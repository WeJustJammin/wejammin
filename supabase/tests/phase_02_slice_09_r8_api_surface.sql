commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC180 NOT-PROVEN): "The SQL API exposes only the eight
-- original named cms_* RPCs for A01-A08 (CMS-03A-01 through CMS-03A-08), checked
-- by an exact-set guard that treats only the named amendment RPCs as
-- additional; anon/authenticated roles have no direct table INSERT/UPDATE/DELETE
-- grants."  The guard that existed was a regular expression over migration
-- text, and it asserted a grant the next statement revokes.  This suite is the
-- live-catalog guard: every cms_ function of the exposed API schemas is
-- classified into exactly one of three named sets, so a new RPC cannot appear
-- without a reviewed classification, and the grants of each set are asserted on
-- the real catalog.
--   original  - the eight BE03a A01-A08 operations;
--   amendment - the ten RPCs the DEC-108/DEC-119 amendments name (AC685);
--   supporting - Worker, consumer, sweep and read helpers of later slices and
--                lanes; service-role only, never browser-callable.

create temp table r8a_original(fn text primary key, human boolean) on commit drop;
insert into r8a_original values
  ('cms_create_type_draft', true), ('cms_add_field_definition', true), ('cms_bind_relation', true),
  ('cms_activate_schema', false), ('cms_register_block', false), ('cms_advance_block_lifecycle', false),
  ('cms_list_content_types', true), ('cms_get_content_type_version', true);
create temp table r8a_amendment(fn text primary key) on commit drop;
insert into r8a_amendment values
  ('cms_create_schema_successor'),
  ('cms_start_schema_dry_run'),
  ('cms_submit_schema_review'),
  ('cms_decide_schema_review'),
  ('cms_get_schema_review'),
  ('cms_assign_schema_review'),
  ('cms_grant_capability'),
  ('cms_renew_capability_grant'),
  ('cms_revoke_capability_grant'),
  ('cms_list_capability_grants');
create temp table r8a_supporting(fn text primary key) on commit drop;
insert into r8a_supporting values
  ('cms_acknowledge_schema_migration_event'),
  ('cms_activate_schema_migration'),
  ('cms_author_locale_variant'),
  ('cms_begin_schema_migration_verification'),
  ('cms_capability_grant_read_current'),
  ('cms_claim_operational_alert'),
  ('cms_claim_schema_migration_event'),
  ('cms_claim_schema_migration_lease'),
  ('cms_complete_operational_alert'),
  ('cms_complete_schema_migration'),
  ('cms_create_entry'),
  ('cms_create_revision'),
  ('cms_dead_letter_schema_migration_event'),
  ('cms_define_template'),
  ('cms_finalize_schema_migration_dry_run'),
  ('cms_get_entry_draft'),
  ('cms_get_operational_alert_exercise_eligibility'),
  ('cms_get_operational_state_snapshot'),
  ('cms_get_schema_migration_plan'),
  ('cms_heartbeat_schema_migration_lease'),
  ('cms_list_revisions'),
  ('cms_process_schema_migration_batch'),
  ('cms_process_schema_migration_dry_run_batch'),
  ('cms_read_schema_migration_source_rows'),
  ('cms_reconcile_schema_activation'),
  ('cms_release_schema_migration_event'),
  ('cms_resolve_conflict'),
  ('cms_resolve_template_compatibility'),
  ('cms_rollback_schema_migration'),
  ('cms_sweep_expired_review_authority'),
  ('cms_template_context'),
  ('cms_template_latest'),
  ('cms_validate_locale_config'),
  ('cms_verify_operational_alert_delivery'),
  ('cms_verify_schema_migration');

select is((select count(*)::integer from r8a_original), 8, 'the original set is exactly eight named operations [P2-S09-AC-180]');
select is((select count(*)::integer from r8a_original o join r8a_amendment a using (fn)), 0, 'no function is both original and amendment [P2-S09-AC-180]');
select is((select count(*)::integer from (select fn from r8a_original union all select fn from r8a_amendment union all select fn from r8a_supporting) all_sets), 
  (select count(distinct fn)::integer from (select fn from r8a_original union all select fn from r8a_amendment union all select fn from r8a_supporting) all_sets),
  'the three sets are disjoint [P2-S09-AC-180]');
select is((select string_agg(n.nspname || '.' || p.proname, ',' order by n.nspname, p.proname)
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('platform_api', 'public_api') and p.proname like 'cms\_%'
             and p.proname not in (select fn from r8a_original union select fn from r8a_amendment union select fn from r8a_supporting)),
  null, 'every cms_ function of platform_api and public_api is classified: no unreviewed RPC is exposed [P2-S09-AC-180]');
select is((select string_agg(s.fn, ',' order by s.fn)
            from (select fn from r8a_original union select fn from r8a_amendment union select fn from r8a_supporting) s
           where not exists (select 1 from pg_proc p where p.pronamespace = 'platform_api'::regnamespace and p.proname = s.fn)),
  null, 'every classified function exists in platform_api, so the lists carry no stale name [P2-S09-AC-180]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public_api' and p.proname like 'cms\_%'), 0, 'public_api exposes no cms_ function [P2-S09-AC-180]');
select is((select string_agg(o.fn, ',' order by o.fn) from r8a_original o join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = o.fn
            where not p.prosecdef or not has_function_privilege('service_role', p.oid, 'execute')), null,
  'all eight original RPCs are SECURITY DEFINER and executable by the service role [P2-S09-AC-180]');
select is((select string_agg(o.fn, ',' order by o.fn) from r8a_original o join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = o.fn
            where has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute')), null,
  'neither anon nor PUBLIC can execute any original RPC [P2-S09-AC-180]');
select is((select string_agg(o.fn, ',' order by o.fn) from r8a_original o join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = o.fn
            where has_function_privilege('authenticated', p.oid, 'execute')),
  'cms_add_field_definition,cms_bind_relation,cms_create_type_draft,cms_get_content_type_version,cms_list_content_types',
  'the authenticated role executes exactly the five signed-in-human originals, not the other three (the migration''s grant of all eight is revoked before it ends) [P2-S09-AC-180]');
select is((select string_agg(s.fn, ',' order by s.fn)
            from (select fn from r8a_amendment union select fn from r8a_supporting) s
            join pg_proc p on p.pronamespace = 'platform_api'::regnamespace and p.proname = s.fn
           where has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute')
              or has_function_privilege('public', p.oid, 'execute') or not has_function_privilege('service_role', p.oid, 'execute')), null,
  'every amendment and supporting RPC is service-role only: never anon, PUBLIC or authenticated [P2-S09-AC-180]');
select is((select string_agg(c.relname || ':' || r.privilege, ',' order by c.relname, r.privilege)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['anon', 'authenticated']) as role_name(role_name)
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE']) as r(privilege)
     where n.nspname = 'platform_private' and c.relkind in ('r', 'p') and c.relname like 'cms\_%'
       and has_table_privilege(role_name.role_name, c.oid, r.privilege)),
  null, 'anon and authenticated hold no INSERT, UPDATE or DELETE on any platform_private.cms_ table [P2-S09-AC-180]');

select * from finish();
rollback;
