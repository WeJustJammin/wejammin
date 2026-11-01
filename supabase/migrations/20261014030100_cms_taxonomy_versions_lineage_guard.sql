-- Slice 12 lane taxonomy-def (BE03c lineage ids at 219, DEC-188 at 208, E14 at 218, TaxonomyVersion row at
-- 1427; P2-S12-AC-124..128): the definition guard of a taxonomy version learns the lineage.
--
-- Replaces platform_private.cms_taxonomy_versions_lifecycle_guard (20260927260000, amended by the governed
-- lifecycle migration 20261013300000).  Everything the existing body does is kept, in the same order: the
-- draft-only insert, the governed-lifecycle early return (only a governed RPC advances state,
-- lifecycle_version, activated_at and retired_at), the refusal of every change to an active or terminal row and
-- of every delete, and the refusal of any non-lifecycle column change on a draft or review row.  New:
--   * INSERT: the lifecycle counter starts at 1 with no activation or retirement stamp.  A first version
--     (no parent) must be the only row of its (owner, key) and is its own lineage root; a successor names a
--     parent of the SAME owner and key whose definition number is exactly one less and carries that parent's
--     lineage id.  A direct insert that omits the lineage id gets the right one (existing fixtures and tools
--     keep working); a wrong one is refused.
--   * UPDATE: taxonomy_id, supersedes_id and canonical_overlap_domains are definition columns, so the
--     existing whole-row comparison already freezes them.
-- The body now names the forced CMS table (parent lookup), so, as for the template guard, the definer role
-- owns it and the forced policies apply to its statements.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_taxonomy_versions_lifecycle_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  parent platform_private.cms_taxonomy_versions%rowtype;
  expected_lineage uuid;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at
       or new.lifecycle_version <> 1 or new.activated_at is not null or new.retired_at is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if new.supersedes_id is null then
      if exists (
        select 1 from platform_private.cms_taxonomy_versions sibling
         where sibling.owner_id = new.owner_id and sibling.taxonomy_key = new.taxonomy_key
      ) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      expected_lineage := new.id;
    else
      select * into parent
        from platform_private.cms_taxonomy_versions candidate
       where candidate.id = new.supersedes_id;
      if not found
         or parent.owner_id <> new.owner_id
         or parent.taxonomy_key <> new.taxonomy_key
         or parent.version + 1 <> new.version then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      expected_lineage := parent.taxonomy_id;
    end if;
    if new.taxonomy_id is null then
      new.taxonomy_id := expected_lineage;
    elsif new.taxonomy_id <> expected_lineage then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- BE03c governed lifecycle: only a governed RPC advances state, lifecycle_version, activated_at and retired_at.
  if tg_op = 'UPDATE' and platform_private.cms_governed_lifecycle_update(pg_catalog.to_jsonb(old), pg_catalog.to_jsonb(new)) then
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active', 'superseded', 'retired', 'blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if (pg_catalog.to_jsonb(new) - 'state' - 'updated_at') is distinct from
     (pg_catalog.to_jsonb(old) - 'state' - 'updated_at') or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_taxonomy_versions_lifecycle_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_taxonomy_versions_lifecycle_guard()
  from public, anon, authenticated, service_role;

commit;
