/**
 * Slice 11 durable-effect snapshot helpers (lane S11-4R). The PURE decoder and
 * table list live in `phase-02-slice-11-snapshot-core.ts` (no DB import) and are
 * re-exported here; this module adds the DB-bearing `snapshotDigest` builder and
 * the idempotency projections, which call `psql` at run time (never at import).
 * `snapshotDigest` hashes EVERY row of EVERY effect table SQL-SIDE (no row text
 * crosses the boundary) and returns only a count and a digest.
 */
import { createHash } from 'node:crypto';

import { expect } from 'vitest';

import {
  EFFECT_TABLES,
  type EffectSnapshot,
  type RowTextOverrides,
  type SnapshotOptions,
  decodeSnapshot,
} from './phase-02-slice-11-snapshot-core';
import { psql } from './stack';

export {
  EFFECT_TABLES,
  decodeSnapshot,
} from './phase-02-slice-11-snapshot-core';
export type {
  EffectSnapshot,
  RowTextOverrides,
  SnapshotOptions,
} from './phase-02-slice-11-snapshot-core';

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
