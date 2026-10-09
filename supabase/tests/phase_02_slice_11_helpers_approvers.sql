-- Slice 11 shared helpers: platform_private.cms_editorial_review_qualifying_decisions
-- and cms_editorial_review_distinct_approvals (BE03b "Qualifying approvers",
-- DEC-136; tracker P2-S11-AC-110).  RED before 20261005017530, GREEN after.
--
-- A recorded approve COUNTS while its human holds the standing capability of the
-- slot the decision satisfied (in the review's owner party) and the human's
-- assignment is not revoked.  Assignment expiry after the decision does not
-- unwind it (the window bounds the act of deciding); the lapse of the standing
-- grant (its valid_through day passing), its revocation or the end of the tenure
-- does.  A reject never counts.  distinctApprovalCount is the live recount.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(28);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

create or replace function pg_temp.h11_q(p_review text)
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select coalesce(string_agg(q.reviewer_person_id::text || '':'' || q.capability, '','' order by decided.decided_at, q.decision_id), '''') from platform_private.cms_editorial_review_qualifying_decisions(%L::uuid) q join platform_private.cms_editorial_decisions decided on decided.id = q.decision_id',
    pg_temp.s11_id(p_review)))
$body$;

create or replace function pg_temp.h11_n(p_review text)
returns text
language sql
as $body$
  select pg_temp.h11_text(format(
    'select platform_private.cms_editorial_review_distinct_approvals(%L::uuid)', pg_temp.s11_id(p_review)))
$body$;

-- Fixture: protected review `prot` (two decisions, specialist slot cms.reviewer.policy);
-- reviewer01 holds cms.reviewer, reviewer02 holds cms.reviewer and cms.reviewer.policy.
select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer02', array['cms.reviewer', 'cms.reviewer.policy']);
select pg_temp.h11r_member('reviewer03', array['cms.reviewer']);

select pg_temp.h11r_review('prot', jsonb_build_object(
  'revision_id', pg_temp.s11_id('revA2'), 'risk_class', 'protected', 'required_decision_count', 2,
  'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')));
select pg_temp.h11r_assign('asg1', 'prot', 'reviewer01');
select pg_temp.h11r_assign('asg2', 'prot', 'reviewer02');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_editorial_review_qualifying_decisions(uuid)')
    and pg_temp.h11_private_definer('cms_editorial_review_distinct_approvals(uuid)'),
  'both approver helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-110]'
);
select ok(
  pg_temp.h11_volatility('cms_editorial_review_qualifying_decisions(uuid)') = 's'
    and pg_temp.h11_volatility('cms_editorial_review_distinct_approvals(uuid)') = 's',
  'both approver helpers are STABLE reads [P2-S11-AC-110]'
);
select is(pg_temp.h11_rettype('cms_editorial_review_distinct_approvals(uuid)'), 'integer',
  'distinct approvals is an integer [P2-S11-AC-110]');
select is(pg_temp.h11_rettype('cms_editorial_review_qualifying_decisions(uuid)'),
  'TABLE(decision_id uuid, reviewer_person_id uuid, capability text, assignment_id uuid)',
  'the qualifying set has the frozen four columns [P2-S11-AC-110]');

-- ---------------------------------------------------------------------------
-- Empty and absent.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11_q('prot'), '', 'a review with no decision has no qualifying approver [P2-S11-AC-110]');
select is(pg_temp.h11_n('prot'), '0', 'a review with no decision has zero distinct approvals [P2-S11-AC-110]');
select is(
  pg_temp.h11_text('select count(*) from platform_private.cms_editorial_review_qualifying_decisions(null::uuid)'),
  '0', 'a null review id has no qualifying approver [P2-S11-AC-110]');
select is(pg_temp.h11_text(format(
    'select platform_private.cms_editorial_review_distinct_approvals(%L::uuid)', 'a9200000-0000-4000-8000-0000000000ee'::uuid)),
  '0', 'an absent review has zero distinct approvals [P2-S11-AC-110]');

-- ---------------------------------------------------------------------------
-- Approvals.
-- ---------------------------------------------------------------------------
select pg_temp.h11r_decide('d1', 'prot', 'reviewer01', 'asg1', 'approve', 'cms.reviewer');
select is(pg_temp.h11_n('prot'), '1', 'one recorded approve by a holder of the slot capability counts [P2-S11-AC-110]');
select is(pg_temp.h11_q('prot'), pg_temp.s11_id('reviewer01')::text || ':cms.reviewer',
  'the qualifying set names the reviewer and the satisfied slot, never the reason or the owner [P2-S11-AC-110]');
select pg_temp.h11r_decide('d2', 'prot', 'reviewer02', 'asg2', 'approve', 'cms.reviewer.policy');
select is(pg_temp.h11_n('prot'), '2', 'the specialist approve brings the live recount to two [P2-S11-AC-110]');
select is(
  pg_temp.h11_text(format('select count(*) from platform_private.cms_editorial_review_qualifying_decisions(%L::uuid) where assignment_id in (%L::uuid, %L::uuid)',
    pg_temp.s11_id('prot'), pg_temp.s11_id('asg1'), pg_temp.s11_id('asg2'))),
  '2', 'each qualifying row carries the assignment that authorized it [P2-S11-AC-110]');
select is((select state from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('prot')), 'approved',
  'control: the review reached approved through the recorded decisions [P2-S11-AC-110]');

-- Assignment expiry after the decision does not unwind it: the fixture windows ended on 2026-10-02.
select ok(
  (select ends_at < clock_timestamp() from platform_private.cms_editorial_review_assignments where id = pg_temp.s11_id('asg1')),
  'control: the assignment window already ended and the approve still counts (expiry does not unwind a decision) [P2-S11-AC-110]');

-- ---------------------------------------------------------------------------
-- Loss of the qualification unwinds the count.
-- ---------------------------------------------------------------------------
update identity_private.organization_actor_grant
   set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer02')
   and capability_code = 'cms.reviewer.policy';
select is(pg_temp.h11_n('prot'), '1', 'losing the specialist slot capability unwinds that approve [P2-S11-AC-110]');
update identity_private.organization_actor_grant
   set active = true
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer02')
   and capability_code = 'cms.reviewer.policy';
select is(pg_temp.h11_n('prot'), '2', 'control: the capability back restores the count (the decision row never moved) [P2-S11-AC-110]');

update identity_private.organization_actor_grant
   set valid_from = current_date - 5, valid_through = current_date - 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer01')
   and capability_code = 'cms.reviewer';
select is(pg_temp.h11_n('prot'), '1', 'a lapsed standing grant (valid_through passed) unwinds the approve [P2-S11-AC-110]');
update identity_private.organization_actor_grant
   set valid_from = current_date, valid_through = null
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer01')
   and capability_code = 'cms.reviewer';

update identity_private.membership_tenure
   set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer02');
select is(pg_temp.h11_n('prot'), '1', 'an ended tenure unwinds the approve even though the grant row is intact [P2-S11-AC-110]');
update identity_private.membership_tenure
   set state = 'confirmed', revoked_at = null, ends_on = null
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer02');

-- The slot the decision SATISFIED is the one that must still be held: reviewer01
-- holds only the base slot, so an approve recorded for the specialist slot does not count.
select pg_temp.h11r_review('wrongslot', jsonb_build_object(
  'revision_id', pg_temp.s11_id('revB1'), 'entry_id', pg_temp.s11_id('entryB'),
  'risk_class', 'protected', 'required_decision_count', 2,
  'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')));
select pg_temp.h11r_assign('asg3', 'wrongslot', 'reviewer01');
select pg_temp.h11r_decide('d3', 'wrongslot', 'reviewer01', 'asg3', 'approve', 'cms.reviewer.policy');
select is(pg_temp.h11_n('wrongslot'), '0',
  'an approve recorded for a slot capability the reviewer does not hold does not count [P2-S11-AC-110]');

-- Revoking the assignment unwinds the approve.
update platform_private.cms_editorial_review_assignments
   set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('asg2');
select is(pg_temp.h11_n('prot'), '1', 'a revoked assignment unwinds its approve at the next recount [P2-S11-AC-110]');
select is(pg_temp.h11_q('prot'), pg_temp.s11_id('reviewer01')::text || ':cms.reviewer',
  'only the reviewer with the live assignment remains in the qualifying set [P2-S11-AC-110]');

-- A reject never counts.
select pg_temp.h11r_review('rejected', jsonb_build_object(
  'revision_id', pg_temp.s11_id('revA1'),
  'submitted_by', pg_temp.s11_id('editor')));
select pg_temp.h11r_assign('asg4', 'rejected', 'reviewer03');
select pg_temp.h11r_decide('d4', 'rejected', 'reviewer03', 'asg4', 'reject', 'cms.reviewer');
select is(pg_temp.h11_n('rejected'), '0', 'a reject decision is never a qualifying approver [P2-S11-AC-110]');
select is((select state from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rejected')), 'rejected',
  'control: the review is rejected and its reject row exists but does not count [P2-S11-AC-110]');

select * from finish();
rollback;
