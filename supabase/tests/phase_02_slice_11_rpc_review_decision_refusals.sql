-- Slice 11 lane S11-3a: cms_record_review_decision refusals (CMS-03B-06, AC-108 order; tracker
-- P2-S11-AC-012, AC-013, AC-015, AC-108, AC-109).  Every refusal is the reason token as the whole P0001
-- message and changes nothing.  The contract and the committed effects are in
-- phase_02_slice_11_rpc_review_decision.sql; the invalidation outcomes are in
-- phase_02_slice_11_rpc_review_decision_invalidation.sql.  RED before 20261005017630.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

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

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- rBase: open v1.  rvA decides (window covers now); rvB's window is over (expired, not revoked);
-- rvS's window has not started; rvX's assignment is revoked.
select pg_temp.r11_frozen_review('rBase', 'ref-base');
select pg_temp.r11_assign_now('rBase-rvA', 'rBase', 'rvA');
select pg_temp.h11r_assign('rBase-rvB', 'rBase', 'rvB');
select pg_temp.h11r_assign('rBase-rvS', 'rBase', 'rvS', jsonb_build_object(
  'starts_at', clock_timestamp() + interval '1 hour', 'ends_at', clock_timestamp() + interval '25 hours'));
select pg_temp.r11_assign_now('rBase-rvX', 'rBase', 'rvX');
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_editorial_review_assignments
   set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('rBase-rvX');

-- States: rApproved / rRejected / rInvalid keep rvA's effective assignment so the state check is reached.
select pg_temp.r11_frozen_review('rApproved', 'ref-approved');
select pg_temp.r11_assign_now('rApproved-rvA', 'rApproved', 'rvA');
select pg_temp.r11_assign_now('rApproved-rvB', 'rApproved', 'rvB');
select pg_temp.r11_decide_now('rApproved-dec', 'rApproved', 'rvB', 'rApproved-rvB', 'approve');
select pg_temp.r11_frozen_review('rRejected', 'ref-rejected');
select pg_temp.r11_assign_now('rRejected-rvA', 'rRejected', 'rvA');
select pg_temp.r11_assign_now('rRejected-rvB', 'rRejected', 'rvB');
select pg_temp.r11_decide_now('rRejected-dec', 'rRejected', 'rvB', 'rRejected-rvB', 'reject');
select pg_temp.r11_frozen_review('rInvalid', 'ref-invalid');
select pg_temp.r11_assign_now('rInvalid-rvA', 'rInvalid', 'rvA');
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'revision_superseded', version = version + 1,
       updated_at = clock_timestamp()
 where id = pg_temp.s11_id('rInvalid');
-- A two-decision review at version 2 (rvB approved) for the CAS and duplicate cases.
select pg_temp.r11_frozen_review('rTwo', 'ref-two', jsonb_build_object('required_decision_count', 2));
select pg_temp.r11_assign_now('rTwo-rvA', 'rTwo', 'rvA');
select pg_temp.r11_assign_now('rTwo-rvB', 'rTwo', 'rvB');
select pg_temp.r11_decide_now('rTwo-dec', 'rTwo', 'rvB', 'rTwo-rvB', 'approve');
-- Separation: the submitter and the revision author hold an effective assignment (guard bypassed:
-- the assignment guard itself refuses them, this proves the command's own check).
select pg_temp.r11_frozen_review('rSep', 'ref-sep');
select pg_temp.h11r_raw_insert('platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object('id', extensions.gen_random_uuid(), 'review_id', pg_temp.s11_id('rSep'),
    'reviewer_person_id', pg_temp.s11_id('editor'), 'starts_at', clock_timestamp() - interval '1 hour',
    'ends_at', clock_timestamp() + interval '23 hours')));
select pg_temp.h11r_raw_insert('platform_private.cms_editorial_review_assignments',
  pg_temp.s11_assignment_row(jsonb_build_object('id', extensions.gen_random_uuid(), 'review_id', pg_temp.s11_id('rSep'),
    'reviewer_person_id', pg_temp.s11_id('creator'), 'starts_at', clock_timestamp() - interval '1 hour',
    'ends_at', clock_timestamp() + interval '23 hours')));

select is(
  (select string_agg(id.key || '=' || review.state || '/' || review.version || '/' || review.recorded_decision_count, ',' order by id.key)
     from (values ('rBase'), ('rApproved'), ('rRejected'), ('rInvalid'), ('rTwo'), ('rSep')) as id(key)
     join platform_private.cms_editorial_reviews review on review.id = pg_temp.s11_id(id.key)),
  'rApproved=approved/2/1,rBase=open/1/0,rInvalid=invalidated/2/0,rRejected=rejected/2/1,rSep=open/1/0,rTwo=open/2/1',
  'control: the six review fixtures are in the intended states');
insert into r11_snap(label, effects) values ('start', pg_temp.r11_effects());

-- ---------------------------------------------------------------------------
-- 1. The step-up proof comes first (even before a hidden review is concealed).
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('su-stale', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '611 seconds'))), false);
select pg_temp.r11_dcall('su-future', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '-40 seconds'))), false);
select pg_temp.r11_dcall('su-unverified', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', false))), false);
select pg_temp.r11_dcall('su-absent', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx() - 'stepUpAt')), false);
select pg_temp.r11_dcall('su-hidden', 'stranger', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select is(
  (select count(distinct pg_temp.r11_out(label))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('su-stale'), ('su-future'), ('su-unverified'), ('su-absent'), ('su-hidden')) as v(label)),
  '1:P0001:STEP_UP_REQUIRED',
  'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]');
select pg_temp.r11_dcall('su-ok-edge', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('context', pg_temp.r11_ctx(interval '590 seconds'))), false);
select is(pg_temp.r11_out('su-ok-edge'), '00000:', 'control: a proof 590 s old is accepted [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- 2. Concealment (404) and the effective assignment (403 capability_missing).
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('h-stranger', 'stranger', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('h-outsider', 'outsider', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('h-absent', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reviewId', extensions.gen_random_uuid())), false);
select pg_temp.r11_dcall('h-other-party', 'rvA', pg_temp.r11_dreq('rBase', 'approve',
  jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', true, pg_temp.s11_id('rvA')))), false);
select pg_temp.r11_dcall('h-revoked', 'rvX', pg_temp.r11_dreq('rBase', 'approve'), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text || ':' || min(pg_temp.r11_out(label))
     from (values ('h-stranger'), ('h-outsider'), ('h-absent'), ('h-other-party'), ('h-revoked')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a non-member, a scope-less member, an absent review, another acting party and a reviewer whose assignment was revoked are one indistinguishable NOT_FOUND [P2-S11-AC-013]');
select pg_temp.r11_dcall('f-expired', 'rvB', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('f-not-started', 'rvS', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('f-submitter-no-assignment', 'editor', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('f-publisher', 'pub', pg_temp.r11_dreq('rBase', 'approve'), false);
select pg_temp.r11_dcall('f-owner', 'owner', pg_temp.r11_dreq('rBase', 'approve'), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'), ';' order by label)
     from (values ('f-expired'), ('f-not-started'), ('f-submitter-no-assignment'), ('f-publisher'), ('f-owner')) as v(label)),
  'f-expired=P0001:capability_missing|null;f-not-started=P0001:capability_missing|null;f-owner=P0001:capability_missing|null;f-publisher=P0001:capability_missing|null;f-submitter-no-assignment=P0001:capability_missing|null',
  'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]');

-- ---------------------------------------------------------------------------
-- 3. Open state, then the CAS operand.
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('s-approved', 'rvA', pg_temp.r11_dreq('rApproved', 'approve', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1')), false);
select pg_temp.r11_dcall('s-rejected', 'rvA', pg_temp.r11_dreq('rRejected', 'approve'), false);
select pg_temp.r11_dcall('s-invalid', 'rvA', pg_temp.r11_dreq('rInvalid', 'reject'), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label) from (values ('s-approved'), ('s-rejected'), ('s-invalid')) as v(label)),
  's-approved=P0001:review_not_open;s-invalid=P0001:review_not_open;s-rejected=P0001:review_not_open',
  'an approved, rejected or invalidated review is review_not_open, and the state is evaluated before the CAS operand [P2-S11-AC-108]');
select pg_temp.r11_dcall('s-stale', 'rvA', pg_temp.r11_dreq('rTwo', 'approve', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1')), false);
select ok(pg_temp.r11_out('s-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('s-stale')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb,
  'a stale review version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-014]');
select pg_temp.r11_dcall('s-ifmatch', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('ifMatch', '2')), false);
select pg_temp.r11_dcall('s-version', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('expectedVersion', 'x')), false);
select is(pg_temp.r11_out('s-ifmatch') || '|' || pg_temp.r11_out('s-version') || pg_temp.r11_detail('s-version'),
  'P0001:INVALID_REQUEST|P0001:VALIDATION_FAILED["/expectedVersion"]',
  'If-Match must equal expectedVersion (INVALID_REQUEST) and be a positive decimal (VALIDATION_FAILED) [P2-S11-AC-012]');

-- ---------------------------------------------------------------------------
-- 4. Separation of duties, duplicates and the standing grant.
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('sod-submitter', 'editor', pg_temp.r11_dreq('rSep', 'approve'), false);
select pg_temp.r11_dcall('sod-author', 'owner', pg_temp.r11_dreq('rSep', 'reject'), false);
select is(pg_temp.r11_out('sod-submitter') || '|' || pg_temp.r11_out('sod-author'),
  'P0001:separation_of_duties|P0001:separation_of_duties',
  'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]');
select pg_temp.r11_dcall('dup', 'rvB', pg_temp.r11_dreq('rTwo', 'approve'), false);
select is(pg_temp.r11_out('dup'), 'P0001:duplicate_decision', 'a second decision by the same human is 409 duplicate_decision [P2-S11-AC-108]');
update identity_private.organization_actor_grant
   set valid_from = current_date - 5, valid_through = current_date - 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA') and capability_code = 'cms.reviewer';
select pg_temp.r11_dcall('cap-lapsed', 'rvA', pg_temp.r11_dreq('rBase', 'approve'), false);
update identity_private.organization_actor_grant
   set valid_from = current_date, valid_through = null
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA') and capability_code = 'cms.reviewer';
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA') and capability_code = 'cms.reviewer';
select pg_temp.r11_dcall('cap-off', 'rvA', pg_temp.r11_dreq('rBase', 'reject'), false);
update identity_private.organization_actor_grant set active = true
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA') and capability_code = 'cms.reviewer';
update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA');
select pg_temp.r11_dcall('cap-tenure', 'rvA', pg_temp.r11_dreq('rBase', 'approve'), false);
update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, ends_on = null
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('rvA');
select is(pg_temp.r11_out('cap-lapsed') || '|' || pg_temp.r11_out('cap-off') || '|' || pg_temp.r11_out('cap-tenure'),
  'P0001:capability_missing|P0001:capability_missing|P0001:NOT_FOUND',
  'a lapsed or deactivated standing cms.reviewer grant is 403 capability_missing; an ended membership leaves no scope at all (404) [P2-S11-AC-108]');
select pg_temp.r11_dcall('cap-control', 'rvA', pg_temp.r11_dreq('rBase', 'approve'), false);
select is(pg_temp.r11_out('cap-control'), '00000:', 'control: with the grants restored the same decision succeeds [P2-S11-AC-108]');

-- ---------------------------------------------------------------------------
-- 5. The request: decision, reason (SafeText, code points), caller authority keys.
-- ---------------------------------------------------------------------------
select pg_temp.r11_dcall('v-decision', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('decision', 'maybe')), false);
select pg_temp.r11_dcall('v-decision-null', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('decision', null)), false);
select pg_temp.r11_dcall('v-empty', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', '')), false);
select pg_temp.r11_dcall('v-long', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', repeat('x', 2001))), false);
select pg_temp.r11_dcall('v-nfd', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'e' || U&'\0301')), false);
select pg_temp.r11_dcall('v-control', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'bell' || chr(7))), false);
select pg_temp.r11_dcall('v-lineseparator', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'a' || U&'\2028' || 'b')), false);
select pg_temp.r11_dcall('v-bidi', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'a' || U&'\202E' || 'b')), false);
select pg_temp.r11_dcall('v-markup', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'a <b> b')), false);
select pg_temp.r11_dcall('v-brace', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 'a {{ b }}')), false);
select pg_temp.r11_dcall('v-number', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', 7)), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('v-decision'), ('v-decision-null'), ('v-empty'), ('v-long'), ('v-nfd'), ('v-control'),
                  ('v-lineseparator'), ('v-bidi'), ('v-markup'), ('v-brace'), ('v-number')) as v(label)),
  'v-bidi=P0001:VALIDATION_FAILED["/reason"];v-brace=P0001:VALIDATION_FAILED["/reason"];v-control=P0001:VALIDATION_FAILED["/reason"];v-decision=P0001:VALIDATION_FAILED["/decision"];v-decision-null=P0001:VALIDATION_FAILED["/decision"];v-empty=P0001:VALIDATION_FAILED["/reason"];v-lineseparator=P0001:VALIDATION_FAILED["/reason"];v-long=P0001:VALIDATION_FAILED["/reason"];v-markup=P0001:VALIDATION_FAILED["/reason"];v-nfd=P0001:VALIDATION_FAILED["/reason"];v-number=P0001:VALIDATION_FAILED["/reason"]',
  'an unknown decision, an empty, over-long, non-NFC, control, separator, bidi, markup or brace reason, and a non-string reason are VALIDATION_FAILED at their pointer [P2-S11-AC-012]');
select pg_temp.r11_dcall('v-2000-emoji', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reason', repeat(U&'\+01F600', 2000))), false);
select ok(pg_temp.r11_out('v-2000-emoji') = '00000:',
  'the reason bound is 2000 Unicode code points: 2000 emoji (8000 octets) are accepted (DEC-158(a)) [P2-S11-AC-012]');
select pg_temp.r11_dcall('v-capability', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('capability', 'cms.reviewer.policy')), false);
select pg_temp.r11_dcall('v-stepup-key', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('stepUpAt', clock_timestamp())), false);
select pg_temp.r11_dcall('v-review-key', 'rvA', pg_temp.r11_dreq('rBase', 'approve', jsonb_build_object('reviewId', 'nope')), false);
select pg_temp.r11_dcall('v-missing-reason', 'rvA', pg_temp.r11_dreq('rBase', 'approve', '{}'::jsonb, array['reason']), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('v-capability'), ('v-stepup-key'), ('v-review-key'), ('v-missing-reason')) as v(label)),
  'v-capability=P0001:INVALID_REQUEST;v-missing-reason=P0001:INVALID_REQUEST;v-review-key=P0001:INVALID_REQUEST;v-stepup-key=P0001:INVALID_REQUEST',
  'a caller capability or stepUpAt is an unknown key, and a missing reason or malformed review id is INVALID_REQUEST [P2-S11-AC-012]');

select is(pg_temp.r11_effects(), (select effects from r11_snap where label = 'start'),
  'every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]');

select * from finish();
rollback;
