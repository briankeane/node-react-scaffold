import type {
  RenderClient,
  GitHubClient,
  NetlifyClient,
  RenderService,
  EnvGroup,
  NetlifySite,
} from './types.js';

// Deterministic in-memory client fakes for tests. Each fake is seeded with
// initial state, records the mutating calls it received, and can be told to fail
// the next call to a given method with a specific (typed) error via failNext() —
// enough to exercise resume, gate, and retry paths with zero live calls.
class Failable {
  private queued = new Map<string, Error[]>();
  calls: string[] = [];

  failNext(method: string, err: Error): void {
    const q = this.queued.get(method) ?? [];
    q.push(err);
    this.queued.set(method, q);
  }

  protected enter(method: string): void {
    this.calls.push(method);
    const q = this.queued.get(method);
    if (q && q.length > 0) throw q.shift() as Error;
  }
}

export interface FakeRenderState {
  services?: RenderService[];
  envGroups?: EnvGroup[];
}

export class FakeRender extends Failable implements RenderClient {
  services: RenderService[];
  envGroups: EnvGroup[];
  private idSeq = 0;

  constructor(state: FakeRenderState = {}) {
    super();
    this.services = [...(state.services ?? [])];
    this.envGroups = (state.envGroups ?? []).map((g) => ({ ...g, varKeys: [...g.varKeys] }));
  }

  async listServices(): Promise<RenderService[]> {
    this.enter('listServices');
    return this.services.map((s) => ({ ...s }));
  }

  async listEnvGroups(): Promise<EnvGroup[]> {
    this.enter('listEnvGroups');
    return this.envGroups.map((g) => ({ ...g, varKeys: [...g.varKeys] }));
  }

  async createEnvGroup(name: string, vars: Record<string, string>): Promise<EnvGroup> {
    this.enter('createEnvGroup');
    const group: EnvGroup = { id: `evg-${this.idSeq++}`, name, varKeys: Object.keys(vars) };
    this.envGroups.push(group);
    return { ...group, varKeys: [...group.varKeys] };
  }

  async addEnvGroupVars(groupId: string, vars: Record<string, string>): Promise<void> {
    this.enter('addEnvGroupVars');
    const group = this.envGroups.find((g) => g.id === groupId);
    if (!group) throw new Error(`no env group ${groupId}`);
    for (const k of Object.keys(vars)) if (!group.varKeys.includes(k)) group.varKeys.push(k);
  }
}

export interface FakeGitHubState {
  repo?: { owner: string; name: string };
  secrets?: string[];
  visibility?: 'public' | 'private' | 'unknown';
  images?: string[]; // "image:tag" strings that exist
  authed?: boolean;
}

export class FakeGitHub extends Failable implements GitHubClient {
  repo: { owner: string; name: string };
  secrets: string[];
  visibility: 'public' | 'private' | 'unknown';
  images: Set<string>;
  authed: boolean;

  constructor(state: FakeGitHubState = {}) {
    super();
    this.repo = state.repo ?? { owner: 'acme', name: 'app' };
    this.secrets = [...(state.secrets ?? [])];
    this.visibility = state.visibility ?? 'private';
    this.images = new Set(state.images ?? []);
    this.authed = state.authed ?? true;
  }

  async authStatus(): Promise<boolean> {
    this.enter('authStatus');
    return this.authed;
  }
  async currentRepo(): Promise<{ owner: string; name: string }> {
    this.enter('currentRepo');
    return { ...this.repo };
  }
  async packageVisibility(): Promise<'public' | 'private' | 'unknown'> {
    this.enter('packageVisibility');
    return this.visibility;
  }
  async setPackagePublic(): Promise<void> {
    this.enter('setPackagePublic');
    this.visibility = 'public';
  }
  async imageExists(image: string, tag: string): Promise<boolean> {
    this.enter('imageExists');
    return this.images.has(`${image}:${tag}`);
  }
  async listSecrets(): Promise<string[]> {
    this.enter('listSecrets');
    return [...this.secrets];
  }
  async setSecret(name: string, _value: string): Promise<void> {
    this.enter('setSecret');
    if (!this.secrets.includes(name)) this.secrets.push(name);
  }
}

export interface FakeNetlifyState {
  loggedIn?: boolean;
  accountSlug?: string;
  sites?: NetlifySite[];
}

export class FakeNetlify extends Failable implements NetlifyClient {
  loggedIn: boolean;
  slug: string;
  sites: NetlifySite[];
  siteEnv = new Map<string, Record<string, string>>();
  private idSeq = 0;

  constructor(state: FakeNetlifyState = {}) {
    super();
    this.loggedIn = state.loggedIn ?? true;
    this.slug = state.accountSlug ?? 'acme-team';
    this.sites = [...(state.sites ?? [])];
  }

  async loginStatus(): Promise<boolean> {
    this.enter('loginStatus');
    return this.loggedIn;
  }
  async accountSlug(): Promise<string> {
    this.enter('accountSlug');
    return this.slug;
  }
  async findSite(name: string): Promise<NetlifySite | undefined> {
    this.enter('findSite');
    const s = this.sites.find((x) => x.name === name);
    return s ? { ...s } : undefined;
  }
  async createSite(name: string, accountSlug: string): Promise<NetlifySite> {
    this.enter('createSite');
    const site: NetlifySite = { id: `site-${this.idSeq++}`, name, accountSlug };
    this.sites.push(site);
    return { ...site };
  }
  async setSiteEnv(siteId: string, key: string, value: string): Promise<void> {
    this.enter('setSiteEnv');
    const cur = this.siteEnv.get(siteId) ?? {};
    cur[key] = value;
    this.siteEnv.set(siteId, cur);
  }
  async getSiteEnv(siteId: string, key: string): Promise<string | undefined> {
    this.enter('getSiteEnv');
    return this.siteEnv.get(siteId)?.[key];
  }
}
