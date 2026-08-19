import type { GitHubClient } from './types.js';
import { NotFoundError } from './types.js';
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

  async packageVisibility(pkg: string): Promise<'public' | 'private' | 'unknown'> {
    const { owner } = await this.currentRepo();
    for (const scope of [`/users/${owner}`, `/orgs/${owner}`]) {
      try {
        const out = await this.gh(['api', `${scope}/packages/container/${encodeURIComponent(pkg)}`]);
        const v = (JSON.parse(out) as { visibility?: string }).visibility;
        if (v === 'public' || v === 'private') return v;
      } catch (err) {
        if (err instanceof NotFoundError) continue; // try the other owner scope
        throw err;
      }
    }
    return 'unknown';
  }

  async setPackagePublic(pkg: string): Promise<void> {
    const { owner } = await this.currentRepo();
    // GHCR visibility change endpoint. If GitHub returns 404 for this owner scope,
    // fall back to the org scope; if both fail the user can flip it in the UI
    // (documented in the README cloud runbook).
    let lastErr: unknown;
    for (const scope of [`/users/${owner}`, `/orgs/${owner}`]) {
      try {
        await this.gh([
          'api',
          '--method',
          'PATCH',
          `${scope}/packages/container/${encodeURIComponent(pkg)}/visibility`,
          '-f',
          'visibility=public',
        ]);
        return;
      } catch (err) {
        lastErr = err;
        if (err instanceof NotFoundError) continue;
        throw err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('failed to set package visibility');
  }

  async imageExists(image: string, tag: string): Promise<boolean> {
    const { owner } = await this.currentRepo();
    const pkg = image.split('/').pop() ?? image; // ghcr.io/owner/repo -> repo
    for (const scope of [`/users/${owner}`, `/orgs/${owner}`]) {
      try {
        const out = await this.gh([
          'api',
          '--paginate',
          `${scope}/packages/container/${encodeURIComponent(pkg)}/versions`,
        ]);
        const versions = JSON.parse(out) as Array<{ metadata?: { container?: { tags?: string[] } } }>;
        if (versions.some((v) => v.metadata?.container?.tags?.includes(tag))) return true;
        return false;
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
