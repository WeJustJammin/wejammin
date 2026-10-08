import { describe, expect, it } from 'vitest';

import {
  CMS_DEPENDENCY_MANIFEST_MAX_BYTES,
  DependencyManifestSchema,
  PublicationRequestSchema,
  PublicationScheduleRequestSchema,
} from '@wejammin/contracts';

import {
  hash,
  uuid,
  uuid2,
  uuid3,
  validDependencyManifest,
  validPublication,
  validSchedule,
  validVersionSet,
} from '../../packages/contracts/src/cms-editorial/publication-contracts.test-support';

// Evidence lane EB: boundary assertions the contract suites left implicit for the
// CMS-03B-05 dependency manifest (AC-039), the CMS-03B-07 time members (AC-044) and
// the CMS-03B-09 publication request (AC-048). Each case names the exact member it breaks.

const manifestIssues = (manifest: unknown): string[] => {
  const result = DependencyManifestSchema.safeParse(manifest);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

const jsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

const withHash = (path: readonly (string | number)[], value: string) => {
  const copy = structuredClone(validDependencyManifest) as Record<
    string,
    unknown
  >;
  let cursor: Record<string, unknown> | unknown[] = copy;
  for (const key of path.slice(0, -1)) {
    cursor = (cursor as Record<string | number, unknown>)[key] as
      Record<string, unknown> | unknown[];
  }
  (cursor as Record<string | number, unknown>)[
    path[path.length - 1] as string | number
  ] = value;
  return copy;
};

describe('EB evidence CMS-03B-05 dependencyManifest hash and identity grammar per group', () => {
  const hashMembers: readonly (readonly [
    string,
    readonly (string | number)[],
  ])[] = [
    ['schema.hash', ['schema', 'hash']],
    ['template.hash', ['template', 'hash']],
    ['blocks[0].hash', ['blocks', 0, 'hash']],
    ['patterns[0].hash', ['patterns', 0, 'hash']],
    ['terms[0].hash', ['terms', 0, 'hash']],
    ['localeSources[0].hash', ['localeSources', 0, 'hash']],
    ['settings.hash', ['settings', 'hash']],
  ];
  const badHashes: readonly (readonly [string, string])[] = [
    ['uppercase', 'A'.repeat(64)],
    ['63-character', 'a'.repeat(63)],
    ['65-character', 'a'.repeat(65)],
    ['non-hex', 'g'.repeat(64)],
  ];

  it('accepts the canonical manifest it derives every case from', () => {
    expect(manifestIssues(validDependencyManifest)).toEqual([]);
  });

  for (const [member, path] of hashMembers) {
    for (const [label, bad] of badHashes) {
      it(`refuses the ${label} hash value at manifest member ${member}`, () => {
        expect(manifestIssues(withHash(path, bad)).length).toBeGreaterThan(0);
      });
    }
  }

  it('refuses a schema id that is not a UUID and an empty or 65-character checker key', () => {
    expect(
      manifestIssues(withHash(['schema', 'id'], 'x')).length,
    ).toBeGreaterThan(0);
    expect(
      manifestIssues(withHash(['checker', 'key'], '')).length,
    ).toBeGreaterThan(0);
    expect(
      manifestIssues(withHash(['checker', 'key'], 'k'.repeat(65))).length,
    ).toBeGreaterThan(0);
    expect(
      manifestIssues(withHash(['checker', 'key'], 'k'.repeat(64))),
    ).toEqual([]);
  });

  it('refuses a plural checkers member: the contract carries exactly one checker entry (DEC-145 D-13)', () => {
    expect(
      manifestIssues({
        ...validDependencyManifest,
        checkers: [validDependencyManifest.checker],
      }).length,
    ).toBeGreaterThan(0);
  });
});

describe('EB evidence CMS-03B-05 dependencyManifest exact 32 KiB serialized boundary', () => {
  // Entries are capped at 256, so reaching 32 KiB needs the widest entries: 32 locale sources
  // with 35-character locales and 128 relations. The remaining bytes come from a number of
  // terms plus the length of schemaArtifact.zodContractRef (1-256 characters); neither changes
  // anything but the serialized size.
  const idOf = (index: number): string =>
    `123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`;
  type Wide = Record<string, unknown> & {
    schema: { schemaArtifact: { zodContractRef: string } };
  };
  const manifestOfBytes = (target: number): Wide => {
    const base = structuredClone(validDependencyManifest) as unknown as Wide;
    base.localeSources = Array.from({ length: 32 }, (_, index) => ({
      locale: `en-${String(index).padStart(8, '0')}-aaaaaaaa-aaaaaaaa-bbbbb`,
      revisionId: idOf(index),
      hash,
    }));
    base.relations = Array.from({ length: 128 }, (_, index) => ({
      fieldId: idOf(1000 + index),
      targetId: idOf(2000 + index),
      targetVersion: '1',
    }));
    const withTerms = (count: number): Wide => ({
      ...base,
      terms: Array.from({ length: count }, (_, index) => ({
        id: idOf(3000 + index),
        hash,
      })),
    });
    let terms = 0;
    while (jsonBytes(withTerms(terms + 1)) <= target) terms += 1;
    const sized = withTerms(terms);
    const current = sized.schema.schemaArtifact.zodContractRef.length;
    sized.schema.schemaArtifact.zodContractRef = 'z'.repeat(
      current + target - jsonBytes(sized),
    );
    return sized;
  };

  it('accepts a manifest of exactly 32768 UTF-8 bytes and refuses 32769 with only the byte-bound issue', () => {
    const atBound = manifestOfBytes(CMS_DEPENDENCY_MANIFEST_MAX_BYTES);
    expect(jsonBytes(atBound)).toBe(CMS_DEPENDENCY_MANIFEST_MAX_BYTES);
    expect(manifestIssues(atBound)).toEqual([]);
    const overBound = manifestOfBytes(CMS_DEPENDENCY_MANIFEST_MAX_BYTES + 1);
    expect(jsonBytes(overBound)).toBe(CMS_DEPENDENCY_MANIFEST_MAX_BYTES + 1);
    expect(manifestIssues(overBound)).toEqual([
      'dependency_manifest_max_bytes',
    ]);
  });
});

describe('EB evidence CMS-03B-07 resolvedUtc and tzdbVersion bounds', () => {
  const issues = (patch: Record<string, unknown>): boolean =>
    PublicationScheduleRequestSchema.safeParse({ ...validSchedule, ...patch })
      .success;

  it('bounds tzdbVersion to 1-32 characters: empty refused, 1 and exactly 32 accepted, 33 refused', () => {
    expect(issues({ tzdbVersion: '' })).toBe(false);
    expect(issues({ tzdbVersion: 'x' })).toBe(true);
    expect(issues({ tzdbVersion: 'x'.repeat(32) })).toBe(true);
    expect(issues({ tzdbVersion: 'x'.repeat(33) })).toBe(false);
  });

  it('accepts an ISO instant with a non-Z numeric offset and refuses an instant without any offset', () => {
    expect(issues({ resolvedUtc: '2026-11-01T16:30:00+02:00' })).toBe(true);
    expect(issues({ resolvedUtc: '2026-11-01T09:30:00-05:00' })).toBe(true);
    expect(issues({ resolvedUtc: '2026-11-01T14:30:00' })).toBe(false);
    expect(issues({ resolvedUtc: '2026-11-01' })).toBe(false);
  });
});

describe('EB evidence CMS-03B-09 publication request frozenHash and expectedVersionSet strictness', () => {
  const accepts = (patch: Record<string, unknown>): boolean =>
    PublicationRequestSchema.safeParse({ ...validPublication, ...patch })
      .success;

  it('refuses a frozenHash that is uppercase, non-hex, 63 or 65 characters long on the publication request member itself', () => {
    expect(accepts({})).toBe(true);
    expect(accepts({ frozenHash: 'A'.repeat(64) })).toBe(false);
    expect(accepts({ frozenHash: 'g'.repeat(64) })).toBe(false);
    expect(accepts({ frozenHash: 'a'.repeat(63) })).toBe(false);
    expect(accepts({ frozenHash: 'a'.repeat(65) })).toBe(false);
  });

  it('refuses an expectedVersionSet carrying an extra key, a duplicate block id or a non-hash schemaHash', () => {
    expect(
      accepts({ expectedVersionSet: { ...validVersionSet, extra: 1 } }),
    ).toBe(false);
    expect(
      accepts({
        expectedVersionSet: {
          ...validVersionSet,
          blockVersionIds: [uuid3, uuid3],
        },
      }),
    ).toBe(false);
    expect(
      accepts({
        expectedVersionSet: { ...validVersionSet, schemaHash: 'A'.repeat(64) },
      }),
    ).toBe(false);
    expect(
      accepts({
        expectedVersionSet: {
          ...validVersionSet,
          templateVersionId: uuid2,
          templateHash: null,
        },
      }),
    ).toBe(false);
    expect(
      accepts({
        expectedVersionSet: { ...validVersionSet, schemaVersionId: uuid },
      }),
    ).toBe(false);
  });
});
