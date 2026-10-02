/**
 * Source-row read protocol: RPC `cms_read_schema_migration_source_rows`.
 * Request `{ migrationPlanId, expectedVersion, cursor, limit, leaseToken }`;
 * response `{ rows, nextCursor, done, targetField? }`. Every page is validated
 * before any row is transformed, so a malformed page never reaches evidence.
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

const invalidResponse = {
  code: 'DEPENDENCY_INVALID_RESPONSE',
  retryable: false,
} as const;

const parseTargetField = (value: unknown): TargetFieldSpec | null => {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'fieldKey',
      'kind',
      'required',
      'defaultMode',
      'defaultValue',
    ]) ||
    typeof value.fieldKey !== 'string' ||
    !FIELD_KEY.test(value.fieldKey) ||
    typeof value.kind !== 'string' ||
    typeof value.required !== 'boolean' ||
    typeof value.defaultMode !== 'string'
  )
    throw invalidResponse;
  return {
    fieldKey: value.fieldKey,
    kind: value.kind,
    required: value.required,
    defaultMode: value.defaultMode,
    defaultValue: value.defaultValue,
  };
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
    Object.keys(value).some(
      (key) => !['rows', 'nextCursor', 'done', 'targetField'].includes(key),
    ) ||
    value.rows.length > Math.min(limit, MAX_MIGRATION_BATCH_ROWS)
  )
    throw invalidResponse;
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
    targetField: parseTargetField(value.targetField),
  };
};
