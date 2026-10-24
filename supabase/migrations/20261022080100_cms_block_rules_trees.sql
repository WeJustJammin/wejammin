-- Slice 12 lane block-rules (DEC-210, BE03c "Block composition rules (DEC-210)"): the tree adapters of the shared
-- block composition rule check (20261022080000) and the enforcers the write paths call.
--
--   cms_pattern_forest_pointer(forest, chain, base)   the RFC 6901 request-body pointer of the literal node a key chain
--                                                     reaches (`/blockTree/{i}/children/{j}`...); a chain that enters a
--                                                     nested pattern reference stops at the reference node, because the
--                                                     expanded nodes below it are not in the request body
--   cms_pattern_block_rules_forest(owner, forest, visited)
--                                                     NULL, or {chain, reason}: the offending node's key chain (the first
--                                                     disallowed CHILD for reason `children`, the rule-bearing node for
--                                                     `nodes`/`depth`) over the forest with every nested pattern reference
--                                                     expanded in place (DEC-181), nested versions read as pinned
--   cms_pattern_block_rules_enforce_save(owner, forest, visited)
--                                                     CMS-03C-12: raises `block_rules_violated` (P0001) with DETAIL
--                                                     [request pointer of the offending node]
--   cms_pattern_block_rules_enforce_plan(plan, pointer)
--                                                     CMS-03C-02: the same over the placement plan (the block nodes of
--                                                     the selected roots), DETAIL [pointer]
--   cms_pattern_forest_rules_violated(owner, forest, lineage)
--                                                     boolean for the publication provider (live pin)
--   cms_detached_tree_block_rules(tree, rules)        NULL or the violation of a canonical detached tree (the writer
--                                                     passes the rules map it already loaded; NULL loads the registry)
-- Private; owned by the CMS definer role; never executable by a request role.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_forest_pointer(p_forest jsonb, p_chain text, p_base text)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
declare
  v_segment text;
  v_level jsonb := p_forest;
  v_node jsonb;
  v_index integer;
  v_pointer text := p_base;
  v_first boolean := true;
begin
  foreach v_segment in array pg_catalog.string_to_array(pg_catalog.ltrim(p_chain, '/'), '/') loop
    select (element.ordinal - 1)::integer into v_index
      from pg_catalog.jsonb_array_elements(v_level) with ordinality element(value, ordinal)
     where element.value->>'key' = v_segment
     order by element.ordinal limit 1;
    if v_index is null then
      return v_pointer;
    end if;
    v_pointer := v_pointer || case when v_first then '' else '/children' end || '/' || v_index::text;
    v_first := false;
    v_node := v_level->v_index;
    if v_node->>'kind' is distinct from 'block' then
      return v_pointer;
    end if;
    v_level := v_node->'children';
    v_index := null;
  end loop;
  return v_pointer;
end;
$body$;

comment on function platform_private.cms_pattern_forest_pointer(jsonb, text, text) is
  'DEC-210: request-body JSON pointer of the literal node a key chain reaches in a PatternNode forest; a chain entering a nested pattern reference stops at the reference node. Private.';

create or replace function platform_private.cms_pattern_block_rules_forest(
  p_owner_id uuid, p_forest jsonb, p_visited uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_nodes jsonb;
  v_violation jsonb;
  v_target integer;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'chain', expanded.node_chain, 'blockKey', expanded.node->>'blockKey',
           'blockVersion', (expanded.node->>'blockVersion')::integer) order by expanded.ordinal), '[]'::jsonb)
    into v_nodes
    from platform_private.cms_pattern_update_nodes(p_owner_id, p_forest, p_visited, false)
      with ordinality expanded(node_chain, root_chain, is_root, node, ordinal);
  v_violation := platform_private.cms_block_rules_violation(v_nodes, platform_private.cms_block_rules_registry(v_nodes));
  if v_violation is null then
    return null;
  end if;
  v_target := case when v_violation->>'reason' = 'children'
    then (v_violation->>'child')::integer else (v_violation->>'index')::integer end;
  return pg_catalog.jsonb_build_object('chain', v_nodes->v_target->>'chain', 'reason', v_violation->>'reason');
end;
$body$;

comment on function platform_private.cms_pattern_block_rules_forest(uuid, jsonb, uuid[]) is
  'DEC-210: the first block composition rule violation (chain of the offending node, reason) of a PatternNode forest with nested pattern references expanded in place, or NULL. Private.';

create or replace function platform_private.cms_pattern_block_rules_enforce_save(
  p_owner_id uuid, p_forest jsonb, p_visited uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_violation jsonb;
begin
  v_violation := platform_private.cms_pattern_block_rules_forest(p_owner_id, p_forest, p_visited);
  if v_violation is not null then
    raise exception 'block_rules_violated' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array(
        platform_private.cms_pattern_forest_pointer(p_forest, v_violation->>'chain', '/blockTree'))::text;
  end if;
end;
$body$;

comment on function platform_private.cms_pattern_block_rules_enforce_save(uuid, jsonb, uuid[]) is
  'CMS-03C-12 (DEC-210): refuses a pattern save whose expanded block forest breaks a pinned block version''s allowedChildren or slotRules: block_rules_violated at the offending node''s /blockTree pointer. Private.';

create or replace function platform_private.cms_pattern_block_rules_enforce_plan(p_plan jsonb, p_pointer text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_nodes jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'chain', item.value->>'chain', 'blockKey', item.value->'node'->>'blockKey',
           'blockVersion', (item.value->'node'->>'blockVersion')::integer) order by item.ordinal), '[]'::jsonb)
    into v_nodes
    from pg_catalog.jsonb_array_elements(p_plan) with ordinality item(value, ordinal);
  if platform_private.cms_block_rules_violation(v_nodes, platform_private.cms_block_rules_registry(v_nodes)) is not null then
    raise exception 'block_rules_violated' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_array(p_pointer)::text;
  end if;
end;
$body$;

comment on function platform_private.cms_pattern_block_rules_enforce_plan(jsonb, text) is
  'CMS-03C-02 (DEC-210): refuses a placement whose written block nodes break a pinned block version''s allowedChildren or slotRules: block_rules_violated at /roots (roots named) or /patternVersion. Private.';

create or replace function platform_private.cms_pattern_forest_rules_violated(
  p_owner_id uuid, p_forest jsonb, p_lineage uuid)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_pattern_block_rules_forest(
           p_owner_id, p_forest, case when p_lineage is null then '{}'::uuid[] else array[p_lineage] end) is not null
$body$;

comment on function platform_private.cms_pattern_forest_rules_violated(uuid, jsonb, uuid) is
  'DEC-210 publication provider helper: true when the expanded block forest of a stored pattern version breaks a pinned block version''s rules. Private.';

create or replace function platform_private.cms_detached_tree_block_rules(p_tree jsonb, p_rules jsonb default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_nodes jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'parent', item.value->'node'->'parent', 'chain', item.value->>'chain',
           'blockKey', item.value->'node'->>'blockKey',
           'blockVersion', (item.value->'node'->>'blockVersion')::integer) order by item.ordinal), '[]'::jsonb)
    into v_nodes
    from pg_catalog.jsonb_array_elements(platform_private.cms_pattern_snapshot_expanded(p_tree))
      with ordinality item(value, ordinal);
  return platform_private.cms_block_rules_violation(
    v_nodes, coalesce(p_rules, platform_private.cms_block_rules_registry(v_nodes)));
end;
$body$;

comment on function platform_private.cms_detached_tree_block_rules(jsonb, jsonb) is
  'DEC-210: the first block composition rule violation of a canonical detached tree (explicit parents), against the supplied rules map or the registry, or NULL. Private.';

do $owner$
declare
  had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
  item text;
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  foreach item in array array[
    'platform_private.cms_pattern_forest_pointer(jsonb, text, text)',
    'platform_private.cms_pattern_block_rules_forest(uuid, jsonb, uuid[])',
    'platform_private.cms_pattern_block_rules_enforce_save(uuid, jsonb, uuid[])',
    'platform_private.cms_pattern_block_rules_enforce_plan(jsonb, text)',
    'platform_private.cms_pattern_forest_rules_violated(uuid, jsonb, uuid)',
    'platform_private.cms_detached_tree_block_rules(jsonb, jsonb)'] loop
    execute pg_catalog.format('alter function %s owner to wejammin_cms_definer', item);
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated, service_role', item);
  end loop;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;

commit;
