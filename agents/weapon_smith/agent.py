"""Weapon Smith uAgent.

A *provider* for the game: SpacetimeDB's gen_spec procedure POSTs a doodle here and gets weapon
JSON back. The agent never touches the game database; the game validates, balances and stores
whatever this returns, and falls back on its own if this is slow or down.

Run:  python agent.py      (see README.md)
"""

import hmac
import os
import time
import json
from pathlib import Path

from dotenv import load_dotenv
from uagents import Agent, Context

from models import Health, SpecRequest, SpecResponse
from smith import PROMPT_VERSION, forge
from chat import protocol

load_dotenv(Path(__file__).with_name(".env"))

PORT = int(os.environ.get("AGENT_PORT", "8001"))
PUBLIC_URL = os.environ.get("AGENT_PUBLIC_URL", f"http://localhost:{PORT}").rstrip("/")
SHARED_SECRET = os.environ.get("AGENT_SHARED_SECRET", "")

agent = Agent(
    name="weapon_smith",
    seed=os.environ["AGENT_SEED"],
    port=PORT,
    endpoint=[f"{PUBLIC_URL}/submit"],
    mailbox=os.environ.get("AGENT_MAILBOX", "false").lower() == "true",
    publish_agent_details=True,
    handle_messages_concurrently=True,
)


@agent.on_rest_get("/health", Health)
async def health(ctx: Context) -> Health:
    return Health(ok=True, prompt_version=PROMPT_VERSION, address=ctx.agent.address)


@agent.on_rest_post("/spec", SpecRequest, SpecResponse)
async def spec(ctx: Context, req: SpecRequest) -> SpecResponse:
    if not SHARED_SECRET or not hmac.compare_digest(req.token, SHARED_SECRET):
        return SpecResponse(error="unauthorized", prompt_version=PROMPT_VERSION)
    started = time.monotonic()
    try:
        result = await forge(req.png_base64, req.features_json, req.flavor, seed=req.seed)
        weapon_json = json.dumps(result["weapon"]["spec"])
        seconds = time.monotonic() - started
        ctx.logger.info(f"rest duration={seconds:.3f}s status={'fallback' if result['issues'] else 'success'}")
        return SpecResponse(weapon_json=weapon_json, prompt_version=PROMPT_VERSION, seconds=seconds)
    except Exception as e:  # the game falls back; just report what went wrong
        ctx.logger.warning(f"rest duration={time.monotonic() - started:.3f}s status={type(e).__name__}")
        return SpecResponse(error=type(e).__name__, prompt_version=PROMPT_VERSION, seconds=time.monotonic() - started)


agent.include(protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()
