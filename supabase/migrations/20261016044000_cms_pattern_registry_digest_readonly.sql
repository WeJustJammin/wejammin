-- DEC-199: read-only registry digest used by publication currentness.
-- This is the writer's tuple fold without its locks, VOLATILE marking, or
-- SECURITY DEFINER boundary.  Callers already run in the CMS permission
-- closure; a missing/withdrawn registry row yields a null digest.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_pattern_registry_digest_readonly(
  p_owner_id uuid, p_tree jsonb
)
returns text
language sql
stable
security invoker
set search_path = ''
as $body$
  with reached as (
    select distinct closure.block_key, closure.block_version
      from platform_private.cms_governed_pattern_closure(p_owner_id, p_tree) closure
     where closure.item_kind = 'block'
  ), tuple_rows as (
    select reached.block_key, reached.block_version,
           block_row.id as block_definition_id,
           block_row.release_digest, block_row.props_schema_hash,
           block_row.renderer_ref,
           coalesce(lifecycle.to_lifecycle, 'supported') as lifecycle
      from reached
      left join platform_private.cms_block_definition_versions block_row
        on block_row.block_key = reached.block_key
       and block_row.block_version = reached.block_version
       and block_row.state = 'registered'
      left join lateral (
        select event.to_lifecycle
          from platform_private.cms_block_definition_lifecycle_events event
         where event.block_definition_version_id = block_row.id
         order by event.created_at desc, event.id desc
         limit 1
      ) lifecycle on true
  ), folded as (
    select coalesce(
             pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'blockKey', block_key,
               'blockVersion', block_version,
               'releaseDigest', pg_catalog.btrim(release_digest::text),
               'propsSchemaHash', pg_catalog.btrim(props_schema_hash::text),
               'rendererRef', renderer_ref,
               'lifecycle', lifecycle
             ) order by block_key collate "C", block_version), '[]'::jsonb) as tuples,
           coalesce(
             pg_catalog.bool_and(block_definition_id is not null and lifecycle <> 'withdrawn'), true
           ) as valid
      from tuple_rows
  )
  select case when valid then platform_private.cms_jcs_sha256(tuples) else null end
    from folded
$body$;

comment on function platform_private.cms_pattern_registry_digest_readonly(uuid, jsonb) is
  'DEC-199 read-only pattern registry digest: deduplicated reachable block tuples sorted by C-key and numeric version, with latest lifecycle and RFC 8785 JCS. Missing or withdrawn registry rows return no digest; no locks or mutation. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_registry_digest_readonly(uuid, jsonb)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_registry_digest_readonly(uuid, jsonb)
  from public, anon, authenticated, service_role;

do $guard$
declare item pg_catalog.pg_proc%rowtype;
begin
  select proc.* into item from pg_catalog.pg_proc proc
   where proc.oid = pg_catalog.to_regprocedure(
     'platform_private.cms_pattern_registry_digest_readonly(uuid,jsonb)');
  if not found or item.proowner <> 'wejammin_cms_definer'::pg_catalog.regrole
     or item.prosecdef or item.prokind <> 'f' or item.provolatile <> 's'
     or item.proretset or item.prorettype <> 'text'::pg_catalog.regtype
     or item.proconfig is distinct from array['search_path=""']::text[]
     or item.prolang <> (select lang.oid from pg_catalog.pg_language lang where lang.lanname = 'sql') then
    raise exception 'cms_pattern_registry_digest_readonly attributes changed' using errcode = '55000';
  end if;
  if pg_catalog.has_function_privilege('anon', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', item.oid, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', item.oid, 'EXECUTE') then
    raise exception 'cms_pattern_registry_digest_readonly is not private' using errcode = '55000';
  end if;
end;
$guard$;

commit;
