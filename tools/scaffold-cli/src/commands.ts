import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, type Conflict } from './config.js';
import { planRender } from './renderPlanner.js';
import { planCompose } from './composePlanner.js';
import { planDomain } from './domainPlanner.js';
import { planStagingWorkflow, WorkflowConflictError } from './workflowPlanner.js';
import { commitWrites, type FileWrite } from './apply.js';
import type { Env } from './cloud/types.js';

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
  for (const w of render.warnings ?? []) console.error(w);
  console.log('Background jobs enabled.');
  return 0;
}

// enable-domain manages a single scaffold-owned custom domain on the target env's
// server service in render.yaml, and flips the customDomain feature flag. The
// domain VALUE lives in render.yaml (Render's IaC source of truth); the flag is a
// boolean like staging/jobs. Sole writer of customDomain. Exit codes: 0 ok,
// 3 conflict (hand-managed domains / missing env server).
export function enableDomain(rootDir: string, opts: { env: Env; domain: string }): number {
  const config = loadConfig(rootDir);
  const render = planDomain(readFileSync(join(rootDir, RENDER), 'utf8'), opts);
  if (!render.ok) {
    printConflicts('enable-domain', render.conflicts);
    return 3;
  }

  const writes: FileWrite[] = [];
  if (render.changed) writes.push({ path: join(rootDir, RENDER), content: render.output });
  commitWrites(rootDir, writes, { features: { ...config.features, customDomain: true } });

  for (const w of render.warnings ?? []) console.error(w);
  console.log(`Custom domain enabled for ${opts.env}: ${opts.domain}`);
  console.log(
    `DNS: add a CNAME record for your subdomain -> <your-${opts.env}-server>.onrender.com`,
  );
  console.log('(Cloudflare users: set the record to DNS only / grey cloud, not proxied.)');
  return 0;
}
