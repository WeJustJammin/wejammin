-- Slice 12 lane web-impl (DEC-228; BE03c field matrix CMS-03C-12 `blockTree` row, 1525; FE03 885; tracker P2-S12-AC-105): the
-- offending-node helpers of the CMS-03C-12 refusals.  A cycle, depth or node-count refusal names the offending node of the
-- REQUEST `blockTree` as the RFC 6901 pointer `/blockTree/{i}(/children/{j})*`, like the operation's other `blockTree`
-- refusals (20261022080100 `cms_pattern_forest_pointer` for DEC-210).
--
--   cms_pattern_node_pointer(path)               the pointer of a node from its child indices (the empty path is /blockTree)
--   cms_pattern_depth_offender(tree)             depth: the first request node in preorder at level 9
--   cms_pattern_chain_offender(owner, tree)      depth through nested patterns: the first request `pattern` node in preorder
--                                                whose own nested chain reaches nine levels (the producer's closure bound)
--   cms_pattern_count_offender(owner, tree)      node count: the request node whose expansion first takes the running
--                                                expanded total (a block counts 1, a nested pattern its node_count) past 512
--   cms_pattern_cycle_offender(owner, tree, id)  cycle: the first request `pattern` node in preorder whose nested closure
--                                                reaches the lineage being defined
-- Preorder is the lexicographic order of the integer[] child-index path.  A path that cannot be found answers the root
-- pointer (/blockTree), the pointer these refusals carried before DEC-228.  Private; SECURITY DEFINER with an empty
-- search_path, owned by the CMS definer role, executable by nobody else.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_node_pointer(p_path integer[])
returns text
language sql
immutable
set search_path = ''
as $body$
  select '/blockTree' || coalesce((
    select pg_catalog.string_agg(
             case when item.ord = 1 then '/' else '/children/' end || item.value::text, '' order by item.ord)
      from pg_catalog.unnest(p_path) with ordinality item(value, ord)), '')
$body$;

comment on function platform_private.cms_pattern_node_pointer(integer[]) is
  'DEC-228: the request-body JSON pointer /blockTree/{i}(/children/{j})* of the node at a child-index path; the empty path is /blockTree. Private.';

create or replace function platform_private.cms_pattern_depth_offender(p_tree jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_pattern_node_pointer(coalesce((
    select scanned.node_path
      from platform_private.cms_pattern_forest_nodes(p_tree) scanned
     where scanned.node_level = 9
     order by scanned.node_path
     limit 1), array[]::integer[]))
$body$;

comment on function platform_private.cms_pattern_depth_offender(jsonb) is
  'DEC-228: the pointer of the first request node in preorder at level 9 of a forest deeper than eight levels. Private.';

create or replace function platform_private.cms_pattern_chain_offender(p_owner_id uuid, p_tree jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_pattern_node_pointer(coalesce((
    select scanned.node_path
      from platform_private.cms_pattern_forest_nodes(p_tree) scanned
     where scanned.node->>'kind' = 'pattern'
       and exists (
         select 1
           from platform_private.cms_pattern_nested_closure(p_owner_id, pg_catalog.jsonb_build_array(scanned.node)) closure
          where closure.nested_depth >= 9)
     order by scanned.node_path
     limit 1), array[]::integer[]))
$body$;

comment on function platform_private.cms_pattern_chain_offender(uuid, jsonb) is
  'DEC-228: the pointer of the first request pattern node in preorder whose own nested chain reaches nine levels (the nested closure bound of CMS-03C-12). Private.';

create or replace function platform_private.cms_pattern_count_offender(p_owner_id uuid, p_tree jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_pattern_node_pointer(coalesce((
    select running.node_path
      from (
        select scanned.node_path,
               pg_catalog.sum(case when scanned.node->>'kind' = 'pattern'
                                   then coalesce(pinned.node_count, 1) else 1 end)
                 over (order by scanned.node_path) as total
          from platform_private.cms_pattern_forest_nodes(p_tree) scanned
          left join platform_private.cms_pattern_versions pinned
            on scanned.node->>'kind' = 'pattern'
           and pinned.owner_id = p_owner_id
           and pinned.pattern_id = (scanned.node->>'patternId')::uuid
           and pinned.version = (scanned.node->>'patternVersion')::integer
      ) running
     where running.total > 512
     order by running.node_path
     limit 1), array[]::integer[]))
$body$;

comment on function platform_private.cms_pattern_count_offender(uuid, jsonb) is
  'DEC-228: the pointer of the request node whose expansion first takes the expanded node total (a block 1, a nested pattern its stored node_count) past 512, in preorder. Private.';

create or replace function platform_private.cms_pattern_cycle_offender(p_owner_id uuid, p_tree jsonb, p_lineage_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select platform_private.cms_pattern_node_pointer(coalesce((
    select scanned.node_path
      from platform_private.cms_pattern_forest_nodes(p_tree) scanned
     where scanned.node->>'kind' = 'pattern'
       and exists (
         select 1
           from platform_private.cms_pattern_nested_closure(p_owner_id, pg_catalog.jsonb_build_array(scanned.node)) closure
          where closure.nested_pattern_id = p_lineage_id)
     order by scanned.node_path
     limit 1), array[]::integer[]))
$body$;

comment on function platform_private.cms_pattern_cycle_offender(uuid, jsonb, uuid) is
  'DEC-228: the pointer of the first request pattern node in preorder whose nested closure reaches the lineage being defined, the node whose lineage closes the cycle. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_node_pointer(integer[]) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_depth_offender(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_chain_offender(uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_count_offender(uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_cycle_offender(uuid, jsonb, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_pattern_node_pointer(integer[]),
  platform_private.cms_pattern_depth_offender(jsonb),
  platform_private.cms_pattern_chain_offender(uuid, jsonb),
  platform_private.cms_pattern_count_offender(uuid, jsonb),
  platform_private.cms_pattern_cycle_offender(uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

commit;
