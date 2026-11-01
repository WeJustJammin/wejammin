/**
 * Shared kit of the Slice 11 review-authority race runners
 * (supabase/tests/phase_02_slice_11_races/*.mjs; lane S11-3a: cms_assign_editorial_reviewer,
 * cms_record_review_decision, cms_submit_review).  Like race-kit.mjs, every call is a fresh
 * `psql` process inside the disposable local Supabase database container, so a lock or
 * ordering guarantee is proven across real committed PostgreSQL sessions, which a
 * single-transaction pgTAP file cannot do.  Run only right after `pnpm db:reset`.
 *
 * The fixture is the SAME pgTAP fragments the pgTAP suites include (Slice 10 identity /
 * organization fixture, Slice 11 data-model fixture, the h11doc world with the real editorial
 * policy, the receipt-derived owner, the reviewer accounts), executed once in a script that
 * COMMITS, plus supabase/tests/phase_02_slice_11_rpc_review/090-race-fixture.sqlinc (the
 * reviews, assignments and entries the races use).  Producers are driven only through the
 * named commands (`platform_api.cms_*`) exactly as the Worker calls them: a service-role
 * session publishing the actor's verified claims, the request carrying a fresh step-up proof.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as kit from './race-kit.mjs';

export const { check, sql, jsonb, sleep, errorMessage } = kit;
const { runScript, runValue, runCapture, runAsync } = kit;

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
  'phase_02_slice_11_rpc_review/000-world.sqlinc',
  'phase_02_slice_11_rpc_review/020-decision.sqlinc',
  'phase_02_slice_11_rpc_review/030-submit.sqlinc',
  'phase_02_slice_11_rpc_review/090-race-fixture.sqlinc',
];

/** Builds the committed fixture; returns the ids document of 090-race-fixture.sqlinc. */
export const buildReviewFixture = () => {
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
  return JSON.parse(runScript(script, 's11race-setup'));
};

/** The session settings a command session runs under (what the Worker publishes). */
export const actorSettings = (ids, who) => {
  const actor = ids.actors[who];
  return `select
    set_config('request.jwt.claims', ${sql(JSON.stringify({ role: 'authenticated', sub: actor.auth }))}, true),
    set_config('app.auth_user_id', ${sql(actor.auth)}, true),
    set_config('app.actor_auth_user_id', ${sql(actor.auth)}, true),
    set_config('app.actor_person_id', ${sql(actor.person)}, true),
    set_config('app.acting_party_id', ${sql(ids.org)}, true),
    set_config('app.acting_context_id', '', true);`;
};

/** The server-built request context: a verified step-up one minute old. */
export const context = (ids, ageMs = 60_000) => ({
  actingPartyId: ids.org,
  stepUpVerified: true,
  stepUpAt: new Date(Date.now() - ageMs).toISOString(),
  correlationId: randomUUID(),
});

let sequence = 0;
/** A fresh idempotency key. */
export const nextKey = (label) =>
  `s11race-${label}-${String((sequence += 1)).padStart(4, '0')}-${randomUUID().slice(0, 8)}`;

export const commandScript = (ids, functionName, request, who) =>
  `begin; ${actorSettings(ids, who)} select platform_api.${functionName}(${jsonb(request)}); commit;`;

/** One command to completion in its own session: { code, stdout, stderr, token, response }. */
export const call = (
  ids,
  functionName,
  who,
  request,
  appName = 's11race-call',
) => {
  const outcome = runCapture(
    commandScript(ids, functionName, request, who),
    appName,
  );
  return annotate(outcome);
};

/** A command in a background session; `done` resolves the annotated outcome. */
export const callAsync = (ids, functionName, who, request, appName) => {
  const session = runAsync(
    appName,
    commandScript(ids, functionName, request, who),
  );
  return {
    app: appName,
    session,
    done: session.done.then(annotate),
  };
};

const annotate = (outcome) => {
  const line = outcome.stdout
    .split('\n')
    .filter(
      (candidate) => candidate.startsWith('{') && !candidate.includes('|'),
    )
    .at(-1);
  return {
    ...outcome,
    token: outcome.code === 0 ? null : errorMessage(outcome),
    response: line === undefined ? null : JSON.parse(line),
  };
};

// ---------------------------------------------------------------- requests ----
export const assignRequest = (ids, reviewId, version, extra = {}) => ({
  reviewId,
  action: 'create',
  expectedVersion: String(version),
  ifMatch: String(version),
  idempotencyKey: nextKey('assign'),
  reviewerPersonId: ids.actors.rvA.person,
  expiresAt: new Date(Date.now() + 6 * 3_600_000).toISOString(),
  context: context(ids),
  ...extra,
});

export const revokeRequest = (
  ids,
  reviewId,
  version,
  assignmentId,
  extra = {},
) => ({
  reviewId,
  action: 'revoke',
  expectedVersion: String(version),
  ifMatch: String(version),
  idempotencyKey: nextKey('revoke'),
  assignmentId,
  context: context(ids),
  ...extra,
});

export const decisionRequest = (
  ids,
  reviewId,
  decision,
  version,
  extra = {},
) => ({
  reviewId,
  decision,
  reason:
    decision === 'approve' ? 'Reads well; approved.' : 'Needs work; rejected.',
  expectedVersion: String(version),
  ifMatch: String(version),
  idempotencyKey: nextKey(decision),
  context: context(ids),
  ...extra,
});

/** A submission request built from the committed revision (healthy accessibility evidence). */
export const submitRequest = (ids, tag, extra = {}) => {
  const entryId = ids.entries[tag];
  const revisionId = ids.revisions[tag];
  const built = JSON.parse(
    runScript(
      `begin;
       select set_config('app.cms_rpc', 'true', true);
       select jsonb_build_object(
         'frozenHash', (select payload_hash from platform_private.cms_entry_revisions where id = ${sql(revisionId)}),
         'version', (select version::text from platform_private.cms_content_entries where id = ${sql(entryId)}),
         'manifest', platform_private.cms_build_dependency_manifest(${sql(revisionId)}::uuid),
         'binding', platform_private.cms_accessibility_binding_hash(${sql(revisionId)}::uuid,
            platform_private.cms_jcs_sha256(platform_private.cms_build_dependency_manifest(${sql(revisionId)}::uuid))))::text;
       commit;`,
      's11race-submit-build',
    ),
  );
  return {
    entryId,
    revisionId,
    frozenHash: built.frozenHash,
    dependencyManifest: built.manifest,
    expectedVersion: built.version,
    ifMatch: built.version,
    idempotencyKey: nextKey('submit'),
    evidence: {
      category: 'accessibility',
      providerKey: 'cms.a11y.structural',
      providerVersion: '1',
      outcome: 'healthy',
      blockingCount: 0,
      inputHash: 'a'.repeat(64),
      bindingHash: built.binding,
      evaluatedAt: new Date().toISOString(),
    },
    context: context(ids),
    ...extra,
  };
};

/** A cms_create_revision request appending to a submit-race entry (the creator holds cms.author). */
export const appendRequest = (ids, tag, title) => ({
  entryId: ids.entries[tag],
  baseRevision: '1',
  changedPaths: [`/fields/${ids.titleField}`],
  values: { [ids.titleField]: title },
  locale: 'en-US',
  expectedVersion: '1',
  ifMatch: '1',
  idempotencyKey: nextKey('append'),
  context: { actingPartyId: ids.org, correlationId: randomUUID() },
});

// ---------------------------------------------------------------- database reads ----
export const reviewState = (reviewId) =>
  runValue(
    `select state || '/' || version || '/' || recorded_decision_count || '/' || coalesce(invalidated_reason, '-')
       from platform_private.cms_editorial_reviews where id = ${sql(reviewId)};`,
  );
export const count = (statement) => Number(runValue(statement));
export const decisionCount = (reviewId) =>
  count(
    `select count(*) from platform_private.cms_editorial_decisions where review_id = ${sql(reviewId)};`,
  );
export const activeAssignments = (reviewId) =>
  count(
    `select count(*) from platform_private.cms_editorial_review_assignments where review_id = ${sql(reviewId)} and state = 'active';`,
  );
export const eventCount = (aggregateId) =>
  count(
    `select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1' and aggregate_id = ${sql(aggregateId)};`,
  );

/** A session holding the review row lock (FOR UPDATE) until terminated. */
export const holdReviewLock = async (reviewId, label) => {
  const app = `s11race-holder-${label}`;
  const holder = runAsync(
    app,
    `begin; select 1 from platform_private.cms_editorial_reviews where id = ${sql(reviewId)} for update; select pg_catalog.pg_sleep(900);`,
  );
  await kit.waitFor(
    `${app} to hold the review lock`,
    () => kit.waitEvent(app) === 'Timeout:PgSleep',
  );
  return {
    app,
    release: async () => {
      runValue(
        `select count(pg_catalog.pg_terminate_backend(pid)) from pg_stat_activity where application_name = ${sql(app)};`,
      );
      await holder.done;
    },
  };
};

/** Committed idempotency reservations of the CMS-03B-18 (assignment) command. */
export const assignmentReservations = () =>
  count(
    `select count(*) from platform_private.idempotency_records where operation = 'CMS-03B-18';`,
  );

/**
 * The application names of the sessions that currently block `appName` (a wait for a row, a
 * tuple, a transaction id or an advisory lock), sorted; the empty array when nothing blocks it.
 */
export const blockedBy = (appName) =>
  runValue(
    `select coalesce(string_agg(distinct blocker.application_name, ',' order by blocker.application_name), '')
       from pg_stat_activity waiter
       join pg_stat_activity blocker on blocker.pid = any (pg_blocking_pids(waiter.pid))
      where waiter.application_name = ${sql(appName)};`,
  )
    .split(',')
    .filter(Boolean);

/**
 * True once the session has begun writing `relation` (a granted RowExclusiveLock, taken by the
 * statement that writes it).  A session that still waits for a lock BEFORE its first write has none.
 */
export const holdsWriteLock = (appName, relation) =>
  runValue(
    `select exists (
       select 1
         from pg_locks held
         join pg_stat_activity session_item on session_item.pid = held.pid
        where session_item.application_name = ${sql(appName)}
          and held.locktype = 'relation'
          and held.relation = ${sql(relation)}::regclass
          and held.mode = 'RowExclusiveLock'
          and held.granted);`,
  ) === 't';

/** Runs `statement` (SQL ending in `;`) as one committed transaction in the RPC context. */
export const commitStatement = (statement) =>
  runValue(
    `begin; select set_config('app.cms_rpc', 'true', true); ${statement} commit; select 'committed';`,
    's11race-commit',
  );

/** UPDATE of one actor-grant row of the owner organization (`active` true restores, false revokes). */
export const grantUpdate = (ids, who, capability, active) =>
  `update identity_private.organization_actor_grant set active = ${active}, updated_at = clock_timestamp() where organization_id = ${sql(ids.org)}::uuid and person_id = ${sql(ids.actors[who].person)}::uuid and capability_code = ${sql(capability)};`;

/** UPDATE that ends (`ended` true) or restores the confirmed membership tenure of one person. */
export const tenureUpdate = (ids, who, ended) =>
  `update identity_private.membership_tenure set state = ${ended ? "'ended'" : "'confirmed'"}, revoked_at = ${ended ? 'clock_timestamp()' : 'null'}, updated_at = clock_timestamp() where organization_id = ${sql(ids.org)}::uuid and person_id = ${sql(ids.actors[who].person)}::uuid;`;

export const {
  installGateTrigger,
  closeGate,
  openGate,
  openAllGates,
  waitParked,
  blockedOrCompleted,
  waitFor,
  waitEvent,
  isLockWaiting,
  revokerScript,
  runValue: value,
  runCapture: capture,
  runAsync: spawnSession,
} = kit;
