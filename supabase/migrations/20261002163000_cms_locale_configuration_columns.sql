-- BE03a OD-4: the immutable locale configuration of a content-type version.
-- This migration adds the three columns (supported_locales, fallback_chains,
-- locale_config_hash), the pure code-owned validator that reproduces the exact
-- refusal table of the contracts package, the deterministic localeConfigHash
-- (RFC 8785 / JCS SHA-256 of { sourceLocale, defaultLocale, supportedLocales
-- sorted by UTF-8 bytes, fallbackChains }) and the immutability trigger: a
-- locale change is only ever a new successor row.
--
-- Backfill of existing versions (deterministic, documented): a version created
-- before OD-4 declared only a source and a default locale, so it gets the
-- single-locale default configuration consistent with them:
-- supportedLocales = the unique set { sourceLocale, defaultLocale } sorted by
-- UTF-8 bytes, and every supported locale other than defaultLocale gets the
-- chain [defaultLocale].  localeConfigHash is computed from that configuration.
-- The backfill never rewrites an existing definition_hash (active, superseded
-- and reviewed versions are immutable evidence); only versions compiled after
-- this migration compose localeConfigHash into definition_hash.
-- Forward-only.
begin;

-- ---------------------------------------------------------------- helpers ----
-- True when a tag has the BCP 47 shape, 2-35 characters and canonical case:
-- language lower-case, a four-letter script Title-case, a two-letter or
-- three-digit region upper-case and every other subtag lower-case.  This is the
-- same mapper as canonicalizeBcp47 in packages/contracts.
create or replace function platform_private.cms_locale_canonical_valid(p_tag text)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  parts text[];
  output_parts text[];
  subtag text;
  position_name text := 'language';
begin
  if p_tag is null
     or pg_catalog.length(p_tag) not between 2 and 35
     or p_tag !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    return false;
  end if;
  parts := pg_catalog.string_to_array(p_tag, '-');
  output_parts := array[pg_catalog.lower(parts[1])];
  for index_no in 2..pg_catalog.cardinality(parts) loop
    subtag := parts[index_no];
    if position_name = 'rest' or pg_catalog.length(subtag) = 1 then
      position_name := 'rest';
      output_parts := output_parts || pg_catalog.lower(subtag);
    elsif position_name = 'language'
          and pg_catalog.length(subtag) = 4 and subtag ~ '^[A-Za-z]+$' then
      position_name := 'script';
      output_parts := output_parts
        || (pg_catalog.upper(pg_catalog.left(subtag, 1)) || pg_catalog.lower(pg_catalog.substr(subtag, 2)));
    elsif position_name in ('language', 'script')
          and ((pg_catalog.length(subtag) = 2 and subtag ~ '^[A-Za-z]+$')
               or (pg_catalog.length(subtag) = 3 and subtag ~ '^[0-9]+$')) then
      position_name := 'region';
      output_parts := output_parts || pg_catalog.upper(subtag);
    else
      if not (position_name = 'language'
              and pg_catalog.length(subtag) = 3 and subtag ~ '^[A-Za-z]+$') then
        position_name := 'rest';
      end if;
      output_parts := output_parts || pg_catalog.lower(subtag);
    end if;
  end loop;
  return pg_catalog.array_to_string(output_parts, '-') = p_tag;
end;
$body$;

-- supportedLocales sorted ascending by UTF-8 byte order (a JSON array).
create or replace function platform_private.cms_locale_sorted(p_supported jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select coalesce(
    pg_catalog.jsonb_agg(item.value order by item.value collate "C"),
    '[]'::jsonb)
  from pg_catalog.jsonb_array_elements_text(p_supported) item(value)
$body$;

-- The deterministic localeConfigHash.  fallbackChains order inside each chain
-- is preserved; JCS orders the object keys.
create or replace function platform_private.cms_locale_config_hash(
  p_source text, p_default text, p_supported jsonb, p_chains jsonb
)
returns text
language sql
stable
set search_path = ''
as $body$
  select platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'sourceLocale', p_source,
    'defaultLocale', p_default,
    'supportedLocales', platform_private.cms_locale_sorted(p_supported),
    'fallbackChains', p_chains))
$body$;

-- Structural precondition of the validator: supportedLocales is an array of
-- strings and fallbackChains an object of arrays of strings, all bounded so a
-- hostile payload cannot make the rule pass expensive.
create or replace function platform_private.cms_locale_config_shape_valid(
  p_supported jsonb, p_chains jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  chain record;
begin
  if pg_catalog.jsonb_typeof(p_supported) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_supported) > 128
     or pg_catalog.jsonb_typeof(p_chains) is distinct from 'object'
     or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_chains)) > 128 then
    return false;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_supported) item(value)
     where pg_catalog.jsonb_typeof(item.value) is distinct from 'string'
  ) then
    return false;
  end if;
  for chain in select entry.key, entry.value from pg_catalog.jsonb_each(p_chains) entry loop
    if pg_catalog.jsonb_typeof(chain.value) is distinct from 'array'
       or pg_catalog.jsonb_array_length(chain.value) > 128
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(chain.value) item(value)
          where pg_catalog.jsonb_typeof(item.value) is distinct from 'string'
       ) then
      return false;
    end if;
  end loop;
  return true;
end;
$body$;

-- One ordered pass over the exact refusal table (BE03a OD-4).  Returns a JSON
-- array of { path: [...], message } issues grouped by rule in table order, then
-- by position; chain keys are visited in ascending UTF-8 byte order because
-- jsonb does not keep request key order.  p_source / p_default may be null only
-- when the caller does not know them; the source/default rules are then skipped.
create or replace function platform_private.cms_locale_config_violations(
  p_source text, p_default text, p_supported jsonb, p_chains jsonb
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $body$
declare
  issues jsonb := '[]'::jsonb;
  supported text[];
  keys text[];
  targets text[];
  chain text[];
  seen text[];
  chain_key text;
  cyclic boolean;
begin
  select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
    into supported
    from pg_catalog.jsonb_array_elements_text(p_supported) with ordinality item(value, ord);
  select coalesce(pg_catalog.array_agg(entry.key order by entry.key collate "C"), '{}'::text[])
    into keys
    from pg_catalog.jsonb_object_keys(p_chains) entry(key);
  select coalesce(pg_catalog.array_agg(candidate order by candidate collate "C"), '{}'::text[])
    into targets
    from pg_catalog.unnest(keys) candidate
   where candidate = any(supported)
     and candidate is distinct from p_default;

  if pg_catalog.cardinality(supported) < 1 or pg_catalog.cardinality(supported) > 32 then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('supportedLocales'),
      'message', 'supportedLocales must contain 1 to 32 locales'));
  end if;
  for index_no in 1..pg_catalog.cardinality(supported) loop
    if not platform_private.cms_locale_canonical_valid(supported[index_no]) then
      issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', pg_catalog.jsonb_build_array('supportedLocales', index_no - 1),
        'message', 'locale tag must be a canonical-case BCP 47 tag'));
    end if;
  end loop;
  foreach chain_key in array keys loop
    if not platform_private.cms_locale_canonical_valid(chain_key) then
      issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key),
        'message', 'locale tag must be a canonical-case BCP 47 tag'));
    end if;
  end loop;
  foreach chain_key in array keys loop
    select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
      into chain
      from pg_catalog.jsonb_array_elements_text(p_chains -> chain_key) with ordinality item(value, ord);
    for index_no in 1..pg_catalog.cardinality(chain) loop
      if not platform_private.cms_locale_canonical_valid(chain[index_no]) then
        issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key, index_no - 1),
          'message', 'locale tag must be a canonical-case BCP 47 tag'));
      end if;
    end loop;
  end loop;

  seen := '{}'::text[];
  for index_no in 1..pg_catalog.cardinality(supported) loop
    if supported[index_no] = any(seen) then
      issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', pg_catalog.jsonb_build_array('supportedLocales', index_no - 1),
        'message', 'supportedLocales must be unique'));
    end if;
    seen := seen || supported[index_no];
  end loop;

  if p_source is not null and not (p_source = any(supported)) then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('supportedLocales'),
      'message', 'supportedLocales must include sourceLocale'));
  end if;
  if p_default is not null and not (p_default = any(supported)) then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('supportedLocales'),
      'message', 'supportedLocales must include defaultLocale'));
  end if;

  foreach chain_key in array keys loop
    if not (chain_key = any(supported)) then
      issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key),
        'message', 'fallbackChains key must be a supported locale'));
    end if;
  end loop;
  if p_default is not null and p_chains ? p_default then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('fallbackChains', p_default),
      'message', 'defaultLocale must not have a fallback chain'));
  end if;
  if p_default is not null and exists (
    select 1 from pg_catalog.unnest(supported) candidate
     where candidate <> p_default and not (p_chains ? candidate)
  ) then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('fallbackChains'),
      'message', 'every supported locale other than defaultLocale needs a fallback chain'));
  end if;

  foreach chain_key in array targets loop
    if pg_catalog.jsonb_array_length(p_chains -> chain_key) < 1
       or pg_catalog.jsonb_array_length(p_chains -> chain_key) > 16 then
      issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key),
        'message', 'fallback chain must contain 1 to 16 locales'));
    end if;
  end loop;
  foreach chain_key in array targets loop
    select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
      into chain
      from pg_catalog.jsonb_array_elements_text(p_chains -> chain_key) with ordinality item(value, ord);
    for index_no in 1..pg_catalog.cardinality(chain) loop
      if not (chain[index_no] = any(supported)) then
        issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key, index_no - 1),
          'message', 'fallback chain locale must be a supported locale'));
      end if;
    end loop;
  end loop;
  foreach chain_key in array targets loop
    select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
      into chain
      from pg_catalog.jsonb_array_elements_text(p_chains -> chain_key) with ordinality item(value, ord);
    seen := '{}'::text[];
    for index_no in 1..pg_catalog.cardinality(chain) loop
      if chain[index_no] = any(seen) then
        issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key, index_no - 1),
          'message', 'fallback chain locales must be unique'));
      end if;
      seen := seen || chain[index_no];
    end loop;
  end loop;
  foreach chain_key in array targets loop
    select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
      into chain
      from pg_catalog.jsonb_array_elements_text(p_chains -> chain_key) with ordinality item(value, ord);
    for index_no in 1..pg_catalog.cardinality(chain) loop
      if chain[index_no] = chain_key then
        issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key, index_no - 1),
          'message', 'fallback chain must not include its own target locale'));
      end if;
    end loop;
  end loop;
  if p_default is not null then
    foreach chain_key in array targets loop
      select coalesce(pg_catalog.array_agg(item.value order by item.ord), '{}'::text[])
        into chain
        from pg_catalog.jsonb_array_elements_text(p_chains -> chain_key) with ordinality item(value, ord);
      if pg_catalog.cardinality(chain) > 0
         and chain[pg_catalog.cardinality(chain)] <> p_default then
        issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path', pg_catalog.jsonb_build_array('fallbackChains', chain_key),
          'message', 'fallback chain must end at defaultLocale'));
      end if;
    end loop;
  end if;

  -- The directed graph with an edge from each target to every other supported
  -- locale of its chain must be acyclic (self edges are excluded: they already
  -- have their own refusal).
  with recursive edge(source_key, target_key) as (
    select entry.key, link.value
      from pg_catalog.jsonb_each(p_chains) entry(key, value)
      cross join lateral pg_catalog.jsonb_array_elements_text(entry.value) link(value)
     where entry.key = any(targets)
       and link.value <> entry.key
       and link.value = any(supported)
  ), reach(source_key, target_key) as (
    select source_key, target_key from edge
    union
    select reach.source_key, edge.target_key
      from reach join edge on edge.source_key = reach.target_key
  )
  select exists (select 1 from reach where source_key = target_key) into cyclic;
  if cyclic then
    issues := issues || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path', pg_catalog.jsonb_build_array('fallbackChains'),
      'message', 'fallback chains must not form a cycle'));
  end if;
  return issues;
end;
$body$;

-- RFC 6901 pointers for the BE00 `violations` list carried as machine DETAIL.
create or replace function platform_private.cms_locale_violation_detail(p_issues jsonb)
returns text
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object('violations', coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'pointer',
      '/' || (select pg_catalog.string_agg(
                pg_catalog.replace(pg_catalog.replace(segment.value, '~', '~0'), '/', '~1'),
                '/' order by segment.ord)
              from pg_catalog.jsonb_array_elements_text(issue.value->'path')
                with ordinality segment(value, ord)),
      'message', issue.value->>'message') order by issue.ord), '[]'::jsonb))::text
  from pg_catalog.jsonb_array_elements(p_issues) with ordinality issue(value, ord)
$body$;

-- The service-role wrapper: pure validation of one locale configuration.
create or replace function platform_api.cms_validate_locale_config(
  p_source text, p_default text, p_supported jsonb, p_chains jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
begin
  if not platform_private.cms_locale_config_shape_valid(p_supported, p_chains) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return platform_private.cms_locale_config_violations(p_source, p_default, p_supported, p_chains);
end;
$body$;

-- ---------------------------------------------------------------- columns ----
alter table platform_private.cms_content_type_versions
  add column supported_locales jsonb,
  add column fallback_chains jsonb,
  add column locale_config_hash char(64);

select pg_catalog.set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_content_type_versions disable trigger user;
update platform_private.cms_content_type_versions version_row
   set supported_locales = (
         select pg_catalog.jsonb_agg(locale.value order by locale.value collate "C")
           from (select distinct item as value
                   from pg_catalog.unnest(array[version_row.source_locale, version_row.default_locale]) item
                ) locale),
       fallback_chains = coalesce((
         select pg_catalog.jsonb_object_agg(locale.value, pg_catalog.jsonb_build_array(version_row.default_locale))
           from (select distinct item as value
                   from pg_catalog.unnest(array[version_row.source_locale, version_row.default_locale]) item
                  where item <> version_row.default_locale
                ) locale), '{}'::jsonb);
update platform_private.cms_content_type_versions version_row
   set locale_config_hash = platform_private.cms_locale_config_hash(
         version_row.source_locale, version_row.default_locale,
         version_row.supported_locales, version_row.fallback_chains);
alter table platform_private.cms_content_type_versions enable trigger user;

alter table platform_private.cms_content_type_versions
  alter column supported_locales set not null,
  alter column fallback_chains set not null,
  alter column locale_config_hash set not null,
  add constraint cms_content_type_versions_supported_locales_check check (
    pg_catalog.jsonb_typeof(supported_locales) = 'array'
    and pg_catalog.jsonb_array_length(supported_locales) between 1 and 32
    and supported_locales ? source_locale
    and supported_locales ? default_locale
  ),
  add constraint cms_content_type_versions_fallback_chains_check check (
    pg_catalog.jsonb_typeof(fallback_chains) = 'object'
  ),
  add constraint cms_content_type_versions_locale_config_hash_check check (
    locale_config_hash ~ '^[a-f0-9]{64}$'
  );

-- A locale configuration is fixed at insert: the only way to change it is a
-- successor row (CMS-03A-09).  No state is exempt.
create or replace function platform_private.cms_content_version_locale_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if new.source_locale is distinct from old.source_locale
     or new.default_locale is distinct from old.default_locale
     or new.supported_locales is distinct from old.supported_locales
     or new.fallback_chains is distinct from old.fallback_chains
     or new.locale_config_hash is distinct from old.locale_config_hash then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_content_type_versions_locale_immutable_guard
before update on platform_private.cms_content_type_versions
for each row execute function platform_private.cms_content_version_locale_guard();

revoke all on function platform_private.cms_locale_canonical_valid(text),
  platform_private.cms_locale_sorted(jsonb),
  platform_private.cms_locale_config_hash(text, text, jsonb, jsonb),
  platform_private.cms_locale_config_shape_valid(jsonb, jsonb),
  platform_private.cms_locale_config_violations(text, text, jsonb, jsonb),
  platform_private.cms_locale_violation_detail(jsonb),
  platform_private.cms_content_version_locale_guard()
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_validate_locale_config(text, text, jsonb, jsonb)
  to service_role;

commit;
