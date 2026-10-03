# Weapon Smith (uAgent)

A Fetch.ai uAgent that turns a doodle into weapon JSON using ASI:One's `asi1` model.

It's a **provider** for the game, not part of the backend. The game's `gen_spec` procedure sends it
a doodle and gets JSON back. The game then validates it, applies the balance formula and stores it.
This agent never touches SpacetimeDB. If it's slow or down, the round uses the fallback weapon.

## Files

| File | What |
|---|---|
| `agent.py` | The uAgent: `GET /health`, `POST /spec` |
| `smith.py` | The ASI:One call |
| `models.py` | Request/response models |
| `schema.json` | **Generated.** System prompt, name flavors and JSON schema, exported from the TypeScript source by `pnpm agents:schema`. Don't edit by hand |

## Run

```bash
cd agents/weapon_smith
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # fill ASI_ONE_API_KEY, AGENT_SEED, AGENT_SHARED_SECRET
.venv/bin/python agent.py   # listens on :8001
```

## Contract

```bash
curl localhost:8001/health
# {"ok": true, "prompt_version": "spec.v1", "address": "agent1q…"}

curl -X POST localhost:8001/spec -H 'Content-Type: application/json' -d '{
  "token": "<AGENT_SHARED_SECRET>",
  "png_base64": "<base64 PNG>",
  "features_json": "{\"strokeCount\": 4, …}",
  "flavor": ""
}'
# {"weapon_json": "{\"name\": …}", "error": "", "prompt_version": "spec.v1", "seconds": 3.2}
```

- `error` is non-empty on failure, and `weapon_json` is then `""`. A bad token returns `"unauthorized"`.
- An empty `flavor` means one is picked at random from `schema.json`.
- The ASI:One call times out after 8 s, which stays under the game's 12 s `gen_spec` timeout.

## Keeping it in sync

After editing the enums in `packages/spec`, or the prompt or schema in `server/src/prompts/spec.v*.ts`:

```bash
pnpm agents:schema     # from the repo root; rewrites schema.json
```

## Roadmap

- **Phase 0 (done, in the game):** `SPEC_PROVIDER = 'asi1'` in `server/src/config.ts`, so the game
  calls ASI:One directly. Use it to measure the speed and quality baseline.
- **Phase 1 (this folder):** the agent with the same prompt and schema, behind a REST endpoint.
- **Phase 2:** add `'agent'` to `SPEC_PROVIDER` in the game, which posts to `AGENT_URL/spec` with
  `AGENT_SHARED_SECRET`. Both values go in the `secrets` table. Needs a public HTTPS URL
  (Fly, Render, a small VM, or ngrok for the demo).
- **Phase 3:** add the chat protocol and register on Agentverse so the agent is discoverable in ASI:One.
  On startup the agent warns that it can't register on the Almanac contract (no funds). For a
  hackathon, use `Agent(..., network="testnet")` and fund it from the testnet faucet, or use an
  Agentverse mailbox.

## Open check

Whether ASI:One accepts a base64 `data:` URL in `image_url`, or needs a hosted image URL, is not yet
verified with a real key. If it needs a hosted URL, the S3 upload has to work first.
