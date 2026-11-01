-- Slice 12 lane dec205, cmsLocaleVariantRead (DEC-205; BE03c epic index CMS-15, route registry, validation row
-- `cmsLocaleVariantRead | entryId/locale`, CMS-03C-20 consumers, `LocaleVariantRead`, error matrix, authority row; tracker
-- P2-S12-AC-058, AC-234, AC-152, AC-270): GET /api/v1/cms/entries/{entryId}/locales/{locale}, the protected read of one
-- entry's current locale variant for the translation form.
--   platform_private.cms_get_locale_variant(p_request jsonb) returns jsonb   the strict LocaleVariantRead
--   { locale, activeFallbackChain, variant, fields, resolutions }   (the platform_api wrapper is 20261022020010)
-- Private request: { entryId, locale, context?, correlationId? }.
-- Order (BE00, as CMS-03C-04): a non-object body or an unknown/absent member is INVALID_REQUEST; actor and acting party
-- (UNAUTHENTICATED); entryId a UUID and locale a BCP 47 tag (a malformed path value: INVALID_REQUEST, 400, before any
-- authority or existence answer); an entry that is absent, owned by another party or invisible to the caller is NOT_FOUND (one
-- uniform answer); a visible entry on which the caller holds neither cms.author nor cms.editor BY ASSIGNMENT is FORBIDDEN (403),
-- from the very helper CMS-03C-04 uses (cms_require_entry_capability), so the read and the write refuse identically; only
-- then a locale that is not a member of the ACTIVE content-type version's supportedLocales is NOT_FOUND, with the same
-- answer as an absent entry (a caller without edit is answered FORBIDDEN first, so authority never depends on the locale).
-- Answer:
--   locale              the locale read;
--   activeFallbackChain the active version's ordered chain for the locale, [] for the version's default locale (the
--                       CMS-03C-04 equality expectation, BE03a OD-4);
--   variant             the LocaleVariantResource of the NEWEST row of the locale, or null when none exists (untranslated).
--                       id/version/createdAt/updatedAt = that row; contentHash = its revision's payload hash; state = the
--                       derived LocaleVariantState (cms_locale_variant_state); fallbackChain/noFallbackFieldIds/staleFieldIds
--                       as stored; so a variant written by CMS-03C-04 reads back byte-identical to the 201 resource;
--   fields              the localizable (localized, no_fallback) active fields' stored values of the variant's revision,
--                       ascending by field id; an explicit JSON null is listed as null, a field the translator never wrote is
--                       not listed; [] when there is no variant.  Never another locale's value;
--   resolutions         the CMS-03C-20 resolution of EVERY localizable active field of the active version for the locale, in
--                       ONE statement through the resolver core cms_locale_resolutions with the locale's newest revision
--                       as its own (exactly cms_resolve_locale_field's semantics, the one resolver of the publication gate
--                       and the delivery projection), ascending by field id.  Identifiers, enums and booleans only.
-- A read: it locks and writes nothing (no insert, update, delete, audit, outbox or idempotency row).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_get_locale_variant(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_locale text;
  v_entry platform_private.cms_content_entries%rowtype;
  v_version platform_private.cms_content_type_versions%rowtype;
  v_variant platform_private.cms_locale_variants%rowtype;
  v_variant_found boolean;
  v_chain jsonb;
  v_field_ids uuid[];
  v_resource jsonb := null;
  v_fields jsonb := '[]'::jsonb;
  v_resolutions jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request, array['entryId', 'locale']::text[],
       array['entryId', 'locale', 'context', 'correlationId']::text[]) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or pg_catalog.jsonb_typeof(p_request->'locale') is distinct from 'string'
     or p_request->>'locale' !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_locale := p_request->>'locale';

  select * into v_entry from platform_private.cms_content_entries entry_row
   where entry_row.id = (p_request->>'entryId')::uuid;
  if not found or v_entry.owner_party_id is distinct from v_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, v_entry.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability(
    v_actor_id, v_party_id, array['cms.author', 'cms.editor']::text[], v_entry.id);

  select * into v_version from platform_private.cms_content_type_versions version_row
   where version_row.content_type_id = v_entry.content_type_id and version_row.state::text = 'active';
  if not found then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if not (v_version.supported_locales ? v_locale) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_chain := case when v_locale = v_version.default_locale then '[]'::jsonb
                  else coalesce(v_version.fallback_chains -> v_locale, '[]'::jsonb) end;

  select * into v_variant from platform_private.cms_locale_variants variant_row
   where variant_row.entry_id = v_entry.id and pg_catalog.lower(variant_row.locale) = pg_catalog.lower(v_locale)
   order by variant_row.version desc, variant_row.created_at desc, variant_row.id desc
   limit 1;
  v_variant_found := found;
  if v_variant_found then
    select pg_catalog.jsonb_build_object(
             'id', v_variant.id,
             'version', v_variant.version::text,
             'contentHash', pg_catalog.btrim(revision_row.payload_hash::text),
             'createdAt', platform_private.auth_iso_time(v_variant.created_at),
             'updatedAt', platform_private.auth_iso_time(v_variant.updated_at),
             'state', platform_private.cms_locale_variant_state(v_entry.id, v_locale),
             'entryId', v_entry.id,
             'revisionId', v_variant.revision_id,
             'locale', v_variant.locale,
             'sourceRevisionId', v_variant.source_revision_id,
             'fallbackChain', v_variant.fallback_chain,
             'noFallbackFieldIds', v_variant.no_fallback_field_ids,
             'staleFieldIds', v_variant.stale_field_ids)
      into v_resource
      from platform_private.cms_entry_revisions revision_row
     where revision_row.id = v_variant.revision_id;
    if v_resource is null then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    select coalesce(pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object('fieldId', value_row.field_id, 'value', coalesce(value_row.value, 'null'::jsonb))
             order by value_row.field_id), '[]'::jsonb)
      into v_fields
      from platform_private.cms_entry_field_values value_row
      join platform_private.cms_field_definition_versions definition
        on definition.stable_field_id = value_row.field_id
       and definition.content_type_version_id = v_version.id
       and definition.state = 'active'
       and definition.localization_mode in ('localized', 'no_fallback')
     where value_row.revision_id = v_variant.revision_id;
  end if;

  select coalesce(pg_catalog.array_agg(definition.stable_field_id order by definition.stable_field_id), array[]::uuid[])
    into v_field_ids
    from platform_private.cms_field_definition_versions definition
   where definition.content_type_version_id = v_version.id
     and definition.state = 'active'
     and definition.localization_mode in ('localized', 'no_fallback');
  select coalesce(pg_catalog.jsonb_agg(resolved.resolution order by resolved.field_id), '[]'::jsonb)
    into v_resolutions
    from platform_private.cms_locale_resolutions(v_entry.id, v_locale, v_version.id, v_field_ids, null) resolved;

  return pg_catalog.jsonb_build_object(
    'locale', v_locale,
    'activeFallbackChain', v_chain,
    'variant', case when v_variant_found then v_resource else 'null'::jsonb end,
    'fields', v_fields,
    'resolutions', v_resolutions);
end;
$body$;

comment on function platform_private.cms_get_locale_variant(jsonb) is
  'cmsLocaleVariantRead (DEC-205): an assigned author or editor who can edit the entry reads its current locale variant (or null), the variant''s stored localizable values, the CMS-03C-20 resolution of every localizable field and the active fallback order; a visible entry without edit is FORBIDDEN, a hidden or absent one or an unsupported locale NOT_FOUND. A read: writes and locks nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_get_locale_variant(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_get_locale_variant(jsonb) from public, anon, authenticated, service_role;

-- Privilege closure: every function and table the reader uses directly must be available to the definer; only what is missing is granted.
do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_actor(jsonb)',
    'platform_private.cms_acting_party(jsonb,uuid)', 'platform_private.cms_valid_uuid(text)',
    'platform_private.cms_entry_tenant_visible(uuid,uuid)',
    'platform_private.cms_require_entry_capability(uuid,uuid,text[],uuid)',
    'platform_private.cms_locale_variant_state(uuid,text)',
    'platform_private.cms_locale_resolutions(uuid,text,uuid,uuid[],uuid)',
    'platform_private.auth_iso_time(timestamptz)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'locale-variant reader callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_revisions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

commit;
