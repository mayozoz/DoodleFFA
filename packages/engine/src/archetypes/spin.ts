import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** weapon orbits the character. TODO(M2/M4): implement; falls back to swing until then. */
export const spin: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
