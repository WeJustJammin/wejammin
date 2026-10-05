import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import {
  ENTRY_ID,
  REQUEST_ID,
  REVISION_ID,
  captureInit,
  environment,
  json,
  portInput,
} from './cms-editorial-production.test-support';

const resource = {
  entry: {
    id: ENTRY_ID,
    version: '1',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  revision: {
    id: REVISION_ID,
    version: '1',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  revisionNumber: '1',
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  validationState: 'valid',
};
const input = () =>
  portInput({
    operationId: 'CMS-03B-10',
    path: undefined,
    body: { contentTypeId: ENTRY_ID, locale: 'en-US' },
    ifMatch: undefined,
    idempotencyKey: 'entry-create-0001',
  });

describe('CMS-03B-10 production create port', () => {
  it('binds initial create to the named RPC without If-Match and with server context', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await dependencies.ports.createEntry(
        input(),
        new AbortController().signal,
      ),
    ).toMatchObject({
      ok: true,
      value: resource,
    });
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_create_entry',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBe('entry-create-0001');
    const requestBody = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(requestBody.p_request).toMatchObject({
      contentTypeId: ENTRY_ID,
      idempotencyKey: 'entry-create-0001',
      context: { requestId: REQUEST_ID },
    });
  });

  it('rejects an undeclared field in a successful RPC response', async () => {
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: vi.fn(async () =>
        json({ ...resource, secret: 'leak' }),
      ) as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await dependencies.ports.createEntry(
        input(),
        new AbortController().signal,
      ),
    ).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it.each([
    { path: { entryId: ENTRY_ID }, ifMatch: undefined },
    { path: undefined, ifMatch: '1' },
  ])(
    'rejects an existing-resource precondition before fetch',
    async (override) => {
      const fetchImpl = vi.fn(async () => json(resource));
      const dependencies = createProductionCmsEditorialDependencies({
        environment,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        humanOrigins: ['https://cms.example.test'],
      });
      const result = await dependencies.ports.createEntry(
        portInput({ ...input(), ...override }),
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});
