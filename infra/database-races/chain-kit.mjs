/**
 * Producer-chain world of the Slice 10 activation races
 * (supabase/tests/phase_02_slice_10_races/010 and 014).
 *
 * The earlier activation race stood the schema-activation switch in for by an explicit
 * `FOR UPDATE` on the version row, which never reaches the authority and review locks
 * the real switch takes, so it could not see lock-order cycles.  These runners drive the
 * REAL activation commands (platform_api.cms_activate_schema, the human switch, and
 * platform_api.cms_activate_schema_migration, the Worker's second switch) against the
 * real Slice 10 writers and the real authority-loss commands, so a deadlock between any
 * of them is a failing assertion.
 *
 * The candidates are produced ONLY through the named commands, exactly like the Slice 09
 * runners: type draft -> dry-run -> worker seal -> submit -> assign -> decide -> activate
 * (the source version), then successor -> dry-run -> worker scan -> submit -> assign ->
 * decide -> worker backfill (the approved candidate with a completed plan).  The pgTAP
 * fragments of the Slice 09 DEC-108 suite are reused through committed psql scripts; the
 * pg_temp state they keep (actors, remembered ids) is persisted between scripts in two
 * scratch tables of the disposable race database (public.s10chain_actor / s10chain_ids)
 * and restored at the start of the next script, because a pg_temp table dies with its
 * transaction.  Run only against the disposable local database right after
 * `pnpm db:reset` (the gate in infra/run-database-race-runners.mjs does).
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import * as kit from './race-kit.mjs';

const { sql, jsonb, runScript, runValue, testsDir } = kit;

const fragment = (relative) => readFileSync(join(testsDir, relative), 'utf8');
const DEC108 = 'phase_02_slice_09_dec108';
const PROTECTED_WORKFLOW = { key: 'cms.disclosure.policy', version: '1' };

const HELPERS = [
  fragment(`${DEC108}/00-helpers.sqlinc`),
  fragment(`${DEC108}/02-chain.sqlinc`),
  fragment(`${DEC108}/03-support.sqlinc`),
  fragment(`${DEC108}/04-worker.sqlinc`),
  fragment('phase_02_slice_09_dec119/00-support.sqlinc'),
].join('\n');

/** Re-selects an actor's acting context through the real command (fresh recency). */
const BIND_FUNCTIONS = `
create or replace function pg_temp.s10c_bind(p_key text, p_nonce text) returns void
language plpgsql as $body$
declare actor s09d_actor%rowtype; bound jsonb;
begin
  select * into actor from s09d_actor where key = p_key;
  perform pg_temp.s09d_session(p_key, 'authenticated');
  perform set_config('app.correlation_id', extensions.gen_random_uuid()::text, true);
  perform set_config('app.idempotency_key_hash', 's10c-bind-' || p_key || '-' || p_nonce, true);
  perform set_config('app.request_hash', 's10c-bind-' || p_key || '-' || p_nonce || '-request', true);
  bound := platform_api.identity_context_bind(actor.party_id, true, 's10c-' || p_key || '-' || p_nonce);
  update s09d_actor set binding_id = (bound->>'bindingId')::uuid where key = p_key;
end;
$body$;
create or replace function pg_temp.s10c_outcomes_ok(p_labels text[]) returns void
language plpgsql as $body$
declare label text; bad text := '';
begin
  foreach label in array p_labels loop
    if pg_temp.s09d_outcome(label) <> 'OK' then
      bad := bad || label || '=' || pg_temp.s09d_outcome(label) || ' ';
    end if;
  end loop;
  if bad <> '' then raise exception 'chain step failed: %', bad; end if;
end;
$body$;
create or replace function pg_temp.s10c_source_json(p_tag text) returns jsonb
language plpgsql as $body$
declare result jsonb;
begin
  perform set_config('app.cms_rpc', 'true', true);
  select jsonb_build_object(
    'typeId', version_row.content_type_id, 'versionId', version_row.id,
    'artifactId', artifact.id, 'artifactHash', artifact.artifact_hash,
    'compiler', artifact.compiler_version, 'zodRef', artifact.zod_contract_ref,
    'titleField', field.stable_field_id,
    'workflowPolicy', platform_private.cms_editorial_workflow_policy_evidence(version_row.id),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence')
  into result
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_schema_artifacts artifact on artifact.id = version_row.schema_artifact_id
  join platform_private.cms_field_definition_versions field on field.content_type_version_id = version_row.id
  where version_row.id = pg_temp.s09d_id(p_tag || ':version') and field.field_key = 'title';
  perform set_config('app.cms_rpc', '', true);
  return result;
end;
$body$;
`;

const REHYDRATE = `
insert into s09d_actor select * from public.s10chain_actor;
insert into s09d_ids select * from public.s10chain_ids;
`;
const PERSIST = `
delete from public.s10chain_ids;
insert into public.s10chain_ids select * from s09d_ids;
delete from public.s10chain_actor;
insert into public.s10chain_actor select * from s09d_actor;
`;

const stage = (body) =>
  [
    '\\set ON_ERROR_STOP on',
    fragment('support/jwt-claims.sqlinc'),
    'begin;',
    HELPERS,
    BIND_FUNCTIONS,
    REHYDRATE,
    body,
    PERSIST,
    'commit;',
  ].join('\n');

let stageCounter = 0;
const nonce = () => `${(stageCounter += 1)}-${randomUUID().slice(0, 8)}`;

/**
 * Builds the world once: the Slice 09 actors (owner = the CMS owner of the owner
 * organization, rev1..rev3 independent reviewers), the owner's cms.author and cms.editor
 * grants through CMS-03A-15, and the scratch tables the later scripts restore from.
 * Returns { org, owner: { auth, person, party, binding }, rev1, rev2, rev3 }.
 */
export const buildWorld = () => {
  const script = [
    '\\set ON_ERROR_STOP on',
    fragment('support/jwt-claims.sqlinc'),
    'begin;',
    fragment(`${DEC108}/00-helpers.sqlinc`),
    fragment(`${DEC108}/01-actors.sqlinc`),
    fragment(`${DEC108}/02-chain.sqlinc`),
    fragment(`${DEC108}/03-support.sqlinc`),
    fragment(`${DEC108}/04-worker.sqlinc`),
    fragment('phase_02_slice_09_dec119/00-support.sqlinc'),
    BIND_FUNCTIONS,
    `select pg_temp.s09g_grant('s10c:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(30));`,
    `select pg_temp.s09g_grant('s10c:editor', 'owner', 'owner', 'cms.editor', pg_temp.s09g_day(30));`,
    `select pg_temp.s10c_outcomes_ok(array['s10c:author', 's10c:editor']);`,
    `create table public.s10chain_actor as table s09d_actor;`,
    `create table public.s10chain_ids as table s09d_ids;`,
    `select jsonb_build_object(
       'org', pg_temp.s09d_id('ownerOrg'),
       'owner', (select jsonb_build_object('auth', auth_user_id, 'person', person_id,
                   'party', party_id, 'binding', binding_id) from s09d_actor where key = 'owner'),
       'rev1', (select jsonb_build_object('auth', auth_user_id, 'person', person_id) from s09d_actor where key = 'rev1'),
       'rev2', (select jsonb_build_object('auth', auth_user_id, 'person', person_id) from s09d_actor where key = 'rev2'),
       'rev3', (select jsonb_build_object('auth', auth_user_id, 'person', person_id) from s09d_actor where key = 'rev3'))::text;`,
    'commit;',
  ].join('\n');
  return JSON.parse(runScript(script, 's10race-chain-world'));
};

/** The ids object of race-kit for one active source version of the owner organization. */
export const ownerIds = (world, source) => ({
  organization: world.org,
  creatorAuth: world.owner.auth,
  creatorPerson: world.owner.person,
  editorAuth: world.owner.auth,
  editorPerson: world.owner.person,
  ...source,
});

/**
 * Creates and activates one first-version type per tag through the named commands (one
 * independent reviewer).  Returns { tag: { typeId, versionId, artifactId, artifactHash,
 * compiler, zodRef, titleField, workflowPolicy, activationEvidence } }.
 */
export const buildSources = (tags) => {
  const body = [
    `select pg_temp.s10c_bind(key, ${sql(nonce())}) from s09d_actor order by key;`,
    ...tags.flatMap((tag) => [
      `select pg_temp.s09d_create_type(${sql(tag)}, ${sql(`race${tag}`)});`,
      `select pg_temp.s09d_to_active(${sql(tag)});`,
    ]),
    `select pg_temp.s10c_outcomes_ok(array[${tags.map((tag) => sql(`${tag}:activate`)).join(', ')}]);`,
    `select jsonb_build_object('sources', jsonb_build_object(${tags
      .map((tag) => `${sql(tag)}, pg_temp.s10c_source_json(${sql(tag)})`)
      .join(', ')}))::text;`,
  ].join('\n');
  return JSON.parse(runScript(stage(body), 's10race-chain-sources')).sources;
};

/**
 * Takes each source (with its entries already written) to an APPROVED successor with a
 * COMPLETED migration plan, through the named commands: successor -> dry-run -> worker
 * scan -> submit -> assign -> decide -> worker backfill.  A `protectedPolicy` candidate
 * names the protected workflow, so its review needs two distinct humans and the
 * specialist (rev1 holds cms.reviewer.policy through CMS-03A-15, rev1 and rev2 decide).
 * Returns { candidateTag: { candidateVersionId, planId, dryRunId, reviewId } }.
 */
export const buildCandidates = (specs) => {
  const needsSpecialist = specs.some((spec) => spec.protectedPolicy);
  const body = [
    `select pg_temp.s10c_bind(key, ${sql(nonce())}) from s09d_actor order by key;`,
    needsSpecialist
      ? `select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');`
      : '',
    ...specs.flatMap((spec) => {
      const tag = spec.tag;
      const successorArgs = spec.protectedPolicy
        ? `, ${sql(PROTECTED_WORKFLOW.key)}, ${sql(PROTECTED_WORKFLOW.version)}`
        : '';
      const reviewers = spec.protectedPolicy ? ['rev1', 'rev2'] : ['rev1'];
      return [
        `select pg_temp.s09d_successor(${sql(tag)}, ${sql(spec.source)}, 'owner', null, null, null, null, null${successorArgs});`,
        `select pg_temp.s09d_dry_run(${sql(tag)});`,
        `select pg_temp.s09w_dry_run(${sql(tag)});`,
        `select pg_temp.s09d_submit(${sql(tag)});`,
        ...reviewers.map(
          (reviewer) =>
            `select pg_temp.s09d_assign(${sql(tag)}, ${sql(reviewer)});`,
        ),
        ...reviewers.map(
          (reviewer) =>
            `select pg_temp.s09d_decide(${sql(tag)}, ${sql(reviewer)});`,
        ),
        `select pg_temp.s09w_backfill(${sql(tag)});`,
        `select pg_temp.s10c_outcomes_ok(array[${[
          `${tag}:successor`,
          `${tag}:dryRun`,
          `${tag}:w.seal`,
          `${tag}:submit`,
          ...reviewers.map((reviewer) => `${tag}:assign:${reviewer}`),
          ...reviewers.map((reviewer) => `${tag}:decide:${reviewer}`),
          `${tag}:w.complete`,
        ]
          .map(sql)
          .join(', ')}]);`,
      ];
    }),
    `select jsonb_build_object('candidates', jsonb_build_object(${specs
      .map(
        (spec) => `${sql(spec.tag)}, jsonb_build_object(
          'candidateVersionId', pg_temp.s09d_id(${sql(`${spec.tag}:version`)}),
          'planId', pg_temp.s09d_id(${sql(`${spec.tag}:plan`)}),
          'dryRunId', pg_temp.s09d_id(${sql(`${spec.tag}:dryRun`)}),
          'reviewId', pg_temp.s09d_id(${sql(`${spec.tag}:review`)}),
          'sourceVersionId', pg_temp.s09d_id(${sql(`${spec.source}:version`)}),
          'typeId', pg_temp.s09d_id(${sql(`${spec.tag}:type`)}))`,
      )
      .join(', ')}))::text;`,
  ].join('\n');
  return JSON.parse(runScript(stage(body), 's10race-chain-candidates'))
    .candidates;
};

/** Makes rev1 hold the specialist capability (a revoked aggregate is re-granted). */
export const ensureSpecialist = () => {
  runScript(
    stage(
      `select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');\nselect '{}';`,
    ),
    's10race-chain-specialist',
  );
};

/** A fresh acting-context binding of the owner (real command), so MFA recency holds. */
export const bindOwner = (world) => {
  const text = runScript(
    stage(
      `select pg_temp.s10c_bind('owner', ${sql(nonce())});
       select jsonb_build_object('binding', binding_id)::text from s09d_actor where key = 'owner';`,
    ),
    's10race-chain-bind',
  );
  world.owner.binding = JSON.parse(text).binding;
  return world.owner.binding;
};

// ----------------------------------------------------------------- requests ----
const ownerContext = (world) => ({
  authUserId: world.owner.auth,
  sessionId: randomUUID(),
  actorPersonId: world.owner.person,
  actingPartyId: world.org,
  stepUpVerified: true,
  stepUpAt: new Date(Date.now() - 60_000).toISOString(),
  requestId: randomUUID(),
  correlationId: randomUUID(),
  actingContextId: world.owner.binding,
});

/** Session settings of a service-role Worker request published for the owner. */
const ownerSettings = (world) => `select
  set_config('request.jwt.claims', ${sql(JSON.stringify({ role: 'service_role', sub: world.owner.auth }))}, true),
  set_config('app.auth_user_id', ${sql(world.owner.auth)}, true),
  set_config('app.actor_auth_user_id', ${sql(world.owner.auth)}, true),
  set_config('app.actor_person_id', ${sql(world.owner.person)}, true),
  set_config('app.acting_party_id', ${sql(world.owner.party)}, true),
  set_config('app.acting_context_id', ${sql(world.owner.binding)}, true);`;

const workerSettings = `select set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('app.cms_rpc', 'true', true);`;

/** The CMS-03A-04 request of an approved candidate (server-read evidence, fresh context). */
export const humanActivationRequest = (world, candidate) =>
  JSON.parse(
    runValue(`select (jsonb_build_object(
      'contentTypeId', version_row.content_type_id, 'versionId', version_row.id,
      'expectedVersion', version_row.version::text, 'dryRunId', ${sql(candidate.dryRunId)}::uuid,
      'approvalIds', (select coalesce(jsonb_agg(decision.id order by decision.id), '[]'::jsonb)
                        from platform_private.cms_schema_review_decisions decision
                       where decision.review_id = ${sql(candidate.reviewId)}::uuid and decision.decision = 'approve'),
      'migrationPlanId', ${sql(candidate.planId)}::uuid,
      'idempotencyKey', ${sql(`s10race-act-${randomUUID()}`)}))::text
      from platform_private.cms_content_type_versions version_row
     where version_row.id = ${sql(candidate.candidateVersionId)}::uuid;`),
  );

/** The Worker's second-switch request over the completed plan (server-read fingerprints). */
export const workerActivationRequest = (candidate) =>
  JSON.parse(
    runValue(`select jsonb_build_object(
      'migrationPlanId', plan.id, 'contentTypeId', plan.content_type_id,
      'schemaVersionId', plan.to_version_id, 'expectedVersion', plan.version::text,
      'expectedActiveVersionId', plan.from_version_id, 'transformKey', null, 'transformVersion', null,
      'compilerHash', artifact.artifact_hash, 'sourceHash', source.definition_hash,
      'targetHash', target.definition_hash,
      'idempotencyKey', ${sql(`s10race-wact-${randomUUID()}`)}, 'switchOnlyOnce', true)::text
      from platform_private.cms_schema_migration_plans plan
      join platform_private.cms_content_type_versions source on source.id = plan.from_version_id
      join platform_private.cms_content_type_versions target on target.id = plan.to_version_id
      join platform_private.cms_schema_artifacts artifact on artifact.content_type_version_id = target.id
     where plan.id = ${sql(candidate.planId)}::uuid;`),
  );

/**
 * The activation session of one path, ready for kit.runAsync: `human` is the
 * service-role CMS-03A-04 switch as the owner, `worker` the Worker's second switch.
 * `holdGate` keeps the transaction open (every lock held) until that gate opens.
 */
export const activationScript = (world, path, candidate, holdGate = null) => {
  const hold =
    holdGate === null
      ? ''
      : `select pg_catalog.pg_advisory_xact_lock_shared(${holdGate});`;
  if (path === 'human') {
    const request = {
      ...humanActivationRequest(world, candidate),
      context: ownerContext(world),
    };
    return `begin; ${ownerSettings(world)} select platform_api.cms_activate_schema(${jsonb(request)}); ${hold} commit;`;
  }
  return `begin; ${workerSettings} select platform_api.cms_activate_schema_migration(${jsonb(workerActivationRequest(candidate))}); ${hold} commit;`;
};

/** The state of one version row. */
export const versionState = (versionId) =>
  runValue(
    `select state::text from platform_private.cms_content_type_versions where id = ${sql(versionId)}::uuid;`,
  );

/** True when a session outcome carries the PostgreSQL deadlock error. */
export const isDeadlock = (outcome) =>
  /deadlock detected/iu.test(outcome.stderr ?? '') ||
  /\b40P01\b/u.test(outcome.stderr ?? '');

/** The machine DETAIL line of a failed session (`DETAIL:  <text>`), or null. */
export const errorDetail = (outcome) => {
  const match = /DETAIL:\s+([^\n]*)/u.exec(outcome.stderr ?? '');
  return match ? match[1].trim() : null;
};

/** The owner's CMS-03A-17 revoke of one capability grant (real command), as a held session. */
export const revokeGrantScript = (world, who, capability, holdGate = null) => {
  const row = JSON.parse(
    runValue(`select jsonb_build_object('id', grant_row.id, 'version', grant_row.version::text)::text
      from platform_private.cms_capability_grants grant_row
     where grant_row.owner_id = ${sql(world.org)}::uuid
       and grant_row.subject_person_ref = ${sql(world[who].person)}::uuid
       and grant_row.capability_code = ${sql(capability)} and grant_row.state = 'active';`),
  );
  const request = {
    grantId: row.id,
    expectedVersion: row.version,
    idempotencyKey: `s10race-revoke-${randomUUID()}`,
    context: ownerContext(world),
  };
  const hold =
    holdGate === null
      ? ''
      : `select pg_catalog.pg_advisory_xact_lock_shared(${holdGate});`;
  return `begin; ${ownerSettings(world)} select platform_api.cms_revoke_capability_grant(${jsonb(request)}); ${hold} commit;`;
};

/**
 * Inserts (or re-activates) an authority row the activation could not have seen when it scanned: a reviewer-class
 * actor grant of one person, committed with row triggers skipped (a fixture-level write: no
 * command inserts a reviewer-class grant without invalidating the reviews that person
 * approved, which would make the row's later revocation moot).
 */
export const insertGrantRow = (world, who, capability) =>
  runValue(
    `begin; set local session_replication_role = replica; insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active) values (${sql(world.org)}::uuid, ${sql(world[who].person)}::uuid, ${sql(capability)}, current_date, current_date + 30, true) on conflict (organization_id, person_id, capability_code) do update set active = true, valid_through = excluded.valid_through; commit; select 'inserted';`,
  );

/** Deactivates one actor-grant row as the organization's owner session (a held transaction). */
export const deactivateGrantScript = (
  world,
  who,
  capability,
  holdGate = null,
) => {
  const hold =
    holdGate === null
      ? ''
      : `select pg_catalog.pg_advisory_xact_lock_shared(${holdGate});`;
  return `begin; ${ownerSettings(world)} select set_config('app.cms_rpc', 'true', true); update identity_private.organization_actor_grant set active = false, updated_at = clock_timestamp() where organization_id = ${sql(world.org)}::uuid and person_id = ${sql(world[who].person)}::uuid and capability_code = ${sql(capability)}; ${hold} commit;`;
};

/**
 * Ends the confirmed membership of a person in the owner organization (a held transaction),
 * as the organization's owner session: the review rows the AFTER trigger invalidates are
 * visible to the definer only inside a session scoped to the owning party.
 */
export const endTenureScript = (world, who, holdGate = null) => {
  const hold =
    holdGate === null
      ? ''
      : `select pg_catalog.pg_advisory_xact_lock_shared(${holdGate});`;
  return `begin; ${ownerSettings(world)} select set_config('app.cms_rpc', 'true', true); update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp() where organization_id = ${sql(world.org)}::uuid and person_id = ${sql(world[who].person)}::uuid and state = 'confirmed'; ${hold} commit;`;
};
