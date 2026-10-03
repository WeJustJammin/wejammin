\ir support/jwt-claims.sqlinc
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3 follow-up, AC181): BE03a "Database invariants
-- and grants" asks for RLS policies that call a schema-qualified helper that
-- RESOLVES THE VERIFIED SESSION and acting context, with WITH CHECK requiring
-- the same scope, in addition to the RPC gate.  The producers publish the
-- verified session (actor + acting party, or the MFA subject) after their own
-- checks; every new private CMS/identity table carries a RESTRICTIVE policy that
-- re-resolves that session against the live authority tables on every read and
-- write.  `postgres` (the owner of the definer RPCs) has BYPASSRLS on this
-- platform, so the behavioural proofs run the statements as a non-bypass probe
-- role, including inside a SECURITY DEFINER function that sets the RPC flag
-- itself (a definer context that bypasses the RPC gate).

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- SEC-2 note: the restrictive policies evaluate the session scope once per statement through
-- cms_session_owner_scope / cms_session_reviewer_scope / cms_session_report_scope (20261003120380);
-- cms_session_scope_ok is the single-row oracle they must agree with (proved in
-- phase_02_slice_09_sec2_definer_rls.sql).
-- ------------------------------------------------------------ structure ----
select ok(
  to_regprocedure('platform_private.cms_session_scope_ok(uuid, uuid)') is not null
  and to_regprocedure('platform_private.cms_session_scope_ok_report(uuid)') is not null
  and to_regprocedure('platform_private.identity_session_scope_ok(uuid)') is not null
  and to_regprocedure('platform_private.cms_publish_session(uuid, uuid)') is not null,
  'the session-resolving scope helpers and the session publisher exist, schema-qualified [P2-S09-AC-181]');
select is((select string_agg(p.proname, ',' order by p.proname)
             from pg_proc p
            where p.pronamespace = 'platform_private'::regnamespace
              and p.proname in ('cms_session_scope_ok', 'cms_session_scope_ok_report', 'identity_session_scope_ok')
              and not (p.prosecdef and p.proconfig @> array['search_path=""'] and p.provolatile = 's')), null,
  'every scope helper is SECURITY DEFINER with a pinned empty search_path and STABLE volatility [P2-S09-AC-181]');
select is((select string_agg(p.proname, ',' order by p.proname)
             from pg_proc p
            where p.pronamespace = 'platform_private'::regnamespace
              and p.proname in ('cms_session_scope_ok', 'cms_session_scope_ok_report', 'identity_session_scope_ok', 'cms_publish_session')
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
                   or has_function_privilege('service_role', p.oid, 'execute'))), null,
  'no API role may execute a scope helper or the session publisher [P2-S09-AC-181]');

create temp table r3rls_tables(schema_name text, table_name text) on commit drop;
insert into r3rls_tables values
  ('platform_private', 'cms_schema_reviews'), ('platform_private', 'cms_schema_review_decisions'),
  ('platform_private', 'cms_schema_review_assignments'), ('platform_private', 'cms_schema_dry_run_reports'),
  ('platform_private', 'cms_schema_dry_run_row_evidence'), ('platform_private', 'cms_schema_migration_target_rows'),
  ('platform_private', 'cms_schema_migration_plans'), ('platform_private', 'cms_workflow_policies'),
  ('platform_private', 'cms_schema_transform_registry'), ('platform_private', 'cms_capability_grants'),
  ('platform_private', 'cms_capability_grant_events'), ('identity', 'mfa_factor_registry'),
  ('identity', 'step_up_challenges'), ('identity', 'mfa_verification_lockouts'),
  ('identity', 'in_app_notification_intents');

select is((select string_agg(t.table_name, ',' order by t.table_name)
             from r3rls_tables t
            where t.schema_name = 'platform_private'
              and not exists (
                select 1 from pg_policies p
                 where p.schemaname = t.schema_name and p.tablename = t.table_name
                   and p.permissive = 'RESTRICTIVE' and p.cmd in ('ALL', 'INSERT')
                   and coalesce(p.with_check, '') ~ 'cms_session_(owner_scope|reviewer_scope|report_scope|scope_ok)')), null,
  'every new private CMS table carries a RESTRICTIVE policy whose WITH CHECK re-resolves the session scope on INSERT [P2-S09-AC-181]');
select is((select string_agg(t.table_name, ',' order by t.table_name)
             from r3rls_tables t
            where t.schema_name = 'platform_private'
              and t.table_name not in ('cms_workflow_policies', 'cms_schema_transform_registry')
              and not exists (
                select 1 from pg_policies p
                 where p.schemaname = t.schema_name and p.tablename = t.table_name
                   and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
                   and coalesce(p.qual, '') ~ 'cms_session_(owner_scope|reviewer_scope|report_scope|scope_ok)' and coalesce(p.with_check, '') ~ 'cms_session_(owner_scope|reviewer_scope|report_scope|scope_ok)')), null,
  'every scoped CMS table re-resolves the session scope on read (USING) and on every write (WITH CHECK) [P2-S09-AC-181]');
select is((select string_agg(t.table_name || ':' || c.cmd, ',' order by t.table_name, c.cmd)
             from r3rls_tables t
            cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
            where t.schema_name = 'identity' and t.table_name <> 'in_app_notification_intents'
              and not exists (
                select 1 from pg_policies p
                 where p.schemaname = t.schema_name and p.tablename = t.table_name and p.cmd = c.cmd
                   and coalesce(p.qual, '') || coalesce(p.with_check, '') ~ 'identity_session_scope_ok')), null,
  'every identity MFA table re-resolves the published subject on INSERT, UPDATE and DELETE [P2-S09-AC-181]');
select is((select count(*)::integer from pg_policies p
            where p.schemaname = 'identity' and p.tablename = 'in_app_notification_intents' and p.cmd = 'INSERT'
              and coalesce(p.with_check, '') ~ 'cms_session_scope_ok_system'), 1,
  'notification intents are written only under the system scope [P2-S09-AC-181]');
select is((select string_agg(t.table_name, ',' order by t.table_name)
             from r3rls_tables t
            where t.schema_name = 'platform_private'
              and t.table_name not in ('cms_workflow_policies', 'cms_schema_transform_registry')
              and not exists (
                select 1 from pg_policies p
                 where p.schemaname = t.schema_name and p.tablename = t.table_name
                   and p.permissive = 'PERMISSIVE' and p.qual = 'platform_private.cms_rpc_context_valid()'
                   and p.with_check = 'platform_private.cms_rpc_context_valid()')), null,
  'the RPC context gate is still present on every scoped CMS table: the session policy is in addition to it, never instead [P2-S09-AC-181]');
select ok(not exists (
  select 1 from r3rls_tables t join pg_class c on c.oid = to_regclass(t.schema_name || '.' || t.table_name)
   where not (c.relrowsecurity and c.relforcerowsecurity)),
  'RLS stays enabled and forced on every one of them [P2-S09-AC-181]');
select is((select string_agg(t.table_name, ',' order by t.table_name)
             from r3rls_tables t join pg_class c on c.oid = to_regclass(t.schema_name || '.' || t.table_name)
            where exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
                          cross join unnest(array['INSERT', 'UPDATE', 'DELETE']) p(privilege)
                          where has_table_privilege(r.role_name, c.oid, p.privilege))), null,
  'no API role holds a direct write privilege on any of them: the policies are defense in depth behind the revoked grants [P2-S09-AC-181]');

-- --------------------------------------------------------------- fixtures ----
select pg_temp.s09d_create_type('x', 'r3rls_x');
select pg_temp.s09d_to_review('x');
select pg_temp.s09d_assign('x', 'rev1');
select pg_temp.s09d_get_review('x:read', 'x', 'owner');
select is(pg_temp.s09d_outcome('x:read'), 'OK', 'fixture: the owner reads the frozen review through CMS-03A-13');

create temp table r3rls_ctx on commit drop as
select pg_temp.s09d_id('ownerOrg') as owner_org,
       pg_temp.s09d_id('otherOrg') as other_org,
       pg_temp.s09d_id('x:review') as review_id,
       pg_temp.s09d_id('x:assignment:rev1') as assignment_id,
       pg_temp.s09d_actor_id('owner', 'auth')::uuid as owner_auth,
       pg_temp.s09d_actor_id('rev1', 'auth')::uuid as rev1_auth,
       pg_temp.s09d_actor_id('rev1', 'person')::uuid as rev1_person,
       pg_temp.s09d_actor_id('rev2', 'person')::uuid as rev2_person,
       pg_temp.s09d_actor_id('other', 'auth')::uuid as other_auth,
       pg_temp.s09d_actor_id('other', 'person')::uuid as other_person,
       pg_temp.s09d_actor_id('owner', 'person')::uuid as owner_person;
select ok((select owner_org is not null and other_org is not null and other_org <> owner_org and review_id is not null from r3rls_ctx),
  'fixture: two distinct organizations and a frozen review exist');

-- A non-bypass probe role: the platform `postgres` role is BYPASSRLS, so only a
-- role without that attribute actually evaluates the policies.
create role s09_rls_probe nologin nobypassrls;
grant s09_rls_probe to postgres with set true;
grant usage, create on schema platform_private to s09_rls_probe;
grant usage on schema identity, extensions to s09_rls_probe;
grant select, insert, update, delete on all tables in schema platform_private to s09_rls_probe;
grant select, insert, update, delete on identity.mfa_factor_registry, identity.step_up_challenges,
  identity.mfa_verification_lockouts, identity.in_app_notification_intents to s09_rls_probe;
grant execute on all functions in schema platform_private to s09_rls_probe;
select is((select rolbypassrls from pg_roles where rolname = 's09_rls_probe'), false, 'fixture: the probe role does not bypass RLS');

-- Forged definer context: the function sets only the RPC flag itself (the gate a
-- definer context can always satisfy) and then writes.  Owned by the probe role.
create function platform_private.s09_forged_assignment(p_owner uuid, p_review uuid, p_person uuid, p_grantor uuid)
returns integer language plpgsql security definer set search_path = '' as $body$
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- NEGATIVE CONTROL: a hand-written review/decision/dry-run/plan row or state change: never a producer path, only proof that the guard sees and refuses it.
  insert into platform_private.cms_schema_review_assignments(
    owner_id, review_id, reviewer_person_ref, grantor_person_ref, capability_key, actions, state,
    starts_at, ends_at, reason)
  values (p_owner, p_review, p_person, p_grantor, 'cms.schema_review', array['read', 'decide'], 'active',
          pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp() + interval '1 hour', 'forged');
  return 1;
end;
$body$;
alter function platform_private.s09_forged_assignment(uuid, uuid, uuid, uuid) owner to s09_rls_probe;
create function platform_private.s09_forged_review_touch(p_review uuid)
returns integer language plpgsql security definer set search_path = '' as $body$
declare touched integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- NEGATIVE CONTROL: a hand-written review/decision/dry-run/plan row or state change: never a producer path, only proof that the guard sees and refuses it.
  update platform_private.cms_schema_reviews set updated_at = updated_at where id = p_review;
  get diagnostics touched = row_count;
  return touched;
end;
$body$;
alter function platform_private.s09_forged_review_touch(uuid) owner to s09_rls_probe;
create function platform_private.s09_forged_factor(p_user uuid)
returns integer language plpgsql security definer set search_path = '' as $body$
begin
  -- NEGATIVE CONTROL: a forged definer writes an MFA factor row directly; the session-scope policy must refuse it, no factor is claimed.
  insert into identity.mfa_factor_registry(auth_user_id, provider_factor_id, friendly_name, state, pending_expires_at)
  values (p_user, extensions.gen_random_uuid(), 'forged-' || substr(p_user::text, 1, 8), 'pending',
          pg_catalog.clock_timestamp() + interval '5 minutes');
  return 1;
end;
$body$;
alter function platform_private.s09_forged_factor(uuid) owner to s09_rls_probe;
grant execute on function platform_private.s09_forged_assignment(uuid, uuid, uuid, uuid),
  platform_private.s09_forged_review_touch(uuid), platform_private.s09_forged_factor(uuid) to s09_rls_probe;

create or replace function pg_temp.r3rls_as_probe(p_sql text) returns integer language plpgsql as $body$
declare result integer;
begin
  set local role s09_rls_probe;
  execute p_sql into result;
  reset role;
  return result;
exception when others then
  reset role;
  raise;
end;
$body$;
create or replace function pg_temp.r3rls_clear() returns void language sql as $body$
  select set_config('app.cms_rpc', '', true), set_config('app.cms_session_actor', '', true),
         set_config('app.cms_session_party', '', true), pg_temp.set_jwt_claim('role', '', true),
         set_config('app.mfa_session_subject', '', true)
$body$;

-- ----------------------------------------- producers publish the session ----
select is(current_setting('app.cms_session_actor', true), (select owner_auth::text from r3rls_ctx),
  'the CMS producer published the verified actor after resolving it [P2-S09-AC-181]');
select is(current_setting('app.cms_session_party', true), (select owner_org::text from r3rls_ctx),
  'and the acting party [P2-S09-AC-181]');
select ok(platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), null)
  and not platform_private.cms_session_scope_ok((select other_org from r3rls_ctx), null),
  'with that session the helper admits the owner organization and refuses another organization [P2-S09-AC-181]');

-- ------------------------------------------ a session without scope: denied --
select pg_temp.r3rls_clear();
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), null)
  and not platform_private.cms_session_scope_ok_report(gen_random_uuid()),
  'with no published session the helper admits nothing [P2-S09-AC-181]');
select pg_temp.set_jwt_claim('role', 'service_role', true);
select ok(platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), null)
  and platform_private.cms_session_scope_ok_report(gen_random_uuid())
  and platform_private.identity_session_scope_ok((select rev1_auth from r3rls_ctx)),
  'the verified service-role JWT with no human session is the system scope (worker commands, sweeps, notification intents) [P2-S09-AC-181]');
select platform_private.cms_publish_session((select other_auth from r3rls_ctx), (select other_org from r3rls_ctx));
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), null)
  and platform_private.cms_session_scope_ok((select other_org from r3rls_ctx), null) is not null,
  'a published human session takes precedence over the service role: it is held to its own scope [P2-S09-AC-181]');
select pg_temp.r3rls_clear();
select is((select count(*)::integer from platform_private.cms_schema_reviews), 1, 'control: as the platform owner the review is visible');
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_reviews'), 0,
  'a non-bypass role that sets the RPC flag but has no session scope reads no review [P2-S09-AC-181]');
select is(pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_review_assignments'), 0,
  'and reads no assignment [P2-S09-AC-181]');
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 0,
  'a definer context that sets the RPC flag itself updates no review row without session scope [P2-S09-AC-181]');
select pg_temp.r3rls_clear();
-- The owner-consistency guard (a definer function of the NOLOGIN definer role) now reads the review
-- through the same policies, so for a session without scope it would refuse the row (CONFLICT) before
-- the policy's WITH CHECK is reached; it is switched off for these statements so the policy itself is proved.
alter table platform_private.cms_schema_review_assignments disable trigger cms_schema_review_assignments_z_state_guard;
select throws_ok(format($q$select platform_private.s09_forged_assignment(%L, %L, %L, %L)$q$,
    (select owner_org from r3rls_ctx), (select review_id from r3rls_ctx), (select rev1_person from r3rls_ctx), (select owner_person from r3rls_ctx)),
  '42501', 'new row violates row-level security policy "cms_schema_review_assignments_session_scope" for table "cms_schema_review_assignments"', 'a definer context with the RPC flag but no session scope: WITH CHECK refuses the assignment insert [P2-S09-AC-181]');
select throws_ok(format($q$select platform_private.s09_forged_factor(%L)$q$, (select rev1_auth from r3rls_ctx)),
  '42501', 'new row violates row-level security policy for table "mfa_factor_registry"', 'a definer context with no MFA subject: WITH CHECK refuses an MFA factor insert [P2-S09-AC-181]');

-- ----------------------------------- a session scoped to another organization --
select platform_private.cms_publish_session((select other_auth from r3rls_ctx), (select other_org from r3rls_ctx));
select throws_ok(format($q$select platform_private.s09_forged_assignment(%L, %L, %L, %L)$q$,
    (select owner_org from r3rls_ctx), (select review_id from r3rls_ctx), (select rev1_person from r3rls_ctx), (select owner_person from r3rls_ctx)),
  '42501', 'new row violates row-level security policy "cms_schema_review_assignments_session_scope" for table "cms_schema_review_assignments"', 'a session scoped to another organization cannot write an out-of-scope assignment even inside a definer context [P2-S09-AC-181]');
alter table platform_private.cms_schema_review_assignments enable trigger cms_schema_review_assignments_z_state_guard;
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 0,
  'and cannot touch the owner organization''s review [P2-S09-AC-181]');
select pg_temp.r3rls_clear();
select pg_temp.s09d_session('owner');

-- -------------------------------------- the producers still work in scope ----
select platform_private.cms_publish_session((select owner_auth from r3rls_ctx), (select owner_org from r3rls_ctx));
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 1,
  'positive control: with the owner session the same definer context reaches the owner organization''s review row [P2-S09-AC-181]');
select lives_ok(format($q$select platform_private.s09_forged_assignment(%L, %L, %L, %L)$q$,
    (select owner_org from r3rls_ctx), (select review_id from r3rls_ctx), (select rev1_person from r3rls_ctx), (select owner_person from r3rls_ctx)),
  'positive control: an in-scope assignment insert passes WITH CHECK [P2-S09-AC-181]');
-- The BEFORE INSERT owner-consistency guard (20261002198000) would refuse this
-- row first; it is disabled for the next statement so the policy's own WITH
-- CHECK is what is proved here.  The guard itself is proved in
-- phase_02_slice_09_r8_review_owner_consistency.sql.
alter table platform_private.cms_schema_review_assignments disable trigger cms_schema_review_assignments_z_state_guard;
select throws_ok(format($q$select platform_private.s09_forged_assignment(%L, %L, %L, %L)$q$,
    (select other_org from r3rls_ctx), (select review_id from r3rls_ctx), (select rev1_person from r3rls_ctx), (select owner_person from r3rls_ctx)),
  '42501', 'new row violates row-level security policy "cms_schema_review_assignments_session_scope" for table "cms_schema_review_assignments"', 'with the owner session, an assignment stamped with another organization''s owner_id is refused by WITH CHECK [P2-S09-AC-181]');
alter table platform_private.cms_schema_review_assignments enable trigger cms_schema_review_assignments_z_state_guard;

-- an assigned reviewer's review-only scope reaches only that review
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select rev1_auth from r3rls_ctx), (select rev1_person from r3rls_ctx));
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 1,
  'an assigned reviewer''s session reaches the review it is assigned to [P2-S09-AC-181]');
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select other_auth from r3rls_ctx), (select other_person from r3rls_ctx));
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 0,
  'an unassigned person''s session does not [P2-S09-AC-181]');

-- ------------------------------------------------------------------ identity --
select pg_temp.r3rls_clear();
select platform_private.mfa_lock_binding((select rev1_auth from r3rls_ctx), false);
select is(current_setting('app.mfa_session_subject', true), (select rev1_auth::text from r3rls_ctx),
  'the MFA producers publish the verified subject when they resolve the account binding [P2-S09-AC-181]');
select lives_ok(format($q$select platform_private.s09_forged_factor(%L)$q$, (select rev1_auth from r3rls_ctx)),
  'positive control: a factor row for the published subject passes WITH CHECK [P2-S09-AC-181]');
select throws_ok(format($q$select platform_private.s09_forged_factor(%L)$q$, (select other_auth from r3rls_ctx)),
  '42501', 'new row violates row-level security policy for table "mfa_factor_registry"', 'a factor row for a different account than the published subject is refused by WITH CHECK [P2-S09-AC-181]');
select pg_temp.r3rls_clear();

-- ------------------------------------ reviewer authority lifecycle (AC181) ----
-- The reviewer branch of the scope helper must demand the EFFECTIVE assignment
-- (state active, starts_at <= now < ends_at) on a review of the same owner, in
-- the policy USING (reads, update targets) and WITH CHECK (every write).  A
-- revoked, expired or future assignment, and an assignment stamped with another
-- organization's owner_id, grant no scope.  The assignments are real CMS-03A-14
-- rows; only their stored instants/state are warped afterwards on real rows.
create function platform_private.s09_forged_decision(p_owner uuid, p_review uuid, p_assignment uuid, p_person uuid)
returns integer language plpgsql security definer set search_path = '' as $body$
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- NEGATIVE CONTROL: a hand-written review/decision/dry-run/plan row or state change: never a producer path, only proof that the guard sees and refuses it.
  insert into platform_private.cms_schema_review_decisions(
    owner_id, review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash,
    capability_key, capability_version, decision, reviewed_hash, mfa_verified_at)
  values (p_owner, p_review, p_assignment, 1, p_person, pg_catalog.repeat('a', 64),
          'cms.schema_review', 1, 'approve', pg_catalog.repeat('b', 64), pg_catalog.clock_timestamp());
  return 1;
end;
$body$;
alter function platform_private.s09_forged_decision(uuid, uuid, uuid, uuid) owner to s09_rls_probe;
grant execute on function platform_private.s09_forged_decision(uuid, uuid, uuid, uuid) to s09_rls_probe;

select pg_temp.s09d_assign('x', 'rev2');
select pg_temp.s09d_assign('x', 'rev3');
select pg_temp.s09d_assign('x', 'designer2');
select pg_temp.s09d_assign('x', 'other');
select pg_temp.r3rls_clear();
select ok((select count(*) = 4 from platform_private.cms_schema_review_assignments assignment
            where assignment.review_id = (select review_id from r3rls_ctx)
              and assignment.reviewer_person_ref in (
                (select pg_temp.s09d_actor_id('rev2', 'person')::uuid), (select pg_temp.s09d_actor_id('rev3', 'person')::uuid),
                (select pg_temp.s09d_actor_id('designer2', 'person')::uuid), (select pg_temp.s09d_actor_id('other', 'person')::uuid))),
  'fixture: the producer assigned four more reviewers to the frozen review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');

create temp table r3rls_results(k text primary key, v text) on commit drop;
create temp table r3rls_life(label text primary key, auth uuid, person uuid, assignment_id uuid) on commit drop;
insert into r3rls_life
select k.label, pg_temp.s09d_actor_id(k.actor, 'auth')::uuid, pg_temp.s09d_actor_id(k.actor, 'person')::uuid,
       pg_temp.s09d_id('x:assignment:' || k.actor)
  from (values ('revoked', 'rev2'), ('expired', 'rev3'), ('future', 'designer2'), ('cross-owner', 'other')) k(label, actor);

select ok(pg_temp.s09d_timewarp('cms_schema_review_assignments', format(
  $q$update platform_private.cms_schema_review_assignments set state = 'revoked' where id = %L$q$,
  (select assignment_id from r3rls_life where label = 'revoked'))),
  'fixture: one real assignment is revoked [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select ok(pg_temp.s09d_timewarp('cms_schema_review_assignments', format(
  $q$update platform_private.cms_schema_review_assignments
        set starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 hour'
      where id = %L$q$, (select assignment_id from r3rls_life where label = 'expired'))),
  'fixture: one real assignment has expired [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select ok(pg_temp.s09d_timewarp('cms_schema_review_assignments', format(
  $q$update platform_private.cms_schema_review_assignments
        set starts_at = clock_timestamp() + interval '1 hour', ends_at = clock_timestamp() + interval '2 hours'
      where id = %L$q$, (select assignment_id from r3rls_life where label = 'future'))),
  'fixture: one real assignment starts in the future [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select ok(pg_temp.s09d_timewarp('cms_schema_review_assignments', format(
  $q$update platform_private.cms_schema_review_assignments set owner_id = %L where id = %L$q$,
  (select other_org from r3rls_ctx), (select assignment_id from r3rls_life where label = 'cross-owner'))),
  'fixture: one real assignment is stamped with another organization''s owner_id [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');

-- the helper itself: only the effective, owner-consistent assignment grants scope
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select auth from r3rls_life where label = 'revoked'), (select person from r3rls_life where label = 'revoked'));
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), (select review_id from r3rls_ctx)),
  'a revoked assignment grants no scope [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select auth from r3rls_life where label = 'expired'), (select person from r3rls_life where label = 'expired'));
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), (select review_id from r3rls_ctx)),
  'an expired assignment grants no scope [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select auth from r3rls_life where label = 'future'), (select person from r3rls_life where label = 'future'));
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), (select review_id from r3rls_ctx)),
  'a not-yet-started assignment grants no scope [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select auth from r3rls_life where label = 'cross-owner'), (select person from r3rls_life where label = 'cross-owner'));
select ok(not platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), (select review_id from r3rls_ctx))
  and not platform_private.cms_session_scope_ok((select other_org from r3rls_ctx), (select review_id from r3rls_ctx)),
  'an assignment whose owner differs from the review''s owner grants no scope for either owner [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select rev1_auth from r3rls_ctx), (select rev1_person from r3rls_ctx));
select ok(platform_private.cms_session_scope_ok((select owner_org from r3rls_ctx), (select review_id from r3rls_ctx))
  and not platform_private.cms_session_scope_ok((select other_org from r3rls_ctx), (select review_id from r3rls_ctx)),
  'positive control: the effective, owner-consistent assignment grants the review''s owner scope and no other owner''s [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');

-- USING: reads and update targets
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select rev1_auth from r3rls_ctx), (select rev1_person from r3rls_ctx));
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_reviews'), 1,
  'positive control (USING): the effective reviewer reads the review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is(pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_review_assignments'),
  (select count(*)::integer from platform_private.cms_schema_review_assignments assignment
    where assignment.review_id = (select review_id from r3rls_ctx) and assignment.owner_id = (select owner_org from r3rls_ctx)),
  'and exactly the owner-consistent assignments of that review, never the cross-owner row [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select ok((select count(*) from platform_private.cms_schema_review_assignments assignment
            where assignment.review_id = (select review_id from r3rls_ctx) and assignment.owner_id <> (select owner_org from r3rls_ctx)) = 1,
  'fixture: exactly one cross-owner assignment row exists to be hidden [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is(platform_private.s09_forged_review_touch((select review_id from r3rls_ctx)), 1,
  'and updates the review it is assigned to [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
-- The owner-consistency guard (a definer function of the NOLOGIN definer role) now reads the review
-- through the same policies, so for a session without scope it would refuse the row (CONFLICT) before
-- the policy's WITH CHECK is reached; it is switched off for these statements so the policy itself is proved.
alter table platform_private.cms_schema_review_assignments disable trigger cms_schema_review_assignments_z_state_guard;
do $body$
declare
  life record;
  review uuid := (select review_id from r3rls_ctx);
  owner_org uuid := (select r.owner_org from r3rls_ctx r);
  reviews integer;
  assignments integer;
  touched integer;
  verdict text;
begin
  for life in select * from r3rls_life order by label loop
    perform pg_temp.r3rls_clear();
    perform platform_private.cms_publish_session(life.auth, life.person);
    perform pg_catalog.set_config('app.cms_rpc', 'true', true);
    reviews := pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_reviews');
    assignments := pg_temp.r3rls_as_probe('select count(*)::integer from platform_private.cms_schema_review_assignments');
    touched := platform_private.s09_forged_review_touch(review);
    insert into r3rls_results values ('using:' || life.label, reviews::text || '/' || assignments::text || '/' || touched::text);
    begin
      perform platform_private.s09_forged_assignment(owner_org, review, life.person, life.person);
      verdict := 'accepted';
    exception when others then
      verdict := sqlstate || ' ' || sqlerrm;
    end;
    insert into r3rls_results values ('check-assignment:' || life.label, verdict);
    begin
      perform platform_private.s09_forged_decision(owner_org, review, life.assignment_id, life.person);
      verdict := 'accepted';
    exception when others then
      verdict := sqlstate || ' ' || sqlerrm;
    end;
    insert into r3rls_results values ('check-decision:' || life.label, verdict);
  end loop;
  perform pg_temp.r3rls_clear();
end;
$body$;

-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_schema_review_assignments enable trigger cms_schema_review_assignments_z_state_guard;
select is((select v from r3rls_results where k = 'using:revoked'), '0/0/0',
  'USING: a revoked assignment reads no review, no assignment and updates no review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select v from r3rls_results where k = 'using:expired'), '0/0/0',
  'USING: an expired assignment reads no review, no assignment and updates no review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select v from r3rls_results where k = 'using:future'), '0/0/0',
  'USING: a future assignment reads no review, no assignment and updates no review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select v from r3rls_results where k = 'using:cross-owner'), '0/0/0',
  'USING: a cross-owner assignment reads no review, no assignment and updates no review [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select string_agg(k || '=' || v, '; ' order by k) from r3rls_results
            where k like 'check-assignment:%' and v !~ '^42501 new row violates row-level security policy "cms_schema_review_assignments_session_scope"'),
  null,
  'WITH CHECK: a revoked, expired, future or cross-owner assignment cannot write an assignment row [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select string_agg(k || '=' || v, '; ' order by k) from r3rls_results
            where k like 'check-decision:%' and v !~ '^(42501 new row violates row-level security policy "cms_schema_review_decisions_session_scope"|P0001 CONFLICT)'),
  null,
  'a revoked, expired, future or cross-owner assignment cannot write a decision row (the policy refuses it, or the append guard, which reads the review as the same restricted role, no longer sees it) [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select is((select count(*)::integer from platform_private.cms_schema_review_decisions decision
            where decision.reviewer_person_ref in (select person from r3rls_life)), 0,
  'and no decision row was written for any of them [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');

-- WITH CHECK owner consistency: an effective reviewer cannot stamp another owner
select pg_temp.r3rls_clear();
select platform_private.cms_publish_session((select rev1_auth from r3rls_ctx), (select rev1_person from r3rls_ctx));
-- The owner-consistency guard is isolated off for this one statement (see above).
alter table platform_private.cms_schema_review_assignments disable trigger cms_schema_review_assignments_z_state_guard;
select throws_ok(format($q$select platform_private.s09_forged_assignment(%L, %L, %L, %L)$q$,
    (select other_org from r3rls_ctx), (select review_id from r3rls_ctx), (select rev1_person from r3rls_ctx), (select rev1_person from r3rls_ctx)),
  '42501', 'new row violates row-level security policy "cms_schema_review_assignments_session_scope" for table "cms_schema_review_assignments"',
  'WITH CHECK: an effective reviewer of the owner''s review cannot write a row stamped with another organization''s owner_id [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
alter table platform_private.cms_schema_review_assignments enable trigger cms_schema_review_assignments_z_state_guard;
-- positive control through the real producer: the effective reviewer's decision
-- passes the policies' WITH CHECK (CMS-03A-12).
select pg_temp.s09d_decide('x', 'rev1');
select is(pg_temp.s09d_outcome('x:decide:rev1'), 'OK',
  'positive control (WITH CHECK): the effective, owner-consistent reviewer decides through CMS-03A-12 [P2-S09-AC-181] [P2-S09-AC-414] [P2-S09-AC-416]');
select pg_temp.r3rls_clear();


-- ------------------------------------------- every writer is covered, exactly --
-- A function that writes one of these tables either publishes the verified
-- session itself (cms_acting_party / cms_publish_session / mfa_lock_binding) or
-- is in the exact list below: service-role system paths with no human session,
-- and two internal steps only ever called inside an already published session.
-- A new writer fails this assertion until it is reviewed and listed.
select is((
  select string_agg(distinct p.proname, ',' order by p.proname)
    from pg_proc p
    join r3rls_tables t
      on p.prosrc ~* ('(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+(platform_private\.|identity\.)?' || t.table_name || '\y')
   where p.pronamespace::regnamespace::text in ('platform_private', 'platform_api', 'identity')
     and p.proname not like 's09\_forged\_%'
     and p.prosrc !~ 'cms_acting_party|cms_publish_session|mfa_lock_binding'),
  'admin_mfa_factor_reset_settle,auth_mfa_registry_sweep,cms_advance_activation_plan,cms_begin_schema_migration_verification,cms_capability_grant_record_event,cms_claim_schema_migration_lease,cms_complete_schema_migration,cms_finalize_schema_migration_dry_run,cms_heartbeat_schema_migration_lease,cms_invalidate_activation_reviews,cms_process_schema_migration_batch,cms_rollback_schema_migration,in_app_notification_record,rpc_admin_reset_mfa_factors',
  'every other function that writes a scoped table publishes the session itself; the unpublished writers are exactly the reviewed system paths and internal steps [P2-S09-AC-181]');

select * from finish();
rollback;
