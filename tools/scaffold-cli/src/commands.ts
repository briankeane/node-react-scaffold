import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, type Conflict } from './config.js';
import { planRender } from './renderPlanner.js';
import { planCompose } from './composePlanner.js';
import { planStagingWorkflow, WorkflowConflictError } from './workflowPlanner.js';
import { commitWrites, type FileWrite } from './apply.js';

const RENDER = 'render.yaml';
const COMPOSE = 'docker-compose.yaml';
const WORKFLOW = '.github/workflows/deploy-staging.yml';

function printConflicts(label: string, conflicts: Conflict[]): void {
  console.error(`\n${label} would clobber hand-edited scaffold-owned block(s). Aborting; nothing was changed.\n`);
  for (const c of conflicts) console.error(`  [${c.block}]\n${c.diff}\n`);
}

export function enableStaging(rootDir: string): number {
  const config = loadConfig(rootDir);
  const desired = { staging: true, jobs: config.features.jobs };
  const writes: FileWrite[] = [];

  const render = planRender(readFileSync(join(rootDir, RENDER), 'utf8'), desired);
  if (!render.ok) {
    printConflicts('enable-staging', render.conflicts);
    return 1;
  }
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });

  const wfPath = join(rootDir, WORKFLOW);
  try {
    const exists = existsSync(wfPath);
    const wf = planStagingWorkflow(exists, exists ? readFileSync(wfPath, 'utf8') : null, true);
    if (wf.action === 'create') writes.push({ path: wfPath, content: wf.content });
  } catch (err) {
    if (err instanceof WorkflowConflictError) {
      printConflicts('enable-staging', [{ block: WORKFLOW, diff: err.diff }]);
      return 1;
    }
    throw err;
  }

  commitWrites(rootDir, writes, { features: { ...config.features, staging: true } });
  console.log('Staging enabled.');
  return 0;
}

export function enableJobs(rootDir: string): number {
  const config = loadConfig(rootDir);
  const desired = { staging: config.features.staging, jobs: true };
  const writes: FileWrite[] = [];

  const render = planRender(readFileSync(join(rootDir, RENDER), 'utf8'), desired);
  if (!render.ok) {
    printConflicts('enable-jobs', render.conflicts);
    return 1;
  }
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });

  const compose = planCompose(readFileSync(join(rootDir, COMPOSE), 'utf8'), desired);
  if (!compose.ok) {
    printConflicts('enable-jobs', compose.conflicts);
    return 1;
  }
  if (compose.changed) writes.push({ path: join(rootDir, COMPOSE), content: compose.output });

  commitWrites(rootDir, writes, { features: { ...config.features, jobs: true } });
  console.log('Background jobs enabled.');
  return 0;
}
