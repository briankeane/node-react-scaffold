import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, findRepoRoot, ConfigError } from '../src/config.js';

function tmpRoot(json: string | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'scaffold-cfg-'));
  if (json !== null) writeFileSync(join(dir, 'scaffold.config.json'), json);
  return dir;
}

describe('loadConfig', () => {
  it('loads a valid all-false config', () => {
    const dir = tmpRoot('{"features":{"staging":false,"jobs":false,"customDomain":false}}');
    expect(loadConfig(dir).features).toEqual({ staging: false, jobs: false, customDomain: false });
  });

  it('throws ConfigError when the file is missing', () => {
    const dir = tmpRoot(null);
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it('throws ConfigError on invalid JSON', () => {
    const dir = tmpRoot('{ not json');
    expect(() => loadConfig(dir)).toThrow(ConfigError);
  });

  it('throws ConfigError when a feature flag is missing', () => {
    const dir = tmpRoot('{"features":{"staging":true}}');
    expect(() => loadConfig(dir)).toThrow(/jobs/);
  });

  it('throws ConfigError when a feature flag is not a boolean', () => {
    const dir = tmpRoot('{"features":{"staging":"yes","jobs":false,"customDomain":false}}');
    expect(() => loadConfig(dir)).toThrow(/staging/);
  });
});

describe('findRepoRoot', () => {
  it('resolves the root from a nested subdir (the `cd tools/scaffold-cli` case)', () => {
    const root = tmpRoot('{"features":{"staging":false,"jobs":false,"customDomain":false}}');
    const nested = join(root, 'tools', 'scaffold-cli');
    mkdirSync(nested, { recursive: true });
    expect(findRepoRoot(nested)).toBe(root);
  });

  it('resolves the root when startDir is itself the root', () => {
    const root = tmpRoot('{"features":{"staging":false,"jobs":false,"customDomain":false}}');
    expect(findRepoRoot(root)).toBe(root);
  });

  it('throws ConfigError when no ancestor has scaffold.config.json', () => {
    const dir = tmpRoot(null);
    expect(() => findRepoRoot(dir)).toThrow(ConfigError);
    expect(() => findRepoRoot(dir)).toThrow(/not found/);
  });
});
