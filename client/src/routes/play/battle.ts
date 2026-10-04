import { Timestamp } from 'spacetimedb';
import nipplejs from 'nipplejs';
import { ABILITIES, ABILITY_TUNING, isAbilityId, MAX_HP, type StoredWeapon } from '@doodle/spec';
import { secondsLeft } from '../../net/clock';
import { haptic } from '../../ui/haptics';
import { click, resumeAudio } from '../../audio/sfx';
import type { View } from './types';

const SEND_HZ = 20;

/** Landscape: joystick left, signature button right (with cooldown ring), HP bar on top. */
export const battleView: View = (ctx) => {
  ctx.el.innerHTML = `
    <div style="position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr">
      <div id="hp" style="position:absolute;top:12px;left:50%;translate:-50%;width:40vw;height:14px;border-radius:7px;background:#0006;overflow:hidden">
        <div id="hpfill" style="height:100%;width:100%;background:var(--player)"></div>
      </div>
      <button id="hear-weapon" style="position:absolute;top:36px;right:12px;z-index:1;font-size:14px;padding:8px 12px">Hear weapon</button>
      <div id="stick" style="position:relative"></div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
        <button id="atk" style="position:relative;width:38vmin;height:38vmin;border-radius:50%;font-size:28px">
          <svg viewBox="0 0 100 100" style="position:absolute;inset:-8px;width:calc(100% + 16px);height:calc(100% + 16px);rotate:-90deg">
            <circle id="ring" cx="50" cy="50" r="48" fill="none" stroke="#fff" stroke-width="4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/>
          </svg>
        </button>
        <button id="special" style="font-size:18px;padding:12px 20px;border-radius:16px;min-width:180px">Special · 2/2</button>
      </div>
    </div>`;

  const player = ctx.conn.db.player.identity.find(ctx.identity);
  const color = player ? getComputedStyle(document.documentElement).getPropertyValue('--player') : '#fff';
  const stick = nipplejs.create({ zone: ctx.el.querySelector<HTMLElement>('#stick')!, mode: 'dynamic', color });

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

  // Every press: local bounce + click + haptic, even during cooldown. Server buffers one press.
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
    haptic(15);
    void ctx.conn.reducers.pressAttack({});
  };

  const special = ctx.el.querySelector<HTMLButtonElement>('#special')!;
  special.onpointerdown = () => {
    if (special.disabled) return;
    click(); haptic(25);
    void ctx.conn.reducers.pressAbility({});
  };

  // Cooldown ring + HP from our own fighter row.
  const ring = ctx.el.querySelector<SVGCircleElement>('#ring')!;
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
      special.style.opacity = special.disabled ? '0.5' : '1';
      special.textContent = `${ability.name} · ${f.abilityCharges}/${ABILITY_TUNING.charges}${abilityLeft > 0 ? ` · ${Math.ceil(abilityLeft)}s` : statusLocked ? ' · Blocked' : ''}`;
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
    active = false;
    clearInterval(sender);
    cancelAnimationFrame(raf);
    stick.destroy();
    void ctx.conn.reducers.setInput({ dx: 0, dy: 0 });
  };
};
