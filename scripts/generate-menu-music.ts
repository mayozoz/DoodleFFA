/** Generate the static menu track once; no API credentials or calls are shipped to browsers.
 * Usage: corepack pnpm tsx scripts/generate-menu-music.ts
 * API: https://elevenlabs.io/docs/api-reference/music/compose
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

async function main() {
  let key = process.env.ELEVENLABS_API_KEY;
  if (!key && existsSync('.env')) {
    key = readFileSync('.env', 'utf8').split('\n').find(line => /^\s*ELEVENLABS_API_KEY\s*=/.test(line))?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  if (!key) throw new Error('Set ELEVENLABS_API_KEY in .env before generating menu music.');
  const output = 'client/public/music/doodle-ffa-menu.mp3';
  if (existsSync(output) && !process.argv.includes('--replace')) throw new Error('Menu track already exists. Pass --replace to generate a new version.');
  const prompt = 'Original instrumental title-screen background music for Doodle FFA, a playful cartoon ghost arena brawler where players draw silly weapons. A catchy bouncy chiptune synth hook, rubbery funk bass, punchy light electronic drums, handclaps, whimsical plucked mallets and little arcade bleeps. Mischievous, cheerful, energetic, friendly competitive party-game energy. 120 BPM, bright major-key melody with a quirky twist. Start with the groove immediately; consistent groove and volume throughout; a clean 16-bar phrase suitable for continuous looping, end at the same musical point as the beginning without a dramatic ending or fade-out. Polished modern game soundtrack, original melody, no vocals, no speech, no sound effects of combat, no cinematic buildup. Leave space for menu clicks and conversation.';
  const soundLoop = process.argv.includes('--sound-loop');
  const request = soundLoop
    ? { text: 'Seamless instrumental arcade game menu music loop. Bouncy chiptune synth melody, rubbery funk bass, crisp light electronic drums, plucked mallets, playful bleeps. Cheerful mischievous cartoon ghost brawler energy, bright major key, 120 BPM. Catchy original melody, consistent groove, no intro or outro, no fading, no vocals or speech. Clean polished game soundtrack, leave room for menu clicks.', duration_seconds: 24, loop: true, prompt_influence: .55, model_id: 'eleven_text_to_sound_v2' }
    : { prompt, music_length_ms: 32000, force_instrumental: true, model_id: 'music_v1' };
  const endpoint = soundLoop ? 'sound-generation' : 'music';
  console.log(`Generating ElevenLabs ${soundLoop ? '24-second instrumental sound loop' : '32-second instrumental menu track'}…`);
  const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify(request), signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    const detail = (await response.text()).replaceAll(key, '[redacted]').slice(0, 600);
    throw new Error(`ElevenLabs music HTTP ${response.status}: ${detail}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 10000 || !(response.headers.get('content-type') ?? '').includes('audio')) throw new Error('Music generation returned an invalid audio response.');
  mkdirSync('client/public/music', { recursive: true });
  writeFileSync(output, bytes);
  writeFileSync('client/public/music/doodle-ffa-menu.json', JSON.stringify({ provider: 'ElevenLabs', endpoint, ...request, generatedAt: new Date().toISOString(), songId: response.headers.get('song-id') }, null, 2) + '\n');
  console.log(`Saved ${output} (${bytes.length} bytes).`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Music generation failed'); process.exitCode = 1; });
