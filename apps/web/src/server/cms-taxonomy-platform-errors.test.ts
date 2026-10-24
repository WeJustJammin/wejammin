import { describe, expect, it } from 'vitest';
import {
  relayTaxonomyError,
  taxonomyLocalError,
} from './cms-taxonomy-platform-errors';
import {
  CANONICAL_ID,
  jsonResponse,
  readRequest,
  taxonomyApiError,
  VERSIONS_PATH,
  type TaxonomyOperationId,
} from './cms-taxonomy-platform.test-support';

const request = readRequest(VERSIONS_PATH);
const relay = (
  operation: TaxonomyOperationId,
  status: number,
  details: Readonly<Record<string, unknown>> = {},
  headers: Readonly<Record<string, string>> = {},
) =>
  relayTaxonomyError(
    request,
    jsonResponse(status, taxonomyApiError(operation, status, details), headers),
    operation,
  );
const detailsOf = async (response: Response) =>
  ((await response.json()) as { details: Record<string, unknown> }).details;

describe('taxonomy catalog: relay-local refusals', () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [400, 'INVALID_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'TAXONOMY_FORBIDDEN'],
    [404, 'TAXONOMY_NOT_FOUND'],
    [409, 'TAXONOMY_VERSION_CONFLICT'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'TAXONOMY_VALIDATION_FAILED'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'DEPENDENCY_UNAVAILABLE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
    [504, 'DEPENDENCY_UNAVAILABLE'],
  ];
  it.each(cases)(
    'speaks the taxonomy code of status %i',
    async (status, code) => {
      const response = taxonomyLocalError(request, 'CMS-03C-16', status);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = (await response.json()) as { code: string; message: string };
      expect(body.code).toBe(code);
      expect(body.message).toBe(
        `${code}: taxonomy operation rejected or unavailable.`,
      );
    },
  );

  it.each([502, 503, 504])(
    'marks a local %i retryable (BE00 172)',
    async (status) => {
      expect(
        await detailsOf(taxonomyLocalError(request, 'CMS-03C-03', status)),
      ).toEqual({ dependencyClass: 'cms_composition', retryable: true });
    },
  );

  it('advises a wait on 429, 503 and 504 only', () => {
    expect(
      taxonomyLocalError(request, 'CMS-03C-16', 429).headers.get('retry-after'),
    ).toBe('5');
    expect(
      taxonomyLocalError(request, 'CMS-03C-16', 503).headers.get('retry-after'),
    ).toBe('5');
    expect(
      taxonomyLocalError(request, 'CMS-03C-16', 504).headers.get('retry-after'),
    ).toBe('5');
    expect(
      taxonomyLocalError(request, 'CMS-03C-16', 502).headers.get('retry-after'),
    ).toBeNull();
  });

  it('carries the 415 media hint and the caller-given details', async () => {
    expect(
      await detailsOf(taxonomyLocalError(request, 'CMS-03C-16', 415)),
    ).toEqual({
      allowedMediaTypes: ['application/json'],
    });
    expect(
      await detailsOf(
        taxonomyLocalError(request, 'CMS-03C-16', 422, { reasonCode: 'x' }),
      ),
    ).toEqual({ reasonCode: 'x' });
  });
});

describe('taxonomy relay: typed refusals', () => {
  it('relays capability_missing on a 403 of every operation', async () => {
    for (const operation of [
      'CMS-03C-16',
      'CMS-03C-03',
      'CMS-03C-17',
      'cmsTaxonomyVersionsRead',
      'cmsTaxonomyTermsRead',
    ] as const)
      expect(
        await detailsOf(
          await relay(operation, 403, { reasonCode: 'capability_missing' }),
        ),
      ).toEqual({ reasonCode: 'capability_missing' });
  });

  it('drops a 403 reason that is not capability_missing, and the pre-contract token', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 403, { reasonCode: 'CAPABILITY_REQUIRED' }),
      ),
    ).toEqual({});
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 403, { reasonCode: 'separation_of_duties' }),
      ),
    ).toEqual({});
  });

  it('relays taxonomy_not_active on a 409 of CMS-03C-03 only', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 409, { reasonCode: 'taxonomy_not_active' }),
      ),
    ).toEqual({ reasonCode: 'taxonomy_not_active' });
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 409, { reasonCode: 'taxonomy_not_active' }),
      ),
    ).toEqual({});
  });

  it('relays canonical_overlap with its domain and canonical id and nothing else', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 422, {
          reasonCode: 'canonical_overlap',
          domain: 'role',
          canonicalId: CANONICAL_ID,
          label: 'Guitarist',
          violations: [{ path: '/labels', code: 'x', message: 'Guitarist' }],
        }),
      ),
    ).toEqual({
      reasonCode: 'canonical_overlap',
      domain: 'role',
      canonicalId: CANONICAL_ID,
    });
  });

  it.each([
    [
      'no domain',
      { reasonCode: 'canonical_overlap', canonicalId: CANONICAL_ID },
    ],
    [
      'an unknown domain',
      {
        reasonCode: 'canonical_overlap',
        domain: 'planet',
        canonicalId: CANONICAL_ID,
      },
    ],
    ['no canonical id', { reasonCode: 'canonical_overlap', domain: 'role' }],
    [
      'a malformed canonical id',
      { reasonCode: 'canonical_overlap', domain: 'role', canonicalId: 'x' },
    ],
    [
      'no domain on source unavailable',
      { reasonCode: 'canonical_source_unavailable' },
    ],
  ])('drops a typed refusal with %s', async (_name, upstream) => {
    expect(await detailsOf(await relay('CMS-03C-03', 422, upstream))).toEqual(
      {},
    );
  });

  it('relays canonical_source_unavailable with its domain', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 422, {
          reasonCode: 'canonical_source_unavailable',
          domain: 'gear',
          extra: 1,
        }),
      ),
    ).toEqual({ reasonCode: 'canonical_source_unavailable', domain: 'gear' });
  });

  it('drops a token on the wrong status, from another operation, or unknown', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 409, {
          reasonCode: 'canonical_overlap',
          domain: 'role',
          canonicalId: CANONICAL_ID,
        }),
      ),
    ).toEqual({});
    expect(
      await detailsOf(
        await relay('CMS-03C-03', 409, { reasonCode: 'pattern_cycle' }),
      ),
    ).toEqual({});
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 422, {
          reasonCode: 'canonical_overlap',
          domain: 'role',
          canonicalId: CANONICAL_ID,
        }),
      ),
    ).toEqual({});
    expect(
      await detailsOf(await relay('CMS-03C-03', 422, { reasonCode: 'nope' })),
    ).toEqual({});
  });

  it('keeps the version hints of a plain write conflict, but not on a read', async () => {
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 409, {
          expectedVersion: '2',
          currentVersion: '3',
          secret: 'x',
        }),
      ),
    ).toEqual({ expectedVersion: '2', currentVersion: '3' });
    expect(
      await detailsOf(
        await relay('CMS-03C-16', 409, {
          currentVersion: '9223372036854775808',
        }),
      ),
    ).toEqual({});
    expect(
      await detailsOf(
        await relay('cmsTaxonomyTermsRead', 409, { currentVersion: '3' }),
      ),
    ).toEqual({});
  });
});
