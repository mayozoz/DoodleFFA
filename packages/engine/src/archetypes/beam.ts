import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** shake while charging → glowing line. TODO(M2/M4): implement; falls back to swing until then. */
export const beam: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
