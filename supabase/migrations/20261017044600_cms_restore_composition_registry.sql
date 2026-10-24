-- DEC-201: read-only restore repin after the planner's dependency position3.
-- The root-chain local is restore_root_chain so it cannot collide with reached.root_chain.
-- Captured IDs are a closure bound, never authorization or lock attestation.
-- Forward-only rollback: remove callers, then drop this exact helper RESTRICT
-- in a new migration. No existing function or application grant is changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $absent$
begin
  if exists (
    select 1 from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'platform_private'
      and proc.proname = 'cms_restore_composition_registry'
  ) then
    raise exception 'restore composition registry already exists' using errcode = '55000';
  end if;
end;
$absent$;

create function platform_private.cms_restore_composition_registry(
  p_row platform_private.cms_composition_instances,
  p_content_type_id uuid, p_pattern_ids uuid[], p_block_ids uuid[])
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare
  stored platform_private.cms_composition_instances;
  root_pattern platform_private.cms_pattern_versions;
  parent_pattern platform_private.cms_pattern_versions;
  child_pattern platform_private.cms_pattern_versions;
  actual_type_id uuid;
  source_template_id uuid;
  reference record;
  edge record;
  required_patterns uuid[] := '{}'::uuid[];
  template_seen boolean := false;
  slot_path text;
  restore_root_chain text;
  snapshot_root text;
  selected_root jsonb;
  digest_tree jsonb;
  current_digest text;
begin
  -- Match every typed member, not just a caller-supplied ID/owner/path tuple.
  select instance.* into stored
    from platform_private.cms_composition_instances instance
    where instance.id = p_row.id;
  if not found or pg_catalog.to_jsonb(stored) is distinct from pg_catalog.to_jsonb(p_row) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  select entry.content_type_id, revision.template_version_id
    into actual_type_id, source_template_id
    from platform_private.cms_entry_revisions revision
    join platform_private.cms_content_entries entry
      on entry.id = revision.entry_id and entry.owner_id = revision.owner_id
    where revision.id = stored.revision_id and revision.owner_id = stored.owner_id;
  if not found or p_content_type_id is null or p_content_type_id is distinct from actual_type_id then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Sorted, unique, nonnull one-dimensional version-ROW-ID arrays only.
  if p_pattern_ids is null or p_block_ids is null
     or p_pattern_ids is distinct from (
       select coalesce(pg_catalog.array_agg(distinct member order by member), '{}'::uuid[])
       from pg_catalog.unnest(p_pattern_ids) member where member is not null)
     or p_block_ids is distinct from (
       select coalesce(pg_catalog.array_agg(distinct member order by member), '{}'::uuid[])
       from pg_catalog.unnest(p_block_ids) member where member is not null) then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  -- Source-bound flat slot, never the current draft's possibly different template.
  if source_template_id is null then
    -- Placement's logical slotPath '/' is stored as slot_key 'root' (141102:80).
    if stored.slot_key is distinct from 'root' then
      raise exception 'template_incompatible' using errcode = 'P0001';
    end if;
    restore_root_chain := stored.path;
  else
    select '/' || (slot.value->>'key') into slot_path
      from platform_private.cms_template_versions template
      cross join lateral pg_catalog.jsonb_array_elements(template.slots) slot(value)
      where template.id = source_template_id and template.owner_id = stored.owner_id
        and slot.value->>'key' = stored.slot_key;
    if not found or not pg_catalog.starts_with(stored.path, slot_path || '/') then
      raise exception 'template_incompatible' using errcode = 'P0001';
    end if;
    restore_root_chain := pg_catalog.substr(stored.path, pg_catalog.char_length(slot_path) + 1);
  end if;

  -- The extractor proves actual complete B/own-node reachability, including
  -- missing/cyclic/truncated graph refusal. No activity policy is borrowed here.
  for reference in select * from platform_private.cms_restore_composition_refs(stored) loop
    if reference.ref_id is null then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    case reference.kind
      when 'pattern' then
        if not (reference.ref_id = any(p_pattern_ids)) then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
        required_patterns := pg_catalog.array_append(required_patterns, reference.ref_id);
      when 'block' then
        if not (reference.ref_id = any(p_block_ids)) then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
      when 'template' then
        if reference.ref_id is distinct from source_template_id then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
        template_seen := true;
      else
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end case;
  end loop;
  if (source_template_id is not null) is distinct from template_seen then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;

  if stored.detached_tree is not null then
    -- Canonical own content is provenance-blind. This is the persisted format
    -- predicate, not an authored forest/props validator or an aggregate read cap.
    if platform_private.cms_detached_tree_valid(stored.detached_tree) is not true then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    select '/' || pg_catalog.string_agg(segment.value, '/' order by segment.ordinal)
      into snapshot_root
      from pg_catalog.jsonb_array_elements_text(stored.detached_tree#>'{nodes,0,keySegments}')
        with ordinality segment(value, ordinal);
    if snapshot_root is distinct from restore_root_chain
       or stored.detached_tree#>>'{nodes,0,blockKey}' is distinct from stored.block_key
       or (stored.detached_tree#>>'{nodes,0,blockVersion}')::bigint is distinct from stored.block_version then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'blockKey', own.block_key, 'blockVersion', own.block_version, 'children', '[]'::jsonb)
        order by own.block_key collate "C", own.block_version)
      into digest_tree from (
        select distinct node.value->>'blockKey' as block_key,
          (node.value->>'blockVersion')::integer as block_version
        from pg_catalog.jsonb_array_elements(stored.detached_tree->'nodes') node(value)
      ) own;
  elsif stored.pattern_id is not null then
    select pattern.* into root_pattern from platform_private.cms_pattern_versions pattern
      where pattern.owner_id = stored.owner_id and pattern.pattern_id = stored.pattern_id
        and pattern.version = stored.pattern_version;
    if not found or not (root_pattern.id = any(required_patterns)) then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    -- Exact source root identity is separate from the WHOLE-B registry repin.
    select reached.node into selected_root
      from platform_private.cms_pattern_update_nodes(stored.owner_id, root_pattern.block_tree,
        array[root_pattern.pattern_id], false, '', null, 1) reached
      where reached.is_root and reached.root_chain = restore_root_chain;
    if not found or selected_root->>'blockKey' is distinct from stored.block_key
       or (selected_root->>'blockVersion')::bigint is distinct from stored.block_version then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    if stored.link_mode = 'linked' then
      -- Every pattern in the independently resolved closure is a parent whose
      -- immediate edges must retain the producer's case-insensitive containment.
      for parent_pattern in select pattern.* from platform_private.cms_pattern_versions pattern
        where pattern.id = any(required_patterns) loop
        if parent_pattern.owner_id is distinct from stored.owner_id or parent_pattern.state <> 'active'
           or pg_catalog.jsonb_typeof(parent_pattern.compatible_type_ids) is distinct from 'array' then
          raise exception 'migration_chain_incomplete' using errcode = 'P0001';
        end if;
        for edge in select * from platform_private.cms_pattern_refs(parent_pattern.block_tree) loop
          select pattern.* into child_pattern from platform_private.cms_pattern_versions pattern
            where pattern.owner_id = stored.owner_id and pattern.pattern_id = edge.ref_pattern_id
              and pattern.version = edge.ref_pattern_version;
          if not found or child_pattern.state <> 'active' or not (child_pattern.id = any(required_patterns))
             or pg_catalog.jsonb_typeof(child_pattern.compatible_type_ids) is distinct from 'array' then
            raise exception 'migration_chain_incomplete' using errcode = 'P0001';
          end if;
          if exists (
            select 1 from pg_catalog.jsonb_array_elements_text(parent_pattern.compatible_type_ids) wanted(value)
            where not exists (
              select 1 from pg_catalog.jsonb_array_elements_text(child_pattern.compatible_type_ids) offered(value)
              where pg_catalog.lower(offered.value) = pg_catalog.lower(wanted.value))) then
            raise exception 'migration_chain_incomplete' using errcode = 'P0001';
          end if;
        end loop;
      end loop;
      if not exists (
        select 1 from pg_catalog.jsonb_array_elements_text(root_pattern.compatible_type_ids) wanted(value)
        where pg_catalog.lower(wanted.value) = pg_catalog.lower(actual_type_id::text)) then
        raise exception 'migration_chain_incomplete' using errcode = 'P0001';
      end if;
    elsif stored.link_mode <> 'detached' then
      raise exception 'migration_chain_incomplete' using errcode = 'P0001';
    end if;
    -- Legacy detached NULL keeps its real pin but ignores origin activity/types.
    digest_tree := root_pattern.block_tree;
  else
    digest_tree := pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', stored.block_key, 'blockVersion', stored.block_version, 'children', '[]'::jsonb));
  end if;

  current_digest := platform_private.cms_pattern_registry_digest_readonly(stored.owner_id, digest_tree);
  if current_digest is null or platform_private.cms_pattern_blocks_compatible(
      stored.owner_id, digest_tree, pg_catalog.jsonb_build_array(actual_type_id)) is not true then
    raise exception 'migration_chain_incomplete' using errcode = 'P0001';
  end if;
  -- A changed prior digest is intentional: restore repins current allowed tuples.
  -- No catch-all: unexpected dependency/programming/injected faults propagate.
  return current_digest;
end;
$body$;

comment on function platform_private.cms_restore_composition_registry(
  platform_private.cms_composition_instances, uuid, uuid[], uuid[]) is
  'DEC-201 private read-only restore gate: persisted complete source image/actual entry type/source template slot, captured version-row closure containment, live-only recursive activity/type rules and current whole-B or own-node registry/compiler-range repin. No locks, writes, authored props revalidation, stale-digest refusal or authorization/lock attestation.';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_restore_composition_registry(
    platform_private.cms_composition_instances, uuid, uuid[], uuid[]) owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_restore_composition_registry(
  platform_private.cms_composition_instances, uuid, uuid[], uuid[])
  from public, anon, authenticated, service_role;

do $guard$
declare proc pg_catalog.pg_proc%rowtype; signature text; callee regprocedure;
begin
  select item.* into proc from pg_catalog.pg_proc item
    where item.oid = pg_catalog.to_regprocedure(
      'platform_private.cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])');
  if not found or proc.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole or proc.prosecdef
     or proc.prokind <> 'f' or proc.provolatile <> 's' or proc.proretset or proc.pronargs <> 4
     or proc.pronargdefaults <> 0 or proc.prorettype <> 'text'::pg_catalog.regtype
     or proc.proconfig is distinct from array['search_path=""']::text[]
     or proc.prolang <> (select language.oid from pg_catalog.pg_language language where language.lanname = 'plpgsql')
     or (select pg_catalog.count(*) from pg_catalog.pg_proc item
       where item.pronamespace = proc.pronamespace and item.proname = proc.proname) <> 1
     or exists (select 1 from pg_catalog.aclexplode(proc.proacl) acl where acl.grantee = 0)
     or pg_catalog.has_function_privilege('anon', proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', proc.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', proc.oid, 'EXECUTE') then
    raise exception 'restore composition registry attributes/ACL changed' using errcode = '55000';
  end if;
  foreach signature in array array[
    'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)',
    'platform_private.cms_detached_tree_valid(jsonb)',
    'platform_private.cms_pattern_update_nodes(uuid,jsonb,uuid[],boolean,text,text,integer)',
    'platform_private.cms_pattern_refs(jsonb)',
    'platform_private.cms_pattern_registry_digest_readonly(uuid,jsonb)',
    'platform_private.cms_pattern_blocks_compatible(uuid,jsonb,jsonb)'
  ] loop
    callee := pg_catalog.to_regprocedure(signature);
    if callee is null or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee, 'EXECUTE') then
      raise exception 'restore registry existing dependency unavailable: %', signature using errcode = '55000';
    end if;
  end loop;
  foreach signature in array array['platform_private.cms_composition_instances',
    'platform_private.cms_entry_revisions', 'platform_private.cms_content_entries',
    'platform_private.cms_template_versions', 'platform_private.cms_pattern_versions'] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', signature, 'SELECT') then
      raise exception 'restore registry existing source unavailable: %', signature using errcode = '55000';
    end if;
  end loop;
end;
$guard$;

commit;
