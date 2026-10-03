-- BE03a "Database invariants and grants" / AC181: RLS policies that call a
-- schema-qualified helper which RESOLVES THE VERIFIED SESSION and acting
-- context, with WITH CHECK re-resolving the same scope on every write, in
-- addition to the transaction-local RPC gate (defense in depth; the tables keep
-- no table grants).
--
-- Session publication.  A producer publishes the verified session after its own
-- checks, in transaction-local settings: cms_acting_party() publishes the
-- resolved actor and acting party (every CMS RPC resolves them through it) and
-- mfa_lock_binding() publishes the MFA subject (every MFA RPC resolves the
-- account binding through it).  Service paths with no human session (migration
-- worker commands, sweeps, trigger-driven invalidation, notification intents,
-- the admin MFA reset settlement) are identified by the verified service-role
-- JWT role (`request.jwt.claim.role` = service_role, the repo's session role setting)
-- with NO human session published; a published human session always takes
-- precedence and is then held to its own scope.  (A custom function-level
-- setting cannot carry this: ALTER FUNCTION ... SET of an unregistered custom
-- parameter needs a superuser grant that migrations do not have.)
--
-- The helpers never trust the published ids: they re-resolve the person, the
-- confirmed membership, the live capability grant (or the owner-initialization
-- receipt) and the effective review assignment on every evaluation, so a forged
-- setting can reach no more than the scope of a real, currently authorized
-- principal.  The helpers are STABLE (they read the session and tables; the
-- spec word "immutable" describes the definition, which no caller may alter:
-- SECURITY DEFINER, pinned search_path, no API grant).
--
-- Policies are RESTRICTIVE on the CMS tables (ANDed with the existing RPC gate,
-- so the existing assertions about that gate stay true) and are the write
-- policies themselves on the identity tables, whose existing SELECT
-- self-read policies keep serving the owner-scoped views.
-- Forward-only.
begin;

create function platform_private.cms_session_uuid(p_name text)
returns uuid
language sql
stable
set search_path = ''
as $body$
  select case when raw.value ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then raw.value::uuid end
    from (select nullif(pg_catalog.current_setting(p_name, true), '') as value) raw
$body$;

create function platform_private.cms_publish_session(p_actor_id uuid, p_acting_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform pg_catalog.set_config('app.cms_session_actor', coalesce(p_actor_id::text, ''), true);
  perform pg_catalog.set_config('app.cms_session_party', coalesce(p_acting_party_id::text, ''), true);
end;
$body$;

create function platform_private.cms_session_system_scope()
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_session_uuid('app.cms_session_actor') is null
     and nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '')
         is not distinct from 'service_role'
$body$;

-- True when the published session is allowed to touch a row of `p_owner_id`:
-- the system scope, the owner organization's schema-design/registry scope
-- (a confirmed member holding cms.schema_designer or cms.schema_registry.read,
-- or the owner-initialization receipt holder), or, with `p_review_id`, a
-- person who holds an assignment on that frozen review.
create function platform_private.cms_session_scope_ok(p_owner_id uuid, p_review_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  actor uuid;
  party uuid;
  person uuid;
begin
  if platform_private.cms_session_system_scope() then
    return true;
  end if;
  actor := platform_private.cms_session_uuid('app.cms_session_actor');
  party := platform_private.cms_session_uuid('app.cms_session_party');
  if actor is null or party is null or p_owner_id is null then
    return false;
  end if;
  select person_row.party_id into person
    from platform_private.person_party person_row
   where person_row.auth_user_id = actor
     and person_row.account_state in (
       'claimed'::platform_private.person_account_state,
       'active'::platform_private.person_account_state);
  if person is null then
    return false;
  end if;
  if party = p_owner_id and (
       exists (
         select 1 from platform_private.cms_owner_initialization receipt
          where receipt.auth_user_id = actor and receipt.person_id = person
            and receipt.organization_id = party)
       or platform_private.cms_person_holds_capability(party, person, 'cms.schema_designer')
       or platform_private.cms_person_holds_capability(party, person, 'cms.schema_registry.read')
     ) then
    return true;
  end if;
  if p_review_id is not null and exists (
       select 1 from platform_private.cms_schema_review_assignments assignment
        where assignment.review_id = p_review_id
          and assignment.reviewer_person_ref = person) then
    return true;
  end if;
  return false;
end;
$body$;

-- Rows keyed by a dry-run report (the per-row evidence has no owner column):
-- the scope is the report's owner.
create function platform_private.cms_session_scope_ok_report(p_report_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  report_owner uuid;
begin
  if platform_private.cms_session_system_scope() then
    return true;
  end if;
  if p_report_id is null then
    return false;
  end if;
  select report.owner_id into report_owner
    from platform_private.cms_schema_dry_run_reports report
   where report.id = p_report_id;
  return platform_private.cms_session_scope_ok(report_owner, null);
end;
$body$;

-- Code-owned registries are written only by trusted release/service code.
create function platform_private.cms_session_scope_ok_system()
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_session_system_scope()
$body$;

-- Identity tables: the verified subject published by the MFA producers, with a
-- live eligible account binding; or the system scope.
create function platform_private.identity_session_scope_ok(p_auth_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  subject uuid;
begin
  if platform_private.cms_session_system_scope() then
    return true;
  end if;
  subject := platform_private.cms_session_uuid('app.mfa_session_subject');
  if subject is null or p_auth_user_id is null or subject <> p_auth_user_id then
    return false;
  end if;
  return exists (
    select 1 from identity.auth_user_bindings binding
     where binding.auth_user_id = subject
       and binding.state in ('claimed', 'active'));
end;
$body$;

revoke all on function
  platform_private.cms_session_uuid(text),
  platform_private.cms_publish_session(uuid, uuid),
  platform_private.cms_session_system_scope(),
  platform_private.cms_session_scope_ok(uuid, uuid),
  platform_private.cms_session_scope_ok_report(uuid),
  platform_private.cms_session_scope_ok_system(),
  platform_private.identity_session_scope_ok(uuid)
  from public, anon, authenticated, service_role;

-- ------------------------------------------------ session publication hooks --
create or replace function platform_private.cms_acting_party(p_request jsonb, p_actor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  resolved_party uuid;
begin
  resolved_party := platform_private.cfg_acting_party(p_request, p_actor_id);
  perform platform_private.cms_publish_session(p_actor_id, resolved_party);
  return resolved_party;
end;
$body$;

create or replace function platform_private.mfa_lock_binding(p_auth_user_id uuid, p_lock boolean default true)
returns identity.auth_user_bindings
language plpgsql
security definer
set search_path = ''
as $body$
declare
  binding identity.auth_user_bindings%rowtype;
begin
  if p_auth_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_lock then
    select * into binding from identity.auth_user_bindings
     where auth_user_id = p_auth_user_id for update;
  else
    select * into binding from identity.auth_user_bindings
     where auth_user_id = p_auth_user_id;
  end if;
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  if binding.state not in ('claimed', 'active') then
    raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.mfa_session_subject', p_auth_user_id::text, true);
  return binding;
end;
$body$;

-- ----------------------------------------------------------------- policies --
-- CMS tables: RESTRICTIVE, so they AND with the RPC context gate.
create policy cms_schema_reviews_session_scope on platform_private.cms_schema_reviews
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, id))
  with check (platform_private.cms_session_scope_ok(owner_id, id));
create policy cms_schema_review_decisions_session_scope on platform_private.cms_schema_review_decisions
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, review_id))
  with check (platform_private.cms_session_scope_ok(owner_id, review_id));
create policy cms_schema_review_assignments_session_scope on platform_private.cms_schema_review_assignments
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, review_id))
  with check (platform_private.cms_session_scope_ok(owner_id, review_id));
create policy cms_schema_dry_run_reports_session_scope on platform_private.cms_schema_dry_run_reports
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, null))
  with check (platform_private.cms_session_scope_ok(owner_id, null));
create policy cms_schema_dry_run_row_evidence_session_scope on platform_private.cms_schema_dry_run_row_evidence
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok_report(report_id))
  with check (platform_private.cms_session_scope_ok_report(report_id));
create policy cms_schema_migration_target_rows_session_scope on platform_private.cms_schema_migration_target_rows
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, null))
  with check (platform_private.cms_session_scope_ok(owner_id, null));
create policy cms_schema_migration_plans_session_scope on platform_private.cms_schema_migration_plans
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, null))
  with check (platform_private.cms_session_scope_ok(owner_id, null));
create policy cms_capability_grants_session_scope on platform_private.cms_capability_grants
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, null))
  with check (platform_private.cms_session_scope_ok(owner_id, null));
create policy cms_capability_grant_events_session_scope on platform_private.cms_capability_grant_events
  as restrictive for all to public
  using (platform_private.cms_session_scope_ok(owner_id, null))
  with check (platform_private.cms_session_scope_ok(owner_id, null));

-- Code-owned registries stay publicly readable; their writes (the seed and any
-- change) are system-only.
create policy cms_workflow_policies_session_scope_insert on platform_private.cms_workflow_policies
  as restrictive for insert to public with check (platform_private.cms_session_scope_ok_system());
create policy cms_workflow_policies_session_scope_update on platform_private.cms_workflow_policies
  as restrictive for update to public
  using (platform_private.cms_session_scope_ok_system())
  with check (platform_private.cms_session_scope_ok_system());
create policy cms_workflow_policies_session_scope_delete on platform_private.cms_workflow_policies
  as restrictive for delete to public using (platform_private.cms_session_scope_ok_system());
create policy cms_schema_transform_registry_session_scope_insert on platform_private.cms_schema_transform_registry
  as restrictive for insert to public with check (platform_private.cms_session_scope_ok_system());
create policy cms_schema_transform_registry_session_scope_update on platform_private.cms_schema_transform_registry
  as restrictive for update to public
  using (platform_private.cms_session_scope_ok_system())
  with check (platform_private.cms_session_scope_ok_system());
create policy cms_schema_transform_registry_session_scope_delete on platform_private.cms_schema_transform_registry
  as restrictive for delete to public using (platform_private.cms_session_scope_ok_system());

-- Identity tables: the existing SELECT self-read policies stay; the write
-- policies re-resolve the published MFA subject (or the system scope).
create policy mfa_factor_registry_session_scope_insert on identity.mfa_factor_registry
  for insert to public with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_factor_registry_session_scope_update on identity.mfa_factor_registry
  for update to public
  using (platform_private.identity_session_scope_ok(auth_user_id))
  with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_factor_registry_session_scope_delete on identity.mfa_factor_registry
  for delete to public using (platform_private.identity_session_scope_ok(auth_user_id));
create policy step_up_challenges_session_scope_insert on identity.step_up_challenges
  for insert to public with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy step_up_challenges_session_scope_update on identity.step_up_challenges
  for update to public
  using (platform_private.identity_session_scope_ok(auth_user_id))
  with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy step_up_challenges_session_scope_delete on identity.step_up_challenges
  for delete to public using (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_verification_lockouts_session_scope_insert on identity.mfa_verification_lockouts
  for insert to public with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_verification_lockouts_session_scope_update on identity.mfa_verification_lockouts
  for update to public
  using (platform_private.identity_session_scope_ok(auth_user_id))
  with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_verification_lockouts_session_scope_delete on identity.mfa_verification_lockouts
  for delete to public using (platform_private.identity_session_scope_ok(auth_user_id));
create policy mfa_verification_lockouts_session_scope_select on identity.mfa_verification_lockouts
  for select to public using (platform_private.identity_session_scope_ok(auth_user_id));
create policy in_app_notification_intents_session_scope_insert on identity.in_app_notification_intents
  for insert to public with check (platform_private.cms_session_scope_ok_system());

commit;
