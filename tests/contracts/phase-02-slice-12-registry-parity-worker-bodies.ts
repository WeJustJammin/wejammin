import {
  concretePath,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-types';
import { CMS_ORIGIN } from './phase-02-slice-12-registry-parity-worker.test-support';

/*
 * Minimal contract-valid requests for every Slice 12 operation, so a request passes the Worker's
 * strict path, query, header and body checks and reaches the quota step (BE00 step 7). The ids in
 * a body equal the ids of the path sample (`concretePath`). No value here is a secret or a real
 * identifier.
 */

const ID = (n: number): string =>
  `d6000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const HASH = 'a'.repeat(64);
const ENTRY = 'd2000000-0000-4000-8000-000000000001';
const TAXONOMY = 'd1200000-0000-4000-8000-000000000001';
const REVIEW = 'd3000000-0000-4000-8000-000000000001';

const BODIES: Readonly<
  Record<string, Readonly<{ body: unknown; ifMatch?: string }>>
> = {
  'CMS-03C-01': {
    body: {
      templateKey: 'profile-header',
      compatibleTypeIds: [ID(1)],
      slots: [
        {
          key: 'header',
          required: true,
          allowedBlocks: [{ blockKey: 'profile.header', blockVersion: 1 }],
          maxCount: 1,
        },
      ],
      reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
      bindings: { title: { projection: 'profile.title', required: true } },
      locale: 'en-US',
      audience: 'public',
      blockRegistryDigest: HASH,
      expectedVersion: null,
    },
  },
  'CMS-03C-02': {
    body: {
      revisionId: ID(2),
      patternId: ID(3),
      patternVersion: 1,
      linkMode: 'linked',
      slotPath: '/main',
      overrides: {},
      expectedVersion: '1',
    },
    ifMatch: '"1"',
  },
  'CMS-03C-03': {
    body: {
      taxonomyId: TAXONOMY,
      action: 'create',
      termKey: 'jazz-fusion',
      parentId: null,
      survivorId: null,
      labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
      aliases: ['fusion'],
      expectedVersion: '7',
    },
    ifMatch: '"7"',
  },
  'CMS-03C-04': {
    body: {
      entryId: ENTRY,
      locale: 'fr-FR',
      sourceRevisionId: ID(4),
      fields: [{ fieldId: ID(5), value: 'Titre traduit' }],
      fallbackChain: ['en-US'],
      noFallbackFieldIds: [],
      sourceHash: HASH,
      expectedVersion: '1',
    },
    ifMatch: '"1"',
  },
  'CMS-03C-05': {
    body: {
      entryId: ENTRY,
      pins: [ID(6)],
      exclusions: [ID(7)],
      derivedRule: {
        key: 'similar-genre',
        version: '2',
        reasonCode: 'genre_match',
        maxCandidates: 20,
      },
      expectedVersion: '1',
    },
    ifMatch: '"1"',
  },
  'CMS-03C-06': {
    body: {
      subjectKind: 'template_version',
      subjectId: ID(8),
      subjectHash: HASH,
    },
  },
  'CMS-03C-07': {
    body: {
      reviewId: REVIEW,
      decision: 'approve',
      reason: 'Meets the template review checklist.',
      expectedVersion: '3',
    },
    ifMatch: '"3"',
  },
  'CMS-03C-08': {
    body: {
      action: 'create',
      expectedVersion: '3',
      reviewerPersonId: ID(9),
      expiresAt: '2026-10-15T00:00:00Z',
      reason: 'Primary reviewer.',
    },
    ifMatch: '"3"',
  },
  'CMS-03C-09': {
    body: { action: 'activate', expectedVersion: '3' },
    ifMatch: '"3"',
  },
  'CMS-03C-12': {
    body: {
      patternKey: 'hero-pattern',
      compatibleTypeIds: [ID(1)],
      blockTree: [
        {
          kind: 'block',
          key: 'header',
          blockKey: 'profile.header',
          blockVersion: 1,
          props: {},
          children: [],
        },
      ],
      expectedVersion: null,
    },
  },
  'CMS-03C-15': {
    body: {
      action: 'accept',
      targetPatternVersion: 2,
      instances: [{ instanceId: ID(10), expectedVersion: '3', choices: [] }],
      expectedVersion: '7',
    },
    ifMatch: '"7"',
  },
  'CMS-03C-16': {
    body: {
      taxonomyKey: 'instrument-tags',
      shape: 'flat',
      allowedTypeKeys: ['article'],
      allowedFieldKeys: ['instruments'],
      canonicalOverlapDomains: ['instrument'],
      expectedVersion: null,
    },
  },
};

const QUERIES: Readonly<Record<string, string>> = {
  'CMS-03C-13': `?contentTypeId=${ID(1)}`,
  cmsPatternNestableRead: `?contentTypeId=${ID(1)}&contentTypeId=${ID(2)}`,
  'CMS-03C-17': '?typeKey=article&fieldKey=instruments&locale=en-US',
};

/** A request that is valid up to the quota step, from an allowed origin. */
export const quotaRequestFor = (expected: SpecOperation): Request => {
  const url = `https://api.example.test${concretePath(expected.path)}${QUERIES[expected.id] ?? ''}`;
  if (expected.method === 'GET')
    return new Request(url, { headers: { origin: CMS_ORIGIN } });
  const sample = BODIES[expected.id];
  if (sample === undefined)
    throw new Error(`No sample body for ${expected.id}.`);
  return new Request(url, {
    method: 'POST',
    headers: {
      origin: CMS_ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': 'parity-key-0001',
      ...(sample.ifMatch === undefined ? {} : { 'if-match': sample.ifMatch }),
    },
    body: JSON.stringify(sample.body),
  });
};
