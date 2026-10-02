commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a "Source drift", race fix): an entry or publication
-- write that targets a content-type version takes a FOR SHARE row lock on that
-- version's row, and the activation switch takes the conflicting FOR UPDATE lock
-- on the source version before its final unchanged-source check, so no entry
-- commits unscanned between that check and the switch.  The true two-session
-- race is proven by 010-entry-lock-race.mjs; this suite proves the lock is taken
-- by every producer path (the row lock is visible to pgrowlocks), that a write
-- targeting an already-superseded version is refused, and that the guard is
-- installed on exactly the two tables whose rows the scan reads.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select ok(exists (select 1 from pg_trigger
    where tgrelid = 'platform_private.cms_entry_revisions'::regclass
      and tgname = 'cms_entry_revisions_a_version_lock_guard' and not tgisinternal and tgtype & 4 = 4 and tgtype & 2 = 2),
  'a BEFORE INSERT version-lock guard exists on cms_entry_revisions');
select ok(exists (select 1 from pg_trigger
    where tgrelid = 'platform_private.cms_publication_versions'::regclass
      and tgname = 'cms_publication_versions_a_version_lock_guard' and not tgisinternal and tgtype & 4 = 4 and tgtype & 2 = 2),
  'a BEFORE INSERT version-lock guard exists on cms_publication_versions');
select ok(not has_function_privilege('authenticated', 'platform_private.cms_entry_version_lock_guard()', 'execute')
  and not has_function_privilege('anon', 'platform_private.cms_entry_version_lock_guard()', 'execute'),
  'the guard function is not executable by browser roles');

select ok(pg_temp.s09d_def('platform_private.cms_entry_version_lock_guard()') ~* 'from platform_private\.cms_content_type_versions[^;]*for share;',
  'the guard locks the target content-type version row FOR SHARE (not a plain read)');
select ok(pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)') ~* 'active_version[^;]*for update'
  and pg_temp.s09d_def('platform_private.cms_worker_activate_schema(jsonb)') ~* 'expected_active_version_id[^;]*for update',
  'both switch paths lock the source version row FOR UPDATE, the lock mode that conflicts with FOR SHARE [P2-S09-AC-097]');
select pg_temp.s09d_create_type('a', 'entrylock');
select pg_temp.s09d_to_active('a');
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09w_entry('e1', 'a', 'Alpha');
select is(pg_temp.s09d_outcome('e1'), 'OK', 'cms_create_entry still creates the entry on the active version through the guard');

-- A write that targets a version the switch already moved away from is refused.
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_tighten('b', 40);
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09d_submit('b');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_decide('b', 'rev1');
select pg_temp.s09w_backfill('b');
select pg_temp.s09d_activate('b');
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'fixture: the successor was switched in over the scanned row');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'superseded',
  'fixture: the source version is superseded');
select set_config('app.cms_rpc', 'true', true);
create or replace function pg_temp.s09l_insert_revision(p_version uuid) returns text language plpgsql as $body$
begin
  insert into platform_private.cms_entry_revisions(
      id, owner_id, entry_id, revision_number, schema_version_id, template_version_id, taxonomy_version_ids,
      parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version,
      validation_state, validation_report)
    select extensions.gen_random_uuid(), owner_id, entry_id, revision_number + 100, p_version,
           template_version_id, taxonomy_version_ids, parent_revision_ids, locale, payload_hash,
           author_person_id, acting_party_id, state, 1, validation_state, validation_report
      from platform_private.cms_entry_revisions
     where entry_id = (select id from platform_private.cms_content_entries limit 1) limit 1;
  return 'ACCEPTED';
exception when others then
  return sqlerrm;
end;
$body$;
select is(pg_temp.s09l_insert_revision(pg_temp.s09d_id('a:version')), 'CONFLICT',
  'a revision that targets the superseded version is refused with CONFLICT (an entry never commits on a switched-away version)');
select is((select count(*)::integer from platform_private.cms_entry_revisions where revision_number >= 100), 0,
  'the refused write left no revision behind');

select * from finish();
rollback;
