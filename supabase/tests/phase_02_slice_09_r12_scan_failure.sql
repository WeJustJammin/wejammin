\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R12 (AC641): a dry-run attempt whose scan cannot be sealed ends in the
-- unsealed `failed` state with a safe failure code, produced by the worker's own
-- failure call (cms_rollback_schema_migration on a plan that is still dry_running)
-- and read back through the CMS-03A-07 activationPreparation.dryRunRef projection.
-- No trigger is disabled and no report row is written by hand.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc

create or replace function pg_temp.s09r_report(p_tag text, p_attempt integer, p_col text) returns text language plpgsql stable as $body$
declare result text;
begin
  execute format('select %I::text from platform_private.cms_schema_dry_run_reports where target_version_id = $1 and attempt_no = $2', p_col)
    into result using pg_temp.s09d_id(p_tag || ':version'), p_attempt;
  return result;
end;
$body$;
create or replace function pg_temp.s09r_plan(p_tag text, p_col text) returns text language plpgsql stable as $body$
declare result text;
begin
  execute format('select %I::text from platform_private.cms_schema_migration_plans where id = $1', p_col) into result using pg_temp.s09d_id(p_tag || ':plan');
  return result;
end;
$body$;

select pg_temp.s09d_create_type('a', 'r12scan_a');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select is(pg_temp.s09d_outcome('b:dryRun'), 'OK', 'fixture: the CMS-03A-10 command queued attempt 1');
select pg_temp.s09w_claim('b');
select is(pg_temp.s09r_plan('b', 'state'), 'dry_running', 'fixture: the worker claimed the lease and the plan is dry_running');
select is(pg_temp.s09r_report('b', 1, 'state'), 'running', 'fixture: the attempt is running');

-- Refusals first: nothing changes.
create temp table s09r_before on commit drop as select pg_temp.s09d_fingerprint(false) as fp, pg_temp.s09r_plan('b', 'version') as plan_version;
select pg_temp.s09w_rollback('b', 'a', true, 'b:fail:retryable', 'SCAN_ABORTED');
select is(pg_temp.s09d_outcome('b:fail:retryable'), 'CONFLICT',
  'a retryable failure of a dry-running scan is refused: retry belongs to the queue, the attempt stays running [P2-S09-AC-641]');
select pg_temp.s09w_rollback('b', 'a', false, 'b:fail:code', 'scan.aborted');
select is(pg_temp.s09d_outcome('b:fail:code'), 'INVALID_REQUEST',
  'a failure code outside ^[A-Z][A-Z0-9_]{0,63}$ is refused [P2-S09-AC-641]');
select pg_temp.s09w_rollback('b', 'a', false, 'b:fail:long', repeat('A', 65));
select is(pg_temp.s09d_outcome('b:fail:long'), 'INVALID_REQUEST', 'a 65-character failure code is refused [P2-S09-AC-641]');
select ok(pg_temp.s09d_fingerprint(false) = (select fp from s09r_before)
    and pg_temp.s09r_plan('b', 'version') = (select plan_version from s09r_before)
    and pg_temp.s09r_report('b', 1, 'state') = 'running',
  'every refusal left the plan, the attempt and every other row unchanged [P2-S09-AC-641]');

-- The failure itself.
select pg_temp.s09w_rollback('b', 'a', false, 'b:fail', 'SCAN_ABORTED');
select is(pg_temp.s09d_outcome('b:fail'), 'OK', 'the worker failure call on a dry-running plan is accepted [P2-S09-AC-641]');
select ok(pg_temp.s09r_report('b', 1, 'state') = 'failed' and pg_temp.s09r_report('b', 1, 'failure_code') = 'SCAN_ABORTED'
    and pg_temp.s09r_report('b', 1, 'sealed_at') is null and pg_temp.s09r_report('b', 1, 'result') is null
    and pg_temp.s09r_report('b', 1, 'source_count') is null and pg_temp.s09r_report('b', 1, 'report') is null,
  'attempt 1 is failed with the worker-reported code, unsealed, with no result, counts or report [P2-S09-AC-641]');
select ok(pg_temp.s09r_plan('b', 'state') = 'blocked' and (pg_temp.s09d_resp('b:fail')->'plan'->>'state') = 'blocked',
  'the plan is blocked (recoverable by a new dry run) and the response says so [P2-S09-AC-641]');
select ok(pg_temp.s09d_get_pr('b')->>'failureCode' = 'SCAN_ABORTED' and pg_temp.s09d_get_pr('b')->>'state' = 'failed'
    and (pg_temp.s09d_get_pr('b')->>'failureCode') ~ '^[A-Z][A-Z0-9_]{0,63}$' and not (pg_temp.s09d_get_pr('b') ? 'sourceCount'),
  'the CMS-03A-07 dryRunRef projects the stored failure code of the latest, failed attempt and none of the sealed-only members [P2-S09-AC-641]');

-- The failed attempt is immutable evidence and cannot be sealed, resumed or failed again.
select pg_temp.s09w_rollback('b', 'a', false, 'b:fail:again', 'OTHER_CODE');
select is(pg_temp.s09d_outcome('b:fail:again'), 'CONFLICT', 'a second failure call on the blocked plan is refused [P2-S09-AC-641]');
select is(pg_temp.s09r_report('b', 1, 'failure_code'), 'SCAN_ABORTED', 'the stored failure code is unchanged [P2-S09-AC-641]');
select pg_temp.s09d_call('b:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('b') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('b'),
    'cursor', pg_temp.s09w_plan_cursor('b'), 'sourceCount', '0', 'targetCount', '0', 'rowErrorCount', '0'));
select is(pg_temp.s09d_outcome('b:seal'), 'CONFLICT', 'a failed scan cannot be sealed afterwards [P2-S09-AC-641]');
select pg_temp.s09d_submit('b');
select isnt(pg_temp.s09d_outcome('b:submit'), 'OK', 'the candidate with a failed scan cannot be submitted for review [P2-S09-AC-641]');

-- Recovery: a new dry run supersedes the blocked plan; attempt 1 stays as evidence.
select pg_temp.s09d_dry_run('b', 'owner', null, null, 's09r-recover-0001');
select ok(pg_temp.s09d_outcome('b:dryRun') = 'OK' and pg_temp.s09r_report('b', 2, 'state') = 'queued'
    and pg_temp.s09r_report('b', 1, 'failure_code') = 'SCAN_ABORTED' and pg_temp.s09r_report('b', 1, 'state') = 'failed',
  'a new CMS-03A-10 attempt starts and the failed attempt 1 is retained unchanged [P2-S09-AC-641]');
select ok(pg_temp.s09d_get_pr('b')->'failureCode' = 'null'::jsonb and pg_temp.s09d_get_pr('b')->>'state' = 'queued',
  'the projection follows the latest attempt: queued carries failureCode null, not the earlier failure code [P2-S09-AC-641]');

select * from finish();
rollback;
