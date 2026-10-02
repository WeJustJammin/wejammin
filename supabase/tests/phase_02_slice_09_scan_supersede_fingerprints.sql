commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a CMS-03A-10): a COMPLETED, unsuperseded migration plan
-- is immutable evidence only of the exact attempt it recorded.  The new dry run
-- compares every persisted fingerprint (source, target, compiler, artifact and
-- transform) with the freshly computed one: an identical completed attempt is
-- refused with CONFLICT (nothing new to prove), while ANY difference (a target
-- edit after completion, a different registered transform pair) supersedes it
-- and creates a new attempt, so the candidate is never stranded behind evidence
-- of a different migration.  Everything runs through the real worker RPC protocol.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

create or replace function pg_temp.s09f_plans(p_tag text, p_filter text) returns integer language sql stable as $body$
  select count(*)::integer from platform_private.cms_schema_migration_plans plan
   where plan.to_version_id = pg_temp.s09d_id(p_tag || ':version') and (
     (p_filter = 'all') or (p_filter = 'live' and plan.superseded_at is null)
     or (p_filter = 'superseded' and plan.superseded_at is not null)
     or (p_filter = 'completed-superseded' and plan.superseded_at is not null and plan.state = 'completed')) $body$;

-- --------------------------------------------- target edit after completion ----
select pg_temp.s09d_create_type('a', 'fpedit');
select pg_temp.s09d_to_active('a');
select pg_temp.s09w_entry('a1', 'a', 'Alpha');
select pg_temp.s09w_entry('a2', 'a', 'Beta');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_tighten('b', 40);
select is(pg_temp.s09d_outcome('b:tighten'), 'OK', 'fixture: CMS-03A-02 tightens the title under the clone''s ready plan');
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1', 'fp-edit-dry-0001');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'fixture: the transform attempt is admitted');
select pg_temp.s09d_remember('b:firstPlan', pg_temp.s09d_id('b:plan'));
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_backfill('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:firstPlan')), 'completed',
  'fixture: the worker completes the first attempt over two rows');
-- Nothing changed: an identical request has no new evidence to produce.
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1', 'fp-edit-dry-0002');
select is(pg_temp.s09d_outcome('b:dryRun'), 'CONFLICT',
  'an identical attempt over an unchanged source and unchanged target is refused with CONFLICT');
select is(pg_temp.s09f_plans('b', 'live'), 1, 'the refused identical attempt created no plan and superseded none');
-- The target changes after completion: an optional field is added to the draft.
select pg_temp.s09w_add_field('b', 'note', 2);
select is(pg_temp.s09d_outcome('b:note'), 'OK', 'CMS-03A-02 edits the draft target after its plan completed');
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1', 'fp-edit-dry-0003');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK',
  'a changed target fingerprint supersedes the completed attempt and starts a new one');
select is(pg_temp.s09f_plans('b', 'completed-superseded'), 1, 'the first attempt stays completed, immutable history, now superseded');
select is(pg_temp.s09f_plans('b', 'live'), 1, 'exactly one live attempt remains');
select ok(pg_temp.s09d_id('b:plan') <> pg_temp.s09d_id('b:firstPlan')
    and (select dry_run_report->>'targetHash' from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan'))
      <> (select dry_run_report->>'targetHash' from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:firstPlan')),
  'the new attempt records the new target hash');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_backfill('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'completed',
  'the worker completes the new attempt through the real protocol');

-- ---------------------------------------- transform change after completion ----
select pg_temp.s09d_create_type('c', 'fptransform');
select pg_temp.s09w_add_summary('c');
select pg_temp.s09d_to_active('c');
select pg_temp.s09w_entry('c1', 'c', 'Alpha', 'Has summary');
select pg_temp.s09w_entry('c2', 'c', 'Beta', 'Also has one');
select pg_temp.s09d_successor('d', 'c');
select pg_temp.s09d_dry_run('d');
select pg_temp.s09w_dry_run('d');
select pg_temp.s09w_redefine('d', 'short_text', '{}'::jsonb, null, 'd:summary', 'summary', true, 'literal', '"n/a"'::jsonb);
select is(pg_temp.s09d_outcome('d:summary'), 'OK', 'fixture: the summary becomes required with a literal default');
select pg_temp.s09d_dry_run('d', 'owner', 'identity.revalidate', '1', 'fp-transform-0001');
select is(pg_temp.s09d_outcome('d:dryRun'), 'OK', 'fixture: the identity.revalidate attempt is admitted');
select pg_temp.s09d_remember('d:firstPlan', pg_temp.s09d_id('d:plan'));
select pg_temp.s09w_dry_run('d');
select pg_temp.s09w_backfill('d');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('d:firstPlan')), 'completed',
  'fixture: the identity.revalidate attempt completes (every row already has a summary)');
select pg_temp.s09d_dry_run('d', 'owner', 'identity.revalidate', '1', 'fp-transform-0002');
select is(pg_temp.s09d_outcome('d:dryRun'), 'CONFLICT', 'the identical transform attempt is refused with CONFLICT');
select pg_temp.s09d_dry_run('d', 'owner', 'default.fill_literal', '1', 'fp-transform-0003');
select is(pg_temp.s09d_outcome('d:dryRun'), 'OK',
  'a different transform pair supersedes the completed attempt and starts a new one');
select is(pg_temp.s09f_plans('d', 'completed-superseded'), 1, 'the identity.revalidate attempt stays as superseded completed evidence');
select is((select transform_key from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('d:plan')),
  'default.fill_literal', 'the new attempt records the new transform key');
select pg_temp.s09w_dry_run('d');
select pg_temp.s09w_backfill('d');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('d:plan')), 'completed',
  'the worker completes the default.fill_literal attempt');

select ok(pg_temp.s09x_via_rpc('cms_schema_migration_plans') > 0,
  'precondition: plans were written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

select * from finish();
rollback;
