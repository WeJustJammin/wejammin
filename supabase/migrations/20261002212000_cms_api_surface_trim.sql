-- Slice 09 P240 (AC180, security-first): the SQL API must expose only the
-- cms_ RPCs a caller really uses.  Two platform_api functions are named by the
-- specification but are called by no Worker, workflow or browser path:
--
--   platform_api.cms_resolve_template_compatibility(jsonb)
--     the DB-internal activation preflight calls the platform_private resolver
--     (platform_private.cms_resolve_template_compatibility) directly;
--   platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)
--     the pure validator is run only by the SECURITY DEFINER draft and
--     successor RPCs.
--
-- Both keep their schema-qualified name and body (the definer RPCs that use
-- them still can: they run as the function owner), but no API role (anon,
-- authenticated, service_role, PUBLIC) can execute them any more.  Every other
-- cms_ function stays: the exact allowed set is enumerated and guarded by
-- supabase/tests/phase_02_slice_09_r8_api_surface.sql.  Forward-only.
begin;

revoke all on function platform_api.cms_resolve_template_compatibility(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
