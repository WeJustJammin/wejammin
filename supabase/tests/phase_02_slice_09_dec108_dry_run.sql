\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-10 actual schema dry-run (BE03a route row,
-- field matrix, dry-run attempt columns, "State machine and concurrency",
-- G1-G4).  The report, plan and BE00 job are produced atomically by the RPC;
-- the sealed scan is produced by the worker RPCs, never by a fixture insert.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('a', 'dec108dry');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_dry_run_reports where target_version_id = %L',
    pg_temp.s09d_id('a:version'))), '0',
  'CMS-03A-01 creates no dry-run report: only CMS-03A-10 produces one, so a draft carries no self-certified pass');
select is(pg_temp.s09d_resp('a:create')->'dryRunId', 'null'::jsonb,
  'a fresh draft resource reports dryRunId null until a real attempt is bound');
create temp table s09d_before on commit drop as select pg_temp.s09d_fingerprint() as fingerprint;
select pg_temp.s09d_dry_run('a', 'owner', null, null, 's09d-dry-replay-0001');
select is(pg_temp.s09d_outcome('a:dryRun'), 'OK', 'CMS-03A-10 accepts a dry-run for a draft candidate [P2-S09-AC-342]');
select ok((select r->>'resourceKind' = 'schema_dry_run' and r->>'state' = 'queued'
    and r->>'contentTypeVersionId' = pg_temp.s09d_id('a:version')::text
    and r->>'classification' = 'additive' and r->>'migrationPlanId' is not null
    and r->>'jobId' is not null and r->>'attemptId' is not null
    and r->'transformKey' = 'null'::jsonb and r->'failureCode' = 'null'::jsonb
    from (select pg_temp.s09d_resp('a:dryRun') r) s),
  'the 202 SchemaDryRunResource is queued with a server-derived classification, plan, job and attempt [P2-S09-AC-330]');
select ok((select r->'result' = 'null'::jsonb and r->'sourceCount' = 'null'::jsonb
    and r->'targetCount' = 'null'::jsonb and r->'rowErrorCount' = 'null'::jsonb
    and r->'sourceHash' = 'null'::jsonb and r->'targetHash' = 'null'::jsonb
    and r->'reportHash' = 'null'::jsonb
    from (select pg_temp.s09d_resp('a:dryRun') r) s),
  'a queued attempt exposes no result, counts or hashes and is never reported as passed');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_schema_dry_run_reports
       where id = %1$L and target_version_id = %2$L and attempt_no = 1 and state = 'queued'
         and sealed_at is null and result is null and source_count is null
         and source_hash is null and report is null and plan_id = %3$L and job_id = %4$L) = 1
    and (select count(*) from platform_private.cms_schema_migration_plans where id = %3$L and to_version_id = %2$L) = 1
    and (select count(*) from platform_private.jobs where id = %4$L and state = 'queued') = 1
    and (select count(*) from platform_private.outbox_events where aggregate_type = 'job'
          and aggregate_id = %4$L and event_type = 'job.requested') = 1)::text$q$,
  pg_temp.s09d_id('a:dryRun'), pg_temp.s09d_id('a:version'), pg_temp.s09d_id('a:plan'),
  pg_temp.s09d_id('a:job')))::boolean, false),
  'report, plan and the BE00 job commit together; the report is unsealed and carries no final evidence [P2-S09-AC-348]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'dry_run_id', pg_temp.s09d_id('a:version')),
  pg_temp.s09d_id('a:dryRun')::text,
  'the report id is bound onto the still-draft candidate');

-- Idempotency and attempt preservation.
create temp table s09d_replay on commit drop as
select pg_temp.s09d_resp('a:dryRun') as first;
select ok((select first is not null and pg_temp.s09d_rpc('a:replay', 'platform_api.cms_start_schema_dry_run', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
      'expectedVersion', '1', 'transformKey', null, 'transformVersion', null,
      'idempotencyKey', 's09d-dry-replay-0001')) = first from s09d_replay),
  'a same-key retry returns the same report, plan and job [P2-S09-AC-345]');
select is(pg_temp.s09d_scalar(format($q$select count(*)::text from platform_private.cms_schema_dry_run_reports
    where target_version_id = %L and state in ('queued', 'running', 'completed', 'failed')$q$,
    pg_temp.s09d_id('a:version'))), '1', 'the same-key retry created no second attempt [P2-S09-AC-345]');

select pg_temp.s09d_add_relation('a');
select pg_temp.s09d_dry_run('a');
select ok(pg_temp.s09d_outcome('a:dryRun') = 'OK'
  and (select (r->>'id') <> (first->>'id') from (select pg_temp.s09d_resp('a:dryRun') r, first from s09d_replay) s),
  'changed candidate evidence starts a new explicit attempt with its own report id [P2-S09-AC-346] [P2-S09-AC-673]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_schema_dry_run_reports where target_version_id = %1$L) = 2
    and (select count(distinct attempt_no) = count(*) from platform_private.cms_schema_dry_run_reports where target_version_id = %1$L)
    and (select count(*) from platform_private.cms_schema_dry_run_reports where id = %2$L and attempt_no = 1) = 1
    and (select count(*) from platform_private.cms_schema_migration_plans where to_version_id = %1$L and superseded_at is null) = 1
    and (select count(*) from platform_private.cms_schema_migration_plans where to_version_id = %1$L and superseded_at is not null) >= 1)::text$q$,
  pg_temp.s09d_id('a:version'), (select (first->>'id')::uuid from s09d_replay)))::boolean, false),
  'earlier immutable attempts are retained with distinct attempt numbers; exactly one live plan remains and earlier ones are superseded [P2-S09-AC-346] [P2-S09-AC-347] [P2-S09-AC-673]');

-- the reference check is a definer function: called outside an RPC it holds the RPC context itself
select set_config('app.cms_rpc', 'true', true);
select ok(pg_temp.s09d_outcome('a:dryRun') = 'OK'
  and coalesce(platform_private.cms_activation_references_valid(pg_temp.s09d_id('a:version')), false)
  and pg_temp.s09d_read('cms_content_type_versions', 'definition_hash', pg_temp.s09d_id('a:version'))
      = pg_temp.s09d_scalar(format('select artifact_hash from platform_private.cms_schema_artifacts where content_type_version_id = %L',
          pg_temp.s09d_id('a:version'))),
  'the dry-run compiles the edited candidate: its immutable artifact matches the persisted field/relation graph, with no hand-rebuilt artifact');
select set_config('app.cms_rpc', '', true);

-- Server-side derivation: callers cannot supply evidence.
select pg_temp.s09d_rpc('a:extra:' || k, 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', null, 'transformVersion', null,
    'idempotencyKey', 's09d-dry-extra-' || k) || jsonb_build_object(k, v))
from (values ('sourceCount', '3'::jsonb), ('sourceHash', to_jsonb(repeat('a', 64))),
  ('classification', '"breaking"'::jsonb), ('report', '{"result":"pass"}'::jsonb)) as t(k, v);
select is(pg_temp.s09d_outcome('a:extra:' || k), 'INVALID_REQUEST',
  'the caller-supplied "' || k || '" is refused (the server derives all evidence) [P2-S09-AC-344]')
from unnest(array['sourceCount', 'sourceHash', 'classification', 'report']) k;

select pg_temp.s09d_rpc('a:pair1', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', 'cms.schema.migrate', 'transformVersion', null,
    'idempotencyKey', 's09d-dry-pair-0001'));
select is(pg_temp.s09d_outcome('a:pair1'), 'VALIDATION_FAILED',
  'a transform key without its version is refused (both null or both present)');
select pg_temp.s09d_rpc('a:pair2', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', 'cms.schema.migrate', 'transformVersion', '1',
    'idempotencyKey', 's09d-dry-pair-0002'));
select is(pg_temp.s09d_outcome('a:pair2'), 'VALIDATION_FAILED',
  'a transform pair on an additive candidate contradicts the server classification (422) [P2-S09-AC-322]');

-- Refusals (atomic).
create temp table s09d_refusal_baseline on commit drop as select pg_temp.s09d_fingerprint(false) as fingerprint;
select pg_temp.s09d_rpc('a:stale', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', '999', 'transformKey', null, 'transformVersion', null, 'idempotencyKey', 's09d-dry-stale-0001'));
select is(pg_temp.s09d_outcome('a:stale'), 'VERSION_MISMATCH', 'a stale draft CAS version is a 409 VERSION_MISMATCH');
select pg_temp.s09d_rpc('a:hidden', 'platform_api.cms_start_schema_dry_run', 'other',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', null, 'transformVersion', null,
    'idempotencyKey', 's09d-dry-hidden-0001'));
select is(pg_temp.s09d_outcome('a:hidden'), 'NOT_FOUND', 'another organization''s candidate is concealed as 404 [P2-S09-AC-343]');
select pg_temp.s09d_rpc('a:denied', 'platform_api.cms_start_schema_dry_run', 'rev1',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', null, 'transformVersion', null,
    'idempotencyKey', 's09d-dry-denied-0001'), false, jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')));
select is(pg_temp.s09d_outcome('a:denied'), 'FORBIDDEN', 'a human without cms.schema_designer is a 403 FORBIDDEN [P2-S09-AC-342]');
select pg_temp.s09d_rpc('a:nokey', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'transformKey', null, 'transformVersion', null));
select is(pg_temp.s09d_outcome('a:nokey'), 'INVALID_REQUEST', 'a missing Idempotency-Key is a 400 INVALID_REQUEST');
select ok(pg_temp.s09d_outcome('a:dryRun') = 'OK'
  and pg_temp.s09d_fingerprint(false) = (select fingerprint from s09d_refusal_baseline),
  'every refusal leaves reports, plans, jobs, idempotency and outbox unchanged');

-- A candidate that has left draft cannot start another attempt.
select pg_temp.s09d_create_type('r', 'dec108drylocked');
select pg_temp.s09d_to_review('r');
select pg_temp.s09d_rpc('r:redo', 'platform_api.cms_start_schema_dry_run', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('r:type'), 'versionId', pg_temp.s09d_id('r:version'),
    'expectedVersion', pg_temp.s09d_version('r'), 'transformKey', null, 'transformVersion', null,
    'idempotencyKey', 's09d-dry-locked-0001'));
select ok(pg_temp.s09d_outcome('r:submit') = 'OK' and pg_temp.s09d_outcome('r:redo') = 'CONFLICT',
  'a candidate already frozen in review is not still-draft: a new attempt is a 409 CONFLICT [P2-S09-AC-343]');

-- The worker seals the scan; zero source is proven, never assumed.
select ok((select r->>'state' = 'queued' and r->'result' = 'null'::jsonb
    from (select pg_temp.s09d_get_pr('a') r) s),
  'before the scan seals, activationPreparation.dryRunRef is queued with result null');
select pg_temp.s09d_seal('a', '3');
select ok(not coalesce((select r->>'state' = 'completed' and r->>'result' = 'passed'
    from (select pg_temp.s09d_get_pr('a') r) s), false) and pg_temp.s09d_outcome('a:dryRun') = 'OK',
  'a worker claiming three source rows where the scan proves none cannot seal a pass');
select pg_temp.s09d_create_type('z', 'dec108dryzero');
select pg_temp.s09d_dry_run('z');
select pg_temp.s09d_seal('z');
select ok((select r->>'state' = 'completed' and r->>'result' = 'passed'
    from (select pg_temp.s09d_get_pr('z') r) s),
  'a zero-source additive report seals as completed/passed');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_schema_dry_run_reports where id = %1$L
       and state = 'completed' and sealed_at is not null and result is not null
       and source_count = 0 and target_count = 0 and row_error_count = 0
       and source_hash is not null and target_hash is not null and report is not null) = 1
    and (select count(*) from platform_private.cms_schema_dry_run_row_evidence where report_id = %1$L) = 0
    and (select state from platform_private.cms_schema_migration_plans where id = %2$L) = 'ready')::text$q$,
  pg_temp.s09d_id('z:dryRun'), pg_temp.s09d_id('z:plan')))::boolean, false),
  'the sealed pass carries zero counts and hashes, no per-row evidence, and advances the plan to ready [P2-S09-AC-087]');

-- Server classification of a successor: a newly required field is conditional and
-- needs one registered transform pair; the pair is refused on a no-transform
-- classification and an unregistered pair is refused on a conditional one.
select pg_temp.s09d_create_type('k', 'dec108dryclass');
select pg_temp.s09d_to_active('k');
select pg_temp.s09d_successor('kb', 'k');
select pg_temp.s09d_rpc('kb:field', 'platform_api.cms_add_field_definition', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('kb:type'), 'versionId', pg_temp.s09d_id('kb:version'),
    'field', jsonb_build_object('key', 'summary', 'kind', 'short_text', 'constraints', '{}'::jsonb,
      'required', true, 'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none',
      'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', 'Summary', 'order', 1),
      'lifecycle', 'active'),
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('kb'),
    'idempotencyKey', pg_temp.s09d_idem('kb', 'field')));
select pg_temp.s09d_dry_run('kb', 'owner', null, null, 's09d-dry-class-none');
select is(pg_temp.s09d_outcome('kb:dryRun'), 'VALIDATION_FAILED',
  'a conditional candidate without a transform pair is refused (422) [P2-S09-AC-322] [P2-S09-AC-683]');
select pg_temp.s09d_dry_run('kb', 'owner', 'cms.unregistered', '1', 's09d-dry-class-unregistered');
select is(pg_temp.s09d_outcome('kb:dryRun'), 'VALIDATION_FAILED', 'an unregistered transform pair is refused (422) [P2-S09-AC-323] [P2-S09-AC-683]');
select pg_temp.s09d_dry_run('kb', 'owner', 'identity.revalidate', '1', 's09d-dry-class-registered');
select ok(pg_temp.s09d_outcome('kb:dryRun') = 'OK'
  and (select r->>'classification' = 'conditional' and r->>'transformKey' = 'identity.revalidate'
        and r->>'transformVersion' = '1' from (select pg_temp.s09d_resp('kb:dryRun') r) s)
  and pg_temp.s09d_read('cms_content_type_versions', 'compatibility', pg_temp.s09d_id('kb:version')) = 'conditional',
  'the server derives conditional and a registered pair is admitted onto the attempt and the candidate [P2-S09-AC-330]');

select ok(pg_temp.s09d_service_only('platform_api.cms_start_schema_dry_run(jsonb)')
  and to_regprocedure('platform_private.cms_start_schema_dry_run(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_start_schema_dry_run(jsonb)'), 'execute'), true),
  'the dry-run RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
