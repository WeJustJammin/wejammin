import { describe, expect, it } from 'vitest';

import { authError } from '../authentication/boundary';
import {
  bindEffectiveQueryScope,
  bindMutationScope,
  enforceConfigurationRate,
  hasServiceConsumerHeaders,
  isConfigurationStepUpFresh,
  releasePrincipalFromRequest,
  releasePrincipalHeadersValid,
  resolveReleasePrincipal,
  resolveServiceConsumer,
  serviceConsumerHeaders,
} from './route-support';
import {
  allowedRate,
  fakeHeadersRequest,
  makeContext,
  rateAuth,
  request,
} from './phase-02-slice-07-route-runtime-coverage.test-support';
import {
  otherId,
  releaseHeaders,
  serviceHeaders,
  sessionFor,
} from './phase-02-slice-07.test-support';

describe('Slice 07 verified release and service credentials', () => {
  it('validates release principals, signatures, and resolver outcomes', async () => {
    expect(
      releasePrincipalFromRequest(request('/', { headers: releaseHeaders })),
    ).toBe('header.release');
    expect(
      releasePrincipalFromRequest(
        request('/', {
          headers: { 'x-release-principal': 'one', 'x-worker-key-id': 'two' },
        }),
      ),
    ).toBeNull();
    expect(
      releasePrincipalFromRequest(
        request('/', { headers: { 'x-release-principal': '!' } }),
      ),
    ).toBeNull();
    expect(
      releasePrincipalFromRequest(
        fakeHeadersRequest({
          'x-release-principal': undefined,
          'x-worker-key-id': null,
          'x-producer-id': null,
        }),
      ),
    ).toBeNull();
    expect(
      releasePrincipalHeadersValid(request('/', { headers: releaseHeaders })),
    ).toBe(true);
    expect(
      releasePrincipalHeadersValid(
        request('/', {
          headers: { ...releaseHeaders, 'x-release-signature': 'short' },
        }),
      ),
    ).toBe(false);
    expect(
      releasePrincipalHeadersValid(
        fakeHeadersRequest({
          'x-release-principal': 'release.valid',
          'x-worker-key-id': null,
          'x-producer-id': null,
          'x-release-signature': undefined,
          'x-worker-signature': null,
          'x-producer-signature': null,
        }),
      ),
    ).toBe(false);

    const context = makeContext(
      request('/', { headers: releaseHeaders }),
    ).context;
    await expect(
      resolveReleasePrincipal(context, async () => ({
        ok: true as const,
        value: { principalId: 'verified.release' },
      })),
    ).resolves.toEqual({
      ok: true,
      value: { principalId: 'verified.release' },
    });
    await expect(resolveReleasePrincipal(context, undefined)).resolves.toEqual(
      expect.objectContaining({ ok: false, status: 503 }),
    );
    await expect(
      resolveReleasePrincipal(context, async () => {
        throw new Error('release down');
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 503 }));
    await expect(
      resolveReleasePrincipal(context, async () => ({}) as never),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 503 }));
    await expect(
      resolveReleasePrincipal(context, async () =>
        authError(401, 'UNAUTHENTICATED', 'bad signature'),
      ),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveReleasePrincipal(context, async () => ({
        ok: true as const,
        value: {} as never,
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveReleasePrincipal(context, async () => ({
        ok: true as const,
        value: { principalId: 'BAD' },
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
  });

  it('validates service-consumer headers and resolver outcomes', async () => {
    expect(hasServiceConsumerHeaders(request('/'))).toBe(false);
    expect(
      hasServiceConsumerHeaders(
        request('/', { headers: { 'x-consumer-key': 'web.profile' } }),
      ),
    ).toBe(true);
    expect(
      serviceConsumerHeaders(request('/', { headers: serviceHeaders })),
    ).toEqual({
      principalId: 'header.consumer',
      consumerKey: 'web.profile',
    });
    for (const headers of [
      { ...serviceHeaders, 'x-worker-consumer': 'x' },
      { ...serviceHeaders, 'x-consumer-key': 'not a key' },
      { ...serviceHeaders, 'x-worker-signature': 'short' },
      { 'x-worker-consumer': 'header.consumer' },
    ]) {
      expect(serviceConsumerHeaders(request('/', { headers }))).toBeNull();
    }

    await expect(
      resolveServiceConsumer(makeContext(request('/')).context, undefined),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));

    const context = makeContext(
      request('/', { headers: serviceHeaders }),
    ).context;
    await expect(
      resolveServiceConsumer(context, async () => ({
        ok: true as const,
        value: { principalId: 'verified.consumer', consumerKey: 'web.profile' },
      })),
    ).resolves.toEqual({
      ok: true,
      value: { principalId: 'verified.consumer', consumerKey: 'web.profile' },
    });
    await expect(resolveServiceConsumer(context, undefined)).resolves.toEqual(
      expect.objectContaining({ ok: false, status: 503 }),
    );
    await expect(
      resolveServiceConsumer(context, async () => {
        throw new Error('service down');
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 503 }));
    await expect(
      resolveServiceConsumer(context, async () => ({}) as never),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 503 }));
    await expect(
      resolveServiceConsumer(context, async () =>
        authError(401, 'UNAUTHENTICATED', 'bad signature'),
      ),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveServiceConsumer(context, async () => ({
        ok: true as const,
        value: {} as never,
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveServiceConsumer(context, async () => ({
        ok: true as const,
        value: { principalId: 'verified.consumer', consumerKey: 'other.key' },
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveServiceConsumer(context, async () => ({
        ok: true as const,
        value: { principalId: 'BAD', consumerKey: 'web.profile' },
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
    await expect(
      resolveServiceConsumer(context, async () => ({
        ok: true as const,
        value: { principalId: 'verified.consumer', consumerKey: 'not a key' },
      })),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 401 }));
  });
});

describe('Slice 07 verified scope and rate boundaries', () => {
  it('enforces fresh step-up and verified query/mutation scopes', () => {
    const session = sessionFor(402);
    const now = Date.parse('2026-09-02T03:00:00.000Z');
    expect(
      isConfigurationStepUpFresh({ ...session, stepUpAt: null }, now),
    ).toBe(false);
    // DEC-111 window: a proof up to 30 s ahead of the clock is skew, beyond it is stale.
    expect(
      isConfigurationStepUpFresh(
        { ...session, stepUpAt: new Date(now + 30_000).toISOString() },
        now,
      ),
    ).toBe(true);
    expect(
      isConfigurationStepUpFresh(
        { ...session, stepUpAt: new Date(now + 31_000).toISOString() },
        now,
      ),
    ).toBe(false);
    expect(
      isConfigurationStepUpFresh(
        { ...session, stepUpAt: new Date(now - 11 * 60 * 1000).toISOString() },
        now,
      ),
    ).toBe(false);
    expect(
      isConfigurationStepUpFresh(
        { ...session, stepUpAt: new Date(now - 30 * 1000).toISOString() },
        now,
      ),
    ).toBe(true);

    expect(
      bindEffectiveQueryScope(
        { partyId: session.actingPartyId, userId: session.authUserId },
        session,
      ),
    ).toEqual({
      ok: true,
      value: { partyId: session.actingPartyId, userId: session.authUserId },
    });
    expect(bindEffectiveQueryScope({ partyId: otherId }, session)).toEqual(
      expect.objectContaining({ ok: false, status: 403 }),
    );
    expect(bindEffectiveQueryScope({ userId: otherId }, session)).toEqual(
      expect.objectContaining({ ok: false, status: 403 }),
    );
    expect(bindEffectiveQueryScope({}, session)).toEqual({
      ok: true,
      value: {},
    });

    expect(
      bindMutationScope(
        { scopeType: 'party', scopeId: session.actingPartyId },
        session,
      ),
    ).toEqual({
      ok: true,
      value: { scopeType: 'party', scopeId: session.actingPartyId },
    });
    expect(
      bindMutationScope(
        { scopeType: 'user', scopeId: session.authUserId },
        session,
      ),
    ).toEqual({
      ok: true,
      value: { scopeType: 'user', scopeId: session.authUserId },
    });
    expect(
      bindMutationScope({ scopeType: 'user', scopeId: otherId }, session),
    ).toEqual(expect.objectContaining({ ok: false, status: 403 }));
    expect(
      bindMutationScope({ scopeType: 'party', scopeId: otherId }, session),
    ).toEqual(expect.objectContaining({ ok: false, status: 403 }));
    expect(bindMutationScope({}, session)).toEqual({ ok: true, value: {} });
    expect(
      bindMutationScope(
        { scopeType: 'party', scopeId: session.actingPartyId },
        { ...session, actingPartyId: null },
      ),
    ).toEqual(expect.objectContaining({ ok: false, status: 403 }));
  });

  it('merges remote and local rate decisions across verified identities', async () => {
    const session = sessionFor(403);
    const remote = allowedRate();
    expect(
      await enforceConfigurationRate(
        makeContext(request('/')).context,
        'CFG-05A-01',
        undefined,
        session,
        null,
      ),
    ).toEqual(expect.objectContaining({ status: 503 }));

    const remoteError = authError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'rate unavailable',
    );
    expect(
      await enforceConfigurationRate(
        makeContext(request('/')).context,
        'CFG-05A-01',
        rateAuth(remoteError),
        null,
        null,
      ),
    ).toEqual(expect.objectContaining({ status: 503 }));

    for (const [operationId, currentSession, principal, raw] of [
      ['CFG-05A-01', session, null, request('/')],
      [
        'CFG-05A-02',
        null,
        { principalId: 'verified.consumer', consumerKey: 'web.profile' },
        request('/'),
      ],
      [
        'CFG-05A-03',
        null,
        null,
        request('/', { headers: { 'cf-connecting-ip': '10.0.0.9' } }),
      ],
      ['CFG-05A-04', null, null, request('/')],
    ] as const) {
      expect(
        await enforceConfigurationRate(
          makeContext(raw).context,
          operationId,
          rateAuth(remote),
          currentSession,
          principal,
        ),
      ).toBeNull();
    }

    const localContext = makeContext(
      request('/', { headers: { 'cf-connecting-ip': '10.0.0.10' } }),
    ).context;
    expect(
      await enforceConfigurationRate(
        localContext,
        'CFG-05A-03',
        undefined,
        null,
        null,
      ),
    ).toBeNull();
    expect(
      await enforceConfigurationRate(
        localContext,
        'CFG-05A-03',
        undefined,
        null,
        null,
      ),
    ).toBeNull();
  });
});
