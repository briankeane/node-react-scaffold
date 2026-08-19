import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planStagingWorkflow, WorkflowConflictError } from '../src/workflowPlanner.js';
import { DEPLOY_STAGING_WORKFLOW } from '../src/templates.js';

const golden = readFileSync(join(__dirname, 'fixtures/deploy-staging.yml'), 'utf8');

describe('planStagingWorkflow', () => {
  it('template equals the committed PR1 job graph exactly', () => {
    expect(DEPLOY_STAGING_WORKFLOW).toBe(golden);
  });

  it('creates the file when absent', () => {
    const p = planStagingWorkflow(false, null, true);
    expect(p.action).toBe('create');
    if (p.action === 'create') expect(p.content).toBe(golden);
  });

  it('is a no-op when present and identical', () => {
    expect(planStagingWorkflow(true, golden, true).action).toBe('none');
  });

  it('throws a conflict when present but hand-edited', () => {
    expect(() =>
      planStagingWorkflow(true, golden.replace('Deploy Staging', 'Hacked'), true),
    ).toThrow(WorkflowConflictError);
  });

  it('is a no-op when staging is not desired, even if the file is absent', () => {
    expect(planStagingWorkflow(false, null, false).action).toBe('none');
  });

  it('is a no-op when staging is not desired, even if the file exists and differs', () => {
    expect(planStagingWorkflow(true, golden.replace('Deploy Staging', 'Hacked'), false).action).toBe(
      'none',
    );
  });
});
