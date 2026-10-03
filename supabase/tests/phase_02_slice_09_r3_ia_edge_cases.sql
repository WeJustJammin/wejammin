commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): IA03 edge cases AC1128..AC1138 at database
-- level.  Every candidate, review, assignment, decision and grant comes from the
-- named producers; only authority windows are time-shifted with s09d_timewarp
-- (never a row creation) and the outcomes are exact tokens, no disjunctions.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.r3_review_digest(p_tag text) returns text language sql stable as $body$
  select md5(coalesce((select string_agg(t::text, ',' order by id) from platform_private.cms_schema_reviews t where id = pg_temp.s09d_id(p_tag || ':review')), '')
          || '|' || coalesce((select string_agg(d::text, ',' order by id) from platform_private.cms_schema_review_decisions d where review_id = pg_temp.s09d_id(p_tag || ':review')), '')
          || '|' || coalesce((select v.state::text || v.version::text || coalesce(v.definition_hash, '') from platform_private.cms_content_type_versions v where id = pg_temp.s09d_id(p_tag || ':version')), '')) $body$;
create or replace function pg_temp.r3_window(p_assignment text, p_starts text, p_ends text) returns boolean language sql as $body$
  select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
    set starts_at = %s, ends_at = %s where id = %L$q$, p_starts, p_ends, pg_temp.s09d_id(p_assignment))) $body$;

-- ===================================================================== AC1128 ==
select pg_temp.s09d_create_type('a', 'r3ia_a');
select pg_temp.s09d_to_review('a');
select pg_temp.s09d_assign('a', 'rev1');
select pg_temp.r3_review_digest('a') as a_frozen \gset
select ok(pg_temp.r3_window('a:assignment:rev1', 'clock_timestamp() + interval ''1 hour''', 'clock_timestamp() + interval ''2 hours'''),
  'fixture: the real assignment window is shifted to start in the future');
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:notstarted');
select is(pg_temp.s09d_outcome('a:notstarted'), 'NOT_FOUND', 'a decision before starts_at is refused with NOT_FOUND (the authority is not yet effective) [P2-S09-AC-1128]');
select ok(pg_temp.r3_window('a:assignment:rev1', 'clock_timestamp() - interval ''2 hours''', 'clock_timestamp() - interval ''1 microsecond'''),
  'fixture: the same assignment window now ended a microsecond ago');
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:ended');
select is(pg_temp.s09d_outcome('a:ended'), 'NOT_FOUND', 'a decision at or after ends_at is refused with NOT_FOUND: the window is starts_at <= now < ends_at [P2-S09-AC-1128]');
select is(pg_temp.r3_review_digest('a'), :'a_frozen', 'the refused decisions left the review, its decisions and the candidate byte-for-byte unchanged: the review stays frozen [P2-S09-AC-1128]');
select ok(pg_temp.r3_window('a:assignment:rev1', 'clock_timestamp() - interval ''1 minute''', 'clock_timestamp() + interval ''1 day'''),
  'fixture: the assignment window is valid again');
select pg_temp.s09d_decide('a', 'rev1', 'approve', '{}'::jsonb, 'a:valid');
select is(pg_temp.s09d_outcome('a:valid'), 'OK', 'control: inside starts_at <= now < ends_at the same reviewer decides [P2-S09-AC-1128]');

select pg_temp.s09d_create_type('b', 'r3ia_b');
select pg_temp.s09d_to_review('b');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_rpc('b:revoke', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('b:review'), 'action', 'revoke', 'expectedVersion', pg_temp.s09d_review_version('b'),
    'assignmentId', pg_temp.s09d_id('b:assignment:rev1'), 'idempotencyKey', 'r3ia-b-revoke-0001'), true);
select is(pg_temp.s09d_outcome('b:revoke'), 'OK', 'fixture: the owner revokes the assignment through CMS-03A-14');
select pg_temp.r3_review_digest('b') as b_frozen \gset
select pg_temp.s09d_decide('b', 'rev1', 'approve', '{}'::jsonb, 'b:decide');
select is(pg_temp.s09d_outcome('b:decide'), 'NOT_FOUND', 'a decision by a reviewer whose assignment was revoked mid-review is refused with NOT_FOUND [P2-S09-AC-1128]');
select is(pg_temp.r3_review_digest('b'), :'b_frozen', 'and the review stays frozen [P2-S09-AC-1128]');

select pg_temp.s09d_create_type('c', 'r3ia_c');
select pg_temp.s09d_to_review('c');
select pg_temp.s09d_assign('c', 'rev1');
update platform_private.acting_context_binding set state = 'revoked' where id = pg_temp.s09d_actor_id('rev1', 'binding')::uuid;
select pg_temp.s09d_decide('c', 'rev1', 'approve', '{}'::jsonb, 'c:nobinding');
select is(pg_temp.s09d_outcome('c:nobinding'), 'STEP_UP_REQUIRED', 'authority needs a current binding: a revoked binding makes the decision STEP_UP_REQUIRED [P2-S09-AC-1128]');
update platform_private.acting_context_binding set state = 'active' where id = pg_temp.s09d_actor_id('rev1', 'binding')::uuid;

select pg_temp.s09d_create_type('d', 'r3ia_d');
select pg_temp.s09d_to_approved('d');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('d:review')), 'approved', 'fixture: d is approved while the assignment was effective');
select ok(pg_temp.r3_window('d:assignment:rev1', 'clock_timestamp() - interval ''2 hours''', 'clock_timestamp() - interval ''1 second'''),
  'fixture: the approving reviewer assignment ended after the decision');
select pg_temp.s09d_activate('d', 'owner', '{}'::jsonb, 'd:activate');
select is(pg_temp.s09d_outcome('d:activate'), 'APPROVAL_INVALID', 'activation rechecks the live assignment: an ended assignment makes the approval APPROVAL_INVALID [P2-S09-AC-1128]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('d:version')), 'approved', 'and the candidate stays approved and unswitched [P2-S09-AC-1128]');

-- ===================================================================== AC1129 ==
select pg_temp.s09d_create_type('e', 'r3ia_e');
select pg_temp.s09d_dry_run('e', 'designer2');
select pg_temp.s09d_seal('e', '0', 'designer2');
select pg_temp.s09d_submit('e', 'designer2');
select is(pg_temp.s09d_outcome('e:submit'), 'OK', 'fixture: designer2 submits the review, so designer2 is the submitter');
select pg_temp.s09d_rpc('e:self', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('e:review'), 'action', 'create', 'expectedVersion', pg_temp.s09d_review_version('e'),
    'reviewerPersonId', pg_temp.s09d_actor_id('designer2', 'person'),
    'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'idempotencyKey', 'r3ia-e-self-0001'), true);
select is(pg_temp.s09d_outcome('e:self'), 'CONFLICT', 'the submitter can never be assigned as a reviewer: 409 CONFLICT [P2-S09-AC-1129]');
select is((select count(*) from platform_private.cms_schema_review_assignments where review_id = pg_temp.s09d_id('e:review')), 0::bigint, 'no assignment row exists for the submitter [P2-S09-AC-1129]');
select pg_temp.s09d_decide('e', 'designer2', 'approve', '{}'::jsonb, 'e:submitter');
select is(pg_temp.s09d_outcome('e:submitter'), 'FORBIDDEN', 'a decision by the submitter is refused (it holds no assignment, the review is readable to them): FORBIDDEN [P2-S09-AC-1129]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('e:review')), 0::bigint, 'the submitter never counts: no decision row exists [P2-S09-AC-1129]');
select pg_temp.s09d_create_type('f', 'r3ia_f', 'cms.disclosure.policy');
select pg_temp.s09d_to_review('f');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_assign('f', 'rev1');
select pg_temp.s09d_assign('f', 'rev2');
select pg_temp.s09d_decide('f', 'rev1', 'approve');
select pg_temp.r3_review_digest('f') as f_before \gset
select pg_temp.s09d_decide('f', 'rev1', 'approve', '{}'::jsonb, 'f:duplicate');
select is(pg_temp.s09d_outcome('f:duplicate'), 'CONFLICT', 'a second decision by the same human on the same review is refused: 409 CONFLICT [P2-S09-AC-1129]');
select pg_temp.s09d_decide('f', 'rev1', 'reject', '{}'::jsonb, 'f:flip');
select is(pg_temp.s09d_outcome('f:flip'), 'CONFLICT', 'a repeated human cannot flip approve to reject either: 409 CONFLICT [P2-S09-AC-1129]');
select is(pg_temp.r3_review_digest('f'), :'f_before', 'neither refused decision changed any row: the decision history is append-only [P2-S09-AC-1129]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('f:review')), 1::bigint, 'exactly one decision row exists [P2-S09-AC-1129]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('f:review') and reviewer_person_ref = pg_temp.s09d_actor_id('rev1', 'person')::uuid),
  1::bigint, 'and it is the first human decision, unchanged [P2-S09-AC-1129]');

-- ===================================================================== AC1130 ==
-- Protected review (two decisions): the stale-version loser gets the typed 409; the
-- review is approved only when the required count of independent approvals exists.
select pg_temp.s09d_create_type('g', 'r3ia_g', 'cms.disclosure.policy');
select pg_temp.s09d_to_review('g');
select pg_temp.s09d_assign('g', 'rev1');
select pg_temp.s09d_assign('g', 'rev2');
select pg_temp.s09d_review_version('g') as g_v0 \gset
select pg_temp.s09d_decide('g', 'rev1', 'approve');
select is(pg_temp.s09d_outcome('g:decide:rev1'), 'OK', 'the first reviewer decides at the version both read [P2-S09-AC-1130]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('g:review')), 'open', 'one approval of two required leaves the review open [P2-S09-AC-1130]');
select pg_temp.s09d_rpc('g:loser', 'platform_api.cms_decide_schema_review', 'rev2',
  jsonb_build_object('reviewId', pg_temp.s09d_id('g:review'), 'expectedVersion', :'g_v0', 'decision', 'approve', 'idempotencyKey', 'r3ia-g-loser-0001'), true);
select is(pg_temp.s09d_outcome('g:loser'), 'CONFLICT', 'the second reviewer still carrying the stale review version gets the typed 409 CONFLICT [P2-S09-AC-1130]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('g:review')), 1::bigint, 'the loser recorded nothing: one decision row [P2-S09-AC-1130]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('g:review')), 'open', 'the loser did not approve the review: still open [P2-S09-AC-1130]');
select pg_temp.s09d_decide('g', 'rev2', 'approve', '{}'::jsonb, 'g:retry');
select is(pg_temp.s09d_outcome('g:retry'), 'OK', 'after refetching the version the second independent reviewer decides [P2-S09-AC-1130]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('g:review')), 'approved', 'the review is approved only now that the required count of independent approvals exists [P2-S09-AC-1130]');
select is((select count(distinct reviewer_person_ref) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('g:review') and decision = 'approve'), 2::bigint,
  'exactly two distinct humans approved [P2-S09-AC-1130]');

-- ===================================================================== AC1131 ==
-- Drift after approval invalidates the review, activation is refused with the
-- typed CONFLICT and a resubmission freezes NEW evidence.
create or replace function pg_temp.r3_resubmit(p_tag text) returns void language plpgsql as $body$
begin
  perform pg_temp.s09d_dry_run(p_tag, 'owner', null, null, 'r3ia-resubmit-dry-' || p_tag);
  perform pg_temp.s09d_seal(p_tag);
  perform pg_temp.s09d_remember(p_tag || ':oldReview', pg_temp.s09d_id(p_tag || ':review'));
  perform pg_temp.s09d_submit(p_tag);
end;
$body$;
select pg_temp.s09d_create_type('h', 'r3ia_h');
select pg_temp.s09d_add_relation('h');
select pg_temp.s09d_to_approved('h');
update platform_private.cms_relation_definitions set max_count = 4
 where field_definition_id in (select id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('h:version'));
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('h:review')), 'invalidated', 'dependency drift invalidates the approved review [P2-S09-AC-1131]');
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'h:late');
select is(pg_temp.s09d_outcome('h:late'), 'CONFLICT', 'activation after dependency drift is refused with the typed 409 CONFLICT [P2-S09-AC-1131]');
select pg_temp.r3_resubmit('h');
select is(pg_temp.s09d_outcome('h:submit'), 'OK', 'a resubmission after drift is accepted [P2-S09-AC-1131]');
select ok(pg_temp.s09d_id('h:review') <> pg_temp.s09d_id('h:oldReview')
  and (select r.definition_hash <> o.definition_hash from platform_private.cms_schema_reviews r, platform_private.cms_schema_reviews o
        where r.id = pg_temp.s09d_id('h:review') and o.id = pg_temp.s09d_id('h:oldReview')),
  'the resubmission froze a new review whose frozen definition hash differs from the invalidated one [P2-S09-AC-1131]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('h:oldReview')), 'invalidated', 'the old review stays invalidated and carries none of the new evidence [P2-S09-AC-1131]');

select pg_temp.s09d_create_type('i', 'r3ia_i');
select pg_temp.s09d_to_approved('i');
set constraints all immediate;
alter table platform_private.cms_schema_artifacts disable trigger cms_schema_artifacts_write_guard;
alter table platform_private.cms_schema_artifacts disable trigger cms_schema_artifacts_z_compile_guard;
update platform_private.cms_schema_artifacts set compiler_version = '2'
 where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('i:version'));
alter table platform_private.cms_schema_artifacts enable trigger cms_schema_artifacts_write_guard;
alter table platform_private.cms_schema_artifacts enable trigger cms_schema_artifacts_z_compile_guard;
set constraints all deferred;
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('i:review')), 'invalidated', 'compiler drift invalidates the approved review [P2-S09-AC-1131]');
select pg_temp.s09d_activate('i', 'owner', '{}'::jsonb, 'i:late');
select is(pg_temp.s09d_outcome('i:late'), 'CONFLICT', 'activation after compiler drift is refused with the typed 409 CONFLICT [P2-S09-AC-1131]');

select pg_temp.s09d_create_type('j', 'r3ia_j');
select pg_temp.s09d_to_approved('j');
update platform_private.cms_content_types set owner_capability = 'cms.schema_registry.read' where id = pg_temp.s09d_id('j:type');
update platform_private.cms_content_types set owner_capability = 'cms.schema_designer' where id = pg_temp.s09d_id('j:type');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('j:review')), 'invalidated', 'candidate authority (owner capability) drift invalidates the approved review [P2-S09-AC-1131]');
select pg_temp.s09d_activate('j', 'owner', '{}'::jsonb, 'j:late');
select is(pg_temp.s09d_outcome('j:late'), 'CONFLICT', 'activation after authority drift is refused with the typed 409 CONFLICT [P2-S09-AC-1131]');

select pg_temp.s09d_create_type('k', 'r3ia_k', 'cms.disclosure.policy');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_to_approved('k', array['rev1', 'rev2']);
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('k:review')), 'approved', 'fixture: a protected review with a specialist approver is approved');
select is(pg_temp.s09d_revoke_via_rpc('rev1', 'cms.reviewer.policy'), 'OK', 'the owner revokes the specialist capability of the counted approver through CMS-03A-17');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('k:review')), 'invalidated', 'reviewer authority drift invalidates the approved review [P2-S09-AC-1131] [P2-S09-AC-1135]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('k:version')), 'draft', 'and returns the candidate to draft [P2-S09-AC-1135]');
select pg_temp.s09d_activate('k', 'owner', '{}'::jsonb, 'k:late');
select is(pg_temp.s09d_outcome('k:late'), 'CONFLICT', 'activation after the specialist capability was revoked is refused with the typed 409 CONFLICT [P2-S09-AC-1135]');
select pg_temp.r3_resubmit('k');
select is(pg_temp.s09d_outcome('k:submit'), 'OK', 'a resubmission after the specialist loss freezes new evidence [P2-S09-AC-1135]');
select ok(pg_temp.s09d_id('k:review') <> pg_temp.s09d_id('k:oldReview') and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('k:review')) = 'open'
  and (select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('k:review')) = 0,
  'the new review is a different open review with none of the old decisions [P2-S09-AC-1135]');

-- Expiry (not revocation) of the specialist capability has no event, so the live
-- authority recheck at activation is what refuses: the approver stops qualifying
-- (APPROVAL_INVALID), nothing switches, and renewing the capability restores it.
select pg_temp.s09d_create_type('l', 'r3ia_l', 'cms.disclosure.legal');
select pg_temp.s09d_grant_specialist('rev2', 'cms.reviewer.legal');
select pg_temp.s09d_to_approved('l', array['rev2', 'rev3']);
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('l:review')), 'approved', 'fixture: the legal-specialist protected review is approved');
select ok(pg_temp.s09g_warp('rev2', 'cms.reviewer.legal', -3, -1), 'fixture: the approver''s specialist grant lapsed yesterday (time-shift of the real aggregate and its projection)');
select pg_temp.s09d_activate('l', 'owner', '{}'::jsonb, 'l:late');
select is(pg_temp.s09d_outcome('l:late'), 'APPROVAL_INVALID', 'an expired specialist capability stops the approver qualifying: activation is refused with APPROVAL_INVALID [P2-S09-AC-1135]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('l:version')), 'approved', 'and nothing switched: the candidate stays approved [P2-S09-AC-1135]');
select pg_temp.s09d_rpc('l:renew', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', (select id from platform_private.cms_capability_grants where subject_person_ref = pg_temp.s09d_actor_id('rev2', 'person')::uuid and capability_code = 'cms.reviewer.legal'),
    'expectedVersion', (select version::text from platform_private.cms_capability_grants where subject_person_ref = pg_temp.s09d_actor_id('rev2', 'person')::uuid and capability_code = 'cms.reviewer.legal'),
    'validThrough', pg_temp.s09g_day(20), 'idempotencyKey', 'r3ia-l-renew-0001'), true);
select is(pg_temp.s09d_outcome('l:renew'), 'OK', 'fixture: the owner renews the lapsed specialist capability');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('l:review')), 'invalidated',
  'the renewal is a reviewer-authority change: the next authority event invalidates the approved review and returns the candidate to draft [P2-S09-AC-1135]');
select pg_temp.s09d_activate('l', 'owner', '{}'::jsonb, 'l:again');
select is(pg_temp.s09d_outcome('l:again'), 'CONFLICT', 'and activation is then refused with the typed 409 CONFLICT until a new review is frozen [P2-S09-AC-1135]');

-- ===================================================================== AC1132 ==
select pg_temp.s09d_create_type('m', 'r3ia_m');
select pg_temp.s09d_to_review('m');
select pg_temp.s09d_assign('m', 'rev1');
select pg_temp.s09d_decide('m', 'rev1', 'reject');
select is(pg_temp.s09d_outcome('m:decide:rev1'), 'OK', 'a reviewer rejects the review [P2-S09-AC-1132]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('m:review')), 'rejected', 'the review is rejected [P2-S09-AC-1132]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('m:version')), 'draft', 'the candidate returns to an editable draft [P2-S09-AC-1132]');
select is((select count(*) from audit_private.audit_events a join platform_private.cms_schema_review_decisions d on d.id = a.target_id
            where d.review_id = pg_temp.s09d_id('m:review') and a.action = 'cms.schema.review.decide'), 1::bigint,
  'the rejection transition is audited: one cms.schema.review.decide audit event targets the rejecting decision [P2-S09-AC-1132]');
select is((select count(*) from platform_private.outbox_events o where o.event_type = 'cms.schema.review.decided.v1' and o.aggregate_id = pg_temp.s09d_id('m:review')), 1::bigint,
  'and one cms.schema.review.decided.v1 outbox event announces it [P2-S09-AC-1132]');
select is(pg_temp.s09d_scalar(format($q$select pg_temp.s09d_try(%L)::text$q$, format('update platform_private.cms_schema_review_decisions set decision = ''approve'' where review_id = %L', pg_temp.s09d_id('m:review')))), 'false',
  'the rejecting decision row cannot be updated [P2-S09-AC-1132]');
select is(pg_temp.s09d_scalar(format($q$select pg_temp.s09d_try(%L)::text$q$, format('delete from platform_private.cms_schema_review_decisions where review_id = %L', pg_temp.s09d_id('m:review')))), 'false',
  'the rejecting decision row cannot be deleted [P2-S09-AC-1132]');
select is(pg_temp.s09d_scalar(format($q$select pg_temp.s09d_try(%L)::text$q$, format('update platform_private.cms_schema_reviews set state = ''open'' where id = %L', pg_temp.s09d_id('m:review')))), 'false',
  'the rejected review row cannot be reopened [P2-S09-AC-1132]');
select pg_temp.s09d_add_field_only('m');
select is((select count(*) from platform_private.cms_schema_reviews where content_type_version_id = pg_temp.s09d_id('m:version')), 1::bigint, 'the rejected review and decision rows remain after the draft is edited [P2-S09-AC-1132]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('m:review')), 1::bigint, 'the rejecting decision is still there [P2-S09-AC-1132]');

-- ===================================================================== AC1136 ==
-- legal-specialist protected review: the first approval is fine; the approval that would
-- leave the specialist slot unsatisfiable is a 409 and a reject is always accepted.
select pg_temp.s09d_create_type('o', 'r3ia_o', 'cms.disclosure.legal');
select pg_temp.s09d_to_review('o');
select pg_temp.s09d_assign('o', 'rev1');
select pg_temp.s09d_assign('o', 'rev3');
select pg_temp.s09d_decide('o', 'rev1', 'approve');
select pg_temp.s09d_decide('o', 'rev3', 'approve', '{}'::jsonb, 'o:unsat');
select is(pg_temp.s09d_outcome('o:unsat'), 'CONFLICT', 'an approve that leaves the specialist slot unsatisfiable is refused with exactly 409 CONFLICT [P2-S09-AC-1136]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('o:review')), 1::bigint, 'and records no decision [P2-S09-AC-1136]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('o:review')), 'open', 'the review stays open [P2-S09-AC-1136]');
select pg_temp.s09d_decide('o', 'rev3', 'reject', '{}'::jsonb, 'o:reject');
select is(pg_temp.s09d_outcome('o:reject'), 'OK', 'a reject decision is always accepted [P2-S09-AC-1136]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('o:review')), 'rejected', 'and rejects the review [P2-S09-AC-1136]');

-- ===================================================================== AC1137 ==
-- Serialization on the grant aggregate version (the true two-session race is in
-- ../phase_02_slice_09_dec108/012-concurrent-commands.mjs): two commands carrying
-- the same version cannot both win.
select pg_temp.s09g_member('rev3');
select pg_temp.s09g_grant('r:g', 'owner', 'rev3', 'cms.publisher', pg_temp.s09g_day(3));
select pg_temp.s09d_resp('r:g')->>'id' as r_id \gset
select pg_temp.s09d_resp('r:g')->>'version' as r_ver \gset
select pg_temp.s09d_rpc('r:first', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', :'r_id'::uuid, 'expectedVersion', :'r_ver', 'validThrough', pg_temp.s09g_day(8), 'idempotencyKey', 'r3ia-race-first-0001'), true);
select pg_temp.s09d_rpc('r:second', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', :'r_id'::uuid, 'expectedVersion', :'r_ver', 'idempotencyKey', 'r3ia-race-second-0001'), true);
select is(pg_temp.s09d_outcome('r:first'), 'OK', 'the first command at the aggregate version wins [P2-S09-AC-1137]');
select is(pg_temp.s09d_outcome('r:second'), 'CONFLICT', 'the second command at the same version is refused with the typed 409 CONFLICT and must refetch [P2-S09-AC-1137]');
select is((select version::text from platform_private.cms_capability_grants where id = :'r_id'::uuid), '2', 'the aggregate advanced exactly once (version 2) [P2-S09-AC-1137]');
select is((select state from platform_private.cms_capability_grants where id = :'r_id'::uuid), 'active', 'and the losing revocation had no effect [P2-S09-AC-1137]');
select pg_temp.s09d_rpc('r:refetch', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', :'r_id'::uuid, 'expectedVersion', (select version::text from platform_private.cms_capability_grants where id = :'r_id'::uuid), 'idempotencyKey', 'r3ia-race-refetch-0001'), true);
select is(pg_temp.s09d_outcome('r:refetch'), 'OK', 'after refetching the version the loser succeeds [P2-S09-AC-1137]');

-- ===================================================================== AC1138 ==
select pg_temp.s09g_grant('s:rev', 'owner', 'owner', 'cms.reviewer', pg_temp.s09g_day(5));
select pg_temp.s09g_grant('s:pol', 'owner', 'owner', 'cms.reviewer.policy', pg_temp.s09g_day(5));
select pg_temp.s09g_grant('s:pub', 'owner', 'owner', 'cms.publisher', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('s:rev') || pg_temp.s09d_outcome('s:pol') || pg_temp.s09d_outcome('s:pub'), 'OKOKOK',
  'the owner grants itself the reviewer, a specialist reviewer and the publisher capability: there is no self-grant limit at grant time [P2-S09-AC-1138]');
select ok(pg_temp.s09g_holds('owner', 'cms.reviewer') and pg_temp.s09g_holds('owner', 'cms.reviewer.policy') and pg_temp.s09g_holds('owner', 'cms.publisher'),
  'the self-granted capabilities are effective [P2-S09-AC-1138]');
-- Separation of duties at decision time: the owner submits (owner is the submitter).
select pg_temp.s09d_create_type('u', 'r3ia_u');
select pg_temp.s09d_to_review('u');
select pg_temp.s09d_rpc('u:selfassign', 'platform_api.cms_assign_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('u:review'), 'action', 'create', 'expectedVersion', pg_temp.s09d_review_version('u'),
    'reviewerPersonId', pg_temp.s09d_actor_id('owner', 'person'),
    'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'idempotencyKey', 'r3ia-u-selfassign-0001'), true);
select is(pg_temp.s09d_outcome('u:selfassign'), 'CONFLICT', 'holding the self-granted reviewer capability does not let the submitter review its own submission: assignment is 409 CONFLICT [P2-S09-AC-1138]');
select pg_temp.s09d_decide('u', 'owner', 'approve', '{}'::jsonb, 'u:selfdecide');
select is(pg_temp.s09d_outcome('u:selfdecide'), 'FORBIDDEN', 'and a direct decision by the self-granted submitter is refused at decision time (no assignment, review readable): FORBIDDEN [P2-S09-AC-1138]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('u:review')), 0::bigint, 'the separation of duties recorded no decision [P2-S09-AC-1138]');
-- When another designer submitted, the self-granted owner may be assigned and decide.
select pg_temp.s09d_create_type('v', 'r3ia_v');
select pg_temp.s09d_dry_run('v', 'designer2');
select pg_temp.s09d_seal('v', '0', 'designer2');
select pg_temp.s09d_submit('v', 'designer2');
select pg_temp.s09d_assign('v', 'owner');
select is(pg_temp.s09d_outcome('v:assign:owner'), 'OK', 'when a different designer submitted, the self-granted owner may be assigned as the reviewer [P2-S09-AC-1138]');
select pg_temp.s09d_decide('v', 'owner', 'approve');
select is(pg_temp.s09d_outcome('v:decide:owner'), 'OK', 'and decides: the separation of duties is enforced at decision time, not at grant time [P2-S09-AC-1138]');

-- ===================================================================== AC1133 ==
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('n:g', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select ok(pg_temp.s09g_warp('owner', 'cms.schema_designer', -5, -1) and not pg_temp.s09g_holds('owner', 'cms.schema_designer'),
  'fixture: the owner''s own cms.schema_designer grant lapsed yesterday and the owner holds no current CMS grant');
select count(*) as n_persons from platform_private.person_party \gset
select count(*) as n_parties from platform_private.party \gset
select count(*) as n_members from identity_private.membership_tenure \gset
select pg_temp.s09g_warp('rev1', 'cms.author', -5, -1) as rev1_lapsed \gset
select ok(not pg_temp.s09g_holds('rev1', 'cms.author'), 'fixture: rev1''s cms.author grant lapsed as well');
select pg_temp.s09d_resp('n:g')->>'id' as n_id \gset
select pg_temp.s09d_resp('n:g')->>'version' as n_ver \gset
select pg_temp.s09d_rpc('n:renew', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', :'n_id'::uuid, 'expectedVersion', (select version::text from platform_private.cms_capability_grants where id = :'n_id'::uuid),
    'validThrough', pg_temp.s09g_day(30), 'idempotencyKey', 'r3ia-renew-lapse-0001'), true);
select is(pg_temp.s09d_outcome('n:renew'), 'OK', 'the owner renews a lapsed grant with only the receipt identity, a live binding and recent MFA while holding no current grant of its own [P2-S09-AC-1133]');
select ok(pg_temp.s09g_holds('rev1', 'cms.author'), 'and the renewed capability is effective again [P2-S09-AC-1133]');
select is((select count(*) from platform_private.person_party), :n_persons::bigint, 'no person was bootstrapped [P2-S09-AC-1133]');
select is((select count(*) from platform_private.party), :n_parties::bigint, 'no party was bootstrapped [P2-S09-AC-1133]');
select is((select count(*) from identity_private.membership_tenure), :n_members::bigint, 'no membership was created [P2-S09-AC-1133]');
select pg_temp.s09d_rpc('n:norecent', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', :'n_id'::uuid, 'expectedVersion', (select version::text from platform_private.cms_capability_grants where id = :'n_id'::uuid),
    'validThrough', pg_temp.s09g_day(31), 'idempotencyKey', 'r3ia-renew-lapse-0002'), true, jsonb_build_object('stepUpVerified', false));
select is(pg_temp.s09d_outcome('n:norecent'), 'STEP_UP_REQUIRED', 'recent MFA is still required for the owner renewal: STEP_UP_REQUIRED without it [P2-S09-AC-1133]');
select pg_temp.s09d_rpc('n:designer2', 'platform_api.cms_renew_capability_grant', 'designer2',
  jsonb_build_object('grantId', :'n_id'::uuid, 'expectedVersion', (select version::text from platform_private.cms_capability_grants where id = :'n_id'::uuid),
    'validThrough', pg_temp.s09g_day(31), 'idempotencyKey', 'r3ia-renew-lapse-0003'), true);
select is(pg_temp.s09d_outcome('n:designer2'), 'FORBIDDEN', 'only the receipt identity may renew: a designer holding a current grant is FORBIDDEN [P2-S09-AC-1133]');

-- ===================================================================== AC1134 ==
create temp table r3_before on commit drop as
select (select count(*) from platform_private.person_party) as persons, (select count(*) from platform_private.party) as parties,
       (select count(*) from platform_private.alias_party) as aliases, (select count(*) from identity_private.membership_tenure) as tenures,
       (select count(*) from platform_private.cms_capability_grants) as grants, (select count(*) from identity_private.organization_actor_grant) as projections;
update auth.users set banned_until = clock_timestamp() + interval '1 year' where id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid;
select pg_temp.s09g_grant('t:banned', 'owner', 'rev2', 'cms.editor', pg_temp.s09g_day(3));
update auth.users set banned_until = null where id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid;
update platform_private.person_party set account_state = 'shadow', auth_user_id = null where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;
select pg_temp.s09g_grant('t:unclaimed', 'owner', 'rev2', 'cms.editor', pg_temp.s09g_day(3));
update platform_private.person_party set account_state = 'claimed', auth_user_id = pg_temp.s09d_actor_id('rev2', 'auth')::uuid where party_id = pg_temp.s09d_actor_id('rev2', 'person')::uuid;
select pg_temp.s09g_grant('t:absent', 'owner', extensions.gen_random_uuid()::text, 'cms.editor', pg_temp.s09g_day(3));
select pg_temp.s09g_grant('t:outside', 'owner', 'other', 'cms.editor', pg_temp.s09g_day(3));
select is((select count(distinct (state, message, coalesce(detail, ''))) from s09d_probe where label in ('t:banned', 't:unclaimed', 't:absent', 't:outside')), 1::bigint,
  'a banned, unclaimed, absent and other-organization subject all yield one identical refusal (same SQLSTATE, message and detail) [P2-S09-AC-1134]');
select is(pg_temp.s09d_outcome('t:banned'), 'NOT_FOUND', 'and that refusal is NOT_FOUND [P2-S09-AC-1134]');
select ok((select persons = (select count(*) from platform_private.person_party) and parties = (select count(*) from platform_private.party)
             and aliases = (select count(*) from platform_private.alias_party) and tenures = (select count(*) from identity_private.membership_tenure)
             and grants = (select count(*) from platform_private.cms_capability_grants) and projections = (select count(*) from identity_private.organization_actor_grant)
           from r3_before),
  'no identity, party, alias, membership, grant or projection row was created by any of the four refusals [P2-S09-AC-1134]');

select * from finish();
rollback;
