// RPC-context derivation coverage for the CMS-03B editorial production
// adapter: server-side session cache keys, step-up freshness projection, and
// request-scoped body projection when no session resolved.
import { describe, expect, it, vi } from 'vitest';

import {
  ENTRY_ID,
  PARTY_ID,
  SCHEMA_VERSION_ID,
  REQUEST_ID,
  captureInit,
  compose,
  json,
  portInput,
  request,
  revisionResource,
} from './cms-editorial-production.test-support';
import {
  NOW,
  PERSON_ID,
  SESSION_ID,
  USER_ID,
  authenticationSession,
} from './cms-editorial-production-session-test-support';
import { validateCmsEditorialPortInput } from './cms-editorial-production-session';

describe('cms editorial session resolution', () => {
  it('derives the RPC context from the server-side session cache', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      now: () => NOW,
      auth: {
        resolveSession: (async () => ({
          ok: true,
          value: authenticationSession(),
        })) as never,
      },
      resolveCapabilities: ['cms.author'],
    });
    const inbound = request();
    const resolved = await dependencies.resolveSession(
      inbound,
      new AbortController().signal,
    );
    expect(resolved.ok).toBe(true);
    await dependencies.ports.appendRevision(
      portInput({ request: inbound, session: undefined }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: { context: Record<string, unknown> };
    };
    expect(body.p_request.context).toMatchObject({
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
    });
  });

  it('derives stepUpVerified from the same freshness window as mfaFresh', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      now: () => NOW,
      auth: {
        resolveSession: (async () => ({
          ok: true,
          value: authenticationSession({
            stepUpAt: '2026-09-26T10:00:00.000Z',
          }),
        })) as never,
      },
      resolveCapabilities: ['cms.author'],
    });
    const inbound = request();
    const resolved = await dependencies.resolveSession(
      inbound,
      new AbortController().signal,
    );
    expect(resolved).toMatchObject({ ok: true, value: { mfaFresh: false } });
    await dependencies.ports.appendRevision(
      portInput({ request: inbound, session: undefined }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: { context: Record<string, unknown> };
    };
    expect(body.p_request.context.stepUpVerified).toBe(false);
  });

  it('marks a future-dated step-up proof unverified rather than fresh', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      now: () => NOW,
      auth: {
        resolveSession: (async () => ({
          ok: true,
          value: authenticationSession({
            stepUpAt: '2026-09-26T12:05:00.000Z',
          }),
        })) as never,
      },
      resolveCapabilities: ['cms.author'],
    });
    const inbound = request();
    await dependencies.resolveSession(inbound, new AbortController().signal);
    await dependencies.ports.appendRevision(
      portInput({ request: inbound, session: undefined }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: { context: Record<string, unknown> };
    };
    expect(body.p_request.context.stepUpVerified).toBe(false);
  });

  it('omits server-only context keys when no session was resolved', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    await dependencies.ports.appendRevision(
      portInput({
        session: undefined,
        body: undefined,
        path: undefined,
        query: { locale: 'en-US' },
        ifMatch: '1',
      }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown> & { context: Record<string, unknown> };
    };
    expect(body.p_request.context.authUserId).toBeUndefined();
    expect(body.p_request.context.sessionId).toBeUndefined();
    expect(body.p_request.context.actingPartyId).toBeNull();
    expect(body.p_request.context.stepUpVerified).toBe(false);
    expect(body.p_request.expectedVersion).toBe('1');
    expect(body.p_request.locale).toBe('en-US');
    expect(body.p_request.entryId).toBeUndefined();
  });

  it('falls back to the request id when the correlation header is invalid', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    await dependencies.ports.appendRevision(
      portInput({
        request: new Request('https://api.example.test/x', {
          headers: { 'x-request-id': REQUEST_ID, 'x-correlation-id': 'nope' },
        }),
      }),
      new AbortController().signal,
    );
    const headers = captureInit(fetchImpl).init.headers as Record<
      string,
      string
    >;
    expect(headers['X-Correlation-Id']).toBe(REQUEST_ID);
  });

  it('keeps the declared entry path in the projected body', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    await dependencies.ports.appendRevision(
      portInput({ path: { entryId: ENTRY_ID }, ifMatch: '1' }),
      new AbortController().signal,
    );
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request.entryId).toBe(ENTRY_ID);
    expect(body.p_request.expectedVersion).toBe('1');
    expect(SCHEMA_VERSION_ID.length).toBeGreaterThan(0);
  });

  it('[P2-S10-AC-089] [P2-S10-AC-095] [P2-S10-AC-101] rejects an unsafe S10 read precondition before any transport call', () => {
    // RED: no CMS-03B-12/13/14 read precondition branch exists, so the guard
    // returns null even for input that must be refused (a read carrying a
    // mutation header and body, an undeclared query key, and an extra path id).
    const rejected = validateCmsEditorialPortInput(
      portInput({
        operationId: 'CMS-03B-12' as 'CMS-03B-11',
        path: {
          entryId: ENTRY_ID,
          conflictId: '30000000-0000-4000-8000-0000000000ff',
        },
        query: { state: 'open' },
        idempotencyKey: 'mutation-key',
        ifMatch: '2',
      }),
      'CMS-03B-12' as 'CMS-03B-11',
    );
    expect(rejected).not.toBeNull();
    expect(rejected).toMatchObject({ ok: false, status: 400 });
  });
});
