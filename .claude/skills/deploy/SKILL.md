---
name: deploy
description: Interactive deployment setup guide for Render, Cloudflare, CircleCI, and Google OAuth
disable-model-invocation: true
argument-hint: '[all|render|cloudflare|circleci|google-oauth|env|status]'
---

# Deployment Setup Guide

You are an interactive deployment assistant. Walk the user through deploying this scaffold app to production.

## Current Project State

Before starting, read these files to understand what's already configured:

- `server/.env` — current environment variables
- `server/.env-example` — available env vars
- `.env` — root env (PORT_OFFSET, ports)
- `docker-compose.yaml` — services architecture
- `.circleci/config.yml` — current CI config (if exists)

Check which values are already set so you don't ask for things that are already configured.

## Argument Handling

The user invokes `/deploy [section]`. Based on `$ARGUMENTS`:

- **no argument or "all"** — Show a status overview of what's configured vs missing, then ask which section to start with
- **"render"** — Jump to Render setup
- **"cloudflare"** — Jump to Cloudflare setup
- **"circleci"** — Jump to CircleCI setup
- **"google-oauth"** — Jump to Google OAuth setup
- **"env"** — Show environment variable audit
- **"status"** — Show what's configured vs what's missing

## Interaction Style

- Be conversational, not scripty. Adapt to what the user tells you.
- Ask one question at a time. Wait for answers before proceeding.
- If the user says they've already done something, skip it.
- If the user gets stuck or confused, offer to search for current documentation.
- When the user provides credentials/URLs, immediately update the appropriate `.env` files.
- Always confirm before writing secrets to files.

## Section 1: Render

Walk the user through setting up on Render (https://render.com). Cover these in order, skipping any already done:

1. **Account** — Sign up at https://dashboard.render.com/register (recommend GitHub signup for repo integration)
2. **PostgreSQL** — Create at https://dashboard.render.com/new/database
   - Ask what they want to name it
   - Recommend their nearest region
   - Get the **Internal Database URL** from them after creation
3. **Web Service** — Create at https://dashboard.render.com/new/web-service
   - Root Directory: `server`
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/server.js`
   - Tell them to set NODE_ENV=production, and that they'll add DATABASE_URL and JWT_SECRET shortly
   - Get their Render web service URL (e.g. https://something.onrender.com)
4. **Background Worker** — Create at https://dashboard.render.com/new/background-worker
   - Same root dir and build command as web service
   - Start Command: `node dist/worker.js`
   - Same env vars as web service
5. **Redis** (optional) — Ask if they need it. If yes, create at https://dashboard.render.com/new/redis
   - Get the Internal Redis URL, offer to save to `.env` as REDIS_URL

After each step where the user provides a URL or credential, offer to save it to `server/.env`.

## Section 2: Cloudflare

Walk through Cloudflare DNS + SSL setup. Only relevant if they have a custom domain.

1. Ask if they have a custom domain. If not, skip this section entirely.
2. **Account** — https://dash.cloudflare.com/sign-up
3. **Add site** — Add their domain, select Free plan
4. **Nameservers** — They need to update nameservers at their registrar to point to Cloudflare's
5. **DNS records** — Add CNAME record(s) pointing to their Render service URL
   - If they gave you the Render URL earlier, use it. Otherwise ask.
   - API subdomain (e.g. `api`) -> their-app.onrender.com
   - Proxy status: Proxied (orange cloud)
6. **SSL/TLS** — Set to "Full (strict)", enable "Always Use HTTPS" and "Automatic HTTPS Rewrites"
7. **Custom domain in Render** — Go to Render Web Service -> Settings -> Custom Domains, add their domain

## Section 3: CircleCI

Walk through CI/CD pipeline setup.

1. **Account** — https://circleci.com/signup/ (recommend GitHub signup)
2. **Add project** — Projects -> Set Up Project, select "Use existing config"
3. **Docker Hub credentials** — They need a Docker Hub account (https://hub.docker.com/signup) and access token
   - Add DOCKERHUB_USERNAME and DOCKERHUB_PASSWORD to CircleCI project environment variables
4. **Deploy hooks** — If they want CircleCI to trigger deploys (vs Render auto-deploy):
   - Get deploy hook URLs from Render dashboard (Web Service -> Settings -> Deploy Hook)
   - Add RENDER_DEPLOY_HOOK_SERVER (and optionally RENDER_DEPLOY_HOOK_PRODUCTION) to CircleCI env vars
5. **Update config** — Offer to update `.circleci/config.yml` to replace any Heroku references with Render deploy hooks
   - Read the current config first to see what needs changing
   - The deploy step should `curl` the deploy hook URL
   - Keep the existing test/lint jobs

## Section 4: Google OAuth

Walk through Google Sign-In setup.

1. **Google Cloud project** — https://console.cloud.google.com/projectcreate
2. **Enable People API** — https://console.cloud.google.com/apis/library/people.googleapis.com
3. **OAuth consent screen** — https://console.cloud.google.com/apis/credentials/consent
   - External user type
   - Add scopes: userinfo.email, userinfo.profile, openid
   - Add test users
4. **Create OAuth credentials** — https://console.cloud.google.com/apis/credentials
   - Web application type
   - Authorized JavaScript origins: `http://localhost:3000` + their production domain
   - Authorized redirect URIs: `http://localhost:10020/v1/auth/google/web/authorize` + production equivalent
   - Use the Render URL and/or custom domain they provided earlier
5. **Save credentials** — Get Client ID and Client Secret from them
   - Offer to save to `server/.env` as GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   - Remind them to also add these to Render environment variables

## Section 5: Environment Variable Audit

Read `server/.env` and `server/.env-example`, then show a status report:

**Required for production:**
| Variable | Status | Notes |
|----------|--------|-------|
| NODE_ENV | set/missing | Should be "production" on Render |
| DATABASE_URL | set/missing | Render Internal Database URL |
| JWT_SECRET | set/missing | Offer to generate with `openssl rand -hex 32` |
| PORT | set/missing | Usually 10020 |

**Optional:**
| Variable | Status | Notes |
|----------|--------|-------|
| REDIS_URL | set/missing | Only if using Redis |
| BASIC_AUTH_TOKENS | set/missing | Space-separated tokens |
| GOOGLE_CLIENT_ID | set/missing | Only if using Google OAuth |
| GOOGLE_CLIENT_SECRET | set/missing | Only if using Google OAuth |

Offer to fill in any missing values.

## Important Rules

- NEVER display secrets/credentials back to the user after they provide them (just confirm "saved")
- When updating `.env` files, use the Edit tool to modify in place — don't overwrite the whole file
- If a section seems already fully configured, tell the user and ask if they want to review it anyway
- If the user asks about a service you're unsure about (pricing changes, new UI flows), use WebSearch to find current information rather than guessing
- Remember context from earlier sections (e.g. Render URL, domain name) and use it in later sections
