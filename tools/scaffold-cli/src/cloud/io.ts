import { createInterface } from 'node:readline';
import type { IO } from './types.js';

// Real terminal IO: print to stdout, confirm via a stdin y/N prompt, poll with a
// real delay between attempts.
export function realIO(): IO {
  return {
    print(msg: string): void {
      console.log(msg);
    },
    async confirm(prompt: string): Promise<boolean> {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = await new Promise<string>((resolve) => rl.question(`${prompt} [y/N] `, resolve));
        return /^y(es)?$/i.test(answer.trim());
      } finally {
        rl.close();
      }
    },
    async poll<T>(fn: () => Promise<T | undefined>, attempts: number, delayMs: number): Promise<T | undefined> {
      for (let i = 0; i < attempts; i++) {
        const v = await fn();
        if (v !== undefined) return v;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return undefined;
    },
  };
}
