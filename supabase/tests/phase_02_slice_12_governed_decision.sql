-- Slice 12 lane governed-a, CMS-03C-07 (BE03c Route Registry, Registry invariants, Governed review machinery, Governed
-- policy basis, Slice 12 lock order, Per-operation authorization matrix; tracker P2-S12-AC-070 .. AC-075).  An assigned
-- reviewer records one approve or reject on an open governed review through the real
-- platform_api.cms_record_governed_decision command, called under the real service_role.
--
-- Real fixtures only: S09 owner initialization, real CMS-03A-15 grants and CMS-03A-17 revocation, real active content types
-- (one protected, one ordinary: governed_submit/005), real CMS-03C-01 templates, real CMS-03C-06 submissions, real
-- CMS-03C-08 assignments and a real DEC-108 successor activation for the changed dependency.  The only labelled
-- provisioning forgery is the S09 membership tenure; no governed row is ever inserted by hand.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(58);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_decision/010-setup.sqlinc
\ir phase_02_slice_12_governed_decision/020-gates.sqlinc
\ir phase_02_slice_12_governed_decision/030-happy.sqlinc
\ir phase_02_slice_12_governed_decision/040-flows.sqlinc
\ir phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc


select finish();
rollback;
