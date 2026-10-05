\ir support/jwt-claims.sqlinc
commit;
create extension if not exists dblink with schema extensions;
create extension if not exists pgtap with schema extensions;
create temp table s09_release_lock_probe(on_commit boolean) on commit preserve rows;
create temp table s09_activation_lock_probe(busy boolean, drained boolean) on commit preserve rows;
\ir phase_02_slice_09_schema/000-release-lock.sqlinc
\ir phase_02_slice_09_schema/000b-activation-lock.sqlinc
commit;

begin;

select no_plan();

select ok(
  (select busy and drained from s09_activation_lock_probe limit 1),
  'P2-S09 activation lock probe completed with an ordered two-context hand-off'
);

-- Slice 09 QA-RED.  The assertions mirror BE03a's eleven canonical private
-- tables and eight named RPCs.  This file is deliberately written before the
-- authority migration so an absent migration produces an evidence-backed RED.

\ir phase_02_slice_09_schema/001-contract.sqlinc
\ir phase_02_slice_09_schema/001-fixture-bootstrap.sqlinc
\ir phase_02_slice_09_schema/002-fixtures-and-mutations.sqlinc
\ir phase_02_slice_09_schema/002b-activation-fixture.sqlinc
\ir phase_02_slice_09_schema/003-authorization-and-projections.sqlinc
\ir phase_02_slice_09_schema/003b-block-release.sqlinc
\ir phase_02_slice_09_schema/003c-block-release-boundaries.sqlinc
\ir phase_02_slice_09_schema/004-registries-and-rollback.sqlinc
\ir phase_02_slice_09_schema/005-migration-worker.sqlinc
\ir phase_02_slice_09_schema/005b-worker-activation.sqlinc
\ir phase_02_slice_09_schema/005e-worker-dead-letter-identity.sqlinc
\ir phase_02_slice_09_schema/005f-worker-event-claim-lease.sqlinc
\ir phase_02_slice_09_schema/005c-worker-nonzero.sqlinc
\ir phase_02_slice_09_schema/005d-worker-breaking.sqlinc
\ir phase_02_slice_09_schema/006-rollback-fencing.sqlinc
\ir phase_02_slice_09_schema/007-activation-gates.sqlinc
\ir phase_02_slice_09_schema/008-activation-remediation.sqlinc
\ir phase_02_slice_09_schema/008b-activation-move-invalidation.sqlinc
\ir phase_02_slice_09_schema/009-recovery-acceptance.sqlinc
\ir phase_02_slice_09_schema/009b-recovery-activation.sqlinc
\ir phase_02_slice_09_schema/010-operational-alerts.sqlinc
\ir phase_02_slice_09_schema/010b-provider-message-boundaries.sqlinc
\ir phase_02_slice_09_schema/011-constraint-probes.sqlinc
\ir phase_02_slice_09_schema/012-trigger-catalog.sqlinc

select finish();

rollback;
