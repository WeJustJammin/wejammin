import { describe, expect, it } from 'vitest';

import {
  bindings,
  contextFor,
  expectApiError,
  request,
} from './phase-02-slice-08-worker.test-support';
import { makeResetHarness } from './admin-mfa-reset.test-support';

const PATH = '/api/v1/admin/capability-snapshot';

const snapshotRequest = (
  query = '',
  headers: Readonly<Record<string, string | undefined>> = {},
): Request =>
  request(
    `${PATH}${query}`,
    { method: 'GET' },
    {
      authorization: 'Bearer verified-session',
      ...headers,
    },
  );

const send = (
  harness: ReturnType<typeof makeResetHarness>,
  req: Request = snapshotRequest(),
) => harness.app.fetch(req, bindings);

describe('CFG-05B-07 admin capability snapshot route', () => {
  it('returns only the named admin capabilities of the verified context', async () => {
    const harness = makeResetHarness({
      context: contextFor([
        'admin.identity.mfa_reset',
        'cms.editor',
        'admin.inbox.read',
      ]),
    });
    const response = await send(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      capabilities: ['admin.identity.mfa_reset', 'admin.inbox.read'],
    });
  });

  it('projects the settings.* command namespace and drops every other domain', async () => {
    const harness = makeResetHarness({
      context: contextFor([
        'settings.rollback',
        'configuration.editor',
        'cms.editor',
        'settings.approve',
        'admin.inbox.read',
      ]),
    });
    const response = await send(harness);
    expect(await response.json()).toEqual({
      capabilities: [
        'settings.rollback',
        'settings.approve',
        'admin.inbox.read',
      ],
    });
  });

  it('drops the whole snapshot when a context capability is outside the published admin name grammar', async () => {
    const harness = makeResetHarness({
      context: contextFor(['admin.inbox.read', 'admin.scoped:grant']),
    });
    const response = await send(harness);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ capabilities: [] });
  });

  it('needs no named capability: an actor with none gets an empty list', async () => {
    const harness = makeResetHarness({ context: contextFor([]) });
    const response = await send(harness);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ capabilities: [] });
  });

  it('never reads a capability claim from the browser request', async () => {
    const harness = makeResetHarness({ context: contextFor([]) });
    const response = await send(
      harness,
      snapshotRequest('', {
        'x-configuration-capabilities': 'admin.identity.mfa_reset',
        'x-capabilities': 'admin.identity.mfa_reset',
      }),
    );
    expect(await response.json()).toEqual({ capabilities: [] });
  });

  it('carries no person, party, session or grant identifier', async () => {
    const harness = makeResetHarness();
    const body = (await (await send(harness)).json()) as Record<
      string,
      unknown
    >;
    expect(Object.keys(body)).toEqual(['capabilities']);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/u);
  });

  it('is 401 UNAUTHENTICATED without a session credential', async () => {
    const harness = makeResetHarness();
    const response = await send(
      harness,
      snapshotRequest('', { authorization: undefined }),
    );
    await expectApiError(response, 401, 'UNAUTHENTICATED');
  });

  it('is 403 for a foreign origin', async () => {
    const harness = makeResetHarness();
    const response = await send(
      harness,
      snapshotRequest('', { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it.each(['?role=admin', '?actorId=x', '?capabilities=admin.inbox.read'])(
    'is 400 for any query string (%s)',
    async (query) => {
      const harness = makeResetHarness();
      await expectApiError(
        await send(harness, snapshotRequest(query)),
        400,
        'INVALID_REQUEST',
      );
    },
  );

  it('is 503 when the authorization context is unavailable', async () => {
    const harness = makeResetHarness({
      resolveContext: () => Promise.reject(new Error('rpc down')),
    });
    const response = await send(harness);
    await expectApiError(response, 503, 'DEPENDENCY_UNAVAILABLE');
  });

  it('is 401 when the resolved context is invalid', async () => {
    const harness = makeResetHarness({
      resolveContext: () => Promise.resolve(null),
    });
    await expectApiError(await send(harness), 401, 'UNAUTHENTICATED');
  });

  it('charges the CFG-05B-07 rate bucket and answers 429 when exhausted', async () => {
    const denied = {
      ok: true as const,
      value: {
        allowed: false,
        limit: 120,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + 30,
      },
    };
    const harness = makeResetHarness({ rateLimits: [denied] });
    await expectApiError(await send(harness), 429, 'RATE_LIMITED');
    expect(harness.auth.rateLimit.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CFG-05B-07',
      limit: 120,
      windowSeconds: 60,
    });
  });
});
