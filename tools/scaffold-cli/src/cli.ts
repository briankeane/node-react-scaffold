import { findRepoRoot, ConfigError } from './config.js';
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

let rootDir: string;
try {
  rootDir = findRepoRoot(process.cwd());
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
process.exit(fn(rootDir));
