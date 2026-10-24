import {
  CMS_SLICE_12_OPERATION_REASONS,
  cmsCompositionCatalogCode,
  cmsCompositionCatalogMessage,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  GOVERNED_DECLARED_STATUSES,
  projectGovernedErrorDetails,
  type GovernedProxyOperation,
} from './cms-governed-review-platform-error-details';
import {
  governedLocalError,
  relayGovernedError,
} from './cms-governed-review-platform-errors';
import {
  REQUEST_ID,
  governedApiError,
  jsonResponse,
} from './cms-governed-review-fixtures.test-support';
import { ORIGIN } from './cms-workflow-platform-command.test-support';

/*
 * The first-party relay of a governed-review error (BE03c "Normative application
 * error catalog", rows 168-173): the code and message must be the catalog's for
 * the status, and every published detail is rebuilt from closed vocabularies.
 */
const OPERATIONS: readonly GovernedProxyOperation[] = [
  'CMS-03C-06',
  'CMS-03C-07',
  'CMS-03C-08',
  'CMS-03C-10',
  'CMS-03C-11',
];

const request = new Request(`${ORIGIN}/api/v1/cms/governed-reviews`);

const upstream = (
  operation: GovernedProxyOperation,
  status: number,
  details: Readonly<Record<string, unknown>> = {},
  overrides: { code?: string; message?: string } = {},
): Response => {
  const code =
    overrides.code ?? (cmsCompositionCatalogCode(operation, status) as string);
  const message = (): string => {
    try {
      return cmsCompositionCatalogMessage('governedReview', code);
    } catch {
      return `${code}: a message from another catalog.`;
    }
  };
  return jsonResponse(
    status,
    governedApiError(code, overrides.message ?? message(), details),
  );
};

describe('declared statuses', () => {
  it('give the read operations the statuses BE03c row 172 and 173 document and every command all twelve', () => {
    expect([...GOVERNED_DECLARED_STATUSES['CMS-03C-10']].sort()).toEqual(
      [400, 401, 403, 404, 415, 429, 500, 502, 503, 504].sort(),
    );
    expect([...GOVERNED_DECLARED_STATUSES['CMS-03C-11']].sort()).toEqual(
      [400, 401, 409, 415, 422, 429, 500, 502, 503, 504].sort(),
    );
    for (const operation of ['CMS-03C-06', 'CMS-03C-07', 'CMS-03C-08'] as const)
      expect([...GOVERNED_DECLARED_STATUSES[operation]].sort()).toEqual(
        [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504].sort(),
      );
  });
});

describe('governedLocalError', () => {
  it.each([
    [400, 'INVALID_REQUEST'],
    [403, 'GOVERNED_REVIEW_FORBIDDEN'],
    [404, 'GOVERNED_REVIEW_NOT_FOUND'],
    [409, 'GOVERNED_REVIEW_VERSION_CONFLICT'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'GOVERNED_REVIEW_VALIDATION_FAILED'],
    [429, 'RATE_LIMITED'],
    [502, 'DEPENDENCY_UNAVAILABLE'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const)(
    'answers %i with the catalog code %s and no-store',
    async (status, code) => {
      const response = governedLocalError(request, 'CMS-03C-07', status);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.code).toBe(code);
      expect(body.message).toBe(
        cmsCompositionCatalogMessage('governedReview', code),
      );
    },
  );

  it('carries the dependency class and retryable true (BE00 172) on every 502, 503 and 504 answer, and a retry hint on 429, 503 and 504', async () => {
    const unavailable = governedLocalError(request, 'CMS-03C-10', 503);
    expect(unavailable.headers.get('retry-after')).toBe('5');
    expect(
      ((await unavailable.json()) as { details: unknown }).details,
    ).toEqual({ dependencyClass: 'cms_composition', retryable: true });
    const invalid = governedLocalError(request, 'CMS-03C-10', 502);
    expect(invalid.headers.has('retry-after')).toBe(false);
    expect(((await invalid.json()) as { details: unknown }).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it('carries the supplied violations and nothing else on a 400 or 422', async () => {
    const response = governedLocalError(request, 'CMS-03C-07', 422, {
      violations: [{ path: '/reason', code: 'invalid' }],
    });
    const body = (await response.json()) as { details: unknown };
    expect(body.details).toEqual({
      violations: [
        { path: '/reason', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
  });

  it('honours a safe inbound request id and never echoes an unsafe one', async () => {
    const withId = new Request(request.url, {
      headers: { 'x-request-id': REQUEST_ID },
    });
    const response = governedLocalError(withId, 'CMS-03C-10', 404);
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
  });
});

describe('projectGovernedErrorDetails', () => {
  it('relays the step-up recovery only on the two step-up commands', () => {
    for (const operation of ['CMS-03C-07', 'CMS-03C-08'] as const)
      expect(
        projectGovernedErrorDetails(operation, 401, 'STEP_UP_REQUIRED', {
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
          leaked: 'x',
        }),
      ).toEqual({ recoveryAction: 'step_up', allowedMethods: ['totp'] });
    expect(
      projectGovernedErrorDetails('CMS-03C-06', 401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'reauthenticate',
      }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-10', 401, 'UNAUTHENTICATED', {
        recoveryAction: 'reauthenticate',
        extra: 1,
      }),
    ).toEqual({ recoveryAction: 'reauthenticate' });
  });

  it.each(
    OPERATIONS.flatMap((operation) =>
      (CMS_SLICE_12_OPERATION_REASONS[operation] as readonly string[]).map(
        (reason) => [operation, reason] as const,
      ),
    ),
  )(
    'relays the registered token %s %s at its one status',
    (operation, reason) => {
      const status = cmsSlice12ReasonStatus(
        reason as Parameters<typeof cmsSlice12ReasonStatus>[0],
      );
      const upstreamDetails =
        reason === 'canonical_source_unavailable'
          ? { reasonCode: reason, domain: 'gear', leaked: 'x' }
          : { reasonCode: reason, leaked: 'x' };
      const projected = projectGovernedErrorDetails(
        operation,
        status,
        cmsCompositionCatalogCode(operation, status) as string,
        upstreamDetails,
      );
      expect(projected.reasonCode).toBe(reason);
      expect(Object.keys(projected)).not.toContain('leaked');
    },
  );

  it('refuses a token from another operation or at another status', () => {
    expect(
      projectGovernedErrorDetails('CMS-03C-06', 409, 'X', {
        reasonCode: 'review_not_open',
      }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 422, 'X', {
        reasonCode: 'review_not_open',
      }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 403, 'X', {
        reasonCode: 'made_up',
      }),
    ).toEqual({});
  });

  it('requires a canonical domain for canonical_source_unavailable', () => {
    expect(
      projectGovernedErrorDetails('CMS-03C-06', 422, 'X', {
        reasonCode: 'canonical_source_unavailable',
        domain: 'private SQL text',
      }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-06', 422, 'X', {
        reasonCode: 'canonical_source_unavailable',
      }),
    ).toEqual({});
  });

  it('keeps only the operation request pointers as violations, once each', () => {
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 422, 'X', {
        violations: [
          { path: '/reason', code: 'x', message: 'raw SQL' },
          { path: '/reason', code: 'x' },
          { path: '/attacker', code: 'x' },
        ],
      }),
    ).toEqual({
      violations: [
        { path: '/reason', code: 'invalid', message: 'The value is invalid.' },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    expect(
      projectGovernedErrorDetails('CMS-03C-08', 422, 'X', {
        reasonCode: 'expiry_out_of_bounds',
        violations: [{ path: '/expiresAt', code: 'x' }],
      }),
    ).toEqual({
      reasonCode: 'expiry_out_of_bounds',
      violations: [
        {
          path: '/expiresAt',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('relays only numeric rate hints and a digit-only reset', () => {
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 429, 'X', {
        retryAfterSeconds: 30,
        limit: 30,
        resetAt: '1760000000',
        leaked: 'x',
      }),
    ).toEqual({ retryAfterSeconds: 30, limit: 30, resetAt: '1760000000' });
    expect(
      projectGovernedErrorDetails('CMS-03C-07', 429, 'X', {
        retryAfterSeconds: -1,
        limit: '30',
        resetAt: 'tomorrow',
      }),
    ).toEqual({});
  });

  it('publishes the dependency class for 502, 503 and 504 and nothing for 404 and 500', () => {
    expect(projectGovernedErrorDetails('CMS-03C-10', 503, 'X', {})).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    expect(projectGovernedErrorDetails('CMS-03C-10', 502, 'X', {})).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    expect(
      projectGovernedErrorDetails('CMS-03C-10', 404, 'X', { id: 'secret' }),
    ).toEqual({});
    expect(
      projectGovernedErrorDetails('CMS-03C-10', 500, 'X', { id: 'secret' }),
    ).toEqual({});
  });

  it('echoes the single allowed media type on 415', () => {
    expect(projectGovernedErrorDetails('CMS-03C-07', 415, 'X', {})).toEqual({
      allowedMediaTypes: ['application/json'],
    });
  });
});

describe('relayGovernedError', () => {
  it('relays a catalog error with rebuilt details, its request id and no-store', async () => {
    const response = await relayGovernedError(
      request,
      upstream('CMS-03C-07', 403, {
        reasonCode: 'separation_of_duties',
        leaked: 'x',
      }),
      'CMS-03C-07',
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(await response.json()).toEqual({
      code: 'GOVERNED_REVIEW_FORBIDDEN',
      message: cmsCompositionCatalogMessage(
        'governedReview',
        'GOVERNED_REVIEW_FORBIDDEN',
      ),
      details: { reasonCode: 'separation_of_duties' },
      requestId: REQUEST_ID,
    });
  });

  it('relays the step-up shortfall as the registered code', async () => {
    const response = await relayGovernedError(
      request,
      upstream(
        'CMS-03C-07',
        401,
        { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        { code: 'STEP_UP_REQUIRED' },
      ),
      'CMS-03C-07',
    );
    expect(response.status).toBe(401);
    expect(((await response.json()) as { code: string }).code).toBe(
      'STEP_UP_REQUIRED',
    );
  });

  it('answers 502 for a status the operation does not document', async () => {
    const response = await relayGovernedError(
      request,
      upstream('CMS-03C-10', 422),
      'CMS-03C-10',
    );
    expect(response.status).toBe(502);
  });

  it.each([
    ['a code of another catalog', { code: 'TEMPLATE_FORBIDDEN' }],
    ['a code of another status', { code: 'GOVERNED_REVIEW_NOT_FOUND' }],
    ['a message the catalog did not write', { message: 'SQL: boom at line 4' }],
  ] as const)('answers 502 for %s', async (_name, overrides) => {
    const response = await relayGovernedError(
      request,
      upstream('CMS-03C-07', 403, {}, overrides),
      'CMS-03C-07',
    );
    expect(response.status).toBe(502);
  });

  it('refuses STEP_UP_REQUIRED on an operation without step-up', async () => {
    const response = await relayGovernedError(
      request,
      upstream('CMS-03C-06', 401, {}, { code: 'STEP_UP_REQUIRED' }),
      'CMS-03C-06',
    );
    expect(response.status).toBe(502);
  });

  it('answers 502 for a body that is not an ApiError', async () => {
    for (const body of [
      new Response('<html>', { status: 403 }),
      jsonResponse(403, { oops: true }),
    ])
      expect(
        (await relayGovernedError(request, body, 'CMS-03C-07')).status,
      ).toBe(502);
  });

  it('keeps a valid retry-after only on 429, 503 and 504', async () => {
    const limited = upstream('CMS-03C-10', 429, { retryAfterSeconds: 12 });
    limited.headers.set('retry-after', '12');
    expect(
      (await relayGovernedError(request, limited, 'CMS-03C-10')).headers.get(
        'retry-after',
      ),
    ).toBe('12');
    const notFound = upstream('CMS-03C-10', 404);
    notFound.headers.set('retry-after', '12');
    expect(
      (await relayGovernedError(request, notFound, 'CMS-03C-10')).headers.has(
        'retry-after',
      ),
    ).toBe(false);
  });
});
