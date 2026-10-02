import { describe, expect, it, vi } from 'vitest';
import type { RevisionHistoryPage } from '@wejammin/contracts';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import { createCmsEditorialApp } from './cms-editorial';
import {
  ENTRY_ID,
  REQUEST_ID,
  captureInit,
  environment,
  json,
  portInput,
} from './cms-editorial-production.test-support';

const page: RevisionHistoryPage = {
  items: [],
  nextCursor: null,
  pageVersion: '1',
  compare: null,
};
const historyRequest = () =>
  new Request(
    `https://api.example.test/api/v1/cms/entries/${ENTRY_ID}/revisions`,
    { headers: { 'x-request-id': REQUEST_ID } },
  );
const input = () =>
  portInput({
    operationId: 'CMS-03B-03',
    request: historyRequest(),
    path: { entryId: ENTRY_ID },
    query: { entryId: ENTRY_ID, limit: 25 },
    body: undefined,
    ifMatch: undefined,
    idempotencyKey: undefined,
  });

describe('CMS-03B-03 production signed-history read port', () => {
  it('serves the protected history route through the named RPC', async () => {
    const fetchImpl = vi.fn(async () => json(page));
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
      telemetry: async () => {},
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: ['cms.author'],
          mfaFresh: true,
        },
      }),
      rateLimit: async (rate) => ({
        ok: true,
        value: {
          allowed: true,
          limit: rate.limit,
          remaining: rate.limit - 1,
          resetAt: 60_000,
        },
      }),
    });
    const response =
      await createCmsEditorialApp(dependencies).request(historyRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(page);
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_revisions',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBeUndefined();
    const body = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request).toMatchObject({
      entryId: ENTRY_ID,
      limit: 25,
      context: { requestId: REQUEST_ID },
    });
  });

  it('rejects malformed history port inputs before any RPC fetch', async () => {
    const fetchImpl = vi.fn(async () => json(page));
    const port = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    }).ports.listRevisions;
    const base = input();
    for (const changed of [
      { path: undefined },
      { path: { entryId: 'bad' } },
      { path: { entryId: ENTRY_ID, conflictId: ENTRY_ID } },
      { query: { entryId: 'bad', limit: 25 } },
      { query: { entryId: ENTRY_ID, limit: 51 } },
      { body: { entryId: ENTRY_ID } },
      { idempotencyKey: 'unexpected' },
      { ifMatch: '1' },
      {
        request: new Request(historyRequest().url, {
          headers: { 'idempotency-key': 'unexpected' },
        }),
      },
      {
        request: new Request(historyRequest().url, {
          headers: { 'if-match': '"1"' },
        }),
      },
      {
        request: new Request(historyRequest().url, { method: 'POST' }),
      },
      {
        request: new Request(
          `https://api.example.test/api/v1/cms/entries/${ENTRY_ID}`,
        ),
      },
    ]) {
      const result = await port(
        { ...base, ...changed } as typeof base,
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a malformed dependency page without leaking its content', async () => {
    const fetchImpl = vi.fn(async () => json({ ...page, private: 'leak' }));
    const port = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    }).ports.listRevisions;
    expect(await port(input(), new AbortController().signal)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('keeps history unavailable when the RPC has no owner key', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ code: 'P0001', message: 'DEPENDENCY_UNAVAILABLE' }, 400),
    );
    const port = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    }).ports.listRevisions;
    const result = await port(input(), new AbortController().signal);
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(JSON.stringify(result)).not.toContain('P0001');
  });
});
