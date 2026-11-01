-- R1-003: ownership, ACL and trusted-closure proof of the DEC-201 private restore copy, split
-- from 20261017044700 (file-size limit). Same order as before: the function exists, then it is
-- handed to the CMS definer, revoked from every API role, and its closure is proven.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $owner$
declare had_create boolean := pg_catalog.has_schema_privilege('wejammin_cms_definer', 'platform_private', 'CREATE');
begin
  if not had_create then grant create on schema platform_private to wejammin_cms_definer; end if;
  alter function platform_private.cms_restore_composition_copy(
    uuid, uuid, timestamptz, platform_private.cms_composition_instances[], uuid[], uuid[])
    owner to wejammin_cms_definer;
  if not had_create then revoke create on schema platform_private from wejammin_cms_definer; end if;
end;
$owner$;
revoke all on function platform_private.cms_restore_composition_copy(
  uuid, uuid, timestamptz, platform_private.cms_composition_instances[], uuid[], uuid[])
  from public, anon, authenticated, service_role;

-- Prove the existing trusted closure, never widen a missing runtime grant.
do $closure$
declare relation_name text; signature text; callee regprocedure;
begin
  foreach relation_name in array array[
    'platform_private.cms_entry_revisions', 'platform_private.cms_content_entries',
    'platform_private.cms_content_type_versions', 'platform_private.cms_content_types',
    'platform_private.cms_schema_artifacts', 'platform_private.cms_template_versions',
    'platform_private.cms_composition_instances', 'platform_private.cms_pattern_versions',
    'platform_private.cms_block_definition_versions'
  ] loop
    if not pg_catalog.has_table_privilege('wejammin_cms_definer', relation_name, 'SELECT') then
      raise exception 'restore copy source privilege missing: %', relation_name using errcode = '55000';
    end if;
  end loop;
  if not pg_catalog.has_table_privilege('wejammin_cms_definer',
      'platform_private.cms_composition_instances', 'INSERT') then
    raise exception 'restore copy existing INSERT privilege missing' using errcode = '55000';
  end if;
  foreach signature in array array[
    'platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)',
    'platform_private.cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])',
    'extensions.gen_random_uuid()'
  ] loop
    callee := pg_catalog.to_regprocedure(signature);
    if callee is null or not pg_catalog.has_function_privilege('wejammin_cms_definer', callee, 'EXECUTE') then
      raise exception 'restore copy dependency unavailable: %', signature using errcode = '55000';
    end if;
  end loop;
end;
$closure$;


commit;
