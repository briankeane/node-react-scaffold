import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
