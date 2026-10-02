commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 integrated path 1 (BE03a real scan): create -> dry-run ->
-- submit -> assign -> independent decision(s) -> activate for a FIRST version.
-- The zero-source additive report exists only after the database proved zero
-- affected rows; an ordinary type needs one independent decision, a protected
-- type two including the specialist.  Every producer row is written by a named
-- RPC and an in-test guard proves no statement of this script wrote one.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();

-- Ordinary first version.
select pg_temp.s09d_create_type('o', 'pathone');
select pg_temp.s09d_dry_run('o');
select is(pg_temp.s09d_outcome('o:dryRun'), 'OK', 'CMS-03A-10 starts the first-version attempt [P2-S09-AC-711]');
select ok((select p.from_version_id is null and p.source_count = 0 and p.state = 'draft' and p.classification = 'additive'
    from platform_private.cms_schema_migration_plans p where p.id = pg_temp.s09d_id('o:plan')),
  'the plan of a first version has no source version and the database-proven zero row count');
-- A caller cannot seal a wrong count: the database proves it.
select pg_temp.s09d_seal('o', '3');
select is(pg_temp.s09d_outcome('o:plan.seal'), 'CONFLICT', 'finalize refuses a caller-claimed source count that the database does not prove');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('o:plan')), 'dry_running',
  'the refused seal left the plan unsealed');
select pg_temp.s09d_dry_run('o', 'owner', null, null, 's09p1-redry-0001');
select pg_temp.s09d_seal('o');
select ok((select report.state = 'completed' and report.result = 'pass' and report.source_count = 0 and report.target_count = 0
          and report.row_error_count = 0 and report.sealed_at is not null
   from platform_private.cms_schema_dry_run_reports report where report.id = pg_temp.s09d_id('o:dryRun')),
  'the worker seals a passing zero-row report only after the database proved zero affected rows');
select is((select count(*)::integer from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id('o:plan')), 0,
  'a zero-source plan has no row evidence');
select pg_temp.s09d_submit('o');
select pg_temp.s09d_assign('o', 'rev1');
select pg_temp.s09d_decide('o', 'rev1');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('o:review')), 'approved',
  'one independent assigned decision approves an ordinary schema review [P2-S09-AC-711]');
select pg_temp.s09d_activate('o');
select is(pg_temp.s09d_outcome('o:activate'), 'OK', 'CMS-03A-04 activates the first version over the sealed plan [P2-S09-AC-711]');
select ok((select version_row.state = 'active' and plan.state = 'completed'
   from platform_private.cms_content_type_versions version_row
   join platform_private.cms_schema_migration_plans plan on plan.id = pg_temp.s09d_id('o:plan')
   where version_row.id = pg_temp.s09d_id('o:version')),
  'the first version is active and its zero-row plan completed in the same atomic activation');

-- Protected first version: two distinct humans including the specialist.
select pg_temp.s09d_create_type('p', 'pathoneprot', 'cms.disclosure.legal');
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('p:specialist', 'owner', 'rev1', 'cms.reviewer.legal', pg_temp.s09g_day(5));
select pg_temp.s09d_to_review('p');
select pg_temp.s09d_assign('p', 'rev1');
select pg_temp.s09d_assign('p', 'rev2');
select pg_temp.s09d_decide('p', 'rev1');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')), 'open',
  'a protected review stays open after the first of two required decisions');
select pg_temp.s09d_decide('p', 'rev2');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')), 'approved',
  'the second distinct human decision approves the protected review [P2-S09-AC-091]');
select pg_temp.s09d_activate('p');
select is(pg_temp.s09d_outcome('p:activate'), 'OK', 'the protected first version activates over its sealed plan [P2-S09-AC-091]');

select ok(pg_temp.s09x_via_rpc('cms_schema_reviews') > 0 and pg_temp.s09x_via_rpc('cms_schema_review_decisions') > 0
  and pg_temp.s09x_via_rpc('cms_schema_review_assignments') > 0 and pg_temp.s09x_via_rpc('cms_schema_dry_run_reports') > 0
  and pg_temp.s09x_via_rpc('cms_schema_migration_plans') > 0,
  'precondition: every producer table was written through named RPCs [P2-S09-AC-711]');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, plan or evidence row was written by a direct statement [P2-S09-AC-711]');

select * from finish();
rollback;
