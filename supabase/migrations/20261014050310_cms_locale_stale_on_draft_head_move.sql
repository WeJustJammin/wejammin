-- Slice 12 lane locale, fix pass F3: the source-change fan-out fires when the draft head moves, after the
-- revision's values exist (BE03c Locale field resolution (DEC-121, DEC-138) and fan-out (D12) 1393 "staleFieldIds
-- carries them", LocaleVariant table 1431, CMS-03C-04 transaction 1508; tracker P2-S12-AC-235, AC-260).
--
-- Defect (review-locale F3).  The fan-out ran from an AFTER INSERT row trigger on cms_entry_revisions, but every
-- revision writer inserts the revision row first and its field values after, so at fire time the new revision held
-- no value: cms_locale_source_field_hash(new_revision, field) was hash(null) for every field.  A recorded field
-- whose source value was present was always listed, a recorded field whose source value was absent and is now
-- present was never listed.  The stored stale_field_ids was wrong in both directions (the lane's own fixture:
-- stored [title], truth [date]).
--
-- Design.  The three writers that advance a source revision (cms_create_revision, cms_resolve_conflict,
-- cms_restore_revision) all write the revision, its values and its relations and only THEN move
-- cms_content_entries.current_draft_revision_id to the new revision under the entry version CAS.  The fan-out is
-- therefore attached to that head move: an AFTER UPDATE OF current_draft_revision_id row trigger on
-- cms_content_entries, fired only when the head changes to a non-null revision.  It runs inside the writer's own
-- transaction, immediately (so no pgTAP suite and no wrapper observes a changed timing), after every value the
-- revision holds, so the recorded snapshot is exact by construction.  The only other revision writer that can
-- source a locale, cms_author_locale_variant, never moves the head (it writes a target-locale revision) and calls
-- the fan-out itself after its values (20261014050200).  cms_create_entry writes a first revision no variant can
-- depend on.  A DEFERRABLE INITIALLY DEFERRED constraint trigger on the revision row was rejected: it also gives
-- an exact snapshot, but it moves the fan-out to COMMIT, so every assertion of a mid-transaction stale row needs
-- `set constraints all immediate`, every ALTER TABLE on cms_entry_revisions after a revision write fails with
-- "pending trigger events" (Slice 11 e2_state_check, reads_plan_stability), and a fan-out error (a source author
-- without an active account) surfaces at commit, past the wrappers that map it.  Amending the three writers with
-- an explicit call was rejected as the larger edit of shared, repeatedly redefined functions.
--
-- cms_stale_locale_dependents is unchanged by this migration: its row-level rule (latest source revision of the
-- locale, one stale row per latest non-stale dependent whose source hash differs) and its idempotence (a latest
-- stale row is skipped) make a head move to an already-processed revision a no-op.  The retired AFTER INSERT
-- trigger and its function are dropped (the Slice 9 trigger inventory pins one row less on cms_entry_revisions
-- and one row more on cms_content_entries).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
begin
  if (select pg_catalog.count(*) from pg_catalog.pg_trigger trigger_row
       where trigger_row.tgrelid = 'platform_private.cms_entry_revisions'::pg_catalog.regclass
         and trigger_row.tgname = 'cms_entry_revisions_locale_stale'
         and not trigger_row.tgisinternal
         and trigger_row.tgfoid = 'platform_private.cms_entry_revision_locale_stale_trigger()'::pg_catalog.regprocedure) <> 1 then
    raise exception 'locale fan-out: the installed revision trigger is missing' using errcode = '55000';
  end if;
  if pg_catalog.to_regprocedure('platform_private.cms_content_entry_locale_stale_trigger()') is not null then
    raise exception 'locale fan-out: the head-move trigger function already exists' using errcode = '55000';
  end if;
end;
$guard$;

drop trigger cms_entry_revisions_locale_stale on platform_private.cms_entry_revisions;
drop function platform_private.cms_entry_revision_locale_stale_trigger();

create function platform_private.cms_content_entry_locale_stale_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_stale_locale_dependents(new.current_draft_revision_id, false);
  return new;
end;
$body$;

create trigger cms_content_entries_locale_stale
after update of current_draft_revision_id on platform_private.cms_content_entries
for each row
when (new.current_draft_revision_id is not null
      and old.current_draft_revision_id is distinct from new.current_draft_revision_id)
execute function platform_private.cms_content_entry_locale_stale_trigger();

comment on function platform_private.cms_content_entry_locale_stale_trigger() is
  'D12: runs the source-change fan-out for the revision a writer has just made the draft head, after the revision values exist, so stale_field_ids is exact. Trigger function; not callable by API roles.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_content_entry_locale_stale_trigger() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_content_entry_locale_stale_trigger()
  from public, anon, authenticated, service_role;

do $verify$
declare
  trigger_row pg_catalog.pg_trigger%rowtype;
begin
  select * into trigger_row from pg_catalog.pg_trigger candidate
   where candidate.tgrelid = 'platform_private.cms_content_entries'::pg_catalog.regclass
     and candidate.tgname = 'cms_content_entries_locale_stale';
  if not found or trigger_row.tgenabled <> 'O' or trigger_row.tgdeferrable
     or (trigger_row.tgtype & 1) = 0 or (trigger_row.tgtype & 2) <> 0 or (trigger_row.tgtype & 16) = 0 then
    raise exception 'locale fan-out: the head-move trigger is not an enabled immediate AFTER UPDATE row trigger'
      using errcode = '55000';
  end if;
end;
$verify$;

commit;
