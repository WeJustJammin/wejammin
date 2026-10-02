-- Forward-only BE03b correction. Rich text is approved structured AST, never
-- a scalar string or arbitrary JSON. The protected registry has no rich-text
-- validator yet, so non-null values must remain fail-closed until one exists.
-- A rollback to the previous function would reopen unvalidated admission.
begin;
set local lock_timeout = '5s';

do $preflight$
begin
  if exists (
    select 1
    from platform_private.cms_entry_field_values value_row
    join platform_private.cms_field_definition_versions field_row
      on field_row.id = value_row.field_definition_id
    where field_row.kind = 'rich_text'
      and value_row.value is not null
      and pg_catalog.jsonb_typeof(value_row.value) <> 'null'
  ) then
    raise exception 'CMS rich-text values require an approved AST migration before admission is narrowed'
      using errcode = 'P0001';
  end if;
end;
$preflight$;

create or replace function platform_private.cms_draft_field_value_valid(
  p_schema_version_id uuid,
  p_field_id uuid,
  p_value jsonb,
  p_provenance text
)
returns boolean
language plpgsql
stable
set search_path = ''
as $body$
declare
  field_row platform_private.cms_field_definition_versions%rowtype;
  value_type text;
  numeric_value numeric;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return p_provenance in ('explicit_null', 'missing')
      and exists (
        select 1
        from platform_private.cms_field_definition_versions field
        where field.stable_field_id = p_field_id
          and field.content_type_version_id = p_schema_version_id
      );
  end if;

  select * into field_row
  from platform_private.cms_field_definition_versions field
  where field.stable_field_id = p_field_id
    and field.content_type_version_id = p_schema_version_id;
  if not found then
    return false;
  end if;

  value_type := pg_catalog.jsonb_typeof(p_value);
  -- BE03b permits only an approved structured AST. No executable rich-text
  -- validator is registered yet; admitting a scalar or arbitrary JSON would
  -- make the protected write and read boundaries claim false schema proof.
  if field_row.kind = 'rich_text' then
    return false;
  end if;
  if field_row.kind in ('short_text', 'long_text', 'enum', 'taxonomy')
     and value_type <> 'string' then
    return false;
  end if;
  if field_row.kind = 'boolean' and value_type <> 'boolean' then
    return false;
  end if;
  if field_row.kind = 'integer'
     and (value_type <> 'number' or (p_value::text) !~ '^-?[0-9]+$') then
    return false;
  end if;
  if field_row.kind = 'decimal' and value_type <> 'number' then
    return false;
  end if;
  if field_row.kind = 'date' then
    if value_type <> 'string'
       or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return false;
    end if;
    begin
      perform (p_value #>> '{}')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
  end if;
  if field_row.kind = 'datetime' then
    if value_type <> 'string'
       or (p_value #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
      return false;
    end if;
    begin
      -- PostgreSQL rejects offsets above 15:59, while the declared ISO
      -- contract accepts offsets up to 23:59.  The regex validates clock and
      -- offset components; cast only the calendar portion for real dates.
      perform pg_catalog.left(p_value #>> '{}', 10)::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        return false;
    end;
  end if;
  if field_row.kind = 'object' and value_type <> 'object' then
    return false;
  end if;
  if field_row.kind = 'list' and value_type <> 'array' then
    return false;
  end if;
  if field_row.kind in ('media', 'relation')
     and value_type not in ('string', 'array', 'object') then
    return false;
  end if;

  if value_type = 'string' then
    if field_row.constraints ? 'minLength'
       and pg_catalog.length(p_value #>> '{}')
           < (field_row.constraints->>'minLength')::integer then
      return false;
    end if;
    if field_row.constraints ? 'maxLength'
       and pg_catalog.length(p_value #>> '{}')
           > (field_row.constraints->>'maxLength')::integer then
      return false;
    end if;
    if field_row.constraints ? 'enumValues'
       and not (field_row.constraints->'enumValues'
                @> pg_catalog.jsonb_build_array(p_value #>> '{}')) then
      return false;
    end if;
  end if;
  if value_type = 'number' then
    numeric_value := (p_value::text)::numeric;
    if field_row.constraints ? 'minimum'
       and numeric_value < (field_row.constraints->>'minimum')::numeric then
      return false;
    end if;
    if field_row.constraints ? 'maximum'
       and numeric_value > (field_row.constraints->>'maximum')::numeric then
      return false;
    end if;
  end if;
  if value_type = 'array'
     and field_row.constraints ? 'maxLength'
     and pg_catalog.jsonb_array_length(p_value)
         > (field_row.constraints->>'maxLength')::integer then
    return false;
  end if;
  return true;
end;
$body$;

comment on function platform_private.cms_draft_field_value_valid(uuid, uuid, jsonb, text) is
  'Pinned-schema draft value gate. Rich text remains non-null fail-closed until an approved structured-AST validator is registered; raw strings and arbitrary JSON are refused.';

commit;
