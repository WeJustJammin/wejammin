/**
 * Slice 11 effect-snapshot comparator control (lane S11-4R, first action3). The
 * `snapshotDigest` helper must be a genuinely sensitive no-write oracle:

 *   * its decoder fails CLOSED on anything that is not the exact closed set of
 *     effect tables, each with a nonnegative integer count and a 64-lowercase-hex
 *     sha256 -- so the historical `::text` cast (which turned every group into a
 *     JSON string and yielded `undefined:undefined`, making every comparison
 *     equal) can never pass again;
 *   * it detects a changed row value while the row COUNT and the projected byte
 *     LENGTH are unchanged (a count/version-sum comparator cannot), proven against
 *     real committed rows through the SAME builder/decoder;
 *   * the MIME boundary is exercised through `expectSafeError` itself (no
 *     duplicate matcher oracle), so reverting its regex fails.

 * This file is RED against the stringified payload and GREEN against the strict
 * decoder. It commits fixtures (a world and one draft entry): run right after
 * `pnpm db:reset`, and reset again afterwards.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  EFFECT_TABLES,
  IDEMPOTENCY_TABLE,
  decodeSnapshot,
  expectSafeError,
  idempotencyHashByteLength,
  idempotencyProjectedHashByteLength,
  idempotencyProjectionRowText,
  sameInstant,
  snapshotDigest,
} from './support/phase-02-slice-11-assert';
import type { S11Response } from './support/phase-02-slice-11-stack';
import {
  type S11World,
  prepareS11World,
  seedDraft,
} from './support/phase-02-slice-11-world';
import { submitForReview } from './support/phase-02-slice-11-flow';
import {
  type S11Stack,
  createS11Stack,
} from './support/phase-02-slice-11-stack';

let world: S11World;
let stack: S11Stack;

beforeAll(async () => {
  world = await prepareS11World();
  stack = createS11Stack(world.owner);
  const seeded = await seedDraft(stack, world, 'Effect snapshot subject');
  // A real submit creates one CMS-03B-05 idempotency reservation, so the
  // row-projection control below has a populated real row to mutate in SELECT.
  await submitForReview(stack, world, seeded);
});

const goodGroup = { count: 1, sha: 'a'.repeat(64) };
const goodPayload = (): string =>
  JSON.stringify(
    Object.fromEntries(EXPECTED_TABLES.map((table) => [table, goodGroup])),
  );

/**
 * The expected closed group set, written out EXPLICITLY (not sourced from the
 * helper's `EFFECT_TABLES`): deleting a group from the helper must fail this
 * oracle, not delete it too.
 */
const EXPECTED_TABLES = [
  'platform_private.cms_editorial_reviews',
  'platform_private.cms_editorial_decisions',
  'platform_private.cms_editorial_review_assignments',
  'platform_private.cms_editorial_review_dependencies',
  'platform_private.cms_publication_schedules',
  'platform_private.cms_publication_versions',
  'platform_private.cms_preview_tokens',
  'platform_private.cms_publication_settings_snapshots',
  'platform_private.cms_command_accessibility_evidence',
  'platform_private.idempotency_records',
  'platform_private.outbox_events',
  'audit_private.audit_events',
  'platform_private.cms_content_entries',
  'platform_private.cms_entry_revisions',
] as const;

describe('the effect-snapshot decoder fails closed', () => {
  it('accepts the exact closed group set with integer counts and 64-hex digests', () => {
    const decoded = decodeSnapshot(goodPayload());
    expect(Object.keys(decoded).sort()).toEqual([...EXPECTED_TABLES].sort());
    // The helper's own group set matches the independent oracle exactly.
    expect([...EFFECT_TABLES].sort()).toEqual([...EXPECTED_TABLES].sort());
    expect(decoded[EFFECT_TABLES[0] as string]).toBe(`1:${'a'.repeat(64)}`);
  });

  it('rejects the historical stringified group (the ::text cast yields undefined:undefined)', () => {
    const stringified = JSON.stringify(
      Object.fromEntries(
        EFFECT_TABLES.map((table) => [table, JSON.stringify(goodGroup)]),
      ),
    );
    expect(() => decodeSnapshot(stringified)).toThrow(/not an object/u);
  });

  it('rejects an omitted group, a malformed sha, a negative count and a non-JSON payload', () => {
    const omitted = JSON.parse(goodPayload()) as Record<string, unknown>;
    delete omitted[EFFECT_TABLES[0] as string];
    expect(() => decodeSnapshot(JSON.stringify(omitted))).toThrow(
      /closed set/u,
    );

    const badSha = JSON.parse(goodPayload()) as Record<string, unknown>;
    badSha[EFFECT_TABLES[1] as string] = { count: 1, sha: 'xyz' };
    expect(() => decodeSnapshot(JSON.stringify(badSha))).toThrow(
      /no sha256 digest/u,
    );

    const negative = JSON.parse(goodPayload()) as Record<string, unknown>;
    negative[EFFECT_TABLES[2] as string] = { count: -1, sha: 'a'.repeat(64) };
    expect(() => decodeSnapshot(JSON.stringify(negative))).toThrow(
      /integer count/u,
    );

    expect(() => decodeSnapshot('not json')).toThrow(/not JSON/u);
  });
});

describe('the effect snapshot detects a changed value at an unchanged count', () => {
  const IDEMPOTENCY = IDEMPOTENCY_TABLE;

  it('moves the shared fingerprint for a same-length changed value, at an unchanged count and projected byte length, through the same builder/decoder', () => {
    // Baseline and projection both run the SHARED `snapshotDigest` builder and
    // decoder; only the idempotency row-text expression differs, XOR-flipping byte 0
    // of request_hash IN THE SELECT (the stored rows are never updated). The flip
    // preserves the bytea type and length, so the projected byte length equals the
    // stored one -- the change the fingerprint must detect is a genuine same-length
    // value change, not a shorter serialization.
    const storedBytes = idempotencyHashByteLength();
    expect(storedBytes).toBeGreaterThan(0);
    // The actual projected byte length equals the stored length (guaranteed flip).
    expect(idempotencyProjectedHashByteLength()).toBe(storedBytes);
    const baseline = snapshotDigest();
    const projected = snapshotDigest({
      [IDEMPOTENCY]: idempotencyProjectionRowText,
    });

    // The projected group's count is unchanged, but its fingerprint moved.
    const baseCount = baseline[IDEMPOTENCY]?.split(':')[0];
    expect(projected[IDEMPOTENCY]?.split(':')[0]).toBe(baseCount);
    expect(projected[IDEMPOTENCY]).not.toBe(baseline[IDEMPOTENCY]);

    // The projection touches ONLY the idempotency group: every other group's
    // fingerprint is identical, so the shared builder ran for all fourteen.
    const others = Object.keys(baseline).filter((key) => key !== IDEMPOTENCY);
    expect(others.length).toBe(13);
    for (const key of others) expect(projected[key]).toBe(baseline[key]);

    // No stored row changed: the byte length and the full baseline are identical.
    expect(idempotencyHashByteLength()).toBe(storedBytes);
    expect(snapshotDigest()).toEqual(baseline);
  });

  it('the whole-effect snapshot is stable across two identical reads (no false positive)', () => {
    const first = snapshotDigest();
    expect(snapshotDigest()).toEqual(first);
  });

  it('the value-blind mutant removes sensitivity from the shared boundary, so the projection assertion would fail', () => {
    // The controlled mutant drops full-row value hashing from the SHARED builder
    // (only the count is hashed). Under it, the same-length request_hash change is
    // no longer detected, so the projection assertion above (projected != baseline)
    // would fail: the assertion is genuinely sensitive to the shared boundary.
    const baseline = snapshotDigest();
    const valueBlindBaseline = snapshotDigest({}, { valueBlind: true });
    const valueBlindProjected = snapshotDigest(
      { [IDEMPOTENCY]: idempotencyProjectionRowText },
      { valueBlind: true },
    );
    // Under the value-blind boundary the projection is invisible (equal fingerprints),
    // while the default boundary detects it (they differ) -- so the assertion above is
    // sensitive to exactly the shared full-row hashing it guards.
    expect(valueBlindProjected[IDEMPOTENCY]).toBe(
      valueBlindBaseline[IDEMPOTENCY],
    );
    expect(baseline[IDEMPOTENCY]).not.toBe(
      snapshotDigest({ [IDEMPOTENCY]: idempotencyProjectionRowText })[
        IDEMPOTENCY
      ],
    );
  });
});

describe('sameInstant is exact to the nanosecond', () => {
  it('treats a whole-second and a millisecond spelling of one instant as equal, and a sub-second difference as distinct', () => {
    expect(
      sameInstant('2026-12-01T08:00:00Z', '2026-12-01T08:00:00.000Z'),
    ).toBe(true);
    expect(
      sameInstant('2026-12-01T08:00:00Z', '2026-12-01T08:00:00.000000001Z'),
    ).toBe(false);
    // A one-nanosecond difference and an equal offset spelling both behave exactly.
    expect(
      sameInstant(
        '2026-12-01T08:00:00.000000001Z',
        '2026-12-01T08:00:00.000000002Z',
      ),
    ).toBe(false);
    expect(
      sameInstant('2026-12-01T09:00:00+01:00', '2026-12-01T08:00:00Z'),
    ).toBe(true);
  });
});

describe('the MIME boundary is exact', () => {
  // A minimal strict BE00 ApiError response; no real identifiers are printed in a
  // failure (the summary echoes only a closed-grammar code and a body digest).
  const errorResponse = (contentType: string): S11Response => ({
    status: 409,
    headers: new Headers({
      'content-type': contentType,
      'cache-control': 'no-store',
      'x-request-id': '00000000-0000-4000-8000-000000000000',
    }),
    body: {
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
      message: 'conflict',
      requestId: '00000000-0000-4000-8000-000000000000',
    },
    text: '{}',
  });

  it('expectSafeError accepts both application/json forms', () => {
    for (const contentType of [
      'application/json',
      'application/json; charset=UTF-8',
    ]) {
      expect(() =>
        expectSafeError(errorResponse(contentType), {
          status: 409,
          code: 'CONFLICT',
          details: {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'refresh',
          },
        }),
      ).not.toThrow();
    }
  });

  it('expectSafeError rejects a prefix-suffixed media type', () => {
    for (const contentType of [
      'application/json-not-json',
      'application/jsonx',
    ]) {
      expect(() =>
        expectSafeError(errorResponse(contentType), {
          status: 409,
          code: 'CONFLICT',
          details: {
            conflict: 'INVALID_TRANSITION',
            recoveryAction: 'refresh',
          },
        }),
      ).toThrow();
    }
  });
});
