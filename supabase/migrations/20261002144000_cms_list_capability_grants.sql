-- CMS-03A-18 (DEC-119): the protected owner list of CMS capability grants.  A
-- projection-only RPC: receipt-derived owner, a current binding but no step-up,
-- rows limited to the owner's organization, derived active|lapsed|revoked state,
-- strict query, keyset pagination bound to the exact query by a hash, and no
-- idempotency reservation, audit, outbox, event or row write on success or
-- failure.  Forward-only.
begin;

create or replace function platform_private.cms_list_capability_grants(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  subject_filter uuid;
  capability_filter text := nullif(p_request->>'capability', '');
  state_filter text := nullif(p_request->>'state', '');
  sort_value text := coalesce(nullif(p_request->>'sort', ''), 'updatedAt');
  direction_value text := coalesce(nullif(p_request->>'direction', ''), 'desc');
  limit_value integer;
  cursor_text text := nullif(p_request->>'cursor', '');
  cursor_value jsonb;
  cursor_sort timestamptz;
  cursor_id uuid;
  query_hash text;
  page_ids uuid[];
  page_sorts timestamptz[];
  fetched integer;
  items jsonb := '[]'::jsonb;
  next_cursor text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if not platform_private.cms_exact_keys(
    p_request,
    array[]::text[],
    array['subjectPersonId','capability','state','limit','cursor','sort','direction',
          'context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_grant_owner(actor_id, acting_party_id);
  perform platform_private.cms_review_binding(p_request, actor_id, acting_party_id, false);
  begin
    limit_value := coalesce(nullif(p_request->>'limit', '')::integer, 25);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end;
  if p_request ? 'subjectPersonId' then
    if pg_catalog.jsonb_typeof(p_request->'subjectPersonId') <> 'string'
       or not platform_private.cms_valid_uuid(p_request->>'subjectPersonId') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    subject_filter := (p_request->>'subjectPersonId')::uuid;
  end if;
  if limit_value not between 1 and 100
     or (capability_filter is not null and not platform_private.cms_grantable_capability(capability_filter))
     or (state_filter is not null and state_filter not in ('active', 'lapsed', 'revoked'))
     or sort_value not in ('updatedAt', 'validThrough')
     or direction_value not in ('asc', 'desc')
     or (cursor_text is not null and pg_catalog.octet_length(cursor_text) not between 1 and 512) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'ownerId', acting_party_id, 'subjectPersonId', subject_filter,
    'capability', capability_filter, 'state', state_filter, 'limit', limit_value,
    'sort', sort_value, 'direction', direction_value
  ));
  if cursor_text is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         cursor_value,
         array['queryHash','lastSort','lastId']::text[],
         array['queryHash','lastSort','lastId']::text[]
       )
       or cursor_value->>'queryHash' is distinct from query_hash
       or not platform_private.cms_valid_uuid(cursor_value->>'lastId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      cursor_sort := (cursor_value->>'lastSort')::timestamptz;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    cursor_id := (cursor_value->>'lastId')::uuid;
  end if;
  select pg_catalog.array_agg(ordered.id order by ordered.rn),
         pg_catalog.array_agg(ordered.sort_ts order by ordered.rn)
    into page_ids, page_sorts
    from (
      select keyed.id, keyed.sort_ts,
             pg_catalog.row_number() over (
               order by
                 case when direction_value = 'asc' then keyed.sort_ts end asc,
                 case when direction_value = 'desc' then keyed.sort_ts end desc,
                 case when direction_value = 'asc' then keyed.id end asc,
                 case when direction_value = 'desc' then keyed.id end desc
             ) as rn
        from (
          select grant_row.id,
                 case sort_value
                   when 'validThrough' then (grant_row.valid_through::timestamp at time zone 'UTC')
                   else grant_row.updated_at
                 end as sort_ts
            from platform_private.cms_capability_grants grant_row
           where grant_row.owner_id = acting_party_id
             and (subject_filter is null or grant_row.subject_person_ref = subject_filter)
             and (capability_filter is null or grant_row.capability_code = capability_filter)
             and (state_filter is null
                  or platform_private.cms_capability_grant_state(grant_row.state, grant_row.valid_through) = state_filter)
        ) keyed
       where cursor_text is null
          or case when direction_value = 'desc'
                  then (keyed.sort_ts, keyed.id) < (cursor_sort, cursor_id)
                  else (keyed.sort_ts, keyed.id) > (cursor_sort, cursor_id) end
    ) ordered
   where ordered.rn <= limit_value + 1;
  fetched := coalesce(pg_catalog.cardinality(page_ids), 0);
  for index_value in 1 .. least(fetched, limit_value) loop
    items := items || pg_catalog.jsonb_build_array(
      platform_private.cms_capability_grant_resource(page_ids[index_value]));
  end loop;
  if fetched > limit_value then
    next_cursor := replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', query_hash,
        'lastSort', page_sorts[limit_value],
        'lastId', page_ids[limit_value]
      )), 'utf8'), 'base64'), E'\n', '');
  end if;
  return pg_catalog.jsonb_build_object(
    'items', items,
    'nextCursor', to_jsonb(next_cursor)
  );
end;
$body$;

create or replace function platform_api.cms_list_capability_grants(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_list_capability_grants(p_request)
$body$;

revoke all on function platform_private.cms_list_capability_grants(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_capability_grants(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_capability_grants(jsonb) to service_role;

commit;
