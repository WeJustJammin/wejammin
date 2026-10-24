-- Slice 12 lane pattern-updates (BE03c Pattern versions and linked updates 1367, 1365; DEC-181, DEC-186; tracker P2-S12-AC-112,
-- AC-113, AC-119): the expansion of a pattern version into the block nodes a linked update compares.
--
--   platform_private.cms_pattern_update_nodes(owner, forest, visited, strict) returns, in forest order, every BLOCK node of the
--   forest with its key chain, exactly as the placement expander cms_pattern_placement_nodes does (a top-level nested pattern
--   reference is replaced in place by the nested pinned forest, recursively, and its key leads the chain of every root it expands
--   to; a reference below a block root stays inside that root; reference nodes are never returned), with ONE difference:
--     strict = true   every nested pinned version must be `active` (nested_pattern_not_active, 422), as at placement;
--     strict = false  a nested pinned version need only EXIST in the owner scope.  The base of a diff is the version an instance
--                     was placed on; its nested versions were active when it was placed and may have been superseded since
--                     (activating a nested pattern never touches the patterns that pin it), so the base must still resolve.
--   A lineage that recurs on the chain is pattern_cycle (409) and a nesting deeper than 128 levels is pattern_depth_exceeded
--   (422, a runaway guard that stored versions never reach), in both modes.
-- Private; STABLE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_update_nodes(
  p_owner_id uuid, p_forest jsonb, p_visited uuid[], p_strict boolean, p_prefix text default '', p_root_chain text default null,
  p_depth integer default 1)
returns table(node_chain text, root_chain text, is_root boolean, node jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  item record;
  nested platform_private.cms_pattern_versions%rowtype;
  chain text;
  under_root text;
begin
  if p_depth > 128 and pg_catalog.jsonb_array_length(p_forest) > 0 then
    raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  for item in
    select element.value as value
      from pg_catalog.jsonb_array_elements(p_forest) with ordinality element(value, ordinality)
     order by element.ordinality
  loop
    chain := p_prefix || '/' || (item.value->>'key');
    if item.value->>'kind' = 'block' then
      under_root := coalesce(p_root_chain, chain);
      node_chain := chain;
      root_chain := under_root;
      is_root := p_root_chain is null;
      node := item.value;
      return next;
      return query select * from platform_private.cms_pattern_update_nodes(
        p_owner_id, item.value->'children', p_visited, p_strict, chain, under_root, p_depth + 1);
    else
      select * into nested
        from platform_private.cms_pattern_versions candidate
       where candidate.owner_id = p_owner_id
         and candidate.pattern_id = (item.value->>'patternId')::uuid
         and candidate.version = (item.value->>'patternVersion')::integer;
      if not found or (p_strict and nested.state <> 'active') then
        raise exception 'nested_pattern_not_active' using errcode = 'P0001', detail = '["/patternId"]';
      end if;
      if nested.pattern_id = any(p_visited) then
        raise exception 'pattern_cycle' using errcode = 'P0001', detail = '["/patternId"]';
      end if;
      return query select * from platform_private.cms_pattern_update_nodes(
        p_owner_id, nested.block_tree, p_visited || nested.pattern_id, p_strict, chain, p_root_chain, p_depth + 1);
    end if;
  end loop;
end;
$body$;

comment on function platform_private.cms_pattern_update_nodes(uuid, jsonb, uuid[], boolean, text, text, integer) is
  'CMS-03C-14/15 (DEC-181, DEC-186): every block node of a pattern version forest in forest order with its key chain and the chain of the block root it lies under, nested references expanded in place; strict requires nested versions active (the target), non-strict only existing (the pinned base of an instance). Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_nodes(uuid, jsonb, uuid[], boolean, text, text, integer) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_update_nodes(uuid, jsonb, uuid[], boolean, text, text, integer)
  from public, anon, authenticated, service_role;
grant select on table platform_private.cms_pattern_versions to wejammin_cms_definer;

commit;
