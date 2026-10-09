-- Slice 11 lane S11-3c: platform_api.cms_get_editorial_review (CMS-03B-16; tracker P2-S11-AC-055 ..
-- AC-060).  A safe read of one review for its readers: the submitter, a non-revoked reviewer assignee, an
-- entry assignee, an owner-party publisher or the receipt-derived owner.  The document is the
-- EditorialReviewDetailResource: the base review, revision number and locale, content type label, the
-- frozen candidate, the LIVE distinctApprovalCount, decisions with the caller's own reason only, owner-only
-- assignment summaries by display label, the caller's own assignment and the permitted next actions.  No
-- person, actor or party identifier is serialized.  A hidden, absent or foreign review is one concealed 404;
-- a confirmed member with no read scope is 403.  RED before 20261005017880.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(32);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- rr-1: an open ordinary review (submitter rvB) with reviewer rvA assigned, rvX assigned then revoked.
-- rr-2: an open PROTECTED review (2 decisions) with rvA's approve recorded and rvS assigned.
-- rr-3: an approved review (rvA's approve) for the publisher cases.
select pg_temp.r11_entry('rr-1');
select pg_temp.r11_entry('rr-2');
select pg_temp.r11_entry('rr-3');
select pg_temp.r11r_review('rr1', 'rr-1', 'rvB');
select pg_temp.r11r_review('rr2', 'rr-2', 'editor', pg_temp.r11_protected());
select pg_temp.r11r_review('rr3', 'rr-3', 'editor');
select pg_temp.r11_assign_now('rr1-rvA', 'rr1', 'rvA');
select pg_temp.r11_assign_now('rr1-rvX', 'rr1', 'rvX');
select pg_temp.h11_raw_exec('platform_private.cms_editorial_review_assignments',
  format($$update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1 where id = %L$$,
         pg_temp.s11_id('rr1-rvX')));
select pg_temp.r11_assign_now('rr2-rvA', 'rr2', 'rvA');
select pg_temp.r11_assign_now('rr2-rvS', 'rr2', 'rvS');
select pg_temp.r11_decide_now('rr2-dec-rvA', 'rr2', 'rvA', 'rr2-rvA', 'approve');
select pg_temp.r11_assign_now('rr3-rvA', 'rr3', 'rvA');
select pg_temp.r11_decide_now('rr3-dec-rvA', 'rr3', 'rvA', 'rr3-rvA', 'approve');

-- rr-big: 15 active assignments plus 20 assign/revoke cycles of one more reviewer (35 rows, 16 distinct reviewers).
select pg_temp.r11_entry('rr-big');
select pg_temp.r11r_review('rr-big', 'rr-big', 'editor');
select pg_temp.h11r_assign('big-' || n, 'rr-big', 'reviewer' || lpad(n::text, 2, '0'),
  jsonb_build_object('created_at', timestamptz '2026-10-02T10:00:00Z' + (n * interval '1 second'),
                     'updated_at', timestamptz '2026-10-02T10:00:00Z' + (n * interval '1 second')))
  from generate_series(1, 15) n;
create or replace function pg_temp.r11r_cycle(p_n integer)
returns void
language plpgsql
as $body$
declare
  key text := 'cyc-' || p_n;
begin
  perform pg_temp.h11r_assign(key, 'rr-big', 'reviewer17',
    jsonb_build_object('created_at', timestamptz '2026-10-02T11:00:00Z' + (p_n * interval '1 second'),
                       'updated_at', timestamptz '2026-10-02T11:00:00Z' + (p_n * interval '1 second')));
  perform pg_temp.h11_raw_exec('platform_private.cms_editorial_review_assignments',
    format($q$update platform_private.cms_editorial_review_assignments
                 set state = 'revoked', version = 2, updated_at = created_at + interval '1 minute' where id = %L$q$,
           pg_temp.s11_id(key)));
end;
$body$;
select pg_temp.r11r_cycle(n) from generate_series(1, 20) n;

create or replace function pg_temp.r11r_rq(p_review text)
returns jsonb language sql as $body$
  select jsonb_build_object('reviewId', pg_temp.s11_id(p_review), 'context', pg_temp.r11_ctx())
$body$;

select ok(pg_temp.r11_posture('platform_private', 'cms_get_editorial_review(jsonb)'),
  'cms_get_editorial_review is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-058]');
select ok(pg_temp.r11_posture('platform_api', 'cms_get_editorial_review(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-058]');

insert into r11_snap(label, effects) values ('before', pg_temp.r11r_effects());

-- ---------------------------------------------------------------------------
-- The owner reads an open review.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('owner-rr1', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr1'));
select is(pg_temp.r11_out('owner-rr1'), '00000:', 'the receipt-derived owner reads the review [P2-S11-AC-055]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('owner-rr1')),
  'activationEvidence,assignments,contentTypeLabel,createdAt,decidedAt,decisions,dependencyHash,distinctApprovalCount,entryId,frozen,frozenHash,id,invalidatedReason,locale,myAssignment,permittedNextActions,recordedDecisionCount,requiredDecisionCount,revisionId,revisionNumber,riskClass,state,submittedAt,updatedAt,version,workflowPolicy',
  'the document is exactly EditorialReviewDetailResource (the 17 base members plus the nine detail members) [P2-S11-AC-055]');
select ok(
  (select pg_temp.r11_resp('owner-rr1') - 'revisionNumber' - 'locale' - 'contentTypeLabel' - 'frozen' - 'distinctApprovalCount'
          - 'decisions' - 'assignments' - 'myAssignment' - 'permittedNextActions'
          = platform_private.cms_editorial_review_resource(pg_temp.s11_id('rr1')))
    and pg_temp.r11_resp('owner-rr1')->>'revisionNumber' = '1' and pg_temp.r11_resp('owner-rr1')->>'locale' = 'en-US'
    and pg_temp.r11_resp('owner-rr1')->>'contentTypeLabel' = 'H11 document',
  'the base members equal the EditorialReviewResource of the review; revision number, locale and the content type label come from canonical rows [P2-S11-AC-055]');
select ok(
  pg_temp.r11_resp('owner-rr1')#>>'{frozen,frozenHash}' = pg_temp.r11_resp('owner-rr1')->>'frozenHash'
    and pg_temp.r11_resp('owner-rr1')#>>'{frozen,dependencyHash}' = pg_temp.r11_resp('owner-rr1')->>'dependencyHash'
    and pg_temp.r11_resp('owner-rr1')#>'{frozen,versionSet}' = platform_private.cms_version_set_of(
      (select dependency_manifest from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rr1')), '[]'::jsonb),
  'the frozen candidate restates the review hashes and serves the version set projected from the FROZEN manifest [P2-S11-AC-055]');
select ok(
  jsonb_array_length(pg_temp.r11_resp('owner-rr1')->'assignments') = 2
    and (select bool_and(item->>'reviewerLabel' ~ '^Reviewer [0-9]+$' and item->>'assignmentId' is not null)
           from jsonb_array_elements(pg_temp.r11_resp('owner-rr1')->'assignments') item)
    and (select array_agg(item->>'state' order by item->>'reviewerLabel') from jsonb_array_elements(pg_temp.r11_resp('owner-rr1')->'assignments') item) = array['active', 'revoked']
    and pg_temp.r11_keys(pg_temp.r11_resp('owner-rr1')->'assignments'->0) = 'assignmentId,endsAt,reviewerLabel,startsAt,state,version',
  'the owner receives the assignment summaries (id, version, state, window, display label) including the revoked one [P2-S11-AC-057]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('owner-rr1'), array[
    pg_temp.s11_id('rvA')::text, pg_temp.s11_id('rvX')::text, pg_temp.s11_id('rvB')::text, pg_temp.s11_id('editor')::text,
    pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner')]),
  'the document carries no reviewer, submitter, grantor, owner, party or account identifier [P2-S11-AC-057]');
select ok(
  pg_temp.r11_resp('owner-rr1')->'permittedNextActions' = '["assign_reviewer", "revoke_assignment"]'::jsonb
    and pg_temp.r11_resp('owner-rr1')->'myAssignment' = 'null'::jsonb
    and (pg_temp.r11_resp('owner-rr1')->>'distinctApprovalCount')::integer = 0,
  'the owner of an open review may assign and revoke and has no assignment of their own [P2-S11-AC-055]');

-- ---------------------------------------------------------------------------
-- Every other reader scope and what it sees.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('rvA-rr1', 'cms_get_editorial_review', 'rvA', pg_temp.r11r_rq('rr1'));
select ok(
  pg_temp.r11_out('rvA-rr1') = '00000:' and pg_temp.r11_resp('rvA-rr1')->'assignments' = '[]'::jsonb
    and pg_temp.r11_resp('rvA-rr1')#>>'{myAssignment,assignmentId}' = pg_temp.s11_id('rr1-rvA')::text
    and pg_temp.r11_keys(pg_temp.r11_resp('rvA-rr1')->'myAssignment') = 'assignmentId,endsAt'
    and pg_temp.r11_resp('rvA-rr1')->'permittedNextActions' = '["record_decision"]'::jsonb,
  'a reviewer assignee reads the review: no assignment summaries, only their own assignment id and end, and may record a decision [P2-S11-AC-057]');
select pg_temp.r11r_call('rvB-rr1', 'cms_get_editorial_review', 'rvB', pg_temp.r11r_rq('rr1'));
select ok(
  pg_temp.r11_out('rvB-rr1') = '00000:' and pg_temp.r11_resp('rvB-rr1')->'assignments' = '[]'::jsonb
    and pg_temp.r11_resp('rvB-rr1')->'myAssignment' = 'null'::jsonb
    and pg_temp.r11_resp('rvB-rr1')->'permittedNextActions' = '[]'::jsonb,
  'the submitter reads the review with no assignments and no actions [P2-S11-AC-057]');
select pg_temp.r11r_call('editor-rr1', 'cms_get_editorial_review', 'editor', pg_temp.r11r_rq('rr1'));
select ok(pg_temp.r11_out('editor-rr1') = '00000:' and pg_temp.r11_resp('editor-rr1')->'permittedNextActions' = '[]'::jsonb,
  'an entry assignee (cms.editor assignment) reads the review; holding cms.reviewer without an assignment grants no decision [P2-S11-AC-057]');
select pg_temp.r11r_call('pub-rr1', 'cms_get_editorial_review', 'pub', pg_temp.r11r_rq('rr1'));
select ok(pg_temp.r11_out('pub-rr1') = '00000:' and pg_temp.r11_resp('pub-rr1')->'permittedNextActions' = '[]'::jsonb,
  'an owner-party publisher reads an open review and has no action on it [P2-S11-AC-057]');

-- ---------------------------------------------------------------------------
-- Decisions: a reason only for its decider; the live recount.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('rvA-rr2', 'cms_get_editorial_review', 'rvA', pg_temp.r11r_rq('rr2'));
select pg_temp.r11r_call('rvS-rr2', 'cms_get_editorial_review', 'rvS', pg_temp.r11r_rq('rr2'));
select pg_temp.r11r_call('owner-rr2', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr2'));
select ok(
  jsonb_array_length(pg_temp.r11_resp('rvA-rr2')->'decisions') = 1
    and pg_temp.r11_keys(pg_temp.r11_resp('rvA-rr2')->'decisions'->0) = 'capability,decidedAt,decision,id,mine,reason'
    and (pg_temp.r11_resp('rvA-rr2')->'decisions'->0->>'mine')::boolean
    and pg_temp.r11_resp('rvA-rr2')->'decisions'->0->>'reason' = 'Reads well; approved.'
    and pg_temp.r11_resp('rvA-rr2')->'decisions'->0->>'capability' = 'cms.reviewer'
    and pg_temp.r11_resp('rvA-rr2')->'decisions'->0->>'decision' = 'approve',
  'a decision exposes id, decision, capability, decidedAt and mine, and its reason to its decider [P2-S11-AC-057]');
select ok(
  not (pg_temp.r11_resp('rvS-rr2')->'decisions'->0->>'mine')::boolean
    and pg_temp.r11_resp('rvS-rr2')->'decisions'->0->'reason' = 'null'::jsonb
    and pg_temp.r11_resp('owner-rr2')->'decisions'->0->'reason' = 'null'::jsonb
    and not pg_temp.r11_leaks(pg_temp.r11_resp('rvS-rr2'), array['Reads well; approved.', pg_temp.s11_id('rvA')::text])
    and not pg_temp.r11_leaks(pg_temp.r11_resp('owner-rr2'), array['Reads well; approved.', pg_temp.s11_id('rvA')::text]),
  'another reviewer and the owner see the decision with mine false and reason null: a private comment and the decider''s identity never leave [P2-S11-AC-057]');
select ok(
  (pg_temp.r11_resp('rvA-rr2')->>'distinctApprovalCount')::integer = 1
    and (pg_temp.r11_resp('rvA-rr2')->>'recordedDecisionCount')::integer = 1
    and (pg_temp.r11_resp('rvA-rr2')->>'requiredDecisionCount')::integer = 2
    and pg_temp.r11_resp('rvA-rr2')->>'riskClass' = 'protected' and pg_temp.r11_resp('rvA-rr2')->>'state' = 'open'
    and pg_temp.r11_resp('rvA-rr2')->'permittedNextActions' = '[]'::jsonb
    and pg_temp.r11_resp('rvS-rr2')->'permittedNextActions' = '["record_decision"]'::jsonb,
  'a protected review shows one of two decisions; the reviewer who decided has no further action, the other assigned reviewer may decide [P2-S11-AC-055]');

-- The approved review: publisher actions; live recount.
select pg_temp.r11r_call('pub-rr3', 'cms_get_editorial_review', 'pub', pg_temp.r11r_rq('rr3'));
select pg_temp.r11r_call('owner-rr3', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr3'));
select ok(
  pg_temp.r11_resp('pub-rr3')->>'state' = 'approved' and pg_temp.r11_resp('pub-rr3')->'decidedAt' <> 'null'::jsonb
    and pg_temp.r11_resp('pub-rr3')->'permittedNextActions' = '["schedule", "publish"]'::jsonb
    and pg_temp.r11_resp('owner-rr3')->'permittedNextActions' = '[]'::jsonb
    and (pg_temp.r11_resp('pub-rr3')->>'distinctApprovalCount')::integer = 1,
  'an approved review offers its owner-party publisher schedule and publish (the publisher is not the revision author) and the owner nothing [P2-S11-AC-055]');
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
            where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$$,
         pg_temp.s11_id('org'), pg_temp.s11_id('rvA')));
select pg_temp.r11r_call('pub-rr3-lapsed', 'cms_get_editorial_review', 'pub', pg_temp.r11r_rq('rr3'));
select ok(
  (pg_temp.r11_resp('pub-rr3-lapsed')->>'distinctApprovalCount')::integer = 0
    and (pg_temp.r11_resp('pub-rr3-lapsed')->>'recordedDecisionCount')::integer = 1
    and jsonb_array_length(pg_temp.r11_resp('pub-rr3-lapsed')->'decisions') = 1
    and pg_temp.r11_resp('pub-rr3-lapsed')->>'state' = 'approved',
  'distinctApprovalCount is the LIVE recount: after the approver''s standing grant lapsed it is 0 while the recorded decision and the stored state are unchanged [P2-S11-AC-055]');

-- ---------------------------------------------------------------------------
-- Concealment (404) versus capability (403).
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('f-outsider', 'cms_get_editorial_review', 'outsider', pg_temp.r11r_rq('rr1'), false);
select pg_temp.r11r_call('f-rvX', 'cms_get_editorial_review', 'rvX', pg_temp.r11r_rq('rr1'), false);
select is(pg_temp.r11_out('f-outsider') || '|' || coalesce(pg_temp.r11_detail('f-outsider'), 'null')
    || ' ' || pg_temp.r11_out('f-rvX') || '|' || coalesce(pg_temp.r11_detail('f-rvX'), 'null'),
  'P0001:capability_missing|null P0001:capability_missing|null',
  'a confirmed member with no read scope, and a reviewer whose assignment was revoked, are 403 capability_missing [P2-S11-AC-057]');
select pg_temp.r11r_call('h-stranger', 'cms_get_editorial_review', 'stranger', pg_temp.r11r_rq('rr1'), false);
select pg_temp.r11r_call('h-absent', 'cms_get_editorial_review', 'owner',
  jsonb_build_object('reviewId', extensions.gen_random_uuid(), 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('h-party', 'cms_get_editorial_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s11_id('rr1'), 'context', pg_temp.r11_ctx(interval '60 seconds', true, pg_temp.s11_id('creator'))), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('h-stranger'), ('h-absent'), ('h-party')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a non-member, an absent review and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-057]');

-- ---------------------------------------------------------------------------
-- Structure.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('s-extra', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr1') || '{"limit":5}', false);
select pg_temp.r11r_call('s-cursor', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr1') || '{"cursor":"x"}', false);
select pg_temp.r11r_call('s-missing', 'cms_get_editorial_review', 'owner', jsonb_build_object('context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('s-bad-id', 'cms_get_editorial_review', 'owner', jsonb_build_object('reviewId', 'nope', 'context', pg_temp.r11_ctx()), false);
select pg_temp.r11r_call('s-number-id', 'cms_get_editorial_review', 'owner', jsonb_build_object('reviewId', 7, 'context', pg_temp.r11_ctx()), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label)
     from (values ('s-extra'), ('s-cursor'), ('s-missing'), ('s-bad-id'), ('s-number-id')) as v(label)),
  's-bad-id=P0001:INVALID_REQUEST s-cursor=P0001:INVALID_REQUEST s-extra=P0001:INVALID_REQUEST s-missing=P0001:INVALID_REQUEST s-number-id=P0001:INVALID_REQUEST',
  'a query member, a missing or malformed review id is INVALID_REQUEST [P2-S11-AC-056]');

-- ---------------------------------------------------------------------------
-- Bounds and the safe-read guarantee.
-- ---------------------------------------------------------------------------
select pg_temp.r11r_call('owner-big', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr-big'));
select ok(
  jsonb_array_length(pg_temp.r11_resp('owner-big')->'assignments') = 32
    and (select count(*) filter (where item->>'state' = 'active') = 15 and count(*) filter (where item->>'state' = 'revoked') = 17
           and count(distinct item->>'reviewerLabel') = 16
           and bool_and(item->>'reviewerLabel' ~ '^Reviewer ([1-9]|1[0-6])$')
           from jsonb_array_elements(pg_temp.r11_resp('owner-big')->'assignments') item),
  'assignment summaries are capped at 32, every active one first then the newest revoked, with one display label per reviewer (16) and never an identifier [P2-S11-AC-056]');

select pg_temp.r11r_call('replay-1', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr1'));
select pg_temp.r11r_call('replay-2', 'cms_get_editorial_review', 'owner', pg_temp.r11r_rq('rr1'));
select ok(pg_temp.r11_resp('replay-1') = pg_temp.r11_resp('replay-2')
    and pg_temp.r11r_effects() = (select effects from r11_snap where label = 'before'),
  'reading twice answers the same document and writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules and publications are unchanged by every read above [P2-S11-AC-059]');

select * from finish();
rollback;
