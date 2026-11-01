-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085, P2-S11-AC-086): the CMS-03B-13 entry list projects and filters the
-- DERIVED EntryRevisionState of every entry's current draft revision.
--
-- The item `state` was copied from the physical cms_entry_revisions.state (the
-- constant `draft`, 20261005018090) and the `state` filter was a predicate of the
-- keyset statement.  Both now come from platform_private.cms_revision_effective_states,
-- the set form of the one E2 helper, and the filter leaves the statement:
--
--   * the keyset statement (authorized relation -> entries -> current draft
--     revision, the collection epoch, the page) no longer mentions the state.  Order
--     (updated_at DESC, entry id DESC), cursor payload, queryHash binding and the
--     aheadDigest epoch are computed over the caller's whole authorized collection
--     (content-type filter only), so they never depend on the derived state: a state
--     change of an entry the walk has passed or has not reached is not a collection
--     change and is never a 409 CONFLICT;
--   * it returns the first candidate_budget candidates after the cursor in keyset
--     order: limit + 1 without a state filter (exactly as before), 1,001 with one;
--   * the derived state is computed in batches of 200 candidates, lazily (only for
--     batches the walk reaches); a filtered read returns up to `limit` matching rows,
--     scans at most 1,000 candidates and, on reaching that bound, returns the rows
--     found with a cursor positioned after the last scanned candidate (and the
--     epoch of that candidate), so a filtered page may be shorter than `limit` while
--     nextCursor is non-null.  When the probe for the (limit + 1)th match succeeds
--     first, the cursor stays after the last returned row and the probe is read again
--     by the next page.
--
-- Request/response shapes, the cursor wrapper (cms_list_entries_signed), the SECURITY
-- DEFINER attributes, search_path, owner and grants are unchanged (CREATE OR
-- REPLACE).  Forward-only.
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
  cursor_epoch text;
  resume_count bigint := 0;
  resume_xor bigint := 0;
  page_rows jsonb := '[]'::jsonb;
  page_elem jsonb;
  last_rank bigint;
  last_xor bigint;
  query_hash text;
  resolved_person_id uuid;
  granted_capabilities text[];
  rows_seen integer := 0;
  has_more boolean := false;
  page_items jsonb := '[]'::jsonb;
  page_max_updated timestamptz;
  next_cursor text;
  -- E2: the state filter is evaluated over keyset candidates read in batches of
  -- batch_size; a filtered request scans at most scan_bound candidates.
  scan_bound constant integer := 1000;
  batch_size constant integer := 200;
  candidate_budget integer;
  candidate_ordinal bigint;
  batch_states jsonb := '{}'::jsonb;
  candidate_state text;
  scan_updated_at timestamptz;
  scan_entry_id uuid;
  scan_rank bigint;
  scan_xor bigint;
  bound_reached boolean := false;
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

  -- Unsigned keyset payload: {queryHash, lastUpdatedAt, lastEntryId, aheadDigest,
  -- expiresAt}.  queryHash binds the cursor to the exact actor, acting party,
  -- filters and window, so a cursor cannot be replayed against another reading
  -- scope.  aheadDigest is the collection epoch (Codex review 3, finding 3): the
  -- digest of the set of entries that sorted at or before the page's last row when
  -- the cursor was issued.  The order is the spec's mutable (updatedAt DESC,
  -- entryId DESC), so an unseen entry updated between two pages would move ahead of
  -- the cursor and never be listed; the resumed read recomputes the digest of the
  -- entries now at or before the cursor position and answers 409 CONFLICT (DEC-140:
  -- the collection changed, restart from the first page) unless it is unchanged.
  -- Updating an entry the walk already passed keeps the set, so it is not a
  -- conflict.  The signed wrapper adds keyId and signature around this payload.
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
      array['queryHash', 'lastUpdatedAt', 'lastEntryId', 'aheadDigest', 'expiresAt']::text[],
      array['queryHash', 'lastUpdatedAt', 'lastEntryId', 'aheadDigest', 'expiresAt']::text[]
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
       or coalesce(cursor_value->>'aheadDigest', '') !~ '^[0-9a-f]{32}$'
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
    cursor_epoch := cursor_value->>'aheadDigest';

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
  -- current draft revision are joined in SQL, so the lifecycle, content-type and
  -- keyset predicates are index-assisted filters on authorized rows only and the
  -- candidate budget bounds the page.  The derived state (E2) is NOT a predicate of
  -- this statement: it is evaluated afterwards, in batches, over the keyset
  -- candidates.  The work therefore depends on the
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

  -- Without a state filter every candidate is a match, so limit + 1 candidates are
  -- enough (the extra one only proves another page exists).  With a state filter the
  -- page may have to look further: up to scan_bound candidates plus one that proves
  -- the walk can continue past the bound.
  candidate_budget := case
    when requested_state is null then limit_value + 1
    else scan_bound + 1
  end;

  if resolved_person_id is not null and cardinality(granted_capabilities) > 0 then
    -- ONE statement, so one snapshot: the epoch of the cursor position and the page
    -- are read from the same committed state.  `scoped` is the caller's whole
    -- authorized collection under the request's content-type filter (never the state
    -- filter: the derived state is evaluated over the candidates afterwards, so the
    -- order and the epoch cannot depend on it); `resume` aggregates the
    -- entries at or before the incoming cursor position; `ranked` numbers the
    -- collection and carries the running XOR of the entry hashes, so the epoch of
    -- the page's last row is (rank, running xor) with no second pass.
    select resumed.entry_count, resumed.entry_xor, resumed.page_rows
      into resume_count, resume_xor, page_rows
    from (
      with authorized as materialized (
        select distinct assignment.entry_id
        from platform_private.cms_entry_assignments assignment
        where assignment.assignee_person_id = resolved_person_id
          and assignment.state = 'active'
          and assignment.owner_id = acting_party_id
          and assignment.capability_key = any(granted_capabilities)
      ),
      scoped as materialized (
        select candidate.id as entry_id,
               candidate.updated_at as entry_updated_at,
               candidate.lifecycle as entry_lifecycle,
               pg_catalog.hashtextextended(candidate.id::text, 0) as entry_hash,
               revision.id as revision_id,
               revision.revision_number as revision_number,
               revision.locale as revision_locale,
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
      ),
      resume as (
        select pg_catalog.count(*)::bigint as entry_count,
               coalesce(pg_catalog.bit_xor(scoped.entry_hash), 0)::bigint as entry_xor
        from scoped
        where cursor_text is not null
          and (scoped.entry_updated_at, scoped.entry_id)
              >= (cursor_updated_at, cursor_entry_id)
      ),
      ranked as (
        select scoped.*,
               pg_catalog.row_number() over ordered as entry_rank,
               pg_catalog.bit_xor(scoped.entry_hash) over ordered as running_xor
        from scoped
        window ordered as (order by scoped.entry_updated_at desc, scoped.entry_id desc)
      ),
      page as (
        select ranked.*
        from ranked
        where cursor_text is null
           or (ranked.entry_updated_at, ranked.entry_id)
              < (cursor_updated_at, cursor_entry_id)
        order by ranked.entry_rank
        limit candidate_budget
      )
      select (select resume.entry_count from resume) as entry_count,
             (select resume.entry_xor from resume) as entry_xor,
             coalesce(
               pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page) order by page.entry_rank),
               '[]'::jsonb
             ) as page_rows
      from page
    ) resumed;
  end if;

  -- The collection epoch of the incoming cursor (an unauthorized or empty
  -- collection has the epoch of the empty set): the entries now at or before the
  -- cursor position must be exactly the entries that were when it was issued.
  if cursor_text is not null
     and cursor_epoch is distinct from
       platform_private.cms_entry_list_epoch(resume_count, resume_xor) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  -- The page candidates arrive in keyset order.  Their derived EntryRevisionState
  -- (BE03b E2) is computed with the set form of the one helper, once per batch of
  -- batch_size candidates and only for batches the walk reaches.  An unfiltered read
  -- consumes limit + 1 candidates; a filtered read stops at the (limit + 1)th match
  -- (the probe) or at the scan bound.  At the bound the rows found are returned with
  -- a cursor positioned after the LAST SCANNED candidate; at the probe the cursor
  -- stays after the last returned row and the probe is read again by the next page.
  for page_elem, candidate_ordinal in
    select element.value, element.ord
    from pg_catalog.jsonb_array_elements(page_rows) with ordinality element(value, ord)
    order by element.ord
  loop
    if candidate_ordinal > scan_bound then
      has_more := true;
      bound_reached := true;
      exit;
    end if;
    if (candidate_ordinal - 1) % batch_size = 0 then
      batch_states := coalesce((
        select pg_catalog.jsonb_object_agg(derived.revision_id::text, derived.state)
        from platform_private.cms_revision_effective_states(array(
          select (batch.elem->>'revision_id')::uuid
          from pg_catalog.jsonb_array_elements(page_rows) with ordinality batch(elem, ord)
          where batch.ord between candidate_ordinal and candidate_ordinal + batch_size - 1
        )) derived
      ), '{}'::jsonb);
    end if;
    scan_updated_at := (page_elem->>'entry_updated_at')::timestamptz;
    scan_entry_id := (page_elem->>'entry_id')::uuid;
    scan_rank := (page_elem->>'entry_rank')::bigint;
    scan_xor := (page_elem->>'running_xor')::bigint;
    candidate_state := batch_states->>(page_elem->>'revision_id');
    if candidate_state is null then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
    if requested_state is not null and candidate_state <> requested_state then
      continue;
    end if;

    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    cursor_updated_at := scan_updated_at;
    cursor_entry_id := scan_entry_id;
    last_rank := scan_rank;
    last_xor := scan_xor;
    if page_max_updated is null then
      page_max_updated := cursor_updated_at;
    end if;

    page_items := page_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', page_elem->>'revision_id',
        'entryId', page_elem->>'entry_id',
        -- DEC-145 (lane G): server-derived lifecycle and update instant of the
        -- entry; no owner or assignee identifier.
        'entryLifecycle', page_elem->>'entry_lifecycle',
        'entryUpdatedAt', platform_private.auth_iso_time(cursor_updated_at),
        'revisionNumber', page_elem->>'revision_number',
        'locale', page_elem->>'revision_locale',
        'state', candidate_state,
        'contentHash', platform_private.cms_revision_content_hash(
          (page_elem->>'revision_id')::uuid,
          pg_catalog.btrim(page_elem->>'revision_payload_hash'),
          page_elem->>'revision_locale',
          (page_elem->>'revision_schema_version_id')::uuid
        ),
        'createdAt', platform_private.auth_iso_time(
          (page_elem->>'revision_created_at')::timestamptz
        ),
        'authorClass', platform_private.cms_revision_author_class(
          (page_elem->>'entry_id')::uuid,
          (page_elem->>'revision_author_person_id')::uuid
        )
      )
    );
    if pg_catalog.jsonb_array_length(page_items) > 50 then
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  end loop;

  if bound_reached then
    cursor_updated_at := scan_updated_at;
    cursor_entry_id := scan_entry_id;
    last_rank := scan_rank;
    last_xor := scan_xor;
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
            'aheadDigest', platform_private.cms_entry_list_epoch(last_rank, last_xor),
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
  'CMS-03B-13 safe bounded read of the entries the caller is assigned: authorized relation, keyset (updated_at DESC, id DESC) bound to a collection epoch, DERIVED EntryRevisionState per item (cms_revision_effective_states, BE03b E2).  A state filter is evaluated over keyset candidates read in batches of 200, returns up to limit matching rows and scans at most 1,000 candidates per request; reaching the bound answers the rows found with a cursor after the last scanned candidate.  The cursor, the sort and the epoch never depend on the derived state.  Private; the signed wrapper cms_list_entries_signed seals the cursor.';

commit;
