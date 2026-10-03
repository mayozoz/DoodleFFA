# Preset sounds

Original synthesized WAV effects for swing, thrust, slam, shoot, throw, whip,
spin, beam, and the controller click. Rebuild with `python3 scripts/build-sfx.py`.

Each phone controller preloads and plays the generated `weapon.sfxUrl` when present,
and uses the archetype preset if generation or audio decoding fails. Sound is
unlocked by tapping Join, drawing, or using the phone controls. The shared
screen does not play weapon audio. The phone also announces its weapon name
during Reveal; Hear weapon replays the ElevenLabs announcement.

Custom effects are one-second ElevenLabs MP3s stored as inline data URLs. They
need only the server's private `ELEVENLABS_API_KEY`; S3 is not used for sound.
