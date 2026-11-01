begin;
create or replace function platform_private.cms_compiled_manifest_bounded(p_value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $body$
  select platform_private.cms_json_bounded(p_value, 524288, 12, 128, 128)
$body$;
commit;
