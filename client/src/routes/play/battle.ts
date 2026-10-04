import { Timestamp } from 'spacetimedb';
import nipplejs from 'nipplejs';
import { ABILITIES, ABILITY_DESCRIPTIONS, ABILITY_STYLES, abilityStyle, ABILITY_TUNING, isAbilityId, MAX_HP, type StoredWeapon } from '@doodle/spec';
import { secondsLeft } from '../../net/clock';
import { haptic } from '../../ui/haptics';
import { click, resumeAudio } from '../../audio/sfx';
import { mountRotateHint } from '../../ui/rotate-hint';
import type { View } from './types';
import './battle-controls.css';
import { weaponArt } from '../../ui/weapon-art';
import { weaponDescription } from '../../ui/weapon-description';

const SEND_HZ = 20;

/** Landscape: joystick left, signature button right (with cooldown ring), HP bar on top. */
export const battleView: View = (ctx) => {
  ctx.el.innerHTML = `
    <div class="battle-controls-shell">
      <div id="hp" style="position:absolute;top:12px;left:50%;translate:-50%;width:40vw;height:14px;border-radius:7px;background:#0006;overflow:hidden">
        <div id="hpfill" style="height:100%;width:100%;background:var(--player)"></div>
      </div>
      <button id="hear-weapon" class="battle-hear" aria-label="Hear your weapon">Hear weapon</button>
      <div class="battle-weapon-info"><div id="weapon-picture"></div><div><span class="battle-info-label">YOUR WEAPON</span><strong id="weapon-name"></strong><p id="weapon-description"></p></div></div>
      <div id="stick" class="battle-stick-zone" aria-label="Movement area"></div>
      <div class="battle-attack-zone">
        <div class="battle-attack-frame">
          <button id="atk" class="battle-sword-button" aria-label="Attack">
            <svg class="battle-sword" viewBox="0 0 48 48" aria-hidden="true">
              <path d="m19 28 5 5L39 18l2-11-11 2z" fill="currentColor"/>
              <path d="m23 29 11-11" fill="none" stroke="#14121f" stroke-width="2" opacity=".25" stroke-linecap="round"/>
              <path d="m15 25 13 13M12 36l8-8M9 39l3-3" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <svg class="battle-sword-cooldown" viewBox="0 0 100 100" aria-hidden="true">
            <circle id="ring" cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/>
          </svg>
        </div>
          <div class="battle-special-group">
            <div class="battle-special-frame">
              <button id="special" class="battle-special" disabled aria-label="Special ability" aria-describedby="special-description"><span id="special-icon" aria-hidden="true">✦</span><span id="special-state">Waiting</span></button>
              <svg class="battle-sword-cooldown" viewBox="0 0 100 100" aria-hidden="true"><circle id="special-ring" cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="3" pathLength="1" stroke-dasharray="1" /></svg>
            </div>
            <div class="battle-special-copy"><strong id="special-name">Special ability</strong><span id="special-charges"></span><p id="special-description"></p></div>
          </div>
      </div>
    </div>`;

  // Non-blocking rotate pill (ui/rotate-hint.ts): a phone with rotation lock can still play.
  const unhint = mountRotateHint(ctx.el, false);
  const zone = ctx.el.querySelector<HTMLElement>('#stick')!;
  const stick = nipplejs.create({ zone, mode: 'dynamic', color: '#fff', size: 120, fadeTime: 0 });
  stick.on('start', () => zone.classList.add('is-active'));
  stick.on('end', () => zone.classList.remove('is-active'));

  // Send the direction vector only when it changes, max 20/s.
  let want = { dx: 0, dy: 0 };
  let sent = { dx: 0, dy: 0 };
  stick.on('move', (_e, d) => {
    const f = Math.min(1, d.force);
    // nipplejs: +y is up; arena: +y is down.
    want = { dx: Math.cos(d.angle.radian) * f, dy: -Math.sin(d.angle.radian) * f };
  });
  stick.on('end', () => (want = { dx: 0, dy: 0 }));
  const sender = setInterval(() => {
    if (Math.abs(want.dx - sent.dx) < 0.02 && Math.abs(want.dy - sent.dy) < 0.02) return;
    sent = want;
    void ctx.conn.reducers.setInput(want);
  }, 1000 / SEND_HZ);

  // Every press: local bounce + click, even during cooldown. Server buffers one press.
  const btn = ctx.el.querySelector<HTMLButtonElement>('#atk')!;
  let active = true;
  const hear = ctx.el.querySelector<HTMLButtonElement>('#hear-weapon')!;
  hear.onclick = async () => {
    const ready = resumeAudio();
    hear.disabled = true;
    hear.textContent = 'Listening…';
    const played = await ready && await ctx.audio?.announce(true);
    if (!active) return;
    hear.disabled = false;
    hear.textContent = played ? 'Hear weapon' : 'Tap to retry';
  };
  btn.onpointerdown = () => {
    btn.animate([{ scale: 1 }, { scale: 0.9 }, { scale: 1 }], { duration: 120 });
    click();
    void ctx.conn.reducers.pressAttack({});
  };

  // Damage feedback follows confirmed server HP changes, never attack presses.
  const onDamage: Parameters<typeof ctx.conn.db.fighter.onUpdate>[0] = (_event, previous, current) => {
    if (current.player.isEqual(ctx.identity) && current.hp < previous.hp) haptic(50);
  };
  ctx.conn.db.fighter.onUpdate(onDamage);
  let artRevision = 0;
  const renderWeapon = () => {
    const w = ctx.conn.db.weapon.player.find(ctx.identity);
    const d = ctx.conn.db.doodle.player.find(ctx.identity);
    const stored = w?.spec ? JSON.parse(w.spec) as StoredWeapon : null;
    ctx.el.querySelector('#weapon-name')!.textContent = stored?.spec.name ?? 'Mystery Stick';
    ctx.el.querySelector('#weapon-description')!.textContent = weaponDescription(stored?.spec ?? null);
    const revision = ++artRevision;
    void weaponArt({ spriteUrl: w?.spriteUrl, png: d?.png }, stored?.spec ?? null).then(art => {
      if (!active || revision !== artRevision) return;
      art.setAttribute('role', 'img');
      art.setAttribute('aria-label', stored?.spec.name ?? 'Your drawn weapon');
      ctx.el.querySelector('#weapon-picture')!.replaceChildren(art);
    });
  };
  const onWeaponUpdate: Parameters<typeof ctx.conn.db.weapon.onUpdate>[0] = (_e, _old, next) => { if (next.player.isEqual(ctx.identity)) renderWeapon(); };
  ctx.conn.db.weapon.onUpdate(onWeaponUpdate);
  renderWeapon();
  const special = ctx.el.querySelector<HTMLButtonElement>('#special')!;
  special.onpointerdown = () => {
    if (special.disabled) return;
    special.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 160 });
    click(); haptic(25);
    void ctx.conn.reducers.pressAbility({});
  };

  // Cooldown ring + HP from our own fighter row.
  const ring = ctx.el.querySelector<SVGCircleElement>('#ring')!;
  const specialRing = ctx.el.querySelector<SVGCircleElement>('#special-ring')!;
  const specialName = ctx.el.querySelector<HTMLElement>('#special-name')!;
  const specialState = ctx.el.querySelector<HTMLElement>('#special-state')!;
  const specialCharges = ctx.el.querySelector<HTMLElement>('#special-charges')!;
  const specialDescription = ctx.el.querySelector<HTMLElement>('#special-description')!;
  const specialIcon = ctx.el.querySelector<HTMLElement>('#special-icon')!;
  const hpFill = ctx.el.querySelector<HTMLDivElement>('#hpfill')!;
  let raf = 0;
  const loop = () => {
    const f = ctx.conn.db.fighter.player.find(ctx.identity);
    const w = ctx.conn.db.weapon.player.find(ctx.identity);
    if (f) {
      const ability = isAbilityId(f.abilityId) ? ABILITIES[f.abilityId] : ABILITIES.flash;
      const abilityLeft = secondsLeft(f.abilityReadyAt);
      const effects = JSON.parse(f.effects) as Record<string, { until: number }>;
      const statusLocked = ['silenced', 'frozen'].some(key => effects[key] && secondsLeft(new Timestamp(BigInt(Math.round(effects[key]!.until * 1e6)))) > 0);
      special.disabled = f.hp <= 0 || f.abilityCharges === 0 || abilityLeft > 0 || statusLocked;
      specialName.textContent = ability.name;
      specialIcon.textContent = ABILITY_STYLES[abilityStyle(f.abilityId)].icon;
      specialDescription.textContent = ABILITY_DESCRIPTIONS[isAbilityId(f.abilityId) ? f.abilityId : 'flash'];
      specialCharges.textContent = `${f.abilityCharges}/${ABILITY_TUNING.charges} uses left`;
      const state = f.hp <= 0 ? 'Out' : f.abilityCharges === 0 ? 'Empty' : statusLocked ? 'Blocked' : abilityLeft > 0 ? `${Math.ceil(abilityLeft)}s` : 'Ready';
      specialState.textContent = state;
      special.setAttribute('aria-label', `${ability.name}: ${state}, ${f.abilityCharges} uses left`);
      specialRing.style.strokeDashoffset = String(Math.min(1, Math.max(0, abilityLeft / ability.cooldown)));
      hpFill.style.width = `${Math.max(0, (f.hp / MAX_HP) * 100)}%`;
      const rage = effects.rage && secondsLeft(new Timestamp(BigInt(Math.round(effects.rage.until * 1e6)))) > 0;
      const cd = (w?.spec ? (JSON.parse(w.spec) as StoredWeapon).stats.cooldown : 0.6) / (rage ? ABILITY_TUNING.attackSpeedMultiplier : 1);
      const left = secondsLeft(f.cooldownReadyAt);
      ring.style.strokeDashoffset = String(Math.min(1, left / cd));
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  return () => {
    ctx.conn.db.fighter.removeOnUpdate(onDamage);
    ctx.conn.db.weapon.removeOnUpdate(onWeaponUpdate);
    active = false;
    clearInterval(sender);
    cancelAnimationFrame(raf);
    stick.destroy();
    unhint();
    void ctx.conn.reducers.setInput({ dx: 0, dy: 0 });
  };
};
