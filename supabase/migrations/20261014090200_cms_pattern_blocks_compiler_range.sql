-- Slice 12 lane block-compat (root ruling B, review-blockcompat.md).  Replaces the block compatibility rule of
-- platform_private.cms_pattern_blocks_compatible (promoted in 20261014020300, mirror of the template rule).
--
-- WHAT CHANGES (and only this): "compatible" is no longer "the block is listed in the renderer manifest
-- (`blocks` or `blockDefinitions`) of the active version of every type" (no spec basis; the compiler never writes
-- it).  BE03c 1361 ("rejects a missing, withdrawn or incompatible block"), 396 ("a registered, non-withdrawn
-- version"), 209, 321, 1567; BE03a 1098-1101, 2761: every distinct block a forest reaches, nested patterns
-- included, must be REGISTERED and its registered compatibility {minSchemaCompiler, maxSchemaCompiler} must cover
-- the compiler_version of the active schema artifact of EVERY compatibleTypeIds member (dotted-numeric over the
-- closed compiler registry; fails closed: cms_block_range_covers, 20261014090000).  A block row that does not
-- exist covers nothing, so it fails closed here too (the digest already refuses it first).
--
-- Lifecycle is not decided here, exactly as before: cms_pattern_registry_digest refuses a withdrawn block and
-- admits a deprecated one (BE03c 396, 1361, 1514-1515).  The active-owner-type and active-version join is the
-- same as before.  Signature, language, volatility, SECURITY DEFINER, empty search_path, owner and ACL are kept
-- by CREATE OR REPLACE; the caller (cms_create_pattern_version, 20261014020400) is untouched.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_blocks_compatible(
  p_owner_id uuid, p_tree jsonb, p_type_ids jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select not exists (
    select 1
      from (
        select distinct closure.block_key, closure.block_version
          from platform_private.cms_governed_pattern_closure(p_owner_id, p_tree) closure
         where closure.item_kind = 'block'
      ) reached
      left join platform_private.cms_block_definition_versions registered
        on registered.block_key = reached.block_key
       and registered.block_version = reached.block_version
       and registered.state = 'registered'
      cross join pg_catalog.jsonb_array_elements_text(p_type_ids) wanted(value)
     where not exists (
       select 1
         from platform_private.cms_content_types content_type
         join platform_private.cms_content_type_versions version_row
           on version_row.content_type_id = content_type.id
         join platform_private.cms_schema_artifacts artifact
           on artifact.id = version_row.schema_artifact_id
          and artifact.content_type_version_id = version_row.id
        where content_type.id = wanted.value::uuid
          and content_type.owner_id = p_owner_id
          and content_type.state = 'active'
          and version_row.state = 'active'
          and platform_private.cms_block_range_covers(
            registered.compatibility_range, artifact.compiler_version))
  )
$body$;

comment on function platform_private.cms_pattern_blocks_compatible(uuid, jsonb, jsonb) is
  'BE03c 1361: true when every distinct registered block a pattern forest reaches, nested patterns included, has a registered schema-compiler range that covers the compiler_version of the active artifact of every compatible content type of the owner (dotted-numeric, fails closed). Lifecycle is decided by cms_pattern_registry_digest. Private.';

revoke all on function platform_private.cms_pattern_blocks_compatible(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
