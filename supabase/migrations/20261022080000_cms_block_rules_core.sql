-- Slice 12 lane block-rules (owner decision DEC-210; BE03c "Block composition rules (DEC-210)" in "Pattern versions and
-- linked updates"; review R1-001): the shared evaluation of a registered block version's `allowedChildren` and `slotRules`
-- over an expanded block forest, used by every operation that writes or publishes a tree.
--
--   cms_block_rules_violation(nodes, rules)  PURE.  nodes: ordered jsonb array of {blockKey, blockVersion} plus either an
--                                            explicit `parent` (0-based index, JSON null for a root) or a slash-joined key
--                                            `chain` whose longest proper prefix naming another node is its parent (nested
--                                            pattern references are never nodes, so a node below a reference hangs off the
--                                            nearest enclosing block).  rules: {"<key>:<version>": {children: [key...],
--                                            limits: {maxNodes, maxDepth}}}.  Returns NULL, or the FIRST offending node by
--                                            index as {index, reason, child}: reason `children` (a child whose blockKey is not
--                                            listed; an empty list admits no child; `child` is the first such child index),
--                                            `nodes` (the subtree rooted at the node, counting the node, exceeds maxNodes) or
--                                            `depth` (more than maxDepth levels, the node itself being level 1).  A node whose
--                                            version has no rule row is skipped (an unregistered block is refused by the
--                                            registry validators that run before this check); a limit that the rule row does
--                                            not declare as an integer is no declared bound and is not enforced (a registered
--                                            row always declares both, BE03a BlockSlotRules; only raw fixtures omit them).
--   cms_block_rules_registry(nodes)          the rules map of the distinct registered (blockKey, blockVersion) pairs of nodes,
--                                            read from the immutable registry rows (no lock: the callers hold the registry
--                                            FOR SHARE locks of the existing lock order).
-- Both private; owned by the CMS definer role; never executable by a request role.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_block_rules_violation(p_nodes jsonb, p_rules jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  with recursive nodes as (
    select (item.ordinal - 1)::integer as idx, item.node as node,
           item.node->>'chain' as chain, item.node->>'blockKey' as block_key,
           item.node->>'blockVersion' as block_version
      from pg_catalog.jsonb_array_elements(
             case when pg_catalog.jsonb_typeof(p_nodes) = 'array' then p_nodes else '[]'::jsonb end
           ) with ordinality item(node, ordinal)
  ), linked as (
    select child.idx, child.block_key,
           case when child.node ? 'parent'
                then case when pg_catalog.jsonb_typeof(child.node->'parent') = 'number'
                          then (child.node->>'parent')::numeric::integer end
                else (select candidate.idx from nodes candidate
                       where candidate.idx <> child.idx
                         and pg_catalog.starts_with(child.chain, candidate.chain || '/')
                       order by pg_catalog.char_length(candidate.chain) desc, candidate.idx limit 1)
           end as parent_idx
      from nodes child
  ), reach(ancestor, descendant, depth) as (
    select linked.idx, linked.idx, 1 from linked
    union all
    select reach.ancestor, child.idx, reach.depth + 1
      from reach join linked child on child.parent_idx = reach.descendant
     where reach.depth < 64
  ), totals as (
    select reach.ancestor as idx, pg_catalog.count(*) as node_count, pg_catalog.max(reach.depth) as depth
      from reach group by reach.ancestor
  ), judged as (
    select nodes.idx,
           (select pg_catalog.min(child.idx) from linked child
             where child.parent_idx = nodes.idx
               and coalesce((rule.value->'children') ? child.block_key, false) is not true) as bad_child,
           coalesce(totals.node_count > case when rule.value#>>'{limits,maxNodes}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxNodes}')::integer end, false) as nodes_over,
           coalesce(totals.depth > case when rule.value#>>'{limits,maxDepth}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxDepth}')::integer end, false) as depth_over
      from nodes
      cross join lateral (select p_rules->(nodes.block_key || ':' || nodes.block_version) as value) rule
      join totals on totals.idx = nodes.idx
     where rule.value is not null
  )
  select pg_catalog.jsonb_build_object('index', judged.idx,
           'reason', case when judged.bad_child is not null then 'children'
                          when judged.nodes_over then 'nodes' else 'depth' end,
           'child', judged.bad_child)
    from judged
   where judged.bad_child is not null or judged.nodes_over or judged.depth_over
   order by judged.idx
   limit 1
$body$;

comment on function platform_private.cms_block_rules_violation(jsonb, jsonb) is
  'DEC-210 pure block composition rule check: first offending node of an expanded block forest (index, reason children|nodes|depth, first disallowed child) against a pinned-version rules map, or NULL. Private.';

create or replace function platform_private.cms_block_rules_registry(p_nodes jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $body$
  select coalesce(pg_catalog.jsonb_object_agg(
           registered.block_key || ':' || registered.block_version,
           pg_catalog.jsonb_build_object('children', registered.allowed_children, 'limits', registered.slot_rules)),
         '{}'::jsonb)
    from (
      select distinct item.node->>'blockKey' as block_key, (item.node->>'blockVersion')::integer as block_version
        from pg_catalog.jsonb_array_elements(
               case when pg_catalog.jsonb_typeof(p_nodes) = 'array' then p_nodes else '[]'::jsonb end) item(node)
    ) wanted
    join platform_private.cms_block_definition_versions registered
      on registered.block_key = wanted.block_key and registered.block_version = wanted.block_version
     and registered.state = 'registered'
$body$;

comment on function platform_private.cms_block_rules_registry(jsonb) is
  'DEC-210: the {"key:version": {children, limits}} rules map of the registered block versions a node list names; immutable registry rows, no lock (callers hold the registry FOR SHARE locks). Private.';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_block_rules_violation(jsonb, jsonb) owner to wejammin_cms_definer;
  alter function platform_private.cms_block_rules_registry(jsonb) owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_block_rules_violation(jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_block_rules_registry(jsonb)
  from public, anon, authenticated, service_role;

commit;
