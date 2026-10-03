import { Application, Assets, Container, Graphics, Texture } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Character, Feedback, ParticleSystem, Tweener, createWeaponSprite, motionFeel, vfxParams,
} from '@doodle/engine';
import { ARCHETYPES, VFX_TYPES, balance, type StoredWeapon, type WeaponSpec } from '@doodle/spec';
import { BALANCE } from '../../../server/src/balance';

// /dev/weapons — feel-tuning playground. Loads the fixtures + sample sprites, lets you toggle
// archetype, effects and motion sliders, and replays the attack. Never linked from player UI.
//
// Imports server/src/balance.ts directly (it's dependency-free) so stats match the server.

const fixtures = import.meta.glob<WeaponSpec>('../../../packages/spec/fixtures/*.json', { eager: true, import: 'default' });

export async function mount(el: HTMLElement) {
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;height:100dvh">
      <aside id="panel" style="padding:12px;overflow:auto;background:#0003;font-size:14px;touch-action:auto;user-select:auto"></aside>
      <div id="stage"></div>
    </div>`;
  const app = new Application();
  await app.init({ resizeTo: el.querySelector<HTMLElement>('#stage')!, background: '#2a2640', antialias: true });
  el.querySelector('#stage')!.appendChild(app.canvas);

  const unit = 80;
  const world = new Container();
  const fxLayer = new Container();
  const numbers = new Container();
  const particles = new ParticleSystem();
  world.addChild(fxLayer, particles.view, numbers);
  app.stage.addChild(world);
  const tweener = new Tweener();
  const feedback = new Feedback(world, tweener, numbers);
  const char = new Character(0x2f9bff, 'triangle', 'Tester', unit);
  world.addChildAt(char.view, 0);
  const dummy = new Graphics().circle(0, 0, unit * 0.5).fill(0xff3b3b);
  dummy.position.set(unit * 2.2, 0);
  world.addChild(dummy);

  const names = Object.keys(fixtures);
  let spec: WeaponSpec = structuredClone(Object.values(fixtures)[0]!);
  let tex: Texture = Texture.WHITE;
  let sprite = createWeaponSprite(tex, toStored(spec), unit);

  const loadSprite = async (fixturePath: string) => {
    const base = fixturePath.split('/').pop()!.replace('.json', '');
    try { tex = await Assets.load<Texture>(`/dev-sprites/${base}.png`); } catch { tex = placeholderTexture(app); }
    rebuild();
  };
  const rebuild = () => {
    sprite.destroy();
    sprite = createWeaponSprite(tex, toStored(spec), unit, tex === Texture.WHITE);
    char.hand.addChild(sprite);
    renderPanel();
  };
  const attack = () => {
    const stored = toStored(spec);
    void ARCHETYPE_MODULES[spec.archetype].play(sprite, {
      spec, stats: stored.stats, feel: motionFeel(spec.motion), tweener, unit, fxLayer, facing: 0,
      onStrike: () => {
        const f = motionFeel(spec.motion);
        feedback.hitStop(f.hitPauseMs);
        feedback.shake(f.shake);
        feedback.damageNumber(dummy.x, dummy.y - unit, stored.stats.damagePerHit);
        for (const [i, v] of spec.vfx.entries()) if (v.where === 'impact') particles.emit(dummy.x, dummy.y, 0, vfxParams(v, spec.palette, i), 12);
      },
    });
  };

  const panel = el.querySelector<HTMLElement>('#panel')!;
  const renderPanel = () => {
    const s = toStored(spec).stats;
    panel.innerHTML = `
      <h3>Weapon playground</h3>
      <label>Fixture <select id="fx">${names.map((n) => `<option>${n.split('/').pop()}</option>`).join('')}</select></label>
      <p><button id="go">Attack (space)</button></p>
      <label>Archetype <select id="arch">${ARCHETYPES.map((a) => `<option ${a === spec.archetype ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      ${(['elasticity', 'weight', 'wobble'] as const).map((k) => `
        <div>${k} <input type="range" min="0" max="1" step="0.05" data-m="${k}" value="${spec.motion[k]}"></div>`).join('')}
      <div>range <input type="range" min="0" max="1" step="0.05" data-n="range" value="${spec.range}"></div>
      <div>area <input type="range" min="0" max="1" step="0.05" data-n="area" value="${spec.area}"></div>
      <fieldset><legend>vfx</legend>${VFX_TYPES.map((t) => `
        <label style="display:inline-block;width:45%"><input type="checkbox" data-v="${t}" ${spec.vfx.some((v) => v.type === t) ? 'checked' : ''}> ${t}</label>`).join('')}
      </fieldset>
      <pre style="white-space:pre-wrap">${spec.name}
cooldown ${s.cooldown.toFixed(2)}s · dmg/hit ${s.damagePerHit.toFixed(1)}
range ${s.rangeUnits.toFixed(1)}u · speed ×${s.moveSpeedMul.toFixed(2)}</pre>`;
    panel.querySelector<HTMLButtonElement>('#go')!.onclick = attack;
    panel.querySelector<HTMLSelectElement>('#fx')!.onchange = (e) => {
      const i = (e.target as HTMLSelectElement).selectedIndex;
      spec = structuredClone(fixtures[names[i]!]!);
      void loadSprite(names[i]!);
    };
    panel.querySelector<HTMLSelectElement>('#arch')!.onchange = (e) => { spec.archetype = (e.target as HTMLSelectElement).value as WeaponSpec['archetype']; rebuild(); };
    panel.querySelectorAll<HTMLInputElement>('[data-m]').forEach((i) => (i.oninput = () => { spec.motion[i.dataset.m as 'weight'] = +i.value; renderStatsOnly(); }));
    panel.querySelectorAll<HTMLInputElement>('[data-n]').forEach((i) => (i.oninput = () => { spec[i.dataset.n as 'range'] = +i.value; renderStatsOnly(); }));
    panel.querySelectorAll<HTMLInputElement>('[data-v]').forEach((i) => (i.onchange = () => {
      const t = i.dataset.v as WeaponSpec['vfx'][number]['type'];
      spec.vfx = i.checked ? [...spec.vfx, { type: t, where: 'trail', intensity: 0.7 }] : spec.vfx.filter((v) => v.type !== t);
      renderStatsOnly();
    }));
  };
  const renderStatsOnly = () => {
    const s = toStored(spec).stats;
    panel.querySelector('pre')!.textContent = `${spec.name}\ncooldown ${s.cooldown.toFixed(2)}s · dmg/hit ${s.damagePerHit.toFixed(1)}\nrange ${s.rangeUnits.toFixed(1)}u · speed ×${s.moveSpeedMul.toFixed(2)}`;
  };

  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); attack(); } });

  let trailT = 0;
  app.ticker.add((t) => {
    const dt = t.deltaMS / 1000;
    world.position.set(app.screen.width / 2 - unit, app.screen.height / 2);
    const simDt = feedback.step(dt);
    tweener.step(dt);
    particles.step(simDt);
    char.animate(simDt, 0, spec.motion.wobble);
    trailT += simDt;
    // continuous "trail"/"always" emitters at the weapon tip
    for (const [i, v] of spec.vfx.entries()) {
      if (v.where === 'impact') continue;
      const p = vfxParams(v, spec.palette, i);
      if (trailT * p.rate >= 1) {
        const tip = sprite.toGlobal({ x: sprite.texture.width * (1 - sprite.anchor.x), y: 0 });
        const local = world.toLocal(tip);
        particles.emit(local.x, local.y, -Math.PI / 2, p, 1);
      }
    }
    if (trailT * 60 >= 1) trailT = 0;
  });

  await loadSprite(names[0]!);
}

/** Uses the real tuning file so the readout matches the server exactly. */
function toStored(spec: WeaponSpec): StoredWeapon {
  return { spec, stats: balance(spec, BALANCE) };
}

function placeholderTexture(app: Application): Texture {
  const g = new Graphics().roundRect(0, 0, 200, 40, 12).fill(0xd2a26b).stroke({ color: 0x111111, width: 4 });
  return app.renderer.generateTexture(g);
}
