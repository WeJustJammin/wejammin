-- Slice 11 shared helpers (lane S11-3s, BE03b "Frozen dependency manifest build and
-- version set (E1, E7)"; tracker P2-S11-AC-087 .. AC-090, AC-113): the ONLY builder
-- of a DependencyManifest and its companions.
--
-- cms_build_dependency_manifest(revision) reads canonical committed state, accepts
-- no caller value and returns the nine contract groups (every list ascending by the
-- lowercase UUID string, bytewise, each identity once):
--   schema        the revision's pinned content-type version: id and definition hash, its
--                 compiled SchemaArtifact, the protected validators frozen into the artifact
--                 (DEC-146), the editorial workflow-policy evidence (strictest-of rule, DEC-109)
--                 and the non-null 03a activation evidence
--   template      { id, hash = TemplateVersion content_hash } or JSON null
--   blocks        every BlockDefinitionVersion reachable from the revision's live composition
--                 instances and its template slots: { id, hash = registry release_digest }
--   patterns      every PatternVersion a live instance names: { id, hash = content_hash }
--   terms         the distinct terms of the revision's ACTIVE TermAssignment rows: { id, hash =
--                 SHA-256 of the JCS { id, termKey, lifecycle, version (decimal string),
--                 successorId } of the term row }
--   localeSources the revision's LocaleVariant source: { locale = source locale, revisionId =
--                 source revision, hash = sourceHash } (empty for a source-locale revision)
--   settings      the E7 snapshot { version = ordinal, hash } (recorded if absent)
--   relations     { fieldId = stable field id, targetId, targetVersion = the pinned
--                 expectedTargetVersion, else the target's current version } per relation row;
--                 a relation whose onUnavailable is omit or placeholder and whose target is
--                 unavailable (not an existing ACTIVE content entry) is not listed
--   checker       { key, version } of the current accessibility provider of the preflight registry
-- A group member that cannot be resolved (no compiled artifact, no workflow-policy or
-- activation evidence, a block with no registry record) is DEPENDENCY_UNAVAILABLE and
-- never a partial manifest.  More than 256 entries in total, more than the contract
-- maximum of one group, or more than 32768 UTF-8 bytes of JCS is `dependency_manifest_too_large`.
-- dependencyHash = cms_jcs_sha256(manifest).  VOLATILE: it records the settings snapshot.
--
-- Companions:
--   cms_dependency_manifest_within_bounds(manifest)  the 256-entry / per-group / 32 KiB rule
--   cms_revision_version_set(revision, manifest)      version_set_of(manifest, revision taxonomy ids)
--   cms_dependency_manifest_valid(manifest)           the STRICT DependencyManifest structure (the SQL twin of
--       DependencyManifestSchema): the nine groups and no other key, every group's exact keys, types,
--       hashes (64 lowercase hex), lowercase UUIDs, decimal versions, the per-group maxima and the
--       256-entry / 32 KiB bounds, and the canonical order (blocks, patterns and terms ascending by id;
--       localeSources by revision id then locale, one per locale; relations by field id then target id;
--       validator references by key then version) with every identity named once.  Pure reads.
--   cms_manifest_identities_current(manifest)         a frozen identity is CURRENT when its source
--       still serves it (and only after the manifest passed cms_dependency_manifest_valid): the schema version is the content type's ACTIVE version with an equal
--       artifact hash; template and pattern versions are `active` with equal hashes; blocks are
--       supported or deprecated (never withdrawn) with an equal digest; the settings snapshot equals
--       the owner's current one.  False (never an error) for a malformed manifest.
--   cms_frozen_dependencies_status(revision, frozen)  'current' only when the rebuilt manifest equals
--       the frozen one bit-for-bit AND every frozen identity is current AND every taxonomy version
--       the revision records is `active`; otherwise 'stale' (the caller answers 409 version_set_stale
--       and invalidates the review dependency_changed).
--   cms_review_dependency_refs(revision, manifest)    the (kind, ref_id) ReviewDependency rows
--       cms_submit_review writes from the frozen manifest: schema, template, block, pattern, term,
--       taxonomy_version (the revision's ids), locale_source, relation_target, settings (the snapshot
--       ROW id).  One row per identity.
-- Private, callers run under the CMS RPC context.  Forward-only.
begin;

create or replace function platform_private.cms_dependency_manifest_within_bounds(
  p_manifest jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  validator_count integer;
  block_count integer;
  pattern_count integer;
  term_count integer;
  locale_count integer;
  relation_count integer;
begin
  if p_manifest is null or pg_catalog.jsonb_typeof(p_manifest) is distinct from 'object' then
    return false;
  end if;
  validator_count := case when pg_catalog.jsonb_typeof(p_manifest->'schema'->'validatorRefs') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'schema'->'validatorRefs') else 0 end;
  block_count := case when pg_catalog.jsonb_typeof(p_manifest->'blocks') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'blocks') else 0 end;
  pattern_count := case when pg_catalog.jsonb_typeof(p_manifest->'patterns') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'patterns') else 0 end;
  term_count := case when pg_catalog.jsonb_typeof(p_manifest->'terms') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'terms') else 0 end;
  locale_count := case when pg_catalog.jsonb_typeof(p_manifest->'localeSources') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'localeSources') else 0 end;
  relation_count := case when pg_catalog.jsonb_typeof(p_manifest->'relations') = 'array'
    then pg_catalog.jsonb_array_length(p_manifest->'relations') else 0 end;
  -- Each present singleton (schema, settings, checker, and the template when not null)
  -- is one entry; every element of the six lists is one entry.
  if validator_count + block_count + pattern_count + term_count + locale_count + relation_count
       + 3 + (case when pg_catalog.jsonb_typeof(p_manifest->'template') = 'object' then 1 else 0 end) > 256
     or validator_count > 128 or block_count > 128 or pattern_count > 128
     or term_count > 256 or locale_count > 32 or relation_count > 128 then
    return false;
  end if;
  return pg_catalog.octet_length(pg_catalog.convert_to(platform_private.cms_jcs(p_manifest), 'utf8')) <= 32768;
end;
$body$;

comment on function platform_private.cms_dependency_manifest_within_bounds(jsonb) is
  'BE03b E1: a DependencyManifest is within bounds when it has at most 256 entries in total (list elements plus the present singletons), no group over its contract maximum, and at most 32768 UTF-8 bytes of JCS. False for a non-object. Private; STABLE.';

create or replace function platform_private.cms_build_dependency_manifest(
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  policy jsonb;
  activation jsonb;
  validator_refs jsonb;
  template_group jsonb := 'null'::jsonb;
  template_row platform_private.cms_template_versions%rowtype;
  block_refs integer;
  block_resolved integer;
  blocks_group jsonb;
  patterns_group jsonb;
  terms_group jsonb;
  locale_group jsonb;
  relations_group jsonb;
  settings_group jsonb;
  checker_row record;
  manifest jsonb;
begin
  if p_revision_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- schema ------------------------------------------------------------------
  select version.* into version_row
    from platform_private.cms_content_type_versions version
   where version.id = revision_row.schema_version_id;
  select artifact.* into artifact_row
    from platform_private.cms_schema_artifacts artifact
   where artifact.id = version_row.schema_artifact_id
     and artifact.content_type_version_id = version_row.id
     and artifact.artifact_hash = version_row.definition_hash
     and artifact.state::text = 'compiled';
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  policy := platform_private.cms_editorial_workflow_policy_evidence(version_row.id);
  activation := platform_private.cms_type_version_resource(version_row.id)->'activationEvidence';
  if policy is null or policy = 'null'::jsonb
     or activation is null or activation = 'null'::jsonb then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object('key', validator.value->>'key', 'version', validator.value->>'version')
           order by validator.value->>'key' collate "C", validator.value->>'version' collate "C"
         ), '[]'::jsonb)
    into validator_refs
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(artifact_row.editor_manifest->'validators') = 'array'
        then artifact_row.editor_manifest->'validators' else '[]'::jsonb end
    ) validator(value);

  -- template ----------------------------------------------------------------
  if revision_row.template_version_id is not null then
    select template.* into template_row
      from platform_private.cms_template_versions template
     where template.id = revision_row.template_version_id;
    if not found then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    template_group := pg_catalog.jsonb_build_object('id', template_row.id, 'hash', template_row.content_hash);
  end if;

  -- blocks: live composition instances plus the template slots ------------------
  create temporary table if not exists pg_temp.cms_manifest_block_refs(
    block_key text not null, block_version integer not null
  ) on commit drop;
  -- An unqualified DELETE is refused under PostgREST (pg-safeupdate); clear the
  -- per-call scratch table with an explicit predicate.
  delete from pg_temp.cms_manifest_block_refs where true;
  insert into pg_temp.cms_manifest_block_refs(block_key, block_version)
  select distinct instance.block_key, instance.block_version::integer
    from platform_private.cms_composition_instances instance
   where instance.revision_id = revision_row.id
     and instance.state in ('draft', 'active', 'pending_diff')
  union
  select distinct reference.value->>'blockKey', (reference.value->>'blockVersion')::integer
    from pg_catalog.jsonb_array_elements(coalesce(template_row.slots, '[]'::jsonb)) slot(value)
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(slot.value->'allowedBlocks') = 'array'
        then slot.value->'allowedBlocks' else '[]'::jsonb end
    ) reference(value);
  select pg_catalog.count(*) into block_refs from pg_temp.cms_manifest_block_refs;
  select pg_catalog.count(*) into block_resolved
    from pg_temp.cms_manifest_block_refs reference
    join platform_private.cms_block_definition_versions block
      on block.block_key = reference.block_key and block.block_version = reference.block_version;
  if block_refs <> block_resolved then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object('id', resolved.id, 'hash', resolved.digest)
           order by resolved.id::text collate "C"
         ), '[]'::jsonb)
    into blocks_group
    from (
      select block.id, block.release_digest::text as digest
        from pg_temp.cms_manifest_block_refs reference
        join platform_private.cms_block_definition_versions block
          on block.block_key = reference.block_key and block.block_version = reference.block_version
    ) resolved;

  -- patterns ------------------------------------------------------------------
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object('id', named.id, 'hash', named.digest)
           order by named.id::text collate "C"
         ), '[]'::jsonb)
    into patterns_group
    from (
      select distinct pattern.id, pattern.content_hash::text as digest
        from platform_private.cms_composition_instances instance
        join platform_private.cms_pattern_versions pattern on pattern.id = instance.pattern_id
       where instance.revision_id = revision_row.id
         and instance.state in ('draft', 'active', 'pending_diff')
    ) named;

  -- terms ---------------------------------------------------------------------
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object('id', assigned.id, 'hash', assigned.digest)
           order by assigned.id::text collate "C"
         ), '[]'::jsonb)
    into terms_group
    from (
      select distinct term.id,
             platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
               'id', term.id, 'termKey', term.term_key, 'lifecycle', term.lifecycle,
               'version', term.version::text, 'successorId', term.successor_id
             )) as digest
        from platform_private.cms_term_assignments assignment
        join platform_private.cms_terms term on term.id = assignment.term_id
       where assignment.revision_id = revision_row.id
         and assignment.state = 'active'
    ) assigned;

  -- localeSources -------------------------------------------------------------
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'locale', source.source_locale, 'revisionId', source.source_revision_id,
             'hash', source.source_hash::text
           ) order by source.source_revision_id::text collate "C"
         ), '[]'::jsonb)
    into locale_group
    from (
      select variant.source_locale, variant.source_revision_id, variant.source_hash
        from platform_private.cms_locale_variants variant
       where variant.revision_id = revision_row.id
       order by variant.version desc
       limit 1
    ) source;

  -- settings and checker ------------------------------------------------------
  settings_group := platform_private.cms_settings_snapshot(revision_row.owner_id);
  select registry.provider_key, registry.provider_version into checker_row
    from platform_private.cms_preflight_registry registry
   where registry.category = 'accessibility'
   order by registry.version desc
   limit 1;
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- relations -----------------------------------------------------------------
  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'fieldId', listed.field_id, 'targetId', listed.target_id,
             'targetVersion', listed.target_version::text
           ) order by listed.field_id::text collate "C", listed.target_id::text collate "C"
         ), '[]'::jsonb)
    into relations_group
    from (
      select relation.field_id, relation.target_id,
             coalesce(relation.expected_target_version, entry.version, 1) as target_version
        from platform_private.cms_entry_relations relation
        left join platform_private.cms_content_entries entry
          on relation.target_kind = 'content' and entry.id = relation.target_id
       where relation.revision_id = revision_row.id
         and relation.state = 'active'
         and (relation.on_unavailable = 'block'
              or (relation.target_kind = 'content' and entry.lifecycle = 'active'))
    ) listed;

  manifest := pg_catalog.jsonb_build_object(
    'schema', pg_catalog.jsonb_build_object(
      'id', version_row.id,
      'hash', version_row.definition_hash::text,
      'schemaArtifact', pg_catalog.jsonb_build_object(
        'id', artifact_row.id,
        'contentTypeVersionId', version_row.id,
        'artifactHash', artifact_row.artifact_hash::text,
        'compilerVersion', artifact_row.compiler_version,
        'zodContractRef', artifact_row.zod_contract_ref
      ),
      'validatorRefs', validator_refs,
      'workflowPolicy', policy,
      'activationEvidence', activation
    ),
    'template', template_group,
    'blocks', blocks_group,
    'patterns', patterns_group,
    'terms', terms_group,
    'localeSources', locale_group,
    'settings', settings_group,
    'relations', relations_group,
    'checker', pg_catalog.jsonb_build_object(
      'key', checker_row.provider_key, 'version', checker_row.provider_version::text
    )
  );
  if not platform_private.cms_dependency_manifest_within_bounds(manifest) then
    raise exception 'dependency_manifest_too_large' using errcode = 'P0001';
  end if;
  return manifest;
end;
$body$;

comment on function platform_private.cms_build_dependency_manifest(uuid) is
  'BE03b E1: the only builder of a DependencyManifest (nine groups, sorted, each identity once; 256 entries / 32 KiB). Reads canonical state, accepts no caller value; records the E7 settings snapshot. NOT_FOUND for an absent revision, DEPENDENCY_UNAVAILABLE for unresolvable evidence, dependency_manifest_too_large over the bounds. Private; VOLATILE.';

create or replace function platform_private.cms_revision_version_set(
  p_revision_id uuid,
  p_manifest jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_taxonomy jsonb;
begin
  select revision.taxonomy_version_ids into revision_taxonomy
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return platform_private.cms_version_set_of(p_manifest, revision_taxonomy);
end;
$body$;

comment on function platform_private.cms_revision_version_set(uuid, jsonb) is
  'BE03b E1/E4: the VersionSet of a revision = cms_version_set_of(manifest, the revision''s taxonomy_version_ids). NOT_FOUND for an absent revision. Private; STABLE.';

create or replace function platform_private.cms_manifest_version_text_valid(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select p_value is not null
    and p_value ~ '^[1-9][0-9]{0,18}$'
    and (pg_catalog.length(p_value) < 19 or p_value <= '9223372036854775807')
$body$;

comment on function platform_private.cms_manifest_version_text_valid(text) is
  'BE03b CmsVersion: a decimal string 1..9223372036854775807 without leading zeros. Pure; IMMUTABLE.';

create or replace function platform_private.cms_manifest_policy_evidence_valid(p_policy jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  member_keys text[] := array[
    'key', 'version', 'policyHash', 'riskClass', 'requiredDecisionCount',
    'requiredCapabilities', 'approvalEvidenceHash'
  ]::text[];
begin
  if not platform_private.cms_exact_keys(p_policy, member_keys, member_keys) then
    return false;
  end if;
  if pg_catalog.jsonb_typeof(p_policy->'key') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_policy->'version') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_policy->'policyHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_policy->'approvalEvidenceHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_policy->'riskClass') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_policy->'requiredDecisionCount') is distinct from 'number'
     or pg_catalog.jsonb_typeof(p_policy->'requiredCapabilities') is distinct from 'array' then
    return false;
  end if;
  if p_policy->>'key' !~ '^[a-z][a-z0-9._-]{0,127}$'
     or not platform_private.cms_manifest_version_text_valid(p_policy->>'version')
     or not platform_private.cms_valid_hash(p_policy->>'policyHash')
     or not platform_private.cms_valid_hash(p_policy->>'approvalEvidenceHash')
     or p_policy->>'riskClass' not in ('ordinary', 'protected')
     or p_policy->>'requiredDecisionCount' !~ '^[1-8]$'
     or pg_catalog.jsonb_array_length(p_policy->'requiredCapabilities') > 16
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_policy->'requiredCapabilities') capability(value)
        where pg_catalog.jsonb_typeof(capability.value) is distinct from 'string'
           or (capability.value #>> '{}') !~ '^[a-z][a-z0-9._-]{0,127}$'
     ) then
    return false;
  end if;
  -- A protected policy needs two named approvals and at least one capability slot.
  return p_policy->>'riskClass' = 'ordinary'
    or ((p_policy->>'requiredDecisionCount')::integer >= 2
        and pg_catalog.jsonb_array_length(p_policy->'requiredCapabilities') > 0);
end;
$body$;

comment on function platform_private.cms_manifest_policy_evidence_valid(jsonb) is
  'BE03b WorkflowPolicyEvidence: exactly the seven members with their types, hashes, 1..8 decisions, <=16 capability keys, and the protected-policy rule. Pure; IMMUTABLE.';

create or replace function platform_private.cms_manifest_hashed_entries_valid(
  p_entries jsonb,
  p_max integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  entry_ids text[];
begin
  if pg_catalog.jsonb_typeof(p_entries) is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_entries) > p_max
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_entries) entry(value)
        where not platform_private.cms_exact_keys(entry.value, array['id', 'hash']::text[], array['id', 'hash']::text[])
           or pg_catalog.jsonb_typeof(entry.value->'id') is distinct from 'string'
           or pg_catalog.jsonb_typeof(entry.value->'hash') is distinct from 'string'
           or not platform_private.cms_valid_uuid(entry.value->>'id')
           or not platform_private.cms_valid_hash(entry.value->>'hash')
     ) then
    return false;
  end if;
  select coalesce(pg_catalog.array_agg(entry.value->>'id' order by entry.ordinal), '{}'::text[])
    into entry_ids
    from pg_catalog.jsonb_array_elements(p_entries) with ordinality entry(value, ordinal);
  return platform_private.cms_ids_strictly_ascending(entry_ids);
end;
$body$;

comment on function platform_private.cms_manifest_hashed_entries_valid(jsonb, integer) is
  'BE03b DependencyManifest group of { id, hash } entries: at most p_max entries, exact keys, lowercase UUID ids, 64-hex hashes, ids ascending bytewise and named once. Pure; IMMUTABLE.';

create or replace function platform_private.cms_dependency_manifest_valid(p_manifest jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  group_keys text[] := array[
    'schema', 'template', 'blocks', 'patterns', 'terms', 'localeSources', 'settings', 'relations', 'checker'
  ]::text[];
  schema_keys text[] := array[
    'id', 'hash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy', 'activationEvidence'
  ]::text[];
  artifact_keys text[] := array[
    'id', 'contentTypeVersionId', 'artifactHash', 'compilerVersion', 'zodContractRef'
  ]::text[];
  schema_group jsonb;
  artifact jsonb;
  ordered_keys text[];
begin
  if p_manifest is null or not platform_private.cms_exact_keys(p_manifest, group_keys, group_keys) then
    return false;
  end if;

  -- schema
  schema_group := p_manifest->'schema';
  if not platform_private.cms_exact_keys(schema_group, schema_keys, schema_keys)
     or pg_catalog.jsonb_typeof(schema_group->'id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(schema_group->'hash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(schema_group->'validatorRefs') is distinct from 'array' then
    return false;
  end if;
  if not platform_private.cms_valid_uuid(schema_group->>'id')
     or not platform_private.cms_valid_hash(schema_group->>'hash')
     or pg_catalog.jsonb_array_length(schema_group->'validatorRefs') > 128 then
    return false;
  end if;
  artifact := schema_group->'schemaArtifact';
  if not platform_private.cms_exact_keys(artifact, artifact_keys, artifact_keys)
     or pg_catalog.jsonb_typeof(artifact->'id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(artifact->'contentTypeVersionId') is distinct from 'string'
     or pg_catalog.jsonb_typeof(artifact->'artifactHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(artifact->'compilerVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(artifact->'zodContractRef') is distinct from 'string' then
    return false;
  end if;
  if not platform_private.cms_valid_uuid(artifact->>'id')
     or artifact->>'contentTypeVersionId' is distinct from schema_group->>'id'
     or not platform_private.cms_valid_hash(artifact->>'artifactHash')
     or pg_catalog.char_length(artifact->>'compilerVersion') not between 1 and 32
     or pg_catalog.char_length(artifact->>'zodContractRef') not between 1 and 256 then
    return false;
  end if;
  if exists (
       select 1
         from pg_catalog.jsonb_array_elements(schema_group->'validatorRefs') member
        where not platform_private.cms_exact_keys(member.value, array['key', 'version']::text[], array['key', 'version']::text[])
           or pg_catalog.jsonb_typeof(member.value->'key') is distinct from 'string'
           or pg_catalog.jsonb_typeof(member.value->'version') is distinct from 'string'
           or (member.value->>'key') !~ '^[a-z][a-z0-9._-]{0,127}$'
           or not platform_private.cms_manifest_version_text_valid(member.value->>'version')
     ) then
    return false;
  end if;
  select coalesce(pg_catalog.array_agg(
           (member.value->>'key') || pg_catalog.chr(1) || (member.value->>'version') order by member.ordinal
         ), '{}'::text[])
    into ordered_keys
    from pg_catalog.jsonb_array_elements(schema_group->'validatorRefs') with ordinality member(value, ordinal);
  if not platform_private.cms_ids_strictly_ascending(ordered_keys)
     or not platform_private.cms_manifest_policy_evidence_valid(schema_group->'workflowPolicy')
     or not platform_private.cms_manifest_policy_evidence_valid(schema_group->'activationEvidence') then
    return false;
  end if;

  -- template: null or exactly { id, hash }
  if pg_catalog.jsonb_typeof(p_manifest->'template') is distinct from 'null' then
    if not platform_private.cms_exact_keys(p_manifest->'template', array['id', 'hash']::text[], array['id', 'hash']::text[])
       or pg_catalog.jsonb_typeof(p_manifest->'template'->'id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_manifest->'template'->'hash') is distinct from 'string'
       or not platform_private.cms_valid_uuid(p_manifest->'template'->>'id')
       or not platform_private.cms_valid_hash(p_manifest->'template'->>'hash') then
      return false;
    end if;
  end if;

  -- blocks, patterns, terms
  if not platform_private.cms_manifest_hashed_entries_valid(p_manifest->'blocks', 128)
     or not platform_private.cms_manifest_hashed_entries_valid(p_manifest->'patterns', 128)
     or not platform_private.cms_manifest_hashed_entries_valid(p_manifest->'terms', 256) then
    return false;
  end if;

  -- localeSources: { locale, revisionId, hash }, one per locale, ascending by (revisionId, locale)
  if pg_catalog.jsonb_typeof(p_manifest->'localeSources') is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_manifest->'localeSources') > 32
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_manifest->'localeSources') source(value)
        where not platform_private.cms_exact_keys(source.value, array['locale', 'revisionId', 'hash']::text[], array['locale', 'revisionId', 'hash']::text[])
           or pg_catalog.jsonb_typeof(source.value->'locale') is distinct from 'string'
           or pg_catalog.jsonb_typeof(source.value->'revisionId') is distinct from 'string'
           or pg_catalog.jsonb_typeof(source.value->'hash') is distinct from 'string'
           or (source.value->>'locale') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
           or pg_catalog.char_length(source.value->>'locale') > 35
           or not platform_private.cms_valid_uuid(source.value->>'revisionId')
           or not platform_private.cms_valid_hash(source.value->>'hash')
     ) then
    return false;
  end if;
  select coalesce(pg_catalog.array_agg(
           (source.value->>'revisionId') || pg_catalog.chr(1) || (source.value->>'locale') order by source.ordinal
         ), '{}'::text[])
    into ordered_keys
    from pg_catalog.jsonb_array_elements(p_manifest->'localeSources') with ordinality source(value, ordinal);
  if not platform_private.cms_ids_strictly_ascending(ordered_keys)
     or (select pg_catalog.count(distinct source.value->>'locale')
           from pg_catalog.jsonb_array_elements(p_manifest->'localeSources') source(value))
        <> pg_catalog.jsonb_array_length(p_manifest->'localeSources') then
    return false;
  end if;

  -- settings: exactly { version, hash }
  if not platform_private.cms_exact_keys(p_manifest->'settings', array['version', 'hash']::text[], array['version', 'hash']::text[])
     or pg_catalog.jsonb_typeof(p_manifest->'settings'->'version') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_manifest->'settings'->'hash') is distinct from 'string'
     or not platform_private.cms_manifest_version_text_valid(p_manifest->'settings'->>'version')
     or not platform_private.cms_valid_hash(p_manifest->'settings'->>'hash') then
    return false;
  end if;

  -- relations: { fieldId, targetId, targetVersion }, ascending by (fieldId, targetId), each pair once
  if pg_catalog.jsonb_typeof(p_manifest->'relations') is distinct from 'array' then
    return false;
  end if;
  if pg_catalog.jsonb_array_length(p_manifest->'relations') > 128
     or exists (
       select 1
         from pg_catalog.jsonb_array_elements(p_manifest->'relations') relation(value)
        where not platform_private.cms_exact_keys(relation.value, array['fieldId', 'targetId', 'targetVersion']::text[], array['fieldId', 'targetId', 'targetVersion']::text[])
           or pg_catalog.jsonb_typeof(relation.value->'fieldId') is distinct from 'string'
           or pg_catalog.jsonb_typeof(relation.value->'targetId') is distinct from 'string'
           or pg_catalog.jsonb_typeof(relation.value->'targetVersion') is distinct from 'string'
           or not platform_private.cms_valid_uuid(relation.value->>'fieldId')
           or not platform_private.cms_valid_uuid(relation.value->>'targetId')
           or not platform_private.cms_manifest_version_text_valid(relation.value->>'targetVersion')
     ) then
    return false;
  end if;
  select coalesce(pg_catalog.array_agg(
           (relation.value->>'fieldId') || pg_catalog.chr(1) || (relation.value->>'targetId') order by relation.ordinal
         ), '{}'::text[])
    into ordered_keys
    from pg_catalog.jsonb_array_elements(p_manifest->'relations') with ordinality relation(value, ordinal);
  if not platform_private.cms_ids_strictly_ascending(ordered_keys) then
    return false;
  end if;

  -- checker: exactly { key (1..64 characters), version }
  if not platform_private.cms_exact_keys(p_manifest->'checker', array['key', 'version']::text[], array['key', 'version']::text[])
     or pg_catalog.jsonb_typeof(p_manifest->'checker'->'key') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_manifest->'checker'->'version') is distinct from 'string'
     or pg_catalog.char_length(p_manifest->'checker'->>'key') not between 1 and 64
     or not platform_private.cms_manifest_version_text_valid(p_manifest->'checker'->>'version') then
    return false;
  end if;

  return platform_private.cms_dependency_manifest_within_bounds(p_manifest);
end;
$body$;

comment on function platform_private.cms_dependency_manifest_valid(jsonb) is
  'BE03b E1: true only for a manifest of exactly the nine DependencyManifest groups with the strict structure, types, hashes, bounds, canonical ordering and uniqueness of DependencyManifestSchema (the SQL twin). False, never an error, for anything else. Private; STABLE.';

create or replace function platform_private.cms_manifest_identities_current(
  p_manifest jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  current_snapshot jsonb;
  member record;
begin
  -- Malformed manifests are not current: the strict DependencyManifest structure (all nine
  -- groups, exact keys, types, hashes, bounds, canonical order, uniqueness) is validated first.
  if not platform_private.cms_dependency_manifest_valid(p_manifest) then
    return false;
  end if;
  -- The projection must also accept it (it never fails for a valid manifest).
  perform platform_private.cms_version_set_of(p_manifest, '[]'::jsonb);

  select version.* into version_row
    from platform_private.cms_content_type_versions version
    join platform_private.cms_content_types content_type on content_type.id = version.content_type_id
   where version.id = (p_manifest->'schema'->>'id')::uuid
     and version.state::text = 'active'
     and content_type.state = 'active'
     and version.definition_hash::text = p_manifest->'schema'->>'hash'
     and version.schema_artifact_id = (p_manifest->'schema'->'schemaArtifact'->>'id')::uuid;
  if not found then
    return false;
  end if;
  if not exists (
    select 1
      from platform_private.cms_schema_artifacts artifact
     where artifact.id = version_row.schema_artifact_id
       and artifact.content_type_version_id = version_row.id
       and artifact.state::text = 'compiled'
       and artifact.artifact_hash::text = p_manifest->'schema'->'schemaArtifact'->>'artifactHash'
       and artifact.artifact_hash = version_row.definition_hash
  ) then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(p_manifest->'template') = 'object' and not exists (
    select 1
      from platform_private.cms_template_versions template
     where template.id = (p_manifest->'template'->>'id')::uuid
       and template.state = 'active'
       and template.content_hash::text = p_manifest->'template'->>'hash'
  ) then
    return false;
  end if;

  for member in
    select pattern.value->>'id' as id, pattern.value->>'hash' as hash
      from pg_catalog.jsonb_array_elements(p_manifest->'patterns') pattern(value)
  loop
    if not exists (
      select 1
        from platform_private.cms_pattern_versions pattern
       where pattern.id = member.id::uuid
         and pattern.state = 'active'
         and pattern.content_hash::text = member.hash
    ) then
      return false;
    end if;
  end loop;

  for member in
    select block.value->>'id' as id, block.value->>'hash' as hash
      from pg_catalog.jsonb_array_elements(p_manifest->'blocks') block(value)
  loop
    if not exists (
      select 1
        from platform_private.cms_block_definition_versions block
       where block.id = member.id::uuid
         and block.release_digest::text = member.hash
         and coalesce((
           select lifecycle.to_lifecycle
             from platform_private.cms_block_definition_lifecycle_events lifecycle
            where lifecycle.block_definition_version_id = block.id
            order by lifecycle.created_at desc, lifecycle.id desc
            limit 1
         ), 'supported') in ('supported', 'deprecated')
    ) then
      return false;
    end if;
  end loop;

  current_snapshot := platform_private.cms_settings_snapshot(version_row.owner_id);
  return current_snapshot = p_manifest->'settings';
exception
  when raise_exception or invalid_text_representation then
    return false;
end;
$body$;

comment on function platform_private.cms_manifest_identities_current(jsonb) is
  'BE03b E1: every identity a frozen manifest names is current (active schema version with an equal artifact hash; active template/pattern with equal hashes; supported or deprecated blocks with equal digests; settings snapshot equal to the owner''s current). False, never an error, for a malformed manifest. VOLATILE (records the settings snapshot); private.';

create or replace function platform_private.cms_frozen_dependencies_status(
  p_revision_id uuid,
  p_frozen_manifest jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rebuilt jsonb;
begin
  if p_revision_id is null or p_frozen_manifest is null then
    return 'stale';
  end if;
  begin
    rebuilt := platform_private.cms_build_dependency_manifest(p_revision_id);
  exception
    when raise_exception then
      return 'stale';
  end;
  if rebuilt is distinct from p_frozen_manifest
     or not platform_private.cms_manifest_identities_current(p_frozen_manifest)
     or exists (
       select 1
         from platform_private.cms_entry_revisions revision
         cross join lateral pg_catalog.jsonb_array_elements_text(revision.taxonomy_version_ids) recorded(id)
        where revision.id = p_revision_id
          and not exists (
            select 1
              from platform_private.cms_taxonomy_versions taxonomy
             where taxonomy.id = recorded.id::uuid
               and taxonomy.state = 'active'
          )
     ) then
    return 'stale';
  end if;
  return 'current';
end;
$body$;

comment on function platform_private.cms_frozen_dependencies_status(uuid, jsonb) is
  'BE03b E1: current when the rebuilt manifest equals the frozen one bit-for-bit, every frozen identity is current and every recorded taxonomy version is active; otherwise stale (409 version_set_stale + review invalidated dependency_changed). Private; VOLATILE.';

create or replace function platform_private.cms_review_dependency_refs(
  p_revision_id uuid,
  p_manifest jsonb
)
returns table(kind text, ref_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  snapshot_id uuid;
begin
  perform platform_private.cms_version_set_of(p_manifest, '[]'::jsonb);
  select revision.* into revision_row
    from platform_private.cms_entry_revisions revision
   where revision.id = p_revision_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select snapshot.id into snapshot_id
    from platform_private.cms_publication_settings_snapshots snapshot
   where snapshot.owner_id = revision_row.owner_id
     and snapshot.snapshot_hash = p_manifest->'settings'->>'hash'
     and snapshot.ordinal::text = p_manifest->'settings'->>'version';
  if snapshot_id is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  return query
  select distinct refs.kind, refs.ref_id
    from (
      select 'schema'::text as kind, (p_manifest->'schema'->>'id')::uuid as ref_id
      union all
      select 'template', (p_manifest->'template'->>'id')::uuid
       where pg_catalog.jsonb_typeof(p_manifest->'template') = 'object'
      union all
      select 'block', (member.value->>'id')::uuid
        from pg_catalog.jsonb_array_elements(p_manifest->'blocks') member(value)
      union all
      select 'pattern', (member.value->>'id')::uuid
        from pg_catalog.jsonb_array_elements(p_manifest->'patterns') member(value)
      union all
      select 'term', (member.value->>'id')::uuid
        from pg_catalog.jsonb_array_elements(coalesce(p_manifest->'terms', '[]'::jsonb)) member(value)
      union all
      select 'taxonomy_version', recorded.id::uuid
        from pg_catalog.jsonb_array_elements_text(revision_row.taxonomy_version_ids) recorded(id)
      union all
      select 'locale_source', (member.value->>'revisionId')::uuid
        from pg_catalog.jsonb_array_elements(coalesce(p_manifest->'localeSources', '[]'::jsonb)) member(value)
      union all
      select 'relation_target', (member.value->>'targetId')::uuid
        from pg_catalog.jsonb_array_elements(coalesce(p_manifest->'relations', '[]'::jsonb)) member(value)
      union all
      select 'settings', snapshot_id
    ) refs;
end;
$body$;

comment on function platform_private.cms_review_dependency_refs(uuid, jsonb) is
  'BE03b "Review invalidation / Dependency recheck": the (kind, ref_id) ReviewDependency rows cms_submit_review writes from the frozen manifest (schema, template, block, pattern, term, taxonomy_version, locale_source, relation_target, settings = the snapshot row id), one row per identity. Private; STABLE.';

grant select on table
  platform_private.cms_block_definition_lifecycle_events,
  platform_private.cms_block_definition_versions,
  platform_private.cms_composition_instances,
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_content_types,
  platform_private.cms_entry_relations,
  platform_private.cms_entry_revisions,
  platform_private.cms_locale_variants,
  platform_private.cms_pattern_versions,
  platform_private.cms_preflight_registry,
  platform_private.cms_publication_settings_snapshots,
  platform_private.cms_schema_artifacts,
  platform_private.cms_taxonomy_versions,
  platform_private.cms_template_versions,
  platform_private.cms_term_assignments,
  platform_private.cms_terms
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_dependency_manifest_within_bounds(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_build_dependency_manifest(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_revision_version_set(uuid, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_manifest_version_text_valid(text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_manifest_policy_evidence_valid(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_manifest_hashed_entries_valid(jsonb, integer)
  owner to wejammin_cms_definer;
alter function platform_private.cms_dependency_manifest_valid(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_manifest_identities_current(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_frozen_dependencies_status(uuid, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_review_dependency_refs(uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_dependency_manifest_within_bounds(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_build_dependency_manifest(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_version_set(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_manifest_version_text_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_manifest_policy_evidence_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_manifest_hashed_entries_valid(jsonb, integer)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_dependency_manifest_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_manifest_identities_current(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_frozen_dependencies_status(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_review_dependency_refs(uuid, jsonb)
  from public, anon, authenticated, service_role;

commit;
