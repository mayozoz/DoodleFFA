# Weapon Smith — FetchAI / ASI integration

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

Weapon Smith interprets a text request in an ASI conversation or a submitted game doodle, calls ASI:One, executes the canonical TypeScript validation/balance tool, and returns a completed weapon artifact. This is a single agent. Chat artifacts are standalone: the agent does not insert them into a live game.

Agent address: **not registered/verified yet**. Run with your permanent `AGENT_SEED`, then copy the actual `agent1…` address from startup or `/health` here before submission. Never publish the seed.

## Architecture and bounds

- `smith.py`: shared asynchronous workflow for REST and chat, with `asi1` structured output. Maximum four active workflows, immediate overload rejection, 8 s HTTP timeout and 10 s total bound (limits, not latency measurements).
- `adapter.ts`: a subprocess tool that imports `server/src/lib/weapon-creation.ts`, `packages/spec` and `server/src/balance.ts`. Python has **no balance formula**. The tool validates, repairs unsafe fields with canonical defaults, and balances deterministically. It has a 2 s timeout and is killed/reaped on cancellation. Deploy the repository and Node dependencies with the Python agent.
- `agent.py`: authenticated `POST /spec`, `GET /health`, official uAgent registration/inspector support. The server independently validates and balances every returned spec before storing it; returned numbers are never trusted for combat.
- `chat.py`: official ACP **0.3.0**, incoming acknowledgements, envelope session preserved by `ctx.send`, stateless text requests ending with `EndSessionContent`, acknowledgement handler, manifest publication. Responses contain readable mechanics plus a fenced JSON `{spec, stats}` artifact. Control-only messages are acknowledged without a model call.
- Game calls run exclusively in the `genSpec` procedure, outside transactions. Drawing submission starts generation alongside the existing roll/special tutorials. “See my weapon” waits at most 12 s for work already in flight, then `prepareWeapon` freezes the weapon. Reveal also freezes fallback. The existing 60 s preparation deadline and combat tick are unchanged.
- Private game request claims prevent repeated spec/sprite/sound calls per round. Original job/claim, room, round, seed, drawing and finalization checks discard late responses. Claims are removed with per-round player data. Sprite still starts independently; sound starts once after the spec attempt and uses the available finalized prompt.
- Chat message IDs are deduplicated by sender + envelope session + message ID, in flight and across restarts using uAgents storage. Completed duplicate messages replay the same reply without another model call. Cache horizon: 24 h / 512 most recent requests per process. A persisted interrupted claim returns a retry explanation without repeating model spend; send a new message ID to retry. Keep the storage volume persistent and use one process per agent identity.
- Application logs report duration/status/repair counts, without prompts, raw responses or credentials. Do not enable HTTP body logging in a reverse proxy.

Chat input is **text only**. ACP resource blocks exist, but ASI image delivery/retrieval has not been verified here; this agent never fetches arbitrary resource URLs. The game REST entry point supports base64 PNGs, verified with a live synthetic doodle.

## Local startup

Requirements: Node 22+, Corepack/pnpm 9.15, Python 3.10–3.13 (tested 3.12), SpacetimeDB CLI compatible with this repository. Current PyPI versions verified on 2026-10-04: `uagents==0.26.0`, `httpx==0.28.1`, `python-dotenv==1.2.4`. The official guide requires uAgents >=0.25.5; the installed protocol version is asserted by tests.

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
node --import tsx scripts/export-agent-schema.ts
python3 -m venv agents/weapon_smith/.venv
agents/weapon_smith/.venv/bin/pip install -r agents/weapon_smith/requirements.txt
cp agents/weapon_smith/.env.example agents/weapon_smith/.env
```

Fill the agent `.env`: `ASI_ONE_API_KEY`, a permanent random `AGENT_SEED`, a separate random `AGENT_SHARED_SECRET`, `AGENT_PORT=8001`, `AGENT_PUBLIC_URL=http://localhost:8001`, `AGENT_MAILBOX=false` for local tests. Generate random strings with `python3 -c 'import secrets; print(secrets.token_hex(32))'`. Do not reuse sample seeds.

Start it from its directory (the cwd owns the private persistent `*_data.json` cache):

```bash
cd agents/weapon_smith
.venv/bin/python agent.py
```

In separate terminals, from the repo root:

```bash
spacetime start
```

```bash
spacetime publish --module-path server doodle-arena
spacetime generate --lang typescript --out-dir client/src/module_bindings --module-path server
# Create root .env from .env.example if you do not already have one.
# Fill SPEC_PROVIDER=agent, AGENT_URL=http://127.0.0.1:8001,
# AGENT_SHARED_SECRET=<same value as agent .env>. Keep client variables as appropriate.
node --import tsx scripts/set-secrets.ts
corepack pnpm --filter @doodle/client dev --host 0.0.0.0
```

`spacetime publish` above preserves database data. Do not use `--delete-data`. No deployment or live database reset was performed during implementation. Missing/blank/unknown private `SPEC_PROVIDER` disables external specs and keeps deterministic gameplay. Set `SPEC_PROVIDER=asi1` plus private `ASI_ONE_API_KEY` for the direct provider. `server/src/config.ts`'s exported `SPEC_PROVIDER` is only the prompt-lab default, not a game opt-in.

`AGENT_URL` is the base URL, without `/spec`. All three game settings are loaded into the **private secrets table**, administered by the publisher identity via `set_secret`. No API key, shared secret, or private endpoint configuration belongs in `VITE_*`. To disable an existing configuration, call as the publisher:

```bash
spacetime call doodle-arena set_secret '"SPEC_PROVIDER"' '""'
```

Local `127.0.0.1` works only when the SpacetimeDB procedure host can reach the agent there. Cloud SpacetimeDB needs a reachable **HTTPS** endpoint. Mailbox connectivity for chat does not expose the REST game endpoint.

## Publish and register for ASI

Deploy the repository on a persistent Python + Node host. Install the dependencies above, keep the agent cwd/storage persistent, and run `agent.py` under your process manager. Expose port 8001 through HTTPS; set `AGENT_PUBLIC_URL=https://<your-agent-host>` and `AGENT_MAILBOX=true`. Keep the model key, seed and shared token in host secrets. Rate-limit REST ingress and keep `/connect` and inspector routes restricted to your administrative access. The game uses `/spec`; Agentverse message ingress uses `/submit` or its mailbox.

1. Start the agent. It includes `Protocol(spec=chat_protocol_spec)` with `publish_manifest=True`, `publish_agent_details=True`, `mailbox=True`, and concurrent handlers. These are the documented SDK APIs; the SDK manages signed Almanac registration and manifest publication.
2. Sign in to [Agentverse](https://agentverse.ai). Open the **actual inspector URL printed at startup** (or use a local tunnel to it), choose **Connect → Mailbox**, and associate the permanent agent with your account. This invokes the SDK's `/connect` flow, proves ownership by signed challenge, registers the listing, and configures mailbox access. No hard-coded mailbox token or copied agent address is used.
3. Confirm actual startup/inspector results: mailbox token acquired, registration successful, `AgentChatProtocol` manifest published, correct agent address/listing, and mailbox messages arriving. A constructor flag or a healthy `/health` response alone does not verify these steps.
4. In the Agentverse profile, describe it as “Weapon Smith for Doodle Arena: generates validated, deterministically balanced weapon JSON from a text request; returns completed mechanics and an exportable artifact.” Add the Innovation Lab/hackathon tags and a link to this repository. Save the profile and keep the process online.
5. Use the profile/inspector chat first, then open [ASI:One Chat](https://chat.asi1.ai), select the registered agent, and run the ASI demo below. Also verify a fresh natural-language discovery query routes to the same address. Record the address and discovery evidence; registration is not proof of discovery.
6. Set root `.env` `SPEC_PROVIDER=agent`, `AGENT_URL=https://<your-agent-host>`, and the matching `AGENT_SHARED_SECRET`. Publish the module with `spacetime publish -s maincloud --module-path server doodle-arena`, regenerate bindings, then load secrets with `node --import tsx scripts/set-secrets.ts maincloud` as the publisher. Configure the client's public SpacetimeDB connection, build using `corepack pnpm --filter @doodle/client build`, and serve `client/dist` over HTTPS.

The registration flow follows the [compatible-agent/mailbox guide](https://innovationlab.fetch.ai/resources/docs/examples/chat-protocol/asi-compatible-uagents), [uAgent creation guide](https://innovationlab.fetch.ai/resources/docs/agent-creation/uagent-creation), and [Agentverse listing API](https://docs.agentverse.ai/api-reference/agents/register-agent). Account linking is required; it has not been performed for this checkout.

## Contract

`POST /spec` JSON:

```json
{"token":"<shared secret>","png_base64":"<PNG base64>","features_json":"<extracted features JSON>","flavor":"mythic","seed":42}
```

`seed` is optional for backward compatibility; the game sends its seeded player-specific value so malformed answers get the same features-based fallback. Response: `weapon_json` (validated spec JSON string), `error`, `prompt_version`, `seconds`. Nonempty `error` causes game fallback. Authentication failure returns `error=unauthorized` in the SDK's JSON response; inspect the body, not just HTTP 200. `/health` reports process health/address/prompt version, not API credentials or account readiness.

Run `node --import tsx scripts/export-agent-schema.ts` after changing the prompt/schema/enums. `schema.json` is generated, never a separate Python schema. Balance changes are automatically picked up by the adapter; do not export a Python copy.

## Verification and latency

```bash
corepack pnpm -r test
corepack pnpm -r typecheck
spacetime build --module-path server
agents/weapon_smith/.venv/bin/python -m unittest discover -s agents/weapon_smith -p 'test_*.py' -v
agents/weapon_smith/.venv/bin/python -c 'from uagents_core.contrib.protocols.chat import chat_protocol_spec; print(chat_protocol_spec.name, chat_protocol_spec.version)'
```

Local automated coverage includes canonical valid/malformed specs (including nested null), private request authentication, missing configuration, timeout/unavailability, bounded parallel workflows, duplicate game calls, repeated/in-flight/restarted chat requests, acknowledgements, sessions, readable + parseable artifacts, round/room/drawing changes, and responses after finalization/Reveal. TypeScript tests use mocked DB/HTTP; Python tests use the real SDK ASGI REST router, SDK chat dispatch with envelope-session assertions, and official chat models/handlers with mocked model calls and a real TypeScript adapter. They do not prove signed network delivery, mailbox access or ASI discovery.

Opt-in live API probe (reads the root `.env` key; does not print payloads or keys):

```bash
agents/weapon_smith/.venv/bin/python agents/weapon_smith/live_probe.py
# Optionally pass a PNG path and a file containing extracted-features JSON:
agents/weapon_smith/.venv/bin/python agents/weapon_smith/live_probe.py /path/doodle.png /path/features.json
```

On 2026-10-04, one live synthetic PNG request completed in **3.965 s** through local SDK ASGI REST → live ASI API → TS validation/balance → response. One live frost-spear text request completed in **3.716 s** through the local ACP handler, with acknowledgement + completed JSON artifact (some fields repaired by the validator). Earlier textless REST smoke request: 3.412 s. These are individual observations, not percentiles or deployed network latency. The 8/10/12 s bounds are not measurements. No actual ASI discovery test or public deployment test was performed.

## Demo scripts

**Entirely in ASI (after account registration/discovery verification):**

1. Ask ASI: “Find Weapon Smith for Doodle Arena and create a frost spear that slows enemies, with blue runes.” If natural-language discovery does not select it, record that as unverified; opening the profile directly only proves direct access.
2. The agent acknowledges, interprets the text, generates structured JSON, executes the TS validator/balance tool, and replies with completed mechanics and `{spec, stats}` JSON. Show cooldown, damage, range and effects. It explicitly says no live game insertion occurred.
3. Request “Create a five-projectile fire blaster with a wide spread.” Compare the per-projectile budget in the returned artifact. Copy the JSON without using a separate frontend. Record agent logs showing durations/status and the conversation result.

**Two-phone game:**

1. Host the screen on a laptop; connect two phones on the same network using the QR code. Start the round; draw an ice spear on phone A and a red mallet on phone B.
2. During preparation, show both roll/special tutorials while the two agent calls run concurrently. Tap “See my weapon,” read the finalized mechanics, then choose deployment spots. Show the Reveal, then move/attack on both phones; no agent/model call runs in combat.
3. In a second round, stop the agent (or point `AGENT_URL` to an unavailable host through the private secrets table). Repeat drawings. Show fallback weapons and that the existing deadline still advances to battle. Restore configuration for the live demo. Do not reset the database.
4. Record the two-phone video and actual end-to-end deployed latency. Those manual checks remain pending.

## Requirements checklist

| Requirement | Status / evidence |
|---|---|
| Configurable authenticated game provider | Implemented; mocked complete procedure + SDK REST tests; explicit private opt-in |
| Canonical schema and deterministic balance shared by game/chat | Implemented; real TS adapter + validation/balance tests |
| HTTP outside transactions, no combat requests | Verified by code review and mocked transaction assertions |
| Deadline, finalization, stale responses, deterministic fallback | Existing deadline retained; automated preparation/guard/failure tests |
| Concurrent bounded workflow and duplicate prevention | Automated tests; four active agent workflows, persistent bounded chat cache, per-round DB claims |
| Sprite/sound behavior without duplicate calls | Existing pipelines retained; shared claim guard + sound/sprite tests |
| ACP acknowledgements/session handling and manifest configuration | Official 0.3.0 models/handlers verified locally; publication success needs account/network deployment |
| Text weapon workflow entirely in conversation | Handler + live model test returns completed readable mechanics and artifact; actual ASI conversation pending |
| Game PNG model request | Live ASI API success with synthetic PNG; deployed procedure/network latency pending |
| Agentverse registration + mailbox | SDK/configuration/instructions implemented; account linking/listing/message delivery pending |
| ASI discovery | **Not verified**; needs registered online agent + actual ASI routing test |
| Two-phone gameplay demo | Script provided; manual run/video pending |
| Public deployment and published address | Pending; no deployment or registration claimed |
| Hackathon submission | Manual: public GitHub README/address, 3–5 minute video, Devpost, and MHacks ASI submission agent |

The [MHacks hackpack](https://www.fetch.ai/events/hackathons/mhacks-2026/hackpack) requires registration, ACP, ASI discoverability, meaningful execution and the complete primary workflow in ASI. The official [ACP reference](https://innovationlab.fetch.ai/resources/docs/agent-communication/agent-chat-protocol) and [ASI API quickstart](https://innovationlab.fetch.ai/resources/docs/asione/asi-one-quickstart) were checked during implementation. The ASI submission-agent link and current submission steps are in the hackpack; follow them manually after deployment. A mock chat test or API key alone does not satisfy discovery/submission requirements.
