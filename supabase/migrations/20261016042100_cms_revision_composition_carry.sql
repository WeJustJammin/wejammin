-- BE03c1545 / DEC-198 / DEC-200: ordinary revision carry, not restore.
-- Plan the complete logical graph before writing; preserve raw snapshot values.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_revision_composition_carry(
  p_source_revision_id uuid,
  p_target_revision_id uuid,
  p_snapshot_time timestamptz
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
  source_row platform_private.cms_composition_instances;
  copied_row platform_private.cms_composition_instances;
  selected_rows platform_private.cms_composition_instances[] :=
    '{}'::platform_private.cms_composition_instances[];
  selected_paths text[] := '{}'::text[];
  destination_ids uuid[] := '{}'::uuid[];
  parent_indexes integer[] := '{}'::integer[];
  scheduled boolean[] := '{}'::boolean[];
  insertion_order integer[] := '{}'::integer[];
  parent_path text;
  parent_index integer;
  row_index integer;
  row_count integer := 0;
  made_progress boolean;
begin
  select revision.* into source_revision
    from platform_private.cms_entry_revisions revision
   where revision.id = p_source_revision_id;
  if not found then
    raise exception 'VALIDATION_FAILED'
      using errcode = 'P0001', detail = '["/baseRevision"]';
  end if;
  select revision.* into target_revision
    from platform_private.cms_entry_revisions revision
   where revision.id = p_target_revision_id;
  if not found or p_source_revision_id = p_target_revision_id
     or p_snapshot_time is null
     or target_revision.owner_id is distinct from source_revision.owner_id
     or target_revision.entry_id is distinct from source_revision.entry_id
     or target_revision.locale is distinct from source_revision.locale
     or exists (
       select 1 from platform_private.cms_composition_instances instance
        where instance.revision_id = p_target_revision_id
     ) then
    raise exception 'VALIDATION_FAILED'
      using errcode = 'P0001', detail = '["/baseRevision"]';
  end if;

  -- Eligibility follows newest-per-path selection. A retired newest row hides
  -- older active history; an unanswered pending head retains B and its target.
  for source_row in
    select head.* from (
      select distinct on (instance.path collate "C") instance.*
        from platform_private.cms_composition_instances instance
       where instance.revision_id = source_revision.id
         and instance.owner_id = source_revision.owner_id
       order by instance.path collate "C", instance.version desc, instance.id desc
    ) head
    where head.state in ('active', 'pending_diff')
    order by head.path collate "C"
  loop
    selected_rows := pg_catalog.array_append(selected_rows, source_row);
    selected_paths := pg_catalog.array_append(selected_paths, source_row.path);
    destination_ids := pg_catalog.array_append(destination_ids, extensions.gen_random_uuid());
    parent_indexes := pg_catalog.array_append(parent_indexes, 0);
    scheduled := pg_catalog.array_append(scheduled, false);
    row_count := row_count + 1;
  end loop;
  if row_count = 0 then return; end if;

  -- Resolve the recorded parent identity only inside the source owner/revision,
  -- then reconnect by its logical path to that path's newest eligible head.
  -- Historical P1 -> selected P2 is valid; an excluded parent is not resurrected.
  for row_index in 1..row_count loop
    source_row := selected_rows[row_index];
    if source_row.parent_instance_id is null then continue; end if;
    select parent.path into parent_path
      from platform_private.cms_composition_instances parent
     where parent.id = source_row.parent_instance_id
       and parent.owner_id = source_revision.owner_id
       and parent.revision_id = source_revision.id;
    if not found then
      raise exception 'VALIDATION_FAILED'
        using errcode = 'P0001', detail = '["/baseRevision"]';
    end if;
    parent_index := pg_catalog.array_position(selected_paths, parent_path);
    if parent_index is null then
      raise exception 'VALIDATION_FAILED'
        using errcode = 'P0001', detail = '["/baseRevision"]';
    end if;
    parent_indexes[row_index] := parent_index;
  end loop;

  -- Topological planning detects cycles introduced by collapsing historical IDs
  -- to selected paths. No INSERT occurs until the whole graph is representable.
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
      raise exception 'VALIDATION_FAILED'
        using errcode = 'P0001', detail = '["/baseRevision"]';
    end if;
  end loop;

  foreach row_index in array insertion_order loop
    source_row := selected_rows[row_index];
    copied_row := source_row;
    copied_row.id := destination_ids[row_index];
    copied_row.revision_id := target_revision.id;
    copied_row.version := 1;
    copied_row.created_at := p_snapshot_time;
    copied_row.updated_at := p_snapshot_time;
    copied_row.carried_from_id := source_row.id;
    parent_index := parent_indexes[row_index];
    copied_row.parent_instance_id := case when parent_index = 0 then null
      else destination_ids[parent_index] end;
    -- Composite assignment preserves every other semantic column, including
    -- created_by, pending state/pins, NULL legacy trees and large local trees.
    insert into platform_private.cms_composition_instances
      select (copied_row).*;
  end loop;
end;
$body$;

comment on function platform_private.cms_revision_composition_carry(uuid, uuid, timestamptz) is
  'Private ordinary append/resolve carry from the selected base revision: newest active/pending heads, fresh identity/version/times, immediate owner-bound provenance, complete semantic snapshot preservation and DEC-200 parent-path remap. Preplans and rejects excluded parents/collapsed cycles atomically; no registry lookup, repin, source mutation, restore policy or aggregate JSON cap.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_composition_carry(uuid, uuid, timestamptz)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_composition_carry(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- Existing CMS-owned RPC privileges suffice. Fail closed instead of adding
-- grants, bypassing RLS or establishing caller context inside this helper.
do $closure$
declare relation_name text;
begin
  foreach relation_name in array array['platform_private.cms_entry_revisions',
    'platform_private.cms_composition_instances'] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', relation_name, 'SELECT') then
      raise exception 'composition carry source privilege missing: %', relation_name
        using errcode = '55000';
    end if;
  end loop;
  if not pg_catalog.has_table_privilege('wejammin_cms_definer',
      'platform_private.cms_composition_instances', 'INSERT')
     or not pg_catalog.has_function_privilege('wejammin_cms_definer',
      'extensions.gen_random_uuid()', 'EXECUTE') then
    raise exception 'composition carry existing write closure missing' using errcode = '55000';
  end if;
end;
$closure$;

commit;
