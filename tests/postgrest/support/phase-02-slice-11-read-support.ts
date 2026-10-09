/** Exact read oracles; expected membership is supplied by fixture commands. */
import { expect } from 'vitest';
import {
  ReviewQueuePageSchema,
  type ReviewQueueItem,
} from '@wejammin/contracts';
import { z } from 'zod';

import { expectSafeEqual, expectStatus } from './phase-02-slice-11-assert';
import type { S11Response, S11Stack } from './phase-02-slice-11-stack';
import { psql } from './stack';

const QueueCursorEnvelopeSchema = z.strictObject({
  queryHash: z.string().regex(/^[0-9a-f]{64}$/u),
  lastUpdatedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u),
  lastReviewId: z.uuid(),
  expiresAt: z.string().regex(/^[0-9]{1,12}$/u),
  keyId: z.uuid(),
  signature: z.string().regex(/^[0-9a-f]{64}$/u),
});

/** Independently bound the artifact, without printing a cursor or parse error. */
const queueCursorEnvelope = (cursor: string) => {
  try {
    if (
      cursor.length < 1 ||
      cursor.length > 512 ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(cursor)
    ) {
      throw new Error('invalid queue cursor fixture');
    }
    const envelope = QueueCursorEnvelopeSchema.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')),
    );
    if (!envelope.success) throw new Error('invalid queue cursor fixture');
    if (
      new Date(envelope.data.lastUpdatedAt).toISOString() !==
      envelope.data.lastUpdatedAt
    ) {
      throw new Error('invalid queue cursor fixture');
    }
    return envelope.data;
  } catch {
    throw new Error('invalid queue cursor fixture');
  }
};

/**
 * PRIVILEGED LOCAL TEST-ARTIFACT SIGNER, not an API-role RPC or queue producer.
 * Existing SELECT-only cms_signed_cursor_seal_page seals a public cursor's
 * independently bounded payload. No Vault material leaves that function; no
 * keys, grants, clock, or rows change. Only expiry or signing domain changes.
 */
export const s11SignedQueueNegative = (
  publicCursor: string,
  variant: 'expired' | 'foreign-domain',
): string => {
  const original = queueCursorEnvelope(publicCursor);
  const payload = {
    queryHash: original.queryHash,
    lastUpdatedAt: original.lastUpdatedAt,
    lastReviewId: original.lastReviewId,
    expiresAt: variant === 'expired' ? '1' : original.expiresAt,
  };
  const unsigned = Buffer.from(JSON.stringify(payload)).toString('base64');
  const domain = variant === 'expired' ? 'cms-03b-17' : 'cms-03b-03';
  const sealed = psql(`
    select platform_private.cms_signed_cursor_seal_page(
      '${domain}', jsonb_build_object('nextCursor', '${unsigned}'),
      array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[]
    )->>'nextCursor'`);
  const result = queueCursorEnvelope(sealed);
  expectSafeEqual(
    {
      queryHash: result.queryHash,
      lastUpdatedAt: result.lastUpdatedAt,
      lastReviewId: result.lastReviewId,
      expiresAt: result.expiresAt,
    },
    payload,
    'negative signer preserves the exact intended payload',
  );
  expectSafeEqual(
    result.keyId,
    original.keyId,
    'negative signer retains active key identity',
  );
  expect(
    result.signature === original.signature,
    'negative artifact is newly signed',
  ).toBe(false);
  return sealed;
};

export const expectReadHeaders = (response: S11Response): void => {
  expect(response.headers.get('cache-control') === 'no-store').toBe(true);
  expect(/^"[^"\r\n]+"$/u.test(response.headers.get('etag') ?? '')).toBe(true);
  expect(response.headers.get('location')).toBeNull();
};

export const expectReadIdentity = (
  stack: S11Stack,
  response: S11Response,
  requestId: string,
  correlationId: string,
): void => {
  expectSafeEqual(
    response.headers.get('x-request-id'),
    requestId,
    'read response request identity',
  );
  expect(stack.rpcs().length).toBeGreaterThan(0);
  for (const rpc of stack.rpcs()) {
    const context = rpc.request.context as Record<string, unknown> | undefined;
    expectSafeEqual(
      context?.requestId,
      requestId,
      'RPC context request identity',
    );
    expectSafeEqual(
      context?.correlationId,
      correlationId,
      'RPC context correlation identity',
    );
  }
};

export const expectQueueMembership = (
  items: readonly ReviewQueueItem[],
  expected: readonly string[],
  excluded: readonly string[],
): void => {
  const ids = items.map((item) => item.reviewId);
  expectSafeEqual(
    [...ids].sort(),
    [...expected].sort(),
    'exact queue membership',
  );
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of excluded)
    expect(ids.includes(id), 'excluded review absent').toBe(false);
};

/** A bounded, complete walk; missing final pages and repeated cursors fail. */
export const readQueuePages = async (
  stack: S11Stack,
  query: string,
  expected: readonly string[],
  limit = 1,
): Promise<readonly ReviewQueueItem[]> => {
  const items: ReviewQueueItem[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex <= expected.length; pageIndex += 1) {
    const suffix: string =
      cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
    const response = await stack.get(
      `/api/v1/cms/reviews?${query}&limit=${limit}${suffix}`,
    );
    expectStatus(response, 200);
    expectReadHeaders(response);
    const page = ReviewQueuePageSchema.parse(response.body);
    expectSafeEqual(
      response.headers.get('etag'),
      `"${page.pageVersion}"`,
      'queue page ETag',
    );
    expect(page.items.length).toBe(
      Math.min(limit, expected.length - items.length),
    );
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor === null) {
      expectQueueMembership(items, expected, []);
      for (let index = 1; index < items.length; index += 1) {
        const prior = items[index - 1]!;
        const next = items[index]!;
        expect(
          next.updatedAt < prior.updatedAt ||
            (next.updatedAt === prior.updatedAt &&
              next.reviewId < prior.reviewId),
          'strict keyset order across page boundaries',
        ).toBe(true);
      }
      return items;
    }
    expect(items.length).toBeLessThan(expected.length);
    expect(cursors.has(cursor), 'cursor never repeats').toBe(false);
    cursors.add(cursor);
  }
  throw new Error('queue did not terminate at its independently expected size');
};
