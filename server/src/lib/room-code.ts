// 4-letter room codes without ambiguous letters (no I, O, L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export function makeRoomCode(rand: () => number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}
