// gen_spec system prompt, version 1. Never sent to or logged on clients.
// Bump the version (new file) instead of editing in place once playtests start,
// so we can compare outputs across versions.

import { ARCHETYPES, ON_HIT, PROJECTILE_BEHAVIORS, VFX_TYPES, VFX_WHERE } from '@doodle/spec';

export const SPEC_PROMPT_VERSION = 'spec.v1';

export const SPEC_SYSTEM_PROMPT = `
You turn a child-like doodle of a weapon into a playful game weapon. You see the drawing
and a JSON of measured drawing features. Reply with ONE JSON object matching the schema.
Use only the listed enum values. Numbers you give for cooldown or damage are ignored.

Enums:
- archetype: ${ARCHETYPES.join(' | ')}
- vfx.type: ${VFX_TYPES.join(' | ')}
- vfx.where: ${VFX_WHERE.join(' | ')}
- on_hit (max 2): ${ON_HIT.join(' | ')}
- projectile.behavior (only for "shoot", otherwise projectile = null): ${PROJECTILE_BEHAVIORS.join(' | ')}

Guidance (nudges, not rules):
- What it looks like decides archetype + theme (bow → shoot, hammer → slam, flower → splitting petal shuriken, rope/snake → whip).
- Fast jagged strokes → electric or thorns, lighter weight. Spirals/loops → throw or spin.
- Long and thin → more range. Heavy ink → more weight.
- Colors → palette and element hints: red→fire, blue→ice/goo, green→poison/petals, black→shadow.
- grip = where a hand would hold it, tip = the business end, both as 0–1 image coordinates.
- palette = 2–3 hex colors actually present in the drawing.
- name: evocative, funny, varied; 2–5 words. Flavor style for this one: {{FLAVOR}}.
- sfx_prompt: a short sound-effect description (under 12 words), no speech.
`.trim();

/** Rotated per player so names don't feel templated. */
export const NAME_FLAVORS = [
  'epic fantasy title ("X of the Y")',
  'cozy and silly',
  'brand name of a ridiculous product',
  'ancient legendary relic',
  'grumpy nickname',
  'cosmic / sci-fi',
  'kitchen-appliance energy',
  'pirate slang',
];

/** Gemini `responseSchema` (OpenAPI subset). */
export const SPEC_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    grip: { type: 'ARRAY', items: { type: 'NUMBER' } },
    tip: { type: 'ARRAY', items: { type: 'NUMBER' } },
    archetype: { type: 'STRING', enum: [...ARCHETYPES] },
    range: { type: 'NUMBER' },
    area: { type: 'NUMBER' },
    projectile: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        count: { type: 'INTEGER' },
        spread_deg: { type: 'NUMBER' },
        speed: { type: 'NUMBER' },
        behavior: { type: 'STRING', enum: [...PROJECTILE_BEHAVIORS] },
      },
    },
    on_hit: { type: 'ARRAY', items: { type: 'STRING', enum: [...ON_HIT] } },
    vfx: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: [...VFX_TYPES] },
          where: { type: 'STRING', enum: [...VFX_WHERE] },
          intensity: { type: 'NUMBER' },
        },
        required: ['type', 'where', 'intensity'],
      },
    },
    motion: {
      type: 'OBJECT',
      properties: { elasticity: { type: 'NUMBER' }, weight: { type: 'NUMBER' }, wobble: { type: 'NUMBER' } },
      required: ['elasticity', 'weight', 'wobble'],
    },
    palette: { type: 'ARRAY', items: { type: 'STRING' } },
    sfx_prompt: { type: 'STRING' },
  },
  required: ['name', 'grip', 'tip', 'archetype', 'range', 'area', 'on_hit', 'vfx', 'motion', 'palette', 'sfx_prompt'],
} as const;
