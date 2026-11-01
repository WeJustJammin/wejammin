import { describe, expect, it, vi } from 'vitest';

import type { CmsEditorialSession } from './cms-editorial/types';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import { actEnvironment } from './cms-composition-production-taxonomy-act.test-support';
import {
  createTaxonomyContextVerifier,
  createTaxonomyTransport,
} from './cms-composition-production-taxonomy-context';
import type { TaxonomyBaseInput } from './cms-composition/taxonomy-definition-shared';

/**
 * The fresh-context verifier of every taxonomy RPC: it never trusts the first resolution. Each refusal here happens
 * before any network, so a hand-built Request, a different session or a revoked capability can not reach the database.
 */
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';
const PARTY = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '77777777-7777-4777-8777-777777777777';
const PERSON = '88888888-8888-4888-8888-888888888888';
const configuration = {
  now: () => 1_000,
} as unknown as CmsEditorialProductionConfiguration;
const server = (
  overrides: Partial<CmsEditorialServerSessionContext> = {},
): CmsEditorialServerSessionContext => ({
  authUserId: USER,
  sessionId: SESSION_ID,
  actorPersonId: PERSON,
  actingPartyId: PARTY,
  stepUpAt: null,
  ...overrides,
});
const session = (
  capabilities: readonly string[] = ['cms.taxonomy_curator'],
): CmsEditorialSession => ({
  userId: USER,
  actingPartyId: PARTY,
  capabilities,
  mfaFresh: false,
});

const setup = (
  options: {
    before?: CmsEditorialServerSessionContext | null;
    after?: CmsEditorialServerSessionContext;
    refreshed?: unknown;
    headers?: Record<string, string>;
    requestId?: string;
    operationId?: TaxonomyBaseInput['operationId'];
    session?: CmsEditorialSession;
  } = {},
) => {
  const request = new Request('https://api.example.test/x', {
    headers: options.headers ?? {},
  });
  const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
  if (options.before !== null)
    contexts.set(request, options.before ?? server());
  const resolveSession = vi.fn(async (req: Request) => {
    if (options.after !== undefined) contexts.set(req, options.after);
    return (options.refreshed ?? { ok: true, value: session() }) as never;
  });
  const verify = createTaxonomyContextVerifier(
    contexts,
    resolveSession,
    configuration,
  );
  const input: TaxonomyBaseInput = {
    operationId: options.operationId ?? 'cmsTaxonomyTermsRead',
    request,
    requestId: options.requestId ?? REQUEST_ID,
    session: options.session ?? session(),
  };
  return { verify, input, resolveSession };
};

const run = async (options: Parameters<typeof setup>[0] = {}) => {
  const { verify, input, resolveSession } = setup(options);
  return {
    result: await verify(input, new AbortController().signal),
    resolveSession,
  };
};

describe('createTaxonomyContextVerifier', () => {
  it('builds the server context from the fresh resolution', async () => {
    const { result } = await run();
    expect(result).toMatchObject({
      ok: true,
      value: {
        authUserId: USER,
        sessionId: SESSION_ID,
        actorPersonId: PERSON,
        actingPartyId: PARTY,
        stepUpVerified: false,
        requestId: REQUEST_ID,
        correlationId: REQUEST_ID,
      },
    });
  });

  it.each([
    ['a request id that is not a UUID', { requestId: 'nope' }],
    [
      'an x-request-id header that names another request',
      { headers: { 'x-request-id': '99999999-9999-4999-8999-999999999999' } },
    ],
  ])(
    '%s is a 400 before the session is resolved again',
    async (_n, options) => {
      const { result, resolveSession } = await run(options);
      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(resolveSession).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no server-resolved session for the Request', { before: null }],
    [
      'another user than the admitted session',
      { before: server({ authUserId: PARTY }) },
    ],
    [
      'another acting party than the admitted session',
      { before: server({ actingPartyId: USER }) },
    ],
  ])(
    '%s is a 401 before the session is resolved again',
    async (_n, options) => {
      const { result, resolveSession } = await run(options);
      expect(result).toMatchObject({ ok: false, status: 401 });
      expect(resolveSession).not.toHaveBeenCalled();
    },
  );

  it('an invalid resolver envelope is a retryable 502 and a resolver refusal is relayed', async () => {
    expect((await run({ refreshed: 'x' })).result).toMatchObject({
      ok: false,
      status: 502,
    });
    expect(
      (
        await run({
          refreshed: {
            ok: false,
            status: 429,
            details: { limit: 1 },
            retryAfterSeconds: 7,
          },
        })
      ).result,
    ).toMatchObject({ ok: false, status: 429, retryAfterSeconds: 7 });
  });

  it.each([
    ['session', { sessionId: '99999999-9999-4999-8999-999999999990' }],
    ['user', { authUserId: PARTY }],
    ['acting party', { actingPartyId: USER }],
    ['person', { actorPersonId: USER }],
  ])('a changed %s across the refresh is a 401', async (_n, change) => {
    const { result } = await run({ after: server(change) });
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('a Request whose context vanished during the refresh is a 401', async () => {
    const request = new Request('https://api.example.test/x');
    const contexts = new WeakMap<Request, CmsEditorialServerSessionContext>();
    contexts.set(request, server());
    const verify = createTaxonomyContextVerifier(
      contexts,
      (async (req: Request) => {
        contexts.delete(req);
        return { ok: true, value: session() };
      }) as never,
      configuration,
    );
    expect(
      await verify(
        {
          operationId: 'cmsTaxonomyTermsRead',
          request,
          requestId: REQUEST_ID,
          session: session(),
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 401 });
  });

  it.each(['cmsTaxonomyTermsRead', 'CMS-03C-17'] as const)(
    'a fresh session without a usable human identity is a 401 for %s',
    async (operationId) => {
      const bad = {
        ...session(['cms.taxonomy_curator', 'cms.author']),
        userId: '',
      };
      expect(
        (await run({ operationId, refreshed: { ok: true, value: bad } }))
          .result,
      ).toMatchObject({ ok: false, status: 401 });
    },
  );

  it('proves the operation capability on the fresh session: curator for the term store, author or editor for the selector', async () => {
    expect(
      (await run({ refreshed: { ok: true, value: session([]) } })).result,
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      (
        await run({
          operationId: 'CMS-03C-17',
          refreshed: { ok: true, value: session(['cms.taxonomy_curator']) },
        })
      ).result,
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      (
        await run({
          operationId: 'CMS-03C-17',
          refreshed: { ok: true, value: session(['cms.editor']) },
        })
      ).result,
    ).toMatchObject({ ok: true });
  });
});

describe('createTaxonomyTransport', () => {
  it('refuses an operation it has no named RPC for, before any network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const { rpc } = createTaxonomyTransport({
      environment: actEnvironment,
      fetchImpl,
    });
    expect(
      await rpc(
        {
          operationId: 'toString' as never,
          request: new Request('https://api.example.test/x'),
          requestId: REQUEST_ID,
          session: session(),
        },
        {},
        ((): boolean => false) as never,
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [{ maxResponseBytes: 1 }],
    [{ maxResponseBytes: 1.5 }],
    [{ deadlineMs: 0 }],
    [{ deadlineMs: 2.5 }],
  ])('refuses the configuration %j at composition', (options) => {
    expect(() =>
      createTaxonomyTransport({ environment: actEnvironment, ...options }),
    ).toThrow('Invalid CMS taxonomy configuration.');
  });

  it('defaults to the global fetch and the 15,000 ms command deadline, and clamps a larger deadline', () => {
    const fallback = createTaxonomyTransport({ environment: actEnvironment });
    expect(fallback.deadlineMs).toBe(15_000);
    expect(fallback.configuration.fetchImpl).toBeTypeOf('function');
    expect(
      createTaxonomyTransport({
        environment: actEnvironment,
        deadlineMs: 60_000,
      }).deadlineMs,
    ).toBe(15_000);
  });
});
