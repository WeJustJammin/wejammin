-- Slice 10 gap resolution DEC-140 (P2-S10-AC-035/097/098, audit D-2): CMS-03B-13
-- list cursor faults use the two classes CMS-03B-03 history already uses.  The
-- signed wrapper (20261005010700 cms_list_entries_signed over the shared
-- 20261005010400 helpers) already answers a structurally malformed envelope
-- (length, encoding, key set, malformed keyId or signature) with INVALID_REQUEST
-- and an unverifiable, tampered, stale-key, wrong-domain, over-lived or
-- foreign-bound cursor with CONFLICT.  The unsigned keyset reader inside it
-- still folded a structural fault of the keyset payload (non-UUID lastEntryId,
-- malformed lastUpdatedAt or expiresAt) into the same CONFLICT as a binding
-- mismatch.  The reader now raises INVALID_REQUEST for every structural payload
-- fault first and CONFLICT only for a well-formed payload that is expired or
-- bound to another actor, acting party, filter set or window.  Only that check
-- changed; the body is otherwise the 20261005010700 definition, signature,
-- attributes, owner and grants are unchanged (CREATE OR REPLACE).
-- Forward-only.
begin;

create or replace function platform_private.cms_list_entries(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
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
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
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

  -- Keyset walk: descending (updated_at, entry id).  A row the caller has no
  -- proven authority over is concealed by omission and still advances the
  -- scan, so a cursor never becomes an existence probe and visibility cannot
  -- be inferred from the page shape.
  for entry_row in
    select candidate.*
    from platform_private.cms_content_entries candidate
    where candidate.lifecycle::text = 'active'
      and (
        requested_content_type_id is null
        or candidate.content_type_id = requested_content_type_id
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
  loop
    -- Authority is per row and server-derived: a proven registered grant keyed
    -- to the acting party AND an active assignment on this entry.
    if platform_private.cms_authority_origin(
         actor_id, acting_party_id, 'cms.editor', entry_row.id
       ) is null
       and platform_private.cms_authority_origin(
         actor_id, acting_party_id, 'cms.author', entry_row.id
       ) is null then
      continue;
    end if;

    if entry_row.current_draft_revision_id is null then
      continue;
    end if;
    select * into revision_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = entry_row.current_draft_revision_id
      and candidate.entry_id = entry_row.id;
    if not found then
      continue;
    end if;
    if requested_state is not null
       and revision_row.state::text <> requested_state then
      continue;
    end if;

    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    cursor_updated_at := entry_row.updated_at;
    cursor_entry_id := entry_row.id;
    if page_max_updated is null then
      page_max_updated := entry_row.updated_at;
    end if;

    page_items := page_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', revision_row.id,
        'entryId', entry_row.id,
        'revisionNumber', revision_row.revision_number::text,
        'locale', revision_row.locale,
        'state', revision_row.state,
        'contentHash', platform_private.cms_revision_content_hash(
          revision_row.id,
          pg_catalog.btrim(revision_row.payload_hash::text),
          revision_row.locale,
          revision_row.schema_version_id
        ),
        'createdAt', platform_private.auth_iso_time(revision_row.created_at),
        'authorClass', platform_private.cms_revision_author_class(
          revision_row.entry_id, revision_row.author_person_id
        )
      )
    );
    if pg_catalog.jsonb_array_length(page_items) > 50 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  end loop;

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
