import { parseDocument, Document, isNode } from 'yaml';

export function parseDoc(text: string): Document.Parsed {
  return parseDocument(text, { keepSourceTokens: false });
}

// Deterministic stringify. `yaml` preserves comments and existing quote styles by
// default; keep line width unlimited so long image URLs / commands don't wrap.
// flowCollectionPadding: false keeps `['a', 'b']` un-padded so re-stringifying
// UNOWNED flow sequences (e.g. docker-compose `command: [...]`) round-trips
// byte-identical instead of drifting to `[ 'a', 'b' ]`.
export function stringifyDoc(doc: Document): string {
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

// Structural equality that ignores comments, anchors, and key order, but does NOT
// coerce scalar types: the quoted string "10020" and the number 10020 differ, and
// the quoted "off" and boolean false differ. Achieved by comparing the plain JS
// value of each node with types preserved (yaml keeps "10020" a string, 10020 a
// number), recursing structurally for maps/seqs.
export function structurallyEqual(a: unknown, b: unknown): boolean {
  const av = isNode(a) ? (a as any).toJSON() : a;
  const bv = isNode(b) ? (b as any).toJSON() : b;
  return deepEqualTyped(av, bv);
}

function deepEqualTyped(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqualTyped(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (ak.length !== bk.length || !ak.every((k, i) => k === bk[i])) return false;
    return ak.every((k) =>
      deepEqualTyped((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// Minimal line-based unified diff for conflict messages (no external dep).
export function unifiedDiff(expected: string, actual: string, label: string): string {
  const e = expected.split('\n');
  const a = actual.split('\n');
  const out = [`--- expected (scaffold-owned: ${label})`, `+++ actual (in file)`];
  const max = Math.max(e.length, a.length);
  for (let i = 0; i < max; i++) {
    if (e[i] === a[i]) {
      if (e[i] !== undefined) out.push(`  ${e[i]}`);
    } else {
      if (e[i] !== undefined) out.push(`- ${e[i]}`);
      if (a[i] !== undefined) out.push(`+ ${a[i]}`);
    }
  }
  return out.join('\n');
}
