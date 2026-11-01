-- Slice 12 lane pattern-updates, CMS-03C-15 (BE03c route row 177, validation row 400, lock order 1336-1357, authorization 1476; DEC-181,
-- DEC-185, DEC-193; tracker P2-S12-AC-118 .. AC-123, AC-219, AC-258): POST /api/v1/cms/compositions/pattern-updates.
-- An assigned author or editor ACCEPTS the latest active compatible pattern version for, or DETACHES, 1 to 32 linked instances of the
-- entry's current draft revision, all-or-nothing; each instance appends one row (cms_pattern_update_next_row). Returns { items, entryVersion }
-- (the transport 20261014140610 strips entryVersion into the ETag). A named row that is not the newest of its path is a 422 at its
-- instanceId (BE03c 410/1416); only the stale head expectedVersion is the 409. Owner, ACL, table privileges: 20261014140605. Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function platform_private.cms_apply_pattern_update(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_correlation_id uuid;
  v_action text;
  v_target integer;
  v_requested bigint;
  v_instances jsonb;
  v_count integer;
  v_item jsonb;
  v_choices jsonb;
  v_i integer;
  v_row platform_private.cms_composition_instances%rowtype;
  v_head platform_private.cms_composition_instances%rowtype;
  v_new platform_private.cms_composition_instances;
  v_next_rows platform_private.cms_composition_instances[] := array[]::platform_private.cms_composition_instances[];
  v_entry platform_private.cms_content_entries%rowtype;
  v_entry_id uuid;
  v_revision platform_private.cms_entry_revisions%rowtype;
  v_reservation platform_private.idempotency_records;
  v_candidate platform_private.cms_pattern_versions%rowtype;
  v_pinned platform_private.cms_pattern_versions%rowtype;
  v_target_row platform_private.cms_pattern_versions%rowtype;
  v_ids uuid[] := array[]::uuid[];
  v_entries uuid[] := array[]::uuid[];
  v_heads uuid[] := array[]::uuid[];
  v_lock_ids uuid[] := array[]::uuid[];
  v_candidate_ids uuid[] := array[]::uuid[];
  v_plans jsonb := '[]'::jsonb;
  v_plan jsonb;
  v_block_refs jsonb := '[]'::jsonb;
  v_tree jsonb;
  v_digests jsonb := '{}'::jsonb;
  v_digest text;
  v_colliding text[];
  v_now timestamptz;
  v_items jsonb := '[]'::jsonb;
  v_review_id uuid;
  v_current text;
  v_msg text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.cms_pattern_update_check(p_request);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation_id := platform_private.cms_correlation(p_request);
  v_action := p_request->>'action';
  v_target := case when v_action = 'accept' then (p_request->>'targetPatternVersion')::integer end;
  v_requested := (p_request->>'expectedVersion')::bigint;
  v_instances := p_request->'instances';
  v_count := pg_catalog.jsonb_array_length(v_instances);
  for v_i in 0 .. v_count - 1 loop
    select * into v_row from platform_private.cms_composition_instances instance_row
     where instance_row.id = (v_instances -> v_i ->> 'instanceId')::uuid;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    select entry_row.id into v_entry_id
      from platform_private.cms_entry_revisions revision_row
      join platform_private.cms_content_entries entry_row on entry_row.id = revision_row.entry_id
     where revision_row.id = v_row.revision_id and entry_row.owner_party_id = v_party_id
       and platform_private.cms_entry_tenant_visible(v_actor_id, entry_row.owner_party_id);
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    v_ids := v_ids || v_row.id;
    v_entries := v_entries || v_entry_id;
  end loop;
  for v_i in 1 .. v_count - 1 loop
    if v_entries[v_i + 1] <> v_entries[1] then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
    end if;
  end loop;
  -- [0] Entry; [1] authority and capability; reservation/replay before CAS.
  select * into v_entry from platform_private.cms_content_entries entry_row where entry_row.id = v_entries[1] for update;
  perform platform_private.cms_lock_entry_authority(v_actor_id, v_party_id, v_entry.id);
  if platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.editor', v_entry.id) is null
     and platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.author', v_entry.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-15');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if v_entry.version <> v_requested then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('expectedVersion', v_requested::text, 'currentVersion', v_entry.version::text)::text;
  end if;
  for v_i in 0 .. v_count - 1 loop
    select * into v_row from platform_private.cms_composition_instances instance_row where instance_row.id = v_ids[v_i + 1];
    if v_entry.lifecycle <> 'active' or v_entry.current_draft_revision_id is distinct from v_row.revision_id
       or platform_private.cms_revision_effective_state(v_row.revision_id) is distinct from 'draft' then
      raise exception 'revision_not_editable' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
    end if;
  end loop;
  select * into v_revision from platform_private.cms_entry_revisions revision_row where revision_row.id = v_entry.current_draft_revision_id;
  for v_i in 0 .. v_count - 1 loop
    v_item := v_instances -> v_i;
    select * into v_row from platform_private.cms_composition_instances instance_row where instance_row.id = v_ids[v_i + 1];
    select * into v_head from platform_private.cms_composition_instances head_row
     where head_row.revision_id = v_row.revision_id and head_row.path = v_row.path order by head_row.version desc limit 1;
    -- BE03c 410/1416 (DEC-193): a named row that is not the newest version of its path is a 422 at its
    -- instanceId; only the stale expectedVersion of the head row is the 409 below (R1-007).
    if v_head.id <> v_row.id then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
    end if;
    if v_head.version <> (v_item->>'expectedVersion')::bigint then
      raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object('expectedVersion', v_item->>'expectedVersion', 'currentVersion', v_head.version::text,
          'instanceId', v_row.id)::text;
    end if;
    if v_head.pattern_id is null or v_head.pattern_version is null or v_head.pattern_version < 1
       or v_head.link_mode <> 'linked'
       or (v_action = 'accept' and v_head.state not in ('active', 'pending_diff')) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
    end if;
    v_heads := v_heads || v_head.id;
  end loop;
  -- [3] Union both provenance pins and candidate targets/nested pins before
  -- locking once in ascending id. Ordinary retired detach needs its real B pin.
  for v_i in 0 .. v_count - 1 loop
    select * into v_head from platform_private.cms_composition_instances head_row where head_row.id = v_heads[v_i + 1];
    select * into v_pinned from platform_private.cms_pattern_versions pinned
     where pinned.owner_id = v_head.owner_id and pinned.pattern_id = v_head.pattern_id and pinned.version = v_head.pattern_version;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    v_lock_ids := v_lock_ids || v_pinned.id || array(
      select closure.nested_row_id from platform_private.cms_pattern_nested_closure(v_head.owner_id, v_pinned.block_tree) closure
       where closure.nested_row_id is not null);
    if v_action = 'accept' then
      v_candidate := platform_private.cms_pattern_update_target(v_head.owner_id, v_head.pattern_id, v_head.pattern_version, v_entry.content_type_id);
      v_candidate_ids := pg_catalog.array_append(v_candidate_ids, v_candidate.id);
      if v_candidate.id is not null then
        v_lock_ids := v_lock_ids || v_candidate.id || array(
          select closure.nested_row_id from platform_private.cms_pattern_nested_closure(v_head.owner_id, v_candidate.block_tree) closure
           where closure.nested_row_id is not null);
      end if;
    end if;
  end loop;
  perform 1 from platform_private.cms_pattern_versions locked where locked.id = any (v_lock_ids) order by locked.id for share;
  if v_action = 'accept' then
    for v_i in 0 .. v_count - 1 loop
      select * into v_head from platform_private.cms_composition_instances head_row where head_row.id = v_heads[v_i + 1];
      begin
        v_plan := platform_private.cms_pattern_update_plan(v_head, v_entry.content_type_id, true);
      exception when sqlstate 'P0001' then
        get stacked diagnostics v_msg = message_text;
        if v_msg = 'nested_pattern_not_active' then
          raise exception '%', v_msg using errcode = 'P0001', detail = '["/targetPatternVersion"]';
        end if;
        raise;
      end;
      if v_plan->>'target' is null or (v_plan->>'target')::integer <> v_target
         or (v_plan->>'targetId')::uuid is distinct from v_candidate_ids[v_i + 1] then
        raise exception 'pattern_version_not_active' using errcode = 'P0001', detail = '["/targetPatternVersion"]';
      end if;
      select * into v_target_row from platform_private.cms_pattern_versions target_version where target_version.id = (v_plan->>'targetId')::uuid;
      if not found or exists (
        select 1 from platform_private.cms_pattern_nested_closure(v_head.owner_id, v_target_row.block_tree) closure
         where closure.nested_row_id is not null and (closure.nested_row_id = any (v_lock_ids)) is not true) then
        raise exception 'pattern_version_not_active' using errcode = 'P0001', detail = '["/targetPatternVersion"]';
      end if;
      v_plans := v_plans || pg_catalog.jsonb_build_array(v_plan);
    end loop;
    for v_i in 0 .. v_count - 1 loop
      if v_count > 1 and (v_plans -> v_i ->> 'collisionCount')::integer > 0 then
        raise exception 'diff_has_collisions' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
      end if;
    end loop;
    if v_count = 1 then
      v_choices := coalesce(v_instances -> 0 -> 'choices', '[]'::jsonb);
      v_colliding := array(select entry.value->>'path' from pg_catalog.jsonb_array_elements(v_plans -> 0 -> 'paths') entry(value)
                            where (entry.value->>'collision')::boolean);
      for v_i in 0 .. pg_catalog.jsonb_array_length(v_choices) - 1 loop
        if not (v_choices -> v_i ->> 'path' = any (v_colliding)) then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
            detail = pg_catalog.jsonb_build_array(format('/instances/0/choices/%s/path', v_i))::text;
        end if;
      end loop;
      if exists (select 1 from unnest(v_colliding) colliding(path)
                  where not exists (select 1 from pg_catalog.jsonb_array_elements(v_choices) chosen(value) where chosen.value->>'path' = colliding.path)) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/instances/0/choices"]';
      end if;
    end if;
  end if;
  -- [4] Bound type; [5] live review rows, unchanged positions/order.
  perform 1 from platform_private.cms_content_type_versions type_version where type_version.id = v_revision.schema_version_id for share;
  perform 1 from platform_private.cms_editorial_reviews review_row
   where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
   order by review_row.id for update;
  v_now := pg_catalog.clock_timestamp();
  -- Assemble purely before acquiring registry locks or writing any row. Registry
  -- refs include full linked targets, not just the instance root's selected tree.
  for v_i in 0 .. v_count - 1 loop
    select * into v_head from platform_private.cms_composition_instances head_row where head_row.id = v_heads[v_i + 1];
    v_plan := case when v_action = 'accept' then v_plans -> v_i end;
    v_new := platform_private.cms_pattern_update_next_row(v_head, v_action, v_plan,
      case when v_action = 'accept' and v_count = 1 then v_instances -> 0 -> 'choices' end,
      v_head.block_registry_digest::text, v_actor_id, v_now);
    v_next_rows := pg_catalog.array_append(v_next_rows, v_new);
    v_block_refs := v_block_refs || coalesce(v_plan#>'{baseTree,nodes}', '[]'::jsonb)
      || coalesce(v_plan#>'{targetTree,nodes}', '[]'::jsonb) || coalesce(v_new.detached_tree->'nodes', '[]'::jsonb);
    if v_action = 'accept' then
      select * into v_target_row from platform_private.cms_pattern_versions target_version where target_version.id = (v_plan->>'targetId')::uuid;
      v_block_refs := v_block_refs || coalesce((select pg_catalog.jsonb_agg(expanded.node)
        from platform_private.cms_pattern_update_nodes(v_head.owner_id, v_target_row.block_tree,
          array[v_target_row.pattern_id], false) expanded), '[]'::jsonb);
    end if;
  end loop;
  perform 1 from platform_private.cms_block_definition_versions registered join (
    select distinct ref->>'blockKey' as block_key, (ref->>'blockVersion')::integer as block_version
      from pg_catalog.jsonb_array_elements(v_block_refs) ref
    ) wanted on wanted.block_key = registered.block_key and wanted.block_version = registered.block_version
    order by registered.block_key collate "C", registered.block_version for share of registered;
  for v_i in 0 .. v_count - 1 loop
    select * into v_head from platform_private.cms_composition_instances head_row where head_row.id = v_heads[v_i + 1];
    v_new := v_next_rows[v_i + 1];
    v_plan := case when v_action = 'accept' then v_plans -> v_i end;
    if v_new.state <> 'retired' then
      v_tree := case when v_new.detached_tree is not null then v_new.detached_tree else v_plan->'targetTree' end;
      begin
        v_digest := platform_private.cms_detached_tree_registry(v_head.owner_id, v_tree, v_entry.content_type_id,
          case when v_new.detached_tree is not null then '{}'::jsonb else v_new.props end);
      exception when sqlstate 'P0001' then
        get stacked diagnostics v_msg = message_text;
        if v_msg = 'VALIDATION_FAILED' then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(
            case when v_action = 'accept' and v_count = 1 then '/instances/0/choices'
              else format('/instances/%s/instanceId', v_i) end)::text;
        end if;
        raise;
      end;
      if v_new.link_mode = 'linked' then
        v_current := v_plan->>'targetId';
        if not v_digests ? v_current then
          select * into v_target_row from platform_private.cms_pattern_versions target_version where target_version.id = (v_plan->>'targetId')::uuid;
          v_digests := v_digests || pg_catalog.jsonb_build_object(v_current,
            platform_private.cms_pattern_registry_digest(v_head.owner_id, v_target_row.block_tree));
        end if;
        v_digest := v_digests ->> v_current;
      end if;
      v_new.block_registry_digest := v_digest;
    end if;
    if not platform_private.cms_json_bounded(v_new.props, 262144, 8, 128, 128) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', v_i))::text;
    end if;
    insert into platform_private.cms_composition_instances select (v_new).*;
    v_items := v_items || pg_catalog.jsonb_build_array(platform_private.cms_composition_instance_resource(v_new));
  end loop;
  update platform_private.cms_content_entries entry_row
     set version = entry_row.version + 1, updated_at = v_now
   where entry_row.id = v_entry.id and entry_row.version = v_requested;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;
  for v_review_id in
    select review_row.id from platform_private.cms_editorial_reviews review_row
     where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
     order by review_row.id
  loop
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', v_review_id, 'reasonCode', 'dependency_changed', 'correlationId', v_correlation_id, 'actorId', v_actor_id));
  end loop;
  perform platform_private.cms_record_audit(
    case v_action when 'accept' then 'cms.composition.pattern.update' else 'cms.composition.pattern.detach' end,
    v_actor_id, v_party_id, 'cms_composition_instance', (v_items->0->>'id')::uuid,
    case v_action when 'accept' then 'CMS_PATTERN_UPDATE_ACCEPTED' else 'CMS_PATTERN_DETACHED' end, v_correlation_id);
  perform platform_private.cms_complete(v_reservation.id, (v_items->0->>'id')::uuid, 200,
    pg_catalog.jsonb_build_object('items', v_items, 'entryVersion', (v_requested + 1)::text));
  return pg_catalog.jsonb_build_object('items', v_items, 'entryVersion', (v_requested + 1)::text);
end;
$body$;

comment on function platform_private.cms_apply_pattern_update(jsonb) is
  'CMS-03C-15 DEC-193 forward integration: unchanged protected envelope/effects, ordered B/T pins and complete registry union, pure simultaneous row assembly and selected registry checks; linked uses whole-target digest, detached uses selected-tree digest/prior pin/empty props, retirement keeps prior pin. No public snapshot or aggregate materialization limit.';

commit;
