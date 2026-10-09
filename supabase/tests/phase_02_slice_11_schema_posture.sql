-- Slice 11 data model, lane S11-2: the access posture and the guard inventory of
-- every table the Slice 11 forward migrations create or reconcile (BE03b
-- "Permission, RLS and grants"; tracker P2-S11-AC-119 .. AC-122).  The nine
-- tables are private, forced-RLS, grant nothing to an API role, are written only
-- inside a CMS RPC context, and carry exactly the guards below; each guard
-- function is SECURITY INVOKER with an empty search_path and executable by no API
-- role.  RED before 20261005017010, GREEN after 20261005017090.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(8);

\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc

create temp table s11_posture(
  tbl text primary key,
  triggers text not null,
  policies text not null
) on commit drop;

insert into s11_posture(tbl, triggers, policies) values
  ('cms_editorial_reviews',
   'cms_editorial_reviews_write_guard:cms_write_guard:31,cms_editorial_reviews_z_state_guard:cms_review_cas_guard:31',
   'cms_editorial_reviews_rpc_policy'),
  ('cms_editorial_review_assignments',
   'cms_editorial_review_assignments_preview_scope:cms_preview_scope_review_assignment_trigger:25,cms_editorial_review_assignments_write_guard:cms_write_guard:31,cms_editorial_review_assignments_z_state_guard:cms_review_assignment_guard:31',
   'cms_editorial_review_assignments_rpc_policy'),
  ('cms_editorial_decisions',
   'cms_editorial_decisions_immutable_guard:cms_immutable_guard:27,cms_editorial_decisions_write_guard:cms_write_guard:31,cms_editorial_decisions_z_binding_guard:cms_decision_binding_guard:7',
   'cms_editorial_decisions_rpc_policy'),
  ('cms_editorial_review_dependencies',
   'cms_editorial_review_dependencies_immutable_guard:cms_immutable_guard:27,cms_editorial_review_dependencies_write_guard:cms_write_guard:7,cms_editorial_review_dependencies_z_review_guard:cms_review_dependency_guard:7',
   'cms_editorial_review_dependencies_rpc_policy'),
  ('cms_publication_settings_snapshots',
   'cms_publication_settings_snapshots_immutable_guard:cms_immutable_guard:27,cms_publication_settings_snapshots_write_guard:cms_write_guard:7,cms_publication_settings_snapshots_z_snapshot_guard:cms_settings_snapshot_guard:7',
   'cms_publication_settings_snapshots_rpc_policy'),
  ('cms_preflight_registry',
   'cms_preflight_registry_immutable_guard:cms_immutable_guard:27,cms_preflight_registry_write_guard:cms_write_guard:7,cms_preflight_registry_z_newer_guard:cms_preflight_registry_guard:7',
   'cms_preflight_registry_rpc_policy'),
  ('cms_publication_schedules',
   'cms_publication_schedules_write_guard:cms_write_guard:31,cms_publication_schedules_z_state_guard:cms_schedule_state_guard:31',
   'cms_publication_schedules_rpc_policy'),
  ('cms_publication_versions',
   'cms_publication_versions_a_version_lock_guard:cms_entry_version_lock_guard:7,cms_publication_versions_immutable_guard:cms_immutable_guard:27,cms_publication_versions_write_guard:cms_write_guard:31,cms_publication_versions_z_lineage_guard:cms_lineage_append_guard:7',
   'cms_publication_versions_rpc_policy'),
  ('cms_preview_tokens',
   'cms_preview_tokens_write_guard:cms_write_guard:31,cms_preview_tokens_z_state_guard:cms_preview_state_guard:31',
   'cms_preview_tokens_rpc_policy');

select is(
  (select count(*)::integer from s11_posture p
    where to_regclass('platform_private.' || p.tbl) is not null),
  9,
  'posture: all nine Slice 11 tables exist in the private schema [P2-S11-AC-119]'
);

select is(
  (select string_agg(p.tbl, ',' order by p.tbl) from s11_posture p
    where not pg_temp.s11_rls_forced('platform_private.' || p.tbl)),
  null,
  'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]'
);

select is(
  (select string_agg(p.tbl || '=' || pg_temp.s11_api_privileges('platform_private.' || p.tbl), ';' order by p.tbl)
     from s11_posture p
    where pg_temp.s11_api_privileges('platform_private.' || p.tbl) <> ''),
  null,
  'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]'
);

select is(
  (select string_agg(p.tbl, ',' order by p.tbl) from s11_posture p
    where pg_temp.s11_triggers('platform_private.' || p.tbl) is distinct from p.triggers),
  null,
  'posture: each Slice 11 table carries exactly its write, append-only and state guards in firing order, plus the AFTER preview-scope revocation trigger of the reviewer assignments (BE03b preview token revocation) [P2-S11-AC-120]'
);

select is(
  (select string_agg(p.tbl, ',' order by p.tbl) from s11_posture p
    where pg_temp.s11_policies('platform_private.' || p.tbl) is distinct from p.policies),
  null,
  'posture: each Slice 11 table has exactly one policy, the CMS RPC-context gate [P2-S11-AC-119]'
);

create or replace function pg_temp.s11_direct_insert(p_table text)
returns text
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', '', true);
  return pg_temp.s11_outcome(format('insert into platform_private.%I default values', p_table));
end;
$body$;

select is(
  (select string_agg(p.tbl || '=' || pg_temp.s11_direct_insert(p.tbl), ';' order by p.tbl)
     from s11_posture p
    where pg_temp.s11_direct_insert(p.tbl) is distinct from 'P0001:DIRECT_CMS_TABLE_WRITE'),
  null,
  'posture: a write outside the CMS RPC context is refused before any constraint on every Slice 11 table [P2-S11-AC-119]'
);

select is(
  (select string_agg(p.proname, ',' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in (
        'cms_review_cas_guard', 'cms_review_assignment_guard', 'cms_decision_binding_guard',
        'cms_review_dependency_guard', 'cms_settings_snapshot_guard', 'cms_preflight_registry_guard',
        'cms_schedule_state_guard', 'cms_lineage_append_guard', 'cms_preview_state_guard')
      and (p.prosecdef
           or p.proconfig is null
           or not (p.proconfig @> array['search_path=""'])
           or exists (
             select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
              where acl.privilege_type = 'EXECUTE'
                and (acl.grantee = 0
                     or acl.grantee in (select oid from pg_roles
                                         where rolname in ('anon', 'authenticated', 'service_role'))))
           )),
  null,
  'posture: the nine guard functions are SECURITY INVOKER with an empty search_path and executable by no API role [P2-S11-AC-119]'
);

select is(
  (select count(*)::integer
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in (
        'cms_review_cas_guard', 'cms_review_assignment_guard', 'cms_decision_binding_guard',
        'cms_review_dependency_guard', 'cms_settings_snapshot_guard', 'cms_preflight_registry_guard',
        'cms_schedule_state_guard', 'cms_lineage_append_guard', 'cms_preview_state_guard')),
  9,
  'posture: the nine guard functions exist exactly once each [P2-S11-AC-119]'
);

select * from finish();
rollback;
