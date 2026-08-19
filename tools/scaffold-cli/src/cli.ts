import { findRepoRoot, ConfigError } from './config.js';
import { enableStaging, enableJobs, enableDomain } from './commands.js';
import { setupCloud } from './setupCloud.js';
import { setupLocal, realRunner } from './setupLocal.js';
import type { Env, Mode } from './cloud/types.js';

const USAGE =
  'Usage: scaffold-cli <command>\n' +
  '  enable-staging\n' +
  '  enable-jobs\n' +
  '  enable-domain <domain> [--env production|staging]\n' +
  '  setup local\n' +
  '  setup cloud [--plan | --yes]';

// Validate a `--env` value (default production).
function requireEnv(value: string | undefined): Env {
  if (value === undefined) return 'production';
  if (value !== 'production' && value !== 'staging') {
    throw new ConfigError(`--env must be "production" or "staging", got: ${value}`);
  }
  return value;
}

// --plan and --yes are mutually exclusive; default is interactive.
function parseMode(args: string[]): Mode {
  const plan = args.includes('--plan');
  const yes = args.includes('--yes');
  if (plan && yes) throw new ConfigError('--plan and --yes are mutually exclusive');
  return plan ? 'plan' : yes ? 'yes' : 'interactive';
}

async function run(cmd: string | undefined, args: string[], rootDir: string): Promise<number> {
  switch (cmd) {
    case 'enable-staging':
      return enableStaging(rootDir);
    case 'enable-jobs':
      return enableJobs(rootDir);
    case 'enable-domain': {
      const envIdx = args.indexOf('--env');
      const env = requireEnv(envIdx === -1 ? undefined : args[envIdx + 1]);
      const domain = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--env');
      if (!domain) {
        console.error('enable-domain requires a <domain> argument.\n' + USAGE);
        return 2;
      }
      return enableDomain(rootDir, { env, domain });
    }
    case 'setup': {
      const sub = args[0];
      if (sub === 'local') return setupLocal(rootDir, { run: realRunner(rootDir) });
      if (sub === 'cloud') return setupCloud(rootDir, { mode: parseMode(args.slice(1)) });
      console.error('Usage: scaffold-cli setup <local | cloud> [--plan | --yes]');
      return 2;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

// ConfigError / usage -> exit 2; other failures -> exit 1. Command return values
// (0 ok, 1/3/4 per the exit-code contract) pass straight through.
(async () => run(process.argv[2], process.argv.slice(3), findRepoRoot(process.cwd())))()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error((err as Error).message);
    process.exit(err instanceof ConfigError ? 2 : 1);
  });
