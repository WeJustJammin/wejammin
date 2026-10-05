-- Slice 09 (re-audit AC064/AC065/AC067): a JSON null defaultMode, localizationMode or
-- lifecycle made `NULL NOT IN (...)` evaluate to NULL, so the closed-vocabulary
-- check passed and the caller's null was silently coerced to the column default
-- ('none' / 'active').  The three members are now null-safe: an absent or null
-- value is outside the closed set and refused.  Body is otherwise identical to the
-- previous definition (regenerated from the live function); grants unchanged.
-- Forward-only.
begin;

create or replace function platform_private.cms_valid_field_input(p_value jsonb, p_require_stable_id boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  constraints jsonb;
  editor_config jsonb;
  kind text;
begin
  if not platform_private.cms_exact_keys(
    p_value,
    case when p_require_stable_id
      then array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
      else array['key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','localizationMode','editorConfig','lifecycle']::text[]
    end,
    array['stableFieldId','key','kind','constraints','required','validatorKey','validatorVersion','defaultMode','defaultValue','localizationMode','editorConfig','lifecycle']::text[]
  ) then
    return false;
  end if;
  if p_require_stable_id and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
  if not p_require_stable_id and p_value ? 'stableFieldId'
     and not platform_private.cms_valid_uuid(p_value->>'stableFieldId') then return false; end if;
  if p_value->>'key' !~ '^[a-z][a-z0-9_]{1,63}$' or platform_private.cms_reserved_key(p_value->>'key') then return false; end if;
  kind := p_value->>'kind';
  if kind not in (
    'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
  ) then return false; end if;
  constraints := p_value->'constraints';
  if pg_catalog.jsonb_typeof(constraints) <> 'object'
     or not platform_private.cms_json_bounded(constraints, 8192, 4, 64, 256)
     or exists (select 1 from pg_catalog.jsonb_object_keys(constraints) key_name
       where key_name not in ('minLength','maxLength','minimum','maximum','enumValues','itemKind')) then
    return false;
  end if;
  if constraints ? 'minLength' and (
       pg_catalog.jsonb_typeof(constraints->'minLength') <> 'number'
       or (constraints->>'minLength') !~ '^[0-9]+$'
       or (constraints->>'minLength')::numeric > 100000
     ) then return false; end if;
  if constraints ? 'maxLength' and (
       pg_catalog.jsonb_typeof(constraints->'maxLength') <> 'number'
       or (constraints->>'maxLength') !~ '^[0-9]+$'
       or (constraints->>'maxLength')::numeric > 100000
     ) then return false; end if;
  if constraints ? 'minLength' and constraints ? 'maxLength'
     and (constraints->>'minLength')::numeric > (constraints->>'maxLength')::numeric then return false; end if;
  if constraints ? 'minimum' and pg_catalog.jsonb_typeof(constraints->'minimum') <> 'number' then return false; end if;
  if constraints ? 'maximum' and pg_catalog.jsonb_typeof(constraints->'maximum') <> 'number' then return false; end if;
  if constraints ? 'minimum' and constraints ? 'maximum'
     and (constraints->>'minimum')::numeric > (constraints->>'maximum')::numeric then return false; end if;
  if constraints ? 'enumValues' then
    if pg_catalog.jsonb_typeof(constraints->'enumValues') <> 'array'
       or pg_catalog.jsonb_array_length(constraints->'enumValues') > 256
       or exists (select 1 from pg_catalog.jsonb_array_elements(constraints->'enumValues') enum_entry
         where pg_catalog.jsonb_typeof(enum_entry) <> 'string'
           or pg_catalog.length(enum_entry #>> '{}') > 160) then return false; end if;
  end if;
  if constraints ? 'itemKind' and (constraints->>'itemKind') not in (
    'short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal',
    'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list'
  ) then return false; end if;
  if pg_catalog.jsonb_typeof(p_value->'required') <> 'boolean'
     or coalesce(p_value->>'defaultMode', '') not in ('none','literal','inherited')
     or coalesce(p_value->>'localizationMode', '') not in ('none','localized','no_fallback')
     or coalesce(p_value->>'lifecycle', '') not in ('active','deprecated','retired') then return false; end if;
  if (p_value->>'validatorKey' is null) <> (p_value->>'validatorVersion' is null) then return false; end if;
  if p_value->>'validatorKey' is not null
     and (p_value->>'validatorKey') !~ '^[a-z][a-z0-9._-]{0,127}$' then return false; end if;
  if p_value->>'validatorVersion' is not null
     and (
       not platform_private.cms_valid_version(p_value->>'validatorVersion')
       or not platform_private.cms_validator_registry_valid(
         p_value->>'validatorKey', (p_value->>'validatorVersion')::bigint
       )
     ) then return false; end if;
  if p_value->>'defaultMode' = 'literal'
     and (not (p_value ? 'defaultValue') or p_value->'defaultValue' = 'null'::jsonb) then return false; end if;
  if p_value->>'defaultMode' in ('none','inherited') and p_value ? 'defaultValue' then return false; end if;
  if p_value ? 'defaultValue'
     and not platform_private.cms_json_bounded(p_value->'defaultValue', 262144, 8, 128, 128) then return false; end if;
  editor_config := p_value->'editorConfig';
  if not platform_private.cms_exact_keys(
    editor_config,
    array['label','order']::text[],
    array['label','helpText','order']::text[]
  ) or pg_catalog.length(pg_catalog.normalize(editor_config->>'label', 'NFC')) not between 1 and 120
    or (editor_config ? 'helpText' and pg_catalog.length(pg_catalog.normalize(editor_config->>'helpText', 'NFC')) > 500)
    or pg_catalog.jsonb_typeof(editor_config->'order') <> 'number'
    or (editor_config->>'order') !~ '^[0-9]+$'
    or (editor_config->>'order')::numeric > 10000 then return false; end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  return false;
end;
$function$;

commit;
