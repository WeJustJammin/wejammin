-- Slice 11 lane reviewA-1: the EXECUTE surface of the scheduled-sweep RPCs, enumerated over EVERY role of the
-- cluster (CMS-03B-20; tracker P2-S11-AC-081, DEC-156; review finding A-M13).  The criterion: "EXECUTE only to the
-- registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked)".  Under
-- DEC-156 the registered principal is the Worker service credential (service_role) plus a Worker module boundary
-- (apps/worker/src/cms-publication-schedule-import-graph.test.ts).  The existing posture helper checks service_role,
-- anon, authenticated and PUBLIC only; this file asserts the whole ACL and walks every role.
--
--   platform_api.cms_claim_due_publication_schedules(jsonb)       executable by the definer (owner) and service_role
--   platform_api.cms_execute_publication_schedule(jsonb)          executable by the definer (owner) and service_role
--   platform_private.cms_claim_due_publication_schedules(jsonb)   executable by the definer (owner) ONLY
--   platform_private.cms_execute_publication_schedule(jsonb)      executable by the definer (owner) ONLY
--
-- "Executable" is the effective privilege: the explicit ACL, PUBLIC, and membership with INHERIT, so a role that merely
-- inherits from a permitted role is the permitted role.  A superuser is permitted anywhere by construction.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(6);

create temp table sweep_fn(signature text primary key, allowed_roles text[] not null) on commit drop;
insert into sweep_fn values
  ('platform_api.cms_claim_due_publication_schedules(jsonb)', array['wejammin_cms_definer', 'service_role']),
  ('platform_api.cms_execute_publication_schedule(jsonb)', array['wejammin_cms_definer', 'service_role']),
  ('platform_private.cms_claim_due_publication_schedules(jsonb)', array['wejammin_cms_definer']),
  ('platform_private.cms_execute_publication_schedule(jsonb)', array['wejammin_cms_definer']);

select is(
  (select count(*)::integer from sweep_fn f where to_regprocedure(f.signature) is not null),
  4,
  'fixture: the four sweep functions exist, one overload each [P2-S11-AC-081]');

-- The whole explicit ACL, as a sorted grantee list per function.
select is(
  (select string_agg(f.signature || ' => ' || (
            select string_agg(case acl.grantee when 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end || ':' || acl.privilege_type,
                              ',' order by case acl.grantee when 0 then 'PUBLIC' else pg_get_userbyid(acl.grantee) end)
              from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
             where p.oid = to_regprocedure(f.signature)), E'\n' order by f.signature)
     from sweep_fn f),
  E'platform_api.cms_claim_due_publication_schedules(jsonb) => service_role:EXECUTE,wejammin_cms_definer:EXECUTE\n'
  || E'platform_api.cms_execute_publication_schedule(jsonb) => service_role:EXECUTE,wejammin_cms_definer:EXECUTE\n'
  || E'platform_private.cms_claim_due_publication_schedules(jsonb) => wejammin_cms_definer:EXECUTE\n'
  || 'platform_private.cms_execute_publication_schedule(jsonb) => wejammin_cms_definer:EXECUTE',
  'the execute ACL of each sweep function is exactly its definer and, for the platform_api wrappers, service_role: no other grantee and no PUBLIC [P2-S11-AC-081]');

-- The effective privilege of every role of the cluster.
select ok(
  (select count(*) >= 6 from pg_roles r where r.rolname !~ '^pg_'),
  'fixture: the role walk covers the cluster''s roles (anon, authenticated, service_role, the Supabase service roles, the definer roles, postgres) [P2-S11-AC-081]');

select is(
  (select string_agg(f.signature || ' <= ' || r.rolname, E'\n' order by f.signature, r.rolname)
     from sweep_fn f
     cross join pg_roles r
    where has_function_privilege(r.rolname, to_regprocedure(f.signature), 'EXECUTE')
      and not r.rolsuper
      and not (r.rolname = any (f.allowed_roles))
      and not exists (
        select 1 from unnest(f.allowed_roles) allowed(role_name)
         where pg_has_role(r.rolname, allowed.role_name, 'USAGE'))),
  null,
  'no role other than the definer and (for the wrappers) service_role - nor a role that inherits from them - can execute any sweep function: anon, authenticated, authenticator and every Supabase service role are refused [P2-S11-AC-081]');

select is(
  (select string_agg(f.signature || ' <= ' || r.rolname, E'\n' order by f.signature, r.rolname)
     from sweep_fn f
     cross join pg_roles r
    where f.signature like 'platform_private.%'
      and has_function_privilege(r.rolname, to_regprocedure(f.signature), 'EXECUTE')
      and not r.rolsuper
      and r.rolname <> 'wejammin_cms_definer'
      and not pg_has_role(r.rolname, 'wejammin_cms_definer', 'USAGE')),
  null,
  'the private claim and execute functions are reachable by the definer role alone, service_role included [P2-S11-AC-081]');

select is(
  (select string_agg(f.signature || ' <= ' || r.rolname, E'\n' order by f.signature, r.rolname)
     from sweep_fn f
     cross join (values ('anon'), ('authenticated'), ('authenticator'), ('supabase_auth_admin'),
                        ('supabase_storage_admin'), ('dashboard_user'), ('pgbouncer')) as named(rolname_text)
     join pg_roles r on r.rolname = named.rolname_text
    where has_function_privilege(r.rolname, to_regprocedure(f.signature), 'EXECUTE')),
  null,
  'the named browser and platform roles (anon, authenticated, authenticator, supabase_auth_admin, supabase_storage_admin, dashboard_user, pgbouncer) hold no EXECUTE on any sweep function [P2-S11-AC-081]');

select * from finish();
rollback;
