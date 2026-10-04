import { describe, expect, it } from 'vitest';
import { DEFAULT_SWING } from '@doodle/spec';
import { SPEC_JSON_SCHEMA } from '../src/prompts/spec.v1';

type Node = { type?: string | readonly string[]; properties?: Record<string, Node>; required?: readonly string[]; additionalProperties?: boolean; items?: Node };

const isObject = (n: Node) => n.type === 'object' || (Array.isArray(n.type) && n.type.includes('object'));

function walk(n: Node, path: string, visit: (n: Node, path: string) => void) {
  visit(n, path);
  for (const [k, child] of Object.entries(n.properties ?? {})) walk(child, `${path}.${k}`, visit);
  if (n.items) walk(n.items, `${path}[]`, visit);
}

describe('SPEC_JSON_SCHEMA (strict mode rules)', () => {
  it('every object forbids extra keys and requires every property', () => {
    walk(SPEC_JSON_SCHEMA as Node, '$', (n, path) => {
      if (!isObject(n)) return;
      expect(n.additionalProperties, `${path}.additionalProperties`).toBe(false);
      expect([...(n.required ?? [])].sort(), `${path}.required`).toEqual(Object.keys(n.properties ?? {}).sort());
    });
  });

  it('asks for exactly the WeaponSpec fields (minus cooldown, which the balance formula sets)', () => {
    const expected = Object.keys(DEFAULT_SWING).filter((k) => k !== 'cooldown').sort();
    expect(Object.keys(SPEC_JSON_SCHEMA.properties).sort()).toEqual(expected);
  });
});
