import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enableStaging, enableJobs } from '../src/commands.js';

const REPO = join(__dirname, '../../..'); // repo root

function freshRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scaffold-e2e-'));
  cpSync(join(REPO, 'render.yaml'), join(dir, 'render.yaml'));
  cpSync(join(REPO, 'docker-compose.yaml'), join(dir, 'docker-compose.yaml'));
  cpSync(join(REPO, 'scaffold.config.json'), join(dir, 'scaffold.config.json'));
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  return dir;
}
const cfg = (d: string) => JSON.parse(readFileSync(join(d, 'scaffold.config.json'), 'utf8')).features;

describe('enable commands', () => {
  it('enable-staging flips the flag, adds workflow + staging blocks, is idempotent', () => {
    const d = freshRoot();
    expect(enableStaging(d)).toBe(0);
    expect(cfg(d).staging).toBe(true);
    expect(existsSync(join(d, '.github/workflows/deploy-staging.yml'))).toBe(true);
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toContain('name: staging-server');
    const snapshot = readFileSync(join(d, 'render.yaml'), 'utf8');
    expect(enableStaging(d)).toBe(0); // idempotent
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(snapshot);
  });

  it('both orders converge to identical render.yaml + compose + config', () => {
    const a = freshRoot();
    enableStaging(a);
    enableJobs(a);
    const b = freshRoot();
    enableJobs(b);
    enableStaging(b);
    expect(readFileSync(join(a, 'render.yaml'), 'utf8')).toBe(readFileSync(join(b, 'render.yaml'), 'utf8'));
    expect(readFileSync(join(a, 'docker-compose.yaml'), 'utf8')).toBe(
      readFileSync(join(b, 'docker-compose.yaml'), 'utf8'),
    );
    expect(cfg(a)).toEqual(cfg(b));
    expect(cfg(a)).toEqual({ staging: true, jobs: true, customDomain: false });
  });

  it('a conflict aborts with exit 1 and mutates nothing (flag stays, files unchanged)', () => {
    const d = freshRoot();
    enableStaging(d);
    const before = readFileSync(join(d, 'render.yaml'), 'utf8');
    // hand-mangle the owned staging-server block
    writeFileSync(join(d, 'render.yaml'), before.replace('node dist/server.js', 'node dist/HACKED.js'));
    const mangled = readFileSync(join(d, 'render.yaml'), 'utf8');
    const codeBefore = cfg(d).jobs;
    expect(enableJobs(d)).toBe(1);
    expect(readFileSync(join(d, 'render.yaml'), 'utf8')).toBe(mangled); // untouched
    expect(cfg(d).jobs).toBe(codeBefore); // flag not flipped
  });
});
