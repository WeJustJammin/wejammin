-- DEC-193 / BE03c 1487: store-free typed delta for CMS-03C-14 only.
-- Inputs are ordered expanded blocks {chain, root, isRoot, node}, at most 512
-- per forest, supplied by the private GET planner. No legacy writer-plan change.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_pattern_diff_delta(
  p_base_nodes jsonb, p_target_nodes jsonb, p_root_chain text, p_overrides jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $body$
  with raw_nodes as (
    select 'base'::text as side, item.ordinality as ord,
      item.value->>'chain' as chain, item.value->>'root' as root_chain,
      (item.value->>'isRoot')::boolean as is_root, item.value->'node' as node
      from pg_catalog.jsonb_array_elements(p_base_nodes) with ordinality item(value, ordinality)
    union all
    select 'target'::text, item.ordinality, item.value->>'chain', item.value->>'root',
      (item.value->>'isRoot')::boolean, item.value->'node'
      from pg_catalog.jsonb_array_elements(p_target_nodes) with ordinality item(value, ordinality)
  ), parented as (
    select child.*, (
      select parent.chain from raw_nodes parent
       where parent.side = child.side and parent.root_chain = child.root_chain
         and pg_catalog.starts_with(child.chain, parent.chain || '/')
       order by pg_catalog.char_length(parent.chain) desc limit 1
    ) as parent_chain
    from raw_nodes child
  ), node_values as (
    select source.side, source.ord, source.chain, source.root_chain, source.is_root,
      pg_catalog.jsonb_build_object(
        'blockKey', source.node->'blockKey', 'blockVersion', source.node->'blockVersion',
        'props', source.node->'props', 'children', coalesce((
          select pg_catalog.jsonb_agg(child.chain order by child.ord)
            from parented child
           where child.side = source.side and child.root_chain = source.root_chain
             and child.parent_chain = source.chain), '[]'::jsonb)) as node_value
    from parented source
  ), paired as (
    select coalesce(base.chain, target.chain) as path,
      base.node_value as base_value, target.node_value as target_value
      from (select * from node_values where side = 'base' and root_chain = p_root_chain) base
      full join (select * from node_values where side = 'target' and root_chain = p_root_chain) target
        on target.chain = base.chain
     where base.node_value is distinct from target.node_value
  ), emitted as (
    select changed.*, case
      when changed.path = p_root_chain and changed.target_value is null then 'removed_root'
      when changed.base_value->'blockKey' is distinct from changed.target_value->'blockKey'
        or changed.base_value->'blockVersion' is distinct from changed.target_value->'blockVersion'
        or changed.base_value->'children' is distinct from changed.target_value->'children' then 'structure'
      when p_overrides ? changed.path
        and p_overrides->changed.path is distinct from changed.base_value->'props'
        and changed.base_value->'props' is distinct from changed.target_value->'props' then 'props'
      else null end as collision_kind
    from paired changed
    where not exists (
      select 1 from paired ancestor
       where ancestor.path <> changed.path
         and pg_catalog.starts_with(changed.path, ancestor.path || '/')
         and ((ancestor.base_value is null) <> (ancestor.target_value is null)))
  ), paths as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'path', emitted.path, 'base', emitted.base_value, 'theirs', emitted.target_value,
      'yours', case when p_overrides ? emitted.path then p_overrides->emitted.path else null end,
      'collision', emitted.collision_kind is not null, 'collisionKind', emitted.collision_kind)
      order by emitted.path collate "C"), '[]'::jsonb) as value
    from emitted
  ), new_roots as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'rootPath', target.chain, 'blockKey', target.node_value->'blockKey',
      'blockVersion', target.node_value->'blockVersion') order by target.ord), '[]'::jsonb) as value
    from node_values target
    where target.side = 'target' and target.is_root and not exists (
      select 1 from node_values base
       where base.side = 'base' and base.is_root and base.chain = target.chain)
  )
  select pg_catalog.jsonb_build_object('paths', paths.value, 'newRoots', new_roots.value,
    'collisionCount', (select pg_catalog.count(*)::integer from emitted where collision_kind is not null))
  from paths cross join new_roots
$body$;

comment on function platform_private.cms_pattern_diff_delta(jsonb, jsonb, text, jsonb) is
  'DEC-193 CMS-03C-14: pure typed node delta over ordered expanded block forests, preserving expanded children, override presence, structural precedence, highest added/removed subtrees and new block-root chains. Not the legacy accept/detach plan. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_diff_delta(jsonb, jsonb, text, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_diff_delta(jsonb, jsonb, text, jsonb)
  from public, anon, authenticated, service_role;

commit;
