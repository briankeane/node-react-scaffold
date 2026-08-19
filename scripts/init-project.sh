#!/bin/bash

set -euo pipefail

SCAFFOLD_NAME="node-react-scaffold"

# Portable in-place edit. `sed -i` differs between BSD/macOS (`-i ''`) and
# GNU/Linux (`-i`); writing through a temp file behaves identically on both.
# Returns 0 only when the file actually changed, 1 when the pattern didn't match
# (a no-op) or the file is missing — callers report just the real changes rather
# than blindly claiming every edit landed.
replace_in_file() {
  local expr=$1 file=$2
  [ -f "$file" ] || return 1
  local tmp
  tmp=$(mktemp)
  sed "$expr" "$file" >"$tmp"
  if cmp -s "$tmp" "$file"; then
    rm -f "$tmp"
    return 1
  fi
  cat "$tmp" >"$file"
  rm -f "$tmp"
  return 0
}

echo "=== Project Initializer ==="
echo ""

# Accept the name as an argument for non-interactive use (e.g. templating
# scripts); fall back to an interactive prompt.
PROJECT_NAME="${1:-}"
if [ -z "$PROJECT_NAME" ]; then
  read -rp "Project name (kebab-case, e.g. my-cool-app): " PROJECT_NAME
fi

if [ -z "$PROJECT_NAME" ]; then
  echo "Error: Project name cannot be empty" >&2
  exit 1
fi

# Validate kebab-case
if ! echo "$PROJECT_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  echo "Error: Project name must be kebab-case (lowercase letters, numbers, hyphens)" >&2
  exit 1
fi

echo ""
echo "Renaming project from '$SCAFFOLD_NAME' to '$PROJECT_NAME'..."

UPDATED=()
NOTES=()

# Root package.json name
if replace_in_file "s/\"name\": \"$SCAFFOLD_NAME\"/\"name\": \"$PROJECT_NAME\"/" package.json; then
  UPDATED+=("package.json (name)")
else
  NOTES+=("package.json: no \"name\": \"$SCAFFOLD_NAME\" entry to rename (already done or changed).")
fi

# README title
if replace_in_file "s/^# Node\/React Scaffold/# $PROJECT_NAME/" README.md; then
  UPDATED+=("README.md (title)")
else
  NOTES+=("README.md: scaffold title heading not found (already done or changed).")
fi

# API docs title (single-quoted in source; appears in two blocks)
if replace_in_file "s/title: 'API Documentation'/title: '$PROJECT_NAME API'/g" server/src/docs/index.ts; then
  UPDATED+=("server/src/docs/index.ts (API title)")
else
  NOTES+=("server/src/docs/index.ts: API title not found (already done or changed).")
fi

# render.yaml GHCR image path. Only meaningful for github.com remotes — the
# scaffold's CI publishes to ghcr.io (github.com only). Derive the lowercased
# owner/repo from the git `origin` remote and swap the placeholder. Anything
# unexpected leaves the placeholder untouched with a note; `/setup` re-checks it
# before deploying.
if [ -f render.yaml ]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [ -z "$REMOTE_URL" ]; then
    NOTES+=("render.yaml: no git 'origin' remote — left the ghcr.io/YOUR_ORG/YOUR_REPO placeholder (/setup will remind you).")
  elif ! grep -q 'YOUR_ORG/YOUR_REPO' render.yaml; then
    NOTES+=("render.yaml: no ghcr.io/YOUR_ORG/YOUR_REPO placeholder present — left the image path as-is.")
  else
    # Host: strip scheme / user prefix, keep up to the first ':' or '/'.
    HOST=$(printf '%s' "$REMOTE_URL" | sed -E 's#^ssh://##; s#^https?://##; s#^git@##; s#[:/].*$##' | tr '[:upper:]' '[:lower:]')
    # Slug: trailing owner/repo from any remote shape, minus a .git suffix.
    SLUG=$(printf '%s' "$REMOTE_URL" | sed -E 's#\.git$##; s#^.*[:/]([^/:]+/[^/]+)$#\1#' | tr '[:upper:]' '[:lower:]')
    if [ "$HOST" != "github.com" ]; then
      NOTES+=("render.yaml: git 'origin' host is '$HOST', not github.com — left the placeholder (GHCR is github.com only; set the image manually or via /setup).")
    elif ! printf '%s' "$SLUG" | grep -qE '^[a-z0-9._-]+/[a-z0-9._-]+$'; then
      NOTES+=("render.yaml: could not parse owner/repo from git 'origin' ($REMOTE_URL) — left the placeholder (/setup will remind you).")
    elif [ "${SLUG##*/}" = "$SCAFFOLD_NAME" ]; then
      NOTES+=("render.yaml: git 'origin' still points at the scaffold template — left the placeholder (/setup will remind you).")
    elif replace_in_file "s#YOUR_ORG/YOUR_REPO#$SLUG#g" render.yaml; then
      UPDATED+=("render.yaml (image path -> ghcr.io/$SLUG)")
    else
      NOTES+=("render.yaml: placeholder swap produced no change — check the image path manually.")
    fi
  fi
fi

echo ""
if [ ${#UPDATED[@]} -gt 0 ]; then
  echo "Updated:"
  for u in "${UPDATED[@]}"; do echo "  - $u"; done
else
  echo "No files changed (already initialized?)."
fi
if [ ${#NOTES[@]} -gt 0 ]; then
  echo ""
  echo "Notes:"
  for n in "${NOTES[@]}"; do echo "  - $n"; done
fi
echo ""
echo "COMPOSE_PROJECT_NAME is set by 'make install' from this directory's name."
echo ""
echo "Next steps:"
echo "  1. make install"
echo "  2. make launch"
echo "  3. Open http://localhost:3000"
