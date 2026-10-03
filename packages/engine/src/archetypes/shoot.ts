import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** recoil + tip flash; projectiles are server rows, rendered by the screen. TODO(M2/M4): implement; falls back to swing until then. */
export const shoot: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
