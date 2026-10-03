import { Application, Container, Graphics, Texture, type Sprite } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Character, Character3D, Feedback, Interpolator, STAGE, Stage3D, StageGrid, Tweener,
  createWeaponSprite, drawMarker, loadCharacterAsset, loadCutout, motionFeel, type CharacterAsset,
} from '@doodle/engine';
import { DEFAULT_SWING, colorForSlot, type Marker, type Phase, type StoredWeapon } from '@doodle/spec';
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
    this.world.addChild(this.ground, this.actors, this.fx, this.numbers);
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
    if (p === 'draw' || p === 'lobby') this.clearFighters();
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
      v.char.setHp(f.hp / 100);
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
      } else if (ev.type === 'death') {
        // TODO(M1): confetti in the dead player's color.
      }
    });

    // When a weapon row changes (fallback/AI spec, sprite URL), rebuild that fighter's weapon.
    c.db.weapon.onUpdate((_e, _o, w) => { if (mine(w.roomCode)) void this.refreshWeapon(w.player.toHexString()); });
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
    const v: FighterView = { char, body3d, last: null, weapon: null, interp: new Interpolator(), lastAttack: 0n, stored: PLACEHOLDER };
    this.fighters.set(hex, v);
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
    return this.cachedCutout(`png:${key}`, png);
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

  private playAttack(v: FighterView, facing: number) {
    if (!v.weapon) return;
    const mod = ARCHETYPE_MODULES[v.stored.spec.archetype];
    const feel = motionFeel(v.stored.spec.motion);
    void v.body3d?.attack(v.stored.spec.archetype, feel, this.tweener);
    void mod.play(v.weapon, {
      spec: v.stored.spec, stats: v.stored.stats, feel,
      tweener: this.tweener, unit: this.unit, fxLayer: this.fx, facing,
    });
    // TODO(M4): play weapon sound (audio/sfx.ts) using row.sfxUrl or archetype preset.
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

    // Fit the arena to the screen.
    const arenaR = r.arenaR || 10;
    this.unit = Math.min(this.app.screen.width, this.app.screen.height) / (arenaR * 2.3);
    this.world.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    if (this.stage3d) {
      this.stage3d.setView(this.app.screen.width, this.app.screen.height, this.unit);
      this.stage3d.setShake(this.world.pivot.x, this.world.pivot.y);
    } else {
      this.grid.draw(this.app.screen.width / 2, this.app.screen.height / 2, this.unit);
    }
    this.edge.clear().circle(0, 0, arenaR * this.unit).stroke({ color: 0x5a5a5a, width: 2, alpha: 0.6 });
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
    this.stage3d?.render();
    // TODO(M2): render projectile rows; attach vfx emitters per weapon (vfx/index.ts).
  }

  private drawDropMarkers() {
    this.markers.removeChildren();
    if (this.phase !== 'drop' && this.phase !== 'reveal') return;
    const r = this.conn.db.room.code.find(this.code);
    const arenaR = r?.arenaR || 10;
    for (const p of this.conn.db.player.iter()) {
      if (p.roomCode !== this.code || p.dropX < 0) continue;
      const g = new Graphics();
      const c = hexToNum(colorForSlot(p.colorSlot).hex);
      drawMarker(g, p.marker as Marker, (p.dropX * 2 - 1) * arenaR * this.unit, (p.dropY * 2 - 1) * arenaR * this.unit, this.unit * 0.4, c);
      this.markers.addChild(g);
    }
  }
}
