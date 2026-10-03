import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** pull back → lunge + lengthwise stretch. TODO(M2/M4): implement; falls back to swing until then. */
export const thrust: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
