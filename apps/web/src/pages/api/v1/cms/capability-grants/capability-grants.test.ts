import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('cloudflare:workers', () => ({
  env: { PLATFORM_API: { fetch: fetchMock } },
}));

import { GET, POST, prerender } from './index';
import * as renewals from './[grantId]/renewals';
import * as revocations from './[grantId]/revocations';
import {
  GRANT_ID,
  GRANT_ORIGIN,
  SUBJECT_ID,
  grantListPage,
  grantResource,
} from '../../../../../server/cms-capability-grant.test-support';

/**
 * First-party CMS-03A-15..18 transport. The API Worker stays the authority;
 * these routes only validate shape and forward through the private binding.
 */

const mutation = (path: string, body: unknown): Request =>
  new Request(`${GRANT_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      origin: GRANT_ORIGIN,
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123',
      'x-csrf-token': 'csrf-token-123',
      'idempotency-key': 'cms-grant-12345678',
      'if-match': '"2"',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const upstream = (status: number, body: unknown): void => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
};

type Ctx<T extends (...args: never[]) => unknown> = Parameters<T>[0];

describe('first-party CMS capability grant endpoints', () => {
  it('serve on demand only', () => {
    expect(prerender).toBe(false);
    expect(renewals.prerender).toBe(false);
    expect(revocations.prerender).toBe(false);
  });

  it('POST /capability-grants forwards a valid grant (CMS-03A-15)', async () => {
    fetchMock.mockClear();
    upstream(201, grantResource());
    const response = await POST({
      request: mutation('/api/v1/cms/capability-grants', {
        subjectPersonId: SUBJECT_ID,
        capability: 'cms.author',
        validThrough: '2026-12-30',
      }),
    } as Ctx<typeof POST>);
    expect(response.status).toBe(201);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(sent.url).pathname).toBe('/api/v1/cms/capability-grants');
    expect(sent.method).toBe('POST');
  });

  it('POST /capability-grants refuses an unregistered capability without forwarding', async () => {
    fetchMock.mockClear();
    const response = await POST({
      request: mutation('/api/v1/cms/capability-grants', {
        subjectPersonId: SUBJECT_ID,
        capability: 'cms.schema_review',
        validThrough: '2026-12-30',
      }),
    } as Ctx<typeof POST>);
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST /{grantId}/renewals binds the grant id from the route (CMS-03A-16)', async () => {
    fetchMock.mockClear();
    upstream(200, grantResource({ version: '3' }));
    const response = await renewals.POST({
      request: mutation(`/api/v1/cms/capability-grants/${GRANT_ID}/renewals`, {
        expectedVersion: '2',
        validThrough: '2026-12-30',
      }),
      params: { grantId: GRANT_ID },
    } as unknown as Ctx<typeof renewals.POST>);
    expect(response.status).toBe(200);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(sent.url).pathname).toBe(
      `/api/v1/cms/capability-grants/${GRANT_ID}/renewals`,
    );
    expect(sent.headers.get('if-match')).toBe('"2"');
  });

  it('POST /{grantId}/revocations binds the grant id from the route (CMS-03A-17)', async () => {
    fetchMock.mockClear();
    upstream(200, grantResource({ state: 'revoked', lastAction: 'revoked' }));
    const response = await revocations.POST({
      request: mutation(
        `/api/v1/cms/capability-grants/${GRANT_ID}/revocations`,
        {
          expectedVersion: '2',
        },
      ),
      params: { grantId: GRANT_ID },
    } as unknown as Ctx<typeof revocations.POST>);
    expect(response.status).toBe(200);
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(sent.url).pathname).toBe(
      `/api/v1/cms/capability-grants/${GRANT_ID}/revocations`,
    );
  });

  it('refuses a malformed grant id with 400 and never forwards', async () => {
    fetchMock.mockClear();
    const response = await revocations.POST({
      request: mutation('/api/v1/cms/capability-grants/x/revocations', {
        expectedVersion: '2',
      }),
      params: { grantId: 'not-a-uuid' },
    } as unknown as Ctx<typeof revocations.POST>);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GET /capability-grants forwards a validated list read (CMS-03A-18)', async () => {
    fetchMock.mockClear();
    upstream(200, grantListPage());
    const response = await GET({
      request: new Request(
        `${GRANT_ORIGIN}/api/v1/cms/capability-grants?capability=cms.author&state=active&subjectPersonId=${SUBJECT_ID}&limit=10`,
        { headers: { cookie: 'wj_access=protected; tracking=omit' } },
      ),
    } as Ctx<typeof GET>);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ nextCursor: null });
    const sent = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(sent.url);
    expect(url.searchParams.get('capability')).toBe('cms.author');
    expect(url.searchParams.get('subjectPersonId')).toBe(SUBJECT_ID);
    expect(url.searchParams.get('limit')).toBe('10');
    expect(sent.headers.get('cookie')).not.toContain('tracking');
  });

  it('GET refuses an invalid query with 400 and never forwards', async () => {
    fetchMock.mockClear();
    const response = await GET({
      request: new Request(
        `${GRANT_ORIGIN}/api/v1/cms/capability-grants?capability=cms.schema_review`,
      ),
    } as Ctx<typeof GET>);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 429])(
    'GET relays upstream %i without a body leak',
    async (status) => {
      fetchMock.mockClear();
      upstream(status, {
        code: 'X',
        details: {},
        message: 'Refused.',
        requestId: '6a3173d9-f113-4aa4-91c3-3fbc137ea258',
      });
      const response = await GET({
        request: new Request(`${GRANT_ORIGIN}/api/v1/cms/capability-grants`),
      } as Ctx<typeof GET>);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );
});
