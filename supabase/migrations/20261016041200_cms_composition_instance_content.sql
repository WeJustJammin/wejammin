-- Shared private D5 image; legacy NULL-tree bytes/formula remain unchanged.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_composition_instance_content(
  p_row platform_private.cms_composition_instances)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version,
    'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'mode', p_row.link_mode,
    'patternRef', case when p_row.pattern_id is null or p_row.detached_tree is not null then null
      else pg_catalog.jsonb_build_object('patternId', p_row.pattern_id, 'patternVersion', p_row.pattern_version) end,
    'props', p_row.props, 'bindings', p_row.bindings)
    || case when p_row.detached_tree is null then '{}'::jsonb
      else pg_catalog.jsonb_build_object('detachedTree', p_row.detached_tree) end
$body$;

comment on function platform_private.cms_composition_instance_content(
  platform_private.cms_composition_instances) is
  'Private canonical composition content image. SQL NULL detached_tree preserves the exact legacy seven-field D5 image, including legacy detached pins. Nonnull canonical detached content contributes privately and its retained pattern pin is provenance only. No table lookup or public snapshot field.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_composition_instance_content(platform_private.cms_composition_instances)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_composition_instance_content(platform_private.cms_composition_instances)
  from public, anon, authenticated, service_role;
commit;
