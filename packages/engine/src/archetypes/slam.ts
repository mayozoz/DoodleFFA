import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** raise → hold → drop; shockwave ring + screen shake. TODO(M2/M4): implement; falls back to swing until then. */
export const slam: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
