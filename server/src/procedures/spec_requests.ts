import { ENDPOINTS, MODELS } from '../config';
import { SPEC_JSON_SCHEMA } from '../prompts/spec.v1';

// Pure request builder + response parser for the spec provider (ASI:One). No SpacetimeDB imports, so
// scripts/prompt-lab.ts sends byte-identical requests from Node.

export interface SpecRequest {
  pngBase64: string;
  featuresJson: string;
  systemPrompt: string;
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
