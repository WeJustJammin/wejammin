-- SEC-2: the definer roles hold exactly the privileges the functions they own
-- need, derived from the function bodies (schema usage, per-table verbs, and
-- EXECUTE on the functions those bodies and the table policies, constraints and
-- defaults call).  No role gets CREATE, TRUNCATE, REFERENCES or TRIGGER, and no
-- table grant reaches an API role.  Forward-only.
begin;

-- wejammin_cms_definer
grant usage on schema audit_private, extensions, identity, identity_private, platform_api, platform_private to wejammin_cms_definer;
grant delete, insert, select, update on table
  identity.mfa_factor_registry,
  identity.step_up_challenges
  to wejammin_cms_definer;
grant insert, select on table
  identity.in_app_notification_intents,
  platform_private.cms_block_definition_lifecycle_events,
  platform_private.cms_block_definition_versions,
  platform_private.cms_capability_grant_events,
  platform_private.cms_content_type_capability_bindings,
  platform_private.cms_content_type_template_bindings,
  platform_private.cms_entry_assignments,
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_relations,
  platform_private.cms_entry_revisions,
  platform_private.cms_locale_variants,
  platform_private.cms_relation_definitions,
  platform_private.cms_schema_dry_run_row_evidence,
  platform_private.cms_schema_migration_target_rows,
  platform_private.cms_schema_review_decisions,
  platform_private.cms_template_versions
  to wejammin_cms_definer;
grant insert, select, update on table
  identity.mfa_verification_lockouts,
  platform_private.cms_capability_grants,
  platform_private.cms_conflict_records,
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_content_types,
  platform_private.cms_field_definition_versions,
  platform_private.cms_release_nonce_receipts,
  platform_private.cms_schema_artifacts,
  platform_private.cms_schema_dry_run_reports,
  platform_private.cms_schema_migration_plans,
  platform_private.cms_schema_review_assignments,
  platform_private.cms_schema_reviews,
  platform_private.idempotency_records
  to wejammin_cms_definer;
grant select on table
  identity.auth_user_bindings,
  identity.security_events,
  identity_private.membership_tenure,
  identity_private.organization_actor_grant,
  platform_private.acting_context_binding,
  platform_private.cfg_release_principals,
  platform_private.cms_owner_initialization,
  platform_private.cms_publication_versions,
  platform_private.cms_schema_transform_registry,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_terms,
  platform_private.cms_workflow_policies,
  platform_private.jobs,
  platform_private.outbox_event_producers,
  platform_private.outbox_events,
  platform_private.person_party
  to wejammin_cms_definer;
grant select, update on table
  identity.auth_session_index,
  platform_private.admin_mfa_factor_resets
  to wejammin_cms_definer;
-- Row locks (SELECT ... FOR UPDATE / SHARE) need UPDATE on at least one column:
-- these relations are only locked, never updated, so the grant is one key column.
grant update (id) on table identity.auth_user_bindings to wejammin_cms_definer;
grant update (id) on table identity_private.membership_tenure to wejammin_cms_definer;
grant update (organization_id) on table identity_private.organization_actor_grant to wejammin_cms_definer;
grant update (id) on table platform_private.acting_context_binding to wejammin_cms_definer;
grant update (principal_id) on table platform_private.cfg_release_principals to wejammin_cms_definer;
grant update (id) on table platform_private.cms_block_definition_versions to wejammin_cms_definer;
grant update (id) on table platform_private.cms_content_type_capability_bindings to wejammin_cms_definer;
grant update (id) on table platform_private.cms_content_type_template_bindings to wejammin_cms_definer;
grant update (id) on table platform_private.cms_entry_revisions to wejammin_cms_definer;
grant update (id) on table platform_private.cms_relation_definitions to wejammin_cms_definer;
grant update (id) on table platform_private.cms_taxonomy_versions to wejammin_cms_definer;
grant update (id) on table platform_private.cms_template_versions to wejammin_cms_definer;
grant execute on function
  identity.in_app_notification_immutable(),
  platform_api.cms_validate_locale_config(text,text,jsonb,jsonb),
  platform_api.identity_alias_create(text,text,text),
  platform_api.rpc_create_organization(text,text[]),
  platform_private.accept_job_with_outbox(uuid,uuid,text,uuid,bytea,bytea,timestamp with time zone,uuid,uuid),
  platform_private.admin_actions_valid(text[]),
  platform_private.admin_mfa_factor_reset_guard(),
  platform_private.admin_mfa_factor_reset_view(uuid),
  platform_private.admin_scope_valid(jsonb,uuid),
  platform_private.auth_iso_time(timestamp with time zone),
  platform_private.cfg_correlation(jsonb),
  platform_private.cfg_request_actor(jsonb,boolean),
  platform_private.cfg_require_keys(jsonb,text[],text[]),
  platform_private.cfg_valid_uuid(text),
  platform_private.cms_acting_party(jsonb,uuid),
  platform_private.cms_actor(jsonb),
  platform_private.cms_artifact_contract_ref(text,integer),
  platform_private.cms_canonical_type_definition(jsonb),
  platform_private.cms_capability_grant_event_guard(),
  platform_private.cms_capability_grant_guard(),
  platform_private.cms_capability_grant_project(uuid,uuid,text,date,date,boolean),
  platform_private.cms_capability_grant_state(text,date),
  platform_private.cms_capability_registry_valid(text,bigint),
  platform_private.cms_compiled_editor_manifest(jsonb),
  platform_private.cms_compiled_manifest_bounded(jsonb),
  platform_private.cms_compiled_renderer_manifest(jsonb),
  platform_private.cms_compiler_registry_valid(text),
  platform_private.cms_complete(uuid,uuid,integer,jsonb),
  platform_private.cms_completed_migration_plan_guard(),
  platform_private.cms_content_type_identity_guard(),
  platform_private.cms_content_version_guard(),
  platform_private.cms_content_version_locale_guard(),
  platform_private.cms_correlation(jsonb),
  platform_private.cms_data_source_registry_valid(text),
  platform_private.cms_definition_artifact_hash(jsonb),
  platform_private.cms_definition_artifact_hash(jsonb,integer),
  platform_private.cms_definition_blocked_guard(),
  platform_private.cms_definition_delete_guard(),
  platform_private.cms_dry_run_report_valid(jsonb,uuid,text,text,bigint,text,text,text,text),
  platform_private.cms_emit_event(text,uuid,uuid,text,uuid,text,text,text,uuid,bigint,jsonb,uuid),
  platform_private.cms_entry_tenant_visible(uuid,uuid),
  platform_private.cms_exact_keys(jsonb,text[],text[]),
  platform_private.cms_expected_version(jsonb),
  platform_private.cms_field_identity_guard(),
  platform_private.cms_grant_reason(jsonb),
  platform_private.cms_grant_subject_eligible(uuid,uuid),
  platform_private.cms_grant_subject_lock(uuid,uuid),
  platform_private.cms_grant_today(),
  platform_private.cms_grant_valid_through(jsonb),
  platform_private.cms_grantable_capability(text),
  platform_private.cms_immutable_guard(),
  platform_private.cms_jcs(jsonb),
  platform_private.cms_jcs_number(jsonb),
  platform_private.cms_jcs_sha256(jsonb),
  platform_private.cms_json_bounded(jsonb,integer,integer,integer,integer),
  platform_private.cms_locale_canonical_valid(text),
  platform_private.cms_locale_config_hash(text,text,jsonb,jsonb),
  platform_private.cms_locale_config_shape_valid(jsonb,jsonb),
  platform_private.cms_locale_sorted(jsonb),
  platform_private.cms_locale_violation_detail(jsonb),
  platform_private.cms_migration_expected_output(text,uuid,jsonb,jsonb),
  platform_private.cms_migration_spec_kinds_accepted(jsonb,jsonb),
  platform_private.cms_migration_transform_hash(text,text,bigint,text,text,text,text),
  platform_private.cms_nonce_guard(),
  platform_private.cms_person_holds_capability(uuid,uuid,text),
  platform_private.cms_projection_registry_valid(text,text,text),
  platform_private.cms_publish_session(uuid,uuid),
  platform_private.cms_raise_forbidden(text),
  platform_private.cms_raise_version_mismatch(bigint,bigint),
  platform_private.cms_record_audit(text,uuid,uuid,text,uuid,text,uuid),
  platform_private.cms_release_actor(jsonb),
  platform_private.cms_release_nonce_claim(jsonb,text,uuid),
  platform_private.cms_release_signing_payload(jsonb,text),
  platform_private.cms_renderer_registry_valid(text),
  platform_private.cms_require_capability(uuid,uuid,text),
  platform_private.cms_require_entry_capability(uuid,uuid,text[],uuid),
  platform_private.cms_require_read(uuid,uuid),
  platform_private.cms_require_release_worker(),
  platform_private.cms_require_scope_member(uuid,uuid),
  platform_private.cms_reserve(jsonb,uuid,text),
  platform_private.cms_reserve_conflict(jsonb,uuid,text),
  platform_private.cms_reserved_key(text),
  platform_private.cms_resolution_policy_complete(uuid),
  platform_private.cms_review_assignment_effective(text,timestamp with time zone,timestamp with time zone),
  platform_private.cms_review_binding(jsonb,uuid,uuid,boolean),
  platform_private.cms_review_context_hash(uuid,uuid,uuid,uuid),
  platform_private.cms_review_is_owner(uuid,uuid),
  platform_private.cms_review_person_eligible(uuid),
  platform_private.cms_revision_content_hash(uuid,text,text,uuid),
  platform_private.cms_revision_field_hash(jsonb),
  platform_private.cms_revision_page_disposition(uuid,uuid,platform_private.cms_entry_revisions),
  platform_private.cms_revision_reader_capabilities(),
  platform_private.cms_rpc_context_valid(),
  platform_private.cms_schema_dry_run_report_guard(),
  platform_private.cms_schema_ref_registry_valid(text),
  platform_private.cms_schema_review_guard(),
  platform_private.cms_schema_source_row_count(uuid,uuid),
  platform_private.cms_session_scope_ok(uuid,uuid),
  platform_private.cms_session_scope_ok_report(uuid),
  platform_private.cms_session_scope_ok_system(),
  platform_private.cms_session_system_scope(),
  platform_private.cms_session_uuid(text),
  platform_private.cms_successor_template_gate(uuid,uuid,uuid,uuid,uuid,jsonb),
  platform_private.cms_taxonomy_versions_lifecycle_guard(),
  platform_private.cms_template_designer_authorized(uuid,uuid),
  platform_private.cms_template_manifest_valid(jsonb),
  platform_private.cms_template_versions_guard(),
  platform_private.cms_terms_lifecycle_guard(),
  platform_private.cms_transform_registry_digest(text,bigint,jsonb,jsonb,jsonb,text),
  platform_private.cms_transform_registry_member_valid(text,bigint),
  platform_private.cms_valid_base64(text),
  platform_private.cms_valid_block_request(jsonb),
  platform_private.cms_valid_field_input(jsonb,boolean),
  platform_private.cms_valid_hash(text),
  platform_private.cms_valid_relation_input(jsonb),
  platform_private.cms_valid_uuid(text),
  platform_private.cms_valid_version(text),
  platform_private.cms_validator_registry_valid(text,bigint),
  platform_private.cms_verify_props_attestation(jsonb,uuid),
  platform_private.cms_version_monotonic_guard(),
  platform_private.cms_with_content_hash(jsonb),
  platform_private.cms_worker_counter(text,text),
  platform_private.cms_worker_lease_valid(platform_private.cms_schema_migration_plans,text,text,timestamp with time zone),
  platform_private.cms_worker_positive(text,text),
  platform_private.cms_worker_require_request(jsonb,text[],text[]),
  platform_private.cms_worker_require_scan_request(jsonb,text[]),
  platform_private.cms_worker_set_report(jsonb,text,text,text,timestamp with time zone,bigint,bigint,bigint,bigint,bigint),
  platform_private.cms_worker_time(text),
  platform_private.cms_worker_uuid(text,text),
  platform_private.cms_workflow_policy_hash(text,bigint,text,integer,jsonb),
  platform_private.cms_workflow_registry_valid(text,bigint),
  platform_private.cms_write_guard(),
  platform_private.guard_idempotency(),
  platform_private.guard_jobs(),
  platform_private.guard_outbox(),
  platform_private.identity_actor_person(uuid),
  platform_private.identity_session_scope_ok(uuid),
  platform_private.mfa_audit(text,uuid,uuid,text,uuid,text,uuid),
  platform_private.mfa_bump(uuid),
  platform_private.mfa_factor_changed_event(uuid,bigint,uuid,uuid),
  platform_private.mfa_factor_guard(),
  platform_private.mfa_lock_binding(uuid,boolean),
  platform_private.mfa_notification_request(uuid,uuid,uuid),
  platform_private.mfa_parse_version(text),
  platform_private.mfa_require_name(text),
  platform_private.mfa_require_not_last_factor(uuid),
  platform_private.mfa_require_session(uuid,uuid),
  platform_private.mfa_require_version(bigint,text),
  platform_private.mfa_rotate_session(uuid,uuid,uuid,timestamp with time zone,uuid,uuid,uuid),
  platform_private.mfa_security_event(text,uuid,uuid,text,text,uuid,uuid),
  platform_private.step_up_challenge_guard(),
  platform_private.valid_attempts(jsonb),
  platform_private.valid_base_event_payload(text,integer,jsonb),
  platform_private.valid_job_progress(jsonb),
  platform_private.valid_response_ref(jsonb)
  to wejammin_cms_definer;

-- wejammin_cms_authority_reader
grant usage on schema identity, identity_private, platform_private to wejammin_cms_authority_reader;
grant select on table
  identity.auth_user_bindings,
  identity_private.membership_tenure,
  identity_private.organization_actor_grant,
  platform_private.admin_capability_grants,
  platform_private.cms_owner_initialization,
  platform_private.cms_schema_dry_run_reports,
  platform_private.cms_schema_review_assignments,
  platform_private.cms_schema_reviews,
  platform_private.person_party
  to wejammin_cms_authority_reader;
grant execute on function
  platform_private.cms_person_holds_capability(uuid,uuid,text),
  platform_private.cms_review_assignment_effective(text,timestamp with time zone,timestamp with time zone),
  platform_private.cms_session_system_scope(),
  platform_private.cms_session_uuid(text),
  platform_private.step_up_capability_designated(text)
  to wejammin_cms_authority_reader;

commit;
