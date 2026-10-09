-- Slice 11 lane S11-3a: cms_assign_editorial_reviewer refusals (CMS-03B-18, DEC-136, DEC-157;
-- tracker P2-S11-AC-068 .. AC-071).  Every refusal is the reason token as the whole P0001 message,
-- changes nothing and (except the replay) reserves nothing.  The contract and the committed effects
-- are in phase_02_slice_11_rpc_review_assign.sql.  RED before 20261005017620.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(22);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/010-assign.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

-- Every revision of entry A is inserted BEFORE any review: a newer revision of the entry invalidates
-- the older live reviews (revision_superseded, the Slice 11 producer trigger).
select pg_temp.r11_revision('revOpen2', 31);
select pg_temp.r11_revision('revApproved', 32);
select pg_temp.r11_revision('revRejected', 33);
select pg_temp.r11_revision('revInvalid', 34);
select pg_temp.r11_revision('revLimit', 35);
select pg_temp.r11_revision('revLimit2', 36);

-- Reviews in every state, each on its own revision of entry A.
select pg_temp.h11r_review('r1');
select pg_temp.h11r_review('rOpen2', jsonb_build_object('revision_id', pg_temp.s11_id('revOpen2'), 'required_decision_count', 2));
select pg_temp.h11r_assign('rOpen2-asg', 'rOpen2', 'rvB');
select pg_temp.h11r_decide('rOpen2-dec', 'rOpen2', 'rvB', 'rOpen2-asg', 'approve');
select pg_temp.h11r_approved('rApproved', pg_temp.s11_id('revApproved'), pg_temp.s11_id('entryA'), 'rvB');
select pg_temp.h11r_review('rRejected', jsonb_build_object('revision_id', pg_temp.s11_id('revRejected')));
select pg_temp.h11r_assign('rRejected-asg', 'rRejected', 'rvB');
select pg_temp.h11r_decide('rRejected-dec', 'rRejected', 'rvB', 'rRejected-asg', 'reject');
select pg_temp.h11r_review('rInvalid', jsonb_build_object('revision_id', pg_temp.s11_id('revInvalid')));
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'dependency_changed', version = version + 1,
       updated_at = clock_timestamp()
 where id = pg_temp.s11_id('rInvalid');

select is(
  (select string_agg(id.key || '=' || review.state || '/' || review.version, ',' order by id.key)
     from (values ('r1'), ('rOpen2'), ('rApproved'), ('rRejected'), ('rInvalid')) as id(key)
     join platform_private.cms_editorial_reviews review on review.id = pg_temp.s11_id(id.key)),
  'r1=open/1,rApproved=approved/2,rInvalid=invalidated/2,rOpen2=open/2,rRejected=rejected/2',
  'control: the five review fixtures are open v1, open v2, approved, rejected and invalidated');

-- Capacity fixtures (built before the snapshot): rLimit holds sixteen unexpired assignments;
-- rLimit2 holds two EXPIRED rows (they end before the later rows start, so the insert guard does
-- not count them) and fifteen unexpired rows.
select pg_temp.h11r_review('rLimit', jsonb_build_object('revision_id', pg_temp.s11_id('revLimit')));
select pg_temp.h11r_assign('lim' || n, 'rLimit', 'reviewer' || lpad(n::text, 2, '0'),
  jsonb_build_object('starts_at', clock_timestamp() - interval '1 hour', 'ends_at', clock_timestamp() + interval '23 hours'))
from generate_series(1, 16) as n;
select pg_temp.h11r_review('rLimit2', jsonb_build_object('revision_id', pg_temp.s11_id('revLimit2')));
select pg_temp.h11r_assign('limx' || n, 'rLimit2', 'reviewer' || lpad(n::text, 2, '0'),
  jsonb_build_object('starts_at', clock_timestamp() - interval '3 hours', 'ends_at', clock_timestamp() - interval '2 hours'))
from generate_series(16, 17) as n;
select pg_temp.h11r_assign('limb' || n, 'rLimit2', 'reviewer' || lpad(n::text, 2, '0'),
  jsonb_build_object('starts_at', clock_timestamp() - interval '1 hour', 'ends_at', clock_timestamp() + interval '23 hours'))
from generate_series(1, 15) as n;
-- The assigned reviewer of r1 and the expired-but-active row of rvB on r1.
select pg_temp.h11r_assign('r1-rvA-asg', 'r1', 'rvA');
select pg_temp.h11r_assign('rvB-expired-active', 'r1', 'rvB');

insert into r11_snap(label, effects) values ('start', pg_temp.r11_effects());

-- ---------------------------------------------------------------------------
-- Concealment (404) and the owner gate (403).
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('h-stranger', 'stranger', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('h-stranger-own-party', 'stranger',
  pg_temp.r11_areq('r1', 'create', jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', true,
    (select party_id from platform_private.person_party where party_id = pg_temp.s11_id('stranger'))))), false);
select pg_temp.r11_acall('h-outsider', 'outsider', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('h-absent', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewId', extensions.gen_random_uuid())), false);
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text
     || ':' || min(pg_temp.r11_out(label))
     from (values ('h-stranger'), ('h-stranger-own-party'), ('h-outsider'), ('h-absent')) as v(label)),
  '1:P0001:NOT_FOUND',
  'a non-member, a member without any scope on the review, a caller acting in another party and an absent review are one indistinguishable NOT_FOUND [P2-S11-AC-069]');

select pg_temp.r11_acall('h-submitter', 'editor', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('h-publisher', 'pub', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('h-reviewer', 'rvA', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'))), false);
select pg_temp.r11_acall('h-submitter-revoke', 'editor', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('r1-rvA-asg'))), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'), ';' order by label)
     from (values ('h-submitter'), ('h-publisher'), ('h-reviewer'), ('h-submitter-revoke')) as v(label)),
  'h-publisher=P0001:capability_missing|null;h-reviewer=P0001:capability_missing|null;h-submitter=P0001:capability_missing|null;h-submitter-revoke=P0001:capability_missing|null',
  'a submitter, a publisher and an assigned reviewer can read the review but are not the receipt-derived owner: 403 capability_missing for create and revoke [P2-S11-AC-069]');

select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set active = false
      where organization_id = %L and person_id = %L and capability_code = 'cms.editor'$q$, pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select pg_temp.r11_acall('h-owner-no-editor', 'owner', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('h-owner-no-editor-revoke', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('r1-rvA-asg'))), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set active = true
      where organization_id = %L and person_id = %L and capability_code = 'cms.editor'$q$, pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select is(pg_temp.r11_out('h-owner-no-editor') || '|' || pg_temp.r11_out('h-owner-no-editor-revoke'),
  'P0001:capability_missing|00000:',
  'an owner without a valid cms.editor grant is refused a create (no grantor authority end) but may still revoke [P2-S11-AC-069]');

-- ---------------------------------------------------------------------------
-- Review state and the CAS operand.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('s-approved', 'owner', pg_temp.r11_areq('rApproved', 'create'), false);
select pg_temp.r11_acall('s-rejected', 'owner', pg_temp.r11_areq('rRejected', 'create'), false);
select pg_temp.r11_acall('s-invalid', 'owner', pg_temp.r11_areq('rInvalid', 'create'), false);
select pg_temp.r11_acall('s-approved-revoke', 'owner', pg_temp.r11_areq('rApproved', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('rApproved-asg'))), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('s-approved'), ('s-rejected'), ('s-invalid'), ('s-approved-revoke')) as v(label)),
  's-approved=P0001:review_not_open;s-approved-revoke=P0001:review_not_open;s-invalid=P0001:review_not_open;s-rejected=P0001:review_not_open',
  'an approved, rejected or invalidated review accepts no assignment change: review_not_open [P2-S11-AC-071]');
select pg_temp.r11_acall('s-stale', 'owner', pg_temp.r11_areq('rOpen2', 'create',
  jsonb_build_object('expectedVersion', '1', 'ifMatch', '1')), false);
select ok(pg_temp.r11_out('s-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('s-stale')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb,
  'a stale review version is VERSION_MISMATCH carrying the expected and current versions [P2-S11-AC-071]');
select pg_temp.r11_acall('s-ifmatch', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('ifMatch', '2')), false);
select pg_temp.r11_acall('s-version-text', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('expectedVersion', 'one')), false);
select pg_temp.r11_acall('s-version-zero', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('ifMatch', '0')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('s-ifmatch'), ('s-version-text'), ('s-version-zero')) as v(label)),
  's-ifmatch=P0001:INVALID_REQUEST;s-version-text=P0001:VALIDATION_FAILED["/expectedVersion"];s-version-zero=P0001:VALIDATION_FAILED["/ifMatch"]',
  'If-Match must equal expectedVersion (INVALID_REQUEST) and both must be positive decimals (VALIDATION_FAILED at the member) [P2-S11-AC-068]');

-- ---------------------------------------------------------------------------
-- Reviewer eligibility: one uniform 409, never an existence or role signal.
-- ---------------------------------------------------------------------------
update auth.users set banned_until = clock_timestamp() + interval '1 day'
 where id = (select auth_user_id from r11_actor where key = 'rvX');
select pg_temp.r11_acall('e-absent', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', extensions.gen_random_uuid())), false);
select pg_temp.r11_acall('e-stranger', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('stranger'))), false);
select pg_temp.r11_acall('e-no-grant', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('outsider'))), false);
select pg_temp.r11_acall('e-submitter', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('editor'))), false);
select pg_temp.r11_acall('e-author', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('creator'))), false);
select pg_temp.r11_acall('e-banned', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvX'))), false);
select pg_temp.r11_acall('e-shadow', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('reviewer05'))), false);
select pg_temp.r11_acall('e-publisher-only', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('pub'))), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvB')));
select pg_temp.r11_acall('e-lapsed', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvB'))), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_from = current_date, valid_through = null
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvB')));
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set active = false
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
select pg_temp.r11_acall('e-deactivated', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'))), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set active = true
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$,
  pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
select pg_temp.h11_raw_exec('identity_private.membership_tenure', format(
  $q$update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
      where organization_id = %L and person_id = %L$q$, pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
select pg_temp.r11_acall('e-ended-tenure', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'))), false);
select pg_temp.h11_raw_exec('identity_private.membership_tenure', format(
  $q$update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, ends_on = null
      where organization_id = %L and person_id = %L$q$, pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
select is(
  (select count(distinct pg_temp.r11_out(label) || '|' || coalesce(pg_temp.r11_detail(label), 'null'))::text
     || ':' || min(pg_temp.r11_out(label)) || ':' || count(*)::text
     from (values ('e-absent'), ('e-stranger'), ('e-no-grant'), ('e-submitter'), ('e-author'), ('e-banned'),
                  ('e-shadow'), ('e-publisher-only'), ('e-lapsed'), ('e-deactivated'), ('e-ended-tenure')) as v(label)),
  '1:P0001:reviewer_not_eligible:11',
  'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]');
select pg_temp.r11_acall('e-control', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'))), false);
select is(pg_temp.r11_out('e-control'), '00000:',
  'control: the same request for an eligible reviewer succeeds (so the eleven refusals are about the reviewer) [P2-S11-AC-069]');

-- ---------------------------------------------------------------------------
-- Duplicate and capacity.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('d-exists', 'owner', pg_temp.r11_areq('r1', 'create'), false);
select pg_temp.r11_acall('d-exists-expired', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvB'))), false);
select is(pg_temp.r11_out('d-exists') || '|' || pg_temp.r11_out('d-exists-expired'),
  'P0001:assignment_exists|P0001:assignment_exists',
  'a second assignment of a reviewer who holds an active row is assignment_exists, even when that row is expired but not revoked [P2-S11-AC-071]');

select pg_temp.r11_acall('l-full', 'owner', pg_temp.r11_areq('rLimit', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvA'))), false);
select is(pg_temp.r11_out('l-full'), 'P0001:assignment_limit',
  'the seventeenth active assignment of a review is assignment_limit [P2-S11-AC-071]');
select pg_temp.r11_acall('l-expired-free', 'owner', pg_temp.r11_areq('rLimit2', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvA'))), false);
select is(pg_temp.r11_out('l-expired-free'), '00000:',
  'expired assignments are inert: fifteen unexpired plus two expired rows leave room for a sixteenth [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- Expiry bounds (422 expiry_out_of_bounds at /expiresAt).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.r11_iso(p_at timestamptz) returns text language sql immutable as $body$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $body$;
select pg_temp.r11_acall('x-past', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'expiresAt', pg_temp.r11_iso(clock_timestamp() - interval '1 minute'))), false);
select pg_temp.r11_acall('x-now', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'expiresAt', pg_temp.r11_iso(clock_timestamp()))), false);
-- Grantor bound: the end of the owner's cms.editor grant day (S10 fixture: valid_through = today + 1).
select pg_temp.r11_acall('x-grantor-over', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'expiresAt', pg_temp.r11_iso(((current_date + 2)::timestamp at time zone 'UTC') + interval '1 second'))), false);
select pg_temp.r11_acall('x-grantor-edge', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'expiresAt', pg_temp.r11_iso((current_date + 2)::timestamp at time zone 'UTC'))), false);
-- Reviewer bound: the end of the reviewer's cms.reviewer grant day.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_through = current_date
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$, pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
select pg_temp.r11_acall('x-reviewer-over', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'expiresAt', pg_temp.r11_iso(((current_date + 1)::timestamp at time zone 'UTC') + interval '1 second'))), false);
select pg_temp.r11_acall('x-reviewer-edge', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'),
    'expiresAt', pg_temp.r11_iso((current_date + 1)::timestamp at time zone 'UTC'))), false);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_through = null
      where organization_id = %L and person_id = %L and capability_code = 'cms.reviewer'$q$, pg_temp.s11_id('org'), pg_temp.s11_id('rvS')));
-- Seven-day bound: with an open-ended owner grant only the 7-day ceiling binds.
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant', format(
  $q$update identity_private.organization_actor_grant set valid_through = null
      where organization_id = %L and person_id = %L and capability_code = 'cms.editor'$q$, pg_temp.s11_id('org'), pg_temp.s11_id('creator')));
select pg_temp.r11_acall('x-seven-over', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'expiresAt', pg_temp.r11_iso(clock_timestamp() + interval '7 days 2 minutes'))), false);
select pg_temp.r11_acall('x-seven-ok', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('reviewerPersonId', pg_temp.s11_id('rvS'), 'expiresAt', pg_temp.r11_iso(clock_timestamp() + interval '6 days 23 hours'))), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('x-past'), ('x-now'), ('x-grantor-over'), ('x-grantor-edge'), ('x-reviewer-over'),
                  ('x-reviewer-edge'), ('x-seven-over'), ('x-seven-ok')) as v(label)),
  'x-grantor-edge=00000:;x-grantor-over=P0001:expiry_out_of_bounds["/expiresAt"];x-now=P0001:expiry_out_of_bounds["/expiresAt"];x-past=P0001:expiry_out_of_bounds["/expiresAt"];x-reviewer-edge=00000:;x-reviewer-over=P0001:expiry_out_of_bounds["/expiresAt"];x-seven-ok=00000:;x-seven-over=P0001:expiry_out_of_bounds["/expiresAt"]',
  'the expiry must be after now, within seven days, and not after the reviewer grant day end or the owner cms.editor grant day end (the end itself is allowed) [P2-S11-AC-068]');

-- ---------------------------------------------------------------------------
-- Malformed requests (before any lookup).
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('m-unknown-key', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('ownerId', pg_temp.s11_id('org'))), false);
select pg_temp.r11_acall('m-no-reviewer', 'owner', pg_temp.r11_areq('r1', 'create', '{}'::jsonb, array['reviewerPersonId']), false);
select pg_temp.r11_acall('m-no-expiry', 'owner', pg_temp.r11_areq('r1', 'create', '{}'::jsonb, array['expiresAt']), false);
select pg_temp.r11_acall('m-revoke-with-create-fields', 'owner', pg_temp.r11_areq('r1', 'revoke',
  jsonb_build_object('assignmentId', pg_temp.s11_id('r1-rvA-asg'), 'reviewerPersonId', pg_temp.s11_id('rvA'))), false);
select pg_temp.r11_acall('m-bad-action', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('action', 'extend')), false);
select pg_temp.r11_acall('m-bad-review', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('reviewId', 'not-a-uuid')), false);
select pg_temp.r11_acall('m-no-key', 'owner', pg_temp.r11_areq('r1', 'create', '{}'::jsonb, array['idempotencyKey']), false);
select pg_temp.r11_acall('m-short-key', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('idempotencyKey', 'short')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ';' order by label)
     from (values ('m-unknown-key'), ('m-no-reviewer'), ('m-no-expiry'), ('m-revoke-with-create-fields'),
                  ('m-bad-action'), ('m-bad-review'), ('m-no-key'), ('m-short-key')) as v(label)),
  'm-bad-action=P0001:INVALID_REQUEST;m-bad-review=P0001:INVALID_REQUEST;m-no-expiry=P0001:INVALID_REQUEST;m-no-key=P0001:INVALID_REQUEST;m-no-reviewer=P0001:INVALID_REQUEST;m-revoke-with-create-fields=P0001:INVALID_REQUEST;m-short-key=P0001:INVALID_REQUEST;m-unknown-key=P0001:INVALID_REQUEST',
  'an unknown key (a caller-supplied owner), a missing member, the other action''s members, an unknown action, a malformed review id and a missing or short idempotency key are INVALID_REQUEST [P2-S11-AC-068]');
select pg_temp.r11_acall('m-reviewer-uuid', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('reviewerPersonId', 'nobody')), false);
select pg_temp.r11_acall('m-expiry-text', 'owner', pg_temp.r11_areq('r1', 'create', jsonb_build_object('expiresAt', 'tomorrow')), false);
select pg_temp.r11_acall('m-expiry-no-offset', 'owner', pg_temp.r11_areq('r1', 'create',
  jsonb_build_object('expiresAt', to_char(clock_timestamp() + interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS'))), false);
select pg_temp.r11_acall('m-assignment-uuid', 'owner', pg_temp.r11_areq('r1', 'revoke', jsonb_build_object('assignmentId', '42')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('m-reviewer-uuid'), ('m-expiry-text'), ('m-expiry-no-offset'), ('m-assignment-uuid')) as v(label)),
  'm-assignment-uuid=P0001:VALIDATION_FAILED["/assignmentId"];m-expiry-no-offset=P0001:VALIDATION_FAILED["/expiresAt"];m-expiry-text=P0001:VALIDATION_FAILED["/expiresAt"];m-reviewer-uuid=P0001:VALIDATION_FAILED["/reviewerPersonId"]',
  'a non-UUID reviewer or assignment id and an expiry that is not an offset ISO instant are VALIDATION_FAILED at their member pointer [P2-S11-AC-068]');

-- ---------------------------------------------------------------------------
-- No partial effects.
-- ---------------------------------------------------------------------------
select is(pg_temp.r11_effects(), (select effects from r11_snap where label = 'start'),
  'every refusal above left no assignment, review change, reservation, audit record or outbox event behind [P2-S11-AC-071]');

select * from finish();
rollback;
