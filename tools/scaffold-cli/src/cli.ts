import { enableStaging, enableJobs } from './commands.js';

const cmd = process.argv[2];
const rootDir = process.cwd(); // make runs from repo root
const table: Record<string, (r: string) => number> = {
  'enable-staging': enableStaging,
  'enable-jobs': enableJobs,
};
const fn = table[cmd];
if (!fn) {
  console.error('Usage: scaffold-cli <enable-staging|enable-jobs>');
  process.exit(2);
}
process.exit(fn(rootDir));
