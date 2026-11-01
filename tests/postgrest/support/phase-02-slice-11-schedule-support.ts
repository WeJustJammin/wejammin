/**
 * Reusable CMS-03B-07 schedule request/row helpers for the Slice 11 schedule and
 * sweep suites (lane S11-4R). Extracted from `phase-02-slice-11-schedule.apispec.ts`
 * to keep the suite within the 400-line test limit while preserving every test and
 * behaviour. The helpers take the caller's `stack`/`tzdb` so the suite keeps its
 * own isolated fixtures.
 *
 * DB-BEARING: `scheduleRow` calls `psql` and this module imports `./stack`, whose
 * module load runs `statusEnv()`/docker. It is NOT a pure module; a pure control
 * must not import it.
 */
import type { ReviewedDraft } from './phase-02-slice-11-flow';
import type { S11Stack } from './phase-02-slice-11-stack';
import { expect } from 'vitest';
import { ScheduleExecutionResultSchema } from '@wejammin/contracts';
import {
  claimsOf,
  executionOf,
  strictValue,
  type SweepTrace,
} from './phase-02-slice-11-sweep-support';
import {
  type EffectSnapshot,
  EFFECT_TABLES,
  expectUnchanged,
} from './phase-02-slice-11-assert';
import { supabaseRpcHeaders } from '../../../apps/worker/src/supabase-rpc-headers';
import {
  API_URL,
  psql,
  workerServiceCredential,
  type RpcOutcome,
} from './stack';

const EXECUTE = 'cms_execute_publication_schedule';

/** The CMS-03B-07 collection path. */
export const SCHEDULES = '/api/v1/cms/publication-schedules';

/** Yield to the real clock in bounded intervals; never rewrite schedule or lease instants. */
export const sleepUntil = async (iso: string): Promise<void> => {
  let remaining = Date.parse(iso) - Date.now() + 1_500;
  while (remaining > 0) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(remaining, 30_000)),
    );
    remaining = Date.parse(iso) - Date.now() + 1_500;
  }
};

/** Replay the exact captured internal command against PostgREST, without regenerating any operand. */
export const replayExecution = async (request: Record<string, unknown>) => {
  const response = await resendExecution(request);
  expect(response.status).toBe(200);
  return strictValue(ScheduleExecutionResultSchema, response.body);
};

/** Fresh transport only: exact captured claim, lease, CAS and evidence operands. */
export const resendExecution = async (
  request: Record<string, unknown>,
): Promise<RpcOutcome> => {
  const response = await fetch(`${API_URL}/rest/v1/rpc/${EXECUTE}`, {
    method: 'POST',
    headers: {
      ...supabaseRpcHeaders(workerServiceCredential()),
      'content-type': 'application/json',
      'content-profile': 'platform_api',
      'accept-profile': 'platform_api',
    },
    body: JSON.stringify({ p_request: request }),
  });
  const text = await response.text();
  const parsed: unknown = (() => {
    try {
      return text === '' ? null : (JSON.parse(text) as unknown);
    } catch {
      return text;
    }
  })();
  const record =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    status: response.status,
    message: typeof record.message === 'string' ? record.message : '',
    code: typeof record.code === 'string' ? record.code : '',
    body: parsed,
  };
};

/** Observe real server-clock expiry without changing the row or inventing time. */
export const waitForLeaseExpiry = async (scheduleId: string): Promise<void> => {
  for (;;) {
    const value =
      psql(`select greatest(0, extract(epoch from lease_until - clock_timestamp()))
      from platform_private.cms_publication_schedules where id = '${scheduleId}'
        and state = 'executing' and lease_id is not null and lease_until is not null`);
    if (value === '') throw new Error('actual executing lease missing');
    const seconds = Number(value);
    if (!Number.isFinite(seconds))
      throw new Error('actual lease expiry is invalid');
    if (seconds <= 0) return;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(seconds * 1_000 + 100, 30_000)),
    );
  }
};

/** Compare the stored five-field audit summary to the actual Worker evidence, SQL-side hash only. */
export const expectStoredEvidence = (
  trace: SweepTrace,
  scheduleId: string,
): void => {
  const { request } = executionOf(trace, scheduleId);
  const claim = claimsOf(trace).find((item) => item.scheduleId === scheduleId);
  if (claim === undefined)
    throw new Error('stored evidence requires actual claim');
  const evidence = request.evidence;
  if (evidence === null)
    throw new Error('stored evidence assertion requires actual proof');
  const matches =
    psql(`select count(*) from platform_private.cms_command_accessibility_evidence
    where subject_id = '${scheduleId}' and operation_id = 'CMS-03B-20'
      and revision_id = '${claim.revisionId}' and correlation_id = '${claim.correlationId}'
      and checker_key = '${evidence.providerKey}' and checker_version = ${evidence.providerVersion}
      and outcome = '${evidence.outcome}' and blocking_count = ${evidence.blockingCount}
      and input_hash = '${evidence.inputHash}'`);
  expect(matches).toBe('1');
};

/** An ISO instant truncated to whole seconds (the schedule body's second precision). */
export const isoSecond = (at: Date): string => at.toISOString().slice(0, 19);

/**
 * A UTC schedule request `leadMs` from now (UTC wall clock equals the resolved
 * instant), pinned to `tzdbVersion`, optionally overridden.
 */
export const utcScheduleBody = (
  draft: ReviewedDraft,
  leadMs: number,
  tzdbVersion: string,
  over: Record<string, unknown> = {},
) => {
  const local = isoSecond(new Date(Date.now() + leadMs));
  return {
    revisionId: draft.revisionId,
    action: 'publish',
    localDateTime: local,
    timezone: 'UTC',
    resolvedUtc: `${local}Z`,
    tzdbVersion,
    disambiguation: 'none',
    audience: 'public',
    expectedVersion: draft.reviewVersion,
    ...over,
  };
};

/** POST one CMS-03B-07 schedule under the strong review `If-Match`. */
export const postSchedule = (
  stack: S11Stack,
  draft: ReviewedDraft,
  body: Record<string, unknown>,
  options: { key?: string; ifMatch?: string } = {},
) =>
  stack.post(SCHEDULES, {
    body,
    ifMatch: options.ifMatch ?? draft.reviewVersion,
    ...(options.key === undefined ? {} : { idempotencyKey: options.key }),
  });

/** The `state/version/attempt_count/reason_code` projection of one schedule row. */
export const scheduleRow = (id: string): string =>
  psql(
    `select state || '/' || version || '/' || attempt_count || '/' || coalesce(reason_code, '-')
       from platform_private.cms_publication_schedules where id = '${id}'`,
  );

/** Exact whole-table deltas; every other full-row group remains byte-identical. */
export const expectScheduleEffects = (
  before: EffectSnapshot,
  after: EffectSnapshot,
  deltas: Readonly<Record<string, number>> = {
    'platform_private.cms_publication_schedules': 1,
    'platform_private.idempotency_records': 1,
    'platform_private.cms_command_accessibility_evidence': 1,
    'audit_private.audit_events': 1,
  },
): void => {
  for (const table of EFFECT_TABLES) {
    if (!Object.hasOwn(deltas, table)) {
      expectUnchanged(
        { [table]: before[table] as string },
        {
          [table]: after[table] as string,
        },
        'unrelated complete effect group remains unchanged',
      );
      continue;
    }
    expect(
      Number(after[table]?.split(':')[0]) -
        Number(before[table]?.split(':')[0]),
      `effect group ${table}: before=${Number(before[table]?.split(':')[0])}, after=${Number(after[table]?.split(':')[0])}, expectedDelta=${deltas[table]}`,
    ).toBe(deltas[table]);
    expect(after[table] === before[table]).toBe(false);
  }
};
