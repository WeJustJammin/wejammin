-- Slice 12 lane governed-a, CMS-03C-08 (BE03c Route Registry, Registry invariants, Governed review machinery,
-- Per-operation authorization matrix, Slice 12 lock order; tracker P2-S12-AC-076 .. AC-080).  The receipt-derived
-- owner creates or revokes a bounded read+decide reviewer assignment on one open governed review through the real
-- platform_api.cms_assign_governed_reviewer command, called under the real service_role.
--
-- Real fixtures only: S09 owner initialization, real CMS-03A-15 grants and CMS-03A-16/17 renewals/revocations,
-- real active content types (governed_submit/005), real CMS-03C-01 templates and real CMS-03C-06 submissions.
-- The only labelled provisioning forgery is the S09 membership tenure (no command confirms an ungoverned
-- membership); no governed row is ever inserted by hand.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(68);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_assignment/010-setup.sqlinc
\ir phase_02_slice_12_governed_assignment/020-create.sqlinc
\ir phase_02_slice_12_governed_assignment/030-refusals.sqlinc
\ir phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc
\ir phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc

select finish();
rollback;
