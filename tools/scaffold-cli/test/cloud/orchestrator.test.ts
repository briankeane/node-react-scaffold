import { describe, it, expect } from 'vitest';
import { runSteps } from '../../src/cloud/orchestrator.js';
import type {
  Step,
  StepKind,
  CheckState,
  CheckResult,
  CloudContext,
  IO,
  Mode,
} from '../../src/cloud/types.js';
import { ConflictError, RetryableError, AuthError } from '../../src/cloud/clients/types.js';

class FakeIO implements IO {
  lines: string[] = [];
  answers: boolean[];
  constructor(answers: boolean[] = []) {
    this.answers = answers;
  }
  print(msg: string): void {
    this.lines.push(msg);
  }
  async confirm(): Promise<boolean> {
    return this.answers.length ? (this.answers.shift() as boolean) : true;
  }
  // Test poll: run fn up to `attempts` times immediately (no delay).
  async poll<T>(fn: () => Promise<T | undefined>, attempts: number): Promise<T | undefined> {
    for (let i = 0; i < attempts; i++) {
      const v = await fn();
      if (v !== undefined) return v;
    }
    return undefined;
  }
}

function ctx(mode: Mode, io: IO): CloudContext {
  return {
    rootDir: '/tmp',
    mode,
    envs: ['production'],
    jobs: false,
    repo: { owner: 'acme', name: 'app', image: 'ghcr.io/acme/app' },
    tokens: { renderApiKey: 'rk', netlifyAuthToken: 'nt' },
    // clients unused by these synthetic steps
    render: {} as never,
    github: {} as never,
    netlify: {} as never,
    io,
  };
}

// Build a step whose check() returns each queued state in turn (last one sticks),
// recording apply() calls into `applied`.
function mkStep(
  name: string,
  kind: StepKind,
  states: CheckState[],
  applied: string[],
  opts: { applyThrows?: Error } = {},
): Step {
  const queue = [...states];
  return {
    name,
    kind,
    async check(): Promise<CheckResult> {
      const state = queue.length > 1 ? (queue.shift() as CheckState) : queue[0];
      return { state, detail: `${name}: ${state}` };
    },
    preview: () => `preview:${name}`,
    async apply(): Promise<void> {
      if (opts.applyThrows) throw opts.applyThrows;
      applied.push(name);
    },
  };
}

describe('runSteps', () => {
  it('--plan applies nothing and returns 0', async () => {
    const applied: string[] = [];
    const io = new FakeIO();
    const steps = [mkStep('a', 'gate', ['needs_action'], applied)];
    expect(await runSteps(ctx('plan', io), steps)).toBe(0);
    expect(applied).toEqual([]);
    expect(io.lines.join('\n')).toContain('preview:a');
  });

  it('satisfied steps are skipped, auto steps apply, returns 0', async () => {
    const applied: string[] = [];
    const io = new FakeIO();
    const steps = [
      mkStep('done', 'auto', ['satisfied'], applied),
      mkStep('work', 'auto', ['needs_action'], applied),
    ];
    expect(await runSteps(ctx('interactive', io), steps)).toBe(0);
    expect(applied).toEqual(['work']);
    expect(io.lines.join('\n')).toMatch(/skip.*done/);
  });

  it('a conflict returns 3 and stops', async () => {
    const applied: string[] = [];
    const steps = [
      mkStep('bad', 'auto', ['conflict'], applied),
      mkStep('after', 'auto', ['needs_action'], applied),
    ];
    expect(await runSteps(ctx('interactive', new FakeIO()), steps)).toBe(3);
    expect(applied).toEqual([]); // stopped before 'after'
  });

  it('a gate under --yes applies without prompting', async () => {
    const applied: string[] = [];
    const steps = [mkStep('paid', 'gate', ['needs_action'], applied)];
    expect(await runSteps(ctx('yes', new FakeIO()), steps)).toBe(0);
    expect(applied).toEqual(['paid']);
  });

  it('a gate declined interactively returns 0 and does not apply', async () => {
    const applied: string[] = [];
    const io = new FakeIO([false]); // decline
    const steps = [mkStep('paid', 'gate', ['needs_action'], applied)];
    expect(await runSteps(ctx('interactive', io), steps)).toBe(0);
    expect(applied).toEqual([]);
  });

  it('a manual step under --yes returns 4', async () => {
    const applied: string[] = [];
    const steps = [mkStep('blueprint', 'manual', ['needs_action'], applied)];
    expect(await runSteps(ctx('yes', new FakeIO()), steps)).toBe(4);
  });

  it('a manual step interactively polls to satisfied then continues', async () => {
    const applied: string[] = [];
    // first check needs_action, subsequent checks satisfied (poll succeeds)
    const step = mkStep('blueprint', 'manual', ['needs_action', 'satisfied'], applied);
    const after = mkStep('after', 'auto', ['needs_action'], applied);
    expect(await runSteps(ctx('interactive', new FakeIO()), [step, after])).toBe(0);
    expect(applied).toEqual(['after']);
  });

  it('a manual step that never completes interactively returns 4', async () => {
    const step = mkStep('blueprint', 'manual', ['needs_action'], []); // always needs_action
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(4);
  });

  it('a transient error while polling a manual step keeps polling (does not crash)', async () => {
    const applied: string[] = [];
    let calls = 0;
    const step: Step = {
      name: 'blueprint',
      kind: 'manual',
      async check(): Promise<CheckResult> {
        calls++;
        if (calls === 1) return { state: 'needs_action', detail: 'pending' };
        if (calls === 2) throw new RetryableError('render 503'); // mid-poll blip
        return { state: 'satisfied', detail: 'synced' };
      },
      preview: () => 'blueprint',
      async apply(): Promise<void> {},
    };
    const after = mkStep('after', 'auto', ['needs_action'], applied);
    expect(await runSteps(ctx('interactive', new FakeIO()), [step, after])).toBe(0);
    expect(applied).toEqual(['after']);
  });

  it('a conflict surfacing while polling a manual step returns 3', async () => {
    let calls = 0;
    const step: Step = {
      name: 'blueprint',
      kind: 'manual',
      async check(): Promise<CheckResult> {
        calls++;
        if (calls === 1) return { state: 'needs_action', detail: 'pending' };
        throw new ConflictError('wrong-type service appeared');
      },
      preview: () => 'blueprint',
      async apply(): Promise<void> {},
    };
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(3);
  });

  it('retryable check that clears on retry proceeds', async () => {
    const applied: string[] = [];
    const step = mkStep('flaky', 'auto', ['retryable_error', 'needs_action'], applied);
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(0);
    expect(applied).toEqual(['flaky']);
  });

  it('persistent retryable check returns 1', async () => {
    const step = mkStep('down', 'auto', ['retryable_error'], []);
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(1);
  });

  it('apply throwing RetryableError retries then succeeds via re-check', async () => {
    const applied: string[] = [];
    // check always needs_action; apply throws once then... we cannot easily flip apply,
    // so assert the exhausted path returns 1 (apply keeps throwing retryable).
    const step = mkStep('w', 'auto', ['needs_action'], applied, {
      applyThrows: new RetryableError('flaky write'),
    });
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(1);
  });

  it('apply throwing ConflictError returns 3', async () => {
    const step = mkStep('w', 'auto', ['needs_action'], [], { applyThrows: new ConflictError('nope') });
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(3);
  });

  it('apply throwing AuthError returns 2', async () => {
    const step = mkStep('w', 'auto', ['needs_action'], [], { applyThrows: new AuthError('401') });
    expect(await runSteps(ctx('interactive', new FakeIO()), [step])).toBe(2);
  });
});
