"""Weapon Smith uAgent.

A *provider* for the game: SpacetimeDB's gen_spec procedure POSTs a doodle here and gets weapon
JSON back. The agent never touches the game database; the game validates, balances and stores
whatever this returns, and falls back on its own if this is slow or down.

Run:  python agent.py      (see README.md)
"""

import hmac
import os
import time

from dotenv import load_dotenv
from uagents import Agent, Context

from models import Health, SpecRequest, SpecResponse
from smith import PROMPT_VERSION, forge

load_dotenv()

PORT = int(os.environ.get("AGENT_PORT", "8001"))
PUBLIC_URL = os.environ.get("AGENT_PUBLIC_URL", f"http://localhost:{PORT}").rstrip("/")
SHARED_SECRET = os.environ.get("AGENT_SHARED_SECRET", "")

agent = Agent(
    name="weapon_smith",
    seed=os.environ["AGENT_SEED"],
    port=PORT,
    endpoint=[f"{PUBLIC_URL}/submit"],
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
        weapon_json = await forge(req.png_base64, req.features_json, req.flavor)
        seconds = time.monotonic() - started
        ctx.logger.info(f"forged weapon in {seconds:.1f}s")
        return SpecResponse(weapon_json=weapon_json, prompt_version=PROMPT_VERSION, seconds=seconds)
    except Exception as e:  # the game falls back; just report what went wrong
        ctx.logger.warning(f"forge failed: {e}")
        return SpecResponse(error=type(e).__name__, prompt_version=PROMPT_VERSION, seconds=time.monotonic() - started)


# TODO(Phase 3): include the chat protocol and publish the manifest so the agent is discoverable
# on Agentverse / ASI:One, e.g. agent.include(chat_protocol, publish_manifest=True). A chat message
# with a doodle image should reply with a weapon card (name + archetype + effects).

if __name__ == "__main__":
    agent.run()
