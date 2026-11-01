-- Slice 12 lane taxonomy-terms, CMS-03C-03 support (BE03c route validation matrix 372-374 and 408-410, contract taxonomy-term.ts, Term
-- actions at 1377, DEC-135 at 1375, term resource at 911; P2-S12-AC-016, AC-017, AC-141): the private pieces cms_act_taxonomy_term uses.
--   cms_term_action_values(request)             exact members (INVALID_REQUEST), then member values (VALIDATION_FAILED with the member pointer
--                                               as DETAIL '["/pointer"]'), then the If-Match operand (INVALID_REQUEST)
--   cms_term_overlap_check(domains, candidates) the DEC-135 overlap check over the DECLARED domains, through CMS-03C-18
--   cms_term_resource(term id)                  the strict TaxonomyTermResource
--   cms_term_locale_canonical(locale)           the ONE stored case form of a locale (BCP 47: language lower, 4-letter script Title, 2-letter or
--                                               3-digit region UPPER, singleton and private-use subtags lower)
--   cms_term_write_labels(...)                  append-only label versions, one per submitted locale in its canonical form
--   cms_term_alias_union(existing, new)         the bounded alias set
-- Every function is private, SECURITY DEFINER, owned by the CMS definer and executable by no API role.  Forward-only.
begin;
set local lock_timeout = '5s';

-- The stored form of a label locale.  CmsLocaleSchema accepts any case and fixes no canonical form, and a label lineage is (term, locale), so
-- the producer stores ONE form and the readers match it: `en-US`, `en-us` and `EN-US` are one locale.  RFC 5646 2.1.1 case convention by
-- position: the language subtag lower case; after it a 4-letter alphabetic subtag (script) in Title case, a 2-letter alphabetic or 3-digit
-- subtag (region) in UPPER case, anything else (variant, extension) in lower case; a singleton subtag ('x', 'a', ...) and everything after it
-- in lower case.  Input is the CmsLocaleSchema grammar; anything else is returned lower-cased (the callers have validated it already).
create or replace function platform_private.cms_term_locale_canonical(p_locale text)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
declare
  parts text[] := pg_catalog.string_to_array(p_locale, '-');
  result text[] := array[]::text[];
  part text;
  part_index integer := 0;
  after_singleton boolean := false;
begin
  if p_locale is null then
    return null;
  end if;
  foreach part in array parts loop
    part_index := part_index + 1;
    if part_index = 1 or after_singleton then
      result := result || pg_catalog.lower(part);
    elsif pg_catalog.length(part) = 1 then
      after_singleton := true;
      result := result || pg_catalog.lower(part);
    elsif pg_catalog.length(part) = 4 and part ~ '^[A-Za-z]{4}$' then
      result := result || (pg_catalog.upper(pg_catalog.substr(part, 1, 1)) || pg_catalog.lower(pg_catalog.substr(part, 2)));
    elsif (pg_catalog.length(part) = 2 and part ~ '^[A-Za-z]{2}$') then
      result := result || pg_catalog.upper(part);
    else
      result := result || pg_catalog.lower(part);
    end if;
  end loop;
  return pg_catalog.array_to_string(result, '-');
end;
$body$;

comment on function platform_private.cms_term_locale_canonical(text) is
  'The stored case form of a label locale (BCP 47 case convention by subtag position). Private; IMMUTABLE.';

create or replace function platform_private.cms_term_action_values(p_request jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  members constant text[] := array['taxonomyId', 'action', 'termKey', 'parentId', 'survivorId', 'labels', 'aliases',
                                   'expectedVersion', 'ifMatch', 'idempotencyKey', 'context'];
  action_value text;
  operand text;
  entry record;
  seen_locales text[] := array[]::text[];
  locale_value text;
  label_value text;
begin
  if not platform_private.cms_exact_keys(p_request, members, members || array['correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'taxonomyId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'taxonomyId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- The If-Match operand: a decimal string in 1 .. 2^63 - 1 that the body's expectedVersion repeats exactly.
  operand := case when pg_catalog.jsonb_typeof(p_request->'expectedVersion') = 'string' then p_request->>'expectedVersion' end;
  if operand is null or operand !~ '^[1-9][0-9]{0,18}$' or operand::numeric > 9223372036854775807
     or pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string' or p_request->'ifMatch' <> p_request->'expectedVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  action_value := case when pg_catalog.jsonb_typeof(p_request->'action') = 'string' then p_request->>'action' end;
  if action_value is null or action_value not in ('create', 'rename', 'alias', 'deprecate', 'merge') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/action"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'termKey') is distinct from 'string' or (p_request->>'termKey') !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/termKey"]';
  end if;
  -- parentId: null, or a UUID, on every action (the frozen request carries it on all five and FE03 1792 sends the form's parent whatever the
  -- action); existence, shape and cycle rules are the apply step's, and only create and rename APPLY it (decision D3).
  if pg_catalog.jsonb_typeof(p_request->'parentId') = 'null' then
    null;
  elsif pg_catalog.jsonb_typeof(p_request->'parentId') is distinct from 'string'
        or platform_private.cms_valid_uuid(p_request->>'parentId') is not true then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/parentId"]';
  end if;
  -- survivorId: a UUID exactly for merge.
  if pg_catalog.jsonb_typeof(p_request->'survivorId') = 'null' then
    if action_value = 'merge' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/survivorId"]';
    end if;
  elsif pg_catalog.jsonb_typeof(p_request->'survivorId') is distinct from 'string'
        or platform_private.cms_valid_uuid(p_request->>'survivorId') is not true or action_value <> 'merge' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/survivorId"]';
  end if;

  -- labels: 1 to 64 { locale, label } entries, one per locale, NFC labels of 1 to 160 characters.
  if pg_catalog.jsonb_typeof(p_request->'labels') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'labels') not between 1 and 64 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/labels"]';
  end if;
  for entry in
    select element.value, element.ord - 1 as idx from pg_catalog.jsonb_array_elements(p_request->'labels') with ordinality element(value, ord) order by element.ord
  loop
    if pg_catalog.jsonb_typeof(entry.value) is distinct from 'object'
       or not platform_private.cms_exact_keys(entry.value, array['locale', 'label']::text[], array['locale', 'label']::text[]) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/labels/%s"]', entry.idx);
    end if;
    locale_value := case when pg_catalog.jsonb_typeof(entry.value->'locale') = 'string' then entry.value->>'locale' end;
    if locale_value is null or locale_value !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
       or platform_private.cms_term_locale_canonical(locale_value) = any (seen_locales) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/labels/%s/locale"]', entry.idx);
    end if;
    seen_locales := seen_locales || platform_private.cms_term_locale_canonical(locale_value);
    label_value := case when pg_catalog.jsonb_typeof(entry.value->'label') = 'string' then entry.value->>'label' end;
    if label_value is null or pg_catalog.char_length(label_value) not between 1 and 160 or normalize(label_value, NFC) <> label_value then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/labels/%s/label"]', entry.idx);
    end if;
  end loop;

  -- aliases: at most 64 strings of 1 to 160 characters.
  if pg_catalog.jsonb_typeof(p_request->'aliases') is distinct from 'array' or pg_catalog.jsonb_array_length(p_request->'aliases') > 64 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/aliases"]';
  end if;
  for entry in
    select element.value, element.ord - 1 as idx from pg_catalog.jsonb_array_elements(p_request->'aliases') with ordinality element(value, ord) order by element.ord
  loop
    if pg_catalog.jsonb_typeof(entry.value) is distinct from 'string' or pg_catalog.char_length(entry.value #>> '{}') not between 1 and 160 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/aliases/%s"]', entry.idx);
    end if;
  end loop;
end;
$body$;

-- DEC-135: the overlap check runs only for the domains the vocabulary's ACTIVE version declares.  A declared domain with no built provider
-- is refused first (in declaration order) with details.domain; then each declared domain is matched, 64 candidates per CMS-03C-18 call, and a
-- match is 422 canonical_overlap with details.domain and details.canonicalId.  A provider fault propagates as DEPENDENCY_UNAVAILABLE.
create or replace function platform_private.cms_term_overlap_check(p_domains jsonb, p_candidates text[])
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  declared text;
  position_index integer;
  answer jsonb;
begin
  if p_domains is null or pg_catalog.jsonb_typeof(p_domains) <> 'array' or pg_catalog.jsonb_array_length(p_domains) = 0 then
    return;
  end if;
  for declared in
    select element.value from pg_catalog.jsonb_array_elements_text(p_domains) with ordinality element(value, ord) order by element.ord
  loop
    if not exists (select 1 from platform_private.cms_canonical_domain_current(declared) current_row where current_row.provider_state = 'built') then
      raise exception 'canonical_source_unavailable' using errcode = 'P0001',
        detail = pg_catalog.jsonb_build_object('domain', declared)::text;
    end if;
  end loop;
  if p_candidates is null or pg_catalog.cardinality(p_candidates) = 0 then
    return;
  end if;
  for declared in
    select element.value from pg_catalog.jsonb_array_elements_text(p_domains) with ordinality element(value, ord) order by element.ord
  loop
    position_index := 1;
    while position_index <= pg_catalog.cardinality(p_candidates) loop
      answer := platform_private.cms_canonical_taxonomy_match(declared, pg_catalog.to_jsonb(p_candidates[position_index : position_index + 63]));
      if answer->>'outcome' = 'match' then
        raise exception 'canonical_overlap' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_object('domain', declared, 'canonicalId', answer->>'canonicalId')::text;
      elsif answer->>'outcome' = 'source_unavailable' then
        raise exception 'canonical_source_unavailable' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_object('domain', declared)::text;
      end if;
      position_index := position_index + 64;
    end loop;
  end loop;
end;
$body$;

create or replace function platform_private.cms_term_resource(p_term_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
           'id', term.id,
           'version', term.version::text,
           'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
             'id', term.id, 'termKey', term.term_key, 'lifecycle', term.lifecycle,
             'version', term.version::text, 'successorId', term.successor_id)),
           'createdAt', platform_private.auth_iso_time(term.created_at),
           'updatedAt', platform_private.auth_iso_time(term.updated_at),
           'lifecycle', term.lifecycle,
           'taxonomyId', term.taxonomy_id,
           'termId', term.id,
           'termKey', term.term_key,
           'parentId', term.parent_term_id,
           'successorId', term.successor_id)
    from platform_private.cms_terms term
   where term.id = p_term_id
$body$;

-- One new label version per submitted locale, in its canonical case (labels are immutable per version; locales not named keep their current version).
create or replace function platform_private.cms_term_write_labels(p_term_id uuid, p_owner_id uuid, p_actor_id uuid, p_labels jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  entry record;
begin
  for entry in
    select platform_private.cms_term_locale_canonical(element.value->>'locale') as locale, element.value->>'label' as label
      from pg_catalog.jsonb_array_elements(p_labels) with ordinality element(value, ord) order by element.ord
  loop
    insert into platform_private.cms_term_labels (owner_id, state, version, term_id, locale, label, aliases, created_by)
    select p_owner_id, 'active', coalesce(pg_catalog.max(existing.version), 0) + 1, p_term_id, entry.locale, entry.label, '[]'::jsonb, p_actor_id
      from platform_private.cms_term_labels existing
     where existing.term_id = p_term_id and existing.locale = entry.locale;
  end loop;
end;
$body$;

-- The existing aliases first, then the new ones that are not yet present (exact strings, request order), bounded like the column.
create or replace function platform_private.cms_term_alias_union(p_existing jsonb, p_new jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  merged jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(combined.value order by combined.rank), '[]'::jsonb)
    into merged
    from (
      select existing.value, existing.ord as rank
        from pg_catalog.jsonb_array_elements(p_existing) with ordinality existing(value, ord)
      union all
      select added.value, 1000000 + added.ord
        from (select distinct on (candidate.value) candidate.value, candidate.ord
                from pg_catalog.jsonb_array_elements(p_new) with ordinality candidate(value, ord)
               order by candidate.value, candidate.ord) added
       where not exists (select 1 from pg_catalog.jsonb_array_elements(p_existing) known where known.value = added.value)
    ) combined;
  if not platform_private.cms_json_bounded(merged, 16384, 2, 64, 64) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/aliases"]';
  end if;
  return merged;
end;
$body$;

grant execute on function platform_private.cms_exact_keys(jsonb, text[], text[]) to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_term_locale_canonical(text) owner to wejammin_cms_definer;
alter function platform_private.cms_term_action_values(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_term_overlap_check(jsonb, text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_term_resource(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_term_write_labels(uuid, uuid, uuid, jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_term_alias_union(jsonb, jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_term_locale_canonical(text),
  platform_private.cms_term_action_values(jsonb),
  platform_private.cms_term_overlap_check(jsonb, text[]),
  platform_private.cms_term_resource(uuid),
  platform_private.cms_term_write_labels(uuid, uuid, uuid, jsonb),
  platform_private.cms_term_alias_union(jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
