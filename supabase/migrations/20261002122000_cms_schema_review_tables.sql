-- DEC-108 private CMS-owned schema-review records (BE03a "Database Schema",
-- "Database invariants and grants", "State machine and concurrency").  These
-- three tables are the only authority for schema-review evidence; they are
-- never CFG setting-value candidates.  Forward-only.
begin;

create table platform_private.cms_schema_reviews (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'open',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_type_id uuid not null references platform_private.cms_content_types(id),
  content_type_version_id uuid not null references platform_private.cms_content_type_versions(id),
  candidate_version_no integer not null check (candidate_version_no > 0),
  definition_hash char(64) not null,
  schema_artifact_id uuid not null,
  compiler_version text not null,
  dependency_manifest_hash char(64) not null,
  dry_run_id uuid not null references platform_private.cms_schema_dry_run_reports(id),
  dry_run_report_hash char(64) not null,
  policy_key text not null,
  policy_version bigint not null check (policy_version > 0),
  policy_hash char(64) not null,
  source_policy_key text,
  source_policy_version bigint,
  source_policy_hash char(64),
  risk_class text not null,
  required_decision_count smallint not null,
  required_capabilities jsonb not null,
  context_hash char(64) not null,
  submitter_person_ref uuid not null,
  submitted_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  approval_evidence_hash char(64),
  constraint cms_schema_reviews_state_check check (
    state in ('open', 'approved', 'rejected', 'invalidated')
  ),
  constraint cms_schema_reviews_definition_hash_check check (definition_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_reviews_compiler_version_check check (
    pg_catalog.octet_length(compiler_version) between 1 and 32
  ),
  constraint cms_schema_reviews_dependency_hash_check check (
    dependency_manifest_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_schema_reviews_report_hash_check check (dry_run_report_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_reviews_policy_key_check check (policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_schema_reviews_policy_hash_check check (policy_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_reviews_source_policy_key_check check (
    source_policy_key is null or source_policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'
  ),
  constraint cms_schema_reviews_source_policy_version_check check (
    source_policy_version is null or source_policy_version > 0
  ),
  constraint cms_schema_reviews_source_policy_hash_check check (
    source_policy_hash is null or source_policy_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_schema_reviews_source_policy_complete_check check (
    (source_policy_key is null) = (source_policy_version is null)
    and (source_policy_key is null) = (source_policy_hash is null)
  ),
  constraint cms_schema_reviews_risk_class_check check (risk_class in ('ordinary', 'protected')),
  constraint cms_schema_reviews_required_count_check check (
    required_decision_count between 1 and 8
  ),
  constraint cms_schema_reviews_required_capabilities_check check (
    pg_catalog.jsonb_typeof(required_capabilities) = 'array'
    and pg_catalog.jsonb_array_length(required_capabilities) between 1 and 16
  ),
  constraint cms_schema_reviews_context_hash_check check (context_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_reviews_approval_hash_check check (
    approval_evidence_hash is null or approval_evidence_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_schema_reviews_approved_evidence_check check (
    (state = 'approved') = (approval_evidence_hash is not null)
  ),
  constraint cms_schema_reviews_decided_after_submitted_check check (
    decided_at is null or decided_at >= submitted_at
  ),
  constraint cms_schema_reviews_approved_decided_check check (
    (state = 'approved') = (decided_at is not null)
  )
);

create unique index cms_schema_reviews_one_open_per_evidence_unique
  on platform_private.cms_schema_reviews (content_type_version_id, definition_hash, dry_run_id)
  where state = 'open';
create index cms_schema_reviews_owner_state_submitted_idx
  on platform_private.cms_schema_reviews (owner_id, state, submitted_at desc);
create index cms_schema_reviews_version_state_idx
  on platform_private.cms_schema_reviews (content_type_version_id, state);

create table platform_private.cms_schema_review_assignments (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  review_id uuid not null references platform_private.cms_schema_reviews(id),
  reviewer_person_ref uuid not null,
  grantor_person_ref uuid not null,
  capability_key text not null,
  actions text[] not null,
  state text not null default 'active',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version bigint not null default 1 check (version > 0),
  constraint cms_schema_review_assignments_capability_check check (
    capability_key = 'cms.schema_review'
  ),
  constraint cms_schema_review_assignments_actions_check check (
    actions = array['read', 'decide']::text[]
  ),
  constraint cms_schema_review_assignments_state_check check (state in ('active', 'revoked')),
  constraint cms_schema_review_assignments_reason_check check (
    reason is null or pg_catalog.octet_length(reason) between 1 and 256
  ),
  constraint cms_schema_review_assignments_window_check check (ends_at > starts_at),
  constraint cms_schema_review_assignments_ceiling_check check (
    ends_at <= starts_at + interval '7 days'
  ),
  constraint cms_schema_review_assignments_id_review_unique unique (id, review_id)
);

create index cms_schema_review_assignments_review_reviewer_idx
  on platform_private.cms_schema_review_assignments (review_id, reviewer_person_ref, state);
create index cms_schema_review_assignments_owner_state_ends_idx
  on platform_private.cms_schema_review_assignments (owner_id, state, ends_at);

create table platform_private.cms_schema_review_decisions (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  review_id uuid not null references platform_private.cms_schema_reviews(id),
  assignment_id uuid not null,
  assignment_version bigint not null check (assignment_version > 0),
  reviewer_person_ref uuid not null,
  binding_context_hash char(64) not null,
  capability_key text not null,
  capability_version bigint not null check (capability_version > 0),
  decision text not null,
  decided_at timestamptz not null default clock_timestamp(),
  reviewed_hash char(64) not null,
  mfa_verified_at timestamptz not null,
  constraint cms_schema_review_decisions_assignment_fkey
    foreign key (assignment_id, review_id)
    references platform_private.cms_schema_review_assignments (id, review_id),
  constraint cms_schema_review_decisions_binding_hash_check check (
    binding_context_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_schema_review_decisions_capability_check check (
    capability_key = 'cms.schema_review'
  ),
  constraint cms_schema_review_decisions_decision_check check (decision in ('approve', 'reject')),
  constraint cms_schema_review_decisions_reviewed_hash_check check (reviewed_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_schema_review_decisions_created_immutable_check check (updated_at = created_at),
  constraint cms_schema_review_decisions_review_reviewer_unique unique (review_id, reviewer_person_ref)
);

create index cms_schema_review_decisions_review_idx
  on platform_private.cms_schema_review_decisions (review_id, decided_at);

-- Review rows: frozen evidence is immutable; state moves only
-- open -> approved | rejected | invalidated and approved -> invalidated.
create or replace function platform_private.cms_schema_review_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at
     or new.content_type_id is distinct from old.content_type_id
     or new.content_type_version_id is distinct from old.content_type_version_id
     or new.candidate_version_no is distinct from old.candidate_version_no
     or new.definition_hash is distinct from old.definition_hash
     or new.schema_artifact_id is distinct from old.schema_artifact_id
     or new.compiler_version is distinct from old.compiler_version
     or new.dependency_manifest_hash is distinct from old.dependency_manifest_hash
     or new.dry_run_id is distinct from old.dry_run_id
     or new.dry_run_report_hash is distinct from old.dry_run_report_hash
     or new.policy_key is distinct from old.policy_key
     or new.policy_version is distinct from old.policy_version
     or new.policy_hash is distinct from old.policy_hash
     or new.source_policy_key is distinct from old.source_policy_key
     or new.source_policy_version is distinct from old.source_policy_version
     or new.source_policy_hash is distinct from old.source_policy_hash
     or new.risk_class is distinct from old.risk_class
     or new.required_decision_count is distinct from old.required_decision_count
     or new.required_capabilities is distinct from old.required_capabilities
     or new.context_hash is distinct from old.context_hash
     or new.submitter_person_ref is distinct from old.submitter_person_ref
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.version < old.version then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if old.state = 'open' then
    if new.state not in ('open', 'approved', 'rejected', 'invalidated') then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
  elsif old.state = 'approved' then
    if new.state not in ('approved', 'invalidated')
       or new.decided_at is distinct from old.decided_at
       or new.approval_evidence_hash is distinct from old.approval_evidence_hash then
      raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
    end if;
  elsif new.state is distinct from old.state
        or new.decided_at is distinct from old.decided_at
        or new.approval_evidence_hash is distinct from old.approval_evidence_hash then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- Assignments only move active -> revoked (version + 1); the reviewer, grantor,
-- scope and term never change.
create or replace function platform_private.cms_schema_review_assignment_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.review_id is distinct from old.review_id
     or new.reviewer_person_ref is distinct from old.reviewer_person_ref
     or new.grantor_person_ref is distinct from old.grantor_person_ref
     or new.capability_key is distinct from old.capability_key
     or new.actions is distinct from old.actions
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.created_at is distinct from old.created_at
     or (old.state = 'revoked' and new.state is distinct from old.state)
     or new.version < old.version then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- A decision is append-only.  The submitter of the referenced review can never
-- be recorded as its reviewer (a cross-row rule, hence a trigger and not a
-- CHECK) and a decision is only recorded against an open review.
create or replace function platform_private.cms_schema_review_decision_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  review_row platform_private.cms_schema_reviews%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
  end if;
  select * into review_row from platform_private.cms_schema_reviews review
   where review.id = new.review_id;
  if not found
     or review_row.state <> 'open'
     or review_row.owner_id <> new.owner_id
     or review_row.submitter_person_ref = new.reviewer_person_ref then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create trigger cms_schema_reviews_write_guard
before insert or update or delete on platform_private.cms_schema_reviews
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_reviews_z_state_guard
before update or delete on platform_private.cms_schema_reviews
for each row execute function platform_private.cms_schema_review_guard();
create trigger cms_schema_review_assignments_write_guard
before insert or update or delete on platform_private.cms_schema_review_assignments
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_review_assignments_z_state_guard
before update or delete on platform_private.cms_schema_review_assignments
for each row execute function platform_private.cms_schema_review_assignment_guard();
create trigger cms_schema_review_decisions_write_guard
before insert or update or delete on platform_private.cms_schema_review_decisions
for each row execute function platform_private.cms_write_guard();
create trigger cms_schema_review_decisions_z_append_guard
before insert or update or delete on platform_private.cms_schema_review_decisions
for each row execute function platform_private.cms_schema_review_decision_guard();

do $body$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cms_schema_reviews', 'cms_schema_review_assignments', 'cms_schema_review_decisions'
  ] loop
    execute format('alter table platform_private.%I enable row level security', table_name);
    execute format('alter table platform_private.%I force row level security', table_name);
    execute format('revoke all on table platform_private.%I from public, anon, authenticated, service_role', table_name);
    execute format('create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())', table_name || '_rpc_policy', table_name);
  end loop;
end;
$body$;

revoke all on function platform_private.cms_schema_review_guard(),
  platform_private.cms_schema_review_assignment_guard(),
  platform_private.cms_schema_review_decision_guard()
  from public, anon, authenticated, service_role;

commit;
