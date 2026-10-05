-- DEC-111 / BE01a "Index, RLS, and retention inventory" (P2-S09-AC-903): the MFA
-- factor registry and step-up challenge tables are readable by their own holder
-- only as a safe projection through security-invoker views.  Both tables keep
-- ENABLE+FORCE RLS and no table-level grant; the invoker view needs only
-- column-level SELECT on the safe columns, and one self-read policy
-- (auth_user_id = the JWT subject) scopes every row.  The provider factor id,
-- provider challenge id, session id and auth user id columns carry no grant, so
-- no select over them (or select *) succeeds for any API role.  Mutations stay
-- the named service-role platform_api RPCs; anon, service_role and every
-- operator or support role hold no privilege on either table.  Forward-only.
begin;

create policy mfa_factor_self_read on identity.mfa_factor_registry
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy step_up_challenge_self_read on identity.step_up_challenges
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create view api_identity.mfa_factor_self_v1
  with (security_invoker = true) as
  select id, method, friendly_name, state, pending_expires_at, verified_at,
         last_used_at, removed_at, version, created_at, updated_at
    from identity.mfa_factor_registry;
create view api_identity.step_up_challenge_self_v1
  with (security_invoker = true) as
  select id, factor_id, state, expires_at, failed_attempt_count,
         consumed_at, failed_at, version, created_at
    from identity.step_up_challenges;

revoke all on table api_identity.mfa_factor_self_v1,
  api_identity.step_up_challenge_self_v1
  from public, anon, authenticated, service_role;
grant usage on schema api_identity, identity to authenticated;
grant select on table api_identity.mfa_factor_self_v1,
  api_identity.step_up_challenge_self_v1 to authenticated;
grant select (id, method, friendly_name, state, pending_expires_at, verified_at,
  last_used_at, removed_at, version, created_at, updated_at)
  on identity.mfa_factor_registry to authenticated;
grant select (id, factor_id, state, expires_at, failed_attempt_count,
  consumed_at, failed_at, version, created_at)
  on identity.step_up_challenges to authenticated;

commit;
