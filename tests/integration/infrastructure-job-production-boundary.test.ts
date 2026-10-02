import { JobStatusTransportSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  createJobStatusReader,
  readJobStatusResponse,
} from '../../apps/web/src/lib/infrastructure-jobs';
import {
  createJobStatusBoundaryPorts,
  handleJobStatusRead,
} from '../../apps/web/src/server/job-status-boundary';
import { readPlatformApiJobStatusBoundaryPorts } from '../../apps/web/src/server/job-status-platform-api';

const JOB_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '99999999-9999-4999-8999-999999999999';
const JOB = {
  id: JOB_ID,
  type: 'infrastructure.refresh',
  state: 'running' as const,
  progress: { completed: 1, total: 2, unit: 'record' },
  resultRef: null,
  error: null,
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:01:00.000Z',
};
const TRANSPORT = JobStatusTransportSchema.parse({ data: JOB, etag: '"7"' });

const notModifiedResponse = () =>
  ({
    status: 304,
    ok: false,
    headers: new Headers({ etag: TRANSPORT.etag, 'x-request-id': REQUEST_ID }),
    json: vi.fn(async () => {
      throw new Error('304 responses have no JSON body');
    }),
  }) as unknown as Response;

describe('production job status boundary', () => {
  it('uses the bound platform API when no Astro locals producer exists', async () => {
    const requests: Request[] = [];
    const token = 'opaque-production-bearer';
    const binding = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request);
        return new Response(JSON.stringify(JOB), {
          status: 200,
          headers: {
            'cache-control': 'no-store',
            etag: TRANSPORT.etag,
            'x-request-id': REQUEST_ID,
          },
        });
      }),
    };
    const ports = readPlatformApiJobStatusBoundaryPorts(binding);

    expect(ports).not.toBeNull();
    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          authorization: `Bearer ${token}`,
          cookie: 'unknown-session-format=must-not-be-forwarded',
          'if-none-match': TRANSPORT.etag,
          'x-request-id': REQUEST_ID,
        },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toBe('/api/v1/jobs/' + JOB_ID);
    expect(Object.fromEntries(requests[0]!.headers.entries())).toEqual({
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'if-none-match': TRANSPORT.etag,
      'x-request-id': REQUEST_ID,
    });
  });

  it('reads the HttpOnly wj_access cookie the browser can send, forwarding only its token as the bearer', async () => {
    const requests: Request[] = [];
    const token = 'header.payload.signature';
    const binding = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input);
        requests.push(request);
        return new Response(JSON.stringify(JOB), {
          status: 200,
          headers: {
            'cache-control': 'no-store',
            etag: TRANSPORT.etag,
            'x-request-id': REQUEST_ID,
          },
        });
      }),
    };
    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          cookie: `wj_csrf=csrf-value; wj_access=${token}; unrelated=1`,
          'x-request-id': REQUEST_ID,
        },
      }),
      JOB_ID,
      readPlatformApiJobStatusBoundaryPorts(binding),
    );

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.headers.get('authorization')).toBe(`Bearer ${token}`);
    expect(requests[0]!.headers.get('cookie')).toBeNull();
  });

  it('prefers an explicit bearer over the cookie', async () => {
    const requests: Request[] = [];
    const binding = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        requests.push(input instanceof Request ? input : new Request(input));
        return new Response('{}', { status: 404 });
      }),
    };
    await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          authorization: 'Bearer explicit-token',
          cookie: 'wj_access=cookie-token',
        },
      }),
      JOB_ID,
      readPlatformApiJobStatusBoundaryPorts(binding),
    );
    expect(requests[0]!.headers.get('authorization')).toBe(
      'Bearer explicit-token',
    );
  });

  it('maps a service-verified invalid bearer to 401 without exposing the token', async () => {
    const token = 'invalid-but-opaque';
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 401,
          headers: { 'cache-control': 'no-store' },
        }),
    );
    const ports = readPlatformApiJobStatusBoundaryPorts({ fetch: fetcher });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: { authorization: `Bearer ${token}` },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(token);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('treats an unknown cookie format as unauthenticated', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(JOB)));
    const ports = readPlatformApiJobStatusBoundaryPorts({ fetch: fetcher });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: { cookie: 'session=opaque-but-unsupported' },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards only the canonical bearer and cache/request validators', async () => {
    let forwarded: Request | null = null;
    const binding = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        forwarded = input instanceof Request ? input : new Request(input);
        return new Response(JSON.stringify(JOB), {
          status: 200,
          headers: { etag: TRANSPORT.etag },
        });
      }),
    };
    const ports = readPlatformApiJobStatusBoundaryPorts(binding);

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          authorization: 'Bearer opaque-token',
          cookie: 'session=do-not-forward',
          'if-none-match': TRANSPORT.etag,
          origin: 'https://evil.example.test',
          referer: 'https://evil.example.test/steal',
          'x-acting-party-id': '22222222-2222-4222-8222-222222222222',
          'x-capability': 'jobs.read:any',
          'x-operator-reason': 'forged client reason',
          'x-request-id': REQUEST_ID,
          'x-step-up-verified': 'true',
        },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(304);
    expect(forwarded).not.toBeNull();
    expect([...forwarded!.headers.keys()]).toEqual([
      'accept',
      'authorization',
      'if-none-match',
      'x-request-id',
    ]);
    expect(forwarded!.headers.get('cookie')).toBeNull();
    expect(forwarded!.headers.get('x-acting-party-id')).toBeNull();
    expect(forwarded!.headers.get('x-capability')).toBeNull();
    expect(forwarded!.headers.get('x-operator-reason')).toBeNull();
    expect(forwarded!.headers.get('x-step-up-verified')).toBeNull();
  });

  it('keeps the bearer in an opaque server session and maps empty 304 strictly', async () => {
    const token = 'opaque-never-serialized';
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 304,
          headers: { etag: TRANSPORT.etag },
        }),
    );
    const ports = readPlatformApiJobStatusBoundaryPorts({ fetch: fetcher });
    expect(ports).not.toBeNull();
    const authentication = await ports!.authenticate(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(JSON.stringify(authentication)).not.toContain(token);
    expect(JSON.stringify(authentication.session)).not.toContain(token);
    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          authorization: `Bearer ${token}`,
          'if-none-match': TRANSPORT.etag,
        },
      }),
      JOB_ID,
      ports,
    );
    expect(response.status).toBe(304);
    expect(await response.text()).toBe('');
  });

  it('returns the previous canonical transport for 304 without parsing an empty body', async () => {
    await expect(
      readJobStatusResponse(notModifiedResponse(), TRANSPORT),
    ).resolves.toEqual(TRANSPORT);
  });

  it('sends same-origin credentials and reuses its own ETag for 304', async () => {
    const requests: RequestInit[] = [];
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        requests.push(init ?? {});
        return requests.length === 1
          ? new Response(JSON.stringify(TRANSPORT.data), {
              status: 200,
              headers: { etag: TRANSPORT.etag, 'x-request-id': REQUEST_ID },
            })
          : notModifiedResponse();
      },
    );
    const reader = createJobStatusReader(JOB_ID, fetcher);

    await expect(reader(new AbortController().signal)).resolves.toEqual(
      TRANSPORT,
    );
    await expect(reader(new AbortController().signal)).resolves.toEqual(
      TRANSPORT,
    );
    expect(requests[0]?.credentials).toBe('same-origin');
    expect(requests[0]?.cache).toBe('no-store');
    expect(requests[0]?.headers).toEqual({ accept: 'application/json' });
    expect(requests[1]?.headers).toEqual({
      accept: 'application/json',
      'if-none-match': TRANSPORT.etag,
    });
  });

  it('rejects an invalid path before consulting server authentication', async () => {
    const authenticate = vi.fn(() => ({ kind: 'unauthenticated' as const }));
    const ports = createJobStatusBoundaryPorts({
      authenticate,
      read: vi.fn(),
    });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/not-a-uuid'),
      'not-a-uuid',
      ports,
    );

    expect(response.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      code: 'INVALID_REQUEST',
      details: { path: '/path/jobId' },
    });
  });

  it('fails closed when no server auth/read producer is installed', async () => {
    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID),
      JOB_ID,
      null,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('authenticates before reading and emits an empty 304 response', async () => {
    const authenticate = vi.fn(() => ({
      kind: 'authenticated' as const,
      session: { source: 'server-verified' },
    }));
    const read = vi.fn(() => TRANSPORT);
    const ports = createJobStatusBoundaryPorts({ authenticate, read });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: {
          cookie: 'session=opaque',
          'if-none-match': TRANSPORT.etag,
          'x-request-id': REQUEST_ID,
        },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('etag')).toBe(TRANSPORT.etag);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
    expect(authenticate).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith({
      request: expect.any(Request),
      jobId: JOB_ID,
      session: { source: 'server-verified' },
      ifNoneMatch: TRANSPORT.etag,
    });
  });

  it('does not treat an invalid client ETag as a server validator', async () => {
    const read = vi.fn(() => TRANSPORT);
    const ports = createJobStatusBoundaryPorts({
      authenticate: () => ({ kind: 'authenticated' as const, session: {} }),
      read,
    });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID, {
        headers: { 'if-none-match': 'client-controlled' },
      }),
      JOB_ID,
      ports,
    );

    expect(response.status).toBe(200);
    expect(read).toHaveBeenCalledWith({
      request: expect.any(Request),
      jobId: JOB_ID,
      session: {},
      ifNoneMatch: null,
    });
  });

  it('does not disclose a resource returned for a different job ID', async () => {
    const ports = createJobStatusBoundaryPorts({
      authenticate: () => ({ kind: 'authenticated' as const, session: {} }),
      read: () => TRANSPORT,
    });

    const response = await handleJobStatusRead(
      new Request('https://app.example.test/api/v1/jobs/' + JOB_ID),
      '22222222-2222-4222-8222-222222222222',
      ports,
    );

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(JOB_ID);
  });
});
