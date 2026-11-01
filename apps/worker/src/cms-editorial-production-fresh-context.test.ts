import { describe, expect, it, vi } from 'vitest';

import { createFreshContextVerifier } from './cms-editorial-production-fresh-context';
import type {
  CmsEditorialServerSessionContext,
  CmsEditorialSession,
} from './cms-editorial-production-types';
import {
  configuration,
  context,
  URL_,
} from './cms-composition-production-pattern-update-rpc.test-support';
import {
  puId,
  PU_PARTY_ID,
  PU_REQUEST_ID,
} from './cms-composition/pattern-update.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';

/**
 * The shared request-bound verifier with a marker `failure`, a stand-in envelope guard and a scripted authorizer: only
 * the identity re-proof lives in the helper; every refusal body, the envelope shape and the capability decision belong
 * to the caller. The three production adopters (pattern update, pattern definition, governed review) each keep their
 * own behavioural suites.
 */
type MarkError = Readonly<{
  ok: false;
  status: 400 | 401 | 403 | 502 | 503;
  code: string;
  details: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;
type MarkResult<T> = Readonly<{ ok: true; value: T }> | MarkError;

const mark = (
  status: MarkError['status'],
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): MarkError => ({
  ok: false,
  status,
  code: `MARK-${String(status)}`,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});
const markEnvelope = <T>(value: unknown): value is MarkResult<T> =>
  typeof value === 'object' && value !== null && 'ok' in value;

const signal = new AbortController().signal;
const ok = (session: CmsEditorialSession = puSession()) => ({
  ok: true as const,
  value: session,
});

const build = (
  refreshed: unknown,
  options: {
    after?: CmsEditorialServerSessionContext | null;
    before?: CmsEditorialServerSessionContext | null;
    headers?: Record<string, string>;
    authorize?: (session: CmsEditorialSession) => MarkError | null;
  } = {},
) => {
  const after = options.after === undefined ? context() : options.after;
  const before = options.before === undefined ? context() : options.before;
  const request = new Request(URL_, {
    headers: options.headers ?? { 'x-request-id': PU_REQUEST_ID },
  });
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  if (before !== null) contexts.set(request, before);
  const resolveSession = vi.fn(async () => {
    if (after === null) contexts.delete(request);
    else contexts.set(request, after);
    return refreshed;
  });
  const authorize = vi.fn(options.authorize ?? (() => null));
  const verify = createFreshContextVerifier({
    contexts,
    resolveSession,
    configuration: configuration(),
    failure: mark,
    validEnvelope: markEnvelope,
    authorize,
  });
  const input = (over: Record<string, unknown> = {}) => ({
    request,
    requestId: PU_REQUEST_ID,
    session: puSession(),
    ...over,
  });
  return { verify, input, resolveSession, authorize };
};

describe('createFreshContextVerifier', () => {
  it('rebuilds the server context from a fresh resolution of the same session', async () => {
    const { verify, input, resolveSession, authorize } = build(ok());
    expect(await verify(input(), signal)).toEqual({
      ok: true,
      value: {
        authUserId: context().authUserId,
        sessionId: puId(7),
        actorPersonId: puId(8),
        actingPartyId: PU_PARTY_ID,
        stepUpVerified: false,
        requestId: PU_REQUEST_ID,
        correlationId: PU_REQUEST_ID,
      },
    });
    expect(resolveSession).toHaveBeenCalledTimes(1);
    expect(resolveSession).toHaveBeenCalledWith(input().request, signal);
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it('hands the authorizer the REFRESHED session and the port input, not the admitted session', async () => {
    const fresh = puSession(['cms.editor']);
    const { verify, input, authorize } = build(ok(fresh));
    const admitted = input();
    await verify(admitted, signal);
    expect(authorize).toHaveBeenCalledWith(fresh, admitted);
    expect(authorize.mock.calls[0]?.[0]).not.toBe(admitted.session);
  });

  it('returns the authorizer refusal verbatim and builds no context', async () => {
    const refusal = mark(403, { reasonCode: 'capability_missing' });
    const { verify, input } = build(ok(), { authorize: () => refusal });
    expect(await verify(input(), signal)).toBe(refusal);
  });

  it.each([
    ['a request id that is not a UUID', { requestId: 'nope' }, undefined],
    ['an x-request-id header that disagrees', {}, { 'x-request-id': puId(99) }],
  ])(
    '%s is 400 before any resolution, in the caller catalog',
    async (_name, over, headers) => {
      const built = build(ok(), headers === undefined ? {} : { headers });
      expect(await built.verify(built.input(over), signal)).toEqual(mark(400));
      expect(built.resolveSession).not.toHaveBeenCalled();
      expect(built.authorize).not.toHaveBeenCalled();
    },
  );

  it('a request id that is not a UUID is 400 even when no x-request-id header corroborates it', async () => {
    const built = build(ok(), { headers: {} });
    expect(
      await built.verify(built.input({ requestId: 'nope' }), signal),
    ).toEqual(mark(400));
    expect(built.resolveSession).not.toHaveBeenCalled();
  });

  it('an x-request-id header that is not a UUID is ignored, not trusted', async () => {
    const built = build(ok(), { headers: { 'x-request-id': 'free text' } });
    expect((await built.verify(built.input(), signal)).ok).toBe(true);
  });

  it('a Request never resolved by this boundary is 401 before any resolution', async () => {
    const built = build(ok(), { after: null, before: null });
    expect(await built.verify(built.input(), signal)).toEqual(mark(401));
    expect(built.resolveSession).not.toHaveBeenCalled();
  });

  it.each([
    ['another user', { session: { ...puSession(), userId: puId(50) } }],
    [
      'another acting party',
      { session: { ...puSession(), actingPartyId: puId(51) } },
    ],
  ])('a port session of %s is 401 before any resolution', async (_n, over) => {
    const built = build(ok());
    expect(await built.verify(built.input(over), signal)).toEqual(mark(401));
    expect(built.resolveSession).not.toHaveBeenCalled();
  });

  it('a refused fresh resolution is relayed with its details and retry hint through the caller failure', async () => {
    const built = build({
      ok: false,
      status: 503,
      details: { dependencyClass: 'authentication' },
      retryAfterSeconds: 5,
    });
    expect(await built.verify(built.input(), signal)).toEqual(
      mark(503, { dependencyClass: 'authentication' }, 5),
    );
    expect(built.authorize).not.toHaveBeenCalled();
  });

  it('a refused fresh resolution without details relays an empty details object', async () => {
    const built = build({ ok: false, status: 503 });
    expect(await built.verify(built.input(), signal)).toEqual(mark(503));
  });

  it('a fresh resolution that is not an envelope is 502', async () => {
    const built = build('nope');
    expect(await built.verify(built.input(), signal)).toEqual(mark(502));
    expect(built.authorize).not.toHaveBeenCalled();
  });

  it.each([
    ['another session', context({ sessionId: puId(60) })],
    ['another user', context({ authUserId: puId(61) })],
    ['another acting party', context({ actingPartyId: puId(62) })],
    ['another person', context({ actorPersonId: puId(63) })],
    ['no recorded context', null],
  ])(
    'a fresh resolution of %s is 401 and never reaches the authorizer',
    async (_n, after) => {
      const built = build(ok(), { after });
      expect(await built.verify(built.input(), signal)).toEqual(mark(401));
      expect(built.authorize).not.toHaveBeenCalled();
    },
  );

  it('a malformed fresh session is 401 and never reaches the authorizer', async () => {
    const built = build(ok({ ...puSession(), userId: 'nope' }));
    expect(await built.verify(built.input(), signal)).toEqual(mark(401));
    expect(built.authorize).not.toHaveBeenCalled();
  });
});
