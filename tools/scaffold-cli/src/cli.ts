import { findRepoRoot, ConfigError } from './config.js';
import { enableStaging, enableJobs, enableDomain } from './commands.js';
import type { Env } from './cloud/types.js';

const USAGE =
  'Usage: scaffold-cli <enable-staging|enable-jobs|enable-domain>\n' +
  '  enable-domain <domain> [--env production|staging]';

// Split argv into positionals and a validated `--env` (default production).
function parseArgs(args: string[]): { positionals: string[]; env: Env } {
  const positionals: string[] = [];
  let env: Env = 'production';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env') {
      const value = args[++i];
      if (value !== 'production' && value !== 'staging') {
        throw new ConfigError(
          `--env must be "production" or "staging", got: ${value ?? '(missing)'}`,
        );
      }
      env = value;
    } else {
      positionals.push(args[i]);
    }
  }
  return { positionals, env };
}

function run(cmd: string | undefined, args: string[], rootDir: string): number {
  switch (cmd) {
    case 'enable-staging':
      return enableStaging(rootDir);
    case 'enable-jobs':
      return enableJobs(rootDir);
    case 'enable-domain': {
      const { positionals, env } = parseArgs(args);
      const domain = positionals[0];
      if (!domain) {
        console.error('enable-domain requires a <domain> argument.\n' + USAGE);
        return 2;
      }
      return enableDomain(rootDir, { env, domain });
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

// Surface ConfigError / usage as exit 2, YAML parse + other command failures as
// exit 1. Command return values (0 ok, 1/3 conflict) pass straight through.
try {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);
  const rootDir = findRepoRoot(process.cwd());
  process.exit(run(cmd, args, rootDir));
} catch (err) {
  console.error((err as Error).message);
  process.exit(err instanceof ConfigError ? 2 : 1);
}
