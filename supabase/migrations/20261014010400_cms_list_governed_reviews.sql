-- Slice 12 lane governed-a, CMS-03C-11 (BE03c Route Registry 176, Route field validation matrix, Contract and error matrix; DEC-140
-- fault classes; BE03b CMS-03B-17 applied with the governed substitutions; tracker P2-S12-AC-094 .. AC-099): the reviewer queue.
--   cms_list_governed_reviews(p_request)          the unsigned keyset reader over the caller's OWN scope
--   cms_list_governed_reviews_signed(p_request)   verifies and signs the cursor over the shared Vault envelope (domain 'cms-03c-11')
--   (the platform_api wrapper is 20261014010410)
-- A SAFE READ: it writes nothing.  Scopes: `assigned` lists exactly the reviews of the acting party on which the caller holds an
-- ACTIVE assignment, `submitted` exactly those the caller submitted, `owned` exactly those whose subject kind the caller's designer
-- (template and pattern) or curator (taxonomy) capability covers.  A caller who is not a confirmed member of the acting party gets the
-- empty page.  BOUNDED WORK (the 20261010171000 lesson): the caller's assignments are read FIRST, as one array of review ids, and the
-- review table is then a single-relation probe; the keyset order and LIMIT apply to the review rows alone, the decision and assignment
-- lookups run per page row (at most limit + 1).
-- Order and cursor: (updatedAt DESC, reviewId DESC) with updatedAt truncated to the MILLISECOND the wire format carries.  The unsigned
-- cursor is the base64 JCS payload { queryHash, lastUpdatedAt, lastReviewId, expiresAt }; queryHash binds the actor, acting party,
-- scope, state, subject kind and page size.  Fault classes (DEC-140): a structurally malformed cursor is INVALID_REQUEST (400); an
-- expired, tampered or foreign-bound one is CONFLICT (409) and the client restarts from the first page.  pageVersion is the page
-- high-water mark (the greatest update instant in UTC microseconds, 1 for an empty page).  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_list_governed_reviews(p_request jsonb)
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
  v_scope text := 'assigned';
  v_state text;
  v_kind text;
  v_cursor_text text;
  v_cursor jsonb;
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_hash text;
  v_ids uuid[] := array[]::uuid[];
  v_kinds text[] := array[]::text[];
  v_rows jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_seen integer := 0;
  v_more boolean := false;
  v_last_ts timestamptz;
  v_last_id uuid;
  v_max timestamptz;
  v_updated timestamptz;
  v_next text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array[]::text[],
       array['cursor', 'limit', 'scope', 'state', 'subjectKind', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);

  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 50 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/limit"]';
    end if;
    v_limit := (p_request->>'limit')::integer;
  end if;
  if p_request ? 'scope' and p_request->'scope' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'scope') <> 'string'
       or (p_request->>'scope') not in ('assigned', 'submitted', 'owned') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/scope"]';
    end if;
    v_scope := p_request->>'scope';
  end if;
  if p_request ? 'state' and p_request->'state' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'state') <> 'string'
       or (p_request->>'state') not in ('open', 'approved', 'rejected', 'invalidated') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/state"]';
    end if;
    v_state := p_request->>'state';
  end if;
  if p_request ? 'subjectKind' and p_request->'subjectKind' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'subjectKind') <> 'string'
       or (p_request->>'subjectKind') not in ('template_version', 'pattern_version', 'taxonomy_version') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/subjectKind"]';
    end if;
    v_kind := p_request->>'subjectKind';
  end if;

  v_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', v_actor_id::text, 'actingPartyId', v_party_id::text, 'scope', v_scope,
    'state', v_state, 'subjectKind', v_kind, 'limit', v_limit::text));

  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string'
       or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    v_cursor_text := p_request->>'cursor';
    begin
      v_cursor := pg_catalog.convert_from(pg_catalog.decode(v_cursor_text, 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         v_cursor, array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[],
         array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[]) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if coalesce(v_cursor->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or platform_private.cms_valid_uuid(v_cursor->>'lastReviewId') is not true
       or coalesce(v_cursor->>'lastUpdatedAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
       or coalesce(v_cursor->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      v_cursor_ts := (v_cursor->>'lastUpdatedAt')::timestamptz;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if v_cursor->>'queryHash' is distinct from v_hash
       or (v_cursor->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    v_cursor_id := (v_cursor->>'lastReviewId')::uuid;
  end if;

  begin
    v_person := platform_private.identity_actor_person(v_actor_id);
  exception when others then
    v_person := null;
  end;

  if v_person is not null and platform_private.cms_entry_tenant_visible(v_actor_id, v_party_id) then
    if v_scope = 'assigned' then
      select coalesce(pg_catalog.array_agg(assignment_item.review_id), array[]::uuid[]) into v_ids
        from platform_private.cms_governed_review_assignments assignment_item
       where assignment_item.reviewer_person_id = v_person and assignment_item.state = 'active'
         and assignment_item.owner_id = v_party_id;
    elsif v_scope = 'owned' then
      if platform_private.cms_person_holds_capability(v_party_id, v_person, 'cms.template_designer') then
        v_kinds := v_kinds || array['template_version', 'pattern_version']::text[];
      end if;
      if platform_private.cms_person_holds_capability(v_party_id, v_person, 'cms.taxonomy_curator') then
        v_kinds := v_kinds || array['taxonomy_version']::text[];
      end if;
    end if;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page_row) order by page_row.key_ts desc, page_row.review_id desc), '[]'::jsonb)
      into v_rows
      from (
        select review_item.id as review_id, pg_catalog.date_trunc('milliseconds', review_item.updated_at) as key_ts,
               review_item.subject_kind, review_item.subject_key, review_item.subject_version, review_item.state,
               review_item.risk_class, review_item.required_decision_count, review_item.recorded_decision_count,
               review_item.submitted_at, review_item.updated_at,
               coalesce((select decision_item.decision from platform_private.cms_governed_review_decisions decision_item
                          where decision_item.review_id = review_item.id and decision_item.reviewer_person_id = v_person
                          limit 1), 'none') as my_decision,
               case when v_scope = 'assigned' then (
                 select assignment_item.ends_at from platform_private.cms_governed_review_assignments assignment_item
                  where assignment_item.review_id = review_item.id and assignment_item.reviewer_person_id = v_person
                    and assignment_item.state = 'active') end as assignment_ends_at
          from platform_private.cms_governed_reviews review_item
         where review_item.owner_id = v_party_id
           and (v_state is null or review_item.state = v_state)
           and (v_kind is null or review_item.subject_kind = v_kind)
           and case v_scope when 'assigned' then review_item.id = any (v_ids)
                            when 'submitted' then review_item.submitted_by = v_person
                            else review_item.subject_kind = any (v_kinds) end
           and (v_cursor_text is null
                or (pg_catalog.date_trunc('milliseconds', review_item.updated_at), review_item.id) < (v_cursor_ts, v_cursor_id))
         order by pg_catalog.date_trunc('milliseconds', review_item.updated_at) desc, review_item.id desc
         limit v_limit + 1
      ) page_row;
  end if;

  for v_elem in select element.value from pg_catalog.jsonb_array_elements(v_rows) element(value) loop
    if v_seen >= v_limit then
      v_more := true;
      exit;
    end if;
    v_seen := v_seen + 1;
    v_last_ts := (v_elem->>'key_ts')::timestamptz;
    v_last_id := (v_elem->>'review_id')::uuid;
    v_updated := (v_elem->>'updated_at')::timestamptz;
    if v_max is null or v_updated > v_max then
      v_max := v_updated;
    end if;
    v_items := v_items || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'reviewId', v_elem->>'review_id',
      'subjectKind', v_elem->>'subject_kind',
      'subjectKey', v_elem->>'subject_key',
      'subjectVersion', (v_elem->>'subject_version')::bigint,
      'state', v_elem->>'state',
      'riskClass', v_elem->>'risk_class',
      'requiredDecisionCount', (v_elem->>'required_decision_count')::integer,
      'recordedDecisionCount', (v_elem->>'recorded_decision_count')::integer,
      'myDecision', v_elem->>'my_decision',
      'assignmentEndsAt', case when v_scope = 'assigned'
        then platform_private.auth_iso_time((v_elem->>'assignment_ends_at')::timestamptz) end,
      'submittedAt', platform_private.auth_iso_time((v_elem->>'submitted_at')::timestamptz),
      'updatedAt', platform_private.auth_iso_time(v_updated)));
  end loop;

  if v_more then
    v_next := pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', v_hash,
        'lastUpdatedAt', pg_catalog.to_char(v_last_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lastReviewId', v_last_id::text,
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
    'pageVersion', case when v_max is null then '1'
                        else pg_catalog.floor(pg_catalog.date_part('epoch', v_max) * 1000000)::bigint::text end);
end;
$body$;

comment on function platform_private.cms_list_governed_reviews(jsonb) is
  'CMS-03C-11 internal keyset reader (unsigned cursor; reachable only through cms_list_governed_reviews_signed). Lists only the caller''s assigned, submitted or owned governed reviews of the acting party, ordered (updatedAt DESC at millisecond precision, reviewId DESC), with bounded work. Writes nothing. Private.';

create or replace function platform_private.cms_list_governed_reviews_signed(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_keys constant text[] := array['queryHash', 'lastUpdatedAt', 'lastReviewId', 'expiresAt']::text[];
  v_request jsonb := p_request;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array[]::text[],
       array['cursor', 'limit', 'scope', 'state', 'subjectKind', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform platform_private.cms_signed_cursor_require_key();
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    v_request := pg_catalog.jsonb_set(
      p_request, '{cursor}',
      pg_catalog.to_jsonb(platform_private.cms_signed_cursor_open('cms-03c-11', p_request->'cursor', v_keys)), false);
  end if;
  return platform_private.cms_signed_cursor_seal_page(
    'cms-03c-11', platform_private.cms_list_governed_reviews(v_request), v_keys);
end;
$body$;

comment on function platform_private.cms_list_governed_reviews_signed(jsonb) is
  'CMS-03C-11 signed wrapper: requires the Vault history-signing key, verifies the signed context-bound cursor in constant time (domain cms-03c-11) and signs the next cursor. A malformed envelope is INVALID_REQUEST; an unverifiable, expired or foreign-bound one is CONFLICT. Private.';

-- SEC-2: the reader names forced-RLS CMS tables, so it is owned by the definer role.  The signed wrapper and the API wrapper stay
-- with the migration owner, which alone may call the Vault cursor helpers (their EXECUTE is revoked from every other role).
grant select on table
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_assignments,
  platform_private.cms_governed_review_decisions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_governed_reviews(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_governed_reviews(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_list_governed_reviews_signed(jsonb)
  from public, anon, authenticated, service_role;

commit;
