-- Slice 10 DEC-107 conflict-record table foundation (BE03b canonical row 12).
--
-- Companion to 20260926090000_cms_entry_revision_authority.sql (five core
-- records) and 20260927090000_cms_editorial_support_authority.sql (six support
-- records). Owner-approved DEC-107 adds the twelfth canonical editorial record
-- that CMS-03B-02 conflict resolution requires:
--
--   ConflictRecord / cms_conflict_records
--
-- Scope is strictly the table, envelope coupling, foreign keys, indexes, write
-- guard and RLS posture. Named RPC implementations (cms_resolve_conflict) and
-- Zod contracts are later Slice 10 work and are intentionally absent.
--
-- Spec-to-reality notes:
--   1. actor columns reference the canonical BE01 rows
--      platform_private.person_party(party_id) and platform_private.party(id).
--   2. The BE03b envelope coupling CHECK is reproduced exactly. It compares
--      state to literals in addition to the closed state union, so the shared
--      closed-union test helper de-duplicates labels; see the suite header.
--   3. Cross-entry binding (base/theirs/yours revisions all belonging to
--      entry_id) is enforced by the cms_resolve_conflict RPC and asserted by a
--      negative test, not a composite FK: adding UNIQUE(id, entry_id) to
--      cms_entry_revisions would modify an existing canonical table that
--      DEC-107 forbids changing.
--   4. NOT append-only. The row is CAS-mutable open -> resolved | superseded,
--      so there is no blanket CHECK(updated_at = created_at); identity/binding
--      evidence is immutable by RPC contract.
--   5. A stale autosave can be rejected before any `yours` revision commits, so
--      the `yours` side is discriminated by yours_source: 'revision' carries a
--      persisted cms_entry_revisions identity, while 'proposed' carries an
--      uncommitted candidate payload (proposed_values) that never became a
--      revision. base_revision_id and theirs_revision_id stay NOT NULL because
--      both are authoritative persisted revisions. yours_revision_id is NOT
--      coupled to state: superseded rows retain their original evidence.
--   6. proposed_values is private and never browser-exposed. This table
--      enforces only the frozen jsonb_typeof = 'object' shape check; the spec's
--      numeric payload bounds (<=128 keys, <=8 depth, <=256 KiB) are a forward
--      obligation for the cms_resolve_conflict RPC boundary, not silently
--      invented here.
--
-- Forward obligations: the cms_resolve_conflict RPC (Slice 10 RPC lane), and the
-- template_version_id FK owed at 03c for the sibling migrations.

create table platform_private.cms_conflict_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  entry_id uuid not null
    references platform_private.cms_content_entries(id),
  base_revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  theirs_revision_id uuid not null
    references platform_private.cms_entry_revisions(id),
  yours_revision_id uuid null
    references platform_private.cms_entry_revisions(id),
  yours_source text not null,
  proposed_values jsonb null,
  proposed_values_hash char(64) null,
  changed_paths jsonb not null,
  base_hash char(64) not null,
  theirs_hash char(64) not null,
  yours_hash char(64) not null,
  conflict_hash char(64) not null,
  state text not null,
  version bigint not null default 1,
  resolved_revision_id uuid null
    references platform_private.cms_entry_revisions(id),
  resolved_by_person_id uuid null
    references platform_private.person_party(party_id),
  resolved_acting_party_id uuid null
    references platform_private.party(id),
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_conflict_records_state_check
    check (state in ('open', 'resolved', 'superseded')),
  constraint cms_conflict_records_version_check check (version > 0),
  constraint cms_conflict_records_changed_paths_check
    check (
      jsonb_typeof(changed_paths) = 'array'
      and jsonb_array_length(changed_paths) between 1 and 128
    ),
  constraint cms_conflict_records_base_hash_check
    check (base_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_conflict_records_theirs_hash_check
    check (theirs_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_conflict_records_yours_hash_check
    check (yours_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_conflict_records_conflict_hash_check
    check (conflict_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_conflict_records_conflict_hash_unique unique (conflict_hash),
  constraint cms_conflict_records_yours_source_check
    check (yours_source in ('revision', 'proposed')),
  constraint cms_conflict_records_proposed_values_check
    check (
      proposed_values is null
      or jsonb_typeof(proposed_values) = 'object'
    ),
  constraint cms_conflict_records_proposed_values_hash_check
    check (
      proposed_values_hash is null
      or proposed_values_hash ~ '^[a-f0-9]{64}$'
    ),
  constraint cms_conflict_records_yours_binding_check
    check (
      (
        yours_source = 'revision'
        and yours_revision_id is not null
        and proposed_values is null
        and proposed_values_hash is null
      )
      or (
        yours_source = 'proposed'
        and yours_revision_id is null
        and proposed_values is not null
        and proposed_values_hash is not null
      )
    ),
  constraint cms_conflict_records_resolution_envelope_check
    check (
      (
        state = 'open'
        and resolved_revision_id is null
        and resolved_by_person_id is null
        and resolved_acting_party_id is null
        and resolved_at is null
      )
      or (
        state = 'resolved'
        and resolved_revision_id is not null
        and resolved_by_person_id is not null
        and resolved_at is not null
      )
      or (
        state = 'superseded'
        and resolved_revision_id is null
        and resolved_by_person_id is null
        and resolved_acting_party_id is null
        and resolved_at is null
      )
    )
);

-- DEC-107 locks exactly one open conflict per entry. Weakening this to a
-- plain UNIQUE(entry_id) would permanently block a future conflict once a
-- resolved row exists, so the partial predicate is required.
create unique index cms_conflict_records_one_open_per_entry
  on platform_private.cms_conflict_records (entry_id)
  where state = 'open';

create index cms_conflict_records_owner_state_updated_idx
  on platform_private.cms_conflict_records (owner_id, state, updated_at desc);
create index cms_conflict_records_entry_state_updated_idx
  on platform_private.cms_conflict_records (entry_id, state, updated_at desc);
create index cms_conflict_records_entry_conflict_hash_idx
  on platform_private.cms_conflict_records (entry_id, conflict_hash);
create index cms_conflict_records_base_revision_idx
  on platform_private.cms_conflict_records (base_revision_id);
create index cms_conflict_records_theirs_revision_idx
  on platform_private.cms_conflict_records (theirs_revision_id);
create index cms_conflict_records_yours_revision_idx
  on platform_private.cms_conflict_records (yours_revision_id);

-- Write guard: the record is RPC-only, so a direct browser or service-role
-- write is rejected with P0001 before RLS is even consulted.
create trigger cms_conflict_records_write_guard
before insert or update or delete on platform_private.cms_conflict_records
for each row execute function platform_private.cms_write_guard();

-- RLS posture: enabled and forced, browser and service roles revoked, and one
-- policy that admits a row only inside a verified CMS RPC context.
do $body$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cms_conflict_records'
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
