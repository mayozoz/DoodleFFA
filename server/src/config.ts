// External service config. Model IDs move fast — verify against provider docs before M3.

/**
 * Which provider answers gen_spec. Swapping this is the only change needed; validation,
 * balance and fallbacks don't care where the JSON came from.
 * Phase 2 adds 'agent' (the Weapon Smith uAgent in agents/weapon_smith/).
 */
export type SpecProvider = 'gemini' | 'asi1';
export const SPEC_PROVIDER: SpecProvider = 'asi1';

export const MODELS = {
  /** gen_spec via Gemini: multimodal, structured JSON output */
  // gemini-2.5-flash is closed to new API users (404). Verified against the live model list 2026-10-03.
  specGemini: 'gemini-3.8-flash',
  /** gen_spec via ASI:One. Only `asi1` accepts images (not asi1-mini / asi1-ultra). */
  specAsi1: 'asi1',
  /** gen_sprite: image-to-image ("Nano Banana 2"); the stable id, not -preview */
  sprite: 'gemini-3.1-flash-image',
} as const;

export const ENDPOINTS = {
  gemini: (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  /** OpenAI-compatible chat completions */
  asi1: 'https://api.asi1.ai/v1/chat/completions',
  elevenSfx: 'https://api.elevenlabs.io/v1/sound-generation',
  elevenTts: (voiceId: string) => `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
} as const;

export const TIMEOUT_MS = {
  spec: 12_000,
  sprite: 30_000,
  sfx: 30_000,
} as const;

/** Battle commentator (backlog — see README "Commentator"). Off until it's built. */
export const COMMENTARY = {
  enabled: true,
  /** ElevenLabs premade "Adam": deep American male, brash and confident. Swap any time. */
  voiceId: 'pNInz6obpgDQGcFmaJgB',
  /** fastest ElevenLabs TTS model (~0.4 s for a short line) */
  ttsModel: 'eleven_flash_v2_5',
  /** ASI:One text model for writing the line (no image needed, so the fast one) */
  lineModel: 'asi1-mini',
  /** cost guards, per room per round */
  maxLinesPerRound: 16,
  minGapS: 4,
  timeoutMs: 7000,
} as const;

/** Keys expected in the private `secrets` table (set via set_secret). */
export const SECRET_KEYS = [
  'GEMINI_API_KEY',
  'ASI_ONE_API_KEY',
  'ELEVENLABS_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
  'S3_BUCKET',
  'ASSET_BASE_URL',
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
