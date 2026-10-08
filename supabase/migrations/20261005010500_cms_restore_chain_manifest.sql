-- Slice 10 WP-S10-3 (CMS-03B-04, decision D6): revision restore chain manifest.
--
-- Restoring a revision never edits or activates the source; it resolves a
-- private, immutable chain manifest composed from completed 03a migration-plan
-- edges, re-derives that chain identity and requires the request's
-- migrationChainId to equal it (409 migration_chain_mismatch), inserts the
-- manifest when absent (insert-if-absent then hash verify), then translates the
-- source content onto the current active schema and appends one new draft with
-- parentRevisionIds = [currentDraftRevisionId, sourceRevisionId].  The source
-- revision is never mutated.  Forward-only.
--
-- Translation applies each edge's registered transform with the Slice 09
-- database-side semantics (identity.revalidate / default.fill_literal through
-- cms_migration_expected_output), rebinds every value to the TARGET active
-- field definition, revalidates it through the protected value gate (the
-- rich_text.v1 AST, the DEC-133 object structure, the relation and list
-- encodings), re-resolves every relation against the target RelationDefinition,
-- and recomputes every value hash and the payload hash server-side.  A value
-- that cannot be proven refuses with migration_chain_incomplete; nothing is
-- fabricated.  The command reserves its idempotency key (CMS-03B-04) before the
-- entry-version CAS or any write, exactly as CMS-03B-01/02/10 do, so a lost
-- response replays the stored first outcome.

begin;

-- The manifest is a private immutable chain identity keyed by content type and
-- source/target schema versions, carrying the ordered bounded plan ids.  It is
-- written only by cms_restore_revision and is never updated or deleted.
create table platform_private.cms_restore_chain_manifests (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'active',
  version bigint not null default 1,
  content_type_id uuid not null
    references platform_private.cms_content_types(id),
  source_schema_version_id uuid not null
    references platform_private.cms_content_type_versions(id),
  target_schema_version_id uuid not null
    references platform_private.cms_content_type_versions(id),
  plan_ids jsonb not null,
  edge_count smallint not null,
  manifest_hash char(64) not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_restore_chain_manifests_state_check check (state = 'active'),
  constraint cms_restore_chain_manifests_version_check check (version = 1 and version > 0),
  constraint cms_restore_chain_manifests_plan_ids_check check (
    pg_catalog.jsonb_typeof(plan_ids) = 'array'
    and pg_catalog.jsonb_array_length(plan_ids) <= 64
  ),
  constraint cms_restore_chain_manifests_edge_count_check check (edge_count <= 64),
  constraint cms_restore_chain_manifests_edge_count_length_check check (
    edge_count >= 0 and edge_count = pg_catalog.jsonb_array_length(plan_ids)
  ),
  constraint cms_restore_chain_manifests_manifest_hash_check check (
    manifest_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_restore_chain_manifests_time_check check (updated_at = created_at),
  constraint cms_restore_chain_manifests_unique unique (manifest_hash)
);

create index cms_restore_chain_manifests_scope_idx
  on platform_private.cms_restore_chain_manifests (
    content_type_id, source_schema_version_id, target_schema_version_id
  );

-- The write guard admits the row only inside the restore command's RPC
-- context; the immutable guard then refuses every UPDATE and DELETE even
-- there, because the chain identity is hand-off evidence and no path may edit
-- or delete a manifest.
create trigger cms_restore_chain_manifests_write_guard
before insert on platform_private.cms_restore_chain_manifests
for each row execute function platform_private.cms_write_guard();

create trigger cms_restore_chain_manifests_immutable_guard
before update or delete on platform_private.cms_restore_chain_manifests
for each row execute function platform_private.cms_immutable_guard();

-- Private with forced RLS and no browser grant.
alter table platform_private.cms_restore_chain_manifests enable row level security;
alter table platform_private.cms_restore_chain_manifests force row level security;
revoke all on platform_private.cms_restore_chain_manifests
  from public, anon, authenticated, service_role;

-- A deterministic UUID derived from the JCS manifest hash, shaped to satisfy
-- the canonical UUID grammar.  This is the migrationChainId the restore command
-- re-derives and matches against the request.
create or replace function platform_private.cms_restore_chain_manifest_id(
  p_hash text
)
returns uuid
language plpgsql
immutable
strict
set search_path = ''
as $body$
declare
  canonical text;
begin
  if p_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  canonical := pg_catalog.substr(p_hash, 1, 8) || '-'
    || pg_catalog.substr(p_hash, 9, 4) || '-4'
    || pg_catalog.substr(p_hash, 13, 3) || '-8'
    || pg_catalog.substr(p_hash, 17, 3) || '-'
    || pg_catalog.substr(p_hash, 21, 12);
  return canonical::uuid;
end;
$body$;

-- Composes the ordered chain of completed 03a migration-plan edges from a
-- source schema version to the active target version.  Every edge is a
-- completed plan whose from_version chains consecutively to the next edge's
-- from_version.  Returns null when the path is ambiguous (a version with more
-- than one completed outgoing plan), does not reach the target, or exceeds 64
-- edges.  A same-schema restore is always the zero-edge case: the identity of
-- the empty manifest is deterministic for the (type, version, version) triple,
-- so a completed edge that merely ENDS at the active version (the migration
-- that produced it) never makes a revision already on that version ambiguous.
create or replace function platform_private.cms_restore_chain_derive(
  p_content_type_id uuid,
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  plan_ids jsonb := '[]'::jsonb;
  current_version uuid := p_source_version_id;
  next_plan_id uuid;
  next_version_id uuid;
  outgoing integer;
  final_to uuid;
  steps integer := 0;
  manifest_hash text;
begin
  if p_source_version_id = p_target_version_id then
    manifest_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'contentTypeId', p_content_type_id,
      'sourceSchemaVersionId', p_source_version_id,
      'targetSchemaVersionId', p_target_version_id,
      'planIds', plan_ids
    ));
    return pg_catalog.jsonb_build_object(
      'planIds', plan_ids, 'edgeCount', 0, 'hash', manifest_hash
    );
  end if;

  loop
    select count(*) into outgoing
    from platform_private.cms_schema_migration_plans plan
    where plan.content_type_id = p_content_type_id
      and plan.state = 'completed'
      and plan.from_version_id = current_version;
    if outgoing <> 1 then
      -- Zero outgoing edges means the path cannot reach the target; more than
      -- one means the recorded path is ambiguous.  Both are refused, never
      -- guessed.
      return null;
    end if;
    select plan.id, plan.to_version_id into next_plan_id, next_version_id
    from platform_private.cms_schema_migration_plans plan
    where plan.content_type_id = p_content_type_id
      and plan.state = 'completed'
      and plan.from_version_id = current_version;
    plan_ids := plan_ids || pg_catalog.to_jsonb(next_plan_id);
    current_version := next_version_id;
    steps := steps + 1;
    if steps > 64 then
      return null;
    end if;
    exit when current_version = p_target_version_id;
  end loop;

  -- The path must be terminal: the active version has no further completed
  -- edge, otherwise the resolved chain is not the whole path.
  select plan.to_version_id into final_to
  from platform_private.cms_schema_migration_plans plan
  where plan.content_type_id = p_content_type_id
    and plan.state = 'completed'
    and plan.from_version_id = p_target_version_id;
  if final_to is not null then
    return null;
  end if;

  manifest_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'contentTypeId', p_content_type_id,
    'sourceSchemaVersionId', p_source_version_id,
    'targetSchemaVersionId', p_target_version_id,
    'planIds', plan_ids
  ));
  return pg_catalog.jsonb_build_object(
    'planIds', plan_ids, 'edgeCount', steps, 'hash', manifest_hash
  );
end;
$body$;

comment on function platform_private.cms_restore_chain_derive(uuid, uuid, uuid) is
  'Composes the ordered completed 03a migration-plan chain from a source schema version to the active target version; returns null for an ambiguous, unreachable or over-64-edge path and the deterministic zero-edge result for a same-schema restore.';

-- The per-value revalidation seam of the restore command.  A source value is
-- typed against the TARGET schema version's field definition through the shared
-- pinned-schema value gate: the rich_text.v1 AST (the protected validator and
-- its NFC length bounds), the DEC-133 depth-1 object structure, the ordered
-- relation targets shape and the list/scalar/enum/calendar encodings.  A kind
-- with no value-level proof available yet (a media provider, a taxonomy term
-- registry) fails closed for any non-null value, a field the target schema no
-- longer declares active is refused, and a validator pair the protected
-- registry does not resolve is refused.  Null and missing values only satisfy
-- the provenance gate.  Pure and read-only.
create or replace function platform_private.cms_restore_source_side_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_row platform_private.cms_field_definition_versions%rowtype;
begin
  if p_schema_version_id is null or p_field_id is null or p_provenance is null then
    return false;
  end if;
  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.content_type_version_id = p_schema_version_id
    and field.stable_field_id = p_field_id
    and field.state = 'active';
  if not found then
    return false;
  end if;
  if field_row.validator_key is not null
     and not platform_private.cms_validator_registry_valid(
       field_row.validator_key, field_row.validator_version
     ) then
    return false;
  end if;
  if p_value is not null
     and pg_catalog.jsonb_typeof(p_value) <> 'null'
     and field_row.kind in ('media', 'taxonomy') then
    return false;
  end if;
  return coalesce(
    platform_private.cms_draft_field_value_valid(
      p_schema_version_id, p_field_id, p_value, p_provenance
    ),
    false
  );
end;
$body$;

comment on function platform_private.cms_restore_source_side_valid(uuid, uuid, jsonb, text) is
  'Restore per-value revalidation seam: one source value typed against the TARGET schema version field definition (rich_text.v1, DEC-133 object, relation, list and scalar encodings) through the shared draft value gate; media/taxonomy content fails closed until their providers exist. Read-only.';

-- The active target schema evidence the restore re-fetches (BE03b: the active
-- 03a ContentTypeVersion id/hash, non-null activation evidence, the compiled
-- SchemaArtifact id/hash/compiler and every protected validator pair).  True
-- only when every link is proven.
create or replace function platform_private.cms_restore_active_schema_evidence_valid(
  p_version_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  activation_evidence jsonb;
begin
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.id = p_version_id;
  if not found or version_row.state::text <> 'active' then
    return false;
  end if;
  activation_evidence :=
    platform_private.cms_type_version_resource(version_row.id)->'activationEvidence';
  if activation_evidence is null or activation_evidence = 'null'::jsonb then
    return false;
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = version_row.schema_artifact_id
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found
     or artifact_row.artifact_hash is distinct from version_row.definition_hash
     or artifact_row.compiler_version is null
     or artifact_row.zod_contract_ref is null then
    return false;
  end if;
  return not exists (
    select 1
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not platform_private.cms_validator_registry_valid(
        field.validator_key, field.validator_version
      )
  );
end;
$body$;

comment on function platform_private.cms_restore_active_schema_evidence_valid(uuid) is
  'Restore re-fetch of the active 03a schema evidence: active version, non-null activation evidence, compiled artifact bound to the definition hash and compiler, and every protected validator pair registered.';

-- The transformed value map of a source revision across a verified chain.
-- The map is keyed by the STABLE field id (never the field key, so a rename
-- cannot move a value across fields) and holds every stored value of the
-- source locale; a value the source never recorded (missing provenance) stays
-- absent and an explicit null stays a JSON null.  Each edge is applied with
-- the Slice 09 database-side executor contract (cms_migration_expected_output:
-- identity.revalidate carries and proves the changed target fields,
-- default.fill_literal writes only a declared literal default), over a
-- document keyed by that edge's TARGET field keys, so restore and the verified
-- backfill can never disagree about a transform.  A plan that is not completed,
-- does not chain consecutively from the revision's schema, names a transform
-- the digest-verified registry cannot resolve, targets a field kind the member
-- does not accept, or whose executor cannot prove the document returns NULL
-- (the command maps that to migration_chain_incomplete).  Values of fields a
-- later version retires are carried here unvalidated, exactly like the backfill,
-- and refused by the command when they hold content.
create or replace function platform_private.cms_restore_chain_values(
  p_revision_id uuid,
  p_plan_ids jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $body$
declare
  revision_row platform_private.cms_entry_revisions%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  member jsonb;
  spec jsonb;
  walk_version_id uuid;
  chain_values jsonb;
  edge_document jsonb;
  edge_output jsonb;
  expected_edges integer;
  applied_edges integer := 0;
begin
  if p_plan_ids is null or pg_catalog.jsonb_typeof(p_plan_ids) <> 'array' then
    return null;
  end if;
  select * into revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = p_revision_id;
  if not found then
    return null;
  end if;
  walk_version_id := revision_row.schema_version_id;
  expected_edges := pg_catalog.jsonb_array_length(p_plan_ids);
  select coalesce(
    pg_catalog.jsonb_object_agg(
      stored.field_id::text, coalesce(stored.value, 'null'::jsonb)
    ),
    '{}'::jsonb
  )
  into chain_values
  from platform_private.cms_entry_field_values stored
  where stored.revision_id = revision_row.id
    and stored.locale = revision_row.locale
    and stored.provenance <> 'missing';

  for plan_row in
    select plan.*
    from pg_catalog.jsonb_array_elements_text(p_plan_ids)
      with ordinality as item(plan_id, edge_position)
    join platform_private.cms_schema_migration_plans plan
      on plan.id = item.plan_id::uuid
    order by item.edge_position
  loop
    if plan_row.state <> 'completed'
       or plan_row.from_version_id is distinct from walk_version_id then
      return null;
    end if;
    if plan_row.transform_key is null then
      spec := null;
    else
      member := platform_private.cms_transform_registry_member(
        plan_row.transform_key, plan_row.transform_version
      );
      spec := platform_private.cms_migration_target_fields_spec(plan_row.id);
      if member is null or spec is null
         or not platform_private.cms_migration_spec_kinds_accepted(member, spec) then
        return null;
      end if;
    end if;
    select coalesce(
      pg_catalog.jsonb_object_agg(
        definition.field_key, chain_values -> definition.stable_field_id::text
      ),
      '{}'::jsonb
    )
    into edge_document
    from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = plan_row.to_version_id
      and definition.state = 'active'
      and chain_values ? definition.stable_field_id::text;
    edge_output := platform_private.cms_migration_expected_output(
      plan_row.transform_key, plan_row.to_version_id, spec, edge_document
    );
    if edge_output is null then
      return null;
    end if;
    select chain_values || coalesce(
      pg_catalog.jsonb_object_agg(
        definition.stable_field_id::text, edge_output -> definition.field_key
      ),
      '{}'::jsonb
    )
    into chain_values
    from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = plan_row.to_version_id
      and definition.state = 'active'
      and edge_output ? definition.field_key;
    walk_version_id := plan_row.to_version_id;
    applied_edges := applied_edges + 1;
  end loop;
  if applied_edges <> expected_edges then
    return null;
  end if;
  return chain_values;
end;
$body$;

comment on function platform_private.cms_restore_chain_values(uuid, jsonb) is
  'Transformed stable-field-id value map of a source revision across a verified restore chain, applying each edge with the Slice 09 registered-transform executor contract; NULL when any edge cannot be proven. Read-only.';

-- Rebinds the transformed value map of a source revision to the TARGET active
-- field definitions and revalidates every value through the source-side seam.
-- Content a field the target no longer declares active would carry has no
-- transform and no definition to rebind to, so it refuses (a retired field's
-- null carries nothing and is dropped).  A required field is satisfied only by a
-- carried value or its declared literal default; nothing else is invented, and
-- an optional absent field stays absent.  A relation field's targets live in the
-- relation rows, checked by cms_restore_relations_resolvable.  Returns
-- { values, provenance } keyed by stable field id, or NULL when any value or
-- required field cannot be proven.  Read-only.
create or replace function platform_private.cms_restore_translate_values(
  p_source_revision_id uuid,
  p_target_version_id uuid,
  p_chain_values jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $body$
declare
  source_row platform_private.cms_entry_revisions%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  field_value jsonb;
  field_provenance text;
  source_value jsonb;
  source_provenance text;
  final_values jsonb := '{}'::jsonb;
  final_provenance jsonb := '{}'::jsonb;
begin
  if p_chain_values is null or pg_catalog.jsonb_typeof(p_chain_values) <> 'object' then
    return null;
  end if;
  select * into source_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = p_source_revision_id;
  if not found then
    return null;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_each(p_chain_values) carried(field_key, field_value)
    where pg_catalog.jsonb_typeof(carried.field_value) <> 'null'
      and not exists (
        select 1
        from platform_private.cms_field_definition_versions definition
        where definition.content_type_version_id = p_target_version_id
          and definition.state = 'active'
          and definition.stable_field_id::text = carried.field_key
      )
  ) then
    return null;
  end if;
  for field_row in
    select definition.*
    from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = p_target_version_id
      and definition.state = 'active'
    order by definition.field_key
  loop
    field_value := p_chain_values -> field_row.stable_field_id::text;
    select stored.value, stored.provenance into source_value, source_provenance
    from platform_private.cms_entry_field_values stored
    where stored.revision_id = source_row.id
      and stored.locale = source_row.locale
      and stored.field_id = field_row.stable_field_id;
    if field_value is null or pg_catalog.jsonb_typeof(field_value) = 'null' then
      if field_row.kind = 'relation' and field_value is null then
        continue;
      elsif field_row.required then
        if field_row.default_mode = 'literal' and field_row.default_value is not null then
          field_value := field_row.default_value;
          field_provenance := 'default';
        else
          return null;
        end if;
      elsif field_value is null then
        continue;
      else
        field_provenance := 'explicit_null';
      end if;
    elsif source_value is not distinct from field_value then
      field_provenance := case
        when source_provenance in ('authored', 'default', 'inherited', 'localized_fallback')
          then source_provenance
        else 'authored' end;
    else
      -- The registered default.fill_literal transform produced this value.
      field_provenance := 'default';
    end if;
    if not platform_private.cms_restore_source_side_valid(
      p_target_version_id, field_row.stable_field_id, field_value, field_provenance
    ) then
      return null;
    end if;
    final_values := final_values
      || pg_catalog.jsonb_build_object(field_row.stable_field_id::text, field_value);
    final_provenance := final_provenance
      || pg_catalog.jsonb_build_object(field_row.stable_field_id::text, field_provenance);
  end loop;
  return pg_catalog.jsonb_build_object(
    'values', final_values, 'provenance', final_provenance
  );
end;
$body$;

comment on function platform_private.cms_restore_translate_values(uuid, uuid, jsonb) is
  'Rebinds the transformed value map of a source revision to the TARGET active field definitions and revalidates each value through cms_restore_source_side_valid; required fields take only a carried value or their declared literal default. Returns { values, provenance } by stable field id or NULL when anything cannot be proven. Read-only.';

-- Relations are re-resolved against the TARGET RelationDefinitions: every source
-- relation row must still belong to an active relation field under the same
-- content target kind and registered projection, its target must still resolve
-- (same owner and party, active, the declared target type, and its pinned
-- version unless it is the entry itself), and the per-field count must fit the
-- target bounds.  Nothing is dropped or guessed.  Read-only.
create or replace function platform_private.cms_restore_relations_resolvable(
  p_entry_id uuid,
  p_source_revision_id uuid,
  p_target_version_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  entry_row platform_private.cms_content_entries%rowtype;
begin
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = p_entry_id;
  if not found then
    return false;
  end if;
  if (
    select count(*)
    from platform_private.cms_entry_relations stored
    where stored.revision_id = p_source_revision_id
  ) > 512 then
    return false;
  end if;
  if exists (
    select 1
    from platform_private.cms_entry_relations stored
    where stored.revision_id = p_source_revision_id
      and not exists (
        select 1
        from platform_private.cms_field_definition_versions definition
        join platform_private.cms_relation_definitions relation_definition
          on relation_definition.field_definition_id = definition.id
        left join platform_private.cms_content_entries target
          on target.id = stored.target_id
        left join platform_private.cms_content_types target_type
          on target_type.id = target.content_type_id
        where definition.content_type_version_id = p_target_version_id
          and definition.stable_field_id = stored.field_id
          and definition.state = 'active'
          and definition.kind = 'relation'
          and definition.owner_id = entry_row.owner_id
          and relation_definition.owner_id = entry_row.owner_id
          and relation_definition.target_kind = 'content'
          and stored.target_kind = relation_definition.target_kind
          and platform_private.cms_projection_registry_valid(
            relation_definition.target_kind,
            relation_definition.target_type,
            relation_definition.projection_key
          )
          and target.id is not null
          and target.owner_id = entry_row.owner_id
          and target.owner_party_id is not distinct from entry_row.owner_party_id
          and target.lifecycle = 'active'
          and (
            target.id = entry_row.id
            or stored.expected_target_version is null
            or target.version = stored.expected_target_version
          )
          and target_type.owner_id = entry_row.owner_id
          and target_type.state::text = 'active'
          and target_type.type_key = relation_definition.target_type
      )
  ) then
    return false;
  end if;
  return not exists (
    select 1
    from platform_private.cms_field_definition_versions definition
    join platform_private.cms_relation_definitions relation_definition
      on relation_definition.field_definition_id = definition.id
    where definition.content_type_version_id = p_target_version_id
      and definition.state = 'active'
      and definition.kind = 'relation'
      and (
        select count(*)
        from platform_private.cms_entry_relations stored
        where stored.revision_id = p_source_revision_id
          and stored.field_id = definition.stable_field_id
      ) not between relation_definition.min_count and relation_definition.max_count
  );
end;
$body$;

comment on function platform_private.cms_restore_relations_resolvable(uuid, uuid, uuid) is
  'Restore relation re-resolution against the TARGET RelationDefinitions: active relation field, same content target kind and registered projection, every target resolving for the same owner/party/type and pinned version, and the per-field count within the target bounds. Read-only.';

-- The chain helpers are private: the restore command re-derives and verifies
-- the identity itself, so no caller may compute a manifest id, a chain hash or
-- a translated value map outside the verified command path.  The revokes run
-- after the function bodies are defined so the CREATE-time PUBLIC EXECUTE
-- default cannot survive.
revoke all on function platform_private.cms_restore_chain_manifest_id(text)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_chain_derive(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_source_side_valid(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_active_schema_evidence_valid(uuid)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_chain_values(uuid, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_translate_values(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function platform_private.cms_restore_relations_resolvable(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

-- The manifest id helper is called by the definer-owned restore command and by
-- the definer-owned comparison read, so the definer role alone keeps EXECUTE;
-- every other role stays without it.
grant execute on function platform_private.cms_restore_chain_manifest_id(text)
  to wejammin_cms_definer;

-- CMS-03B-04 revision restore.  Server-derives the actor and acting party,
-- requires a proven cms.author/cms.editor grant plus an active entry
-- assignment, reserves the idempotency key (CMS-03B-04) before the entry CAS,
-- re-derives the immutable chain identity and requires equality with the
-- request, records the manifest insert-if-absent then hash verify, translates
-- and revalidates every value onto the active schema, and appends one new draft
-- with the recorded parent chain.  It fabricates nothing.
create or replace function platform_private.cms_restore_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  author_person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  source_row platform_private.cms_entry_revisions%rowtype;
  current_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  manifest_row platform_private.cms_restore_chain_manifests%rowtype;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  active_version_count integer;
  requested_entry_id uuid;
  requested_revision_id uuid;
  requested_chain_id uuid;
  requested_entry_version bigint;
  derived jsonb;
  derived_hash text;
  derived_chain_id uuid;
  derived_plan_ids jsonb;
  derived_edge_count smallint;
  chain_version_ids jsonb;
  walk_version_id uuid;
  plan_id_text text;
  new_revision_id uuid := extensions.gen_random_uuid();
  snapshot_time timestamptz := pg_catalog.now();
  source_values jsonb;
  chain_values jsonb;
  translated jsonb;
  final_values jsonb;
  final_provenance jsonb;
  parent_ids jsonb;
  payload_hash text;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Request shape: exactly the five contract members (the four BE03b request
  -- members plus the mandatory Idempotency-Key the Worker projects into the
  -- body), plus the transport-only ifMatch/context/correlationId.  Any other
  -- key (an ownership, acting-party or capability assertion) has no slot and is
  -- refused before any read.  A request without a key is refused here, so no
  -- write can ever happen without a reservation.
  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'entryId', 'revisionId', 'migrationChainId', 'expectedVersion',
      'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'revisionId', 'migrationChainId', 'expectedVersion',
      'idempotencyKey', 'ifMatch', 'context', 'correlationId'
    ]::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true
     or platform_private.cms_valid_uuid(p_request->>'migrationChainId') is not true
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- The If-Match transport copy, when presented, must equal the CAS version.
  if p_request ? 'ifMatch'
     and (platform_private.cms_valid_version(p_request->>'ifMatch') is not true
          or p_request->>'ifMatch' <> p_request->>'expectedVersion') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_revision_id := (p_request->>'revisionId')::uuid;
  requested_chain_id := (p_request->>'migrationChainId')::uuid;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- Establish tenant visibility, then edit authority, before probing the
  -- source revision or reserving a key: a hidden entry is concealed and a
  -- visible entry without edit authority is refused, whatever the revision.
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = requested_entry_id
  for update;
  if not found
     or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], entry_row.id
  );
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- Source read and lineage disposition: the source revision must belong to
  -- this entry and owner, and its recorded schema version must be a version of
  -- the entry's own content type under the same owner.  An absent, foreign or
  -- mis-lineaged source is concealed as NOT_FOUND before any key is reserved,
  -- so a probe never creates an idempotency row.
  select * into source_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = requested_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.owner_id = entry_row.owner_id
  for share;
  if not found or not exists (
    select 1
    from platform_private.cms_content_type_versions source_version
    join platform_private.cms_content_types content_type
      on content_type.id = source_version.content_type_id
    where source_version.id = source_row.schema_version_id
      and source_version.content_type_id = entry_row.content_type_id
      and source_version.owner_id = entry_row.owner_id
      and content_type.owner_id = entry_row.owner_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Reserve before any effect, and before the entry-version CAS: a replay must
  -- return the exact first outcome even though the entry has since advanced.
  -- The business hash covers the request body, so the same key with another
  -- migrationChainId, source revision or expected version is the typed
  -- IDEMPOTENCY_MISMATCH, never a second restore (AC025).
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-04');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- A restore is a mutation of the entry, so the entry-version CAS is enforced
  -- before the chain is resolved: a stale expectedVersion is a 409 serialization
  -- failure, never a silent write or an incidental chain refusal.
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = '40001';
  end if;

  select * into current_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.locale = source_row.locale
  for share;
  if not found or current_row.state <> 'draft' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- The source is immutable history: refuse to launder a corrupt snapshot into
  -- a fresh draft with freshly computed hashes.  The payload hash is derived
  -- from the stored values, so it is verified here; per-value hashes are never
  -- trusted from the source and are recomputed below.
  select coalesce(
    pg_catalog.jsonb_object_agg(stored.field_id::text, stored.value), '{}'::jsonb
  )
  into source_values
  from platform_private.cms_entry_field_values stored
  where stored.revision_id = source_row.id
    and stored.locale = source_row.locale;
  if platform_private.cms_jcs_sha256(source_values) <> source_row.payload_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- A restore needs exactly one active schema version to translate onto, and
  -- the active 03a evidence must still be proven (re-fetched, never assumed).
  select count(*) into active_version_count
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if active_version_count <> 1 then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if not platform_private.cms_restore_active_schema_evidence_valid(version_row.id) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Re-derive the immutable chain from the completed plan edges.  An
  -- ambiguous, unreachable or over-64-edge path is refused, never guessed or
  -- truncated.
  derived := platform_private.cms_restore_chain_derive(
    entry_row.content_type_id, source_row.schema_version_id, version_row.id
  );
  if derived is null then
    raise exception 'migration_chain_unavailable' using errcode = 'P0001';
  end if;
  derived_hash := derived->>'hash';
  derived_plan_ids := derived->'planIds';
  derived_edge_count := (derived->>'edgeCount')::smallint;
  derived_chain_id := platform_private.cms_restore_chain_manifest_id(derived_hash);
  if derived_edge_count > 64
     or derived_chain_id is distinct from requested_chain_id then
    raise exception 'migration_chain_mismatch' using errcode = 'P0001';
  end if;

  -- Bind every edge: each is a completed plan of this entry's content type and
  -- owner (a foreign edge conceals the chain), chains consecutively from the
  -- source schema, and is bound to the activation of its target version.  The
  -- ordered version ids become the verification evidence.
  chain_version_ids := pg_catalog.jsonb_build_array(source_row.schema_version_id);
  walk_version_id := source_row.schema_version_id;
  for plan_id_text in
    select item.plan_id
    from pg_catalog.jsonb_array_elements_text(derived_plan_ids)
      with ordinality as item(plan_id, edge_position)
    order by item.edge_position
  loop
    select * into plan_row
    from platform_private.cms_schema_migration_plans candidate
    where candidate.id = plan_id_text::uuid;
    if not found
       or plan_row.content_type_id is distinct from entry_row.content_type_id
       or plan_row.owner_id is distinct from entry_row.owner_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if plan_row.state <> 'completed'
       or plan_row.from_version_id is distinct from walk_version_id
       or not exists (
         select 1
         from platform_private.cms_content_type_versions activated
         where activated.id = plan_row.to_version_id
           and activated.content_type_id = entry_row.content_type_id
           and activated.activation_approval_evidence_hash is not null
       ) then
      raise exception 'migration_chain_unavailable' using errcode = 'P0001';
    end if;
    walk_version_id := plan_row.to_version_id;
    chain_version_ids := chain_version_ids || pg_catalog.to_jsonb(walk_version_id);
  end loop;
  if walk_version_id is distinct from version_row.id then
    raise exception 'migration_chain_unavailable' using errcode = 'P0001';
  end if;

  -- Record the manifest insert-if-absent, then verify the stored identity
  -- matches the re-derived chain exactly and still hashes to its own content.
  -- Trusted evidence must never be a second, divergent manifest for the same
  -- hash.
  insert into platform_private.cms_restore_chain_manifests(
    owner_id, content_type_id, source_schema_version_id, target_schema_version_id,
    plan_ids, edge_count, manifest_hash, created_at, updated_at
  ) values (
    entry_row.owner_id, entry_row.content_type_id, source_row.schema_version_id,
    version_row.id, derived_plan_ids, derived_edge_count, derived_hash::char(64),
    snapshot_time, snapshot_time
  )
  on conflict (manifest_hash) do nothing;
  select * into manifest_row
  from platform_private.cms_restore_chain_manifests manifest
  where manifest.manifest_hash = derived_hash::char(64);
  if not found
     or manifest_row.plan_ids is distinct from derived_plan_ids
     or manifest_row.edge_count is distinct from derived_edge_count
     or manifest_row.content_type_id is distinct from entry_row.content_type_id
     or manifest_row.source_schema_version_id is distinct from source_row.schema_version_id
     or manifest_row.target_schema_version_id is distinct from version_row.id
     or manifest_row.owner_id is distinct from entry_row.owner_id
     or platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
          'contentTypeId', manifest_row.content_type_id,
          'sourceSchemaVersionId', manifest_row.source_schema_version_id,
          'targetSchemaVersionId', manifest_row.target_schema_version_id,
          'planIds', manifest_row.plan_ids
        )) <> manifest_row.manifest_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- Template resolution: the source revision's template binding is re-resolved
  -- through the same private BE03c compatibility gate the successor flow uses
  -- against the active schema version.  An absent, withdrawn or incompatible
  -- template refuses the restore.
  if source_row.template_version_id is not null then
    begin
      perform platform_private.cms_successor_template_gate(
        actor_id, acting_party_id, source_row.template_version_id,
        entry_row.content_type_id, version_row.id,
        pg_catalog.jsonb_build_array('templateVersionId')
      );
    exception
      when raise_exception then
        raise exception 'template_incompatible' using errcode = 'P0001';
    end;
  end if;
  -- Every pinned taxonomy version must still resolve for the owner.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(source_row.taxonomy_version_ids) pinned(taxonomy_id)
    where platform_private.cms_valid_uuid(pinned.taxonomy_id) is not true
       or not exists (
         select 1
         from platform_private.cms_taxonomy_versions taxonomy
         where taxonomy.id = pinned.taxonomy_id::uuid
           and taxonomy.owner_id = entry_row.owner_id
       )
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Translate the source values across the verified chain with the registered
  -- transforms.  An edge the executor cannot prove, an unregistered transform
  -- or a chain that does not apply end to end is an incomplete chain.
  chain_values := platform_private.cms_restore_chain_values(
    source_row.id, derived_plan_ids
  );
  if chain_values is null then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  -- Rebind every value to the TARGET active field definition and revalidate it
  -- through the protected value gate; a value or relation the target schema
  -- cannot prove refuses the whole restore and nothing is dropped or invented.
  translated := platform_private.cms_restore_translate_values(
    source_row.id, version_row.id, chain_values
  );
  if translated is null
     or not platform_private.cms_restore_relations_resolvable(
       entry_row.id, source_row.id, version_row.id
     ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  final_values := translated->'values';
  final_provenance := translated->'provenance';

  -- Every hash is recomputed server-side from the translated preimage: the
  -- per-value hash from each value and the payload hash from the whole map.
  payload_hash := platform_private.cms_jcs_sha256(final_values);
  parent_ids := pg_catalog.jsonb_build_array(current_row.id, source_row.id);

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    current_row.revision_number + 1, version_row.id,
    source_row.template_version_id, source_row.taxonomy_version_ids,
    parent_ids, source_row.locale, payload_hash::char(64),
    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id,
         definition.stable_field_id, definition.id, source_row.locale,
         translated.field_value, final_provenance ->> translated.field_key,
         case when pg_catalog.jsonb_typeof(translated.field_value) = 'null' then null
           else platform_private.cms_jcs_sha256(translated.field_value)::char(64) end,
         snapshot_time, snapshot_time
  from pg_catalog.jsonb_each(final_values) translated(field_key, field_value)
  join platform_private.cms_field_definition_versions definition
    on definition.content_type_version_id = version_row.id
   and definition.stable_field_id::text = translated.field_key
   and definition.state = 'active';
  insert into platform_private.cms_entry_relations(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    target_kind, target_id, expected_target_version, position, on_unavailable,
    created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, stored.field_id,
         definition.id, stored.target_kind, stored.target_id,
         case
           when stored.target_kind = 'content' and stored.target_id = entry_row.id
             then requested_entry_version + 1
           else stored.expected_target_version
         end,
         stored.position, relation_definition.on_unavailable,
         snapshot_time, snapshot_time
  from platform_private.cms_entry_relations stored
  join platform_private.cms_field_definition_versions definition
    on definition.content_type_version_id = version_row.id
   and definition.stable_field_id = stored.field_id
   and definition.state = 'active'
  join platform_private.cms_relation_definitions relation_definition
    on relation_definition.field_definition_id = definition.id
  where stored.revision_id = source_row.id;

  -- The source revision is immutable: restore never mutates or activates it.

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = '40001';
  end if;

  -- Audit and outbox carry identifiers only (entry, revision, correlation);
  -- the chain identity lives in the immutable manifest and the verification
  -- evidence, and no migrated value ever reaches either.
  perform platform_private.cms_emit_event(
    'cms.entry.revision.restore', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_REVISION_CREATED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'revisionId', new_revision_id),
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'resource', pg_catalog.jsonb_build_object(
      'id', new_revision_id, 'version', '1',
      'createdAt', platform_private.auth_iso_time(snapshot_time),
      'updatedAt', platform_private.auth_iso_time(snapshot_time),
      'state', 'draft', 'entryId', entry_row.id,
      'revisionNumber', (current_row.revision_number + 1)::text,
      'schemaVersionId', version_row.id,
      'templateVersionId', source_row.template_version_id,
      'taxonomyVersionIds', source_row.taxonomy_version_ids,
      'locale', source_row.locale, 'contentHash', payload_hash,
      'parentRevisionIds', parent_ids, 'validationState', 'valid',
      'conflictId', null
    ),
    'restoreVerification', pg_catalog.jsonb_build_object(
      'request', pg_catalog.jsonb_build_object(
        'entryId', requested_entry_id,
        'revisionId', requested_revision_id,
        'migrationChainId', derived_chain_id,
        'expectedVersion', requested_entry_version::text
      ),
      'registry', pg_catalog.jsonb_build_object(
        'revisionId', source_row.id,
        'migrationChainId', derived_chain_id,
        'sourceSchemaVersionId', source_row.schema_version_id,
        'activeSchemaVersionId', version_row.id,
        'chainSchemaVersionIds', chain_version_ids,
        'entryVersion', requested_entry_version::text
      ),
      'seams', pg_catalog.jsonb_build_array(
        'source_revision_readable_and_immutable',
        'migration_chain_registered_and_ordered',
        'migration_chain_covers_source_to_active_schema',
        'active_schema_compatibility_recheck',
        'non_fabricating_defaults_and_relations_translation',
        'entry_version_cas',
        'new_draft_revision_only_never_activates_source',
        'restore_idempotency_and_epoch_fencing'
      )
    )
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_restore_revision(jsonb) is
  'CMS-03B-04 revision restore. Server-derives actor/acting party, requires a proven cms.author/cms.editor grant plus an active assignment, conceals an unreadable or mis-lineaged source (NOT_FOUND), reserves the CMS-03B-04 idempotency key before the entry CAS (a replay returns the stored first envelope; the same key with another body is IDEMPOTENCY_MISMATCH), CAS-guards the entry version (40001 on stale), re-derives the immutable migration chain and requires the request migrationChainId to equal it (P0001 migration_chain_mismatch), refuses an ambiguous/unreachable/over-64 chain (migration_chain_unavailable), an unregistered or unprovable transform, a value the target schema cannot revalidate and an unresolvable relation (migration_chain_incomplete) and an incompatible template (template_incompatible), records the manifest insert-if-absent then hash verify, recomputes every value and payload hash, and appends one new draft with parentRevisionIds [currentDraftRevisionId, sourceRevisionId] without mutating the source. Returns { resource, restoreVerification }.';

-- The browser-facing named RPC stays service-role only; the wrapper restores
-- the transaction-local RPC-context flag to its prior value.
create or replace function platform_api.cms_restore_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_restore_revision(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

revoke all on function platform_api.cms_restore_revision(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_restore_revision(jsonb) to service_role;

revoke all on function platform_private.cms_restore_revision(jsonb)
  from public, anon, authenticated, service_role;

-- SEC-2: the restore command and its helpers name forced-RLS CMS records, so
-- they are owned by the non-BYPASSRLS definer role (RLS and the context gate
-- then apply to every statement they run).  ALTER FUNCTION ... OWNER TO
-- requires the new owner to hold CREATE on the function's schema, and the
-- owning function must itself hold the table privileges its body uses.  The
-- schema CREATE is granted for the length of this transaction and revoked again
-- after the ownership moves, exactly as 20261003120500_cms_definer_function_ownership
-- establishes for every other definer-owned command.  The manifest is only
-- inserted and read, so the definer receives exactly those two verbs.
grant create on schema platform_private to wejammin_cms_definer;
grant insert, select on table platform_private.cms_restore_chain_manifests
  to wejammin_cms_definer;

alter function platform_private.cms_restore_revision(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_chain_derive(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_source_side_valid(uuid, uuid, jsonb, text)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_active_schema_evidence_valid(uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_chain_values(uuid, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_translate_values(uuid, uuid, jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_restore_relations_resolvable(uuid, uuid, uuid)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

-- The manifest admits a row only inside a verified CMS RPC context; the
-- immutable guard already rejects UPDATE and DELETE even then.
create policy cms_restore_chain_manifests_rpc_policy
  on platform_private.cms_restore_chain_manifests
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

commit;
