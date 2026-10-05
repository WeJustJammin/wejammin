-- BE03a real migration scan, DB side (1/2): the affected source rows, their
-- canonical documents and hashes, the registered-transform executor contract,
-- the private append-only target-row table, and the service-role source-row
-- read RPC the migration worker pages through.
--
-- A source row is an immutable cms_entry_revisions row or cms_publication_versions
-- row bound to the plan's source version (the same set cms_schema_source_row_count
-- counts).  Its document is keyed by the SOURCE field key and carries the stored
-- value of every field of the revision (relation fields carry their relation
-- rows); the source hash is the lowercase SHA-256 of the RFC 8785/JCS canonical
-- JSON of that document and is always computed here, never taken from a caller.
-- Rows are served in the total order (source_table, source_row_id) in bounded
-- pages of at most 128.  Forward-only.
begin;

create table platform_private.cms_schema_migration_target_rows (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  plan_id uuid not null references platform_private.cms_schema_migration_plans(id),
  target_version_id uuid not null references platform_private.cms_content_type_versions(id),
  source_table text not null,
  source_row_id uuid not null,
  source_hash char(64) not null,
  output_hash char(64) not null,
  target_document jsonb not null,
  written_at timestamptz not null default clock_timestamp(),
  constraint cms_schema_migration_target_rows_table_check check (
    source_table in ('cms_entry_revisions', 'cms_publication_versions')
  ),
  constraint cms_schema_migration_target_rows_source_hash_check check (source_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_migration_target_rows_output_hash_check check (output_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_migration_target_rows_document_check check (
    pg_catalog.jsonb_typeof(target_document) = 'object'
    and platform_private.cms_json_bounded(target_document, 786432, 12, 256, 1024)
  ),
  constraint cms_schema_migration_target_rows_row_unique unique (plan_id, source_table, source_row_id)
);
create index cms_schema_migration_target_rows_plan_idx
  on platform_private.cms_schema_migration_target_rows (plan_id, written_at);

create trigger cms_schema_migration_target_rows_write_guard
before insert on platform_private.cms_schema_migration_target_rows
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_migration_target_rows_immutable_guard
before update or delete on platform_private.cms_schema_migration_target_rows
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_schema_migration_target_rows enable row level security;
alter table platform_private.cms_schema_migration_target_rows force row level security;
revoke all on table platform_private.cms_schema_migration_target_rows
  from public, anon, authenticated, service_role;
create policy cms_schema_migration_target_rows_rpc_policy
  on platform_private.cms_schema_migration_target_rows
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

-- ------------------------------------------------------------ live rows ----
create or replace function platform_private.cms_migration_live_rows(p_version_id uuid)
returns table (source_table text, source_row_id uuid, revision_id uuid)
language sql
stable
security definer
set search_path = ''
as $body$
  select 'cms_entry_revisions'::text, revision.id, revision.id
    from platform_private.cms_entry_revisions revision
   where revision.schema_version_id = p_version_id
  union all
  select 'cms_publication_versions'::text, publication.id, publication.revision_id
    from platform_private.cms_publication_versions publication
   where publication.schema_version_id = p_version_id
$body$;

-- Canonical document of one revision, keyed by the field key of the revision's
-- own schema version.  A `missing` value is omitted; an explicit null is a JSON
-- null; a field with relation rows carries them (ordered) instead of a scalar.
create or replace function platform_private.cms_migration_revision_document(p_revision_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(pg_catalog.jsonb_object_agg(item.key, item.value), '{}'::jsonb)
    from (
      select definition.field_key as key,
             coalesce(field_value.value, 'null'::jsonb) as value
        from platform_private.cms_entry_field_values field_value
        join platform_private.cms_field_definition_versions definition
          on definition.id = field_value.field_definition_id
       where field_value.revision_id = p_revision_id
         and field_value.provenance <> 'missing'
         and not exists (
           select 1 from platform_private.cms_entry_relations relation
            where relation.revision_id = p_revision_id
              and relation.field_definition_id = field_value.field_definition_id)
      union all
      select definition.field_key,
             pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'targetKind', relation.target_kind,
               'targetId', relation.target_id,
               'expectedTargetVersion', relation.expected_target_version,
               'onUnavailable', relation.on_unavailable
             ) order by relation.position, relation.target_id)
        from platform_private.cms_entry_relations relation
        join platform_private.cms_field_definition_versions definition
          on definition.id = relation.field_definition_id
       where relation.revision_id = p_revision_id
       group by definition.field_key
    ) item
$body$;

-- ------------------------------------------------------- target field ----
-- The target-version fields a transform plan must prove rows against: a new
-- required field, or an existing field whose kind, constraints, validator,
-- default, relation binding changed or whose required rule tightened.
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

-- The single target field of a transform plan as the worker protocol carries
-- it (plus the internal stableFieldId).  NULL for an additive plan or when no
-- target field is affected; more than one affected field is refused because the
-- worker protocol proves rows against exactly one target field.
create or replace function platform_private.cms_migration_target_field_spec(p_plan_id uuid)
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
  changed_count integer;
  compiled_constraints jsonb;
begin
  select * into plan_row from platform_private.cms_schema_migration_plans plan where plan.id = p_plan_id;
  if not found or plan_row.transform_key is null then
    return null;
  end if;
  select count(*) into changed_count from platform_private.cms_migration_changed_fields(p_plan_id);
  if changed_count = 0 then
    return null;
  end if;
  if changed_count > 1 then
    raise exception 'VALIDATION_FAILED'
      using detail = 'MIGRATION_TARGET_FIELD_AMBIGUOUS', errcode = 'P0001';
  end if;
  select * into field_row from platform_private.cms_migration_changed_fields(p_plan_id);
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
  return pg_catalog.jsonb_build_object(
    'stableFieldId', field_row.stable_field_id,
    'fieldKey', field_row.field_key,
    'kind', field_row.kind,
    'required', field_row.required,
    'defaultMode', field_row.default_mode,
    'defaultValue', field_row.default_value,
    'constraints', compiled_constraints
  );
end;
$body$;

-- ----------------------------------------------------- executor contract ----
-- Proof that one document satisfies the target field: the canonical admission
-- gate (cms_draft_field_value_valid) on the TARGET version, the required rule
-- and the relation count bounds.  Used to refuse a worker pass the database can
-- prove false; a worker-reported row error is always accepted (fails closed).
create or replace function platform_private.cms_migration_value_valid(
  p_target_version_id uuid, p_spec jsonb, p_document jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  value jsonb := p_document -> (p_spec->>'fieldKey');
  relation jsonb := p_spec->'constraints'->'relation';
  value_count integer;
begin
  if value is null or pg_catalog.jsonb_typeof(value) = 'null' then
    return not (p_spec->>'required')::boolean;
  end if;
  if not platform_private.cms_draft_field_value_valid(
       p_target_version_id, (p_spec->>'stableFieldId')::uuid, value, 'authored') then
    return false;
  end if;
  if relation is not null and pg_catalog.jsonb_typeof(relation) = 'object' then
    value_count := case when pg_catalog.jsonb_typeof(value) = 'array'
      then pg_catalog.jsonb_array_length(value) else 1 end;
    if relation->>'cardinality' = 'one'
       and pg_catalog.jsonb_typeof(value) = 'array' and value_count <> 1 then
      return false;
    end if;
    return value_count >= (relation->>'min')::integer
       and value_count <= (relation->>'max')::integer;
  end if;
  return true;
end;
$body$;

-- The registered executor contract of the two code-owned members: the target
-- document a row maps to, or NULL when the member cannot prove the row (a row
-- the target refuses, a missing target field, an unavailable literal default).
-- A null key is the additive no-transform carry.
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
  field_key text := p_spec->>'fieldKey';
  present jsonb;
begin
  if p_key is null then
    return p_document;
  end if;
  if p_key = 'identity.revalidate' then
    if p_spec is null
       or not platform_private.cms_migration_value_valid(p_target_version_id, p_spec, p_document) then
      return null;
    end if;
    return p_document;
  end if;
  if p_key = 'default.fill_literal' then
    if p_spec is null
       or p_spec->>'defaultMode' is distinct from 'literal'
       or p_spec->'defaultValue' is null
       or pg_catalog.jsonb_typeof(p_spec->'defaultValue') = 'null' then
      return null;
    end if;
    present := p_document -> field_key;
    if present is not null and pg_catalog.jsonb_typeof(present) <> 'null' then
      return p_document;
    end if;
    return p_document || pg_catalog.jsonb_build_object(field_key, p_spec->'defaultValue');
  end if;
  return null;
end;
$body$;

-- ------------------------------------------------------ source-row read ----
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
  spec := platform_private.cms_migration_target_field_spec(plan_id);
  if spec is not null and not ((member->'acceptedFieldKinds') ? (spec->>'kind')) then
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
  return pg_catalog.jsonb_build_object(
    'rows', page,
    'nextCursor', (current_cursor + page_count)::text,
    'done', current_cursor + page_count >= plan_row.source_count,
    'targetField', spec - 'stableFieldId'
  );
end;
$body$;

create or replace function platform_api.cms_read_schema_migration_source_rows(p_request jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $body$
  select platform_private.cms_read_schema_migration_source_rows(p_request)
$body$;

revoke all on function platform_private.cms_migration_live_rows(uuid),
  platform_private.cms_migration_revision_document(uuid),
  platform_private.cms_migration_changed_fields(uuid),
  platform_private.cms_migration_target_field_spec(uuid),
  platform_private.cms_migration_value_valid(uuid, jsonb, jsonb),
  platform_private.cms_migration_expected_output(text, uuid, jsonb, jsonb),
  platform_private.cms_read_schema_migration_source_rows(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_read_schema_migration_source_rows(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_read_schema_migration_source_rows(jsonb) to service_role;

commit;
