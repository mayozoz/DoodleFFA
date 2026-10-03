import { Application, Assets, Container, Graphics, Texture, type Sprite } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Character, Feedback, Interpolator, Tweener, createWeaponSprite, drawMarker, motionFeel,
} from '@doodle/engine';
import { DEFAULT_SWING, colorForSlot, type Marker, type Phase, type StoredWeapon } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { hexToNum } from '../../ui/theme';

// Display-only stand-in until the fighter's weapon row arrives. Never used for gameplay.
const PLACEHOLDER: StoredWeapon = {
  spec: DEFAULT_SWING,
  stats: { cooldown: 0.6, damagePerHit: 7.2, dotPerSecond: 0, dotSeconds: 0, rangeUnits: 1.6, areaUnits: 1, moveSpeedMul: 1 },
};

interface FighterView {
  char: Character;
  weapon: Sprite | null;
  interp: Interpolator;
  lastAttack: bigint;
  stored: StoredWeapon;
}

/** PixiJS arena for the shared screen: ground, storm, characters, weapons, fx, numbers. */
export class Arena {
  private world = new Container();
  private ground = new Graphics();
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

  private constructor(private app: Application, private conn: DbConnection) {
    this.world.addChild(this.ground, this.storm, this.markers, this.actors, this.fx, this.numbers);
    app.stage.addChild(this.world);
    this.feedback = new Feedback(this.world, this.tweener, this.numbers);
    app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    this.wire();
  }

  static async create(host: HTMLElement, conn: DbConnection): Promise<Arena> {
    const app = new Application();
    await app.init({ resizeTo: window, background: '#14121f', antialias: true });
    host.appendChild(app.canvas);
    return new Arena(app, conn);
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
      const x = ev.x * this.unit, y = ev.y * this.unit;
      if (ev.type === 'hit') {
        const attacker = this.fighters.get(ev.owner.toHexString());
        const weight = attacker?.stored.spec.motion.weight ?? 0.5;
        this.feedback.hitStop(40);
        this.feedback.shake(2 + weight * 10);
        this.feedback.damageNumber(x, y - this.unit, ev.value);
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
    const char = new Character(hexToNum(color.hex), p.marker as Marker, p.name, this.unit);
    this.actors.addChild(char.view);
    const v: FighterView = { char, weapon: null, interp: new Interpolator(), lastAttack: 0n, stored: PLACEHOLDER };
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

  private async loadUrl(url: string): Promise<Texture | null> {
    try { return (this.textures.get(url) ?? (await Assets.load<Texture>(url))); } catch { return null; }
  }

  private async loadPng(key: string, png: Uint8Array): Promise<Texture | null> {
    const cached = this.textures.get(`png:${key}`);
    if (cached) return cached;
    try {
      // TODO(M3): white-to-alpha here if the server-side background removal isn't done.
      const bmp = await createImageBitmap(new Blob([png.slice()], { type: 'image/png' }));
      const tex = Texture.from(bmp);
      this.textures.set(`png:${key}`, tex);
      return tex;
    } catch { return null; }
  }

  private playAttack(v: FighterView, facing: number) {
    if (!v.weapon) return;
    const mod = ARCHETYPE_MODULES[v.stored.spec.archetype];
    v.char.hand.rotation = facing;
    void mod.play(v.weapon, {
      spec: v.stored.spec, stats: v.stored.stats, feel: motionFeel(v.stored.spec.motion),
      tweener: this.tweener, unit: this.unit, fxLayer: this.fx, facing,
    });
    // TODO(M4): play weapon sound (audio/sfx.ts) using row.sfxUrl or archetype preset.
  }

  private removeFighter(hex: string) {
    const v = this.fighters.get(hex);
    v?.char.view.destroy({ children: true });
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

    this.ground.clear().circle(0, 0, arenaR * this.unit).fill(0x2a2640).stroke({ color: 0x4a4466, width: 4 });
    this.storm.clear();
    if (this.phase === 'battle') {
      this.storm.rect(-5000, -5000, 10000, 10000).fill({ color: 0x6b2bd9, alpha: 0.25 })
        .circle(r.stormX * this.unit, r.stormY * this.unit, r.stormR * this.unit).cut();
    }

    this.drawDropMarkers();

    for (const v of this.fighters.values()) {
      const s = v.interp.sample();
      if (!s) continue;
      const prevX = v.char.view.x;
      v.char.view.position.set(s.x * this.unit, s.y * this.unit);
      const speed = Math.min(1, Math.abs(v.char.view.x - prevX) / Math.max(1e-3, dt * this.unit * 5));
      v.char.animate(simDt, speed, v.stored.spec.motion.wobble);
      v.char.view.zIndex = v.char.view.y;
    }
    this.actors.sortableChildren = true;
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
