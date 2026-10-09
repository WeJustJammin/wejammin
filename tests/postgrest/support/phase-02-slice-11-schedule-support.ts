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
import { psql } from './stack';

/** The CMS-03B-07 collection path. */
export const SCHEDULES = '/api/v1/cms/publication-schedules';

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
