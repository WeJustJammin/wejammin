import { describe, expect, it, vi } from 'vitest';

import {
  ApiErrorSchema,
  type ConflictDetailResource,
} from '@wejammin/contracts';

import { createCmsEditorialApp, type CmsEditorialDependencies } from './index';

/**
 * P2-S10-AC-089, clause "or a side over 256 KiB" ... "as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure
 * without serving it" (BE03b CMS-03B-12, Validation row `paths / preimages`). The route revalidates the dependency's
 * answer against the strict resource contract, whose side values are bounded to 262,144 bytes of serialized JSON, so
 * an answer carrying a larger side is a response-contract failure and is never served.
 */

const origin = 'https://cms-console.example.test';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = '10000000-0000-4000-8000-000000000001';
const partyId = '20000000-0000-4000-8000-000000000002';
const entryId = '30000000-0000-4000-8000-000000000003';
const conflictId = '31000000-0000-4000-8000-000000000003';
const baseRevisionId = '40000000-0000-4000-8000-000000000004';
const theirsRevisionId = '41000000-0000-4000-8000-000000000004';
const schemaVersionId = '50000000-0000-4000-8000-000000000005';
const fieldId = '60000000-0000-4000-8000-000000000006';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T12:00:00.000Z';
const path = `/api/v1/cms/entries/${entryId}/conflicts/${conflictId}`;

const BOUND_BYTES = 262_144;
/** A string whose JSON serialization (quotes included) is exactly `bytes` UTF-8 bytes. */
const stringOfSerializedBytes = (bytes: number): string =>
  'x'.repeat(bytes - 2);

const side = (value: string) => ({
  value,
  provenance: 'authored' as const,
  valueHash: hash,
});

const resourceWith = (
  which: 'base' | 'theirs' | 'yours',
  value: string,
): ConflictDetailResource => ({
  conflict: {
    id: conflictId,
    version: '2',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [`/fields/${fieldId}`],
    conflictHash: hash,
  },
  entry: { id: entryId, version: '3', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: baseRevisionId,
    revisionNumber: '1',
    schemaVersionId,
    contentHash: hash,
  },
  theirs: {
    revisionId: theirsRevisionId,
    revisionNumber: '2',
    schemaVersionId,
    contentHash: hash,
  },
  yours: { source: 'proposed', revisionId: null, contentHash: hash },
  paths: [
    {
      path: `/fields/${fieldId}`,
      base: side(which === 'base' ? value : 'Mine'),
      theirs: side(which === 'theirs' ? value : 'Theirs'),
      yours: side(which === 'yours' ? value : 'Yours'),
    },
  ],
  resolvedRevisionId: null,
});

const harness = (answer: ConflictDetailResource) => {
  const getConflictDetail = vi.fn(async () => ({
    ok: true as const,
    value: answer,
  }));
  const dependencies = {
    ports: { getConflictDetail },
    resolveSession: async () => ({
      ok: true as const,
      value: {
        userId,
        actingPartyId: partyId,
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    }),
    rateLimit: async () => ({
      ok: true as const,
      value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
    }),
    humanOrigins: [origin],
    now: () => 0,
    telemetry: (): void => undefined,
  } as unknown as CmsEditorialDependencies;
  return { app: createCmsEditorialApp(dependencies), getConflictDetail };
};

const get = (app: ReturnType<typeof createCmsEditorialApp>) =>
  Promise.resolve(
    app.request(path, {
      method: 'GET',
      headers: { origin, 'x-request-id': requestId },
    }),
  );

describe('CMS-03B-12 conflict-detail route [P2-S10-AC-089] preimage side bound', () => {
  it.each(['base', 'theirs', 'yours'] as const)(
    'answers a %s side over 256 KiB as 502 DEPENDENCY_UNAVAILABLE without serving it',
    async (which) => {
      const { app, getConflictDetail } = harness(
        resourceWith(which, stringOfSerializedBytes(BOUND_BYTES + 1)),
      );
      const response = await get(app);
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
      expect(response.headers.get('retry-after')).toBeNull();
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
      const text = await response.text();
      // The refusal is a fixed envelope: none of the refused preimage reaches the caller.
      expect(text.length).toBeLessThan(2_048);
      expect(text).not.toContain('xxxxxxxx');
      expect(ApiErrorSchema.parse(JSON.parse(text))).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_editorial', retryable: true },
        requestId,
      });
      expect(getConflictDetail).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['base', 'theirs', 'yours'] as const)(
    'serves the same answer when its %s side is exactly 256 KiB (control)',
    async (which) => {
      const answer = resourceWith(which, stringOfSerializedBytes(BOUND_BYTES));
      const { app } = harness(answer);
      const response = await get(app);
      expect(response.status).toBe(200);
      expect(response.headers.get('etag')).toMatch(/^".+"$/u);
      expect(await response.json()).toEqual(answer);
    },
  );
});
