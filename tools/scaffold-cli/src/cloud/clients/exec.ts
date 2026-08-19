import { execFile } from 'node:child_process';
import { AuthError, NotFoundError, ConflictError, RetryableError, ToolError } from './types.js';

// Map a CLI failure (exit code + stderr) to a typed error so steps can branch on
// it. Pure and unit-tested; the real exec wrapper delegates here.
export function classifyCliError(stderr: string, code: number | null): Error {
  const s = stderr.toLowerCase();
  if (/\b(401|403|unauthorized|not logged in|authentication|requires authentication)\b/.test(s)) {
    return new AuthError(stderr.trim() || 'authentication failed');
  }
  if (/\b(404|not found|could not resolve)\b/.test(s)) {
    return new NotFoundError(stderr.trim() || 'not found');
  }
  if (/\b(409|already exists|name .*taken|conflict)\b/.test(s)) {
    return new ConflictError(stderr.trim() || 'conflict');
  }
  if (/\b(429|rate limit|timeout|timed out|temporarily|econnreset|5\d\d)\b/.test(s)) {
    return new RetryableError(stderr.trim() || 'transient failure');
  }
  return new ToolError(stderr.trim() || `command failed (exit ${code ?? 'null'})`);
}

// Run a command, capturing stdout. Value passed on stdin (not argv) so secrets
// never appear in the process list. Throws a typed error on non-zero exit.
export function execCapture(
  cmd: string,
  args: string[],
  opts: { input?: string } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const code = (err as NodeJS.ErrnoException & { code?: number }).code ?? null;
        reject(classifyCliError(stderr || (err as Error).message, typeof code === 'number' ? code : null));
        return;
      }
      resolve(stdout);
    });
    if (opts.input !== undefined) {
      child.stdin?.end(opts.input);
    }
  });
}
