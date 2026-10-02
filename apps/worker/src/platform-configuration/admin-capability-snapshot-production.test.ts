import { describe, expect, it, vi } from 'vitest';

import { createProductionWorkerApp } from '../index';
import {
  productionCookie,
  productionFetch,
} from './phase-02-slice-08-production.test-support';
import {
  BASE_URL,
  CORRELATION_ID,
  REQUEST_ID,
  bindings,
} from './phase-02-slice-08-worker.test-support';

const snapshotRequest = async (): Promise<Request> =>
  new Request(`${BASE_URL}/api/v1/admin/capability-snapshot`, {
    headers: {
      accept: 'application/json',
      cookie: await productionCookie(),
      origin: BASE_URL,
      'x-correlation-id': CORRELATION_ID,
      'x-request-id': REQUEST_ID,
    },
  });

describe('CFG-05B-07 through the production Worker composition', () => {
  it('answers the admin keys from the server capability RPC and nothing else', async () => {
    const fetchImpl = productionFetch([
      'admin.identity.mfa_reset',
      'cms.editor',
    ]);
    const app = createProductionWorkerApp(bindings, fetchImpl as typeof fetch);
    const response = await app.fetch(await snapshotRequest(), bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      capabilities: ['admin.identity.mfa_reset'],
    });
    expect(
      fetchImpl.mock.calls.some(([input]) =>
        String(input).endsWith('/rpc/admin_context_capabilities'),
      ),
    ).toBe(true);
  });

  it('uses an explicit trusted resolver override when composed', async () => {
    const resolveCapabilities = vi.fn(async () => ['admin.audit.read']);
    const app = createProductionWorkerApp(
      bindings,
      productionFetch([]) as typeof fetch,
      undefined,
      undefined,
      { resolveCapabilities },
    );
    const response = await app.fetch(await snapshotRequest(), bindings);
    expect(await response.json()).toEqual({
      capabilities: ['admin.audit.read'],
    });
  });

  it('fails closed with 503 when the capability RPC is unavailable', async () => {
    const app = createProductionWorkerApp(
      bindings,
      productionFetch({ invalid: true }, 503) as typeof fetch,
    );
    const response = await app.fetch(await snapshotRequest(), bindings);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
