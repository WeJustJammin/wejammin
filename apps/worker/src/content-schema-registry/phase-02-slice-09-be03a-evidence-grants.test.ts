/**
 * BE03a CMS-03A-15..18 owner capability grant field evidence through the real
 * route: rejected bodies are 422 VALIDATION_FAILED, rejected list queries are
 * 400 INVALID_REQUEST, and neither reaches a port.
 */
import { describe, expect, it } from 'vitest';

import {
  calledPorts,
  harnessFor,
  opFor,
  requestFor,
  sendPatched as send,
  type EvidenceOperationId,
} from './phase-02-slice-09-be03a-evidence-support';

type FieldCase = Readonly<{
  marker: string;
  operationId: EvidenceOperationId;
  title: string;
  rejected: readonly Record<string, unknown>[];
  accepted: readonly Record<string, unknown>[];
}>;

const SUBJECT = 'b2000000-0000-4000-8000-0000000000b2';
const GRANTABLE = [
  'cms.schema_registry.read',
  'cms.schema_designer',
  'cms.template_designer',
  'cms.taxonomy_curator',
  'cms.author',
  'cms.editor',
  'cms.reviewer',
  'cms.reviewer.policy',
  'cms.reviewer.legal',
  'cms.reviewer.security',
  'cms.reviewer.financial',
  'cms.publisher',
  'cms.navigation_editor',
  'cms.media_contributor',
  'cms.media_curator',
];
const NOT_GRANTABLE = [
  'cms.schema_review',
  'cms.schema_review.assign',
  'cms.delivery_review',
  'cms.delivery_review.assign',
  'admin.*',
  'admin.config',
  'cms.*',
  '*',
  'cms.unregistered',
  'CMS.AUTHOR',
  '',
];
const BAD_DATES = [
  '2026-02-30',
  '2026-13-01',
  '2026-00-10',
  '2026-04-31',
  '2027-02-29',
  '2026-1-1',
  '26-01-01',
  '2026-01-01T00:00:00Z',
  '10/08/2026',
  20261008,
  null,
];
const GOOD_DATES = ['2026-10-08', '2028-02-29', '2026-12-30'];
const VERSION_BAD = ['0', '01', '-1', 'a', '', 1, null];
const VERSION_OK = ['1', '12'];
const reasonCases = {
  rejected: [{ reason: '' }, { reason: 'x'.repeat(257) }, { reason: 4 }],
  accepted: [
    { reason: undefined },
    { reason: 'x' },
    { reason: 'x'.repeat(256) },
  ],
};

const CASES: readonly FieldCase[] = [
  {
    marker: '[P2-S09-AC-505]',
    operationId: 'CMS-03A-15',
    title:
      'CapabilityGrantRequest is a strict object containing only subjectPersonId, capability, validThrough and reason and rejects unknown keys, including any owner, grantor or validFrom',
    rejected: [
      { ownerId: SUBJECT },
      { ownerPersonId: SUBJECT },
      { grantorId: SUBJECT },
      { grantorPersonId: SUBJECT },
      { validFrom: '2026-10-02' },
      { expectedVersion: '1' },
      { subjectPersonId: undefined },
      { capability: undefined },
      { validThrough: undefined },
    ],
    accepted: [{}],
  },
  {
    marker: '[P2-S09-AC-506]',
    operationId: 'CMS-03A-15',
    title:
      'subjectPersonId is a UUID and a malformed value is 422 VALIDATION_FAILED',
    rejected: [
      { subjectPersonId: 'not-a-uuid' },
      { subjectPersonId: '' },
      { subjectPersonId: null },
      { subjectPersonId: 9 },
      { subjectPersonId: `${SUBJECT}0` },
    ],
    accepted: [{ subjectPersonId: SUBJECT }],
  },
  {
    marker: '[P2-S09-AC-508]',
    operationId: 'CMS-03A-15',
    title:
      'capability must be a member of the closed GrantableCmsCapability registry',
    rejected: [
      { capability: 'cms.unregistered' },
      { capability: null },
      { capability: 3 },
    ],
    accepted: GRANTABLE.map((capability) => ({ capability })),
  },
  {
    marker: '[P2-S09-AC-509]',
    operationId: 'CMS-03A-15',
    title:
      'refuses cms.schema_review, cms.schema_review.assign, cms.delivery_review, cms.delivery_review.assign, any admin.* key, a wildcard and an unregistered key with 422',
    rejected: NOT_GRANTABLE.map((capability) => ({ capability })),
    accepted: [{ capability: 'cms.author' }],
  },
  {
    marker: '[P2-S09-AC-511]',
    operationId: 'CMS-03A-15',
    title:
      'validThrough is a YYYY-MM-DD string that is a real calendar date read as a UTC date',
    rejected: BAD_DATES.map((validThrough) => ({ validThrough })),
    accepted: GOOD_DATES.map((validThrough) => ({ validThrough })),
  },
  {
    marker: '[P2-S09-AC-547]',
    operationId: 'CMS-03A-16',
    title:
      'CapabilityGrantRenewalRequest is a strict object containing only expectedVersion, validThrough and reason and rejects unknown keys',
    rejected: [
      { subjectPersonId: SUBJECT },
      { capability: 'cms.author' },
      { grantId: SUBJECT },
      { validFrom: '2026-10-02' },
      { expectedVersion: undefined },
      { validThrough: undefined },
    ],
    accepted: [{}],
  },
  {
    marker: '[P2-S09-AC-576]',
    operationId: 'CMS-03A-17',
    title:
      'CapabilityGrantRevocationRequest is a strict object containing only expectedVersion and reason and rejects unknown keys',
    rejected: [
      { validThrough: '2026-10-08' },
      { subjectPersonId: SUBJECT },
      { grantId: SUBJECT },
      { expectedVersion: undefined },
    ],
    accepted: [{}],
  },
  {
    marker: '[P2-S09-AC-550]',
    operationId: 'CMS-03A-16',
    title: 'validThrough is a real calendar UTC date',
    rejected: BAD_DATES.map((validThrough) => ({ validThrough })),
    accepted: GOOD_DATES.map((validThrough) => ({ validThrough })),
  },
  {
    marker: '[P2-S09-AC-548]',
    operationId: 'CMS-03A-16',
    title: 'expectedVersion is a positive decimal string',
    rejected: VERSION_BAD.map((expectedVersion) => ({ expectedVersion })),
    accepted: VERSION_OK.map((expectedVersion) => ({ expectedVersion })),
  },
  {
    marker: '[P2-S09-AC-577]',
    operationId: 'CMS-03A-17',
    title: 'expectedVersion is a positive decimal string',
    rejected: VERSION_BAD.map((expectedVersion) => ({ expectedVersion })),
    accepted: VERSION_OK.map((expectedVersion) => ({ expectedVersion })),
  },
  {
    marker: '[P2-S09-AC-514]',
    operationId: 'CMS-03A-15',
    title: 'reason is optional with 1 to 256 characters',
    ...reasonCases,
  },
  {
    marker: '[P2-S09-AC-551]',
    operationId: 'CMS-03A-16',
    title: 'reason is optional with 1 to 256 characters',
    ...reasonCases,
  },
  {
    marker: '[P2-S09-AC-579]',
    operationId: 'CMS-03A-17',
    title: 'reason is optional with 1 to 256 characters',
    ...reasonCases,
  },
];

describe('BE03a owner grant request-body field rules through the route', () => {
  it.each(CASES)(
    '$marker $operationId $title',
    async ({ operationId, rejected, accepted }) => {
      for (const patch of rejected) {
        const { harness, response } = await send(operationId, patch);
        expect(
          response.status,
          `${operationId} must refuse ${JSON.stringify(patch)}`,
        ).toBe(422);
        expect(((await response.json()) as { code: string }).code).toBe(
          'VALIDATION_FAILED',
        );
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const patch of accepted) {
        const { op, harness, body, response } = await send(operationId, patch);
        expect(
          response.status,
          `${operationId} must accept ${JSON.stringify(patch)}`,
        ).toBe(op.status);
        expect(harness.ports[op.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ body }),
          expect.any(AbortSignal),
        );
      }
    },
  );
});

const LIST = opFor('CMS-03A-18');
const listRequest = (query: string): Request =>
  requestFor(LIST, { path: `${LIST.path}${query}` });

type QueryCase = Readonly<{
  marker: string;
  title: string;
  /**
   * BE03a matrix: 400 INVALID_REQUEST for a malformed query (unknown or
   * repeated key) or a malformed cursor, 422 VALIDATION_FAILED for a filter,
   * sort or page validation failure.
   */
  refusal: 400 | 422;
  rejected: readonly string[];
  accepted: ReadonlyArray<readonly [query: string, forwarded: object]>;
}>;

const defaults = { limit: 25, sort: 'updatedAt', direction: 'desc' };

const QUERY_CASES: readonly QueryCase[] = [
  {
    marker: '[P2-S09-AC-604]',
    refusal: 400,
    title:
      'CmsCapabilityGrantListQuery is a strict object and rejects unknown query keys',
    rejected: [
      '?unknown=1',
      '?owner=x',
      '?organizationId=x',
      '?offset=0',
      '?Limit=5',
    ],
    accepted: [['', defaults]],
  },
  {
    marker: '[P2-S09-AC-605]',
    refusal: 422,
    title: 'subjectPersonId is an optional UUID filter',
    rejected: [
      '?subjectPersonId=not-a-uuid',
      '?subjectPersonId=',
      `?subjectPersonId=${SUBJECT}0`,
    ],
    accepted: [
      [
        `?subjectPersonId=${SUBJECT}`,
        { ...defaults, subjectPersonId: SUBJECT },
      ],
    ],
  },
  {
    marker: '[P2-S09-AC-606]',
    refusal: 422,
    title: 'capability is an optional member of the grantable capability set',
    rejected: [
      '?capability=cms.schema_review',
      '?capability=admin.*',
      '?capability=',
      '?capability=cms.nope',
    ],
    accepted: GRANTABLE.map(
      (capability) =>
        [`?capability=${capability}`, { ...defaults, capability }] as const,
    ),
  },
  {
    marker: '[P2-S09-AC-607]',
    refusal: 422,
    title: 'state is an optional filter of active, lapsed or revoked',
    rejected: ['?state=pending', '?state=ACTIVE', '?state=', '?state=expired'],
    accepted: ['active', 'lapsed', 'revoked'].map(
      (state) => [`?state=${state}`, { ...defaults, state }] as const,
    ),
  },
  {
    marker: '[P2-S09-AC-608]',
    refusal: 422,
    title: 'limit is an integer from 1 to 100 with default 25',
    rejected: [
      '?limit=0',
      '?limit=101',
      '?limit=-1',
      '?limit=2.5',
      '?limit=abc',
      '?limit=',
    ],
    accepted: [
      ['', defaults],
      ['?limit=1', { ...defaults, limit: 1 }],
      ['?limit=100', { ...defaults, limit: 100 }],
    ],
  },
  {
    marker: '[P2-S09-AC-609]',
    refusal: 400,
    title: 'cursor is an optional opaque string of 1 to 512 characters',
    rejected: [`?cursor=${'a'.repeat(513)}`, '?cursor='],
    accepted: [
      ['?cursor=a', { ...defaults, cursor: 'a' }],
      [`?cursor=${'a'.repeat(512)}`, { ...defaults, cursor: 'a'.repeat(512) }],
      ['?cursor=abc_DEF-123', { ...defaults, cursor: 'abc_DEF-123' }],
    ],
  },
  {
    marker: '[P2-S09-AC-610]',
    refusal: 422,
    title: 'sort is updatedAt or validThrough with default updatedAt',
    rejected: [
      '?sort=createdAt',
      '?sort=UPDATEDAT',
      '?sort=',
      '?sort=subjectPersonId',
    ],
    accepted: [
      ['', defaults],
      ['?sort=validThrough', { ...defaults, sort: 'validThrough' }],
      ['?sort=updatedAt', defaults],
    ],
  },
  {
    marker: '[P2-S09-AC-611]',
    refusal: 422,
    title: 'direction is asc or desc with default desc',
    rejected: [
      '?direction=up',
      '?direction=ASC',
      '?direction=',
      '?direction=sideways',
    ],
    accepted: [
      ['', defaults],
      ['?direction=asc', { ...defaults, direction: 'asc' }],
      ['?direction=desc', defaults],
    ],
  },
];

describe('BE03a CMS-03A-18 list query', () => {
  it.each(QUERY_CASES)(
    '$marker CMS-03A-18 $title',
    async ({ refusal, rejected, accepted }) => {
      for (const query of rejected) {
        const harness = harnessFor(LIST);
        const response = await harness.app.request(listRequest(query));
        expect(response.status, `must refuse ${query}`).toBe(refusal);
        expect(((await response.json()) as { code: string }).code).toBe(
          refusal === 400 ? 'INVALID_REQUEST' : 'VALIDATION_FAILED',
        );
        expect(calledPorts(harness.ports)).toBe(0);
      }
      for (const [query, forwarded] of accepted) {
        const harness = harnessFor(LIST);
        const response = await harness.app.request(listRequest(query));
        expect(response.status, `must accept ${query}`).toBe(200);
        expect(harness.ports[LIST.portName]).toHaveBeenCalledWith(
          expect.objectContaining({ query: forwarded }),
          expect.any(AbortSignal),
        );
      }
    },
  );
});
