import { describe, expect, it } from 'vitest';

import {
  DependencyManifestSchema,
  VersionSetSchema,
  compareBytewise,
  compareValidatorRefs,
  isAscendingBy,
  versionSetMatchesManifest,
  versionSetOf,
} from './index';
import {
  hash,
  hash2,
  validDependencyManifest,
  validVersionSet,
} from './workflow-fixtures.test-support';

/*
 * BE03b "Frozen dependency manifest build and version set (E1, E7)": "Every
 * list is sorted ascending by the lowercase UUID string (bytewise), each
 * identity appears once". A frozen manifest and version set are hashed and
 * compared as JCS text, so one dependency set has exactly one serialization:
 * a list in any other order is refused, never re-sorted by the reader.
 */

const id = (index: number): string =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;

const SORTED = 'dependency_manifest_entries_must_be_sorted';
const UNIQUE = 'dependency_manifest_entries_must_be_unique';
const VERSION_IDS_SORTED = 'version_ids_must_be_sorted';
const VERSION_IDS_UNIQUE = 'version_ids_must_be_unique';
const NOT_LOWERCASE = 'uuid_must_be_lowercase';

const manifestIssues = (value: unknown) => {
  const result = DependencyManifestSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => ({ path, message }));
};

const versionSetIssues = (value: unknown) => {
  const result = VersionSetSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => ({ path, message }));
};

const entry = (index: number) => ({ id: id(index), hash });

describe('[P2-S11-AC-089] the bytewise comparison and the ascending predicate', () => {
  it('orders ASCII strings by code unit, so digits precede upper case precede lower case', () => {
    const ordered = ['0', '9', 'A', 'Z', 'a', 'f', 'z'];
    for (let index = 1; index < ordered.length; index += 1)
      expect(
        compareBytewise(ordered[index - 1] as string, ordered[index] as string),
      ).toBe(-1);
    expect(compareBytewise('a', 'a')).toBe(0);
    expect(compareBytewise('b', 'a')).toBe(1);
    // Bytewise, not numeric and not locale: "10" precedes "2" and "B" precedes "a".
    expect(compareBytewise('10', '2')).toBe(-1);
    expect(compareBytewise('B', 'a')).toBe(-1);
  });

  it('is true for the empty list, a singleton and an ascending list, false for any inversion', () => {
    const by = (left: string, right: string) => compareBytewise(left, right);
    expect(isAscendingBy([], by)).toBe(true);
    expect(isAscendingBy(['a'], by)).toBe(true);
    expect(isAscendingBy(['a', 'b', 'c'], by)).toBe(true);
    expect(isAscendingBy(['a', 'a'], by)).toBe(true);
    expect(isAscendingBy(['b', 'a'], by)).toBe(false);
    expect(isAscendingBy(['a', 'c', 'b'], by)).toBe(false);
  });

  it('orders validator references by key and then by version, both bytewise', () => {
    const ref = (key: string, version: string) => ({ key, version });
    expect(
      compareValidatorRefs(ref('a.v1', '9'), ref('rich_text.v1', '1')),
    ).toBe(-1);
    expect(
      compareValidatorRefs(ref('rich_text.v1', '1'), ref('rich_text.v1', '10')),
    ).toBe(-1);
    expect(
      compareValidatorRefs(ref('rich_text.v1', '10'), ref('rich_text.v1', '2')),
    ).toBe(-1);
    expect(
      compareValidatorRefs(ref('rich_text.v1', '2'), ref('rich_text.v1', '2')),
    ).toBe(0);
    expect(
      compareValidatorRefs(ref('rich_text.v2', '1'), ref('rich_text.v1', '9')),
    ).toBe(1);
  });
});

describe('[P2-S11-AC-089] DependencyManifest lists are strictly ascending by canonical identity', () => {
  for (const group of ['blocks', 'patterns', 'terms'] as const) {
    it(`accepts ${group} ascending by id and refuses any other order`, () => {
      const ascending = [entry(1), entry(2), entry(15)];
      expect(
        manifestIssues({ ...validDependencyManifest, [group]: ascending }),
      ).toEqual([]);
      expect(
        manifestIssues({
          ...validDependencyManifest,
          [group]: [entry(2), entry(1)],
        }),
      ).toEqual([{ path: [group], message: SORTED }]);
      expect(
        manifestIssues({
          ...validDependencyManifest,
          [group]: [entry(1), entry(15), entry(2)],
        }),
      ).toEqual([{ path: [group], message: SORTED }]);
    });
  }

  it('reports a repeated identity as a duplicate and not as a misordering', () => {
    expect(
      manifestIssues({
        ...validDependencyManifest,
        blocks: [entry(1), entry(1)],
      }),
    ).toEqual([{ path: ['blocks'], message: UNIQUE }]);
  });

  it('orders localeSources by source revision id then locale and relations by field id then target id', () => {
    const source = (index: number, locale: string) => ({
      locale,
      revisionId: id(index),
      hash,
    });
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [source(1, 'fr-FR'), source(2, 'de-DE')],
      }),
    ).toEqual([]);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [source(2, 'de-DE'), source(1, 'fr-FR')],
      }),
    ).toEqual([{ path: ['localeSources'], message: SORTED }]);
    // One source revision may back several locales: the locale breaks the tie.
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [source(1, 'de-DE'), source(1, 'fr-FR')],
      }),
    ).toEqual([]);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [source(1, 'fr-FR'), source(1, 'de-DE')],
      }),
    ).toEqual([{ path: ['localeSources'], message: SORTED }]);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [source(1, 'fr-FR'), source(2, 'fr-FR')],
      }),
    ).toEqual([{ path: ['localeSources'], message: UNIQUE }]);

    const relation = (field: number, target: number) => ({
      fieldId: id(field),
      targetId: id(target),
      targetVersion: '1',
    });
    expect(
      manifestIssues({
        ...validDependencyManifest,
        relations: [relation(1, 2), relation(1, 3), relation(2, 1)],
      }),
    ).toEqual([]);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        relations: [relation(1, 3), relation(1, 2)],
      }),
    ).toEqual([{ path: ['relations'], message: SORTED }]);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        relations: [relation(2, 1), relation(1, 9)],
      }),
    ).toEqual([{ path: ['relations'], message: SORTED }]);
  });

  it('refuses an upper-case identity so the sort key is the lowercase string', () => {
    const upper = 'A0000000-0000-4000-8000-000000000001';
    expect(
      manifestIssues({
        ...validDependencyManifest,
        blocks: [{ id: upper, hash }],
      }).map(({ message }) => message),
    ).toContain(NOT_LOWERCASE);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        relations: [{ fieldId: upper, targetId: id(1), targetVersion: '1' }],
      }).map(({ message }) => message),
    ).toContain(NOT_LOWERCASE);
    expect(
      manifestIssues({
        ...validDependencyManifest,
        localeSources: [{ locale: 'en-US', revisionId: upper, hash }],
      }).map(({ message }) => message),
    ).toContain(NOT_LOWERCASE);
  });
});

describe('[P2-S11-AC-089] VersionSet id lists are strictly ascending by lowercase UUID', () => {
  for (const member of [
    'taxonomyVersionIds',
    'blockVersionIds',
    'patternVersionIds',
  ] as const) {
    it(`accepts ${member} ascending and refuses an inversion, a repeat and an upper-case id`, () => {
      expect(
        versionSetIssues({
          ...validVersionSet,
          [member]: [id(1), id(2), id(15)],
        }),
      ).toEqual([]);
      expect(
        versionSetIssues({ ...validVersionSet, [member]: [id(2), id(1)] }),
      ).toEqual([{ path: [member], message: VERSION_IDS_SORTED }]);
      expect(
        versionSetIssues({ ...validVersionSet, [member]: [id(1), id(1)] }),
      ).toEqual([{ path: [member], message: VERSION_IDS_UNIQUE }]);
      expect(
        versionSetIssues({
          ...validVersionSet,
          [member]: ['A0000000-0000-4000-8000-000000000001'],
        }).map(({ message }) => message),
      ).toContain(NOT_LOWERCASE);
    });
  }
});

describe('[P2-S11-AC-089] versionSetOf emits canonical order whatever order it is given', () => {
  const shuffled = (list: readonly { id: string; hash: string }[]) =>
    [...list].reverse();

  it('sorts the taxonomy ids bytewise, so "10" style ids and hex letters order by code unit', () => {
    const manifest = DependencyManifestSchema.parse(validDependencyManifest);
    const taxonomy = [id(15), id(2), id(1), id(10)];
    expect(versionSetOf(manifest, taxonomy).taxonomyVersionIds).toEqual([
      id(1),
      id(2),
      id(10),
      id(15),
    ]);
    // Bytewise: 'f' (0x66) follows every digit, so 00..0f follows 00..09.
    expect(versionSetOf(manifest, [id(15), id(9)]).taxonomyVersionIds).toEqual([
      id(9),
      id(15),
    ]);
  });

  it('sorts block ids, pattern ids and validator references even from a hand-built manifest', () => {
    const parsed = DependencyManifestSchema.parse({
      ...validDependencyManifest,
      blocks: [entry(1), entry(2), entry(3)],
      patterns: [entry(4), entry(5)],
    });
    const unsorted = {
      ...parsed,
      blocks: shuffled(parsed.blocks),
      patterns: shuffled(parsed.patterns),
    };
    const projected = versionSetOf(unsorted, []);
    expect(projected.blockVersionIds).toEqual([id(1), id(2), id(3)]);
    expect(projected.patternVersionIds).toEqual([id(4), id(5)]);
    expect(VersionSetSchema.safeParse(projected).success).toBe(true);
  });

  it('projects a canonical manifest unchanged and keeps versionSetMatchesManifest consistent', () => {
    const manifest = DependencyManifestSchema.parse({
      ...validDependencyManifest,
      blocks: [entry(1), entry(2)],
      patterns: [entry(3)],
    });
    const set = versionSetOf(manifest, [id(8), id(7)]);
    expect(set.taxonomyVersionIds).toEqual([id(7), id(8)]);
    expect(versionSetMatchesManifest(set, manifest)).toBe(true);
    expect(
      versionSetMatchesManifest(
        { ...set, blockVersionIds: [id(2), id(1)] },
        manifest,
      ),
    ).toBe(false);
    expect(
      versionSetMatchesManifest(
        { ...set, settingsVersion: '9', schemaHash: hash2 },
        manifest,
      ),
    ).toBe(false);
  });
});
