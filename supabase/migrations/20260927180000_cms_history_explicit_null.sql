-- CMS-03B-03 history must preserve the declared explicit-null provenance of
-- an immutable field value. This forward-only correction replaces two private
-- read helpers; no revision, field value, grant, or cursor is rewritten.

begin;

create or replace function platform_private.cms_revision_field_payload(
  p_revision_id uuid,
  p_locale text,
  p_schema_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  field_count integer;
  payload jsonb;
begin
  if p_revision_id is null or p_locale is null or p_schema_version_id is null then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select count(*)::integer into field_count
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = p_revision_id
    and field_value.locale = p_locale;
  if field_count > 128 then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from platform_private.cms_entry_field_values field_value
    where field_value.revision_id = p_revision_id
      and field_value.locale = p_locale
      and (
        not exists (
          select 1
          from platform_private.cms_field_definition_versions field
          where field.id = field_value.field_definition_id
            and field.stable_field_id = field_value.field_id
            and field.content_type_version_id = p_schema_version_id
        )
        or (field_value.value is not null
            and not platform_private.cms_json_bounded(
              field_value.value, 262144, 8, 128, 128
            ))
        or not platform_private.cms_draft_field_value_valid(
          p_schema_version_id,
          field_value.field_id,
          field_value.value,
          field_value.provenance
        )
        or pg_catalog.btrim(field_value.value_hash::text) is distinct from
          case
            when field_value.value is null
              or pg_catalog.jsonb_typeof(field_value.value) = 'null'
              then null
            else platform_private.cms_jcs_sha256(field_value.value)
          end
      )
  ) then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.jsonb_object_agg(
    field_value.field_id::text,
    pg_catalog.btrim(field_value.value_hash::text)
  ), '{}'::jsonb) into payload
  from platform_private.cms_entry_field_values field_value
  where field_value.revision_id = p_revision_id
    and field_value.locale = p_locale;

  return payload;
end;
$body$;

comment on function platform_private.cms_revision_field_payload(uuid, text, uuid) is
  'Safe CMS-03B-03 field projection: stable field id to checked value hash, or JSON null for declared explicit-null/missing provenance. Never returns content.';

create or replace function platform_private.cms_revision_field_hash(p_value jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if pg_catalog.jsonb_typeof(p_value) = 'null' then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_value) is distinct from 'string'
     or coalesce(p_value #>> '{}', '') !~ '^[a-f0-9]{64}$' then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  return p_value #>> '{}';
end;
$body$;

comment on function platform_private.cms_revision_field_hash(jsonb) is
  'Extracts a verified 64-hex value hash or an explicit-null absence marker for CMS-03B-03 compare.';

revoke all on function platform_private.cms_revision_field_payload(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revision_field_hash(jsonb)
  from public, anon, authenticated, service_role;

commit;
