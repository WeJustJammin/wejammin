import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import {
  ENTRY_ID,
  REQUEST_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  captureInit,
  environment,
  json,
  portInput,
  revisionResource,
} from './cms-editorial-production.test-support';

const CONFLICT_ID = '31000000-0000-4000-8000-000000000003';
const BASE_ID = '41000000-0000-4000-8000-000000000004';
const FIELD_ID = '61000000-0000-4000-8000-000000000006';
const resolvedResource = {
  ...revisionResource,
  id: REVISION_ID,
  entryId: ENTRY_ID,
  revisionNumber: '3',
  parentRevisionIds: [BASE_ID, SCHEMA_VERSION_ID],
  conflictId: CONFLICT_ID,
};
const input = (overrides: Record<string, unknown> = {}) =>
  portInput({
    operationId: 'CMS-03B-02',
    path: { entryId: ENTRY_ID, conflictId: CONFLICT_ID },
    body: {
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      baseRevision: '1',
      choices: [{ path: `/fields/${FIELD_ID}`, choice: 'theirs' }],
      expectedVersion: '2',
    },
    ifMatch: '2',
    ...overrides,
  });

const compose = (fetchImpl: typeof fetch) =>
  createProductionCmsEditorialDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
  });

describe('CMS-03B-02 protected production resolver port', () => {
  it('binds the route input to the named RPC and exact server-derived context', async () => {
    const fetchImpl = vi.fn(async () => json(resolvedResource));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.resolveConflict(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: true, value: resolvedResource });
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_resolve_conflict',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Operation-Id']).toBe('CMS-03B-02');
    expect(headers['If-Match']).toBe('"2"');
    const requestBody = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(requestBody.p_request).toMatchObject({
      entryId: ENTRY_ID,
      conflictId: CONFLICT_ID,
      expectedVersion: '2',
      ifMatch: '2',
      context: { requestId: REQUEST_ID },
    });
  });

  it('rejects a conflict path/body disagreement before any RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(resolvedResource));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.resolveConflict(
      input({
        body: {
          entryId: ENTRY_ID,
          conflictId: BASE_ID,
          baseRevision: '1',
          choices: [{ path: `/fields/${FIELD_ID}`, choice: 'theirs' }],
          expectedVersion: '2',
        },
      }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an RPC success without two distinct parents and conflict binding', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ ...resolvedResource, parentRevisionIds: [BASE_ID] }),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.resolveConflict(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it.each([
    {
      overrides: { path: { entryId: ENTRY_ID } },
      label: 'missing path conflict',
    },
    {
      overrides: { body: { entryId: ENTRY_ID, expectedVersion: '2' } },
      label: 'missing body conflict',
    },
  ])('rejects $label before any RPC call', async ({ overrides }) => {
    const fetchImpl = vi.fn(async () => json(resolvedResource));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.resolveConflict(
      input(overrides),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 422 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    { ...resolvedResource, undeclared: 'must be rejected' },
    { ...resolvedResource, parentRevisionIds: [BASE_ID, BASE_ID] },
    { ...resolvedResource, conflictId: null },
  ])('rejects a malformed resolution resource', async (resource) => {
    const dependencies = compose(
      vi.fn(async () => json(resource)) as unknown as typeof fetch,
    );
    const result = await dependencies.ports.resolveConflict(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
