-- Slice 12 CMS-03C-03: merged terms are permanent redirects, not parents.
-- Upgrade the hierarchy guard forward-only, keeping one taxonomy-row lock for
-- both attaching a child and merging a parent. Either competing write sees
-- the other's committed state and one is refused.
-- Rollback policy: forward-only compensating migration; dropping this guard
-- would reopen a taxonomy integrity violation.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (
    select 1
    from platform_private.cms_terms child
    join platform_private.cms_terms parent
      on parent.id = child.parent_term_id
    where parent.lifecycle = 'merged'
  ) then
    raise exception 'existing merged taxonomy parent requires remediation'
      using errcode = 'P0001';
  end if;
end;
$body$;

create or replace function platform_private.cms_terms_hierarchy_cycle_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  parent_lifecycle text;
begin
  if new.parent_term_id is null and new.lifecycle <> 'merged' then
    return new;
  end if;

  -- The same serialization point guards child attachment and parent merge.
  perform 1
  from platform_private.cms_taxonomy_versions taxonomy
  where taxonomy.id = new.taxonomy_version_id
    and taxonomy.owner_id = new.owner_id
  for update;

  if new.parent_term_id is not null then
    select parent.lifecycle into parent_lifecycle
    from platform_private.cms_terms parent
    where parent.id = new.parent_term_id;
    if parent_lifecycle = 'merged' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;

    if tg_op = 'INSERT' or
       (tg_op = 'UPDATE' and
        new.parent_term_id is distinct from old.parent_term_id) then
      if exists (
        with recursive ancestors as (
          select parent.id, parent.parent_term_id,
                 array[parent.id]::uuid[] as path
          from platform_private.cms_terms parent
          where parent.id = new.parent_term_id
          union all
          select parent.id, parent.parent_term_id,
                 ancestors.path || parent.id
          from ancestors
          join platform_private.cms_terms parent
            on parent.id = ancestors.parent_term_id
          where not parent.id = any(ancestors.path)
        )
        select 1 from ancestors where id = new.id
      ) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.lifecycle = 'merged' and exists (
    select 1
    from platform_private.cms_terms child
    where child.parent_term_id = new.id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;

revoke all on function platform_private.cms_terms_hierarchy_cycle_guard()
  from public, anon, authenticated, service_role;

drop trigger cms_terms_hierarchy_cycle_guard on platform_private.cms_terms;
create trigger cms_terms_hierarchy_cycle_guard
before insert or update of parent_term_id, lifecycle
on platform_private.cms_terms
for each row execute function platform_private.cms_terms_hierarchy_cycle_guard();

commit;
