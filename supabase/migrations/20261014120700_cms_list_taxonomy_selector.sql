-- Slice 12 lane taxonomy-terms, CMS-03C-17 (BE03c route registry at 179, validation matrix at 373, TaxonomySelectorPage at 1146-1164, Term
-- governance at 1377, authorization at 1478; P2-S12-AC-130 .. AC-135): GET /api/v1/cms/taxonomies/selector, the author-facing term list.
--   platform_private.cms_list_taxonomy_selector(p_request jsonb)          the unsigned keyset reader (this file)
--   platform_private.cms_list_taxonomy_selector_signed(p_request jsonb)   verifies and signs the cursor (20261014120710)
--   platform_api.cms_list_taxonomy_selector(p_request jsonb)              the Worker transport (20261014120710)
-- Private request: { typeKey, fieldKey, locale, cursor?, limit?, context, correlationId? }.  Answer: the strict TaxonomySelectorPage
-- { items, nextCursor, pageVersion } itself (the selector is not addressed by a path id, so there is no witness).
-- Order: a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party (UNAUTHENTICATED); a caller who cannot read the
-- owner party gets NOT_FOUND; a reader holding neither cms.author nor cms.editor in the owner party is `capability_missing` (403; the taxonomy
-- curator capability is NOT enough); then the query values (typeKey and fieldKey `^[a-z][a-z0-9_]{1,63}$`, a BCP 47 locale, limit 1 .. 100 default
-- 50: VALIDATION_FAILED with the member pointer); then the cursor (malformed: INVALID_REQUEST; foreign-bound or expired: CONFLICT).
-- Page: the ACTIVE terms of the owner's ACTIVE vocabularies whose allowlists name the type key and the field key, ordered (taxonomyKey ASC, termKey
-- ASC) bytewise; a merged or deprecated term, a draft, superseded or retired vocabulary and another owner's vocabulary are never listed.  `label` is
-- the CURRENT label of exactly the requested locale (null when the term has none: no fallback, "en" is not "en-US"; the requested locale is matched in its canonical case, so fr-fr is fr-FR); `taxonomyVersionId` is the
-- ACTIVE version row (term ids are stable across taxonomy versions).  pageVersion is the page's high-water update instant (terms and active
-- version rows) in UTC microseconds ("1" for an empty page).  Reads lock and write nothing.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_list_taxonomy_selector(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  page_limit integer := 50;
  type_key text;
  field_key text;
  locale_value text;
  query_hash text;
  cursor_json jsonb;
  cursor_taxonomy text;
  cursor_term text;
  rows_json jsonb;
  items jsonb := '[]'::jsonb;
  element jsonb;
  seen integer := 0;
  has_more boolean := false;
  last_taxonomy text;
  last_term text;
  high_water timestamptz;
  row_water timestamptz;
  next_cursor text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['typeKey', 'fieldKey', 'locale', 'context']::text[],
       array['typeKey', 'fieldKey', 'locale', 'cursor', 'limit', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
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
  if not (platform_private.cms_person_holds_capability(acting_party_id, person_id, 'cms.author')
          or platform_private.cms_person_holds_capability(acting_party_id, person_id, 'cms.editor')) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'typeKey') is distinct from 'string' or (p_request->>'typeKey') !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/typeKey"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'fieldKey') is distinct from 'string' or (p_request->>'fieldKey') !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/fieldKey"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'locale') is distinct from 'string'
     or (p_request->>'locale') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/locale"]';
  end if;
  type_key := p_request->>'typeKey';
  field_key := p_request->>'fieldKey';
  locale_value := platform_private.cms_term_locale_canonical(p_request->>'locale');
  if p_request ? 'limit' and p_request->'limit' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'limit') <> 'number'
       or (p_request->>'limit')::numeric <> pg_catalog.floor((p_request->>'limit')::numeric)
       or (p_request->>'limit')::numeric < 1 or (p_request->>'limit')::numeric > 100 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/limit"]';
    end if;
    page_limit := (p_request->>'limit')::integer;
  end if;

  query_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'actorId', actor_id::text, 'actingPartyId', acting_party_id::text, 'typeKey', type_key, 'fieldKey', field_key,
    'locale', locale_value, 'limit', page_limit::text));
  if p_request ? 'cursor' and p_request->'cursor' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'cursor') <> 'string' or pg_catalog.octet_length(p_request->>'cursor') not between 1 and 512 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    begin
      cursor_json := pg_catalog.convert_from(pg_catalog.decode(p_request->>'cursor', 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    if not platform_private.cms_exact_keys(
         cursor_json, array['queryHash', 'lastTaxonomyKey', 'lastTermKey', 'expiresAt']::text[],
         array['queryHash', 'lastTaxonomyKey', 'lastTermKey', 'expiresAt']::text[])
       or coalesce(cursor_json->>'queryHash', '') !~ '^[0-9a-f]{64}$'
       or coalesce(cursor_json->>'lastTaxonomyKey', '') !~ '^[a-z][a-z0-9-]{1,63}$'
       or coalesce(cursor_json->>'lastTermKey', '') !~ '^[a-z][a-z0-9-]{1,63}$'
       or coalesce(cursor_json->>'expiresAt', '') !~ '^[0-9]{1,12}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if cursor_json->>'queryHash' is distinct from query_hash
       or (cursor_json->>'expiresAt')::bigint <= pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp()))::bigint then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    cursor_taxonomy := cursor_json->>'lastTaxonomyKey';
    cursor_term := cursor_json->>'lastTermKey';
  end if;

  select coalesce(pg_catalog.jsonb_agg(page_row.item order by page_row.taxonomy_key collate "C", page_row.term_key collate "C"), '[]'::jsonb)
    into rows_json
    from (
      select version_row.taxonomy_key, term.term_key,
             pg_catalog.jsonb_build_object(
               'taxonomyId', version_row.taxonomy_id, 'taxonomyVersionId', version_row.id, 'taxonomyKey', version_row.taxonomy_key,
               'shape', version_row.shape, 'termId', term.id, 'termKey', term.term_key, 'parentId', term.parent_term_id,
               'label', (select current_label.label
                           from (select label_row.label, label_row.state from platform_private.cms_term_labels label_row
                                  where label_row.term_id = term.id and label_row.locale = locale_value
                                  order by label_row.version desc limit 1) current_label
                          where current_label.state = 'active'),
               '_water', greatest(term.updated_at, version_row.updated_at)) as item
        from platform_private.cms_taxonomy_versions version_row
        join platform_private.cms_terms term
          on term.taxonomy_id = version_row.taxonomy_id and term.owner_id = version_row.owner_id and term.lifecycle = 'active'
       where version_row.owner_id = acting_party_id and version_row.state = 'active'
         and version_row.allowlisted_type_keys ? type_key and version_row.allowlisted_field_keys ? field_key
         and (cursor_taxonomy is null
              or version_row.taxonomy_key collate "C" > cursor_taxonomy collate "C"
              or (version_row.taxonomy_key = cursor_taxonomy and term.term_key collate "C" > cursor_term collate "C"))
       order by version_row.taxonomy_key collate "C", term.term_key collate "C"
       limit page_limit + 1
    ) page_row;
  for element in select item.value from pg_catalog.jsonb_array_elements(rows_json) item(value) loop
    if seen >= page_limit then
      has_more := true;
      exit;
    end if;
    seen := seen + 1;
    last_taxonomy := element->>'taxonomyKey';
    last_term := element->>'termKey';
    row_water := (element->>'_water')::timestamptz;
    high_water := greatest(high_water, row_water);
    items := items || pg_catalog.jsonb_build_array(element - '_water');
  end loop;

  if has_more then
    next_cursor := pg_catalog.replace(pg_catalog.encode(pg_catalog.convert_to(
      platform_private.cms_jcs(pg_catalog.jsonb_build_object(
        'queryHash', query_hash, 'lastTaxonomyKey', last_taxonomy, 'lastTermKey', last_term,
        'expiresAt', (pg_catalog.floor(pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())) + 86400)::bigint::text)),
      'utf8'), 'base64'), E'\n', '');
    if pg_catalog.octet_length(next_cursor) > 512 then
      next_cursor := null;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'items', items,
    'nextCursor', next_cursor,
    'pageVersion', case when high_water is null then '1'
                        else pg_catalog.floor(extract(epoch from high_water) * 1000000)::bigint::text end);
end;
$body$;

comment on function platform_private.cms_list_taxonomy_selector(jsonb) is
  'CMS-03C-17 internal keyset reader (unsigned cursor; reachable only through cms_list_taxonomy_selector_signed). A verified author or editor lists the active terms of the owner''s active vocabularies whose allowlists name the type and field key, with the label of exactly the requested locale (null without fallback), ordered (taxonomyKey, termKey) bytewise. Writes and locks nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_list_taxonomy_selector(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_list_taxonomy_selector(jsonb) from public, anon, authenticated, service_role;

commit;
