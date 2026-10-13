-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" and the
-- persistence row for cms_entry_revisions (tracker P2-S11-AC-085): the physical
-- state of an immutable revision snapshot is the constant `draft`.
--
-- An EntryRevision row never changes after it is written (updated_at = created_at,
-- workflow transitions are append-only evidence, never row UPDATE).  Its
-- browser-visible EntryRevisionState -- draft, submitted, approved, rejected,
-- scheduled, published -- is DERIVED from committed review, schedule and publication
-- evidence by platform_private.cms_revision_effective_state (20261005017540), and
-- every read and write response, the state filters of CMS-03B-03 and CMS-03B-13 and
-- the composition admission guard adopt that helper in 20261005018000..018060.  Only
-- now that nothing reads the physical column for a workflow decision is it closed:
-- cms_entry_revisions_state_check, which admitted the six-label union, becomes
-- `state = 'draft'`.
--
-- Safety: the migration refuses to run, naming the count, when a stored revision
-- carries any other state (no Phase 2 code path ever wrote one: every writer inserts
-- `draft`), instead of narrowing the check NOT VALID or rewriting history.  The
-- (entry_id, state, updated_at) index of 20260926090000 is kept (harmless, and the
-- history of the column).  Forward-only; the six-label union is not restored.
begin;

set local lock_timeout = '5s';

do $precheck$
declare
  stored_other integer;
begin
  select pg_catalog.count(*)::integer into stored_other
  from platform_private.cms_entry_revisions revision
  where revision.state <> 'draft';
  if stored_other > 0 then
    raise exception 'E2 narrowing refused: % revision(s) are stored with a state other than draft', stored_other
      using errcode = '23514',
            hint = 'A stored workflow state must first be replaced by the review, schedule or publication evidence that derives it.';
  end if;
end;
$precheck$;

alter table platform_private.cms_entry_revisions
  drop constraint cms_entry_revisions_state_check;
alter table platform_private.cms_entry_revisions
  add constraint cms_entry_revisions_state_check check (state = 'draft');

comment on column platform_private.cms_entry_revisions.state is
  'BE03b E2: the constant draft.  The browser-visible EntryRevisionState (draft, submitted, approved, rejected, scheduled, published) is derived from review, schedule and publication evidence by platform_private.cms_revision_effective_state; no code path stores another value.';

commit;
