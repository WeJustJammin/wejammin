-- Slice 10 canonical editorial table foundation (BE03b CMS-03B-01..-11).
--
-- This migration creates only the private tables, envelope constraints,
-- foreign keys, indexes, immutability guards and RLS posture. RPC
-- implementations, Zod contracts and middleware belong to later Slice 10 work
-- and are intentionally absent here.
--
-- Three deliberate spec-to-reality decisions are recorded in
-- supabase/tests/phase_02_slice_10_schema/README.md:
--   1. author_person_id/acting_party_id reference the canonical BE01 rows
--      platform_private.person_party(party_id) and platform_private.party(id).
--      BE03b's identity_private.person(id)/identity_private.party(id) do not
--      exist in this database.
--   2. template_version_id has no physical FK because 03c owns
--      cms_template_versions. It is protected by a column CHECK against the
--      existing platform_private.cms_template_registry_valid(uuid) seam, and a
--      forward migration must add the real FK once 03c owns TemplateVersion.
--   3. cms_entry_assignments is additive foundation for DEC-106's atomic
--      initial-entry assignment. It still needs a canonical BE03b spec row.

create table platform_private.cms_content_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  content_type_id uuid not null
    references platform_private.cms_content_types(id),
  owner_party_id uuid null references platform_private.party(id),
  lifecycle text not null,
  current_draft_revision_id uuid null,
  version bigint not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_content_entries_lifecycle_check
    check (lifecycle in ('active', 'archived', 'deletion_pending', 'held')),
  constraint cms_content_entries_version_check check (version > 0),
  constraint cms_content_entries_id_version_unique unique (id, version)
);

create index cms_content_entries_owner_updated_idx
  on platform_private.cms_content_entries (owner_id, updated_at desc);
create index cms_content_entries_owner_party_lifecycle_idx
  on platform_private.cms_content_entries
  (owner_party_id, lifecycle, updated_at desc);
create index cms_content_entries_type_lifecycle_idx
  on platform_private.cms_content_entries (content_type_id, lifecycle);

create table platform_private.cms_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  revision_number bigint not null,
  schema_version_id uuid not null
    references platform_private.cms_content_type_versions(id),
  template_version_id uuid null,
  taxonomy_version_ids jsonb not null,
  parent_revision_ids jsonb not null,
  locale text not null,
  payload_hash char(64) not null,
  author_person_id uuid not null
    references platform_private.person_party(party_id),
  acting_party_id uuid null references platform_private.party(id),
  state text not null,
  version bigint not null,
  validation_state text not null,
  validation_report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_entry_revisions_revision_number_check
    check (revision_number > 0),
  constraint cms_entry_revisions_template_registry_check
    check (
      template_version_id is null
      or platform_private.cms_template_registry_valid(template_version_id)
    ),
  constraint cms_entry_revisions_taxonomy_array_check
    check (jsonb_typeof(taxonomy_version_ids) = 'array'),
  constraint cms_entry_revisions_parent_array_check
    check (
      jsonb_typeof(parent_revision_ids) = 'array'
      and jsonb_array_length(parent_revision_ids) <= 2
    ),
  constraint cms_entry_revisions_locale_check
    check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  constraint cms_entry_revisions_payload_hash_check
    check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_entry_revisions_state_check
    check (
      state in ('draft', 'submitted', 'approved', 'rejected', 'scheduled',
                'published')
    ),
  constraint cms_entry_revisions_version_check check (version > 0),
  constraint cms_entry_revisions_validation_state_check
    check (validation_state in ('valid', 'invalid', 'unknown')),
  constraint cms_entry_revisions_validation_report_check
    check (jsonb_typeof(validation_report) = 'object'),
  constraint cms_entry_revisions_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_entry_revisions_number_locale_unique
    unique (entry_id, revision_number, locale)
);

create index cms_entry_revisions_owner_updated_idx
  on platform_private.cms_entry_revisions (owner_id, updated_at desc);
create index cms_entry_revisions_entry_locale_revision_idx
  on platform_private.cms_entry_revisions
  (entry_id, locale, revision_number desc);
create index cms_entry_revisions_entry_state_updated_idx
  on platform_private.cms_entry_revisions (entry_id, state, updated_at desc);
create index cms_entry_revisions_schema_version_idx
  on platform_private.cms_entry_revisions (schema_version_id);

-- The current-draft pointer is a real FK, but it must be added after the
-- revision table exists because revisions already reference the entry.
alter table platform_private.cms_content_entries
  add constraint cms_content_entries_current_draft_fkey
  foreign key (current_draft_revision_id)
  references platform_private.cms_entry_revisions(id);

create table platform_private.cms_entry_field_values (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  revision_id uuid not null references platform_private.cms_entry_revisions(id),
  field_id uuid not null,
  field_definition_id uuid not null
    references platform_private.cms_field_definition_versions(id),
  locale text not null,
  value jsonb null,
  provenance text not null,
  value_hash char(64) null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_entry_field_values_state_check check (state in ('active')),
  constraint cms_entry_field_values_version_check check (version > 0),
  constraint cms_entry_field_values_locale_check
    check (locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'),
  constraint cms_entry_field_values_provenance_check
    check (
      provenance in ('authored', 'default', 'inherited', 'localized_fallback',
                     'explicit_null', 'missing')
    ),
  constraint cms_entry_field_values_value_hash_check
    check (value_hash is null or value_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_entry_field_values_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_entry_field_values_field_unique
    unique (revision_id, field_id, locale),
  constraint cms_entry_field_values_definition_unique
    unique (revision_id, field_definition_id, locale)
);

create index cms_entry_field_values_owner_updated_idx
  on platform_private.cms_entry_field_values (owner_id, updated_at desc);
create index cms_entry_field_values_revision_locale_idx
  on platform_private.cms_entry_field_values (revision_id, locale);
create index cms_entry_field_values_field_locale_idx
  on platform_private.cms_entry_field_values (field_id, locale);

create table platform_private.cms_entry_relations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  state text not null,
  version bigint not null default 1,
  revision_id uuid not null references platform_private.cms_entry_revisions(id),
  field_id uuid not null,
  field_definition_id uuid not null
    references platform_private.cms_field_definition_versions(id),
  target_kind text not null,
  target_id uuid not null,
  expected_target_version bigint null,
  position integer not null,
  on_unavailable text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_entry_relations_state_check check (state in ('active')),
  constraint cms_entry_relations_version_check check (version > 0),
  constraint cms_entry_relations_target_kind_check
    check (target_kind ~ '^[a-z][a-z0-9._-]{0,95}$'),
  constraint cms_entry_relations_expected_version_check
    check (expected_target_version is null or expected_target_version > 0),
  constraint cms_entry_relations_position_check
    check (position >= 0 and position < 512),
  constraint cms_entry_relations_on_unavailable_check
    check (on_unavailable in ('omit', 'block', 'placeholder')),
  constraint cms_entry_relations_snapshot_time_check
    check (updated_at = created_at),
  constraint cms_entry_relations_target_unique
    unique (revision_id, field_id, target_kind, target_id)
);

create index cms_entry_relations_owner_updated_idx
  on platform_private.cms_entry_relations (owner_id, updated_at desc);
create index cms_entry_relations_revision_field_position_idx
  on platform_private.cms_entry_relations (revision_id, field_id, position);
create index cms_entry_relations_target_idx
  on platform_private.cms_entry_relations (target_kind, target_id);

-- DEC-106 requires the initial-entry transaction to persist an assignment
-- atomically. BE03b delegates assignment authority to BE01, so this table is
-- additive foundation and must gain a canonical spec row before RPC work
-- depends on it.
create table platform_private.cms_entry_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_id uuid not null references platform_private.cms_content_entries(id),
  assignee_person_id uuid not null
    references platform_private.person_party(party_id),
  capability_key text not null,
  state text not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_entry_assignments_capability_key_check
    check (capability_key ~ '^[a-z][a-z0-9._-]{0,127}$'),
  constraint cms_entry_assignments_state_check
    check (state in ('active', 'revoked')),
  constraint cms_entry_assignments_version_check check (version > 0),
  constraint cms_entry_assignments_identity_unique
    unique (entry_id, assignee_person_id, capability_key)
);

create index cms_entry_assignments_entry_idx
  on platform_private.cms_entry_assignments (entry_id, state);
create index cms_entry_assignments_assignee_idx
  on platform_private.cms_entry_assignments (assignee_person_id, state);

-- Write guards. ContentEntry is the only mutable row in this slice: its
-- current-draft pointer, lifecycle and aggregate version change through an
-- authorized CAS RPC. Every other table is an immutable append-only snapshot.
create trigger cms_content_entries_write_guard
before insert or update or delete on platform_private.cms_content_entries
for each row execute function platform_private.cms_write_guard();
create trigger cms_entry_revisions_write_guard
before insert or update or delete on platform_private.cms_entry_revisions
for each row execute function platform_private.cms_write_guard();
create trigger cms_entry_revisions_immutable_guard
before update or delete on platform_private.cms_entry_revisions
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_entry_field_values_write_guard
before insert or update or delete on platform_private.cms_entry_field_values
for each row execute function platform_private.cms_write_guard();
create trigger cms_entry_field_values_immutable_guard
before update or delete on platform_private.cms_entry_field_values
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_entry_relations_write_guard
before insert or update or delete on platform_private.cms_entry_relations
for each row execute function platform_private.cms_write_guard();
create trigger cms_entry_relations_immutable_guard
before update or delete on platform_private.cms_entry_relations
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_entry_assignments_write_guard
before insert or update or delete on platform_private.cms_entry_assignments
for each row execute function platform_private.cms_write_guard();

-- RLS posture: enabled and forced, browser and service roles revoked, and one
-- policy that admits a row only inside a verified CMS RPC context.
do $body$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cms_content_entries', 'cms_entry_revisions', 'cms_entry_field_values',
    'cms_entry_relations', 'cms_entry_assignments'
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
