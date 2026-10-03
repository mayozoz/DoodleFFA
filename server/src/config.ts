// External service config. Model IDs move fast — verify against provider docs before M3.

export const MODELS = {
  /** gen_spec: multimodal, structured JSON output */
  spec: 'gemini-2.5-flash', // TODO(M3): confirm current Flash model id
  /** gen_sprite: image-to-image ("Nano Banana 2") */
  sprite: 'gemini-3.1-flash-image-preview', // TODO(M3): confirm current Nano Banana 2 model id
} as const;

export const ENDPOINTS = {
  gemini: (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  elevenSfx: 'https://api.elevenlabs.io/v1/sound-generation',
} as const;

export const TIMEOUT_MS = {
  spec: 30_000,
  sprite: 30_000,
  sfx: 30_000,
} as const;

/** Keys expected in the private `secrets` table (set via set_secret). */
export const SECRET_KEYS = [
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET',
  'ASSET_BASE_URL',
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
