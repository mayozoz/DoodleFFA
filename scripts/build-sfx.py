"""Rebuild the small, original fallback effects. No external assets or API needed."""
import math
from pathlib import Path
import random
import struct
import wave

OUT = Path(__file__).resolve().parent.parent / 'client/public/sfx'
RATE = 22050
# start/end pitch, duration, noise mix
SOUNDS = {
    'swing': (800, 180, .22, .8), 'thrust': (1400, 300, .14, .65),
    'slam': (150, 45, .32, .35), 'shoot': (1200, 180, .18, .1),
    'throw': (500, 220, .32, .45), 'whip': (1800, 100, .12, .85),
    'spin': (350, 700, .38, .4), 'beam': (200, 1600, .4, .08),
    'click': (1100, 650, .045, .05),
}
OUT.mkdir(parents=True, exist_ok=True)
for name, (start, end, duration, noise) in SOUNDS.items():
    rng = random.Random(name)
    frames = bytearray()
    phase = 0
    for i in range(int(RATE * duration)):
        progress = i / (RATE * duration)
        phase += 2 * math.pi * (start + (end - start) * progress) / RATE
        envelope = min(1, progress * 40) * (1 - progress) ** 2
        sample = (math.sin(phase) * (1 - noise) + rng.uniform(-1, 1) * noise)
        frames.extend(struct.pack('<h', int(sample * envelope * 18000)))
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(frames)
