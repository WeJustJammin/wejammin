-- Slice 12 lane pattern-def (BE03c CMS-03C-12 at 174, 395-397, 1361, 1447, 1473; DEC-186, DEC-188; tracker
-- P2-S12-AC-100 to AC-104, AC-193, AC-211): the CMS-03C-12 command.
--
--   platform_private.cms_create_pattern_version(p_request jsonb) returns jsonb   the atomic private body
--   platform_api.cms_create_pattern_version(p_request jsonb)                    the Worker transport (20261014020500)
--
-- Request (the Worker envelope, exactly): patternKey, compatibleTypeIds, blockTree, expectedVersion (JSON null or a
-- decimal string), idempotencyKey, context; optional blockRegistryDigest, ifMatch (the UNQUOTED expectedVersion,
-- required exactly when expectedVersion is not null), correlationId.  A refusal is a P0001 whose whole message is
-- the token (a closed lowercase reason or a catalog token) and whose DETAIL is a JSON pointer array.
--
-- Order: 1 concealment (UNAUTHENTICATED; a non-member owner party is NOT_FOUND), lock position 1 and the capability
-- re-proved under the lock (403 capability_missing); 2 the idempotency reservation (a completed same-fingerprint
-- record returns the stored response, after the capability proof); 3 exact keys; 4 key grammar, reserved keys, the
-- expectedVersion/ifMatch pair, the digest shape, the type list and the literal forest; 5 lock position 3: the
-- parent row FOR UPDATE (the CAS operand, re-proved on a fresh snapshot) and every nested pattern row FOR SHARE;
-- 6 lock position 4: the content type version rows FOR SHARE and the active type proof; 7 the nested graph (active,
-- compatible, acyclic, at most 512 nodes after expansion); 8 the 03a registry, block
-- compatibility with every type's renderer manifest, props against the signed snapshot and the recomputed digest
-- against a client expectation; 9 the draft row, one audit record and the completed
-- reservation.  No outbox event (activation is CMS-03C-09).  The definition `version` is the public CAS number; the
-- private lifecycle counter starts at its default of 1 (DEC-188).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_create_pattern_version(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_person_id uuid;
  v_correlation_id uuid;
  v_reservation platform_private.idempotency_records;
  v_key text;
  v_types jsonb;
  v_tree jsonb;
  v_token text;
  v_previous platform_private.cms_pattern_versions%rowtype;
  v_has_previous boolean;
  v_next_version bigint;
  v_row_id uuid;
  v_lineage_id uuid;
  v_type_count integer;
  v_expanded bigint;
  v_digest text;
  v_hash text;
  v_now timestamptz;
  v_response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation_id := platform_private.cms_correlation(p_request);

  -- 1. concealment, then lock position 1 and the capability re-proved under the lock
  begin
    v_person_id := platform_private.identity_actor_person(v_actor_id);
  exception when others then
    v_person_id := null;
  end;
  if v_person_id is null or not platform_private.cms_entry_tenant_visible(v_actor_id, v_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_governed_authority(v_actor_id, v_party_id, 'cms.template_designer');
  if not platform_private.cms_person_holds_capability(v_party_id, v_person_id, 'cms.template_designer') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 2. the idempotency reservation; a completed record is the stored response
  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-12');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 3. exact keys
  if not platform_private.cms_exact_keys(
    p_request,
    array['patternKey','compatibleTypeIds','blockTree','expectedVersion','idempotencyKey','context']::text[],
    array['patternKey','compatibleTypeIds','blockTree','expectedVersion','blockRegistryDigest',
      'ifMatch','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  -- 4. structure that depends on no stored data
  if pg_catalog.jsonb_typeof(p_request->'patternKey') is distinct from 'string'
     or p_request->>'patternKey' !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/patternKey"]';
  end if;
  v_key := p_request->>'patternKey';
  -- E13: the keys of the fixed route segments are reserved (typed 422 at /patternKey)
  if v_key in ('context', 'versions', 'selector', 'new') then
    raise exception 'key_reserved' using errcode = 'P0001', detail = '["/patternKey"]';
  end if;
  if p_request->'expectedVersion' = 'null'::jsonb then
    if p_request ? 'ifMatch' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  elsif pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or not platform_private.cms_valid_version(p_request->>'expectedVersion')
     or not platform_private.cms_valid_version(p_request->>'ifMatch')
     or p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'blockRegistryDigest'
     and (pg_catalog.jsonb_typeof(p_request->'blockRegistryDigest') is distinct from 'string'
          or p_request->>'blockRegistryDigest' !~ '^[a-f0-9]{64}$') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockRegistryDigest"]';
  end if;
  v_types := p_request->'compatibleTypeIds';
  if not platform_private.cms_pattern_type_ids_valid(v_types) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/compatibleTypeIds"]';
  end if;
  v_tree := p_request->'blockTree';
  v_token := platform_private.cms_pattern_forest_check(v_tree);
  if v_token is not null then
    raise exception '%', v_token using errcode = 'P0001', detail = '["/blockTree"]';
  end if;

  -- 5. lock position 3: the parent version row (the CAS operand), then every nested pattern version row
  select * into v_previous
    from platform_private.cms_pattern_versions candidate
   where candidate.owner_id = v_party_id and candidate.pattern_key = v_key
   order by candidate.version desc limit 1 for update;
  v_has_previous := found;
  if p_request->'expectedVersion' = 'null'::jsonb then
    if v_has_previous then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    v_next_version := 1;
  else
    if not v_has_previous then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if v_previous.version::text <> p_request->>'expectedVersion' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    -- the FOR UPDATE above keeps the stale latest row of a call that waited on the lock: re-prove the CAS on a
    -- fresh snapshot so a successor committed meanwhile is a conflict, never a second successor
    if exists (
      select 1 from platform_private.cms_pattern_versions later
       where later.owner_id = v_party_id and later.pattern_key = v_key
         and later.version > v_previous.version
    ) then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    v_next_version := v_previous.version + 1;
  end if;
  if v_next_version > 2147483647 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform 1
    from platform_private.cms_pattern_versions nested_item
   where nested_item.id in (
     select closure.nested_row_id
       from platform_private.cms_pattern_nested_closure(v_party_id, v_tree) closure
      where closure.nested_row_id is not null)
   order by nested_item.id
     for share;

  -- 6. lock position 4: the active content types the definition names
  perform 1
    from platform_private.cms_content_type_versions version_row
    join platform_private.cms_content_types content_type on content_type.id = version_row.content_type_id
   where content_type.id in (
           select (element.value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_types) element(value))
     and content_type.owner_id = v_party_id
     and content_type.state = 'active'
     and version_row.state = 'active'
   order by version_row.id
     for share of version_row;
  select pg_catalog.count(distinct content_type.id)::integer into v_type_count
    from platform_private.cms_content_types content_type
   where content_type.id in (
           select (element.value #>> '{}')::uuid from pg_catalog.jsonb_array_elements(v_types) element(value))
     and content_type.owner_id = v_party_id
     and content_type.state = 'active'
     and exists (
       select 1 from platform_private.cms_content_type_versions version_row
        where version_row.content_type_id = content_type.id and version_row.state = 'active');
  if v_type_count <> pg_catalog.jsonb_array_length(v_types) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/compatibleTypeIds"]';
  end if;

  -- 7. the nested graph: every pinned version active, direct references listing every type, no lineage cycle, a
  --    chain the governed closure helper (nine levels) can cover, and at most 512 nodes after expansion
  if exists (
    select 1
      from platform_private.cms_pattern_nested_closure(v_party_id, v_tree) closure
      left join platform_private.cms_pattern_versions pinned on pinned.id = closure.nested_row_id
     where pinned.id is null or pinned.state <> 'active'
  ) or exists (
    select 1
      from platform_private.cms_pattern_nested_closure(v_party_id, v_tree) closure
      join platform_private.cms_pattern_versions pinned on pinned.id = closure.nested_row_id
     where closure.nested_depth = 1
       and exists (
         select 1 from pg_catalog.jsonb_array_elements_text(v_types) required_type(value)
          where not exists (
            select 1 from pg_catalog.jsonb_array_elements_text(pinned.compatible_type_ids) listed(value)
             where pg_catalog.lower(listed.value) = pg_catalog.lower(required_type.value)))
  ) then
    raise exception 'nested_pattern_not_active' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;
  v_lineage_id := case when v_has_previous then v_previous.pattern_id else null end;
  if v_lineage_id is not null and exists (
    select 1 from platform_private.cms_pattern_nested_closure(v_party_id, v_tree) closure
     where closure.nested_pattern_id = v_lineage_id
  ) then
    raise exception 'pattern_cycle' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;
  if exists (
    select 1 from platform_private.cms_pattern_nested_closure(v_party_id, v_tree) closure
     where closure.nested_depth >= 9
  ) then
    raise exception 'pattern_depth_exceeded' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;
  select (select pg_catalog.count(*) from platform_private.cms_pattern_forest_nodes(v_tree) scanned
           where scanned.node->>'kind' = 'block')
         + coalesce((select pg_catalog.sum(pinned.node_count)
              from platform_private.cms_pattern_forest_nodes(v_tree) scanned
              join platform_private.cms_pattern_versions pinned
                on pinned.owner_id = v_party_id
               and pinned.pattern_id = (scanned.node->>'patternId')::uuid
               and pinned.version = (scanned.node->>'patternVersion')::integer
             where scanned.node->>'kind' = 'pattern'), 0)
    into v_expanded;
  if v_expanded > 512 then
    raise exception 'pattern_nodes_exceeded' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;

  -- 8. the 03a safe registry: the digest resolves and locks every reachable block, then every literal block's
  --    props must fit its signed snapshot; a client digest is an equality expectation only
  v_digest := platform_private.cms_pattern_registry_digest(v_party_id, v_tree);
  if not platform_private.cms_pattern_blocks_compatible(v_party_id, v_tree, v_types) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;
  if exists (
    select 1
      from platform_private.cms_pattern_forest_nodes(v_tree) scanned
      join platform_private.cms_block_definition_versions registered
        on registered.block_key = scanned.node->>'blockKey'
       and registered.block_version = (scanned.node->>'blockVersion')::integer
       and registered.state = 'registered'
     where scanned.node->>'kind' = 'block'
       and not platform_private.cms_pattern_props_valid(registered.props_schema_snapshot, scanned.node->'props')
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockTree"]';
  end if;
  if p_request ? 'blockRegistryDigest' and p_request->>'blockRegistryDigest' <> v_digest then
    raise exception 'block_registry_digest_mismatch' using errcode = 'P0001', detail = '["/blockRegistryDigest"]';
  end if;

  -- 9. the draft row, one audit record and the completed reservation, atomically
  v_row_id := extensions.gen_random_uuid();
  v_lineage_id := coalesce(v_lineage_id, v_row_id);
  v_now := pg_catalog.clock_timestamp();
  v_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'patternKey', v_key, 'compatibleTypeIds', v_types, 'blockTree', v_tree, 'blockRegistryDigest', v_digest));
  begin
    insert into platform_private.cms_pattern_versions (
      id, owner_id, state, version, created_at, updated_at, pattern_key, block_tree,
      block_registry_digest, content_hash, owner_capability, created_by, pattern_id,
      compatible_type_ids, node_count, supersedes_id
    ) values (
      v_row_id, v_party_id, 'draft', v_next_version, v_now, v_now, v_key, v_tree,
      v_digest::char(64), v_hash::char(64), 'cms.template_designer', v_actor_id, v_lineage_id,
      v_types, v_expanded::smallint, case when v_has_previous then v_previous.id else null end
    );
  exception when unique_violation then
    -- a concurrent writer of the same (owner, key, version) won the unique key
    raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform platform_private.cms_record_audit(
    'cms.pattern.define', v_actor_id, v_party_id,
    'cms_pattern_version', v_row_id, 'CMS_PATTERN_DRAFT_DEFINED', v_correlation_id);
  v_response := platform_private.cms_pattern_resource(v_row_id);
  perform platform_private.cms_complete(v_reservation.id, v_row_id, 201, v_response);
  return v_response;
end;
$body$;

comment on function platform_private.cms_create_pattern_version(jsonb) is
  'CMS-03C-12: a cms.template_designer creates a draft PatternVersion (a first version with expectedVersion null, a successor naming its exact parent) in one transaction: concealment, the Slice 12 lock order, the capability re-proved under the locks, the idempotency reservation, the literal forest bounds, the nested graph, the 03a registry with props against the signed snapshot and the recomputed digest, then the draft row, one audit record and the completed reservation. Private; the Worker calls the platform_api wrapper.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_create_pattern_version(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_create_pattern_version(jsonb)
  from public, anon, authenticated, service_role;

commit;
