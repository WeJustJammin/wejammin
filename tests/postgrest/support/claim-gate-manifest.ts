/**
 * SEC-1 manifest: the security-sensitive `platform_api` functions that read the
 * caller's identity from the JWT claims PostgREST delivers (directly, or through
 * a private function they call), with the gate each one is expected to enforce.
 *
 * The list is checked in on purpose. The previous oracle derived its targets from
 * the function bodies, so a function that lost its claims gate fell out of the
 * test set and the suite stayed green. Now the catalog is only compared AGAINST
 * this list (exact equality, both directions), and every entry is exercised
 * through the real Kong -> PostgREST path whatever its current body says.
 *
 * The gate is the caller class the function must serve, and it must agree with
 * the catalog's EXECUTE grants:
 *   - 'authenticated-subject': authenticated only. The token subject must be a
 *     real auth user and the function acts for that subject, never for a
 *     subject named in the request.
 *   - 'subject-or-service': authenticated callers as above; service_role may
 *     also call it with an actor context.
 *   - 'public-subject': anon and authenticated; a ghost subject is refused.
 *   - 'service-role': service_role only (the Worker); an actor named in the
 *     context must be a real auth user, and a release-worker function needs a
 *     registered release principal.
 *   - 'ungranted': executable by no API role; it is reachable only from other
 *     database functions, so it must stay closed to all three.
 * Adding a `platform_api` function that reads claims, removing one, or changing
 * who may execute one is a deliberate edit of this file.
 */
export type ClaimGate =
  | 'authenticated-subject'
  | 'subject-or-service'
  | 'public-subject'
  | 'service-role'
  | 'ungranted';

export const CLAIM_GATED_API_FUNCTIONS: Readonly<Record<string, ClaimGate>> = {
  admin_audit_diagnostic: 'service-role',
  admin_capability_action: 'service-role',
  admin_context_capabilities: 'service-role',
  admin_inbox: 'service-role',
  admin_mfa_factor_reset: 'service-role',
  admin_mfa_factor_reset_settle: 'service-role',
  cfg_change_action: 'service-role',
  cfg_propose_change: 'service-role',
  cfg_resolve_effective_value: 'service-role',
  cms_acknowledge_schema_migration_event: 'service-role',
  cms_activate_schema: 'service-role',
  cms_activate_schema_migration: 'service-role',
  cms_add_field_definition: 'subject-or-service',
  cms_advance_block_lifecycle: 'service-role',
  cms_assign_schema_review: 'service-role',
  cms_author_locale_variant: 'service-role',
  cms_begin_schema_migration_verification: 'service-role',
  cms_bind_relation: 'subject-or-service',
  cms_claim_schema_migration_event: 'service-role',
  cms_claim_schema_migration_lease: 'service-role',
  cms_complete_schema_migration: 'service-role',
  cms_create_entry: 'service-role',
  cms_create_revision: 'service-role',
  cms_create_schema_successor: 'service-role',
  cms_create_type_draft: 'subject-or-service',
  cms_dead_letter_schema_migration_event: 'service-role',
  cms_decide_schema_review: 'service-role',
  cms_define_template: 'service-role',
  cms_finalize_schema_migration_dry_run: 'service-role',
  cms_get_content_type_version: 'subject-or-service',
  cms_get_entry_draft: 'service-role',
  cms_get_schema_migration_plan: 'service-role',
  cms_get_schema_review: 'service-role',
  cms_grant_capability: 'service-role',
  cms_heartbeat_schema_migration_lease: 'service-role',
  cms_list_capability_grants: 'service-role',
  cms_list_content_types: 'subject-or-service',
  cms_list_revisions: 'service-role',
  cms_process_schema_migration_batch: 'service-role',
  cms_process_schema_migration_dry_run_batch: 'service-role',
  cms_read_schema_migration_source_rows: 'service-role',
  cms_reconcile_schema_activation: 'service-role',
  cms_register_block: 'service-role',
  cms_release_schema_migration_event: 'service-role',
  cms_renew_capability_grant: 'service-role',
  cms_resolve_conflict: 'service-role',
  cms_resolve_template_compatibility: 'ungranted',
  cms_revoke_capability_grant: 'service-role',
  cms_rollback_schema_migration: 'service-role',
  cms_start_schema_dry_run: 'service-role',
  cms_submit_schema_review: 'service-role',
  cms_template_context: 'service-role',
  cms_template_latest: 'service-role',
  cms_verify_schema_migration: 'service-role',
  identity_alias_create: 'authenticated-subject',
  identity_alias_patch: 'authenticated-subject',
  identity_alias_retire: 'authenticated-subject',
  identity_context_bind: 'authenticated-subject',
  identity_contexts_read: 'authenticated-subject',
  identity_create: 'authenticated-subject',
  identity_facet_add: 'authenticated-subject',
  identity_facet_remove: 'authenticated-subject',
  identity_handle_change: 'authenticated-subject',
  identity_memberships_read: 'authenticated-subject',
  identity_organization_read: 'public-subject',
  identity_person_read: 'authenticated-subject',
  identity_transfer_accept: 'authenticated-subject',
  identity_transfer_decline: 'authenticated-subject',
  identity_transfer_offer_create: 'authenticated-subject',
  rpc_accept_or_end_membership: 'authenticated-subject',
  rpc_add_capacity_period: 'authenticated-subject',
  rpc_assert_membership: 'authenticated-subject',
  rpc_cfg_change_action: 'service-role',
  rpc_cfg_propose_change: 'service-role',
  rpc_cfg_resolve_effective_value: 'service-role',
  rpc_change_organization_type: 'authenticated-subject',
  rpc_convert_claim: 'service-role',
  rpc_create_organization: 'authenticated-subject',
  rpc_dispatch_invitation: 'service-role',
  rpc_invite_membership: 'authenticated-subject',
  rpc_issue_claim_challenge: 'service-role',
  rpc_match_shadow: 'service-role',
  rpc_profile_emphasis: 'subject-or-service',
  rpc_profile_reel_create: 'subject-or-service',
  rpc_profile_reel_patch: 'subject-or-service',
  rpc_profile_reel_takedown: 'subject-or-service',
  rpc_profile_section: 'subject-or-service',
  rpc_read_claim: 'service-role',
  rpc_start_claim: 'service-role',
  rpc_submit_claim_proof: 'service-role',
};

/**
 * The helper that resolves the caller for each manifest entry. It decides what
 * the behaviour checks send and what the mutation suite removes:
 *   - 'cfg-actor': `cfg_actor` (via `cms_actor` / `cfg_request_actor`): the
 *     token subject must equal the context actor, a service-role context actor
 *     must be a real auth user.
 *   - 'identity-auth-user': `identity_auth_user`: the token subject only.
 *   - 'release-worker': `cms_require_release_worker`: the `role` claim must be
 *     service_role; there is no actor, so the claim is the whole gate.
 *   - 'release-principal': `cms_release_route_gate` + `cms_release_actor`: a
 *     service-role caller bound to a registered release key.
 *   - 'profile-claims': `profile_prepare_request` + `profile_actor`: a
 *     service-role caller names the actor in `context`; an empty context falls
 *     back to the (absent) token subject and is refused.
 *   - 'profile-subject': `profile_actor` reading the token subject; no
 *     `context` member is accepted.
 *   - 'public-read': an anonymous caller is served; a token subject must be real.
 */
export type ActorFamily =
  | 'cfg-actor'
  | 'identity-auth-user'
  | 'release-worker'
  | 'release-principal'
  | 'profile-claims'
  | 'profile-subject'
  | 'public-read';

const FAMILY_MEMBERS: Readonly<Record<ActorFamily, readonly string[]>> = {
  'cfg-actor': [
    'admin_audit_diagnostic',
    'admin_capability_action',
    'admin_context_capabilities',
    'admin_inbox',
    'admin_mfa_factor_reset',
    'admin_mfa_factor_reset_settle',
    'cfg_change_action',
    'cfg_propose_change',
    'cfg_resolve_effective_value',
    'rpc_cfg_change_action',
    'rpc_cfg_propose_change',
    'rpc_cfg_resolve_effective_value',
    'cms_activate_schema',
    'cms_add_field_definition',
    'cms_assign_schema_review',
    'cms_author_locale_variant',
    'cms_bind_relation',
    'cms_create_entry',
    'cms_create_revision',
    'cms_create_schema_successor',
    'cms_create_type_draft',
    'cms_decide_schema_review',
    'cms_define_template',
    'cms_get_content_type_version',
    'cms_get_entry_draft',
    'cms_get_schema_review',
    'cms_grant_capability',
    'cms_list_capability_grants',
    'cms_list_content_types',
    'cms_list_revisions',
    'cms_renew_capability_grant',
    'cms_resolve_conflict',
    'cms_resolve_template_compatibility',
    'cms_revoke_capability_grant',
    'cms_start_schema_dry_run',
    'cms_submit_schema_review',
    'cms_template_context',
    'cms_template_latest',
  ],
  'identity-auth-user': [
    'identity_alias_create',
    'identity_alias_patch',
    'identity_alias_retire',
    'identity_context_bind',
    'identity_contexts_read',
    'identity_create',
    'identity_facet_add',
    'identity_facet_remove',
    'identity_handle_change',
    'identity_memberships_read',
    'identity_person_read',
    'identity_transfer_accept',
    'identity_transfer_decline',
    'identity_transfer_offer_create',
    'rpc_accept_or_end_membership',
    'rpc_add_capacity_period',
    'rpc_assert_membership',
    'rpc_change_organization_type',
    'rpc_create_organization',
    'rpc_invite_membership',
  ],
  'release-worker': [
    'cms_acknowledge_schema_migration_event',
    'cms_activate_schema_migration',
    'cms_begin_schema_migration_verification',
    'cms_claim_schema_migration_event',
    'cms_claim_schema_migration_lease',
    'cms_complete_schema_migration',
    'cms_dead_letter_schema_migration_event',
    'cms_finalize_schema_migration_dry_run',
    'cms_get_schema_migration_plan',
    'cms_heartbeat_schema_migration_lease',
    'cms_process_schema_migration_batch',
    'cms_process_schema_migration_dry_run_batch',
    'cms_read_schema_migration_source_rows',
    'cms_reconcile_schema_activation',
    'cms_release_schema_migration_event',
    'cms_rollback_schema_migration',
    'cms_verify_schema_migration',
  ],
  'release-principal': ['cms_advance_block_lifecycle', 'cms_register_block'],
  'profile-claims': [
    'rpc_convert_claim',
    'rpc_dispatch_invitation',
    'rpc_issue_claim_challenge',
    'rpc_match_shadow',
    'rpc_read_claim',
    'rpc_start_claim',
    'rpc_submit_claim_proof',
  ],
  'profile-subject': [
    'rpc_profile_emphasis',
    'rpc_profile_reel_create',
    'rpc_profile_reel_patch',
    'rpc_profile_reel_takedown',
    'rpc_profile_section',
  ],
  'public-read': ['identity_organization_read'],
};

export const CLAIM_ACTOR_FAMILY: Readonly<Record<string, ActorFamily>> =
  Object.fromEntries(
    (
      Object.entries(FAMILY_MEMBERS) as [ActorFamily, readonly string[]][]
    ).flatMap(([family, names]) =>
      names.map((name) => [name, family] as const),
    ),
  );
