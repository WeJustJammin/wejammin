-- Keep the composite vocabulary/owner FK as the authority for cross-scope
-- redirects (SQLSTATE 23503), while the successor guard checks lifecycle.
-- Forward-only correction to the locally applied successor guard.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_terms_successor_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  survivor_lifecycle text;
begin
  if new.lifecycle <> 'merged' then
    return new;
  end if;

  perform 1
  from platform_private.cms_taxonomy_versions taxonomy
  where taxonomy.id = new.taxonomy_version_id
    and taxonomy.owner_id = new.owner_id
  for update;

  if new.successor_id is null or new.successor_id = new.id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  select survivor.lifecycle into survivor_lifecycle
  from platform_private.cms_terms survivor
  where survivor.id = new.successor_id;
  if survivor_lifecycle is distinct from 'active' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from platform_private.cms_terms retired
    where retired.successor_id = new.id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;

revoke all on function platform_private.cms_terms_successor_guard()
  from public, anon, authenticated, service_role;

commit;
