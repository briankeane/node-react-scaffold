import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, ConfigError } from '../src/config.js';

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
