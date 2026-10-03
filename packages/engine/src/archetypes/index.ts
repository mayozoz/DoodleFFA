import type { Archetype } from '@doodle/spec';
import type { ArchetypeModule } from './types';
import { swing } from './swing';
import { thrust } from './thrust';
import { slam } from './slam';
import { shoot } from './shoot';
import { throw_ } from './throw';
import { whip } from './whip';
import { spin } from './spin';
import { beam } from './beam';

export const ARCHETYPE_MODULES: Record<Archetype, ArchetypeModule> = {
  swing, thrust, slam, shoot, throw: throw_, whip, spin, beam,
};

export type { ArchetypeCtx, ArchetypeModule } from './types';
