import type { NetlifyClient, NetlifySite } from './types.js';
import { ToolError } from './types.js';
import { execCapture } from './exec.js';

interface RawSite {
  id?: string;
  site_id?: string;
  name: string;
  account_slug?: string;
}

function toSite(raw: RawSite): NetlifySite {
  return { id: String(raw.id ?? raw.site_id), name: raw.name, accountSlug: String(raw.account_slug ?? '') };
}

// Netlify client over the `netlify` CLI. Auth comes from the CLI's own login /
// NETLIFY_AUTH_TOKEN env.
export class NetlifyCli implements NetlifyClient {
  private nf(args: string[]): Promise<string> {
    return execCapture('netlify', args);
  }

  async loginStatus(): Promise<boolean> {
    try {
      await this.nf(['status', '--json']);
      return true;
    } catch {
      return false;
    }
  }

  async accountSlug(): Promise<string> {
    const out = await this.nf(['api', 'listAccountsForUser']);
    const accounts = JSON.parse(out) as Array<{ slug: string }>;
    if (!accounts.length) throw new ToolError('no Netlify accounts for this user');
    return accounts[0].slug;
  }

  async findSite(name: string): Promise<NetlifySite | undefined> {
    const out = await this.nf(['api', 'listSites']);
    const sites = JSON.parse(out) as RawSite[];
    const match = sites.find((s) => s.name === name);
    return match ? toSite(match) : undefined;
  }

  async createSite(name: string, accountSlug: string): Promise<NetlifySite> {
    const out = await this.nf(['sites:create', '--name', name, '--account-slug', accountSlug, '--json']);
    return toSite(JSON.parse(out) as RawSite);
  }

  async setSiteEnv(siteId: string, key: string, value: string): Promise<void> {
    await this.nf(['env:set', key, value, '--site', siteId]);
  }

  async getSiteEnv(siteId: string, key: string): Promise<string | undefined> {
    // Best-effort read; on any failure return undefined so the step safely
    // re-applies (setSiteEnv is idempotent) rather than crashing.
    try {
      const out = (await this.nf(['env:get', key, '--json', '--site', siteId])).trim();
      if (!out) return undefined;
      try {
        const parsed = JSON.parse(out) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && key in parsed) {
          const v = parsed[key];
          return v == null || v === '' ? undefined : String(v);
        }
      } catch {
        // not JSON — fall through to plain-text handling
      }
      return /not set|no value/i.test(out) ? undefined : out;
    } catch {
      return undefined;
    }
  }
}
