import { ADMIN_WORKSPACE_ROUTE_CONTRACTS } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { PLATFORM_CONFIGURATION_BROWSER_ROUTES } from './platform-configuration-route-registry';
import {
  PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH,
  readWorkerCapabilitySnapshot,
} from './platform-configuration-capability-snapshot';

const json = (value: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const callerRequest = (headers: Record<string, string> = {}): Request =>
  new Request('https://www.wejammin.test/app/platform-configuration-admin', {
    headers: {
      cookie: 'wj_access=a; tracking=evil; wj_csrf=c',
      'x-request-id': 'req-1',
      'x-capabilities': 'admin.identity.mfa_reset',
      'x-role': 'admin',
      ...headers,
    },
  });

describe('readWorkerCapabilitySnapshot', () => {
  it('is never a browser-facing route', () => {
    expect(
      PLATFORM_CONFIGURATION_BROWSER_ROUTES.map(({ path }) => path),
    ).not.toContain(PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH);
  });

  it('targets the registered CFG-05B-07 path', () => {
    const route = ADMIN_WORKSPACE_ROUTE_CONTRACTS.find(
      ({ operationId }) => operationId === 'CFG-05B-07',
    );
    expect(route).toMatchObject({ method: 'GET', active: true });
    expect(PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH).toBe(route?.path);
  });

  it('forwards only session cookies and trace headers to the fixed path', async () => {
    const fetch = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(json({ capabilities: ['admin.inbox.read'] })),
    );
    expect(
      await readWorkerCapabilitySnapshot(callerRequest(), { fetch }),
    ).toEqual(['admin.inbox.read']);
    const sent = fetch.mock.calls[0]![0];
    expect(sent.method).toBe('GET');
    expect(new URL(sent.url).pathname).toBe(
      PLATFORM_CONFIGURATION_CAPABILITY_SNAPSHOT_PATH,
    );
    expect(new URL(sent.url).search).toBe('');
    expect(sent.headers.get('cookie')).toBe('wj_access=a; wj_csrf=c');
    expect(sent.headers.get('x-request-id')).toBe('req-1');
    expect(sent.headers.get('origin')).toBe(new URL(sent.url).origin);
    expect(sent.headers.get('x-capabilities')).toBeNull();
    expect(sent.headers.get('x-role')).toBeNull();
  });

  it('does not call the Worker without a session cookie', async () => {
    const fetch = vi.fn();
    const request = callerRequest({ cookie: 'tracking=evil' });
    expect(await readWorkerCapabilitySnapshot(request, { fetch })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, undefined, {}, { fetch: 'nope' }])(
    'is empty for a non-binding value (%j)',
    async (binding) => {
      expect(
        await readWorkerCapabilitySnapshot(callerRequest(), binding),
      ).toEqual([]);
    },
  );

  it.each([
    ['401', () => json({}, { status: 401 })],
    ['204', () => new Response(null, { status: 204 })],
    [
      'html',
      () =>
        new Response('<p>x</p>', { headers: { 'content-type': 'text/html' } }),
    ],
    [
      'invalid json',
      () =>
        new Response('{', { headers: { 'content-type': 'application/json' } }),
    ],
    ['non-admin capability', () => json({ capabilities: ['cms.editor'] })],
    [
      'duplicate',
      () => json({ capabilities: ['admin.inbox.read', 'admin.inbox.read'] }),
    ],
    ['extra key', () => json({ capabilities: [], personId: 'p' })],
    ['not a Response', () => ({ status: 200 }) as unknown as Response],
  ] as const)('is empty on %s', async (_label, answer) => {
    const fetch = vi.fn(() => Promise.resolve(answer()));
    expect(
      await readWorkerCapabilitySnapshot(callerRequest(), { fetch }),
    ).toEqual([]);
  });

  it('is empty when the binding throws or rejects', async () => {
    expect(
      await readWorkerCapabilitySnapshot(callerRequest(), {
        fetch: () => {
          throw new Error('sync');
        },
      }),
    ).toEqual([]);
    expect(
      await readWorkerCapabilitySnapshot(callerRequest(), {
        fetch: () => Promise.reject(new Error('async')),
      }),
    ).toEqual([]);
  });
});
