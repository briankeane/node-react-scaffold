import type { GitHubClient } from './types.js';
import { NotFoundError, ToolError } from './types.js';
import { execCapture } from './exec.js';

// GitHub client over the `gh` CLI. gh carries its own auth + the current repo
// context, so this needs no tokens passed in. Package (GHCR) endpoints are fiddly
// around owner type + lowercase names; keep that resolution here and documented.
export class GitHubCli implements GitHubClient {
  private ownerCache?: { owner: string; name: string };

  private async gh(args: string[], input?: string): Promise<string> {
    return execCapture('gh', args, input === undefined ? {} : { input });
  }

  async authStatus(): Promise<boolean> {
    try {
      await this.gh(['auth', 'status']);
      return true;
    } catch {
      return false;
    }
  }

  async currentRepo(): Promise<{ owner: string; name: string }> {
    if (this.ownerCache) return this.ownerCache;
    const out = await this.gh(['repo', 'view', '--json', 'owner,name']);
    const parsed = JSON.parse(out) as { owner: { login: string }; name: string };
    this.ownerCache = { owner: parsed.owner.login, name: parsed.name };
    return this.ownerCache;
  }

  // Owner-scoped package API paths, in probe order: the authenticated user's own
  // packages (works for PRIVATE packages, unlike /users/{owner}), then the org.
  private async packageScopes(pkg: string): Promise<string[]> {
    const { owner } = await this.currentRepo();
    const p = encodeURIComponent(pkg);
    return [`/user/packages/container/${p}`, `/orgs/${owner}/packages/container/${p}`];
  }

  async packageVisibility(pkg: string): Promise<'public' | 'private' | 'unknown'> {
    for (const scope of await this.packageScopes(pkg)) {
      try {
        const out = await this.gh(['api', scope]);
        const v = (JSON.parse(out) as { visibility?: string }).visibility;
        if (v === 'public' || v === 'private') return v;
      } catch (err) {
        if (err instanceof NotFoundError) continue; // try the next owner scope
        throw err;
      }
    }
    return 'unknown';
  }

  async setPackagePublic(pkg: string): Promise<void> {
    // GitHub's package-visibility update is a PUT to .../visibility. Try the
    // authenticated user's own package first, then the org. If neither works,
    // guide the user to the UI toggle (documented in the README cloud runbook).
    let lastErr: unknown;
    for (const scope of await this.packageScopes(pkg)) {
      try {
        await this.gh(['api', '--method', 'PUT', `${scope}/visibility`, '-f', 'visibility=public']);
        return;
      } catch (err) {
        lastErr = err;
        if (err instanceof NotFoundError) continue;
        throw err;
      }
    }
    throw new ToolError(
      `Could not set GHCR package "${pkg}" public via the API (${(lastErr as Error)?.message ?? 'not found'}). ` +
        'Flip it in the UI (Packages -> ' +
        pkg +
        ' -> Package settings -> Change visibility -> Public), or attach a Render registry credential, then re-run.',
    );
  }

  async imageExists(image: string, tag: string): Promise<boolean> {
    const pkg = image.split('/').pop() ?? image; // ghcr.io/owner/repo -> repo
    for (const scope of await this.packageScopes(pkg)) {
      try {
        const out = await this.gh(['api', '--paginate', `${scope}/versions`]);
        const versions = JSON.parse(out) as Array<{ metadata?: { container?: { tags?: string[] } } }>;
        return versions.some((v) => v.metadata?.container?.tags?.includes(tag));
      } catch (err) {
        if (err instanceof NotFoundError) continue; // package not found under this scope
        throw err;
      }
    }
    return false;
  }

  async listSecrets(): Promise<string[]> {
    const out = await this.gh(['secret', 'list', '--json', 'name']);
    const parsed = JSON.parse(out) as Array<{ name: string }>;
    return parsed.map((s) => s.name);
  }

  async setSecret(name: string, value: string): Promise<void> {
    // Value on stdin so it never appears in the process list / argv.
    await this.gh(['secret', 'set', name], value);
  }
}
