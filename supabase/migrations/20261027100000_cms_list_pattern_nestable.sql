-- Slice 12 lane nestable-read, cmsPatternNestableRead (DEC-196, root cascade DEC-232; BE03c route row 184, validation row 413, schema
-- PatternNestableQuery 1194, error row 1427, CMS-03C-13 paragraph 1528, authority row 1665, RPC inventory 1633; criteria P2-S12-AC-105, AC-261):
-- GET /api/v1/cms/patterns/nestable, the designer-facing list of pattern versions that can be a nested `pattern` node of a pattern.
--   platform_private.cms_list_pattern_nestable(p_request jsonb)          the unsigned keyset reader (this file)
--   platform_private.cms_list_pattern_nestable_signed(p_request jsonb)   verifies and signs the cursor (20261027100010)
--   platform_api.cms_list_pattern_nestable(p_request jsonb)              the Worker transport (20261027100010)
-- Private request: { contentTypeId: [uuid, ...], cursor?, limit?, context, correlationId? } - the PatternNestableQuery plus the server context.
-- Answer: the strict PatternSelectorPage { items, nextCursor, pageVersion } itself (the same page as CMS-03C-13).
-- Order (BE00, as the CMS-03C-13 reader 20261014140300): a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party
-- (UNAUTHENTICATED); then STRICT VALIDATION before any authority or concealment (contentTypeId not an array of 1 or more unique UUIDs, or a malformed
-- cursor: INVALID_REQUEST, 400; more than 64 types: VALIDATION_FAILED with the pointer "/contentTypeId"; limit not an integer 1 .. 50, default 25:
-- VALIDATION_FAILED with "/limit"), so a malformed request from a caller without access is 400/422, never 403/404; a caller who cannot read the
-- owner party gets NOT_FOUND; a reader without cms.template_designer in the owner party is `capability_missing` (403; the author and editor
-- capabilities that select a pattern for an entry are NOT enough, DEC-196); a requested content type outside the caller's owner scope, or absent,
-- is NOT_FOUND for the whole request (no partial answer); then the cursor's binding (foreign-bound or expired: INVALID_REQUEST, BE03c 184
-- "tamper, expiry or cross-context reuse 400", BE00 00-infrastructure 491 - not the CMS-03C-13 409).
-- Page: the ACTIVE pattern versions of the caller's owner party whose compatibleTypeIds contain EVERY requested type (the DEC-181 nested-node rule
-- CMS-03C-12 enforces as nested_pattern_not_active; case-insensitive as the save compares), ordered (patternKey ASC bytewise, patternVersion DESC);
-- a draft, review, approved, scheduled, superseded, retired or blocked version, a version missing any requested type and another owner's are never
-- listed.  It does NOT exclude the lineage being edited: a cycle stays the save's 409 pattern_cycle (BE03c 1528).  The cursor is the base64 JCS
-- payload { queryHash, lastPatternKey, lastPatternVersion, expiresAt }; queryHash binds the route, the actor, the acting party, the SET of
-- requested types (sorted, so their order is irrelevant) and the page size.  pageVersion is the high-water update instant, in UTC microseconds, of
-- ALL the owner's versions listing every requested type in any state ("1" when there is none), so activating, superseding or retiring a listed
-- version moves it.  Reads lock and write nothing.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_list_pattern_nestable(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_person uuid;
  v_limit integer := 25;
  v_types uuid[];
  v_member jsonb;
  v_hash text;
  v_cursor_json jsonb;
  v_cursor_key text;
  v_cursor_version bigint;
  v_rows jsonb;
  v_items jsonb := '[]'::jsonb;
  v_element jsonb;
  v_seen integer := 0;
  v_more boolean := false;
  v_last_key text;
  v_last_version bigint;
  v_water timestamptz;
  v_next text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['contentTypeId', 'context']::text[],
       array['contentTypeId', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  -- BE00 order: strict validation before party concealment and capability.  A malformed type set, limit or cursor is 400/422 before any 404/403.
  -- (the CASE is parenthesised: PL/pgSQL ends an IF condition at the first THEN token it meets outside parentheses)
  if (case when pg_catalog.jsonb_typeof(p_request->'contentTypeId') = 'array'
           then pg_catalog.jsonb_array_length(p_request->'contentTypeId') = 0 else true end) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  for v_member in select elem.value from pg_catalog.jsonb_array_elements(p_request->'contentTypeId') elem(value) loop
    if pg_catalog.jsonb_typeof(v_member) is distinct from 'string'
       or platform_private.cms_valid_uuid(v_member #>> '{}') is not true then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end loop;
  select pg_catalog.array_agg((elem.value #>> '{}')::uuid order by (elem.value #>> '{}')::uuid)
    into v_types
    from pg_catalog.jsonb_array_elements(p_request->'contentTypeId') elem(value);
  if pg_catalog.cardinality(v_types) <> (select pg_catalog.count(distinct unique_type) from pg_catalog.unnest(v_types) unique_type) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.cardinality(v_types) > 64 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/contentTypeId"]';
  end if;
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/limit"]';
    end if;
    v_limit := (p_request->>'limit')::integer;
  end if;
  v_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'route', 'cmsPatternNestableRead', 'sort', 'patternKey:asc,patternVersion:desc', 'actorId', v_actor_id::text, 'actingPartyId', v_party_id::text,
    'contentTypeIds', (select pg_catalog.jsonb_agg(sorted_type::text order by sorted_type) from pg_catalog.unnest(v_types) sorted_type),
    'limit', v_limit::text));
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string' or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      v_cursor_json := pg_catalog.convert_from(pg_catalog.decode(p_request->>'cursor', 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         v_cursor_json, array['queryHash', 'lastPatternKey', 'lastPatternVersion', 'expiresAt']::text[],
         array['queryHash', 'lastPatternKey', 'lastPatternVersion', 'expiresAt']::text[])
       or coalesce(v_cursor_json->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or coalesce(v_cursor_json->>'lastPatternKey', '') !~ '^[a-z][a-z0-9-]{1,63}$'
       or coalesce(v_cursor_json->>'lastPatternVersion', '') !~ '^[1-9][0-9]{0,9}$'
       or coalesce(v_cursor_json->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end if;
  begin
    v_person := platform_private.identity_actor_person(v_actor_id);
  exception when others then
    v_person := null;
  end;
  if v_person is null or not platform_private.cms_entry_tenant_visible(v_actor_id, v_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(v_party_id, v_person, 'cms.template_designer') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  -- Every requested type must be a content type of the caller's owner scope; one hidden or absent type is the policy-safe 404 for the whole request.
  if (select pg_catalog.count(*) from platform_private.cms_content_types content_type
       where content_type.id = any (v_types) and content_type.owner_id = v_party_id) <> pg_catalog.cardinality(v_types) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_cursor_json is not null then
    -- BE03c 184 / BE00 491: a foreign-bound or expired cursor is 400 without disclosing cursor internals.
    if v_cursor_json->>'queryHash' is distinct from v_hash
       or (v_cursor_json->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    v_cursor_key := v_cursor_json->>'lastPatternKey';
    v_cursor_version := (v_cursor_json->>'lastPatternVersion')::bigint;
  end if;

  -- (V14-14) the high-water instant is read BEFORE the page, so a concurrent activation can only leave the validator older than the items.
  select pg_catalog.max(version_row.updated_at) into v_water
    from platform_private.cms_pattern_versions version_row
   where version_row.owner_id = v_party_id
     and not exists (
       select 1 from pg_catalog.unnest(v_types) required_type(id)
        where not exists (select 1 from pg_catalog.jsonb_array_elements_text(version_row.compatible_type_ids) listed(value)
                           where pg_catalog.lower(listed.value) = required_type.id::text));

  select coalesce(pg_catalog.jsonb_agg(page_row.item order by page_row.pattern_key collate "C", page_row.version desc), '[]'::jsonb)
    into v_rows
    from (
      select version_row.pattern_key, version_row.version,
             pg_catalog.jsonb_build_object(
               'patternId', version_row.pattern_id, 'patternVersionId', version_row.id, 'patternKey', version_row.pattern_key,
               'patternVersion', version_row.version, 'nodeCount', version_row.node_count,
               'blockRegistryDigest', pg_catalog.btrim(version_row.block_registry_digest::text)) as item
        from platform_private.cms_pattern_versions version_row
       where version_row.owner_id = v_party_id and version_row.state = 'active'
         and not exists (
           select 1 from pg_catalog.unnest(v_types) required_type(id)
            where not exists (select 1 from pg_catalog.jsonb_array_elements_text(version_row.compatible_type_ids) listed(value)
                               where pg_catalog.lower(listed.value) = required_type.id::text))
         and (v_cursor_key is null
              or version_row.pattern_key collate "C" > v_cursor_key collate "C"
              or (version_row.pattern_key = v_cursor_key and version_row.version < v_cursor_version))
       order by version_row.pattern_key collate "C", version_row.version desc
       limit v_limit + 1
    ) page_row;
  for v_element in select item.value from pg_catalog.jsonb_array_elements(v_rows) item(value) loop
    if v_seen >= v_limit then
      v_more := true;
      exit;
    end if;
    v_seen := v_seen + 1;
    v_last_key := v_element->>'patternKey';
    v_last_version := (v_element->>'patternVersion')::bigint;
    v_items := v_items || pg_catalog.jsonb_build_array(v_element);
  end loop;

  if v_more then
    v_next := pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', v_hash, 'lastPatternKey', v_last_key, 'lastPatternVersion', v_last_version::text,
        'expiresAt', (pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())) + 86400)::bigint::text)),
      'utf8'), 'base64'), E'\n', '');
    -- A cursor that cannot fit the 512-character contract is withheld rather than truncated.
    if pg_catalog.octet_length(v_next) > 512 then
      v_next := null;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'items', v_items,
    'nextCursor', v_next,
    'pageVersion', case when v_water is null then '1'
                        else pg_catalog.floor(extract(epoch from v_water) * 1000000)::bigint::text end);
end;
$body$;

comment on function platform_private.cms_list_pattern_nestable(jsonb) is
  'cmsPatternNestableRead (DEC-196) internal keyset reader (unsigned cursor; reachable only through cms_list_pattern_nestable_signed). A verified cms.template_designer of the owner party names 1-64 unique content types of that party and lists the active pattern versions of the party whose compatibleTypeIds contain every one of them, ordered (patternKey bytewise ASC, patternVersion DESC), as PatternSelectorPage items; a cursor fault is INVALID_REQUEST. Writes and locks nothing. Private.';

-- SEC-2: the reader names forced-RLS CMS tables, so the definer role owns it (as the CMS-03C-13 reader).  The signed wrapper and the API wrapper
-- stay with the migration owner, which alone may call the Vault cursor helpers.
grant select on table platform_private.cms_pattern_versions, platform_private.cms_content_types to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_pattern_nestable(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_pattern_nestable(jsonb) from public, anon, authenticated, service_role;

-- Privilege closure: every function the reader calls directly must be executable by the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.identity_actor_person(uuid)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)', 'platform_private.cms_person_holds_capability(uuid,uuid,text)',
    'platform_private.cms_valid_uuid(text)', 'platform_private.cms_jcs_sha256(jsonb)', 'platform_private.cms_jcs(jsonb)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'nestable reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
