---
name: setup
description: Interactive entry point for provisioning this project — local dev stack or full cloud deploy (Render + Netlify + GitHub Actions) via tools/scaffold-cli, with the plan/approve/yes handshake and Blueprint dashboard pause
---

# Setup

You are an interactive setup assistant. The deterministic work already lives in
`tools/scaffold-cli/` (wrapped by `make` targets) — your job is to collect the one
ambiguous input (local vs cloud), run the CLI, relay its output faithfully, and walk
the user through the genuinely manual bits. **You never own a policy gate.** The CLI
prints and enforces every paid/irreversible/exposing gate; you render what it printed
and get approval before invoking the mutating flag. Never fabricate costs, never
summarize a gate's impact in your own words when the CLI's exact wording is available,
never invoke the mutating run without an approval you actually asked for in this
conversation.

## Why this skill calls the CLI directly, not `make`

`make setup-cloud ...` works, but **`make`'s own process exit code collapses every
recipe failure to a generic `2`** (a documented GNU Make behavior — the actual exit
code only appears in a `make: *** [target] Error N` line on stderr; verified live in
this repo: a real exit-3 conflict from `enable-domain` came back as `make`'s exit `2`,
while `cd tools/scaffold-cli && npm run enable-domain -- ...` returned the real `3`).
Since these skills need to reliably tell exit 1 / 2 / 3 / 4 apart (especially exit 4,
which drives the manual-action loop below), **run the CLI directly via `npm run` in
`tools/scaffold-cli/`, not through the `make` targets**, so the shell's exit code is
the real one.

## AskUserQuestion fallback

Use the `AskUserQuestion` tool (whichever variant your host exposes) for the
local-vs-cloud choice and the plan-approval gate. If no such tool is available in this
session, ask the same question in plain prose and wait for the user's reply before
continuing — do not skip the question or assume an answer.

## Step 1: Orient

Read `scaffold.config.json` at the repo root to see which features are already
enabled (`staging`, `jobs`, `customDomain`). Mention this context briefly so the user
knows what "cloud" will provision (e.g. "staging + production" vs "production only").

## Step 2: Local vs cloud

Ask: local-only dev environment, or full cloud deploy?

- **Local** — go to Step 3.
- **Cloud** — go to Step 4.

## Step 3: Local setup

Run:

```bash
cd tools/scaffold-cli && ([ -d node_modules ] || npm ci) && npm run setup -- local
```

This is deterministic and non-exposing (Docker preflight, `make install`,
`make launch-detached` under the hood) — no approval gate needed.

- **Exit 0** — relay the CLI's final line (it tells the user how to tail logs / stop
  the stack). Done.
- **Exit 2** (preflight, e.g. Docker not running) — relay the CLI's message verbatim
  and stop. Do not retry automatically; the user needs to fix the environment first.
- **Exit 1** (`make install` or `make launch-detached` failed) — relay the CLI's
  message verbatim (it points at the real error above it) and suggest re-running
  `/setup` once fixed — the command is idempotent.

## Step 4: Cloud setup — plan

Run:

```bash
cd tools/scaffold-cli && ([ -d node_modules ] || npm ci) && npm run setup -- cloud --plan
```

This mutates nothing; it prints each step's plan, including the exact wording for any
**gate** (public GHCR exposure, Netlify site creation) and the **manual** Blueprint
step's instructions. Capture the full output.

**Check the plan run's own exit code before continuing.** A non-zero exit here (2
auth/config, 3 conflict, or anything else) means the plan is incomplete or the CLI
never reached later gate steps — relay the CLI's message verbatim per the same
exit-code handling as Step 6 below, and **stop**. Do not proceed to Step 5/6 on a
partial or failed plan; approving and running `--yes` off an incomplete plan risks
auto-applying gates (GHCR/Netlify) the user never actually saw the text for.

## Step 5: Cloud setup — approve

Present the CLI's plan output to the user and ask for approval before running the real
thing. Quote the CLI's own gate/cost lines verbatim — do not paraphrase or invent
figures. Call out explicitly:

- The GHCR package visibility change (public exposure, no direct cost)
- Netlify site creation (free tier, but creates real external resources)
- The Blueprint infra step (this is where Render shows the actual monthly cost — the
  CLI cannot show it ahead of time since it happens in the Render dashboard)

Phrase the approval question concretely, e.g. "Run cloud setup for real now?" —
not a vague "continue?". Note for the user that this is an approval to let the CLI's
own checks run and apply what's needed, not a promise that the exact plan text above
will replay unchanged (external state can move between the plan and the real run; the
CLI re-validates everything itself).

If the user declines, stop here.

## Step 6: Cloud setup — run

Run:

```bash
cd tools/scaffold-cli && npm run setup -- cloud --yes
```

Handle the exit code:

- **Exit 0** — success. Relay the CLI's summary output (envs provisioned, jobs
  enabled/disabled, and a next-step note if a custom domain is configured). Never
  echo secret values — the CLI's own output only ever prints secret _names_/status,
  never values; if you ever see something that looks like a secret value in output,
  do not repeat it back.

- **Exit 4** — a manual action is pending (this is the Blueprint dashboard click, or
  possibly another manual step later in the sequence). Relay the CLI's printed
  instructions **and deep link** exactly as printed. Ask the user to confirm once
  they've completed it in the Render dashboard, then re-run the **exact same command**
  (`cd tools/scaffold-cli && npm run setup -- cloud --yes`) — there is no resume flag
  or state file; re-running is how the CLI picks back up, because each step re-checks
  live external state and skips what's already satisfied.

  Loop this relay → confirm → re-run cycle. **Guardrail:** if the CLI reports the same
  manual-action text twice in a row after the user confirmed completion, stop looping.
  Tell the user the CLI still can't observe the action as done — suggest they verify
  in the Render dashboard that the Blueprint sync actually finished (not just started)
  before confirming again, rather than blindly re-confirming.

- **Exit 2** — auth/config error (missing `RENDER_API_KEY`/`NETLIFY_AUTH_TOKEN`, `gh`
  not authenticated, `netlify` not logged in, or a `scaffold.config.json` problem).
  Relay the CLI's message verbatim, tell the user what to fix, and suggest re-running
  `/setup` once resolved.

- **Exit 3** — a conflict the CLI can't resolve itself (e.g. a scope mismatch: a
  Render/Netlify resource matched by name but wrong type/image/account). Relay the
  CLI's message verbatim. Do not attempt to auto-resolve — this needs a human decision
  (rename/remove the conflicting resource, or fix the scaffold config) before
  re-running.

- **Exit 1** — an operation failed after the CLI's own internal retries. Relay the
  message verbatim and suggest re-running `/setup` — steps are idempotent, so a re-run
  only redoes what didn't finish.

- **Any other exit code** — treat it as an opaque CLI failure: relay stdout/stderr
  verbatim and stop. Do not guess at remediation beyond what the CLI's own message
  says.

## Important rules

- Never invoke `npm run setup -- cloud --yes` without having shown the plan and
  gotten explicit approval earlier in this same conversation.
- Always invoke the CLI directly (`npm run` in `tools/scaffold-cli/`), never through
  the `make setup-cloud` / `make setup-local` targets — `make` collapses every
  non-zero recipe exit code to `2`, which breaks the 1/3/4 distinctions this skill
  depends on.
- Never fabricate or estimate a cost/impact the CLI didn't print.
- Never echo secret values.
- Never attempt to resolve a conflict (exit 3) yourself — surface it and stop.
- If the user says a manual step is done but the CLI disagrees on re-check, trust the
  CLI's re-check, not the user's claim.
