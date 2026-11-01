-- Slice 12 lane dec206, cmsCompositionInstancesRead (DEC-206 as aligned to BE00 collection rules; BE03c route registry row 182, validation row 409
-- `cmsCompositionInstancesRead | entryId/cursor/limit`, schemas CompositionInstancesQuery / CompositionInstancePage, error matrix, catalog and authority
-- rows 1648, changelog 2026-10-22; tracker P2-S12-AC-269):
-- GET /api/v1/cms/entries/{entryId}/compositions, the protected read of an entry's current draft revision's composition instances.
--   platform_private.cms_list_composition_instances(p_request jsonb) returns jsonb           the keyset reader (this file; unsigned cursor)
--   platform_private.cms_list_composition_instances_signed(p_request jsonb) returns jsonb    verifies and signs the cursor (20261022050010)
--   platform_api.cms_list_composition_instances(p_request jsonb) returns jsonb               the Worker transport (20261022050010)
-- Private request: { entryId, cursor?, limit?, context, correlationId? }.  Answer: the strict CompositionInstancePage { revisionId, items, nextCursor }.
-- Order (BE00, as cmsRelatedContentRead and the selector): a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party
-- (UNAUTHENTICATED); STRICT VALIDATION of entryId (a UUID), of `limit` (an integer 1-50, default 25; the error matrix has no 422 for this read, so
-- a bad limit is a 400) and of the cursor's structure, before any authority or existence answer (400); an entry that is absent, owned by another
-- party or invisible to the caller is NOT_FOUND (one uniform answer); a visible entry on which the caller holds neither cms.author nor cms.editor by
-- ASSIGNMENT is `capability_missing` (403), exactly as CMS-03C-02 proves it (cms_authority_origin); then the cursor's binding to the route, entry,
-- draft revision, sort and the caller's user/acting context and its expiry (state- and clock-dependent, so after authority), every failure
-- INVALID_REQUEST (400, BE03c 409: "a tampered, expired or cross-context cursor is 400 without disclosing cursor internals"; the sibling reads' 409
-- is mapped to 400 by the signed wrapper); then the page.  The entry lifecycle is not constrained: a read has no lifecycle answer.
-- Page: the entry's current draft revision (cms_content_entries.current_draft_revision_id; none = an empty page with a null revision), the newest row
-- of each path in state draft, active or pending_diff (cms_revision_effective_composition, DEC-193: a path whose newest row is superseded or retired
-- is not listed, nor is any older version), in the order of the BE05c render plan's composition rows: template slot ordinal (0 without a template, 100000
-- for a slot the template does not declare), authored `position` (DEC-185), path bytewise, id.  The ordering expression is the render plan's own
-- (the live body is 20261016042500_cms_revision_render_plan_dec193.sql); the suite proves the two orders equal.  At most `limit` rows per page, each the
-- CompositionInstanceResource every composition write answers (cms_composition_instance_resource).
-- Cursor: the unsigned payload is the base64 JCS { queryHash, lastInstanceId, expiresAt }: queryHash binds the route, the sort, the contract version,
-- the actor, the acting party, the entry and the draft revision (the page size is NOT bound: BE03c 409 lists none), lastInstanceId is the id of the last
-- row answered, expiresAt is epoch seconds 24 hours after issue.  The signed wrapper seals it with the shared Vault helpers of CMS-03C-13 (domain
-- 'cms-03c-instances').  The cursor is positional, not a snapshot: the next page is the heads strictly after the key (slot ordinal, position, path) of
-- row lastInstanceId, which is stable for a path across all its versions, so a later version of the last path neither repeats nor skips a row.
-- Reads lock and write nothing.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_list_composition_instances(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_limit integer := 25;
  v_actor_id uuid;
  v_party_id uuid;
  v_entry platform_private.cms_content_entries%rowtype;
  v_revision platform_private.cms_entry_revisions%rowtype;
  v_slots jsonb := '[]'::jsonb;
  v_cursor jsonb;
  v_hash text;
  v_cursor_row platform_private.cms_composition_instances%rowtype;
  v_rank integer;
  v_ids uuid[];
  v_items jsonb;
  v_next text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['entryId']::text[], array['entryId', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  -- Strict validation before any concealment: a malformed path value or cursor is 400 for every caller.
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request ? 'limit' then
    -- The numeric casts are reached only for a JSON number: SQL does not order the operands of OR.
    if pg_catalog.jsonb_typeof(p_request->'limit') is distinct from 'number' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 50 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    v_limit := (p_request->>'limit')::numeric::integer;
  end if;
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'string'
       or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      v_cursor := pg_catalog.convert_from(pg_catalog.decode(p_request->>'cursor', 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if pg_catalog.jsonb_typeof(v_cursor) is distinct from 'object'
       or not platform_private.cms_exact_keys(
         v_cursor, array['queryHash', 'lastInstanceId', 'expiresAt']::text[], array['queryHash', 'lastInstanceId', 'expiresAt']::text[])
       or pg_catalog.jsonb_typeof(v_cursor->'queryHash') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_cursor->'lastInstanceId') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_cursor->'expiresAt') is distinct from 'string'
       or v_cursor->>'queryHash' !~ '^[0-9a-f]{64}$'
       or platform_private.cms_valid_uuid(v_cursor->>'lastInstanceId') is not true
       or v_cursor->>'expiresAt' !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end if;

  select * into v_entry from platform_private.cms_content_entries entry_row
   where entry_row.id = (p_request->>'entryId')::uuid;
  if not found or v_entry.owner_party_id is distinct from v_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, v_entry.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.editor', v_entry.id) is null
     and platform_private.cms_authority_origin(v_actor_id, v_party_id, 'cms.author', v_entry.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  if v_entry.current_draft_revision_id is null then
    -- No draft revision: nothing to list, and no cursor can have been issued for it.
    if v_cursor is not null then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object('revisionId', null, 'items', '[]'::jsonb, 'nextCursor', null);
  end if;
  select * into v_revision from platform_private.cms_entry_revisions revision_row
   where revision_row.id = v_entry.current_draft_revision_id;
  if not found then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if v_revision.template_version_id is not null then
    select coalesce(template_row.slots, '[]'::jsonb) into v_slots
      from platform_private.cms_template_versions template_row where template_row.id = v_revision.template_version_id;
  end if;

  v_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'route', 'cmsCompositionInstancesRead', 'sort', 'slot-ordinal,position,path,id', 'contractVersion', 'cms.03c.composition.v1',
    'actorId', v_actor_id::text, 'actingPartyId', v_party_id::text, 'entryId', v_entry.id::text, 'revisionId', v_revision.id::text));
  if v_cursor is not null then
    if v_cursor->>'queryHash' is distinct from v_hash
       or (v_cursor->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    select * into v_cursor_row from platform_private.cms_composition_instances cursor_instance
     where cursor_instance.id = (v_cursor->>'lastInstanceId')::uuid and cursor_instance.revision_id = v_revision.id;
    if not found then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    v_rank := case when v_revision.template_version_id is null then 0 else coalesce((
      select slot.ordinality::integer
        from pg_catalog.jsonb_array_elements(v_slots) with ordinality slot(value, ordinality)
       where slot.value->>'key' = v_cursor_row.slot_key), 100000) end;
  end if;

  -- One more than a page is read to know whether a successor exists.
  select coalesce(pg_catalog.array_agg(limited.id order by limited.ord), array[]::uuid[]) into v_ids
    from (
      select planned.id,
             pg_catalog.row_number() over (
               order by planned.rank_no, planned.position, planned.path collate "C", planned.id) as ord
        from (
          select head.id, head.position, head.path,
                 case when v_revision.template_version_id is null then 0 else coalesce((
                   select slot.ordinality::integer
                     from pg_catalog.jsonb_array_elements(v_slots) with ordinality slot(value, ordinality)
                    where slot.value->>'key' = head.slot_key
                 ), 100000) end as rank_no
            from platform_private.cms_revision_effective_composition(v_revision.id) head
        ) planned
       where v_cursor_row.id is null
          or planned.rank_no > v_rank
          or (planned.rank_no = v_rank and planned.position > v_cursor_row.position)
          or (planned.rank_no = v_rank and planned.position = v_cursor_row.position
              and planned.path collate "C" > v_cursor_row.path collate "C")
       order by ord
       limit v_limit + 1
    ) limited;

  select coalesce(pg_catalog.jsonb_agg(
           platform_private.cms_composition_instance_resource(instance_row)
           order by pg_catalog.array_position(v_ids, instance_row.id)), '[]'::jsonb) into v_items
    from platform_private.cms_composition_instances instance_row
   where instance_row.id = any (v_ids[1:v_limit]);

  if pg_catalog.cardinality(v_ids) > v_limit then
    v_next := pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', v_hash, 'lastInstanceId', v_ids[v_limit]::text,
        'expiresAt', (pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())) + 86400)::bigint::text)),
      'utf8'), 'base64'), E'\n', '');
  end if;
  return pg_catalog.jsonb_build_object('revisionId', v_revision.id, 'items', v_items, 'nextCursor', v_next);
end;
$body$;

comment on function platform_private.cms_list_composition_instances(jsonb) is
  'cmsCompositionInstancesRead (DEC-206) internal keyset reader (unsigned cursor; reachable only through cms_list_composition_instances_signed): an assigned author or editor lists the newest draft, active and pending_diff row of each path of the entry''s current draft revision as CompositionInstanceResource items in render-plan order (slot ordinal, position, path bytewise, id), at most limit (1-50, default 25) per page, with a cursor bound to the route, entry, draft revision, sort and user/acting context that expires within 24 hours (any other cursor is INVALID_REQUEST); a visible entry without edit is capability_missing, a hidden or absent one NOT_FOUND. A read: writes and locks nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_composition_instances(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_composition_instances(jsonb) from public, anon, authenticated, service_role;

-- Privilege closure: every function the reader uses directly must be available to the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.cms_valid_uuid(text)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)', 'platform_private.cms_authority_origin(uuid,uuid,text,uuid)',
    'platform_private.cms_jcs(jsonb)', 'platform_private.cms_jcs_sha256(jsonb)',
    'platform_private.cms_revision_effective_composition(uuid)',
    'platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'composition-instances reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

grant select on table platform_private.cms_content_entries, platform_private.cms_entry_revisions,
  platform_private.cms_template_versions, platform_private.cms_composition_instances to wejammin_cms_definer;

commit;
