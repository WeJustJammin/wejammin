-- Existing public resource fields; only its private content hash image evolves.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_composition_instance_resource(
  p_row platform_private.cms_composition_instances)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_object(
    'id', p_row.id, 'version', p_row.version::text,
    'contentHash', platform_private.cms_jcs_sha256(platform_private.cms_composition_instance_content(p_row)),
    'createdAt', platform_private.auth_iso_time(p_row.created_at),
    'updatedAt', platform_private.auth_iso_time(p_row.updated_at),
    'state', p_row.state, 'revisionId', p_row.revision_id, 'path', p_row.path, 'position', p_row.position,
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version, 'patternId', p_row.pattern_id,
    'patternVersion', p_row.pattern_version, 'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'linkMode', p_row.link_mode, 'conflictState', case p_row.link_mode when 'linked' then 'none' else null end)
$body$;

comment on function platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances) is
  'CompositionInstanceResource with unchanged public members; contentHash uses the shared private canonical content image, including a nonnull detached tree without exposing it. Legacy NULL-tree hash input is unchanged.';

revoke all on function platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)
  from public, anon, authenticated, service_role;
commit;
