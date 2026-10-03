"""The one thing this agent does: doodle + features -> weapon JSON via ASI:One (asi1).

Prompt, name flavors and JSON schema come from schema.json, which `pnpm agents:schema`
generates from the TypeScript source. Don't edit them here.
"""

import json
import os
import random
from pathlib import Path

import httpx

ASI_URL = "https://api.asi1.ai/v1/chat/completions"
# Stay under the game's 12 s gen_spec timeout so the game gets a clean error, not a hang.
TIMEOUT_S = 8.0

CONTRACT = json.loads((Path(__file__).parent / "schema.json").read_text())
PROMPT_VERSION: str = CONTRACT["prompt_version"]


async def forge(png_base64: str, features_json: str, flavor: str) -> str:
    """Return the model's raw JSON text. Raises on HTTP or shape errors."""
    key = os.environ["ASI_ONE_API_KEY"]
    flavor = flavor or random.choice(CONTRACT["name_flavors"])
    body = {
        "model": CONTRACT["model"],
        "temperature": 1.0,
        "messages": [
            {"role": "system", "content": CONTRACT["system_prompt"].replace("{{FLAVOR}}", flavor)},
            {
                "role": "user",
                "content": [
                    # TODO(verify): ASI:One accepts base64 data URLs here (else pass a hosted URL).
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{png_base64}"}},
                    {"type": "text", "text": f"Drawing features: {features_json}"},
                ],
            },
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "weapon", "strict": True, "schema": CONTRACT["json_schema"]},
        },
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        res = await client.post(ASI_URL, json=body, headers={"Authorization": f"Bearer {key}"})
    res.raise_for_status()
    text = res.json()["choices"][0]["message"]["content"]
    json.loads(text)  # fail here, not in the game, if it isn't JSON at all
    return text
