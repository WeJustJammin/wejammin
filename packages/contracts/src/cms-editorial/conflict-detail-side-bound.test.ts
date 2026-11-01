import { describe, expect, it } from 'vitest';

import {
  ConflictDetailResourceSchema,
  ConflictDetailSideSchema,
} from './index';

/**
 * P2-S10-AC-089, clause "or a side over 256 KiB": BE03b CMS-03B-12 bounds each preimage side value to 256 KiB
 * (262,144 bytes of serialized JSON) and refuses a response with a larger side as a response-contract failure. The
 * bound lives in `JsonValueSchema` (`JSON_VALUE_MAX_BYTES`), which every side value passes through, so the strict
 * resource schema is what the Worker route and the web proxy use to refuse an over-bound side.
 */

const BOUND_BYTES = 262_144;

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const pointer = `/fields/${uuid3}`;

/** A string whose JSON serialization (quotes included) is exactly `bytes` UTF-8 bytes. */
const stringOfSerializedBytes = (bytes: number): string =>
  'x'.repeat(bytes - 2);

const authored = (value: unknown) => ({
  value,
  provenance: 'authored' as const,
  valueHash: hash,
});

const resourceWith = (
  side: 'base' | 'theirs' | 'yours',
  value: unknown,
): unknown => ({
  conflict: {
    id: uuid,
    version: '4',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [pointer],
    conflictHash: hash,
  },
  entry: { id: uuid2, version: '2', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: uuid,
    revisionNumber: '3',
    schemaVersionId: uuid2,
    contentHash: hash,
  },
  theirs: {
    revisionId: uuid2,
    revisionNumber: '4',
    schemaVersionId: uuid3,
    contentHash: hash,
  },
  yours: { source: 'revision', revisionId: uuid3, contentHash: hash },
  paths: [
    {
      path: pointer,
      base: authored(side === 'base' ? value : 'base'),
      theirs: authored(side === 'theirs' ? value : 'theirs'),
      yours: authored(side === 'yours' ? value : 'yours'),
    },
  ],
  resolvedRevisionId: null,
});

describe('[P2-S10-AC-089] CMS-03B-12 conflict detail preimage side bound', () => {
  it('accepts a side whose serialized value is exactly 256 KiB and refuses one byte more', () => {
    expect(
      Buffer.byteLength(
        JSON.stringify(stringOfSerializedBytes(BOUND_BYTES)),
        'utf8',
      ),
    ).toBe(BOUND_BYTES);
    expect(
      ConflictDetailSideSchema.safeParse(
        authored(stringOfSerializedBytes(BOUND_BYTES)),
      ).success,
    ).toBe(true);
    expect(
      ConflictDetailSideSchema.safeParse(
        authored(stringOfSerializedBytes(BOUND_BYTES + 1)),
      ).success,
    ).toBe(false);
  });

  it.each(['base', 'theirs', 'yours'] as const)(
    'refuses a resource whose %s side is over 256 KiB and serves the same resource at the bound',
    (side) => {
      expect(
        ConflictDetailResourceSchema.safeParse(
          resourceWith(side, stringOfSerializedBytes(BOUND_BYTES)),
        ).success,
        'the side exactly at the bound is served',
      ).toBe(true);
      const refused = ConflictDetailResourceSchema.safeParse(
        resourceWith(side, stringOfSerializedBytes(BOUND_BYTES + 1)),
      );
      expect(refused.success, 'the side one byte over the bound').toBe(false);
    },
  );

  it('counts serialized UTF-8 bytes, not characters, and covers a nested object value', () => {
    // 131,072 two-byte characters serialize to 262,146 bytes: far under the bound in characters, over it in bytes.
    const twoByte = 'é'.repeat(131_072);
    expect(twoByte.length).toBeLessThan(BOUND_BYTES);
    expect(ConflictDetailSideSchema.safeParse(authored(twoByte)).success).toBe(
      false,
    );
    // The same bound holds for an object value: {"k":"…"} is 8 bytes of structure around the string.
    const nested = (size: number) => ({ k: 'x'.repeat(size - 8) });
    expect(Buffer.byteLength(JSON.stringify(nested(BOUND_BYTES)), 'utf8')).toBe(
      BOUND_BYTES,
    );
    expect(
      ConflictDetailSideSchema.safeParse(authored(nested(BOUND_BYTES))).success,
    ).toBe(true);
    expect(
      ConflictDetailSideSchema.safeParse(authored(nested(BOUND_BYTES + 1)))
        .success,
    ).toBe(false);
  });
});
