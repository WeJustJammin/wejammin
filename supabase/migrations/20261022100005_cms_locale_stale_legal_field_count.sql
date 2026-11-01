-- Slice 12 lane dec208, the stale no_fallback gauge of the locale observability read (DEC-208, DEC-213, DEC-216, DEC-219; BE03c
-- Observability `Database-side locale observability (DEC-208)`; tracker P2-S12-AC-052, AC-263, AC-264):
--   platform_private.cms_locale_stale_legal_field_count() returns bigint
-- `staleLegalFields`: a point-in-time count, over the current locale variant of every entry whose lifecycle is `active` (an
-- archived, deletion_pending or held entry cannot be revalidated, so counting it would hold the alert open; DEC-216) (the newest
-- row per entry and case-insensitive locale by version, created_at, id descending: the cmsLocaleVariantRead rule), of the
-- stale_field_ids members whose locale policy is `no_fallback` in the entry's current (ACTIVE) schema version: the
-- localization_mode predicate cms_locale_resolutions applies to a requested field of the active version.
-- DEC-219: cms_locale_variants is append-only, so the cost may not grow with its history.  The query starts from the `active`
-- entries and reaches each current (entry, locale) head by a skip scan of INDEX(entry_id, locale, version DESC, created_at DESC,
-- id DESC) (a recursive CTE: the next distinct locale above the previous one, then the head row), so a call costs live entries x
-- locales (at most 32 per entry), never superseded rows.  The plain `locale` column, not lower(locale), because under FORCE ROW
-- LEVEL SECURITY only leakproof qualifiers can be index conditions and lower() is not leakproof (20261022100000).  It is its own function so its access path can be
-- measured on its own (supabase/tests/phase_02_slice_12_locale_observability/007-volume.sqlinc).
-- Private helper of platform_private.cms_locale_observability_read (20261022100010), which sets the transaction-local RPC
-- context its forced-RLS reads require before calling it; SECURITY DEFINER owned by the CMS definer (SEC-2), empty search_path,
-- EXECUTE revoked from PUBLIC, anon, authenticated and service_role.  Writes nothing, takes no lock.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_locale_stale_legal_field_count()
returns bigint
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_stale_legal_fields bigint;
begin
  -- Skip scan over the entry's RAW locale values with leakproof qualifiers only (uuid '=', text '=' and '>'): under FORCE ROW LEVEL
  -- SECURITY a lower(locale) qualifier cannot be an index condition (lower() is not leakproof), so the probes would read the whole
  -- entry.  The newest row per (entry, lower(locale)) is then the newest of the raw-locale heads of that case-insensitive group.
  with recursive locale_key(entry_id, content_type_id, locale) as (
    select entry_row.id,
           entry_row.content_type_id,
           (select first_row.locale
              from platform_private.cms_locale_variants first_row
             where first_row.entry_id = entry_row.id
             order by first_row.locale
             limit 1)
      from platform_private.cms_content_entries entry_row
     where entry_row.lifecycle = 'active'
    union all
    select previous.entry_id,
           previous.content_type_id,
           (select next_row.locale
              from platform_private.cms_locale_variants next_row
             where next_row.entry_id = previous.entry_id
               and next_row.locale > previous.locale
             order by next_row.locale
             limit 1)
      from locale_key previous
     where previous.locale is not null
  ), raw_head as (
    select locale_key.entry_id, locale_key.content_type_id, head_row.locale, head_row.version,
           head_row.created_at, head_row.id, head_row.state, head_row.stale_field_ids
      from locale_key
     cross join lateral (
       select current_row.locale, current_row.version, current_row.created_at, current_row.id,
              current_row.state, current_row.stale_field_ids
         from platform_private.cms_locale_variants current_row
        where current_row.entry_id = locale_key.entry_id
          and current_row.locale = locale_key.locale
        order by current_row.version desc, current_row.created_at desc, current_row.id desc
        limit 1) head_row
     where locale_key.locale is not null
  ), head as (
    select distinct on (raw_head.entry_id, pg_catalog.lower(raw_head.locale))
           raw_head.state, raw_head.stale_field_ids, raw_head.content_type_id
      from raw_head
     order by raw_head.entry_id, pg_catalog.lower(raw_head.locale),
              raw_head.version desc, raw_head.created_at desc, raw_head.id desc
  )
  select pg_catalog.count(*)
    into v_stale_legal_fields
    from head
    join platform_private.cms_content_type_versions version_row
      on version_row.content_type_id = head.content_type_id
     and version_row.state::text = 'active'
   cross join lateral pg_catalog.jsonb_array_elements_text(head.stale_field_ids) stale_member(field_id)
    join platform_private.cms_field_definition_versions definition
      on definition.content_type_version_id = version_row.id
     and definition.stable_field_id = stale_member.field_id::uuid
     and definition.state = 'active'
     and definition.localization_mode = 'no_fallback'
   where head.state = 'stale';

  return v_stale_legal_fields;
end;
$body$;

comment on function platform_private.cms_locale_stale_legal_field_count() is
  'DEC-219: the count of stale no_fallback fields on the current locale variant of every active entry, by a skip scan of the current-row index (cost: live entries x locales, never the append-only history). Caller holds the RPC context. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_stale_legal_field_count() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_locale_stale_legal_field_count()
  from public, anon, authenticated, service_role;

grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

commit;
