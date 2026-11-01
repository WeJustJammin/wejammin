import { webcrypto } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CmsLocaleDependencies } from '../../../apps/worker/src/cms-composition/locale-routes';
import type { CmsTemplateDependencies } from '../../../apps/worker/src/cms-composition/template-routes';
import {
  createS12RealLocale,
  createS12RealTemplate,
} from './s12-real-template-locale';
import { SESSION_SIGNING_SECRET } from './s09-session-authority';
import { S10_CAPABILITIES_CLAIM, S10_PARTY_CLAIM } from './s10-session-claims';
import { S11_PERSON_CLAIM } from './s11-session-claims';

/*
 * The real-route launcher gives `cmsTemplate` and `cmsLocale` two homes: the test-owned fixtures
 * (lane and legacy fixture sessions) and the PRODUCTION composition (a session carrying the Slice
 * 11/12 claims). Evidence: pw5 run 1 answered 303-to-sign-in in ~12 ms with no API request for a
 * signed-in Slice 11/12 session, because the fixture resolveSession did not recognise it (401).
 * These tests prove the routing by behaviour: which resolver answered, and which transport ran.
 */
const bindings = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'sb_secret_local_routing_probe',
  S10_HUMAN_ORIGINS: 'http://127.0.0.1:4324',
};
const USER = '10000000-0000-4000-8000-0000000000a1';
const PARTY = '20000000-0000-4000-8000-0000000000a2';
const PERSON = '30000000-0000-4000-8000-0000000000a3';
const SESSION = '80000000-0000-4000-8000-0000000000a4';
const FIXTURE_USER = '10000000-0000-4000-8000-000000000001';

const b64 = (value: Uint8Array | string): string =>
  Buffer.from(value).toString('base64url');

const cookieFor = async (
  claims: Readonly<Record<string, unknown>>,
  sub = USER,
): Promise<string> => {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(
    JSON.stringify({
      ...claims,
      exp: Math.floor(Date.now() / 1_000) + 3_600,
      session_id: SESSION,
      sub,
    }),
  );
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SESSION_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = b64(
    new Uint8Array(
      await webcrypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ),
  );
  return `wj_session_ref=ref; wj_access=${header}.${payload}.${signature}`;
};

const realClaims = {
  [S10_PARTY_CLAIM]: PARTY,
  [S11_PERSON_CLAIM]: PERSON,
  [S10_CAPABILITIES_CLAIM]: ['cms.template_designer', 'cms.author'],
};
const requestWith = (cookie: string): Request =>
  new Request('http://127.0.0.1:8790/api/v1/cms/templates/context', {
    headers: { cookie },
  });
const signal = new AbortController().signal;

const fixtureSession = {
  userId: FIXTURE_USER,
  actingPartyId: '20000000-0000-4000-8000-000000000002',
  capabilities: ['cms.author'],
  mfaFresh: false,
};
const sentinel = { ok: false, status: 503, code: 'FIXTURE', message: 'x' };

const templateBase = () => {
  const spies = {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: fixtureSession,
    })),
    rateLimit: vi.fn(async () => sentinel),
    defineTemplate: vi.fn(async () => sentinel),
    readContext: vi.fn(async () => sentinel),
    readLatest: vi.fn(async () => sentinel),
    telemetry: vi.fn(),
  };
  const base = {
    humanOrigins: ['http://127.0.0.1:4324'],
    now: Date.now,
    ...spies,
  } as unknown as CmsTemplateDependencies;
  return { base, spies };
};

const localeBase = () => {
  const spies = {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: fixtureSession,
    })),
    rateLimit: vi.fn(async () => sentinel),
    authorLocale: vi.fn(async () => sentinel),
    readLocaleVariant: vi.fn(async () => sentinel),
    telemetry: vi.fn(),
  };
  const base = {
    humanOrigins: ['http://127.0.0.1:4324'],
    now: Date.now,
    ...spies,
  } as unknown as CmsLocaleDependencies;
  return { base, spies };
};

const fetchSpy = () => {
  const spy = vi.fn(
    async () =>
      new Response(JSON.stringify({ message: 'probe' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('S12 real-route template routing', () => {
  it('answers a Slice 11/12 session through the production composition', async () => {
    const { base, spies } = templateBase();
    const calls = fetchSpy();
    const routed = createS12RealTemplate(base, bindings, new Set());
    const request = requestWith(await cookieFor(realClaims));
    const session = await routed.resolveSession(request, signal);
    expect(spies.resolveSession).not.toHaveBeenCalled();
    expect(session).toMatchObject({
      ok: true,
      value: { userId: USER, actingPartyId: PARTY },
    });
    if (!session.ok) throw new Error('session expected');
    expect(session.value.capabilities).toEqual(
      expect.arrayContaining(['cms.template_designer']),
    );
    await routed.readContext(
      {
        operationId: 'cmsTemplateContextRead',
        requestId: 'req-1',
        request,
        session: session.value,
      } as never,
      signal,
    );
    expect(spies.readContext).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledTimes(1);
    expect(String((calls.mock.calls[0] as unknown[])[0])).toContain(
      '/rest/v1/rpc/cms_template_context',
    );
    await routed.rateLimit({ request } as never, signal);
    expect(spies.rateLimit).not.toHaveBeenCalled();
  });

  it('keeps a fixture or lane session on the fixture port, byte for byte', async () => {
    const { base, spies } = templateBase();
    const calls = fetchSpy();
    const routed = createS12RealTemplate(base, bindings, new Set());
    const request = requestWith('wj_session_ref=ref; wj_access=not-a-claim');
    expect(await routed.resolveSession(request, signal)).toEqual({
      ok: true,
      value: fixtureSession,
    });
    expect(spies.resolveSession).toHaveBeenCalledTimes(1);
    expect(await routed.readContext({ request } as never, signal)).toBe(
      sentinel,
    );
    expect(await routed.readLatest({ request } as never, signal)).toBe(
      sentinel,
    );
    expect(await routed.defineTemplate({ request } as never, signal)).toBe(
      sentinel,
    );
    expect(await routed.rateLimit({ request } as never, signal)).toBe(sentinel);
    expect(calls).not.toHaveBeenCalled();
    expect(routed.now).toBe(base.now);
    routed.telemetry({ operationId: 'x' } as never);
    expect(spies.telemetry).toHaveBeenCalledTimes(1);
  });

  it('treats a signed session without the party claim as a fixture session', async () => {
    const { base, spies } = templateBase();
    const routed = createS12RealTemplate(base, bindings, new Set());
    const request = requestWith(await cookieFor({}, FIXTURE_USER));
    await routed.resolveSession(request, signal);
    expect(spies.resolveSession).toHaveBeenCalledTimes(1);
  });

  it('keeps a revoked Slice 11/12 session off production', async () => {
    const { base, spies } = templateBase();
    const routed = createS12RealTemplate(base, bindings, new Set([SESSION]));
    await routed.resolveSession(
      requestWith(await cookieFor(realClaims)),
      signal,
    );
    expect(spies.resolveSession).toHaveBeenCalledTimes(1);
  });

  it('accepts the fixture and the configured human origins', () => {
    const { base } = templateBase();
    const routed = createS12RealTemplate(base, bindings, new Set());
    expect(routed.humanOrigins).toContain('http://127.0.0.1:4324');
  });
});

describe('S12 real-route locale routing', () => {
  it('answers a Slice 11/12 session through the production composition', async () => {
    const { base, spies } = localeBase();
    const calls = fetchSpy();
    const routed = createS12RealLocale(base, bindings, new Set());
    const request = requestWith(await cookieFor(realClaims));
    const session = await routed.resolveSession(request, signal);
    expect(spies.resolveSession).not.toHaveBeenCalled();
    expect(session).toMatchObject({
      ok: true,
      value: { userId: USER, actingPartyId: PARTY },
    });
    if (!session.ok) throw new Error('session expected');
    await routed.readLocaleVariant(
      {
        operationId: 'cmsLocaleVariantRead',
        requestId: 'req-2',
        request,
        session: session.value,
        path: {
          entryId: 'd1000000-0000-4000-8000-000000000001',
          locale: 'fr-FR',
        },
      } as never,
      signal,
    );
    expect(calls).toHaveBeenCalledTimes(1);
    expect(spies.readLocaleVariant).not.toHaveBeenCalled();
    await routed.rateLimit({ request } as never, signal);
    expect(spies.rateLimit).not.toHaveBeenCalled();
  });

  it('keeps a fixture session on the fixture port, byte for byte', async () => {
    const { base, spies } = localeBase();
    const calls = fetchSpy();
    const routed = createS12RealLocale(base, bindings, new Set());
    const request = requestWith('wj_session_ref=ref; wj_access=not-a-claim');
    await routed.resolveSession(request, signal);
    expect(spies.resolveSession).toHaveBeenCalledTimes(1);
    expect(await routed.authorLocale({ request } as never, signal)).toBe(
      sentinel,
    );
    expect(await routed.rateLimit({ request } as never, signal)).toBe(sentinel);
    expect(calls).not.toHaveBeenCalled();
    routed.telemetry({ operationId: 'x' } as never);
    expect(spies.telemetry).toHaveBeenCalledTimes(1);
  });

  it('sends the locale read of a fixture session to the fixture port', async () => {
    const { base, spies } = localeBase();
    const calls = fetchSpy();
    const routed = createS12RealLocale(base, bindings, new Set());
    const request = requestWith('wj_session_ref=ref; wj_access=not-a-claim');
    expect(await routed.readLocaleVariant({ request } as never, signal)).toBe(
      sentinel,
    );
    expect(spies.readLocaleVariant).toHaveBeenCalledTimes(1);
    expect(calls).not.toHaveBeenCalled();
  });
});
