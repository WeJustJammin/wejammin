-- Slice 12 evolve-contract (CMS-03B-14): server-derived `typeKey` on the
-- author-safe AuthoringContextType projection.
--
-- STATUS: UNRUN.  Authored before the native/database prerequisites cleared;
-- no local database, migration apply, pgTAP run or hosted gate has executed
-- this file, so it is neither observed applying nor observed RED.
--
-- This migration replaces only the private projection helper
-- `platform_private.cms_authoring_context_type(uuid)`.  It is a body-for-body
-- copy of the definition in migration 20261005010800_cms_entry_authoring_context
-- with one added member, `'typeKey', type_row.type_key`, taken from the joined
-- `cms_content_types` row.  Language, STABLE behavior, the fixed empty search
-- path, the compiled artifact/owner/hash AND version-row fingerprint joins, and
-- every existing response field are unchanged.  No table, public wrapper,
-- grant, audit/outbox effect or request argument is added or removed.
--
-- The member is required, so this is a breaking change for the previous strict
-- parser.  It is NOT represented as compatible with an old/new mixed
-- client/Worker/database release: all first-party consumers and this
-- projection are promoted together.  Forward-only.

begin;

create or replace function platform_private.cms_authoring_context_type(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'contentTypeId', version_row.content_type_id,
    'contentTypeVersionId', version_row.id,
    'typeKey', type_row.type_key,
    'label', coalesce(version_row.labels->>'label', type_row.type_key),
    'sourceLocale', version_row.source_locale,
    'defaultLocale', version_row.default_locale,
    'supportedLocales', coalesce(version_row.supported_locales, '[]'::jsonb),
    'schemaArtifact', (
      select pg_catalog.jsonb_build_object(
        'id', artifact.id,
        'contentTypeVersionId', artifact.content_type_version_id,
        'artifactHash', pg_catalog.btrim(artifact.artifact_hash::text),
        'compilerVersion', artifact.compiler_version,
        'zodContractRef', artifact.zod_contract_ref
      )
      from platform_private.cms_schema_artifacts artifact
      where artifact.id = version_row.schema_artifact_id
        and artifact.content_type_version_id = version_row.id
        and artifact.owner_id = version_row.owner_id
        and artifact.artifact_hash = version_row.definition_hash
        and artifact.state::text = 'compiled'
    ),
    'validatorRefs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'key', ref.validator_key,
          'version', ref.validator_version::text
        )
        order by ref.validator_key
      )
      from (
        select distinct field.validator_key, field.validator_version
        from platform_private.cms_field_definition_versions field
        where field.content_type_version_id = version_row.id
          and field.state = 'active'
          and field.validator_key is not null
      ) ref
    ), '[]'::jsonb),
    'workflowPolicy', platform_private.cms_editorial_workflow_policy_evidence(version_row.id),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
  )
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_content_types type_row on type_row.id = version_row.content_type_id
  join platform_private.cms_schema_artifacts artifact
    on artifact.id = version_row.schema_artifact_id
   and artifact.content_type_version_id = version_row.id
   and artifact.owner_id = version_row.owner_id
   and artifact.artifact_hash = version_row.definition_hash
   and artifact.state::text = 'compiled'
  where version_row.id = p_version_id
$body$;

-- ALTER FUNCTION ... OWNER TO needs CREATE on the schema for the new owner, so
-- the same transaction-local grant/revoke pair the originating Slice 10
-- migration used brackets the ownership move.  The helper stays owned by the
-- non-BYPASSRLS definer role so forced policies still apply to its reads.
grant create on schema platform_private to wejammin_cms_definer;

alter function platform_private.cms_authoring_context_type(uuid)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

-- Private-helper boundary is retained exactly: unreachable from every browser
-- role and from service_role, executable only by the owning definer.
revoke all on function platform_private.cms_authoring_context_type(uuid)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_authoring_context_type(uuid)
  to wejammin_cms_definer;

commit;

