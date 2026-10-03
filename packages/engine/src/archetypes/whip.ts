import type { ArchetypeModule } from './types';
import { swing } from './swing';

/** sprite bends like rope (PixiJS MeshRope + spring chain). TODO(M2/M4): implement; falls back to swing until then. */
export const whip: ArchetypeModule = {
  play: (sprite, ctx) => swing.play(sprite, ctx),
};
