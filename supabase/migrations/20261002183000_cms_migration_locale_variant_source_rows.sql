-- BE03a "Locale variant source rows" (AC-1197): a breaking locale-configuration
-- change scans the affected cms_locale_variants rows through the real worker
-- protocol, in addition to the entry revisions and publication versions bound to
-- the source version.  A variant is affected when its locale is removed from the
-- target's supportedLocales, or when its locale's retained fallback chain differs
-- between the source and target versions (the same two predicates that classify
-- the successor breaking).  The source set therefore depends on the pair
-- (source version, target version): cms_migration_live_rows and
-- cms_schema_source_row_count take both, every plan reader passes the plan's
-- from_version_id and to_version_id, and the plan, the read pages, the evidence,
-- the sealed counts and the target rows include variant rows.  An additive or
-- locale-neutral successor affects no variant.  The single-argument variants are
-- dropped so no caller can count the narrower set.  Forward-only.
begin;

alter table platform_private.cms_schema_dry_run_row_evidence
  drop constraint cms_schema_dry_run_row_evidence_source_table_check,
  add constraint cms_schema_dry_run_row_evidence_source_table_check check (
    source_table in ('cms_entry_revisions', 'cms_publication_versions', 'cms_locale_variants'));
alter table platform_private.cms_schema_migration_target_rows
  drop constraint cms_schema_migration_target_rows_table_check,
  add constraint cms_schema_migration_target_rows_table_check check (
    source_table in ('cms_entry_revisions', 'cms_publication_versions', 'cms_locale_variants'));

create function platform_private.cms_migration_affected_variants(p_from_version_id uuid, p_to_version_id uuid)
returns table (variant_id uuid, revision_id uuid)
language sql
stable
security definer
set search_path = ''
as $body$
  select variant.id, variant.revision_id
    from platform_private.cms_content_type_versions source_version
    join platform_private.cms_content_type_versions target_version
      on target_version.id = p_to_version_id
    join platform_private.cms_entry_revisions revision
      on revision.schema_version_id = source_version.id
    join platform_private.cms_locale_variants variant
      on variant.revision_id = revision.id
   where source_version.id = p_from_version_id
     and source_version.locale_config_hash is distinct from target_version.locale_config_hash
     and (
       not (target_version.supported_locales ? variant.locale)
       or (source_version.fallback_chains -> variant.locale is not null
           and target_version.fallback_chains -> variant.locale
               is distinct from source_version.fallback_chains -> variant.locale)
     )
$body$;

create function platform_private.cms_migration_live_rows(p_from_version_id uuid, p_to_version_id uuid)
returns table (source_table text, source_row_id uuid, revision_id uuid)
language sql
stable
security definer
set search_path = ''
as $body$
  select 'cms_entry_revisions'::text, revision.id, revision.id
    from platform_private.cms_entry_revisions revision
   where revision.schema_version_id = p_from_version_id
  union all
  select 'cms_publication_versions'::text, publication.id, publication.revision_id
    from platform_private.cms_publication_versions publication
   where publication.schema_version_id = p_from_version_id
  union all
  select 'cms_locale_variants'::text, affected.variant_id, affected.revision_id
    from platform_private.cms_migration_affected_variants(p_from_version_id, p_to_version_id) affected
$body$;

create function platform_private.cms_schema_source_row_count(p_from_version_id uuid, p_to_version_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $body$
  select case when p_from_version_id is null then 0::bigint else
    (select pg_catalog.count(*) from platform_private.cms_migration_live_rows(p_from_version_id, p_to_version_id))
  end
$body$;

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
  source_total := platform_private.cms_schema_source_row_count(source_version.id, candidate.id);
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
  actual_source_count := platform_private.cms_schema_source_row_count(plan_row.from_version_id, plan_row.to_version_id);
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

CREATE OR REPLACE FUNCTION platform_private.cms_migration_source_unchanged(p_plan platform_private.cms_schema_migration_plans)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_plan.source_count = (
           select pg_catalog.count(*)
             from platform_private.cms_migration_live_rows(p_plan.from_version_id, p_plan.to_version_id))
     and p_plan.source_count = (
           select pg_catalog.count(*)
             from platform_private.cms_schema_dry_run_row_evidence evidence
            where evidence.plan_id = p_plan.id)
     and not exists (
           select 1
             from platform_private.cms_migration_live_rows(p_plan.from_version_id, p_plan.to_version_id) live
            where not exists (
              select 1 from platform_private.cms_schema_dry_run_row_evidence evidence
               where evidence.plan_id = p_plan.id
                 and evidence.source_table = live.source_table
                 and evidence.source_row_id = live.source_row_id
                 and evidence.source_hash::text = platform_private.cms_jcs_sha256(
                   platform_private.cms_migration_revision_document(live.revision_id))))
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_process_schema_migration_batch(p_request jsonb, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  keys constant text[] := array[
    'migrationPlanId', 'schemaVersionId', 'expectedVersion', 'cursor', 'limit',
    'leaseToken', 'rowEvidence', 'transformKey', 'transformVersion', 'compilerHash',
    'sourceHash', 'targetHash', 'correlationId', 'causationId'
  ]::text[];
  evidence_keys constant text[] := array[
    'sourceTable', 'sourceRowId', 'sourceHash', 'outputHash', 'errorCode'
  ]::text[];
  plan_id uuid;
  schema_version_id uuid;
  expected_version bigint;
  current_cursor bigint;
  batch_limit bigint;
  page_size bigint;
  row_index integer := 0;
  now_at timestamptz := pg_catalog.clock_timestamp();
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  dry_row platform_private.cms_schema_dry_run_row_evidence%rowtype;
  report_id uuid;
  member jsonb;
  spec jsonb;
  evidence jsonb;
  item jsonb;
  live record;
  document jsonb;
  document_hash text;
  expected_document jsonb;
  passed bigint := 0;
  errored bigint := 0;
  next_cursor bigint;
  next_target_count bigint;
  next_row_error_count bigint;
  next_migrated_count bigint;
  next_failed_count bigint;
  next_progress numeric(9, 6);
  done boolean;
begin
  perform platform_private.cms_worker_require_scan_request(p_request, keys);
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  current_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  batch_limit := platform_private.cms_worker_counter(p_request->>'limit');
  if batch_limit not between 1 and 128 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if p_request->>'correlationId' is null
     or not platform_private.cms_valid_uuid(p_request->>'correlationId')
     or (p_request->'causationId' <> 'null'::jsonb
       and not platform_private.cms_valid_uuid(p_request->>'causationId')) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  evidence := p_request->'rowEvidence';
  if pg_catalog.jsonb_typeof(evidence) is distinct from 'array'
     or pg_catalog.jsonb_array_length(evidence) > batch_limit then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.to_version_id <> schema_version_id
     or plan_row.version <> expected_version
     or plan_row.cursor <> current_cursor then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if p_dry_run and plan_row.state <> 'dry_running'
     or not p_dry_run and plan_row.state <> 'running' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_migration_source_evidence_valid(plan_row) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_SOURCE_EVIDENCE_REQUIRED', errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row, p_request->>'leaseToken', null, now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  if current_cursor > plan_row.source_count then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if plan_row.transform_key is not null then
    member := platform_private.cms_transform_registry_member(
      plan_row.transform_key, plan_row.transform_version);
    if member is null then
      raise exception 'VALIDATION_FAILED'
        using detail = 'TRANSFORM_NOT_REGISTERED', errcode = 'P0001';
    end if;
  end if;
  if platform_private.cms_schema_source_row_count(plan_row.from_version_id, plan_row.to_version_id) <> plan_row.source_count then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  spec := platform_private.cms_migration_target_fields_spec(plan_id);
  if not platform_private.cms_migration_spec_kinds_accepted(member, spec) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'TRANSFORM_FIELD_KIND_MISMATCH', errcode = 'P0001';
  end if;
  page_size := least(batch_limit, plan_row.source_count - current_cursor);
  if pg_catalog.jsonb_array_length(evidence) <> page_size then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_EVIDENCE_COUNT', errcode = 'P0001';
  end if;
  select report.id into report_id
    from platform_private.cms_schema_dry_run_reports report
   where report.plan_id = plan_row.id;
  if report_id is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  for live in
    select candidate.source_table, candidate.source_row_id, candidate.revision_id
      from platform_private.cms_migration_live_rows(plan_row.from_version_id, plan_row.to_version_id) candidate
     order by candidate.source_table, candidate.source_row_id
    offset current_cursor limit page_size
  loop
    item := evidence -> row_index;
    row_index := row_index + 1;
    if pg_catalog.jsonb_typeof(item) is distinct from 'object'
       or not platform_private.cms_exact_keys(item, evidence_keys, evidence_keys)
       or pg_catalog.jsonb_typeof(item->'sourceTable') is distinct from 'string'
       or pg_catalog.jsonb_typeof(item->'sourceRowId') is distinct from 'string'
       or not platform_private.cms_valid_uuid(item->>'sourceRowId')
       or (item->>'sourceHash') !~ '^[a-f0-9]{64}$'
       or ((item->'outputHash') <> 'null'::jsonb and (item->>'outputHash') !~ '^[a-f0-9]{64}$')
       or ((item->'errorCode') <> 'null'::jsonb and (item->>'errorCode') !~ '^[A-Z][A-Z0-9_]{0,63}$')
       or ((item->'outputHash') = 'null'::jsonb) = ((item->'errorCode') = 'null'::jsonb) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if item->>'sourceTable' <> live.source_table
       or (item->>'sourceRowId')::uuid <> live.source_row_id then
      raise exception 'VALIDATION_FAILED'
        using detail = 'MIGRATION_EVIDENCE_ROW', errcode = 'P0001';
    end if;
    document := platform_private.cms_migration_revision_document(live.revision_id);
    document_hash := platform_private.cms_jcs_sha256(document);
    if item->>'sourceHash' <> document_hash then
      raise exception 'VALIDATION_FAILED'
        using detail = 'MIGRATION_SOURCE_HASH_MISMATCH', errcode = 'P0001';
    end if;
    expected_document := null;
    if item->>'errorCode' is null then
      -- A pass the registered executor contract cannot prove is refused; an
      -- error the worker reports is always accepted (it fails closed).
      expected_document := platform_private.cms_migration_expected_output(
        plan_row.transform_key, plan_row.to_version_id, spec, document);
      if expected_document is null then
        raise exception 'VALIDATION_FAILED'
          using detail = 'MIGRATION_EVIDENCE_UNPROVEN', errcode = 'P0001';
      end if;
      if item->>'outputHash' <> platform_private.cms_jcs_sha256(expected_document) then
        raise exception 'VALIDATION_FAILED'
          using detail = 'MIGRATION_OUTPUT_HASH_MISMATCH', errcode = 'P0001';
      end if;
    end if;
    if p_dry_run then
      insert into platform_private.cms_schema_dry_run_row_evidence(
        report_id, plan_id, source_table, source_row_id, source_hash, output_hash, error_code
      ) values (
        report_id, plan_row.id, live.source_table, live.source_row_id, document_hash,
        item->>'outputHash', item->>'errorCode'
      );
    else
      select * into dry_row
        from platform_private.cms_schema_dry_run_row_evidence evidence_row
       where evidence_row.plan_id = plan_row.id
         and evidence_row.source_table = live.source_table
         and evidence_row.source_row_id = live.source_row_id;
      if not found or dry_row.source_hash::text <> document_hash then
        raise exception 'VALIDATION_FAILED'
          using detail = 'MIGRATION_EVIDENCE_DRIFT', errcode = 'P0001';
      end if;
      if item->>'errorCode' is null then
        if dry_row.error_code is not null
           or dry_row.output_hash::text is distinct from item->>'outputHash' then
          raise exception 'VALIDATION_FAILED'
            using detail = 'MIGRATION_EVIDENCE_DRIFT', errcode = 'P0001';
        end if;
        insert into platform_private.cms_schema_migration_target_rows(
          owner_id, plan_id, target_version_id, source_table, source_row_id,
          source_hash, output_hash, target_document
        ) values (
          plan_row.owner_id, plan_row.id, plan_row.to_version_id, live.source_table,
          live.source_row_id, document_hash, item->>'outputHash', expected_document
        );
      end if;
    end if;
    if item->>'errorCode' is null then
      passed := passed + 1;
    else
      errored := errored + 1;
    end if;
  end loop;

  next_cursor := current_cursor + page_size;
  next_target_count := plan_row.target_count + case when p_dry_run then passed else 0 end;
  next_row_error_count := plan_row.row_error_count + case when p_dry_run then errored else 0 end;
  next_migrated_count := plan_row.migrated_count + case when p_dry_run then 0 else passed end;
  next_failed_count := plan_row.failed_count + case when p_dry_run then 0 else errored end;
  next_progress := case when plan_row.source_count = 0 then 1
    else least(1, next_cursor::numeric / plan_row.source_count::numeric) end;
  done := next_cursor >= plan_row.source_count;
  update platform_private.cms_schema_migration_plans
     set cursor = next_cursor,
         progress = next_progress,
         target_count = next_target_count,
         row_error_count = next_row_error_count,
         migrated_count = next_migrated_count,
         failed_count = next_failed_count,
         updated_at = now_at,
         dry_run_report = platform_private.cms_worker_set_report(
           dry_run_report,
           case when p_dry_run then 'leased' else 'running' end,
           dry_run_report->'lease'->>'owner',
           dry_run_report->'lease'->>'token',
           (dry_run_report->'lease'->>'expiresAt')::timestamptz,
           plan_row.source_count, next_target_count, next_row_error_count,
           next_migrated_count, next_failed_count
         )
   where id = plan_id and version = expected_version and cursor = current_cursor;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'done', done,
    'cursor', next_cursor::text,
    'progress', next_progress,
    'sourceCount', plan_row.source_count::text,
    'targetCount', next_target_count::text,
    'rowErrorCount', next_row_error_count::text,
    'migratedCount', next_migrated_count::text,
    'failedCount', next_failed_count::text
  );
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_read_schema_migration_source_rows(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  keys constant text[] := array[
    'migrationPlanId', 'expectedVersion', 'cursor', 'limit', 'leaseToken'
  ]::text[];
  plan_id uuid;
  expected_version bigint;
  current_cursor bigint;
  batch_limit bigint;
  page_size bigint;
  now_at timestamptz := pg_catalog.clock_timestamp();
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  spec jsonb;
  member jsonb;
  page jsonb;
  page_count bigint;
begin
  perform platform_private.cms_worker_require_request(p_request, keys, keys);
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  current_cursor := platform_private.cms_worker_counter(p_request->>'cursor');
  batch_limit := platform_private.cms_worker_counter(p_request->>'limit');
  if batch_limit not between 1 and 128 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.version <> expected_version
     or plan_row.cursor <> current_cursor
     or plan_row.state not in ('dry_running', 'running')
     or plan_row.superseded_at is not null then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_worker_lease_valid(
    plan_row, p_request->>'leaseToken', null, now_at
  ) then
    raise exception 'LEASE_EXPIRED' using errcode = 'P0001';
  end if;
  if plan_row.transform_key is not null then
    member := platform_private.cms_transform_registry_member(
      plan_row.transform_key, plan_row.transform_version);
    if member is null then
      raise exception 'VALIDATION_FAILED'
        using detail = 'TRANSFORM_NOT_REGISTERED', errcode = 'P0001';
    end if;
  end if;
  if platform_private.cms_schema_source_row_count(plan_row.from_version_id, plan_row.to_version_id) <> plan_row.source_count then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  spec := platform_private.cms_migration_target_fields_spec(plan_id);
  if not platform_private.cms_migration_spec_kinds_accepted(member, spec) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'TRANSFORM_FIELD_KIND_MISMATCH', errcode = 'P0001';
  end if;
  page_size := least(batch_limit, plan_row.source_count - current_cursor);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'sourceTable', live.source_table,
           'sourceRowId', live.source_row_id,
           'sourceHash', platform_private.cms_jcs_sha256(document.value),
           'document', document.value
         ) order by live.source_table, live.source_row_id), '[]'::jsonb),
         pg_catalog.count(*)
    into page, page_count
    from (
      select candidate.source_table, candidate.source_row_id, candidate.revision_id
        from platform_private.cms_migration_live_rows(plan_row.from_version_id, plan_row.to_version_id) candidate
       order by candidate.source_table, candidate.source_row_id
      offset current_cursor limit page_size
    ) live
    cross join lateral (
      select platform_private.cms_migration_revision_document(live.revision_id) as value
    ) document;
  -- A page that is not the last holds exactly `limit` rows; a shorter page
  -- means the live set changed under the read.
  if page_count <> page_size then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  return pg_catalog.jsonb_build_object(
    'rows', page,
    'nextCursor', (current_cursor + page_count)::text,
    'done', current_cursor + page_count >= plan_row.source_count,
    'targetFields', coalesce((
      select pg_catalog.jsonb_agg(field.value - 'stableFieldId' order by field.value->>'fieldKey')
        from pg_catalog.jsonb_array_elements(coalesce(spec->'targetFields', '[]'::jsonb)) field(value)
    ), '[]'::jsonb),
    'retiredFields', coalesce(spec->'retiredFields', '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_migration_verify_reason(p_plan platform_private.cms_schema_migration_plans)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  spec jsonb;
  mismatched bigint;
begin
  if p_plan.row_error_count > 0 or p_plan.failed_count > 0
     or p_plan.cursor <> p_plan.source_count
     or p_plan.migrated_count <> p_plan.target_count then
    return 'MIGRATION_COUNTER_ERROR';
  end if;
  if not platform_private.cms_migration_source_unchanged(p_plan) then
    return 'MIGRATION_SOURCE_DRIFT';
  end if;
  spec := platform_private.cms_migration_target_fields_spec(p_plan.id);
  select pg_catalog.count(*) into mismatched
    from platform_private.cms_migration_live_rows(p_plan.from_version_id, p_plan.to_version_id) live
    left join platform_private.cms_schema_migration_target_rows target
      on target.plan_id = p_plan.id
     and target.source_table = live.source_table
     and target.source_row_id = live.source_row_id
    left join platform_private.cms_schema_dry_run_row_evidence evidence
      on evidence.plan_id = p_plan.id
     and evidence.source_table = live.source_table
     and evidence.source_row_id = live.source_row_id
   where target.id is null
      or evidence.id is null
      or evidence.error_code is not null
      or target.output_hash is distinct from evidence.output_hash
      or target.source_hash is distinct from evidence.source_hash
      or target.output_hash::text is distinct from platform_private.cms_jcs_sha256(target.target_document)
      or target.target_document is distinct from platform_private.cms_migration_expected_output(
           p_plan.transform_key, p_plan.to_version_id, spec,
           platform_private.cms_migration_revision_document(live.revision_id));
  if mismatched > 0 then
    return 'MIGRATION_TARGET_MISMATCH';
  end if;
  return null;
end;
$function$;

drop function platform_private.cms_schema_source_row_count(uuid);
drop function platform_private.cms_migration_live_rows(uuid);

revoke all on function platform_private.cms_migration_affected_variants(uuid, uuid),
  platform_private.cms_migration_live_rows(uuid, uuid),
  platform_private.cms_schema_source_row_count(uuid, uuid)
  from public, anon, authenticated, service_role;

commit;
