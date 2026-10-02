commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 integrated path 2 (BE03a real scan): an ACTIVE version with
-- real entries -> a successor with a stricter constraint -> nonzero dry-run,
-- backfill and verify through the real worker RPC protocol -> independent
-- review -> the second atomic switch.  Every producer row is written by a named
-- RPC; an in-test guard proves no review, decision, assignment, dry-run,
-- evidence, target-row, plan row was written by a statement of this script.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();

-- Version 1 is active (path 1: create -> dry-run -> submit -> assign -> decide -> activate).
select pg_temp.s09d_create_type('a', 'scanpath');
select pg_temp.s09d_to_active('a');
select is(pg_temp.s09d_outcome('a:activate'), 'OK', 'path 1 fixture: version 1 is active through the real producer chain');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_dry_run_row_evidence where plan_id = %L',
  pg_temp.s09d_id('a:plan'))), '0', 'path 1 proves zero affected rows: no row evidence exists for the first version');

-- Real entries under the bound editorial policy.
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09w_entry('e1', 'a', 'Alpha title');
select pg_temp.s09w_entry('e2', 'a', 'Beta title with more characters');
select pg_temp.s09w_entry('e3', 'a', 'Gamma');
select is((select count(*)::integer from platform_private.cms_entry_revisions
  where schema_version_id = pg_temp.s09d_id('a:version')), 3, 'three real entry revisions exist on the active source version');
select is(pg_temp.s09d_outcome('e1') || pg_temp.s09d_outcome('e2') || pg_temp.s09d_outcome('e3'), 'OKOKOK', 'the entries were created by cms_create_entry');

select pg_temp.s09d_successor('b', 'a');
select is(pg_temp.s09d_outcome('b:successor'), 'OK', 'CMS-03A-09 creates the successor draft');
select pg_temp.s09d_dry_run('b');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'CMS-03A-10 starts the first attempt on the unchanged clone');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'source_count', pg_temp.s09d_id('b:plan')), '3',
  'the plan records the database-proven live source row count');
select pg_temp.s09w_dry_run('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'ready',
  'the worker scan seals the unchanged clone additively');

-- The stricter constraint is only editable under the clone's own READY plan.
select pg_temp.s09w_tighten('b', 40);
select is(pg_temp.s09d_outcome('b:tighten'), 'OK', 'CMS-03A-02 admits the stricter title constraint under the candidate''s ready plan');
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'CMS-03A-10 starts a conditional attempt naming the registered transform');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan')), 'conditional',
  'the server derives a conditional classification from the stricter constraint');
select pg_temp.s09w_dry_run('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'ready',
  'the nonzero worker scan seals the conditional plan ready');
select ok((select source_count = 3 and target_count = 3 and row_error_count = 0 and cursor = 3
  from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan')),
  'the plan counters are derived from three recorded evidence rows');
select is((select count(*)::integer from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id('b:plan')), 3,
  'one append-only evidence row exists per affected source row');

-- Independent review of the frozen, sealed evidence.
select pg_temp.s09d_submit('b');
select is(pg_temp.s09d_outcome('b:submit'), 'OK', 'CMS-03A-11 freezes the sealed nonzero dry-run evidence for review');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_decide('b', 'rev1');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('b:review')), 'approved',
  'the independent assigned reviewer approves the review');

-- The switch needs the completed backfill: a merely sealed (ready) nonzero plan is refused.
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-early');
select is(pg_temp.s09d_outcome('b:activate-early'), 'VALIDATION_FAILED',
  'CMS-03A-04 refuses to switch a nonzero plan whose backfill has not completed');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'active',
  'the old active version keeps serving after the refused switch');

-- Backfill and verify through the worker protocol.
select pg_temp.s09w_backfill('b');
select is(pg_temp.s09d_outcome('b:w.complete'), 'OK', 'the worker completes backfill, verification and completion');
select ok((select state = 'completed' and migrated_count = 3 and failed_count = 0 and target_count = 3 and cursor = 3
  from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan')),
  'the completed plan carries derived migrated/target counts');
select is((select count(*)::integer from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('b:plan')), 3,
  'the database wrote one target row per scanned source row');
select ok(not exists (select 1 from platform_private.cms_schema_migration_target_rows target
    join platform_private.cms_schema_dry_run_row_evidence evidence
      on evidence.plan_id = target.plan_id and evidence.source_row_id = target.source_row_id
   where target.plan_id = pg_temp.s09d_id('b:plan')
     and (target.output_hash <> evidence.output_hash or target.source_hash <> evidence.source_hash)),
  'every target row hash equals its sealed evidence row');

-- The second atomic switch (an exact request is replayed afterwards).
create temp table s09_p2_activation on commit drop as
select pg_temp.s09d_activation_request('b', 'owner', jsonb_build_object('requestId', extensions.gen_random_uuid(),
  'correlationId', extensions.gen_random_uuid()), jsonb_build_object('idempotencyKey', 's09-path2-activate-0001')) as request;
select pg_temp.s09d_call('b:activate', 'platform_api.cms_activate_schema', request) from s09_p2_activation;
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'CMS-03A-04 performs the second atomic switch over the completed plan');
select ok((select pg_temp.s09d_call('b:activate-replay', 'platform_api.cms_activate_schema', request) = pg_temp.s09d_resp('b:activate')
  and pg_temp.s09d_resp('b:activate') is not null from s09_p2_activation),
  'an exact replay of the switch request returns the identical original response');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.schema.activated.v1'
  and aggregate_id = pg_temp.s09d_id('b:version')), 1, 'the switch committed exactly one activation event');
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-again');
select is(pg_temp.s09d_outcome('b:activate-again'), 'CONFLICT',
  'a second switch request is refused by the one-shot CAS once the candidate is active');
select ok((select (select state from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version')) = 'active'
  and (select state from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')) = 'superseded'),
  'the successor is active and version 1 is superseded in one switch');

-- Guard: no producer row of the path was written by a statement of this script.
select ok(pg_temp.s09x_via_rpc('cms_schema_reviews') > 0 and pg_temp.s09x_via_rpc('cms_schema_review_decisions') > 0
  and pg_temp.s09x_via_rpc('cms_schema_review_assignments') > 0 and pg_temp.s09x_via_rpc('cms_schema_dry_run_reports') > 0
  and pg_temp.s09x_via_rpc('cms_schema_dry_run_row_evidence') > 0 and pg_temp.s09x_via_rpc('cms_schema_migration_plans') > 0
  and pg_temp.s09x_via_rpc('cms_schema_migration_target_rows') > 0,
  'precondition: every producer table was written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

-- Non-vacuity: the guard does see a hand-written statement (a negative control).
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_schema_migration_plans set updated_at = updated_at
 where to_version_id = pg_temp.s09d_id('b:version') and superseded_at is not null;
select is(pg_temp.s09x_direct('cms_schema_migration_plans'), 1::bigint,
  'negative control: a hand-written plan update is recorded as a direct write');
select * from finish();
rollback;
