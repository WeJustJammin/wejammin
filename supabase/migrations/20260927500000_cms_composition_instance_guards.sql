-- Slice 12 CMS-03C-02: composition instance admission guard (CMSCOMP-DRAFT-TARGET).
-- A composition instance may attach only to a draft entry revision
-- (IA03 CMS-12 / BE03c). Entry revisions are immutable rows, so the check
-- runs at admission; later state transitions can never mutate an existing
-- link.
-- Cycle-invariant note: cms_composition_instances rows are immutable versions
-- (cms_composition_instances_immutable_guard raises on every UPDATE/DELETE),
-- parent_instance_id is an immediate foreign key, and the parent-not-self
-- check forbids self-parents. A parent must already exist when its child is
-- written and can never be reparented afterwards, so a parent chain can only
-- extend toward pre-existing rows; a 2+-node cycle would require updating an
-- existing row, which is blocked. No separate cycle trigger is added.
-- Rollback policy: a forward-only compensating migration would be required to
-- remove this guard; doing so reopens an accepted composition-safety hole.
begin;

set local lock_timeout = '5s';

create function platform_private.cms_composition_instance_guards()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  -- CMSCOMP-DRAFT-TARGET: only a draft entry revision may host an instance.
  -- Ownership and existence stay with the owner-bound revision foreign key:
  -- when no revision row matches (id, owner) this guard returns NEW so the
  -- existing FK boundary still surfaces 23503; the admission token
  -- VALIDATION_FAILED is reserved for a real non-draft target revision.
  if not exists (
    select 1
      from platform_private.cms_entry_revisions revision
     where revision.id = new.revision_id
       and revision.owner_id = new.owner_id
       and revision.state = 'draft'
  ) and exists (
    select 1
      from platform_private.cms_entry_revisions revision
     where revision.id = new.revision_id
       and revision.owner_id = new.owner_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

revoke all on function platform_private.cms_composition_instance_guards()
  from public, anon, authenticated, service_role;

create trigger cms_composition_instances_target_revision_guard
before insert on platform_private.cms_composition_instances
for each row execute function platform_private.cms_composition_instance_guards();

commit;
