-- Slice 12 lane governed-a, CMS-03C-10 (BE03c Route Registry 175, Per-operation authorization matrix, Permission RLS and grants;
-- BE03b CMS-03B-16 applied with the governed substitutions; DEC-137; tracker P2-S12-AC-088 .. AC-093):
--   platform_private.cms_get_governed_review(p_request jsonb) returns jsonb (the platform_api wrapper is 20261014010310).
--
-- A SAFE READ: it writes no audit, outbox, idempotency or any other row, and the whole document is built by ONE statement, so the
-- review, its decisions, assignments and counts come from one snapshot.  Read scopes (cms_governed_review_scopes): the submitter,
-- a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party, or the receipt-derived owner.
-- A review of another acting party, an absent one and a caller who is not a confirmed member of the owner organization are ONE
-- concealed NOT_FOUND; a confirmed member with no read scope is 403 capability_missing.  The document carries no person, actor or
-- party identifier: a decision exposes id, decision, capability, decidedAt and `mine`, and its `reason` only to its decider;
-- `assignments` (display labels, never ids) only to the owner; `myAssignment` only the caller's own active assignment id and end.
-- distinctApprovalCount is the LIVE recount; permittedNextActions is the review-level hint of cms_governed_next_actions.
-- Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_get_governed_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  v_party_id uuid;
  v_person uuid;
  v_review_id uuid;
  v_review platform_private.cms_governed_reviews%rowtype;
  v_scopes text[];
  v_document jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  v_actor_id := platform_private.cms_actor(p_request);
  v_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
  if not platform_private.cms_exact_keys(
       p_request, array['reviewId']::text[], array['reviewId', 'context', 'correlationId']::text[])
     or pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_review_id := (p_request->>'reviewId')::uuid;
  begin
    v_person := platform_private.identity_actor_person(v_actor_id);
  exception when others then
    v_person := null;
  end;
  select review_item.* into v_review
    from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review_id;
  if not found or v_person is null or v_review.owner_id is distinct from v_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, v_review.owner_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_scopes := platform_private.cms_governed_review_scopes(v_review.id, v_actor_id, v_party_id);
  if pg_catalog.cardinality(v_scopes) = 0 then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  select platform_private.cms_governed_review_resource(review_item.id)
         || pg_catalog.jsonb_build_object(
           'blockRegistryDigest', review_item.block_registry_digest::text,
           'policyBasis', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'contentTypeLabel', summary_item.label, 'policyKey', summary_item.policy_key, 'policyVersion', summary_item.policy_version)
                    order by summary_item.label collate "C", summary_item.policy_key collate "C")
               from (
                 select pg_catalog.left(coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''),
                          type_item.type_key, basis.value->>'policyKey'), 120) as label,
                        basis.value->>'policyKey' as policy_key,
                        basis.value->>'policyVersion' as policy_version
                   from pg_catalog.jsonb_array_elements(review_item.policy_basis) basis(value)
                   left join platform_private.cms_content_types type_item
                     on type_item.id = (basis.value->>'contentTypeId')::uuid
                   left join platform_private.cms_content_type_versions version_item
                     on version_item.content_type_id = type_item.id
                    and version_item.id in (
                      select dependency.ref_id from platform_private.cms_governed_review_dependencies dependency
                       where dependency.review_id = review_item.id and dependency.kind = 'content_type')
               ) summary_item
           ), '[]'::jsonb),
           'distinctApprovalCount', platform_private.cms_governed_review_distinct_approvals(review_item.id),
           'decisions', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'id', decision_item.id,
                      'decision', decision_item.decision,
                      'capability', decision_item.capability,
                      'decidedAt', platform_private.auth_iso_time(decision_item.decided_at),
                      'mine', decision_item.reviewer_person_id = v_person,
                      'reason', case when decision_item.reviewer_person_id = v_person then decision_item.reason end
                    ) order by decision_item.decided_at, decision_item.id)
               from platform_private.cms_governed_review_decisions decision_item
              where decision_item.review_id = review_item.id
           ), '[]'::jsonb),
           'assignments', case when 'owner' = any (v_scopes) then coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'assignmentId', labelled.id,
                      'version', labelled.version::text,
                      'state', labelled.state,
                      'startsAt', platform_private.auth_iso_time(labelled.starts_at),
                      'endsAt', platform_private.auth_iso_time(labelled.ends_at),
                      'reviewerLabel', 'Reviewer ' || labelled.ordinal::text
                    ) order by labelled.created_at, labelled.id)
               from (
                 select ranked.*
                   from (
                     select assignment_item.*,
                            pg_catalog.dense_rank() over (
                              order by first_seen.first_created, assignment_item.reviewer_person_id) as ordinal
                       from platform_private.cms_governed_review_assignments assignment_item
                       join lateral (
                         select pg_catalog.min(other_item.created_at) as first_created
                           from platform_private.cms_governed_review_assignments other_item
                          where other_item.review_id = assignment_item.review_id
                            and other_item.reviewer_person_id = assignment_item.reviewer_person_id
                       ) first_seen on true
                      where assignment_item.review_id = review_item.id
                   ) ranked
                  order by (ranked.state = 'active') desc, ranked.created_at desc, ranked.id desc
                  limit 32
               ) labelled
           ), '[]'::jsonb) else '[]'::jsonb end,
           'myAssignment', (
             select pg_catalog.jsonb_build_object(
                      'assignmentId', mine.id, 'endsAt', platform_private.auth_iso_time(mine.ends_at))
               from platform_private.cms_governed_review_assignments mine
              where mine.review_id = review_item.id and mine.reviewer_person_id = v_person and mine.state = 'active'
              limit 1
           ),
           'subjectState', platform_private.cms_governed_subject_resolve(review_item.subject_kind, review_item.subject_id)->>'state',
           'permittedNextActions', pg_catalog.to_jsonb(
             platform_private.cms_governed_next_actions(review_item.id, v_actor_id, v_party_id, v_scopes))
         )
    into v_document
    from platform_private.cms_governed_reviews review_item
   where review_item.id = v_review.id;
  if v_document is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_document;
end;
$body$;

comment on function platform_private.cms_get_governed_review(jsonb) is
  'CMS-03C-10: the role-scoped GovernedReviewDetailResource of one governed review, built in one statement (one snapshot): the base review, the recomputed block digest, the policy basis by label, the live distinctApprovalCount, decisions (own reason only), owner-only assignment summaries by display label, the caller''s own assignment, the subject state and the permitted next actions. 404 for a hidden, absent or foreign review, 403 for a member with no read scope. Writes nothing. Private; the Worker calls the platform_api wrapper.';

-- SEC-2: what the read names, held by the definer role only (idempotent restatements).
grant select on table
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_assignments,
  platform_private.cms_governed_review_decisions,
  platform_private.cms_governed_review_dependencies,
  platform_private.cms_content_types,
  platform_private.cms_content_type_versions
  to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_get_governed_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_get_governed_review(jsonb)
  from public, anon, authenticated, service_role;

commit;
