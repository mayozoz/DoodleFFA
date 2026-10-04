import { ENDPOINTS, MODELS } from '../config';
import { SPEC_JSON_SCHEMA } from '../prompts/spec.v1';

// Pure request builder + response parser for the spec provider (ASI:One). No SpacetimeDB imports, so
// scripts/prompt-lab.ts sends byte-identical requests from Node.

export interface SpecRequest {
  pngBase64: string;
  featuresJson: string;
  systemPrompt: string;
  flavor?: string;
  seed?: number;
}

export interface HttpCall {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export const asi1Request = (key: string, r: SpecRequest): HttpCall => ({
  url: ENDPOINTS.asi1,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({
    model: MODELS.specAsi1,
    temperature: 1.0,
    messages: [
      { role: 'system', content: r.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${r.pngBase64}` } },
          { type: 'text', text: `Drawing features: ${r.featuresJson}` },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'weapon', strict: true, schema: SPEC_JSON_SCHEMA },
    },
  }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const asi1Text = (json: any): unknown => json?.choices?.[0]?.message?.content;

/** Existing authenticated Weapon Smith REST contract. URL is private server configuration. */
export function agentRequest(key: string, r: SpecRequest, endpoint: string): HttpCall {
  if (!/^https?:\/\/[^\s/@?#]+(?::[0-9]+)?(?:\/[^\s?#]*)?$/.test(endpoint)) throw new Error('Invalid agent URL');
  return {
    url: `${endpoint.replace(/\/$/, '')}/spec`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: key, png_base64: r.pngBase64, features_json: r.featuresJson, flavor: r.flavor ?? '', seed: r.seed ?? 0 }),
  };
}
export function agentText(json: unknown): unknown {
  const r = json as { error?: string; weapon_json?: unknown } | null;
  if (r?.error) throw new Error('Weapon Smith rejected generation');
  return r?.weapon_json;
}
