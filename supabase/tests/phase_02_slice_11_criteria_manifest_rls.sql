-- Slice 11 criteria: P2-S11-AC-087, "`platform_private.cms_build_dependency_manifest(p_revision_id)` is the only
-- builder of a `DependencyManifest`, reads canonical state under RLS, accepts no caller value ..."  The builder is a
-- SECURITY DEFINER of the CMS definer role (no BYPASSRLS), so the only thing that lets it see a row is the CMS RPC
-- context policy `platform_private.cms_rpc_context_valid()` (`app.cms_rpc = 'true'`) on a forced-RLS table.  Every
-- other manifest suite sets that context first; this one proves what happens WITHOUT it:
--   * the definer role is neither superuser nor BYPASSRLS, and every table the builder reads has forced RLS with a
--     policy built on the CMS RPC context;
--   * outside the context (unset, 'false', 'TRUE') the builder sees no revision and answers NOT_FOUND; the currency
--     predicates see no schema, template or settings rows and answer stale / not current;
--   * the context is evaluated per statement: with it restored the same call returns the manifest again.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc

select pg_temp.h11w_revision('rls');

-- The builder with the CMS RPC context set to p_context (null = unset), then the context is restored.
create or replace function pg_temp.c11_build(p_context text)
returns text
language plpgsql
as $body$
declare
  outcome text;
begin
  perform set_config('app.cms_rpc', coalesce(p_context, ''), true);
  begin
    outcome := 'ok:' || (platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('rls:revision'))
                           ?& array['schema', 'template', 'blocks', 'patterns', 'terms', 'localeSources', 'settings', 'relations', 'checker'])::text;
  exception when others then
    outcome := sqlstate || ':' || sqlerrm;
  end;
  perform set_config('app.cms_rpc', 'true', true);
  return outcome;
end;
$body$;

create or replace function pg_temp.c11_status(p_context text, p_manifest jsonb)
returns text
language plpgsql
as $body$
declare
  outcome text;
begin
  perform set_config('app.cms_rpc', coalesce(p_context, ''), true);
  outcome := platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('rls:revision'), p_manifest)
    || '/' || platform_private.cms_manifest_identities_current(p_manifest)::text;
  perform set_config('app.cms_rpc', 'true', true);
  return outcome;
end;
$body$;

-- The manifest frozen WITH the context (the oracle every comparison below is made against).
create temp table c11_frozen on commit drop as
  select platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('rls:revision')) as manifest;

-- ---------------------------------------------------------------------------
-- Structure: the reads are RLS reads.
-- ---------------------------------------------------------------------------
select is(
  (select pg_get_userbyid(p.proowner) || '/' || (not owner.rolsuper)::text || '/' || (not owner.rolbypassrls)::text
     from pg_proc p join pg_roles owner on owner.oid = p.proowner
    where p.oid = to_regprocedure('platform_private.cms_build_dependency_manifest(uuid)')),
  'wejammin_cms_definer/true/true',
  'the builder is owned by the CMS definer role, which is neither superuser nor BYPASSRLS, so every read it makes is subject to row-level security [P2-S11-AC-087]');
select is(
  (select string_agg(t.name || '=' || coalesce((
            select (c.relrowsecurity and c.relforcerowsecurity
                    and exists (select 1 from pg_policy policy
                                 where policy.polrelid = c.oid
                                   and pg_get_expr(policy.polqual, policy.polrelid) like '%cms_rpc_context_valid%'))::text
              from pg_class c where c.oid = to_regclass('platform_private.' || t.name)), 'absent'), ',' order by t.name)
     from (values ('cms_block_definition_versions'), ('cms_composition_instances'), ('cms_content_entries'),
                  ('cms_content_type_versions'), ('cms_entry_relations'), ('cms_entry_revisions'), ('cms_locale_variants'),
                  ('cms_pattern_versions'), ('cms_preflight_registry'), ('cms_publication_settings_snapshots'),
                  ('cms_schema_artifacts'), ('cms_template_versions'), ('cms_term_assignments'), ('cms_terms')) as t(name)),
  'cms_block_definition_versions=true,cms_composition_instances=true,cms_content_entries=true,cms_content_type_versions=true,'
  || 'cms_entry_relations=true,cms_entry_revisions=true,cms_locale_variants=true,cms_pattern_versions=true,cms_preflight_registry=true,'
  || 'cms_publication_settings_snapshots=true,cms_schema_artifacts=true,cms_template_versions=true,cms_term_assignments=true,cms_terms=true',
  'every table the builder reads has forced row-level security with a policy on the CMS RPC context [P2-S11-AC-087]');

-- ---------------------------------------------------------------------------
-- Behaviour: no context, no rows.
-- ---------------------------------------------------------------------------
select is(pg_temp.c11_build('true'), 'ok:true',
  'control: with the CMS RPC context the builder returns the nine-group manifest of the revision [P2-S11-AC-087]');
select is(pg_temp.c11_build(null), 'P0001:NOT_FOUND',
  'without the CMS RPC context the revision is invisible under RLS: the builder answers NOT_FOUND [P2-S11-AC-087]');
select is(pg_temp.c11_build('false'), 'P0001:NOT_FOUND',
  'a context other than true is no context: NOT_FOUND [P2-S11-AC-087]');
select is(pg_temp.c11_build('TRUE'), 'P0001:NOT_FOUND',
  'the context match is exact (TRUE is not true): NOT_FOUND [P2-S11-AC-087]');
select is(pg_temp.c11_build('true'), 'ok:true',
  'the context is evaluated per statement: restored, the same call returns the manifest again [P2-S11-AC-087]');
select is(pg_temp.c11_status(null, (select manifest from c11_frozen)), 'stale/false',
  'outside the context the currency predicates see no canonical rows: the frozen manifest is stale and its identities are not current [P2-S11-AC-087]');
select is(pg_temp.c11_status('true', (select manifest from c11_frozen)), 'current/true',
  'control: inside the context the same frozen manifest is current and its identities are current [P2-S11-AC-087]');

-- ---------------------------------------------------------------------------
-- The builder accepts no caller value.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::text || '/' || min(pg_get_function_arguments(p.oid))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private' and p.proname = 'cms_build_dependency_manifest'),
  '1/p_revision_id uuid',
  'there is exactly one builder and its only input is the revision id: no manifest, hash or version-set value can be passed in [P2-S11-AC-087]');
select is(
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_private', 'platform_api')
      and p.proname like '%dependency_manifest%' and p.proname <> 'cms_build_dependency_manifest'
      and pg_get_function_result(p.oid) = 'jsonb' and p.proname like 'cms_build%'),
  '0',
  'no other function named like a manifest builder returns a manifest [P2-S11-AC-087]');

select * from finish();
rollback;
