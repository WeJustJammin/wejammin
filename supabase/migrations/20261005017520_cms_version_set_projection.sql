-- Slice 11 shared helpers (lane S11-3s, BE03b "Frozen dependency manifest build
-- and version set (E1, E7)"; tracker P2-S11-AC-089): the VersionSet projection.
--
-- The `VersionSet` is the PURE projection versionSetOf(manifest, revision):
--   schemaVersionId  <- manifest.schema.id            schemaHash        <- manifest.schema.hash
--   schemaArtifact, validatorRefs, workflowPolicy, activationEvidence
--                    <- manifest.schema (copied unchanged)
--   templateVersionId / templateHash <- manifest.template.{id, hash}, both null when absent
--   taxonomyVersionIds <- the revision's taxonomy_version_ids sorted bytewise ascending
--   blockVersionIds / patternVersionIds <- the manifest ids in manifest order (the manifest
--                    is canonical: the builder sorts every list by lowercase UUID)
-- Canonical form (BE03b E1, the strict TypeScript schemas): every identity is a lowercase UUID
-- named once, every list ascending bytewise -- block and pattern ids, validator references
-- by (key, version) -- and the revision's taxonomy ids are named once.  A manifest list that
-- is unsorted, repeats an identity or holds a non-canonical id is INVALID_REQUEST (never
-- re-ordered: one dependency set has exactly one serialization); the revision's taxonomy ids,
-- which the manifest does not carry, are sorted bytewise (a duplicate or non-canonical id is
-- INVALID_REQUEST), as the TypeScript projection sorts them.
--   settingsVersion  <- manifest.settings.version     compilerVersion   <- manifest.schema.schemaArtifact.compilerVersion
-- This is the SQL twin of packages/contracts/src/cms-editorial/version-set.ts
-- (versionSetOf / versionSetMatchesManifest); the shared fixture file
-- supabase/tests/phase_02_slice_11_helpers/version-set-parity.sqlinc is read by
-- both sides.  Both helpers are IMMUTABLE and touch no table.  `matches` is the
-- bit-for-bit comparison "the server never accepts a version set it cannot
-- rebuild": the stored/echoed set must equal the projection of the manifest, with
-- the taxonomy ids taken from the set itself (the one member the manifest does
-- not carry).  It answers false for any malformed input, never an error.
-- Forward-only.
begin;

-- True when every element sorts strictly after the one before it, bytewise (collate "C"),
-- so the list is ascending and names each element once.  Pure.
create or replace function platform_private.cms_ids_strictly_ascending(p_ids text[])
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select not exists (
    select 1
      from pg_catalog.unnest(p_ids) with ordinality earlier(id, ordinal)
      join pg_catalog.unnest(p_ids) with ordinality later(id, ordinal)
        on later.ordinal = earlier.ordinal + 1
     where earlier.id collate "C" >= later.id collate "C"
  )
$body$;

comment on function platform_private.cms_ids_strictly_ascending(text[]) is
  'BE03b E1: true when a text list is strictly ascending bytewise (ascending and each element once). Pure; IMMUTABLE.';

create or replace function platform_private.cms_version_set_of(
  p_manifest jsonb,
  p_taxonomy_version_ids jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $body$
declare
  schema_group jsonb;
  template_group jsonb;
  block_ids text[];
  pattern_ids text[];
  taxonomy_ids text[];
  validator_keys text[];
begin
  if p_manifest is null
     or pg_catalog.jsonb_typeof(p_manifest) is distinct from 'object'
     or not (p_manifest ? 'template')
     or pg_catalog.jsonb_typeof(p_manifest->'schema') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_manifest->'template') not in ('object', 'null')
     or pg_catalog.jsonb_typeof(p_manifest->'blocks') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_manifest->'patterns') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_manifest->'settings') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_taxonomy_version_ids) is distinct from 'array' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  schema_group := p_manifest->'schema';
  template_group := p_manifest->'template';
  if pg_catalog.jsonb_typeof(schema_group->'id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(schema_group->'hash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(schema_group->'schemaArtifact') is distinct from 'object'
     or pg_catalog.jsonb_typeof(schema_group->'schemaArtifact'->'compilerVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(schema_group->'validatorRefs') is distinct from 'array'
     or pg_catalog.jsonb_typeof(schema_group->'workflowPolicy') is distinct from 'object'
     or pg_catalog.jsonb_typeof(schema_group->'activationEvidence') is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_manifest->'settings'->'version') is distinct from 'string'
     or (pg_catalog.jsonb_typeof(template_group) = 'object'
         and (pg_catalog.jsonb_typeof(template_group->'id') is distinct from 'string'
              or pg_catalog.jsonb_typeof(template_group->'hash') is distinct from 'string'))
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_manifest->'blocks' || p_manifest->'patterns') member
        where pg_catalog.jsonb_typeof(member.value->'id') is distinct from 'string'
     )
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_taxonomy_version_ids) member
        where pg_catalog.jsonb_typeof(member.value) is distinct from 'string'
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- Canonical lists: lowercase UUIDs named once, ascending bytewise.
  if exists (
       select 1
         from pg_catalog.jsonb_array_elements(schema_group->'validatorRefs') member
        where not platform_private.cms_exact_keys(member.value, array['key', 'version']::text[], array['key', 'version']::text[])
           or pg_catalog.jsonb_typeof(member.value->'key') is distinct from 'string'
           or pg_catalog.jsonb_typeof(member.value->'version') is distinct from 'string'
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(member.value->>'id' order by member.ordinal), '{}'::text[])
    into block_ids
    from pg_catalog.jsonb_array_elements(p_manifest->'blocks') with ordinality member(value, ordinal);
  select coalesce(pg_catalog.array_agg(member.value->>'id' order by member.ordinal), '{}'::text[])
    into pattern_ids
    from pg_catalog.jsonb_array_elements(p_manifest->'patterns') with ordinality member(value, ordinal);
  select coalesce(pg_catalog.array_agg(member.id order by member.ordinal), '{}'::text[])
    into taxonomy_ids
    from pg_catalog.jsonb_array_elements_text(p_taxonomy_version_ids) with ordinality member(id, ordinal);
  -- A validator reference orders by key and then version; chr(1) sorts below every key character.
  select coalesce(pg_catalog.array_agg(
           (member.value->>'key') || pg_catalog.chr(1) || (member.value->>'version') order by member.ordinal
         ), '{}'::text[])
    into validator_keys
    from pg_catalog.jsonb_array_elements(schema_group->'validatorRefs') with ordinality member(value, ordinal);
  if exists (
       select 1
         from pg_catalog.unnest(block_ids || pattern_ids || taxonomy_ids) member(id)
        where not platform_private.cms_valid_uuid(member.id)
     )
     or not platform_private.cms_ids_strictly_ascending(block_ids)
     or not platform_private.cms_ids_strictly_ascending(pattern_ids)
     or not platform_private.cms_ids_strictly_ascending(validator_keys)
     or (select pg_catalog.count(distinct member.id) from pg_catalog.unnest(taxonomy_ids) member(id))
          <> pg_catalog.cardinality(taxonomy_ids) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'schemaVersionId', schema_group->'id',
    'schemaHash', schema_group->'hash',
    'schemaArtifact', schema_group->'schemaArtifact',
    'validatorRefs', schema_group->'validatorRefs',
    'workflowPolicy', schema_group->'workflowPolicy',
    'activationEvidence', schema_group->'activationEvidence',
    'templateVersionId', case when pg_catalog.jsonb_typeof(template_group) = 'object'
      then template_group->'id' else 'null'::jsonb end,
    'templateHash', case when pg_catalog.jsonb_typeof(template_group) = 'object'
      then template_group->'hash' else 'null'::jsonb end,
    'taxonomyVersionIds', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(taxonomy.id) order by taxonomy.id collate "C")
        from pg_catalog.jsonb_array_elements_text(p_taxonomy_version_ids) taxonomy(id)
    ), '[]'::jsonb),
    'blockVersionIds', coalesce((
      select pg_catalog.jsonb_agg(block.value->'id' order by block.ordinality)
        from pg_catalog.jsonb_array_elements(p_manifest->'blocks') with ordinality block(value, ordinality)
    ), '[]'::jsonb),
    'patternVersionIds', coalesce((
      select pg_catalog.jsonb_agg(pattern.value->'id' order by pattern.ordinality)
        from pg_catalog.jsonb_array_elements(p_manifest->'patterns') with ordinality pattern(value, ordinality)
    ), '[]'::jsonb),
    'settingsVersion', p_manifest->'settings'->'version',
    'compilerVersion', schema_group->'schemaArtifact'->'compilerVersion'
  );
end;
$body$;

comment on function platform_private.cms_version_set_of(jsonb, jsonb) is
  'BE03b E1/E4: the pure VersionSet projection of a DependencyManifest (taxonomy ids sorted bytewise); the SQL twin of versionSetOf in packages/contracts. Every list must be canonical (lowercase UUIDs named once, ascending bytewise, validator references by key then version). IMMUTABLE; malformed or non-canonical input is INVALID_REQUEST.';

create or replace function platform_private.cms_version_set_matches_manifest(
  p_version_set jsonb,
  p_manifest jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $body$
begin
  if p_version_set is null
     or pg_catalog.jsonb_typeof(p_version_set) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_version_set->'taxonomyVersionIds') is distinct from 'array' then
    return false;
  end if;
  return p_version_set = platform_private.cms_version_set_of(
    p_manifest, p_version_set->'taxonomyVersionIds'
  );
exception
  when raise_exception then
    return false;
end;
$body$;

comment on function platform_private.cms_version_set_matches_manifest(jsonb, jsonb) is
  'BE03b E1/E4: true when the version set equals the projection of the manifest (taxonomy ids taken from the set). False, never an error, for malformed input. The SQL twin of versionSetMatchesManifest. IMMUTABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_ids_strictly_ascending(text[])
  owner to wejammin_cms_definer;
alter function platform_private.cms_version_set_of(jsonb, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_version_set_matches_manifest(jsonb, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_ids_strictly_ascending(text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_version_set_of(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_version_set_matches_manifest(jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
