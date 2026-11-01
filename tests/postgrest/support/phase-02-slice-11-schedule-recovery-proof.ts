/** Read-only attribution of genuine expired-lease recovery during one sweep.
 * No fabricated rows, clock overrides, lease changes or recovery invocation.
 * Call capture immediately before the tick, then assert immediately afterward.
 * Concurrent locks/other writers or another expiry during that gap are not hidden.
 * DB-BEARING: imports stack (module load observes Docker/statusEnv) and invokes
 * psql. Never import this observer into a pure control.
 */
import { z } from 'zod';

import { expectSafeEqual } from './phase-02-slice-11-assert-core';
import { psql } from './stack';

const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u)
  .refine((value) => value !== '00000000-0000-0000-0000-000000000000');
const sha = z.string().regex(/^[0-9a-f]{64}$/u);
const version = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/u)
  .refine((value) => value.length < 19 || value <= '9223372036854775807');
const instant = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u);
const audit = z.object({ id: uuid, sha }).strict().readonly();
const candidate = z
  .object({
    id: uuid,
    attempt: z.number().int().min(0).max(3),
    version,
    reason: z
      .string()
      .regex(/^[a-z_]+$/u)
      .nullable(),
    leasePresent: z.literal(true),
    immutableSha: sha,
    audits: z
      .array(audit)
      .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length)
      .readonly(),
  })
  .strict()
  .readonly();
const snapshot = z
  .object({
    observedAt: instant,
    eligibleRecoveryCount: z.number().int().min(0).max(100),
    candidates: z.array(candidate).max(100).readonly(),
  })
  .strict()
  .refine(
    (value) =>
      value.eligibleRecoveryCount === value.candidates.length &&
      new Set(value.candidates.map((row) => row.id)).size ===
        value.candidates.length,
  )
  .readonly();

export type ScheduleRecoveryProof = z.infer<typeof snapshot>;

// Hash full stored rows SQL-side. Only these recovery-written columns are omitted.
const immutableRow = `(pg_catalog.to_jsonb(s) - array[
  'state', 'attempt_count', 'version', 'lease_id', 'lease_until',
  'next_attempt_at', 'updated_at', 'reason_code']::text[])::text`;
const digest = (expression: string): string =>
  `pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(${expression}, 'utf8')), 'hex')`;
const auditImage = `jsonb_build_object('id', a.id, 'sha',
  ${digest('pg_catalog.to_jsonb(a)::text')})`;

const read = (sql: string): unknown => {
  try {
    return JSON.parse(psql(sql));
  } catch {
    throw new Error('schedule recovery proof database read failed');
  }
};

/** Exact first-100 source candidates, no lock or mutation; zero is valid. */
export const captureScheduleRecoveryProof = (): ScheduleRecoveryProof => {
  const parsed = snapshot.safeParse(
    read(`
    with clock as materialized (select pg_catalog.clock_timestamp() as stamp),
    eligible as materialized (
      select s.* from platform_private.cms_publication_schedules s cross join clock
      where s.state = 'executing' and s.lease_until <= clock.stamp
      order by s.lease_until, s.id limit 100
    )
    select jsonb_build_object(
      'observedAt', to_char(clock.stamp at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'eligibleRecoveryCount', (select count(*) from eligible),
      'candidates', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'attempt', s.attempt_count, 'version', s.version::text,
        'reason', s.reason_code, 'leasePresent', s.lease_id is not null,
        'immutableSha', ${digest(immutableRow)},
        'audits', (select coalesce(jsonb_agg(${auditImage} order by a.id), '[]'::jsonb)
          from audit_private.audit_events a
          where a.target_type = 'cms_publication_schedule' and a.target_id = s.id)
      ) order by s.lease_until, s.id), '[]'::jsonb) from eligible s)
    ) from clock`),
  );
  if (!parsed.success)
    throw new Error('schedule recovery proof snapshot invalid');
  return parsed.data;
};

/** Return the BEFORE-derived count only after every actual transition is proved.
 * PostgreSQL compares microsecond clock bounds and fixed intervals; no JS Date
 * arithmetic and no conversion of timestamps or versions to floating point.
 */
export const assertScheduleRecoveryProof = (
  before: ScheduleRecoveryProof,
): number => {
  const parsed = snapshot.safeParse(before);
  if (!parsed.success) throw new Error('schedule recovery proof input invalid');
  const proof = parsed.data;
  const literal = JSON.stringify(proof).replaceAll("'", "''");
  const actual = read(`
    with clock as materialized (select pg_catalog.clock_timestamp() as stamp),
    input as materialized (select '${literal}'::jsonb as value),
    prior as materialized (
      select b.*, (input.value->>'observedAt')::timestamptz as observed_at,
        case b.attempt when 0 then interval '15 seconds'
          when 1 then interval '60 seconds' when 2 then interval '300 seconds'
        end as delay
      from input cross join lateral jsonb_to_recordset(input.value->'candidates')
        b(id uuid, attempt integer, version text, reason text,
          "immutableSha" text, audits jsonb)
    )
    select jsonb_build_object(
      'clockOrdered', clock.stamp >= (input.value->>'observedAt')::timestamptz,
      'candidateCount', (select count(*) from prior),
      'rows', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'present', s.id is not null,
        'state', s.state = case when b.attempt < 3 then 'failed_retryable' else 'blocked' end,
        'attempt', s.attempt_count = case when b.attempt < 3 then b.attempt + 1 else 3 end,
        'version', s.version::numeric = b.version::numeric + 1,
        'leaseCleared', s.lease_id is null and s.lease_until is null,
        'reason', s.reason_code is not distinct from
          case when b.attempt < 3 then b.reason else 'retries_exhausted' end,
        'immutable', ${digest(immutableRow)} = b."immutableSha",
        'updatedInWindow', s.updated_at between b.observed_at and clock.stamp,
        'nextAttempt', case when b.attempt = 3 then s.next_attempt_at is null else
          s.next_attempt_at between b.observed_at + b.delay and clock.stamp + b.delay
          and s.next_attempt_at = s.updated_at + b.delay end,
        'priorAudits', (select coalesce(jsonb_agg(${auditImage} order by a.id), '[]'::jsonb)
          from audit_private.audit_events a
          where a.target_type = 'cms_publication_schedule' and a.target_id = b.id
            and exists (select 1 from jsonb_array_elements(b.audits) old
              where old->>'id' = a.id::text)) = b.audits,
        'newAuditCount', fresh.count,
        'newAuditPolicy', fresh.policy
      ) order by b.id), '[]'::jsonb)
      from prior b left join platform_private.cms_publication_schedules s on s.id = b.id
      cross join lateral (
        select count(*) as count, bool_and(
          a.action = case when b.attempt < 3 then 'cms.publication.schedule.retry'
            else 'cms.publication.schedule.block' end
          and a.reason_code = case when b.attempt < 3 then 'CMS_PUBLICATION_SCHEDULE_RETRY'
            else 'CMS_PUBLICATION_SCHEDULE_BLOCKED' end
        ) as policy
        from audit_private.audit_events a
        where a.target_type = 'cms_publication_schedule' and a.target_id = b.id
          and not exists (select 1 from jsonb_array_elements(b.audits) old
            where old->>'id' = a.id::text)
      ) fresh)
    ) from clock cross join input`);
  expectSafeEqual(
    actual,
    {
      clockOrdered: true,
      candidateCount: proof.eligibleRecoveryCount,
      rows: [...proof.candidates]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => ({
          id: row.id,
          present: true,
          state: true,
          attempt: true,
          version: true,
          leaseCleared: true,
          reason: true,
          immutable: true,
          updatedInWindow: true,
          nextAttempt: true,
          priorAudits: true,
          newAuditCount: 1,
          newAuditPolicy: true,
        })),
    },
    'expired schedule recovery preserves immutable rows and proves exact retry/block audits',
  );
  return proof.eligibleRecoveryCount;
};
