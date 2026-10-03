-- SEC-2: tables outside Slice 09 keep forced RLS and no policy for any caller;
-- the platform owner (BYPASSRLS) was the only role that could use them.  Now that
-- the Slice 09 functions run as a non-bypass definer role, the owning slices'
-- tables need an explicit policy for that role.  The policies mirror, verb for
-- verb, the privileges granted in 20261003120100: they preserve exactly what the
-- same function bodies did as the platform owner, for these tables only, and
-- only for the one NOLOGIN definer role.  They are deliberately not predicates
-- about a session: those tables belong to other slices, whose own RPC gates
-- (actor binding, idempotency, audit) stay in the function bodies.  A table that
-- is only row-locked gets an UPDATE policy whose WITH CHECK is false (a lock
-- evaluates USING only), so no row can be changed through it.  Slice 09 tables
-- never get such a policy: they carry the RPC-context gate and the
-- session-scope policies.  Forward-only.
begin;

create policy auth_session_index_cms_definer_select on identity.auth_session_index for select to wejammin_cms_definer using (true);
create policy auth_session_index_cms_definer_update on identity.auth_session_index for update to wejammin_cms_definer using (true) with check (true);
create policy auth_user_bindings_cms_definer_lock on identity.auth_user_bindings for update to wejammin_cms_definer using (true) with check (false);
create policy auth_user_bindings_cms_definer_select on identity.auth_user_bindings for select to wejammin_cms_definer using (true);
create policy security_events_cms_definer_select on identity.security_events for select to wejammin_cms_definer using (true);
create policy membership_tenure_cms_definer_lock on identity_private.membership_tenure for update to wejammin_cms_definer using (true) with check (false);
create policy membership_tenure_cms_definer_select on identity_private.membership_tenure for select to wejammin_cms_definer using (true);
create policy organization_actor_grant_cms_definer_lock on identity_private.organization_actor_grant for update to wejammin_cms_definer using (true) with check (false);
create policy organization_actor_grant_cms_definer_select on identity_private.organization_actor_grant for select to wejammin_cms_definer using (true);
create policy acting_context_binding_cms_definer_lock on platform_private.acting_context_binding for update to wejammin_cms_definer using (true) with check (false);
create policy acting_context_binding_cms_definer_select on platform_private.acting_context_binding for select to wejammin_cms_definer using (true);
create policy admin_mfa_factor_resets_cms_definer_select on platform_private.admin_mfa_factor_resets for select to wejammin_cms_definer using (true);
create policy admin_mfa_factor_resets_cms_definer_update on platform_private.admin_mfa_factor_resets for update to wejammin_cms_definer using (true) with check (true);
create policy cfg_release_principals_cms_definer_lock on platform_private.cfg_release_principals for update to wejammin_cms_definer using (true) with check (false);
create policy cfg_release_principals_cms_definer_select on platform_private.cfg_release_principals for select to wejammin_cms_definer using (true);
create policy idempotency_records_cms_definer_insert on platform_private.idempotency_records for insert to wejammin_cms_definer with check (true);
create policy idempotency_records_cms_definer_select on platform_private.idempotency_records for select to wejammin_cms_definer using (true);
create policy idempotency_records_cms_definer_update on platform_private.idempotency_records for update to wejammin_cms_definer using (true) with check (true);
create policy jobs_cms_definer_select on platform_private.jobs for select to wejammin_cms_definer using (true);
create policy outbox_events_cms_definer_select on platform_private.outbox_events for select to wejammin_cms_definer using (true);
create policy person_party_cms_definer_select on platform_private.person_party for select to wejammin_cms_definer using (true);
create policy auth_user_bindings_authority_reader_read on identity.auth_user_bindings for select to wejammin_cms_authority_reader using (true);
create policy membership_tenure_authority_reader_read on identity_private.membership_tenure for select to wejammin_cms_authority_reader using (true);
create policy organization_actor_grant_authority_reader_read on identity_private.organization_actor_grant for select to wejammin_cms_authority_reader using (true);
create policy admin_capability_grants_authority_reader_read on platform_private.admin_capability_grants for select to wejammin_cms_authority_reader using (true);
create policy person_party_authority_reader_read on platform_private.person_party for select to wejammin_cms_authority_reader using (true);

commit;
