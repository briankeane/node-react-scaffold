# Scaffold Cloud Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four thin LLM skill wrappers (`/setup`, `/enable-staging`, `/enable-jobs`,
`/enable-domain`) around the already-merged `tools/scaffold-cli/` engine — pure
orchestration (collect intent, run the CLI, drive the plan→approve→yes handshake,
surface conflicts, add the genuinely-human bits) with zero re-implemented logic.

**Architecture:** Each skill is a markdown prompt file under `.claude/skills/<name>/SKILL.md`
that shells out to the real `make` targets (`setup-local`, `setup-cloud`,
`enable-staging`, `enable-jobs`, `enable-domain`) and interprets the CLI's exit code /
stdout/stderr per the documented 0/1/2/3/4 contract. The CLI is the sole source of
truth for gate text, cost/impact wording, and conflict diffs — skills relay, never
fabricate.

**Tech Stack:** Markdown (Claude Code skills), no new code. Wraps the existing
TypeScript CLI in `tools/scaffold-cli/`.

**Spec:** `docs/superpowers/specs/2026-08-18-scaffold-deploy-and-setup-design.md`
("Skills (thin LLM wrappers)" + decision 5: the LLM never owns policy gates). The
original brief for this PR assumed engine PR #35 was still open and this branch would
stack on it; PR #35 merged to `develop` at 2026-08-19T18:31:25Z, before this session
started — see "Deviations from the brief" below.

## Global Constraints

- The LLM never owns a policy gate — the CLI prints and enforces cost/impact text for
  every paid/irreversible/exposing action; skills only render it and gate on approval
  before invoking the mutating flag.
- Never fabricate a cost, CNAME target, or exit-code meaning not present in the CLI's
  actual output — verified against real source reads, not the PR #35 description alone
  (which had a stale detail: it implied both `make setup-cloud PLAN=1 YES=1` and CLI
  flags `--plan`/`--yes` were both first-class; only `--plan`/`--yes` are real CLI
  flags, `PLAN=1`/`YES=1` are Makefile-only sugar).
- Match existing skill conventions in `.claude/skills/*/SKILL.md` (frontmatter:
  `name` + `description`; `enable-domain` additionally gets `argument-hint` like the
  existing `deploy` skill, since it takes a required domain argument).
- `setup cloud`'s manual Blueprint step has no resume flag or state file — resuming
  means re-running the identical command; each step's `check()` re-probes live
  external state.

---

## Task 1: Branch setup

**Files:** none (git operation only)

- [x] Confirm current branch (`briankeane/scaffold-cloud-engine`) is identical to
      `origin/develop` (PR #35 already merged): `git log origin/develop..HEAD` and
      `git log HEAD..origin/develop` both show only the merge commit / are empty.
- [x] Create `briankeane/scaffold-cloud-skills` off current HEAD: `git checkout -b briankeane/scaffold-cloud-skills`.

## Task 2: `/setup` skill

**Files:**

- Create: `.claude/skills/setup/SKILL.md`

**Interfaces:**

- Consumes: `make setup-local`, `make setup-cloud PLAN=1`, `make setup-cloud YES=1`
  (from root `Makefile`, wrapping `tools/scaffold-cli/src/cli.ts`'s `setup local` /
  `setup cloud [--plan|--yes]`). Exit codes per `tools/scaffold-cli/src/cli.ts:61-68`
  and `tools/scaffold-cli/src/cloud/orchestrator.ts:120-121`.
- Produces: the local-vs-cloud entry point the other three skills' docs reference
  ("run `/setup` (cloud path) to provision it").

- [x] Write `.claude/skills/setup/SKILL.md`: local path (run, relay exit 0/1/2),
      cloud path (`--plan` → AskUserQuestion approval quoting CLI gate text verbatim →
      `--yes` → exit-code branch covering 0/1/2/3/4, with the exit-4 relay→confirm→
      re-run loop capped at 2 repeated identical manual-action texts before escalating
      to the user instead of looping forever).
- [x] Include the AskUserQuestion-with-prose-fallback rule (brief requires
      AskUserQuestion; Codex consult confirmed following the brief over unwritten repo
      precedent, with a portability fallback for hosts that don't expose the tool).

## Task 3: `/enable-staging` skill

**Files:**

- Create: `.claude/skills/enable-staging/SKILL.md`

**Interfaces:**

- Consumes: `make enable-staging` (wraps `enableStaging()` in
  `tools/scaffold-cli/src/commands.ts:20-48`). Exit 0 success (stderr may carry
  warnings), exit 1 conflict (unified diff via `printConflicts()`).
- Produces: nothing consumed by other skills; documents "run `/setup` next" as the
  hand-off to Task 2.

- [x] Write `.claude/skills/enable-staging/SKILL.md`: run-and-relay, exit 0 relays any
      stderr warnings + "needs `/setup` cloud to provision", exit 1 surfaces the diff
      verbatim and does not attempt auto-resolution, any other exit treated opaque.

## Task 4: `/enable-jobs` skill

**Files:**

- Create: `.claude/skills/enable-jobs/SKILL.md`

**Interfaces:**

- Consumes: `make enable-jobs` (wraps `enableJobs()` in
  `tools/scaffold-cli/src/commands.ts:50-73`). Exit 0 success (stderr may carry the
  "REDIS_URL not wired" warning when `<env>-server` is missing), exit 1 conflict.

- [x] Write `.claude/skills/enable-jobs/SKILL.md`: same shape as Task 3, explicitly
      calling out the REDIS_URL-not-wired warning case since it's easy to miss in a
      wall of output.

## Task 5: `/enable-domain` skill

**Files:**

- Create: `.claude/skills/enable-domain/SKILL.md`

**Interfaces:**

- Consumes: `make enable-domain DOMAIN=<domain> ENV=<env>` (wraps `enableDomain()` in
  `tools/scaffold-cli/src/commands.ts:80-99`). Exit 0 success prints the CNAME target +
  Cloudflare grey-cloud line; exit 3 conflict (multi-domain hand-edit or missing
  `<env>-server`).

- [x] Write `.claude/skills/enable-domain/SKILL.md`: collect domain (+ env if
      ambiguous) via AskUserQuestion/prose fallback, run the patcher, relay CNAME +
      grey-cloud text verbatim, add generic (not fabricated-UI) registrar DNS guidance,
      exit 3 surfaces the diff without auto-resolving.

## Task 6: Doc routing updates

**Files:**

- Modify: `CLAUDE.md` (Task-Type Quick Reference table)
- Modify: `README.md` (Claude Code Skills table)

- [ ] Add 4 rows to `CLAUDE.md`'s Task-Type Quick Reference table.
- [ ] Add 4 rows to `README.md`'s Claude Code Skills table.

## Task 7: Dry-run verification against the real CLI

**Files:** none (verification only, no code changes; any file mutated by a live dry
run must be reverted with `git checkout --` immediately after)

- [x] Ran `make setup-cloud PLAN=1` live (no `RENDER_API_KEY` in this environment) —
      hit the real preflight `AuthError` path, exit 2, message
      `[preflight] RENDER_API_KEY is not set in the environment`. Matches the skill's
      exit-2 handling.
- [x] Ran `make enable-domain DOMAIN=app.example.com` live on a clean `render.yaml` —
      confirmed exit 0 output shape (including the **critical discovery** that the
      printed CNAME line embeds a literal placeholder,
      `<your-production-server>.onrender.com`, not a resolved hostname — updated
      `.claude/skills/enable-domain/SKILL.md` to explain this so the skill doesn't
      tell a user to paste the angle-bracket text verbatim as a DNS target). Reverted
      with `git checkout -- render.yaml scaffold.config.json`.
- [x] Hand-edited `render.yaml` to a hand-managed multi-domain list, re-ran
      `enable-domain` — confirmed the exit-3 conflict path and `printConflicts()`
      diff format match the skill's description. Reverted.
- [x] Ran `enable-staging` live — confirmed exit-0 output and file mutations
      (`render.yaml` domains-adjacent block, new
      `.github/workflows/deploy-staging.yml`). Reverted (including deleting the new
      workflow file).
- [x] **Critical finding, not anticipated by the brief:** `make`'s own process exit
      code collapses every non-zero recipe exit code to a generic `2` — this is
      documented GNU Make behavior (confirmed independently with a throwaway
      Makefile), not a bug in this repo's `Makefile`. Live proof: `enable-domain`'s
      real exit `3` conflict came back as `make`'s exit `2`; the true code only
      appears in the `make: *** [target] Error N` stderr line. This silently breaks
      every skill's ability to distinguish exit 1 vs 3 vs 4 if invoked via `make`
      targets. **Fix:** all four skills now invoke `tools/scaffold-cli` directly via
      `npm run <script> -- <args>` (confirmed live: `npm run enable-domain` returned
      the real exit `3`) instead of the `make` targets. The brief's own wording
      already permitted this ("Run the command (`make enable-staging` /
      `make enable-jobs` **or the CLI entry**)"), so this is a reconciliation within
      the brief's stated options, not a deviation from it.
- [x] Confirmed no skill references a flag/exit-code/command the CLI doesn't expose
      (cross-checked every invocation in all four `SKILL.md` files against
      `tools/scaffold-cli/src/cli.ts` and `commands.ts` directly).

## Task 8: Build/test/lint gates

**Files:** none

- [ ] `make build-server && make lint-server && make test-server`
- [ ] client equivalents
- [ ] `make test-scaffold-cli`
- [ ] `make prettier-all`
- [ ] confirm no client build artifacts staged

## Task 9: Codex adversarial pass

**Files:** none

- [ ] `/codex review` on the final diff (skills-markdown + 2 doc tables; skip a heavy
      challenge pass per the triviality-threshold rule unless review surfaces
      something non-trivial).

## Task 10: Push + PR

**Files:** none

- [ ] `make prettier-all`, commit, push `briankeane/scaffold-cloud-skills`.
- [ ] `gh pr create --base develop`, noting the branch is a normal PR against
      `develop` now that PR #35 (engine) is already merged — not a stacked PR as the
      original brief assumed.
- [ ] Run `/fix-review`. No Greptile re-review if confidence ≥ 4/5. Do not merge.

---

## Deviations from the brief

1. **PR #35 sequencing assumption was stale.** The brief said "PR #35 ... (open,
   unmerged)" and instructed branching off `briankeane/scaffold-cloud-engine` as a
   stack. In reality PR #35 merged to `develop` at `2026-08-19T18:31:25Z`, shortly
   before this session started. Since the engine branch's HEAD is now identical to
   `origin/develop`, this branch is functionally rooted at `develop` already — no
   stacking needed. The PR this produces will be a normal PR against `develop`, not a
   stacked one; the "how to merge the stack" note in the final report is simplified to
   "just merge this PR normally."
2. **`--plan`/`--yes` vs `PLAN=1`/`YES=1`**: confirmed both exist but at different
   layers (Makefile env-var sugar → real CLI flags), not two independent flag systems
   as the PR #35 description's phrasing could suggest.
