-- Close default PostgreSQL function EXECUTE grants on private taxonomy guards.
-- Forward-only correction to the already-applied taxonomy foundation migration.
begin;

revoke all on function platform_private.cms_taxonomy_versions_lifecycle_guard()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_terms_lifecycle_guard()
  from public, anon, authenticated, service_role;

commit;
