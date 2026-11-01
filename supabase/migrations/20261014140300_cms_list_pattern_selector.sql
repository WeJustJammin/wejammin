-- Slice 12 lane pattern-updates, CMS-03C-13 (BE03c route row 175, validation row 398, Pattern versions 1363, authorization 1474,
-- error rows 1266; contract PatternSelectorQuery / PatternSelectorPage; tracker P2-S12-AC-106 .. AC-111):
-- GET /api/v1/cms/patterns/selector, the author-facing list of pattern versions an entry may use.
--   platform_private.cms_list_pattern_selector(p_request jsonb)          the unsigned keyset reader (this file)
--   platform_private.cms_list_pattern_selector_signed(p_request jsonb)   verifies and signs the cursor (20261014140310)
--   platform_api.cms_list_pattern_selector(p_request jsonb)              the Worker transport (20261014140310)
-- Private request: { contentTypeId, cursor?, limit?, context, correlationId? }.  Answer: the strict PatternSelectorPage
-- { items, nextCursor, pageVersion } itself.
-- Order (BE00, BE03c 175: parse first, concealment unchanged): a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party
-- (UNAUTHENTICATED); then STRICT VALIDATION of the query values, before any authority or concealment (contentTypeId not a UUID or a malformed cursor:
-- INVALID_REQUEST, 400; limit not an integer 1 .. 50, default 25: VALIDATION_FAILED with the member pointer), so a malformed request from a caller
-- without access is 400, never 403/404; a caller who cannot read the owner party gets NOT_FOUND; a reader holding neither cms.author nor cms.editor
-- in the owner party is `capability_missing` (403; the designer capability that defines patterns is NOT enough, and no entry assignment is needed to
-- select one); a content type outside the caller's owner scope (or absent) is NOT_FOUND; then the cursor's binding (foreign-bound or expired:
-- CONFLICT).
-- Page: the ACTIVE pattern versions of the caller's owner party whose compatibleTypeIds contain the content type, ordered
-- (patternKey ASC bytewise, patternVersion DESC); a draft, review, approved, scheduled, superseded, retired or blocked version, an incompatible
-- one and another owner's are never listed.  The cursor is the base64 JCS payload { queryHash, lastPatternKey, lastPatternVersion, expiresAt };
-- queryHash binds the actor, acting party, content type and page size.  pageVersion is the high-water update instant, in UTC microseconds, of
-- ALL the owner's versions compatible with the type in any state ("1" when there is none), so activating, superseding or retiring a listed
-- version moves it and it validates the list (a retirement removes a row without touching a remaining one).  Reads lock and write nothing.
-- Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_list_pattern_selector(p_request jsonb)
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
  v_type uuid;
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
  -- BE00 order (BE03c 175): session, acting context, STRICT VALIDATION, then party concealment and capability.  A malformed contentTypeId, limit or
  -- cursor is 400/422 before any 404/403; a well-formed request is concealed and authorized exactly as before.  The cursor's BINDING (queryHash,
  -- expiry: CONFLICT) is state-dependent and is judged after authority.
  if pg_catalog.jsonb_typeof(p_request->'contentTypeId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'contentTypeId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_type := (p_request->>'contentTypeId')::uuid;
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/limit"]';
    end if;
    v_limit := (p_request->>'limit')::integer;
  end if;
  v_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', v_actor_id::text, 'actingPartyId', v_party_id::text, 'contentTypeId', v_type::text, 'limit', v_limit::text));
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
  if not (platform_private.cms_person_holds_capability(v_party_id, v_person, 'cms.author')
          or platform_private.cms_person_holds_capability(v_party_id, v_person, 'cms.editor')) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  if not exists (select 1 from platform_private.cms_content_types content_type
                  where content_type.id = v_type and content_type.owner_id = v_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_cursor_json is not null then
    if v_cursor_json->>'queryHash' is distinct from v_hash
       or (v_cursor_json->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    v_cursor_key := v_cursor_json->>'lastPatternKey';
    v_cursor_version := (v_cursor_json->>'lastPatternVersion')::bigint;
  end if;

  select coalesce(pg_catalog.jsonb_agg(page_row.item order by page_row.pattern_key collate "C", page_row.version desc), '[]'::jsonb)
    into v_rows
    from (
      select version_row.pattern_key, version_row.version,
             pg_catalog.jsonb_build_object(
               'patternId', version_row.pattern_id, 'patternVersionId', version_row.id, 'patternKey', version_row.pattern_key,
               'patternVersion', version_row.version, 'nodeCount', version_row.node_count,
               'blockRegistryDigest', pg_catalog.btrim(version_row.block_registry_digest::text),
               '_water', version_row.updated_at) as item
        from platform_private.cms_pattern_versions version_row
       where version_row.owner_id = v_party_id and version_row.state = 'active'
         and exists (select 1 from pg_catalog.jsonb_array_elements_text(version_row.compatible_type_ids) listed(value)
                      where pg_catalog.lower(listed.value) = v_type::text)
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
    v_items := v_items || pg_catalog.jsonb_build_array(v_element - '_water');
  end loop;

  select pg_catalog.max(version_row.updated_at) into v_water
    from platform_private.cms_pattern_versions version_row
   where version_row.owner_id = v_party_id
     and exists (select 1 from pg_catalog.jsonb_array_elements_text(version_row.compatible_type_ids) listed(value)
                  where pg_catalog.lower(listed.value) = v_type::text);

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

comment on function platform_private.cms_list_pattern_selector(jsonb) is
  'CMS-03C-13 internal keyset reader (unsigned cursor; reachable only through cms_list_pattern_selector_signed). A verified author or editor lists the active pattern versions of the owner party compatible with a content type of that party, ordered (patternKey bytewise ASC, patternVersion DESC). Writes and locks nothing. Private.';

-- SEC-2: the reader names forced-RLS CMS tables, so the definer role owns it.  The signed wrapper and the API wrapper stay with the
-- migration owner, which alone may call the Vault cursor helpers.
grant select on table platform_private.cms_pattern_versions, platform_private.cms_content_types to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_pattern_selector(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_pattern_selector(jsonb) from public, anon, authenticated, service_role;

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
      raise exception 'selector reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
