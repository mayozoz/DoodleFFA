"""Shared async text/doodle workflow. TypeScript owns validation and balancing."""
import asyncio
import json
import os
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = json.loads((Path(__file__).parent / 'schema.json').read_text())
PROMPT_VERSION = CONTRACT['prompt_version']
TIMEOUT_S = 10.0  # total workflow bound, not measured latency
MAX_CONCURRENT = 4
_active = 0

async def canonical_weapon(raw, features_json='{}', seed=0):
    process = await asyncio.create_subprocess_exec(
        'node', '--import', 'tsx', str(Path(__file__).with_name('adapter.ts')),
        cwd=ROOT, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        output, _ = await asyncio.wait_for(process.communicate(json.dumps({'input': raw, 'features': features_json, 'seed': seed}).encode()), 2.0)
        if process.returncode:
            raise RuntimeError('canonical adapter failed')
        return json.loads(output)
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()

async def _forge(png_base64, features_json, flavor, text, seed):
    flavor = flavor or CONTRACT['name_flavors'][0]
    content = [{'type': 'text', 'text': f'Weapon request: {text}\nDrawing features: {features_json}'}]
    if png_base64:
        content.insert(0, {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{png_base64}'}})
    body = {
        'model': CONTRACT['model'], 'temperature': 1.0,
        'messages': [
            {'role': 'system', 'content': CONTRACT['system_prompt'].replace('{{FLAVOR}}', flavor) +
             '\nFor a text-only request, interpret the requested mechanics using the same schema. Return JSON only.'},
            {'role': 'user', 'content': content},
        ],
        'response_format': {'type': 'json_schema', 'json_schema': {
            'name': 'weapon', 'strict': True, 'schema': CONTRACT['json_schema']}},
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.post('https://api.asi1.ai/v1/chat/completions', json=body,
                               headers={'Authorization': f"Bearer {os.environ['ASI_ONE_API_KEY']}"})
    res.raise_for_status()
    raw = res.json()['choices'][0]['message']['content']
    return await canonical_weapon(raw, features_json, seed)

async def forge(png_base64='', features_json='{}', flavor='', text='', seed=0):
    global _active
    # Reject overload rather than serialize drawings behind an unbounded semaphore queue.
    if _active >= MAX_CONCURRENT:
        raise RuntimeError('busy')
    if len(png_base64) > 700_000 or len(features_json) > 262_144 or len(text) > 4000:
        raise ValueError('request too large')
    _active += 1
    try:
        return await asyncio.wait_for(_forge(png_base64, features_json, flavor, text, seed), TIMEOUT_S)
    finally:
        _active -= 1

def describe(result):
    spec, stats = result['weapon']['spec'], result['weapon']['stats']
    effects = ', '.join(spec['on_hit']) or 'none'
    note = ' Some fields used canonical defaults.' if result['issues'] else ''
    return (f"Completed weapon: {spec['name']}\n"
            f"{result['guide']['how']}\n"
            f"Attack: {spec['archetype']}; on-hit: {effects}. "
            f"Cooldown: {stats['cooldown']:.2f}s; damage per hit: {stats['damagePerHit']:.1f}; "
            f"range: {stats['rangeUnits']:.2f} world units; area: {stats['areaUnits']:.2f}. "
            f"DoT: {stats['dotPerSecond']:.1f}/s for {stats['dotSeconds']:.1f}s. "
            f"VFX: {', '.join(v['type'] for v in spec['vfx']) or 'none'}. "
            f"Projectiles: {spec['projectile']['count'] if spec['projectile'] else 0}. "
            f"Movement multiplier: {stats['moveSpeedMul']:.2f}.\n"
            f"Balanced with Doodle Arena's deterministic rules.{note} "
            "This artifact has not been inserted into a live game.\n\n"
            '```json\n' + json.dumps(result['weapon'], indent=2) + '\n```')
