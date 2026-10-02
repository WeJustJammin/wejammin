-- CMS-03B-03: bind the comparison selector to every signed history cursor.
-- Previously the private query hash omitted compareRevisionId, allowing a valid
-- cursor to be replayed against a different comparison on the same entry.
-- Existing cursors fail closed with CONFLICT after this forward-only change.
begin;

create or replace function platform_private.cms_list_revisions(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  resolved_acting_party_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  target_entry_id uuid;
  requested_state text;
  requested_locale text;
  compare_revision_id uuid;
  limit_value integer := 25;
  limit_input text;
  cursor_text text;
  cursor_value jsonb;
  cursor_expires bigint;
  cursor_last_number bigint;
  cursor_last_id uuid;
  query_hash text;
  capability_candidate text;
  authorized_capability text;
  revision_row platform_private.cms_entry_revisions;
  compared_revision_row platform_private.cms_entry_revisions%rowtype;
  newest_revision_row platform_private.cms_entry_revisions%rowtype;
  rows_seen integer := 0;
  has_more boolean := false;
  cursor_revision_number bigint;
  cursor_revision_id uuid;
  next_cursor text;
  page_items jsonb := '[]'::jsonb;
  left_payload jsonb;
  right_payload jsonb;
  compare_changes jsonb := '[]'::jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  resolved_acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Request shape: entryId is required; cursor/limit/state/compareRevisionId/
  -- locale are the only accepted filters.  context and correlationId are
  -- control fields, never authority.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array[
      'entryId', 'cursor', 'limit', 'state', 'compareRevisionId', 'locale',
      'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  target_entry_id := (p_request->>'entryId')::uuid;

  if p_request ? 'state'
     and p_request->'state' <> 'null'::jsonb
     and coalesce(p_request->>'state', '') not in (
       'draft', 'submitted', 'approved', 'rejected', 'scheduled', 'published'
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_state := case
    when p_request->'state' = 'null'::jsonb then null
    else p_request->>'state'
  end;

  if p_request ? 'locale'
     and p_request->'locale' <> 'null'::jsonb
     and coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  requested_locale := case
    when p_request->'locale' = 'null'::jsonb then null
    else p_request->>'locale'
  end;

  if p_request ? 'compareRevisionId'
     and p_request->'compareRevisionId' <> 'null'::jsonb then
    if not platform_private.cms_valid_uuid(p_request->>'compareRevisionId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    compare_revision_id := (p_request->>'compareRevisionId')::uuid;
  end if;

  -- limit is a query bound, not a malformed selector: an out-of-range window is
  -- a 422 VALIDATION_FAILED, matching the registry's query-bounds column rather
  -- than the malformed-query 400.
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    limit_input := p_request->>'limit';
    if limit_input is null
       or limit_input !~ '^[0-9]{1,2}$'
       or (limit_input::integer) not between 1 and 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    limit_value := limit_input::integer;
  end if;

  if p_request ? 'cursor' then
    cursor_text := nullif(p_request->>'cursor', '');
  end if;
  if cursor_text is not null
     and pg_catalog.octet_length(cursor_text) not between 1 and 512 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = target_entry_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Authority: a registered grant keyed to the acting party AND an active
  -- assignment on this entry.  A caller that presents a capability key without
  -- the grant/assignment is refused exactly like a caller that presents none.
  authorized_capability := null;
  foreach capability_candidate in array
    platform_private.cms_revision_reader_capabilities()
  loop
    if platform_private.cms_authority_origin(
         actor_id, resolved_acting_party_id, capability_candidate, target_entry_id
       ) is not null then
      authorized_capability := capability_candidate;
      exit;
    end if;
  end loop;
  if authorized_capability is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Cursor envelope: {queryHash, lastRevisionNumber, lastRevisionId, expiresAt}.
  -- queryHash binds the cursor to the exact actor, acting party, entry, filters,
  -- and window, so a cursor cannot be replayed against another context.
  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text,
    'actingPartyId', resolved_acting_party_id::text,
    'entryId', target_entry_id::text,
    'state', requested_state,
    'locale', requested_locale,
    'compareRevisionId', compare_revision_id::text,
    'limit', limit_value::text
  ));

  if cursor_text is not null then
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
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[],
      array['queryHash', 'lastRevisionNumber', 'lastRevisionId', 'expiresAt']::text[]
    ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;

    -- A cursor whose shape is wrong is malformed (400).  A cursor that is
    -- well-formed but bound to another actor, party, entry, filter set, or
    -- window, or that has expired, is a cursor/context mismatch (409), exactly
    -- as the registry error matrix separates the two.
    if coalesce(cursor_value->>'queryHash', '') is distinct from query_hash
       or not platform_private.cms_valid_version(cursor_value->>'lastRevisionNumber')
       or not platform_private.cms_valid_uuid(cursor_value->>'lastRevisionId')
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;

    cursor_expires := (cursor_value->>'expiresAt')::bigint;
    cursor_last_number := (cursor_value->>'lastRevisionNumber')::bigint;
    cursor_last_id := (cursor_value->>'lastRevisionId')::uuid;

    if cursor_expires <= pg_catalog.floor(
         pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
       )::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- The comparison target is resolved before pagination so an unreadable or
  -- off-entry target is a 404 regardless of which window was requested.
  if compare_revision_id is not null then
    select * into compared_revision_row
    from platform_private.cms_entry_revisions candidate
    where candidate.id = compare_revision_id;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if compared_revision_row.entry_id <> target_entry_id then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, compared_revision_row
       ) = 'absent' then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  -- Keyset walk: descending (revision_number, id).  Concealed rows still
  -- advance the scan (a cursor must not become a probe), so has_more is decided
  -- only by the first row the caller is allowed to see beyond the window.
  for revision_row in
    select candidate.*
    from platform_private.cms_entry_revisions candidate
    where candidate.entry_id = target_entry_id
      and (requested_state is null or candidate.state = requested_state)
      and (requested_locale is null or candidate.locale = requested_locale)
      and (
        cursor_text is null
        or candidate.revision_number < cursor_last_number
        or (
          candidate.revision_number = cursor_last_number
          and candidate.id < cursor_last_id
        )
      )
    order by candidate.revision_number desc, candidate.id desc
  loop
    if platform_private.cms_revision_page_disposition(
         actor_id, resolved_acting_party_id, revision_row
       ) = 'absent' then
      continue;
    end if;

    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    cursor_revision_number := revision_row.revision_number;
    cursor_revision_id := revision_row.id;

    page_items := page_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', revision_row.id,
        'revisionNumber', revision_row.revision_number::text,
        'locale', revision_row.locale,
        'state', revision_row.state,
        'contentHash', platform_private.cms_revision_content_hash(
          revision_row.id,
          revision_row.payload_hash::text,
          revision_row.locale,
          revision_row.schema_version_id
        ),
        'createdAt', platform_private.auth_iso_time(revision_row.created_at),
        'authorClass', platform_private.cms_revision_author_class(
          revision_row.entry_id, revision_row.author_person_id
        )
      )
    );
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
          'lastRevisionNumber', cursor_revision_number::text,
          'lastRevisionId', cursor_revision_id::text,
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
      has_more := false;
    end if;
  end if;

  if compare_revision_id is null then
    return pg_catalog.jsonb_build_object(
      'items', page_items,
      'nextCursor', next_cursor,
      'pageVersion', entry_row.version::text,
      'compare', null
    );
  end if;

  -- The right side of the comparison is the newest readable revision on the
  -- entry that matches the requested locale.  The state filter is deliberately
  -- not applied: state is a window filter for the history list, and narrowing
  -- the comparison side to it would silently change what "latest" means.
  select * into newest_revision_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = target_entry_id
    and (requested_locale is null or candidate.locale = requested_locale)
    and platform_private.cms_revision_page_disposition(
          actor_id, resolved_acting_party_id, candidate
        ) = 'visible'
  order by candidate.revision_number desc, candidate.id desc
  limit 1;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  left_payload := platform_private.cms_revision_field_payload(
    compared_revision_row.id,
    compared_revision_row.locale,
    compared_revision_row.schema_version_id
  );
  right_payload := platform_private.cms_revision_field_payload(
    newest_revision_row.id,
    newest_revision_row.locale,
    newest_revision_row.schema_version_id
  );

  -- A semantic linear change list keyed by stable field id.  Only the pointer
  -- and the two safe hashes are exposed: no value, no field definition id, and
  -- no relation-level diff (relationship comparison has no locked JSON Pointer
  -- convention).  Paths use the same /fields/<stableFieldId> form the create
  -- and restore changedPaths contract already fixes.  left is the explicitly
  -- requested compareRevisionId and right is the newest readable revision, so
  -- kind=added means the field exists only on the newer side.
  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'path', '/fields/' || distinct_keys.key_value,
      'kind', case
        when left_payload ? distinct_keys.key_value
         and right_payload ? distinct_keys.key_value
         and left_payload->distinct_keys.key_value
             is distinct from right_payload->distinct_keys.key_value then 'changed'
        when left_payload ? distinct_keys.key_value
         and right_payload ? distinct_keys.key_value then 'unchanged'
        when right_payload ? distinct_keys.key_value then 'added'
        else 'removed'
      end,
      'leftHash', case
        when left_payload ? distinct_keys.key_value
          then platform_private.cms_revision_field_hash(
            left_payload->distinct_keys.key_value
          )
        else null
      end,
      'rightHash', case
        when right_payload ? distinct_keys.key_value
          then platform_private.cms_revision_field_hash(
            right_payload->distinct_keys.key_value
          )
        else null
      end
    ) order by distinct_keys.key_value
  ), '[]'::jsonb) into compare_changes
  from (
    select distinct keys.key_name as key_value
    from (
      select k.key_name
      from pg_catalog.jsonb_object_keys(left_payload) as k(key_name)
      union all
      select k.key_name
      from pg_catalog.jsonb_object_keys(right_payload) as k(key_name)
    ) keys
  ) distinct_keys;

  if pg_catalog.jsonb_array_length(compare_changes) > 512 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', entry_row.version::text,
    'compare', pg_catalog.jsonb_build_object(
      'leftRevisionId', compared_revision_row.id,
      'rightRevisionId', newest_revision_row.id,
      'changes', compare_changes
    )
  );
end;
$body$;

commit;
