/**
 * Kit of the Slice 11 dependency-recheck race runner
 * (supabase/tests/phase_02_slice_11_races/031-dependency-recheck-race.mjs; P2-S11-AC-113, BE03b "Review invalidation /
 * Dependency recheck": platform_api.cms_dependency_recheck_run).  Like review-kit.mjs, every call is a fresh `psql`
 * process inside the disposable local Supabase database container, so an ordering or lock guarantee is proven across real
 * committed PostgreSQL sessions, which a single-transaction pgTAP file cannot do.  Run only right after `pnpm db:reset`.
 *
 * The fixture is the SAME pgTAP fragments `phase_02_slice_11_recheck_run.sql` includes (the Slice 10 organization fixture,
 * the Slice 11 data-model fixture, the h11doc world, the review builders and the block registry fixtures) executed once in
 * a script that COMMITS, plus supabase/tests/phase_02_slice_11_recheck_race/090-race-fixture.sqlinc (the reviews, the
 * withdrawn blocks and the source events the races use).  The job is driven only through the named RPC, exactly as the
 * Worker's `cms.review.dependency_recheck` job calls it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as review from './review-kit.mjs';
import * as kit from './race-kit.mjs';

export const { check, sql, jsonb, sleep } = review;
export const {
  waitFor,
  isLockWaiting,
  holdReviewLock,
  blockedBy,
  reviewState,
  count,
  eventCount,
} = review;
const { runScript, runAsync } = kit;

const fragment = (relative) =>
  readFileSync(join(kit.testsDir, relative), 'utf8');

const FRAGMENTS = [
  'phase_02_slice_10_rpc/000-helpers.sqlinc',
  'phase_02_slice_10_remaining_schema/000-helpers.sqlinc',
  'phase_02_slice_10_rpc/001-fixtures.sqlinc',
  'phase_02_slice_11_schema/000-helpers.sqlinc',
  'phase_02_slice_11_schema/001-fixture.sqlinc',
  'phase_02_slice_11_schema/002-row-builders.sqlinc',
  'phase_02_slice_11_helpers/000-helpers.sqlinc',
  'phase_02_slice_11_helpers/001-world.sqlinc',
  'phase_02_slice_11_helpers/002-reviews.sqlinc',
  'phase_02_slice_11_helpers/003-registry.sqlinc',
  'phase_02_slice_11_recheck_race/090-race-fixture.sqlinc',
];

/** Builds the committed fixture; returns the ids document of 090-race-fixture.sqlinc. */
export const buildRecheckFixture = () => {
  runScript(
    "create extension if not exists pgtap with schema extensions;\nselect '{}';",
    's11race-setup-ext',
  );
  const script = [
    '\\set ON_ERROR_STOP on',
    fragment('support/jwt-claims.sqlinc'),
    'begin;',
    'select no_plan();',
    ...FRAGMENTS.map(fragment),
    'commit;',
  ].join('\n');
  return JSON.parse(runScript(script, 's11race-recheck-setup'));
};

/** The exact request of one run of the job (the cursor is null for the first message). */
export const runRequest = (eventId, kind, refId, cursor = null) => ({
  eventId,
  kind,
  refId,
  cursor,
});

/**
 * One run of the job in a background session (the platform_api wrapper, as the Worker calls it); `done` resolves
 * { code, stdout, stderr, response } with `response` the parsed `{ examined, invalidated, nextCursor }` (null on an error).
 */
export const startRun = (appName, request) => {
  const session = runAsync(
    appName,
    `begin; select platform_api.cms_dependency_recheck_run(${jsonb(request)}); commit;`,
  );
  return {
    app: appName,
    session,
    done: session.done.then((outcome) => {
      const line = outcome.stdout
        .split('\n')
        .filter((candidate) => candidate.startsWith('{'))
        .at(-1);
      return {
        ...outcome,
        response: line === undefined ? null : JSON.parse(line),
      };
    }),
  };
};

/** True when the outcome is a clean commit: exit 0, a parsed answer and no error text (no deadlock, no unique violation). */
export const clean = (outcome) =>
  outcome.code === 0 &&
  outcome.response !== null &&
  !/ERROR|deadlock|duplicate key|CONFLICT/u.test(outcome.stderr);

/** The first error line of an outcome, or `ok`. */
export const failure = (outcome) =>
  (outcome.stderr || '').split('\n').find((line) => /ERROR/u.test(line)) ??
  'ok';

// ---------------------------------------------------------------- database reads ----
/** Committed `cms.entry.review-changed.v1` events of all reviews (the fixture and the runner emit no other). */
export const reviewChangedEvents = () =>
  count(
    "select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1';",
  );

/** Committed audit records of the invalidation core, for all reviews. */
export const invalidationAudits = () =>
  count(
    "select count(*) from audit_private.audit_events where action = 'cms.entry.review.invalidate';",
  );

/** Audit records of one review's invalidation. */
export const reviewAudits = (reviewId) =>
  count(
    `select count(*) from audit_private.audit_events where action = 'cms.entry.review.invalidate' and target_id = ${sql(reviewId)}::uuid;`,
  );

/** The correlation ids of one review's invalidation events, comma separated (empty when it has none). */
export const eventCorrelations = (reviewId) =>
  review.value(
    `select coalesce(string_agg(correlation_id::text, ',' order by id), '') from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1' and aggregate_id = ${sql(reviewId)}::uuid;`,
  );

/** The correlation ids of one review's invalidation audit records, comma separated. */
export const auditCorrelations = (reviewId) =>
  review.value(
    `select coalesce(string_agg(correlation_id::text, ',' order by id), '') from audit_private.audit_events where action = 'cms.entry.review.invalidate' and target_id = ${sql(reviewId)}::uuid;`,
  );

/** Dependency rows of a set of reviews (they are history and are never deleted by an invalidation). */
export const dependencyRows = (reviewIds) =>
  count(
    `select count(*) from platform_private.cms_editorial_review_dependencies where review_id = any (array[${reviewIds.map(sql).join(',')}]::uuid[]);`,
  );

/** Terminates every session this runner may have left behind (a lock holder or a parked run), so a later reset cannot hang on it. */
export const terminateRunnerSessions = () =>
  review.value(
    "select count(pg_catalog.pg_terminate_backend(pid)) from pg_stat_activity where application_name like 's11race-holder-rc%' or application_name like 's11race-rc-%';",
  );
