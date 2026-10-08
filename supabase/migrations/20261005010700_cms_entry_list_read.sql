-- Slice 10 WP-S10-3 (CMS-03B-13, decision D2): protected authorized entry list.
--
-- platform_private.cms_list_entries is the unsigned internal keyset reader: it
-- binds its cursor to the exact actor, acting party, filters and window and
-- re-checks authority per row, but it mints and accepts a plain four-key
-- cursor.  Callers never reach it directly.  The only caller-facing path is
-- platform_private.cms_list_entries_signed, which verifies the six-key signed
-- cursor envelope on the way in and signs the next page cursor on the way out
-- using the shared Vault-backed helpers from 20261005010400
-- (cms_signed_cursor_require_key / _open / _seal_page), under the 'cms-03b-13'
-- signature domain so an entry-list cursor can never validate as a history
-- cursor.  platform_api.cms_list_entries delegates to the signed wrapper.
--
-- Each item carries the canonical owning entryId beside the revision identity
-- (the EntryListItem contract), so a consumer links to the entry instead of
-- mistaking the revision id for one.

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

    -- A malformed envelope is a 400; a well-formed cursor bound to another
    -- actor, party, filter set or window, or an expired one, is a 409.  Both
    -- are typed P0001 refusals so a forged cursor is never silently ignored.
    if coalesce(cursor_value->>'queryHash', '') is distinct from query_hash
       or not platform_private.cms_valid_uuid(cursor_value->>'lastEntryId')
       or coalesce(cursor_value->>'lastUpdatedAt', '')
            !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$'
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
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

comment on function platform_private.cms_list_entries(jsonb) is
  'CMS-03B-13 internal keyset reader (unsigned cursor; reachable only through cms_list_entries_signed). Server-derives actor/acting party, lists only entries with a proven cms.author/cms.editor grant plus an active assignment (concealed rows omitted, never a probing NOT_FOUND), paginates a query/scope/expiry-bound keyset cursor over (updatedAt DESC, entryId DESC) with default limit 25 and cap 50, allowlists exactly state and contentTypeId, and writes nothing and emits no audit/outbox row.';

-- CMS-03B-13 signed wrapper: the only caller-facing path to the reader above.
-- Admission order mirrors CMS-03B-03: structural request shape, then the Vault
-- key dependency, then the inbound signed cursor.  The reader then rechecks the
-- actor, acting party, filter/window binding, expiry and keyset position.
create or replace function platform_private.cms_list_entries_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  cursor_payload_keys constant text[] := array[
    'queryHash', 'lastUpdatedAt', 'lastEntryId', 'expiresAt'
  ]::text[];
  request_for_reader jsonb := p_request;
begin
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

  perform platform_private.cms_signed_cursor_require_key();

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    request_for_reader := pg_catalog.jsonb_set(
      p_request,
      '{cursor}',
      pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open(
        'cms-03b-13', p_request->'cursor', cursor_payload_keys
      )),
      false
    );
  end if;

  return platform_private.cms_signed_cursor_seal_page(
    'cms-03b-13',
    platform_private.cms_list_entries(request_for_reader),
    cursor_payload_keys
  );
end;
$body$;

comment on function platform_private.cms_list_entries_signed(jsonb) is
  'CMS-03B-13 service-bound entry-list wrapper: requires a per-environment Supabase Vault HMAC key, verifies the six-key signed cursor (queryHash, lastUpdatedAt, lastEntryId, expiresAt, keyId, signature) in constant time under the cms-03b-13 domain, and signs the next page cursor without exposing key material. A malformed envelope is INVALID_REQUEST; an unverifiable, forged, expired or scope-mismatched valid-shaped cursor is CONFLICT. No migration provisions an operational key.';

-- The browser-facing named RPC stays service-role only; the wrapper restores
-- the transaction-local RPC-context flag to its prior value so the read cannot
-- leak the write gate into the rest of the transaction.
create or replace function platform_api.cms_list_entries(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_list_entries_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- Worker-only surface: the named read is service_role only and is never
-- reachable from a browser role, and the private worker function stays
-- unreachable from every role.
revoke all on function platform_api.cms_list_entries(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_entries(jsonb) to service_role;

-- SEC-2: the private reader names forced-RLS tables (cms_content_entries,
-- cms_entry_revisions), so it is owned by the non-BYPASSRLS definer role so the
-- forced policies apply to every statement it runs.  ALTER FUNCTION ... OWNER TO
-- requires CREATE on the function's schema for the new owner, granted for the
-- length of this transaction only.  The definer already holds every table verb
-- the reader body needs (SELECT on cms_content_entries via
-- 20261003120100_cms_definer_privileges.sql) and every function it calls, so no
-- new grant is required.
grant create on schema platform_private to wejammin_cms_definer;

alter function platform_private.cms_list_entries(jsonb)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_list_entries(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_entries_signed(jsonb)
  from public, anon, authenticated, service_role;

commit;
