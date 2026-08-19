import { execFileSync } from 'node:child_process';

// A command runner returns the process exit code (0 = success). Injected so tests
// don't shell out to docker/make.
export type Runner = (command: string[]) => number;

// Real runner: run `command` at rootDir inheriting stdio; return its exit code
// (127 if the binary is missing).
export function realRunner(rootDir: string): Runner {
  return (command: string[]): number => {
    try {
      execFileSync(command[0], command.slice(1), { cwd: rootDir, stdio: 'inherit' });
      return 0;
    } catch (err) {
      const status = (err as { status?: number }).status;
      return typeof status === 'number' ? status : 127;
    }
  };
}

// Thin local bootstrap: verify Docker is running, then drive the existing Make
// targets (env-file copy + set-ports + build via `make install`, then start the
// stack in the background via `make launch-detached`). Most logic already lives
// in bash/Make; this adds a friendly preflight + clear next steps.
export function setupLocal(_rootDir: string, deps: { run: Runner; print?: (m: string) => void }): number {
  const print = deps.print ?? ((m: string): void => console.log(m));

  if (deps.run(['docker', 'info']) !== 0) {
    print("Docker isn't running. Start Docker Desktop (or your Docker daemon) and re-run `make setup-local`.");
    return 2;
  }

  print('Docker is running. Bootstrapping the local stack (env files, ports, build)...');
  if (deps.run(['make', 'install']) !== 0) {
    print('`make install` failed. Fix the error above and re-run `make setup-local`.');
    return 1;
  }

  print('Starting services in the background...');
  if (deps.run(['make', 'launch-detached']) !== 0) {
    print('`make launch-detached` failed. Fix the error above and re-run `make setup-local`.');
    return 1;
  }

  print('Local stack is up. Tail logs with `make logs`; stop it with `make terminate`.');
  return 0;
}
