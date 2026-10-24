import { describe, expect, it } from 'vitest';
import {
  CmsCompositionRefusalDetailsSchema,
  type TaxonomyTermResource,
} from '@wejammin/contracts';

import { patternUpdateDetails } from './pattern-update-details';
import { safeDetails } from './taxonomy-safe-details';
import { taxonomyTermDetails } from './taxonomy-term-details';
import {
  createCmsTaxonomyApp,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
} from './taxonomy-routes';

/**
 * BE03c 1304 and `CMS_SLICE_12_OPERATION_REASONS['CMS-03C-03']`: a CMS-03C-03 refusal carries exactly one lowercase
 * reason token of its own list, on the one status the token keeps, with only the members the token names
 * (`canonical_overlap`: domain and canonicalId; `canonical_source_unavailable`: domain).
 */
const taxonomyId = 'd1200000-0000-4000-8000-000000000001';
const termId = 'd1200000-0000-4000-8000-000000000002';
const canonicalId = 'd1200000-0000-4000-8000-0000000000aa';
const origin = 'https://cms.example.test';
const path = `/api/v1/cms/taxonomies/${taxonomyId}/terms/actions`;
const body = {
  taxonomyId,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: [],
  expectedVersion: '1',
} as const;
const resource: TaxonomyTermResource = {
  id: termId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T04:00:00.000Z',
  updatedAt: '2026-09-28T04:00:00.000Z',
  lifecycle: 'active',
  taxonomyId,
  termId,
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
};

const deps = (
  actTerm: CmsTaxonomyDependencies['actTerm'],
  capabilities: readonly string[] = ['cms.taxonomy_curator'],
): CmsTaxonomyDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1200000-0000-4000-8000-000000000003',
      actingPartyId: 'd1200000-0000-4000-8000-000000000004',
      capabilities,
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: { allowed: true, limit: input.limit, remaining: 1, resetAt: 2_000 },
  }),
  actTerm,
  telemetry: () => undefined,
});

const post = (app: ReturnType<typeof createCmsTaxonomyApp>) =>
  app.request(
    new Request(`https://api.example.test${path}`, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'taxonomy-action-0001',
        'if-match': '"1"',
      },
      body: JSON.stringify(body),
    }),
  );

const refusal = (
  status: CmsTaxonomyError['status'],
  details: Record<string, unknown>,
): CmsTaxonomyError => ({
  ok: false,
  status,
  code: 'UNTRUSTED',
  message: 'provider prose must not escape',
  details,
});

const detailsOf = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { details: unknown }).details;

describe('CMS-03C-03 typed refusals on the wire', () => {
  it('the Worker capability gate publishes the contract token capability_missing', async () => {
    const response = await post(
      createCmsTaxonomyApp(
        deps(async () => ({ ok: true, value: resource }), ['cms.editor']),
      ),
    );
    expect(response.status).toBe(403);
    const details = await detailsOf(response);
    expect(details).toEqual({ reasonCode: 'capability_missing' });
    expect(CmsCompositionRefusalDetailsSchema.safeParse(details).success).toBe(
      true,
    );
  });

  it.each([
    [403, { reasonCode: 'capability_missing' }],
    [409, { reasonCode: 'taxonomy_not_active' }],
    [422, { reasonCode: 'canonical_overlap', domain: 'role', canonicalId }],
    [422, { reasonCode: 'canonical_source_unavailable', domain: 'role' }],
  ] as const)(
    'relays %i %j exactly and nothing else',
    async (status, typed) => {
      const response = await post(
        createCmsTaxonomyApp(
          deps(async () =>
            refusal(status, {
              ...typed,
              privateLabel: 'Secret',
              violations: [],
            }),
          ),
        ),
      );
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(text).not.toContain('Secret');
      const details = (JSON.parse(text) as { details: unknown }).details;
      expect(details).toEqual(typed);
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(details).success,
      ).toBe(true);
    },
  );

  it.each([
    // a token on a status it does not keep
    [409, { reasonCode: 'capability_missing' }],
    [403, { reasonCode: 'taxonomy_not_active' }],
    [422, { reasonCode: 'taxonomy_not_active' }],
    // a token CMS-03C-03 does not publish
    [409, { reasonCode: 'revision_not_editable' }],
    [422, { reasonCode: 'key_reserved' }],
    // the mandatory members are missing or not valid
    [422, { reasonCode: 'canonical_overlap', domain: 'role' }],
    [422, { reasonCode: 'canonical_overlap', domain: 'nope', canonicalId }],
    [
      422,
      { reasonCode: 'canonical_overlap', domain: 'role', canonicalId: 'x' },
    ],
    [422, { reasonCode: 'canonical_source_unavailable' }],
    [422, { reasonCode: 'canonical_source_unavailable', domain: 'nope' }],
    // the former uppercase route token is not a contract token
    [403, { reasonCode: 'CAPABILITY_REQUIRED' }],
  ] as const)('drops %i %j', async (status, details) => {
    const response = await post(
      createCmsTaxonomyApp(deps(async () => refusal(status, details))),
    );
    expect(response.status).toBe(status);
    expect(await detailsOf(response)).toEqual({});
  });

  it('keeps the plain 409 versions and 422 pointers alongside the typed reasons', async () => {
    const conflict = await post(
      createCmsTaxonomyApp(
        deps(async () =>
          refusal(409, { expectedVersion: '1', currentVersion: '4' }),
        ),
      ),
    );
    expect(await detailsOf(conflict)).toEqual({
      expectedVersion: '1',
      currentVersion: '4',
    });
    const invalid = await post(
      createCmsTaxonomyApp(
        deps(async () =>
          refusal(422, {
            violations: [{ path: '/parentId', code: 'invalid', message: 'x' }],
          }),
        ),
      ),
    );
    expect(await detailsOf(invalid)).toEqual({
      violations: [
        {
          path: '/parentId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });
});

describe('the shared BE00 allowlist names no 403 token', () => {
  it('safeDetails relays {} for every 403 (BE03c 1304: each 03c operation publishes its own capability_missing)', () => {
    expect(safeDetails(403, { reasonCode: 'CAPABILITY_REQUIRED' })).toEqual({});
    expect(safeDetails(403, { reasonCode: 'capability_missing' })).toEqual({});
    expect(safeDetails(403, { reasonCode: 'other' })).toEqual({});
    expect(
      taxonomyTermDetails(403, { reasonCode: 'CAPABILITY_REQUIRED' }),
    ).toEqual({});
  });

  // `taxonomyTermDetails` falls through to `safeDetails` for a 403 that carries no typed reason, so it needs no 403
  // branch of its own: every member any other status relays (violations, the version pair, rate members, the
  // dependency members, the media-type and reauthentication hints) is dropped for a 403 by the shared allowlist.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['text', 'forbidden'],
    ['a number', 403],
    ['an array', [{ reasonCode: 'capability_missing' }]],
    ['an empty object', {}],
    [
      'violations',
      { violations: [{ path: '/name', code: 'invalid', message: 'x' }] },
    ],
    ['the version pair', { expectedVersion: '3', currentVersion: '4' }],
    ['rate members', { retryAfterSeconds: 5, limit: 3, resetAt: '1234' }],
    ['dependency members', { dependencyClass: 'x', retryable: true }],
    ['a recovery hint', { recoveryAction: 'reauthenticate' }],
    ['a media-type hint', { allowedMediaTypes: ['application/json'] }],
  ])('relays {} for a 403 whose source is %s', (_label, source) => {
    expect(safeDetails(403, source)).toEqual({});
    expect(taxonomyTermDetails(403, source)).toEqual({});
  });
});

/**
 * `patternUpdateDetails` routes every 403 to `forbiddenDetails` first (`pattern-update-details.ts`), so CMS-03C-13/-14/-15
 * do not depend on the shared allowlist's 403 handling; the shared layer is asserted here only so that a 403 can never
 * be relayed by either path. BE03c 1323 gives a 403 only the typed `capability_missing` token, which the operation
 * filter relays; an untyped 403 (the pre-contract upper-case token, a foreign member, no token) must relay `{}` both at
 * this layer and through each operation.
 */
describe.each(['CMS-03C-13', 'CMS-03C-14', 'CMS-03C-15'] as const)(
  '%s untyped 403',
  (operation) => {
    it.each([
      [
        'the pre-contract upper-case token',
        { reasonCode: 'CAPABILITY_REQUIRED' },
      ],
      ['a foreign member', { reasonCode: 'other', secret: 'private' }],
      ['no token', { secret: 'private' }],
    ])('relays {} for %s', (_label, source) => {
      expect(safeDetails(403, source)).toEqual({});
      expect(patternUpdateDetails(operation, 403, source)).toEqual({});
    });
  },
);
