import type {
  CompositionDiffNodeValue,
  CompositionInstanceResource,
  CompositionUpdateDiffResource,
  CompositionUpdateRequest,
  CompositionUpdateResource,
  PatternSelectorItem,
  PatternSelectorPage,
} from '@wejammin/contracts';

/**
 * Wire fixtures for the linked-update transport (CMS-03C-13/14/15; BE03c 175-177, 1363, 1367). Every value is
 * schema-valid and shaped like what the SQL lane answers (`supabase/migrations/20261014140000` through `20261014140610`): the selector page
 * of active compatible versions, the three-way diff of one instance and the appended rows of an accept or detach.
 */
export const PU_ORIGIN = 'https://cms.example.test';
export const PU_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const PU_HASH = 'a'.repeat(64);
export const puId = (n: number): string =>
  `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const PU_TYPE_ID = puId(1);
export const PU_USER_ID = puId(2);
export const PU_PARTY_ID = puId(3);
export const PU_REVISION_ID = puId(4);
export const PU_INSTANCE_ID = puId(100);
export const PU_SELECTOR_PATH = '/api/v1/cms/patterns/selector';
export const PU_UPDATE_PATH = '/api/v1/cms/compositions/pattern-updates';
export const puDiffPath = (instanceId: string = PU_INSTANCE_ID): string =>
  `/api/v1/cms/compositions/instances/${instanceId}/update-diff`;

/** The item `index` of a selector page: keys ascend, versions descend within a key. */
export const selectorItem = (
  index: number,
  overrides: Partial<PatternSelectorItem> = {},
): PatternSelectorItem => ({
  patternId: puId(200 + index),
  patternVersionId: puId(300 + index),
  patternKey: `pattern-${String(index).padStart(3, '0')}`,
  patternVersion: 2,
  nodeCount: 3,
  blockRegistryDigest: PU_HASH,
  ...overrides,
});

export const selectorPage = (
  count = 2,
  overrides: Partial<PatternSelectorPage> = {},
): PatternSelectorPage => ({
  items: Array.from({ length: count }, (_, index) => selectorItem(index + 1)),
  nextCursor: null,
  pageVersion: '1790000000000000',
  ...overrides,
});

export const diffNodeValue = (
  props: CompositionDiffNodeValue['props'] = {},
  children: string[] = [],
): CompositionDiffNodeValue => ({
  blockKey: 'profile.block',
  blockVersion: 1,
  props,
  children,
});

export const diffResource = (
  overrides: Partial<CompositionUpdateDiffResource> = {},
): CompositionUpdateDiffResource => ({
  instance: {
    id: PU_INSTANCE_ID,
    version: '3',
    revisionId: PU_REVISION_ID,
    path: '/main/hero',
    state: 'active',
    linkMode: 'linked',
    pinnedPatternVersion: 1,
  },
  slotPath: '/main',
  targetPatternVersion: 2,
  paths: [
    {
      path: '/hero',
      base: diffNodeValue({ title: 'Old' }),
      theirs: diffNodeValue({ title: 'New' }),
      yours: null,
      collision: false,
      collisionKind: null,
    },
  ],
  newRoots: [],
  collisionCount: 0,
  bulkEligible: true,
  ...overrides,
});

/** A structural collision plus a separate target root awaiting placement. */
export const structuralDiffResource = (): CompositionUpdateDiffResource =>
  diffResource({
    paths: [
      {
        path: '/hero',
        base: diffNodeValue({ title: 'Old' }),
        theirs: diffNodeValue({ title: 'New' }, ['/hero/cta']),
        yours: null,
        collision: true,
        collisionKind: 'structure',
      },
    ],
    newRoots: [
      { rootPath: '/shared/new', blockKey: 'profile.block', blockVersion: 2 },
    ],
    collisionCount: 1,
    bulkEligible: false,
  });

/** The empty diff of an instance with no newer version (DEC-180 G4): target = pinned. */
export const emptyDiff = (): CompositionUpdateDiffResource =>
  diffResource({
    targetPatternVersion: 1,
    paths: [],
    collisionCount: 0,
    bulkEligible: false,
  });

/** The appended row of an accept (`linked`, pinned to the target) or detach (`detached`). */
export const updateRow = (
  index: number,
  overrides: Partial<CompositionInstanceResource> = {},
): CompositionInstanceResource => ({
  id: puId(400 + index),
  version: '4',
  contentHash: PU_HASH,
  createdAt: '2026-10-15T08:00:00Z',
  updatedAt: '2026-10-15T08:00:00Z',
  state: 'active',
  revisionId: PU_REVISION_ID,
  path: `/main/root${index}`,
  position: index,
  blockKey: 'profile.block',
  blockVersion: 1,
  patternId: puId(200),
  patternVersion: 2,
  blockRegistryDigest: PU_HASH,
  linkMode: 'linked',
  conflictState: 'none',
  ...overrides,
});

export const acceptBody = (
  count = 1,
  overrides: Partial<
    Extract<CompositionUpdateRequest, { action: 'accept' }>
  > = {},
): CompositionUpdateRequest => ({
  action: 'accept',
  targetPatternVersion: 2,
  instances: Array.from({ length: count }, (_, index) => ({
    instanceId: puId(100 + index),
    expectedVersion: '3',
    choices: [],
  })),
  expectedVersion: '7',
  ...overrides,
});

export const detachBody = (count = 1): CompositionUpdateRequest => ({
  action: 'detach',
  instances: Array.from({ length: count }, (_, index) => ({
    instanceId: puId(100 + index),
    expectedVersion: '3',
    choices: [],
  })),
  expectedVersion: '7',
});

/** The 200 body of an accept: one appended row per instance (version 3 -> 4), pinned to version 2. */
export const acceptResource = (count = 1): CompositionUpdateResource => ({
  items: Array.from({ length: count }, (_, index) => updateRow(index)),
});

/** Structural `yours` or removed-root `theirs`, both resolved at /root0. */
export const resolvedAcceptBody = (
  choice: 'yours' | 'theirs',
): CompositionUpdateRequest =>
  acceptBody(1, {
    instances: [
      {
        instanceId: PU_INSTANCE_ID,
        expectedVersion: '3',
        choices: [{ path: '/root0', choice }],
      },
    ],
  });

/** Both DEC-193 outcomes retain pin 1; target version 2 lacks their tree/root. */
export const resolvedAcceptResource = (
  choice: 'yours' | 'theirs',
): CompositionUpdateResource => ({
  items: [
    updateRow(0, {
      state: choice === 'yours' ? 'active' : 'retired',
      linkMode: choice === 'yours' ? 'detached' : 'linked',
      patternVersion: 1,
    }),
  ],
});

export const detachResource = (count = 1): CompositionUpdateResource => ({
  items: Array.from({ length: count }, (_, index) =>
    updateRow(index, { linkMode: 'detached', patternVersion: 1 }),
  ),
});

/** The committed entry aggregate ETag of the accept/detach above (If-Match "7" + 1). */
export const PU_ENTRY_ETAG = '"8"';
