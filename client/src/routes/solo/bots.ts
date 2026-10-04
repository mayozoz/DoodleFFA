import { extractFeatures, type Drawing, type StrokePoint, type StoredWeapon } from '@doodle/spec';
import { connect } from '../../net/connection';
import { botIntent } from './bot-intent';

function botDrawing(index: number): Drawing {
  const outlines = [
    [[96, 420], [150, 356], [126, 334], [162, 300], [190, 326], [360, 90], [414, 60], [390, 136], [216, 352], [240, 380], [204, 408], [180, 382], [116, 444]],
    [[110, 330], [110, 250], [180, 250], [180, 200], [390, 200], [390, 290], [225, 290], [205, 400], [140, 400], [155, 330], [110, 330]],
    [[110, 380], [110, 130], [155, 130], [310, 255], [155, 380], [110, 380]],
  ];
  const color = ['#ef4444', '#2563eb', '#16a34a'][index]!;
  return { width: 512, height: 512, strokes: [{ color, width: 18, points: outlines[index]!.map(([x, y], i) => [x!, y!, i * 30] as StrokePoint) }] };
}

function rasterize(drawing: Drawing) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512); g.lineJoin = g.lineCap = 'round';
  for (const stroke of drawing.strokes) {
    g.strokeStyle = stroke.color; g.lineWidth = stroke.width; g.beginPath();
    stroke.points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
  }
  const raw = atob(canvas.toDataURL('image/png').split(',')[1]!);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Bots send ordinary controller intents; damage, cooldowns and wins remain server-authoritative. */
export async function mountSoloBots(code: string, onBotJoined: (id: string) => void = () => {}): Promise<() => void> {
  const stops: (() => void)[] = [];
  try {
    // Sequential setup lets a failed connection clean up every bot already joined.
    for (let index = 0; index < 3; index++) {
      const { conn, identity } = await connect(`solo-bot-${index}`);
      let active = true;
      let timer = 0;
      stops.push(() => { active = false; clearInterval(timer); conn.disconnect(); });
      onBotJoined(identity.toHexString());
      await conn.reducers.joinRoom({ code, name: ['Bot Ruby', 'Bot Azure', 'Bot Clover'][index]! });
      const drawing = botDrawing(index), png = rasterize(drawing), features = JSON.stringify(extractFeatures(drawing));
      let submittedRound = -1, deployedRound = -1, busy = false, ticks = 0;
      const update = async () => {
        if (!active || busy) return;
        const room = conn.db.room.code.find(code);
        if (!room) return;
        busy = true;
        try {
          if ((room.phase === 'draw' || room.phase === 'drop') && submittedRound !== room.round) {
            await conn.reducers.submitDrawing({ strokes: JSON.stringify(drawing), png, features });
            submittedRound = room.round;
          }
          if (room.phase === 'drop' && deployedRound !== room.round) {
            await conn.reducers.prepareWeapon({});
            await conn.reducers.setDrop({ x: [.2, .8, .5][index]!, y: [.3, .3, .8][index]! });
            deployedRound = room.round;
          }
          if (room.phase === 'battle') {
            const self = conn.db.fighter.player.find(identity);
            if (!self) return;
            const fighters = [...conn.db.fighter.iter()].map(f => ({ id: f.player.toHexString(), x: f.x, y: f.y, hp: f.hp }));
            const w = conn.db.weapon.player.find(identity);
            const spec = w?.spec ? (JSON.parse(w.spec) as StoredWeapon).spec : null;
            const intent = botIntent({ ...self, id: identity.toHexString() }, fighters, ['shoot', 'beam', 'throw'].includes(spec?.archetype ?? ''));
            await conn.reducers.setInput({ dx: intent.dx, dy: intent.dy });
            if (intent.attack && ticks % 6 === 0) await conn.reducers.pressAttack({});
            if (intent.special && self.abilityCharges > 0 && ticks % 30 === 0) await conn.reducers.pressAbility({});
            ticks++;
          }
        } catch { /* A phase may advance between calls; retry using the next room snapshot. */ }
        finally { busy = false; }
      };
      await new Promise<void>((resolve, reject) => conn.subscriptionBuilder()
        .onApplied(() => resolve()).onError(ctx => reject(ctx.event))
        .subscribe([`SELECT * FROM room WHERE code = '${code}'`, `SELECT * FROM fighter WHERE room_code = '${code}'`, `SELECT * FROM weapon WHERE player = 0x${identity.toHexString()}`]));
      timer = window.setInterval(() => void update(), 100);
      void update();
    }
    return () => stops.forEach(stop => stop());
  } catch (error) { stops.forEach(stop => stop()); throw error; }
}
