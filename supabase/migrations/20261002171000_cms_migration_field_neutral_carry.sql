-- BE03a real migration scan, field-neutral plans: a breaking or conditional
-- change that touches no field and retires none (a locale-only change such as
-- removing a supported locale) has no target the registered executor could
-- prove a row against, yet its rows are untouched by definition.  Both
-- registered members therefore carry every row unchanged for such a plan (clean
-- evidence, outputHash == sourceHash) instead of failing each row as
-- unprovable, so a locale-only breaking change over a populated type
-- completes.  The behavior identifiers of the code-owned registry and every
-- transform digest are unchanged; the Worker executor mirrors this rule.
-- A spec of NULL (no transform) is still the additive carry, an unregistered
-- key or a registered key with no spec is still unprovable.  Forward-only.
begin;

create or replace function platform_private.cms_migration_expected_output(
  p_key text, p_target_version_id uuid, p_spec jsonb, p_document jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  fields jsonb := coalesce(p_spec->'targetFields', '[]'::jsonb);
  field jsonb;
  field_key text;
  present jsonb;
  result jsonb := p_document;
begin
  if p_key is null then
    return p_document;
  end if;
  if p_key not in ('identity.revalidate', 'default.fill_literal') or p_spec is null then
    return null;
  end if;
  -- No target field to prove or fill: a retire-only plan carries its rows with
  -- the retired values, and a field-neutral plan (no retired field either)
  -- carries them untouched.
  if pg_catalog.jsonb_array_length(fields) = 0 then
    return p_document;
  end if;
  if p_key = 'identity.revalidate' then
    for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
      if not platform_private.cms_migration_value_valid(p_target_version_id, field, p_document) then
        return null;
      end if;
    end loop;
    return p_document;
  end if;
  for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
    if field->>'defaultMode' is distinct from 'literal'
       or field->'defaultValue' is null
       or pg_catalog.jsonb_typeof(field->'defaultValue') = 'null' then
      return null;
    end if;
  end loop;
  for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
    field_key := field->>'fieldKey';
    present := result -> field_key;
    if present is null or pg_catalog.jsonb_typeof(present) = 'null' then
      result := result || pg_catalog.jsonb_build_object(field_key, field->'defaultValue');
    end if;
  end loop;
  return result;
end;
$body$;

revoke all on function platform_private.cms_migration_expected_output(text, uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
