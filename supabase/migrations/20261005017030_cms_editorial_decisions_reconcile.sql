-- Slice 11 data model (BE03b Database Schema "EditorialDecision", Decision
-- CMS-03B-06, Recent MFA E6 and E10, Separation of duties E11; tracker
-- P2-S11-AC-109, AC-121): reconcile the Slice 10 foundation
-- cms_editorial_decisions (20260927090000) to the locked shape.
--
--   * the authorizing assignment is recorded: assignment_id plus the
--     assignment_version it had when the decision was taken.  The composite key
--     (assignment_id, review_id, reviewer_person_id) makes the assignment the
--     reviewer's own on the same review, and (review_id, owner_id) the review
--     owner, declaratively.
--   * step_up_at (the binding MFA instant) is NOT NULL (E10; no row exists
--     before this migration, so nothing is back-filled).
--   * a reject always carries the base slot capability cms.reviewer; the
--     comment hash, when stored, is the SHA-256 of the reason's UTF-8 bytes.
--   * the reason bound is Unicode CODE POINTS, the API rule (DEC-158(a), BE03b
--     amended 2026-10-08): char_length(reason) BETWEEN 1 AND 2000, replacing the
--     foundation's octet_length bound, which refused a valid 2000-code-point reason
--     that is longer than 2000 bytes.
--   * an INSERT guard (defence in depth under cms_record_review_decision, which
--     validates the same rules first and raises the typed reason): the review is
--     open; the reviewer is neither its submitter nor the revision author
--     (separation_of_duties, E11); the assignment is the reviewer's, active, at
--     the recorded version and inside its [starts_at, ends_at) window at the
--     decision instant; the reviewed hash is the review's frozen hash; the
--     satisfied slot belongs to the frozen policy; the MFA instant lies in the
--     600 s freshness window with the 30 s skew tolerance of stepUpIsFresh; and
--     the decision rows of the review equal its recorded count and stay below
--     the required count, so the decision row is appended BEFORE the review
--     advances its count (BE03b decision steps 8 and 9).  The existing write and
--     immutable guards keep the rows append-only.  SECURITY INVOKER; it reads the
--     review (FOR UPDATE, the review position of the global lock order), the
--     revision and the assignment.
-- Forward-only.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (select 1 from platform_private.cms_editorial_decisions decision_row) then
    raise exception 'CMS editorial decisions pre-date the reviewer assignment binding'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_editorial_decisions
  add column assignment_id uuid not null,
  add column assignment_version bigint not null,
  alter column step_up_at set not null;

alter table platform_private.cms_editorial_decisions
  drop constraint cms_editorial_decisions_reason_check;

alter table platform_private.cms_editorial_decisions
  add constraint cms_editorial_decisions_reason_check
    check (pg_catalog.char_length(reason) between 1 and 2000),
  add constraint cms_editorial_decisions_assignment_version_check
    check (assignment_version > 0),
  add constraint cms_editorial_decisions_reject_slot_check
    check (decision <> 'reject' or capability = 'cms.reviewer'),
  add constraint cms_editorial_decisions_comment_hash_reason_check check (
    comment_hash is null
    or comment_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(reason, 'UTF8')), 'hex'
    )
  ),
  add constraint cms_editorial_decisions_assignment_fkey
    foreign key (assignment_id, review_id, reviewer_person_id)
    references platform_private.cms_editorial_review_assignments(
      id, review_id, reviewer_person_id
    ),
  add constraint cms_editorial_decisions_review_owner_fkey
    foreign key (review_id, owner_id)
    references platform_private.cms_editorial_reviews(id, owner_id);

create or replace function platform_private.cms_decision_binding_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
  assignment_row platform_private.cms_editorial_review_assignments%rowtype;
  revision_author uuid;
  decision_rows integer;
begin
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = new.review_id
     for update;
  if not found then
    -- The foreign key reports the absent review.
    return new;
  end if;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  select revision_item.author_person_id into revision_author
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = review_row.revision_id;
  if new.reviewer_person_id = review_row.submitted_by
     or new.reviewer_person_id = revision_author then
    raise exception 'separation_of_duties' using errcode = 'P0001';
  end if;
  select assignment_item.* into assignment_row
    from platform_private.cms_editorial_review_assignments assignment_item
   where assignment_item.id = new.assignment_id;
  if not found then
    -- The foreign key reports the absent assignment.
    return new;
  end if;
  if assignment_row.review_id <> new.review_id
     or assignment_row.reviewer_person_id <> new.reviewer_person_id
     or assignment_row.state <> 'active'
     or assignment_row.version <> new.assignment_version
     or new.decided_at < assignment_row.starts_at
     or new.decided_at >= assignment_row.ends_at then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if new.reviewed_hash <> review_row.frozen_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if new.capability <> 'cms.reviewer'
     and not pg_catalog.jsonb_exists(review_row.required_capabilities, new.capability) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if new.step_up_at < new.decided_at - interval '630 seconds'
     or new.step_up_at > new.decided_at + interval '30 seconds' then
    raise exception 'STEP_UP_REQUIRED' using errcode = 'P0001';
  end if;
  select pg_catalog.count(*) into decision_rows
    from platform_private.cms_editorial_decisions decision_item
   where decision_item.review_id = new.review_id;
  if decision_rows <> review_row.recorded_decision_count
     or decision_rows >= review_row.required_decision_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Fires after cms_editorial_decisions_write_guard (alphabetical order).
create trigger cms_editorial_decisions_z_binding_guard
before insert on platform_private.cms_editorial_decisions
for each row execute function platform_private.cms_decision_binding_guard();

revoke all on function platform_private.cms_decision_binding_guard()
  from public, anon, authenticated, service_role;

-- SEC-2: a function whose body names a forced-RLS CMS table is owned by the
-- NOLOGIN, non-BYPASSRLS definer role (the catalog guard in
-- supabase/tests/phase_02_slice_09_sec2_definer_rls.sql derives the set from the
-- live bodies), exactly as the Slice 09 schema-review guards are.  ALTER FUNCTION
-- ... OWNER TO needs CREATE on the function's schema for the new owner, held for
-- this transaction only.  The guard stays SECURITY INVOKER: it runs with the
-- privileges of the calling role, so the definer functions that write the table
-- (Slice 11 command migrations) are the ones that hold the table verbs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_decision_binding_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

commit;
