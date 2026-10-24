-- DEC-193 / BE03c1483: a template-bound placement names one exact flat slot.
-- Forward clone of the promoted placement producer. Only the template-slot
-- predicate changes; first-segment slot_key storage and all other body bytes stay.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Require the existing private identity. CREATE OR REPLACE retains its owner/ACL;
-- no role, schema or function grant is added, removed or broadened.
do $identity$
declare prior pg_catalog.pg_proc%rowtype;
begin
  select proc.* into prior from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(
     'platform_private.cms_insert_pattern_instance(jsonb)');
  if not found or prior.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or not prior.prosecdef or prior.provolatile <> 'v'
     or prior.proconfig is distinct from array['search_path=""']::text[] then
    raise exception 'exact-slot migration requires the existing private placement identity'
      using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', prior.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', prior.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', prior.oid, 'EXECUTE') then
    raise exception 'exact-slot migration requires the existing private placement ACL'
      using errcode = '55000';
  end if;
end;
$identity$;

create or replace function platform_private.cms_insert_pattern_instance(p_request jsonb)
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
  v_slot_key text;
  v_slot_path text;
  v_requested bigint;
  v_overrides jsonb;
  v_reservation platform_private.idempotency_records;
  v_revision platform_private.cms_entry_revisions%rowtype;
  v_entry platform_private.cms_content_entries%rowtype;
  v_pattern platform_private.cms_pattern_versions%rowtype;
  v_lineage uuid;
  v_digest text;
  v_nodes jsonb;
  v_roots integer;
  v_base bigint;
  v_now timestamptz;
  v_items jsonb;
  v_response jsonb;
  v_review_id uuid;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  v_correlation_id := platform_private.cms_correlation(p_request);
  v_slot_key := platform_private.cms_pattern_placement_check(p_request);
  v_slot_path := p_request->>'slotPath';
  v_requested := (p_request->>'expectedVersion')::bigint;
  v_overrides := p_request->'overrides';
  v_lineage := (p_request->>'patternId')::uuid;

  -- [0] the entry row; a revision or entry outside the caller's owner party is NOT_FOUND
  select * into v_revision from platform_private.cms_entry_revisions candidate
   where candidate.id = (p_request->>'revisionId')::uuid;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  select * into v_entry from platform_private.cms_content_entries entry_row
   where entry_row.id = v_revision.entry_id for update;
  if not found or not platform_private.cms_entry_tenant_visible(v_actor_id, v_entry.owner_party_id)
     or v_entry.owner_party_id is distinct from v_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- [1] the authority rows, the capability re-proved under the lock
  perform platform_private.cms_lock_entry_authority(v_actor_id, v_party_id, v_entry.id);
  if platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.editor', v_entry.id) is null
     and platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.author', v_entry.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  v_reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-02');
  if v_reservation.state = 'completed'::platform_private.idempotency_state then
    if v_reservation.response_ref->'safeHeaders' ? 'response' then
      return v_reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  if v_entry.version <> v_requested then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object(
        'expectedVersion', v_requested::text, 'currentVersion', v_entry.version::text)::text;
  end if;
  -- DEC-176: the entry's current draft revision, in effective state draft.  An archived (or held) entry answers
  -- revision_not_editable too: BE03c 375 is silent on entry lifecycle for CMS-03C-02 and the token is on the closed
  -- list of 1304 (decision of the fix pass; CMS-03C-05 answers INVALID_TRANSITION for its own, different, subject).
  if v_entry.lifecycle <> 'active' or v_entry.current_draft_revision_id is distinct from v_revision.id
     or platform_private.cms_revision_effective_state(v_revision.id) is distinct from 'draft' then
    raise exception 'revision_not_editable' using errcode = 'P0001', detail = '["/revisionId"]';
  end if;
  -- BE03c 1365 / AC-218 (root ruling, strict reading): the slotPath must exist in the revision's template, or be a
  -- root path when the entry has no template.  An entry with NO template accepts only the root path `/`; an entry WITH
  -- a template must name one of the template's slots and never `/`, even when a template slot is literally named root.
  if v_revision.template_version_id is null then
    if v_slot_path <> '/' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
    end if;
  elsif v_slot_path = '/' or not exists (
    select 1
      from platform_private.cms_template_versions template_row
      cross join lateral pg_catalog.jsonb_array_elements(template_row.slots) slot(value)
     where template_row.id = v_revision.template_version_id and v_slot_path = '/' || (slot.value->>'key')
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;

  -- the pinned version: an absent lineage is NOT_FOUND, an absent version of a known lineage is not active
  select * into v_pattern from platform_private.cms_pattern_versions candidate
   where candidate.owner_id = v_revision.owner_id and candidate.pattern_id = v_lineage
     and candidate.version = (p_request->>'patternVersion')::bigint;
  if not found then
    if exists (select 1 from platform_private.cms_pattern_versions known
                where known.owner_id = v_revision.owner_id and known.pattern_id = v_lineage) then
      raise exception 'pattern_version_not_active' using errcode = 'P0001', detail = '["/patternVersion"]';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- [3] the pinned version and every nested pinned version FOR SHARE, ascending id, state re-read under the lock
  perform 1
    from platform_private.cms_pattern_versions locked
   where locked.id = v_pattern.id
      or locked.id in (select closure.nested_row_id
                         from platform_private.cms_pattern_nested_closure(v_revision.owner_id, v_pattern.block_tree) closure
                        where closure.nested_row_id is not null)
   order by locked.id
     for share;
  select * into v_pattern from platform_private.cms_pattern_versions fresh where fresh.id = v_pattern.id;
  if v_pattern.state <> 'active' then
    raise exception 'pattern_version_not_active' using errcode = 'P0001', detail = '["/patternVersion"]';
  end if;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements_text(v_pattern.compatible_type_ids) listed(value)
     where pg_catalog.lower(listed.value) = pg_catalog.lower(v_entry.content_type_id::text)
  ) then
    raise exception 'pattern_incompatible' using errcode = 'P0001', detail = '["/patternId"]';
  end if;
  -- [4] the entry's content-type version row
  perform 1 from platform_private.cms_content_type_versions type_version
   where type_version.id = v_revision.schema_version_id for share;

  -- the digest is recomputed from the 03a registry; a client digest is an equality expectation only
  v_digest := platform_private.cms_pattern_registry_digest(v_revision.owner_id, v_pattern.block_tree);
  if p_request ? 'blockRegistryDigest' and p_request->>'blockRegistryDigest' <> v_digest then
    raise exception 'block_registry_digest_mismatch' using errcode = 'P0001', detail = '["/blockRegistryDigest"]';
  end if;

  -- the expansion, the 512-row and 248-octet bounds and the override keys (DEC-181, DEC-186)
  v_nodes := platform_private.cms_pattern_placement_plan(v_revision.owner_id, v_pattern, v_slot_path, v_overrides);
  select pg_catalog.count(*)::integer into v_roots
    from pg_catalog.jsonb_array_elements(v_nodes) item(value) where (item.value->>'isRoot')::boolean;
  -- (revision_id, path) is unique: a placement never overwrites, and nothing is written when any row collides
  if exists (
    select 1
      from platform_private.cms_composition_instances existing
      join pg_catalog.jsonb_array_elements(v_nodes) item(value)
        on (item.value->>'isRoot')::boolean
       and existing.path = case when v_slot_path = '/' then item.value->>'root' else v_slot_path || (item.value->>'root') end
     where existing.revision_id = v_revision.id
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;

  -- [5] the live editorial review rows of the revision
  perform 1 from platform_private.cms_editorial_reviews review_row
   where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
   order by review_row.id for update;
  -- DEC-185: one above the greatest position of the (revision, slot), of any state or version, else 0
  select coalesce(pg_catalog.max(existing.position)::bigint, -1) + 1 into v_base
    from platform_private.cms_composition_instances existing
   where existing.revision_id = v_revision.id and existing.slot_key = v_slot_key;
  if v_base + v_roots - 1 > 2147483647 then
    raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;

  v_now := pg_catalog.clock_timestamp();
  with roots as (
    select item.value as node_info, item.ordinality as seq
      from pg_catalog.jsonb_array_elements(v_nodes) with ordinality item(value, ordinality)
     where (item.value->>'isRoot')::boolean
  ), inserted as (
    insert into platform_private.cms_composition_instances (
      id, owner_id, state, version, created_at, updated_at, revision_id, path, slot_key, block_key, block_version,
      pattern_id, pattern_version, block_registry_digest, link_mode, props, bindings, parent_instance_id, created_by,
      position)
    select extensions.gen_random_uuid(), v_revision.owner_id, 'active', 1, v_now, v_now, v_revision.id,
           case when v_slot_path = '/' then root_row.node_info->>'root' else v_slot_path || (root_row.node_info->>'root') end,
           v_slot_key, root_row.node_info->'node'->>'blockKey', (root_row.node_info->'node'->>'blockVersion')::bigint,
           v_pattern.pattern_id, v_pattern.version, v_digest, p_request->>'linkMode',
           coalesce((select pg_catalog.jsonb_object_agg(override_item.key, override_item.value)
                       from pg_catalog.jsonb_each(v_overrides) override_item
                      where exists (select 1 from pg_catalog.jsonb_array_elements(v_nodes) placed(value)
                                     where placed.value->>'chain' = override_item.key
                                       and placed.value->>'root' = root_row.node_info->>'root')), '{}'::jsonb),
           '{}'::jsonb, null, v_actor_id, (v_base + (row_number() over (order by root_row.seq)) - 1)::integer
      from roots root_row
    returning *
  )
  select pg_catalog.jsonb_agg(platform_private.cms_composition_instance_resource(
           row(inserted.*)::platform_private.cms_composition_instances)
         order by inserted.position)
    into v_items
    from inserted;

  update platform_private.cms_content_entries entry_row
     set version = entry_row.version + 1, updated_at = v_now
   where entry_row.id = v_entry.id and entry_row.version = v_requested;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;
  -- AC-219: a composition write invalidates the revision's live review in the same transaction
  for v_review_id in
    select review_row.id from platform_private.cms_editorial_reviews review_row
     where review_row.revision_id = v_revision.id and review_row.state in ('open', 'approved')
     order by review_row.id
  loop
    perform platform_private.cms_invalidate_editorial_review(pg_catalog.jsonb_build_object(
      'reviewId', v_review_id, 'reasonCode', 'dependency_changed', 'correlationId', v_correlation_id,
      'actorId', v_actor_id));
  end loop;
  perform platform_private.cms_record_audit(
    'cms.composition.pattern.insert', v_actor_id, v_party_id, 'cms_composition_instance',
    (v_items->0->>'id')::uuid, 'CMS_PATTERN_PLACED', v_correlation_id);
  v_response := pg_catalog.jsonb_build_object('items', v_items, 'entryVersion', (v_requested + 1)::text);
  perform platform_private.cms_complete(v_reservation.id, (v_items->0->>'id')::uuid, 201, v_response);
  return v_response;
end;
$body$;

commit;
