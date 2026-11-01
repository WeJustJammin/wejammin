import { ApiErrorSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTaxonomyDefinitionAdmissionHarness,
  taxonomyDefinitionOrigin,
  taxonomyDefinitionRequestId,
  taxonomyDefinitionVersionsPath,
  taxonomyDefinitionWriteRequest,
  createTaxonomyProductionHarness,
  taxonomyAuthentication,
  taxonomyResource,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('taxonomy provider status and refreshed authority', () => {
  const operations = ['create', 'read'] as const;
  const tokens = [
    'capability_missing',
    'TAXONOMY_NOT_FOUND',
    'TAXONOMY_FORBIDDEN',
    'TAXONOMY_VERSION_CONFLICT',
    'TAXONOMY_VALIDATION_FAILED',
    'FORBIDDEN',
  ] as const;
  const faults = operations.flatMap((operation) =>
    [500, 502, 503, 504].flatMap((status) =>
      tokens.map((token) => ({ operation, status, token })),
    ),
  );
  it.each(faults)(
    '$operation provider$status cannot become a caller refusal through $token',
    async ({ operation, status, token }) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            code: 'P0001',
            message: token,
            details: {
              reasonCode: 'capability_missing',
              ownerId: 'private-owner',
              violations: [{ path: '/private-person', message: 'private-sql' }],
            },
          },
          { status },
        ),
      );
      const h = createTaxonomyProductionHarness(fetchImpl);
      const response = await h.request(
        operation === 'create'
          ? '/api/v1/cms/taxonomies/versions'
          : taxonomyDefinitionVersionsPath(),
        operation === 'create' ? taxonomyDefinitionWriteRequest() : {},
      );
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).not.toMatch(
        /private-owner|private-person|private-sql|ownerId|reasonCode/,
      );
      const error = ApiErrorSchema.parse(JSON.parse(text));
      expect(error).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        message:
          'DEPENDENCY_UNAVAILABLE: taxonomy operation rejected or unavailable.',
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
      expect(error.details).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
      if (operation === 'create') {
        expect(response.headers.get('x-request-id')).toBe(
          taxonomyDefinitionRequestId,
        );
        expect(response.headers.get('access-control-allow-origin')).toBe(
          taxonomyDefinitionOrigin,
        );
      }
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it.each(
    operations.flatMap((operation) =>
      [
        { code: 'P0001', message: 'INTERNAL_ERROR', expected: 500 },
        { code: 'INTERNAL_ERROR', message: 'private prose', expected: 500 },
        { code: '40001', message: 'VERSION_MISMATCH', expected: 409 },
        { code: '40001', message: 'STALE_EDIT_PRESENCE', expected: 409 },
      ].map((value) => ({ operation, ...value })),
    ),
  )(
    '$operation preserves explicit $code/$message',
    async ({ operation, code, message, expected }) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(
          { code, message, details: 'private SQL' },
          { status: 500 },
        ),
      );
      const h = createTaxonomyProductionHarness(fetchImpl);
      const response = await h.request(
        operation === 'create'
          ? '/api/v1/cms/taxonomies/versions'
          : taxonomyDefinitionVersionsPath(),
        operation === 'create' ? taxonomyDefinitionWriteRequest() : {},
      );
      expect(response.status).toBe(expected);
      expect(await response.text()).not.toContain('private SQL');
    },
  );
  it.each(
    operations.flatMap((operation) =>
      ['authUserId', 'sessionId', 'personId', 'actingPartyId'].map((key) => ({
        operation,
        key,
      })),
    ),
  )(
    '$operation refuses provider-refreshed changed $key before RPC',
    async ({ operation, key }) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const h = createTaxonomyProductionHarness(fetchImpl);
      h.auth.resolveSession.mockResolvedValueOnce({
        ok: true,
        value: taxonomyAuthentication,
      });
      h.auth.resolveSession.mockResolvedValue({
        ok: true,
        value: {
          ...taxonomyAuthentication,
          [key]: '88888888-8888-4888-8888-888888888888',
        },
      });
      const response = await h.request(
        operation === 'create'
          ? '/api/v1/cms/taxonomies/versions'
          : taxonomyDefinitionVersionsPath(),
        operation === 'create' ? taxonomyDefinitionWriteRequest() : {},
      );
      expect(response.status).toBe(401);
      expect(h.auth.resolveSession).toHaveBeenCalledTimes(2);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
  it.each(operations)(
    '%s uses actual provider stale proof with step-up NONE',
    async (operation) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(
          operation === 'create'
            ? taxonomyResource()
            : {
                taxonomyId: taxonomyResource().taxonomyId,
                page: { items: [], pageVersion: '1' },
              },
        ),
      );
      const h = createTaxonomyProductionHarness(fetchImpl);
      h.auth.resolveSession.mockResolvedValue({
        ok: true,
        value: { ...taxonomyAuthentication, stepUpAt: '2026-10-11T00:00:00Z' },
      });
      const response = await h.request(
        operation === 'create'
          ? '/api/v1/cms/taxonomies/versions'
          : taxonomyDefinitionVersionsPath(),
        operation === 'create' ? taxonomyDefinitionWriteRequest() : {},
      );
      expect(response.status).toBe(operation === 'create' ? 201 : 200);
      expect(h.auth.resolveSession).toHaveBeenCalledTimes(2);
      expect(
        JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)).p_request.context
          .stepUpVerified,
      ).toBe(false);
    },
  );
});

const expectTaxonomyAuthenticationRefusal = async (
  response: Response,
): Promise<void> => {
  // This status assertion is the deliberate behavioral RED, not an import error.
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toBe(
    taxonomyDefinitionRequestId,
  );
  expect(response.headers.get('access-control-allow-origin')).toBe(
    taxonomyDefinitionOrigin,
  );
  expect(response.headers.get('etag')).toBeNull();
  expect(ApiErrorSchema.parse(await response.json())).toEqual({
    code: 'UNAUTHENTICATED',
    message: 'UNAUTHENTICATED: taxonomy operation rejected or unavailable.',
    requestId: taxonomyDefinitionRequestId,
    details: { recoveryAction: 'reauthenticate' },
  });
};

describe('taxonomy definition production-composed Worker admission', () => {
  it('reaches existing template authentication as a harness control', async () => {
    const harness = createTaxonomyDefinitionAdmissionHarness();
    const response = await harness.request('/api/v1/cms/templates/versions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: taxonomyDefinitionOrigin,
      },
      body: '{}',
    });

    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'UNAUTHENTICATED',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
    expect(harness.captureException).not.toHaveBeenCalled();
  });

  it.each([
    ['first version, JSON null and no If-Match', null],
    ['successor, exact strong parent If-Match', '7'],
  ] as const)(
    'CMS-03C-16: %s reaches typed 401, not generic 404',
    async (_label, expectedVersion) => {
      const harness = createTaxonomyDefinitionAdmissionHarness();
      const response = await harness.request(
        '/api/v1/cms/taxonomies/versions',
        taxonomyDefinitionWriteRequest(expectedVersion),
      );

      expect(harness.fetchImpl).not.toHaveBeenCalled();
      expect(harness.captureException).not.toHaveBeenCalled();
      await expectTaxonomyAuthenticationRefusal(response);
    },
  );

  it('cmsTaxonomyVersionsRead reaches typed 401 without body/query/write headers', async () => {
    const harness = createTaxonomyDefinitionAdmissionHarness();
    const response = await harness.request(taxonomyDefinitionVersionsPath(), {
      method: 'GET',
      headers: {
        origin: taxonomyDefinitionOrigin,
        'x-request-id': taxonomyDefinitionRequestId,
      },
    });

    expect(harness.fetchImpl).not.toHaveBeenCalled();
    expect(harness.captureException).not.toHaveBeenCalled();
    await expectTaxonomyAuthenticationRefusal(response);
  });
});
