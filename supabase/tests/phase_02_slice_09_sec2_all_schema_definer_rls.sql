\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- SEC-2, second sweep (Codex R14 finding 1).  The first sweep
-- (phase_02_slice_09_sec2_definer_rls.sql) scanned platform_private and
-- platform_api for a CMS table set and so missed the administrative MFA reset:
-- platform_api.admin_mfa_factor_reset and identity.rpc_admin_reset_mfa_factors
-- stayed SECURITY DEFINER under the BYPASSRLS platform role while writing
-- FORCE-RLS tables.  This file closes the CLASS, not the instance:
--   A. catalog guard over EVERY schema and EVERY forced table: a definer
--      function that names a forced table is owned by a NOLOGIN, non-super,
--      non-BYPASSRLS role, unless it is on the explicit legacy list
--      (support/sec2-legacy-bypass-definers.sqlinc, equality in both
--      directions); every Slice 09 function that was found is named below;
--      the exact set of forced tables the definer roles touch is pinned;
--      every privilege a definer role holds is matched by a policy that
--      admits that role for that verb; least privilege holds in every schema.
--   B. behaviour: the policies constrain both MFA reset functions.  A forged
--      or foreign session is refused by row-level security inside
--      platform_api.admin_mfa_factor_reset and
--      identity.rpc_admin_reset_mfa_factors; the verified system scope and the
--      verified subject are admitted (positive controls).

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc
\ir support/sec2-helpers.sqlinc
\ir support/sec2-legacy-bypass-definers.sqlinc

-- ---------------------------------------------------------------- A: catalog --
create temp table sec2a_forced on commit drop as
select c.oid as table_oid, n.nspname as sch, c.relname as rel
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relforcerowsecurity and c.relkind in ('r', 'p');
-- Every SECURITY DEFINER function of a non-system schema, with each forced table
-- its body names (schema-qualified: every definer pins an empty search_path;
-- SQL comments are stripped first).
create temp table sec2a_fn on commit drop as
select p.oid as fn_oid, p.oid::regprocedure::text as signature, p.proowner as owner_oid, r.rolname as owner_name,
       (r.rolsuper or r.rolbypassrls or r.rolcanlogin) as bypass_or_login,
       f.table_oid, f.sch || '.' || f.rel as table_name
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
  join sec2a_forced f on regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
                         ~* ('(^|[^a-z0-9_"])' || f.sch || '\.' || f.rel || '([^a-z0-9_]|$)')
 where p.prosecdef and p.prokind in ('f', 'p') and n.nspname !~ '^pg_'
   and n.nspname not in ('information_schema', 'extensions', 'auth', 'storage', 'vault', 'realtime', 'graphql',
                         'graphql_public', 'pgsodium', 'pgsodium_masks', 'supabase_functions', 'supabase_migrations',
                         'pgbouncer', '_realtime');

select cmp_ok((select count(distinct signature)::integer from sec2a_fn), '>', 0,
  'the definer functions that name a forced table are derived from the live bodies of every schema [P2-S09-AC-181]');
select is((select string_agg(distinct f.signature || ' owner=' || f.owner_name, ',' order by f.signature || ' owner=' || f.owner_name)
             from sec2a_fn f where f.bypass_or_login and f.signature not in (select signature from sec2a_legacy)), null,
  'no SECURITY DEFINER function of any schema that reads or writes a forced table is owned by a BYPASSRLS, superuser or login role unless it is on the explicit legacy list [P2-S09-AC-181]');
select is((select string_agg(l.signature, ',' order by l.signature) from sec2a_legacy l
            where not exists (select 1 from sec2a_fn f where f.signature = l.signature and f.bypass_or_login)), null,
  'every legacy-list entry is still a bypass-owned definer that names a forced table: a converted or dropped function leaves the list (equality both ways) [P2-S09-AC-181]');
select is((select string_agg(m.sig, ',' order by m.sig)
             from unnest(array[
  'identity.rpc_admin_reset_mfa_factors(uuid,uuid,uuid)',
  'identity_private.identity_organization_read(uuid)',
  'identity_private.require_organization_actor(uuid,uuid,text)',
  'platform_api.admin_mfa_factor_reset(jsonb)',
  'platform_api.auth_mfa_factors_read(uuid,uuid,uuid)',
  'platform_api.auth_rate_limit(text,text,integer,integer)',
  'platform_api.consumer_dead_letter_event(jsonb)',
  'platform_api.identity_security_notification_read(uuid)',
  'platform_private.admin_mfa_factor_reset_view(uuid)',
  'platform_private.cfg_require_capability(uuid,uuid,text)',
  'platform_private.cfg_resolve_effective_value(jsonb)',
  'platform_private.claim_outbox_batch(uuid,integer,integer)',
  'platform_private.cms_capability_grant_project(uuid,uuid,text,date,date,boolean)',
  'platform_private.cms_entry_tenant_visible(uuid,uuid)',
  'platform_private.cms_grant_subject_eligible(uuid,uuid)',
  'platform_private.cms_grant_subject_lock(uuid,uuid)',
  'platform_private.cms_person_holds_capability(uuid,uuid,text)',
  'platform_private.cms_release_actor(jsonb)',
  'platform_private.cms_require_capability(uuid,uuid,text)',
  'platform_private.cms_require_read(uuid,uuid)',
  'platform_private.cms_require_scope_member(uuid,uuid)',
  'platform_private.cms_review_binding(jsonb,uuid,uuid,boolean)',
  'platform_private.cms_review_person_eligible(uuid)',
  'platform_private.cms_template_designer_authorized(uuid,uuid)',
  'platform_private.mfa_audit(text,uuid,uuid,text,uuid,text,uuid)',
  'platform_private.mfa_bump(uuid)',
  'platform_private.mfa_factor_changed_event(uuid,bigint,uuid,uuid)',
  'platform_private.mfa_lock_binding(uuid,boolean)',
  'platform_private.mfa_notification_request(uuid,uuid,uuid)',
  'platform_private.mfa_require_session(uuid,uuid)',
  'platform_private.mfa_rotate_session(uuid,uuid,uuid,timestamp with time zone,uuid,uuid,uuid)',
  'platform_private.mfa_security_event(text,uuid,uuid,text,text,uuid,uuid)',
  'profile_private.rpc_convert_claim(jsonb)'
             ]) m(sig)
            where not exists (select 1 from sec2a_fn f where f.signature = m.sig and not f.bypass_or_login)), null,
  'every Slice 09 definer function that names a forced table, named one by one (33 of 33, including both administrative MFA reset functions), is owned by a NOLOGIN non-bypass role [P2-S09-AC-181] [P2-S09-AC-946]');
select is((select string_agg(distinct f.table_name, ',' order by f.table_name) from sec2a_fn f where not f.bypass_or_login),
  'audit_private.audit_events,identity.auth_rate_limits,identity.auth_session_index,identity.auth_user_bindings,identity.in_app_notification_intents,identity.mfa_factor_registry,identity.mfa_verification_lockouts,identity.security_events,identity.step_up_challenges,identity_private.membership_tenure,identity_private.organization_actor_grant,platform_private.acting_context_binding,platform_private.admin_capability_grants,platform_private.admin_mfa_factor_reset_settlements,platform_private.admin_mfa_factor_resets,platform_private.cfg_release_principals,platform_private.cfg_setting_definition_versions,platform_private.cfg_setting_value_versions,platform_private.cms_block_definition_lifecycle_events,platform_private.cms_block_definition_versions,platform_private.cms_capability_grant_events,platform_private.cms_capability_grants,platform_private.cms_composition_instances,platform_private.cms_conflict_records,platform_private.cms_content_entries,platform_private.cms_content_type_capability_bindings,platform_private.cms_content_type_template_bindings,platform_private.cms_content_type_versions,platform_private.cms_content_types,platform_private.cms_edit_presence,platform_private.cms_entry_assignments,platform_private.cms_entry_field_values,platform_private.cms_entry_relations,platform_private.cms_entry_revisions,platform_private.cms_field_definition_versions,platform_private.cms_locale_variants,platform_private.cms_owner_initialization,platform_private.cms_publication_versions,platform_private.cms_relation_definitions,platform_private.cms_release_nonce_receipts,platform_private.cms_restore_chain_manifests,platform_private.cms_schema_artifacts,platform_private.cms_schema_dry_run_reports,platform_private.cms_schema_dry_run_row_evidence,platform_private.cms_schema_migration_plans,platform_private.cms_schema_migration_target_rows,platform_private.cms_schema_review_assignments,platform_private.cms_schema_review_decisions,platform_private.cms_schema_reviews,platform_private.cms_schema_transform_registry,platform_private.cms_taxonomy_versions,platform_private.cms_template_versions,platform_private.cms_terms,platform_private.cms_workflow_policies,platform_private.consumer_dead_letters,platform_private.idempotency_records,platform_private.jobs,platform_private.outbox_event_producers,platform_private.outbox_events,platform_private.person_party,profile_private.claim_cases,profile_private.claim_proof_attempts,profile_private.ownership_contests,profile_private.party_ownership_periods',
  'the exact set of forced tables that functions owned by the definer roles name is pinned (a new table, or a function that starts naming one, must be reviewed here) [P2-S09-AC-181]');

-- The three dedicated roles.
select is((select count(*)::integer from pg_roles
            where rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
              and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
              and not rolcreatedb and not rolreplication), 3,
  'the CMS definer, the authority reader and the platform definer exist as NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION [P2-S09-AC-181]');
select is((select string_agg(distinct r.rolname, ',') from sec2a_fn f join pg_roles r on r.oid = f.owner_oid
            where not f.bypass_or_login
              and r.rolname not in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')), null,
  'a definer function that names a forced table is owned by bypass-free dedicated role only: one of the three [P2-S09-AC-181]');
select is((select string_agg(g.rolname || ' member of ' || m.rolname, ',')
             from pg_auth_members am join pg_roles m on m.oid = am.roleid join pg_roles g on g.oid = am.member
            where g.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
               or (m.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
                   and g.rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'public'))), null,
  'no dedicated role is a member of another role and no API role can SET ROLE to one [P2-S09-AC-181]');

-- Reachability: every function a dedicated role owns that names a forced table
-- has a privilege on it and a policy that admits the owner (or PUBLIC); and the
-- converse: every privilege a dedicated role holds on a forced table has a
-- PERMISSIVE policy for that verb that admits the role, so no grant is dead and
-- no write relies on a missing policy.
select is((select string_agg(distinct f.owner_name || ' -> ' || f.table_name, ',')
             from sec2a_fn f
            where not f.bypass_or_login
              -- type-only mention: a declared row type, no statement touches the table
              and (f.signature, f.table_name) not in (
                    ('profile_private.rpc_convert_claim(jsonb)', 'platform_private.idempotency_records'))
              and not (has_any_column_privilege(f.owner_oid, f.table_oid, 'SELECT')
                       or has_any_column_privilege(f.owner_oid, f.table_oid, 'INSERT')
                       or has_any_column_privilege(f.owner_oid, f.table_oid, 'UPDATE')
                       or has_table_privilege(f.owner_oid, f.table_oid, 'DELETE'))), null,
  'every forced table a dedicated role''s function names is covered by a privilege of that role (N/N) [P2-S09-AC-181]');
select is((select string_agg(r.rolname || ':' || t.sch || '.' || t.rel || ':' || v.verb, ',' order by r.rolname, t.rel, v.verb)
             from sec2a_forced t
            cross join pg_roles r
            cross join (values ('SELECT', 'r'), ('INSERT', 'a'), ('UPDATE', 'w'), ('DELETE', 'd')) v(verb, cmd)
           where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
             and (case v.verb when 'DELETE' then has_table_privilege(r.oid, t.table_oid, 'DELETE')
                  else has_any_column_privilege(r.oid, t.table_oid, v.verb) end)
             and not exists (
               select 1 from pg_policy pol
                where pol.polrelid = t.table_oid and pol.polpermissive and pol.polcmd in (v.cmd, '*')
                  and (pol.polroles = array[0::oid] or r.oid = any (pol.polroles)))), null,
  'every table privilege a dedicated role holds on a forced table has a permissive policy for that verb that admits the role (no dead grant, no write without a policy) [P2-S09-AC-181]');
select is((select string_agg(distinct t.sch || '.' || t.rel || ':' || r.rolname, ',')
             from sec2a_forced t cross join pg_roles r
            where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
              and (has_any_column_privilege(r.oid, t.table_oid, 'SELECT') or has_any_column_privilege(r.oid, t.table_oid, 'INSERT')
                   or has_any_column_privilege(r.oid, t.table_oid, 'UPDATE') or has_table_privilege(r.oid, t.table_oid, 'DELETE'))
              and not exists (
                select 1 from pg_proc p
                 where p.proowner = r.oid
                   and regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
                       ~* ('(^|[^a-z0-9_"])' || t.sch || '\.' || t.rel || '([^a-z0-9_]|$)'))), null,
  'each dedicated role holds a privilege on a forced table only when a function it owns names that table, in every schema (least privilege, N/N) [P2-S09-AC-181]');
select is((select string_agg(distinct rel.relname || ':' || r.rolname || ':' || p.privilege, ',')
             from pg_class rel join pg_namespace n on n.oid = rel.relnamespace
            cross join pg_roles r cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege)
           where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
             and rel.relkind in ('r', 'p') and n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
             and has_table_privilege(r.oid, rel.oid, p.privilege)), null,
  'no dedicated role holds TRUNCATE, REFERENCES or TRIGGER on any table of any schema [P2-S09-AC-181]');
select is((select string_agg(distinct n.nspname || ':' || r.rolname, ',')
             from pg_namespace n cross join pg_roles r
            where r.rolname in ('wejammin_cms_definer', 'wejammin_cms_authority_reader', 'wejammin_platform_definer')
              and has_schema_privilege(r.oid, n.oid, 'CREATE') and n.nspname !~ '^pg_'), null,
  'no dedicated role may CREATE in any schema [P2-S09-AC-181]');
select is((select string_agg(distinct rel.relname || ':' || p.privilege, ',')
             from pg_class rel join pg_namespace n on n.oid = rel.relnamespace
            cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p(privilege)
           where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and rel.relkind in ('r', 'p')
             and has_table_privilege('wejammin_cms_authority_reader', rel.oid, p.privilege)), null,
  'the authority reader holds no write privilege on any table of any schema (it owns read-only helpers) [P2-S09-AC-181]');
select is((select string_agg(distinct f.signature, ',' order by f.signature)
             from sec2a_fn f join pg_proc p on p.oid = f.fn_oid
            where not f.bypass_or_login and not (coalesce(p.proconfig, array[]::text[]) @> array['search_path=""'])), null,
  'every such definer function pins an empty search_path (N/N) [P2-S09-AC-181]');
select is((select string_agg(t.sch || '.' || t.rel || ':' || r.role_name || ':' || p.privilege, ',' order by t.rel)
             from sec2a_forced t
            cross join unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
            cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(privilege)
           where t.table_oid in (select f.table_oid from sec2a_fn f where not f.bypass_or_login)
             and has_table_privilege(r.role_name, t.table_oid, p.privilege)), null,
  'no API role holds any privilege on any forced table the dedicated roles touch (N/N) [P2-S09-AC-181] [P2-S09-AC-946]');

-- The scoped policies state their scope: no unscoped write policy on the two tables whose
-- writers moved in this sweep.
select is((select string_agg(pol.polname, ',' order by pol.polname)
             from pg_policy pol
            where pol.polrelid = 'identity_private.organization_actor_grant'::regclass and pol.polcmd in ('a', 'w')
              and (select oid from pg_roles where rolname = 'wejammin_cms_definer') = any (pol.polroles)
              and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') <> 'false'
              and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') !~ 'cms_rpc_context_valid\(\)'), null,
  'every write policy of the CMS definer on the actor-grant projection (other than the row-lock policy) requires the CMS RPC context [P2-S09-AC-658] [P2-S09-AC-181]');
select is((select string_agg(pol.polname, ',' order by pol.polname)
             from pg_policy pol
            where pol.polrelid = 'platform_private.admin_mfa_factor_resets'::regclass
              and coalesce(pg_get_expr(pol.polqual, pol.polrelid), pg_get_expr(pol.polwithcheck, pol.polrelid)) !~ 'cms_session_scope_ok_system\(\)'
              and coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), pg_get_expr(pol.polqual, pol.polrelid)) !~ 'cms_session_scope_ok_system\(\)'), null,
  'every policy of the administrative reset record requires the system scope (no blanket true) [P2-S09-AC-946]');

-- ----------------------------------------------- B: both MFA reset functions --
-- The wrapper (platform_api.admin_mfa_factor_reset) and the identity command
-- (identity.rpc_admin_reset_mfa_factors) run as wejammin_cms_definer.  Row-level
-- security therefore applies to every statement they run.  The identity tables
-- admit the verified system scope (service-role JWT, no published CMS session) or
-- the verified subject; the reset record admits the system scope only.
create temp table sec2b_ctx on commit drop as
select pg_temp.s09d_actor_id('rev1', 'auth')::uuid as target_auth, pg_temp.s09d_actor_id('rev1', 'person')::uuid as target_person,
       pg_temp.s09d_actor_id('rev2', 'auth')::uuid as other_auth, pg_temp.s09d_actor_id('designer2', 'person')::uuid as operator_person,
       pg_temp.s09d_actor_id('designer2', 'auth')::uuid as operator_auth, pg_temp.s09d_id('ownerOrg') as org;
-- Row count of a sec2_as outcome ('OK:n'); -1 for a refusal, so a refusal never passes a count assertion.
create or replace function pg_temp.sec2_rows(p_outcome text) returns integer language sql immutable as $body$
  select case when p_outcome like 'OK:%' then split_part(p_outcome, ':', 2)::integer else -1 end $body$;
create or replace function pg_temp.sec2b_state() returns text language sql stable as $body$
  select (select count(*) from identity.mfa_factor_registry where auth_user_id = (select target_auth from sec2b_ctx) and state = 'verified')::text
         || '/' || (select mfa_version::text from identity.auth_user_bindings where auth_user_id = (select target_auth from sec2b_ctx))
         || '/' || (select count(*) from platform_private.admin_mfa_factor_resets)::text
         || '/' || (select count(*) from identity.security_events where reason_code = 'MFA_FACTORS_RESET')::text $body$;
create temp table sec2b_before on commit drop as select pg_temp.sec2b_state() as s;

-- Row visibility of the identity tables for the definer role, per kind of session.
select pg_temp.sec2_publish(null, null, null, 'service_role');
select cmp_ok(pg_temp.sec2_rows((select pg_temp.sec2_as('wejammin_cms_definer',
  format('select 1 from identity.mfa_factor_registry where auth_user_id = %L for update', (select target_auth from sec2b_ctx))))), '>', 0,
  'positive control: the system scope (service-role JWT, no published session) reaches the target''s factor rows under the definer role [P2-S09-AC-946]');
select pg_temp.sec2_publish((select operator_person from sec2b_ctx), (select org from sec2b_ctx), null, 'service_role');
select is((select pg_temp.sec2_as('wejammin_cms_definer',
  format('select 1 from identity.mfa_factor_registry where auth_user_id = %L for update', (select target_auth from sec2b_ctx)))), 'OK:0',
  'a forged published CMS session (service-role JWT, actor published) reaches no factor row of the target under the definer role [P2-S09-AC-946]');
select pg_temp.sec2_publish(null, null, (select other_auth from sec2b_ctx), 'authenticated');
select is((select pg_temp.sec2_as('wejammin_cms_definer',
  format('select 1 from identity.mfa_factor_registry where auth_user_id = %L for update', (select target_auth from sec2b_ctx)))), 'OK:0',
  'a foreign verified subject (another account) reaches no factor row of the target under the definer role [P2-S09-AC-946]');
select pg_temp.sec2_publish(null, null, (select target_auth from sec2b_ctx), 'authenticated');
select cmp_ok(pg_temp.sec2_rows((select pg_temp.sec2_as('wejammin_cms_definer',
  format('select 1 from identity.mfa_factor_registry where auth_user_id = %L for update', (select target_auth from sec2b_ctx))))), '>', 0,
  'positive control: the verified subject reaches their own factor rows under the definer role [P2-S09-AC-946]');
select pg_temp.sec2_publish(null, null, null, 'authenticated');
select is((select pg_temp.sec2_as('wejammin_cms_definer',
  format('select 1 from identity.step_up_challenges where auth_user_id = %L for update', (select target_auth from sec2b_ctx)))), 'OK:0',
  'with no published session and no service role the definer reaches no step-up challenge row [P2-S09-AC-946]');

-- The reset record is writable only under the system scope.
select pg_temp.sec2_publish((select operator_person from sec2b_ctx), (select org from sec2b_ctx), null, 'service_role');
select alike((select pg_temp.sec2_as('wejammin_cms_definer', pg_temp.sec2_insert_sql('platform_private.admin_mfa_factor_resets'::regclass,
  jsonb_build_object('target_person_id', (select target_person from sec2b_ctx), 'organization_id', (select org from sec2b_ctx),
    'operator_person_id', (select operator_person from sec2b_ctx))))), '42501:%row-level security%',
  'a forged published session''s INSERT of a reset record is refused by row-level security (42501) [P2-S09-AC-946]');
select pg_temp.sec2_publish(null, null, null, 'service_role');
select unalike((select pg_temp.sec2_as('wejammin_cms_definer', pg_temp.sec2_insert_sql('platform_private.admin_mfa_factor_resets'::regclass,
  jsonb_build_object('target_person_id', (select target_person from sec2b_ctx), 'organization_id', (select org from sec2b_ctx),
    'operator_person_id', (select operator_person from sec2b_ctx))))), '42501:%',
  'positive control: under the system scope the same INSERT is not refused by row-level security [P2-S09-AC-946]');

-- identity.rpc_admin_reset_mfa_factors under a forged scope fails closed: the audit trail
-- (security event) is never written for a scope the policies do not admit, and no factor moves.
select pg_temp.sec2_publish((select operator_person from sec2b_ctx), (select org from sec2b_ctx), null, 'service_role');
select alike((select pg_temp.sec2_as('wejammin_cms_definer', format('select identity.rpc_admin_reset_mfa_factors(extensions.gen_random_uuid(), %L, %L)',
  (select target_person from sec2b_ctx), (select operator_person from sec2b_ctx)))), '42501:%row-level security%',
  'identity.rpc_admin_reset_mfa_factors under a forged published session is refused by row-level security, not silently skipped (42501) [P2-S09-AC-946]');
select pg_temp.sec2_publish(null, null, (select other_auth from sec2b_ctx), 'authenticated');
select alike((select pg_temp.sec2_as('wejammin_cms_definer', format('select identity.rpc_admin_reset_mfa_factors(extensions.gen_random_uuid(), %L, %L)',
  (select target_person from sec2b_ctx), (select operator_person from sec2b_ctx)))), '42501:%row-level security%',
  'identity.rpc_admin_reset_mfa_factors under a foreign verified subject is refused by row-level security (42501) [P2-S09-AC-946]');
select is(pg_temp.sec2b_state(), (select s from sec2b_before), 'the refused calls changed no factor, version, reset record or security event [P2-S09-AC-946]');

-- platform_api.admin_mfa_factor_reset with a forged published CMS session.
select pg_temp.s09d_session('designer2');
select set_config('app.cms_session_actor', (select operator_person::text from sec2b_ctx), true);
select set_config('app.cms_session_party', (select org::text from sec2b_ctx), true);
select pg_temp.s09d_call('b:forged', 'platform_api.admin_mfa_factor_reset', jsonb_build_object(
  'targetPersonId', (select target_person from sec2b_ctx), 'reason', 'forged scope', 'idempotencyKey', 'sec2-forged-key-0001',
  'context', pg_temp.s09d_context('designer2', true, '{}'::jsonb)));
select is((select state from s09d_probe where label = 'b:forged'), '42501',
  'platform_api.admin_mfa_factor_reset under a forged published session is refused by row-level security (42501), not completed [P2-S09-AC-946]');
select is(pg_temp.sec2b_state(), (select s from sec2b_before), 'and the refused wrapper wrote no reset record, moved no factor and bumped no version [P2-S09-AC-946]');
-- positive control: the same request under the verified system scope completes.
select pg_temp.m_reset('b:ok', 'designer2', 'rev1', 'sec2-genuine-key-0002', 'lost every verified factor');
select is(pg_temp.m_out('b:ok'), 'OK', 'positive control: the same reset under the verified system scope completes through the definer role [P2-S09-AC-946]');
select cmp_ok((select count(*)::integer from identity.mfa_factor_registry
                where auth_user_id = (select target_auth from sec2b_ctx) and state = 'reconciling'), '>', 0,
  'and the policies admitted the factor moves the command exists to make (factors are reconciling) [P2-S09-AC-946]');

select * from finish();
