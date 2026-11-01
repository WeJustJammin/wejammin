-- Slice 12 lane governed-b, CMS-03C-19 (BE03c Internal service operations, Governed activation, retirement and scheduled activation
-- (DEC-113, OD-6), Scheduled activation; tracker P2-S12-AC-142 .. AC-152).  The Worker `scheduled` sweep claims due governed activation
-- schedules and executes them through the real platform_api.cms_claim_due_governed_activations / cms_execute_governed_activation
-- commands, called under the real service_role.
--
-- Real fixtures only: S09 owner initialization, real grants and revocation, real approved governed reviews, schedules accepted by the real
-- CMS-03C-09 producer at least 62 s ahead, a real DEC-108 successor activation.  The suite REALLY WAITS for the schedules to fall due
-- (about 100 s): no clock is forged and no trigger is disabled.  The 15 s / 60 s / 300 s ladder past its first step and the lease expiry
-- (300 s) live in phase_02_slice_12_governed_schedule_ladder.sql.  The only function-level fault is the labelled negative policy-evidence
-- fault of 040-retry.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(56);

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/005-lineage-helpers.sqlinc
\ir phase_02_slice_12_governed_schedule/010-setup.sqlinc
\ir phase_02_slice_12_governed_schedule/020-claim.sqlinc
\ir phase_02_slice_12_governed_schedule/030-execute.sqlinc
\ir phase_02_slice_12_governed_schedule/040-retry.sqlinc
\ir phase_02_slice_12_governed_schedule/050-blocked.sqlinc
\ir phase_02_slice_12_governed_schedule/055-fire-approval.sqlinc
\ir phase_02_slice_12_governed_schedule/060-privileges.sqlinc


select finish();
rollback;
