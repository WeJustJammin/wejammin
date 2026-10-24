-- Slice 12 lane locale, CMS-03C-20 shared locale field resolution (BE03c Internal service operations 189,
-- Locale field resolution (DEC-121, DEC-138) and fan-out (D12) 1389; tracker P2-S12-AC-051, AC-052,
-- AC-148, AC-149, AC-150, AC-151, AC-152):
--
--   cms_locale_resolutions(entry, locale, schema version, field ids, own revision)   the one resolver core:
--       one LocaleFieldResolution per requested active field of the schema version, evaluated in a single
--       statement.  `own revision` names the revision whose values are the target locale's own (the
--       preflight gate passes the revision under evaluation); null means the newest revision of the locale.
--   cms_resolve_locale_field(entry, locale, field)   CMS-03C-20: the same resolution for one field of the
--       entry's content type ACTIVE version, the form the Shard 04 delivery projection and the editorial
--       reads call.  It has no browser route and no platform_api wrapper.
--
-- Resolution (DEC-121):
--   none         the value of the source-locale revision (newest revision of the version's sourceLocale);
--   localized    the field in the target locale's own revision when it holds a value (a STALE value is still
--                served and flagged stale: it never blocks and never falls through), else the first locale
--                of the version's fallbackChains[locale] (ordered) whose newest revision holds a value
--                (provenance localized_fallback, resolvedFromLocale), else missing;
--   no_fallback  only the target locale's own revision: never resolved through fallbackChains.  A missing
--                value is no_fallback_missing, a stale one no_fallback_stale, both blocking.
-- A field "holds a value" when a value row exists whose JSON is not null.  A field is stale when the own
-- revision's variant row recorded a source value hash for it that differs from the current hash of the
-- source-locale revision (a legacy stale row without recorded hashes is stale in every field).  The
-- resolution carries identifiers, enums and booleans only, never locale text.  Both functions are STABLE:
-- no insert, update, delete, audit or outbox row.  Private, SECURITY DEFINER owned by the CMS definer
-- (SEC-2), EXECUTE revoked from PUBLIC, anon, authenticated and service_role; callers run under the CMS
-- RPC context.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_locale_resolutions(
  p_entry_id uuid,
  p_locale text,
  p_schema_version_id uuid,
  p_field_ids uuid[],
  p_own_revision_id uuid
)
returns table(field_id uuid, resolution jsonb)
language sql
stable
security definer
set search_path = ''
as $body$
  with version_row as (
    select version.source_locale, version.fallback_chains
      from platform_private.cms_content_type_versions version
     where version.id = p_schema_version_id
  ), chain as (
    select coalesce((select member.value
                       from version_row, pg_catalog.jsonb_each(version_row.fallback_chains) member
                      where pg_catalog.lower(member.key) = pg_catalog.lower(p_locale)),
                    '[]'::jsonb) as locales
  ), own_revision as (
    select revision.id
      from platform_private.cms_entry_revisions revision
     where revision.entry_id = p_entry_id
       and case when p_own_revision_id is null
                then pg_catalog.lower(revision.locale) = pg_catalog.lower(p_locale)
                else revision.id = p_own_revision_id end
     order by revision.revision_number desc, revision.id desc
     limit 1
  ), own_variant as (
    select variant.state, variant.field_source_hashes
      from own_revision
      join platform_private.cms_locale_variants variant
        on variant.revision_id = own_revision.id and variant.entry_id = p_entry_id
     order by variant.version desc, variant.created_at desc, variant.id desc
     limit 1
  ), source_revision as (
    select revision.id
      from platform_private.cms_entry_revisions revision, version_row
     where revision.entry_id = p_entry_id
       and pg_catalog.lower(revision.locale) = pg_catalog.lower(version_row.source_locale)
     order by revision.revision_number desc, revision.id desc
     limit 1
  ), requested as (
    select definition.stable_field_id as field_id, definition.localization_mode as mode, wanted.ordinal
      from pg_catalog.unnest(p_field_ids) with ordinality wanted(field_id, ordinal)
      join platform_private.cms_field_definition_versions definition
        on definition.stable_field_id = wanted.field_id
       and definition.content_type_version_id = p_schema_version_id
       and definition.state = 'active'
  ), evaluated as (
    select requested.field_id, requested.mode, requested.ordinal,
           exists (
             select 1 from own_revision
               join platform_private.cms_entry_field_values value_row on value_row.revision_id = own_revision.id
              where value_row.field_id = requested.field_id
                and value_row.value is not null and value_row.value <> 'null'::jsonb) as own_has,
           exists (
             select 1 from source_revision
               join platform_private.cms_entry_field_values value_row on value_row.revision_id = source_revision.id
              where value_row.field_id = requested.field_id
                and value_row.value is not null and value_row.value <> 'null'::jsonb) as source_has,
           coalesce((
             select (own_variant.field_source_hashes ? requested.field_id::text
                       and own_variant.field_source_hashes ->> requested.field_id::text is distinct from
                           platform_private.cms_locale_source_field_hash(source_revision.id, requested.field_id))
                    or (own_variant.state = 'stale' and own_variant.field_source_hashes = '{}'::jsonb)
               from own_variant, source_revision), false) as own_stale,
           (select chain_member.locale
              from chain, pg_catalog.jsonb_array_elements_text(chain.locales) with ordinality chain_member(locale, ordinal)
             where exists (
               select 1
                 from platform_private.cms_entry_field_values value_row
                where value_row.field_id = requested.field_id
                  and value_row.value is not null and value_row.value <> 'null'::jsonb
                  and value_row.revision_id = (
                    select revision.id from platform_private.cms_entry_revisions revision
                     where revision.entry_id = p_entry_id
                       and pg_catalog.lower(revision.locale) = pg_catalog.lower(chain_member.locale)
                     order by revision.revision_number desc, revision.id desc
                     limit 1))
             order by chain_member.ordinal
             limit 1) as chain_locale
      from requested
  )
  select evaluated.field_id,
         pg_catalog.jsonb_build_object(
           'fieldId', evaluated.field_id,
           'locale', p_locale,
           'mode', evaluated.mode,
           'outcome', case evaluated.mode
                        when 'none' then case when evaluated.source_has then 'resolved' else 'missing' end
                        when 'localized' then case when evaluated.own_has or evaluated.chain_locale is not null
                                                   then 'resolved' else 'missing' end
                        else case when evaluated.own_has then 'resolved' else 'missing' end
                      end,
           'provenance', case evaluated.mode
                           when 'none' then case when evaluated.source_has then 'authored' else 'missing' end
                           when 'localized' then case when evaluated.own_has then 'authored'
                                                      when evaluated.chain_locale is not null then 'localized_fallback'
                                                      else 'missing' end
                           else case when evaluated.own_has then 'authored' else 'missing' end
                         end,
           'resolvedFromLocale', case when evaluated.mode = 'localized' and not evaluated.own_has
                                      then evaluated.chain_locale end,
           'stale', evaluated.own_has and evaluated.own_stale and evaluated.mode <> 'none',
           'blocking', evaluated.mode = 'no_fallback'
                       and (not evaluated.own_has or evaluated.own_stale),
           'reasonCode', case when evaluated.mode <> 'no_fallback' then null
                              when not evaluated.own_has then 'no_fallback_missing'
                              when evaluated.own_stale then 'no_fallback_stale' end
         )
    from evaluated
   order by evaluated.ordinal
$body$;

comment on function platform_private.cms_locale_resolutions(uuid, text, uuid, uuid[], uuid) is
  'CMS-03C-20 core (DEC-121, DEC-138): one LocaleFieldResolution per requested active field of a schema version in a single statement; the own revision is the explicit revision under evaluation or the newest revision of the locale. Private; STABLE; callers run under the CMS RPC context.';

create function platform_private.cms_resolve_locale_field(
  p_entry_id uuid,
  p_locale text,
  p_field_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  version_id uuid;
  resolved jsonb;
begin
  if p_entry_id is null or p_field_id is null or p_locale is null
     or p_locale !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select version.id into version_id
    from platform_private.cms_content_entries entry
    join platform_private.cms_content_type_versions version
      on version.content_type_id = entry.content_type_id and version.state::text = 'active'
   where entry.id = p_entry_id;
  if not found then
    if exists (select 1 from platform_private.cms_content_entries entry where entry.id = p_entry_id) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select resolved_row.resolution into resolved
    from platform_private.cms_locale_resolutions(p_entry_id, p_locale, version_id,
           array[p_field_id], null) resolved_row;
  if resolved is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return resolved;
end;
$body$;

comment on function platform_private.cms_resolve_locale_field(uuid, text, uuid) is
  'CMS-03C-20 (DEC-121, DEC-138): the LocaleFieldResolution of one field of the entry content type active version for a target locale; the one resolver of the preflight gate, the Shard 04 delivery projection and the editorial reads. Read-only, deterministic, no browser route. Private; STABLE; callers run under the CMS RPC context.';

grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_revisions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_resolutions(uuid, text, uuid, uuid[], uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_resolve_locale_field(uuid, text, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_locale_resolutions(uuid, text, uuid, uuid[], uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_resolve_locale_field(uuid, text, uuid)
  from public, anon, authenticated, service_role;

commit;
