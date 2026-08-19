import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ScaffoldConfig {
  features: { staging: boolean; jobs: boolean; customDomain: boolean };
}

export interface Desired {
  staging: boolean;
  jobs: boolean;
}

export class ConfigError extends Error {}

export interface Conflict {
  block: string;
  diff: string;
}

export type Plan =
  | { ok: true; output: string; changed: boolean }
  | { ok: false; conflicts: Conflict[] };

const FLAGS = ['staging', 'jobs', 'customDomain'] as const;

export function configPath(rootDir: string): string {
  return join(rootDir, 'scaffold.config.json');
}

// Walk up from startDir to the nearest ancestor containing scaffold.config.json
// (the single source of truth). Lets the CLI be invoked from any working
// directory — e.g. the Makefile's `cd tools/scaffold-cli && npm run ...`.
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(configPath(dir))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new ConfigError(`scaffold.config.json not found in ${startDir} or any parent`);
    }
    dir = parent;
  }
}

export function loadConfig(rootDir: string): ScaffoldConfig {
  const path = configPath(rootDir);
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new ConfigError(`scaffold.config.json not found at ${path}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`scaffold.config.json is not valid JSON: ${(err as Error).message}`);
  }

  const features = (parsed as { features?: unknown }).features;
  if (features == null || typeof features !== 'object') {
    throw new ConfigError('scaffold.config.json must have a "features" object');
  }

  for (const flag of FLAGS) {
    const value = (features as Record<string, unknown>)[flag];
    if (typeof value !== 'boolean') {
      throw new ConfigError(`scaffold.config.json: features.${flag} must be a boolean`);
    }
  }

  return { features: { ...(features as ScaffoldConfig['features']) } };
}
