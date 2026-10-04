import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Character, Character3D, Feedback, Interpolator, STAGE, Stage3D, StageGrid, Tweener,
  createWeaponSprite, drawMarker, ease, loadCharacterAsset, loadCutout, motionFeel, type CharacterAsset,
} from '@doodle/engine';
import { DEFAULT_SWING, MAX_HP, arenaExtents, colorForSlot, type Marker, type Phase, type ProjectileMeta, type StoredWeapon } from '@doodle/spec';
import { PROJECTILE } from '../../../../server/src/balance';
import { serverNowMs } from '../../net/clock';
import type { DbConnection } from '../../module_bindings';
import { hexToNum } from '../../ui/theme';

// Display-only stand-in until the fighter's weapon row arrives. Never used for gameplay.
const PLACEHOLDER: StoredWeapon = {
  spec: DEFAULT_SWING,
  stats: { cooldown: 0.6, damagePerHit: 7.2, dotPerSecond: 0, dotSeconds: 0, rangeUnits: 1.6, areaUnits: 1, moveSpeedMul: 1 },
};

const MOVE_SPEED = 5; // units/s — mirrors GAME.moveSpeed, only used to scale the run animation

interface FighterView {
  /** Pixi overlay (hand/weapon, tag, HP) — or the full 2D rig when 3D is unavailable */
  char: Character;
  body3d: Character3D | null;
  last: { x: number; y: number } | null;
  weapon: Sprite | null;
  interp: Interpolator;
  lastAttack: bigint;
  stored: StoredWeapon;
  /** set once HP hits 0; the avatar + weapon fade out and stay hidden for the rest of the round */
  dead: boolean;
}

const DEATH_FADE_S = 0.9;

/** One rendered projectile row: a glowing shot, or the owner's weapon flying (throw). */
interface ProjectileView {
  view: Container;
  shadow: Graphics | null;
  interp: Interpolator;
  meta: ProjectileMeta;
  owner: string;
  expiresMs: number;
  spin: number;
}

/**
 * Shared-screen arena. With the 3D character: three.js draws floor grid + bodies on a canvas
 * underneath; this Pixi canvas (transparent) draws weapons, fx, tags, storm and markers on top,
 * placed with Stage3D.toScreen so both layers line up. Without it: everything is 2D Pixi.
 */
export class Arena {
  private world = new Container();
  private grid = new StageGrid();
  /** ground-plane layer: squashed vertically to match the tilted 3D camera */
  private ground = new Container();
  /** faint ring at the arena wall — fighters are clamped to it, so keep it visible */
  private edge = new Graphics();
  private storm = new Graphics();
  private markers = new Container();
  private actors = new Container();
  private fx = new Container();
  private shots = new Container();
  private projectiles = new Map<bigint, ProjectileView>();
  private numbers = new Container();
  private tweener = new Tweener();
  private feedback: Feedback;
  private fighters = new Map<string, FighterView>();
  private textures = new Map<string, Texture>();
  private code = '';
  private phase: Phase = 'lobby';
  private unit = 40; // px per world unit, recomputed from arena radius

  private constructor(
    private app: Application,
    private conn: DbConnection,
    private stage3d: Stage3D | null,
    private asset: CharacterAsset | null,
  ) {
    this.ground.addChild(this.edge, this.storm, this.markers);
    if (stage3d) this.ground.scale.y = Stage3D.groundScaleY;
    else this.world.addChild(this.grid.view);
    this.world.addChild(this.ground, this.actors, this.shots, this.fx, this.numbers);
    app.stage.addChild(this.world);
    this.feedback = new Feedback(this.world, this.tweener, this.numbers);
    app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    this.wire();
  }

  static async create(host: HTMLElement, conn: DbConnection): Promise<Arena> {
    // A missing/broken model must never stall the round: fall back to the 2D rig.
    const asset = await loadCharacterAsset().catch((e: unknown) => {
      console.warn('[arena] 3D character unavailable, using 2D rig', e);
      return null;
    });
    const stage3d = asset ? new Stage3D() : null;
    if (stage3d) host.appendChild(stage3d.canvas);
    const app = new Application();
    await app.init({ resizeTo: window, background: STAGE.background, backgroundAlpha: stage3d ? 0 : 1, antialias: true });
    Object.assign(app.canvas.style, { position: 'absolute', inset: '0' });
    host.appendChild(app.canvas);
    return new Arena(app, conn, stage3d, asset);
  }

  /** game (x, y, height) → Pixi world-container coords */
  private toScreen(x: number, y: number, h = 0) {
    return this.stage3d ? Stage3D.toScreen(x, y, h, this.unit) : { x: x * this.unit, y: (y - h * 0.5) * this.unit };
  }

  setRoom(code: string) { this.code = code; }
  setPhase(p: Phase) {
    this.phase = p;
    if (p === 'draw' || p === 'lobby') {
      // Round boundary: drop every fighter and every weapon texture, so nobody's old doodle
      // can show up next round.
      this.clearFighters();
      for (const id of [...this.projectiles.keys()]) this.removeProjectile(id);
      for (const tex of this.textures.values()) tex.destroy(true);
      this.textures.clear();
    }
  }

  private wire() {
    const c = this.conn;
    const mine = (roomCode: string) => roomCode === this.code;

    c.db.fighter.onInsert((_e, f) => { if (mine(f.roomCode)) void this.ensureFighter(f.player.toHexString()); });
    c.db.fighter.onUpdate((_e, _old, f) => {
      if (!mine(f.roomCode)) return;
      const v = this.fighters.get(f.player.toHexString());
      if (!v) return;
      v.interp.push(f.x, f.y, f.facing);
      v.char.setHp(f.hp / MAX_HP);
      if (f.hp <= 0) this.killFighter(v);
      if (f.lastAttackAt.microsSinceUnixEpoch !== v.lastAttack) {
        v.lastAttack = f.lastAttackAt.microsSinceUnixEpoch;
        this.playAttack(v, f.facing);
      }
    });
    c.db.fighter.onDelete((_e, f) => this.removeFighter(f.player.toHexString()));

    c.db.fxEvent.onInsert((_e, ev) => {
      if (!mine(ev.roomCode)) return;
      const { x, y } = this.toScreen(ev.x, ev.y, 1.2);
      if (ev.type === 'hit') {
        const attacker = this.fighters.get(ev.owner.toHexString());
        const weight = attacker?.stored.spec.motion.weight ?? 0.5;
        this.feedback.hitStop(40);
        this.feedback.shake(2 + weight * 10);
        this.feedback.damageNumber(x, y, ev.value);
        // TODO(M1): flash the victim — needs victim id on the event (add `target` column).
      } else if (ev.type === 'shockwave') {
        // slam / lobbed-shot landing: ring on the ground (ground layer is foreshortened like the 3D floor)
        this.shockwave(ev.x, ev.y, ev.value, ev.owner.toHexString());
      } else if (ev.type === 'death') {
        // TODO(M1): confetti in the dead player's color.
      }
    });

    c.db.projectile.onInsert((_e, p) => { if (mine(p.roomCode)) this.addProjectile(p); });
    c.db.projectile.onUpdate((_e, _o, p) => {
      const v = this.projectiles.get(p.id);
      if (!v) return;
      v.interp.push(p.x, p.y, Math.atan2(p.vy, p.vx));
      try { v.meta = JSON.parse(p.hits) as ProjectileMeta; } catch { /* keep last */ }
    });
    c.db.projectile.onDelete((_e, p) => this.removeProjectile(p.id));

    // When a weapon row changes (fallback/AI spec, sprite URL), rebuild that fighter's weapon.
    const prepareWeapon = (w: { roomCode: string; player: { toHexString(): string }; spec: string; sfxUrl: string }) => {
      if (!mine(w.roomCode)) return;
      void this.refreshWeapon(w.player.toHexString());
    };
    c.db.weapon.onInsert((_e, w) => prepareWeapon(w));
    c.db.weapon.onUpdate((_e, _o, w) => prepareWeapon(w));
  }

  private async ensureFighter(hex: string) {
    if (this.fighters.has(hex)) return;
    const p = [...this.conn.db.player.iter()].find((x) => x.identity.toHexString() === hex);
    if (!p) return;
    const color = colorForSlot(p.colorSlot);
    const tint = hexToNum(color.hex);
    const char = new Character(tint, p.marker as Marker, p.name, this.unit, { overlay: !!this.stage3d });
    this.actors.addChild(char.view);
    let body3d: Character3D | null = null;
    if (this.stage3d && this.asset) {
      body3d = new Character3D(this.asset, tint);
      this.stage3d.scene.add(body3d.root);
    }
    const v: FighterView = { char, body3d, last: null, weapon: null, interp: new Interpolator(), lastAttack: 0n, stored: PLACEHOLDER, dead: false };
    this.fighters.set(hex, v);
    // Joined mid-battle (e.g. screen reload): someone already out shouldn't pop back in.
    const row = [...this.conn.db.fighter.iter()].find((f) => f.player.toHexString() === hex);
    if (row && row.hp <= 0) this.killFighter(v, true);
    await this.refreshWeapon(hex);
  }

  private async refreshWeapon(hex: string) {
    const v = this.fighters.get(hex);
    if (!v) return;
    const row = [...this.conn.db.weapon.iter()].find((w) => w.player.toHexString() === hex);
    v.stored = row?.spec ? (JSON.parse(row.spec) as StoredWeapon) : PLACEHOLDER;
    const doodle = [...this.conn.db.doodle.iter()].find((d) => d.player.toHexString() === hex);

    let tex: Texture | null = null;
    let raw = false;
    if (row?.spriteUrl) tex = await this.loadUrl(row.spriteUrl);
    if (!tex && doodle) { tex = await this.loadPng(hex, doodle.png); raw = true; }
    if (!tex) return;

    v.weapon?.destroy();
    v.weapon = createWeaponSprite(tex, v.stored, this.unit, raw);
    v.char.hand.addChild(v.weapon);
  }

  /** Generated sprite from S3. Cut out the white too: server-side background removal isn't built. */
  private async loadUrl(url: string): Promise<Texture | null> {
    return this.cachedCutout(url, url);
  }

  /** Raw doodle PNG (sprite fallback): strokes only, no white box. */
  private async loadPng(key: string, png: Uint8Array): Promise<Texture | null> {
    // Keyed by content, not just player: a re-submitted drawing must never reuse the old texture.
    return this.cachedCutout(`png:${key}:${png.length}:${hashBytes(png)}`, png);
  }

  private async cachedCutout(key: string, src: string | Uint8Array): Promise<Texture | null> {
    const cached = this.textures.get(key);
    if (cached) return cached;
    try {
      const tex = Texture.from(await loadCutout(src));
      this.textures.set(key, tex);
      return tex;
    } catch { return null; }
  }

  /** Fade the dead fighter's avatar (3D body + ring) and overlay (weapon, tag, HP bar) out of the arena. */
  private killFighter(v: FighterView, instant = false) {
    if (v.dead) return;
    v.dead = true;
    const hide = () => {
      v.char.view.visible = false;
      v.body3d?.setOpacity(0);
    };
    if (instant) return hide();
    void this.tweener.to(DEATH_FADE_S, (t) => {
      const a = 1 - t;
      v.char.view.alpha = a;
      v.body3d?.setOpacity(a);
    }, ease.inQuad).then(hide);
    // TODO(M1): death confetti in the player's color (fx_event 'death' already fires).
  }

  private playAttack(v: FighterView, facing: number) {
    if (!v.weapon || v.dead) return;
    const mod = ARCHETYPE_MODULES[v.stored.spec.archetype];
    const feel = motionFeel(v.stored.spec.motion, v.stored.spec.archetype);
    void v.body3d?.attack(v.stored.spec.archetype, feel, this.tweener);
    void mod.play(v.weapon, {
      spec: v.stored.spec, stats: v.stored.stats, feel,
      tweener: this.tweener, unit: this.unit, fxLayer: this.fx, facing,
      from: v.last ?? undefined,
      project: (x, y, h = 0) => this.toScreen(x, y, h),
    });
  }

  private shockwave(x: number, y: number, radius: number, ownerHex: string) {
    const owner = [...this.conn.db.player.iter()].find((p) => p.identity.toHexString() === ownerHex);
    const color = owner ? hexToNum(colorForSlot(owner.colorSlot).hex) : 0xffffff;
    const g = new Graphics();
    this.ground.addChild(g);
    const cx = x * this.unit, cy = y * this.unit; // ground layer is already squashed vertically
    void this.tweener.to(0.35, (t) => {
      const r = radius * this.unit * (0.3 + 0.7 * t);
      g.clear().circle(cx, cy, r).stroke({ color: 0xffffff, width: 6 * (1 - t), alpha: 1 - t })
        .circle(cx, cy, r * 0.92).stroke({ color, width: 3 * (1 - t), alpha: 1 - t });
    }).then(() => g.destroy());
  }

  private addProjectile(p: { id: bigint; owner: { toHexString(): string }; x: number; y: number; vx: number; vy: number; hits: string; expiresAt: { toMillis(): bigint } }) {
    let meta: ProjectileMeta;
    try { meta = JSON.parse(p.hits) as ProjectileMeta; } catch { return; }
    const owner = p.owner.toHexString();
    const fv = this.fighters.get(owner);
    const view = new Container();
    let shadow: Graphics | null = null;
    if (meta.k === 'throw' && fv?.weapon) {
      // the owner's actual weapon flies; their hand is empty until it comes back
      const s = new Sprite(fv.weapon.texture);
      s.anchor.copyFrom(fv.weapon.anchor);
      s.scale.set(fv.weapon.scale.x * 0.8);
      if (fv.weapon.filters) s.filters = [...fv.weapon.filters];
      view.addChild(s);
      fv.weapon.visible = false;
    } else {
      const player = [...this.conn.db.player.iter()].find((x) => x.identity.toHexString() === owner);
      const outline = player ? hexToNum(colorForSlot(player.colorSlot).hex) : 0xffffff;
      const pal = fv?.stored.spec.palette[0];
      const fill = pal ? hexToNum(pal) : 0xfff3a0;
      const r = meta.r * this.unit;
      // weapon's own color, thin outline in the player's color (brief §3)
      view.addChild(new Graphics().circle(0, 0, r * 1.6).fill({ color: fill, alpha: 0.25 }).circle(0, 0, r).fill(fill).stroke({ color: outline, width: 2 }));
      if (meta.beh === 'arc') {
        shadow = new Graphics().ellipse(0, 0, r, r * 0.5).fill({ color: 0x000000, alpha: 0.35 });
        this.shots.addChild(shadow);
      }
    }
    this.shots.addChild(view);
    const interp = new Interpolator();
    interp.push(p.x, p.y, Math.atan2(p.vy, p.vx));
    this.projectiles.set(p.id, { view, shadow, interp, meta, owner, expiresMs: Number(p.expiresAt.toMillis()), spin: 0 });
  }

  private removeProjectile(id: bigint) {
    const v = this.projectiles.get(id);
    if (!v) return;
    v.view.destroy({ children: true });
    v.shadow?.destroy();
    this.projectiles.delete(id);
    if (v.meta.k === 'throw') {
      // weapon is back in hand (unless another throw from the same owner is still out)
      const stillOut = [...this.projectiles.values()].some((o) => o.owner === v.owner && o.meta.k === 'throw');
      const fv = this.fighters.get(v.owner);
      if (fv?.weapon && !stillOut) fv.weapon.visible = true;
    }
  }

  private drawProjectiles(dt: number) {
    const now = serverNowMs();
    for (const v of this.projectiles.values()) {
      const s = v.interp.sample();
      if (!s) continue;
      let h = 1.0; // shots fly at about hand height
      if (v.meta.k === 'shot' && v.meta.beh === 'arc') {
        const life = Math.max(1, v.expiresMs - v.meta.t0);
        const t = Math.min(1, Math.max(0, (now - v.meta.t0) / life));
        h = 0.6 + 4 * PROJECTILE.arcPeakHeight * t * (1 - t);
        const g = this.toScreen(s.x, s.y, 0);
        v.shadow?.position.set(g.x, g.y);
      }
      const p = this.toScreen(s.x, s.y, h);
      v.view.position.set(p.x, p.y);
      if (v.meta.k === 'throw') { v.spin += dt * 16; v.view.rotation = v.spin; }
    }
  }

  private removeFighter(hex: string) {
    const v = this.fighters.get(hex);
    v?.char.view.destroy({ children: true });
    v?.body3d?.dispose();
    this.fighters.delete(hex);
  }

  private clearFighters() {
    for (const hex of [...this.fighters.keys()]) this.removeFighter(hex);
  }

  private frame(dt: number) {
    const simDt = this.feedback.step(dt);
    this.tweener.step(dt);
    const r = this.conn.db.room.code.find(this.code);
    if (!r) return;

    // Fit the screen-shaped arena rectangle to the screen (letterboxed if the aspect differs).
    const arenaR = r.arenaR || 10;
    const { hw, hh } = arenaExtents(arenaR);
    const k = this.stage3d ? Stage3D.groundScaleY : 1;
    this.unit = Math.min(this.app.screen.width / (2 * hw), this.app.screen.height / (2 * hh * k));
    this.world.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    if (this.stage3d) {
      this.stage3d.setView(this.app.screen.width, this.app.screen.height, this.unit);
      this.stage3d.setShake(this.world.pivot.x, this.world.pivot.y);
    } else {
      this.grid.draw(this.app.screen.width / 2, this.app.screen.height / 2, this.unit);
    }
    this.edge.clear().rect(-hw * this.unit, -hh * this.unit, 2 * hw * this.unit, 2 * hh * this.unit).stroke({ color: 0x5a5a5a, width: 2, alpha: 0.6 });
    this.storm.clear();
    if (this.phase === 'battle') {
      this.storm.rect(-5000, -5000, 10000, 10000).fill({ color: 0x6b2bd9, alpha: 0.25 })
        .circle(r.stormX * this.unit, r.stormY * this.unit, r.stormR * this.unit).cut();
    }

    this.drawDropMarkers();

    for (const v of this.fighters.values()) {
      const s = v.interp.sample();
      if (!s) continue;
      const moved = v.last ? Math.hypot(s.x - v.last.x, s.y - v.last.y) : 0;
      v.last = { x: s.x, y: s.y };
      const speed = Math.min(1, moved / Math.max(1e-3, dt * MOVE_SPEED));
      const feet = this.toScreen(s.x, s.y);
      v.char.view.position.set(feet.x, feet.y);
      // weapon points along the facing, as seen through the tilted camera
      v.char.aim = Math.atan2(Math.sin(s.facing) * (this.stage3d ? Stage3D.groundScaleY : 1), Math.cos(s.facing));
      if (v.body3d) {
        v.body3d.setTransform(s.x, s.y, s.facing);
        v.body3d.update(simDt, speed);
        const hand = v.body3d.handPosition();
        const hp = this.toScreen(hand.x, hand.y, hand.h), head = this.toScreen(s.x, s.y, v.body3d.headHeight);
        v.char.layout3D({ x: hp.x - feet.x, y: hp.y - feet.y }, { x: head.x - feet.x, y: head.y - feet.y });
      }
      v.char.animate(simDt, speed, v.stored.spec.motion.wobble);
      v.char.view.zIndex = feet.y;
    }
    this.actors.sortableChildren = true;
    this.drawProjectiles(simDt);
    this.stage3d?.render();
    // TODO: attach vfx emitters per weapon (vfx/index.ts).
  }

  private drawDropMarkers() {
    this.markers.removeChildren();
    if (this.phase !== 'drop' && this.phase !== 'reveal') return;
    const r = this.conn.db.room.code.find(this.code);
    // Before battle the room has no arena size yet; preview with the size this many players will get.
    const count = [...this.conn.db.player.iter()].filter((p) => p.roomCode === this.code).length;
    const { hw, hh } = arenaExtents(r?.arenaR || 8 + 1.5 * count);
    for (const p of this.conn.db.player.iter()) {
      if (p.roomCode !== this.code || p.dropX < 0) continue;
      const g = new Graphics();
      const c = hexToNum(colorForSlot(p.colorSlot).hex);
      drawMarker(g, p.marker as Marker, (p.dropX * 2 - 1) * (hw - 1) * this.unit, (p.dropY * 2 - 1) * (hh - 1) * this.unit, this.unit * 0.4, c);
      this.markers.addChild(g);
    }
  }
}

/** FNV-1a over the bytes — cheap content key for doodle textures. */
function hashBytes(b: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i]!, 16777619);
  return (h >>> 0).toString(36);
}
