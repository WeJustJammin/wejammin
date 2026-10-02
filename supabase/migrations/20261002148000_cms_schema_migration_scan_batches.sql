-- BE03a real migration scan, DB side (2/2): the bounded batch processor now
-- derives every counter from per-row evidence and persists it, replacing the
-- counter arithmetic and the all-zero source-evidence guard together.
--
-- Request: the existing batch envelope plus `rowEvidence` (at most 128 entries
-- {sourceTable, sourceRowId, sourceHash, outputHash|null, errorCode|null} in
-- source order).  The database recomputes the source document and hash of every
-- row it serves, refuses a pass it can prove false, and:
--   * dry run  -> appends cms_schema_dry_run_row_evidence rows and derives
--                 target_count / row_error_count;
--   * backfill -> replays the batch against the sealed dry-run evidence and
--                 writes cms_schema_migration_target_rows from the registered
--                 executor contract (the worker posts evidence only), deriving
--                 migrated_count / failed_count.
-- Caller counters are never trusted.  Forward-only.
begin;

-- Evidence/counter consistency of a plan (replaces the all-zero guard): the
-- cursor, the append-only per-row evidence and the target rows must account for
-- exactly the plan's counters.
create or replace function platform_private.cms_migration_source_evidence_valid(
  p_plan platform_private.cms_schema_migration_plans
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select p_plan.cursor <= p_plan.source_count
     and p_plan.target_count + p_plan.row_error_count <= p_plan.source_count
     and p_plan.migrated_count + p_plan.failed_count <= p_plan.source_count
     and (select pg_catalog.count(*)
            from platform_private.cms_schema_dry_run_row_evidence evidence
           where evidence.plan_id = p_plan.id)
         = p_plan.target_count + p_plan.row_error_count
     and (select pg_catalog.count(*)
            from platform_private.cms_schema_dry_run_row_evidence evidence
           where evidence.plan_id = p_plan.id and evidence.error_code is not null)
         = p_plan.row_error_count
     and (select pg_catalog.count(*)
            from platform_private.cms_schema_migration_target_rows target
           where target.plan_id = p_plan.id)
         = p_plan.migrated_count
$body$;

-- True when the live source rows are exactly the rows the sealed dry run
-- scanned, byte for byte (same set, same recomputed source hashes).
create or replace function platform_private.cms_migration_source_unchanged(
  p_plan platform_private.cms_schema_migration_plans
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $body$
  select p_plan.source_count = (
           select pg_catalog.count(*)
             from platform_private.cms_migration_live_rows(p_plan.from_version_id))
     and p_plan.source_count = (
           select pg_catalog.count(*)
             from platform_private.cms_schema_dry_run_row_evidence evidence
            where evidence.plan_id = p_plan.id)
     and not exists (
           select 1
             from platform_private.cms_migration_live_rows(p_plan.from_version_id) live
            where not exists (
              select 1 from platform_private.cms_schema_dry_run_row_evidence evidence
               where evidence.plan_id = p_plan.id
                 and evidence.source_table = live.source_table
                 and evidence.source_row_id = live.source_row_id
                 and evidence.source_hash::text = platform_private.cms_jcs_sha256(
                   platform_private.cms_migration_revision_document(live.revision_id))))
$body$;

-- Reason code a backfilled plan cannot verify, or NULL when every target row
-- equals the registered-executor recomputation over the unchanged source.
create or replace function platform_private.cms_migration_verify_reason(
  p_plan platform_private.cms_schema_migration_plans
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
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
  spec := platform_private.cms_migration_target_field_spec(p_plan.id);
  select pg_catalog.count(*) into mismatched
    from platform_private.cms_migration_live_rows(p_plan.from_version_id) live
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
$body$;

-- Scan batches carry up to 128 evidence rows, so the worker envelope bound is
-- wider than the 16 KiB default; every other rule is the shared envelope rule.
create or replace function platform_private.cms_worker_require_scan_request(
  p_request jsonb, p_keys text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_require_release_worker();
  if not platform_private.cms_json_bounded(p_request, 262144, 8, 64, 128)
     or not platform_private.cms_exact_keys(p_request, p_keys, p_keys) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
end;
$body$;

create or replace function platform_private.cms_process_schema_migration_batch(
  p_request jsonb, p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
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
  if platform_private.cms_schema_source_row_count(plan_row.from_version_id) <> plan_row.source_count then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  spec := platform_private.cms_migration_target_field_spec(plan_id);
  if spec is not null and not ((member->'acceptedFieldKinds') ? (spec->>'kind')) then
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
      from platform_private.cms_migration_live_rows(plan_row.from_version_id) candidate
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
$body$;

revoke all on function platform_private.cms_migration_source_evidence_valid(platform_private.cms_schema_migration_plans),
  platform_private.cms_migration_source_unchanged(platform_private.cms_schema_migration_plans),
  platform_private.cms_migration_verify_reason(platform_private.cms_schema_migration_plans),
  platform_private.cms_worker_require_scan_request(jsonb, text[])
  from public, anon, authenticated, service_role;

commit;
