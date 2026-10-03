import { describe, expect, it, vi } from 'vitest';

import {
  CREDIT_ID,
  MEDIA_ID,
  PARTY_ID,
  RIGHTS_ID,
  bindings,
  createProfilePortfolioApp,
  expectApiError,
  failure,
  jsonRequest,
  readRequest,
} from './phase-02-slice-06.test-support';

const profilePath = `/api/v1/profiles/${PARTY_ID}`;
const sectionPath = `${profilePath}/sections/biography`;
const factRef = {
  sourceType: 'credit',
  sourceId: CREDIT_ID,
  sourceVersion: '3',
} as const;
const mediaRef = {
  sourceType: 'media',
  sourceId: MEDIA_ID,
  sourceVersion: '3',
} as const;
const rightsRef = {
  sourceType: 'media',
  sourceId: RIGHTS_ID,
  sourceVersion: '3',
} as const;
const sectionBody = {
  state: 'active',
  blocks: [{ kind: 'paragraph', text: 'A safe profile section.' }],
  clientReason: 'Refresh the asserted profile section',
} as const;
const reelBody = {
  creditRef: factRef,
  mediaRef,
  roleCode: 'performer',
  rightsBasis: 'ownership',
  rightsRef,
  order: 0,
} as const;
describe('Phase 2 Slice 06 Worker validation and authorization RED acceptance', () => {
  it('[P2-S06-AC-004,010,028,034,040,046,052,058,064] rejects unknown query fields before a port call', async () => {
    const harness = createProfilePortfolioApp();
    const response = await harness.app.fetch(
      readRequest(`${profilePath}/portfolio`, 'limit=25&unexpected=true'),
      bindings,
    );

    await expectApiError(response, 400, 'INVALID_REQUEST');
    expect(harness.profilePortfolio.readPortfolio).not.toHaveBeenCalled();
  });

  it('[P2-S06-AC-004,010,022,028,034,040,046,052,058,064] rejects strict body unknown keys without mutation', async () => {
    const harness = createProfilePortfolioApp();
    const request = jsonRequest(
      'PUT',
      sectionPath,
      {
        ...sectionBody,
        authorPersonId: '99999999-9999-4999-8999-999999999999',
      },
      { ifMatch: '"1"' },
    );

    await expectApiError(
      await harness.app.fetch(request, bindings),
      422,
      'VALIDATION_FAILED',
    );
    expect(harness.profilePortfolio.putSection).not.toHaveBeenCalled();
  });

  it.each([
    `${profilePath}/not-a-uuid`,
    `/api/v1/profiles/${PARTY_ID}/sections/not-asserted/revisions`,
    `/api/v1/reel-items/not-a-uuid`,
  ])(
    '[P2-S06-AC-004,010,028,034,040,046,052,058,064] rejects malformed route %s',
    async (path) => {
      const harness = createProfilePortfolioApp();
      // The path is validated after the session step, so the caller is
      // authenticated for the protected route.
      const response = await harness.app.fetch(
        readRequest(path, undefined, true),
        bindings,
      );

      await expectApiError(response, 422, 'VALIDATION_FAILED');
    },
  );

  it('[P2-S06-AC-004,040,052,058] enforces JSON media type and body size before parsing', async () => {
    const harness = createProfilePortfolioApp();
    await expectApiError(
      await harness.app.fetch(
        jsonRequest('POST', `${profilePath}/reel-items`, reelBody, {
          ifMatch: '"3"',
          contentType: 'text/plain',
        }),
        bindings,
      ),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      { allowedMediaTypes: ['application/json'] },
    );

    const oversized = jsonRequest(
      'POST',
      `${profilePath}/reel-items`,
      reelBody,
      {
        ifMatch: '"3"',
      },
    );
    oversized.headers.set('content-length', String(256 * 1024 + 1));
    await expectApiError(
      await harness.app.fetch(oversized, bindings),
      413,
      'PAYLOAD_TOO_LARGE',
    );
    expect(harness.profilePortfolio.createReelItem).not.toHaveBeenCalled();
  });

  it('[P2-S06-AC-005,011,023,029,035,041,047,053,059,065] hides protected resources from anonymous callers', async () => {
    const harness = createProfilePortfolioApp();
    const response = await harness.app.fetch(
      readRequest(`${profilePath}/sections/biography/revisions`),
      bindings,
    );

    await expectApiError(response, 401, 'UNAUTHENTICATED');
    expect(
      harness.profilePortfolio.readSectionRevisions,
    ).not.toHaveBeenCalled();
  });

  it('[P2-S06-AC-001,005] never exposes private evidence when a public projection is unavailable', async () => {
    const harness = createProfilePortfolioApp({
      readPublicProfile: vi.fn(async () =>
        failure(
          404,
          'RESOURCE_NOT_FOUND',
          'The requested profile was not found.',
          {
            target: 'profile',
          },
        ),
      ),
    });
    const response = await harness.app.fetch(
      readRequest(profilePath),
      bindings,
    );
    await expectApiError(response, 404, 'RESOURCE_NOT_FOUND');
    const body = JSON.stringify(await response.clone().json());
    expect(body).not.toMatch(/attester|legal|trader|evidence|private/i);
  });

  it('[P2-S06-AC-005,011,023,029,035,041,047,053,059,065] derives actor and acting party from session, not caller body', async () => {
    const observed: unknown[] = [];
    const harness = createProfilePortfolioApp({
      putSection: vi.fn(async (input) => {
        observed.push(input);
        return failure(403, 'FORBIDDEN');
      }),
    });
    const response = await harness.app.fetch(
      jsonRequest(
        'PUT',
        sectionPath,
        {
          ...sectionBody,
          actorPersonId: '99999999-9999-4999-8999-999999999999',
          actingPartyId: '99999999-9999-4999-8999-999999999999',
        },
        { ifMatch: '"1"' },
      ),
      bindings,
    );

    await expectApiError(response, 422, 'VALIDATION_FAILED');
    expect(observed).toHaveLength(0);
  });

  it.each(['*', 'W/"1"', '"0"', '"01"', '" 1 "'])(
    '[P2-S06-AC-006,012,018,024,030,036,042,048,054,060] rejects invalid If-Match %s before domain validation',
    async (ifMatch) => {
      const harness = createProfilePortfolioApp();
      await expectApiError(
        await harness.app.fetch(
          jsonRequest('PUT', sectionPath, sectionBody, { ifMatch }),
          bindings,
        ),
        400,
        'INVALID_REQUEST',
      );
      expect(harness.profilePortfolio.putSection).not.toHaveBeenCalled();
    },
  );

  it('[P2-S06-AC-006,012,018,024,030,036,042,048,054,060] requires an idempotency key for every mutation', async () => {
    const harness = createProfilePortfolioApp();
    const request = jsonRequest('PUT', sectionPath, sectionBody, {
      idempotencyKey: null,
      ifMatch: '"1"',
    });

    await expectApiError(
      await harness.app.fetch(request, bindings),
      400,
      'INVALID_REQUEST',
    );
    expect(harness.profilePortfolio.putSection).not.toHaveBeenCalled();
  });

  it('[P2-S06-AC-006,012,018,024,030,036,042,048,054,060] rejects stale well-formed versions as VERSION_CONFLICT', async () => {
    const harness = createProfilePortfolioApp({
      putSection: async () =>
        failure(409, 'VERSION_CONFLICT', 'The section changed.'),
    });
    await expectApiError(
      await harness.app.fetch(
        jsonRequest('PUT', sectionPath, sectionBody, { ifMatch: '"1"' }),
        bindings,
      ),
      409,
      'VERSION_CONFLICT',
    );
  });

  it('[P2-S06-AC-006,012,018,024,030,036,042,048,054,060] replays an identical mutation without a second port call', async () => {
    const harness = createProfilePortfolioApp();
    const first = await harness.app.fetch(
      jsonRequest('PUT', sectionPath, sectionBody, {
        idempotencyKey: 'slice06-replay-key',
        ifMatch: '"1"',
      }),
      bindings,
    );
    const second = await harness.app.fetch(
      jsonRequest('PUT', sectionPath, sectionBody, {
        idempotencyKey: 'slice06-replay-key',
        ifMatch: '"1"',
      }),
      bindings,
    );

    expect(second.status).toBe(first.status);
    expect(await second.text()).toBe(await first.clone().text());
    expect(harness.profilePortfolio.putSection).toHaveBeenCalledTimes(1);
  });

  it('[P2-S06-AC-006,012,018,024,030,036,042,048,054,060] rejects idempotency reuse with a different body', async () => {
    const harness = createProfilePortfolioApp();
    await harness.app.fetch(
      jsonRequest('PUT', sectionPath, sectionBody, {
        idempotencyKey: 'slice06-conflict-key',
        ifMatch: '"1"',
      }),
      bindings,
    );
    await expectApiError(
      await harness.app.fetch(
        jsonRequest(
          'PUT',
          sectionPath,
          { ...sectionBody, clientReason: 'Different intent' },
          {
            idempotencyKey: 'slice06-conflict-key',
            ifMatch: '"1"',
          },
        ),
        bindings,
      ),
      409,
      'IDEMPOTENCY_CONFLICT',
    );
    expect(harness.profilePortfolio.putSection).toHaveBeenCalledTimes(1);
  });

  it('[P2-S06-AC-007,013,019,025,031,037,043,049,055,061,067] maps dependency timeouts to the exact ApiError envelope', async () => {
    const harness = createProfilePortfolioApp({
      readPortfolio: async () =>
        failure(504, 'TIMEOUT', 'Profile read exceeded its deadline.'),
    });
    await expectApiError(
      await harness.app.fetch(
        readRequest(`${profilePath}/portfolio`),
        bindings,
      ),
      504,
      'TIMEOUT',
    );
  });

  it('[P2-S06-AC-007,013,019,025,031,037,043,049,055,061,067] maps unavailable dependencies to retryable 503', async () => {
    const harness = createProfilePortfolioApp({
      readReel: async () => failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    const response = await harness.app.fetch(
      readRequest(`${profilePath}/reel`),
      bindings,
    );
    await expectApiError(response, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('5');
  });

  it('[P2-S06-AC-006,012,024,030,036] emits bounded rate headers and rejects the 301st public profile read', async () => {
    const harness = createProfilePortfolioApp();
    let last: Response | undefined;
    for (let index = 0; index < 301; index += 1) {
      const request = readRequest(profilePath);
      request.headers.set('cf-connecting-ip', '203.0.113.10');
      last = await harness.app.fetch(request, bindings);
    }

    expect(last?.status).toBe(429);
    expect(last?.headers.get('ratelimit-limit')).toBe('300');
    expect(last?.headers.get('ratelimit-remaining')).toBe('0');
    expect(last?.headers.get('ratelimit-reset')).toMatch(/^[1-9][0-9]*$/u);
    expect(last?.headers.get('retry-after')).toMatch(/^[1-9][0-9]*$/u);
  });
});
