-- BE03a real migration scan: the multi-field protocol.  A plan may change
-- several fields: the read RPC returns { rows, nextCursor, done, targetFields[],
-- retiredFields[] } (targetFields = every changed or added field of the candidate
-- with its compiled constraints, retiredFields = the fieldKeys the successor
-- removed or deprecated, whose values are carried and never validated); the
-- single targetField member and the MIGRATION_TARGET_FIELD_AMBIGUOUS refusal are
-- gone.  Both registered transforms apply per field; a retire-only plan carries
-- its rows and seals clean; the batch, backfill and verify recomputation use the
-- same per-field semantics.  A page with done = false holds exactly `limit`
-- rows.  Forward-only.
begin;

create or replace function platform_private.cms_migration_changed_fields(p_plan_id uuid)
returns setof platform_private.cms_field_definition_versions
language sql
stable
security definer
set search_path = ''
as $body$
  select target.*
    from platform_private.cms_schema_migration_plans plan
    join platform_private.cms_field_definition_versions target
      on target.content_type_version_id = plan.to_version_id
    left join platform_private.cms_field_definition_versions source
      on source.content_type_version_id = plan.from_version_id
     and source.stable_field_id = target.stable_field_id
    left join platform_private.cms_relation_definitions target_relation
      on target_relation.field_definition_id = target.id
    left join platform_private.cms_relation_definitions source_relation
      on source_relation.field_definition_id = source.id
   where plan.id = p_plan_id
     and target.state = 'active'
     and (
       (source.id is null and target.required)
       or (source.id is not null and (
         target.kind is distinct from source.kind
         or target.constraints is distinct from source.constraints
         or (target.required and not source.required)
         or target.default_mode is distinct from source.default_mode
         or target.default_value is distinct from source.default_value
         or target.validator_key is distinct from source.validator_key
         or target.validator_version is distinct from source.validator_version
         or (source_relation.id is null) <> (target_relation.id is null)
         or (source_relation.id is not null and row(
               source_relation.target_kind, source_relation.target_type,
               source_relation.projection_key, source_relation.cardinality,
               source_relation.min_count, source_relation.max_count,
               source_relation.ordered, source_relation.on_unavailable)
             is distinct from row(
               target_relation.target_kind, target_relation.target_type,
               target_relation.projection_key, target_relation.cardinality,
               target_relation.min_count, target_relation.max_count,
               target_relation.ordered, target_relation.on_unavailable))
       ))
     )
   order by target.field_key
$body$;


-- Fields the successor removed or deprecated: an active source field with no
-- active counterpart (same stable id) in the target version.  Their stored
-- values are carried unvalidated.
create or replace function platform_private.cms_migration_retired_fields(p_plan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(pg_catalog.jsonb_agg(source.field_key order by source.field_key), '[]'::jsonb)
    from platform_private.cms_schema_migration_plans plan
    join platform_private.cms_field_definition_versions source
      on source.content_type_version_id = plan.from_version_id
   where plan.id = p_plan_id
     and plan.transform_key is not null
     and source.state = 'active'
     and not exists (
       select 1 from platform_private.cms_field_definition_versions target
        where target.content_type_version_id = plan.to_version_id
          and target.stable_field_id = source.stable_field_id
          and target.state = 'active')
$body$;

-- The multi-field spec of a transform plan as the worker protocol carries it
-- (plus each target field's internal stableFieldId): { targetFields[],
-- retiredFields[] }.  NULL for a plan with no transform (additive).
create or replace function platform_private.cms_migration_target_fields_spec(p_plan_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  relation_row platform_private.cms_relation_definitions%rowtype;
  compiled_constraints jsonb;
  fields jsonb := '[]'::jsonb;
begin
  select * into plan_row from platform_private.cms_schema_migration_plans plan where plan.id = p_plan_id;
  if not found or plan_row.transform_key is null then
    return null;
  end if;
  for field_row in select * from platform_private.cms_migration_changed_fields(p_plan_id) loop
    relation_row := null;
    select * into relation_row
      from platform_private.cms_relation_definitions relation
     where relation.field_definition_id = field_row.id;
    compiled_constraints := coalesce(field_row.constraints, '{}'::jsonb)
      || case when field_row.validator_key is not null
           then pg_catalog.jsonb_build_object(
             'validatorKey', field_row.validator_key,
             'validatorVersion', field_row.validator_version::text)
           else '{}'::jsonb end
      || case when relation_row.id is not null
           then pg_catalog.jsonb_build_object('relation', pg_catalog.jsonb_build_object(
             'fieldId', field_row.stable_field_id,
             'targetKind', relation_row.target_kind,
             'targetType', relation_row.target_type,
             'projectionKey', relation_row.projection_key,
             'cardinality', relation_row.cardinality,
             'min', relation_row.min_count,
             'max', relation_row.max_count,
             'ordered', relation_row.ordered,
             'onUnavailable', relation_row.on_unavailable))
           else '{}'::jsonb end;
    fields := fields || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'stableFieldId', field_row.stable_field_id,
      'fieldKey', field_row.field_key,
      'kind', field_row.kind,
      'required', field_row.required,
      'defaultMode', field_row.default_mode,
      'defaultValue', field_row.default_value,
      'constraints', compiled_constraints));
  end loop;
  return pg_catalog.jsonb_build_object(
    'targetFields', fields,
    'retiredFields', platform_private.cms_migration_retired_fields(p_plan_id));
end;
$body$;

-- True when every target field's kind is accepted by the registered member.
create or replace function platform_private.cms_migration_spec_kinds_accepted(
  p_member jsonb, p_spec jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select p_spec is null or not exists (
    select 1 from pg_catalog.jsonb_array_elements(coalesce(p_spec->'targetFields', '[]'::jsonb)) field(value)
     where not ((p_member->'acceptedFieldKinds') ? (field.value->>'kind')))
$body$;

-- The registered executor contract of the two code-owned members over the
-- multi-field spec: the target document a row maps to, or NULL when the member
-- cannot prove the row (any target field refuses it, an unavailable literal
-- default, a spec with neither target nor retired fields).  A null key is the
-- additive no-transform carry; a retire-only spec carries the row.
create or replace function platform_private.cms_migration_expected_output(
  p_key text, p_target_version_id uuid, p_spec jsonb, p_document jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  fields jsonb := coalesce(p_spec->'targetFields', '[]'::jsonb);
  retired jsonb := coalesce(p_spec->'retiredFields', '[]'::jsonb);
  field jsonb;
  field_key text;
  present jsonb;
  result jsonb := p_document;
begin
  if p_key is null then
    return p_document;
  end if;
  if p_key not in ('identity.revalidate', 'default.fill_literal') or p_spec is null then
    return null;
  end if;
  if pg_catalog.jsonb_array_length(fields) = 0 then
    if pg_catalog.jsonb_array_length(retired) > 0 then
      return p_document;
    end if;
    return null;
  end if;
  if p_key = 'identity.revalidate' then
    for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
      if not platform_private.cms_migration_value_valid(p_target_version_id, field, p_document) then
        return null;
      end if;
    end loop;
    return p_document;
  end if;
  for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
    if field->>'defaultMode' is distinct from 'literal'
       or field->'defaultValue' is null
       or pg_catalog.jsonb_typeof(field->'defaultValue') = 'null' then
      return null;
    end if;
  end loop;
  for field in select entry.value from pg_catalog.jsonb_array_elements(fields) entry loop
    field_key := field->>'fieldKey';
    present := result -> field_key;
    if present is null or pg_catalog.jsonb_typeof(present) = 'null' then
      result := result || pg_catalog.jsonb_build_object(field_key, field->'defaultValue');
    end if;
  end loop;
  return result;
end;
$body$;

create or replace function platform_private.cms_read_schema_migration_source_rows(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
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
  if platform_private.cms_schema_source_row_count(plan_row.from_version_id) <> plan_row.source_count then
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
        from platform_private.cms_migration_live_rows(plan_row.from_version_id) candidate
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
  spec := platform_private.cms_migration_target_fields_spec(p_plan.id);
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

create or replace function platform_private.cms_migration_scan_preflight(p_plan_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  member jsonb;
  spec jsonb;
begin
  select * into plan_row from platform_private.cms_schema_migration_plans plan where plan.id = p_plan_id;
  if not found or plan_row.transform_key is null then
    return;
  end if;
  member := platform_private.cms_transform_registry_member(
    plan_row.transform_key, plan_row.transform_version);
  if member is null then
    raise exception 'VALIDATION_FAILED'
      using detail = 'TRANSFORM_NOT_REGISTERED', errcode = 'P0001';
  end if;
  spec := platform_private.cms_migration_target_fields_spec(p_plan_id);
  if not platform_private.cms_migration_spec_kinds_accepted(member, spec) then
    raise exception 'VALIDATION_FAILED'
      using detail = 'TRANSFORM_FIELD_KIND_MISMATCH', errcode = 'P0001';
  end if;
end;
$body$;


drop function platform_private.cms_migration_target_field_spec(uuid);

revoke all on function platform_private.cms_migration_changed_fields(uuid),
  platform_private.cms_migration_retired_fields(uuid),
  platform_private.cms_migration_target_fields_spec(uuid),
  platform_private.cms_migration_spec_kinds_accepted(jsonb, jsonb),
  platform_private.cms_migration_expected_output(text, uuid, jsonb, jsonb),
  platform_private.cms_read_schema_migration_source_rows(jsonb),
  platform_private.cms_process_schema_migration_batch(jsonb, boolean),
  platform_private.cms_migration_verify_reason(platform_private.cms_schema_migration_plans),
  platform_private.cms_migration_scan_preflight(uuid)
  from public, anon, authenticated, service_role;

commit;
