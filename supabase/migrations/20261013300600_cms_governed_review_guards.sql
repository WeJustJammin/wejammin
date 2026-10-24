-- Slice 12 lane L1 (BE03c Database Schema "GovernedReview", "GovernedReviewDecision", "GovernedReviewAssignment",
-- "GovernedReviewDependency", Persisted model envelope; tracker P2-S12-AC-251 .. AC-254): the state guards of the
-- four governed review tables.  They are DEFENCE IN DEPTH under the named RPCs (which validate the same rules
-- first and raise the typed reason) and run after the RPC-context write guard (alphabetical trigger order).
--
--   cms_governed_reviews              INSERT: open, version 1, no decision, the subject resolves through
--       cms_governed_subject_resolve and agrees with the frozen owner, lineage, key, version and hash, and the
--       approval evidence hash is the JCS SHA-256 of { policyBasisHash, subjectHash, subjectId, subjectKind }.
--       UPDATE: frozen evidence never changes; the CAS version advances by one; open -> open | approved | rejected
--       moves the recorded count by one and is accepted only when the decision ROWS agree (a reject row exists
--       exactly when rejected; approved exactly when the distinct qualifying approvers reach the required count and
--       every specialist slot after the base one is held); open | approved -> invalidated (a review that already
--       activated its subject is not live and is never invalidated); approved -> approved only to record the
--       activation, schedule or retirement.  rejected and invalidated are terminal; DELETE is refused.
--   cms_governed_review_assignments   INSERT: active at version 1 on an OPEN review (locked), the reviewer is neither
--       the submitter nor the subject creator, fewer than 16 unexpired active assignments.  UPDATE: only
--       active -> revoked with version + 1 and a strictly later updated_at.  DELETE is refused.
--   cms_governed_review_decisions     INSERT: the review is open (locked), the reviewer is neither the submitter nor
--       the subject creator, the authorizing assignment is the reviewer's own, active, at the recorded version and
--       inside its window, the reviewed hash is the frozen subject hash, the satisfied slot belongs to the frozen
--       capability list, the MFA instant lies in the 600 s window (30 s skew), and the decision rows equal the
--       recorded count and stay below the required count (the row is appended BEFORE the review advances).
--   cms_governed_review_dependencies  INSERT: only while the review is still open at its submission version.
-- Every function is SECURITY INVOKER and owned by the CMS definer role (SEC-2).  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  subject jsonb;
  lifecycle_keys constant text[] := array[
    'state', 'version', 'recorded_decision_count', 'invalidated_reason', 'decided_at', 'activated_at', 'updated_at'
  ]::text[];
  decision_rows integer;
  reject_rows integer;
  required_slots integer;
  held_slots integer;
  approvals_met boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'open' or new.version <> 1 or new.recorded_decision_count <> 0
       or new.decided_at is not null or new.activated_at is not null or new.invalidated_reason is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    subject := platform_private.cms_governed_subject_resolve(new.subject_kind, new.subject_id);
    if subject is null
       or subject->>'ownerId' is distinct from new.owner_id::text
       or subject->>'lineageId' is distinct from new.lineage_id::text
       or subject->>'key' is distinct from new.subject_key
       or (subject->>'versionNumber')::bigint is distinct from new.subject_version
       or subject->>'contentHash' is distinct from new.subject_hash::text
       or new.approval_evidence_hash::text is distinct from platform_private.cms_jcs_sha256(
            pg_catalog.jsonb_build_object(
              'policyBasisHash', new.policy_basis_hash::text,
              'subjectHash', new.subject_hash::text,
              'subjectId', new.subject_id,
              'subjectKind', new.subject_kind)) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (pg_catalog.to_jsonb(new) - lifecycle_keys) is distinct from (pg_catalog.to_jsonb(old) - lifecycle_keys) then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if old.state = 'open' and new.state in ('open', 'approved', 'rejected') then
    if new.recorded_decision_count <> old.recorded_decision_count + 1
       or new.activated_at is not null or new.invalidated_reason is not null then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    -- The UPDATE holds the review row lock, so the decision rows cannot move under this check: the RPC
    -- appended its decision row before advancing the review.
    select pg_catalog.count(*)::integer,
           (pg_catalog.count(*) filter (where decision_item.decision = 'reject'))::integer
      into decision_rows, reject_rows
      from platform_private.cms_governed_review_decisions decision_item
     where decision_item.review_id = new.id;
    if decision_rows <> new.recorded_decision_count or (new.state = 'rejected') <> (reject_rows > 0) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if new.state <> 'rejected' then
      select (pg_catalog.count(*) filter (where slot.slot_no > 1))::integer,
             (pg_catalog.count(*) filter (
               where slot.slot_no > 1
                 and exists (
                   select 1 from platform_private.cms_governed_review_qualifying_decisions(new.id) counted
                    where counted.capability = slot.slot_key)))::integer
        into required_slots, held_slots
        from pg_catalog.jsonb_array_elements_text(new.required_capabilities) with ordinality slot(slot_key, slot_no);
      approvals_met := platform_private.cms_governed_review_distinct_approvals(new.id) = new.required_decision_count
                       and held_slots = required_slots;
      if (new.state = 'approved') is distinct from approvals_met then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
  if old.state in ('open', 'approved') and new.state = 'invalidated' then
    if new.recorded_decision_count <> old.recorded_decision_count or old.activated_at is not null
       or new.activated_at is not null then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.state = 'approved' and new.state = 'approved' then
    if new.recorded_decision_count <> old.recorded_decision_count
       or new.decided_at is distinct from old.decided_at
       or new.invalidated_reason is not null
       or not (new.activated_at is not distinct from old.activated_at
               or (old.activated_at is null and new.activated_at is not null)) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  raise exception 'CONFLICT' using errcode = 'P0001';
end;
$body$;

create or replace function platform_private.cms_governed_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  subject jsonb;
  active_count integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (pg_catalog.to_jsonb(new) - 'state' - 'version' - 'updated_at')
       is distinct from (pg_catalog.to_jsonb(old) - 'state' - 'version' - 'updated_at') then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    if old.state <> 'active' or new.state <> 'revoked'
       or new.version <> old.version + 1 or new.updated_at <= old.updated_at then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.state <> 'active' or new.version <> 1 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = new.review_id
     for update;
  if not found then
    return new;
  end if;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  subject := platform_private.cms_governed_subject_resolve(review_row.subject_kind, review_row.subject_id);
  if new.reviewer_person_id = review_row.submitted_by
     or new.reviewer_person_id::text is not distinct from subject->>'creatorPerson' then
    raise exception 'reviewer_not_eligible' using errcode = 'P0001';
  end if;
  select pg_catalog.count(*)::integer into active_count
    from platform_private.cms_governed_review_assignments assignment_row
   where assignment_row.review_id = new.review_id
     and assignment_row.state = 'active'
     and assignment_row.ends_at > new.starts_at;
  if active_count >= 16 then
    raise exception 'assignment_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create or replace function platform_private.cms_governed_decision_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_governed_reviews%rowtype;
  assignment_row platform_private.cms_governed_review_assignments%rowtype;
  subject jsonb;
  decision_rows integer;
begin
  select review_item.* into review_row
    from platform_private.cms_governed_reviews review_item
   where review_item.id = new.review_id
     for update;
  if not found then
    return new;
  end if;
  if review_row.state <> 'open' then
    raise exception 'review_not_open' using errcode = 'P0001';
  end if;
  subject := platform_private.cms_governed_subject_resolve(review_row.subject_kind, review_row.subject_id);
  if new.reviewer_person_id = review_row.submitted_by
     or new.reviewer_person_id::text is not distinct from subject->>'creatorPerson' then
    raise exception 'separation_of_duties' using errcode = 'P0001';
  end if;
  select assignment_item.* into assignment_row
    from platform_private.cms_governed_review_assignments assignment_item
   where assignment_item.id = new.assignment_id;
  if not found then
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
  if new.reviewed_hash::text <> review_row.subject_hash::text then
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
  select pg_catalog.count(*)::integer into decision_rows
    from platform_private.cms_governed_review_decisions decision_item
   where decision_item.review_id = new.review_id;
  if decision_rows <> review_row.recorded_decision_count
     or decision_rows >= review_row.required_decision_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create or replace function platform_private.cms_governed_dependency_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_state text;
  review_version bigint;
begin
  select review_row.state, review_row.version into review_state, review_version
    from platform_private.cms_governed_reviews review_row
   where review_row.id = new.review_id
     for share;
  if not found then
    return new;
  end if;
  if review_state <> 'open' or review_version <> 1 then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_governed_reviews_z_state_guard
before insert or update or delete on platform_private.cms_governed_reviews
for each row execute function platform_private.cms_governed_review_guard();
create trigger cms_governed_review_assignments_z_state_guard
before insert or update or delete on platform_private.cms_governed_review_assignments
for each row execute function platform_private.cms_governed_assignment_guard();
create trigger cms_governed_review_decisions_z_binding_guard
before insert on platform_private.cms_governed_review_decisions
for each row execute function platform_private.cms_governed_decision_guard();
create trigger cms_governed_review_dependencies_z_review_guard
before insert on platform_private.cms_governed_review_dependencies
for each row execute function platform_private.cms_governed_dependency_guard();

grant select on table
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_assignments,
  platform_private.cms_governed_review_decisions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_review_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_governed_assignment_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_governed_decision_guard() owner to wejammin_cms_definer;
alter function platform_private.cms_governed_dependency_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_review_guard(),
  platform_private.cms_governed_assignment_guard(),
  platform_private.cms_governed_decision_guard(),
  platform_private.cms_governed_dependency_guard()
  from public, anon, authenticated, service_role;

commit;
