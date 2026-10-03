import { describe, expect, it, vi } from 'vitest';
import type { EntryDraftDetailResource } from '@wejammin/contracts';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import { createCmsEditorialApp } from './cms-editorial';
import {
  ENTRY_ID,
  REQUEST_ID,
  REVISION_ID,
  captureInit,
  environment,
  json,
  portInput,
} from './cms-editorial-production.test-support';

const resource: EntryDraftDetailResource = {
  entry: {
    id: ENTRY_ID,
    version: '2',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  revision: {
    id: REVISION_ID,
    version: '1',
    createdAt: '2026-09-26T12:00:00.000Z',
    updatedAt: '2026-09-26T12:00:00.000Z',
  },
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  validationState: 'valid',
  fields: [],
  relations: [],
};
const input = () =>
  portInput({
    operationId: 'CMS-03B-11',
    path: { entryId: ENTRY_ID },
    query: { entryId: ENTRY_ID, locale: 'en-US' },
    body: undefined,
    ifMatch: undefined,
    idempotencyKey: undefined,
  });

describe('CMS-03B-11 production draft-detail read port', () => {
  it('serves a protected no-store GET through the real route composition', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
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
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60_000,
        },
      }),
    });
    const response = await createCmsEditorialApp(dependencies).request(
      `https://api.example.test/api/v1/cms/entries/${ENTRY_ID}`,
      { method: 'GET', headers: { origin: 'https://cms.example.test' } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toMatch(/^".+"$/u);
    expect(await response.json()).toEqual(resource);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('binds an authorized read to the named RPC without mutation headers', async () => {
    const fetchImpl = vi.fn(async () => json(resource));
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await dependencies.ports.getEntryDraft(
        input(),
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: true, value: resource });
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_get_entry_draft',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBeUndefined();
    const requestBody = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(requestBody.p_request).toMatchObject({
      entryId: ENTRY_ID,
      locale: 'en-US',
      context: { requestId: REQUEST_ID },
    });
  });

  it('[P2-S09-AC-203] admits the database placeholder relation and rejects a target member beside it', async () => {
    const placeholderRelation = {
      fieldId: ENTRY_ID,
      fieldDefinitionId: REVISION_ID,
      position: 0,
      onUnavailable: 'placeholder',
      unavailable: { status: 'unavailable', reason: 'unavailable' },
    };
    const accepted = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: vi.fn(async () =>
        json({ ...resource, relations: [placeholderRelation] }),
      ) as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await accepted.ports.getEntryDraft(input(), new AbortController().signal),
    ).toMatchObject({
      ok: true,
      value: { relations: [placeholderRelation] },
    });
    const leaky = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: vi.fn(async () =>
        json({
          ...resource,
          relations: [{ ...placeholderRelation, targetId: ENTRY_ID }],
        }),
      ) as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await leaky.ports.getEntryDraft(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('rejects malformed RPC success before a draft reaches the route', async () => {
    const fetchImpl = vi.fn(async () => json({ ...resource, secret: 'leak' }));
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(
      await dependencies.ports.getEntryDraft(
        input(),
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it.each([
    { path: undefined },
    { path: { entryId: REVISION_ID } },
    { body: { ownerId: ENTRY_ID } },
    { idempotencyKey: 'read-must-not-mutate' },
    { ifMatch: '2' },
    { query: { entryId: REVISION_ID } },
    { query: { entryId: ENTRY_ID, hidden: 'probe' } },
  ])('rejects an invalid read-port input before fetch', async (override) => {
    const fetchImpl = vi.fn(async () => json(resource));
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    });
    const result = await dependencies.ports.getEntryDraft(
      portInput({ ...input(), ...override }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
