import type { Archetype } from '@doodle/spec';

export const SFX_PROMPT_VERSION = 'sfx.v1';

/** Used when gen_sfx runs before the spec's sfx_prompt exists. */
export const GENERIC_SFX_BY_ARCHETYPE: Record<Archetype, string> = {
  swing: 'quick cartoon sword whoosh',
  thrust: 'sharp stab swish',
  slam: 'heavy cartoon ground thud',
  shoot: 'bouncy cartoon blaster pew',
  throw: 'spinning boomerang whirr',
  whip: 'leathery whip crack',
  spin: 'fast spinning top whirr',
  beam: 'rising energy beam hum then zap',
};
