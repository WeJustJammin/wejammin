-- SEC-2 (second sweep): the privileges, policies and function grants the 33
-- functions moved in 20261003150200 need once the BYPASSRLS owner is gone.
--
-- Derived from the function bodies, like 20261003120100 and 20261003120200:
-- schema usage, per-table verbs (a row lock needs a one-column UPDATE grant and
-- an UPDATE policy whose WITH CHECK is false, so it can lock but not change),
-- and EXECUTE on every function a body calls and every guard or default a
-- written table runs.  Every privilege has a permissive policy for the same verb
-- and the same role.  Where a verified scope exists the policy states it:
--   * the identity tables already carry session-scope policies for PUBLIC (the
--     system scope, or the verified subject with a live binding); the writes
--     added here (binding version, session rows, security events) use the same
--     helper, so a forged or foreign session is refused by row-level security;
--   * the administrative reset record (platform_private.admin_mfa_factor_resets)
--     is readable and writable under the system scope only: a service-role JWT
--     with no published CMS session, which is how the Worker calls it;
--   * the owner capability projection (identity_private.organization_actor_grant)
--     is writable only inside a CMS command (the RPC context gate).
-- The remaining tables belong to other slices, whose own gates stay in the
-- function bodies; they get a policy for the one NOLOGIN owner that mirrors the
-- grant verb for verb.  Forward-only.
begin;

-- ---------------------------------------------------------- wejammin_cms_definer
grant insert on table audit_private.audit_events, identity.auth_session_index, identity.security_events,
  identity_private.organization_actor_grant, platform_private.admin_mfa_factor_resets,
  platform_private.outbox_events to wejammin_cms_definer;
grant select on table platform_private.admin_capability_grants to wejammin_cms_definer;
grant update (mfa_version, updated_at) on table identity.auth_user_bindings to wejammin_cms_definer;
grant update (valid_from, valid_through, active, updated_at) on table identity_private.organization_actor_grant to wejammin_cms_definer;
-- row locks (SELECT ... FOR SHARE) on rows the reset only reads
grant update (id) on table platform_private.admin_capability_grants to wejammin_cms_definer;
grant update (party_id) on table platform_private.person_party to wejammin_cms_definer;

create policy admin_capability_grants_cms_definer_select on platform_private.admin_capability_grants
  for select to wejammin_cms_definer using (true);
create policy admin_capability_grants_cms_definer_lock on platform_private.admin_capability_grants
  for update to wejammin_cms_definer using (true) with check (false);
create policy person_party_cms_definer_lock on platform_private.person_party
  for update to wejammin_cms_definer using (true) with check (false);
create policy auth_user_bindings_cms_definer_mfa_version on identity.auth_user_bindings
  for update to wejammin_cms_definer
  using (platform_private.identity_session_scope_ok(auth_user_id))
  with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy auth_session_index_cms_definer_insert on identity.auth_session_index
  for insert to wejammin_cms_definer with check (platform_private.identity_session_scope_ok(auth_user_id));
create policy security_events_cms_definer_insert on identity.security_events
  for insert to wejammin_cms_definer with check (platform_private.identity_session_scope_ok(actor_auth_user_id));
create policy audit_events_cms_definer_insert on audit_private.audit_events
  for insert to wejammin_cms_definer with check (true);
create policy outbox_events_cms_definer_insert on platform_private.outbox_events
  for insert to wejammin_cms_definer with check (true);
create policy organization_actor_grant_cms_definer_project_insert on identity_private.organization_actor_grant
  for insert to wejammin_cms_definer with check (platform_private.cms_rpc_context_valid());
create policy organization_actor_grant_cms_definer_project_update on identity_private.organization_actor_grant
  for update to wejammin_cms_definer
  using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid());

-- the reset record: system scope only (replaces the blanket true policies of 20261003120200)
drop policy admin_mfa_factor_resets_cms_definer_select on platform_private.admin_mfa_factor_resets;
drop policy admin_mfa_factor_resets_cms_definer_update on platform_private.admin_mfa_factor_resets;
create policy admin_mfa_factor_resets_cms_definer_select on platform_private.admin_mfa_factor_resets
  for select to wejammin_cms_definer using (platform_private.cms_session_scope_ok_system());
create policy admin_mfa_factor_resets_cms_definer_insert on platform_private.admin_mfa_factor_resets
  for insert to wejammin_cms_definer with check (platform_private.cms_session_scope_ok_system());
create policy admin_mfa_factor_resets_cms_definer_update on platform_private.admin_mfa_factor_resets
  for update to wejammin_cms_definer
  using (platform_private.cms_session_scope_ok_system()) with check (platform_private.cms_session_scope_ok_system());

grant execute on function
  audit_private.guard_audit_events(),
  platform_private.admin_mfa_factor_reset_guard(),
  platform_private.admin_scope_valid(jsonb,uuid),
  platform_private.cfg_correlation(jsonb),
  platform_private.cfg_hash_text(text),
  platform_private.cfg_request_actor(jsonb,boolean),
  platform_private.cfg_require_fresh_step_up(jsonb,interval),
  platform_private.cfg_require_keys(jsonb,text[],text[]),
  platform_private.cfg_valid_uuid(text),
  platform_private.cms_grant_subject_eligible(uuid,uuid),
  platform_private.guard_outbox(),
  platform_private.identity_actor_person(uuid),
  platform_private.identity_idempotency_reserve(uuid,text,bytea,bytea),
  platform_private.valid_base_event_payload(text,integer,jsonb)
  to wejammin_cms_definer;

-- ------------------------------------------------ wejammin_cms_authority_reader
-- Read-only lookups: SELECT only, and the policies that admit the reader are SELECT-only.
grant select on table identity.security_events, platform_private.acting_context_binding,
  platform_private.cfg_release_principals to wejammin_cms_authority_reader;
create policy security_events_authority_reader_read on identity.security_events
  for select to wejammin_cms_authority_reader using (true);
create policy acting_context_binding_authority_reader_read on platform_private.acting_context_binding
  for select to wejammin_cms_authority_reader using (true);
create policy cfg_release_principals_authority_reader_read on platform_private.cfg_release_principals
  for select to wejammin_cms_authority_reader using (true);

grant execute on function
  identity_private.organization_public_resource(uuid),
  identity_private.organization_resource(uuid),
  identity_private.trusted_acting_party(uuid),
  platform_private.cfg_context_value(jsonb,text),
  platform_private.cms_capability_registry_valid(text,bigint),
  platform_private.cms_exact_keys(jsonb,text[],text[]),
  platform_private.cms_raise_forbidden(text),
  platform_private.cms_valid_uuid(text),
  platform_private.identity_actor_person(uuid),
  platform_private.identity_auth_user(),
  platform_private.request_jwt_claim(text)
  to wejammin_cms_authority_reader;

-- -------------------------------------------------------- wejammin_platform_definer
-- `profile` holds the enum types rpc_convert_claim compares against
grant usage on schema identity, platform_private, profile, profile_private to wejammin_platform_definer;
grant insert, select on table identity.auth_rate_limits, platform_private.consumer_dead_letters to wejammin_platform_definer;
grant update (request_count) on table identity.auth_rate_limits to wejammin_platform_definer;
grant select on table platform_private.cfg_setting_definition_versions, platform_private.cfg_setting_value_versions,
  profile_private.claim_proof_attempts, profile_private.ownership_contests to wejammin_platform_definer;
grant select, update (dispatch_lease_token, dispatch_lease_until, dispatch_attempt_count)
  on table platform_private.outbox_events to wejammin_platform_definer;
grant select, update (state, control_level, window_expires_at, version, updated_at)
  on table profile_private.claim_cases to wejammin_platform_definer;
grant insert, select on table profile_private.party_ownership_periods to wejammin_platform_definer;
grant update (id) on table profile_private.party_ownership_periods to wejammin_platform_definer;

create policy auth_rate_limits_platform_definer_select on identity.auth_rate_limits
  for select to wejammin_platform_definer using (true);
create policy auth_rate_limits_platform_definer_insert on identity.auth_rate_limits
  for insert to wejammin_platform_definer with check (true);
create policy auth_rate_limits_platform_definer_update on identity.auth_rate_limits
  for update to wejammin_platform_definer using (true) with check (true);
create policy consumer_dead_letters_platform_definer_select on platform_private.consumer_dead_letters
  for select to wejammin_platform_definer using (true);
create policy consumer_dead_letters_platform_definer_insert on platform_private.consumer_dead_letters
  for insert to wejammin_platform_definer with check (true);
create policy outbox_events_platform_definer_select on platform_private.outbox_events
  for select to wejammin_platform_definer using (true);
create policy outbox_events_platform_definer_update on platform_private.outbox_events
  for update to wejammin_platform_definer using (true) with check (true);
create policy cfg_setting_definition_versions_platform_definer_select on platform_private.cfg_setting_definition_versions
  for select to wejammin_platform_definer using (true);
create policy cfg_setting_value_versions_platform_definer_select on platform_private.cfg_setting_value_versions
  for select to wejammin_platform_definer using (true);
create policy claim_cases_platform_definer_select on profile_private.claim_cases
  for select to wejammin_platform_definer using (true);
create policy claim_cases_platform_definer_update on profile_private.claim_cases
  for update to wejammin_platform_definer using (true) with check (true);
create policy claim_proof_attempts_platform_definer_select on profile_private.claim_proof_attempts
  for select to wejammin_platform_definer using (true);
create policy ownership_contests_platform_definer_select on profile_private.ownership_contests
  for select to wejammin_platform_definer using (true);
create policy party_ownership_periods_platform_definer_select on profile_private.party_ownership_periods
  for select to wejammin_platform_definer using (true);
create policy party_ownership_periods_platform_definer_insert on profile_private.party_ownership_periods
  for insert to wejammin_platform_definer with check (true);
create policy party_ownership_periods_platform_definer_lock on profile_private.party_ownership_periods
  for update to wejammin_platform_definer using (true) with check (false);

grant execute on function
  platform_private.cfg_context_value(jsonb,text),
  platform_private.cfg_correlation(jsonb),
  platform_private.cfg_json_bounded(jsonb,integer,integer),
  platform_private.cfg_parse_uuid(text,text),
  platform_private.cfg_parse_version(text,text),
  platform_private.cfg_request_actor(jsonb,boolean),
  platform_private.cfg_require_capability(uuid,uuid,text),
  platform_private.cfg_require_keys(jsonb,text[],text[]),
  platform_private.cfg_valid_key(text),
  platform_private.external_effects_allowed(),
  platform_private.guard_outbox(),
  platform_private.identity_actor_person(uuid),
  platform_private.identity_idempotency_reserve(uuid,text,bytea,bytea),
  platform_private.outbox_event_producer(text),
  platform_private.request_jwt_claim(text),
  platform_private.valid_base_event_payload(text,integer,jsonb),
  profile_private.profile_acting_party(uuid),
  profile_private.profile_actor(),
  profile_private.profile_claim_resource(profile_private.claim_cases),
  profile_private.profile_close_active_period(uuid,timestamp with time zone),
  profile_private.profile_complete(uuid,uuid,integer),
  profile_private.profile_correlation_id(),
  profile_private.profile_effects(text,uuid,uuid,text,uuid,text,text,text,uuid,bigint,jsonb,uuid),
  profile_private.profile_expected_version(jsonb),
  profile_private.profile_key_hash(jsonb),
  profile_private.profile_request_hash(text,jsonb),
  profile_private.profile_require_keys(jsonb,text[]),
  profile_private.profile_require_uuid(text,text),
  profile_private.profile_state_transition_guard()
  to wejammin_platform_definer;

commit;
