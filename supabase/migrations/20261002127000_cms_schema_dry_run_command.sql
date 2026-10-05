-- DEC-108 / CMS-03A-10: the actual schema dry-run command and the migration
-- worker plumbing that now seals an attempt-scoped report instead of inserting
-- one.  Forward-only.
--   * cms_start_schema_dry_run derives classification/compiler/transform
--     evidence server-side, supersedes earlier live attempts of the pair and
--     commits report + plan + BE00 job together.
--   * The worker plan reader, fingerprint validation and lease claim accept a
--     first version (no source version: the all-zero source fingerprint) and
--     refuse a superseded plan; a claim marks the attempt running.
--   * The dry-run finalizer seals the queued report from the DB-proven source
--     count; a source that has affected rows cannot seal until the real scan
--     ships, and the evidence validators no longer expire a sealed plan with
--     its worker lease (a review can take days).
begin;

-- The unsealed report row carries no report object: the typed-report check
-- applies only once a report exists (the sealed row).
alter table platform_private.cms_schema_dry_run_reports
  drop constraint cms_schema_dry_run_reports_report_check,
  add constraint cms_schema_dry_run_reports_report_check check (
    report is null or (
      pg_catalog.jsonb_typeof(report) = 'object'
      and platform_private.cms_json_bounded(report)
      and report->>'dryRunId' = id::text
      and report->>'result' = result
      and report->>'sourceCount' = source_count::text
      and report->>'targetCount' = target_count::text
      and report->>'rowErrorCount' = row_error_count::text
      and report->>'migratedCount' = migrated_count::text
      and report->>'failedCount' = failed_count::text
    )
  );

CREATE OR REPLACE FUNCTION platform_private.cms_worker_plan_json(p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  response jsonb;
begin
  select jsonb_build_object(
    'id', plan.id,
    'contentTypeId', plan.content_type_id,
    'fromVersionId', plan.from_version_id,
    'toVersionId', plan.to_version_id,
    'state', plan.state,
    'version', plan.version::text,
    'cursor', plan.cursor::text,
    'progress', plan.progress,
    'sourceCount', plan.source_count::text,
    'targetCount', plan.target_count::text,
    'rowErrorCount', plan.row_error_count::text,
    'migratedCount', plan.migrated_count::text,
    'failedCount', plan.failed_count::text,
    'classification', plan.classification,
    'transformKey', plan.transform_key,
    'transformVersion', plan.transform_version::text,
    'compilerHash', artifact.artifact_hash,
    'sourceHash', coalesce(source_version.definition_hash, pg_catalog.repeat('0', 64)),
    'targetHash', target_version.definition_hash,
    'activeVersionId', coalesce(active_version.id, source_version.id),
    'leaseOwner', nullif(plan.dry_run_report->'lease'->>'owner', ''),
    'leaseToken', nullif(plan.dry_run_report->'lease'->>'token', ''),
    'leaseExpiresAt', nullif(plan.dry_run_report->'lease'->>'expiresAt', '')
  )
    into response
    from platform_private.cms_schema_migration_plans plan
    left join platform_private.cms_content_type_versions source_version
      on source_version.id = plan.from_version_id
     and source_version.content_type_id = plan.content_type_id
     and source_version.owner_id = plan.owner_id
    join platform_private.cms_content_type_versions target_version
      on target_version.id = plan.to_version_id
     and target_version.content_type_id = plan.content_type_id
     and target_version.owner_id = plan.owner_id
    join platform_private.cms_schema_artifacts artifact
      on artifact.id = target_version.schema_artifact_id
     and artifact.content_type_version_id = target_version.id
     and artifact.owner_id = plan.owner_id
     and artifact.state = 'compiled'
    left join platform_private.cms_content_type_versions active_version
      on active_version.content_type_id = plan.content_type_id
     and active_version.owner_id = plan.owner_id
     and active_version.state = 'active'
    where plan.id = p_plan_id;
  if response is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not platform_private.cms_valid_hash(response->>'compilerHash')
     or not platform_private.cms_valid_hash(response->>'sourceHash')
     or not platform_private.cms_valid_hash(response->>'targetHash') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_worker_validate_fingerprint(p_plan platform_private.cms_schema_migration_plans, p_request jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  source_hash text;
  target_hash text;
  compiler_hash text;
  report_source_hash text;
  report_target_hash text;
  report_compiler_hash text;
  report_transform_hash text;
  report_compiler_version text;
  artifact_compiler_version text;
  target_dry_run_id text;
  recomputed_transform_hash text;
begin
  if p_plan.superseded_at is not null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_migration_source_evidence_valid(p_plan) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_SOURCE_EVIDENCE_REQUIRED', errcode = 'P0001';
  end if;
  select coalesce(source_version.definition_hash, pg_catalog.repeat('0', 64)),
         target_version.definition_hash,
         target_version.dry_run_id::text, artifact.artifact_hash,
         artifact.compiler_version
    into source_hash, target_hash, target_dry_run_id, compiler_hash,
         artifact_compiler_version
    from platform_private.cms_content_type_versions target_version
    join platform_private.cms_schema_artifacts artifact
      on artifact.id = target_version.schema_artifact_id
     and artifact.content_type_version_id = target_version.id
     and artifact.owner_id = p_plan.owner_id
     and artifact.state = 'compiled'
    left join platform_private.cms_content_type_versions source_version
      on source_version.id = p_plan.from_version_id
     and source_version.content_type_id = p_plan.content_type_id
     and source_version.owner_id = p_plan.owner_id
   where target_version.id = p_plan.to_version_id
     and target_version.content_type_id = p_plan.content_type_id
     and target_version.owner_id = p_plan.owner_id;
  if not found
     or (p_plan.from_version_id is not null and not exists (
       select 1 from platform_private.cms_content_type_versions earlier
        where earlier.id = p_plan.from_version_id
          and earlier.content_type_id = p_plan.content_type_id
          and earlier.owner_id = p_plan.owner_id))
     or not platform_private.cms_valid_hash(source_hash)
     or not platform_private.cms_valid_hash(target_hash)
     or not platform_private.cms_valid_hash(compiler_hash) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->>'sourceHash' is distinct from source_hash
     or p_request->>'targetHash' is distinct from target_hash
     or p_request->>'compilerHash' is distinct from compiler_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_plan.transform_key is null then
    if p_request->>'transformKey' is not null
       or p_request->>'transformVersion' is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  elsif p_request->>'transformKey' is distinct from p_plan.transform_key
     or p_request->>'transformVersion' is distinct from p_plan.transform_version::text then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  report_source_hash := coalesce(
    p_plan.dry_run_report->>'sourceHash',
    p_plan.dry_run_report->>'sourceDefinitionHash'
  );
  report_target_hash := coalesce(
    p_plan.dry_run_report->>'targetHash',
    p_plan.dry_run_report->>'targetDefinitionHash'
  );
  report_compiler_hash := p_plan.dry_run_report->>'compilerHash';
  report_transform_hash := p_plan.dry_run_report->>'transformHash';
  report_compiler_version := p_plan.dry_run_report->>'compilerVersion';
  recomputed_transform_hash := platform_private.cms_migration_transform_hash(
    p_plan.classification,
    p_plan.transform_key,
    p_plan.transform_version,
    source_hash,
    target_hash,
    compiler_hash,
    artifact_compiler_version
  );
  if report_source_hash is distinct from source_hash
     or report_target_hash is distinct from target_hash
     or report_compiler_hash is distinct from compiler_hash
     or not platform_private.cms_valid_hash(report_transform_hash)
     or report_transform_hash is distinct from recomputed_transform_hash
     or report_compiler_version is distinct from artifact_compiler_version then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_plan.dry_run_report->>'result' <> 'pass'
     or not platform_private.cms_valid_uuid(target_dry_run_id)
     or p_plan.dry_run_report->>'dryRunId' is distinct from target_dry_run_id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Fingerprints alone are insufficient: a worker must carry forward the
  -- exact counters that the producer reported.  Keep this check independent
  -- of the mutable plan counters so a forged/missing report cannot become a
  -- valid lease hand-off.
  if not coalesce((
    p_plan.dry_run_report->>'sourceCount' ~ '^[0-9][0-9]{0,17}$'
    and p_plan.dry_run_report->>'targetCount' ~ '^[0-9][0-9]{0,17}$'
    and p_plan.dry_run_report->>'rowErrorCount' ~ '^[0-9][0-9]{0,17}$'
    and p_plan.dry_run_report->>'migratedCount' ~ '^[0-9][0-9]{0,17}$'
    and p_plan.dry_run_report->>'failedCount' ~ '^[0-9][0-9]{0,17}$'
  ), false) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if (p_plan.dry_run_report->>'sourceCount')::bigint <> p_plan.source_count
     or (p_plan.dry_run_report->>'targetCount')::bigint <> p_plan.target_count
     or (p_plan.dry_run_report->>'rowErrorCount')::bigint <> p_plan.row_error_count
     or (p_plan.dry_run_report->>'migratedCount')::bigint <> p_plan.migrated_count
     or (p_plan.dry_run_report->>'failedCount')::bigint <> p_plan.failed_count then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_plan.transform_key is not null
     and (p_plan.dry_run_report->>'transformKey' is distinct from p_plan.transform_key
       or p_plan.dry_run_report->>'transformVersion' is distinct from p_plan.transform_version::text) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- A ready/live hand-off is not valid until the producer snapshot exists in
  -- the independent immutable authority.  Draft/dry-running rows are allowed
  -- to reach the finalizer, which creates that snapshot before returning ready.
  if p_plan.state in ('ready', 'running', 'verifying', 'completed')
     and not platform_private.cms_persisted_dry_run_report_valid(
       case when platform_private.cms_valid_uuid(p_plan.dry_run_report->>'dryRunId')
         then (p_plan.dry_run_report->>'dryRunId')::uuid else null end,
       p_plan.owner_id,
       p_plan.content_type_id,
       p_plan.from_version_id,
       p_plan.to_version_id,
       p_plan.classification,
       p_plan.transform_key,
       p_plan.transform_version,
       source_hash,
       target_hash,
       compiler_hash,
       artifact_compiler_version
     ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_claim_schema_migration_lease(p_request jsonb)
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
  expected_cursor bigint;
  lease_duration bigint;
  now_at timestamptz;
  worker_id text := p_request->>'workerId';
  lease_owner text := p_request->>'leaseOwner';
  existing_expires_at timestamptz;
  existing_owner text;
  next_state text;
  lease_token text;
  lease_expires_at timestamptz;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseOwner', 'workerId', 'leaseDurationMs', 'now', 'transformKey',
      'transformVersion', 'compilerHash', 'sourceHash', 'targetHash'
    ]::text[],
    array[
      'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor',
      'leaseOwner', 'workerId', 'leaseDurationMs', 'now', 'transformKey',
      'transformVersion', 'compilerHash', 'sourceHash', 'targetHash'
    ]::text[]
  );
  if worker_id is null or worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'
     or lease_owner is distinct from worker_id then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  expected_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  lease_duration := platform_private.cms_worker_counter(p_request->>'leaseDurationMs');
  if lease_duration not between 1 and 900000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  now_at := platform_private.cms_worker_time(p_request->>'now');
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.to_version_id <> schema_version_id
     or plan_row.version <> expected_version
     or plan_row.cursor <> expected_cursor then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  begin
    existing_expires_at := (plan_row.dry_run_report->'lease'->>'expiresAt')::timestamptz;
  exception when others then
    existing_expires_at := null;
  end;
  existing_owner := plan_row.dry_run_report->'lease'->>'owner';
  if existing_expires_at is not null
     and existing_expires_at > now_at
     and existing_owner is distinct from worker_id then
    return jsonb_build_object(
      'acquired', false, 'leaseToken', null, 'plan', null,
      'reasonCode', 'LEASE_UNAVAILABLE'
    );
  end if;
  if plan_row.state not in ('draft', 'dry_running', 'ready', 'running', 'failed_retryable') then
    return jsonb_build_object(
      'acquired', false, 'leaseToken', null, 'plan', null,
      'reasonCode', 'MIGRATION_STATE_UNAVAILABLE'
    );
  end if;
  next_state := case plan_row.state
    when 'draft' then 'dry_running'
    when 'ready' then 'running'
    when 'failed_retryable' then 'running'
    else plan_row.state
  end;
  lease_token := extensions.gen_random_uuid()::text;
  lease_expires_at := now_at + pg_catalog.make_interval(secs => lease_duration / 1000.0);
  update platform_private.cms_schema_migration_plans
     set state = next_state,
         version = version + 1,
         updated_at = now_at,
         started_at = coalesce(started_at, now_at),
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report, 'leased', lease_owner, lease_token, lease_expires_at,
           source_count, target_count, row_error_count, migrated_count, failed_count
         )
   where id = plan_id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_schema_dry_run_reports report
     set state = 'running',
         version = report.version + 1,
         updated_at = now_at
   where report.plan_id = plan_id and report.state = 'queued';
  return jsonb_build_object(
    'acquired', true,
    'leaseToken', lease_token,
    'plan', platform_private.cms_worker_plan_json(plan_id),
    'reasonCode', null
  );
end;
$function$;

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
  -- The source count is proven by the database, never taken from the caller;
  -- a source with affected rows needs the real scan evidence to seal.
  actual_source_count := platform_private.cms_schema_source_row_count(plan_row.from_version_id);
  if actual_source_count <> request_source_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if actual_source_count > 0 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_SOURCE_EVIDENCE_REQUIRED', errcode = 'P0001';
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

CREATE OR REPLACE FUNCTION platform_private.cms_migration_plan_ready(p_plan_id uuid, p_content_type_id uuid, p_to_version_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  source_hash text;
  target_hash text;
  compiler_hash text;
  transform_hash text;
  transform_version_text text;
  compiler_version text;
  lease_state text;
  lease_expires_at timestamptz;
  report_source_count bigint;
  report_target_count bigint;
  report_row_error_count bigint;
  report_migrated_count bigint;
  report_failed_count bigint;
  target_dry_run_id text;
  recomputed_transform_hash text;
begin
  select * into plan_row
  from platform_private.cms_schema_migration_plans plan
  where plan.id = p_plan_id
    and plan.content_type_id = p_content_type_id
    and plan.to_version_id = p_to_version_id
    and plan.state in ('ready', 'completed')
    and plan.failed_count = 0
    and plan.row_error_count = 0
    and plan.superseded_at is null;
  if not found then return false; end if;
  if not platform_private.cms_migration_source_evidence_valid(plan_row) then
    return false;
  end if;
  source_hash := coalesce(
    plan_row.dry_run_report->>'sourceHash',
    plan_row.dry_run_report->>'sourceDefinitionHash'
  );
  target_hash := coalesce(
    plan_row.dry_run_report->>'targetHash',
    plan_row.dry_run_report->>'targetDefinitionHash'
  );
  transform_hash := plan_row.dry_run_report->>'transformHash';
  transform_version_text := plan_row.dry_run_report->>'transformVersion';
  compiler_hash := plan_row.dry_run_report->>'compilerHash';
  compiler_version := plan_row.dry_run_report->>'compilerVersion';
  select version_row.dry_run_id::text
    into target_dry_run_id
    from platform_private.cms_content_type_versions version_row
   where version_row.id = plan_row.to_version_id
     and version_row.content_type_id = plan_row.content_type_id
     and version_row.owner_id = plan_row.owner_id;
  recomputed_transform_hash := platform_private.cms_migration_transform_hash(
    plan_row.classification,
    plan_row.transform_key,
    plan_row.transform_version,
    source_hash,
    target_hash,
    compiler_hash,
    compiler_version
  );
  lease_state := plan_row.dry_run_report->'lease'->>'state';
  begin
    lease_expires_at := (plan_row.dry_run_report->'lease'->>'expiresAt')::timestamptz;
    if plan_row.dry_run_report->>'sourceCount' !~ '^[0-9]+$'
       or plan_row.dry_run_report->>'targetCount' !~ '^[0-9]+$'
       or plan_row.dry_run_report->>'rowErrorCount' !~ '^[0-9]+$'
       or plan_row.dry_run_report->>'migratedCount' !~ '^[0-9]+$'
       or plan_row.dry_run_report->>'failedCount' !~ '^[0-9]+$' then
      return false;
    end if;
    report_source_count := (plan_row.dry_run_report->>'sourceCount')::bigint;
    report_target_count := (plan_row.dry_run_report->>'targetCount')::bigint;
    report_row_error_count := (plan_row.dry_run_report->>'rowErrorCount')::bigint;
    report_migrated_count := (plan_row.dry_run_report->>'migratedCount')::bigint;
    report_failed_count := (plan_row.dry_run_report->>'failedCount')::bigint;
  exception when others then
    return false;
  end;
  return source_hash = case when plan_row.from_version_id is null then pg_catalog.repeat('0', 64) else (
      select version_row.definition_hash
      from platform_private.cms_content_type_versions version_row
      where version_row.id = plan_row.from_version_id
        and version_row.content_type_id = plan_row.content_type_id
        and version_row.owner_id = plan_row.owner_id
    ) end
    and plan_row.classification = (
      select version_row.compatibility
      from platform_private.cms_content_type_versions version_row
      where version_row.id = plan_row.to_version_id
        and version_row.content_type_id = plan_row.content_type_id
        and version_row.owner_id = plan_row.owner_id
    )
    and target_hash = (
      select version_row.definition_hash
      from platform_private.cms_content_type_versions version_row
      where version_row.id = plan_row.to_version_id
        and version_row.content_type_id = plan_row.content_type_id
        and version_row.owner_id = plan_row.owner_id
    )
    and transform_hash ~ '^[a-f0-9]{64}$'
    and transform_hash = recomputed_transform_hash
    and (
      (plan_row.transform_key is null
       and plan_row.transform_version is null
       and plan_row.classification = 'additive')
      or (
        plan_row.transform_key is not null
        and plan_row.transform_version is not null
        and plan_row.classification in ('conditional', 'breaking')
        and plan_row.dry_run_report->>'transformKey' = plan_row.transform_key
        and transform_version_text ~ '^[1-9][0-9]{0,17}$'
        and transform_version_text::bigint = plan_row.transform_version
      )
    )
    and compiler_hash = (
      select artifact.artifact_hash
      from platform_private.cms_schema_artifacts artifact
      where artifact.content_type_version_id = plan_row.to_version_id
        and artifact.owner_id = plan_row.owner_id
        and artifact.state = 'compiled'
    )
    and compiler_hash ~ '^[a-f0-9]{64}$'
    and compiler_version = (
      select artifact.compiler_version
      from platform_private.cms_schema_artifacts artifact
      where artifact.content_type_version_id = plan_row.to_version_id
        and artifact.state = 'compiled'
    )
    and report_source_count = plan_row.source_count
    and report_target_count = plan_row.target_count
    and report_row_error_count = plan_row.row_error_count
    and report_migrated_count = plan_row.migrated_count
    and report_failed_count = plan_row.failed_count
    and plan_row.cursor >= plan_row.source_count
    and platform_private.cms_valid_uuid(target_dry_run_id)
    and plan_row.dry_run_report->>'dryRunId' = target_dry_run_id
    and platform_private.cms_dry_run_report_valid(
      plan_row.dry_run_report,
      case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end,
      plan_row.classification,
      plan_row.transform_key,
      plan_row.transform_version,
      source_hash,
      target_hash,
      compiler_hash,
      compiler_version
    )
    and platform_private.cms_persisted_dry_run_report_valid(
      case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end,
      plan_row.owner_id,
      plan_row.content_type_id,
      plan_row.from_version_id,
      plan_row.to_version_id,
      plan_row.classification,
      plan_row.transform_key,
      plan_row.transform_version,
      source_hash,
      target_hash,
      compiler_hash,
      compiler_version
    )
    and (
      select report.source_count
      from platform_private.cms_schema_dry_run_reports report
      where report.id = case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end
    ) = plan_row.source_count
    and (
      select report.target_count
      from platform_private.cms_schema_dry_run_reports report
      where report.id = case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end
    ) = plan_row.target_count
    and (
      select report.row_error_count
      from platform_private.cms_schema_dry_run_reports report
      where report.id = case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end
    ) = plan_row.row_error_count
    and (
      select report.failed_count
      from platform_private.cms_schema_dry_run_reports report
      where report.id = case when platform_private.cms_valid_uuid(target_dry_run_id)
        then target_dry_run_id::uuid else null end
    ) = plan_row.failed_count
    and plan_row.dry_run_report->>'result' = 'pass'
    and lease_state in ('leased', 'running', 'ready', 'completed')
    and lease_expires_at is not null;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_dry_run_report_valid(p_report jsonb, p_dry_run_id uuid, p_classification text, p_transform_key text, p_transform_version bigint, p_source_hash text, p_target_hash text, p_compiler_hash text, p_compiler_version text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  report_source_hash text;
  report_target_hash text;
  report_transform_hash text;
  report_transform_version text;
  report_compiler_hash text;
  report_compiler_version text;
  report_lease_expires_at timestamptz;
begin
  if p_report is null
     or pg_catalog.jsonb_typeof(p_report) <> 'object'
     or p_dry_run_id is null
     or p_classification not in ('additive', 'conditional', 'breaking')
     or p_source_hash is null
     or p_target_hash is null
     or p_compiler_hash is null
     or p_source_hash !~ '^[a-f0-9]{64}$'
     or p_target_hash !~ '^[a-f0-9]{64}$'
     or p_compiler_hash !~ '^[a-f0-9]{64}$'
     or p_compiler_version is null
     or p_report->>'dryRunId' <> p_dry_run_id::text
     or p_report->>'result' <> 'pass'
     or pg_catalog.jsonb_typeof(p_report->'lease') <> 'object'
     or p_report->'lease'->>'state' not in ('leased', 'running', 'ready', 'completed')
     or (p_report ? 'sourceHash' and p_report ? 'sourceDefinitionHash'
       and p_report->>'sourceHash' is distinct from p_report->>'sourceDefinitionHash')
     or (p_report ? 'targetHash' and p_report ? 'targetDefinitionHash'
       and p_report->>'targetHash' is distinct from p_report->>'targetDefinitionHash') then
    return false;
  end if;
  report_source_hash := coalesce(
    p_report->>'sourceHash', p_report->>'sourceDefinitionHash'
  );
  report_target_hash := coalesce(
    p_report->>'targetHash', p_report->>'targetDefinitionHash'
  );
  report_transform_hash := p_report->>'transformHash';
  report_transform_version := p_report->>'transformVersion';
  report_compiler_hash := p_report->>'compilerHash';
  report_compiler_version := p_report->>'compilerVersion';
  if report_source_hash is distinct from p_source_hash
     or report_target_hash is distinct from p_target_hash
     or report_compiler_hash is distinct from p_compiler_hash
     or report_compiler_version is distinct from p_compiler_version
     or report_transform_hash !~ '^[a-f0-9]{64}$'
     or report_transform_hash is distinct from platform_private.cms_migration_transform_hash(
       p_classification, p_transform_key, p_transform_version,
       p_source_hash, p_target_hash, p_compiler_hash, p_compiler_version
     ) then
    return false;
  end if;
  if p_classification = 'additive' then
    if p_transform_key is not null
       or p_transform_version is not null
       or p_report ? 'transformKey'
       or p_report ? 'transformVersion' then
      return false;
    end if;
  elsif p_transform_key is null
     or p_transform_version is null
     or report_transform_version !~ '^[1-9][0-9]{0,17}$'
     or report_transform_version::bigint <> p_transform_version
     or p_report->>'transformKey' <> p_transform_key then
    return false;
  end if;
  if p_report->>'sourceCount' !~ '^[0-9][0-9]{0,17}$'
     or p_report->>'targetCount' !~ '^[0-9][0-9]{0,17}$'
     or p_report->>'rowErrorCount' !~ '^[0-9][0-9]{0,17}$'
     or p_report->>'migratedCount' !~ '^[0-9][0-9]{0,17}$'
     or p_report->>'failedCount' !~ '^[0-9][0-9]{0,17}$' then
    return false;
  end if;
  begin
    report_lease_expires_at := (p_report->'lease'->>'expiresAt')::timestamptz;
  exception when others then
    return false;
  end;
  return report_lease_expires_at is not null;
exception when others then
  return false;
end;
$function$;

-- The number of stored rows the DB itself can prove are bound to a source
-- schema version (entry revisions and publication versions).  A sealed pass
-- requires the worker's reported source count to equal this proof.
create or replace function platform_private.cms_schema_source_row_count(p_version_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $body$
  select case when p_version_id is null then 0::bigint else
    (select pg_catalog.count(*) from platform_private.cms_entry_revisions revision
      where revision.schema_version_id = p_version_id)
    + (select pg_catalog.count(*) from platform_private.cms_publication_versions publication
        where publication.schema_version_id = p_version_id)
  end
$body$;

-- Server-derived migration classification of a candidate against its source
-- (BE03a CMS-03A-10).  First versions are additive.  A removed field, a changed
-- key, kind or relation shape is breaking; a changed constraint, default,
-- localization, validator or lifecycle, a newly required field or a new
-- required field with no default is conditional; everything else is additive.
create or replace function platform_private.cms_derive_schema_classification(
  p_source_id uuid, p_target_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  result text := 'additive';
  source_field platform_private.cms_field_definition_versions%rowtype;
  target_field platform_private.cms_field_definition_versions%rowtype;
  source_relation platform_private.cms_relation_definitions%rowtype;
  target_relation platform_private.cms_relation_definitions%rowtype;
begin
  if p_source_id is null then
    return 'additive';
  end if;
  for source_field in
    select field.* from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = p_source_id
  loop
    select field.* into target_field
      from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = p_target_id
       and field.stable_field_id = source_field.stable_field_id;
    if not found
       or target_field.field_key is distinct from source_field.field_key
       or target_field.kind is distinct from source_field.kind then
      return 'breaking';
    end if;
    select relation.* into source_relation
      from platform_private.cms_relation_definitions relation
     where relation.field_definition_id = source_field.id;
    select relation.* into target_relation
      from platform_private.cms_relation_definitions relation
     where relation.field_definition_id = target_field.id;
    if (source_relation.id is null) <> (target_relation.id is null)
       or (source_relation.id is not null and (
         source_relation.target_kind is distinct from target_relation.target_kind
         or source_relation.target_type is distinct from target_relation.target_type
         or source_relation.projection_key is distinct from target_relation.projection_key
         or source_relation.cardinality is distinct from target_relation.cardinality
         or source_relation.min_count is distinct from target_relation.min_count
         or source_relation.max_count is distinct from target_relation.max_count
         or source_relation.ordered is distinct from target_relation.ordered
         or source_relation.on_unavailable is distinct from target_relation.on_unavailable
       )) then
      return 'breaking';
    end if;
    if target_field.constraints is distinct from source_field.constraints
       or (target_field.required and not source_field.required)
       or target_field.default_mode is distinct from source_field.default_mode
       or target_field.default_value is distinct from source_field.default_value
       or target_field.localization_mode is distinct from source_field.localization_mode
       or target_field.validator_key is distinct from source_field.validator_key
       or target_field.validator_version is distinct from source_field.validator_version
       or target_field.state is distinct from source_field.state then
      result := 'conditional';
    end if;
  end loop;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
     where field.content_type_version_id = p_target_id
       and field.required
       and field.default_mode = 'none'
       and not exists (
         select 1 from platform_private.cms_field_definition_versions earlier
          where earlier.content_type_version_id = p_source_id
            and earlier.stable_field_id = field.stable_field_id
       )
  ) then
    result := 'conditional';
  end if;
  return result;
end;
$body$;

-- CMS-03A-10: one command derives the evidence, supersedes any earlier live
-- attempt of the same pair, and commits the report, the plan and the BE00 job
-- together.  The plan's working record carries the derived fingerprint; the
-- report row stays unsealed until the scan seals it.
create or replace function platform_private.cms_start_schema_dry_run(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  candidate platform_private.cms_content_type_versions%rowtype;
  source_version platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  expected_version bigint;
  request_key text;
  request_version bigint;
  classification text;
  source_hash text;
  target_hash text;
  transform_hash text;
  attempt integer;
  report_id uuid := extensions.gen_random_uuid();
  plan_id uuid := extensions.gen_random_uuid();
  job_id uuid := extensions.gen_random_uuid();
  event_id uuid := extensions.gen_random_uuid();
  plan_report jsonb;
  superseded record;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-10:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return platform_private.cms_schema_dry_run_resource((reservation.response_ref->>'resourceRef')::uuid);
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','transformKey','transformVersion']::text[],
    array['contentTypeId','versionId','expectedVersion','transformKey','transformVersion',
          'idempotencyKey','ifMatch','context','correlationId']::text[]
  ) or not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if pg_catalog.jsonb_typeof(p_request->'transformKey') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_request->'transformVersion') not in ('string', 'null')
     or (pg_catalog.jsonb_typeof(p_request->'transformKey') = 'null')
        <> (pg_catalog.jsonb_typeof(p_request->'transformVersion') = 'null') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'transformKey') = 'string' then
    request_key := p_request->>'transformKey';
    if request_key !~ '^[a-z][a-z0-9._-]{0,127}$'
       or not platform_private.cms_valid_version(p_request->>'transformVersion') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    request_version := (p_request->>'transformVersion')::bigint;
  end if;
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = (p_request->>'versionId')::uuid
     and version_row.content_type_id = (p_request->>'contentTypeId')::uuid
     and version_row.owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state <> 'draft'::platform_private.cms_definition_state
     or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.supersedes_id is not null then
    select * into source_version
      from platform_private.cms_content_type_versions version_row
     where version_row.id = candidate.supersedes_id
       and version_row.content_type_id = candidate.content_type_id
       and version_row.owner_id = candidate.owner_id
     for update;
    if not found then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if source_version.state <> 'active'::platform_private.cms_definition_state then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
  end if;
  perform platform_private.cms_compile_candidate(candidate.id);
  select * into candidate from platform_private.cms_content_type_versions where id = candidate.id;
  select * into artifact_row
    from platform_private.cms_schema_artifacts artifact
   where artifact.id = candidate.schema_artifact_id
     and artifact.content_type_version_id = candidate.id
     and artifact.state = 'compiled';
  if not found or artifact_row.artifact_hash is distinct from candidate.definition_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  classification := platform_private.cms_derive_schema_classification(source_version.id, candidate.id);
  if classification = 'additive' then
    if request_key is not null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  elsif request_key is null
        or not platform_private.cms_transform_registry_member_valid(request_key, request_version) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  source_hash := coalesce(source_version.definition_hash, pg_catalog.repeat('0', 64));
  target_hash := candidate.definition_hash;
  transform_hash := platform_private.cms_migration_transform_hash(
    classification, request_key, request_version, source_hash, target_hash,
    artifact_row.artifact_hash, artifact_row.compiler_version);
  select coalesce(max(report.attempt_no), 0) + 1 into attempt
    from platform_private.cms_schema_dry_run_reports report
   where report.target_version_id = candidate.id;
  -- Earlier live attempts of this pair are retained but superseded; an
  -- attempt whose backfill already completed is immutable evidence.
  for superseded in
    select plan.id, plan.state from platform_private.cms_schema_migration_plans plan
     where plan.to_version_id = candidate.id
       and plan.from_version_id is not distinct from source_version.id
       and plan.superseded_at is null
     order by plan.created_at, plan.id
     for update
  loop
    if superseded.state = 'completed' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    update platform_private.cms_schema_migration_plans plan
       set superseded_at = pg_catalog.clock_timestamp(),
           updated_at = pg_catalog.clock_timestamp(),
           version = plan.version + 1
     where plan.id = superseded.id;
    update platform_private.cms_schema_dry_run_reports report
       set state = 'failed', failure_code = 'ATTEMPT_SUPERSEDED',
           version = report.version + 1, updated_at = pg_catalog.clock_timestamp()
     where report.plan_id = superseded.id and report.state in ('queued', 'running');
  end loop;
  plan_report := pg_catalog.jsonb_build_object(
    'dryRunId', report_id,
    'result', 'pass',
    'sourceHash', source_hash,
    'targetHash', target_hash,
    'compilerHash', artifact_row.artifact_hash,
    'compilerVersion', artifact_row.compiler_version,
    'transformHash', transform_hash,
    'sourceCount', '0', 'targetCount', '0', 'rowErrorCount', '0',
    'migratedCount', '0', 'failedCount', '0'
  ) || case when request_key is null then '{}'::jsonb
            else pg_catalog.jsonb_build_object(
              'transformKey', request_key, 'transformVersion', request_version::text) end;
  insert into platform_private.cms_schema_migration_plans(
    id, owner_id, state, version, content_type_id, from_version_id, to_version_id,
    classification, transform_key, transform_version, dry_run_report, created_by
  ) values (
    plan_id, candidate.owner_id, 'draft', 1, candidate.content_type_id, source_version.id,
    candidate.id, classification, request_key, request_version, plan_report, actor_id
  );
  select accepted.job_id into job_id
    from platform_private.accept_job_with_outbox(
      actor_id, acting_party_id, 'cms.schema.dry_run', correlation_id,
      extensions.digest(pg_catalog.convert_to('cms.schema.dry_run:' || report_id::text, 'utf8'), 'sha256'),
      extensions.digest(pg_catalog.convert_to('cms.schema.dry_run:' || plan_id::text, 'utf8'), 'sha256'),
      pg_catalog.clock_timestamp() + interval '30 days', job_id, event_id
    ) accepted;
  insert into platform_private.cms_schema_dry_run_reports(
    id, owner_id, content_type_id, source_version_id, target_version_id, classification,
    transform_key, transform_version, compiler_version, created_by, attempt_no, state,
    job_id, plan_id
  ) values (
    report_id, candidate.owner_id, candidate.content_type_id, source_version.id, candidate.id,
    classification, request_key, request_version, artifact_row.compiler_version, actor_id,
    attempt, 'queued', job_id, plan_id
  );
  update platform_private.cms_content_type_versions version_row
     set dry_run_id = report_id,
         compatibility = classification,
         version = version_row.version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where version_row.id = candidate.id and version_row.version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_emit_event(
    'cms.schema.dry_run.start', actor_id, acting_party_id, 'cms_schema_dry_run', report_id,
    'CMS_SCHEMA_DRY_RUN_STARTED', 'cms.schema.dry_run.requested.v1', 'cms_schema_dry_run',
    report_id, 1,
    pg_catalog.jsonb_build_object(
      'contentTypeId', candidate.content_type_id, 'schemaVersionId', candidate.id,
      'dryRunId', report_id, 'migrationPlanId', plan_id, 'jobId', job_id
    ), correlation_id
  );
  response := platform_private.cms_schema_dry_run_resource(report_id);
  perform platform_private.cms_complete(reservation.id, report_id, 202, response);
  return response;
end;
$body$;

create or replace function platform_api.cms_start_schema_dry_run(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_start_schema_dry_run(p_request)
$body$;


revoke all on function platform_private.cms_schema_source_row_count(uuid),
  platform_private.cms_derive_schema_classification(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_start_schema_dry_run(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_start_schema_dry_run(jsonb) to service_role;
revoke all on function platform_api.cms_start_schema_dry_run(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_start_schema_dry_run(jsonb) to service_role;

commit;
