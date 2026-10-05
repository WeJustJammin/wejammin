-- SEC-2: make the Slice 09 policies of 20261002192000 work for the real caller.
-- Forward-only.
--
-- 1. The two Slice 09 tables that were readable only by the platform owner get
--    the same RPC-context gate as their siblings (cms_template_versions for the
--    template command, cms_owner_initialization for the owner-receipt read).
-- 2. The session-scope helpers re-read the authority tables (reviews,
--    assignments, reports) through policies that call the helpers.  The helpers
--    are owned by wejammin_cms_authority_reader; the three restrictive policies skip THAT role's own
--    reads (current_user is the querying role, not the caller), which cuts the
--    recursion; every other role, the definer included, is held to the scope.
--    The role is SELECT-only and policy-admitted only for SELECT.
-- 3. Identity tables: the definer role reads the MFA rows of the published
--    subject (or under the system scope), and writes notification intents only
--    under the system scope; the owner self-read policies are untouched.
begin;

create policy cms_template_versions_rpc_policy on platform_private.cms_template_versions
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());
create policy cms_owner_initialization_rpc_policy on platform_private.cms_owner_initialization
  for select to public
  using (platform_private.cms_rpc_context_valid());

alter policy cms_schema_reviews_session_scope on platform_private.cms_schema_reviews
  using (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, id))
  with check (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, id));
alter policy cms_schema_review_assignments_session_scope on platform_private.cms_schema_review_assignments
  using (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, review_id))
  with check (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, review_id));
alter policy cms_schema_dry_run_reports_session_scope on platform_private.cms_schema_dry_run_reports
  using (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, null))
  with check (current_user = 'wejammin_cms_authority_reader' or platform_private.cms_session_scope_ok(owner_id, null));

create policy cms_schema_reviews_authority_reader_read on platform_private.cms_schema_reviews
  for select to wejammin_cms_authority_reader using (true);
create policy cms_schema_review_assignments_authority_reader_read on platform_private.cms_schema_review_assignments
  for select to wejammin_cms_authority_reader using (true);
create policy cms_schema_dry_run_reports_authority_reader_read on platform_private.cms_schema_dry_run_reports
  for select to wejammin_cms_authority_reader using (true);
create policy cms_owner_initialization_authority_reader_read on platform_private.cms_owner_initialization
  for select to wejammin_cms_authority_reader using (true);

create policy mfa_factor_registry_definer_read on identity.mfa_factor_registry
  for select to wejammin_cms_definer using (platform_private.identity_session_scope_ok(auth_user_id));
create policy step_up_challenges_definer_read on identity.step_up_challenges
  for select to wejammin_cms_definer using (platform_private.identity_session_scope_ok(auth_user_id));
create policy in_app_notification_intents_definer_read on identity.in_app_notification_intents
  for select to wejammin_cms_definer using (platform_private.cms_session_scope_ok_system());

commit;
