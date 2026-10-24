import type {
  ChoiceMap,
  CompositionEntryFacts,
  DiffPath,
  InstanceRow,
  SelectorPage,
  UpdateDiff,
} from './composition-types';

/** Shared fixtures of the composition suites: every value is a canonical accepted contract value. */
export const ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const PAGE_PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/composition`;
export const REVISION_ID = '018f0c45-73fe-7dc2-9c09-000000000a01';
export const CONTENT_TYPE_ID = '018f0c45-73fe-7dc2-9c09-000000000a02';
export const PATTERN_ID = '018f0c45-73fe-7dc2-9c09-000000000a03';
export const id = (n: number): string =>
  `018f0c45-73fe-7dc2-9c09-${String(n).padStart(12, '0')}`;

export const entryFacts = (
  extra: Partial<CompositionEntryFacts> = {},
): CompositionEntryFacts => ({
  entryId: ENTRY_ID,
  version: '9',
  revisionId: REVISION_ID,
  contentTypeId: CONTENT_TYPE_ID,
  editable: true,
  ...extra,
});

export const row = (
  n: number,
  extra: Partial<InstanceRow> = {},
): InstanceRow => ({
  id: id(n),
  version: '3',
  contentHash: 'c'.repeat(64),
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
  state: 'active',
  revisionId: REVISION_ID,
  path: `/main/row-${n}`,
  position: n,
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId: PATTERN_ID,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
  ...extra,
});

export const selectorItem = (
  patternKey: string,
  patternVersion: number,
  extra: Partial<SelectorPage['items'][number]> = {},
): SelectorPage['items'][number] => ({
  patternId: PATTERN_ID,
  patternVersionId: id(
    100 +
      patternVersion +
      [...patternKey].reduce(
        (sum, c) => (sum * 31 + c.charCodeAt(0)) % 1_000_000,
        7,
      ) *
        100,
  ),
  patternKey,
  patternVersion,
  nodeCount: 3,
  blockRegistryDigest: 'a'.repeat(64),
  ...extra,
});

export const selectorPage = (
  items: SelectorPage['items'] = [selectorItem('hero-block', 2)],
  nextCursor: string | null = null,
): SelectorPage => ({ items, nextCursor, pageVersion: '7' });

const node = (
  props: Record<string, string>,
  blockKey = 'profile.header',
  children: string[] = [],
) => ({ blockKey, blockVersion: 1, props, children });

export const propsPath = (path = '/hero'): DiffPath => ({
  path,
  base: node({ text: 'a' }),
  theirs: node({ text: 'b' }),
  yours: { text: 'mine' },
  collision: true,
  collisionKind: 'props',
});
export const structurePath = (path = '/body'): DiffPath => ({
  path,
  base: node({}, 'profile.header', ['/body/one']),
  theirs: node({}, 'profile.footer', ['/body/one', '/body/two']),
  yours: null,
  collision: true,
  collisionKind: 'structure',
});
export const removedPath = (path = '/aside'): DiffPath => ({
  path,
  base: node({ text: 'x' }),
  theirs: null,
  yours: null,
  collision: true,
  collisionKind: 'removed_root',
});
export const plainPath = (path = '/note'): DiffPath => ({
  path,
  base: node({ text: 'p' }),
  theirs: node({ text: 'q' }),
  yours: null,
  collision: false,
  collisionKind: null,
});

export const diffOf = (
  n: number,
  paths: readonly DiffPath[],
  extra: Partial<UpdateDiff> = {},
): UpdateDiff => {
  const collisionCount = paths.filter((entry) => entry.collision).length;
  return {
    instance: {
      id: id(n),
      version: '3',
      revisionId: REVISION_ID,
      path: `/main/row-${n}`,
      state: 'pending_diff',
      linkMode: 'linked',
      pinnedPatternVersion: 1,
    },
    slotPath: '/main',
    targetPatternVersion: 2,
    paths: [...paths],
    newRoots: [],
    collisionCount,
    bulkEligible: collisionCount === 0,
    ...extra,
  };
};

export const answers = (
  diff: UpdateDiff,
  ...picks: Array<'yours' | 'theirs'>
): ChoiceMap =>
  Object.fromEntries(
    diff.paths
      .filter((entry) => entry.collision)
      .map((entry, index) => [entry.path, picks[index] ?? 'yours']),
  );
