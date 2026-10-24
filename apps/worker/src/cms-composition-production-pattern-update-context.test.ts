import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPatternUpdateContextVerifier,
  type PatternUpdateRpcInput,
} from './cms-composition-production-pattern-update-rpc';
import {
  configuration,
  context,
  URL_,
} from './cms-composition-production-pattern-update-rpc.test-support';
import type { CmsEditorialServerSessionContext } from './cms-editorial-production-types';
import {
  puId,
  PU_PARTY_ID,
  PU_REQUEST_ID,
  PU_USER_ID,
} from './cms-composition/pattern-update.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';

/**
 * The fresh-context verifier in isolation: every way the session can drift between admission and the call. The named-RPC
 * caller is in `cms-composition-production-pattern-update-rpc.test.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe('createPatternUpdateContextVerifier', () => {
  const build = (
    refreshed: unknown,
    after: CmsEditorialServerSessionContext | null = context(),
    before: CmsEditorialServerSessionContext | null = context(),
    headers: Record<string, string> = { 'x-request-id': PU_REQUEST_ID },
  ) => {
    const request = new Request(URL_, { headers });
    const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
    if (before !== null) contexts.set(request, before);
    const resolve = vi.fn(async () => {
      if (after === null) contexts.delete(request);
      else contexts.set(request, after);
      return refreshed;
    });
    const verify = createPatternUpdateContextVerifier(
      contexts,
      resolve as never,
      configuration(),
    );
    const input = (
      overrides: Partial<PatternUpdateRpcInput> = {},
    ): PatternUpdateRpcInput => ({
      operationId: 'CMS-03C-13',
      request,
      requestId: PU_REQUEST_ID,
      session: puSession(),
      ...overrides,
    });
    return { verify, input, resolve };
  };
  const ok = (session = puSession()) => ({ ok: true as const, value: session });
  const signal = new AbortController().signal;

  it('rebuilds the server context from a fresh resolution of the same session', async () => {
    const { verify, input, resolve } = build(ok());
    expect(await verify(input(), signal)).toEqual({
      ok: true,
      value: {
        authUserId: PU_USER_ID,
        sessionId: puId(7),
        actorPersonId: puId(8),
        actingPartyId: PU_PARTY_ID,
        stepUpVerified: false,
        requestId: PU_REQUEST_ID,
        correlationId: PU_REQUEST_ID,
      },
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('accepts either author or editor', async () => {
    for (const capability of ['cms.author', 'cms.editor']) {
      const built = build(ok(puSession([capability])));
      expect((await built.verify(built.input(), signal)).ok).toBe(true);
    }
  });

  it.each([
    [
      'a request id that is not a UUID',
      { requestId: 'nope' },
      { 'x-request-id': PU_REQUEST_ID },
    ],
    ['an x-request-id header that disagrees', {}, { 'x-request-id': puId(99) }],
  ])('%s is 400 before any resolution', async (_n, over, headers) => {
    const { verify, input, resolve } = build(
      ok(),
      context(),
      context(),
      headers,
    );
    expect(await verify(input(over as never), signal)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('an x-request-id header that is not a UUID is ignored, not trusted', async () => {
    const { verify, input } = build(ok(), context(), context(), {
      'x-request-id': 'free text',
    });
    expect((await verify(input(), signal)).ok).toBe(true);
  });

  it('a Request never resolved by this boundary (a hand-supplied session) is 401', async () => {
    const { verify, input, resolve } = build(ok(), null, null);
    expect(await verify(input(), signal)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['another user', { session: { ...puSession(), userId: puId(50) } }],
    [
      'another acting party',
      { session: { ...puSession(), actingPartyId: puId(51) } },
    ],
  ])('a port session of %s is 401 before any resolution', async (_n, over) => {
    const { verify, input, resolve } = build(ok());
    expect(await verify(input(over as never), signal)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('a refused fresh resolution passes its refusal through', async () => {
    const { verify, input } = build({
      ok: false,
      status: 503,
      code: 'X',
      message: 'x',
      details: { dependencyClass: 'authentication' },
      retryAfterSeconds: 5,
    });
    expect(await verify(input(), signal)).toMatchObject({
      ok: false,
      status: 503,
      details: { dependencyClass: 'authentication' },
      retryAfterSeconds: 5,
    });
  });

  it('a fresh resolution that is not an envelope is 502', async () => {
    const built = build('nope');
    expect(await built.verify(built.input(), signal)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it.each([
    ['another session', context({ sessionId: puId(60) })],
    ['another user', context({ authUserId: puId(61) })],
    ['another acting party', context({ actingPartyId: puId(62) })],
    ['another person', context({ actorPersonId: puId(63) })],
    ['no recorded context', null],
  ])('a fresh resolution of %s is 401', async (_n, after) => {
    const built = build(ok(), after);
    expect(await built.verify(built.input(), signal)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it('a malformed fresh session is 401', async () => {
    const built = build(ok({ ...puSession(), userId: 'nope' }));
    expect(await built.verify(built.input(), signal)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it.each([
    ['revoked', puSession([])],
    ['designer only', puSession(['cms.template_designer'])],
  ])(
    'a capability that is %s since admission is 403 capability_missing',
    async (_n, session) => {
      const built = build(ok(session));
      expect(await built.verify(built.input(), signal)).toMatchObject({
        ok: false,
        status: 403,
        details: { reasonCode: 'capability_missing' },
      });
    },
  );

  it('a fresh session that lost its acting party is 403 capability_missing (authority is party-scoped)', async () => {
    const built = build(ok({ ...puSession(), actingPartyId: null }));
    expect(await built.verify(built.input(), signal)).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
  });

  it('a revoked author is 403 on the same party', async () => {
    const built = build(ok(puSession([])));
    expect(await built.verify(built.input(), signal)).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
  });
});
