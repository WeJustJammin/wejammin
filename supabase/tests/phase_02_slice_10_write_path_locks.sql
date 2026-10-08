-- Slice 10 write-path serialization helpers (lane H, Codex adversarial review H1/H2;
-- BE03b "Entry and revision writes serialize with schema activation"; IA03
-- "Authority revoked ..." edge case).  The two-session proofs live in
-- phase_02_slice_10_races/010-activation-serialization.mjs and
-- 011-authority-revocation.mjs (a single pgTAP transaction cannot interleave two
-- sessions); this file pins what a single session can prove: the helpers exist as
-- private SECURITY DEFINER functions of the NOLOGIN CMS definer role with a pinned
-- search_path and no API grant, they decide exactly as documented, and every
-- command that creates a revision calls them (and no longer calls the unlocked
-- capability check).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- ------------------------------------------------------------- catalog ----
create temp table s10l_helpers(signature text primary key) on commit drop;
insert into s10l_helpers values
  ('platform_private.cms_lock_schema_version_shared(uuid)'),
  ('platform_private.cms_lock_entry_authority(uuid,uuid,uuid)'),
  ('platform_private.cms_require_entry_capability_locked(uuid,uuid,text[],uuid)'),
  ('platform_private.cms_lock_entry_rows_shared(uuid[])'),
  ('platform_private.cms_lock_relation_target(uuid,uuid,uuid)'),
  ('platform_private.cms_acquire_revision_write_slot(uuid)');

select is(
  (select count(*)::integer from s10l_helpers h where to_regprocedure(h.signature) is not null), 6,
  'the six write-path lock helpers exist');
select is(
  (select string_agg(h.signature, ',' order by h.signature) from s10l_helpers h
    where not (select p.prosecdef and p.proconfig = array['search_path=""']
                 and pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'
                 from pg_proc p where p.oid = to_regprocedure(h.signature))), null,
  'every lock helper is SECURITY DEFINER with an empty search_path, owned by the NOLOGIN CMS definer role');
select is(
  (select string_agg(h.signature || ' ' || r.rolname, ',' order by h.signature, r.rolname)
     from s10l_helpers h cross join (values ('anon'), ('authenticated'), ('service_role'), ('public')) r(rolname)
    where has_function_privilege(r.rolname, to_regprocedure(h.signature), 'EXECUTE')), null,
  'no API role (and not PUBLIC) can execute a lock helper');

-- Every command that creates a revision takes the version lock and the locked
-- capability check; none still calls the unlocked check.
create temp table s10l_commands(signature text primary key) on commit drop;
insert into s10l_commands values
  ('platform_private.cms_create_entry(jsonb)'),
  ('platform_private.cms_create_revision(jsonb)'),
  ('platform_private.cms_resolve_conflict(jsonb)'),
  ('platform_private.cms_restore_revision(jsonb)');
select is(
  (select string_agg(c.signature, ',' order by c.signature) from s10l_commands c
    where (select p.prosrc !~ 'cms_lock_schema_version_shared\(version_row\.id\)'
           from pg_proc p where p.oid = to_regprocedure(c.signature))), null,
  'create, append, resolve and restore all lock the target version row before reading schema evidence');
select is(
  (select string_agg(c.signature, ',' order by c.signature) from s10l_commands c
    where (select p.prosrc !~ 'cms_require_entry_capability_locked\('
                 or p.prosrc ~ 'cms_require_entry_capability\('
           from pg_proc p where p.oid = to_regprocedure(c.signature))), null,
  'create, append, resolve and restore prove the capability only through the locked check');

-- Codex review H3: relation targets are locked before they are checked, by every
-- command that resolves, carries or restores a relation.
select ok(
  (select p.prosrc ~ 'cms_lock_relation_target\('
     from pg_proc p where p.oid = to_regprocedure(
       'platform_private.cms_resolve_relation_targets(uuid,uuid,uuid,bigint,uuid,jsonb)')),
  'the relation resolver locks every external content target through cms_lock_relation_target');
select is(
  (select string_agg(c.signature, ',' order by c.signature)
     from s10l_commands c
    where c.signature in ('platform_private.cms_create_revision(jsonb)',
                          'platform_private.cms_resolve_conflict(jsonb)',
                          'platform_private.cms_restore_revision(jsonb)')
      and (select p.prosrc !~ 'cms_lock_entry_rows_shared\('
             from pg_proc p where p.oid = to_regprocedure(c.signature))), null,
  'append, resolve and restore lock the external targets of the relations they carry before re-checking them');

-- BE03b "Rate buckets": the database-side cap of three concurrent revision writes per
-- actor (two-session proof: phase_02_slice_10_races/013-revision-concurrency-cap.mjs).
select ok(
  (select p.prosrc ~ 'cms_acquire_revision_write_slot\(actor_id\)'
     from pg_proc p where p.oid = to_regprocedure('platform_private.cms_create_revision(jsonb)')),
  'append takes one of the three per-actor revision-write slots');
select is(
  pg_temp.s10_rpc_call('select platform_private.cms_acquire_revision_write_slot(null)'), true,
  'the slot helper refuses a null actor');
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'a null actor takes no slot (FORBIDDEN)');
select is(
  (select count(*)::integer from (
     select platform_private.cms_acquire_revision_write_slot((select value::uuid from s10_ids where key = 'creatorAuth'))
     from generate_series(1, 5)) taken), 5,
  'advisory slots are re-entrant per session: one transaction that appends repeatedly never exhausts its own cap');

-- --------------------------------------------- cms_lock_schema_version_shared ----
select is(
  pg_temp.s10_rpc_call(format('select platform_private.cms_lock_schema_version_shared(%L::uuid)',
    (select value from s10_ids where key = 'draftVersionId'))), false,
  'an active version row is locked and accepted');
select is(
  pg_temp.s10_rpc_call(format('select platform_private.cms_lock_schema_version_shared(%L::uuid)',
    extensions.gen_random_uuid())), true,
  'an unknown version row is refused');
select is(pg_temp.s10_last_error_message(), 'CONFLICT', 'an unknown version is refused with CONFLICT');
-- A version the activation switch has superseded is refused with CONFLICT (the
-- version is superseded inside a savepoint so the later assertions see it active).
savepoint s10l_superseded;
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_type_versions
set state = 'superseded', version = version + 1
where id = (select value::uuid from s10_ids where key = 'draftVersionId');
select pg_temp.s10_rpc_call(format('select platform_private.cms_lock_schema_version_shared(%L::uuid)',
  (select value from s10_ids where key = 'draftVersionId')));
select is(pg_temp.s10_last_error_message(), 'CONFLICT',
  'a superseded version is refused with CONFLICT');
rollback to savepoint s10l_superseded;
release savepoint s10l_superseded;
select is(
  pg_temp.s10_rpc_call(format('select platform_private.cms_lock_schema_version_shared(%L::uuid)',
    (select value from s10_ids where key = 'draftVersionId'))), false,
  'the version is active again after the savepoint rolled back');

-- ---------------------------------------------- cms_lock_entry_authority / locked check ----
select is(
  platform_private.cms_require_entry_capability_locked(
    (select value::uuid from s10_ids where key = 'creatorAuth'),
    (select value::uuid from s10_ids where key = 'organization'),
    array['cms.author', 'cms.editor'], (select value::uuid from s10_ids where key = 'entryId')),
  'cms.author',
  'the locked capability check returns the matched capability for an assigned author');
select is(
  platform_private.cms_require_entry_capability_locked(
    (select value::uuid from s10_ids where key = 'editorAuth'),
    (select value::uuid from s10_ids where key = 'organization'),
    array['cms.author', 'cms.editor'], (select value::uuid from s10_ids where key = 'entryId')),
  'cms.editor',
  'the locked capability check returns cms.editor for the assigned editor');
select is(
  platform_private.cms_require_entry_capability_locked(
    (select value::uuid from s10_ids where key = 'creatorAuth'),
    (select value::uuid from s10_ids where key = 'organization'),
    array['cms.author', 'cms.editor'], null),
  'cms.author',
  'with no entry the locked check proves grant-level authority (create)');
select pg_temp.s10_rpc_call(format(
  'select platform_private.cms_require_entry_capability_locked(%L::uuid, %L::uuid, array[''cms.author'', ''cms.editor''], %L::uuid)',
  (select value from s10_ids where key = 'outsiderAuth'), (select value from s10_ids where key = 'organization'),
  (select value from s10_ids where key = 'entryId')));
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'a member with no capability is refused after the locks');
select pg_temp.s10_rpc_call(format(
  'select platform_private.cms_require_entry_capability_locked(%L::uuid, %L::uuid, array[''cms.author'', ''cms.editor''], %L::uuid)',
  (select value from s10_ids where key = 'strangerAuth'), (select value from s10_ids where key = 'organization'),
  (select value from s10_ids where key = 'entryId')));
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'a principal outside the owning organization is refused after the locks');
select is(
  pg_temp.s10_rpc_call('select platform_private.cms_lock_entry_authority(null, null, null)'), false,
  'a null actor takes no lock and raises nothing (the capability check that follows refuses)');
select pg_temp.s10_rpc_call(format(
  'select platform_private.cms_require_entry_capability_locked(null::uuid, %L::uuid, array[''cms.author''], null)',
  (select value from s10_ids where key = 'organization')));
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN', 'a null actor is FORBIDDEN');

select * from finish();
rollback;
