import { describe, expect, it } from 'vitest';
import { SPEC_GEMINI_SCHEMA, SPEC_JSON_SCHEMA } from '../src/prompts/spec.v1';

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

  it('has the same top-level fields as the Gemini schema', () => {
    expect(Object.keys(SPEC_JSON_SCHEMA.properties).sort()).toEqual(Object.keys(SPEC_GEMINI_SCHEMA.properties).sort());
  });
});
