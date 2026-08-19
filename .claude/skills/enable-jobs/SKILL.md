---
name: enable-jobs
description: Idempotently enable background jobs (Redis keyvalue + worker service) via the tools/scaffold-cli patcher
---

# Enable Jobs

Background jobs (Redis keyvalue + worker service) are off by default
(`scaffold.config.json` → `features.jobs: false`). Enabling it is a one-shot,
idempotent structural patch across `render.yaml` and `docker-compose.yaml` — no
ambiguous input to collect, so this skill is a thin run-and-relay wrapper.

Run:

```bash
cd tools/scaffold-cli && ([ -d node_modules ] || npm ci) && npm run enable-jobs
```

Invoke the CLI directly like this rather than `make enable-jobs` — `make`'s own
process exit code collapses every non-zero recipe exit code to a generic `2`
(verified live in this repo), which would hide the real 0-vs-1 distinction this skill
depends on. `npm run` propagates the CLI's actual exit code.

## Exit 0 — success

- If the CLI printed anything to stderr, relay it verbatim — these are warnings, not
  failures. In particular, watch for a warning that jobs were enabled but a
  `<env>-server` service wasn't found for one of the enabled envs, meaning
  `REDIS_URL` couldn't be wired for that env — if you see this, call it out clearly
  rather than letting it slide past in a wall of output.
- Tell the user `render.yaml`/`docker-compose.yaml` are patched, and
  `scaffold.config.json`'s `features.jobs` flag is now flipped to `true` — all three
  are committed to the working tree together. Mention the flag explicitly (not just
  the infra files): it's what later `/setup` runs read to decide which envs get a
  keyvalue + worker provisioned, so it matters for anyone reviewing the diff or
  wanting to revert. **The keyvalue + worker aren't provisioned in Render yet** — they
  only exist once the user runs `/setup` (cloud path) to actually stand them up.

## Exit 1 — conflict

The patcher found a **scaffold-owned block** in `render.yaml` or
`docker-compose.yaml` that's been hand-edited in a way that's incompatible with the
patch it needs to apply. It refused to overwrite it and changed nothing.

- Surface the printed unified diff **verbatim**.
- Explain plainly: a block the scaffold owns was hand-edited, so the patcher stopped
  rather than clobbering it.
- **Do not attempt to auto-resolve this.** The user needs to either revert their edit
  to that block or reconcile it manually, then re-run `/enable-jobs` — the patch is
  idempotent, so a clean re-run is safe.

## Any other exit code

Treat as an opaque CLI failure: relay stdout/stderr verbatim and stop.
