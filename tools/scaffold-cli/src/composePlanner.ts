import { Document, YAMLMap, Pair, Scalar, isMap } from 'yaml';
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

const SERVER_REDIS_URL = 'redis://redis:6379';

// Field-level owned edit on the base `server` service: inject REDIS_URL into its
// `environment` map (mirroring the worker) so the local API can enqueue jobs.
// Absent ⇒ insert (before `command`, matching the worker's key order); present-and-
// equal ⇒ no-op; present-and-different ⇒ conflict. No other server line is touched.
function ensureServerRedisUrl(doc: Document, services: YAMLMap, conflicts: Conflict[]): boolean {
  const server = services.get('server');
  if (!isMap(server)) return false;

  const envPair = server.items.find((p) => keyOf(p) === 'environment');
  const env = envPair?.value;
  if (isMap(env)) {
    if (env.has('REDIS_URL')) {
      const existing = env.get('REDIS_URL');
      if (existing !== SERVER_REDIS_URL) {
        conflicts.push({
          block: 'compose: server.environment.REDIS_URL',
          diff: unifiedDiff(String(SERVER_REDIS_URL), String(existing), 'REDIS_URL'),
        });
      }
      return false;
    }
    env.set('REDIS_URL', SERVER_REDIS_URL);
    return true;
  }

  if (envPair) {
    // `environment` is present but not a map (e.g. list form) — fail closed
    // instead of inserting a second `environment:` key, which would corrupt
    // the compose file.
    conflicts.push({
      block: 'compose: server.environment',
      diff:
        'server.environment must be a map (e.g. `KEY: value` pairs) to inject REDIS_URL; ' +
        'found a non-map form. Convert it to map form and re-run.',
    });
    return false;
  }

  const envMap = new YAMLMap();
  envMap.set('REDIS_URL', SERVER_REDIS_URL);
  const pair = doc.createPair('environment', envMap);
  const idx = server.items.findIndex((p) => keyOf(p) === 'command');
  if (idx === -1) server.items.push(pair);
  else server.items.splice(idx, 0, pair);
  return true;
}

export function planCompose(currentYaml: string, desired: Desired): Plan {
  const doc = parseDoc(currentYaml, 'docker-compose.yaml');
  const services = doc.get('services') as YAMLMap;
  const conflicts: Conflict[] = [];
  let changed = false;

  if (desired.jobs) {
    changed = reconcileService(doc, services, 'redis', COMPOSE_REDIS, conflicts) || changed;
    changed =
      reconcileService(doc, services, 'worker', COMPOSE_WORKER, conflicts, 'server') || changed;
    changed = ensureServerRedisUrl(doc, services, conflicts) || changed;
  }

  if (conflicts.length > 0) return { ok: false, conflicts };
  return { ok: true, output: stringifyDoc(doc), changed };
}
