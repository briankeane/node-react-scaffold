// Foundational shared types for the cloud engine. Step / CloudContext / IO are
// added in the setup-cloud tasks; Env / Mode are shared by enable-domain too.

export type Env = 'production' | 'staging';

// setup cloud runs in one of three modes:
// - plan: dry-run, print the action plan, mutate nothing
// - interactive: confirm each gated step (default)
// - yes: skip prompts (skills path, after the user already approved the plan)
export type Mode = 'plan' | 'interactive' | 'yes';

import type {
  RenderClient,
  GitHubClient,
  NetlifyClient,
} from './clients/types.js';

// A step is 'auto' (apply without asking), 'gate' (paid/exposing — confirm first),
// or 'manual' (a human must act outside the CLI, e.g. the Blueprint dashboard click).
export type StepKind = 'auto' | 'gate' | 'manual';

// check() maps the external world to one of these. Machine-readable so the later
// skills can drive the plan->approve->yes handshake off structured output.
export type CheckState = 'satisfied' | 'needs_action' | 'conflict' | 'retryable_error';

export interface CheckResult {
  state: CheckState;
  detail: string; // human + machine readable reason
  data?: Record<string, unknown>; // e.g. discovered { 'production-server': 'srv-...' }
}

export interface Step {
  name: string;
  kind: StepKind;
  check(ctx: CloudContext): Promise<CheckResult>;
  preview(ctx: CloudContext, r: CheckResult): string; // cost/impact, printed in --plan and before a gate
  apply(ctx: CloudContext, r: CheckResult): Promise<void>;
}

// Injected I/O so the orchestrator is testable without real stdin/stdout/sleep.
export interface IO {
  print(msg: string): void;
  confirm(prompt: string): Promise<boolean>;
  // Call fn up to `attempts` times (delay between); resolve the first defined
  // value, or undefined if exhausted. Used to poll a manual step to completion.
  poll<T>(fn: () => Promise<T | undefined>, attempts: number, delayMs: number): Promise<T | undefined>;
}

export interface CloudContext {
  rootDir: string;
  mode: Mode;
  envs: Env[]; // ['production', ...('staging' if enabled)]
  jobs: boolean;
  repo: { owner: string; name: string; image: string }; // image = lowercased ghcr.io/<owner>/<repo>
  // Credential VALUES resolved at the entrypoint (from env / prompt) so steps stay
  // testable. These become GitHub secrets; RENDER_API_KEY also auths the RenderClient.
  tokens: { renderApiKey?: string; netlifyAuthToken?: string };
  render: RenderClient;
  github: GitHubClient;
  netlify: NetlifyClient;
  io: IO;
}
