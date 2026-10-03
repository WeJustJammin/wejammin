export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  audit_private: {
    Tables: {
      audit_events: {
        Row: {
          acting_party_id: string
          action: string
          actor_id: string | null
          correlation_id: string
          decision: Database["platform_private"]["Enums"]["audit_decision"]
          id: string
          occurred_at: string
          reason_code: string
          target_id: string
          target_type: string
        }
        Insert: {
          acting_party_id: string
          action: string
          actor_id?: string | null
          correlation_id: string
          decision: Database["platform_private"]["Enums"]["audit_decision"]
          id?: string
          occurred_at?: string
          reason_code: string
          target_id: string
          target_type: string
        }
        Update: {
          acting_party_id?: string
          action?: string
          actor_id?: string | null
          correlation_id?: string
          decision?: Database["platform_private"]["Enums"]["audit_decision"]
          id?: string
          occurred_at?: string
          reason_code?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  platform_api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      db_harness_fixture_read: {
        Row: {
          id: string | null
          label: string | null
          owner_id: string | null
        }
        Insert: {
          id?: string | null
          label?: string | null
          owner_id?: string | null
        }
        Update: {
          id?: string | null
          label?: string | null
          owner_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ac265_approved_outage_target_read: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_approved_outage_target_register: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_approved_runner_mapping_read: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_approved_runner_mapping_register: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_approved_safe_resource_register: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_enroll_verified_candidate: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_artifact_manifest_finalize: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_artifact_manifest_read: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_artifact_manifest_register: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_outage_lease_acquire: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_outage_lease_consume: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_hosted_outage_lease_release: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_prepare_hosted_run: { Args: { p_request: Json }; Returns: Json }
      ac265_session_broker_authorize: {
        Args: { p_request: Json }
        Returns: Json
      }
      ac265_session_broker_resolve: { Args: { p_request: Json }; Returns: Json }
      ac265_session_broker_teardown: {
        Args: { p_request: Json }
        Returns: Json
      }
      accept_job_with_outbox: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id?: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_job_id?: string
          p_job_type: string
          p_request_hash: string
        }
        Returns: {
          event_id: string
          job_id: string
          replayed: boolean
          version: number
        }[]
      }
      admin_audit_diagnostic: { Args: { p_request: Json }; Returns: Json }
      admin_capability_action: { Args: { p_request: Json }; Returns: Json }
      admin_context_capabilities: { Args: { p_request: Json }; Returns: Json }
      admin_inbox: { Args: { p_request: Json }; Returns: Json }
      admin_mfa_factor_reset: { Args: { p_request: Json }; Returns: Json }
      admin_mfa_factor_reset_settle: {
        Args: { p_request: Json }
        Returns: Json
      }
      apply_job_outcome:
        | {
            Args: {
              p_error_code: string
              p_expected_version: number
              p_job_id: string
              p_lease_token: string
              p_next_state: Database["platform_private"]["Enums"]["job_state"]
              p_result_ref: Json
              p_retryable: boolean
            }
            Returns: boolean
          }
        | {
            Args: {
              p_error_code: string
              p_expected_version: number
              p_job_id: string
              p_next_state: Database["platform_private"]["Enums"]["job_state"]
              p_result_ref: Json
              p_retryable: boolean
            }
            Returns: boolean
          }
      apply_object_verification: {
        Args: {
          p_correlation_id?: string
          p_error_code?: string
          p_expected_version: number
          p_job_id?: string
          p_next_state: Database["platform_private"]["Enums"]["object_state"]
          p_object_id: string
        }
        Returns: {
          applied: boolean
          job_id: string
          object_id: string
          state: Database["platform_private"]["Enums"]["object_state"]
          version: number
        }[]
      }
      apply_provider_operation_outcome: {
        Args: {
          p_attempt_ended_at?: string
          p_attempt_started_at?: string
          p_error_code?: string
          p_expected_version: number
          p_next_state: Database["platform_private"]["Enums"]["provider_operation_state"]
          p_operation_id: string
          p_provider_ref?: string
          p_retryable?: boolean
        }
        Returns: boolean
      }
      apply_provider_operation_outcome_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_attempt_ended_at?: string
          p_attempt_started_at?: string
          p_error_code?: string
          p_expected_version: number
          p_next_state: Database["platform_private"]["Enums"]["provider_operation_state"]
          p_operation_id: string
          p_provider_ref?: string
          p_retryable?: boolean
        }
        Returns: boolean
      }
      apply_webhook_receipt_outcome: {
        Args: {
          p_error_code?: string
          p_expected_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_next_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_operation_id?: string
          p_receipt_id: string
        }
        Returns: boolean
      }
      apply_webhook_receipt_outcome_authorized: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_error_code: string
          p_expected_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_next_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_operation_id: string
          p_receipt_id: string
        }
        Returns: boolean
      }
      auth_account_merge_confirm: {
        Args: {
          p_acknowledgements: Json
          p_auth_user_id: string
          p_conflict_plan_version: number
          p_correlation_id: string
          p_expected_version: number
          p_key_hash: string
          p_merge_id: string
          p_request_hash: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_account_merge_create: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: number
          p_key_hash: string
          p_request_hash: string
          p_request_id: string
          p_return_path: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_account_merge_proof_callback_complete: {
        Args: {
          p_callback_auth_user_id: string
          p_correlation_id: string
          p_provider: string
          p_provider_subject_digest: string
          p_request_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_account_merge_proof_create: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: number
          p_expires_at: string
          p_key_hash: string
          p_merge_id: string
          p_nonce_digest: string
          p_pkce_verifier_digest: string
          p_provider: string
          p_request_hash: string
          p_request_id: string
          p_return_path: string
          p_session_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_account_merge_read: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_merge_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_bootstrap: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_key_hash: string
          p_request_hash: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_callback_complete: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_request_id: string
          p_session_expires_at: string
          p_session_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_callback_fail: {
        Args: {
          p_correlation_id: string
          p_reason: string
          p_request_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_intent_create: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expires_at: string
          p_intent: string
          p_merge_id: string
          p_nonce_digest: string
          p_pkce_verifier_digest: string
          p_provider: string
          p_request_id: string
          p_return_path: string
          p_session_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_login_method_link_callback_complete: {
        Args: {
          p_callback_auth_user_id: string
          p_correlation_id: string
          p_provider: string
          p_provider_subject_digest: string
          p_request_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_login_method_link_intent_create: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: number
          p_expires_at: string
          p_key_hash: string
          p_nonce_digest: string
          p_pkce_verifier_digest: string
          p_provider: string
          p_request_hash: string
          p_request_id: string
          p_return_path: string
          p_session_id: string
          p_state_digest: string
        }
        Returns: Json
      }
      auth_login_method_unlink: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: number
          p_identity_id: string
          p_key_hash: string
          p_reason: string
          p_request_hash: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_login_methods_read: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_logout: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_key_hash: string
          p_request_hash: string
          p_request_id: string
          p_scope: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_mfa_enrollment_begin: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: string
          p_friendly_name: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_mfa_enrollment_finish: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: string
          p_friendly_name: string
          p_provider_factor_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_mfa_enrollment_verify_prepare: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: string
          p_factor_id: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_mfa_enrollment_verify_settle: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: string
          p_factor_id: string
          p_issued_at: string
          p_new_session_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_mfa_factor_mark_reconciling: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_factor_id: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_mfa_factor_reconcile: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: number
          p_factor_id: string
          p_outcome: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_mfa_factor_reconcile_read: {
        Args: { p_factor_id: string }
        Returns: Json
      }
      auth_mfa_factors_read: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_mfa_reconciling_age: { Args: never; Returns: Json }
      auth_mfa_registry_sweep: { Args: { p_batch: number }; Returns: Json }
      auth_mfa_removal_begin: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expected_version: string
          p_factor_id: string
          p_key_hash: string
          p_reason: string
          p_request_hash: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_mfa_removal_finish: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_factor_id: string
          p_key_hash: string
          p_reason: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_mfa_verification_failure_record: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_outcome: string
          p_request_id: string
        }
        Returns: Json
      }
      auth_provider_catalog: { Args: never; Returns: Json }
      auth_rate_limit: {
        Args: {
          p_bucket_digest: string
          p_limit: number
          p_operation_id: string
          p_window_seconds: number
        }
        Returns: Json
      }
      auth_session_read: {
        Args: { p_auth_user_id: string; p_session_id: string }
        Returns: Json
      }
      auth_session_register: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_issued_at: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_step_up_challenge_begin: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_factor_id: string
          p_method: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_step_up_challenge_failure_record: {
        Args: {
          p_auth_user_id: string
          p_challenge_id: string
          p_correlation_id: string
          p_outcome: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_step_up_challenge_finish: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_expires_at: string
          p_factor_id: string
          p_provider_challenge_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_step_up_challenge_verify_prepare: {
        Args: {
          p_auth_user_id: string
          p_challenge_id: string
          p_correlation_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      auth_step_up_challenge_verify_settle: {
        Args: {
          p_auth_user_id: string
          p_challenge_id: string
          p_correlation_id: string
          p_issued_at: string
          p_new_session_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: Json
      }
      begin_restore_fence: {
        Args: { p_reason: string; p_restore_epoch: number }
        Returns: boolean
      }
      cfg_change_action: { Args: { p_request: Json }; Returns: Json }
      cfg_propose_change: { Args: { p_request: Json }; Returns: Json }
      cfg_register_definition: { Args: { p_request: Json }; Returns: Json }
      cfg_resolve_effective_value: { Args: { p_request: Json }; Returns: Json }
      claim_job: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          attempt_count: number
          job_id: string
          lease_until: string
          state: Database["platform_private"]["Enums"]["job_state"]
          version: number
        }[]
      }
      claim_outbox_batch: {
        Args: {
          p_batch_size: number
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          aggregate_version: number
          causation_id: string
          correlation_id: string
          dispatch_attempt_count: number
          event_id: string
          event_type: string
          lease_token: string
          schema_version: number
        }[]
      }
      claim_outbox_event: {
        Args: {
          p_event_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          aggregate_id: string
          aggregate_version: number
          dispatch_attempt_count: number
          event_id: string
          lease_token: string
        }[]
      }
      cms_acknowledge_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_activate_schema: { Args: { p_request: Json }; Returns: Json }
      cms_activate_schema_migration: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_add_field_definition: { Args: { p_request: Json }; Returns: Json }
      cms_advance_block_lifecycle: { Args: { p_request: Json }; Returns: Json }
      cms_assign_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_author_locale_variant: { Args: { p_request: Json }; Returns: Json }
      cms_begin_schema_migration_verification: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_bind_relation: { Args: { p_request: Json }; Returns: Json }
      cms_capability_grant_read_current: {
        Args: { p_grant_id: string }
        Returns: Json
      }
      cms_claim_operational_alert: { Args: { p_request: Json }; Returns: Json }
      cms_claim_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_claim_schema_migration_lease: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_complete_operational_alert: {
        Args: { p_request: Json }
        Returns: boolean
      }
      cms_complete_schema_migration: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_create_entry: { Args: { p_request: Json }; Returns: Json }
      cms_create_revision: { Args: { p_request: Json }; Returns: Json }
      cms_create_schema_successor: { Args: { p_request: Json }; Returns: Json }
      cms_create_type_draft: { Args: { p_request: Json }; Returns: Json }
      cms_dead_letter_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_decide_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_define_template: { Args: { p_request: Json }; Returns: Json }
      cms_finalize_schema_migration_dry_run: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_content_type_version: { Args: { p_request: Json }; Returns: Json }
      cms_get_entry_draft: { Args: { p_request: Json }; Returns: Json }
      cms_get_operational_alert_exercise_eligibility: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_operational_state_snapshot: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_schema_migration_plan: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_grant_capability: { Args: { p_request: Json }; Returns: Json }
      cms_heartbeat_schema_migration_lease: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_list_capability_grants: { Args: { p_request: Json }; Returns: Json }
      cms_list_content_types: { Args: { p_request: Json }; Returns: Json }
      cms_list_revisions: { Args: { p_request: Json }; Returns: Json }
      cms_process_schema_migration_batch: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_process_schema_migration_dry_run_batch: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_read_schema_migration_source_rows: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_reconcile_schema_activation: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_register_block: { Args: { p_request: Json }; Returns: Json }
      cms_release_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_renew_capability_grant: { Args: { p_request: Json }; Returns: Json }
      cms_resolve_conflict: { Args: { p_request: Json }; Returns: Json }
      cms_resolve_template_compatibility: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_revoke_capability_grant: { Args: { p_request: Json }; Returns: Json }
      cms_rollback_schema_migration: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_start_schema_dry_run: { Args: { p_request: Json }; Returns: Json }
      cms_submit_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_sweep_expired_review_authority: {
        Args: { p_batch: number }
        Returns: Json
      }
      cms_template_context: { Args: { p_request: Json }; Returns: Json }
      cms_template_latest: { Args: { p_request: Json }; Returns: Json }
      cms_validate_locale_config: {
        Args: {
          p_chains: Json
          p_default: string
          p_source: string
          p_supported: Json
        }
        Returns: Json
      }
      cms_verify_operational_alert_delivery: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_verify_schema_migration: { Args: { p_request: Json }; Returns: Json }
      complete_outbox_event: {
        Args: { p_event_id: string; p_lease_token: string }
        Returns: boolean
      }
      complete_restore_fence: {
        Args: { p_restore_epoch: number }
        Returns: boolean
      }
      complete_upload_intent: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id?: string
          p_expected_version: number
          p_idempotency_key_hash: string
          p_job_id?: string
          p_observed_byte_size: number
          p_observed_checksum: string
          p_observed_media_type: string
          p_request_hash: string
          p_storage_adapter: string
          p_upload_intent_id: string
        }
        Returns: {
          event_id: string
          job_id: string
          object_id: string
          object_version: number
          replayed: boolean
        }[]
      }
      complete_upload_intent_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id: string
          p_expected_object_version: number
          p_idempotency_key_hash: string
          p_job_id: string
          p_observed_byte_size: number
          p_observed_checksum: string
          p_observed_media_type: string
          p_request_hash: string
          p_storage_adapter: string
          p_target_id: string
          p_target_type: string
          p_target_version: number
          p_upload_intent_id: string
        }
        Returns: {
          event_id: string
          job_id: string
          object_id: string
          object_version: number
          replayed: boolean
          target_id: string
          target_type: string
          target_version: number
        }[]
      }
      consume_job_read_rate_limit: {
        Args: { p_acting_party_id: string; p_user_id: string }
        Returns: {
          allowed: boolean
          limit_value: number
          remaining: number
          reset_at: string
          scope: string
        }[]
      }
      consumer_dead_letter_event: { Args: { p_request: Json }; Returns: Json }
      create_provider_operation: {
        Args: {
          p_acting_party_id?: string
          p_actor_id: string
          p_causation_id?: string
          p_correlation_id: string
          p_intent_hash: string
          p_operation_id?: string
          p_operation_type: string
          p_provider: string
          p_provider_idempotency_key_hash: string
        }
        Returns: {
          operation_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_provider_operation_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_causation_id: string
          p_correlation_id: string
          p_governed_payload: Json
          p_intent_hash: string
          p_operation_id: string
          p_operation_type: string
          p_provider: string
          p_provider_idempotency_key_hash: string
        }
        Returns: {
          operation_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_upload_intent: {
        Args: {
          p_actor_id: string
          p_allowed_media_types: string[]
          p_bucket: string
          p_byte_size: number
          p_checksum: string
          p_correlation_id?: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_intent_id?: string
          p_max_bytes: number
          p_media_type: string
          p_object_id?: string
          p_object_key: string
          p_owner_party_id: string
          p_purpose: string
          p_request_hash: string
          p_retention_class: string
        }
        Returns: {
          expires_at: string
          intent_id: string
          object_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_upload_intent_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_allowed_media_types: string[]
          p_bucket: string
          p_byte_size: number
          p_checksum: string
          p_correlation_id: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_intent_id: string
          p_max_bytes: number
          p_media_type: string
          p_object_id: string
          p_object_key: string
          p_purpose: string
          p_request_hash: string
          p_retention_class: string
          p_target_id: string
          p_target_type: string
          p_target_version: number
        }
        Returns: {
          expires_at: string
          intent_id: string
          object_id: string
          replayed: boolean
          target_id: string
          target_type: string
          target_version: number
          version: number
        }[]
      }
      dead_letter_unknown_outbox_event: {
        Args: { p_event_id: string; p_lease_token: string }
        Returns: boolean
      }
      external_effects_allowed: { Args: never; Returns: boolean }
      get_public_party_projection: {
        Args: { p_party_id: string }
        Returns: Json
      }
      heartbeat_job_lease: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: boolean
      }
      idempotency_expiry_sweep: {
        Args: { p_correlation_id: string; p_limit: number }
        Returns: Json
      }
      identity_alias_create: {
        Args: {
          p_display_name: string
          p_handle: string
          p_public_link_state: string
        }
        Returns: Json
      }
      identity_alias_patch: {
        Args: {
          p_alias_id: string
          p_display_name: string
          p_expected_version: number
          p_public_link_state: string
        }
        Returns: Json
      }
      identity_alias_retire: {
        Args: { p_alias_id: string; p_expected_version: number }
        Returns: Json
      }
      identity_context_bind: {
        Args: {
          p_client_binding_id: string
          p_context_id: string
          p_deliberate_confirmation: boolean
        }
        Returns: Json
      }
      identity_contexts_read: { Args: { p_cursor?: string }; Returns: Json }
      identity_create: { Args: never; Returns: Json }
      identity_facet_add: { Args: { p_facet_code: string }; Returns: Json }
      identity_facet_remove: {
        Args: { p_expected_version: number; p_facet_code: string }
        Returns: Json
      }
      identity_handle_change: {
        Args: {
          p_alias_id: string
          p_expected_version: number
          p_handle: string
        }
        Returns: Json
      }
      identity_memberships_read: {
        Args: { p_cursor?: string; p_limit?: number; p_organization_id: string }
        Returns: Json
      }
      identity_organization_read: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      identity_person_read: { Args: never; Returns: Json }
      identity_security_notification_read: {
        Args: { p_security_event_id: string }
        Returns: Json
      }
      identity_transfer_accept: {
        Args: { p_expected_version: number; p_offer_id: string }
        Returns: Json
      }
      identity_transfer_decline: {
        Args: { p_expected_version: number; p_offer_id: string }
        Returns: Json
      }
      identity_transfer_offer_create: {
        Args: { p_alias_id: string; p_recipient_person_id: string }
        Returns: Json
      }
      in_app_notification_record: { Args: { p_request: Json }; Returns: Json }
      list_harness_fixtures: {
        Args: never
        Returns: {
          id: string
          label: string
          owner_id: string
        }[]
      }
      protected_writes_allowed: { Args: never; Returns: boolean }
      read_authorized_job: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capability?: string
          p_job_id: string
          p_reason?: string
          p_step_up_verified?: boolean
        }
        Returns: {
          acting_party_id: string
          actor_id: string
          created_at: string
          error_code: string
          job_id: string
          job_type: string
          lease_until: string
          progress: Json
          result_ref: Json
          state: Database["platform_private"]["Enums"]["job_state"]
          updated_at: string
          version: number
        }[]
      }
      read_canonical_job: {
        Args: { p_job_id: string }
        Returns: {
          id: string
          lease_until: string
          state: Database["platform_private"]["Enums"]["job_state"]
          type: string
          version: number
        }[]
      }
      read_consumable_object: {
        Args: { p_object_id: string }
        Returns: {
          bucket: string
          byte_size: number
          checksum: string
          id: string
          media_type: string
          object_key: string
          version: number
        }[]
      }
      read_provider_operation_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_operation_id: string
        }
        Returns: {
          acting_party_id: string
          actor_id: string
          attempts: Json
          causation_id: string
          correlation_id: string
          governed_payload: Json
          intent_hash: string
          last_attempt_at: string
          operation_id: string
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
          provider_ref: string
          reconciliation_at: string
          state: Database["platform_private"]["Enums"]["provider_operation_state"]
          version: number
        }[]
      }
      read_recovery_provenance: {
        Args: never
        Returns: {
          artifact_digest: string
          artifact_id: string
          environment: string
          evidence_id: string
          promoted_at: string
          promotion_expires_at: string
          promotion_id: string
          provenance_kind: string
          provenance_valid: boolean
          source_revision: string
        }[]
      }
      read_recovery_verification: {
        Args: never
        Returns: {
          consumer_restore_epoch: number
          current_restore_epoch: number
          evidence_id: string
          evidence_present: boolean
          expires_at: string
          idempotency_outbox_job_verified: boolean
          integrity_verified: boolean
          measured_rpo_seconds: number
          measured_rto_seconds: number
          object_verified: boolean
          pitr_available: boolean
          pitr_status: string
          pitr_supported: boolean
          pitr_window_seconds: number
          protected_writes_allowed: boolean
          provider_webhook_verified: boolean
          public_projection_verified: boolean
          reason_code: string
          restore_epoch: number
          rls_verified: boolean
          rpc_verified: boolean
          verified_at: string
        }[]
      }
      read_restore_fence: {
        Args: never
        Returns: {
          consumer_epoch: number
          expected_epoch: number
          integrity_verified: boolean
          reconciliation_complete: boolean
        }[]
      }
      record_processed_event: {
        Args: {
          p_aggregate_id: string
          p_event_id: string
          p_event_type: string
          p_pending_manual_review: boolean
          p_schema_version: number
        }
        Returns: string
      }
      record_promoted_recovery_verification: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_artifact_digest: string
          p_artifact_id: string
          p_correlation_id?: string
          p_environment: string
          p_evidence_id?: string
          p_expires_at?: string
          p_idempotency_outbox_job_verified: boolean
          p_integrity_verified: boolean
          p_measured_rpo_seconds: number
          p_measured_rto_seconds: number
          p_object_verified: boolean
          p_pitr_supported: boolean
          p_pitr_window_seconds: number
          p_promotion_id: string
          p_provider_webhook_verified: boolean
          p_public_projection_verified: boolean
          p_restore_epoch: number
          p_rls_verified: boolean
          p_rpc_verified: boolean
          p_source_revision: string
          p_verified_at?: string
        }
        Returns: {
          evidence_id: string
          protected_writes_allowed: boolean
        }[]
      }
      record_webhook_receipt: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_correlation_id?: string
          p_external_event_id: string
          p_operation_id?: string
          p_payload_digest: string
          p_provider: string
          p_receipt_id?: string
          p_signature_verified_at: string
        }
        Returns: {
          accepted: boolean
          conflict: boolean
          duplicate: boolean
          operation_id: string
          receipt_id: string
          state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }[]
      }
      record_webhook_receipt_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_type: string
          p_external_event_id: string
          p_normalized_event: Json
          p_operation_id: string
          p_payload_digest: string
          p_provider: string
          p_receipt_id: string
          p_schema_version: number
          p_signature_verified_at: string
        }
        Returns: {
          accepted: boolean
          conflict: boolean
          duplicate: boolean
          event_type: string
          operation_id: string
          receipt_id: string
          schema_version: number
          state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }[]
      }
      rpc_accept_or_end_membership: {
        Args: {
          p_action: string
          p_counterpart_confirmation_id: string
          p_ends_on: string
          p_expected_version: number
          p_reason_code: string
          p_tenure_id: string
          p_terms_hash?: string
          p_terms_version_id: string
        }
        Returns: Json
      }
      rpc_add_capacity_period: {
        Args: {
          p_capacity: string
          p_ends_on: string
          p_expected_version: number
          p_starts_on: string
          p_tenure_id: string
        }
        Returns: Json
      }
      rpc_assert_membership: {
        Args: {
          p_ends_on: string
          p_evidence_ref: string
          p_expected_version?: number
          p_organization_id: string
          p_person_id: string
          p_starts_on: string
        }
        Returns: Json
      }
      rpc_cfg_change_action: { Args: { p_request: Json }; Returns: Json }
      rpc_cfg_propose_change: { Args: { p_request: Json }; Returns: Json }
      rpc_cfg_register_definition: { Args: { p_request: Json }; Returns: Json }
      rpc_cfg_resolve_effective_value: {
        Args: { p_request: Json }
        Returns: Json
      }
      rpc_change_organization_type: {
        Args: {
          p_action: string
          p_expected_version: number
          p_organization_id: string
          p_type_code: string
        }
        Returns: Json
      }
      rpc_convert_claim: { Args: { p_request: Json }; Returns: Json }
      rpc_create_organization: {
        Args: { p_mode: string; p_type_codes: string[] }
        Returns: Json
      }
      rpc_create_shadow_by_reference: {
        Args: { p_request: Json }
        Returns: Json
      }
      rpc_dispatch_invitation: { Args: { p_request: Json }; Returns: Json }
      rpc_invite_membership: {
        Args: {
          p_capacity: string
          p_expected_version?: number
          p_governance_mode?: string
          p_invite_expires_at: string
          p_organization_id: string
          p_person_id: string
          p_starts_on: string
          p_terms_version_id: string
        }
        Returns: Json
      }
      rpc_issue_claim_challenge: { Args: { p_request: Json }; Returns: Json }
      rpc_match_shadow: { Args: { p_request: Json }; Returns: Json }
      rpc_profile_emphasis: { Args: { p_request: Json }; Returns: Json }
      rpc_profile_observation_apply: {
        Args: { p_request: Json }
        Returns: Json
      }
      rpc_profile_public_facts: { Args: { p_party_id: string }; Returns: Json }
      rpc_profile_reel_create: { Args: { p_request: Json }; Returns: Json }
      rpc_profile_reel_patch: { Args: { p_request: Json }; Returns: Json }
      rpc_profile_reel_takedown: { Args: { p_request: Json }; Returns: Json }
      rpc_profile_section: { Args: { p_request: Json }; Returns: Json }
      rpc_read_claim: { Args: { p_request: Json }; Returns: Json }
      rpc_start_claim: { Args: { p_request: Json }; Returns: Json }
      rpc_submit_claim_proof: { Args: { p_request: Json }; Returns: Json }
      rpc_submit_remedy: { Args: { p_request: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  platform_private: {
    Tables: {
      ac265_approved_outage_target_policies: {
        Row: {
          approved_at: string
          dependency_id: string
          environment: string
          expires_at: string
          policy_ref: string
          request_limit: number
          route_method: string
          route_operation_id: string
          route_path: string
          target_validity_seconds: number
        }
        Insert: {
          approved_at: string
          dependency_id: string
          environment: string
          expires_at: string
          policy_ref: string
          request_limit: number
          route_method: string
          route_operation_id: string
          route_path: string
          target_validity_seconds: number
        }
        Update: {
          approved_at?: string
          dependency_id?: string
          environment?: string
          expires_at?: string
          policy_ref?: string
          request_limit?: number
          route_method?: string
          route_operation_id?: string
          route_path?: string
          target_validity_seconds?: number
        }
        Relationships: []
      }
      ac265_approved_outage_target_registrations: {
        Row: {
          authorization_id: string
          idempotency_ref: string
          policy_ref: string
          registered_at: string
          registration_id: string
          request_sha256: string
          target_id: string
        }
        Insert: {
          authorization_id: string
          idempotency_ref: string
          policy_ref: string
          registered_at: string
          registration_id?: string
          request_sha256: string
          target_id: string
        }
        Update: {
          authorization_id?: string
          idempotency_ref?: string
          policy_ref?: string
          registered_at?: string
          registration_id?: string
          request_sha256?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_outage_target_registration_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: true
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
          {
            foreignKeyName: "ac265_approved_outage_target_registrations_policy_ref_fkey"
            columns: ["policy_ref"]
            isOneToOne: false
            referencedRelation: "ac265_approved_outage_target_policies"
            referencedColumns: ["policy_ref"]
          },
          {
            foreignKeyName: "ac265_approved_outage_target_registrations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: true
            referencedRelation: "ac265_approved_outage_targets"
            referencedColumns: ["target_id"]
          },
        ]
      }
      ac265_approved_outage_targets: {
        Row: {
          approved_at: string
          candidate_id: string
          dependency_id: string
          deployment_id: string
          environment: string
          expires_at: string
          hosting_project_id: string
          identity_sha256: string
          route_method: string
          route_operation_id: string
          route_path: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
          target_id: string
          target_ref: string
          target_sha256: string
        }
        Insert: {
          approved_at: string
          candidate_id: string
          dependency_id: string
          deployment_id: string
          environment: string
          expires_at: string
          hosting_project_id: string
          identity_sha256: string
          route_method: string
          route_operation_id: string
          route_path: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
          target_id?: string
          target_ref: string
          target_sha256: string
        }
        Update: {
          approved_at?: string
          candidate_id?: string
          dependency_id?: string
          deployment_id?: string
          environment?: string
          expires_at?: string
          hosting_project_id?: string
          identity_sha256?: string
          route_method?: string
          route_operation_id?: string
          route_path?: string
          run_id?: string
          source_revision?: string
          supabase_project_ref?: string
          target_id?: string
          target_ref?: string
          target_sha256?: string
        }
        Relationships: []
      }
      ac265_approved_registry_resources: {
        Row: {
          approval_ref: string
          environment: string
          locator_sha256: string
          resource_kind: string
        }
        Insert: {
          approval_ref: string
          environment: string
          locator_sha256: string
          resource_kind: string
        }
        Update: {
          approval_ref?: string
          environment?: string
          locator_sha256?: string
          resource_kind?: string
        }
        Relationships: []
      }
      ac265_approved_registry_role_kinds: {
        Row: {
          approval_ref: string
          environment: string
          resource_kind: string
          role_key: string
        }
        Insert: {
          approval_ref: string
          environment: string
          resource_kind: string
          role_key: string
        }
        Update: {
          approval_ref?: string
          environment?: string
          resource_kind?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_registry_role_kinds_resource_kind_fkey"
            columns: ["resource_kind"]
            isOneToOne: false
            referencedRelation: "ac265_approved_registry_resources"
            referencedColumns: ["resource_kind"]
          },
        ]
      }
      ac265_approved_registry_scenario_roles: {
        Row: {
          approval_ref: string
          environment: string
          role_key: string
          scenario_key: string
        }
        Insert: {
          approval_ref: string
          environment: string
          role_key: string
          scenario_key: string
        }
        Update: {
          approval_ref?: string
          environment?: string
          role_key?: string
          scenario_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_registry_scenario_roles_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "ac265_approved_registry_role_kinds"
            referencedColumns: ["role_key"]
          },
        ]
      }
      ac265_approved_runner_mapping_resources: {
        Row: {
          mapping_id: string
          mapping_resource_id: string
          ordinal: number
          resource_id: string
          role_key: string
        }
        Insert: {
          mapping_id: string
          mapping_resource_id?: string
          ordinal: number
          resource_id: string
          role_key: string
        }
        Update: {
          mapping_id?: string
          mapping_resource_id?: string
          ordinal?: number
          resource_id?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_runner_mapping_resources_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "ac265_approved_runner_mappings"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "ac265_approved_runner_mapping_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "ac265_approved_safe_resources"
            referencedColumns: ["resource_id"]
          },
        ]
      }
      ac265_approved_runner_mapping_scenarios: {
        Row: {
          mapping_id: string
          mapping_scenario_id: string
          ordinal: number
          role_key: string
          scenario_key: string
        }
        Insert: {
          mapping_id: string
          mapping_scenario_id?: string
          ordinal: number
          role_key: string
          scenario_key: string
        }
        Update: {
          mapping_id?: string
          mapping_scenario_id?: string
          ordinal?: number
          role_key?: string
          scenario_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_runner_mapping_scenarios_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "ac265_approved_runner_mappings"
            referencedColumns: ["mapping_id"]
          },
        ]
      }
      ac265_approved_runner_mappings: {
        Row: {
          approved_at: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity: Json
          identity_sha256: string
          mapping_id: string
          request_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Insert: {
          approved_at: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity: Json
          identity_sha256: string
          mapping_id?: string
          request_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Update: {
          approved_at?: string
          authorization_id?: string
          candidate_id?: string
          deployment_id?: string
          environment?: string
          hosting_project_id?: string
          idempotency_ref?: string
          identity?: Json
          identity_sha256?: string
          mapping_id?: string
          request_sha256?: string
          run_id?: string
          source_revision?: string
          supabase_project_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_runner_mappings_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
        ]
      }
      ac265_approved_safe_resources: {
        Row: {
          approved_at: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          locator_sha256: string
          request_sha256: string
          resource_id: string
          resource_kind: string
          resource_ref: string
          resource_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Insert: {
          approved_at: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          locator_sha256: string
          request_sha256: string
          resource_id?: string
          resource_kind: string
          resource_ref: string
          resource_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Update: {
          approved_at?: string
          authorization_id?: string
          candidate_id?: string
          deployment_id?: string
          environment?: string
          hosting_project_id?: string
          idempotency_ref?: string
          identity_sha256?: string
          locator_sha256?: string
          request_sha256?: string
          resource_id?: string
          resource_kind?: string
          resource_ref?: string
          resource_sha256?: string
          run_id?: string
          source_revision?: string
          supabase_project_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_approved_safe_resources_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
        ]
      }
      ac265_hosted_artifact_manifest_finalizations: {
        Row: {
          authorization_id: string
          finalization_id: string
          finalization_ref: string
          finalized_at: string
          manifest_id: string
          manifest_sha256: string
          request_sha256: string
        }
        Insert: {
          authorization_id: string
          finalization_id?: string
          finalization_ref: string
          finalized_at: string
          manifest_id: string
          manifest_sha256: string
          request_sha256: string
        }
        Update: {
          authorization_id?: string
          finalization_id?: string
          finalization_ref?: string
          finalized_at?: string
          manifest_id?: string
          manifest_sha256?: string
          request_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_hosted_artifact_manifest_finalizati_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
          {
            foreignKeyName: "ac265_hosted_artifact_manifest_finalizations_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: true
            referencedRelation: "ac265_hosted_artifact_manifests"
            referencedColumns: ["manifest_id"]
          },
        ]
      }
      ac265_hosted_artifact_manifest_sources: {
        Row: {
          artifact_kind: string
          artifact_ref: string
          artifact_sha256: string
          attestation_key_id: string
          attestation_sha256: string
          expires_at: string
          issued_at: string
          manifest_id: string
          source_id: string
          source_ordinal: number
          subject_sha256: string
        }
        Insert: {
          artifact_kind: string
          artifact_ref: string
          artifact_sha256: string
          attestation_key_id: string
          attestation_sha256: string
          expires_at: string
          issued_at: string
          manifest_id: string
          source_id?: string
          source_ordinal: number
          subject_sha256: string
        }
        Update: {
          artifact_kind?: string
          artifact_ref?: string
          artifact_sha256?: string
          attestation_key_id?: string
          attestation_sha256?: string
          expires_at?: string
          issued_at?: string
          manifest_id?: string
          source_id?: string
          source_ordinal?: number
          subject_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_hosted_artifact_manifest_sources_artifact_ref_fkey"
            columns: ["artifact_ref"]
            isOneToOne: false
            referencedRelation: "ac265_hosted_artifact_replay_ledger"
            referencedColumns: ["artifact_ref"]
          },
          {
            foreignKeyName: "ac265_hosted_artifact_manifest_sources_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "ac265_hosted_artifact_manifests"
            referencedColumns: ["manifest_id"]
          },
        ]
      }
      ac265_hosted_artifact_manifests: {
        Row: {
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          kind_complete: boolean
          manifest_id: string
          manifest_ref: string
          registered_at: string
          request_sha256: string
          run_id: string
          source_count: number
          source_revision: string
          source_set_complete: boolean
          supabase_project_ref: string
        }
        Insert: {
          authorization_id: string
          candidate_id: string
          deployment_id: string
          environment: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          kind_complete: boolean
          manifest_id?: string
          manifest_ref: string
          registered_at: string
          request_sha256: string
          run_id: string
          source_count: number
          source_revision: string
          source_set_complete: boolean
          supabase_project_ref: string
        }
        Update: {
          authorization_id?: string
          candidate_id?: string
          deployment_id?: string
          environment?: string
          hosting_project_id?: string
          idempotency_ref?: string
          identity_sha256?: string
          kind_complete?: boolean
          manifest_id?: string
          manifest_ref?: string
          registered_at?: string
          request_sha256?: string
          run_id?: string
          source_count?: number
          source_revision?: string
          source_set_complete?: boolean
          supabase_project_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_hosted_artifact_manifests_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: true
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
        ]
      }
      ac265_hosted_artifact_replay_ledger: {
        Row: {
          artifact_kind: string
          artifact_ref: string
          artifact_sha256: string
          attestation_key_id: string
          attestation_sha256: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          expires_at: string
          first_seen_at: string
          hosting_project_id: string
          identity_sha256: string
          issued_at: string
          manifest_id: string
          run_id: string
          source_revision: string
          subject_sha256: string
          supabase_project_ref: string
        }
        Insert: {
          artifact_kind: string
          artifact_ref: string
          artifact_sha256: string
          attestation_key_id: string
          attestation_sha256: string
          authorization_id: string
          candidate_id: string
          deployment_id: string
          expires_at: string
          first_seen_at: string
          hosting_project_id: string
          identity_sha256: string
          issued_at: string
          manifest_id: string
          run_id: string
          source_revision: string
          subject_sha256: string
          supabase_project_ref: string
        }
        Update: {
          artifact_kind?: string
          artifact_ref?: string
          artifact_sha256?: string
          attestation_key_id?: string
          attestation_sha256?: string
          authorization_id?: string
          candidate_id?: string
          deployment_id?: string
          expires_at?: string
          first_seen_at?: string
          hosting_project_id?: string
          identity_sha256?: string
          issued_at?: string
          manifest_id?: string
          run_id?: string
          source_revision?: string
          subject_sha256?: string
          supabase_project_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_hosted_artifact_replay_ledger_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
          {
            foreignKeyName: "ac265_hosted_artifact_replay_ledger_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "ac265_hosted_artifact_manifests"
            referencedColumns: ["manifest_id"]
          },
        ]
      }
      ac265_hosted_outage_leases: {
        Row: {
          acquire_request_sha256: string
          acquired_at: string
          authorization_id: string
          consume_request_sha256: string | null
          consumed_at: string | null
          consumed_idempotency_ref: string | null
          dependency_id: string
          deployment_id: string
          environment: string
          expires_at: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          lease_duration_seconds: number
          lease_id: string
          lease_ref: string
          lease_sha256: string
          release_request_sha256: string | null
          released_at: string | null
          released_idempotency_ref: string | null
          request_limit: number
          route_method: string
          route_operation_id: string
          route_path: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
          target_id: string
          target_sha256: string
        }
        Insert: {
          acquire_request_sha256: string
          acquired_at: string
          authorization_id: string
          consume_request_sha256?: string | null
          consumed_at?: string | null
          consumed_idempotency_ref?: string | null
          dependency_id: string
          deployment_id: string
          environment?: string
          expires_at: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          lease_duration_seconds?: number
          lease_id?: string
          lease_ref: string
          lease_sha256: string
          release_request_sha256?: string | null
          released_at?: string | null
          released_idempotency_ref?: string | null
          request_limit?: number
          route_method: string
          route_operation_id: string
          route_path: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
          target_id: string
          target_sha256: string
        }
        Update: {
          acquire_request_sha256?: string
          acquired_at?: string
          authorization_id?: string
          consume_request_sha256?: string | null
          consumed_at?: string | null
          consumed_idempotency_ref?: string | null
          dependency_id?: string
          deployment_id?: string
          environment?: string
          expires_at?: string
          hosting_project_id?: string
          idempotency_ref?: string
          identity_sha256?: string
          lease_duration_seconds?: number
          lease_id?: string
          lease_ref?: string
          lease_sha256?: string
          release_request_sha256?: string | null
          released_at?: string | null
          released_idempotency_ref?: string | null
          request_limit?: number
          route_method?: string
          route_operation_id?: string
          route_path?: string
          run_id?: string
          source_revision?: string
          supabase_project_ref?: string
          target_id?: string
          target_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_hosted_outage_leases_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
          {
            foreignKeyName: "ac265_hosted_outage_leases_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "ac265_approved_outage_targets"
            referencedColumns: ["target_id"]
          },
        ]
      }
      ac265_runner_authorization_jtis: {
        Row: {
          authorization_id: string
          jti_sha256: string
        }
        Insert: {
          authorization_id: string
          jti_sha256: string
        }
        Update: {
          authorization_id?: string
          jti_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_runner_authorization_jtis_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
        ]
      }
      ac265_runner_authorizations: {
        Row: {
          authorization_id: string
          authorized_at: string
          deployment_id: string
          expires_at: string
          github_run_attempt: number
          github_run_id: string
          identity_sha256: string
          jti_sha256: string
          request_sha256: string
          run_id: string
          source_revision: string
          workflow_sha: string
        }
        Insert: {
          authorization_id?: string
          authorized_at: string
          deployment_id: string
          expires_at: string
          github_run_attempt: number
          github_run_id: string
          identity_sha256: string
          jti_sha256: string
          request_sha256: string
          run_id: string
          source_revision: string
          workflow_sha: string
        }
        Update: {
          authorization_id?: string
          authorized_at?: string
          deployment_id?: string
          expires_at?: string
          github_run_attempt?: number
          github_run_id?: string
          identity_sha256?: string
          jti_sha256?: string
          request_sha256?: string
          run_id?: string
          source_revision?: string
          workflow_sha?: string
        }
        Relationships: []
      }
      ac265_session_broker_handle_roles: {
        Row: {
          broker_authorization_id: string
          handle_id: string
          handle_ref: string
          handle_sha256: string
          last_resolve_idempotency_ref: string | null
          last_resolve_request_sha256: string | null
          last_resolved_at: string | null
          last_teardown_idempotency_ref: string | null
          last_teardown_request_sha256: string | null
          logged_out_at: string | null
          material_ref: string
          resolve_limit: number
          resolves: number
          role: string
        }
        Insert: {
          broker_authorization_id: string
          handle_id?: string
          handle_ref: string
          handle_sha256: string
          last_resolve_idempotency_ref?: string | null
          last_resolve_request_sha256?: string | null
          last_resolved_at?: string | null
          last_teardown_idempotency_ref?: string | null
          last_teardown_request_sha256?: string | null
          logged_out_at?: string | null
          material_ref: string
          resolve_limit?: number
          resolves?: number
          role: string
        }
        Update: {
          broker_authorization_id?: string
          handle_id?: string
          handle_ref?: string
          handle_sha256?: string
          last_resolve_idempotency_ref?: string | null
          last_resolve_request_sha256?: string | null
          last_resolved_at?: string | null
          last_teardown_idempotency_ref?: string | null
          last_teardown_request_sha256?: string | null
          logged_out_at?: string | null
          material_ref?: string
          resolve_limit?: number
          resolves?: number
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_session_broker_handle_roles_broker_authorization_id_fkey"
            columns: ["broker_authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_session_broker_handles"
            referencedColumns: ["broker_authorization_id"]
          },
        ]
      }
      ac265_session_broker_handles: {
        Row: {
          authorization_id: string
          authorized_at: string
          broker_authorization_id: string
          deployment_id: string
          environment: string
          expires_at: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          request_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Insert: {
          authorization_id: string
          authorized_at: string
          broker_authorization_id?: string
          deployment_id: string
          environment?: string
          expires_at: string
          hosting_project_id: string
          idempotency_ref: string
          identity_sha256: string
          request_sha256: string
          run_id: string
          source_revision: string
          supabase_project_ref: string
        }
        Update: {
          authorization_id?: string
          authorized_at?: string
          broker_authorization_id?: string
          deployment_id?: string
          environment?: string
          expires_at?: string
          hosting_project_id?: string
          idempotency_ref?: string
          identity_sha256?: string
          request_sha256?: string
          run_id?: string
          source_revision?: string
          supabase_project_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac265_session_broker_handles_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "ac265_runner_authorizations"
            referencedColumns: ["authorization_id"]
          },
        ]
      }
      ac265_verified_candidates: {
        Row: {
          candidate_id: string
          ci_artifact_id: number
          ci_run_attempt: number
          ci_run_id: string
          deployment_id: string
          enrolled_at: string
          identity: Json
          identity_sha256: string
          provenance: Json
          source_revision: string
          staging_artifact_id: number
          staging_run_attempt: number
          staging_run_id: string
        }
        Insert: {
          candidate_id?: string
          ci_artifact_id: number
          ci_run_attempt: number
          ci_run_id: string
          deployment_id: string
          enrolled_at?: string
          identity: Json
          identity_sha256: string
          provenance: Json
          source_revision: string
          staging_artifact_id: number
          staging_run_attempt: number
          staging_run_id: string
        }
        Update: {
          candidate_id?: string
          ci_artifact_id?: number
          ci_run_attempt?: number
          ci_run_id?: string
          deployment_id?: string
          enrolled_at?: string
          identity?: Json
          identity_sha256?: string
          provenance?: Json
          source_revision?: string
          staging_artifact_id?: number
          staging_run_attempt?: number
          staging_run_id?: string
        }
        Relationships: []
      }
      acting_context_binding: {
        Row: {
          acting_party_id: string
          client_binding_id: string
          context_kind: string
          created_at: string
          expires_at: string
          id: string
          last_seen_at: string
          person_id: string
          projection_version: number
          selected_at: string
          source_relationship_id: string | null
          state: Database["platform_private"]["Enums"]["context_binding_state"]
          updated_at: string
          version: number
        }
        Insert: {
          acting_party_id: string
          client_binding_id: string
          context_kind: string
          created_at?: string
          expires_at: string
          id?: string
          last_seen_at?: string
          person_id: string
          projection_version?: number
          selected_at?: string
          source_relationship_id?: string | null
          state?: Database["platform_private"]["Enums"]["context_binding_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          acting_party_id?: string
          client_binding_id?: string
          context_kind?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_seen_at?: string
          person_id?: string
          projection_version?: number
          selected_at?: string
          source_relationship_id?: string | null
          state?: Database["platform_private"]["Enums"]["context_binding_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "acting_context_binding_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acting_context_binding_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "acting_context_binding_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "acting_context_binding_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      admin_audit_links: {
        Row: {
          audit_event_id: string | null
          change_id: string | null
          content_revision_id: string | null
          created_at: string
          financial_audit_id: string | null
          id: string
          safe_label: string
          security_event_id: string | null
          source_id: string
          source_type: string
          source_version: number
        }
        Insert: {
          audit_event_id?: string | null
          change_id?: string | null
          content_revision_id?: string | null
          created_at?: string
          financial_audit_id?: string | null
          id?: string
          safe_label: string
          security_event_id?: string | null
          source_id: string
          source_type: string
          source_version: number
        }
        Update: {
          audit_event_id?: string | null
          change_id?: string | null
          content_revision_id?: string | null
          created_at?: string
          financial_audit_id?: string | null
          id?: string
          safe_label?: string
          security_event_id?: string | null
          source_id?: string
          source_type?: string
          source_version?: number
        }
        Relationships: []
      }
      admin_bulk_item_results: {
        Row: {
          attempt_count: number
          completed_at: string | null
          expected_version: number
          id: string
          operation_id: string
          result_code: string | null
          result_summary: Json | null
          state: string
          target_id: string
          target_type: string
          version_no: number
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          expected_version: number
          id?: string
          operation_id: string
          result_code?: string | null
          result_summary?: Json | null
          state: string
          target_id: string
          target_type: string
          version_no?: number
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          expected_version?: number
          id?: string
          operation_id?: string
          result_code?: string | null
          result_summary?: Json | null
          state?: string
          target_id?: string
          target_type?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_bulk_item_results_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "admin_bulk_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_bulk_operations: {
        Row: {
          acting_party_id: string | null
          actor_person_id: string
          cancelled_at: string | null
          command_key: string
          command_version: number
          created_at: string
          cursor: number
          dry_run_report: Json | null
          failure_count: number
          id: string
          idempotency_key: string
          query_spec: Json | null
          skipped_count: number
          state: string
          success_count: number
          target_count: number
          target_manifest_hash: string
          target_manifest_object_id: string
          updated_at: string
          version_no: number
        }
        Insert: {
          acting_party_id?: string | null
          actor_person_id: string
          cancelled_at?: string | null
          command_key: string
          command_version: number
          created_at?: string
          cursor?: number
          dry_run_report?: Json | null
          failure_count?: number
          id?: string
          idempotency_key: string
          query_spec?: Json | null
          skipped_count?: number
          state: string
          success_count?: number
          target_count: number
          target_manifest_hash: string
          target_manifest_object_id: string
          updated_at?: string
          version_no?: number
        }
        Update: {
          acting_party_id?: string | null
          actor_person_id?: string
          cancelled_at?: string | null
          command_key?: string
          command_version?: number
          created_at?: string
          cursor?: number
          dry_run_report?: Json | null
          failure_count?: number
          id?: string
          idempotency_key?: string
          query_spec?: Json | null
          skipped_count?: number
          state?: string
          success_count?: number
          target_count?: number
          target_manifest_hash?: string
          target_manifest_object_id?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_bulk_operations_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_bulk_operations_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_bulk_operations_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_bulk_operations_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_bulk_operations_target_manifest_object_id_fkey"
            columns: ["target_manifest_object_id"]
            isOneToOne: false
            referencedRelation: "object_records"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_capability_grants: {
        Row: {
          actions: string[]
          approver_person_id: string | null
          capability_key: string
          created_at: string
          ends_at: string
          grantor_person_id: string
          id: string
          purpose_grant: boolean
          reason: string
          resource_id: string
          resource_type: string
          revoked_at: string | null
          revoked_by: string | null
          scope: Json
          starts_at: string
          state: string
          subject_person_id: string
          version_no: number
        }
        Insert: {
          actions: string[]
          approver_person_id?: string | null
          capability_key: string
          created_at?: string
          ends_at: string
          grantor_person_id: string
          id?: string
          purpose_grant: boolean
          reason: string
          resource_id: string
          resource_type: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope: Json
          starts_at: string
          state: string
          subject_person_id: string
          version_no: number
        }
        Update: {
          actions?: string[]
          approver_person_id?: string | null
          capability_key?: string
          created_at?: string
          ends_at?: string
          grantor_person_id?: string
          id?: string
          purpose_grant?: boolean
          reason?: string
          resource_id?: string
          resource_type?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: Json
          starts_at?: string
          state?: string
          subject_person_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_capability_grants_approver_person_id_fkey"
            columns: ["approver_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_approver_person_id_fkey"
            columns: ["approver_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_approver_person_id_fkey"
            columns: ["approver_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_grantor_person_id_fkey"
            columns: ["grantor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_grantor_person_id_fkey"
            columns: ["grantor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_grantor_person_id_fkey"
            columns: ["grantor_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_capability_grants_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      admin_diagnostic_definition_versions: {
        Row: {
          created_at: string
          evidence_schema: Json
          freshness_seconds: number
          hash: string
          id: string
          input_schema: Json
          key: string
          lifecycle: string
          owner_capability: string
          runbook_ref: string
          severity_mapping: Json
          timeout_ms: number
          version_no: number
        }
        Insert: {
          created_at?: string
          evidence_schema: Json
          freshness_seconds: number
          hash: string
          id?: string
          input_schema: Json
          key: string
          lifecycle: string
          owner_capability: string
          runbook_ref: string
          severity_mapping: Json
          timeout_ms: number
          version_no: number
        }
        Update: {
          created_at?: string
          evidence_schema?: Json
          freshness_seconds?: number
          hash?: string
          id?: string
          input_schema?: Json
          key?: string
          lifecycle?: string
          owner_capability?: string
          runbook_ref?: string
          severity_mapping?: Json
          timeout_ms?: number
          version_no?: number
        }
        Relationships: []
      }
      admin_diagnostic_runs: {
        Row: {
          actor_person_id: string | null
          completed_at: string | null
          created_at: string
          definition_id: string
          definition_version: number
          evidence_ref: string | null
          freshness_at: string | null
          id: string
          job_id: string | null
          result_codes: string[]
          started_at: string
          state: string
          target_id: string
          target_type: string
          target_version: number | null
          version_no: number
        }
        Insert: {
          actor_person_id?: string | null
          completed_at?: string | null
          created_at?: string
          definition_id: string
          definition_version: number
          evidence_ref?: string | null
          freshness_at?: string | null
          id?: string
          job_id?: string | null
          result_codes?: string[]
          started_at?: string
          state: string
          target_id: string
          target_type: string
          target_version?: number | null
          version_no?: number
        }
        Update: {
          actor_person_id?: string | null
          completed_at?: string | null
          created_at?: string
          definition_id?: string
          definition_version?: number
          evidence_ref?: string | null
          freshness_at?: string | null
          id?: string
          job_id?: string | null
          result_codes?: string[]
          started_at?: string
          state?: string
          target_id?: string
          target_type?: string
          target_version?: number | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_diagnostic_runs_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_diagnostic_runs_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_diagnostic_runs_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_diagnostic_runs_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "admin_diagnostic_definition_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_diagnostic_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_mfa_factor_resets: {
        Row: {
          completed_at: string | null
          created_at: string
          grant_id: string
          id: string
          idempotency_key: string
          moved_factor_ids: string[]
          operator_person_id: string
          organization_id: string
          outbox_event_id: string
          reason: string
          removed_factor_count: number
          state: string
          target_person_id: string
          version_no: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          grant_id: string
          id?: string
          idempotency_key: string
          moved_factor_ids?: string[]
          operator_person_id: string
          organization_id: string
          outbox_event_id: string
          reason: string
          removed_factor_count?: number
          state: string
          target_person_id: string
          version_no?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          grant_id?: string
          id?: string
          idempotency_key?: string
          moved_factor_ids?: string[]
          operator_person_id?: string
          organization_id?: string
          outbox_event_id?: string
          reason?: string
          removed_factor_count?: number
          state?: string
          target_person_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "admin_mfa_factor_resets_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "admin_capability_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_operator_person_id_fkey"
            columns: ["operator_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_operator_person_id_fkey"
            columns: ["operator_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_operator_person_id_fkey"
            columns: ["operator_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_mfa_factor_resets_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      admin_task_projections: {
        Row: {
          assignee_person_id: string | null
          created_at: string
          due_at: string | null
          freshness_at: string
          freshness_state: string
          id: string
          last_error_code: string | null
          required_capability: string
          severity: string
          source_id: string
          source_status: string
          source_type: string
          source_version: number
          state: string
          task_class: string
          updated_at: string
        }
        Insert: {
          assignee_person_id?: string | null
          created_at?: string
          due_at?: string | null
          freshness_at: string
          freshness_state: string
          id?: string
          last_error_code?: string | null
          required_capability: string
          severity: string
          source_id: string
          source_status: string
          source_type: string
          source_version: number
          state: string
          task_class: string
          updated_at?: string
        }
        Update: {
          assignee_person_id?: string | null
          created_at?: string
          due_at?: string | null
          freshness_at?: string
          freshness_state?: string
          id?: string
          last_error_code?: string | null
          required_capability?: string
          severity?: string
          source_id?: string
          source_status?: string
          source_type?: string
          source_version?: number
          state?: string
          task_class?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_task_projections_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "admin_task_projections_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "admin_task_projections_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      alias_ownership_period: {
        Row: {
          alias_id: string
          created_at: string
          ends_at: string | null
          id: string
          owner_person_id: string
          starts_at: string
          transfer_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          alias_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          owner_person_id: string
          starts_at: string
          transfer_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          alias_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          owner_person_id?: string
          starts_at?: string
          transfer_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "alias_ownership_period_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "alias_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_ownership_period_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "identity_public_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_ownership_period_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_ownership_period_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "alias_ownership_period_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_ownership_period_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "alias_transfer_offer"
            referencedColumns: ["id"]
          },
        ]
      }
      alias_party: {
        Row: {
          created_at: string
          current_handle_id: string
          display_name: string
          lifecycle: Database["platform_private"]["Enums"]["alias_lifecycle"]
          party_id: string
          public_link_state: Database["platform_private"]["Enums"]["public_link_state"]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          current_handle_id: string
          display_name: string
          lifecycle?: Database["platform_private"]["Enums"]["alias_lifecycle"]
          party_id: string
          public_link_state?: Database["platform_private"]["Enums"]["public_link_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          current_handle_id?: string
          display_name?: string
          lifecycle?: Database["platform_private"]["Enums"]["alias_lifecycle"]
          party_id?: string
          public_link_state?: Database["platform_private"]["Enums"]["public_link_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "alias_party_current_handle_id_fkey"
            columns: ["current_handle_id"]
            isOneToOne: false
            referencedRelation: "handle_reservation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alias_party_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      alias_transfer_offer: {
        Row: {
          accepted_at: string | null
          alias_id: string
          closed_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          id: string
          offered_at: string
          offering_person_id: string
          recipient_person_id: string
          state: Database["platform_private"]["Enums"]["transfer_offer_state"]
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          alias_id: string
          closed_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at: string
          id?: string
          offered_at?: string
          offering_person_id: string
          recipient_person_id: string
          state?: Database["platform_private"]["Enums"]["transfer_offer_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          alias_id?: string
          closed_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          id?: string
          offered_at?: string
          offering_person_id?: string
          recipient_person_id?: string
          state?: Database["platform_private"]["Enums"]["transfer_offer_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "alias_transfer_offer_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "alias_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "identity_public_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_offering_person_id_fkey"
            columns: ["offering_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_offering_person_id_fkey"
            columns: ["offering_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_offering_person_id_fkey"
            columns: ["offering_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "alias_transfer_offer_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cfg_config_approvals: {
        Row: {
          acting_party_id: string | null
          capability: string
          decided_at: string
          decision: string
          reason: string
          review_id: string
          review_version: number
          reviewed_hash: string
          reviewer_person_id: string
        }
        Insert: {
          acting_party_id?: string | null
          capability: string
          decided_at?: string
          decision: string
          reason: string
          review_id: string
          review_version: number
          reviewed_hash: string
          reviewer_person_id: string
        }
        Update: {
          acting_party_id?: string | null
          capability?: string
          decided_at?: string
          decision?: string
          reason?: string
          review_id?: string
          review_version?: number
          reviewed_hash?: string
          reviewer_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cfg_config_approvals_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_config_approvals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "cfg_config_change_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cfg_config_change_reviews: {
        Row: {
          candidate_id: string
          candidate_type: string
          candidate_version: number
          created_at: string
          effective_context_hash: string | null
          frozen_hash: string
          id: string
          impact_manifest: Json
          impact_manifest_hash: string
          required_approvals: number
          risk_class: string
          rollback_hash: string | null
          rollback_value: Json | null
          state: string
          submitted_at: string
          submitted_by: string
          updated_at: string
          version_no: number
        }
        Insert: {
          candidate_id: string
          candidate_type: string
          candidate_version: number
          created_at?: string
          effective_context_hash?: string | null
          frozen_hash: string
          id?: string
          impact_manifest: Json
          impact_manifest_hash: string
          required_approvals: number
          risk_class: string
          rollback_hash?: string | null
          rollback_value?: Json | null
          state: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
          version_no?: number
        }
        Update: {
          candidate_id?: string
          candidate_type?: string
          candidate_version?: number
          created_at?: string
          effective_context_hash?: string | null
          frozen_hash?: string
          id?: string
          impact_manifest?: Json
          impact_manifest_hash?: string
          required_approvals?: number
          risk_class?: string
          rollback_hash?: string | null
          rollback_value?: Json | null
          state?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: []
      }
      cfg_experiment_versions: {
        Row: {
          allocation: Json
          consent_ref: string | null
          created_at: string
          created_by: string
          eligibility_dimensions: string[]
          ends_at: string
          hypothesis: string
          id: string
          key: string
          metrics: string[]
          owner_person_id: string
          starts_at: string
          state: string
          stop_rule: Json
          variants: Json
          version_no: number
        }
        Insert: {
          allocation: Json
          consent_ref?: string | null
          created_at?: string
          created_by: string
          eligibility_dimensions: string[]
          ends_at: string
          hypothesis: string
          id?: string
          key: string
          metrics: string[]
          owner_person_id: string
          starts_at: string
          state: string
          stop_rule: Json
          variants: Json
          version_no: number
        }
        Update: {
          allocation?: Json
          consent_ref?: string | null
          created_at?: string
          created_by?: string
          eligibility_dimensions?: string[]
          ends_at?: string
          hypothesis?: string
          id?: string
          key?: string
          metrics?: string[]
          owner_person_id?: string
          starts_at?: string
          state?: string
          stop_rule?: Json
          variants?: Json
          version_no?: number
        }
        Relationships: []
      }
      cfg_feature_flag_versions: {
        Row: {
          allocation: Json
          created_at: string
          created_by: string
          dependencies: string[]
          eligibility_rule_key: string
          eligibility_rule_version: number
          ends_at: string
          environments: string[]
          expires_at: string
          fallback: Json
          id: string
          key: string
          owner_person_id: string
          purpose: string
          starts_at: string
          state: string
          version_no: number
        }
        Insert: {
          allocation: Json
          created_at?: string
          created_by: string
          dependencies?: string[]
          eligibility_rule_key: string
          eligibility_rule_version: number
          ends_at: string
          environments: string[]
          expires_at: string
          fallback: Json
          id?: string
          key: string
          owner_person_id: string
          purpose: string
          starts_at: string
          state: string
          version_no: number
        }
        Update: {
          allocation?: Json
          created_at?: string
          created_by?: string
          dependencies?: string[]
          eligibility_rule_key?: string
          eligibility_rule_version?: number
          ends_at?: string
          environments?: string[]
          expires_at?: string
          fallback?: Json
          id?: string
          key?: string
          owner_person_id?: string
          purpose?: string
          starts_at?: string
          state?: string
          version_no?: number
        }
        Relationships: []
      }
      cfg_kill_switch_activations: {
        Row: {
          acting_party_id: string | null
          actor_person_id: string
          canonical_state: string
          created_at: string
          ends_at: string | null
          id: string
          incident_ref: string
          reason: string
          resolved_at: string | null
          runtime_snapshot_hash: string
          scope_id: string | null
          scope_type: string
          started_at: string
          switch_id: string
          switch_version_id: string
          version_no: number
        }
        Insert: {
          acting_party_id?: string | null
          actor_person_id: string
          canonical_state: string
          created_at?: string
          ends_at?: string | null
          id?: string
          incident_ref: string
          reason: string
          resolved_at?: string | null
          runtime_snapshot_hash: string
          scope_id?: string | null
          scope_type: string
          started_at: string
          switch_id: string
          switch_version_id: string
          version_no: number
        }
        Update: {
          acting_party_id?: string | null
          actor_person_id?: string
          canonical_state?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          incident_ref?: string
          reason?: string
          resolved_at?: string | null
          runtime_snapshot_hash?: string
          scope_id?: string | null
          scope_type?: string
          started_at?: string
          switch_id?: string
          switch_version_id?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "cfg_kill_switch_activations_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_kill_switch_activations_switch_id_fkey"
            columns: ["switch_id"]
            isOneToOne: false
            referencedRelation: "cfg_kill_switch_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_kill_switch_activations_switch_version_id_fkey"
            columns: ["switch_version_id"]
            isOneToOne: false
            referencedRelation: "cfg_kill_switch_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cfg_kill_switch_versions: {
        Row: {
          allowed_scopes: Json
          created_at: string
          fallback_mode: string
          id: string
          key: string
          owner_person_id: string
          runtime_contract_version: number
          state: string
          version_no: number
        }
        Insert: {
          allowed_scopes: Json
          created_at?: string
          fallback_mode: string
          id?: string
          key: string
          owner_person_id: string
          runtime_contract_version: number
          state: string
          version_no: number
        }
        Update: {
          allowed_scopes?: Json
          created_at?: string
          fallback_mode?: string
          id?: string
          key?: string
          owner_person_id?: string
          runtime_contract_version?: number
          state?: string
          version_no?: number
        }
        Relationships: []
      }
      cfg_release_principals: {
        Row: {
          active: boolean
          created_at: string
          key_id: string
          principal_id: string
          public_key: string | null
          revoked_at: string | null
          scope: string
          valid_from: string | null
          valid_through: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          key_id: string
          principal_id: string
          public_key?: string | null
          revoked_at?: string | null
          scope?: string
          valid_from?: string | null
          valid_through?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          key_id?: string
          principal_id?: string
          public_key?: string | null
          revoked_at?: string | null
          scope?: string
          valid_from?: string | null
          valid_through?: string | null
        }
        Relationships: []
      }
      cfg_setting_definition_versions: {
        Row: {
          allowed_scopes: string[]
          approver_policy: Json
          consumer_keys: string[]
          contract_release: string
          created_at: string
          created_by: string
          default_source: string
          default_value: Json | null
          definition_id: string
          deprecated_at: string | null
          hash: string
          id: string
          key: string
          lifecycle: string
          merge_mode: string
          owner_capability: string
          precedence: string[]
          risk_class: string
          schema: Json
          sensitivity: string
          value_kind: string
          version_no: number
        }
        Insert: {
          allowed_scopes: string[]
          approver_policy: Json
          consumer_keys?: string[]
          contract_release: string
          created_at?: string
          created_by: string
          default_source: string
          default_value?: Json | null
          definition_id: string
          deprecated_at?: string | null
          hash: string
          id?: string
          key: string
          lifecycle?: string
          merge_mode: string
          owner_capability: string
          precedence: string[]
          risk_class: string
          schema: Json
          sensitivity: string
          value_kind: string
          version_no: number
        }
        Update: {
          allowed_scopes?: string[]
          approver_policy?: Json
          consumer_keys?: string[]
          contract_release?: string
          created_at?: string
          created_by?: string
          default_source?: string
          default_value?: Json | null
          definition_id?: string
          deprecated_at?: string | null
          hash?: string
          id?: string
          key?: string
          lifecycle?: string
          merge_mode?: string
          owner_capability?: string
          precedence?: string[]
          risk_class?: string
          schema?: Json
          sensitivity?: string
          value_kind?: string
          version_no?: number
        }
        Relationships: []
      }
      cfg_setting_value_versions: {
        Row: {
          acting_party_id: string | null
          author_person_id: string
          created_at: string
          definition_id: string
          definition_version_id: string
          effective_from: string
          effective_to: string | null
          environment: string | null
          id: string
          scope_id: string | null
          scope_type: string
          state: string
          supersedes_id: string | null
          typed_value: Json
          updated_at: string
          value_hash: string
          version_no: number
        }
        Insert: {
          acting_party_id?: string | null
          author_person_id: string
          created_at?: string
          definition_id: string
          definition_version_id: string
          effective_from: string
          effective_to?: string | null
          environment?: string | null
          id?: string
          scope_id?: string | null
          scope_type: string
          state: string
          supersedes_id?: string | null
          typed_value: Json
          updated_at?: string
          value_hash: string
          version_no: number
        }
        Update: {
          acting_party_id?: string | null
          author_person_id?: string
          created_at?: string
          definition_id?: string
          definition_version_id?: string
          effective_from?: string
          effective_to?: string | null
          environment?: string | null
          id?: string
          scope_id?: string | null
          scope_type?: string
          state?: string
          supersedes_id?: string | null
          typed_value?: Json
          updated_at?: string
          value_hash?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "cfg_setting_value_versions_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_setting_value_versions_definition_version_id_fkey"
            columns: ["definition_version_id"]
            isOneToOne: false
            referencedRelation: "cfg_setting_definition_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_setting_value_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "cfg_setting_value_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cfg_snapshot_intents: {
        Row: {
          completed_at: string | null
          config_hash: string
          id: string
          requested_at: string
          requested_by: string
          review_id: string | null
          state: string
          value_version_id: string | null
        }
        Insert: {
          completed_at?: string | null
          config_hash: string
          id?: string
          requested_at?: string
          requested_by: string
          review_id?: string | null
          state?: string
          value_version_id?: string | null
        }
        Update: {
          completed_at?: string | null
          config_hash?: string
          id?: string
          requested_at?: string
          requested_by?: string
          review_id?: string | null
          state?: string
          value_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfg_snapshot_intents_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "cfg_config_change_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cfg_snapshot_intents_value_version_id_fkey"
            columns: ["value_version_id"]
            isOneToOne: false
            referencedRelation: "cfg_setting_value_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_block_definition_lifecycle_events: {
        Row: {
          block_definition_version_id: string
          block_key: string
          block_version: number
          created_at: string
          from_lifecycle: string
          id: string
          owner_id: string
          release_digest: string
          release_key_id: string
          release_nonce_hash: string
          release_principal_id: string
          release_raw_body_hash: string
          release_signature_hash: string
          release_verified_at: string
          state: string
          to_lifecycle: string
          updated_at: string
          version: number
        }
        Insert: {
          block_definition_version_id: string
          block_key: string
          block_version: number
          created_at?: string
          from_lifecycle: string
          id?: string
          owner_id: string
          release_digest: string
          release_key_id: string
          release_nonce_hash: string
          release_principal_id: string
          release_raw_body_hash: string
          release_signature_hash: string
          release_verified_at: string
          state?: string
          to_lifecycle: string
          updated_at?: string
          version?: number
        }
        Update: {
          block_definition_version_id?: string
          block_key?: string
          block_version?: number
          created_at?: string
          from_lifecycle?: string
          id?: string
          owner_id?: string
          release_digest?: string
          release_key_id?: string
          release_nonce_hash?: string
          release_principal_id?: string
          release_raw_body_hash?: string
          release_signature_hash?: string
          release_verified_at?: string
          state?: string
          to_lifecycle?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_block_definition_lifecycle_block_definition_version_id_fkey"
            columns: ["block_definition_version_id"]
            isOneToOne: false
            referencedRelation: "cms_block_definition_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_block_definition_versions: {
        Row: {
          accessibility_contract: Json
          allowed_children: Json
          block_key: string
          block_version: number
          compatibility_range: Json
          created_at: string
          data_source_permissions: Json
          id: string
          owner_id: string
          props_attestation_key_id: string
          props_attestation_signature_hash: string
          props_attestation_verified_at: string
          props_schema_hash: string
          props_schema_ref: string
          props_schema_snapshot: Json
          props_snapshot_attestation: Json
          props_snapshot_hash: string
          release_digest: string
          release_key_id: string
          release_nonce_hash: string
          release_principal_id: string
          release_raw_body_hash: string
          release_signature_hash: string
          release_verified_at: string
          renderer_ref: string
          slot_rules: Json
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          accessibility_contract: Json
          allowed_children: Json
          block_key: string
          block_version: number
          compatibility_range: Json
          created_at?: string
          data_source_permissions: Json
          id?: string
          owner_id: string
          props_attestation_key_id: string
          props_attestation_signature_hash: string
          props_attestation_verified_at: string
          props_schema_hash: string
          props_schema_ref: string
          props_schema_snapshot: Json
          props_snapshot_attestation: Json
          props_snapshot_hash: string
          release_digest: string
          release_key_id: string
          release_nonce_hash: string
          release_principal_id: string
          release_raw_body_hash: string
          release_signature_hash: string
          release_verified_at: string
          renderer_ref: string
          slot_rules: Json
          state?: string
          updated_at?: string
          version?: number
        }
        Update: {
          accessibility_contract?: Json
          allowed_children?: Json
          block_key?: string
          block_version?: number
          compatibility_range?: Json
          created_at?: string
          data_source_permissions?: Json
          id?: string
          owner_id?: string
          props_attestation_key_id?: string
          props_attestation_signature_hash?: string
          props_attestation_verified_at?: string
          props_schema_hash?: string
          props_schema_ref?: string
          props_schema_snapshot?: Json
          props_snapshot_attestation?: Json
          props_snapshot_hash?: string
          release_digest?: string
          release_key_id?: string
          release_nonce_hash?: string
          release_principal_id?: string
          release_raw_body_hash?: string
          release_signature_hash?: string
          release_verified_at?: string
          renderer_ref?: string
          slot_rules?: Json
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      cms_capability_grant_events: {
        Row: {
          action: string
          aggregate_version: number
          binding_context_hash: string
          capability_code: string
          created_at: string
          grant_id: string
          grantor_person_ref: string
          id: string
          mfa_verified_at: string
          owner_id: string
          prior_valid_through: string | null
          reason: string | null
          state: string
          subject_person_ref: string
          updated_at: string
          valid_from: string
          valid_through: string
          version: number
        }
        Insert: {
          action: string
          aggregate_version: number
          binding_context_hash: string
          capability_code: string
          created_at?: string
          grant_id: string
          grantor_person_ref: string
          id?: string
          mfa_verified_at: string
          owner_id: string
          prior_valid_through?: string | null
          reason?: string | null
          state?: string
          subject_person_ref: string
          updated_at?: string
          valid_from: string
          valid_through: string
          version?: number
        }
        Update: {
          action?: string
          aggregate_version?: number
          binding_context_hash?: string
          capability_code?: string
          created_at?: string
          grant_id?: string
          grantor_person_ref?: string
          id?: string
          mfa_verified_at?: string
          owner_id?: string
          prior_valid_through?: string | null
          reason?: string | null
          state?: string
          subject_person_ref?: string
          updated_at?: string
          valid_from?: string
          valid_through?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_capability_grant_events_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "cms_capability_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_capability_grants: {
        Row: {
          capability_code: string
          created_at: string
          grantor_person_ref: string
          id: string
          last_action: string
          owner_id: string
          reason: string | null
          state: string
          subject_person_ref: string
          updated_at: string
          valid_from: string
          valid_through: string
          version: number
        }
        Insert: {
          capability_code: string
          created_at?: string
          grantor_person_ref: string
          id?: string
          last_action: string
          owner_id: string
          reason?: string | null
          state?: string
          subject_person_ref: string
          updated_at?: string
          valid_from: string
          valid_through: string
          version?: number
        }
        Update: {
          capability_code?: string
          created_at?: string
          grantor_person_ref?: string
          id?: string
          last_action?: string
          owner_id?: string
          reason?: string | null
          state?: string
          subject_person_ref?: string
          updated_at?: string
          valid_from?: string
          valid_through?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_capability_grants_grantor_person_ref_fkey"
            columns: ["grantor_person_ref"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_capability_grants_grantor_person_ref_fkey"
            columns: ["grantor_person_ref"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_capability_grants_grantor_person_ref_fkey"
            columns: ["grantor_person_ref"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_capability_grants_subject_person_ref_fkey"
            columns: ["subject_person_ref"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_capability_grants_subject_person_ref_fkey"
            columns: ["subject_person_ref"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_capability_grants_subject_person_ref_fkey"
            columns: ["subject_person_ref"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cms_composition_instances: {
        Row: {
          bindings: Json
          block_key: string
          block_registry_digest: string
          block_version: number
          created_at: string
          created_by: string
          id: string
          link_mode: string
          owner_id: string
          parent_instance_id: string | null
          path: string
          pattern_id: string | null
          pattern_version: number | null
          props: Json
          revision_id: string
          slot_key: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          bindings?: Json
          block_key: string
          block_registry_digest: string
          block_version: number
          created_at?: string
          created_by: string
          id?: string
          link_mode: string
          owner_id: string
          parent_instance_id?: string | null
          path: string
          pattern_id?: string | null
          pattern_version?: number | null
          props?: Json
          revision_id: string
          slot_key: string
          state?: string
          updated_at?: string
          version: number
        }
        Update: {
          bindings?: Json
          block_key?: string
          block_registry_digest?: string
          block_version?: number
          created_at?: string
          created_by?: string
          id?: string
          link_mode?: string
          owner_id?: string
          parent_instance_id?: string | null
          path?: string
          pattern_id?: string | null
          pattern_version?: number | null
          props?: Json
          revision_id?: string
          slot_key?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_composition_instances_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_composition_instances_parent_instance_id_fkey"
            columns: ["parent_instance_id"]
            isOneToOne: false
            referencedRelation: "cms_composition_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_composition_instances_parent_owner_fkey"
            columns: ["parent_instance_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_composition_instances"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_composition_instances_parent_revision_owner_fkey"
            columns: ["parent_instance_id", "revision_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_composition_instances"
            referencedColumns: ["id", "revision_id", "owner_id"]
          },
          {
            foreignKeyName: "cms_composition_instances_pattern_owner_fkey"
            columns: ["pattern_id", "pattern_version", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_pattern_versions"
            referencedColumns: ["id", "version", "owner_id"]
          },
          {
            foreignKeyName: "cms_composition_instances_pattern_version_fkey"
            columns: ["pattern_id", "pattern_version"]
            isOneToOne: false
            referencedRelation: "cms_pattern_versions"
            referencedColumns: ["id", "version"]
          },
          {
            foreignKeyName: "cms_composition_instances_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_composition_instances_revision_owner_fkey"
            columns: ["revision_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_conflict_records: {
        Row: {
          base_hash: string
          base_revision_id: string
          changed_paths: Json
          conflict_hash: string
          created_at: string
          entry_id: string
          id: string
          owner_id: string
          proposed_values: Json | null
          proposed_values_hash: string | null
          resolved_acting_party_id: string | null
          resolved_at: string | null
          resolved_by_person_id: string | null
          resolved_revision_id: string | null
          state: string
          theirs_hash: string
          theirs_revision_id: string
          updated_at: string
          version: number
          yours_hash: string
          yours_revision_id: string | null
          yours_source: string
        }
        Insert: {
          base_hash: string
          base_revision_id: string
          changed_paths: Json
          conflict_hash: string
          created_at?: string
          entry_id: string
          id?: string
          owner_id: string
          proposed_values?: Json | null
          proposed_values_hash?: string | null
          resolved_acting_party_id?: string | null
          resolved_at?: string | null
          resolved_by_person_id?: string | null
          resolved_revision_id?: string | null
          state: string
          theirs_hash: string
          theirs_revision_id: string
          updated_at?: string
          version?: number
          yours_hash: string
          yours_revision_id?: string | null
          yours_source: string
        }
        Update: {
          base_hash?: string
          base_revision_id?: string
          changed_paths?: Json
          conflict_hash?: string
          created_at?: string
          entry_id?: string
          id?: string
          owner_id?: string
          proposed_values?: Json | null
          proposed_values_hash?: string | null
          resolved_acting_party_id?: string | null
          resolved_at?: string | null
          resolved_by_person_id?: string | null
          resolved_revision_id?: string | null
          state?: string
          theirs_hash?: string
          theirs_revision_id?: string
          updated_at?: string
          version?: number
          yours_hash?: string
          yours_revision_id?: string | null
          yours_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_conflict_records_base_revision_id_fkey"
            columns: ["base_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_conflict_records_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_conflict_records_resolved_acting_party_id_fkey"
            columns: ["resolved_acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_conflict_records_resolved_by_person_id_fkey"
            columns: ["resolved_by_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_conflict_records_resolved_by_person_id_fkey"
            columns: ["resolved_by_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_conflict_records_resolved_by_person_id_fkey"
            columns: ["resolved_by_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_conflict_records_resolved_revision_id_fkey"
            columns: ["resolved_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_conflict_records_theirs_revision_id_fkey"
            columns: ["theirs_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_conflict_records_yours_revision_id_fkey"
            columns: ["yours_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_entries: {
        Row: {
          content_type_id: string
          created_at: string
          created_by: string
          current_draft_revision_id: string | null
          id: string
          lifecycle: string
          owner_id: string
          owner_party_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          content_type_id: string
          created_at?: string
          created_by: string
          current_draft_revision_id?: string | null
          id?: string
          lifecycle: string
          owner_id: string
          owner_party_id?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          content_type_id?: string
          created_at?: string
          created_by?: string
          current_draft_revision_id?: string | null
          id?: string
          lifecycle?: string
          owner_id?: string
          owner_party_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_entries_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_entries_current_draft_fkey"
            columns: ["current_draft_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_entries_owner_party_id_fkey"
            columns: ["owner_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_entries_type_owner_fkey"
            columns: ["content_type_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_content_type_capability_bindings: {
        Row: {
          capability_key: string
          capability_version: number
          content_type_version_id: string
          created_at: string
          id: string
          owner_id: string
          state: Database["platform_private"]["Enums"]["cms_definition_state"]
          updated_at: string
          version: number
        }
        Insert: {
          capability_key: string
          capability_version: number
          content_type_version_id: string
          created_at?: string
          id?: string
          owner_id: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          capability_key?: string
          capability_version?: number
          content_type_version_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_type_capability_bindin_content_type_version_id_fkey"
            columns: ["content_type_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_type_template_bindings: {
        Row: {
          content_type_version_id: string
          created_at: string
          id: string
          owner_id: string
          position: number
          state: Database["platform_private"]["Enums"]["cms_definition_state"]
          template_version_id: string
          updated_at: string
          version: number
        }
        Insert: {
          content_type_version_id: string
          created_at?: string
          id?: string
          owner_id: string
          position: number
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          template_version_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          content_type_version_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          position?: number
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          template_version_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_type_template_bindings_content_type_version_id_fkey"
            columns: ["content_type_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_content_type_versions: {
        Row: {
          activation_approval_evidence_hash: string | null
          activation_required_capabilities: Json | null
          activation_required_decision_count: number | null
          activation_workflow_policy_hash: string | null
          activation_workflow_policy_key: string | null
          activation_workflow_policy_version: number | null
          approved_at: string | null
          compatibility: string
          content_type_id: string
          created_at: string
          created_by: string
          default_locale: string
          default_template_version_id: string | null
          definition_hash: string
          dry_run_id: string | null
          fallback_chains: Json
          id: string
          labels: Json
          locale_config_hash: string
          owner_id: string
          schema_artifact_id: string
          source_locale: string
          state: Database["platform_private"]["Enums"]["cms_definition_state"]
          supersedes_id: string | null
          supported_locales: Json
          updated_at: string
          version: number
          version_no: number
          workflow_key: string
          workflow_version: number
        }
        Insert: {
          activation_approval_evidence_hash?: string | null
          activation_required_capabilities?: Json | null
          activation_required_decision_count?: number | null
          activation_workflow_policy_hash?: string | null
          activation_workflow_policy_key?: string | null
          activation_workflow_policy_version?: number | null
          approved_at?: string | null
          compatibility: string
          content_type_id: string
          created_at?: string
          created_by: string
          default_locale: string
          default_template_version_id?: string | null
          definition_hash: string
          dry_run_id?: string | null
          fallback_chains: Json
          id?: string
          labels: Json
          locale_config_hash: string
          owner_id: string
          schema_artifact_id: string
          source_locale: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          supersedes_id?: string | null
          supported_locales: Json
          updated_at?: string
          version?: number
          version_no: number
          workflow_key: string
          workflow_version: number
        }
        Update: {
          activation_approval_evidence_hash?: string | null
          activation_required_capabilities?: Json | null
          activation_required_decision_count?: number | null
          activation_workflow_policy_hash?: string | null
          activation_workflow_policy_key?: string | null
          activation_workflow_policy_version?: number | null
          approved_at?: string | null
          compatibility?: string
          content_type_id?: string
          created_at?: string
          created_by?: string
          default_locale?: string
          default_template_version_id?: string | null
          definition_hash?: string
          dry_run_id?: string | null
          fallback_chains?: Json
          id?: string
          labels?: Json
          locale_config_hash?: string
          owner_id?: string
          schema_artifact_id?: string
          source_locale?: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          supersedes_id?: string | null
          supported_locales?: Json
          updated_at?: string
          version?: number
          version_no?: number
          workflow_key?: string
          workflow_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_type_versions_artifact_pair_fkey"
            columns: ["schema_artifact_id", "id"]
            isOneToOne: false
            referencedRelation: "cms_schema_artifacts"
            referencedColumns: ["id", "content_type_version_id"]
          },
          {
            foreignKeyName: "cms_content_type_versions_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_type_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_type_versions_type_owner_fkey"
            columns: ["content_type_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_content_types: {
        Row: {
          built_in: boolean
          created_at: string
          created_by: string
          id: string
          owner_capability: string
          owner_id: string
          state: string
          type_key: string
          updated_at: string
          version: number
        }
        Insert: {
          built_in?: boolean
          created_at?: string
          created_by: string
          id?: string
          owner_capability: string
          owner_id: string
          state?: string
          type_key: string
          updated_at?: string
          version?: number
        }
        Update: {
          built_in?: boolean
          created_at?: string
          created_by?: string
          id?: string
          owner_capability?: string
          owner_id?: string
          state?: string
          type_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      cms_edit_presence: {
        Row: {
          acting_party_id: string | null
          created_at: string
          current_field_id: string | null
          entry_id: string
          id: string
          last_seen_at: string
          lease_until: string
          owner_id: string
          person_id: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          acting_party_id?: string | null
          created_at?: string
          current_field_id?: string | null
          entry_id: string
          id?: string
          last_seen_at: string
          lease_until: string
          owner_id: string
          person_id: string
          state: string
          updated_at?: string
          version: number
        }
        Update: {
          acting_party_id?: string | null
          created_at?: string
          current_field_id?: string | null
          entry_id?: string
          id?: string
          last_seen_at?: string
          lease_until?: string
          owner_id?: string
          person_id?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_edit_presence_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_edit_presence_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_edit_presence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_edit_presence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_edit_presence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cms_editorial_decisions: {
        Row: {
          acting_party_id: string | null
          capability: string
          comment_hash: string | null
          created_at: string
          decided_at: string
          decision: string
          id: string
          owner_id: string
          reason: string
          review_id: string
          reviewed_hash: string
          reviewer_person_id: string
          state: string
          step_up_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          acting_party_id?: string | null
          capability: string
          comment_hash?: string | null
          created_at?: string
          decided_at?: string
          decision: string
          id?: string
          owner_id: string
          reason: string
          review_id: string
          reviewed_hash: string
          reviewer_person_id: string
          state: string
          step_up_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          acting_party_id?: string | null
          capability?: string
          comment_hash?: string | null
          created_at?: string
          decided_at?: string
          decision?: string
          id?: string
          owner_id?: string
          reason?: string
          review_id?: string
          reviewed_hash?: string
          reviewer_person_id?: string
          state?: string
          step_up_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_editorial_decisions_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_editorial_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "cms_editorial_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_editorial_decisions_reviewer_person_id_fkey"
            columns: ["reviewer_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_editorial_decisions_reviewer_person_id_fkey"
            columns: ["reviewer_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_editorial_decisions_reviewer_person_id_fkey"
            columns: ["reviewer_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cms_editorial_reviews: {
        Row: {
          activation_evidence: Json
          approval_evidence_hash: string
          created_at: string
          dependency_hash: string
          dependency_manifest: Json
          frozen_hash: string
          id: string
          invalidated_reason: string | null
          owner_id: string
          recorded_decision_count: number
          required_capabilities: Json
          required_decision_count: number
          revision_id: string
          risk_class: string
          state: string
          submitted_at: string
          submitted_by: string
          updated_at: string
          version: number
          workflow_policy_hash: string
          workflow_policy_key: string
          workflow_policy_version: number
        }
        Insert: {
          activation_evidence: Json
          approval_evidence_hash: string
          created_at?: string
          dependency_hash: string
          dependency_manifest: Json
          frozen_hash: string
          id?: string
          invalidated_reason?: string | null
          owner_id: string
          recorded_decision_count?: number
          required_capabilities: Json
          required_decision_count: number
          revision_id: string
          risk_class: string
          state: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
          version: number
          workflow_policy_hash: string
          workflow_policy_key: string
          workflow_policy_version: number
        }
        Update: {
          activation_evidence?: Json
          approval_evidence_hash?: string
          created_at?: string
          dependency_hash?: string
          dependency_manifest?: Json
          frozen_hash?: string
          id?: string
          invalidated_reason?: string | null
          owner_id?: string
          recorded_decision_count?: number
          required_capabilities?: Json
          required_decision_count?: number
          revision_id?: string
          risk_class?: string
          state?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
          version?: number
          workflow_policy_hash?: string
          workflow_policy_key?: string
          workflow_policy_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_editorial_reviews_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_editorial_reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_editorial_reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_editorial_reviews_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cms_entry_assignments: {
        Row: {
          assignee_person_id: string
          capability_key: string
          created_at: string
          entry_id: string
          id: string
          owner_id: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          assignee_person_id: string
          capability_key: string
          created_at?: string
          entry_id: string
          id?: string
          owner_id: string
          state: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignee_person_id?: string
          capability_key?: string
          created_at?: string
          entry_id?: string
          id?: string
          owner_id?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_entry_assignments_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_entry_assignments_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_entry_assignments_assignee_person_id_fkey"
            columns: ["assignee_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_entry_assignments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_assignments_entry_owner_fkey"
            columns: ["entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_entry_field_values: {
        Row: {
          created_at: string
          field_definition_id: string
          field_id: string
          id: string
          locale: string
          owner_id: string
          provenance: string
          revision_id: string
          state: string
          updated_at: string
          value: Json | null
          value_hash: string | null
          version: number
        }
        Insert: {
          created_at?: string
          field_definition_id: string
          field_id: string
          id?: string
          locale: string
          owner_id: string
          provenance: string
          revision_id: string
          state: string
          updated_at?: string
          value?: Json | null
          value_hash?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          field_definition_id?: string
          field_id?: string
          id?: string
          locale?: string
          owner_id?: string
          provenance?: string
          revision_id?: string
          state?: string
          updated_at?: string
          value?: Json | null
          value_hash?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_entry_field_values_definition_owner_fkey"
            columns: ["field_definition_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_entry_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_field_values_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_field_values_revision_owner_fkey"
            columns: ["revision_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_entry_relations: {
        Row: {
          created_at: string
          expected_target_version: number | null
          field_definition_id: string
          field_id: string
          id: string
          on_unavailable: string
          owner_id: string
          position: number
          revision_id: string
          state: string
          target_id: string
          target_kind: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          expected_target_version?: number | null
          field_definition_id: string
          field_id: string
          id?: string
          on_unavailable: string
          owner_id: string
          position: number
          revision_id: string
          state: string
          target_id: string
          target_kind: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          expected_target_version?: number | null
          field_definition_id?: string
          field_id?: string
          id?: string
          on_unavailable?: string
          owner_id?: string
          position?: number
          revision_id?: string
          state?: string
          target_id?: string
          target_kind?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_entry_relations_definition_owner_fkey"
            columns: ["field_definition_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_entry_relations_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_relations_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_relations_revision_owner_fkey"
            columns: ["revision_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_entry_revisions: {
        Row: {
          acting_party_id: string | null
          author_person_id: string
          created_at: string
          entry_id: string
          id: string
          locale: string
          owner_id: string
          parent_revision_ids: Json
          payload_hash: string
          revision_number: number
          schema_version_id: string
          state: string
          taxonomy_version_ids: Json
          template_version_id: string | null
          updated_at: string
          validation_report: Json
          validation_state: string
          version: number
        }
        Insert: {
          acting_party_id?: string | null
          author_person_id: string
          created_at?: string
          entry_id: string
          id?: string
          locale: string
          owner_id: string
          parent_revision_ids: Json
          payload_hash: string
          revision_number: number
          schema_version_id: string
          state: string
          taxonomy_version_ids: Json
          template_version_id?: string | null
          updated_at?: string
          validation_report: Json
          validation_state: string
          version: number
        }
        Update: {
          acting_party_id?: string | null
          author_person_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          locale?: string
          owner_id?: string
          parent_revision_ids?: Json
          payload_hash?: string
          revision_number?: number
          schema_version_id?: string
          state?: string
          taxonomy_version_ids?: Json
          template_version_id?: string | null
          updated_at?: string
          validation_report?: Json
          validation_state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_entry_revisions_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_author_person_id_fkey"
            columns: ["author_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_entry_owner_fkey"
            columns: ["entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_schema_owner_fkey"
            columns: ["schema_version_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_entry_revisions_schema_version_id_fkey"
            columns: ["schema_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_field_definition_versions: {
        Row: {
          constraints: Json
          content_type_version_id: string
          created_at: string
          created_by: string
          default_mode: string
          default_value: Json | null
          editor_config: Json
          field_key: string
          id: string
          kind: string
          localization_mode: string
          owner_id: string
          required: boolean
          stable_field_id: string
          state: string
          updated_at: string
          validator_key: string | null
          validator_version: number | null
          version: number
        }
        Insert: {
          constraints?: Json
          content_type_version_id: string
          created_at?: string
          created_by: string
          default_mode?: string
          default_value?: Json | null
          editor_config?: Json
          field_key: string
          id?: string
          kind: string
          localization_mode?: string
          owner_id: string
          required?: boolean
          stable_field_id: string
          state?: string
          updated_at?: string
          validator_key?: string | null
          validator_version?: number | null
          version?: number
        }
        Update: {
          constraints?: Json
          content_type_version_id?: string
          created_at?: string
          created_by?: string
          default_mode?: string
          default_value?: Json | null
          editor_config?: Json
          field_key?: string
          id?: string
          kind?: string
          localization_mode?: string
          owner_id?: string
          required?: boolean
          stable_field_id?: string
          state?: string
          updated_at?: string
          validator_key?: string | null
          validator_version?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_field_definition_versions_content_type_version_id_fkey"
            columns: ["content_type_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_locale_variants: {
        Row: {
          approval_evidence: Json | null
          created_at: string
          created_by: string
          entry_id: string
          fallback_chain: Json
          id: string
          locale: string
          no_fallback_field_ids: Json
          owner_id: string
          revision_id: string
          source_hash: string
          source_locale: string
          source_revision_id: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          approval_evidence?: Json | null
          created_at?: string
          created_by: string
          entry_id: string
          fallback_chain?: Json
          id?: string
          locale: string
          no_fallback_field_ids?: Json
          owner_id: string
          revision_id: string
          source_hash: string
          source_locale: string
          source_revision_id: string
          state?: string
          updated_at?: string
          version: number
        }
        Update: {
          approval_evidence?: Json | null
          created_at?: string
          created_by?: string
          entry_id?: string
          fallback_chain?: Json
          id?: string
          locale?: string
          no_fallback_field_ids?: Json
          owner_id?: string
          revision_id?: string
          source_hash?: string
          source_locale?: string
          source_revision_id?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_locale_variants_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_locale_variants_entry_owner_fkey"
            columns: ["entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_locale_variants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_locale_variants_revision_entry_owner_fkey"
            columns: ["revision_id", "entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "entry_id", "owner_id"]
          },
          {
            foreignKeyName: "cms_locale_variants_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_locale_variants_revision_locale_fkey"
            columns: ["revision_id", "locale"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "locale"]
          },
          {
            foreignKeyName: "cms_locale_variants_source_entry_owner_fkey"
            columns: ["source_revision_id", "entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "entry_id", "owner_id"]
          },
          {
            foreignKeyName: "cms_locale_variants_source_locale_fkey"
            columns: ["source_revision_id", "source_locale"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "locale"]
          },
          {
            foreignKeyName: "cms_locale_variants_source_revision_hash_fkey"
            columns: ["source_revision_id", "source_hash"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "payload_hash"]
          },
          {
            foreignKeyName: "cms_locale_variants_source_revision_id_fkey"
            columns: ["source_revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_operational_alert_deliveries: {
        Row: {
          alert_code: string
          claim_token_hash: string
          claimed_at: string
          delivered_at: string | null
          id: string
          provider_message_hash: string | null
          receipt_hash: string | null
          release: string
          state: string
        }
        Insert: {
          alert_code: string
          claim_token_hash: string
          claimed_at?: string
          delivered_at?: string | null
          id?: string
          provider_message_hash?: string | null
          receipt_hash?: string | null
          release: string
          state?: string
        }
        Update: {
          alert_code?: string
          claim_token_hash?: string
          claimed_at?: string
          delivered_at?: string | null
          id?: string
          provider_message_hash?: string | null
          receipt_hash?: string | null
          release?: string
          state?: string
        }
        Relationships: []
      }
      cms_owner_initialization: {
        Row: {
          alias_id: string
          auth_user_id: string
          authorization_ref: string
          created_at: string
          grant_ends_at: string
          operator_role: unknown
          organization_id: string
          person_id: string
          singleton: boolean
        }
        Insert: {
          alias_id: string
          auth_user_id: string
          authorization_ref: string
          created_at?: string
          grant_ends_at: string
          operator_role: unknown
          organization_id: string
          person_id: string
          singleton?: boolean
        }
        Update: {
          alias_id?: string
          auth_user_id?: string
          authorization_ref?: string
          created_at?: string
          grant_ends_at?: string
          operator_role?: unknown
          organization_id?: string
          person_id?: string
          singleton?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cms_owner_initialization_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "alias_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_owner_initialization_alias_id_fkey"
            columns: ["alias_id"]
            isOneToOne: false
            referencedRelation: "identity_public_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_owner_initialization_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_owner_initialization_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_owner_initialization_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      cms_pattern_versions: {
        Row: {
          block_registry_digest: string
          block_tree: Json
          content_hash: string
          created_at: string
          created_by: string
          id: string
          owner_capability: string
          owner_id: string
          pattern_key: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          block_registry_digest: string
          block_tree: Json
          content_hash: string
          created_at?: string
          created_by: string
          id?: string
          owner_capability: string
          owner_id: string
          pattern_key: string
          state?: string
          updated_at?: string
          version: number
        }
        Update: {
          block_registry_digest?: string
          block_tree?: Json
          content_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          owner_capability?: string
          owner_id?: string
          pattern_key?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_pattern_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_preview_tokens: {
        Row: {
          acting_party_id: string | null
          audience: string
          capability_snapshot_hash: string
          created_at: string
          entry_id: string
          expires_at: string
          id: string
          locale: string
          nonce: string
          owner_id: string
          revision_id: string
          revoked_at: string | null
          route: string
          state: string
          token_hash: string
          updated_at: string
          user_id: string
          version: number
          version_set: Json
        }
        Insert: {
          acting_party_id?: string | null
          audience: string
          capability_snapshot_hash: string
          created_at?: string
          entry_id: string
          expires_at: string
          id?: string
          locale: string
          nonce: string
          owner_id: string
          revision_id: string
          revoked_at?: string | null
          route: string
          state: string
          token_hash: string
          updated_at?: string
          user_id: string
          version?: number
          version_set: Json
        }
        Update: {
          acting_party_id?: string | null
          audience?: string
          capability_snapshot_hash?: string
          created_at?: string
          entry_id?: string
          expires_at?: string
          id?: string
          locale?: string
          nonce?: string
          owner_id?: string
          revision_id?: string
          revoked_at?: string | null
          route?: string
          state?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
          version?: number
          version_set?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cms_preview_tokens_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_preview_tokens_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_preview_tokens_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_publication_schedules: {
        Row: {
          action: string
          activation_evidence_hash: string
          actual_at_utc: string | null
          created_at: string
          created_by: string
          dependency_hash: string
          deviation_seconds: number | null
          disambiguation: string
          entry_id: string
          expected_version: number
          id: string
          job_id: string | null
          local_datetime: string
          owner_id: string
          resolved_at_utc: string
          revision_id: string
          state: string
          timezone: string
          tzdb_version: string
          updated_at: string
          version: number
        }
        Insert: {
          action: string
          activation_evidence_hash: string
          actual_at_utc?: string | null
          created_at?: string
          created_by: string
          dependency_hash: string
          deviation_seconds?: number | null
          disambiguation: string
          entry_id: string
          expected_version: number
          id?: string
          job_id?: string | null
          local_datetime: string
          owner_id: string
          resolved_at_utc: string
          revision_id: string
          state: string
          timezone: string
          tzdb_version: string
          updated_at?: string
          version: number
        }
        Update: {
          action?: string
          activation_evidence_hash?: string
          actual_at_utc?: string | null
          created_at?: string
          created_by?: string
          dependency_hash?: string
          deviation_seconds?: number | null
          disambiguation?: string
          entry_id?: string
          expected_version?: number
          id?: string
          job_id?: string | null
          local_datetime?: string
          owner_id?: string
          resolved_at_utc?: string
          revision_id?: string
          state?: string
          timezone?: string
          tzdb_version?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_publication_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_publication_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "cms_publication_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "cms_publication_schedules_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publication_schedules_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_publication_versions: {
        Row: {
          activated_at: string | null
          activation_evidence_hash: string
          audience: string
          created_at: string
          dependency_hash: string
          entry_id: string
          id: string
          locale: string
          owner_id: string
          publication_hash: string
          revision_id: string
          revoked_at: string | null
          schema_artifact_hash: string
          schema_artifact_id: string
          schema_version_id: string
          settings_version: number
          state: string
          taxonomy_version_ids: Json
          template_version_id: string | null
          updated_at: string
          version: number
          version_set: Json
        }
        Insert: {
          activated_at?: string | null
          activation_evidence_hash: string
          audience: string
          created_at?: string
          dependency_hash: string
          entry_id: string
          id?: string
          locale: string
          owner_id: string
          publication_hash: string
          revision_id: string
          revoked_at?: string | null
          schema_artifact_hash: string
          schema_artifact_id: string
          schema_version_id: string
          settings_version: number
          state: string
          taxonomy_version_ids: Json
          template_version_id?: string | null
          updated_at?: string
          version?: number
          version_set: Json
        }
        Update: {
          activated_at?: string | null
          activation_evidence_hash?: string
          audience?: string
          created_at?: string
          dependency_hash?: string
          entry_id?: string
          id?: string
          locale?: string
          owner_id?: string
          publication_hash?: string
          revision_id?: string
          revoked_at?: string | null
          schema_artifact_hash?: string
          schema_artifact_id?: string
          schema_version_id?: string
          settings_version?: number
          state?: string
          taxonomy_version_ids?: Json
          template_version_id?: string | null
          updated_at?: string
          version?: number
          version_set?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cms_publication_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publication_versions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publication_versions_schema_artifact_id_fkey"
            columns: ["schema_artifact_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publication_versions_schema_version_id_fkey"
            columns: ["schema_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_related_content_rules: {
        Row: {
          created_at: string
          created_by: string
          id: string
          mode: string
          owner_id: string
          position: number | null
          reason_code: string
          rule_key: string | null
          rule_version: number | null
          source_entry_id: string
          state: string
          target_entry_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          mode: string
          owner_id: string
          position?: number | null
          reason_code: string
          rule_key?: string | null
          rule_version?: number | null
          source_entry_id: string
          state?: string
          target_entry_id?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          mode?: string
          owner_id?: string
          position?: number | null
          reason_code?: string
          rule_key?: string | null
          rule_version?: number | null
          source_entry_id?: string
          state?: string
          target_entry_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_related_content_rules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_related_content_rules_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_related_content_rules_source_owner_fkey"
            columns: ["source_entry_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_related_content_rules_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "cms_content_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_relation_definitions: {
        Row: {
          cardinality: string
          created_at: string
          created_by: string
          field_definition_id: string
          id: string
          max_count: number
          min_count: number
          on_unavailable: string
          ordered: boolean
          owner_id: string
          projection_key: string
          state: Database["platform_private"]["Enums"]["cms_definition_state"]
          target_kind: string
          target_type: string
          updated_at: string
          version: number
        }
        Insert: {
          cardinality: string
          created_at?: string
          created_by: string
          field_definition_id: string
          id?: string
          max_count: number
          min_count: number
          on_unavailable: string
          ordered?: boolean
          owner_id: string
          projection_key: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          target_kind: string
          target_type: string
          updated_at?: string
          version?: number
        }
        Update: {
          cardinality?: string
          created_at?: string
          created_by?: string
          field_definition_id?: string
          id?: string
          max_count?: number
          min_count?: number
          on_unavailable?: string
          ordered?: boolean
          owner_id?: string
          projection_key?: string
          state?: Database["platform_private"]["Enums"]["cms_definition_state"]
          target_kind?: string
          target_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_relation_definitions_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: true
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_release_nonce_receipts: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          nonce_hash: string
          operation_id: string
          outcome: string
          raw_body_hash: string
          release_key_id: string
          signature_hash: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          issued_at: string
          nonce_hash: string
          operation_id: string
          outcome?: string
          raw_body_hash: string
          release_key_id: string
          signature_hash: string
          updated_at?: string
          verified_at: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce_hash?: string
          operation_id?: string
          outcome?: string
          raw_body_hash?: string
          release_key_id?: string
          signature_hash?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      cms_schema_artifacts: {
        Row: {
          artifact_hash: string
          compiled_at: string
          compiler_version: string
          content_type_version_id: string
          created_at: string
          editor_manifest: Json
          id: string
          owner_id: string
          renderer_manifest: Json
          state: string
          updated_at: string
          version: number
          zod_contract_ref: string
        }
        Insert: {
          artifact_hash: string
          compiled_at: string
          compiler_version: string
          content_type_version_id: string
          created_at?: string
          editor_manifest: Json
          id?: string
          owner_id: string
          renderer_manifest: Json
          state?: string
          updated_at?: string
          version?: number
          zod_contract_ref: string
        }
        Update: {
          artifact_hash?: string
          compiled_at?: string
          compiler_version?: string
          content_type_version_id?: string
          created_at?: string
          editor_manifest?: Json
          id?: string
          owner_id?: string
          renderer_manifest?: Json
          state?: string
          updated_at?: string
          version?: number
          zod_contract_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_artifacts_content_type_version_id_fkey"
            columns: ["content_type_version_id"]
            isOneToOne: true
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_dry_run_reports: {
        Row: {
          attempt_no: number
          classification: string
          compiler_hash: string | null
          compiler_version: string
          content_type_id: string
          created_at: string
          created_by: string | null
          failed_count: number | null
          failure_code: string | null
          id: string
          job_id: string | null
          migrated_count: number | null
          owner_id: string
          plan_id: string | null
          report: Json | null
          result: string | null
          row_error_count: number | null
          sealed_at: string | null
          source_count: number | null
          source_hash: string | null
          source_version_id: string | null
          state: string
          target_count: number | null
          target_hash: string | null
          target_version_id: string
          transform_key: string | null
          transform_version: number | null
          updated_at: string
          version: number
        }
        Insert: {
          attempt_no: number
          classification: string
          compiler_hash?: string | null
          compiler_version: string
          content_type_id: string
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          failure_code?: string | null
          id: string
          job_id?: string | null
          migrated_count?: number | null
          owner_id: string
          plan_id?: string | null
          report?: Json | null
          result?: string | null
          row_error_count?: number | null
          sealed_at?: string | null
          source_count?: number | null
          source_hash?: string | null
          source_version_id?: string | null
          state: string
          target_count?: number | null
          target_hash?: string | null
          target_version_id: string
          transform_key?: string | null
          transform_version?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          attempt_no?: number
          classification?: string
          compiler_hash?: string | null
          compiler_version?: string
          content_type_id?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number | null
          failure_code?: string | null
          id?: string
          job_id?: string | null
          migrated_count?: number | null
          owner_id?: string
          plan_id?: string | null
          report?: Json | null
          result?: string | null
          row_error_count?: number | null
          sealed_at?: string | null
          source_count?: number | null
          source_hash?: string | null
          source_version_id?: string | null
          state?: string
          target_count?: number | null
          target_hash?: string | null
          target_version_id?: string
          transform_key?: string | null
          transform_version?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_dry_run_reports_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_dry_run_reports_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "cms_schema_migration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_dry_run_reports_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_dry_run_reports_target_version_id_fkey"
            columns: ["target_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_dry_run_row_evidence: {
        Row: {
          error_code: string | null
          id: string
          output_hash: string | null
          plan_id: string
          recorded_at: string
          report_id: string
          source_hash: string
          source_row_id: string
          source_table: string
        }
        Insert: {
          error_code?: string | null
          id?: string
          output_hash?: string | null
          plan_id: string
          recorded_at?: string
          report_id: string
          source_hash: string
          source_row_id: string
          source_table: string
        }
        Update: {
          error_code?: string | null
          id?: string
          output_hash?: string | null
          plan_id?: string
          recorded_at?: string
          report_id?: string
          source_hash?: string
          source_row_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_dry_run_row_evidence_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_migration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_dry_run_row_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_dry_run_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_migration_plans: {
        Row: {
          classification: string
          completed_at: string | null
          content_type_id: string
          created_at: string
          created_by: string | null
          cursor: number
          dry_run_report: Json
          failed_count: number
          from_version_id: string | null
          id: string
          migrated_count: number
          owner_id: string
          progress: number
          row_error_count: number
          source_count: number
          started_at: string | null
          state: string
          superseded_at: string | null
          target_count: number
          to_version_id: string
          transform_key: string | null
          transform_version: number | null
          updated_at: string
          version: number
        }
        Insert: {
          classification: string
          completed_at?: string | null
          content_type_id: string
          created_at?: string
          created_by?: string | null
          cursor?: number
          dry_run_report?: Json
          failed_count?: number
          from_version_id?: string | null
          id?: string
          migrated_count?: number
          owner_id: string
          progress?: number
          row_error_count?: number
          source_count?: number
          started_at?: string | null
          state?: string
          superseded_at?: string | null
          target_count?: number
          to_version_id: string
          transform_key?: string | null
          transform_version?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          classification?: string
          completed_at?: string | null
          content_type_id?: string
          created_at?: string
          created_by?: string | null
          cursor?: number
          dry_run_report?: Json
          failed_count?: number
          from_version_id?: string | null
          id?: string
          migrated_count?: number
          owner_id?: string
          progress?: number
          row_error_count?: number
          source_count?: number
          started_at?: string | null
          state?: string
          superseded_at?: string | null
          target_count?: number
          to_version_id?: string
          transform_key?: string | null
          transform_version?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_migration_plans_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_migration_plans_from_version_id_fkey"
            columns: ["from_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_migration_plans_to_version_id_fkey"
            columns: ["to_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_migration_target_rows: {
        Row: {
          id: string
          output_hash: string
          owner_id: string
          plan_id: string
          source_hash: string
          source_row_id: string
          source_table: string
          target_document: Json
          target_version_id: string
          written_at: string
        }
        Insert: {
          id?: string
          output_hash: string
          owner_id: string
          plan_id: string
          source_hash: string
          source_row_id: string
          source_table: string
          target_document: Json
          target_version_id: string
          written_at?: string
        }
        Update: {
          id?: string
          output_hash?: string
          owner_id?: string
          plan_id?: string
          source_hash?: string
          source_row_id?: string
          source_table?: string
          target_document?: Json
          target_version_id?: string
          written_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_migration_target_rows_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_migration_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_migration_target_rows_target_version_id_fkey"
            columns: ["target_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_review_assignments: {
        Row: {
          actions: string[]
          capability_key: string
          created_at: string
          ends_at: string
          grantor_person_ref: string
          id: string
          owner_id: string
          reason: string | null
          review_id: string
          reviewer_person_ref: string
          starts_at: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          actions: string[]
          capability_key: string
          created_at?: string
          ends_at: string
          grantor_person_ref: string
          id?: string
          owner_id: string
          reason?: string | null
          review_id: string
          reviewer_person_ref: string
          starts_at: string
          state?: string
          updated_at?: string
          version?: number
        }
        Update: {
          actions?: string[]
          capability_key?: string
          created_at?: string
          ends_at?: string
          grantor_person_ref?: string
          id?: string
          owner_id?: string
          reason?: string | null
          review_id?: string
          reviewer_person_ref?: string
          starts_at?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_review_assignments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_review_decisions: {
        Row: {
          assignment_id: string
          assignment_version: number
          binding_context_hash: string
          capability_key: string
          capability_version: number
          created_at: string
          decided_at: string
          decision: string
          id: string
          mfa_verified_at: string
          owner_id: string
          review_id: string
          reviewed_hash: string
          reviewer_person_ref: string
          updated_at: string
          version: number
        }
        Insert: {
          assignment_id: string
          assignment_version: number
          binding_context_hash: string
          capability_key: string
          capability_version: number
          created_at?: string
          decided_at?: string
          decision: string
          id?: string
          mfa_verified_at: string
          owner_id: string
          review_id: string
          reviewed_hash: string
          reviewer_person_ref: string
          updated_at?: string
          version?: number
        }
        Update: {
          assignment_id?: string
          assignment_version?: number
          binding_context_hash?: string
          capability_key?: string
          capability_version?: number
          created_at?: string
          decided_at?: string
          decision?: string
          id?: string
          mfa_verified_at?: string
          owner_id?: string
          review_id?: string
          reviewed_hash?: string
          reviewer_person_ref?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_review_decisions_assignment_fkey"
            columns: ["assignment_id", "review_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_review_assignments"
            referencedColumns: ["id", "review_id"]
          },
          {
            foreignKeyName: "cms_schema_review_decisions_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_reviews: {
        Row: {
          approval_evidence_hash: string | null
          candidate_version_no: number
          compiler_version: string
          content_type_id: string
          content_type_version_id: string
          context_hash: string
          created_at: string
          decided_at: string | null
          definition_hash: string
          dependency_manifest_hash: string
          dry_run_id: string
          dry_run_report_hash: string
          id: string
          locale_config_hash: string
          owner_id: string
          policy_hash: string
          policy_key: string
          policy_version: number
          required_capabilities: Json
          required_decision_count: number
          risk_class: string
          schema_artifact_id: string
          source_policy_hash: string | null
          source_policy_key: string | null
          source_policy_version: number | null
          state: string
          submitted_at: string
          submitter_person_ref: string
          updated_at: string
          version: number
        }
        Insert: {
          approval_evidence_hash?: string | null
          candidate_version_no: number
          compiler_version: string
          content_type_id: string
          content_type_version_id: string
          context_hash: string
          created_at?: string
          decided_at?: string | null
          definition_hash: string
          dependency_manifest_hash: string
          dry_run_id: string
          dry_run_report_hash: string
          id?: string
          locale_config_hash: string
          owner_id: string
          policy_hash: string
          policy_key: string
          policy_version: number
          required_capabilities: Json
          required_decision_count: number
          risk_class: string
          schema_artifact_id: string
          source_policy_hash?: string | null
          source_policy_key?: string | null
          source_policy_version?: number | null
          state?: string
          submitted_at?: string
          submitter_person_ref: string
          updated_at?: string
          version?: number
        }
        Update: {
          approval_evidence_hash?: string | null
          candidate_version_no?: number
          compiler_version?: string
          content_type_id?: string
          content_type_version_id?: string
          context_hash?: string
          created_at?: string
          decided_at?: string | null
          definition_hash?: string
          dependency_manifest_hash?: string
          dry_run_id?: string
          dry_run_report_hash?: string
          id?: string
          locale_config_hash?: string
          owner_id?: string
          policy_hash?: string
          policy_key?: string
          policy_version?: number
          required_capabilities?: Json
          required_decision_count?: number
          risk_class?: string
          schema_artifact_id?: string
          source_policy_hash?: string | null
          source_policy_key?: string | null
          source_policy_version?: number | null
          state?: string
          submitted_at?: string
          submitter_person_ref?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_schema_reviews_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "cms_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_reviews_content_type_version_id_fkey"
            columns: ["content_type_version_id"]
            isOneToOne: false
            referencedRelation: "cms_content_type_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_schema_reviews_dry_run_id_fkey"
            columns: ["dry_run_id"]
            isOneToOne: false
            referencedRelation: "cms_schema_dry_run_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_schema_transform_registry: {
        Row: {
          accepted_field_kinds: Json
          behavior: string
          created_at: string
          digest: string
          id: string
          owner_id: string
          source_constraints: Json
          state: string
          target_constraints: Json
          transform_key: string
          transform_version: number
          updated_at: string
          version: number
        }
        Insert: {
          accepted_field_kinds: Json
          behavior: string
          created_at?: string
          digest: string
          id?: string
          owner_id: string
          source_constraints: Json
          state?: string
          target_constraints: Json
          transform_key: string
          transform_version: number
          updated_at?: string
          version: number
        }
        Update: {
          accepted_field_kinds?: Json
          behavior?: string
          created_at?: string
          digest?: string
          id?: string
          owner_id?: string
          source_constraints?: Json
          state?: string
          target_constraints?: Json
          transform_key?: string
          transform_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      cms_taxonomy_versions: {
        Row: {
          allowlisted_field_keys: Json
          allowlisted_type_keys: Json
          content_hash: string
          created_at: string
          created_by: string
          id: string
          owner_capability: string
          owner_id: string
          shape: string
          state: string
          taxonomy_key: string
          updated_at: string
          version: number
        }
        Insert: {
          allowlisted_field_keys: Json
          allowlisted_type_keys: Json
          content_hash: string
          created_at?: string
          created_by: string
          id?: string
          owner_capability: string
          owner_id: string
          shape: string
          state?: string
          taxonomy_key: string
          updated_at?: string
          version: number
        }
        Update: {
          allowlisted_field_keys?: Json
          allowlisted_type_keys?: Json
          content_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          owner_capability?: string
          owner_id?: string
          shape?: string
          state?: string
          taxonomy_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_taxonomy_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_template_versions: {
        Row: {
          audience: string
          bindings: Json
          block_registry_digest: string
          compatible_type_ids: Json
          content_hash: string
          created_at: string
          created_by: string
          id: string
          locale: string
          owner_id: string
          reserved_regions: Json
          slots: Json
          state: string
          supersedes_id: string | null
          template_key: string
          updated_at: string
          version: number
        }
        Insert: {
          audience: string
          bindings: Json
          block_registry_digest: string
          compatible_type_ids: Json
          content_hash: string
          created_at?: string
          created_by: string
          id?: string
          locale: string
          owner_id: string
          reserved_regions: Json
          slots: Json
          state?: string
          supersedes_id?: string | null
          template_key: string
          updated_at?: string
          version: number
        }
        Update: {
          audience?: string
          bindings?: Json
          block_registry_digest?: string
          compatible_type_ids?: Json
          content_hash?: string
          created_at?: string
          created_by?: string
          id?: string
          locale?: string
          owner_id?: string
          reserved_regions?: Json
          slots?: Json
          state?: string
          supersedes_id?: string | null
          template_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_template_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_template_versions_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "cms_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_term_assignments: {
        Row: {
          created_at: string
          created_by: string
          field_definition_id: string
          id: string
          owner_id: string
          position: number
          provenance: string
          revision_id: string
          state: string
          taxonomy_version_id: string
          term_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          field_definition_id: string
          id?: string
          owner_id: string
          position: number
          provenance: string
          revision_id: string
          state?: string
          taxonomy_version_id: string
          term_id: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          field_definition_id?: string
          id?: string
          owner_id?: string
          position?: number
          provenance?: string
          revision_id?: string
          state?: string
          taxonomy_version_id?: string
          term_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_term_assignments_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_assignments_field_owner_fkey"
            columns: ["field_definition_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_field_definition_versions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_term_assignments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_assignments_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_assignments_revision_owner_fkey"
            columns: ["revision_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_entry_revisions"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "cms_term_assignments_taxonomy_version_id_fkey"
            columns: ["taxonomy_version_id"]
            isOneToOne: false
            referencedRelation: "cms_taxonomy_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_assignments_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_assignments_term_taxonomy_owner_fkey"
            columns: ["term_id", "taxonomy_version_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id", "taxonomy_version_id", "owner_id"]
          },
        ]
      }
      cms_term_labels: {
        Row: {
          aliases: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          label: string
          locale: string
          owner_id: string
          state: string
          term_id: string
          updated_at: string
          version: number
        }
        Insert: {
          aliases?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          label: string
          locale: string
          owner_id: string
          state?: string
          term_id: string
          updated_at?: string
          version: number
        }
        Update: {
          aliases?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          label?: string
          locale?: string
          owner_id?: string
          state?: string
          term_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_term_labels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_term_labels_term_owner_fkey"
            columns: ["term_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_terms: {
        Row: {
          aliases: Json
          created_at: string
          created_by: string
          id: string
          lifecycle: string
          owner_id: string
          parent_term_id: string | null
          successor_id: string | null
          taxonomy_version_id: string
          term_key: string
          updated_at: string
          version: number
        }
        Insert: {
          aliases?: Json
          created_at?: string
          created_by: string
          id?: string
          lifecycle?: string
          owner_id: string
          parent_term_id?: string | null
          successor_id?: string | null
          taxonomy_version_id: string
          term_key: string
          updated_at?: string
          version: number
        }
        Update: {
          aliases?: Json
          created_at?: string
          created_by?: string
          id?: string
          lifecycle?: string
          owner_id?: string
          parent_term_id?: string | null
          successor_id?: string | null
          taxonomy_version_id?: string
          term_key?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cms_terms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_terms_parent_taxonomy_owner_fkey"
            columns: ["parent_term_id", "taxonomy_version_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id", "taxonomy_version_id", "owner_id"]
          },
          {
            foreignKeyName: "cms_terms_parent_term_id_fkey"
            columns: ["parent_term_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_terms_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_terms_successor_taxonomy_owner_fkey"
            columns: ["successor_id", "taxonomy_version_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_terms"
            referencedColumns: ["id", "taxonomy_version_id", "owner_id"]
          },
          {
            foreignKeyName: "cms_terms_taxonomy_owner_fkey"
            columns: ["taxonomy_version_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "cms_taxonomy_versions"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      cms_workflow_policies: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          policy_hash: string
          policy_key: string
          policy_version: number
          required_capabilities: Json
          required_decision_count: number
          risk_class: string
          state: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          policy_hash: string
          policy_key: string
          policy_version: number
          required_capabilities: Json
          required_decision_count: number
          risk_class: string
          state?: string
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          policy_hash?: string
          policy_key?: string
          policy_version?: number
          required_capabilities?: Json
          required_decision_count?: number
          risk_class?: string
          state?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      consumer_dead_letters: {
        Row: {
          aggregate_id: string | null
          aggregate_type: string | null
          aggregate_version: string | null
          consumer: string
          created_at: string
          event_id: string | null
          event_type: string | null
          id: string
          reason_code: string
          schema_version: number | null
        }
        Insert: {
          aggregate_id?: string | null
          aggregate_type?: string | null
          aggregate_version?: string | null
          consumer: string
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          reason_code: string
          schema_version?: number | null
        }
        Update: {
          aggregate_id?: string | null
          aggregate_type?: string | null
          aggregate_version?: string | null
          consumer?: string
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          reason_code?: string
          schema_version?: number | null
        }
        Relationships: []
      }
      db_harness_fixture: {
        Row: {
          created_at: string
          id: string
          label: string
          owner_id: string
        }
        Insert: {
          created_at: string
          id: string
          label: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
        }
        Relationships: []
      }
      handle_reservation: {
        Row: {
          created_at: string
          display_handle: string
          first_used_at: string
          id: string
          last_used_at: string
          normalized_handle: string
          party_id: string
          retired_at: string | null
          state: Database["platform_private"]["Enums"]["handle_state"]
          successor_handle_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          display_handle: string
          first_used_at?: string
          id?: string
          last_used_at?: string
          normalized_handle: string
          party_id: string
          retired_at?: string | null
          state?: Database["platform_private"]["Enums"]["handle_state"]
          successor_handle_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          display_handle?: string
          first_used_at?: string
          id?: string
          last_used_at?: string
          normalized_handle?: string
          party_id?: string
          retired_at?: string | null
          state?: Database["platform_private"]["Enums"]["handle_state"]
          successor_handle_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "handle_reservation_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handle_reservation_successor_handle_id_fkey"
            columns: ["successor_handle_id"]
            isOneToOne: false
            referencedRelation: "handle_reservation"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_records: {
        Row: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        Insert: {
          actor_id: string
          claim_lease_until?: string | null
          claim_token_hash?: string | null
          created_at?: string
          expires_at: string
          id?: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref?: Json | null
          state?: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        Update: {
          actor_id?: string
          claim_lease_until?: string | null
          claim_token_hash?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key_hash?: string
          operation?: string
          request_hash?: string
          response_ref?: Json | null
          state?: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        Relationships: []
      }
      job_read_rate_limits: {
        Row: {
          request_count: number
          scope: string
          scope_id: string
          window_started_at: string
        }
        Insert: {
          request_count?: number
          scope: string
          scope_id: string
          window_started_at: string
        }
        Update: {
          request_count?: number
          scope?: string
          scope_id?: string
          window_started_at?: string
        }
        Relationships: []
      }
      job_type_registry: {
        Row: {
          job_type: string
          registered_at: string
        }
        Insert: {
          job_type: string
          registered_at?: string
        }
        Update: {
          job_type?: string
          registered_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          acting_party_id: string
          actor_id: string
          attempt_count: number
          attempts: Json
          causation_id: string | null
          correlation_id: string
          created_at: string
          error_code: string | null
          id: string
          job_type: string
          lease_token: string | null
          lease_until: string | null
          originating_event_id: string
          progress: Json | null
          result_ref: Json | null
          state: Database["platform_private"]["Enums"]["job_state"]
          updated_at: string
          version: number
        }
        Insert: {
          acting_party_id: string
          actor_id: string
          attempt_count?: number
          attempts?: Json
          causation_id?: string | null
          correlation_id: string
          created_at?: string
          error_code?: string | null
          id?: string
          job_type: string
          lease_token?: string | null
          lease_until?: string | null
          originating_event_id: string
          progress?: Json | null
          result_ref?: Json | null
          state?: Database["platform_private"]["Enums"]["job_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          acting_party_id?: string
          actor_id?: string
          attempt_count?: number
          attempts?: Json
          causation_id?: string | null
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          id?: string
          job_type?: string
          lease_token?: string | null
          lease_until?: string | null
          originating_event_id?: string
          progress?: Json | null
          result_ref?: Json | null
          state?: Database["platform_private"]["Enums"]["job_state"]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      legal_disclosure_event: {
        Row: {
          acting_party_id: string
          actor_person_id: string
          created_at: string
          field_codes: string[]
          id: string
          legal_identity_id: string
          legal_identity_version: number
          occurred_at: string
          purpose_code: string
          recipient_party_id: string
          request_id: string
          transaction_id: string
        }
        Insert: {
          acting_party_id: string
          actor_person_id: string
          created_at?: string
          field_codes: string[]
          id?: string
          legal_identity_id: string
          legal_identity_version: number
          occurred_at?: string
          purpose_code: string
          recipient_party_id: string
          request_id: string
          transaction_id: string
        }
        Update: {
          acting_party_id?: string
          actor_person_id?: string
          created_at?: string
          field_codes?: string[]
          id?: string
          legal_identity_id?: string
          legal_identity_version?: number
          occurred_at?: string
          purpose_code?: string
          recipient_party_id?: string
          request_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_disclosure_event_acting_party_id_fkey"
            columns: ["acting_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_disclosure_event_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "legal_disclosure_event_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "legal_disclosure_event_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "legal_disclosure_event_legal_identity_id_fkey"
            columns: ["legal_identity_id"]
            isOneToOne: false
            referencedRelation: "legal_identity_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_disclosure_event_recipient_party_id_fkey"
            columns: ["recipient_party_id"]
            isOneToOne: false
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_identity_record: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          person_id: string
          protected_field_refs: Json
          state: Database["platform_private"]["Enums"]["legal_identity_state"]
          updated_at: string
          verification_ref: string | null
          version: number
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          person_id: string
          protected_field_refs: Json
          state?: Database["platform_private"]["Enums"]["legal_identity_state"]
          updated_at?: string
          verification_ref?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          person_id?: string
          protected_field_refs?: Json
          state?: Database["platform_private"]["Enums"]["legal_identity_state"]
          updated_at?: string
          verification_ref?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_identity_record_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "legal_identity_record_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "legal_identity_record_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      object_records: {
        Row: {
          bucket: string
          byte_size: number
          checksum: string
          created_at: string
          id: string
          media_type: string
          object_key: string
          observed_byte_size: number | null
          observed_checksum: string | null
          observed_media_type: string | null
          owner_party_id: string
          purpose: string
          retention_class: string
          state: Database["platform_private"]["Enums"]["object_state"]
          version: number
        }
        Insert: {
          bucket: string
          byte_size: number
          checksum: string
          created_at?: string
          id?: string
          media_type: string
          object_key: string
          observed_byte_size?: number | null
          observed_checksum?: string | null
          observed_media_type?: string | null
          owner_party_id: string
          purpose: string
          retention_class: string
          state?: Database["platform_private"]["Enums"]["object_state"]
          version?: number
        }
        Update: {
          bucket?: string
          byte_size?: number
          checksum?: string
          created_at?: string
          id?: string
          media_type?: string
          object_key?: string
          observed_byte_size?: number | null
          observed_checksum?: string | null
          observed_media_type?: string | null
          owner_party_id?: string
          purpose?: string
          retention_class?: string
          state?: Database["platform_private"]["Enums"]["object_state"]
          version?: number
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          aggregate_version: number
          causation_id: string | null
          correlation_id: string
          dead_letter_reason: string | null
          dead_lettered_at: string | null
          dispatch_attempt_count: number
          dispatch_lease_token: string | null
          dispatch_lease_until: string | null
          dispatched_at: string | null
          event_type: string
          id: string
          last_dispatch_error_code: string | null
          occurred_at: string
          payload: Json
          schema_version: number
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          aggregate_version: number
          causation_id?: string | null
          correlation_id: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          dispatch_attempt_count?: number
          dispatch_lease_token?: string | null
          dispatch_lease_until?: string | null
          dispatched_at?: string | null
          event_type: string
          id?: string
          last_dispatch_error_code?: string | null
          occurred_at?: string
          payload: Json
          schema_version: number
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          aggregate_version?: number
          causation_id?: string | null
          correlation_id?: string
          dead_letter_reason?: string | null
          dead_lettered_at?: string | null
          dispatch_attempt_count?: number
          dispatch_lease_token?: string | null
          dispatch_lease_until?: string | null
          dispatched_at?: string | null
          event_type?: string
          id?: string
          last_dispatch_error_code?: string | null
          occurred_at?: string
          payload?: Json
          schema_version?: number
        }
        Relationships: []
      }
      party: {
        Row: {
          created_at: string
          id: string
          kind: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      person_party: {
        Row: {
          account_state: Database["platform_private"]["Enums"]["person_account_state"]
          auth_user_id: string | null
          created_at: string
          legal_identity_id: string | null
          party_id: string
          public_profile_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          account_state?: Database["platform_private"]["Enums"]["person_account_state"]
          auth_user_id?: string | null
          created_at?: string
          legal_identity_id?: string | null
          party_id: string
          public_profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          account_state?: Database["platform_private"]["Enums"]["person_account_state"]
          auth_user_id?: string | null
          created_at?: string
          legal_identity_id?: string | null
          party_id?: string
          public_profile_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_legal_identity_fk"
            columns: ["legal_identity_id"]
            isOneToOne: false
            referencedRelation: "legal_identity_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_party_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_events: {
        Row: {
          aggregate_id: string
          event_id: string
          event_type: string
          pending_manual_review: boolean
          processed_at: string
          schema_version: number
        }
        Insert: {
          aggregate_id: string
          event_id: string
          event_type: string
          pending_manual_review?: boolean
          processed_at?: string
          schema_version: number
        }
        Update: {
          aggregate_id?: string
          event_id?: string
          event_type?: string
          pending_manual_review?: boolean
          processed_at?: string
          schema_version?: number
        }
        Relationships: []
      }
      provider_operation_intents: {
        Row: {
          acting_party_id: string
          actor_id: string
          created_at: string
          governed_payload: Json
          intent_hash: string
          operation_id: string
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
        }
        Insert: {
          acting_party_id: string
          actor_id: string
          created_at?: string
          governed_payload: Json
          intent_hash: string
          operation_id: string
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
        }
        Update: {
          acting_party_id?: string
          actor_id?: string
          created_at?: string
          governed_payload?: Json
          intent_hash?: string
          operation_id?: string
          operation_type?: string
          provider?: string
          provider_idempotency_key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_operation_intents_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: true
            referencedRelation: "provider_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_operations: {
        Row: {
          actor_id: string
          attempts: Json
          causation_id: string | null
          correlation_id: string
          created_at: string
          id: string
          intent_hash: string
          last_attempt_at: string | null
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
          provider_ref: string | null
          reconciliation_at: string | null
          state: Database["platform_private"]["Enums"]["provider_operation_state"]
          version: number
        }
        Insert: {
          actor_id: string
          attempts?: Json
          causation_id?: string | null
          correlation_id: string
          created_at?: string
          id?: string
          intent_hash: string
          last_attempt_at?: string | null
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
          provider_ref?: string | null
          reconciliation_at?: string | null
          state?: Database["platform_private"]["Enums"]["provider_operation_state"]
          version?: number
        }
        Update: {
          actor_id?: string
          attempts?: Json
          causation_id?: string | null
          correlation_id?: string
          created_at?: string
          id?: string
          intent_hash?: string
          last_attempt_at?: string | null
          operation_type?: string
          provider?: string
          provider_idempotency_key_hash?: string
          provider_ref?: string | null
          reconciliation_at?: string | null
          state?: Database["platform_private"]["Enums"]["provider_operation_state"]
          version?: number
        }
        Relationships: []
      }
      recovery_verification_evidence: {
        Row: {
          artifact_digest: string | null
          artifact_id: string | null
          created_at: string
          environment: string | null
          expires_at: string
          id: string
          idempotency_outbox_job_verified: boolean
          integrity_verified: boolean
          measured_rpo_seconds: number | null
          measured_rto_seconds: number | null
          object_verified: boolean
          pitr_supported: boolean
          pitr_window_seconds: number | null
          promotion_id: string | null
          provenance_kind: string
          provider_webhook_verified: boolean
          public_projection_verified: boolean
          restore_epoch: number
          rls_verified: boolean
          rpc_verified: boolean
          source_revision: string | null
          verified_at: string
        }
        Insert: {
          artifact_digest?: string | null
          artifact_id?: string | null
          created_at?: string
          environment?: string | null
          expires_at: string
          id?: string
          idempotency_outbox_job_verified: boolean
          integrity_verified: boolean
          measured_rpo_seconds?: number | null
          measured_rto_seconds?: number | null
          object_verified: boolean
          pitr_supported: boolean
          pitr_window_seconds?: number | null
          promotion_id?: string | null
          provenance_kind?: string
          provider_webhook_verified: boolean
          public_projection_verified: boolean
          restore_epoch: number
          rls_verified: boolean
          rpc_verified: boolean
          source_revision?: string | null
          verified_at?: string
        }
        Update: {
          artifact_digest?: string | null
          artifact_id?: string | null
          created_at?: string
          environment?: string | null
          expires_at?: string
          id?: string
          idempotency_outbox_job_verified?: boolean
          integrity_verified?: boolean
          measured_rpo_seconds?: number | null
          measured_rto_seconds?: number | null
          object_verified?: boolean
          pitr_supported?: boolean
          pitr_window_seconds?: number | null
          promotion_id?: string | null
          provenance_kind?: string
          provider_webhook_verified?: boolean
          public_projection_verified?: boolean
          restore_epoch?: number
          rls_verified?: boolean
          rpc_verified?: boolean
          source_revision?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_verification_evidence_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "recovery_verification_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_verification_promotions: {
        Row: {
          artifact_digest: string
          artifact_id: string
          created_at: string
          environment: string
          expires_at: string
          id: string
          promoted_at: string
          source_revision: string
        }
        Insert: {
          artifact_digest: string
          artifact_id: string
          created_at?: string
          environment: string
          expires_at: string
          id: string
          promoted_at: string
          source_revision: string
        }
        Update: {
          artifact_digest?: string
          artifact_id?: string
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          promoted_at?: string
          source_revision?: string
        }
        Relationships: []
      }
      restore_fences: {
        Row: {
          created_at: string
          id: string
          reason: string
          released_at: string | null
          restore_epoch: number
          state: Database["platform_private"]["Enums"]["restore_fence_state"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          released_at?: string | null
          restore_epoch: number
          state?: Database["platform_private"]["Enums"]["restore_fence_state"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          released_at?: string | null
          restore_epoch?: number
          state?: Database["platform_private"]["Enums"]["restore_fence_state"]
        }
        Relationships: []
      }
      role_facet_assertion: {
        Row: {
          asserted_at: string
          created_at: string
          facet_code: string
          id: string
          person_id: string
          removed_at: string | null
          source: Database["platform_private"]["Enums"]["facet_source"]
          state: Database["platform_private"]["Enums"]["facet_state"]
          updated_at: string
          version: number
        }
        Insert: {
          asserted_at: string
          created_at?: string
          facet_code: string
          id?: string
          person_id: string
          removed_at?: string | null
          source: Database["platform_private"]["Enums"]["facet_source"]
          state: Database["platform_private"]["Enums"]["facet_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          asserted_at?: string
          created_at?: string
          facet_code?: string
          id?: string
          person_id?: string
          removed_at?: string | null
          source?: Database["platform_private"]["Enums"]["facet_source"]
          state?: Database["platform_private"]["Enums"]["facet_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "role_facet_assertion_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_public_person_projection"
            referencedColumns: ["party_id"]
          },
          {
            foreignKeyName: "role_facet_assertion_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "identity_self_projection"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "role_facet_assertion_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_party"
            referencedColumns: ["party_id"]
          },
        ]
      }
      upload_intent_authority: {
        Row: {
          acting_party_id: string
          actor_id: string
          created_at: string
          intent_id: string
          target_id: string
          target_type: string
          target_version: number | null
        }
        Insert: {
          acting_party_id: string
          actor_id: string
          created_at?: string
          intent_id: string
          target_id: string
          target_type: string
          target_version?: number | null
        }
        Update: {
          acting_party_id?: string
          actor_id?: string
          created_at?: string
          intent_id?: string
          target_id?: string
          target_type?: string
          target_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_intent_authority_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "upload_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_intents: {
        Row: {
          actor_id: string
          allowed_media_types: string[]
          created_at: string
          expires_at: string
          id: string
          max_bytes: number
          object_id: string
          state: Database["platform_private"]["Enums"]["upload_intent_state"]
        }
        Insert: {
          actor_id: string
          allowed_media_types: string[]
          created_at?: string
          expires_at: string
          id?: string
          max_bytes: number
          object_id: string
          state?: Database["platform_private"]["Enums"]["upload_intent_state"]
        }
        Update: {
          actor_id?: string
          allowed_media_types?: string[]
          created_at?: string
          expires_at?: string
          id?: string
          max_bytes?: number
          object_id?: string
          state?: Database["platform_private"]["Enums"]["upload_intent_state"]
        }
        Relationships: [
          {
            foreignKeyName: "upload_intents_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "object_records"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_event_records: {
        Row: {
          created_at: string
          event_type: string
          external_event_id: string
          normalized_event: Json
          payload_digest: string
          provider: string
          receipt_id: string
          schema_version: number
        }
        Insert: {
          created_at?: string
          event_type: string
          external_event_id: string
          normalized_event: Json
          payload_digest: string
          provider: string
          receipt_id: string
          schema_version: number
        }
        Update: {
          created_at?: string
          event_type?: string
          external_event_id?: string
          normalized_event?: Json
          payload_digest?: string
          provider?: string
          receipt_id?: string
          schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "webhook_event_records_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: true
            referencedRelation: "webhook_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_receipts: {
        Row: {
          attempts: Json
          external_event_id: string
          id: string
          operation_id: string | null
          payload_digest: string
          provider: string
          received_at: string
          signature_verified_at: string | null
          state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }
        Insert: {
          attempts?: Json
          external_event_id: string
          id?: string
          operation_id?: string | null
          payload_digest: string
          provider: string
          received_at?: string
          signature_verified_at?: string | null
          state?: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }
        Update: {
          attempts?: Json
          external_event_id?: string
          id?: string
          operation_id?: string | null
          payload_digest?: string
          provider?: string
          received_at?: string
          signature_verified_at?: string | null
          state?: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }
        Relationships: [
          {
            foreignKeyName: "webhook_receipts_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "provider_operations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      identity_public_person_projection: {
        Row: {
          account_state:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          kind: string | null
          party_id: string | null
          public_profile_id: string | null
          version: number | null
        }
        Insert: {
          account_state?:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          kind?: never
          party_id?: string | null
          public_profile_id?: string | null
          version?: number | null
        }
        Update: {
          account_state?:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          kind?: never
          party_id?: string | null
          public_profile_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "person_party_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_public_projection: {
        Row: {
          display_name: string | null
          handle: string | null
          kind: string | null
          lifecycle:
            | Database["platform_private"]["Enums"]["alias_lifecycle"]
            | null
          party_id: string | null
          public_link_state:
            | Database["platform_private"]["Enums"]["public_link_state"]
            | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alias_party_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: true
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_self_projection: {
        Row: {
          account_state:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          legal_identity_id: string | null
          person_id: string | null
          public_profile_id: string | null
          version: number | null
        }
        Insert: {
          account_state?:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          legal_identity_id?: string | null
          person_id?: string | null
          public_profile_id?: string | null
          version?: number | null
        }
        Update: {
          account_state?:
            | Database["platform_private"]["Enums"]["person_account_state"]
            | null
          legal_identity_id?: string | null
          person_id?: string | null
          public_profile_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "person_legal_identity_fk"
            columns: ["legal_identity_id"]
            isOneToOne: false
            referencedRelation: "legal_identity_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_party_party_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "party"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ac265_build_approved_outage_target_canonical_json: {
        Args: {
          p_approved_at: string
          p_dependency_id: string
          p_deployment_id: string
          p_expires_at: string
          p_hosting_project_id: string
          p_route_method: string
          p_route_operation_id: string
          p_route_path: string
          p_run_id: string
          p_supabase_project_ref: string
          p_target_id: string
          p_target_ref: string
        }
        Returns: string
      }
      ac265_build_approved_outage_target_registration_envelope: {
        Args: { p_registration_id: string }
        Returns: Json
      }
      ac265_build_approved_runner_mapping_envelope: {
        Args: {
          p_authorization_id: string
          p_idempotency_ref?: string
          p_mapping_id: string
        }
        Returns: Json
      }
      ac265_build_hosted_artifact_manifest_envelope: {
        Args: { p_manifest_id: string }
        Returns: Json
      }
      ac265_build_session_broker_authorize_envelope: {
        Args: { p_broker_authorization_id: string }
        Returns: Json
      }
      ac265_build_session_broker_resolve_envelope: {
        Args: { p_handle_id: string }
        Returns: Json
      }
      ac265_build_session_broker_teardown_envelope: {
        Args: { p_handle_id: string }
        Returns: Json
      }
      ac265_prepare_hosted_run_candidate: {
        Args: { p_request: Json }
        Returns: Json
      }
      accept_job_with_outbox: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id?: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_job_id?: string
          p_job_type: string
          p_request_hash: string
        }
        Returns: {
          event_id: string
          job_id: string
          replayed: boolean
          version: number
        }[]
      }
      admin_actions_valid: { Args: { p_actions: string[] }; Returns: boolean }
      admin_business_request: { Args: { p_request: Json }; Returns: Json }
      admin_capability_allows: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_capability_key: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: boolean
      }
      admin_grantor_can_delegate: {
        Args: {
          p_acting_party_id: string
          p_actions: string[]
          p_actor_person_id: string
          p_capability_key: string
          p_ends_at: string
          p_resource_id: string
          p_resource_type: string
          p_scope: Json
          p_starts_at: string
        }
        Returns: boolean
      }
      admin_inbox_cursor_encode: {
        Args: { p_due_at: string; p_task_id: string }
        Returns: string
      }
      admin_mfa_factor_reset_view: {
        Args: { p_reset_id: string }
        Returns: Json
      }
      admin_request_reserve: {
        Args: { p_acting_party_id: string; p_actor_id: string; p_request: Json }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_result_codes_valid: {
        Args: { p_codes: string[] }
        Returns: boolean
      }
      admin_scope_valid: {
        Args: { p_acting_party_id?: string; p_scope: Json }
        Returns: boolean
      }
      apply_job_outcome:
        | {
            Args: {
              p_error_code: string
              p_expected_version: number
              p_job_id: string
              p_lease_token: string
              p_next_state: Database["platform_private"]["Enums"]["job_state"]
              p_result_ref: Json
              p_retryable: boolean
            }
            Returns: boolean
          }
        | {
            Args: {
              p_error_code: string
              p_expected_version: number
              p_job_id: string
              p_next_state: Database["platform_private"]["Enums"]["job_state"]
              p_result_ref: Json
              p_retryable: boolean
            }
            Returns: boolean
          }
      apply_object_verification: {
        Args: {
          p_correlation_id?: string
          p_error_code?: string
          p_expected_version: number
          p_job_id?: string
          p_next_state: Database["platform_private"]["Enums"]["object_state"]
          p_object_id: string
        }
        Returns: {
          applied: boolean
          job_id: string
          object_id: string
          state: Database["platform_private"]["Enums"]["object_state"]
          version: number
        }[]
      }
      apply_provider_operation_outcome: {
        Args: {
          p_attempt_ended_at?: string
          p_attempt_started_at?: string
          p_error_code?: string
          p_expected_version: number
          p_next_state: Database["platform_private"]["Enums"]["provider_operation_state"]
          p_operation_id: string
          p_provider_ref?: string
          p_retryable?: boolean
        }
        Returns: boolean
      }
      apply_provider_operation_outcome_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_attempt_ended_at?: string
          p_attempt_started_at?: string
          p_error_code?: string
          p_expected_version: number
          p_next_state: Database["platform_private"]["Enums"]["provider_operation_state"]
          p_operation_id: string
          p_provider_ref?: string
          p_retryable?: boolean
        }
        Returns: boolean
      }
      apply_webhook_receipt_outcome: {
        Args: {
          p_error_code?: string
          p_expected_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_next_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_operation_id?: string
          p_receipt_id: string
        }
        Returns: boolean
      }
      apply_webhook_receipt_outcome_authorized: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_error_code: string
          p_expected_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_next_state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
          p_operation_id: string
          p_receipt_id: string
        }
        Returns: boolean
      }
      auth_iso_time: { Args: { p_value: string }; Returns: string }
      auth_login_methods_projection: {
        Args: { p_auth_user_id: string }
        Returns: Json
      }
      auth_merge_projection: { Args: { p_merge_id: string }; Returns: Json }
      auth_require_active_session: {
        Args: { p_auth_user_id: string; p_session_id: string }
        Returns: {
          binding_id: string
          binding_version: number
          person_id: string
        }[]
      }
      auth_reserve_idempotency: {
        Args: {
          p_actor_id: string
          p_expires_at: string
          p_key_hash: string
          p_operation: string
          p_request_hash: string
        }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      begin_restore_fence: {
        Args: { p_reason: string; p_restore_epoch: number }
        Returns: boolean
      }
      bootstrap_auth_user: {
        Args: {
          p_auth_user_id: string
          p_correlation_id: string
          p_request_id: string
        }
        Returns: {
          account_state: string
          acting_party_id: string
          binding_version: number
          created: boolean
          person_id: string
        }[]
      }
      cfg_acting_party: {
        Args: { p_actor_id: string; p_request: Json }
        Returns: string
      }
      cfg_actor: { Args: { p_request: Json }; Returns: string }
      cfg_array_distinct: { Args: { p_values: string[] }; Returns: boolean }
      cfg_change_action: { Args: { p_request: Json }; Returns: Json }
      cfg_context_value: {
        Args: { p_name: string; p_request: Json }
        Returns: string
      }
      cfg_correlation: { Args: { p_request: Json }; Returns: string }
      cfg_definition_response: {
        Args: {
          p_definition: Database["platform_private"]["Tables"]["cfg_setting_definition_versions"]["Row"]
          p_definition_id: string
          p_synchronized?: boolean
        }
        Returns: Json
      }
      cfg_emit_effects: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_aggregate_id: string
          p_aggregate_type: string
          p_aggregate_version: number
          p_correlation_id: string
          p_event_type: string
          p_payload: Json
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      cfg_experiment_allocation_valid: {
        Args: { p_allocation: Json; p_variants: Json }
        Returns: boolean
      }
      cfg_experiment_dimensions_allowed: {
        Args: { p_dimensions: string[] }
        Returns: boolean
      }
      cfg_hash_json: { Args: { p_value: Json }; Returns: string }
      cfg_hash_text: { Args: { p_value: string }; Returns: string }
      cfg_json_bounded: {
        Args: { p_max_bytes?: number; p_max_depth?: number; p_value: Json }
        Returns: boolean
      }
      cfg_json_depth: { Args: { p_value: Json }; Returns: number }
      cfg_key_array_valid: { Args: { p_values: string[] }; Returns: boolean }
      cfg_kill_scope_declared: {
        Args: { p_scope_id: string; p_scope_type: string; p_scopes: Json }
        Returns: boolean
      }
      cfg_kill_scopes_valid: { Args: { p_scopes: Json }; Returns: boolean }
      cfg_parse_uuid: {
        Args: { p_code?: string; p_value: string }
        Returns: string
      }
      cfg_parse_version: {
        Args: { p_code?: string; p_value: string }
        Returns: number
      }
      cfg_propose_change: { Args: { p_request: Json }; Returns: Json }
      cfg_protected_key: { Args: { p_value: string }; Returns: boolean }
      cfg_register_definition: { Args: { p_request: Json }; Returns: Json }
      cfg_release_actor: { Args: { p_request: Json }; Returns: string }
      cfg_release_request_actor: {
        Args: { p_request: Json }
        Returns: {
          acting_party_id: string
          actor_id: string
        }[]
      }
      cfg_request_actor: {
        Args: { p_request: Json; p_require_context?: boolean }
        Returns: {
          acting_party_id: string
          actor_id: string
        }[]
      }
      cfg_request_complete: {
        Args: { p_id: string; p_response: Json; p_status: number }
        Returns: undefined
      }
      cfg_request_reserve: {
        Args: { p_actor_id: string; p_operation: string; p_request: Json }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cfg_require_capability: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capability: string
        }
        Returns: undefined
      }
      cfg_require_fresh_step_up: {
        Args: { p_max_age?: string; p_request: Json }
        Returns: undefined
      }
      cfg_require_keys: {
        Args: { p_allowed: string[]; p_required?: string[]; p_value: Json }
        Returns: undefined
      }
      cfg_resolve_effective_value: { Args: { p_request: Json }; Returns: Json }
      cfg_scope_is_valid: {
        Args: {
          p_environment: string
          p_scope_id: string
          p_scope_type: string
        }
        Returns: boolean
      }
      cfg_valid_key: { Args: { p_value: string }; Returns: boolean }
      cfg_valid_uuid: { Args: { p_value: string }; Returns: boolean }
      cfg_validate_value: {
        Args: { p_kind: string; p_schema: Json; p_value: Json }
        Returns: boolean
      }
      claim_job: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          attempt_count: number
          job_id: string
          lease_until: string
          state: Database["platform_private"]["Enums"]["job_state"]
          version: number
        }[]
      }
      claim_outbox_batch: {
        Args: {
          p_batch_size: number
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          aggregate_version: number
          causation_id: string
          correlation_id: string
          dispatch_attempt_count: number
          event_id: string
          event_type: string
          lease_token: string
          schema_version: number
        }[]
      }
      claim_outbox_event: {
        Args: {
          p_event_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: {
          aggregate_id: string
          aggregate_version: number
          dispatch_attempt_count: number
          event_id: string
          lease_token: string
        }[]
      }
      cms_acknowledge_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_acting_party: {
        Args: { p_actor_id: string; p_request: Json }
        Returns: string
      }
      cms_activate_schema: { Args: { p_request: Json }; Returns: Json }
      cms_activation_frozen_risk_class: {
        Args: { p_candidate_id: string }
        Returns: string
      }
      cms_activation_preparation: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_version_id: string
        }
        Returns: Json
      }
      cms_activation_references_valid: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      cms_activation_risk_class: {
        Args: { p_workflow_key: string }
        Returns: string
      }
      cms_actor: { Args: { p_request: Json }; Returns: string }
      cms_add_field_definition: { Args: { p_request: Json }; Returns: Json }
      cms_advance_activation_plan: {
        Args: {
          p_candidate_id: string
          p_dry_run_id: string
          p_requested_plan_id: string
          p_source_id: string
        }
        Returns: string
      }
      cms_advance_block_lifecycle: { Args: { p_request: Json }; Returns: Json }
      cms_artifact_contract_ref: {
        Args: { p_type_key: string; p_version_no: number }
        Returns: string
      }
      cms_assign_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_author_locale_variant: { Args: { p_request: Json }; Returns: Json }
      cms_authority_origin: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capability_key: string
          p_entry_id: string
        }
        Returns: string
      }
      cms_backfill_owner_capability_grants: {
        Args: { p_organization_id: string }
        Returns: number
      }
      cms_begin_schema_migration_verification: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_bind_relation: { Args: { p_request: Json }; Returns: Json }
      cms_block_key_registry_valid: {
        Args: { p_current_key?: string; p_key: string }
        Returns: boolean
      }
      cms_block_reference_valid: {
        Args: { p_reference: Json }
        Returns: boolean
      }
      cms_candidate_compiled_current: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      cms_candidate_definition_request: {
        Args: { p_version_id: string }
        Returns: Json
      }
      cms_canonical_type_definition: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_capability_grant_project: {
        Args: {
          p_active: boolean
          p_capability: string
          p_organization_id: string
          p_person_id: string
          p_valid_from: string
          p_valid_through: string
        }
        Returns: undefined
      }
      cms_capability_grant_record_event: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_binding_id: string
          p_grant_id: string
          p_mfa_verified_at: string
          p_prior_valid_through: string
        }
        Returns: undefined
      }
      cms_capability_grant_resource: {
        Args: { p_grant_id: string }
        Returns: Json
      }
      cms_capability_grant_state: {
        Args: { p_state: string; p_valid_through: string }
        Returns: string
      }
      cms_capability_registry_valid: {
        Args: { p_key: string; p_version?: number }
        Returns: boolean
      }
      cms_claim_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_claim_schema_migration_lease: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_compile_candidate: { Args: { p_version_id: string }; Returns: string }
      cms_compiled_editor_manifest: { Args: { p_request: Json }; Returns: Json }
      cms_compiled_manifest_bounded: {
        Args: { p_value: Json }
        Returns: boolean
      }
      cms_compiled_renderer_manifest: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_compiler_registry_valid: {
        Args: { p_version: string }
        Returns: boolean
      }
      cms_complete: {
        Args: {
          p_reservation_id: string
          p_resource_id: string
          p_response?: Json
          p_status: number
        }
        Returns: undefined
      }
      cms_complete_schema_migration: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_correlation: { Args: { p_request: Json }; Returns: string }
      cms_create_entry: { Args: { p_request: Json }; Returns: Json }
      cms_create_revision: { Args: { p_request: Json }; Returns: Json }
      cms_create_schema_successor: { Args: { p_request: Json }; Returns: Json }
      cms_create_type_draft: { Args: { p_request: Json }; Returns: Json }
      cms_data_source_registry_valid: {
        Args: { p_key: string }
        Returns: boolean
      }
      cms_dead_letter_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_decide_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_define_template: { Args: { p_request: Json }; Returns: Json }
      cms_definition_artifact_hash:
        | { Args: { p_request: Json }; Returns: string }
        | { Args: { p_request: Json; p_version_no: number }; Returns: string }
      cms_derive_schema_classification: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: string
      }
      cms_derive_schema_field_classification: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: string
      }
      cms_draft_content_hash: {
        Args: { p_locale: string; p_revision_id: string }
        Returns: string
      }
      cms_draft_field_value_valid: {
        Args: {
          p_field_id: string
          p_provenance: string
          p_schema_version_id: string
          p_value: Json
        }
        Returns: boolean
      }
      cms_dry_run_report_valid: {
        Args: {
          p_classification: string
          p_compiler_hash: string
          p_compiler_version: string
          p_dry_run_id: string
          p_report: Json
          p_source_hash: string
          p_target_hash: string
          p_transform_key: string
          p_transform_version: number
        }
        Returns: boolean
      }
      cms_editorial_workflow_policy_evidence: {
        Args: { p_version_id: string }
        Returns: Json
      }
      cms_emit_event: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_aggregate_id: string
          p_aggregate_type: string
          p_aggregate_version: number
          p_correlation_id: string
          p_event_type: string
          p_payload: Json
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      cms_entry_tenant_visible: {
        Args: { p_actor_id: string; p_owner_party_id: string }
        Returns: boolean
      }
      cms_exact_keys: {
        Args: { p_allowed: string[]; p_required: string[]; p_value: Json }
        Returns: boolean
      }
      cms_expected_version: { Args: { p_request: Json }; Returns: number }
      cms_finalize_schema_migration_dry_run: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_content_type_version: { Args: { p_request: Json }; Returns: Json }
      cms_get_entry_draft: { Args: { p_request: Json }; Returns: Json }
      cms_get_schema_migration_plan: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_get_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_grant_capability: { Args: { p_request: Json }; Returns: Json }
      cms_grant_owner: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: string
      }
      cms_grant_reason: { Args: { p_request: Json }; Returns: string }
      cms_grant_subject_eligible: {
        Args: { p_organization_id: string; p_person_id: string }
        Returns: boolean
      }
      cms_grant_subject_lock: {
        Args: { p_organization_id: string; p_person_id: string }
        Returns: boolean
      }
      cms_grant_today: { Args: never; Returns: string }
      cms_grant_valid_through: { Args: { p_value: Json }; Returns: string }
      cms_grantable_capability: { Args: { p_key: string }; Returns: boolean }
      cms_heartbeat_schema_migration_lease: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_history_cursor_mac_equal: {
        Args: { p_left: string; p_right: string }
        Returns: boolean
      }
      cms_invalidate_activation_reviews: {
        Args: { p_candidate_id: string }
        Returns: number
      }
      cms_invalidate_activation_reviews_for_owner: {
        Args: { p_owner_id: string }
        Returns: number
      }
      cms_jcs: { Args: { p_value: Json }; Returns: string }
      cms_jcs_number: { Args: { p_value: Json }; Returns: string }
      cms_jcs_sha256: { Args: { p_value: Json }; Returns: string }
      cms_json_bounded: {
        Args: {
          p_max_array?: number
          p_max_bytes?: number
          p_max_depth?: number
          p_max_keys?: number
          p_value: Json
        }
        Returns: boolean
      }
      cms_json_depth: { Args: { p_value: Json }; Returns: number }
      cms_key_hash: { Args: { p_key: string }; Returns: string }
      cms_list_capability_grants: { Args: { p_request: Json }; Returns: Json }
      cms_list_content_types: { Args: { p_request: Json }; Returns: Json }
      cms_list_revisions: { Args: { p_request: Json }; Returns: Json }
      cms_list_revisions_signed: { Args: { p_request: Json }; Returns: Json }
      cms_locale_canonical_valid: { Args: { p_tag: string }; Returns: boolean }
      cms_locale_config_hash: {
        Args: {
          p_chains: Json
          p_default: string
          p_source: string
          p_supported: Json
        }
        Returns: string
      }
      cms_locale_config_shape_valid: {
        Args: { p_chains: Json; p_supported: Json }
        Returns: boolean
      }
      cms_locale_config_violations: {
        Args: {
          p_chains: Json
          p_default: string
          p_source: string
          p_supported: Json
        }
        Returns: Json
      }
      cms_locale_sorted: { Args: { p_supported: Json }; Returns: Json }
      cms_locale_violation_detail: { Args: { p_issues: Json }; Returns: string }
      cms_lock_activation_authority: {
        Args: {
          p_actor_id: string
          p_candidate_id: string
          p_context_id?: string
        }
        Returns: undefined
      }
      cms_lock_activation_graph: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      cms_migration_affected_variants: {
        Args: { p_from_version_id: string; p_to_version_id: string }
        Returns: {
          revision_id: string
          variant_id: string
        }[]
      }
      cms_migration_changed_fields: {
        Args: { p_plan_id: string }
        Returns: {
          constraints: Json
          content_type_version_id: string
          created_at: string
          created_by: string
          default_mode: string
          default_value: Json | null
          editor_config: Json
          field_key: string
          id: string
          kind: string
          localization_mode: string
          owner_id: string
          required: boolean
          stable_field_id: string
          state: string
          updated_at: string
          validator_key: string | null
          validator_version: number | null
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "cms_field_definition_versions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cms_migration_expected_output: {
        Args: {
          p_document: Json
          p_key: string
          p_spec: Json
          p_target_version_id: string
        }
        Returns: Json
      }
      cms_migration_live_rows: {
        Args: { p_from_version_id: string; p_to_version_id: string }
        Returns: {
          revision_id: string
          source_row_id: string
          source_table: string
        }[]
      }
      cms_migration_plan_ready: {
        Args: {
          p_content_type_id: string
          p_plan_id: string
          p_to_version_id: string
        }
        Returns: boolean
      }
      cms_migration_retired_fields: {
        Args: { p_plan_id: string }
        Returns: Json
      }
      cms_migration_revision_document: {
        Args: { p_revision_id: string }
        Returns: Json
      }
      cms_migration_scan_preflight: {
        Args: { p_plan_id: string }
        Returns: undefined
      }
      cms_migration_source_evidence_valid: {
        Args: {
          p_plan: Database["platform_private"]["Tables"]["cms_schema_migration_plans"]["Row"]
        }
        Returns: boolean
      }
      cms_migration_source_unchanged: {
        Args: {
          p_plan: Database["platform_private"]["Tables"]["cms_schema_migration_plans"]["Row"]
        }
        Returns: boolean
      }
      cms_migration_spec_kinds_accepted: {
        Args: { p_member: Json; p_spec: Json }
        Returns: boolean
      }
      cms_migration_target_fields_spec: {
        Args: { p_plan_id: string }
        Returns: Json
      }
      cms_migration_transform_hash: {
        Args: {
          p_classification: string
          p_compiler_hash: string
          p_compiler_version: string
          p_source_hash: string
          p_target_hash: string
          p_transform_key: string
          p_transform_version: number
        }
        Returns: string
      }
      cms_migration_value_valid: {
        Args: { p_document: Json; p_spec: Json; p_target_version_id: string }
        Returns: boolean
      }
      cms_migration_verify_reason: {
        Args: {
          p_plan: Database["platform_private"]["Tables"]["cms_schema_migration_plans"]["Row"]
        }
        Returns: string
      }
      cms_pattern_tree_keys_valid: { Args: { p_tree: Json }; Returns: boolean }
      cms_persisted_dry_run_report_valid: {
        Args: {
          p_classification: string
          p_compiler_hash: string
          p_compiler_version: string
          p_content_type_id: string
          p_owner_id: string
          p_report_id: string
          p_source_hash: string
          p_source_version_id: string
          p_target_hash: string
          p_target_version_id: string
          p_transform_key: string
          p_transform_version: number
        }
        Returns: boolean
      }
      cms_person_holds_capability: {
        Args: {
          p_capability: string
          p_organization_id: string
          p_person_id: string
        }
        Returns: boolean
      }
      cms_process_schema_migration_batch: {
        Args: { p_dry_run?: boolean; p_request: Json }
        Returns: Json
      }
      cms_process_schema_migration_dry_run_batch: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_projection_registry_valid: {
        Args: {
          p_projection_key: string
          p_target_kind: string
          p_target_type: string
        }
        Returns: boolean
      }
      cms_props_attestation_payload: {
        Args: { p_request: Json }
        Returns: string
      }
      cms_publish_session: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: undefined
      }
      cms_read_schema_migration_source_rows: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_reconcile_schema_activation: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_record_audit: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_correlation_id: string
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      cms_register_block: { Args: { p_request: Json }; Returns: Json }
      cms_register_block_at: {
        Args: { p_now_at: string; p_request: Json }
        Returns: Json
      }
      cms_release_actor: { Args: { p_request: Json }; Returns: string }
      cms_release_nonce_claim: {
        Args: { p_actor_id: string; p_operation_id: string; p_request: Json }
        Returns: string
      }
      cms_release_nonce_claim_at: {
        Args: {
          p_actor_id: string
          p_now_at: string
          p_operation_id: string
          p_request: Json
        }
        Returns: string
      }
      cms_release_schema_migration_event: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_release_signing_payload: {
        Args: { p_operation_id: string; p_request: Json }
        Returns: string
      }
      cms_renderer_registry_valid: { Args: { p_ref: string }; Returns: boolean }
      cms_renew_capability_grant: { Args: { p_request: Json }; Returns: Json }
      cms_request_hash: { Args: { p_request: Json }; Returns: string }
      cms_require_capability: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capability: string
        }
        Returns: undefined
      }
      cms_require_entry_capability: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capabilities: string[]
          p_entry_id: string
        }
        Returns: string
      }
      cms_require_read: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: undefined
      }
      cms_require_release_worker: { Args: never; Returns: undefined }
      cms_reserve: {
        Args: { p_actor_id: string; p_operation: string; p_request: Json }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cms_reserve_conflict: {
        Args: { p_actor_id: string; p_operation: string; p_request: Json }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cms_reserved_key: { Args: { p_key: string }; Returns: boolean }
      cms_resolution_policy_complete: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      cms_resolve_activation_review: {
        Args: { p_candidate_id: string; p_decision_ids: string[] }
        Returns: string
      }
      cms_resolve_conflict: { Args: { p_request: Json }; Returns: Json }
      cms_resolve_review_policy: {
        Args: { p_version_id: string }
        Returns: Json
      }
      cms_resolve_template_compatibility: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_review_assignment_effective: {
        Args: { p_ends_at: string; p_starts_at: string; p_state: string }
        Returns: boolean
      }
      cms_review_authority_lapsed: {
        Args: { p_review_id: string }
        Returns: boolean
      }
      cms_review_binding: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_recent: boolean
          p_request: Json
        }
        Returns: {
          binding_id: string
          mfa_verified_at: string
        }[]
      }
      cms_review_context_hash: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_binding_id: string
          p_person_id: string
        }
        Returns: string
      }
      cms_review_is_owner: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: boolean
      }
      cms_review_owner_authority_end: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: string
      }
      cms_review_person_eligible: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      cms_review_qualifying_approvers: {
        Args: { p_review_id: string }
        Returns: string[]
      }
      cms_review_scope: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_review_id: string
        }
        Returns: string
      }
      cms_review_unsatisfied_slots: {
        Args: { p_extra_person: string; p_review_id: string }
        Returns: number
      }
      cms_revision_author_class: {
        Args: { p_author_person_id: string; p_entry_id: string }
        Returns: string
      }
      cms_revision_content_hash: {
        Args: {
          p_locale: string
          p_payload_hash: string
          p_revision_id: string
          p_schema_version_id: string
        }
        Returns: string
      }
      cms_revision_field_hash: { Args: { p_value: Json }; Returns: string }
      cms_revision_field_payload: {
        Args: {
          p_locale: string
          p_revision_id: string
          p_schema_version_id: string
        }
        Returns: Json
      }
      cms_revision_page_disposition: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_revision: Database["platform_private"]["Tables"]["cms_entry_revisions"]["Row"]
        }
        Returns: string
      }
      cms_revision_reader_capabilities: { Args: never; Returns: string[] }
      cms_revoke_capability_grant: { Args: { p_request: Json }; Returns: Json }
      cms_rollback_schema_migration: {
        Args: { p_request: Json }
        Returns: Json
      }
      cms_rpc_context_valid: { Args: never; Returns: boolean }
      cms_schema_dry_run_resource: {
        Args: { p_report_id: string }
        Returns: Json
      }
      cms_schema_ref_registry_valid: {
        Args: { p_ref: string }
        Returns: boolean
      }
      cms_schema_review_approval_digest: {
        Args: { p_review_id: string }
        Returns: string
      }
      cms_schema_review_assignment_resource: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      cms_schema_review_decision_resource: {
        Args: { p_decision_id: string }
        Returns: Json
      }
      cms_schema_review_resource: {
        Args: {
          p_designer: boolean
          p_owner: boolean
          p_review_id: string
          p_viewer_person_id: string
        }
        Returns: Json
      }
      cms_schema_source_row_count: {
        Args: { p_from_version_id: string; p_to_version_id: string }
        Returns: number
      }
      cms_session_scope_ok: {
        Args: { p_owner_id: string; p_review_id?: string }
        Returns: boolean
      }
      cms_session_scope_ok_report: {
        Args: { p_report_id: string }
        Returns: boolean
      }
      cms_session_scope_ok_system: { Args: never; Returns: boolean }
      cms_session_system_scope: { Args: never; Returns: boolean }
      cms_session_uuid: { Args: { p_name: string }; Returns: string }
      cms_stale_locale_dependents: {
        Args: { p_backfill: boolean; p_source_revision_id: string }
        Returns: number
      }
      cms_start_schema_dry_run: { Args: { p_request: Json }; Returns: Json }
      cms_submit_schema_review: { Args: { p_request: Json }; Returns: Json }
      cms_sweep_expired_review_authority: {
        Args: { p_batch: number }
        Returns: Json
      }
      cms_template_binding_compatible: {
        Args: {
          p_content_type_id: string
          p_owner_id: string
          p_template_version_id: string
        }
        Returns: boolean
      }
      cms_template_block_digest: {
        Args: { p_owner_id: string; p_slots: Json; p_type_ids: Json }
        Returns: string
      }
      cms_template_context: { Args: { p_request: Json }; Returns: Json }
      cms_template_designer_authorized: {
        Args: { p_acting_party_id: string; p_actor_id: string }
        Returns: boolean
      }
      cms_template_latest: { Args: { p_request: Json }; Returns: Json }
      cms_template_manifest_valid: {
        Args: { p_definition: Json }
        Returns: boolean
      }
      cms_template_registry_valid: { Args: { p_id: string }; Returns: boolean }
      cms_transform_registry_digest: {
        Args: {
          p_accepted_field_kinds: Json
          p_behavior: string
          p_key: string
          p_source_constraints: Json
          p_target_constraints: Json
          p_version: number
        }
        Returns: string
      }
      cms_transform_registry_member: {
        Args: { p_key: string; p_version: number }
        Returns: Json
      }
      cms_transform_registry_member_valid: {
        Args: { p_key: string; p_version: number }
        Returns: boolean
      }
      cms_type_version_resource: {
        Args: { p_version_id: string }
        Returns: Json
      }
      cms_valid_base64: { Args: { p_value: string }; Returns: boolean }
      cms_valid_block_request: { Args: { p_request: Json }; Returns: boolean }
      cms_valid_field_input: {
        Args: { p_require_stable_id?: boolean; p_value: Json }
        Returns: boolean
      }
      cms_valid_hash: { Args: { p_value: string }; Returns: boolean }
      cms_valid_relation_input: { Args: { p_value: Json }; Returns: boolean }
      cms_valid_uuid: { Args: { p_value: string }; Returns: boolean }
      cms_valid_version: { Args: { p_value: string }; Returns: boolean }
      cms_validator_registry_valid: {
        Args: { p_key: string; p_version: number }
        Returns: boolean
      }
      cms_verify_props_attestation: {
        Args: { p_actor_id: string; p_request: Json }
        Returns: Json
      }
      cms_verify_schema_migration: { Args: { p_request: Json }; Returns: Json }
      cms_with_content_hash: { Args: { p_resource: Json }; Returns: Json }
      cms_worker_activate_schema: { Args: { p_request: Json }; Returns: Json }
      cms_worker_counter: {
        Args: { p_code?: string; p_value: string }
        Returns: number
      }
      cms_worker_hash: { Args: { p_value: string }; Returns: undefined }
      cms_worker_human_approval_valid: {
        Args: { p_candidate_id: string }
        Returns: boolean
      }
      cms_worker_lease_valid: {
        Args: {
          p_lease_token: string
          p_now?: string
          p_plan: Database["platform_private"]["Tables"]["cms_schema_migration_plans"]["Row"]
          p_worker_id?: string
        }
        Returns: boolean
      }
      cms_worker_plan_json: { Args: { p_plan_id: string }; Returns: Json }
      cms_worker_positive: {
        Args: { p_code?: string; p_value: string }
        Returns: number
      }
      cms_worker_require_request: {
        Args: { p_allowed: string[]; p_request: Json; p_required: string[] }
        Returns: undefined
      }
      cms_worker_require_scan_request: {
        Args: { p_keys: string[]; p_request: Json }
        Returns: undefined
      }
      cms_worker_set_report: {
        Args: {
          p_expires_at: string
          p_failed_count?: number
          p_lease_state: string
          p_migrated_count?: number
          p_owner: string
          p_report: Json
          p_row_error_count?: number
          p_source_count?: number
          p_target_count?: number
          p_token: string
        }
        Returns: Json
      }
      cms_worker_time: { Args: { p_value: string }; Returns: string }
      cms_worker_uuid: {
        Args: { p_code?: string; p_value: string }
        Returns: string
      }
      cms_worker_validate_fingerprint: {
        Args: {
          p_plan: Database["platform_private"]["Tables"]["cms_schema_migration_plans"]["Row"]
          p_request: Json
        }
        Returns: undefined
      }
      cms_workflow_policy_hash: {
        Args: {
          p_key: string
          p_required_capabilities: Json
          p_required_decision_count: number
          p_risk_class: string
          p_version: number
        }
        Returns: string
      }
      cms_workflow_policy_member: {
        Args: { p_key: string; p_version: number }
        Returns: Json
      }
      cms_workflow_registry_valid: {
        Args: { p_key: string; p_version: number }
        Returns: boolean
      }
      complete_outbox_event: {
        Args: { p_event_id: string; p_lease_token: string }
        Returns: boolean
      }
      complete_restore_fence: {
        Args: { p_restore_epoch: number }
        Returns: boolean
      }
      complete_upload_intent: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id?: string
          p_expected_version: number
          p_idempotency_key_hash: string
          p_job_id?: string
          p_observed_byte_size: number
          p_observed_checksum: string
          p_observed_media_type: string
          p_request_hash: string
          p_storage_adapter: string
          p_upload_intent_id: string
        }
        Returns: {
          event_id: string
          job_id: string
          object_id: string
          object_version: number
          replayed: boolean
        }[]
      }
      complete_upload_intent_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_id: string
          p_expected_object_version: number
          p_idempotency_key_hash: string
          p_job_id: string
          p_observed_byte_size: number
          p_observed_checksum: string
          p_observed_media_type: string
          p_request_hash: string
          p_storage_adapter: string
          p_target_id: string
          p_target_type: string
          p_target_version: number
          p_upload_intent_id: string
        }
        Returns: {
          event_id: string
          job_id: string
          object_id: string
          object_version: number
          replayed: boolean
          target_id: string
          target_type: string
          target_version: number
        }[]
      }
      consume_job_read_rate_limit: {
        Args: {
          p_acting_party_id: string
          p_now_at?: string
          p_party_limit?: number
          p_user_id: string
          p_user_limit?: number
        }
        Returns: {
          allowed: boolean
          limit_value: number
          remaining: number
          reset_at: string
          scope: string
        }[]
      }
      create_provider_operation: {
        Args: {
          p_acting_party_id?: string
          p_actor_id: string
          p_causation_id?: string
          p_correlation_id: string
          p_intent_hash: string
          p_operation_id?: string
          p_operation_type: string
          p_provider: string
          p_provider_idempotency_key_hash: string
        }
        Returns: {
          operation_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_provider_operation_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_causation_id: string
          p_correlation_id: string
          p_governed_payload: Json
          p_intent_hash: string
          p_operation_id: string
          p_operation_type: string
          p_provider: string
          p_provider_idempotency_key_hash: string
        }
        Returns: {
          operation_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_upload_intent: {
        Args: {
          p_actor_id: string
          p_allowed_media_types: string[]
          p_bucket: string
          p_byte_size: number
          p_checksum: string
          p_correlation_id?: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_intent_id?: string
          p_max_bytes: number
          p_media_type: string
          p_object_id?: string
          p_object_key: string
          p_owner_party_id: string
          p_purpose: string
          p_request_hash: string
          p_retention_class: string
        }
        Returns: {
          expires_at: string
          intent_id: string
          object_id: string
          replayed: boolean
          version: number
        }[]
      }
      create_upload_intent_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_allowed_media_types: string[]
          p_bucket: string
          p_byte_size: number
          p_checksum: string
          p_correlation_id: string
          p_expires_at: string
          p_idempotency_key_hash: string
          p_intent_id: string
          p_max_bytes: number
          p_media_type: string
          p_object_id: string
          p_object_key: string
          p_purpose: string
          p_request_hash: string
          p_retention_class: string
          p_target_id: string
          p_target_type: string
          p_target_version: number
        }
        Returns: {
          expires_at: string
          intent_id: string
          object_id: string
          replayed: boolean
          target_id: string
          target_type: string
          target_version: number
          version: number
        }[]
      }
      dead_letter_unknown_outbox_event: {
        Args: { p_event_id: string; p_lease_token: string }
        Returns: boolean
      }
      external_effects_allowed: { Args: never; Returns: boolean }
      heartbeat_job_lease: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_lease_seconds: number
          p_lease_token: string
        }
        Returns: boolean
      }
      identity_actor_person: {
        Args: { p_auth_user_id: string }
        Returns: string
      }
      identity_auth_user: { Args: never; Returns: string }
      identity_context_candidate: {
        Args: {
          p_lock_sources?: boolean
          p_party_id: string
          p_person_id: string
        }
        Returns: {
          acting_party_id: string
          context_kind: string
          display_label: string
          projection_version: number
          sort_rank: number
          source_relationship_id: string
        }[]
      }
      identity_current_owner: { Args: { p_alias_id: string }; Returns: string }
      identity_hash_setting: { Args: { p_name: string }; Returns: string }
      identity_idempotency_reserve: {
        Args: {
          p_actor_id: string
          p_key_hash: string
          p_operation: string
          p_request_hash: string
        }
        Returns: {
          actor_id: string
          claim_lease_until: string | null
          claim_token_hash: string | null
          created_at: string
          expires_at: string
          id: string
          key_hash: string
          operation: string
          request_hash: string
          response_ref: Json | null
          state: Database["platform_private"]["Enums"]["idempotency_state"]
        }
        SetofOptions: {
          from: "*"
          to: "idempotency_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      identity_normalized_handle: {
        Args: { p_handle: string }
        Returns: string
      }
      identity_record_effects: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_aggregate_id: string
          p_aggregate_type: string
          p_aggregate_version: number
          p_correlation_id: string
          p_event_type: string
          p_payload: Json
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      identity_session_scope_ok: {
        Args: { p_auth_user_id: string }
        Returns: boolean
      }
      identity_uuid_setting: { Args: { p_name: string }; Returns: string }
      identity_validate_display_name: {
        Args: { p_display_name: string }
        Returns: undefined
      }
      initialize_cms_owner: {
        Args: {
          p_auth_user_id: string
          p_authorization_ref: string
          p_expected_email: string
          p_grant_ends_at: string
          p_person_id: string
          p_preview: boolean
        }
        Returns: Json
      }
      mfa_audit: {
        Args: {
          p_acting_party_id: string
          p_action: string
          p_actor_id: string
          p_correlation_id: string
          p_reason_code: string
          p_target_id: string
          p_target_type: string
        }
        Returns: undefined
      }
      mfa_bump: { Args: { p_binding_id: string }; Returns: number }
      mfa_factor_changed_event: {
        Args: {
          p_binding_id: string
          p_correlation_id: string
          p_factor_id: string
          p_factor_version: number
        }
        Returns: undefined
      }
      mfa_lock_binding: {
        Args: { p_auth_user_id: string; p_lock?: boolean }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "auth_user_bindings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mfa_notification_request: {
        Args: {
          p_binding_id: string
          p_correlation_id: string
          p_security_event_id: string
        }
        Returns: undefined
      }
      mfa_parse_version: { Args: { p_version: string }; Returns: number }
      mfa_projection: { Args: { p_auth_user_id: string }; Returns: Json }
      mfa_require_name: { Args: { p_name: string }; Returns: undefined }
      mfa_require_not_last_factor: {
        Args: { p_person_id: string }
        Returns: undefined
      }
      mfa_require_session: {
        Args: { p_auth_user_id: string; p_session_id: string }
        Returns: undefined
      }
      mfa_require_version: {
        Args: { p_expected: string; p_mfa_version: number }
        Returns: undefined
      }
      mfa_rotate_session: {
        Args: {
          p_auth_user_id: string
          p_binding_id: string
          p_correlation_id: string
          p_issued_at: string
          p_new_session_id: string
          p_request_id: string
          p_session_id: string
        }
        Returns: undefined
      }
      mfa_security_event: {
        Args: {
          p_action: string
          p_auth_user_id: string
          p_correlation_id: string
          p_outcome: string
          p_reason_code: string
          p_request_id: string
          p_session_id: string
        }
        Returns: string
      }
      mfa_step_up_capability_held: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      mfa_verification_charge_failure: {
        Args: { p_auth_user_id: string }
        Returns: Json
      }
      mfa_verification_require_unlocked: {
        Args: { p_auth_user_id: string }
        Returns: undefined
      }
      normalize_identity_handle: { Args: { p_handle: string }; Returns: string }
      protected_writes_allowed: { Args: never; Returns: boolean }
      read_authorized_job: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_capability?: string
          p_job_id: string
          p_reason?: string
          p_step_up_verified?: boolean
        }
        Returns: {
          acting_party_id: string
          actor_id: string
          created_at: string
          error_code: string
          job_id: string
          job_type: string
          lease_until: string
          progress: Json
          result_ref: Json
          state: Database["platform_private"]["Enums"]["job_state"]
          updated_at: string
          version: number
        }[]
      }
      read_canonical_job: {
        Args: { p_job_id: string }
        Returns: {
          id: string
          lease_until: string
          state: Database["platform_private"]["Enums"]["job_state"]
          type: string
          version: number
        }[]
      }
      read_consumable_object: {
        Args: { p_object_id: string }
        Returns: {
          bucket: string
          byte_size: number
          checksum: string
          id: string
          media_type: string
          object_key: string
          version: number
        }[]
      }
      read_provider_operation_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_operation_id: string
        }
        Returns: {
          acting_party_id: string
          actor_id: string
          attempts: Json
          causation_id: string
          correlation_id: string
          governed_payload: Json
          intent_hash: string
          last_attempt_at: string
          operation_id: string
          operation_type: string
          provider: string
          provider_idempotency_key_hash: string
          provider_ref: string
          reconciliation_at: string
          state: Database["platform_private"]["Enums"]["provider_operation_state"]
          version: number
        }[]
      }
      read_recovery_provenance: {
        Args: never
        Returns: {
          artifact_digest: string
          artifact_id: string
          environment: string
          evidence_id: string
          promoted_at: string
          promotion_expires_at: string
          promotion_id: string
          provenance_kind: string
          provenance_valid: boolean
          source_revision: string
        }[]
      }
      read_recovery_verification: {
        Args: never
        Returns: {
          consumer_restore_epoch: number
          current_restore_epoch: number
          evidence_id: string
          evidence_present: boolean
          expires_at: string
          idempotency_outbox_job_verified: boolean
          integrity_verified: boolean
          measured_rpo_seconds: number
          measured_rto_seconds: number
          object_verified: boolean
          pitr_available: boolean
          pitr_status: string
          pitr_supported: boolean
          pitr_window_seconds: number
          protected_writes_allowed: boolean
          provider_webhook_verified: boolean
          public_projection_verified: boolean
          reason_code: string
          restore_epoch: number
          rls_verified: boolean
          rpc_verified: boolean
          verified_at: string
        }[]
      }
      read_restore_fence: {
        Args: never
        Returns: {
          consumer_epoch: number
          expected_epoch: number
          integrity_verified: boolean
          reconciliation_complete: boolean
        }[]
      }
      record_attempt_outcome: {
        Args: {
          attempts: Json
          ended_at: string
          error_code: string
          outcome: string
          retryable: boolean
        }
        Returns: Json
      }
      record_processed_event: {
        Args: {
          p_aggregate_id: string
          p_event_id: string
          p_event_type: string
          p_pending_manual_review: boolean
          p_schema_version: number
        }
        Returns: string
      }
      record_promoted_recovery_verification: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_artifact_digest: string
          p_artifact_id: string
          p_correlation_id?: string
          p_environment: string
          p_evidence_id?: string
          p_expires_at?: string
          p_idempotency_outbox_job_verified: boolean
          p_integrity_verified: boolean
          p_measured_rpo_seconds: number
          p_measured_rto_seconds: number
          p_object_verified: boolean
          p_pitr_supported: boolean
          p_pitr_window_seconds: number
          p_promotion_id: string
          p_provider_webhook_verified: boolean
          p_public_projection_verified: boolean
          p_restore_epoch: number
          p_rls_verified: boolean
          p_rpc_verified: boolean
          p_source_revision: string
          p_verified_at?: string
        }
        Returns: {
          evidence_id: string
          protected_writes_allowed: boolean
        }[]
      }
      record_recovery_verification: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_correlation_id?: string
          p_evidence_id?: string
          p_expires_at?: string
          p_idempotency_outbox_job_verified: boolean
          p_integrity_verified: boolean
          p_measured_rpo_seconds: number
          p_measured_rto_seconds: number
          p_object_verified: boolean
          p_pitr_supported: boolean
          p_pitr_window_seconds: number
          p_provider_webhook_verified: boolean
          p_public_projection_verified: boolean
          p_restore_epoch: number
          p_rls_verified: boolean
          p_rpc_verified: boolean
          p_verified_at?: string
        }
        Returns: {
          evidence_id: string
          protected_writes_allowed: boolean
        }[]
      }
      record_webhook_receipt: {
        Args: {
          p_acting_party_id?: string
          p_actor_id?: string
          p_correlation_id?: string
          p_external_event_id: string
          p_operation_id?: string
          p_payload_digest: string
          p_provider: string
          p_receipt_id?: string
          p_signature_verified_at: string
        }
        Returns: {
          accepted: boolean
          conflict: boolean
          duplicate: boolean
          operation_id: string
          receipt_id: string
          state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }[]
      }
      record_webhook_receipt_authorized: {
        Args: {
          p_acting_party_id: string
          p_actor_id: string
          p_correlation_id: string
          p_event_type: string
          p_external_event_id: string
          p_normalized_event: Json
          p_operation_id: string
          p_payload_digest: string
          p_provider: string
          p_receipt_id: string
          p_schema_version: number
          p_signature_verified_at: string
        }
        Returns: {
          accepted: boolean
          conflict: boolean
          duplicate: boolean
          event_type: string
          operation_id: string
          receipt_id: string
          schema_version: number
          state: Database["platform_private"]["Enums"]["webhook_receipt_state"]
        }[]
      }
      step_up_capability_designated: {
        Args: { p_key: string }
        Returns: boolean
      }
      step_up_usable_challenge: {
        Args: {
          p_auth_user_id: string
          p_challenge_id: string
          p_lock?: boolean
          p_session_id: string
        }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "step_up_challenges"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      valid_attempts: { Args: { value: Json }; Returns: boolean }
      valid_base_event_payload: {
        Args: { event_type: string; payload: Json; schema_version: number }
        Returns: boolean
      }
      valid_governed_provider_payload: {
        Args: { value: Json }
        Returns: boolean
      }
      valid_governed_provider_payload_node: {
        Args: { depth: number; value: Json }
        Returns: boolean
      }
      valid_job_progress: { Args: { value: Json }; Returns: boolean }
      valid_media_type_list: { Args: { value: string[] }; Returns: boolean }
      valid_object_key: { Args: { value: string }; Returns: boolean }
      valid_response_ref: { Args: { value: Json }; Returns: boolean }
    }
    Enums: {
      alias_lifecycle: "active" | "transfer_pending" | "transferred" | "retired"
      audit_decision: "allowed" | "denied" | "completed" | "failed"
      cms_definition_state:
        | "draft"
        | "review"
        | "approved"
        | "scheduled"
        | "active"
        | "superseded"
        | "retired"
        | "blocked"
      context_binding_state: "active" | "revoked" | "expired"
      facet_source: "self_asserted" | "curation_approved"
      facet_state: "active" | "removed"
      handle_state: "active" | "redirect" | "retired"
      idempotency_state: "reserved" | "completed" | "failed_retryable"
      job_state: "queued" | "running" | "succeeded" | "failed" | "cancelled"
      legal_identity_state: "active" | "superseded" | "withdrawn"
      object_state:
        | "pending_upload"
        | "uploaded"
        | "verifying"
        | "ready"
        | "rejected"
        | "quarantined"
      person_account_state:
        | "shadow"
        | "claimed"
        | "active"
        | "suspended"
        | "memorialised"
        | "erasure_processing"
      provider_operation_state:
        | "planned"
        | "pending"
        | "confirmed"
        | "failed"
        | "manual_review"
      public_link_state: "private" | "public"
      restore_fence_state: "reconciling" | "released"
      transfer_offer_state:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      upload_intent_state: "issued" | "consumed" | "expired" | "cancelled"
      webhook_receipt_state:
        | "received"
        | "accepted"
        | "duplicate"
        | "rejected"
        | "processed"
        | "failed"
        | "manual_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public_api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  audit_private: {
    Enums: {},
  },
  platform_api: {
    Enums: {},
  },
  platform_private: {
    Enums: {
      alias_lifecycle: ["active", "transfer_pending", "transferred", "retired"],
      audit_decision: ["allowed", "denied", "completed", "failed"],
      cms_definition_state: [
        "draft",
        "review",
        "approved",
        "scheduled",
        "active",
        "superseded",
        "retired",
        "blocked",
      ],
      context_binding_state: ["active", "revoked", "expired"],
      facet_source: ["self_asserted", "curation_approved"],
      facet_state: ["active", "removed"],
      handle_state: ["active", "redirect", "retired"],
      idempotency_state: ["reserved", "completed", "failed_retryable"],
      job_state: ["queued", "running", "succeeded", "failed", "cancelled"],
      legal_identity_state: ["active", "superseded", "withdrawn"],
      object_state: [
        "pending_upload",
        "uploaded",
        "verifying",
        "ready",
        "rejected",
        "quarantined",
      ],
      person_account_state: [
        "shadow",
        "claimed",
        "active",
        "suspended",
        "memorialised",
        "erasure_processing",
      ],
      provider_operation_state: [
        "planned",
        "pending",
        "confirmed",
        "failed",
        "manual_review",
      ],
      public_link_state: ["private", "public"],
      restore_fence_state: ["reconciling", "released"],
      transfer_offer_state: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      upload_intent_state: ["issued", "consumed", "expired", "cancelled"],
      webhook_receipt_state: [
        "received",
        "accepted",
        "duplicate",
        "rejected",
        "processed",
        "failed",
        "manual_review",
      ],
    },
  },
  public: {
    Enums: {},
  },
  public_api: {
    Enums: {},
  },
} as const
