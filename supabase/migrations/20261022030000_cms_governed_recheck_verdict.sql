-- Slice 12 lane governed-recheck (BE03c "Governed review machinery" Invalidation, "Governed policy basis"; tracker P2-S12-AC-203):
-- the one verdict the governed recheck job applies to a live review.
--
--   cms_governed_recheck_verdict(review)   'current' | 'dependency_changed' | 'reviewer_authority_changed'
--       * a review that is not live (open or approved, never activated) is 'current': there is nothing to invalidate;
--       * the frozen status (subject hash, policy basis, dependency identities, block digest, nested pattern states, bound content
--         types: cms_governed_frozen_status, the ONE currency test) differing from the frozen evidence is 'dependency_changed';
--       * an APPROVED review whose live qualifying approvals no longer reach the required count or no longer hold every specialist
--         slot (a stored `approved` state that lags the loss of a counted approver) is 'reviewer_authority_changed'.  The same
--         recount cms_governed_activation_verdict runs at activation, so there is one rule.  An OPEN review is not recounted here:
--         approvals still possible are the decision's business (CMS-03C-07), and a lost counted approver is the person
--         invalidation's (cms_invalidate_governed_reviews_for_person).
--   A NULL workflow-policy evidence raises DEPENDENCY_UNAVAILABLE (fail closed): unknown is never reported as a change.
-- Lock order (BE03c "Slice 12 lock order"): the verdict reads the dependency graph (the block digest takes FOR SHARE on the
-- reachable block rows, position 3 after the subject), so the CALLER must hold the subject version row FOR UPDATE first
-- (cms_recheck_governed_reviews does, per review); this function takes no lock of an earlier position itself.
-- Private; SECURITY DEFINER; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_recheck_verdict(p_review_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_review platform_private.cms_governed_reviews%rowtype;
  v_slots integer;
  v_held integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  select review_item.* into v_review from platform_private.cms_governed_reviews review_item
   where review_item.id = p_review_id;
  if not found or v_review.state not in ('open', 'approved') or v_review.activated_at is not null then
    return 'current';
  end if;
  if platform_private.cms_governed_frozen_status(v_review.id) is distinct from 'current' then
    return 'dependency_changed';
  end if;
  if v_review.state = 'approved' then
    select (pg_catalog.count(*) filter (where slot.slot_no > 1))::integer,
           (pg_catalog.count(*) filter (
             where slot.slot_no > 1
               and exists (
                 select 1 from platform_private.cms_governed_review_qualifying_decisions(v_review.id) counted
                  where counted.capability = slot.slot_key)))::integer
      into v_slots, v_held
      from pg_catalog.jsonb_array_elements_text(v_review.required_capabilities) with ordinality slot(slot_key, slot_no);
    if platform_private.cms_governed_review_distinct_approvals(v_review.id) < v_review.required_decision_count
       or v_held < v_slots then
      return 'reviewer_authority_changed';
    end if;
  end if;
  return 'current';
end;
$body$;

comment on function platform_private.cms_governed_recheck_verdict(uuid) is
  'BE03c governed recheck verdict of one review: current, dependency_changed (the frozen status differs) or, for an approved review, reviewer_authority_changed (its live qualifying approvals fell short). A review that is not live is current. Raises DEPENDENCY_UNAVAILABLE for a NULL workflow-policy evidence. Private.';

grant select on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_recheck_verdict(uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_governed_recheck_verdict(uuid) from public, anon, authenticated, service_role;

commit;
