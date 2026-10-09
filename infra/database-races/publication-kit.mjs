/**
 * Shared kit of the Slice 11 schedule / publication race runners
 * (supabase/tests/phase_02_slice_11_races/013-*.mjs .. 015-*.mjs; lane S11-3b: cms_schedule_publication,
 * cms_publish_revision, cms_claim_due_publication_schedules, cms_execute_publication_schedule).  Like
 * review-kit.mjs, every call is a fresh `psql` process inside the disposable local Supabase database
 * container, so a lock or ordering guarantee is proven across real committed PostgreSQL sessions, which a
 * single-transaction pgTAP file cannot do.  Run only right after `pnpm db:reset`.
 *
 * The fixture is the SAME pgTAP fragments the pgTAP suites include (Slice 10 identity / organization
 * fixture, Slice 11 data-model fixture, the h11doc world with the real editorial policy, the receipt-derived
 * owner, the reviewer accounts, the publication world) executed once in a script that COMMITS, plus
 * supabase/tests/phase_02_slice_11_rpc_publication/090-race-fixture.sqlinc (34 entries, each with an approved
 * review, and 26 pending schedules dated 30 days ahead).  Producers are driven only through the named
 * commands (`platform_api.cms_*`) exactly as the Worker calls them: a service-role session publishing the
 * actor's verified claims for the browser commands, no actor at all for the scheduled sweep.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as kit from './race-kit.mjs';
import * as review from './review-kit.mjs';

export * from './review-kit.mjs';
const { sql, jsonb, runScript, runValue, runCapture, runAsync } = kit;

export { runValue };

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
  'phase_02_slice_11_rpc_publication/000-world.sqlinc',
  'phase_02_slice_11_rpc_publication/090-race-fixture.sqlinc',
];

/** Builds the committed fixture; returns the ids document of 090-race-fixture.sqlinc. */
export const buildPublicationFixture = () => {
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

/** The Worker's healthy accessibility proof bound to one revision (the binding hash comes from the database). */
const healthyEvidence = (binding, ageMs = 0) => ({
  category: 'accessibility',
  providerKey: 'cms.a11y.structural',
  providerVersion: '1',
  outcome: 'healthy',
  blockingCount: 0,
  inputHash: 'a'.repeat(64),
  bindingHash: binding,
  evaluatedAt: new Date(Date.now() - ageMs).toISOString(),
});

/** What a command request needs from the committed review of one tag. */
const reviewFacts = (ids, tag) =>
  JSON.parse(
    runScript(
      `begin;
       select set_config('app.cms_rpc', 'true', true);
       select jsonb_build_object(
         'entryId', review.entry_id, 'revisionId', review.revision_id, 'frozenHash', review.frozen_hash,
         'version', review.version::text, 'dependencyHash', review.dependency_hash,
         'versionSet', platform_private.cms_revision_version_set(review.revision_id, review.dependency_manifest),
         'binding', platform_private.cms_accessibility_binding_hash(review.revision_id, review.dependency_hash))::text
         from platform_private.cms_editorial_reviews review where review.id = ${sql(ids.reviews[tag])};
       commit;`,
      's11race-facts',
    ),
  );

/** A CMS-03B-09 publication request for the committed approved review of a tag. */
export const publishRequest = (ids, tag, extra = {}) => {
  const facts = reviewFacts(ids, tag);
  return {
    entryId: facts.entryId,
    revisionId: facts.revisionId,
    frozenHash: facts.frozenHash,
    expectedVersionSet: facts.versionSet,
    audience: 'public',
    expectedVersion: facts.version,
    ifMatch: facts.version,
    idempotencyKey: review.nextKey('publish'),
    evidence: healthyEvidence(facts.binding),
    context: review.context(ids),
    ...extra,
  };
};

/** A CMS-03B-07 schedule request (a UTC publish `leadMs` from now, whole seconds). */
export const scheduleRequest = (
  ids,
  tag,
  extra = {},
  leadMs = 3 * 86_400_000,
) => {
  const facts = reviewFacts(ids, tag);
  const fire = new Date(Math.floor((Date.now() + leadMs) / 1000) * 1000);
  const local = fire.toISOString().slice(0, 19);
  return {
    revisionId: facts.revisionId,
    action: 'publish',
    localDateTime: local,
    timezone: 'UTC',
    resolvedUtc: `${local}Z`,
    tzdbVersion: '2026e',
    disambiguation: 'none',
    audience: 'public',
    expectedVersion: facts.version,
    ifMatch: facts.version,
    idempotencyKey: review.nextKey('schedule'),
    evidence: healthyEvidence(facts.binding),
    context: review.context(ids),
    ...extra,
  };
};

/** A fresh proof for the revision of a tag (what the sweep sends with an execution). */
export const proofFor = (ids, tag) =>
  healthyEvidence(reviewFacts(ids, tag).binding);

// ---------------------------------------------------------------- the scheduled sweep (no actor) ----
const parseLast = (outcome) => {
  const line = outcome.stdout
    .split('\n')
    .filter(
      (candidate) =>
        (candidate.startsWith('{') || candidate.startsWith('[')) &&
        !candidate.includes('|'),
    )
    .at(-1);
  return {
    ...outcome,
    token: outcome.code === 0 ? null : kit.errorMessage(outcome),
    response: line === undefined ? null : JSON.parse(line),
  };
};

const serviceScript = (functionName, request) =>
  `begin; select platform_api.${functionName}(${jsonb(request)}); commit;`;

/** One service-role call (claim / execute) to completion. */
export const serviceCall = (
  functionName,
  request,
  appName = 's11race-service',
) => parseLast(runCapture(serviceScript(functionName, request), appName));

/** A service-role call in a background session; `done` resolves the parsed outcome. */
export const serviceAsync = (functionName, request, appName) => {
  const session = runAsync(appName, serviceScript(functionName, request));
  return { app: appName, session, done: session.done.then(parseLast) };
};

export const claim = (batch, appName) =>
  serviceCall('cms_claim_due_publication_schedules', { batch }, appName);
export const claimAsync = (batch, appName) =>
  serviceAsync('cms_claim_due_publication_schedules', { batch }, appName);

/** The execute request of a claimed element. */
export const executeRequest = (claimed, evidence) => ({
  scheduleId: claimed.scheduleId,
  expectedVersion: claimed.scheduleVersion,
  leaseId: claimed.leaseId,
  evidence,
});
export const execute = (request, appName) =>
  serviceCall('cms_execute_publication_schedule', request, appName);
export const executeAsync = (request, appName) =>
  serviceAsync('cms_execute_publication_schedule', request, appName);

// ---------------------------------------------------------------- committed-state helpers ----
/** Runs statements with the user triggers of the schedule table off (fixture surgery; no concurrent session). */
export const scheduleSurgery = (statements) =>
  runScript(
    `begin;
     select set_config('app.cms_rpc', 'true', true);
     alter table platform_private.cms_publication_schedules disable trigger user;
     ${statements}
     alter table platform_private.cms_publication_schedules enable trigger user;
     commit;
     select '{}';`,
    's11race-surgery',
  );

/** Makes the named schedules due (resolved one minute ago, local time consistent). */
export const makeDue = (ids, tags) =>
  scheduleSurgery(
    `update platform_private.cms_publication_schedules
        set resolved_at_utc = date_trunc('second', clock_timestamp()) - interval '1 minute',
            local_datetime = (date_trunc('second', clock_timestamp()) - interval '1 minute') at time zone 'UTC'
      where id in (${tags.map((tag) => sql(ids.schedules[tag])).join(', ')});`,
  );

/** Expires the lease of an executing schedule (a crashed worker). */
export const expireLease = (ids, tag) =>
  scheduleSurgery(
    `update platform_private.cms_publication_schedules
        set lease_until = clock_timestamp() - interval '1 second'
      where id = ${sql(ids.schedules[tag])} and state = 'executing';`,
  );

/** Makes a failed_retryable schedule's next attempt due. */
export const retryDue = (ids, tag) =>
  scheduleSurgery(
    `update platform_private.cms_publication_schedules
        set next_attempt_at = clock_timestamp() - interval '1 second'
      where id = ${sql(ids.schedules[tag])} and state = 'failed_retryable';`,
  );

/** 'state/version/attempts/reason/lease' of a schedule tag. */
export const scheduleState = (ids, tag) =>
  runValue(
    `select state || '/' || version || '/' || attempt_count || '/' || coalesce(reason_code, '-') || '/'
            || case when lease_id is null then '-' else 'lease' end
       from platform_private.cms_publication_schedules where id = ${sql(ids.schedules[tag])};`,
  );

export const scheduleLease = (ids, tag) =>
  runValue(
    `select coalesce(lease_id::text, '') from platform_private.cms_publication_schedules where id = ${sql(ids.schedules[tag])};`,
  );

/** The lineage rows of (entry of tag, en-US, audience) as 'version:action:state' joined by commas. */
export const lineage = (ids, tag, audience = 'public') =>
  runValue(
    `select coalesce(string_agg(version || ':' || action || ':' || state, ',' order by version), '-')
       from platform_private.cms_publication_versions
      where entry_id = ${sql(ids.entries[tag])} and locale = 'en-US' and audience = ${sql(audience)};`,
  );

export const publicationEvents = (ids, tag) =>
  review.count(
    `select count(*) from platform_private.outbox_events
      where event_type = 'cms.publication.changed.v1' and payload->>'entryId' = ${sql(ids.entries[tag])};`,
  );

export const publicationAudits = (ids, tag) =>
  review.count(
    `select count(*) from audit_private.audit_events audit
       join platform_private.cms_publication_versions row_item on row_item.id = audit.target_id
      where audit.action like 'cms.publication.%' and row_item.entry_id = ${sql(ids.entries[tag])};`,
  );

export const schedulesOf = (ids, tag) =>
  review.count(
    `select count(*) from platform_private.cms_publication_schedules where revision_id = ${sql(ids.revisions[tag])};`,
  );

export const newKey = (label) =>
  `s11race-${label}-${randomUUID().slice(0, 12)}`;

// ---------------------------------------------------------------- lineage gate and row-lock probes ----
/**
 * Installs the lineage gate trigger (a test probe, like race-kit's installGateTrigger): a BEFORE INSERT
 * trigger on cms_publication_versions that parks a session whose application_name is
 * `s11race-lineage-<gateKey>-<label>` on a shared advisory lock, i.e. AFTER the command took every lock of
 * the global order and right before it appends its lineage row.  closeGate / openGate / waitParked of the
 * shared kit close, open and observe it.
 */
export const installLineageGate = () =>
  runScript(
    `
create or replace function public.s11race_lineage_gate() returns trigger
language plpgsql security definer set search_path = ''
as $f$
declare
  app text := pg_catalog.current_setting('application_name', true);
begin
  if app like 's11race-lineage-%' then
    perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.split_part(app, '-', 3)::bigint);
  end if;
  return new;
end;
$f$;
revoke all on function public.s11race_lineage_gate() from public;
grant execute on function public.s11race_lineage_gate() to public;
drop trigger if exists cms_publication_versions_0_s11race_gate on platform_private.cms_publication_versions;
create trigger cms_publication_versions_0_s11race_gate
  before insert on platform_private.cms_publication_versions
  for each row execute function public.s11race_lineage_gate();
select '{}';
`,
    's11race-lineage-gate-install',
  );

/** A session holding the row lock (FOR UPDATE) of one schedule until released. */
export const holdScheduleLock = async (ids, tag, label) => {
  const app = `s11race-holder-${label}`;
  const holder = runAsync(
    app,
    `begin; select 1 from platform_private.cms_publication_schedules where id = ${sql(ids.schedules[tag])} for update; select pg_catalog.pg_sleep(900);`,
  );
  await kit.waitFor(
    `${app} to hold the schedule lock`,
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

/** Seconds from now until a schedule's next attempt (rounded), for the retry ladder. */
export const nextAttemptIn = (ids, tag) =>
  Number(
    runValue(
      `select coalesce(round(extract(epoch from next_attempt_at - clock_timestamp()))::text, 'NaN')
         from platform_private.cms_publication_schedules where id = ${sql(ids.schedules[tag])};`,
    ),
  );

/** Audit rows of one schedule by action. */
export const scheduleAudits = (ids, tag, action) =>
  review.count(
    `select count(*) from audit_private.audit_events
      where action = ${sql(action)} and target_id = ${sql(ids.schedules[tag])};`,
  );
