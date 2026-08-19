import { writeFileSync } from 'node:fs';
import { configPath, type ScaffoldConfig } from './config.js';

export interface FileWrite {
  path: string;
  content: string;
}

// Transactional writer: write every infra file first, then write
// scaffold.config.json LAST. A crash mid-write can leave a partially patched
// tree, but never a flipped flag with un-patched infra files.
export function commitWrites(rootDir: string, writes: FileWrite[], nextConfig: ScaffoldConfig): void {
  for (const w of writes) writeFileSync(w.path, w.content);
  writeFileSync(configPath(rootDir), JSON.stringify(nextConfig, null, 2) + '\n');
}
