-- DEC-193 read adapters only. No registry/activity decision, repin or producer.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_revision_effective_composition(p_revision_id uuid)
returns setof platform_private.cms_composition_instances
language sql
stable
security invoker
set search_path = ''
as $body$
  select head.* from (
    select distinct on (instance.path collate "C") instance.*
      from platform_private.cms_composition_instances instance
     where instance.revision_id = p_revision_id
     order by instance.path collate "C", instance.version desc, instance.id desc
  ) head
  where head.state in ('draft', 'active', 'pending_diff')
$body$;

create function platform_private.cms_composition_effective_nodes(
  p_row platform_private.cms_composition_instances)
returns table(node_index integer, block_key text, block_version bigint, effective_props jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $body$
declare
  pinned platform_private.cms_pattern_versions;
  tree jsonb;
begin
  -- The checker's field arm uses a LEFT JOIN, with no composition row.
  if p_row.id is null then return; end if;
  if p_row.detached_tree is not null then
    -- A private snapshot owns its complete content. Never reopen its provenance.
    tree := p_row.detached_tree;
  elsif p_row.pattern_id is not null then
    select candidate.* into pinned from platform_private.cms_pattern_versions candidate
     where candidate.owner_id = p_row.owner_id and candidate.pattern_id = p_row.pattern_id
       and candidate.version = p_row.pattern_version;
    if not found then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    -- Historical/pending pins resolve exact B, including superseded nested pins.
    tree := platform_private.cms_pattern_root_snapshot(p_row, pinned, false);
    tree := platform_private.cms_pattern_update_resolve(tree, tree, p_row.props, '[]'::jsonb)->'tree';
  else
    -- Legacy standalone props are the node value, not a path-keyed override map.
    return query select 0, p_row.block_key::text, p_row.block_version::bigint, p_row.props;
    return;
  end if;
  return query
    select (item.ordinality - 1)::integer, item.value->'node'->>'blockKey',
           (item.value->'node'->>'blockVersion')::bigint, item.value->'node'->'props'
      from pg_catalog.jsonb_array_elements(platform_private.cms_pattern_snapshot_expanded(tree))
        with ordinality item(value, ordinality)
     order by item.ordinality;
end;
$body$;

comment on function platform_private.cms_revision_effective_composition(uuid) is
  'Private read adapter: newest immutable row per revision/path BEFORE draft/active/pending eligibility; retired/superseded heads hide old history. No writes or activity inference.';
comment on function platform_private.cms_composition_effective_nodes(platform_private.cms_composition_instances) is
  'Private read adapter: zero-based canonical preorder, exact block identity and effective arbitrary JSON props. Nonnull snapshots own content; legacy NULL snapshots resolve exact pinned B with overrides or one standalone node. No registry validation, repin, public read cap or aggregate snapshot cap.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_revision_effective_composition(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_composition_effective_nodes(platform_private.cms_composition_instances)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_revision_effective_composition(uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_composition_effective_nodes(platform_private.cms_composition_instances)
  from public, anon, authenticated, service_role;

do $closure$
declare signature text; relation_name text; callee regprocedure;
begin
  foreach signature in array array[
    'platform_private.cms_pattern_root_snapshot(platform_private.cms_composition_instances,platform_private.cms_pattern_versions,boolean)',
    'platform_private.cms_pattern_update_resolve(jsonb,jsonb,jsonb,jsonb)',
    'platform_private.cms_pattern_snapshot_expanded(jsonb)'
  ] loop
    callee := pg_catalog.to_regprocedure(signature);
    if callee is null or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee, 'EXECUTE') then
      raise exception 'effective composition dependency unavailable: %', signature using errcode = '55000';
    end if;
  end loop;
  foreach relation_name in array array['platform_private.cms_composition_instances',
    'platform_private.cms_pattern_versions'] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', relation_name, 'SELECT') then
      raise exception 'effective composition source unavailable: %', relation_name using errcode = '55000';
    end if;
  end loop;
end;
$closure$;

commit;
