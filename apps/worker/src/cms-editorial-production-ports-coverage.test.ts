import { describe, it } from 'vitest';
import type { RevisionHistoryPage } from '@wejammin/contracts';

import {
  CMS_EDITORIAL_PORTS,
  createCmsEditorialRpcCaller,
  cmsEditorialResourcePort,
  quoteVersion,
} from './cms-editorial-production-ports';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import { MAX_DEFAULT_RESPONSE_BYTES } from './cms-editorial-production-types';
import {
  captureInit,
  expect,
  json,
  portInput,
  revisionResource,
  vi,
} from './cms-editorial-production.test-support';

const NOW = Date.parse('2026-09-26T12:00:00.000Z');

const configuration = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsEditorialProductionConfiguration> = {},
): CmsEditorialProductionConfiguration => ({
  baseUrl: 'https://supabase.example.test',
  secret: 'sb_secret_ports_coverage',
  fetchImpl,
  maxResponseBytes: MAX_DEFAULT_RESPONSE_BYTES,
  now: () => NOW,
  ...overrides,
});

const caller = (
  fetchImpl: typeof fetch,
  operationId: 'CMS-03B-01' | 'CMS-03B-10' | 'CMS-03B-11' = 'CMS-03B-01',
) =>
  createCmsEditorialRpcCaller(
    configuration(fetchImpl),
    new WeakMap(),
    operationId,
    5_000,
  );

describe('cms editorial production ports', () => {
  it('binds each declared operation to a port member', () => {
    expect(CMS_EDITORIAL_PORTS['CMS-03B-01']).toBe('appendRevision');
    expect(CMS_EDITORIAL_PORTS['CMS-03B-03']).toBe('listRevisions');
    expect(CMS_EDITORIAL_PORTS['CMS-03B-10']).toBe('createEntry');
    expect(CMS_EDITORIAL_PORTS['CMS-03B-11']).toBe('getEntryDraft');
  });

  it('accepts only a strict CMS-03B-03 history page from a read port', async () => {
    const page: RevisionHistoryPage = {
      items: [],
      nextCursor: null,
      pageVersion: '1',
      compare: null,
    };
    const input = portInput({ operationId: 'CMS-03B-03' });
    const valid = cmsEditorialResourcePort<RevisionHistoryPage>(
      async () => ({ ok: true, value: page }),
      'CMS-03B-03',
    );
    expect(await valid(input, new AbortController().signal)).toEqual({
      ok: true,
      value: page,
    });
    const invalid = cmsEditorialResourcePort<RevisionHistoryPage>(
      async () => ({ ok: true, value: { ...page, secret: 'leak' } }),
      'CMS-03B-03',
    );
    expect(await invalid(input, new AbortController().signal)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('maps a committed revision conflict to 409 without exposing the private proposal', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        kind: 'conflict',
        code: 'VERSION_MISMATCH',
        details: {
          expectedVersion: '1',
          currentVersion: '2',
          conflictHash: 'a'.repeat(64),
        },
      }),
    );
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const result = await port(portInput(), new AbortController().signal);
    expect(result).toEqual({
      ok: false,
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS editorial resource changed; reload and try again.',
      details: {
        conflict: 'VERSION_MISMATCH',
        expectedVersion: '1',
        currentVersion: '2',
        recoveryAction: 'reload',
      },
    });
    expect(JSON.stringify(result)).not.toContain('conflictHash');
  });

  it('refuses a malformed private revision conflict disposition', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ kind: 'conflict', code: 'VERSION_MISMATCH', proposal: 'secret' }),
    );
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const result = await port(portInput(), new AbortController().signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('omits conditional headers and body keys when no validator is supplied', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    await port(
      portInput({ ifMatch: undefined, idempotencyKey: undefined }),
      new AbortController().signal,
    );
    const headers = captureInit(fetchImpl).init.headers as Record<
      string,
      string
    >;
    expect(headers['If-Match']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBeUndefined();
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request.ifMatch).toBeUndefined();
    expect(body.p_request.idempotencyKey).toBeUndefined();
    // The route-derived path wins over any caller body field of the same name.
    expect(body.p_request.entryId).toBe('30000000-0000-4000-8000-000000000003');
  });

  it('emits the idempotency key as both a header and a body field', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    await port(
      portInput({ idempotencyKey: 'idem-key-value' }),
      new AbortController().signal,
    );
    const headers = captureInit(fetchImpl).init.headers as Record<
      string,
      string
    >;
    expect(headers['X-Idempotency-Key']).toBe('idem-key-value');
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request.idempotencyKey).toBe('idem-key-value');
  });

  it('quotes only a bare decimal validator', () => {
    expect(quoteVersion('1')).toBe('"1"');
    expect(quoteVersion('W/"1"')).toBe('W/"1"');
    expect(quoteVersion('"1"')).toBe('"1"');
    expect(quoteVersion('0')).toBe('0');
  });

  it('rejects a weak If-Match with a 400 and no RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    for (const ifMatch of ['W/"1"', '"1"', '0', '01', 'v1']) {
      const result = await port(
        portInput({ ifMatch }),
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        ok: false,
        status: 400,
        code: 'INVALID_REQUEST',
        details: { reasonCode: 'if_match_invalid' },
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a foreign operation id and an entry-id disagreement with no RPC call', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const foreign = await port(
      portInput({ operationId: 'CMS-03B-10' }),
      new AbortController().signal,
    );
    expect(foreign).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
      details: { reasonCode: 'operation_mismatch' },
    });
    const mismatched = await port(
      portInput({ path: { entryId: '30000000-0000-4000-8000-0000000000ff' } }),
      new AbortController().signal,
    );
    expect(mismatched).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { reasonCode: 'entry_id_mismatch' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('ignores a non-string body entryId and keeps the declared path binding', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const result = await port(
      portInput({ body: { entryId: 42, expectedVersion: '1' } }),
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(captureInit(fetchImpl).init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(body.p_request.entryId).toBe('30000000-0000-4000-8000-000000000003');
  });

  it('fails closed when the response body is not JSON', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('not json', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    );
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const result = await port(portInput(), new AbortController().signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('fails closed for an operation without a declared success contract', async () => {
    const port = cmsEditorialResourcePort(
      async () => ({ ok: true as const, value: revisionResource }),
      'CMS-03B-99' as 'CMS-03B-11',
    );
    const result = await port(
      portInput({ operationId: 'CMS-03B-99' }),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
    });
  });

  it('returns a validated payload through the resource port', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const port = cmsEditorialResourcePort(
      caller(fetchImpl as unknown as typeof fetch),
      'CMS-03B-01',
    );
    const result = await port(portInput(), new AbortController().signal);
    expect(result).toMatchObject({ ok: true, value: revisionResource });
  });
});
