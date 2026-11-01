-- DEC-193 canonical-content registry validation, not an authored-object parser.
-- Selected effective props reuse the existing executable-leaf policy.
-- DEC-210 (BE03c "Block composition rules"): the registry allowedChildren / slotRules of the pinned block versions are
-- evaluated by the shared pure check platform_private.cms_detached_tree_block_rules (migrations-wip/block-rules
-- 20261022080100) over the canonical expanded tree, after every structural and props validation, and refuse with the
-- token block_rules_violated; the call sites of CMS-03C-15 map it to its operation pointer.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_detached_tree_registry(
  p_owner_id uuid, p_tree jsonb, p_content_type_id uuid, p_overrides jsonb default '{}')
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_expanded jsonb;
  v_values jsonb;
  v_rules jsonb := '{}'::jsonb;
  v_refs jsonb := '[]'::jsonb;
  v_tuples jsonb := '[]'::jsonb;
  v_ref record;
  v_block platform_private.cms_block_definition_versions%rowtype;
  v_lifecycle text;
  v_entry jsonb;
  v_props jsonb;
  v_key text;
begin
  if platform_private.cms_detached_tree_valid(p_tree) is not true
     or pg_catalog.jsonb_typeof(p_overrides) is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  v_expanded := platform_private.cms_pattern_snapshot_expanded(p_tree);
  select pg_catalog.jsonb_object_agg(item->>'chain', item->'node') into v_values
    from pg_catalog.jsonb_array_elements(v_expanded) item;
  if exists (select 1 from pg_catalog.jsonb_object_keys(p_overrides) named(path)
      where not (v_values ? named.path)) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Caller prelocks its complete B/T/selected/whole-target union first. This
  -- helper also has deterministic standalone order, identical to the old digest.
  for v_ref in select reached.block_key, reached.block_version from (
    select distinct item->'node'->>'blockKey' as block_key,
      (item->'node'->>'blockVersion')::integer as block_version
      from pg_catalog.jsonb_array_elements(v_expanded) item
    ) reached order by reached.block_key collate "C", reached.block_version
  loop
    select * into v_block from platform_private.cms_block_definition_versions registered
     where registered.block_key = v_ref.block_key and registered.block_version = v_ref.block_version
       and registered.state = 'registered' for share;
    if not found or platform_private.cms_reserved_key(v_ref.block_key) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select event.to_lifecycle into v_lifecycle
      from platform_private.cms_block_definition_lifecycle_events event
     where event.block_definition_version_id = v_block.id
     order by event.created_at desc, event.id desc limit 1;
    if coalesce(v_lifecycle, 'supported') = 'withdrawn' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    v_key := v_ref.block_key || ':' || v_ref.block_version;
    v_rules := v_rules || pg_catalog.jsonb_build_object(v_key,
      pg_catalog.jsonb_build_object('children', v_block.allowed_children, 'limits', v_block.slot_rules));
    v_refs := v_refs || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', v_block.block_key, 'blockVersion', v_block.block_version, 'children', '[]'::jsonb));
    v_tuples := v_tuples || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'blockKey', v_block.block_key, 'blockVersion', v_block.block_version,
      'releaseDigest', pg_catalog.btrim(v_block.release_digest::text),
      'propsSchemaHash', pg_catalog.btrim(v_block.props_schema_hash::text),
      'rendererRef', v_block.renderer_ref, 'lifecycle', coalesce(v_lifecycle, 'supported')));
  end loop;
  -- Flat immutable registry refs adapt only the existing compatibility lookup;
  -- no authored forest validator or authored root/child/depth cap is applied.
  if platform_private.cms_pattern_blocks_compatible(
      p_owner_id, v_refs, pg_catalog.jsonb_build_array(p_content_type_id)) is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for v_entry in select item from pg_catalog.jsonb_array_elements(v_expanded) item loop
    v_props := case when p_overrides ? (v_entry->>'chain')
      then p_overrides->(v_entry->>'chain') else v_entry->'node'->'props' end;
    -- Effective local props are arbitrary JSON by the existing override contract.
    -- Do not require an object, coerce null/arrays, or invent reserved JSON keys.
    if platform_private.cms_json_executable_leaves(v_props) > 0 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if platform_private.cms_json_bounded(v_props, 262144, 8, 128, 128) is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;
  -- DEC-210: allowedChildren and slotRules (maxNodes, maxDepth) of the pinned block versions, over this exact tree,
  -- with the rules already read FOR SHARE above.
  if platform_private.cms_detached_tree_block_rules(p_tree, v_rules) is not null then
    raise exception 'block_rules_violated' using errcode = 'P0001';
  end if;
  return platform_private.cms_jcs_sha256(v_tuples);
end;
$body$;

comment on function platform_private.cms_detached_tree_registry(uuid,jsonb,uuid,jsonb) is
  'DEC-193 private canonical-tree registry check/digest: registered nonreserved identities, nonwithdrawn signed safe-registry tuples, existing active-type compiler compatibility, allowed child identities and registered subtree depth/node rules; exact bounded arbitrary effective JSON. No whole-snapshot aggregate or authored-object coercion. Caller prelocks the complete operation registry union.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_detached_tree_registry(uuid,jsonb,uuid,jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_detached_tree_registry(uuid,jsonb,uuid,jsonb)
  from public, anon, authenticated, service_role;
commit;
