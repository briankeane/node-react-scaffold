import { Document, YAMLSeq, YAMLMap, isMap, isSeq } from 'yaml';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from './yamlUtil.js';
import {
  STAGING_DB,
  STAGING_SERVER,
  STAGING_WORKER,
  PRODUCTION_WORKER,
  KEYVALUE,
  REDIS_URL_ITEM,
} from './templates.js';
import type { Desired, Plan, Conflict } from './config.js';

const DB_ORDER = ['staging-db', 'production-db'];
const SERVICE_ORDER = [
  'keyvalue',
  'staging-server',
  'staging-worker',
  'production-server',
  'production-worker',
];

// Parse a one-item template fragment and return its single node. The node carries
// its attached comments (commentBefore / comment) with it.
function templateNode(fragment: string): YAMLMap {
  const seq = parseDoc(fragment).contents as YAMLSeq;
  return seq.items[0] as YAMLMap;
}

function nameOf(node: unknown): string | undefined {
  return isMap(node) ? (node.get('name') as string | undefined) : undefined;
}

function findByName(seq: YAMLSeq, name: string): YAMLMap | undefined {
  return seq.items.find((it) => nameOf(it) === name) as YAMLMap | undefined;
}

function insertCanonical(seq: YAMLSeq, order: string[], node: YAMLMap): void {
  const rank = order.indexOf(nameOf(node)!);
  const idx = seq.items.findIndex((it) => order.indexOf(nameOf(it) ?? '') > rank);
  if (idx === -1) seq.items.push(node);
  else seq.items.splice(idx, 0, node);
}

// A plain-JS copy of `map` with any REDIS_URL envVar item removed, for template
// comparison (REDIS_URL is owned by the jobs feature, not by the service block).
function withoutRedis(map: YAMLMap): unknown {
  const json = map.toJSON() as { envVars?: Array<Record<string, unknown>> };
  if (json.envVars) json.envVars = json.envVars.filter((e) => e.key !== 'REDIS_URL');
  return json;
}

// Stringify a single node as a one-item sequence for diff output.
function stringifyOne(node: unknown): string {
  const doc = new Document();
  const seq = new YAMLSeq();
  (seq.items as unknown[]).push(node);
  doc.contents = seq;
  return stringifyDoc(doc);
}

function reconcileBlock(
  seq: YAMLSeq,
  order: string[],
  fragment: string,
  conflicts: Conflict[],
): boolean {
  const node = templateNode(fragment);
  const name = nameOf(node)!;
  const existing = findByName(seq, name);
  if (!existing) {
    insertCanonical(seq, order, node);
    return true;
  }
  if (!structurallyEqual(withoutRedis(existing), withoutRedis(node))) {
    conflicts.push({
      block: `services/databases: ${name}`,
      diff: unifiedDiff(stringifyOne(node), stringifyOne(existing), name),
    });
  }
  return false;
}

// Insert REDIS_URL into a server/worker map's envVars after DATABASE_URL, before
// fromGroup: absent ⇒ insert; present-and-equal ⇒ no-op; different ⇒ conflict.
function ensureRedisUrl(map: YAMLMap | undefined, conflicts: Conflict[]): boolean {
  if (!map) return false;
  const envVars = map.get('envVars') as YAMLSeq | undefined;
  if (!isSeq(envVars)) return false;
  const redisNode = templateNode(REDIS_URL_ITEM);
  const existing = envVars.items.find(
    (it) => isMap(it) && it.get('key') === 'REDIS_URL',
  ) as YAMLMap | undefined;
  if (existing) {
    if (!structurallyEqual(existing.toJSON(), redisNode.toJSON())) {
      conflicts.push({
        block: `${map.get('name')}: REDIS_URL`,
        diff: unifiedDiff(stringifyOne(redisNode), stringifyOne(existing), 'REDIS_URL'),
      });
    }
    return false;
  }
  const groupIdx = envVars.items.findIndex((it) => isMap(it) && it.has('fromGroup'));
  if (groupIdx === -1) envVars.items.push(redisNode);
  else envVars.items.splice(groupIdx, 0, redisNode);
  return true;
}

export function planRender(currentYaml: string, desired: Desired): Plan {
  const doc = parseDoc(currentYaml);
  const dbs = doc.get('databases') as YAMLSeq;
  const services = doc.get('services') as YAMLSeq;
  const conflicts: Conflict[] = [];
  let changed = false;

  // Existence pass: databases, then services, each in canonical order.
  if (desired.staging) changed = reconcileBlock(dbs, DB_ORDER, STAGING_DB, conflicts) || changed;
  if (desired.jobs) changed = reconcileBlock(services, SERVICE_ORDER, KEYVALUE, conflicts) || changed;
  if (desired.staging)
    changed = reconcileBlock(services, SERVICE_ORDER, STAGING_SERVER, conflicts) || changed;
  if (desired.staging && desired.jobs)
    changed = reconcileBlock(services, SERVICE_ORDER, STAGING_WORKER, conflicts) || changed;
  if (desired.jobs)
    changed = reconcileBlock(services, SERVICE_ORDER, PRODUCTION_WORKER, conflicts) || changed;

  // REDIS_URL pass: only when jobs are enabled.
  if (desired.jobs) {
    const envs = ['production', ...(desired.staging ? ['staging'] : [])];
    for (const env of envs) {
      changed = ensureRedisUrl(findByName(services, `${env}-server`), conflicts) || changed;
      changed = ensureRedisUrl(findByName(services, `${env}-worker`), conflicts) || changed;
    }
  }

  if (conflicts.length > 0) return { ok: false, conflicts };
  return { ok: true, output: stringifyDoc(doc), changed };
}
