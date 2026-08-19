import { DEPLOY_STAGING_WORKFLOW } from './templates.js';
import { unifiedDiff } from './yamlUtil.js';

export type WorkflowPlan = { action: 'create'; content: string } | { action: 'none' };

export class WorkflowConflictError extends Error {
  constructor(public diff: string) {
    super('deploy-staging.yml was hand-edited; refusing to clobber');
  }
}

// Whole-file planner for deploy-staging.yml: this workflow is not a YAML fragment
// merged into a larger document (unlike render.yaml / docker-compose.yaml), it is
// either scaffold-owned verbatim or it isn't. Byte-identity decides create vs.
// no-op vs. conflict — no structural comparison needed.
export function planStagingWorkflow(
  exists: boolean,
  currentContent: string | null,
  desiredStaging: boolean,
): WorkflowPlan {
  if (!desiredStaging) return { action: 'none' };
  if (!exists) return { action: 'create', content: DEPLOY_STAGING_WORKFLOW };
  if (currentContent === DEPLOY_STAGING_WORKFLOW) return { action: 'none' };
  throw new WorkflowConflictError(
    unifiedDiff(DEPLOY_STAGING_WORKFLOW, currentContent ?? '', 'deploy-staging.yml'),
  );
}
