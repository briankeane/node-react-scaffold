import { findRepoRoot } from './config.js';
import { enableStaging, enableJobs } from './commands.js';

const cmd = process.argv[2];
const table: Record<string, (r: string) => number> = {
  'enable-staging': enableStaging,
  'enable-jobs': enableJobs,
};
const fn = table[cmd];
if (!fn) {
  console.error('Usage: scaffold-cli <enable-staging|enable-jobs>');
  process.exit(2);
}

// Surface ConfigError, YAML parse errors, and any other command failure as a
// clean one-line message rather than a raw stack trace.
try {
  const rootDir = findRepoRoot(process.cwd());
  process.exit(fn(rootDir));
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
