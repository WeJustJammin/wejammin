-- DEC-108 / CMS-03A-10: the dry-run report becomes one typed, attempt-scoped
-- record and the migration plan gets attempt identity (BE03a "Database
-- Schema", G1-G4, WP2a follow-up 6).  Forward-only.
--   * cms_schema_dry_run_reports: attempt_no, state (queued|running|completed|
--     failed), job_id, plan_id, failure_code, sealed_at.  An unsealed row
--     carries no result, counts, hashes or report; the sealing RPC writes them
--     together with state = 'completed'; a trigger then rejects every UPDATE.
--   * cms_schema_migration_plans: one plan per attempt; from_version_id is
--     NULL only for the first version of a type; earlier attempts are
--     superseded, and at most one live plan exists per version pair.
--   * cms_schema_dry_run_row_evidence: private append-only per-row evidence.
--   * cms.schema.dry_run job type for the BE00 job seam.
--   * the manual report insert seam (cms_record_dry_run_report) is removed:
--     only a sealed worker scan can produce report evidence.
begin;

-- ---------------------------------------------------------------- plans ----
alter table platform_private.cms_schema_migration_plans
  alter column from_version_id drop not null,
  add column superseded_at timestamptz;
alter table platform_private.cms_schema_migration_plans
  drop constraint cms_schema_migration_plans_unique,
  drop constraint cms_schema_migration_plans_distinct_versions_check,
  add constraint cms_schema_migration_plans_distinct_versions_check check (
    from_version_id is null or from_version_id <> to_version_id
  );
create unique index cms_schema_migration_plans_one_live_per_pair_unique
  on platform_private.cms_schema_migration_plans (
    coalesce(from_version_id, '00000000-0000-0000-0000-000000000000'::uuid),
    to_version_id
  )
  where superseded_at is null;

-- -------------------------------------------------------------- reports ----
alter table platform_private.cms_schema_dry_run_reports
  alter column source_hash drop not null,
  alter column target_hash drop not null,
  alter column compiler_hash drop not null,
  alter column source_count drop not null,
  alter column target_count drop not null,
  alter column row_error_count drop not null,
  alter column migrated_count drop not null,
  alter column failed_count drop not null,
  alter column result drop not null,
  alter column result drop default,
  alter column report drop not null,
  add column version bigint not null default 1 check (version > 0),
  add column updated_at timestamptz not null default now(),
  add column attempt_no integer,
  add column state text,
  add column job_id uuid,
  add column plan_id uuid references platform_private.cms_schema_migration_plans(id),
  add column failure_code text,
  add column sealed_at timestamptz;

-- Rows that predate attempts are sealed single attempts.
alter table platform_private.cms_schema_dry_run_reports disable trigger user;
update platform_private.cms_schema_dry_run_reports report
   set attempt_no = numbered.attempt_no,
       state = 'completed',
       sealed_at = report.created_at,
       updated_at = report.created_at
  from (
    select id, row_number() over (partition by target_version_id order by created_at, id)::integer as attempt_no
      from platform_private.cms_schema_dry_run_reports
  ) numbered
 where numbered.id = report.id;
alter table platform_private.cms_schema_dry_run_reports enable trigger user;

alter table platform_private.cms_schema_dry_run_reports
  alter column attempt_no set not null,
  alter column state set not null,
  drop constraint cms_schema_dry_run_reports_result_check,
  add constraint cms_schema_dry_run_reports_result_check check (result in ('pass', 'fail')),
  add constraint cms_schema_dry_run_reports_attempt_no_check check (attempt_no > 0),
  add constraint cms_schema_dry_run_reports_state_check check (
    state in ('queued', 'running', 'completed', 'failed')
  ),
  add constraint cms_schema_dry_run_reports_failure_code_check check (
    (failure_code is null or failure_code ~ '^[A-Z][A-Z0-9_]{0,63}$')
    and ((failure_code is not null) = (state = 'failed'))
  ),
  add constraint cms_schema_dry_run_reports_sealed_check check (
    (state = 'completed') = (sealed_at is not null)
  ),
  add constraint cms_schema_dry_run_reports_evidence_shape_check check (
    (
      state in ('queued', 'running', 'failed')
      and result is null and report is null
      and source_hash is null and target_hash is null and compiler_hash is null
      and source_count is null and target_count is null and row_error_count is null
      and migrated_count is null and failed_count is null
    )
    or (
      state = 'completed'
      and result is not null and report is not null
      and source_hash is not null and target_hash is not null and compiler_hash is not null
      and source_count is not null and target_count is not null
      and row_error_count is not null and migrated_count is not null
      and failed_count is not null
      and ((result = 'pass' and row_error_count = 0) or (result = 'fail' and row_error_count > 0))
    )
  ),
  add constraint cms_schema_dry_run_reports_attempt_unique unique (target_version_id, attempt_no),
  add constraint cms_schema_dry_run_reports_plan_unique unique (plan_id),
  add constraint cms_schema_dry_run_reports_job_unique unique (job_id);

-- Report rows: inserted queued with their plan and job by CMS-03A-10 only;
-- they advance forward through the named dry-run RPCs; a completed or failed
-- row is immutable; DELETE is always rejected.
create or replace function platform_private.cms_schema_dry_run_report_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'queued' or new.plan_id is null or new.job_id is null then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.state in ('completed', 'failed')
     or new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.content_type_id is distinct from old.content_type_id
     or new.source_version_id is distinct from old.source_version_id
     or new.target_version_id is distinct from old.target_version_id
     or new.classification is distinct from old.classification
     or new.transform_key is distinct from old.transform_key
     or new.transform_version is distinct from old.transform_version
     or new.compiler_version is distinct from old.compiler_version
     or new.attempt_no is distinct from old.attempt_no
     or new.job_id is distinct from old.job_id
     or new.plan_id is distinct from old.plan_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.version < old.version
     or (old.state = 'running' and new.state = 'queued') then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

drop trigger cms_schema_dry_run_reports_write_guard on platform_private.cms_schema_dry_run_reports;
drop trigger cms_schema_dry_run_reports_immutable_guard on platform_private.cms_schema_dry_run_reports;
create trigger cms_schema_dry_run_reports_write_guard
before insert or update or delete on platform_private.cms_schema_dry_run_reports
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_dry_run_reports_z_state_guard
before insert or update or delete on platform_private.cms_schema_dry_run_reports
for each row execute function platform_private.cms_schema_dry_run_report_guard();

-- The manual insert seam is removed: only the sealing worker RPC writes
-- report evidence.
drop function platform_private.cms_record_dry_run_report(
  uuid, uuid, uuid, uuid, uuid, text, text, bigint, text, text, text, text, jsonb, uuid
);

-- ------------------------------------------------------- row evidence ----
create table platform_private.cms_schema_dry_run_row_evidence (
  id uuid not null default extensions.gen_random_uuid() primary key,
  report_id uuid not null references platform_private.cms_schema_dry_run_reports(id),
  plan_id uuid not null references platform_private.cms_schema_migration_plans(id),
  source_table text not null,
  source_row_id uuid not null,
  source_hash char(64) not null,
  output_hash char(64),
  error_code text,
  recorded_at timestamptz not null default clock_timestamp(),
  constraint cms_schema_dry_run_row_evidence_source_table_check check (
    source_table in ('cms_entry_revisions', 'cms_publication_versions')
  ),
  constraint cms_schema_dry_run_row_evidence_source_hash_check check (source_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_dry_run_row_evidence_output_hash_check check (
    output_hash is null or output_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_schema_dry_run_row_evidence_error_code_check check (
    error_code is null or error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
  ),
  constraint cms_schema_dry_run_row_evidence_outcome_check check (
    (error_code is null) = (output_hash is not null)
  ),
  constraint cms_schema_dry_run_row_evidence_row_unique unique (report_id, source_table, source_row_id)
);
create index cms_schema_dry_run_row_evidence_plan_idx
  on platform_private.cms_schema_dry_run_row_evidence (plan_id, recorded_at);

create trigger cms_schema_dry_run_row_evidence_write_guard
before insert on platform_private.cms_schema_dry_run_row_evidence
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_dry_run_row_evidence_immutable_guard
before update or delete on platform_private.cms_schema_dry_run_row_evidence
for each row execute function platform_private.cms_immutable_guard();

alter table platform_private.cms_schema_dry_run_row_evidence enable row level security;
alter table platform_private.cms_schema_dry_run_row_evidence force row level security;
revoke all on table platform_private.cms_schema_dry_run_row_evidence
  from public, anon, authenticated, service_role;
create policy cms_schema_dry_run_row_evidence_rpc_policy
  on platform_private.cms_schema_dry_run_row_evidence
  for all to public
  using (platform_private.cms_rpc_context_valid())
  with check (platform_private.cms_rpc_context_valid());

-- --------------------------------------------------- artifact recompile ----
-- A draft candidate's artifact is recompiled in place by the dry-run command
-- (the only mutation point); every other UPDATE and every DELETE is rejected,
-- and a candidate that has left draft keeps an immutable artifact.
create or replace function platform_private.cms_schema_artifact_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if pg_catalog.current_setting('app.cms_compile', true) is distinct from 'true'
     or new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.state is distinct from old.state
     or new.version is distinct from old.version
     or new.created_at is distinct from old.created_at
     or new.content_type_version_id is distinct from old.content_type_version_id
     or new.compiler_version is distinct from old.compiler_version
     or new.zod_contract_ref is distinct from old.zod_contract_ref
     or not exists (
       select 1 from platform_private.cms_content_type_versions version_row
        where version_row.id = old.content_type_version_id
          and version_row.state = 'draft'::platform_private.cms_definition_state
     ) then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;
drop trigger cms_schema_artifacts_write_guard on platform_private.cms_schema_artifacts;
drop trigger cms_schema_artifacts_immutable_guard on platform_private.cms_schema_artifacts;
create trigger cms_schema_artifacts_write_guard
before insert or update on platform_private.cms_schema_artifacts
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_artifacts_z_compile_guard
before update or delete on platform_private.cms_schema_artifacts
for each row execute function platform_private.cms_schema_artifact_guard();

-- ------------------------------------------------------- job + registry ----
insert into platform_private.job_type_registry (job_type) values ('cms.schema.dry_run');

-- Code-owned transform registry membership (BE03a "transform registry"): a
-- transform pair names exactly one registered member.  The members and their
-- versions ship in code plus a forward migration; nothing here accepts an
-- uploaded expression, SQL or code.
create or replace function platform_private.cms_transform_registry_member_valid(
  p_key text, p_version bigint
)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select exists (
    select 1 from (values
      ('identity.revalidate', 1::bigint),
      ('default.fill_literal', 1::bigint)
    ) as registry(key, version)
    where registry.key = p_key and registry.version = p_version
  )
$body$;

revoke all on function platform_private.cms_schema_dry_run_report_guard(),
  platform_private.cms_schema_artifact_guard(),
  platform_private.cms_transform_registry_member_valid(text, bigint)
  from public, anon, authenticated, service_role;

commit;
