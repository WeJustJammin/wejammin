-- Slice 12 lane governed-recheck (BE03c "Reviewer-authority invalidation on revocation (DEC-180, G6)", "Slice 12 lock order" row
-- `cms_recheck_governed_reviews` and `cms_invalidate_governed_reviews_for_person`; BE03b "Review invalidation" applied unchanged and rule 7
-- of "Write-path lock order and authority fencing"; tracker P2-S12-AC-204).
--
--   cms_invalidate_governed_reviews_for_person(person, capability)   returns the number of reviews transitioned
--       Mirrors 03b cms_invalidate_reviews_for_person.  For every open or approved (never activated) governed review in which the person
--       has a recorded `approve` decision under `capability` (NULL: any capability) that NO LONGER COUNTS - it is not among
--       cms_governed_review_qualifying_decisions, the person no longer holds the standing capability of the slot the decision
--       satisfied - the review becomes invalidated `reviewer_authority_changed` through the single-review invalidation (subject row
--       FOR UPDATE before the review row; CAS version + 1; subject back to draft; pending and failed_retryable schedules cancelled
--       approval_invalidated; audit; NO event, DEC-207: the revocation invalidates synchronously and enqueues no recheck), all in the
--       caller's transaction.  A review already invalidated, rejected or activated is skipped, so a repeated call transitions nothing.
--       SECURITY DEFINER and reading no caller identity: it reaches the governed rows whichever party's session performs the
--       revocation.  A person who still holds the capability invalidates nothing.
--       The candidate set is a snapshot taken before any lock (DEC-221).  Each candidate is therefore re-read UNDER its subject row lock
--       (position 3) by cms_governed_invalidate_review_if_live and SKIPPED when it is no longer live: a governed command that held the
--       subject first (an activation, a decision, an assignment revocation) may have activated, rejected or invalidated the review
--       between the snapshot and the lock, and the revocation then finds nothing left to invalidate instead of failing on a review it does
--       not concern (BE03b rule 4: "if the activation commits first, the revocation waits and then commits").
--   cms_governed_invalidate_review_if_live(review, reason, actor, party, correlation)   returns whether the review was invalidated
--       The subject row FOR UPDATE, then a plain re-read of the review (a fresh statement: it sees every command that committed before the
--       subject lock was granted); a review that is not open or approved, or that has `activated_at`, returns false and nothing is
--       written; otherwise the single-review invalidation (cms_governed_invalidate_approved_review) runs and true is returned.
--   cms_governed_authority_trigger()          the call site of an actor-grant change: an AFTER UPDATE OR DELETE row trigger on
--       identity_private.organization_actor_grant, the table the CMS-03A-17 revocation projects `active = false` into (and the seam 03b
--       uses), passing the changed person and capability.
--   cms_governed_tenure_authority_trigger()   the call site of a membership tenure change (BE03c "Reviewer-authority invalidation on revocation", tenure end; BE03b wires both tables to the
--       one function and says the authority revocation includes "the membership tenure end"): an AFTER UPDATE OR DELETE row trigger on
--       identity_private.membership_tenure passing `(person, NULL)`: whichever capability the ended tenure carried, every review in which
--       the person no longer counts is invalidated.  The function re-evaluates the person in EVERY party (cms_person_holds_capability is
--       asked with each review's owner), so a tenure that ends in another organization invalidates nothing in this one.
--   Both triggers run the invalidation in the revoking or ending transaction after that command's own position 1 lock; no promoted
--   function is edited.
-- A grant or tenure that merely LAPSES by the calendar (valid_through or ends_on passes) writes nothing and so fires nothing; it is found
-- lazily by the recheck verdict (cms_governed_recheck_verdict), the decision and the activation recount (BE03c: "As defense in depth,
-- activation recomputes the live qualifying approvals under its locks and refuses a short count").
-- The assignment half of AC-204 (a counted approver's assignment revoked while the review is open) is cms_assign_governed_reviewer
-- (20261014010100).  Private; forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_invalidate_review_if_live(
  p_review_id uuid,
  p_reason text,
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_correlation_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_review platform_private.cms_governed_reviews%rowtype;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found then
    return false;
  end if;
  -- position 3 (the subject row) before position 5 (the review row, taken by the invalidation)
  perform platform_private.cms_governed_subject_resolve(v_review.subject_kind, v_review.subject_id, true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if v_review.state not in ('open', 'approved') or v_review.activated_at is not null then
    return false;
  end if;
  perform platform_private.cms_governed_invalidate_approved_review(
    v_review.id, p_reason, p_actor_id, p_acting_party_id, p_correlation_id);
  return true;
end;
$body$;

comment on function platform_private.cms_governed_invalidate_review_if_live(uuid, text, uuid, uuid, uuid) is
  'DEC-221: locks the subject of a review (position 3), re-reads the review under that lock and invalidates it through the single-review invalidation only if it is still open or approved and not activated; returns false (nothing written) for a review that is no longer live. Leaves app.cms_rpc set: the caller restores it. Private.';

create or replace function platform_private.cms_invalidate_governed_reviews_for_person(
  p_person_id uuid,
  p_capability text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate record;
  transitioned integer := 0;
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  correlation uuid := platform_private.cms_trigger_correlation();
begin
  if p_person_id is null
     or (p_capability is not null and p_capability !~ '^[a-z][a-z0-9_.-]{0,127}$') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  for candidate in
    select distinct review.id, review.owner_id
      from platform_private.cms_governed_review_decisions decision
      join platform_private.cms_governed_reviews review on review.id = decision.review_id
     where decision.reviewer_person_id = p_person_id
       and decision.decision = 'approve'
       and (p_capability is null or decision.capability = p_capability)
       and review.state in ('open', 'approved')
       and review.activated_at is null
       and not exists (
         select 1
           from platform_private.cms_governed_review_qualifying_decisions(review.id) qualifying
          where qualifying.decision_id = decision.id
       )
     order by review.id
  loop
    begin
      -- DEC-221: re-read under the subject lock; a review a concurrent command already activated, decided or invalidated is skipped
      if platform_private.cms_governed_invalidate_review_if_live(
           candidate.id, 'reviewer_authority_changed', null, candidate.owner_id, correlation) then
        transitioned := transitioned + 1;
      end if;
    exception when others then
      -- invalidated by another writer between the re-read and the review row lock: nothing left to do
      if sqlerrm <> 'review_not_open' then
        raise;
      end if;
    end;
  end loop;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return transitioned;
end;
$body$;

comment on function platform_private.cms_invalidate_governed_reviews_for_person(uuid, text) is
  'BE03c G6: invalidates (reviewer_authority_changed) every open or approved governed review in which the person has a recorded approve under the capability (NULL: any) that no longer counts, in the caller transaction: subject back to draft, pending schedules cancelled, audit, no event; re-reads each candidate under its subject lock and skips a review that is no longer live (DEC-221); returns the number transitioned. Not scoped to the revoker party. Called by the actor-grant and tenure triggers. Private.';

create or replace function platform_private.cms_governed_authority_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_invalidate_governed_reviews_for_person(old.person_id, old.capability_code);
  if tg_op = 'UPDATE' then
    if (new.person_id, new.capability_code) is distinct from (old.person_id, old.capability_code) then
      perform platform_private.cms_invalidate_governed_reviews_for_person(new.person_id, new.capability_code);
    end if;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

create or replace function platform_private.cms_governed_tenure_authority_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_invalidate_governed_reviews_for_person(old.person_id, null);
  if tg_op = 'UPDATE' then
    if new.person_id is distinct from old.person_id then
      perform platform_private.cms_invalidate_governed_reviews_for_person(new.person_id, null);
    end if;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return null;
end;
$body$;

comment on function platform_private.cms_governed_authority_trigger() is
  'AFTER UPDATE|DELETE on the actor-grant projection: a counted governed approver who no longer holds the revoked capability invalidates the reviews they counted in (reviewer_authority_changed) in the transaction of the revocation (BE03c G6).';
comment on function platform_private.cms_governed_tenure_authority_trigger() is
  'AFTER UPDATE|DELETE on the membership tenure: a counted governed approver whose tenure ended (or whose row was deleted) invalidates the reviews they no longer count in (reviewer_authority_changed) in the transaction of the tenure change, as 03b does for editorial reviews (BE03c G6, BE03b rule 7). Private.';

create trigger cms_organization_actor_grant_governed_authority
after update or delete on identity_private.organization_actor_grant
for each row execute function platform_private.cms_governed_authority_trigger();

create trigger cms_membership_tenure_governed_authority
after update or delete on identity_private.membership_tenure
for each row execute function platform_private.cms_governed_tenure_authority_trigger();

grant select on table
  platform_private.cms_governed_review_decisions,
  platform_private.cms_governed_reviews
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_invalidate_review_if_live(uuid, text, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_invalidate_governed_reviews_for_person(uuid, text) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_authority_trigger() owner to wejammin_cms_definer;
alter function platform_private.cms_governed_tenure_authority_trigger() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_invalidate_review_if_live(uuid, text, uuid, uuid, uuid),
  platform_private.cms_invalidate_governed_reviews_for_person(uuid, text),
  platform_private.cms_governed_authority_trigger(),
  platform_private.cms_governed_tenure_authority_trigger()
  from public, anon, authenticated, service_role;

commit;
