-- Slice 12 lane dec191, DEC-191 (orchestrator resolution, 2026-10-15; BE03c schema blocks and changelog row "FE03-BE03c read gap"; FE03 :882, :1118):
--   CMS-03C-09  GovernedActivationResource.supersededVersion  the definition version of the lineage's previously active version that a committed
--               immediate `activate` superseded; null for `schedule`, `retire` and a lineage's first activation (020 templates, 030 taxonomy;
--               patterns in phase_02_slice_12_dec191_pattern.sql).
--   CMS-03C-10  GovernedReviewDetailResource.activationSchedule  the review's most recent cms_governed_activation_schedules row as
--               { state, reasonCode } or null; reasonCode non-null exactly when state is blocked or cancelled (040).
-- No new state, vocabulary, authority, lock or write path.  Real fixtures only: S09 owner initialization, real grants and revocations, real approved
-- governed reviews, schedules accepted by the real CMS-03C-09 producer and executed by the real CMS-03C-19 commands after a REAL wait (about 90 s),
-- a real DEC-108 successor activation.  No governed row is inserted by hand and no trigger is disabled; the only function-level fault is the labelled
-- negative policy-evidence fault of the schedule suite (a retryable failure).

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(53);

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
\ir phase_02_slice_12_dec191/000-helpers.sqlinc
\ir phase_02_slice_12_dec191/010-setup.sqlinc
\ir phase_02_slice_12_dec191/020-activation.sqlinc
\ir phase_02_slice_12_dec191/030-taxonomy.sqlinc
\ir phase_02_slice_12_dec191/040-detail.sqlinc
\ir phase_02_slice_12_dec191/050-structure.sqlinc


select * from finish();
rollback;
