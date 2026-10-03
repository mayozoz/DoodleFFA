import {
  ARCHETYPES, ON_HIT, PROJECTILE_BEHAVIORS, VFX_TYPES, VFX_WHERE, isOneOf,
} from './enums';
import type { MotionSpec, ProjectileSpec, Vec2, VfxSpec, WeaponSpec } from './types';

// Hand-rolled on purpose: it must run inside the SpacetimeDB module runtime as well as the
// browser, with zero dependencies. Never throws — every bad field falls back individually.

export interface ValidationResult {
  spec: WeaponSpec;
  /** Human-readable notes for server logs only. Never send to clients. */
  issues: string[];
}

export const LIMITS = {
  nameMaxLen: 48,
  sfxPromptMaxLen: 160,
  maxOnHit: 2,
  maxVfx: 3,
  maxPalette: 4,
  cooldown: [0.25, 1.5] as const,
  projectileCount: [1, 5] as const,
  spreadDeg: [0, 90] as const,
} as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

function num(v: unknown, fb: number, lo: number, hi: number, path: string, issues: string[]): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    if (v !== undefined) issues.push(`${path}: not a number, using fallback`);
    return fb;
  }
  if (v < lo || v > hi) issues.push(`${path}: ${v} clamped to [${lo}, ${hi}]`);
  return clamp(v, lo, hi);
}

function vec2(v: unknown, fb: Vec2, path: string, issues: string[]): Vec2 {
  if (!Array.isArray(v) || v.length !== 2) {
    issues.push(`${path}: bad vec2, using fallback`);
    return fb;
  }
  return [num(v[0], fb[0], 0, 1, `${path}[0]`, issues), num(v[1], fb[1], 0, 1, `${path}[1]`, issues)];
}

function str(v: unknown, fb: string, maxLen: number, path: string, issues: string[]): string {
  if (typeof v !== 'string' || v.trim() === '') {
    issues.push(`${path}: missing, using fallback`);
    return fb;
  }
  // Strip control chars; keep it a plain display string.
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
}

function projectile(v: unknown, fb: ProjectileSpec | null, issues: string[]): ProjectileSpec | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') {
    issues.push('projectile: not an object');
    return fb;
  }
  const p = v as Record<string, unknown>;
  const base = fb ?? { count: 1, spread_deg: 0, speed: 0.5, behavior: 'pierce' as const };
  return {
    count: Math.round(num(p.count, base.count, ...LIMITS.projectileCount, 'projectile.count', issues)),
    spread_deg: num(p.spread_deg, base.spread_deg, ...LIMITS.spreadDeg, 'projectile.spread_deg', issues),
    speed: num(p.speed, base.speed, 0, 1, 'projectile.speed', issues),
    behavior: isOneOf(PROJECTILE_BEHAVIORS, p.behavior) ? p.behavior : base.behavior,
  };
}

function vfxList(v: unknown, fb: VfxSpec[], issues: string[]): VfxSpec[] {
  if (!Array.isArray(v)) return fb;
  const out: VfxSpec[] = [];
  for (const [i, raw] of v.entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    if (!isOneOf(VFX_TYPES, e.type)) {
      issues.push(`vfx[${i}].type: unknown "${String(e.type)}", dropped`);
      continue;
    }
    out.push({
      type: e.type,
      where: isOneOf(VFX_WHERE, e.where) ? e.where : 'trail',
      intensity: num(e.intensity, 0.6, 0, 1, `vfx[${i}].intensity`, issues),
    });
    if (out.length >= LIMITS.maxVfx) break;
  }
  return out;
}

function motion(v: unknown, fb: MotionSpec, issues: string[]): MotionSpec {
  const m = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    elasticity: num(m.elasticity, fb.elasticity, 0, 1, 'motion.elasticity', issues),
    weight: num(m.weight, fb.weight, 0, 1, 'motion.weight', issues),
    wobble: num(m.wobble, fb.wobble, 0, 1, 'motion.wobble', issues),
  };
}

/**
 * Parse anything (string JSON or object) into a safe WeaponSpec.
 * `fallback` supplies every field the input gets wrong — normally the
 * deterministic features-based spec, so a half-broken AI answer still keeps its good parts.
 */
export function validateWeaponSpec(input: unknown, fallback: WeaponSpec): ValidationResult {
  const issues: string[] = [];
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { spec: fallback, issues: ['input: invalid JSON, full fallback'] };
    }
  }
  if (!raw || typeof raw !== 'object') return { spec: fallback, issues: ['input: not an object, full fallback'] };
  // Accept either `{ weapon: {...} }` or the weapon object itself.
  const r = ('weapon' in raw ? (raw as { weapon: unknown }).weapon : raw) as Record<string, unknown>;

  const archetype = isOneOf(ARCHETYPES, r.archetype) ? r.archetype : fallback.archetype;
  if (archetype !== r.archetype) issues.push(`archetype: "${String(r.archetype)}" invalid`);

  const onHit = Array.isArray(r.on_hit)
    ? [...new Set(r.on_hit.filter((x): x is (typeof ON_HIT)[number] => isOneOf(ON_HIT, x)))].slice(0, LIMITS.maxOnHit)
    : fallback.on_hit;

  const palette = Array.isArray(r.palette)
    ? r.palette.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, LIMITS.maxPalette)
    : [];

  const spec: WeaponSpec = {
    name: str(r.name, fallback.name, LIMITS.nameMaxLen, 'name', issues),
    grip: vec2(r.grip, fallback.grip, 'grip', issues),
    tip: vec2(r.tip, fallback.tip, 'tip', issues),
    archetype,
    range: clamp01(num(r.range, fallback.range, 0, 1, 'range', issues)),
    area: clamp01(num(r.area, fallback.area, 0, 1, 'area', issues)),
    cooldown: num(r.cooldown, fallback.cooldown, ...LIMITS.cooldown, 'cooldown', issues),
    // Projectiles only make sense for `shoot`.
    projectile: archetype === 'shoot' ? (projectile(r.projectile, fallback.projectile, issues) ?? {
      count: 1, spread_deg: 0, speed: 0.6, behavior: 'pierce',
    }) : null,
    on_hit: onHit,
    vfx: vfxList(r.vfx, fallback.vfx, issues),
    motion: motion(r.motion, fallback.motion, issues),
    palette: palette.length > 0 ? palette : fallback.palette,
    sfx_prompt: str(r.sfx_prompt, fallback.sfx_prompt, LIMITS.sfxPromptMaxLen, 'sfx_prompt', issues),
  };

  // grip and tip must not coincide, otherwise orientation is undefined.
  if (Math.hypot(spec.tip[0] - spec.grip[0], spec.tip[1] - spec.grip[1]) < 0.1) {
    issues.push('grip/tip too close, using fallback');
    spec.grip = fallback.grip;
    spec.tip = fallback.tip;
  }
  return { spec, issues };
}
