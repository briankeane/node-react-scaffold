import { Document, YAMLMap, Pair, Scalar } from 'yaml';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from './yamlUtil.js';
import { COMPOSE_REDIS, COMPOSE_WORKER } from './templates.js';
import type { Desired, Plan, Conflict } from './config.js';

// COMPOSE_REDIS / COMPOSE_WORKER are top-level map fragments (not sequence items,
// unlike the render.yaml templates), so the parsed document's contents is already
// the service's YAMLMap.
function serviceNode(fragment: string): YAMLMap {
  return parseDoc(fragment).contents as YAMLMap;
}

function keyOf(pair: Pair): string {
  const key = pair.key;
  return key instanceof Scalar ? String(key.value) : String(key);
}

// Stringify a single node as a standalone doc for diff output.
function stringifyOne(node: unknown): string {
  const doc = new Document();
  doc.contents = node as any;
  return stringifyDoc(doc);
}

function reconcileService(
  doc: Document,
  services: YAMLMap,
  key: string,
  fragment: string,
  conflicts: Conflict[],
  afterKey?: string,
): boolean {
  const node = serviceNode(fragment);
  if (services.has(key)) {
    const existing = services.get(key) as YAMLMap;
    if (!structurallyEqual(existing.toJSON(), node.toJSON())) {
      conflicts.push({
        block: `compose: ${key}`,
        diff: unifiedDiff(stringifyOne(node), stringifyOne(existing), key),
      });
    }
    return false;
  }
  // `createPair` lives on Document, not on the map/collection node itself (yaml@2.9).
  const pair = doc.createPair(key, node);
  if (afterKey) {
    const idx = services.items.findIndex((p) => keyOf(p) === afterKey);
    if (idx !== -1) {
      services.items.splice(idx + 1, 0, pair);
      return true;
    }
  }
  services.items.unshift(pair);
  return true;
}

export function planCompose(currentYaml: string, desired: Desired): Plan {
  const doc = parseDoc(currentYaml);
  const services = doc.get('services') as YAMLMap;
  const conflicts: Conflict[] = [];
  let changed = false;

  if (desired.jobs) {
    changed = reconcileService(doc, services, 'redis', COMPOSE_REDIS, conflicts) || changed;
    changed =
      reconcileService(doc, services, 'worker', COMPOSE_WORKER, conflicts, 'server') || changed;
  }

  if (conflicts.length > 0) return { ok: false, conflicts };
  return { ok: true, output: stringifyDoc(doc), changed };
}
