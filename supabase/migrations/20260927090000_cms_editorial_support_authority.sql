-- Slice 10 remaining editorial support table foundation (BE03b canonical rows).
--
-- Companion to 20260926090000_cms_entry_revision_authority.sql, which created
-- the five core records (ContentEntry, EntryRevision, EntryFieldValue,
-- EntryRelation, EntryAssignment). This migration adds the remaining private
-- support records that BE03b's Database Schema locks:
--
--   EditorialReview      cms_editorial_reviews
--   EditorialDecision    cms_editorial_decisions
--   PublicationSchedule  cms_publication_schedules
--   PublicationVersion   cms_publication_versions
--   PreviewToken         cms_preview_tokens
--   EditPresence         cms_edit_presence
--
-- Scope is strictly the tables, envelope constraints, foreign keys, indexes,
-- guard triggers and RLS posture. Named RPC implementations, Zod contracts and
-- middleware are later Slice 10 work and are intentionally absent.
--
-- Spec-to-reality decisions recorded in
-- supabase/tests/phase_02_slice_10_remaining_schema/README.md:
--   1. author/reviewer/submitted_by/created_by/actor columns reference the
--      canonical BE01 rows platform_private.person_party(party_id) and
--      platform_private.party(id). BE03b's identity_private.person(id) and
--      identity_private.party(id) do not exist in this database.
--   2. template_version_id has no physical FK because 03c owns
--      cms_template_versions. It is protected by a CHECK against the existing
--      platform_private.cms_template_registry_valid(uuid) seam, and a forward
--      migration must add the real FK once 03c owns TemplateVersion.
--   3. schema_artifact_id resolves to the existing platform_private.
--      cms_schema_artifacts(id); the spec omits the REFERENCES clause but the
--      relation exists in 03a, so the FK is real rather than a seam.
--   4. BE03b's Database Schema defines no conflict-record table even though
--      CMS-03B-02 returns a conflictId. No table is invented here; the gap is
--      reported as still absent.

create table platform_private.cms_edit_presence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  person_id uuid not null references platform_private.person_party(party_id),
  acting_party_id uuid null references platform_private.party(id),
  lease_until timestamptz not null,
  last_seen_at timestamptz not null,
  current_field_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_edit_presence_state_check
    check (state in ('active', 'expired', 'revoked')),
  constraint cms_edit_presence_version_check check (version > 0),
  constraint cms_edit_presence_entry_person_unique unique (entry_id, person_id)
);

create index cms_edit_presence_owner_state_updated_idx
  on platform_private.cms_edit_presence (owner_id, state, updated_at desc);
create index cms_edit_presence_entry_lease_idx
  on platform_private.cms_edit_presence (entry_id, lease_until);
create index cms_edit_presence_person_lease_idx
  on platform_private.cms_edit_presence (person_id, lease_until);

create table platform_private.cms_editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  state text not null,
  version bigint not null,
  risk_class text not null,
  frozen_hash char(64) not null,
  dependency_manifest jsonb not null,
  dependency_hash char(64) not null,
  activation_evidence jsonb not null,
  workflow_policy_key text not null,
  workflow_policy_version bigint not null,
  workflow_policy_hash char(64) not null,
  required_capabilities jsonb not null,
  required_decision_count smallint not null,
  recorded_decision_count smallint not null default 0,
  approval_evidence_hash char(64) not null,
  submitted_by uuid not null references platform_private.person_party(party_id),
  submitted_at timestamptz not null default now(),
  invalidated_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_editorial_reviews_state_check
    check (state in ('open', 'approved', 'rejected', 'invalidated')),
  constraint cms_editorial_reviews_version_check check (version > 0),
  constraint cms_editorial_reviews_risk_class_check
    check (risk_class in ('ordinary', 'protected')),
  constraint cms_editorial_reviews_frozen_hash_check
    check (frozen_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_reviews_dependency_manifest_check
    check (jsonb_typeof(dependency_manifest) = 'object'),
  constraint cms_editorial_reviews_dependency_hash_check
    check (dependency_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_reviews_activation_evidence_check
    check (jsonb_typeof(activation_evidence) = 'object'),
  constraint cms_editorial_reviews_workflow_policy_key_check
    check (workflow_policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_editorial_reviews_workflow_policy_version_check
    check (workflow_policy_version > 0),
  constraint cms_editorial_reviews_workflow_policy_hash_check
    check (workflow_policy_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_reviews_required_capabilities_check
    check (
      jsonb_typeof(required_capabilities) = 'array'
      and jsonb_array_length(required_capabilities) between 1 and 16
    ),
  constraint cms_editorial_reviews_required_decision_count_check
    check (required_decision_count between 1 and 8),
  constraint cms_editorial_reviews_recorded_decision_count_check
    check (
      recorded_decision_count between 0 and 8
      and recorded_decision_count <= required_decision_count
    ),
  constraint cms_editorial_reviews_approval_evidence_hash_check
    check (approval_evidence_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_reviews_protected_decisions_check
    check (risk_class <> 'protected' or required_decision_count >= 2),
  constraint cms_editorial_reviews_protected_capabilities_check
    check (
      risk_class <> 'protected' or jsonb_array_length(required_capabilities) >= 1
    )
);

-- One live review per revision; invalidated reviews stay in history so a
-- revision may accumulate superseded review evidence.
create unique index cms_editorial_reviews_live_revision_unique
  on platform_private.cms_editorial_reviews (revision_id)
  where state in ('open', 'approved');
create index cms_editorial_reviews_owner_state_updated_idx
  on platform_private.cms_editorial_reviews (owner_id, state, updated_at desc);
create index cms_editorial_reviews_revision_state_idx
  on platform_private.cms_editorial_reviews (revision_id, state);

create table platform_private.cms_editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  review_id uuid not null
    references platform_private.cms_editorial_reviews(id),
  reviewer_person_id uuid not null
    references platform_private.person_party(party_id),
  acting_party_id uuid null references platform_private.party(id),
  capability text not null,
  decision text not null,
  reason text not null,
  comment_hash char(64) null,
  reviewed_hash char(64) not null,
  step_up_at timestamptz null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_editorial_decisions_state_check check (state in ('recorded')),
  constraint cms_editorial_decisions_version_check check (version > 0),
  constraint cms_editorial_decisions_capability_check
    check (octet_length(capability) between 1 and 128),
  constraint cms_editorial_decisions_decision_check
    check (decision in ('approve', 'reject')),
  constraint cms_editorial_decisions_reason_check
    check (octet_length(reason) between 1 and 2000),
  constraint cms_editorial_decisions_comment_hash_check
    check (comment_hash is null or comment_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_decisions_reviewed_hash_check
    check (reviewed_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_editorial_decisions_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_editorial_decisions_reviewer_unique
    unique (review_id, reviewer_person_id)
);

create index cms_editorial_decisions_owner_updated_idx
  on platform_private.cms_editorial_decisions (owner_id, updated_at desc);
create index cms_editorial_decisions_review_decided_idx
  on platform_private.cms_editorial_decisions (review_id, decided_at);
create index cms_editorial_decisions_reviewer_decided_idx
  on platform_private.cms_editorial_decisions
  (reviewer_person_id, decided_at desc);

create table platform_private.cms_publication_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  dependency_hash char(64) not null,
  activation_evidence_hash char(64) not null,
  action text not null,
  local_datetime timestamp not null,
  timezone text not null,
  resolved_at_utc timestamptz not null,
  tzdb_version text not null,
  disambiguation text not null,
  state text not null,
  job_id uuid null,
  expected_version bigint not null,
  actual_at_utc timestamptz null,
  deviation_seconds bigint null,
  version bigint not null,
  created_by uuid not null references platform_private.person_party(party_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_publication_schedules_dependency_hash_check
    check (dependency_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_schedules_activation_evidence_hash_check
    check (activation_evidence_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_schedules_action_check
    check (action in ('publish', 'unpublish', 'expire', 'archive')),
  constraint cms_publication_schedules_timezone_check
    check (octet_length(timezone) between 1 and 64),
  constraint cms_publication_schedules_tzdb_version_check
    check (octet_length(tzdb_version) between 1 and 32),
  constraint cms_publication_schedules_disambiguation_check
    check (disambiguation in ('none', 'earlier', 'later')),
  constraint cms_publication_schedules_state_check
    check (
      state in (
        'pending', 'executing', 'completed', 'failed_retryable', 'blocked',
        'cancelled'
      )
    ),
  constraint cms_publication_schedules_expected_version_check
    check (expected_version > 0),
  constraint cms_publication_schedules_version_check check (version > 0),
  constraint cms_publication_schedules_identity_unique
    unique (entry_id, revision_id, action, local_datetime, timezone)
);

create index cms_publication_schedules_owner_state_updated_idx
  on platform_private.cms_publication_schedules
  (owner_id, state, updated_at desc);
create index cms_publication_schedules_state_resolved_idx
  on platform_private.cms_publication_schedules (state, resolved_at_utc);
create index cms_publication_schedules_entry_state_resolved_idx
  on platform_private.cms_publication_schedules
  (entry_id, state, resolved_at_utc);

create table platform_private.cms_publication_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  dependency_hash char(64) not null,
  activation_evidence_hash char(64) not null,
  schema_artifact_id uuid not null
    references platform_private.cms_schema_artifacts(id),
  schema_artifact_hash char(64) not null,
  version_set jsonb not null,
  schema_version_id uuid not null
    references platform_private.cms_content_type_versions(id),
  template_version_id uuid null,
  taxonomy_version_ids jsonb not null,
  settings_version bigint not null,
  locale text not null,
  audience text not null,
  publication_hash char(64) not null,
  activated_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_publication_versions_state_check
    check (state in ('active', 'superseded', 'revoked', 'pending')),
  constraint cms_publication_versions_version_check check (version > 0),
  constraint cms_publication_versions_dependency_hash_check
    check (dependency_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_versions_activation_evidence_hash_check
    check (activation_evidence_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_versions_schema_artifact_hash_check
    check (schema_artifact_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_versions_version_set_check
    check (jsonb_typeof(version_set) = 'object'),
  constraint cms_publication_versions_template_registry_check
    check (
      template_version_id is null
      or platform_private.cms_template_registry_valid(template_version_id)
    ),
  constraint cms_publication_versions_taxonomy_array_check
    check (jsonb_typeof(taxonomy_version_ids) = 'array'),
  constraint cms_publication_versions_settings_version_check
    check (settings_version > 0),
  constraint cms_publication_versions_locale_check
    check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  constraint cms_publication_versions_audience_check
    check (octet_length(audience) between 1 and 64),
  constraint cms_publication_versions_publication_hash_check
    check (publication_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_publication_versions_snapshot_time_check
    check (updated_at = created_at)
);

-- One active publication per (entry, locale, audience); superseded and revoked
-- evidence stays as append-only history.
create unique index cms_publication_versions_active_identity_unique
  on platform_private.cms_publication_versions (entry_id, locale, audience)
  where state = 'active';
create index cms_publication_versions_owner_updated_idx
  on platform_private.cms_publication_versions (owner_id, updated_at desc);
create index cms_publication_versions_entry_locale_audience_state_idx
  on platform_private.cms_publication_versions
  (entry_id, locale, audience, state);
create index cms_publication_versions_revision_idx
  on platform_private.cms_publication_versions (revision_id);

create table platform_private.cms_preview_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  token_hash char(64) not null,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  user_id uuid not null references auth.users(id),
  acting_party_id uuid null references platform_private.party(id),
  capability_snapshot_hash char(64) not null,
  version_set jsonb not null,
  locale text not null,
  audience text not null,
  route text not null,
  expires_at timestamptz not null,
  nonce uuid not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_preview_tokens_state_check
    check (state in ('active', 'expired', 'revoked')),
  constraint cms_preview_tokens_version_check check (version > 0),
  constraint cms_preview_tokens_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_preview_tokens_token_hash_unique unique (token_hash),
  constraint cms_preview_tokens_capability_snapshot_hash_check
    check (capability_snapshot_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_preview_tokens_version_set_check
    check (jsonb_typeof(version_set) = 'object'),
  constraint cms_preview_tokens_locale_check
    check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  constraint cms_preview_tokens_audience_check
    check (octet_length(audience) between 1 and 64),
  constraint cms_preview_tokens_route_check
    check (route ~ '^/[^[:cntrl:]]{0,2047}$')
);

create index cms_preview_tokens_owner_updated_idx
  on platform_private.cms_preview_tokens (owner_id, updated_at desc);
create index cms_preview_tokens_entry_revision_expires_idx
  on platform_private.cms_preview_tokens (entry_id, revision_id, expires_at);
create index cms_preview_tokens_user_expires_idx
  on platform_private.cms_preview_tokens (user_id, expires_at);
create index cms_preview_tokens_expires_live_idx
  on platform_private.cms_preview_tokens (expires_at)
  where revoked_at is null;

-- Write guards. Every record is RPC-only, so a direct browser or service-role
-- write is rejected with P0001 before RLS is even consulted.
create trigger cms_edit_presence_write_guard
before insert or update or delete on platform_private.cms_edit_presence
for each row execute function platform_private.cms_write_guard();
create trigger cms_editorial_reviews_write_guard
before insert or update or delete on platform_private.cms_editorial_reviews
for each row execute function platform_private.cms_write_guard();
create trigger cms_editorial_decisions_write_guard
before insert or update or delete on platform_private.cms_editorial_decisions
for each row execute function platform_private.cms_write_guard();
create trigger cms_publication_schedules_write_guard
before insert or update or delete on platform_private.cms_publication_schedules
for each row execute function platform_private.cms_write_guard();
create trigger cms_publication_versions_write_guard
before insert or update or delete on platform_private.cms_publication_versions
for each row execute function platform_private.cms_write_guard();
create trigger cms_preview_tokens_write_guard
before insert or update or delete on platform_private.cms_preview_tokens
for each row execute function platform_private.cms_write_guard();

-- Immutability guards. Append-only evidence rejects UPDATE and DELETE even
-- inside a verified CMS RPC context. Review, presence, schedule and token rows
-- stay CAS-mutable because BE03b names a state/version advance for each of
-- them.
create trigger cms_editorial_decisions_immutable_guard
before update or delete on platform_private.cms_editorial_decisions
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_publication_versions_immutable_guard
before update or delete on platform_private.cms_publication_versions
for each row execute function platform_private.cms_immutable_guard();

-- RLS posture: enabled and forced, browser and service roles revoked, and one
-- policy that admits a row only inside a verified CMS RPC context.
do $body$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cms_edit_presence', 'cms_editorial_reviews', 'cms_editorial_decisions',
    'cms_publication_schedules', 'cms_publication_versions',
    'cms_preview_tokens'
  ] loop
    execute format(
      'alter table platform_private.%I enable row level security', table_name
    );
    execute format(
      'alter table platform_private.%I force row level security', table_name
    );
    execute format(
      'revoke all on table platform_private.%I from public, anon, authenticated, service_role',
      table_name
    );
    execute format(
      'create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())',
      table_name || '_rpc_policy', table_name
    );
  end loop;
end;
$body$;
