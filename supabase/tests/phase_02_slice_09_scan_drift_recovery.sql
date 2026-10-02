commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a "Source drift"): rows created on the still-active
-- source after a candidate was frozen for review make the sealed evidence stale.
-- Every switch / verify / complete path refuses (409 CONFLICT detail
-- MIGRATION_SOURCE_DRIFT, never committing over drift), and the candidate is
-- never left stuck: a new dry run atomically invalidates the open or approved
-- review (its decisions stay as history) and returns the candidate to draft, so
-- a fresh scan and a resubmission succeed.  A raised error rolls its whole
-- transaction back, so the invalidation commits with the recovery command (or,
-- on the non-raising verify path, with the verdict itself).

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

-- An active type with two real entries and a conditional successor that is
-- sealed, reviewed and approved ('tag'); the backfill is run by the caller.
create or replace function pg_temp.s09r_prepare(p_src text, p_tag text, p_type text) returns void
language plpgsql as $body$
begin
  perform pg_temp.s09d_create_type(p_src, p_type);
  perform pg_temp.s09d_to_active(p_src);
  perform pg_temp.s09w_entry(p_src || '1', p_src, 'Alpha');
  perform pg_temp.s09w_entry(p_src || '2', p_src, 'Beta');
  perform pg_temp.s09d_successor(p_tag, p_src);
  perform pg_temp.s09d_dry_run(p_tag);
  perform pg_temp.s09w_dry_run(p_tag);
  perform pg_temp.s09w_tighten(p_tag, 40);
  perform pg_temp.s09d_dry_run(p_tag, 'owner', 'identity.revalidate', '1');
  perform pg_temp.s09w_dry_run(p_tag);
  perform pg_temp.s09d_submit(p_tag);
  perform pg_temp.s09d_assign(p_tag, 'rev1');
  perform pg_temp.s09d_decide(p_tag, 'rev1');
end;
$body$;

create or replace function pg_temp.s09r_state(p_tag text, p_relation text, p_id_name text) returns text
language sql stable as $body$
  select pg_temp.s09d_read(p_relation, 'state', pg_temp.s09d_id(p_id_name)) $body$;

-- ------------------------- A. drift at the switch (approved, completed plan) ----
select pg_temp.s09r_prepare('a', 'b', 'driftswitch');
select is(pg_temp.s09r_state('b', 'cms_content_type_versions', 'b:version'), 'approved', 'fixture: the candidate is approved');
select pg_temp.s09w_backfill('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'completed',
  'fixture: the backfill completed over two rows');
create temp table s09r_old_a on commit drop as select pg_temp.s09d_id('b:review') as review_id;
select pg_temp.s09w_entry('a3', 'a', 'Gamma');
select is(pg_temp.s09d_outcome('a3'), 'OK', 'the active source keeps accepting entries after the freeze');
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-drift');
select is(pg_temp.s09d_outcome('b:activate-drift'), 'CONFLICT', 'the switch refuses to commit over drift');
select is(pg_temp.s09d_detail('b:activate-drift'), 'MIGRATION_SOURCE_DRIFT', 'the 409 detail is MIGRATION_SOURCE_DRIFT');
select is(pg_temp.s09r_state('b', 'cms_content_type_versions', 'b:version') || '/' || pg_temp.s09r_state('b', 'cms_schema_reviews', 'b:review'),
  'approved/approved', 'the refusal itself changed nothing (a raised error rolls back)');
-- Recovery: the new dry run invalidates the review and reopens the candidate.
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1', 's09r-recover-a-0001');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'a new dry run is admitted for a frozen candidate whose source drifted');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', (select review_id from s09r_old_a)), 'invalidated',
  'the review of the drifted evidence is invalidated');
select is(pg_temp.s09r_state('b', 'cms_content_type_versions', 'b:version'), 'draft', 'the candidate returned to draft in the same transaction');
select is((select count(*)::integer from platform_private.cms_schema_review_decisions
  where review_id = (select review_id from s09r_old_a)), 1, 'the invalidated review keeps its decision rows as history');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'source_count', pg_temp.s09d_id('b:plan')), '3',
  'the new attempt records the new database-proven source row count');
select ok((select count(*) = 1 from platform_private.cms_schema_migration_plans
  where to_version_id = pg_temp.s09d_id('b:version') and superseded_at is not null and state = 'completed'),
  'the stale completed plan stays immutable history, superseded');
select pg_temp.s09w_dry_run('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'ready', 'the fresh scan seals three rows');
select pg_temp.s09d_submit('b');
select is(pg_temp.s09d_outcome('b:submit'), 'OK', 'the resubmission freezes the new evidence');
select isnt(pg_temp.s09d_id('b:review'), (select review_id from s09r_old_a), 'a new review row is created');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_decide('b', 'rev1');
select is(pg_temp.s09r_state('b', 'cms_schema_reviews', 'b:review'), 'approved', 'the independent reviewer approves the new review');
select pg_temp.s09w_backfill('b');
select pg_temp.s09d_activate('b');
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'recovery completes: the switch succeeds over the fresh evidence');
select is(pg_temp.s09r_state('b', 'cms_content_type_versions', 'b:version') || '/' || pg_temp.s09r_state('a', 'cms_content_type_versions', 'a:version'),
  'active/superseded', 'the successor is active and the source superseded');

-- ----------------------- B. drift at verify (non-raising: eager invalidation) ----
select pg_temp.s09r_prepare('c', 'd', 'driftverify');
select pg_temp.s09w_claim('d');
select pg_temp.s09w_pass('d', false);
select pg_temp.s09w_begin('d');
select is(pg_temp.s09d_outcome('d:w.begin'), 'OK', 'fixture: the worker began verification');
create temp table s09r_old_c on commit drop as select pg_temp.s09d_id('d:review') as review_id;
select pg_temp.s09w_entry('c3', 'c', 'Gamma');
select pg_temp.s09w_verify('d');
select ok((select r->>'valid' = 'false' and r->>'reasonCode' = 'MIGRATION_SOURCE_DRIFT' from (select pg_temp.s09d_resp('d:w.verify') r) s),
  'verify reports MIGRATION_SOURCE_DRIFT to the worker');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', (select review_id from s09r_old_c)), 'invalidated',
  'the non-raising verdict invalidates the frozen review atomically with itself');
select is(pg_temp.s09r_state('d', 'cms_content_type_versions', 'd:version'), 'draft', 'and returns the candidate to draft');
select pg_temp.s09d_dry_run('d', 'owner', 'identity.revalidate', '1', 's09r-recover-c-0001');
select is(pg_temp.s09d_outcome('d:dryRun'), 'OK', 'a new dry run is admitted straight away');
select pg_temp.s09w_dry_run('d');
select pg_temp.s09d_submit('d');
select is(pg_temp.s09d_outcome('d:submit'), 'OK', 'the candidate resubmits over the fresh evidence');

-- ----------------------- C. drift at complete (raising: lazy recovery) ----
select pg_temp.s09r_prepare('e', 'f', 'driftcomplete');
select pg_temp.s09w_claim('f');
select pg_temp.s09w_pass('f', false);
select pg_temp.s09w_begin('f');
select pg_temp.s09w_verify('f');
select ok((select (r->>'valid')::boolean from (select pg_temp.s09d_resp('f:w.verify') r) s), 'fixture: verification passed before the drift');
select pg_temp.s09w_entry('e3', 'e', 'Gamma');
select pg_temp.s09w_complete('f');
select is(pg_temp.s09d_outcome('f:w.complete'), 'VALIDATION_FAILED', 'completion refuses to seal the plan over drift');
select is(pg_temp.s09d_detail('f:w.complete'), 'MIGRATION_SOURCE_DRIFT', 'with detail MIGRATION_SOURCE_DRIFT');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('f:plan')), 'verifying', 'the plan stays unsealed');
select is(pg_temp.s09r_state('f', 'cms_content_type_versions', 'f:version'), 'approved', 'the refused completion changed nothing');
select pg_temp.s09d_dry_run('f', 'owner', 'identity.revalidate', '1', 's09r-recover-f-0001');
select is(pg_temp.s09d_outcome('f:dryRun'), 'OK', 'the recovery dry run is admitted over the unsealed drifted plan');
select is(pg_temp.s09r_state('f', 'cms_content_type_versions', 'f:version'), 'draft', 'and returns the candidate to draft');

-- ------------------------------------------------ D. no drift, no shortcut ----
select pg_temp.s09r_prepare('g', 'h', 'driftnone');
select pg_temp.s09d_dry_run('h', 'owner', 'identity.revalidate', '1', 's09r-recover-h-0001');
select is(pg_temp.s09d_outcome('h:dryRun'), 'CONFLICT',
  'a frozen candidate whose scanned source did not change cannot start a new dry run');
select is(pg_temp.s09r_state('h', 'cms_content_type_versions', 'h:version') || '/' || pg_temp.s09r_state('h', 'cms_schema_reviews', 'h:review'),
  'approved/approved', 'the refusal left the review and candidate untouched');

select ok(pg_temp.s09x_via_rpc('cms_schema_reviews') > 0 and pg_temp.s09x_via_rpc('cms_schema_migration_plans') > 0,
  'precondition: reviews and plans were written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

select * from finish();
rollback;
