// Foundational shared types for the cloud engine. Step / CloudContext / IO are
// added in the setup-cloud tasks; Env / Mode are shared by enable-domain too.

export type Env = 'production' | 'staging';

// setup cloud runs in one of three modes:
// - plan: dry-run, print the action plan, mutate nothing
// - interactive: confirm each gated step (default)
// - yes: skip prompts (skills path, after the user already approved the plan)
export type Mode = 'plan' | 'interactive' | 'yes';
