-- Slice 11 data model (BE03b Database Schema "EditorialReview", Persisted model
-- envelope, Review invalidation; tracker P2-S11-AC-111, AC-120): reconcile the
-- Slice 10 foundation cms_editorial_reviews (20260927090000) to the locked
-- shape by forward migration.
--
--   * entry_id (the reviewed entry) and decided_at are added.  The entry is the
--     revision's entry; the owner is the entry owner and the revision belongs
--     to the entry, all declaratively through composite foreign keys.
--   * the invalidation reason is the closed four-token union and is stored
--     exactly when the review is invalidated; decided_at is stored exactly when
--     the review is approved or rejected (an invalidated review clears it: the
--     decision rows keep their own timestamps).
--   * the latest-review, entry-state and submitter indexes of the locked schema.
--   * a state guard: frozen evidence is immutable, every UPDATE advances the CAS
--     version by exactly one, the recorded decision count moves only with a
--     decision (open -> open | approved | rejected, +1) or stays put on an
--     invalidation (open | approved -> invalidated); rejected and invalidated
--     are terminal; a review is created open at version 1 with no decision and
--     is never deleted.  The named review RPCs (Slice 11 lane 3) are the only
--     writers; this guard is defence in depth under them.
--   * the decision ROWS are the evidence (BE03b EditorialReview: approval and
--     rejection are computed from the immutable decision rows): a transition out
--     of open is accepted only when the recorded count equals the number of
--     decision rows of the review, the review is rejected exactly when a reject
--     row exists, and otherwise it is approved exactly when the distinct
--     QUALIFYING approvers (cms_editorial_review_distinct_approvals, migration
--     20261005017530) reach required_decision_count and every specialist slot
--     after the base one is held by a qualifying decision.  The count and state
--     therefore cannot be advanced without the decision the RPC appends first.
--
-- The trigger function is SECURITY INVOKER (like cms_schema_review_guard).  It
-- reads cms_editorial_decisions and calls the two approver helpers, which are
-- created later in this range (20261005017530): plpgsql resolves them when a row
-- is first updated, and no review is updated between these migrations.  Because
-- its body names a forced-RLS CMS table it is owned by the CMS definer role (SEC-2).
-- Forward-only.
begin;

set local lock_timeout = '5s';

select pg_catalog.set_config('app.cms_rpc', 'true', true);

alter table platform_private.cms_editorial_reviews
  add column entry_id uuid,
  add column decided_at timestamptz;

-- Rows written before this migration (none exist in a Phase 2 database: no
-- named review RPC existed) are normalized from their own evidence.
update platform_private.cms_editorial_reviews review_row
   set entry_id = revision_row.entry_id
  from platform_private.cms_entry_revisions revision_row
 where revision_row.id = review_row.revision_id;
update platform_private.cms_editorial_reviews review_row
   set decided_at = review_row.updated_at
 where review_row.state in ('approved', 'rejected');

alter table platform_private.cms_editorial_reviews
  alter column entry_id set not null;

alter table platform_private.cms_editorial_reviews
  add constraint cms_editorial_reviews_entry_id_fkey
    foreign key (entry_id) references platform_private.cms_content_entries(id),
  add constraint cms_editorial_reviews_invalidated_reason_check check (
    invalidated_reason is null
    or invalidated_reason in (
      'revision_superseded', 'dependency_changed', 'reviewer_authority_changed',
      'entry_unavailable'
    )
  ),
  add constraint cms_editorial_reviews_invalidated_state_check check (
    (state = 'invalidated') = (invalidated_reason is not null)
  ),
  add constraint cms_editorial_reviews_decided_state_check check (
    (state in ('approved', 'rejected')) = (decided_at is not null)
  ),
  add constraint cms_editorial_reviews_id_owner_key unique (id, owner_id),
  add constraint cms_editorial_reviews_id_revision_key unique (id, revision_id),
  add constraint cms_editorial_reviews_entry_owner_fkey
    foreign key (entry_id, owner_id)
    references platform_private.cms_content_entries(id, owner_id),
  add constraint cms_editorial_reviews_revision_entry_fkey
    foreign key (revision_id, entry_id)
    references platform_private.cms_entry_revisions(id, entry_id);

create index cms_editorial_reviews_revision_submitted_idx
  on platform_private.cms_editorial_reviews (revision_id, submitted_at desc, id desc);
create index cms_editorial_reviews_entry_state_idx
  on platform_private.cms_editorial_reviews (entry_id, state);
create index cms_editorial_reviews_submitter_updated_idx
  on platform_private.cms_editorial_reviews (submitted_by, updated_at desc);

create or replace function platform_private.cms_review_cas_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  decision_rows integer;
  reject_rows integer;
  required_slots integer;
  held_slots integer;
  approvals_met boolean;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'open'
       or new.version <> 1
       or new.recorded_decision_count <> 0
       or new.decided_at is not null
       or new.invalidated_reason is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  -- Frozen revision, dependency, activation, workflow-policy and approval
  -- evidence, the submitter and the identity never change; only the state, the
  -- recorded count, the invalidation reason, decided_at, the CAS version and
  -- updated_at move.
  if (pg_catalog.to_jsonb(new)
        - 'state' - 'version' - 'recorded_decision_count'
        - 'invalidated_reason' - 'decided_at' - 'updated_at')
     is distinct from
     (pg_catalog.to_jsonb(old)
        - 'state' - 'version' - 'recorded_decision_count'
        - 'invalidated_reason' - 'decided_at' - 'updated_at') then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not (
       (old.state = 'open'
          and new.state in ('open', 'approved', 'rejected')
          and new.recorded_decision_count = old.recorded_decision_count + 1)
    or (old.state in ('open', 'approved')
          and new.state = 'invalidated'
          and new.recorded_decision_count = old.recorded_decision_count)
  ) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if old.state = 'open' and new.state in ('open', 'approved', 'rejected') then
    -- The UPDATE holds the review row lock, so the decision rows cannot move under
    -- this check: the RPC appended its decision row before advancing the review.
    select pg_catalog.count(*)::integer,
           (pg_catalog.count(*) filter (where decision_item.decision = 'reject'))::integer
      into decision_rows, reject_rows
      from platform_private.cms_editorial_decisions decision_item
     where decision_item.review_id = new.id;
    if decision_rows <> new.recorded_decision_count
       or (new.state = 'rejected') <> (reject_rows > 0) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if new.state <> 'rejected' then
      select (pg_catalog.count(*) filter (where slot.slot_no > 1))::integer,
             (pg_catalog.count(*) filter (
               where slot.slot_no > 1
                 and exists (
                   select 1
                     from platform_private.cms_editorial_review_qualifying_decisions(new.id) counted
                    where counted.capability = slot.slot_key
                 )
             ))::integer
        into required_slots, held_slots
        from pg_catalog.jsonb_array_elements_text(new.required_capabilities)
               with ordinality slot(slot_key, slot_no);
      approvals_met :=
        platform_private.cms_editorial_review_distinct_approvals(new.id) = new.required_decision_count
        and held_slots = required_slots;
      if (new.state = 'approved') is distinct from approvals_met then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$body$;

-- Fires after cms_editorial_reviews_write_guard (alphabetical order), so a
-- write outside the CMS RPC context is still refused with DIRECT_CMS_TABLE_WRITE.
create trigger cms_editorial_reviews_z_state_guard
before insert or update or delete on platform_private.cms_editorial_reviews
for each row execute function platform_private.cms_review_cas_guard();

revoke all on function platform_private.cms_review_cas_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the decision binding guard is (20261005017030).  The
-- guard stays SECURITY INVOKER: it runs with the privileges of the calling role,
-- the definer functions that write the table, so the definer holds SELECT on the
-- decision rows it reads.  ALTER FUNCTION ... OWNER TO needs CREATE on the schema
-- for the new owner, held for this transaction only.
grant select on table platform_private.cms_editorial_decisions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_review_cas_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
