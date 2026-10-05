import { afterEach, describe, expect, it, vi } from 'vitest';

import { contentSchemaRegistryRoutePolicies } from '@wejammin/contracts';

import { createContentSchemaRegistryApp } from './routes';
import {
  activationBody,
  contentTypeBody,
  expectError,
  failure,
  humanRequest,
  makeDependencies,
  releaseBody,
  releaseRequest,
  TYPE_ID,
  VERSION_ID,
} from './routes.coverage.fixtures';

afterEach(() => vi.restoreAllMocks());

describe('content schema registry route defensive coverage', () => {
  it('filters unsafe conflict, rate, and dependency details', async () => {
    const conflict = makeDependencies({
      port: failure(409, 'CONFLICT', undefined),
    });
    await expectError(
      await createContentSchemaRegistryApp(conflict.dependencies).request(
        humanRequest('/api/v1/cms/content-types'),
      ),
      409,
    );

    const detailedConflict = makeDependencies({
      port: failure(409, 'CONFLICT', {
        expectedVersion: '1',
        currentVersion: '2',
        reason: 'stale',
        ownerId: '10000000-0000-4000-8000-000000000001',
      }),
    });
    const conflictBody = (await (
      await createContentSchemaRegistryApp(
        detailedConflict.dependencies,
      ).request(humanRequest('/api/v1/cms/content-types'))
    ).json()) as { details: unknown };
    expect(conflictBody.details).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
      expectedVersion: '1',
      currentVersion: '2',
    });

    const rate = makeDependencies({
      port: failure(429, 'RATE_LIMITED', undefined),
    });
    await expectError(
      await createContentSchemaRegistryApp(rate.dependencies).request(
        humanRequest('/api/v1/cms/content-types'),
      ),
      429,
    );

    const dependency = makeDependencies({
      port: failure(503, 'DEPENDENCY_UNAVAILABLE', undefined),
    });
    await expectError(
      await createContentSchemaRegistryApp(dependency.dependencies).request(
        humanRequest('/api/v1/cms/content-types'),
      ),
      503,
    );
    const detailedDependency = makeDependencies({
      port: failure(
        503,
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'cms_registry', retryable: true },
        5,
      ),
    });
    const response = await createContentSchemaRegistryApp(
      detailedDependency.dependencies,
    ).request(humanRequest('/api/v1/cms/content-types'));
    expect(await response.json()).toMatchObject({
      details: {
        dependencyClass: 'cms_registry',
        retryable: true,
        retryAfterSeconds: 5,
      },
    });
  });

  it('rejects human origin, session, step-up, rate, and release admission failures', async () => {
    const origin = makeDependencies();
    await expectError(
      await createContentSchemaRegistryApp(origin.dependencies).request(
        humanRequest('/api/v1/cms/content-types', contentTypeBody, {
          origin: 'https://evil.example.test',
        }),
      ),
      403,
    );

    const sessionFailure = makeDependencies({
      session: failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    await expectError(
      await createContentSchemaRegistryApp(sessionFailure.dependencies).request(
        humanRequest('/api/v1/cms/content-types'),
      ),
      503,
    );

    const noStepUp = makeDependencies({
      session: {
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
          mfaFresh: false,
        },
      },
    });
    await expectError(
      await createContentSchemaRegistryApp(noStepUp.dependencies).request(
        humanRequest(
          `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/activate`,
          activationBody,
          { 'if-match': '"1"' },
        ),
      ),
      401,
    );

    const rateFailure = makeDependencies({
      rate: failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    await expectError(
      await createContentSchemaRegistryApp(rateFailure.dependencies).request(
        humanRequest('/api/v1/cms/content-types'),
      ),
      503,
    );

    const rateLimited = makeDependencies({
      rate: {
        ok: true,
        value: { allowed: false, limit: 1, remaining: 0, resetAt: 2 },
      },
    });
    const limitedResponse = await createContentSchemaRegistryApp(
      rateLimited.dependencies,
    ).request(humanRequest('/api/v1/cms/content-types'));
    expect(await expectError(limitedResponse, 429)).toMatchObject({
      code: 'RATE_LIMITED',
    });

    const missingHeader = makeDependencies();
    await expectError(
      await createContentSchemaRegistryApp(missingHeader.dependencies).request(
        releaseRequest('/api/v1/cms/blocks/versions', undefined, {
          'idempotency-key': '',
        }),
      ),
      400,
    );

    const releaseRateFailure = makeDependencies({
      rate: failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    await expectError(
      await createContentSchemaRegistryApp(
        releaseRateFailure.dependencies,
      ).request(releaseRequest('/api/v1/cms/blocks/versions')),
      503,
    );

    const releaseRateLimited = makeDependencies({
      rate: {
        ok: true,
        value: { allowed: false, limit: 1, remaining: 0, resetAt: 2 },
      },
    });
    await expectError(
      await createContentSchemaRegistryApp(
        releaseRateLimited.dependencies,
      ).request(releaseRequest('/api/v1/cms/blocks/versions')),
      429,
    );
  });

  it('rejects protected-read session, capability, and rate failures', async () => {
    const sessionFailure = makeDependencies({
      session: failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    await expectError(
      await createContentSchemaRegistryApp(sessionFailure.dependencies).request(
        new Request('https://api.example.test/api/v1/cms/content-types'),
      ),
      503,
    );

    const noCapability = makeDependencies({
      session: {
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: [],
          mfaFresh: true,
        },
      },
    });
    await expectError(
      await createContentSchemaRegistryApp(noCapability.dependencies).request(
        new Request('https://api.example.test/api/v1/cms/content-types'),
      ),
      403,
    );

    const malformedSession = makeDependencies({
      session: {
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: null,
          capabilities: ['cms.schema_registry.read'],
          mfaFresh: 'yes',
        } as unknown as import('./types').ContentSchemaRegistrySession,
      },
    });
    await expectError(
      await createContentSchemaRegistryApp(
        malformedSession.dependencies,
      ).request(
        new Request('https://api.example.test/api/v1/cms/content-types'),
      ),
      401,
    );

    const rateFailure = makeDependencies({
      rate: failure(503, 'DEPENDENCY_UNAVAILABLE'),
    });
    await expectError(
      await createContentSchemaRegistryApp(rateFailure.dependencies).request(
        new Request('https://api.example.test/api/v1/cms/content-types'),
      ),
      503,
    );
  });

  it('covers every protected route path validation branch', async () => {
    const cases = [
      `/api/v1/cms/content-types/not-a-uuid/versions/${VERSION_ID}/fields`,
      `/api/v1/cms/content-types/${TYPE_ID}/versions/not-a-uuid/fields`,
      `/api/v1/cms/content-types/not-a-uuid/versions/${VERSION_ID}/relations`,
      `/api/v1/cms/content-types/${TYPE_ID}/versions/not-a-uuid/relations`,
      `/api/v1/cms/content-types/not-a-uuid/versions/${VERSION_ID}/activate`,
      `/api/v1/cms/content-types/${TYPE_ID}/versions/not-a-uuid/activate`,
    ];
    for (const path of cases)
      await expectError(
        await createContentSchemaRegistryApp(
          makeDependencies().dependencies,
        ).request(humanRequest(path)),
        400,
      );

    await expectError(
      await createContentSchemaRegistryApp(
        makeDependencies().dependencies,
      ).request(
        new Request(
          `https://api.example.test/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}?unexpected=1`,
        ),
      ),
      400,
    );
    await expectError(
      await createContentSchemaRegistryApp(
        makeDependencies().dependencies,
      ).request(
        new Request(
          `https://api.example.test/api/v1/cms/content-types/not-a-uuid/versions/${VERSION_ID}`,
        ),
      ),
      400,
    );
    await expectError(
      await createContentSchemaRegistryApp(
        makeDependencies().dependencies,
      ).request(
        new Request(
          `https://api.example.test/api/v1/cms/content-types/${TYPE_ID}/versions/not-a-uuid`,
        ),
      ),
      400,
    );
    await expectError(
      await createContentSchemaRegistryApp(
        makeDependencies().dependencies,
      ).request(
        releaseRequest(
          '/api/v1/cms/blocks/versions/not-a-uuid/lifecycle',
          releaseBody,
        ),
      ),
      400,
    );
  });

  it('exercises the missing-policy and app error boundaries', async () => {
    const policies = contentSchemaRegistryRoutePolicies as unknown as Array<
      (typeof contentSchemaRegistryRoutePolicies)[number]
    >;
    const saved = [...policies];
    try {
      const harness = makeDependencies();
      harness.rateLimit.mockImplementation(async () => {
        policies.splice(0, policies.length);
        return {
          ok: true,
          value: { allowed: true, limit: 1, remaining: 0, resetAt: 1 },
        };
      });
      const response = await createContentSchemaRegistryApp(
        harness.dependencies,
      ).request(humanRequest('/api/v1/cms/content-types'));
      await expectError(response, 500);
    } finally {
      policies.splice(0, policies.length, ...saved);
    }
  });

  it('uses the request id fallback for a route outside the CMS middleware', async () => {
    const response = await createContentSchemaRegistryApp(
      makeDependencies().dependencies,
    ).request(new Request('https://api.example.test/not-found'));
    expect(response.status).toBe(404);
  });

  it('exercises default and overridden fixture port results', async () => {
    const signal = new AbortController().signal;
    const fallback = makeDependencies();
    const invokePort = async (
      port: typeof fallback.ports.createTypeDraft,
    ): Promise<boolean> => {
      if (port === undefined) throw new Error('coverage fixture port missing');
      return (await port({}, signal)).ok;
    };
    expect(await invokePort(fallback.ports.createTypeDraft)).toBe(true);

    const overridden = makeDependencies({
      port: failure(409, 'CONFLICT'),
    });
    expect(await invokePort(overridden.ports.createTypeDraft)).toBe(false);
  });
});
