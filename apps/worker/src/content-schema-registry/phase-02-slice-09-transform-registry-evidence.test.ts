/**
 * BE03a transform registry acceptance evidence: every member is a code-owned,
 * pure, bounded declaration, and the two v1 members behave exactly as the
 * spec states when run through the real scan executor.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MAX_MIGRATION_BATCH_ROWS } from './migration-worker-constants';
import { scanSourcePage } from './migration-scan-executor';
import {
  canonicalHash,
  canonicalJson,
  sha256Hex,
} from './migration-transform-jcs';
import {
  DEFAULT_FILL_LITERAL_KEY,
  DEFAULT_TRANSFORM_REGISTRY,
  IA_FIELD_KINDS,
  IDENTITY_REVALIDATE_KEY,
  digestPreimage,
  resolveTransform,
  TRANSFORM_BEHAVIOR,
} from './migration-transform-registry';
import type {
  SourcePage,
  TargetFieldSpec,
  TransformRegistryEntry,
} from './migration-transform-types';

const here = dirname(fileURLToPath(import.meta.url));

const member = (key: string): TransformRegistryEntry => {
  const found = DEFAULT_TRANSFORM_REGISTRY.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`missing registry member ${key}`);
  return found;
};

const target = (overrides: Partial<TargetFieldSpec> = {}): TargetFieldSpec => ({
  fieldKey: 'title',
  kind: 'short_text',
  required: true,
  defaultMode: 'literal',
  defaultValue: 'untitled',
  constraints: { maxLength: 8 },
  ...overrides,
});

const page = (
  documents: readonly Record<string, unknown>[],
  targetFields: readonly TargetFieldSpec[],
): SourcePage => ({
  rows: documents.map((document, index) => ({
    sourceTable: 'cms_entry_field_values',
    sourceRowId: `0195b6f0-0000-7000-8000-${String(index + 1).padStart(12, '0')}`,
    sourceHash: `${String(index + 1).repeat(64)}`.slice(0, 64),
    document,
  })),
  nextCursor: '1',
  done: true,
  targetFields,
  retiredFields: [],
});

describe('code-owned transform registry', () => {
  it('[P2-S09-AC-679] declares for every entry a key, positive version, 64-hex digest, source and target constraints, a non-empty accepted field-kind subset and deterministic bounded behavior with no I/O, clock or randomness, and is never an uploaded expression, SQL or code', async () => {
    expect(DEFAULT_TRANSFORM_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of DEFAULT_TRANSFORM_REGISTRY) {
      expect(entry.key).toMatch(/^[a-z][a-z0-9._-]{0,127}$/u);
      expect(Number.isInteger(entry.version) && entry.version > 0).toBe(true);
      expect(entry.digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(typeof entry.sourceConstraints).toBe('object');
      expect(typeof entry.targetConstraints).toBe('object');
      expect(entry.acceptedFieldKinds.length).toBeGreaterThan(0);
      for (const kind of entry.acceptedFieldKinds)
        expect(IA_FIELD_KINDS).toContain(kind);
      expect(typeof entry.apply).toBe('function');
      const behavior =
        TRANSFORM_BEHAVIOR[entry.key as keyof typeof TRANSFORM_BEHAVIOR];
      expect(behavior.length).toBeGreaterThan(0);
      expect(entry.digest).toBe(
        await sha256Hex(canonicalJson(digestPreimage(entry, behavior))),
      );
      // Pure: identical output for identical input, and frozen input is untouched.
      const document = Object.freeze({ title: 'abc' });
      const context = Object.freeze({
        targetFields: Object.freeze([target()]),
        retiredFields: Object.freeze([]),
      });
      expect(entry.apply(document, context)).toEqual(
        entry.apply(document, context),
      );
    }
    // Bounded: a batch never exceeds 128 rows.
    expect(MAX_MIGRATION_BATCH_ROWS).toBe(128);
    // No I/O, clock or randomness in the member implementations.
    for (const file of [
      'migration-transform-registry.ts',
      'migration-target-validator.ts',
    ]) {
      const source = readFileSync(resolve(here, file), 'utf8');
      expect(source, file).not.toMatch(
        /\b(Date\.now|new Date\(\)|performance\.now|Math\.random|getRandomValues|randomUUID|fetch\(|XMLHttpRequest|setTimeout|setInterval|process\.env|require\(|import\(|eval\(|new Function)/u,
      );
    }
    // Never an uploaded expression: only registered names resolve.
    for (const key of [
      'eval(1)',
      'select 1',
      'x=>x',
      'identity.revalidate;drop',
    ])
      expect(resolveTransform(DEFAULT_TRANSFORM_REGISTRY, key, '1').kind).toBe(
        'unregistered',
      );
    expect(
      resolveTransform(DEFAULT_TRANSFORM_REGISTRY, IDENTITY_REVALIDATE_KEY, '1')
        .kind,
    ).toBe('entry');
  });
});

describe('identity.revalidate version 1 through the scan executor', () => {
  it('[P2-S09-AC-681] carries every stored value unchanged (output_hash equals source_hash), validates it against the target constraints and records TRANSFORM_TARGET_VIOLATION with no output hash for a failing row', async () => {
    const identity = member(IDENTITY_REVALIDATE_KEY);
    expect(identity.carriesSourceHash).toBe(true);
    const evidence = await scanSourcePage(
      page([{ title: 'short' }, { title: 'toolongvalue' }], [target()]),
      identity,
    );
    expect(evidence[0]).toMatchObject({
      outputHash: evidence[0]?.sourceHash,
      errorCode: null,
    });
    expect(evidence[1]).toMatchObject({
      outputHash: null,
      errorCode: 'TRANSFORM_TARGET_VIOLATION',
    });
    const document = { title: 'short', extra: [1, 2] };
    expect(
      identity.apply(document, { targetFields: [target()], retiredFields: [] }),
    ).toBe(document);
    expect(await canonicalHash(document)).toBe(await canonicalHash(document));
  });
});

describe('default.fill_literal version 1 through the scan executor', () => {
  it('[P2-S09-AC-682] writes the target field declared literal default for an absent or null value, passes an existing value unchanged and records TRANSFORM_DEFAULT_UNAVAILABLE for any other default mode', async () => {
    const fill = member(DEFAULT_FILL_LITERAL_KEY);
    const context = { targetFields: [target()], retiredFields: [] };
    expect(fill.apply({}, context)).toEqual({ title: 'untitled' });
    expect(fill.apply({ title: null }, context)).toEqual({ title: 'untitled' });
    const present = { title: 'kept' };
    expect(fill.apply(present, context)).toBe(present);
    const absent = await scanSourcePage(
      page([{}, { title: 'kept' }], [target()]),
      fill,
    );
    expect(absent.map((entry) => entry.errorCode)).toEqual([null, null]);
    expect(
      absent.every((entry) => /^[a-f0-9]{64}$/u.test(entry.outputHash ?? '')),
    ).toBe(true);
    for (const defaultMode of ['none', 'computed', 'now', 'copy']) {
      const refused = await scanSourcePage(
        page([{}], [target({ defaultMode })]),
        fill,
      );
      expect(refused[0]).toMatchObject({
        outputHash: null,
        errorCode: 'TRANSFORM_DEFAULT_UNAVAILABLE',
      });
    }
  });
});
