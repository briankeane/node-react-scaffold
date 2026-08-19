// Typed errors: real clients translate low-level failures (HTTP status, CLI exit)
// into these so the orchestrator can decide retry vs conflict vs abort without
// parsing raw output. See classifyHttp in render.ts.
export class AuthError extends Error {} // 401/403, not logged in
export class NotFoundError extends Error {} // 404
export class ConflictError extends Error {} // 409, name collision, ambiguous state
export class RetryableError extends Error {} // 429/5xx/network reset
export class ToolError extends Error {} // malformed CLI/API output

export type RenderServiceType = 'web' | 'worker' | 'keyvalue' | 'pserv' | 'cron';

export interface RenderService {
  id: string;
  name: string;
  type: RenderServiceType;
  imagePath?: string; // e.g. ghcr.io/org/repo:production
  url?: string; // onrender.com URL for web services
}

export interface EnvGroup {
  id: string;
  name: string;
  varKeys: string[];
}

export interface RenderClient {
  listServices(): Promise<RenderService[]>;
  listEnvGroups(): Promise<EnvGroup[]>;
  createEnvGroup(name: string, vars: Record<string, string>): Promise<EnvGroup>;
  addEnvGroupVars(groupId: string, vars: Record<string, string>): Promise<void>;
}

export interface GitHubClient {
  authStatus(): Promise<boolean>;
  currentRepo(): Promise<{ owner: string; name: string }>;
  packageVisibility(pkg: string): Promise<'public' | 'private' | 'unknown'>;
  setPackagePublic(pkg: string): Promise<void>;
  imageExists(image: string, tag: string): Promise<boolean>;
  listSecrets(): Promise<string[]>;
  setSecret(name: string, value: string): Promise<void>;
}

export interface NetlifySite {
  id: string;
  name: string;
  accountSlug: string;
}

export interface NetlifyClient {
  loginStatus(): Promise<boolean>;
  accountSlug(): Promise<string>;
  findSite(name: string): Promise<NetlifySite | undefined>;
  createSite(name: string, accountSlug: string): Promise<NetlifySite>;
  setSiteEnv(siteId: string, key: string, value: string): Promise<void>;
  getSiteEnv(siteId: string, key: string): Promise<string | undefined>;
}
