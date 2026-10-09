-- Slice 11 lane S11-3c, CMS-03B-16 (BE03b "Review scopes, reviewer assignment and decision evaluation
-- (DEC-136)", Per-operation authorization matrix, EditorialReviewDetailResource; tracker P2-S11-AC-055 ..
-- AC-060): platform_private.cms_get_editorial_review(p_request jsonb) returns jsonb with the
-- platform_api wrapper the Worker calls (service_role only).
--
-- A SAFE READ: it writes no audit, outbox, idempotency or any other row.  The whole document is built by
-- ONE statement, so the review, its decisions, assignments and counts come from one snapshot (a decision
-- committing between two statements could otherwise serve `decisions` and `recordedDecisionCount` that
-- disagree).
--
-- Read scopes (cms_editorial_review_scopes): the submitter, a non-revoked reviewer assignee, an entry
-- assignee, an owner-party publisher, or the receipt-derived owner.  A review of another acting party, an
-- absent one and a caller who is not a confirmed member of the owner organisation are ONE concealed
-- NOT_FOUND; a confirmed member with no read scope is 403 capability_missing.  The document carries no
-- person, actor or party identifier: a decision exposes id, decision, capability, decidedAt and `mine`,
-- and its `reason` only to its decider; `assignments` (display labels, never ids) only to the owner;
-- `myAssignment` only the caller's own non-revoked assignment id and end.  distinctApprovalCount is the
-- LIVE recount (cms_editorial_review_distinct_approvals).
--
-- cms_review_next_actions(review, actor, party, scopes) is the one place the review-level
-- permittedNextActions are derived (CMS-03B-15 reuses it): record_decision (open, an assignment whose
-- window covers now, the standing cms.reviewer grant, neither the submitter nor the revision author, no
-- earlier decision), assign_reviewer / revoke_assignment (owner, open; fewer than 16 active assignments and
-- the owner's cms.editor grant / at least one active assignment), schedule (approved, revision still
-- `approved`) and publish (approved, `approved` or `scheduled`, not the revision author), both for an
-- owner-party publisher.  The list is a hint only: every command re-proves its own authority.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_review_next_actions(
  p_review_id uuid, p_actor_id uuid, p_acting_party_id uuid, p_scopes text[]
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  review_row platform_private.cms_editorial_reviews%rowtype;
  revision_author uuid;
  person uuid;
  effective text;
  actions text[] := array[]::text[];
  now_at timestamptz := pg_catalog.clock_timestamp();
begin
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = p_review_id;
  if not found or p_scopes is null or pg_catalog.cardinality(p_scopes) = 0 then
    return actions;
  end if;
  select revision_item.author_person_id into revision_author
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = review_row.revision_id;
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  if person is null then
    return actions;
  end if;

  if review_row.state = 'open' then
    if exists (
         select 1
           from platform_private.cms_editorial_review_assignments assignment_item
          where assignment_item.review_id = review_row.id
            and assignment_item.reviewer_person_id = person
            and assignment_item.state = 'active'
            and assignment_item.starts_at <= now_at
            and now_at < assignment_item.ends_at
       )
       and platform_private.cms_person_holds_capability(review_row.owner_id, person, 'cms.reviewer')
       and review_row.submitted_by is distinct from person
       and revision_author is distinct from person
       and not exists (
         select 1
           from platform_private.cms_editorial_decisions decision_item
          where decision_item.review_id = review_row.id
            and decision_item.reviewer_person_id = person
       ) then
      actions := actions || 'record_decision'::text;
    end if;
    if 'owner' = any (p_scopes) then
      if platform_private.cms_person_holds_capability(review_row.owner_id, person, 'cms.editor')
         and (select pg_catalog.count(*)
                from platform_private.cms_editorial_review_assignments assignment_item
               where assignment_item.review_id = review_row.id
                 and assignment_item.state = 'active') < 16 then
        actions := actions || 'assign_reviewer'::text;
      end if;
      if exists (
        select 1
          from platform_private.cms_editorial_review_assignments assignment_item
         where assignment_item.review_id = review_row.id
           and assignment_item.state = 'active'
      ) then
        actions := actions || 'revoke_assignment'::text;
      end if;
    end if;
  elsif review_row.state = 'approved' and 'publisher' = any (p_scopes) then
    effective := platform_private.cms_revision_effective_state(review_row.revision_id);
    if effective = 'approved' then
      actions := actions || 'schedule'::text;
    end if;
    if effective in ('approved', 'scheduled') and revision_author is distinct from person then
      actions := actions || 'publish'::text;
    end if;
  end if;
  return actions;
end;
$body$;

comment on function platform_private.cms_review_next_actions(uuid, uuid, uuid, text[]) is
  'The review-level permittedNextActions of a caller (record_decision, assign_reviewer, revoke_assignment, schedule, publish) from the caller''s review scopes. A hint for the UI that grants no authority: every command re-proves its own. Private; STABLE.';

create or replace function platform_private.cms_get_editorial_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  actor_id uuid;
  acting_party_id uuid;
  person uuid;
  requested_review uuid;
  review_row platform_private.cms_editorial_reviews%rowtype;
  scopes text[];
  document jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  if not platform_private.cms_exact_keys(
       p_request, array['reviewId']::text[], array['reviewId', 'context', 'correlationId']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_review := (p_request->>'reviewId')::uuid;

  begin
    person := platform_private.identity_actor_person(actor_id);
  exception when others then
    person := null;
  end;
  select review_item.* into review_row
    from platform_private.cms_editorial_reviews review_item
   where review_item.id = requested_review;
  if not found
     or person is null
     or review_row.owner_id is distinct from acting_party_id
     or not platform_private.cms_entry_tenant_visible(actor_id, review_row.owner_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  scopes := platform_private.cms_editorial_review_scopes(review_row.id, actor_id, acting_party_id);
  if pg_catalog.cardinality(scopes) = 0 then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  select platform_private.cms_editorial_review_resource(review_item.id)
         || pg_catalog.jsonb_build_object(
           'revisionNumber', revision_item.revision_number::text,
           'locale', revision_item.locale,
           'contentTypeLabel', pg_catalog.left(
             coalesce(nullif(pg_catalog.btrim(version_item.labels->>'label'), ''), type_item.type_key), 120),
           'frozen', pg_catalog.jsonb_build_object(
             'frozenHash', review_item.frozen_hash::text,
             'dependencyHash', review_item.dependency_hash::text,
             'versionSet', platform_private.cms_version_set_of(
               review_item.dependency_manifest, revision_item.taxonomy_version_ids)
           ),
           'distinctApprovalCount', platform_private.cms_editorial_review_distinct_approvals(review_item.id),
           'decisions', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'id', decision_item.id,
                      'decision', decision_item.decision,
                      'capability', decision_item.capability,
                      'decidedAt', platform_private.auth_iso_time(decision_item.decided_at),
                      'mine', decision_item.reviewer_person_id = person,
                      'reason', case when decision_item.reviewer_person_id = person then decision_item.reason end
                    ) order by decision_item.decided_at, decision_item.id)
               from platform_private.cms_editorial_decisions decision_item
              where decision_item.review_id = review_item.id
           ), '[]'::jsonb),
           'assignments', case when 'owner' = any (scopes) then coalesce((
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
                       from platform_private.cms_editorial_review_assignments assignment_item
                       join lateral (
                         select pg_catalog.min(other_item.created_at) as first_created
                           from platform_private.cms_editorial_review_assignments other_item
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
               from platform_private.cms_editorial_review_assignments mine
              where mine.review_id = review_item.id
                and mine.reviewer_person_id = person
                and mine.state = 'active'
              limit 1
           ),
           'permittedNextActions', pg_catalog.to_jsonb(
             platform_private.cms_review_next_actions(review_item.id, actor_id, acting_party_id, scopes))
         )
    into document
    from platform_private.cms_editorial_reviews review_item
    join platform_private.cms_entry_revisions revision_item on revision_item.id = review_item.revision_id
    join platform_private.cms_content_entries entry_item on entry_item.id = review_item.entry_id
    join platform_private.cms_content_types type_item on type_item.id = entry_item.content_type_id
    join platform_private.cms_content_type_versions version_item on version_item.id = revision_item.schema_version_id
   where review_item.id = review_row.id;
  if document is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  return document;
end;
$body$;

comment on function platform_private.cms_get_editorial_review(jsonb) is
  'CMS-03B-16: the role-scoped EditorialReviewDetailResource of one review, built in one statement (one snapshot): the base review, revision number and locale, content type label, the frozen candidate, the live distinctApprovalCount, decisions (own reason only), owner-only assignment summaries by display label, the caller''s own assignment and the permitted next actions. 404 for a hidden, absent or foreign review, 403 for a member with no read scope. Writes nothing. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_get_editorial_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_editorial_review(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_get_editorial_review(jsonb) is
  'CMS-03B-16 (GET /api/v1/cms/reviews/{reviewId}): reviewId -> EditorialReviewDetailResource. Safe read; executable by service_role only.';

-- SEC-2: what the read names, held by the definer role only (every table it reads is already readable
-- by the role through the Slice 10/11 command migrations; the grants below are idempotent restatements).
grant select on table
  platform_private.cms_editorial_reviews,
  platform_private.cms_editorial_review_assignments,
  platform_private.cms_editorial_decisions,
  platform_private.cms_entry_revisions,
  platform_private.cms_content_entries,
  platform_private.cms_content_types,
  platform_private.cms_content_type_versions
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_review_next_actions(uuid, uuid, uuid, text[]) owner to wejammin_cms_definer;
alter function platform_private.cms_get_editorial_review(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_get_editorial_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_review_next_actions(uuid, uuid, uuid, text[])
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_get_editorial_review(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_get_editorial_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_editorial_review(jsonb) to service_role;

commit;
