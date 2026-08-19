import type { RenderClient, RenderService, EnvGroup, RenderServiceType } from './types.js';
import { AuthError, NotFoundError, ConflictError, RetryableError, ToolError } from './types.js';

const API = 'https://api.render.com/v1';

// Map an HTTP status to a typed error (or undefined for 2xx). Pure + unit-tested.
export function classifyHttp(status: number, message = ''): Error | undefined {
  if (status >= 200 && status < 300) return undefined;
  if (status === 401 || status === 403) return new AuthError(message || `HTTP ${status}`);
  if (status === 404) return new NotFoundError(message || 'HTTP 404');
  if (status === 409) return new ConflictError(message || 'HTTP 409');
  if (status === 429 || status >= 500) return new RetryableError(message || `HTTP ${status}`);
  return new ToolError(message || `HTTP ${status}`);
}

// Render API service `type` -> our render.yaml-flavored type. Unknown types map
// to undefined (caller ignores them, e.g. static sites we don't provision here).
export function mapRenderType(apiType: string): RenderServiceType | undefined {
  switch (apiType) {
    case 'web_service':
      return 'web';
    case 'background_worker':
      return 'worker';
    case 'key_value':
    case 'redis':
      return 'keyvalue';
    case 'private_service':
      return 'pserv';
    case 'cron_job':
      return 'cron';
    default:
      return undefined;
  }
}

// Parse the Render list-services response into our RenderService[]. Defensive
// about the envelope (items may be `{ service }` or bare) and about where the
// image path / URL live across Render API revisions. Pure + unit-tested.
export function parseServices(json: unknown): RenderService[] {
  if (!Array.isArray(json)) return [];
  const out: RenderService[] = [];
  for (const raw of json) {
    const svc = (raw && typeof raw === 'object' && 'service' in raw ? (raw as { service: unknown }).service : raw) as
      | Record<string, unknown>
      | undefined;
    if (!svc || typeof svc !== 'object') continue;
    const type = mapRenderType(String(svc.type ?? ''));
    if (!type) continue;
    const details = (svc.serviceDetails ?? {}) as Record<string, unknown>;
    const image = (svc.imagePath ??
      (svc.image as Record<string, unknown> | undefined)?.imagePath ??
      (details.image as Record<string, unknown> | undefined)?.imagePath) as string | undefined;
    const url = (details.url ?? details.externalUrl ?? svc.url) as string | undefined;
    out.push({
      id: String(svc.id),
      name: String(svc.name),
      type,
      imagePath: image,
      url,
    });
  }
  return out;
}

export class RenderApi implements RenderClient {
  constructor(private apiKey: string) {}

  private async req(path: string, init?: RequestInit): Promise<unknown> {
    let resp: Response;
    try {
      resp = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    } catch (err) {
      // network reset / DNS / offline -> retryable
      throw new RetryableError((err as Error).message);
    }
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw classifyHttp(resp.status, body) ?? new ToolError(body);
    }
    return resp.json().catch(() => ({}));
  }

  // Follow Render's cursor pagination, accumulating every page.
  private async listAll(path: string): Promise<unknown[]> {
    const sep = path.includes('?') ? '&' : '?';
    const all: unknown[] = [];
    let cursor = '';
    for (;;) {
      const page = (await this.req(`${path}${sep}limit=100${cursor ? `&cursor=${cursor}` : ''}`)) as Array<{
        cursor?: string;
      }>;
      if (!Array.isArray(page) || page.length === 0) break;
      all.push(...page);
      const last = page[page.length - 1];
      if (!last?.cursor || page.length < 100) break;
      cursor = last.cursor;
    }
    return all;
  }

  async listServices(): Promise<RenderService[]> {
    // includePreviews=false so a preview environment's same-named service can't be
    // matched and bound into a production secret.
    return parseServices(await this.listAll('/services?includePreviews=false'));
  }

  async listEnvGroups(): Promise<EnvGroup[]> {
    const items = (await this.listAll('/env-groups')) as Array<{ envGroup?: Record<string, unknown> }>;
    return items.map((raw) => {
      const g = (raw.envGroup ?? raw) as Record<string, unknown>;
      const envVars = (g.envVars ?? []) as Array<{ key?: string }>;
      return {
        id: String(g.id),
        name: String(g.name),
        varKeys: envVars.map((v) => String(v.key)).filter(Boolean),
      };
    });
  }

  async createEnvGroup(name: string, vars: Record<string, string>): Promise<EnvGroup> {
    const body = JSON.stringify({
      name,
      envVars: Object.entries(vars).map(([key, value]) => ({ key, value })),
    });
    const g = (await this.req('/env-groups', { method: 'POST', body })) as Record<string, unknown>;
    return { id: String(g.id), name, varKeys: Object.keys(vars) };
  }

  async addEnvGroupVars(groupId: string, vars: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(vars)) {
      await this.req(`/env-groups/${groupId}/env-vars/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    }
  }
}
