-- Slice 09 (AC641; R12 holdover, orchestrator ruling): a dry-run scan that
-- cannot be sealed now ends in the unsealed `failed` state with a failure code.
-- The Worker already calls cms_rollback_schema_migration with a reason code when
-- a dry-running scan fails terminally, but the RPC accepted only running,
-- verifying and failed_retryable plans, so the call was refused with 409 and no
-- failed attempt could ever be produced.  For a dry_running plan the RPC now
-- (a) refuses a retryable failure (409: retry belongs to the queue), (b) refuses
-- a reason code outside ^[A-Z][A-Z0-9_]{0,63}$ (400), (c) marks the attempt's own
-- report row failed with that code (unsealed: no result, counts, hashes or
-- report), (d) blocks the plan, which a new CMS-03A-10 attempt recovers, and
-- (e) leaves every other path of the RPC untouched.  The activationPreparation
-- dryRunRef.failureCode projection reads the stored code.  Forward-only; the
-- signature and grants are unchanged.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_rollback_schema_migration(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  plan_id uuid;
  schema_version_id uuid;
  expected_version bigint;
  request_cursor bigint;
  fallback_version_id uuid;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
  rollback_state text;
  scan_failure boolean;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseToken', 'reasonCode', 'retryable', 'fallbackVersionId',
      'preserveOldActive', 'deleteRows', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[],
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseToken', 'reasonCode', 'retryable', 'fallbackVersionId',
      'preserveOldActive', 'deleteRows', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[]
  );
  if p_request->>'reasonCode' is null
     or p_request->>'reasonCode' !~ '^[A-Z][A-Z0-9_.-]{0,63}$'
     or p_request->'retryable' is distinct from 'true'::jsonb
       and p_request->'retryable' is distinct from 'false'::jsonb
     or p_request->'preserveOldActive' is distinct from 'true'::jsonb
     or p_request->'deleteRows' is distinct from 'false'::jsonb then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  request_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  fallback_version_id := platform_private.cms_worker_uuid(p_request->>'fallbackVersionId');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.to_version_id <> schema_version_id
     or plan_row.from_version_id <> fallback_version_id
     or plan_row.version <> expected_version
     or plan_row.cursor <> request_cursor then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  scan_failure := plan_row.state = 'dry_running';
  if plan_row.state not in ('dry_running', 'running', 'verifying', 'failed_retryable') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- A scan that cannot be sealed ends its attempt in the unsealed `failed` state:
  -- retry of a scan belongs to the queue (the attempt stays running), so only a
  -- terminal failure is recorded, and its code must fit the report grammar.
  if scan_failure and ((p_request->'retryable') is distinct from 'false'::jsonb) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if scan_failure and p_request->>'reasonCode' !~ '^[A-Z][A-Z0-9_]{0,63}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row, p_request->>'leaseToken', null, now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  if scan_failure then
    -- The attempt's own report row carries the worker-reported code; the plan is
    -- blocked (never ready, never a pass) and a new CMS-03A-10 attempt recovers it.
    update platform_private.cms_schema_dry_run_reports report
       set state = 'failed',
           failure_code = p_request->>'reasonCode',
           version = report.version + 1,
           updated_at = now_at
     where report.plan_id = plan_id and report.state in ('queued', 'running');
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    update platform_private.cms_schema_migration_plans
       set state = 'blocked',
           version = version + 1,
           updated_at = now_at,
           dry_run_report = platform_private.cms_worker_set_report(
             dry_run_report, 'blocked', null, null, now_at,
             source_count, target_count, row_error_count, migrated_count, failed_count
           ) || jsonb_build_object('result', 'failed')
     where id = plan_id and version = expected_version;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return jsonb_build_object('plan', platform_private.cms_worker_plan_json(plan_id));
  end if;
  rollback_state := case when (p_request->'retryable')::boolean
    then 'failed_retryable' else 'failed_terminal' end;
  update platform_private.cms_schema_migration_plans
     set state = rollback_state,
         version = version + 1,
         updated_at = now_at,
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report, rollback_state, null, null,
           now_at + interval '15 minutes',
           source_count, target_count, row_error_count, migrated_count, failed_count
         )
   where id = plan_id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return jsonb_build_object('plan', platform_private.cms_worker_plan_json(plan_id));
end;
$function$;

commit;
