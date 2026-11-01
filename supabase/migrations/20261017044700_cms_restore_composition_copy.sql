-- DEC-201: private restore copy after the caller's early dependency/schema locks.
-- Captured arrays are compared with actual complete source rows and references;
-- they confer neither authority nor proof of held locks. No earlier locks here.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $absent$
begin
  if exists (
    select 1 from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'platform_private'
      and proc.proname = 'cms_restore_composition_copy'
  ) then
    raise exception 'restore composition copy already exists' using errcode = '55000';
  end if;
end;
$absent$;

create function platform_private.cms_restore_composition_copy(
  p_source_revision_id uuid,
  p_target_revision_id uuid,
  p_snapshot_time timestamptz,
  p_heads platform_private.cms_composition_instances[],
  p_pattern_ids uuid[],
  p_block_ids uuid[]
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $body$
declare
  source_revision platform_private.cms_entry_revisions;
  target_revision platform_private.cms_entry_revisions;
  source_entry platform_private.cms_content_entries;
  source_row platform_private.cms_composition_instances;
  copied_row platform_private.cms_composition_instances;
  selected_rows platform_private.cms_composition_instances[] :=
    '{}'::platform_private.cms_composition_instances[];
  copied_rows platform_private.cms_composition_instances[] :=
    '{}'::platform_private.cms_composition_instances[];
  selected_paths text[] := '{}'::text[];
  actual_pattern_ids uuid[] := '{}'::uuid[];
  actual_block_ids uuid[] := '{}'::uuid[];
  destination_ids uuid[] := '{}'::uuid[];
  parent_indexes integer[] := '{}'::integer[];
  scheduled boolean[] := '{}'::boolean[];
  insertion_order integer[] := '{}'::integer[];
  dependency record;
  parent_path text;
  parent_index integer;
  row_index integer;
  row_count integer := 0;
  made_progress boolean;
  current_digest text;
begin
  if p_source_revision_id is null or p_target_revision_id is null
     or p_source_revision_id = p_target_revision_id or p_snapshot_time is null
     or p_heads is null or p_pattern_ids is null or p_block_ids is null then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  select revision.* into source_revision
    from platform_private.cms_entry_revisions revision
   where revision.id = p_source_revision_id;
  if not found then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  select revision.* into target_revision
    from platform_private.cms_entry_revisions revision
   where revision.id = p_target_revision_id;
  if not found
     or target_revision.owner_id is distinct from source_revision.owner_id
     or target_revision.entry_id is distinct from source_revision.entry_id
     or target_revision.locale is distinct from source_revision.locale
     or target_revision.state <> 'draft'
     or exists (
       select 1 from platform_private.cms_composition_instances instance
        where instance.revision_id = target_revision.id
     ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  select entry.* into source_entry
    from platform_private.cms_content_entries entry
   where entry.id = source_revision.entry_id;
  if not found or source_entry.owner_id is distinct from source_revision.owner_id
     or source_entry.owner_party_id is distinct from source_revision.owner_id
     or source_entry.lifecycle <> 'active' then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Historical and active schema IDs may differ: restore translates between
  -- real versions of this same entry type, rather than copying schema identity.
  if not exists (
    select 1
      from platform_private.cms_content_type_versions source_version
      join platform_private.cms_content_type_versions target_version
        on target_version.content_type_id = source_version.content_type_id
      join platform_private.cms_content_types content_type
        on content_type.id = source_version.content_type_id
      join platform_private.cms_schema_artifacts artifact
        on artifact.id = target_version.schema_artifact_id
       and artifact.content_type_version_id = target_version.id
     where source_version.id = source_revision.schema_version_id
       and target_version.id = target_revision.schema_version_id
       and source_version.owner_id = source_revision.owner_id
       and target_version.owner_id = source_revision.owner_id
       and content_type.owner_id = source_revision.owner_id
       and content_type.id = source_entry.content_type_id
       and content_type.state = 'active'
       and target_version.state::text = 'active'
       and artifact.state::text = 'compiled'
       and artifact.artifact_hash = target_version.definition_hash
  ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Prove the exact retained source template even with no composition heads.
  -- Unused allowedBlocks are not copied dependencies and are not traversed.
  if target_revision.template_version_id is distinct from source_revision.template_version_id then
    raise exception 'template_incompatible' using errcode = 'P0001';
  end if;
  if source_revision.template_version_id is not null and not exists (
    select 1 from platform_private.cms_template_versions template
     where template.id = source_revision.template_version_id
       and template.owner_id = source_revision.owner_id
       and template.state not in ('retired', 'blocked')
       and exists (
         select 1
           from pg_catalog.jsonb_array_elements_text(template.compatible_type_ids) compatible(value)
          where compatible.value::uuid = source_entry.content_type_id
       )
  ) then
    raise exception 'template_incompatible' using errcode = 'P0001';
  end if;

  -- Independently derive the real newest-before-active selection. Comparing the
  -- typed arrays includes every source column, order, dimensions and NULL value.
  for source_row in
    select head.* from (
      select distinct on (instance.path collate "C") instance.*
        from platform_private.cms_composition_instances instance
       where instance.revision_id = source_revision.id
         and instance.owner_id = source_revision.owner_id
       order by instance.path collate "C", instance.version desc, instance.id desc
    ) head
    where head.state = 'active'
    order by head.position, head.path collate "C", head.id
  loop
    selected_rows := pg_catalog.array_append(selected_rows, source_row);
    selected_paths := pg_catalog.array_append(selected_paths, source_row.path);
    row_count := row_count + 1;
  end loop;
  if p_heads is distinct from selected_rows then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Extract activity-neutral actual refs again; do not trust captured lists,
  -- a supplied composite, a lineage ID, or a caller-supplied superset.
  foreach source_row in array selected_rows loop
    for dependency in
      select refs.kind, refs.ref_id
        from platform_private.cms_restore_composition_refs(source_row) refs
    loop
      if dependency.ref_id is null then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
      if dependency.kind = 'pattern' then
        actual_pattern_ids := pg_catalog.array_append(actual_pattern_ids, dependency.ref_id);
      elsif dependency.kind = 'block' then
        actual_block_ids := pg_catalog.array_append(actual_block_ids, dependency.ref_id);
      elsif dependency.kind is distinct from 'template'
         or dependency.ref_id is distinct from source_revision.template_version_id then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
    end loop;
  end loop;
  actual_pattern_ids := array(
    select distinct named.id from pg_catalog.unnest(actual_pattern_ids) named(id) order by named.id
  );
  actual_block_ids := array(
    select distinct named.id from pg_catalog.unnest(actual_block_ids) named(id) order by named.id
  );
  if p_pattern_ids is distinct from actual_pattern_ids
     or p_block_ids is distinct from actual_block_ids
     or exists (
       select 1 from pg_catalog.unnest(actual_pattern_ids) named(id)
       left join platform_private.cms_pattern_versions pattern
         on pattern.id = named.id and pattern.owner_id = source_revision.owner_id
       where pattern.id is null
     )
     or exists (
       select 1 from pg_catalog.unnest(actual_block_ids) named(id)
       left join platform_private.cms_block_definition_versions block
         on block.id = named.id and block.state = 'registered'
       where block.id is null
     ) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  if row_count = 0 then return; end if;

  -- Preallocate every identity before resolving historical parents by source
  -- path. An older parent ID must resolve to that path's selected active head.
  for row_index in 1..row_count loop
    destination_ids := pg_catalog.array_append(destination_ids, extensions.gen_random_uuid());
    parent_indexes := pg_catalog.array_append(parent_indexes, 0);
    scheduled := pg_catalog.array_append(scheduled, false);
  end loop;
  for row_index in 1..row_count loop
    source_row := selected_rows[row_index];
    if source_row.parent_instance_id is null then continue; end if;
    select parent.path into parent_path
      from platform_private.cms_composition_instances parent
     where parent.id = source_row.parent_instance_id
       and parent.owner_id = source_revision.owner_id
       and parent.revision_id = source_revision.id;
    if not found then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    parent_index := pg_catalog.array_position(selected_paths, parent_path);
    if parent_index is null or parent_index = row_index then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    parent_indexes[row_index] := parent_index;
  end loop;
  while pg_catalog.cardinality(insertion_order) < row_count loop
    made_progress := false;
    for row_index in 1..row_count loop
      if scheduled[row_index] then continue; end if;
      parent_index := parent_indexes[row_index];
      if parent_index = 0 or scheduled[parent_index] then
        insertion_order := pg_catalog.array_append(insertion_order, row_index);
        scheduled[row_index] := true;
        made_progress := true;
      end if;
    end loop;
    if not made_progress then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
  end loop;

  -- Resolve every current digest before the first INSERT. This read-only gate
  -- checks actual refs against the captured closure without new earlier locks.
  for row_index in 1..row_count loop
    source_row := selected_rows[row_index];
    current_digest := platform_private.cms_restore_composition_registry(
      source_row, source_entry.content_type_id, p_pattern_ids, p_block_ids
    );
    if current_digest is null or current_digest !~ '^[a-f0-9]{64}$' then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    copied_row := source_row;
    copied_row.id := destination_ids[row_index];
    copied_row.revision_id := target_revision.id;
    copied_row.version := 1;
    copied_row.created_at := p_snapshot_time;
    copied_row.updated_at := p_snapshot_time;
    copied_row.carried_from_id := source_row.id;
    copied_row.block_registry_digest := current_digest;
    parent_index := parent_indexes[row_index];
    copied_row.parent_instance_id := case when parent_index = 0 then null
      else destination_ids[parent_index] end;
    copied_rows := pg_catalog.array_append(copied_rows, copied_row);
  end loop;
  -- No exception blanket: injected/programming faults, including a second-copy
  -- P0001, propagate unchanged so the caller's transaction rolls back all effects.
  foreach row_index in array insertion_order loop
    copied_row := copied_rows[row_index];
    insert into platform_private.cms_composition_instances select (copied_row).*;
  end loop;
end;
$body$;

comment on function platform_private.cms_restore_composition_copy(
  uuid, uuid, timestamptz, platform_private.cms_composition_instances[], uuid[], uuid[]) is
  'DEC-201 private restore copy: exact actual active-head images and complete captured version-row dependency sets, source-bound template and translated active schema proof, preplanned fresh identities/current digests and historical-parent path remapping, parent-first typed immutable copies. No earlier locks, authority substitution, GUC mutation, producer validator, aggregate cap or per-copy effects.';

commit;
