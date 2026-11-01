-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085) and Slice 12 CMSCOMP-DRAFT-TARGET (20260927500000): only a draft
-- entry revision may host a composition instance.
--
-- An entry revision is an immutable snapshot whose physical state is the constant
-- `draft` (20261005018090); whether it is still a draft is DERIVED from review,
-- schedule and publication evidence by platform_private.cms_revision_effective_state.
-- The admission guard therefore judges the derived state: a revision that is
-- submitted, approved, rejected, scheduled or published is frozen (its dependency
-- manifest was captured from its composition instances) and refuses a new instance
-- with the admission token VALIDATION_FAILED; a revision with no review, or whose
-- latest review was invalidated, is a draft again and admits one.  The existing
-- boundaries are unchanged: when no revision row matches (id, owner) the guard
-- returns NEW so the owner-bound foreign key still surfaces 23503.
--
-- The guard stays SECURITY INVOKER with an empty search_path; it runs as the
-- definer-owned RPC that writes the instance, which owns the helper.  CREATE OR
-- REPLACE keeps the owner and the trigger.  Forward-only.
begin;

create or replace function platform_private.cms_composition_instance_guards()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  -- CMSCOMP-DRAFT-TARGET: only a draft entry revision may host an instance.
  -- Ownership and existence stay with the owner-bound revision foreign key:
  -- when no revision row matches (id, owner) this guard returns NEW so the
  -- existing FK boundary still surfaces 23503; the admission token
  -- VALIDATION_FAILED is reserved for a real target revision that is not a draft.
  if exists (
    select 1
      from platform_private.cms_entry_revisions target
     where target.id = new.revision_id
       and target.owner_id = new.owner_id
  ) and platform_private.cms_revision_effective_state(new.revision_id)
          is distinct from 'draft' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

commit;
