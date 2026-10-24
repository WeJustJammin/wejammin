-- Slice 12 lane L1 (BE03c Database Schema "GovernedReview", "GovernedReviewDecision",
-- "GovernedReviewAssignment", "GovernedReviewDependency", Governed review machinery (DEC-137); tracker
-- P2-S12-AC-196, AC-251 .. AC-254): the four review tables of the one subject-polymorphic review set keyed by
-- (subject_kind, subject_id).  The 03a cms_schema_reviews set and the 03b editorial review tables keep their
-- own tables and operations.
--
--   cms_governed_reviews              the mutable CAS envelope (open -> approved | rejected | invalidated, approved
--                                     -> invalidated); frozen evidence never changes.
--   cms_governed_review_assignments   the bounded read+decide access window of one reviewer on one frozen review.
--   cms_governed_review_decisions     append-only, one per human per review.
--   cms_governed_review_dependencies  the immutable index of the frozen dependency identities.
-- Declarative integrity is here; the state guards (defence in depth under the named RPCs) are in
-- 20261013300400.  Every table has forced RLS, no role grant and one RPC-context policy; the session and
-- relationship predicates follow in 20261013301400.  Forward-only.
begin;
set local lock_timeout = '5s';

create table platform_private.cms_governed_reviews (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null references platform_private.party(id),
  state text not null default 'open',
  version bigint not null default 1,
  subject_kind text not null,
  subject_id uuid not null,
  lineage_id uuid not null,
  subject_key text not null,
  subject_version bigint not null,
  subject_hash char(64) not null,
  block_registry_digest char(64) null,
  risk_class text not null,
  required_decision_count smallint not null,
  recorded_decision_count smallint not null default 0,
  required_capabilities jsonb not null,
  policy_basis jsonb not null,
  policy_basis_hash char(64) not null,
  approval_evidence_hash char(64) not null,
  submitted_by uuid not null references platform_private.person_party(party_id),
  submitted_at timestamptz not null default pg_catalog.clock_timestamp(),
  decided_at timestamptz null,
  activated_at timestamptz null,
  invalidated_reason text null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cms_governed_reviews_state_check check (state in ('open', 'approved', 'rejected', 'invalidated')),
  constraint cms_governed_reviews_version_check check (version > 0),
  constraint cms_governed_reviews_subject_kind_check check (
    subject_kind in ('template_version', 'pattern_version', 'taxonomy_version')
  ),
  constraint cms_governed_reviews_subject_key_check check (subject_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  constraint cms_governed_reviews_subject_version_check check (subject_version > 0),
  constraint cms_governed_reviews_subject_hash_check check (subject_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_governed_reviews_digest_check check (
    block_registry_digest is null or block_registry_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint cms_governed_reviews_risk_check check (risk_class in ('ordinary', 'protected')),
  constraint cms_governed_reviews_required_count_check check (required_decision_count between 1 and 8),
  constraint cms_governed_reviews_recorded_count_check check (
    recorded_decision_count between 0 and 8 and recorded_decision_count <= required_decision_count
  ),
  constraint cms_governed_reviews_capabilities_check check (
    pg_catalog.jsonb_typeof(required_capabilities) = 'array'
    and pg_catalog.jsonb_array_length(required_capabilities) between 1 and 16
  ),
  constraint cms_governed_reviews_policy_basis_check check (
    pg_catalog.jsonb_typeof(policy_basis) = 'array'
    and pg_catalog.jsonb_array_length(policy_basis) between 1 and 64
  ),
  constraint cms_governed_reviews_policy_basis_hash_check check (policy_basis_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_governed_reviews_approval_evidence_check check (approval_evidence_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_governed_reviews_protected_check check (
    risk_class <> 'protected'
    or (required_decision_count >= 2 and pg_catalog.jsonb_array_length(required_capabilities) >= 2)
  ),
  constraint cms_governed_reviews_invalidated_reason_check check (
    invalidated_reason is null or invalidated_reason in ('dependency_changed', 'reviewer_authority_changed')
  ),
  constraint cms_governed_reviews_invalidated_state_check check (
    (state = 'invalidated') = (invalidated_reason is not null)
  ),
  constraint cms_governed_reviews_decided_state_check check (
    (state in ('approved', 'rejected')) = (decided_at is not null)
  ),
  constraint cms_governed_reviews_activated_state_check check (
    activated_at is null or state = 'approved'
  ),
  constraint cms_governed_reviews_id_owner_key unique (id, owner_id)
);

create unique index cms_governed_reviews_live_subject_unique
  on platform_private.cms_governed_reviews (subject_kind, subject_id)
  where state in ('open', 'approved');
create index cms_governed_reviews_owner_state_updated_idx
  on platform_private.cms_governed_reviews (owner_id, state, updated_at desc);
create index cms_governed_reviews_kind_lineage_state_idx
  on platform_private.cms_governed_reviews (subject_kind, lineage_id, state);
create index cms_governed_reviews_submitter_updated_idx
  on platform_private.cms_governed_reviews (submitted_by, updated_at desc);

create table platform_private.cms_governed_review_assignments (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  review_id uuid not null references platform_private.cms_governed_reviews(id),
  reviewer_person_id uuid not null references platform_private.person_party(party_id),
  grantor_person_id uuid not null references platform_private.person_party(party_id),
  capability_key text not null,
  actions text[] not null,
  state text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text null,
  version bigint not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cms_governed_review_assignments_capability_check check (capability_key = 'cms.definition_review'),
  constraint cms_governed_review_assignments_actions_check check (actions = array['read', 'decide']::text[]),
  constraint cms_governed_review_assignments_state_check check (state in ('active', 'revoked')),
  constraint cms_governed_review_assignments_reason_check check (
    reason is null or pg_catalog.char_length(reason) between 1 and 256
  ),
  constraint cms_governed_review_assignments_version_check check (version > 0),
  constraint cms_governed_review_assignments_window_check check (ends_at > starts_at),
  constraint cms_governed_review_assignments_ceiling_check check (ends_at <= starts_at + interval '7 days'),
  constraint cms_governed_review_assignments_review_owner_fkey
    foreign key (review_id, owner_id) references platform_private.cms_governed_reviews(id, owner_id),
  -- A decision names (assignment, review, reviewer) as one key: only the reviewer's own assignment of the
  -- same review can authorize it.
  constraint cms_governed_review_assignments_id_review_reviewer_key unique (id, review_id, reviewer_person_id)
);

create unique index cms_governed_review_assignments_active_reviewer_unique
  on platform_private.cms_governed_review_assignments (review_id, reviewer_person_id)
  where state = 'active';
create index cms_governed_review_assignments_review_reviewer_state_idx
  on platform_private.cms_governed_review_assignments (review_id, reviewer_person_id, state);
create index cms_governed_review_assignments_reviewer_state_ends_idx
  on platform_private.cms_governed_review_assignments (reviewer_person_id, state, ends_at);
create index cms_governed_review_assignments_owner_state_ends_idx
  on platform_private.cms_governed_review_assignments (owner_id, state, ends_at);

create table platform_private.cms_governed_review_decisions (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'recorded',
  version bigint not null default 1,
  review_id uuid not null references platform_private.cms_governed_reviews(id),
  reviewer_person_id uuid not null references platform_private.person_party(party_id),
  acting_party_id uuid null references platform_private.party(id),
  assignment_id uuid not null,
  assignment_version bigint not null,
  capability text not null,
  decision text not null,
  reason text not null,
  comment_hash char(64) not null,
  reviewed_hash char(64) not null,
  step_up_at timestamptz not null,
  decided_at timestamptz not null default pg_catalog.clock_timestamp(),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint cms_governed_review_decisions_state_check check (state = 'recorded'),
  constraint cms_governed_review_decisions_version_check check (version = 1),
  constraint cms_governed_review_decisions_assignment_version_check check (assignment_version > 0),
  constraint cms_governed_review_decisions_capability_check check (
    pg_catalog.octet_length(capability) between 1 and 128
  ),
  constraint cms_governed_review_decisions_decision_check check (decision in ('approve', 'reject')),
  constraint cms_governed_review_decisions_reject_slot_check check (
    decision <> 'reject' or capability = 'cms.reviewer'
  ),
  constraint cms_governed_review_decisions_reason_check check (pg_catalog.char_length(reason) between 1 and 2000),
  constraint cms_governed_review_decisions_comment_hash_check check (
    comment_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(reason, 'UTF8')), 'hex')
  ),
  constraint cms_governed_review_decisions_reviewed_hash_check check (reviewed_hash ~ '^[a-f0-9]{64}$'),
  constraint cms_governed_review_decisions_time_check check (updated_at = created_at),
  constraint cms_governed_review_decisions_review_owner_fkey
    foreign key (review_id, owner_id) references platform_private.cms_governed_reviews(id, owner_id),
  constraint cms_governed_review_decisions_assignment_fkey
    foreign key (assignment_id, review_id, reviewer_person_id)
    references platform_private.cms_governed_review_assignments(id, review_id, reviewer_person_id),
  constraint cms_governed_review_decisions_review_reviewer_key unique (review_id, reviewer_person_id)
);

create index cms_governed_review_decisions_review_decided_idx
  on platform_private.cms_governed_review_decisions (review_id, decided_at);
create index cms_governed_review_decisions_reviewer_decided_idx
  on platform_private.cms_governed_review_decisions (reviewer_person_id, decided_at desc);

create table platform_private.cms_governed_review_dependencies (
  id uuid not null default extensions.gen_random_uuid() primary key,
  owner_id uuid not null,
  state text not null default 'active',
  version bigint not null default 1,
  review_id uuid not null references platform_private.cms_governed_reviews(id),
  kind text not null,
  ref_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint cms_governed_review_dependencies_state_check check (state = 'active'),
  constraint cms_governed_review_dependencies_version_check check (version = 1),
  constraint cms_governed_review_dependencies_kind_check check (
    kind in ('block', 'pattern', 'content_type', 'canonical_domain')
  ),
  constraint cms_governed_review_dependencies_time_check check (updated_at = created_at),
  constraint cms_governed_review_dependencies_review_owner_fkey
    foreign key (review_id, owner_id) references platform_private.cms_governed_reviews(id, owner_id),
  constraint cms_governed_review_dependencies_review_kind_ref_key unique (review_id, kind, ref_id)
);

create index cms_governed_review_dependencies_kind_ref_idx
  on platform_private.cms_governed_review_dependencies (kind, ref_id);
create index cms_governed_review_dependencies_review_idx
  on platform_private.cms_governed_review_dependencies (review_id);

do $security$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cms_governed_reviews', 'cms_governed_review_assignments',
    'cms_governed_review_decisions', 'cms_governed_review_dependencies'
  ] loop
    execute pg_catalog.format('alter table platform_private.%I enable row level security', table_name);
    execute pg_catalog.format('alter table platform_private.%I force row level security', table_name);
    execute pg_catalog.format(
      'revoke all on table platform_private.%I from public, anon, authenticated, service_role', table_name);
    execute pg_catalog.format(
      'create policy %I on platform_private.%I for all to public using (platform_private.cms_rpc_context_valid()) with check (platform_private.cms_rpc_context_valid())',
      table_name || '_rpc_policy', table_name);
    execute pg_catalog.format(
      'create trigger %I before insert or update or delete on platform_private.%I for each row execute function platform_private.cms_write_guard()',
      table_name || '_write_guard', table_name);
  end loop;
end;
$security$;

create trigger cms_governed_review_dependencies_immutable_guard
before update or delete on platform_private.cms_governed_review_dependencies
for each row execute function platform_private.cms_immutable_guard();
create trigger cms_governed_review_decisions_immutable_guard
before update or delete on platform_private.cms_governed_review_decisions
for each row execute function platform_private.cms_immutable_guard();

grant insert, select, update on table
  platform_private.cms_governed_reviews,
  platform_private.cms_governed_review_assignments
  to wejammin_cms_definer;
grant insert, select on table
  platform_private.cms_governed_review_decisions,
  platform_private.cms_governed_review_dependencies
  to wejammin_cms_definer;

comment on table platform_private.cms_governed_reviews is
  'BE03c GovernedReview: one review per subject version (template_version, pattern_version, taxonomy_version), frozen evidence plus the CAS state; written only by the named governed RPCs.';

commit;
