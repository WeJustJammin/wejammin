-- Slice 12 lane taxonomy-terms, cmsTaxonomyTermsRead (BE03c route registry at 167, validation matrix at 371, TaxonomyTermListPage at 1170-1186,
-- authorization at 1480, DEC-140 fault classes; P2-S12-AC-183 .. AC-187): GET /api/v1/cms/taxonomies/{taxonomyId}/terms, the curator's term list.
--   platform_private.cms_list_taxonomy_terms(p_request jsonb)          the unsigned keyset reader (this file)
--   platform_private.cms_list_taxonomy_terms_signed(p_request jsonb)   verifies and signs the cursor (20261014120610)
--   platform_api.cms_list_taxonomy_terms(p_request jsonb)              the Worker transport (20261014120610)
-- Private request: { taxonomyId, lifecycle?, cursor?, limit?, context, correlationId? }, nothing else.  Answer: the witness
-- { taxonomyId, page: { items, nextCursor, pageVersion } } (the Worker unwraps the unchanged TaxonomyTermListPage only after the witness names the
-- lineage it asked for, so an empty page can never be mistaken for an absent vocabulary).
-- Order: a non-object body or an unknown/absent member and a malformed taxonomyId are INVALID_REQUEST; actor and acting party (UNAUTHENTICATED);
-- a caller who cannot read the owner party gets NOT_FOUND; a reader without cms.taxonomy_curator is `capability_missing` (403); then the
-- query values (a lifecycle or limit outside its grammar is INVALID_REQUEST: the validation row of cmsTaxonomyTermsRead, BE03c 406, answers 400); the vocabulary lineage must exist in the caller's owner scope in ANY state
-- (NOT_FOUND: the same refusal for an absent, another owner's or a non-lineage id); the cursor (structurally malformed: INVALID_REQUEST; a
-- foreign-bound or expired one: CONFLICT, the client restarts from page one).
-- Page: the vocabulary's terms of every lifecycle ordered (termKey ASC bytewise, termId ASC), `limit` 1 .. 50 (default 25).  Each item carries the
-- CURRENT label of each locale (the highest version of the locale while it is active), the aliases, the parent and, for a merged term, its
-- successor.  pageVersion is the page's high-water update instant in UTC microseconds ("1" for an empty page).  Reads lock and write nothing.
-- Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_list_taxonomy_terms(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  lineage_id uuid;
  page_limit integer := 25;
  lifecycle_filter text;
  query_hash text;
  cursor_text text;
  cursor_json jsonb;
  cursor_key text;
  cursor_id uuid;
  rows_json jsonb;
  items jsonb := '[]'::jsonb;
  element jsonb;
  seen integer := 0;
  has_more boolean := false;
  last_key text;
  last_id uuid;
  high_water timestamptz;
  next_cursor text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['taxonomyId', 'context']::text[],
       array['taxonomyId', 'lifecycle', 'cursor', 'limit', 'context', 'correlationId']::text[])
     or pg_catalog.jsonb_typeof(p_request->'taxonomyId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'taxonomyId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  lineage_id := (p_request->>'taxonomyId')::uuid;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  begin
    person_id := platform_private.identity_actor_person(actor_id);
  exception when others then
    person_id := null;
  end;
  if person_id is null or not platform_private.cms_entry_tenant_visible(actor_id, acting_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_person_holds_capability(acting_party_id, person_id, 'cms.taxonomy_curator') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 50 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    page_limit := (p_request->>'limit')::integer;
  end if;
  if p_request ? 'lifecycle' and p_request->'lifecycle' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'lifecycle') <> 'string' or (p_request->>'lifecycle') not in ('active', 'deprecated', 'merged') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    lifecycle_filter := p_request->>'lifecycle';
  end if;

  if not exists (
    select 1 from platform_private.cms_taxonomy_versions root_row
     where root_row.id = lineage_id and root_row.taxonomy_id = lineage_id and root_row.owner_id = acting_party_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text, 'actingPartyId', acting_party_id::text, 'taxonomyId', lineage_id::text,
    'lifecycle', lifecycle_filter, 'limit', page_limit::text));
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string' or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_text := p_request->>'cursor';
    begin
      cursor_json := pg_catalog.convert_from(pg_catalog.decode(cursor_text, 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         cursor_json, array['queryHash', 'lastTermKey', 'lastTermId', 'expiresAt']::text[],
         array['queryHash', 'lastTermKey', 'lastTermId', 'expiresAt']::text[])
       or coalesce(cursor_json->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or coalesce(cursor_json->>'lastTermKey', '') !~ '^[a-z][a-z0-9-]{1,63}$'
       or platform_private.cms_valid_uuid(cursor_json->>'lastTermId') is not true
       or coalesce(cursor_json->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if cursor_json->>'queryHash' is distinct from query_hash
       or (cursor_json->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    cursor_key := cursor_json->>'lastTermKey';
    cursor_id := (cursor_json->>'lastTermId')::uuid;
  end if;

  select coalesce(pg_catalog.jsonb_agg(page_row.item order by page_row.term_key collate "C", page_row.term_id), '[]'::jsonb)
    into rows_json
    from (
      select term.term_key, term.id as term_id,
             pg_catalog.jsonb_build_object(
               'termId', term.id, 'termKey', term.term_key, 'lifecycle', term.lifecycle, 'version', term.version::text,
               'parentId', term.parent_term_id, 'successorId', term.successor_id,
               'labels', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('locale', current_label.locale, 'label', current_label.label)
                                                    order by current_label.locale collate "C"), '[]'::jsonb)
                            from (select distinct on (label_row.locale) label_row.locale, label_row.label, label_row.state
                                    from platform_private.cms_term_labels label_row where label_row.term_id = term.id
                                   order by label_row.locale, label_row.version desc) current_label
                           where current_label.state = 'active'),
               'aliases', term.aliases) as item,
             term.updated_at
        from platform_private.cms_terms term
       where term.taxonomy_id = lineage_id and term.owner_id = acting_party_id
         and (lifecycle_filter is null or term.lifecycle = lifecycle_filter)
         and (cursor_key is null
              or term.term_key collate "C" > cursor_key collate "C"
              or (term.term_key = cursor_key and term.id > cursor_id))
       order by term.term_key collate "C", term.id
       limit page_limit + 1
    ) page_row;
  -- the work above is one bounded keyset scan; the high-water instant is read per returned item below
  for element in select item.value from pg_catalog.jsonb_array_elements(rows_json) item(value) loop
    if seen >= page_limit then
      has_more := true;
      exit;
    end if;
    seen := seen + 1;
    last_key := element->>'termKey';
    last_id := (element->>'termId')::uuid;
    items := items || pg_catalog.jsonb_build_array(element);
    select greatest(high_water, term.updated_at) into high_water
      from platform_private.cms_terms term where term.id = last_id;
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', query_hash, 'lastTermKey', last_key, 'lastTermId', last_id::text,
        'expiresAt', (pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())) + 86400)::bigint::text)),
      'utf8'), 'base64'), E'\n', '');
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'taxonomyId', lineage_id,
    'page', pg_catalog.jsonb_build_object(
      'items', items,
      'nextCursor', next_cursor,
      'pageVersion', case when high_water is null then '1'
                          else pg_catalog.floor(extract(epoch from high_water) * 1000000)::bigint::text end));
end;
$body$;

comment on function platform_private.cms_list_taxonomy_terms(jsonb) is
  'cmsTaxonomyTermsRead internal keyset reader (unsigned cursor; reachable only through cms_list_taxonomy_terms_signed). A verified taxonomy curator lists the terms of one vocabulary lineage of their owner scope in any state, ordered (termKey ASC bytewise, termId ASC), with current labels, aliases and the successor of a merged term. Answers { taxonomyId, page }. Writes and locks nothing. Private.';

grant select on table platform_private.cms_term_labels to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_taxonomy_terms(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_taxonomy_terms(jsonb) from public, anon, authenticated, service_role;

commit;
