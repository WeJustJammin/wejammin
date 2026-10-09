/**
 * Slice 11 durable-effect snapshot helpers (lane S11-4R, first action3). Split
 * from `phase-02-slice-11-assert.ts` to stay within the 300-line utility limit
 * (`.agents/rules/extensibility.md`).

 * `snapshotDigest` hashes EVERY row of EVERY effect table SQL-SIDE (no row text
 * crosses the boundary) and returns only a count and a digest, so a failure diff
 * can never print a token, content or secret; a changed value moves the digest
 * even at an unchanged count. `decodeSnapshot` fails closed on anything that is
 * not the exact closed table set with an integer count and a 64-hex digest.
 */
import { createHash } from 'node:crypto';

import { expect } from 'vitest';

import { psql } from './stack';

/**
 * The durable-effect tables a Slice 11 command could write. The snapshot hashes
 * EVERY row of EVERY table (no filter at all): an incorrectly targeted side
 * effect, a mis-named audit/outbox action or an unexpected aggregate id cannot
 * escape, because the row set is not narrowed to the entry under test.
 */
export const EFFECT_TABLES = [
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

export type EffectSnapshot = Readonly<Record<string, string>>;

/**
 * The row-text SQL expression per table (aliased `t`); the default hashes the
 * WHOLE row. A caller overrides one table to project a controlled mutation, and
 * the value-blind mutant (below) drops the row text entirely. Both go through
 * this ONE builder and the ONE decoder, so weakening the boundary is observable.
 */
export type RowTextOverrides = Readonly<Record<string, string>>;

/**
 * A `snapshotDigest` option: `valueBlind` makes the fingerprint depend only on
 * the row COUNT, removing full-row value hashing. It is the controlled mutant
 * that must fail the projection assertion; the default (`false`) hashes rows.
 */
export type SnapshotOptions = Readonly<{ valueBlind?: boolean }>;

const DEFAULT_ROW_TEXT = 'pg_catalog.to_jsonb(t)::text';

/**
 * `<count>:<sha256>` for one table, SQL-side, as a jsonb object. The whole
 * ordered row text is hashed in the database by default (a changed value moves
 * the digest even at an unchanged count); with `valueBlind` only the count is
 * hashed, which is the boundary the projection control must detect as broken.
 */
const tableDigestSql = (
  table: string,
  rowText: string,
  valueBlind: boolean,
): string =>
  valueBlind
    ? `select jsonb_build_object('count', count(*), 'sha',
         pg_catalog.encode(pg_catalog.sha256(
           pg_catalog.convert_to(count(*)::text, 'utf8')), 'hex'))
       from ${table} t`
    : `select jsonb_build_object('count', count(*), 'sha',
         coalesce(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
           coalesce(pg_catalog.string_agg(${rowText}, E'\n'
             order by ${rowText}), ''), 'utf8')), 'hex'), ''))
       from ${table} t`;

const SHA256_HEX = /^[0-9a-f]{64}$/u;

/**
 * Decode one snapshot payload into `<count>:<sha>` per table, failing closed on
 * anything that is not the exact closed set of `EFFECT_TABLES`, each with a
 * nonnegative integer `count` and a 64-lowercase-hex `sha`. TypeScript casts are
 * not runtime proof: an omitted group, a stringified value (`count`/`sha`
 * undefined) or a malformed digest throws instead of comparing equal.
 */
export const decodeSnapshot = (raw: string): EffectSnapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('effect snapshot is not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('effect snapshot is not an object');
  const record = parsed as Record<string, unknown>;
  const expectedKeys = [...EFFECT_TABLES].sort();
  const actualKeys = Object.keys(record).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key, index) => key === expectedKeys[index])
  )
    throw new Error(
      `effect snapshot groups differ from the closed set: ${actualKeys.join(',')}`,
    );
  const out: Record<string, string> = {};
  for (const table of EFFECT_TABLES) {
    const value = record[table];
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new Error(`effect snapshot group ${table} is not an object`);
    const { count, sha } = value as { count?: unknown; sha?: unknown };
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0)
      throw new Error(`effect snapshot group ${table} has no integer count`);
    if (typeof sha !== 'string' || !SHA256_HEX.test(sha))
      throw new Error(`effect snapshot group ${table} has no sha256 digest`);
    out[table] = `${count}:${sha}`;
  }
  return out;
};

export const snapshotDigest = (
  rowTextOverrides: RowTextOverrides = {},
  options: SnapshotOptions = {},
): EffectSnapshot =>
  decodeSnapshot(
    psql(
      `select pg_catalog.jsonb_object_agg(tbl, d) from (values ${EFFECT_TABLES.map(
        (table) =>
          `('${table}', (${tableDigestSql(
            table,
            rowTextOverrides[table] ?? DEFAULT_ROW_TEXT,
            options.valueBlind === true,
          )}))`,
      ).join(', ')} ) as v(tbl, d)`,
    ),
  );

const IDEMPOTENCY = 'platform_private.idempotency_records';

/**
 * A SELECT-only row-text projection of the idempotency reservations: byte 0 of
 * `request_hash` is XOR-flipped IN THE SELECT via `set_byte`/`get_byte` (the
 * stored rows are never updated). A flip is guaranteed to change the value and
 * preserves the bytea type and length, so `to_jsonb` still serializes the
 * `\x<hex>` form at the SAME length. It exercises the SHARED `snapshotDigest`
 * builder and decoder through `rowTextOverrides`, so weakening the shared
 * full-row hashing boundary is observable here.
 */
export const idempotencyProjectionRowText =
  "(pg_catalog.to_jsonb(t) || pg_catalog.jsonb_build_object('request_hash', " +
  'pg_catalog.set_byte(t.request_hash, 0, ' +
  'pg_catalog.get_byte(t.request_hash, 0) # 255)))::text';

/** The stored octet length of every Slice 11 idempotency request_hash. */
export const idempotencyHashByteLength = (): number =>
  Number(
    psql(`
      select coalesce(pg_catalog.sum(pg_catalog.octet_length(t.request_hash)), 0)
        from platform_private.idempotency_records t
       where t.operation like 'CMS-03B-%'`),
  );

/**
 * The octet length of the SAME rows under the projection: the XOR flip must
 * leave every length identical, so a same-length change is what the comparator
 * detects (not a shorter serialization).
 */
export const idempotencyProjectedHashByteLength = (): number =>
  Number(
    psql(`
      select coalesce(pg_catalog.sum(pg_catalog.octet_length(
        pg_catalog.set_byte(t.request_hash, 0,
          pg_catalog.get_byte(t.request_hash, 0) # 255))), 0)
        from platform_private.idempotency_records t
       where t.operation like 'CMS-03B-%'`),
  );

/** Assert two effect snapshots are byte-identical (no write happened). */
export const expectUnchanged = (
  before: EffectSnapshot,
  after: EffectSnapshot,
  label: string,
): void => {
  expect(after, label).toEqual(before);
};

/** A digest of a full resource value, safe to print in a failure diff. */
export const resourceDigest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export { IDEMPOTENCY as IDEMPOTENCY_TABLE };
