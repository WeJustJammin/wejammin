-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound).
-- A placement projects every inserted row through cms_composition_instance_resource, which canonicalises and hashes the
-- row's content image (blockKey, blockVersion, digest, mode, patternRef, props, bindings) once per row: 0.09 ms of the
-- 0.2 ms per row.  Rows of one placement share most content images, so the producer hashes each DISTINCT image once and
-- projects the rows through cms_composition_instance_resource_hashed(row, hash), the same projection with the hash
-- supplied.  cms_composition_instance_resource now delegates to it, so there is one projection body and its output is
-- byte for byte unchanged for every caller (asserted by phase_02_slice_12_placement_perf_equivalence).  The hashed
-- form is private like its sibling (owner CMS definer, SECURITY DEFINER, empty search_path, no API-role grant).
-- The installed source of the existing function must equal the promoted source byte for byte.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_composition_instance_resource_hashed(
  p_row platform_private.cms_composition_instances, p_content_hash text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$

  select pg_catalog.jsonb_build_object(
    'id', p_row.id, 'version', p_row.version::text,
    'contentHash', p_content_hash,
    'createdAt', platform_private.auth_iso_time(p_row.created_at),
    'updatedAt', platform_private.auth_iso_time(p_row.updated_at),
    'state', p_row.state, 'revisionId', p_row.revision_id, 'path', p_row.path, 'position', p_row.position,
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version, 'patternId', p_row.pattern_id,
    'patternVersion', p_row.pattern_version, 'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'linkMode', p_row.link_mode, 'conflictState', case p_row.link_mode when 'linked' then 'none' else null end)
$body$;

comment on function platform_private.cms_composition_instance_resource_hashed(platform_private.cms_composition_instances, text) is
  'CompositionInstanceResource of a stored row with its contentHash supplied by the caller (the hash of cms_composition_instance_content, computed once per distinct image); cms_composition_instance_resource delegates here. Private.';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_composition_instance_resource_hashed(platform_private.cms_composition_instances, text)
    owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_composition_instance_resource_hashed(platform_private.cms_composition_instances, text)
  from public, anon, authenticated, service_role;

do $migration$
declare
  identity constant text := 'platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)';
  original pg_catalog.pg_proc%rowtype;
  actual pg_catalog.pg_proc%rowtype;
  old_source constant text := $old$
  select pg_catalog.jsonb_build_object(
    'id', p_row.id, 'version', p_row.version::text,
    'contentHash', platform_private.cms_jcs_sha256(platform_private.cms_composition_instance_content(p_row)),
    'createdAt', platform_private.auth_iso_time(p_row.created_at),
    'updatedAt', platform_private.auth_iso_time(p_row.updated_at),
    'state', p_row.state, 'revisionId', p_row.revision_id, 'path', p_row.path, 'position', p_row.position,
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version, 'patternId', p_row.pattern_id,
    'patternVersion', p_row.pattern_version, 'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'linkMode', p_row.link_mode, 'conflictState', case p_row.link_mode when 'linked' then 'none' else null end)
$old$;
  new_source constant text := $new$
  select platform_private.cms_composition_instance_resource_hashed(
           p_row, platform_private.cms_jcs_sha256(platform_private.cms_composition_instance_content(p_row)))
$new$;
  definition text;
  comment_text text;
begin
  select proc.* into original from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found then
    raise exception 'placement-perf: missing existing function %', identity using errcode = '55000';
  end if;
  if original.prosrc is distinct from old_source then
    raise exception 'placement-perf: unexpected installed source of %', identity using errcode = '55000';
  end if;
  if original.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or original.prosecdef is distinct from true or original.prokind <> 'f' or original.provolatile <> 's'
     or original.proretset or original.proconfig is distinct from array['search_path=""']::text[]
     or original.prolang <> (select oid from pg_catalog.pg_language where lanname = 'sql') then
    raise exception 'placement-perf: unexpected baseline attributes of %', identity using errcode = '55000';
  end if;
  comment_text := pg_catalog.obj_description(original.oid, 'pg_proc');
  definition := pg_catalog.pg_get_functiondef(original.oid);
  if (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, old_source, '')))
       / pg_catalog.length(old_source) <> 1 then
    raise exception 'placement-perf: ambiguous definition of %', identity using errcode = '55000';
  end if;
  execute pg_catalog.replace(definition, old_source, new_source);
  select proc.* into actual from pg_catalog.pg_proc proc where proc.oid = pg_catalog.to_regprocedure(identity);
  if not found or actual.oid <> original.oid or actual.prosrc is distinct from new_source
     or pg_catalog.to_jsonb(actual) - 'prosrc' is distinct from pg_catalog.to_jsonb(original) - 'prosrc'
     or pg_catalog.obj_description(actual.oid, 'pg_proc') is distinct from comment_text then
    raise exception 'placement-perf: replacement changed more than the source of %', identity using errcode = '55000';
  end if;
end;
$migration$;

commit;
