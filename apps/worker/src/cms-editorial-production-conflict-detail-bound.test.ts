import { describe, expect, it, vi } from 'vitest';
import {
  ApiErrorSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import {
  CONFLICT_ID,
  FIELD_ID,
  ORIGIN,
  wiredApp,
} from './cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  HASH,
  REQUEST_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
} from './cms-editorial-production.test-support';

/**
 * P2-S10-AC-089, clause "or a side over 256 KiB" ... "as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
 * without serving it" (BE03b CMS-03B-12), through the real route composition: the production Hono routes over the real
 * production RPC adapter, with only the PostgREST network edge faked. The adapter reads a response under BE00's 256 KiB
 * ceiling, so a conflict whose side is over 256 KiB (and any answer over the ceiling) never leaves the adapter as data.
 */

const CEILING_BYTES = 256 * 1024;
const path = `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}`;
const instant = '2026-09-26T12:00:00.000Z';

const side = (value: string) => ({
  value,
  provenance: 'authored' as const,
  valueHash: HASH,
});

const conflictWith = (value: string): ConflictDetailResource => ({
  conflict: {
    id: CONFLICT_ID,
    version: '2',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [`/fields/${FIELD_ID}`],
    conflictHash: HASH,
  },
  entry: { id: ENTRY_ID, version: '3', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: REVISION_ID,
    revisionNumber: '1',
    schemaVersionId: SCHEMA_VERSION_ID,
    contentHash: HASH,
  },
  theirs: {
    revisionId: '41000000-0000-4000-8000-000000000004',
    revisionNumber: '2',
    schemaVersionId: SCHEMA_VERSION_ID,
    contentHash: HASH,
  },
  yours: { source: 'proposed', revisionId: null, contentHash: HASH },
  paths: [
    {
      path: `/fields/${FIELD_ID}`,
      base: side('Mine'),
      theirs: side(value),
      yours: side('Yours'),
    },
  ],
  resolvedRevisionId: null,
});

const bytesOf = (value: unknown): number =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

/** A conflict whose whole serialized answer is exactly `total` bytes (the padding is one side's value). */
const conflictOfTotalBytes = (total: number): ConflictDetailResource => {
  const empty = bytesOf(conflictWith(''));
  return conflictWith('x'.repeat(total - empty));
};

const declaredLength = (resource: unknown): Response => {
  const text = JSON.stringify(resource);
  return new Response(text, {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(text, 'utf8')),
    },
  });
};

/** The same answer streamed in 64 KiB chunks with no declared length: the adapter must count bytes itself. */
const streamed = (resource: unknown): Response => {
  const bytes = new TextEncoder().encode(JSON.stringify(resource));
  let offset = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) {
          controller.close();
          return;
        }
        controller.enqueue(bytes.subarray(offset, offset + 65_536));
        offset += 65_536;
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
};

const read = async (answer: () => Response) => {
  const fetchImpl = vi.fn(async () => answer());
  const app = wiredApp(fetchImpl as unknown as typeof fetch);
  const response = await app.request(path, {
    method: 'GET',
    headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID },
  });
  return { response, fetchImpl };
};

describe('CMS-03B-12 production conflict-detail read [P2-S10-AC-089] over-bound preimage side', () => {
  it.each([
    ['declared length', declaredLength],
    ['streamed without a declared length', streamed],
  ] as const)(
    'refuses a side of 256 KiB plus one byte (%s) as 502 DEPENDENCY_UNAVAILABLE and serves nothing of it',
    async (_label, transport) => {
      // The side value alone serializes to 262,145 bytes, one more than BE03b's 256 KiB side bound.
      const oversized = conflictWith('x'.repeat(CEILING_BYTES - 1));
      const { response, fetchImpl } = await read(() => transport(oversized));
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
      const text = await response.text();
      expect(text.length).toBeLessThan(2_048);
      expect(text).not.toContain('xxxxxxxx');
      expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        requestId: REQUEST_ID,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url] = fetchImpl.mock.calls[0] as unknown as [string];
      expect(url).toBe(
        'https://supabase.example.test/rest/v1/rpc/cms_get_conflict_detail',
      );
    },
  );

  it('serves an answer of exactly 256 KiB and refuses the same answer one byte longer', async () => {
    const atCeiling = conflictOfTotalBytes(CEILING_BYTES);
    expect(bytesOf(atCeiling)).toBe(CEILING_BYTES);
    const served = await read(() => declaredLength(atCeiling));
    expect(served.response.status).toBe(200);
    expect(await served.response.json()).toEqual(atCeiling);

    const pastCeiling = conflictOfTotalBytes(CEILING_BYTES + 1);
    expect(bytesOf(pastCeiling)).toBe(CEILING_BYTES + 1);
    for (const transport of [declaredLength, streamed]) {
      const refused = await read(() => transport(pastCeiling));
      expect(refused.response.status).toBe(502);
      expect(ApiErrorSchema.parse(await refused.response.json())).toMatchObject(
        { code: 'DEPENDENCY_UNAVAILABLE' },
      );
    }
  });
});
