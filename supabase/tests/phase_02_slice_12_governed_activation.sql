-- Slice 12 lane governed-b, CMS-03C-09 (BE03c Route Registry 171, Registry invariants, Governed activation, retirement and scheduled
-- activation (DEC-113, OD-6), Slice 12 lock order, Event schemas; tracker P2-S12-AC-082 .. AC-087, AC-142 .. AC-145).  The subject
-- owner switches an approved governed review's subject to active (200), or accepts a scheduled activation (202), through the real
-- platform_api.cms_activate_governed_subject command, called under the real service_role.  `retire` (DEC-190) removes the exposure of an
-- ACTIVE version with no fresh approval and no dependency, policy or preflight validity (095).
--
-- Real fixtures only: S09 owner initialization, real CMS-03A-15 grants and CMS-03A-17 revocation, real active content types (one
-- protected, one ordinary: governed_submit/005), real CMS-03C-01 templates, real CMS-03C-06 submissions, real CMS-03C-08 assignments,
-- real CMS-03C-07 approvals and a real DEC-108 successor activation for the changed dependency.  The only labelled provisioning
-- forgery is the S09 membership tenure; no governed row is ever inserted by hand and no trigger is disabled.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(124);

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
\ir phase_02_slice_12_governed_activation/010-setup.sqlinc
\ir phase_02_slice_12_governed_activation/020-gates.sqlinc
\ir phase_02_slice_12_governed_activation/030-activate.sqlinc
\ir phase_02_slice_12_governed_activation/040-supersession.sqlinc
\ir phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc
\ir phase_02_slice_12_governed_activation/060-invalidation.sqlinc
\ir phase_02_slice_12_governed_activation/080-taxonomy.sqlinc
\ir phase_02_slice_12_governed_activation/090-lineage-lock.sqlinc
\ir phase_02_slice_12_governed_activation/095-retire.sqlinc
\ir phase_02_slice_12_governed_activation/070-privileges.sqlinc


select finish();
rollback;
