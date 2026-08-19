import { YAMLSeq, YAMLMap, Scalar, isSeq, isMap } from 'yaml';
import { parseDoc, stringifyDoc } from './yamlUtil.js';
import type { Plan, Conflict } from './config.js';
import type { Env } from './cloud/types.js';

function nameOf(node: unknown): string | undefined {
  return isMap(node) ? (node.get('name') as string | undefined) : undefined;
}

function findByName(seq: YAMLSeq, name: string): YAMLMap | undefined {
  return seq.items.find((it) => nameOf(it) === name) as YAMLMap | undefined;
}

function keyOf(pair: { key: unknown }): string {
  const k = pair.key;
  return k instanceof Scalar ? String(k.value) : String(k);
}

// Pure planner for `enable-domain`: manage a single scaffold-owned custom domain
// on the target env's server service in render.yaml (Render's IaC source of truth).
//
//   absent            -> add `domains: [<domain>]`
//   same single value -> no-op
//   different single  -> REPLACE (supports "domain changed after deploy")
//   multiple / non-list / server missing -> conflict (won't clobber a hand-managed setup)
export function planDomain(currentYaml: string, opts: { env: Env; domain: string }): Plan {
  const doc = parseDoc(currentYaml, 'render.yaml');
  const services = doc.get('services') as YAMLSeq;
  const svc = findByName(services, `${opts.env}-server`);

  if (!svc) {
    return {
      ok: false,
      conflicts: [
        {
          block: `services: ${opts.env}-server`,
          diff: `no ${opts.env}-server service found in render.yaml; enable the ${opts.env} env first (e.g. make enable-staging)`,
        },
      ],
    };
  }

  const existing = svc.get('domains') as unknown;
  const warnings: string[] = [];

  if (existing == null) {
    const seq = new YAMLSeq();
    seq.add(new Scalar(opts.domain));
    const pair = doc.createPair('domains', seq);
    // Deterministic position: before envVars (falls back to append).
    const idx = svc.items.findIndex((p) => keyOf(p) === 'envVars');
    if (idx === -1) svc.items.push(pair);
    else svc.items.splice(idx, 0, pair);
    return { ok: true, output: stringifyDoc(doc), changed: true, warnings };
  }

  if (!isSeq(existing) || existing.items.length !== 1) {
    const detail = isSeq(existing)
      ? `${existing.items.length} entries`
      : 'a non-list value';
    const conflict: Conflict = {
      block: `services: ${opts.env}-server.domains`,
      diff:
        `domains: is hand-managed (expected a single scaffold-owned entry, found ${detail}). ` +
        `Edit render.yaml manually and re-run.`,
    };
    return { ok: false, conflicts: [conflict] };
  }

  const item = existing.items[0] as Scalar;
  const current = String(item.value);
  if (current === opts.domain) {
    return { ok: true, output: stringifyDoc(doc), changed: false, warnings };
  }

  item.value = opts.domain;
  warnings.push(`domain changed: ${current} -> ${opts.domain}`);
  return { ok: true, output: stringifyDoc(doc), changed: true, warnings };
}
