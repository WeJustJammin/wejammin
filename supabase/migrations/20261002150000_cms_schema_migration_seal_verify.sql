-- BE03a real migration scan: plan lifecycle (2/3).  Dry-run finalize seals from
-- the recorded per-row evidence (cursor at the end, source unchanged) instead of
-- refusing any source with affected rows; begin-verification, verify and
-- complete prove the backfilled target rows against the unchanged source
-- through the registered executor contract.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_finalize_schema_migration_dry_run(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare
  plan_id uuid;
  expected_version bigint;
  request_cursor bigint;
  request_source_count bigint;
  request_target_count bigint;
  request_row_error_count bigint;
  now_at timestamptz := pg_catalog.clock_timestamp();
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  next_state text;
  sealed_report jsonb;
  actual_source_count bigint;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'expectedVersion', 'cursor', 'sourceCount',
      'targetCount', 'rowErrorCount', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[],
    array[
      'migrationPlanId', 'expectedVersion', 'cursor', 'sourceCount',
      'targetCount', 'rowErrorCount', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[]
  );
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  request_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  request_source_count := platform_private.cms_worker_counter(p_request->>'sourceCount');
  request_target_count := platform_private.cms_worker_counter(p_request->>'targetCount');
  request_row_error_count := platform_private.cms_worker_counter(p_request->>'rowErrorCount');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.state <> 'dry_running'
     or plan_row.version <> expected_version
     or plan_row.cursor <> request_cursor
     or plan_row.source_count <> request_source_count
     or plan_row.target_count <> request_target_count
     or plan_row.row_error_count <> request_row_error_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  -- The source count is proven by the database, never taken from the caller.
  actual_source_count := platform_private.cms_schema_source_row_count(plan_row.from_version_id);
  if actual_source_count <> request_source_count
     or plan_row.cursor <> plan_row.source_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- The seal rests on the recorded per-row evidence: every live row was scanned
  -- exactly once and is unchanged since, so the counters are derived, not claimed.
  if not platform_private.cms_migration_source_unchanged(plan_row) then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row,
    plan_row.dry_run_report->'lease'->>'token',
    null,
    now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  next_state := case when request_row_error_count = 0 then 'ready' else 'blocked' end;
  update platform_private.cms_schema_migration_plans
     set state = next_state,
         version = version + 1,
         updated_at = now_at,
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report, next_state, null, null, now_at,
           request_source_count, request_target_count, request_row_error_count,
           migrated_count, failed_count
         ) || jsonb_build_object(
           'result', case when next_state = 'ready' then 'pass' else 'blocked' end
         )
   where id = plan_id and version = expected_version
  returning dry_run_report into sealed_report;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- Seal the attempt's own report row once: the final evidence, counts, hashes
  -- and report appear together with state completed and sealed_at; the report
  -- trigger then rejects every further UPDATE.
  update platform_private.cms_schema_dry_run_reports report
     set state = 'completed',
         result = case when next_state = 'ready' then 'pass' else 'fail' end,
         source_hash = sealed_report->>'sourceHash',
         target_hash = sealed_report->>'targetHash',
         compiler_hash = sealed_report->>'compilerHash',
         source_count = request_source_count,
         target_count = request_target_count,
         row_error_count = request_row_error_count,
         migrated_count = plan_row.migrated_count,
         failed_count = plan_row.failed_count,
         report = sealed_report || pg_catalog.jsonb_build_object(
           'result', case when next_state = 'ready' then 'pass' else 'fail' end),
         sealed_at = now_at,
         updated_at = now_at,
         version = report.version + 1
   where report.plan_id = plan_id and report.state in ('queued', 'running');
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return platform_private.cms_worker_plan_json(plan_id);
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_begin_schema_migration_verification(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_id uuid;
  expected_version bigint;
  request_cursor bigint;
  request_source_count bigint;
  request_target_count bigint;
  request_row_error_count bigint;
  request_migrated_count bigint;
  request_failed_count bigint;
  now_at timestamptz := pg_catalog.clock_timestamp();
  plan_row platform_private.cms_schema_migration_plans%rowtype;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'expectedVersion', 'cursor', 'sourceCount',
      'targetCount', 'rowErrorCount', 'migratedCount', 'failedCount',
      'transformKey', 'transformVersion', 'compilerHash', 'sourceHash',
      'targetHash'
    ]::text[],
    array[
      'migrationPlanId', 'expectedVersion', 'cursor', 'sourceCount',
      'targetCount', 'rowErrorCount', 'migratedCount', 'failedCount',
      'transformKey', 'transformVersion', 'compilerHash', 'sourceHash',
      'targetHash'
    ]::text[]
  );
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  request_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  request_source_count := platform_private.cms_worker_counter(p_request->>'sourceCount');
  request_target_count := platform_private.cms_worker_counter(p_request->>'targetCount');
  request_row_error_count := platform_private.cms_worker_counter(p_request->>'rowErrorCount');
  request_migrated_count := platform_private.cms_worker_counter(p_request->>'migratedCount');
  request_failed_count := platform_private.cms_worker_counter(p_request->>'failedCount');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.state <> 'running'
     or plan_row.version <> expected_version
     or plan_row.cursor <> request_cursor
     or plan_row.source_count <> request_source_count
     or plan_row.target_count <> request_target_count
     or plan_row.row_error_count <> request_row_error_count
     or plan_row.migrated_count <> request_migrated_count
     or plan_row.failed_count <> request_failed_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if request_row_error_count > 0 or request_failed_count > 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  if plan_row.cursor <> plan_row.source_count
     or plan_row.migrated_count <> plan_row.target_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_migration_source_unchanged(plan_row) then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row,
    plan_row.dry_run_report->'lease'->>'token',
    null,
    now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  update platform_private.cms_schema_migration_plans
     set state = 'verifying',
         version = version + 1,
         updated_at = now_at,
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report, 'verifying', dry_run_report->'lease'->>'owner',
           dry_run_report->'lease'->>'token',
           (dry_run_report->'lease'->>'expiresAt')::timestamptz,
           request_source_count, request_target_count, request_row_error_count,
           request_migrated_count, request_failed_count
         )
   where id = plan_id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return platform_private.cms_worker_plan_json(plan_id);
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_verify_schema_migration(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_id uuid;
  expected_version bigint;
  request_cursor bigint;
  request_source_count bigint;
  request_target_count bigint;
  request_row_error_count bigint;
  request_migrated_count bigint;
  request_failed_count bigint;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  now_at timestamptz := pg_catalog.clock_timestamp();
  verify_reason text;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseToken', 'sourceCount', 'targetCount', 'rowErrorCount',
      'migratedCount', 'failedCount', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[],
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseToken', 'sourceCount', 'targetCount', 'rowErrorCount',
      'migratedCount', 'failedCount', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash'
    ]::text[]
  );
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  if not platform_private.cms_valid_uuid(p_request->>'schemaVersionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  request_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  request_source_count := platform_private.cms_worker_counter(p_request->>'sourceCount');
  request_target_count := platform_private.cms_worker_counter(p_request->>'targetCount');
  request_row_error_count := platform_private.cms_worker_counter(p_request->>'rowErrorCount');
  request_migrated_count := platform_private.cms_worker_counter(p_request->>'migratedCount');
  request_failed_count := platform_private.cms_worker_counter(p_request->>'failedCount');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.to_version_id::text is distinct from p_request->>'schemaVersionId'
     or plan_row.state <> 'verifying'
     or plan_row.version <> expected_version
     or plan_row.cursor <> request_cursor
     or plan_row.source_count <> request_source_count
     or plan_row.target_count <> request_target_count
     or plan_row.row_error_count <> request_row_error_count
     or plan_row.migrated_count <> request_migrated_count
     or plan_row.failed_count <> request_failed_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row, p_request->>'leaseToken', null, now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  -- Verification recomputes every target row from the unchanged live source
  -- through the registered executor contract; counters alone never verify.
  verify_reason := platform_private.cms_migration_verify_reason(plan_row);
  if verify_reason is not null then
    return jsonb_build_object('valid', false, 'reasonCode', verify_reason);
  end if;
  return jsonb_build_object('valid', true, 'reasonCode', null);
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_complete_schema_migration(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_id uuid;
  expected_version bigint;
  now_at timestamptz := pg_catalog.clock_timestamp();
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  verify_reason text;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array['migrationPlanId', 'expectedVersion', 'leaseToken']::text[],
    array['migrationPlanId', 'expectedVersion', 'leaseToken']::text[]
  );
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_migration_source_evidence_valid(plan_row) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_SOURCE_EVIDENCE_REQUIRED', errcode = 'P0001';
  end if;
  if plan_row.state = 'completed' then
    return platform_private.cms_worker_plan_json(plan_id);
  end if;
  if plan_row.state <> 'verifying' or plan_row.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row, p_request->>'leaseToken', null, now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  -- Completion re-proves the target rows against the unchanged source at the
  -- instant it seals the plan immutable.
  verify_reason := platform_private.cms_migration_verify_reason(plan_row);
  if verify_reason is not null then
    raise exception 'VALIDATION_FAILED' using detail = verify_reason, errcode = 'P0001';
  end if;
  update platform_private.cms_schema_migration_plans
     set state = 'completed',
         version = version + 1,
         updated_at = now_at,
         completed_at = now_at,
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report, 'completed', null, null,
           greatest(
             now_at + interval '15 minutes',
             (dry_run_report->'lease'->>'expiresAt')::timestamptz
           ),
           source_count, target_count, row_error_count, migrated_count, failed_count
         )
   where id = plan_id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return platform_private.cms_worker_plan_json(plan_id);
end;
$function$;

revoke all on function platform_private.cms_finalize_schema_migration_dry_run(jsonb),
  platform_private.cms_begin_schema_migration_verification(jsonb),
  platform_private.cms_verify_schema_migration(jsonb),
  platform_private.cms_complete_schema_migration(jsonb)
  from public, anon, authenticated, service_role;

commit;
