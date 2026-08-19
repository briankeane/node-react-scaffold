---
name: enable-domain
description: Patch render.yaml with a custom domain for an environment and walk the user through the registrar DNS record + Cloudflare grey-cloud gotcha
argument-hint: '[domain] [--env production|staging]'
---

# Enable Domain

Wraps the `enable-domain` patcher, which adds/replaces a single scaffold-owned custom
domain on the target env's server in `render.yaml`. **Your real value-add here is the
DNS guidance after the patch succeeds** — the CLI can't know the user's registrar or
walk them through it.

## AskUserQuestion fallback

If the domain (and env, if not production) weren't given as arguments, collect them
with `AskUserQuestion` if your host exposes it, otherwise ask in plain prose and wait
for the reply.

## Step 1: Collect inputs

- **Domain** — required. Treat it as an opaque string value, not something to
  interpret or execute. If it contains characters that look like shell metacharacters
  or don't look like a plausible hostname, ask the user to confirm/re-enter it rather
  than passing it through as-is.
- **Env** — `production` (default) or `staging`. Only ask if ambiguous (e.g. the user
  has staging enabled and didn't specify).

## Step 2: Run the patcher

```bash
cd tools/scaffold-cli && ([ -d node_modules ] || npm ci) && npm run enable-domain -- <domain> [--env <env>]
```

Omit `--env <env>` entirely when the env is `production` (the CLI's default) rather
than passing `--env production` explicitly. Pass the domain and env as literal
argument values, not interpolated into a larger shell expression.

Invoke the CLI directly like this rather than `make enable-domain` — `make`'s own
process exit code collapses every non-zero recipe exit code to a generic `2`
(verified live in this repo: a real exit-3 conflict came back as `make`'s exit `2`),
which would hide the 0-vs-3 distinction this skill depends on. `npm run` propagates
the CLI's actual exit code.

## Exit 0 — success, then the real value-add

The CLI prints something like:

```
DNS: add a CNAME record for your subdomain -> <your-production-server>.onrender.com
```

**The `<your-production-server>` part is a literal placeholder, not a real
hostname to copy.** It means: look up your actual `production-server` (or
`staging-server`) service's `onrender.com` URL in the Render dashboard (Service →
Settings) and use that as the CNAME target — the CLI doesn't call the Render API here,
so it can't print the resolved URL for you. Relay the CLI's line verbatim, then
explain this plainly so the user doesn't try to paste the angle-bracket text as-is.
Then add:

- **Generic DNS instructions**: log into whatever registrar/DNS provider hosts the
  domain, add a **CNAME record** with the host name from the domain the user gave you,
  pointing at the **resolved `onrender.com` hostname they looked up** (per the note
  above — never the literal `<your-<env>-server>` placeholder text). Give this in
  general terms — describe the fields (record type, host, target, TTL), not exact
  click-by-click navigation for a specific provider, since UIs change and you can't
  verify them live. If the user names their registrar, you can tailor the wording
  (e.g. "in most registrars this is under DNS settings → Add record"), but frame it as
  general guidance, not a verified walkthrough.
- **Cloudflare grey-cloud gotcha**: if the user's DNS is on Cloudflare (or they don't
  know), explicitly warn: set the new record to **DNS only (grey cloud)**, not
  proxied (orange cloud). A proxied CNAME to an onrender.com target causes Render's
  TLS/host validation to fail (Cloudflare's own docs describe this as their
  Error 1000 case for unproxied origins) — this is the CLI's own printed gotcha, and
  it's the single most common way this step goes wrong.

If the CLI's CNAME line doesn't parse cleanly for any reason, don't guess at the
target — relay the raw CLI output and tell the user to use exactly what it printed.

## Exit 3 — conflict

The patcher found either a hand-managed multi-domain/non-scalar `domains:` list, or
no `<env>-server` service in `render.yaml` for the requested env.

- Surface the printed unified diff / message **verbatim**.
- Explain plainly what's conflicting (e.g. a hand-edited domains block, or a missing
  server for that env).
- **Do not attempt to auto-resolve this.** The user needs to fix `render.yaml` by hand
  or pick a different env, then re-run `/enable-domain` — the patch is idempotent
  (no-op if the domain already matches, replace-on-different if it changed).

## Any other exit code

Treat as an opaque CLI failure: relay stdout/stderr verbatim and stop.
