import { Application, Container, Graphics, Texture } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Character, Character3D, Feedback, ParticleSystem, STAGE, Stage3D, StageGrid, Tweener,
  createWeaponSprite, loadCharacterAsset, loadCutout, motionFeel, vfxParams, type CharacterAsset,
} from '@doodle/engine';
import { ARCHETYPES, VFX_TYPES, balance, type StoredWeapon, type WeaponSpec } from '@doodle/spec';
import { BALANCE } from '../../../server/src/balance';

// /dev/weapons — feel-tuning playground. Loads the fixtures + sample sprites, lets you toggle
// archetype, effects and motion sliders, and replays the attack. Never linked from player UI.
//
// Imports server/src/balance.ts directly (it's dependency-free) so stats match the server.
//
// Uses the 3D character when client/public/models/character/character.glb loads (else the 2D rig).
// ?pose=<archetype>&t=<0..3> freezes the body's attack timeline (0–1 wind-up, 1–2 strike,
// 2–3 recover) for tuning packages/engine/src/three/poses.ts. Add &noweapon to see the body alone, &run to start running,
// &fixture=<name> to pick the starting weapon.

const fixtures = import.meta.glob<WeaponSpec>('../../../packages/spec/fixtures/*.json', { eager: true, import: 'default' });

export async function mount(el: HTMLElement) {
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:300px 1fr;height:100dvh">
      <aside id="panel" style="padding:12px;overflow:auto;background:#0003;font-size:14px;touch-action:auto;user-select:auto"></aside>
      <div id="stage" style="position:relative;overflow:hidden"></div>
    </div>`;
  const host = el.querySelector<HTMLElement>('#stage')!;
  const asset: CharacterAsset | null = await loadCharacterAsset().catch((e: unknown) => {
    console.warn('[dev] 3D character unavailable, using 2D rig', e);
    return null;
  });

  // 3D: three.js canvas (floor + body) underneath, transparent Pixi canvas (weapon, fx, tags) on top.
  const stage3d = asset ? new Stage3D() : null;
  if (stage3d) host.appendChild(stage3d.canvas);
  const app = new Application();
  await app.init({ resizeTo: host, background: STAGE.background, backgroundAlpha: stage3d ? 0 : 1, antialias: true });
  Object.assign(app.canvas.style, { position: 'absolute', inset: '0' });
  host.appendChild(app.canvas);

  const unit = 80;
  const world = new Container();
  const fxLayer = new Container();
  const numbers = new Container();
  const particles = new ParticleSystem();
  const grid = new StageGrid();
  if (!stage3d) world.addChild(grid.view);
  world.addChild(fxLayer, particles.view, numbers);
  app.stage.addChild(world);
  const tweener = new Tweener();
  const feedback = new Feedback(world, tweener, numbers);
  const char = new Character(0x2f9bff, 'triangle', 'Tester', unit, { overlay: !!stage3d });
  world.addChildAt(char.view, stage3d ? 0 : 1);
  const body3d = asset && stage3d ? new Character3D(asset, 0x2f9bff) : null;
  if (body3d) stage3d!.scene.add(body3d.root);

  const DUMMY = { x: 2.2, y: 0 };
  const dummyPos = stage3d ? Stage3D.toScreen(DUMMY.x, DUMMY.y, 0.5, unit) : { x: DUMMY.x * unit, y: 0 };
  const dummy = new Graphics().circle(0, 0, unit * 0.5).fill(0xff3b3b);
  dummy.position.set(dummyPos.x, dummyPos.y);
  world.addChild(dummy);

  const params = new URLSearchParams(location.search);
  const frozenPose = params.get('pose') as WeaponSpec['archetype'] | null;
  const frozenT = Number(params.get('t') ?? 1);
  const hideWeapon = params.has('noweapon');
  let running = params.has('run');

  const placeholder = placeholderTexture(app);
  const names = Object.keys(fixtures);
  let spec: WeaponSpec = structuredClone(Object.values(fixtures)[0]!);
  let tex: Texture = Texture.WHITE;
  let sprite = createWeaponSprite(tex, toStored(spec), unit);

  const loadSprite = async (fixturePath: string) => {
    const base = fixturePath.split('/').pop()!.replace('.json', '');
    // The dev server answers missing files with index.html (200), so check it's really an image.
    const url = `/dev-sprites/${base}.png`;
    const isImage = await fetch(url, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('image/'), () => false);
    try { tex = isImage ? Texture.from(await loadCutout(url)) : placeholder; } catch { tex = placeholder; }
    rebuild();
  };
  const rebuild = () => {
    sprite.destroy();
    // dev-sprites are raw doodles, so preview them exactly like the in-round fallback (outline + glow)
    sprite = createWeaponSprite(tex, toStored(spec), unit, tex !== placeholder);
    sprite.visible = !hideWeapon;
    char.hand.addChild(sprite);
    renderPanel();
  };
  const attack = () => {
    const stored = toStored(spec);
    void body3d?.attack(spec.archetype, motionFeel(spec.motion), tweener);
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
      ${body3d ? `<label><input type="checkbox" id="run" ${running ? 'checked' : ''}> Running (attack while running)</label>` : '<p>2D rig (no character.glb)</p>'}
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
    const run = panel.querySelector<HTMLInputElement>('#run');
    if (run) run.onchange = () => (running = run.checked);
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
    const w = app.screen.width, h = app.screen.height;
    world.position.set(w / 2 - unit, h / 2);
    const simDt = feedback.step(dt);
    tweener.step(dt);
    particles.step(simDt);

    if (stage3d && body3d) {
      body3d.setTransform(0, 0, 0); // facing the dummy (+x)
      if (frozenPose) body3d.setPoseAt(frozenPose, frozenT);
      body3d.update(simDt, running ? 1 : 0);
      stage3d.setView(w, h, unit, { x: -unit, y: 0 });
      stage3d.setShake(world.pivot.x, world.pivot.y);
      stage3d.render();
      const hand = body3d.handPosition();
      char.layout3D(Stage3D.toScreen(hand.x, hand.y, hand.h, unit), Stage3D.toScreen(0, 0, body3d.headHeight, unit));
    } else {
      grid.draw(w / 2 + unit, h / 2, unit);
    }
    char.animate(simDt, running ? 1 : 0, spec.motion.wobble);
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

  // ?fixture=sparkle-sword picks the starting fixture
  const start = Math.max(0, names.findIndex((n) => n.endsWith(`/${params.get('fixture')}.json`)));
  spec = structuredClone(fixtures[names[start]!]!);
  await loadSprite(names[start]!);
  panel.querySelector<HTMLSelectElement>('#fx')!.selectedIndex = start;
}

/** Uses the real tuning file so the readout matches the server exactly. */
function toStored(spec: WeaponSpec): StoredWeapon {
  return { spec, stats: balance(spec, BALANCE) };
}

function placeholderTexture(app: Application): Texture {
  const g = new Graphics().roundRect(0, 0, 200, 40, 12).fill(0xd2a26b).stroke({ color: 0x111111, width: 4 });
  return app.renderer.generateTexture(g);
}
