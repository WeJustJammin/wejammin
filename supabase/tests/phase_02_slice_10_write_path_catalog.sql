-- Slice 10 write-path hardening (lane H, migrations 20261005012000..012400): the
-- security-definer discipline of every function those migrations create or redefine
-- (SEC-2, BE03b "Permission, RLS and grants").  The commands stay SECURITY DEFINER
-- functions of the NOLOGIN CMS definer role with an empty search_path; every new private
-- helper that reads a forced table is owned by that role; the pure registry helpers stay
-- with the migration owner and grant EXECUTE only to the definer; and no API role (nor
-- PUBLIC) can execute any of them.  The API surface and trigger inventories
-- (phase_02_slice_09_r8_api_surface.sql, the trigger catalogs) are unchanged: no
-- API-callable RPC and no trigger was added.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Definer-owned (SECURITY DEFINER or invoker functions owned by the CMS definer role).
create temp table s10w_definer(signature text primary key, secdef boolean not null) on commit drop;
insert into s10w_definer values
  ('platform_private.cms_create_entry(jsonb)', true),
  ('platform_private.cms_create_revision(jsonb)', true),
  ('platform_private.cms_resolve_conflict(jsonb)', true),
  ('platform_private.cms_restore_revision(jsonb)', true),
  ('platform_private.cms_list_entries(jsonb)', true),
  ('platform_private.cms_expire_edit_presence_leases(integer)', true),
  ('platform_private.cms_activation_references_valid(uuid)', true),
  ('platform_private.cms_validators_frozen_current(uuid)', true),
  ('platform_private.cms_lock_schema_version_shared(uuid)', true),
  ('platform_private.cms_lock_entry_authority(uuid,uuid,uuid)', true),
  ('platform_private.cms_require_entry_capability_locked(uuid,uuid,text[],uuid)', true),
  ('platform_private.cms_lock_entry_rows_shared(uuid[])', true),
  ('platform_private.cms_lock_relation_target(uuid,uuid,uuid)', true),
  ('platform_private.cms_acquire_revision_write_slot(uuid)', true),
  ('platform_private.cms_resolve_relation_targets(uuid,uuid,uuid,bigint,uuid,jsonb)', false),
  ('platform_private.cms_require_draft_value_valid(uuid,uuid,jsonb,text)', false),
  ('platform_private.cms_require_value_source_available(uuid,uuid,jsonb)', false);
-- Pure registry helpers: migration owner, EXECUTE granted to the CMS definer only.
create temp table s10w_pure(signature text primary key) on commit drop;
insert into s10w_pure values
  ('platform_private.cms_protected_validator_descriptor_body(text,bigint)'),
  ('platform_private.cms_protected_validator_descriptor(text,bigint)'),
  ('platform_private.cms_required_protected_validators(jsonb)'),
  ('platform_private.cms_compiled_editor_manifest(jsonb)');

select is(
  (select string_agg(signature, ',' order by signature) from (
     select signature from s10w_definer union all select signature from s10w_pure) all_functions
    where to_regprocedure(signature) is null),
  null, 'every function the lane H migrations create or redefine exists');
select is(
  (select string_agg(d.signature || ' owner=' || pg_get_userbyid(p.proowner), ',' order by d.signature)
     from s10w_definer d join pg_proc p on p.oid = to_regprocedure(d.signature)
    where pg_get_userbyid(p.proowner) <> 'wejammin_cms_definer'),
  null, 'every definer-side function is owned by the NOLOGIN CMS definer role (SEC-2)');
select is(
  (select string_agg(d.signature, ',' order by d.signature)
     from s10w_definer d join pg_proc p on p.oid = to_regprocedure(d.signature)
    where p.prosecdef is distinct from d.secdef),
  null, 'the SECURITY DEFINER attribute of each function is exactly as declared (commands and lock helpers are SECURITY DEFINER)');
select is(
  (select string_agg(d.signature, ',' order by d.signature)
     from s10w_definer d join pg_proc p on p.oid = to_regprocedure(d.signature)
    where d.secdef and p.proconfig is distinct from array['search_path=""']),
  null, 'every SECURITY DEFINER function pins an empty search_path');
select is(
  (select string_agg(d.signature, ',' order by d.signature)
     from s10w_definer d join pg_proc p on p.oid = to_regprocedure(d.signature)
    where not d.secdef and p.proconfig is distinct from array['search_path=""']),
  null, 'the invoker functions owned by the definer role also pin an empty search_path');
select is(
  (select string_agg(s.signature || ' ' || pg_get_userbyid(p.proowner), ',' order by s.signature)
     from s10w_pure s join pg_proc p on p.oid = to_regprocedure(s.signature)
    where pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'
       or p.proconfig is distinct from array['search_path=""']),
  null, 'the pure registry helpers stay with the migration owner and pin an empty search_path');
select is(
  (select string_agg(s.signature, ',' order by s.signature)
     from s10w_pure s
    where not has_function_privilege('wejammin_cms_definer', to_regprocedure(s.signature), 'EXECUTE')),
  null, 'the CMS definer role can execute every pure registry helper');
select is(
  (select string_agg(f.signature || ' ' || r.rolname, ',' order by f.signature, r.rolname)
     from (select signature from s10w_definer union all select signature from s10w_pure) f
     cross join (values ('anon'), ('authenticated'), ('service_role')) r(rolname)
    where has_function_privilege(r.rolname, to_regprocedure(f.signature), 'EXECUTE')),
  null, 'no API role can execute any function the migrations create or redefine');
select is(
  (select string_agg(f.signature, ',' order by f.signature)
     from (select signature from s10w_definer union all select signature from s10w_pure) f
     join pg_proc p on p.oid = to_regprocedure(f.signature)
    where exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl where acl.grantee = 0)),
  null, 'PUBLIC holds no EXECUTE on any of them');

-- Least privilege: the definer roles gained no schema CREATE and no table privilege from these migrations.
select is(
  (select string_agg(r.rolname, ',') from pg_roles r
    where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
      and has_schema_privilege(r.rolname, 'platform_private', 'CREATE')),
  null, 'no dedicated definer role keeps CREATE on platform_private');

select * from finish();
rollback;
