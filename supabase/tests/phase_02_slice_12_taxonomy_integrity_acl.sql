-- DEC-226 rule 2: the privileged helpers of the taxonomy-integrity batch are owner-only.  proacl asserts that PUBLIC, anon, authenticated and
-- service_role hold no EXECUTE on any of the thirteen functions the batch creates (and on the three bodies it replaces), that each is owned
-- by the CMS definer with an empty search_path, and that exactly the owner appears in the ACL.  [P2-S12-AC-239][P2-S12-AC-242][P2-S12-AC-246]
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create temp table acl_fn(sig text primary key, kind text not null) on commit drop;
insert into acl_fn values
  ('platform_private.cms_resolve_taxonomy_version(uuid)', 'created'),
  ('platform_private.cms_taxonomy_version_resolves(text)', 'created'),
  ('platform_private.cms_taxonomy_assignment_integrity(uuid)', 'created'),
  ('platform_private.cms_term_assignable(uuid,text,text,uuid)', 'created'),
  ('platform_private.cms_term_existing_deprecated(uuid,uuid,uuid,uuid)', 'created'),
  ('platform_private.cms_require_value_source_available(uuid,uuid,jsonb,uuid)', 'created'),
  ('platform_private.cms_taxonomy_value_plan(uuid,uuid,uuid,jsonb,text[])', 'created'),
  ('platform_private.cms_taxonomy_plan_version_ids(uuid,uuid,uuid,jsonb,text[])', 'created'),
  ('platform_private.cms_record_term_assignments(uuid,uuid,uuid,uuid,uuid,jsonb,text[])', 'created'),
  ('platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])', 'created'),
  ('platform_private.cms_restore_term_plan(uuid,uuid,uuid,jsonb)', 'created'),
  ('platform_private.cms_restore_record_term_assignments(uuid,uuid,uuid,jsonb)', 'created'),
  ('platform_private.cms_restore_lock_term_plan(uuid,uuid,uuid,jsonb,jsonb)', 'created'),
  ('platform_private.cms_value_source_refusal(text,jsonb)', 'replaced'),
  ('platform_private.cms_require_value_source_available(uuid,uuid,jsonb)', 'replaced'),
  ('platform_private.cms_restore_source_side_valid(uuid,uuid,jsonb,text)', 'replaced');

select is((select count(*)::integer from acl_fn where kind = 'created'), 13, 'the batch creates thirteen functions');
select is((select count(*)::integer from acl_fn where to_regprocedure(sig) is null), 0, 'every listed function exists');

select is(
  (select coalesce(string_agg(sig || ':' || coalesce(grantee_role.rolname, 'PUBLIC'), ',' order by sig), '')
     from acl_fn
     join pg_proc proc on proc.oid = to_regprocedure(acl_fn.sig)
     cross join lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
     left join pg_roles grantee_role on grantee_role.oid = acl.grantee
    where acl.privilege_type = 'EXECUTE'
      and (acl.grantee = 0 or grantee_role.rolname in ('anon', 'authenticated', 'service_role'))),
  '', 'no function of the batch grants EXECUTE to PUBLIC, anon, authenticated or service_role (proacl) [DEC-226 rule 2]');
select is(
  (select coalesce(string_agg(sig, ',' order by sig), '')
     from acl_fn
     join pg_proc proc on proc.oid = to_regprocedure(acl_fn.sig)
    where exists (
      select 1 from aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
       where acl.privilege_type = 'EXECUTE' and acl.grantee <> proc.proowner)
      and acl_fn.kind = 'created'),
  '', 'the owner is the only grantee of EXECUTE on each created function [DEC-226 rule 2]');
select is(
  (select coalesce(string_agg(sig, ',' order by sig), '')
     from acl_fn join pg_proc proc on proc.oid = to_regprocedure(acl_fn.sig)
    where acl_fn.kind = 'created'
      and (pg_get_userbyid(proc.proowner) <> 'wejammin_cms_definer'
           or not (coalesce(proc.proconfig, array[]::text[]) @> array['search_path=""']::text[]))),
  '', 'each created function is owned by the CMS definer with an empty search_path [SEC-2]');
select is(
  (select coalesce(string_agg(sig, ',' order by sig), '')
     from acl_fn join pg_proc proc on proc.oid = to_regprocedure(acl_fn.sig)
    where acl_fn.kind = 'replaced'
      and not (coalesce(proc.proconfig, array[]::text[]) @> array['search_path=""']::text[])),
  '', 'the three replaced bodies keep their empty search_path [SEC-2]');
select is(
  (select coalesce(string_agg(sig, ',' order by sig), '')
     from acl_fn join pg_proc proc on proc.oid = to_regprocedure(acl_fn.sig)
    where acl_fn.kind = 'created' and proc.prosecdef
      and sig not in ('platform_private.cms_resolve_taxonomy_version(uuid)', 'platform_private.cms_taxonomy_version_resolves(text)',
                      'platform_private.cms_taxonomy_assignment_integrity(uuid)')),
  '', 'only the resolver, its boolean form and the provider are SECURITY DEFINER; the other ten helpers run with the caller''s rights [SEC-2]');
select is(
  (select coalesce(string_agg(has_function_privilege(rname, to_regprocedure(sig), 'EXECUTE')::text, ',' order by sig, rname), '')
     from acl_fn cross join (values ('anon'), ('authenticated'), ('service_role')) r(rname)
    where sig = 'platform_private.cms_lock_term_plan(uuid,uuid,uuid,jsonb,text[])'),
  'false,false,false', 'control: has_function_privilege agrees for the lock helper [DEC-226 rule 2]');

select * from finish();
rollback;
