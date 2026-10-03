\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): CMS-03A-09 successor and CMS-03A-10
-- dry-run criteria whose clauses the producer suites do not pin.  Every
-- candidate is produced through the named commands only; the failing-outbox
-- trigger (the dec119 atomicity pattern) lives and dies inside this transaction.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

-- Effect fingerprint wider than the shared one: jobs, definition children,
-- artifacts and evidence rows too, so "nothing committed" is total.
create or replace function pg_temp.s09e_fp() returns text language plpgsql as $body$
begin
  return md5(pg_temp.s09d_fingerprint(true) || '|' ||
    coalesce(pg_temp.s09d_scalar('select count(*)::text from platform_private.jobs'), 'x') || '|' ||
    coalesce(pg_temp.s09d_scalar('select md5(coalesce(string_agg(t::text, '','' order by id), '''')) from platform_private.cms_field_definition_versions t'), 'x') || '|' ||
    coalesce(pg_temp.s09d_scalar('select md5(coalesce(string_agg(t::text, '','' order by id), '''')) from platform_private.cms_relation_definitions t'), 'x') || '|' ||
    coalesce(pg_temp.s09d_scalar('select md5(coalesce(string_agg(t::text, '','' order by id), '''')) from platform_private.cms_schema_artifacts t'), 'x'));
end;
$body$;

create function public.s09e_fail_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = current_setting('s09e.fail_event', true) then
    raise exception 'S09E_FORCED_OUTBOX_FAILURE';
  end if;
  return new;
end;
$body$;
create trigger s09e_fail_outbox before insert on platform_private.outbox_events
for each row execute function public.s09e_fail_outbox();

-- ======================================================== CMS-03A-09 ====
select pg_temp.s09d_create_type('a', 'ev09a');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_to_active('b');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'superseded',
  'fixture: the first version is superseded by the activated successor');

-- AC298: only an immutable source in an activatable state (active) is a source.
select pg_temp.s09d_successor('c', 'a', 'owner', 's09e-succ-superseded-0001');
select is(pg_temp.s09d_outcome('c:successor'), 'CONFLICT',
  'CMS-03A-09 refuses a superseded source: only an active immutable source is activatable [P2-S09-AC-298]');
select pg_temp.s09d_create_type('dr', 'ev09draft');
select pg_temp.s09d_successor('drs', 'dr', 'owner', 's09e-succ-draft-0001');
select is(pg_temp.s09d_outcome('drs:successor'), 'CONFLICT',
  'CMS-03A-09 refuses a source that is still a mutable draft (not an immutable source) [P2-S09-AC-298]');
select pg_temp.s09d_successor('e', 'b', 'owner', 's09e-succ-active-0001');
select is(pg_temp.s09d_outcome('e:successor'), 'OK',
  'CMS-03A-09 allows the verified designer of the owner party on the readable active immutable source [P2-S09-AC-298]');

-- AC299: owner and creator are derived server-side; a browser-supplied owner is refused.
select pg_temp.s09d_rpc('e:ownerkey', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('b:type'), 'versionId', pg_temp.s09d_id('b:version'),
    'expectedVersion', pg_temp.s09d_version('b'), 'ownerId', pg_temp.s09d_id('otherOrg'),
    'idempotencyKey', 's09e-succ-ownerkey-0001'));
select is(pg_temp.s09d_outcome('e:ownerkey'), 'INVALID_REQUEST',
  'CMS-03A-09 refuses a browser-supplied ownerId as an unknown key [P2-S09-AC-299]');
select pg_temp.s09d_rpc('e:creatorkey', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('b:type'), 'versionId', pg_temp.s09d_id('b:version'),
    'expectedVersion', pg_temp.s09d_version('b'), 'createdBy', pg_temp.s09d_actor_id('rev1', 'auth'),
    'idempotencyKey', 's09e-succ-creatorkey-0001'));
select is(pg_temp.s09d_outcome('e:creatorkey'), 'INVALID_REQUEST',
  'CMS-03A-09 refuses a browser-supplied createdBy as an unknown key [P2-S09-AC-299]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    successor.owner_id = source.owner_id and successor.owner_id = %3$L
    and successor.created_by = %4$L and successor.supersedes_id = source.id)::text
  from platform_private.cms_content_type_versions successor
  join platform_private.cms_content_type_versions source on source.id = %2$L
  where successor.id = %1$L$q$, pg_temp.s09d_id('e:version'), pg_temp.s09d_id('b:version'),
  pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('owner', 'auth')))::boolean, false),
  'the persisted successor owner is the source owner (the acting party) and its creator is the verified actor [P2-S09-AC-299]');

-- Same actor, same key, another source path: the BE00 binding (actor, operation, key hash) is
-- shared and the request hash covers the path, so it is a 409 CONFLICT and never a replay (AC-300).
select pg_temp.s09d_create_type('p', 'ev09path');
select pg_temp.s09d_to_active('p');
create temp table s09e_first_resp on commit drop as select pg_temp.s09d_resp('e:successor') as response;
select pg_temp.s09d_rpc('p:reuse', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('p:type'), 'versionId', pg_temp.s09d_id('p:version'),
    'expectedVersion', pg_temp.s09d_version('p'), 'idempotencyKey', 's09e-succ-active-0001'));
select ok(pg_temp.s09d_outcome('p:reuse') = 'IDEMPOTENCY_MISMATCH'
  and pg_temp.s09d_resp('p:reuse') is distinct from (select response from s09e_first_resp),
  'a key reused by the same actor for another source path is refused IDEMPOTENCY_MISMATCH: it never replays the first response [P2-S09-AC-300]');

-- AC302: the clone, its audit row and its outbox row commit together or not at all.
select pg_temp.s09d_create_type('f', 'ev09atomic');
select pg_temp.s09d_to_active('f');
select set_config('s09e.fail_event', 'cms.schema.draft.created.v1', true);
select pg_temp.s09e_fp() as atomic_before \gset
select pg_temp.s09d_successor('g', 'f', 'owner', 's09e-succ-atomic-0001');
select ok(pg_temp.s09d_outcome('g:successor') not in ('OK', 'MISSING'),
  'a failing outbox write fails CMS-03A-09 [P2-S09-AC-302]');
select is(pg_temp.s09e_fp(), :'atomic_before',
  'the failure left the source, the cloned definition rows, audit, outbox and idempotency record unchanged [P2-S09-AC-302]');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_content_type_versions where content_type_id = %L',
  pg_temp.s09d_id('f:type'))), '1', 'no successor row exists after the rolled-back clone [P2-S09-AC-302]');
select set_config('s09e.fail_event', '', true);
select pg_temp.s09d_successor('g2', 'f', 'owner', 's09e-succ-atomic-0001');
select is(pg_temp.s09d_outcome('g2:successor'), 'OK',
  'the same key succeeds once the failure is removed (no stuck reservation) [P2-S09-AC-302]');

-- ======================================================== CMS-03A-10 ====
-- AC341: contentHash is the JCS SHA-256 of the resource without contentHash.
select pg_temp.s09d_create_type('h', 'ev10hash');
select pg_temp.s09d_dry_run('h');
select ok((select r->>'contentHash' ~ '^[a-f0-9]{64}$' and r->>'contentHash' = platform_private.cms_jcs_sha256(r - 'contentHash')
    from (select pg_temp.s09d_resp('h:dryRun') r) s),
  'the SchemaDryRunResource contentHash is the lowercase SHA-256 of the RFC 8785 JCS canonical JSON of the resource excluding contentHash [P2-S09-AC-341]');

-- AC343: an absent candidate is the same 404 as a concealed one.
select pg_temp.s09d_rpc('h:absent', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('h:type'), 'versionId', extensions.gen_random_uuid(),
    'expectedVersion', '1', 'transformKey', null, 'transformVersion', null, 'idempotencyKey', 's09e-dry-absent-0001'));
select is(pg_temp.s09d_outcome('h:absent'), 'NOT_FOUND',
  'an absent candidate is an indistinguishable 404 and creates nothing [P2-S09-AC-343]');

-- AC344: source, target, compiler version and classification are server-derived.
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    report.target_version_id = %2$L and report.source_version_id is null
    and report.classification = 'additive'
    and report.compiler_version = artifact.compiler_version
    and report.content_type_id = version.content_type_id)::text
  from platform_private.cms_schema_dry_run_reports report
  join platform_private.cms_content_type_versions version on version.id = report.target_version_id
  join platform_private.cms_schema_artifacts artifact on artifact.id = version.schema_artifact_id
  where report.id = %1$L$q$, pg_temp.s09d_id('h:dryRun'), pg_temp.s09d_id('h:version')))::boolean, false),
  'the persisted report names the candidate as target, the compiler version of its artifact and the derived classification [P2-S09-AC-344]');
select pg_temp.s09d_rpc('h:extra:' || k, 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('h:type'), 'versionId', pg_temp.s09d_id('h:version'),
    'expectedVersion', pg_temp.s09d_version('h'), 'transformKey', null, 'transformVersion', null,
    'idempotencyKey', 's09e-dry-extra-' || k) || jsonb_build_object(k, v))
from (values ('sourceVersionId', to_jsonb(extensions.gen_random_uuid())),
  ('targetVersionId', to_jsonb(extensions.gen_random_uuid())),
  ('compilerVersion', '"9"'::jsonb)) as t(k, v);
select is(pg_temp.s09d_outcome('h:extra:' || k), 'INVALID_REQUEST',
  'the caller-supplied "' || k || '" is refused: source, target and compiler version are server-derived [P2-S09-AC-344]')
from unnest(array['sourceVersionId', 'targetVersionId', 'compilerVersion']) k;
select pg_temp.s09d_dry_run('e');
select ok(pg_temp.s09d_outcome('e:dryRun') = 'OK' and coalesce(pg_temp.s09d_scalar(format($q$select (
    report.source_version_id = version.supersedes_id and report.source_version_id = %2$L
    and report.target_version_id = version.id)::text
  from platform_private.cms_schema_dry_run_reports report
  join platform_private.cms_content_type_versions version on version.id = report.target_version_id
  where report.id = %1$L$q$, pg_temp.s09d_id('e:dryRun'), pg_temp.s09d_id('b:version')))::boolean, false),
  'a successor attempt binds the report to the candidate supersedes_id as source and itself as target [P2-S09-AC-344]');

-- AC348: report, plan and BE00 job commit together or not at all.
select pg_temp.s09d_create_type('i', 'ev10atomic');
select set_config('s09e.fail_event', 'cms.schema.dry_run.requested.v1', true);
select pg_temp.s09e_fp() as dry_before \gset
select pg_temp.s09d_dry_run('i', 'owner', null, null, 's09e-dry-atomic-0001');
select ok(pg_temp.s09d_outcome('i:dryRun') not in ('OK', 'MISSING'), 'a failing outbox write fails CMS-03A-10 [P2-S09-AC-348]');
select is(pg_temp.s09e_fp(), :'dry_before',
  'the failure left no report, plan, BE00 job, outbox, audit or idempotency row [P2-S09-AC-348]');
select set_config('s09e.fail_event', '', true);
select pg_temp.s09d_dry_run('i', 'owner', null, null, 's09e-dry-atomic-0001');
select is(pg_temp.s09d_outcome('i:dryRun'), 'OK',
  'the same key succeeds once the failure is removed: one idempotent transaction [P2-S09-AC-348]');

-- AC347: supersede an earlier pre-running plan; refuse while an earlier plan is
-- running, verifying or failed_retryable (a drifted source is the one recovery).
select pg_temp.s09d_create_type('d', 'ev10inflight');
select pg_temp.s09d_to_active('d');
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09w_entry('d1', 'd', 'Alpha');
select pg_temp.s09w_entry('d2', 'd', 'Beta');
select pg_temp.s09d_successor('k', 'd');
select pg_temp.s09d_dry_run('k');
select pg_temp.s09w_dry_run('k');
select pg_temp.s09w_tighten('k', 40);
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0001');
select pg_temp.s09w_dry_run('k');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('k:plan')), 'ready',
  'fixture: the sealed attempt is a ready, pre-running plan');
create temp table s09e_ready_plan on commit drop as select pg_temp.s09d_id('k:plan') as plan_id;
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0002');
select ok(pg_temp.s09d_outcome('k:dryRun') = 'OK'
  and (select superseded_at is not null from platform_private.cms_schema_migration_plans where id = (select plan_id from s09e_ready_plan))
  and pg_temp.s09d_id('k:plan') <> (select plan_id from s09e_ready_plan),
  'CMS-03A-10 supersedes an earlier pre-running (ready) plan for the same version pair [P2-S09-AC-347]');
select pg_temp.s09w_dry_run('k');
-- running: one page of the backfill pass is consumed.
select pg_temp.s09w_claim('k');
select pg_temp.s09w_read('k', 'k:run.read', '1');
select pg_temp.s09w_batch('k', 'k:run.batch', pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('k:run.read')), false, '1');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('k:plan')), 'running',
  'fixture: the worker holds the plan in running');
create temp table s09e_running_plan on commit drop as select pg_temp.s09d_id('k:plan') as plan_id;
select pg_temp.s09e_fp() as running_before \gset
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0003');
select is(pg_temp.s09d_outcome('k:dryRun'), 'CONFLICT',
  'CMS-03A-10 returns 409 CONFLICT while an earlier plan of the pair is running [P2-S09-AC-347]');
select is(pg_temp.s09e_fp(), :'running_before', 'the refused attempt left the running plan and every other row untouched [P2-S09-AC-347]');
-- verifying: the pass completes and verification begins.
select pg_temp.s09w_pass('k', false);
select pg_temp.s09w_begin('k');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('k:plan')), 'verifying',
  'fixture: the worker holds the plan in verifying');
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0004');
select is(pg_temp.s09d_outcome('k:dryRun'), 'CONFLICT',
  'CMS-03A-10 returns 409 CONFLICT while an earlier plan of the pair is verifying [P2-S09-AC-347]');
-- failed_retryable: a retryable worker rollback.
select pg_temp.s09w_rollback('k', 'd', true);
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('k:plan')), 'failed_retryable',
  'fixture: the worker holds the plan in failed_retryable');
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0005');
select is(pg_temp.s09d_outcome('k:dryRun'), 'CONFLICT',
  'CMS-03A-10 returns 409 CONFLICT while an earlier plan of the pair is failed_retryable [P2-S09-AC-347]');
-- drift: the source changed after the scan, so the in-flight evidence no longer
-- describes the migration and the new attempt supersedes it (no candidate stuck).
select pg_temp.s09w_entry('d3', 'd', 'Gamma');
select pg_temp.s09d_dry_run('k', 'owner', 'identity.revalidate', '1', 's09e-inflight-0006');
select ok(pg_temp.s09d_outcome('k:dryRun') = 'OK'
  and (select superseded_at is not null from platform_private.cms_schema_migration_plans where id = (select plan_id from s09e_running_plan)),
  'a drifted in-flight plan is superseded by the fresh attempt: source drift is the one recovery [P2-S09-AC-347]');

-- AC330: a candidate whose derivation inputs cannot be resolved is a 422 before any attempt exists.
select pg_temp.s09d_create_type('u', 'ev10underiv');
select pg_temp.s09d_to_active('u');
select pg_temp.s09d_successor('v', 'u');
set constraints all immediate;
alter table platform_private.cms_content_type_versions drop constraint cms_content_type_versions_supersedes_id_fkey;
select ok(pg_temp.s09d_timewarp('cms_content_type_versions', format($q$update platform_private.cms_content_type_versions
   set supersedes_id = extensions.gen_random_uuid() where id = %L$q$, pg_temp.s09d_id('v:version'))),
  'precondition: the candidate source cannot be resolved (fixture statement only, rolled back with the test)');
select pg_temp.s09e_fp() as underiv_before \gset
select pg_temp.s09d_dry_run('v', 'owner', null, null, 's09e-dry-underiv-0001');
select is(pg_temp.s09d_outcome('v:dryRun'), 'VALIDATION_FAILED',
  'a candidate whose classification cannot be derived is refused with 422 [P2-S09-AC-330]');
select is(pg_temp.s09e_fp(), :'underiv_before', 'the refusal happened before any report, plan, job or idempotency row existed [P2-S09-AC-330]');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_dry_run_reports where target_version_id = %L',
  pg_temp.s09d_id('v:version'))), '0', 'no attempt exists for the underivable candidate [P2-S09-AC-330]');

select * from finish();
rollback;
