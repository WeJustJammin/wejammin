-- Forward-only correction: the new trigger helper in 20260927200000 must
-- have the same no-direct-execute boundary as every other private CMS helper.
begin;

revoke all on function platform_private.cms_template_versions_guard()
  from public, anon, authenticated, service_role;

commit;
