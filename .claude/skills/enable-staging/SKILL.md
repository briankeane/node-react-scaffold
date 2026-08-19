---
name: enable-staging
description: Idempotently enable the staging environment (patches render.yaml + adds the staging deploy workflow) via the tools/scaffold-cli patcher
---

# Enable Staging

Staging is off by default (`scaffold.config.json` → `features.staging: false`).
Enabling it is a one-shot, idempotent structural patch — no ambiguous input to
collect, so this skill is a thin run-and-relay wrapper.

Run:

```bash
cd tools/scaffold-cli && ([ -d node_modules ] || npm ci) && npm run enable-staging
```

Invoke the CLI directly like this rather than `make enable-staging` — `make`'s own
process exit code collapses every non-zero recipe exit code to a generic `2`
(verified live in this repo), which would hide the real 0-vs-1 distinction this skill
depends on. `npm run` propagates the CLI's actual exit code.

## Exit 0 — success

- If the CLI printed anything to stderr, relay it verbatim — these are warnings, not
  failures (e.g. a note about a wiring gap the patch couldn't resolve on its own).
- Tell the user the render.yaml (and, if newly created, the staging deploy workflow)
  are patched and committed to the working tree, but **staging isn't provisioned in
  Render yet** — the new service only exists once they run `/setup` (cloud path) to
  actually stand it up.

## Exit 1 — conflict

The patcher found a **scaffold-owned block** in `render.yaml` or the staging workflow
file that's been hand-edited in a way that's incompatible with the patch it needs to
apply. It refused to overwrite it and changed nothing.

- Surface the printed unified diff **verbatim** — it shows exactly what the patcher
  expected vs what's actually in the file.
- Explain plainly: a block the scaffold owns was hand-edited, so the patcher stopped
  rather than clobbering it.
- **Do not attempt to auto-resolve this.** The user needs to either revert their edit
  to that block or reconcile it manually, then re-run `/enable-staging` — the patch is
  idempotent, so a clean re-run is safe.

## Any other exit code

Treat as an opaque CLI failure: relay stdout/stderr verbatim and stop.
