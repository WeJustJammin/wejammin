-- Slice 11 lane S11-3c, CMS-03B-17 (BE03b Route Registry, Route field validation matrix, Contract and error
-- matrix; DEC-140 fault classes; tracker P2-S11-AC-061 .. AC-066): the reviewer queue.
-- platform_private.cms_list_editorial_reviews(p_request jsonb) returns jsonb is the keyset reader over the
-- caller's OWN scope, cms_list_editorial_reviews_signed signs and verifies the cursor over the shared Vault
-- envelope (domain 'cms-03b-17'), and platform_api.cms_list_editorial_reviews is the wrapper the Worker
-- calls (service_role only).
--
-- A SAFE READ: it writes nothing.  Scopes: `assigned` lists exactly the reviews of the acting party on which
-- the caller holds a non-revoked assignment, `submitted` exactly those the caller submitted; a review
-- outside the scope is never listed and the reader is driven from the caller's own assignment / submission
-- rows (never a scan of the hidden population).  A caller who is not a confirmed member of the acting party
-- gets the empty page.
--
-- Order and cursor: (updatedAt DESC, reviewId DESC) where updatedAt is the review's update instant
-- truncated to the MILLISECOND the wire format carries (platform_private.auth_iso_time); ordering by the
-- microsecond column would let two rows of one millisecond appear in an order the contract's keyset check
-- ((updatedAt, reviewId) strictly descending) rejects.  The unsigned cursor is the base64 JCS payload
-- { queryHash, lastUpdatedAt, lastReviewId, expiresAt }: queryHash binds the actor, acting party, scope,
-- state and page size, so a cursor cannot be replayed against another reading scope; the signed wrapper
-- adds keyId and signature (HMAC under the Vault history-signing key, 24-hour ceiling).  Fault classes
-- (DEC-140): a structurally malformed cursor is INVALID_REQUEST (400); an expired, tampered, foreign-bound
-- or over-lived one is CONFLICT (409) and the client restarts from the first page.
--
-- pageVersion is the high-water mark of the page (the greatest update instant on it, in UTC microseconds, 1
-- for an empty page), the page ETag.  myDecision is the caller's own decision on the review (none |
-- approve | reject); assignmentEndsAt is the caller's non-revoked assignment end for scope `assigned` and
-- null for `submitted`.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_list_editorial_reviews(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person uuid;
  limit_value integer := 25;
  scope_value text := 'assigned';
  state_value text;
  cursor_text text;
  cursor_value jsonb;
  cursor_ts timestamptz;
  cursor_id uuid;
  query_hash text;
  page_rows jsonb := '[]'::jsonb;
  page_items jsonb := '[]'::jsonb;
  page_elem jsonb;
  rows_seen integer := 0;
  has_more boolean := false;
  last_ts timestamptz;
  last_id uuid;
  page_max timestamptz;
  next_cursor text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- Request: an optional window and filters only; context and correlationId are transport control fields.
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array[]::text[],
       array['cursor', 'limit', 'scope', 'state', 'context', 'correlationId']::text[]
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1
       or (p_request->>'limit')::numeric > 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/limit"]';
    end if;
    limit_value := (p_request->>'limit')::integer;
  end if;
  if p_request ? 'scope' and p_request->'scope' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'scope') <> 'string'
       or (p_request->>'scope') not in ('assigned', 'submitted') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/scope"]';
    end if;
    scope_value := p_request->>'scope';
  end if;
  if p_request ? 'state' and p_request->'state' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'state') <> 'string'
       or (p_request->>'state') not in ('open', 'approved', 'rejected', 'invalidated') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/state"]';
    end if;
    state_value := p_request->>'state';
  end if;

  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text,
    'actingPartyId', acting_party_id::text,
    'scope', scope_value,
    'state', state_value,
    'limit', limit_value::text
  ));

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string'
       or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_text := p_request->>'cursor';
    begin
      cursor_value := pg_catalog.convert_from(pg_catalog.decode(cursor_text, 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         cursor_value,
         array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[],
         array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[]
       ) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    -- DEC-140: a structural fault in the keyset payload is a 400; a well-formed cursor bound to another
    -- scope, or an expired one, is a 409.
    if coalesce(cursor_value->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or platform_private.cms_valid_uuid(cursor_value->>'lastReviewId') is not true
       or coalesce(cursor_value->>'lastUpdatedAt', '')
            !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
       or coalesce(cursor_value->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      cursor_ts := (cursor_value->>'lastUpdatedAt')::timestamptz;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if cursor_value->>'queryHash' is distinct from query_hash then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if (cursor_value->>'expiresAt')::bigint
         <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    cursor_id := (cursor_value->>'lastReviewId')::uuid;
  end if;

  begin
    person := platform_private.identity_actor_person(actor_id);
  exception when others then
    person := null;
  end;

  -- The page is driven from the caller's own assignment / submission rows.  A caller outside the acting
  -- party reads nothing.
  if person is not null and platform_private.cms_entry_tenant_visible(actor_id, acting_party_id) then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page_row) order by page_row.key_ts desc, page_row.review_id desc),
                    '[]'::jsonb)
      into page_rows
      from (
        select scoped.review_id, scoped.key_ts, scoped.assignment_ends_at,
               review_item.entry_id, review_item.revision_id, review_item.state, review_item.risk_class,
               review_item.required_decision_count, review_item.recorded_decision_count,
               review_item.submitted_at, review_item.updated_at,
               revision_item.revision_number, revision_item.locale,
               pg_catalog.left(
                 coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120
               ) as content_type_label,
               coalesce((
                 select decision_item.decision
                   from platform_private.cms_editorial_decisions decision_item
                  where decision_item.review_id = review_item.id
                    and decision_item.reviewer_person_id = person
                  limit 1
               ), 'none') as my_decision
          from (
            select assigned.review_id, assigned.assignment_ends_at,
                   pg_catalog.date_trunc('milliseconds', assigned.updated_at) as key_ts
              from (
                select assignment_item.review_id, assignment_item.ends_at as assignment_ends_at, review_scoped.updated_at
                  from platform_private.cms_editorial_review_assignments assignment_item
                  join platform_private.cms_editorial_reviews review_scoped on review_scoped.id = assignment_item.review_id
                 where scope_value = 'assigned'
                   and assignment_item.reviewer_person_id = person
                   and assignment_item.state = 'active'
                   and review_scoped.owner_id = acting_party_id
                   and (state_value is null or review_scoped.state = state_value)
              ) assigned
            union all
            select submitted.id, null::timestamptz,
                   pg_catalog.date_trunc('milliseconds', submitted.updated_at)
              from platform_private.cms_editorial_reviews submitted
             where scope_value = 'submitted'
               and submitted.submitted_by = person
               and submitted.owner_id = acting_party_id
               and (state_value is null or submitted.state = state_value)
          ) scoped(review_id, assignment_ends_at, key_ts)
          join platform_private.cms_editorial_reviews review_item on review_item.id = scoped.review_id
          join platform_private.cms_entry_revisions revision_item on revision_item.id = review_item.revision_id
          join platform_private.cms_content_entries entry_item on entry_item.id = review_item.entry_id
          join platform_private.cms_content_types type_item on type_item.id = entry_item.content_type_id
          join platform_private.cms_content_type_versions version_item on version_item.id = revision_item.schema_version_id
         where cursor_text is null
            or (scoped.key_ts, scoped.review_id) < (cursor_ts, cursor_id)
         order by scoped.key_ts desc, scoped.review_id desc
         limit limit_value + 1
      ) page_row;
  end if;

  for page_elem in
    select element.value from pg_catalog.jsonb_array_elements(page_rows) element(value)
  loop
    if rows_seen >= limit_value then
      has_more := true;
      exit;
    end if;
    rows_seen := rows_seen + 1;
    last_ts := (page_elem->>'key_ts')::timestamptz;
    last_id := (page_elem->>'review_id')::uuid;
    if page_max is null then
      page_max := (page_elem->>'updated_at')::timestamptz;
    end if;
    page_items := page_items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'reviewId', page_elem->>'review_id',
      'entryId', page_elem->>'entry_id',
      'revisionId', page_elem->>'revision_id',
      'revisionNumber', page_elem->>'revision_number',
      'locale', page_elem->>'locale',
      'contentTypeLabel', page_elem->>'content_type_label',
      'state', page_elem->>'state',
      'riskClass', page_elem->>'risk_class',
      'requiredDecisionCount', (page_elem->>'required_decision_count')::integer,
      'recordedDecisionCount', (page_elem->>'recorded_decision_count')::integer,
      'myDecision', page_elem->>'my_decision',
      'assignmentEndsAt', case when scope_value = 'assigned'
        then platform_private.auth_iso_time((page_elem->>'assignment_ends_at')::timestamptz) end,
      'submittedAt', platform_private.auth_iso_time((page_elem->>'submitted_at')::timestamptz),
      'updatedAt', platform_private.auth_iso_time((page_elem->>'updated_at')::timestamptz)
    ));
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(
      pg_catalog.encode(
        pg_catalog.convert_to(
          platform_private.cms_jcs(pg_catalog.jsonb_build_object(
            'queryHash', query_hash,
            'lastUpdatedAt', pg_catalog.to_char(last_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'lastReviewId', last_id::text,
            'expiresAt', (pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())) + 86400)::bigint::text
          )),
          'utf8'
        ),
        'base64'
      ),
      E'\n', ''
    );
    -- A cursor that cannot fit the 512-character contract is withheld rather than truncated.
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'items', page_items,
    'nextCursor', next_cursor,
    'pageVersion', case
      when page_max is null then '1'
      else pg_catalog.floor(extract(epoch from page_max) * 1000000)::bigint::text
    end
  );
end;
$body$;

comment on function platform_private.cms_list_editorial_reviews(jsonb) is
  'CMS-03B-17 internal keyset reader (unsigned cursor; reachable only through cms_list_editorial_reviews_signed). Lists only the caller''s own assigned or submitted reviews of the acting party, ordered (updatedAt DESC at millisecond precision, reviewId DESC), driven from the caller''s assignment / submission rows. Writes nothing. Private.';

create or replace function platform_private.cms_list_editorial_reviews_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  cursor_payload_keys constant text[] := array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[];
  request_for_reader jsonb := p_request;
begin
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array[]::text[],
       array['cursor', 'limit', 'scope', 'state', 'context', 'correlationId']::text[]
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  perform platform_private.cms_signed_cursor_require_key();

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    request_for_reader := pg_catalog.jsonb_set(
      p_request,
      '{cursor}',
      pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open(
        'cms-03b-17', p_request->'cursor', cursor_payload_keys
      )),
      false
    );
  end if;

  return platform_private.cms_signed_cursor_seal_page(
    'cms-03b-17',
    platform_private.cms_list_editorial_reviews(request_for_reader),
    cursor_payload_keys
  );
end;
$body$;

comment on function platform_private.cms_list_editorial_reviews_signed(jsonb) is
  'CMS-03B-17 signed wrapper: requires the Vault history-signing key, verifies the signed context-bound cursor in constant time (domain cms-03b-17) and signs the next cursor. A malformed envelope is INVALID_REQUEST; an unverifiable, expired or foreign-bound one is CONFLICT. Private.';

create or replace function platform_api.cms_list_editorial_reviews(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_list_editorial_reviews_signed(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_list_editorial_reviews(jsonb) is
  'CMS-03B-17 (GET /api/v1/cms/reviews): ReviewQueueQuery -> ReviewQueuePage over the caller''s assigned or submitted reviews. Safe read; executable by service_role only.';

-- SEC-2: the reader names forced-RLS CMS tables, so it is owned by the definer role (which already holds
-- SELECT on every table it reads); the signed wrapper and the API wrapper stay with the migration owner,
-- which alone may call the Vault cursor helpers (their EXECUTE is revoked from every other role).
grant select on table
  platform_private.cms_editorial_reviews,
  platform_private.cms_editorial_review_assignments,
  platform_private.cms_editorial_decisions,
  platform_private.cms_entry_revisions,
  platform_private.cms_content_entries,
  platform_private.cms_content_types,
  platform_private.cms_content_type_versions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_editorial_reviews(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_list_editorial_reviews(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_editorial_reviews_signed(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_list_editorial_reviews(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_list_editorial_reviews(jsonb) to service_role;

commit;
