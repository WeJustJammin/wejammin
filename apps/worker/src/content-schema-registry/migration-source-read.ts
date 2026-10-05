/**
 * Source-row read protocol: RPC `cms_read_schema_migration_source_rows`.
 * Request `{ migrationPlanId, expectedVersion, cursor, limit, leaseToken }`;
 * response `{ rows, nextCursor, done, targetFields, retiredFields }` with
 * exactly those keys. `targetFields[]` holds every changed field with its
 * compiled constraints, `retiredFields[]` the removed field keys. Every page
 * is validated before any row is transformed, so a malformed page never
 * reaches evidence. A page that is not the last must be full (`limit` rows):
 * the DB asserts evidence count == min(limit, remaining).
 */
import {
  MAX_MIGRATION_BATCH_ROWS,
  SCHEMA_MIGRATION_RPC,
} from './migration-worker-constants';
import type {
  SourcePage,
  SourceRow,
  TargetFieldSpec,
} from './migration-transform-types';
import {
  hasExactKeys,
  isCounter,
  isHash,
  isRecord,
  isUuid,
} from './migration-worker-schema-core';

export const READ_SOURCE_ROWS_RPC = SCHEMA_MIGRATION_RPC.readSourceRows;

const TABLE_TOKEN = /^[a-z][a-z0-9_]{0,62}$/u;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/u;
const MAX_FIELDS = 128;

const invalidResponse = {
  code: 'DEPENDENCY_INVALID_RESPONSE',
  retryable: false,
} as const;

const hasKeysWithOptional = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): boolean =>
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every(
    (key) => required.includes(key) || optional.includes(key),
  );

const parseTargetField = (value: unknown): TargetFieldSpec => {
  if (
    !isRecord(value) ||
    !hasKeysWithOptional(
      value,
      ['fieldKey', 'kind', 'required', 'defaultMode', 'defaultValue'],
      ['constraints'],
    ) ||
    typeof value.fieldKey !== 'string' ||
    !FIELD_KEY.test(value.fieldKey) ||
    typeof value.kind !== 'string' ||
    typeof value.required !== 'boolean' ||
    typeof value.defaultMode !== 'string' ||
    !(
      value.constraints === undefined ||
      value.constraints === null ||
      isRecord(value.constraints)
    )
  )
    throw invalidResponse;
  return {
    fieldKey: value.fieldKey,
    kind: value.kind,
    required: value.required,
    defaultMode: value.defaultMode,
    defaultValue: value.defaultValue,
    // Absent or null stays null so identity.revalidate refuses the row with
    // a typed error; the constraint payload itself is validated there.
    constraints: isRecord(value.constraints) ? value.constraints : null,
  };
};

const parseTargetFields = (value: unknown): readonly TargetFieldSpec[] => {
  if (!Array.isArray(value) || value.length > MAX_FIELDS) throw invalidResponse;
  const fields = value.map(parseTargetField);
  if (new Set(fields.map((field) => field.fieldKey)).size !== fields.length)
    throw invalidResponse;
  return fields;
};

const parseRetiredFields = (
  value: unknown,
  targets: readonly TargetFieldSpec[],
): readonly string[] => {
  if (!Array.isArray(value) || value.length > MAX_FIELDS) throw invalidResponse;
  const keys = new Set<string>(targets.map((field) => field.fieldKey));
  const retired = value.map((key: unknown) => {
    if (typeof key !== 'string' || !FIELD_KEY.test(key) || keys.has(key))
      throw invalidResponse;
    keys.add(key);
    return key;
  });
  return retired;
};

const parseRow = (value: unknown): SourceRow => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'sourceTable',
      'sourceRowId',
      'sourceHash',
      'document',
    ]) ||
    typeof value.sourceTable !== 'string' ||
    !TABLE_TOKEN.test(value.sourceTable) ||
    !isUuid(value.sourceRowId) ||
    !isHash(value.sourceHash) ||
    !isRecord(value.document)
  )
    throw invalidResponse;
  return {
    sourceTable: value.sourceTable,
    sourceRowId: value.sourceRowId,
    sourceHash: value.sourceHash,
    document: value.document,
  };
};

/** Parses one read page; `limit` is the bound requested (at most 128). */
export const parseSourcePage = (value: unknown, limit: number): SourcePage => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.rows) ||
    !isCounter(value.nextCursor) ||
    typeof value.done !== 'boolean' ||
    !hasExactKeys(value, [
      'rows',
      'nextCursor',
      'done',
      'targetFields',
      'retiredFields',
    ]) ||
    value.rows.length > Math.min(limit, MAX_MIGRATION_BATCH_ROWS) ||
    (!value.done && value.rows.length !== limit)
  )
    throw invalidResponse;
  const targetFields = parseTargetFields(value.targetFields);
  const retiredFields = parseRetiredFields(value.retiredFields, targetFields);
  const seen = new Set<string>();
  const rows = value.rows.map((candidate) => {
    const row = parseRow(candidate);
    const identity = `${row.sourceTable}:${row.sourceRowId}`;
    if (seen.has(identity)) throw invalidResponse;
    seen.add(identity);
    return row;
  });
  return {
    rows,
    nextCursor: value.nextCursor,
    done: value.done,
    targetFields,
    retiredFields,
  };
};
