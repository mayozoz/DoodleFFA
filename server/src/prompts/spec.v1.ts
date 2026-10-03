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

Number scales (important):
- range, area, every vfx intensity, and motion.elasticity / weight / wobble are fractions from 0.0 to 1.0
  (0.5 = average). Never use 0–10 or 0–100 scales.
- projectile.speed is also 0.0–1.0; projectile.count is 1–5; projectile.spread_deg is 0–90.
- grip and tip are [x, y] fractions of the image (0,0 = top-left), at least 0.3 apart.
- Each vfx type at most once; at most 3 vfx entries.

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

/** Gemini `responseSchema` (OpenAPI subset). Keep in sync with SPEC_JSON_SCHEMA below. */
export const SPEC_GEMINI_SCHEMA = {
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

/**
 * Standard JSON Schema for OpenAI-style `response_format: json_schema` (ASI:One, and the
 * Weapon Smith agent via scripts/export-agent-schema.ts). Written to satisfy `strict: true`:
 * every object has `additionalProperties: false` and lists every property in `required`;
 * optional values use a `null` type instead of being omitted.
 */
export const SPEC_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    grip: { type: 'array', items: { type: 'number' } },
    tip: { type: 'array', items: { type: 'number' } },
    archetype: { type: 'string', enum: [...ARCHETYPES] },
    range: { type: 'number' },
    area: { type: 'number' },
    projectile: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        count: { type: 'integer' },
        spread_deg: { type: 'number' },
        speed: { type: 'number' },
        behavior: { type: 'string', enum: [...PROJECTILE_BEHAVIORS] },
      },
      required: ['count', 'spread_deg', 'speed', 'behavior'],
    },
    on_hit: { type: 'array', items: { type: 'string', enum: [...ON_HIT] } },
    vfx: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: [...VFX_TYPES] },
          where: { type: 'string', enum: [...VFX_WHERE] },
          intensity: { type: 'number' },
        },
        required: ['type', 'where', 'intensity'],
      },
    },
    motion: {
      type: 'object',
      additionalProperties: false,
      properties: { elasticity: { type: 'number' }, weight: { type: 'number' }, wobble: { type: 'number' } },
      required: ['elasticity', 'weight', 'wobble'],
    },
    palette: { type: 'array', items: { type: 'string' } },
    sfx_prompt: { type: 'string' },
  },
  required: ['name', 'grip', 'tip', 'archetype', 'range', 'area', 'projectile', 'on_hit', 'vfx', 'motion', 'palette', 'sfx_prompt'],
} as const;
