import { vi } from 'vitest';

import {
  HASH,
  PATTERN_ID,
  ROW_ID,
  TYPE_ID,
} from '../../server/cms-pattern-platform.test-support';
import type { PatternDesignerContext } from './pattern-designer-request';
import type { PatternSubmitResult } from './pattern-designer-submit';
import type { PatternLatestDetail } from './pattern-latest-read';

export const TYPE_B = '30000000-0000-4000-8000-000000000004';
export const CSRF_TOKEN = 'csrf-token-000000000001';

export const designerContext: PatternDesignerContext = {
  contentTypes: [
    { id: TYPE_ID, typeKey: 'profile' },
    { id: TYPE_B, typeKey: 'release' },
  ],
  registeredBlocks: [
    { blockKey: 'profile.header', blockVersion: 1 },
    { blockKey: 'profile.text', blockVersion: 3 },
  ],
};

export const latestDetail = (
  overrides: Partial<PatternLatestDetail> = {},
): PatternLatestDetail => ({
  id: ROW_ID,
  version: '2',
  contentHash: HASH,
  state: 'draft',
  patternKey: 'profile-hero',
  patternVersion: 2,
  compatibleTypeIds: [TYPE_ID],
  nodeCount: 2,
  blockRegistryDigest: 'b'.repeat(64),
  blockTree: [
    {
      kind: 'block',
      key: 'hero',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: { title: 'Hello' },
      children: [
        {
          kind: 'block',
          key: 'title',
          blockKey: 'profile.text',
          blockVersion: 3,
          props: {},
          children: [],
        },
      ],
    },
  ],
  ...overrides,
});

export const nestedReferenceTree = (): PatternLatestDetail['blockTree'] => [
  { kind: 'pattern', key: 'shared', patternId: PATTERN_ID, patternVersion: 2 },
];

/** A recorded submit seam answering the queued results in order. */
export const submitStub = (...results: PatternSubmitResult[]) => {
  const queue = [...results];
  return vi.fn(async () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('unexpected submit');
    return next;
  });
};

export const createdResult = (
  overrides: Partial<
    Extract<PatternSubmitResult, { kind: 'created' }>['resource']
  > = {},
): PatternSubmitResult => ({
  kind: 'created',
  resource: {
    id: ROW_ID,
    patternKey: 'profile-hero',
    patternVersion: 1,
    version: '1',
    nodeCount: 1,
    blockRegistryDigest: 'c'.repeat(64),
    ...overrides,
  },
});
