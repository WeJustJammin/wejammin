-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound).
-- cms_block_rules_violation (DEC-210) found the parent of every chain-addressed node by scanning all nodes (n x n
-- starts_with probes) and found each node's first disallowed child by scanning all links again, so a 512-node plan cost
-- 43 ms of the placement.  The new body resolves parents with one hash join over the proper chain prefixes of each node
-- and the disallowed children with one grouped join.  Same result for every input (asserted by
-- phase_02_slice_12_placement_perf_equivalence against a verbatim copy of the installed body), same signature,
-- immutability, owner, search_path, ACL and comment.  The installed source must equal the promoted source byte for byte,
-- else the migration aborts.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  identity constant text := 'platform_private.cms_block_rules_violation(jsonb,jsonb)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source constant text := $old$
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
$old$;
  new_source constant text := $new$
  with recursive nodes as (
    select (item.ordinal - 1)::integer as idx, item.node as node,
           item.node->>'chain' as chain, item.node->>'blockKey' as block_key,
           item.node->>'blockVersion' as block_version
      from pg_catalog.jsonb_array_elements(
             case when pg_catalog.jsonb_typeof(p_nodes) = 'array' then p_nodes else '[]'::jsonb end
           ) with ordinality item(node, ordinal)
  ), ancestors as (
    -- every proper chain prefix of a chain-addressed node, cut at each `/`: candidate.chain || '/' is a prefix of child.chain
    select child.idx as child_idx, ancestor_pos.p as pos, pg_catalog.left(child.chain, ancestor_pos.p - 1) as ancestor_chain
      from nodes child
      cross join lateral pg_catalog.generate_series(1, pg_catalog.char_length(child.chain)) ancestor_pos(p)
     where not (child.node ? 'parent') and pg_catalog.substr(child.chain, ancestor_pos.p, 1) = '/'
  ), picked as (
    -- the longest such prefix naming another node (ties: lowest index), found with one hash join instead of a scan per node
    select distinct on (ancestors.child_idx) ancestors.child_idx, candidate.idx as parent_idx
      from ancestors
      join nodes candidate on candidate.chain = ancestors.ancestor_chain and candidate.idx <> ancestors.child_idx
     order by ancestors.child_idx, ancestors.pos desc, candidate.idx
  ), linked as (
    select child.idx, child.block_key,
           case when child.node ? 'parent'
                then case when pg_catalog.jsonb_typeof(child.node->'parent') = 'number'
                          then (child.node->>'parent')::numeric::integer end
                else picked.parent_idx
           end as parent_idx
      from nodes child
      left join picked on picked.child_idx = child.idx
  ), reach(ancestor, descendant, depth) as (
    select linked.idx, linked.idx, 1 from linked
    union all
    select reach.ancestor, child.idx, reach.depth + 1
      from reach join linked child on child.parent_idx = reach.descendant
     where reach.depth < 64
  ), totals as (
    select reach.ancestor as idx, pg_catalog.count(*) as node_count, pg_catalog.max(reach.depth) as depth
      from reach group by reach.ancestor
  ), bad as (
    -- the first child (lowest index) of each ruled parent whose block key the parent does not list
    select child.parent_idx as idx, pg_catalog.min(child.idx) as bad_child
      from linked child
      join nodes parent on parent.idx = child.parent_idx
     where (p_rules->(parent.block_key || ':' || parent.block_version)) is not null
       and coalesce(((p_rules->(parent.block_key || ':' || parent.block_version))->'children') ? child.block_key, false) is not true
     group by child.parent_idx
  ), judged as (
    select nodes.idx, bad.bad_child,
           coalesce(totals.node_count > case when rule.value#>>'{limits,maxNodes}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxNodes}')::integer end, false) as nodes_over,
           coalesce(totals.depth > case when rule.value#>>'{limits,maxDepth}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxDepth}')::integer end, false) as depth_over
      from nodes
      cross join lateral (select p_rules->(nodes.block_key || ':' || nodes.block_version) as value) rule
      join totals on totals.idx = nodes.idx
      left join bad on bad.idx = nodes.idx
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
$new$;
  definition text;
  comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'placement-perf: missing existing function %', identity using errcode = '55000';
  end if;
  if original.prosrc is distinct from old_source then
    raise exception 'placement-perf: unexpected installed source of %', identity using errcode = '55000';
  end if;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef or original.prokind <> 'f' or original.provolatile <> 'i'
     or original.proretset or original.prorettype <> 'jsonb'::pg_catalog.regtype
     or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql') then
    raise exception 'placement-perf: unexpected baseline attributes of %', identity using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'placement-perf: ambiguous definition of %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'placement-perf: replacement changed more than the source of %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
