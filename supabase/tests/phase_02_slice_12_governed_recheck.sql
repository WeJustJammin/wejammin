-- Slice 12 lane governed-recheck, P2-S12-AC-202 / AC-203 / AC-204 (BE03c "Governed review machinery" Invalidation,
-- "Reviewer-authority invalidation on revocation (DEC-180, G6)", "Job transport (DEC-166, DEC-180 G9)", "Slice 12 lock order"
-- (row `cms_recheck_governed_reviews`); BE03b "Review invalidation").  The recheck RPC platform_api.cms_recheck_governed_reviews (the database
-- half of the typed platform-queue job cms.governed_review.recheck) and the person invalidation
-- platform_private.cms_invalidate_governed_reviews_for_person that the capability revocation AND the membership tenure end run in their own
-- transaction.
--
-- Real fixtures only: S09 owner initialization, real CMS-03A-15 grants, renewals and CMS-03A-17 revocation, real active content types,
-- real CMS-03C-01 templates, real CMS-03C-06 submissions, real CMS-03C-08 assignments, real CMS-03C-07 approvals, real CMS-03C-09
-- scheduling and a real DEC-108 successor activation for the changed dependency.  The labelled fixtures besides the S09 membership tenure:
--   * the LAG fixture (002-lapse-helpers): the test-admin guards the one function every recount reads the standing authority through
--     (cms_person_holds_capability) so a named grant reads as ended, the one loss of a counted approver no trigger covers (a grant whose
--     term passes by the calendar), and restores it byte for byte; no row is written to make it lapse (030, 040, 070, and the
--     governed-activation, governed-decision, governed-schedule and dec191 drivers);
--   * tenure writes (080): ending, deleting and touching an ungoverned tenure, which no command does;
--   * two function-level faults (070): the test-admin guards ONE private function and restores it byte for byte.
-- No governed row is inserted by hand and no trigger is disabled.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_recheck/005-helpers.sqlinc
\ir phase_02_slice_12_governed_recheck/010-setup.sqlinc
\ir phase_02_slice_12_governed_recheck/020-contract.sqlinc
\ir phase_02_slice_12_governed_recheck/025-lapse-fixture.sqlinc
\ir phase_02_slice_12_governed_recheck/030-person.sqlinc
\ir phase_02_slice_12_governed_recheck/040-recheck.sqlinc
\ir phase_02_slice_12_governed_recheck/050-block.sqlinc
\ir phase_02_slice_12_governed_recheck/060-resolver.sqlinc
\ir phase_02_slice_12_governed_recheck/070-isolation.sqlinc
\ir phase_02_slice_12_governed_recheck/075-digest-locks.sqlinc
\ir phase_02_slice_12_governed_recheck/078-person-live.sqlinc
\ir phase_02_slice_12_governed_recheck/080-tenure.sqlinc
\ir phase_02_slice_12_governed_recheck/085-real-reader.sqlinc
\ir phase_02_slice_12_governed_recheck/090-rpc-context.sqlinc


select * from finish();
rollback;
