-- BE03a CMS-03A-10 (P2-S09-AC-347): a new dry-run attempt supersedes an earlier
-- pre-running plan of the version pair but returns 409 CONFLICT while an earlier
-- plan is running, verifying or failed_retryable and its scanned source is
-- unchanged.  The previous definition superseded every non-completed plan, so a
-- worker-owned backfill could be abandoned by a second attempt.  Source drift
-- keeps its documented recovery.  Forward-only.
begin;

CREATE OR REPLACE FUNCTION platform_private.cms_start_schema_dry_run(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  source_total bigint;
  superseded record;
  frozen_plan platform_private.cms_schema_migration_plans%rowtype;
  completed_plan platform_private.cms_schema_migration_plans%rowtype;
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
  if candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.state in (
    'review'::platform_private.cms_definition_state,
    'approved'::platform_private.cms_definition_state
  ) then
    -- Drift recovery: a frozen candidate may start a new attempt only when the
    -- source its live scan evidence rests on has since changed.
    select plan.* into frozen_plan
      from platform_private.cms_schema_dry_run_reports report
      join platform_private.cms_schema_migration_plans plan on plan.id = report.plan_id
     where report.id = candidate.dry_run_id;
    if not found
       or frozen_plan.superseded_at is not null
       or platform_private.cms_migration_source_unchanged(frozen_plan) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    perform platform_private.cms_invalidate_activation_reviews(candidate.id);
    select * into candidate from platform_private.cms_content_type_versions
     where id = candidate.id;
    expected_version := candidate.version;
  end if;
  if candidate.state <> 'draft'::platform_private.cms_definition_state then
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
  source_total := platform_private.cms_schema_source_row_count(source_version.id);
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
    -- A completed attempt is immutable evidence of the exact attempt it
    -- recorded.  It stands (the request is refused: there is nothing new to
    -- prove) only while EVERY persisted fingerprint still matches the freshly
    -- computed one: the scanned source rows and source hash, the target
    -- definition, the compiler and artifact identity, the classification and
    -- the registered transform pair with its hash.  Any difference (rows
    -- created after the scan, a target edit, a different transform) makes the
    -- sealed evidence describe a different migration, so it is superseded and a
    -- fresh attempt is created rather than stranding the candidate behind it.
    -- BE03a "Canonical records and fields": an earlier plan that has reached
    -- running, verifying or failed_retryable is a worker-owned attempt; a new
    -- attempt never supersedes it (409 CONFLICT) while the scanned source is
    -- unchanged.  A drifted source is the one recovery (BE03a "Source drift"):
    -- the in-flight evidence no longer describes the migration and is superseded.
    if superseded.state in ('running', 'verifying', 'failed_retryable') then
      select * into completed_plan
        from platform_private.cms_schema_migration_plans old_plan
       where old_plan.id = superseded.id;
      if platform_private.cms_migration_source_unchanged(completed_plan) then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
    end if;
    if superseded.state = 'completed' then
      select * into completed_plan
        from platform_private.cms_schema_migration_plans old_plan
       where old_plan.id = superseded.id;
      if platform_private.cms_migration_source_unchanged(completed_plan)
         and completed_plan.source_count is not distinct from source_total
         and completed_plan.classification is not distinct from classification
         and completed_plan.transform_key is not distinct from request_key
         and completed_plan.transform_version is not distinct from request_version
         and completed_plan.dry_run_report->>'sourceHash' is not distinct from source_hash
         and completed_plan.dry_run_report->>'targetHash' is not distinct from target_hash
         and completed_plan.dry_run_report->>'compilerHash' is not distinct from artifact_row.artifact_hash
         and completed_plan.dry_run_report->>'compilerVersion' is not distinct from artifact_row.compiler_version
         and completed_plan.dry_run_report->>'transformHash' is not distinct from transform_hash then
        raise exception 'CONFLICT' using errcode = 'P0001';
      end if;
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
    'sourceCount', source_total::text, 'targetCount', '0', 'rowErrorCount', '0',
    'migratedCount', '0', 'failedCount', '0'
  ) || case when request_key is null then '{}'::jsonb
            else pg_catalog.jsonb_build_object(
              'transformKey', request_key, 'transformVersion', request_version::text) end;
  insert into platform_private.cms_schema_migration_plans(
    id, owner_id, state, version, content_type_id, from_version_id, to_version_id,
    classification, transform_key, transform_version, dry_run_report, created_by,
    source_count
  ) values (
    plan_id, candidate.owner_id, 'draft', 1, candidate.content_type_id, source_version.id,
    candidate.id, classification, request_key, request_version, plan_report, actor_id,
    source_total
  );
  -- A transform plan over affected rows must name exactly one target field the
  -- registered member accepts; the same proof the scan repeats row by row.
  if request_key is not null and source_total > 0 then
    perform platform_private.cms_migration_scan_preflight(plan_id);
  end if;
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
$function$;

revoke all on function platform_private.cms_start_schema_dry_run(jsonb)
  from public, anon, authenticated, service_role;

commit;
