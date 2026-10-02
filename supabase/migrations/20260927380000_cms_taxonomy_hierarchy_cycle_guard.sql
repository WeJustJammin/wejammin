-- Slice 12 CMS-03C-03: a CAS reparent must never introduce a term cycle.
-- The owner/taxonomy FK prevents cross-vocabulary edges but not a descendant
-- becoming its own ancestor. Serialize hierarchy writes on the taxonomy row
-- so concurrent curators cannot each validate against the other's old tree.
-- Rollback policy: forward-only compensating migration; removing this guard
-- would reopen an accepted integrity and publication-safety hole.
begin;

set local lock_timeout = '5s';

-- Refuse deployment if pre-existing rows are already cyclic. The recursive
-- path stops on a repeated ID, so this preflight cannot loop indefinitely.
do $body$
declare
  has_cycle boolean;
begin
  with recursive ancestors as (
    select term.id, term.parent_term_id, array[term.id]::uuid[] as path,
           false as cyclic
    from platform_private.cms_terms term
    where term.parent_term_id is not null
    union all
    select parent.id, parent.parent_term_id,
           ancestors.path || parent.id,
           parent.id = any(ancestors.path)
    from ancestors
    join platform_private.cms_terms parent
      on parent.id = ancestors.parent_term_id
    where not ancestors.cyclic
  )
  select exists(select 1 from ancestors where cyclic) into has_cycle;

  if has_cycle then
    raise exception 'existing taxonomy hierarchy cycle requires remediation'
      using errcode = 'P0001';
  end if;
end;
$body$;

create function platform_private.cms_terms_hierarchy_cycle_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
begin
  if new.parent_term_id is null or
     (tg_op = 'UPDATE' and
      new.parent_term_id is not distinct from old.parent_term_id) then
    return new;
  end if;

  -- PostgreSQL READ COMMITTED takes a fresh snapshot for the ancestry query
  -- after this row lock is acquired. All term writes for one vocabulary use
  -- the same lock, including writes from distinct app instances.
  perform 1
  from platform_private.cms_taxonomy_versions taxonomy
  where taxonomy.id = new.taxonomy_version_id
    and taxonomy.owner_id = new.owner_id
  for update;

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
  return new;
end;
$body$;

revoke all on function platform_private.cms_terms_hierarchy_cycle_guard()
  from public, anon, authenticated, service_role;

create trigger cms_terms_hierarchy_cycle_guard
before insert or update of parent_term_id on platform_private.cms_terms
for each row execute function platform_private.cms_terms_hierarchy_cycle_guard();

commit;
