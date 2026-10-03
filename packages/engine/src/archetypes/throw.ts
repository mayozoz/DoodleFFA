import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** weapon leaves hand on a curve and returns. TODO(M2/M4): implement; falls back to swing until then. */
export const throw_: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
