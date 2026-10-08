-- Slice 10 CMS-03B-13 entry list, authorized keyset (lane H, wave 2; Codex
-- adversarial review H4; P2-S10-AC-035/097/098).  platform_private.cms_list_entries
-- (latest definition 20261005011200) walked EVERY active entry of the database in
-- (updated_at, id) order and tested the caller's authority per row in PL/pgSQL,
-- concealing unauthorized rows with `continue`: a caller with no assignments forced
-- a scan of the whole table, an empty page carried no continuation, and the cost
-- leaked the size of the hidden population.  The reader now drives the page from the
-- caller's authorized relation (their active assignments whose capability is proven
-- at grant level), joins the entries and the current draft revision in SQL and
-- applies LIMIT limit + 1; the work depends on the authorized population and the
-- page, not on the hidden population.  Only the keyset walk changed: the request
-- validation, the signed-cursor structural/binding classes (DEC-140), the item
-- projection, the cursor and the page version are the 20261005011200 definition;
-- signature, SECURITY DEFINER attributes, search_path, owner and grants are
-- unchanged (CREATE OR REPLACE).  The index-assisted access path is the existing
-- cms_entry_assignments_assignee_idx (assignee_person_id, state), the entry primary
-- key and the current-draft revision primary key; the bounded-work guard is
-- supabase/tests/phase_02_slice_10_entry_list_authorized_keyset.sql.  Each item also
-- carries `entryLifecycle` and `entryUpdatedAt` (DEC-145, lane G contract).
-- Forward-only.
begin;

create or replace function platform_private.cms_list_entries(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  actor_id uuid;
  acting_party_id uuid;
  requested_state text;
  requested_content_type_id uuid;
  limit_value integer := 25;
  cursor_text text;
  cursor_value jsonb;
  cursor_expires bigint;
  cursor_updated_at timestamptz;
  cursor_entry_id uuid;
  query_hash text;
  resolved_person_id uuid;
  granted_capabilities text[];
  page_row record;
  rows_seen integer := 0;
  has_more boolean := false;
  page_items jsonb := '[]'::jsonb;
  page_max_updated timestamptz;
  next_cursor text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Request shape: an optional filter/window only.  context and correlationId
  -- are transport control fields, never authority.  Any other key -- including
  -- an ownership or capability assertion -- has no slot and is refused before
  -- any row is read, so the filter allowlist is exactly state and
  -- contentTypeId.
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array[]::text[],
       array[
         'cursor', 'limit', 'state', 'contentTypeId', 'context', 'correlationId'
       ]::text[]
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- state is a closed EntryRevisionState and contentTypeId is a plain UUID.
  -- Both are query bounds, not authority claims.
  if p_request ? 'state' and p_request->'state' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'state') <> 'string'
       or coalesce(p_request->>'state', '') not in (
         'draft', 'submitted', 'approved', 'rejected', 'scheduled', 'published'
       ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    requested_state := p_request->>'state';
  end if;

  if p_request ? 'contentTypeId' and p_request->'contentTypeId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'contentTypeId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    requested_content_type_id := (p_request->>'contentTypeId')::uuid;
  end if;

  -- limit is a query bound: an out-of-range window is a typed refusal, never a
  -- silent clamp.  The default is 25 and the cap is 50.
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric
            <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1
       or (p_request->>'limit')::numeric > 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    limit_value := (p_request->>'limit')::integer;
  end if;

  -- Unsigned keyset payload: {queryHash, lastUpdatedAt, lastEntryId,
  -- expiresAt}.  queryHash binds the cursor to the exact actor, acting party,
  -- filters and window, so a cursor cannot be replayed against another reading
  -- scope.  The signed wrapper adds keyId and signature around this payload.
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', case when actor_id is null then null else actor_id::text end,
    'actingPartyId', case
      when acting_party_id is null then null else acting_party_id::text end,
    'state', requested_state,
    'contentTypeId', case
      when requested_content_type_id is null then null
      else requested_content_type_id::text end,
    'limit', limit_value::text
  ));

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string'
       or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_text := p_request->>'cursor';

    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(cursor_text, 'base64'), 'utf8'
      )::jsonb;
    exception
      when others then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;

    if not platform_private.cms_exact_keys(
      cursor_value,
      array['queryHash', 'lastUpdatedAt', 'lastEntryId', 'expiresAt']::text[],
      array['queryHash', 'lastUpdatedAt', 'lastEntryId', 'expiresAt']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- DEC-140 (P2-S10-AC-035/097/098): the same two classes as the signed
    -- envelope.  A structural fault in the keyset payload (a non-hex queryHash,
    -- a non-UUID lastEntryId, a malformed lastUpdatedAt or expiresAt) is a 400
    -- INVALID_REQUEST; a well-formed cursor bound to another actor, party,
    -- filter set or window, or an expired one, is a 409 CONFLICT.  Both are
    -- typed P0001 refusals so a forged cursor is never silently ignored.
    if coalesce(cursor_value->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or not platform_private.cms_valid_uuid(cursor_value->>'lastEntryId')
       or coalesce(cursor_value->>'lastUpdatedAt', '')
            !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if cursor_value->>'queryHash' is distinct from query_hash then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    begin
      cursor_updated_at := (cursor_value->>'lastUpdatedAt')::timestamptz;
    exception
      when others then
        raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    cursor_expires := (cursor_value->>'expiresAt')::bigint;
    cursor_entry_id := (cursor_value->>'lastEntryId')::uuid;

    if cursor_expires <= pg_catalog.floor(
         pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
       )::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- Authorized keyset (Codex adversarial review H4).  The page is driven from the
  -- caller's OWN authorized relation, never from the entry table: the active
  -- assignments of the server-resolved person, in the acting party, whose
  -- capability (cms.editor or cms.author) is proven at grant level (registered key,
  -- confirmed tenure, active grant -- the same cms_authority_origin proof the old
  -- per-row check used, evaluated once with no entry).  The entries and their
  -- current draft revision are joined in SQL, so the lifecycle, content-type,
  -- state and keyset predicates are index-assisted filters on authorized rows only
  -- and LIMIT limit + 1 bounds the page.  The work therefore depends on the
  -- caller's authorized population and the page, never on the hidden population:
  -- a caller with nothing visible reads no entry row, gets an empty page and no
  -- cursor, and cannot infer the size of the hidden population from latency or
  -- from the page shape.  Descending (updated_at, entry id); the keyset predicate
  -- is exclusive of the cursor position.
  begin
    resolved_person_id := platform_private.identity_actor_person(actor_id);
  exception
    when others then
      resolved_person_id := null;
  end;
  granted_capabilities := array(
    select capability.key
    from pg_catalog.unnest(array['cms.editor', 'cms.author']::text[]) as capability(key)
    where platform_private.cms_authority_origin(
      actor_id, acting_party_id, capability.key, null
    ) is not null
  );

  if resolved_person_id is not null and cardinality(granted_capabilities) > 0 then
    for page_row in
      with authorized as materialized (
        select distinct assignment.entry_id
        from platform_private.cms_entry_assignments assignment
        where assignment.assignee_person_id = resolved_person_id
          and assignment.state = 'active'
          and assignment.owner_id = acting_party_id
          and assignment.capability_key = any(granted_capabilities)
      )
      select candidate.id as entry_id,
             candidate.updated_at as entry_updated_at,
             candidate.lifecycle as entry_lifecycle,
             revision.id as revision_id,
             revision.revision_number as revision_number,
             revision.locale as revision_locale,
             revision.state as revision_state,
             revision.payload_hash as revision_payload_hash,
             revision.schema_version_id as revision_schema_version_id,
             revision.created_at as revision_created_at,
             revision.author_person_id as revision_author_person_id
      from authorized
      join platform_private.cms_content_entries candidate
        on candidate.id = authorized.entry_id
      join platform_private.cms_entry_revisions revision
        on revision.id = candidate.current_draft_revision_id
       and revision.entry_id = candidate.id
      where candidate.lifecycle::text = 'active'
        and candidate.owner_party_id = acting_party_id
        and (
          requested_content_type_id is null
          or candidate.content_type_id = requested_content_type_id
        )
        and (
          requested_state is null
          or revision.state::text = requested_state
        )
        and (
          cursor_text is null
          or candidate.updated_at < cursor_updated_at
          or (
            candidate.updated_at = cursor_updated_at
            and candidate.id < cursor_entry_id
          )
        )
      order by candidate.updated_at desc, candidate.id desc
      limit limit_value + 1
    loop
      if rows_seen >= limit_value then
        has_more := true;
        exit;
      end if;
      rows_seen := rows_seen + 1;
      cursor_updated_at := page_row.entry_updated_at;
      cursor_entry_id := page_row.entry_id;
      if page_max_updated is null then
        page_max_updated := page_row.entry_updated_at;
      end if;

      page_items := page_items || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', page_row.revision_id,
          'entryId', page_row.entry_id,
          -- DEC-145 (lane G): server-derived lifecycle and update instant of the
          -- entry; no owner or assignee identifier.
          'entryLifecycle', page_row.entry_lifecycle,
          'entryUpdatedAt', platform_private.auth_iso_time(page_row.entry_updated_at),
          'revisionNumber', page_row.revision_number::text,
          'locale', page_row.revision_locale,
          'state', page_row.revision_state,
          'contentHash', platform_private.cms_revision_content_hash(
            page_row.revision_id,
            pg_catalog.btrim(page_row.revision_payload_hash::text),
            page_row.revision_locale,
            page_row.revision_schema_version_id
          ),
          'createdAt', platform_private.auth_iso_time(page_row.revision_created_at),
          'authorClass', platform_private.cms_revision_author_class(
            page_row.entry_id, page_row.revision_author_person_id
          )
        )
      );
      if pg_catalog.jsonb_array_length(page_items) > 50 then
        raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  if has_more then
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
            'lastUpdatedAt', pg_catalog.to_char(
              cursor_updated_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ),
            'lastEntryId', cursor_entry_id::text,
            'expiresAt', (
              pg_catalog.floor(
                pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
              ) + 86400
            )::bigint::text
          )),
          'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    -- A cursor that cannot fit the 512-character contract is withheld rather
    -- than truncated; the client re-reads the first window instead.
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', case
      when page_max_updated is null then '1'
      -- The page version is the window's high-water mark in UTC microseconds.
      -- A plain 1e6-scaled epoch is at most 16 digits (the current epoch is
      -- ~1.78e15), so the emitted token always satisfies CmsVersionSchema's
      -- 1..19-digit range.  A YYYYMMDDHH24MISSUS rendering is 20 digits and
      -- would be refused by the locked contract, so it is avoided.
      else (pg_catalog.floor(
        pg_catalog.date_part('epoch', page_max_updated) * 1000000
      ))::bigint::text
    end
  );
end;
$body$;

commit;
