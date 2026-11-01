-- DEC-199: one live pattern pin's closed publication reason.
-- Provenance is checked only for SQL-NULL live placements; canonical detached
-- trees are handled by the active-digest provider without reopening this graph.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_pattern_live_pin_reason(
  p_owner_id uuid, p_pattern_id uuid, p_pattern_version integer,
  p_expected_content_hash text
)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare root_row platform_private.cms_pattern_versions%rowtype;
  current_digest text;
begin
  select pattern.* into root_row
    from platform_private.cms_pattern_versions pattern
   where pattern.owner_id = p_owner_id
     and pattern.pattern_id = p_pattern_id
     and pattern.version = p_pattern_version;
  if not found or root_row.state <> 'active' then
    return 'pattern_not_active';
  end if;

  if exists (
    select 1
      from platform_private.cms_governed_pattern_closure(p_owner_id, root_row.block_tree) closure
     where closure.item_kind = 'pattern'
       and (closure.nested_id is null or closure.nested_state <> 'active')
  ) then
    return 'nested_pattern_not_active';
  end if;

  -- The producer's existing rule is immediate parent-to-child type containment.
  -- Reapply it at every recursive edge, using case-insensitive UUID text equality.
  if exists (
    with recursive graph(tree, types, depth) as (
      select root_row.block_tree, root_row.compatible_type_ids, 0
      union all
      select child.block_tree, child.compatible_type_ids, graph.depth + 1
        from graph
        cross join lateral platform_private.cms_pattern_refs(graph.tree) ref
        join platform_private.cms_pattern_versions child
          on child.owner_id = p_owner_id
         and child.pattern_id = ref.ref_pattern_id
         and child.version = ref.ref_pattern_version
       where graph.depth < 9
    )
    select 1
      from graph parent
      cross join lateral platform_private.cms_pattern_refs(parent.tree) ref
      join platform_private.cms_pattern_versions child
        on child.owner_id = p_owner_id
       and child.pattern_id = ref.ref_pattern_id
       and child.version = ref.ref_pattern_version
     where exists (
       select 1
         from pg_catalog.jsonb_array_elements_text(parent.types) required_type(value)
        where not exists (
          select 1
            from pg_catalog.jsonb_array_elements_text(child.compatible_type_ids) listed(value)
           where pg_catalog.lower(listed.value) = pg_catalog.lower(required_type.value)
        )
     )
  ) then
    return 'nested_pattern_not_active';
  end if;

  current_digest := platform_private.cms_pattern_registry_digest_readonly(
    p_owner_id, root_row.block_tree);
  if root_row.content_hash::text is distinct from p_expected_content_hash
     or current_digest is distinct from pg_catalog.btrim(root_row.block_registry_digest::text) then
    return 'pattern_digest_changed';
  end if;
  return null;
end;
$body$;

comment on function platform_private.cms_pattern_live_pin_reason(uuid, uuid, integer, text) is
  'DEC-199 live pin gate: root activity, recursive nested activity and existing immediate parent type containment precede root content-hash and reachable registry-digest checks. Returns only pattern_not_active, nested_pattern_not_active, pattern_digest_changed, or NULL. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_live_pin_reason(uuid, uuid, integer, text)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_live_pin_reason(uuid, uuid, integer, text)
  from public, anon, authenticated, service_role;

do $guard$
declare item pg_catalog.pg_proc%rowtype;
begin
  select proc.* into item from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(
     'platform_private.cms_pattern_live_pin_reason(uuid,uuid,integer,text)');
  if not found or item.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or item.prosecdef or item.prokind <> 'f' or item.provolatile <> 's'
     or item.proretset or item.prorettype <> 'text'::pg_catalog.regtype
     or item.proconfig is distinct from array['search_path=""']::text[]
     or item.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'plpgsql') then
    raise exception 'cms_pattern_live_pin_reason attributes changed' using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', item.oid, 'EXECUTE') then
    raise exception 'cms_pattern_live_pin_reason is not private' using errcode = '55000';
  end if;
end;
$guard$;

commit;
