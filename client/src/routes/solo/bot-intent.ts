export interface BotFighter { id: string; x: number; y: number; hp: number }

/** Approach the closest living opponent, keeping a little distance with ranged weapons. */
export function botIntent(self: BotFighter, fighters: BotFighter[], ranged: boolean) {
  const target = fighters.filter(f => f.id !== self.id && f.hp > 0)
    .sort((a, b) => Math.hypot(a.x - self.x, a.y - self.y) - Math.hypot(b.x - self.x, b.y - self.y))[0];
  if (self.hp <= 0 || !target) return { dx: 0, dy: 0, attack: false, special: false };
  const x = target.x - self.x, y = target.y - self.y, distance = Math.hypot(x, y);
  // Small forward movement keeps facing locked toward the opponent even when holding range.
  const speed = ranged && distance < 5 ? .08 : distance < .8 ? .08 : .75;
  return { dx: distance ? x / distance * speed : 0, dy: distance ? y / distance * speed : 0,
    attack: distance < (ranged ? 12 : 3.2), special: distance < 5 };
}
