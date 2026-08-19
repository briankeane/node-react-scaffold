import type { Step, CloudContext } from './types.js';
import { AuthError, ConflictError, RetryableError } from './clients/types.js';

const MAX_ATTEMPTS = 3;
// Manual (Blueprint) poll budget for interactive mode. FakeIO ignores the delay.
const MANUAL_POLL_ATTEMPTS = 120;
const MANUAL_POLL_DELAY_MS = 5000;

// Map a thrown client error to an exit code, or 'retry' to try the step again.
function classify(err: unknown): number | 'retry' {
  if (err instanceof RetryableError) return 'retry';
  if (err instanceof AuthError) return 2;
  if (err instanceof ConflictError) return 3;
  return 1;
}

const CONTINUE = Symbol('continue');
type StepOutcome = typeof CONTINUE | number;

async function runOne(ctx: CloudContext, step: Step): Promise<StepOutcome> {
  const { io } = ctx;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // --- check() ---
    let result;
    try {
      result = await step.check(ctx);
    } catch (err) {
      const code = classify(err);
      if (code === 'retry') {
        if (attempt < MAX_ATTEMPTS) continue;
        io.print(`[${step.name}] transient failure, retries exhausted: ${(err as Error).message}`);
        return 1;
      }
      io.print(`[${step.name}] ${(err as Error).message}`);
      return code;
    }

    if (result.state === 'conflict') {
      io.print(`conflict [${step.name}]: ${result.detail}`);
      return 3;
    }
    if (result.state === 'retryable_error') {
      if (attempt < MAX_ATTEMPTS) continue;
      io.print(`[${step.name}] transient failure, retries exhausted: ${result.detail}`);
      return 1;
    }
    if (result.state === 'satisfied') {
      io.print(`skip (already done): ${step.name}`);
      return CONTINUE;
    }

    // --- needs_action ---
    io.print(step.preview(ctx, result));
    if (ctx.mode === 'plan') return CONTINUE; // record only, mutate nothing

    if (step.kind === 'manual') {
      if (ctx.mode === 'yes') {
        io.print(`manual action required: ${step.name} (re-run once done)`);
        return 4;
      }
      // Poll check() to completion. A transient error (e.g. Render 503 mid-wait)
      // keeps polling; a conflict (wrong-type service appears) surfaces as exit 3.
      let conflict: ConflictError | undefined;
      const done = await io.poll(
        async () => {
          try {
            const again = await step.check(ctx);
            return again.state === 'satisfied' ? again : undefined;
          } catch (err) {
            if (err instanceof RetryableError) return undefined; // keep polling
            if (err instanceof ConflictError) {
              conflict = err;
              return { state: 'conflict', detail: err.message }; // stop polling; handled below
            }
            throw err; // unexpected -> operational failure
          }
        },
        MANUAL_POLL_ATTEMPTS,
        MANUAL_POLL_DELAY_MS,
      );
      if (conflict) {
        io.print(`conflict [${step.name}]: ${conflict.message}`);
        return 3;
      }
      if (!done) {
        io.print(`manual action still pending: ${step.name} (re-run once done)`);
        return 4;
      }
      return CONTINUE;
    }

    if (step.kind === 'gate' && ctx.mode === 'interactive') {
      const proceed = await io.confirm(`Proceed with ${step.name}?`);
      if (!proceed) {
        io.print('stopped at your request; re-run to continue');
        return 0;
      }
    }

    // --- apply() (auto, or gate approved / --yes) ---
    try {
      await step.apply(ctx, result);
      return CONTINUE;
    } catch (err) {
      const code = classify(err);
      if (code === 'retry') {
        if (attempt < MAX_ATTEMPTS) continue; // re-check then re-apply
        io.print(`[${step.name}] transient write failure, retries exhausted: ${(err as Error).message}`);
        return 1;
      }
      io.print(`[${step.name}] ${(err as Error).message}`);
      return code;
    }
  }
  return 1; // attempts exhausted
}

// Run the ordered steps, returning a process exit code per the contract:
// 0 ok / plan / user-declined; 1 op failure; 2 usage/auth; 3 conflict; 4 manual pending.
export async function runSteps(ctx: CloudContext, steps: Step[]): Promise<number> {
  for (const step of steps) {
    const outcome = await runOne(ctx, step);
    if (outcome !== CONTINUE) return outcome;
  }
  return 0;
}
