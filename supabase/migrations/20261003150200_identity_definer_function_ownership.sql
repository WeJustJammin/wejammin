-- SEC-2 (second sweep): hand ownership of 33 more SECURITY DEFINER functions to
-- non-bypass roles.
--
-- Codex review R14 finding 1: platform_api.admin_mfa_factor_reset and
-- identity.rpc_admin_reset_mfa_factors stayed owned by the BYPASSRLS platform
-- role while writing forced tables, and the first catalog guard scanned only
-- platform_private and platform_api.  The sweep of every schema found 33
-- functions, created or redefined by Slice 09 migrations (20261002*, 20261003*),
-- that name a forced table; this migration moves all 33.  The 154 functions of
-- earlier slices that still name a forced table stay with the platform owner and
-- are pinned by name in supabase/tests/support/sec2-legacy-bypass-definers.sqlinc.
--
-- The privileges, policies and function grants are in 20261003150100.
-- ALTER FUNCTION ... OWNER TO requires CREATE on the function's schema for the
-- new owner, so each role holds it for the length of this transaction only.
-- Forward-only.
begin;

grant create on schema identity, platform_api, platform_private to wejammin_cms_definer;
grant create on schema identity_private, platform_api, platform_private to wejammin_cms_authority_reader;
grant create on schema platform_api, platform_private, profile_private to wejammin_platform_definer;

alter function identity.rpc_admin_reset_mfa_factors(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_api.admin_mfa_factor_reset(jsonb) owner to wejammin_cms_definer;
alter function platform_api.auth_mfa_factors_read(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.admin_mfa_factor_reset_view(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_capability_grant_project(uuid,uuid,text,date,date,boolean) owner to wejammin_cms_definer;
alter function platform_private.cms_grant_subject_lock(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_audit(text,uuid,uuid,text,uuid,text,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_bump(uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_factor_changed_event(uuid,bigint,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_lock_binding(uuid,boolean) owner to wejammin_cms_definer;
alter function platform_private.mfa_notification_request(uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_require_session(uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_rotate_session(uuid,uuid,uuid,timestamp with time zone,uuid,uuid,uuid) owner to wejammin_cms_definer;
alter function platform_private.mfa_security_event(text,uuid,uuid,text,text,uuid,uuid) owner to wejammin_cms_definer;

alter function identity_private.identity_organization_read(uuid) owner to wejammin_cms_authority_reader;
alter function identity_private.require_organization_actor(uuid,uuid,text) owner to wejammin_cms_authority_reader;
alter function platform_api.identity_security_notification_read(uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cfg_require_capability(uuid,uuid,text) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_entry_tenant_visible(uuid,uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_grant_subject_eligible(uuid,uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_person_holds_capability(uuid,uuid,text) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_release_actor(jsonb) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_require_capability(uuid,uuid,text) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_require_read(uuid,uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_require_scope_member(uuid,uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_review_binding(jsonb,uuid,uuid,boolean) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_review_person_eligible(uuid) owner to wejammin_cms_authority_reader;
alter function platform_private.cms_template_designer_authorized(uuid,uuid) owner to wejammin_cms_authority_reader;

alter function platform_api.auth_rate_limit(text,text,integer,integer) owner to wejammin_platform_definer;
alter function platform_api.consumer_dead_letter_event(jsonb) owner to wejammin_platform_definer;
alter function platform_private.cfg_resolve_effective_value(jsonb) owner to wejammin_platform_definer;
alter function platform_private.claim_outbox_batch(uuid,integer,integer) owner to wejammin_platform_definer;
alter function profile_private.rpc_convert_claim(jsonb) owner to wejammin_platform_definer;

revoke create on schema identity, platform_api, platform_private from wejammin_cms_definer;
revoke create on schema identity_private, platform_api, platform_private from wejammin_cms_authority_reader;
revoke create on schema platform_api, platform_private, profile_private from wejammin_platform_definer;

commit;
