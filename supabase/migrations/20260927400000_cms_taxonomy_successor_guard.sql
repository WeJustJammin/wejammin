-- Slice 12 CMS-03C-03: every merged term must point directly to an active
-- survivor. A survivor with inbound redirects cannot itself be retired.
-- Rollback policy: forward-only compensating migration; removing this guard
-- would reopen permanent-redirect chains and cycles.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (
    select 1
    from platform_private.cms_terms retired
    left join platform_private.cms_terms survivor
      on survivor.id = retired.successor_id
    where retired.lifecycle = 'merged'
      and (survivor.id is null or survivor.lifecycle <> 'active')
  ) then
    raise exception 'existing taxonomy redirect chain requires remediation'
      using errcode = 'P0001';
  end if;
end;
$body$;

create or replace function platform_private.cms_terms_successor_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  survivor_lifecycle text;
begin
  if new.lifecycle <> 'merged' then
    return new;
  end if;

  -- The hierarchy guard uses this same taxonomy-row lock for term merges.
  -- This also serializes competing merges and redirect checks per vocabulary.
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
  where survivor.id = new.successor_id
    and survivor.taxonomy_version_id = new.taxonomy_version_id
    and survivor.owner_id = new.owner_id;
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

create trigger cms_terms_successor_guard
before update of lifecycle, successor_id
on platform_private.cms_terms
for each row execute function platform_private.cms_terms_successor_guard();

commit;
