-- SEC-2: hand ownership of the Slice 09 functions to the definer roles.
--
-- After this migration no function whose body reads or writes a forced Slice 09
-- table is owned by the BYPASSRLS platform role, so the forced policies apply to
-- every statement those functions run.  The set is every platform_private and
-- platform_api function whose body names such a table (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives it from the live
-- bodies, so a function added later without this ownership fails that test).
-- The three session-scope helpers go to the SELECT-only authority-reader role.
-- ALTER FUNCTION ... OWNER TO requires CREATE on the function's schema for the
-- new owner, so the roles hold it for the length of this transaction only.
-- Forward-only.
begin;

grant create on schema platform_private, platform_api to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_authority_reader;

alter function platform_api.admin_mfa_factor_reset_settle(jsonb) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_enrollment_begin(uuid,text,text,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_enrollment_finish(uuid,uuid,text,text,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_enrollment_verify_prepare(uuid,uuid,text,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_enrollment_verify_settle(uuid,uuid,text,uuid,uuid,timestamp with time zone,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_factor_mark_reconciling(uuid,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_factor_reconcile(uuid,uuid,text,bigint,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_factor_reconcile_read(uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_reconciling_age() owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_registry_sweep(integer) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_removal_begin(uuid,uuid,text,text,uuid,bytea,bytea,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_removal_finish(uuid,uuid,text,uuid,bytea,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_step_up_challenge_begin(uuid,uuid,text,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_step_up_challenge_failure_record(uuid,uuid,uuid,text,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_step_up_challenge_finish(uuid,uuid,uuid,uuid,timestamp with time zone,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_step_up_challenge_verify_prepare(uuid,uuid,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.auth_step_up_challenge_verify_settle(uuid,uuid,uuid,uuid,timestamp with time zone,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.cms_capability_grant_read_current(uuid) owner to wejammin_cms_definer;
alter function platform_api.cms_get_operational_state_snapshot(jsonb) owner to wejammin_cms_definer;
alter function platform_api.in_app_notification_record(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_activate_schema(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_activation_frozen_risk_class(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_activation_preparation(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_activation_references_valid(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_activation_review_invalidation_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_activation_risk_class(text) owner to wejammin_cms_definer;
alter function platform_private.cms_active_parent_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_add_field_definition(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_advance_activation_plan(uuid,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_advance_block_lifecycle(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_assign_schema_review(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_author_locale_variant(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_authority_origin(uuid,uuid,text,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_backfill_owner_capability_grants(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_begin_schema_migration_verification(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_bind_relation(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_block_key_registry_valid(text,text) owner to wejammin_cms_definer;
alter function platform_private.cms_block_reference_valid(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_candidate_compiled_current(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_candidate_definition_request(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_capability_grant_record_event(uuid,text,date,uuid,uuid,uuid,timestamp with time zone) owner to wejammin_cms_definer;
alter function platform_private.cms_capability_grant_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_claim_schema_migration_lease(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_compile_candidate(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_complete_schema_migration(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_composition_instance_guards() owner to wejammin_cms_definer;
alter function platform_private.cms_create_entry(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_create_revision(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_create_schema_successor(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_create_type_draft(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_decide_schema_review(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_define_template(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_derive_schema_classification(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_derive_schema_field_classification(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_draft_content_hash(uuid,text) owner to wejammin_cms_definer;
alter function platform_private.cms_draft_field_value_valid(uuid,uuid,jsonb,text) owner to wejammin_cms_definer;
alter function platform_private.cms_draft_template_binding_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_editorial_workflow_policy_evidence(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_entry_version_lock_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_finalize_schema_migration_dry_run(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_get_content_type_version(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_get_entry_draft(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_get_schema_migration_plan(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_get_schema_review(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_grant_capability(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_grant_owner(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_heartbeat_schema_migration_lease(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_invalidate_activation_reviews(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_invalidate_activation_reviews_for_owner(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_list_capability_grants(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_list_content_types(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_list_revisions(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_lock_activation_authority(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_lock_activation_graph(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_affected_variants(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_changed_fields(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_live_rows(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_plan_ready(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_retired_fields(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_revision_document(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_scan_preflight(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_source_evidence_valid(platform_private.cms_schema_migration_plans) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_source_unchanged(platform_private.cms_schema_migration_plans) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_target_fields_spec(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_migration_verify_reason(platform_private.cms_schema_migration_plans) owner to wejammin_cms_definer;
alter function platform_private.cms_persisted_dry_run_report_valid(uuid,uuid,uuid,uuid,uuid,text,text,bigint,text,text,text,text) owner to wejammin_cms_definer;
alter function platform_private.cms_process_schema_migration_batch(jsonb,boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_read_schema_migration_source_rows(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_reconcile_schema_activation(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_register_block_at(jsonb,timestamp with time zone) owner to wejammin_cms_definer;
alter function platform_private.cms_release_nonce_claim_at(jsonb,text,uuid,timestamp with time zone) owner to wejammin_cms_definer;
alter function platform_private.cms_renew_capability_grant(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_activation_review(uuid,uuid[]) owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_conflict(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_review_policy(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_template_compatibility(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_review_authority_lapsed(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_review_owner_authority_end(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_review_qualifying_approvers(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_review_scope(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_review_unsatisfied_slots(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_revision_author_class(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_revision_field_payload(uuid,text,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_revoke_capability_grant(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_rollback_schema_migration(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_schema_artifact_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_schema_dry_run_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_approval_digest(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_assignment_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_assignment_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_decision_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_decision_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_schema_review_resource(uuid,uuid,boolean,boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_session_scope_ok(uuid,uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_session_scope_ok_report(uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_stale_locale_dependents(uuid,boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_start_schema_dry_run(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_submit_schema_review(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_sweep_expired_review_authority(integer) owner to wejammin_cms_definer;
alter function platform_private.cms_template_binding_compatible(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_template_block_digest(jsonb,jsonb,uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_template_context(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_template_latest(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_template_registry_valid(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_terms_hierarchy_cycle_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_terms_successor_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_transform_registry_member(text,bigint) owner to wejammin_cms_definer;
alter function platform_private.cms_type_version_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_type_version_template_compat_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_verify_schema_migration(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_worker_activate_schema(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_worker_human_approval_valid(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_worker_plan_json(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_worker_validate_fingerprint(platform_private.cms_schema_migration_plans,jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_workflow_policy_member(text,bigint) owner to wejammin_cms_definer;
alter function platform_private.identity_session_scope_ok(uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.initialize_cms_owner(uuid,uuid,text,timestamp with time zone,uuid,boolean) owner to wejammin_cms_definer;
alter function platform_private.mfa_projection(uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_step_up_capability_held(uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.mfa_verification_charge_failure(uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_verification_require_unlocked(uuid) owner to wejammin_cms_definer;
alter function platform_private.outbox_event_producer(text) owner to wejammin_cms_definer;
alter function platform_private.step_up_usable_challenge(uuid,uuid,uuid,boolean) owner to wejammin_cms_definer;

revoke create on schema platform_private, platform_api from wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_authority_reader;

commit;
