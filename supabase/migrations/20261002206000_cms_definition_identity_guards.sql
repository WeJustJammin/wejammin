-- Slice 09 (re-audit AC001/AC016/AC186): three storage-level guards for the
-- schema definition aggregates, each one a refusal that no producer ever needs.
--
--  * Definitions are removed only by deprecation or retirement (BE03a "Retention"),
--    never by DELETE: a content type, a content-type version, a field definition,
--    a relation definition, a template binding or a capability binding row cannot
--    be deleted, in any state, inside or outside a named RPC.  No command deletes
--    one (writer sets are pinned by the pgTAP suites), and an active version is
--    additionally protected by its foreign-keyed children only when it has any.
--  * Versioning is monotonic: the CAS `version` of a type, a version, a field, a
--    relation, a migration plan or a dry-run report never decreases.
--  * A blocked definition returns to draft only through an audited transition: a
--    state change away from `blocked` requires the transaction setting
--    app.cms_audited_transition, which no caller-reachable command sets.  No
--    producer creates a blocked definition today, so the guard closes the one
--    unaudited way out.
-- Forward-only.
begin;

create or replace function platform_private.cms_definition_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  return old;
end;
$body$;

create or replace function platform_private.cms_version_monotonic_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if new.version < old.version then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create or replace function platform_private.cms_definition_blocked_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if old.state = 'blocked'::platform_private.cms_definition_state
     and new.state is distinct from old.state
     and pg_catalog.current_setting('app.cms_audited_transition', true) is distinct from 'true' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

revoke all on function platform_private.cms_definition_delete_guard() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_version_monotonic_guard() from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_definition_blocked_guard() from public, anon, authenticated, service_role;

create trigger cms_content_types_no_delete
before delete on platform_private.cms_content_types
for each row execute function platform_private.cms_definition_delete_guard();
create trigger cms_content_type_versions_no_delete
before delete on platform_private.cms_content_type_versions
for each row execute function platform_private.cms_definition_delete_guard();
create trigger cms_field_definition_versions_no_delete
before delete on platform_private.cms_field_definition_versions
for each row execute function platform_private.cms_definition_delete_guard();
create trigger cms_relation_definitions_no_delete
before delete on platform_private.cms_relation_definitions
for each row execute function platform_private.cms_definition_delete_guard();
create trigger cms_content_type_template_bindings_no_delete
before delete on platform_private.cms_content_type_template_bindings
for each row execute function platform_private.cms_definition_delete_guard();
create trigger cms_content_type_capability_bindings_no_delete
before delete on platform_private.cms_content_type_capability_bindings
for each row execute function platform_private.cms_definition_delete_guard();

create trigger cms_content_types_version_monotonic
before update on platform_private.cms_content_types
for each row execute function platform_private.cms_version_monotonic_guard();
create trigger cms_content_type_versions_version_monotonic
before update on platform_private.cms_content_type_versions
for each row execute function platform_private.cms_version_monotonic_guard();
create trigger cms_field_definition_versions_version_monotonic
before update on platform_private.cms_field_definition_versions
for each row execute function platform_private.cms_version_monotonic_guard();
create trigger cms_relation_definitions_version_monotonic
before update on platform_private.cms_relation_definitions
for each row execute function platform_private.cms_version_monotonic_guard();

create trigger cms_schema_migration_plans_version_monotonic
before update on platform_private.cms_schema_migration_plans
for each row execute function platform_private.cms_version_monotonic_guard();
create trigger cms_schema_dry_run_reports_version_monotonic
before update on platform_private.cms_schema_dry_run_reports
for each row execute function platform_private.cms_version_monotonic_guard();

create trigger cms_content_type_versions_blocked_guard
before update on platform_private.cms_content_type_versions
for each row execute function platform_private.cms_definition_blocked_guard();

commit;
