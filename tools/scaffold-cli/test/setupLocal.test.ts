import { describe, it, expect } from 'vitest';
import { setupLocal, type Runner } from '../src/setupLocal.js';

function recorder(codes: Record<string, number> = {}): { run: Runner; calls: string[][]; lines: string[] } {
  const calls: string[][] = [];
  const lines: string[] = [];
  const run: Runner = (command) => {
    calls.push(command);
    return codes[command.join(' ')] ?? 0;
  };
  return { run, calls, lines };
}

describe('setupLocal', () => {
  it('exits 2 and runs no make targets when Docker is down', () => {
    const r = recorder({ 'docker info': 1 });
    const code = setupLocal('/repo', { run: r.run, print: (m) => r.lines.push(m) });
    expect(code).toBe(2);
    expect(r.calls).toEqual([['docker', 'info']]); // stopped before make
    expect(r.lines.join('\n')).toMatch(/Docker isn't running/);
  });

  it('runs docker info -> make install -> make launch-detached in order, exit 0', () => {
    const r = recorder();
    const code = setupLocal('/repo', { run: r.run, print: (m) => r.lines.push(m) });
    expect(code).toBe(0);
    expect(r.calls).toEqual([['docker', 'info'], ['make', 'install'], ['make', 'launch-detached']]);
    expect(r.lines.join('\n')).toMatch(/Local stack is up/);
  });

  it('exits 1 if make install fails, without launching', () => {
    const r = recorder({ 'make install': 2 });
    const code = setupLocal('/repo', { run: r.run, print: (m) => r.lines.push(m) });
    expect(code).toBe(1);
    expect(r.calls).toEqual([['docker', 'info'], ['make', 'install']]);
  });

  it('exits 1 if launch-detached fails', () => {
    const r = recorder({ 'make launch-detached': 1 });
    const code = setupLocal('/repo', { run: r.run, print: (m) => r.lines.push(m) });
    expect(code).toBe(1);
    expect(r.calls[r.calls.length - 1]).toEqual(['make', 'launch-detached']);
  });
});
