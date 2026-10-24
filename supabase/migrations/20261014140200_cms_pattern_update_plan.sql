-- Slice 12 lane pattern-updates (BE03c Pattern versions and linked updates 1367, Canonical records 1426; DEC-185, DEC-186, DEC-193;
-- tracker P2-S12-AC-112 .. AC-114, AC-118 .. AC-122): the writer-side plan of a linked update, used by CMS-03C-15 (accept, detach).
-- The public GET plan (CMS-03C-14) is the independent cms_pattern_diff_plan.
--
--   cms_pattern_update_target(owner, lineage, above, content type)   the latest ACTIVE version of the lineage above a version number
--     whose compatibleTypeIds contain the content type (NULL fields when there is none): the only version a linked update may adopt.
--   cms_pattern_update_plan(row, content type, strict)               DEC-193 writer plan: the exact flat-slot canonical base and target root
--     snapshots (cms_pattern_root_snapshot), the typed unbounded collision delta, and the pinned/target/targetId/rootChain/rootBlock metadata.
--     Only the HEAD of its path, linked and active or pending_diff (the states an accept admits), is offered a target; a detached row stops
--     receiving updates, and a draft, retired or superseded row, and any row with a newer row on its path, is history or not yet live.
-- Private; SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_update_target(
  p_owner_id uuid, p_lineage_id uuid, p_above bigint, p_content_type_id uuid)
returns platform_private.cms_pattern_versions
language sql
stable
security definer
set search_path = ''
as $body$
  select candidate.*
    from platform_private.cms_pattern_versions candidate
   where candidate.owner_id = p_owner_id and candidate.pattern_id = p_lineage_id
     and candidate.state = 'active' and candidate.version > p_above
     and exists (select 1 from pg_catalog.jsonb_array_elements_text(candidate.compatible_type_ids) listed(value)
                  where pg_catalog.lower(listed.value) = pg_catalog.lower(p_content_type_id::text))
   order by candidate.version desc
   limit 1
$body$;

create or replace function platform_private.cms_pattern_update_plan(
  p_row platform_private.cms_composition_instances, p_content_type_id uuid, p_strict boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  pinned platform_private.cms_pattern_versions%rowtype;
  target platform_private.cms_pattern_versions%rowtype;
  base_tree jsonb;
  target_tree jsonb;
  root_chain text;
  delta jsonb;
begin
  select * into pinned from platform_private.cms_pattern_versions candidate
   where candidate.owner_id = p_row.owner_id and candidate.pattern_id = p_row.pattern_id
     and candidate.version = p_row.pattern_version;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if p_row.link_mode = 'linked' and p_row.state in ('active', 'pending_diff')
     and not exists (select 1 from platform_private.cms_composition_instances newer
       where newer.revision_id = p_row.revision_id and newer.path = p_row.path
         and newer.version > p_row.version) then
    target := platform_private.cms_pattern_update_target(
      p_row.owner_id, pinned.pattern_id, pinned.version, p_content_type_id);
  end if;
  if target.id is null then
    return pg_catalog.jsonb_build_object('pinned', pinned.version, 'target', null,
      'targetId', null, 'rootChain', null, 'rootBlock', null,
      'paths', '[]'::jsonb, 'collisionCount', 0);
  end if;
  base_tree := platform_private.cms_pattern_root_snapshot(p_row, pinned, false);
  target_tree := platform_private.cms_pattern_root_snapshot(p_row, target, p_strict);
  root_chain := platform_private.cms_pattern_snapshot_expanded(base_tree)->0->>'chain';
  delta := platform_private.cms_pattern_diff_delta(
    platform_private.cms_pattern_snapshot_expanded(base_tree),
    platform_private.cms_pattern_snapshot_expanded(target_tree), root_chain, p_row.props);
  return pg_catalog.jsonb_build_object('pinned', pinned.version, 'target', target.version,
    'targetId', target.id, 'rootChain', root_chain,
    'rootBlock', case when target_tree <> 'null'::jsonb then pg_catalog.jsonb_build_object(
      'blockKey', target_tree#>'{nodes,0,blockKey}', 'blockVersion', target_tree#>'{nodes,0,blockVersion}') end,
    'baseTree', base_tree, 'targetTree', target_tree,
    'paths', delta->'paths', 'collisionCount', delta->'collisionCount');
end;
$body$;

comment on function platform_private.cms_pattern_update_plan(
  platform_private.cms_composition_instances, uuid, boolean) is
  'DEC-193 internal writer plan: retain pinned/target/targetId/rootChain/rootBlock metadata, canonical full B/T snapshots and unbounded typed collision delta. Newest active compatible target and caller strict nested-target validation remain. Not the public GET plan.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_target(uuid, uuid, bigint, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_plan(platform_private.cms_composition_instances, uuid, boolean) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_pattern_update_target(uuid, uuid, bigint, uuid),
  platform_private.cms_pattern_update_plan(platform_private.cms_composition_instances, uuid, boolean)
  from public, anon, authenticated, service_role;

commit;
