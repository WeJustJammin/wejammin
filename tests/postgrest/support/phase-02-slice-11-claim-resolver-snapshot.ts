import { execFileSync } from 'node:child_process';

import {
  CLAIM_RESOLVER_TABLES,
  decodeClaimResolverSnapshot,
  type ClaimResolverRowTextOverrides,
  type ClaimResolverSnapshot,
  type ClaimResolverTable,
} from './phase-02-slice-11-claim-resolver-snapshot-core';

// Runtime-only SELECT transport. Importing stack.ts would execute status/secret
// discovery; this module intentionally imports neither that module nor credentials.
const select = (sql: string): string => {
  try {
    return execFileSync(
      'docker',
      [
        'exec',
        '-i',
        process.env.S09_DB_CONTAINER ?? 'supabase_db_wejammin',
        'psql',
        '-X',
        '-q',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-At',
        '-F',
        '|',
      ],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  } catch {
    throw new Error('claim resolver snapshot database read failed');
  }
};

const tableDigestSql = (
  table: ClaimResolverTable,
  rowText: string,
  valueBlind: boolean,
): string => {
  const content = valueBlind
    ? 'count(*)::text'
    : `coalesce(pg_catalog.string_agg(${rowText}, E'\\n' order by ${rowText}), '')`;
  return `select pg_catalog.jsonb_build_object('count', count(*), 'sha',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${content}, 'utf8')), 'hex'))
    from ${table} t`;
};

/** Hash every ordered full row SQL-side; only count and digest leave the DB. */
export const snapshotClaimResolver = (
  overrides: ClaimResolverRowTextOverrides = {},
  options: Readonly<{ valueBlind?: boolean }> = {},
): ClaimResolverSnapshot =>
  decodeClaimResolverSnapshot(
    select(
      `select pg_catalog.jsonb_object_agg(tbl, digest) from (values ${CLAIM_RESOLVER_TABLES.map(
        (table) =>
          `('${table}', (${tableDigestSql(
            table,
            overrides[table] ?? 'pg_catalog.to_jsonb(t)::text',
            options.valueBlind === true,
          )}))`,
      ).join(', ')}) as snapshots(tbl, digest)`,
    ),
  );

/** SELECT-only UUID projection: changes a nonnull token without changing length. */
export const claimJobLeaseProjectionRowText =
  "(pg_catalog.to_jsonb(t) || pg_catalog.jsonb_build_object('lease_token', " +
  'case when t.lease_token is null then null else (' +
  "case when pg_catalog.substr(t.lease_token::text, 1, 1) = 'a' then 'b' else 'a' end " +
  '|| pg_catalog.substr(t.lease_token::text, 2))::uuid end))::text';

/** Whole-table token text length; null tokens contribute zero. */
export const claimJobLeaseTextLength = (): number => {
  const raw =
    select(`select coalesce(pg_catalog.sum(pg_catalog.length(t.lease_token::text)), 0)
    from platform_private.jobs t`);
  const value = Number(raw);
  if (!/^(?:0|[1-9][0-9]*)$/u.test(raw) || !Number.isSafeInteger(value))
    throw new Error('claim resolver snapshot token length is invalid');
  return value;
};
