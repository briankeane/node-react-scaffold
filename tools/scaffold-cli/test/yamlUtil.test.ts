import { describe, it, expect } from 'vitest';
import { parseDoc, stringifyDoc, structurallyEqual, unifiedDiff } from '../src/yamlUtil.js';

describe('structurallyEqual', () => {
  it('ignores comments, quote style, and key order', () => {
    const a = parseDoc('a: 1\n# comment\nb: "two"\n').get('a');
    const b = parseDoc('a: 1\n').get('a');
    expect(structurallyEqual(a, b)).toBe(true);
  });

  it('treats a quoted string and a number as different (no scalar coercion)', () => {
    const doc = parseDoc('x: "10020"\ny: 10020\n');
    expect(structurallyEqual(doc.get('x', true), doc.get('y', true))).toBe(false);
  });

  it('detects a changed value as unequal', () => {
    const a = parseDoc('k: node dist/server.js\n').get('k');
    const b = parseDoc('k: node dist/hacked.js\n').get('k');
    expect(structurallyEqual(a, b)).toBe(false);
  });
});

describe('stringifyDoc round-trip', () => {
  it('preserves a leading comment', () => {
    const text = '# hello\nfoo: bar\n';
    expect(stringifyDoc(parseDoc(text))).toContain('# hello');
  });
});

describe('unifiedDiff', () => {
  it('produces a readable diff with the label', () => {
    const d = unifiedDiff('a: 1\n', 'a: 2\n', 'production-server');
    expect(d).toContain('production-server');
    expect(d).toMatch(/-.*a: 1/);
    expect(d).toMatch(/\+.*a: 2/);
  });
});
