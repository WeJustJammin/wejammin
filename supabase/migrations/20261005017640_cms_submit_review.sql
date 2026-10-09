-- Slice 11 lane S11-3a, CMS-03B-05 (BE03b "Frozen dependency manifest build and version set
-- (E1, E7)", "Derived revision workflow state (E2)", "Publication preflight registry (D19)",
-- Transaction and external seams; tracker P2-S11-AC-005 .. AC-010, AC-035, AC-085, AC-113,
-- AC-120): platform_private.cms_submit_review(p_request jsonb) returns jsonb, with the
-- platform_api wrapper the Worker calls (service_role only).
--
-- An entry assignee (cms.author or cms.editor, grant AND active assignment) freezes the entry's
-- CURRENT draft revision for review.  Order of the evaluation (a refusal is a P0001 whose whole
-- message is the token; structured members ride in a JSON-OBJECT DETAIL, like VERSION_MISMATCH;
-- nothing a refusal does is committed):
--   1. structure: exact keys (a caller riskClass / owner is an unknown key), UUIDs, positive decimal
--      versions that agree, a 64-lowercase-hex frozenHash, an in-bounds manifest object
--      (VALIDATION_FAILED at /frozenHash, /dependencyManifest, /expectedVersion, /ifMatch);
--   2. concealment: an absent entry, another acting party or a non-member is NOT_FOUND; a visible entry
--      without an assignment is 403 capability_missing.  No step-up (BE03b E6: CMS-03B-05 has none);
--   3. global lock order: the entry row FOR SHARE (position 0: a revision append and a submit
--      serialize, so a review never freezes a draft that was superseded in between), the
--      assignee's authority rows FOR SHARE (position 1), the idempotency reservation (a replay
--      returns the stored response even though the revision is now under review), the entry CAS
--      (VERSION_MISMATCH with expected/current), the revision (NOT_FOUND unless it belongs to
--      the entry), then the revision's content-type version FOR SHARE (position 4);
--   4. the revision must be the entry's current draft with effective state `draft` (409
--      revision_not_submittable: superseded, or already under a live review / approved / rejected /
--      scheduled / published); the stored payload hash is RECOMPUTED from the stored field values
--      (corruption is INTERNAL_ERROR) and must equal the submitted frozenHash;
--   5. the dependency manifest is REBUILT by cms_build_dependency_manifest (dependency_manifest_too_large,
--      DEPENDENCY_UNAVAILABLE) and must equal the submitted one by JCS hash, else 409
--      dependency_changed with DETAIL {"dependencyHash": <current>};
--   6. the submit-phase preflight (17 categories, no short circuit) with the Worker's accessibility
--      evidence: a failed category is 422 preflight_failed with DETAIL {"preflight": [{category,
--      outcome, reasonCode} x17]}, an unavailable one 503 DEPENDENCY_UNAVAILABLE with DETAIL
--      {"dependencyClass":"preflight"} (DEC-159: the Worker adds retryable); stale or mis-bound evidence is the
--      helper's 409 preflight_evidence_stale / dependency_changed (this command adds the current
--      dependencyHash to the DETAIL of the latter);
--   7. the open EditorialReview (version 1) freezes the revision hash, the manifest, its hash, the
--      activation evidence and the strictest-of workflow-policy evidence (risk class, required
--      decision count and capability slots) of the REBUILT manifest; its ReviewDependency rows are
--      the manifest identities (cms_review_dependency_refs); one audit record and one
--      cms.entry.review-changed.v1 {reviewId, revisionId} commit with the completed idempotency record;
--      the accessibility evidence summary { checkerKey, checkerVersion, outcome, blockingCount, inputHash }
--      is appended to cms_command_accessibility_evidence (DEC-159 (5)) whenever evidence was supplied.
-- A unique-index collision on the live-review-per-revision slot (a concurrent submit of the same
-- revision under another key) is 409 revision_not_submittable.  Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_submit_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  submitter_person uuid;
  correlation_id uuid;
  requested_entry uuid;
  requested_revision uuid;
  expected_version bigint;
  frozen_hash text;
  submitted_manifest jsonb;
  evidence jsonb;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  rebuilt jsonb;
  rebuilt_hash text;
  policy jsonb;
  report jsonb;
  failed_results jsonb;
  review_id uuid := extensions.gen_random_uuid();
  event_id uuid;
  submitted_at timestamptz;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId', 'revisionId', 'frozenHash', 'dependencyManifest', 'expectedVersion', 'ifMatch',
          'idempotencyKey']::text[],
    array['entryId', 'revisionId', 'frozenHash', 'dependencyManifest', 'expectedVersion', 'ifMatch',
          'idempotencyKey', 'evidence', 'context', 'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/expectedVersion"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/ifMatch"]';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'frozenHash') is distinct from 'string'
     or p_request->>'frozenHash' !~ '^[a-f0-9]{64}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/frozenHash"]';
  end if;
  submitted_manifest := p_request->'dependencyManifest';
  if pg_catalog.jsonb_typeof(submitted_manifest) is distinct from 'object'
     or not platform_private.cms_dependency_manifest_within_bounds(submitted_manifest) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/dependencyManifest"]';
  end if;
  evidence := p_request->'evidence';
  if evidence is not null and pg_catalog.jsonb_typeof(evidence) not in ('object', 'null') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(evidence) = 'null' then
    evidence := null;
  end if;
  requested_entry := (p_request->>'entryId')::uuid;
  requested_revision := (p_request->>'revisionId')::uuid;
  expected_version := (p_request->>'expectedVersion')::bigint;
  frozen_hash := p_request->>'frozenHash';

  -- 2. concealment (404) and the assignee gate (403)
  submitter_person := platform_private.identity_actor_person(actor_id);
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = requested_entry;
  if not found
     or entry_row.owner_party_id is distinct from acting_party_id
     or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 3. global lock order: entry (0), authority (1), reservation, CAS, revision, schema version (4)
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = requested_entry
     for share;
  perform platform_private.cms_lock_entry_authority(actor_id, acting_party_id, entry_row.id);
  if platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.author', entry_row.id) is null
     and platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.editor', entry_row.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-05');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if entry_row.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, entry_row.version);
  end if;
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = requested_revision
     and revision_item.entry_id = entry_row.id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform 1
    from platform_private.cms_content_type_versions version_item
   where version_item.id = revision_row.schema_version_id
     for share;

  -- 4. only the current draft whose derived state is `draft`; the frozen hash is recomputed
  if entry_row.current_draft_revision_id is distinct from revision_row.id
     or platform_private.cms_revision_effective_state(revision_row.id) is distinct from 'draft' then
    raise exception 'revision_not_submittable' using errcode = 'P0001';
  end if;
  if platform_private.cms_revision_content_hash(
       revision_row.id, revision_row.payload_hash::text, revision_row.locale, revision_row.schema_version_id
     ) is distinct from frozen_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/frozenHash"]';
  end if;

  -- 5. the manifest is rebuilt from canonical state and must equal the submitted one
  rebuilt := platform_private.cms_build_dependency_manifest(revision_row.id);
  rebuilt_hash := platform_private.cms_jcs_sha256(rebuilt);
  if platform_private.cms_jcs_sha256(submitted_manifest) is distinct from rebuilt_hash then
    raise exception 'dependency_changed' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('dependencyHash', rebuilt_hash)::text;
  end if;

  -- 6. the submit-phase preflight registry
  submitted_at := pg_catalog.clock_timestamp();
  begin
    report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
      'phase', 'submit', 'revisionId', revision_row.id, 'actingPartyId', acting_party_id,
      'actorPersonId', submitter_person,
      'effectiveAt', platform_private.auth_iso_time(submitted_at),
      'frozenManifest', rebuilt, 'evidence', evidence));
  exception
    when raise_exception then
      if sqlerrm = 'dependency_changed' then
        raise exception 'dependency_changed' using errcode = 'P0001',
          detail = pg_catalog.jsonb_build_object('dependencyHash', rebuilt_hash)::text;
      end if;
      raise;
  end;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'category', result.item->>'category', 'outcome', result.item->>'outcome',
           'reasonCode', result.item->'reasonCode') order by result.ordinal)
    into failed_results
    from pg_catalog.jsonb_array_elements(report->'results') with ordinality result(item, ordinal);
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result(item)
     where result.item->>'outcome' = 'failed'
  ) then
    raise exception 'preflight_failed' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object('preflight', failed_results)::text;
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(report->'results') result(item)
     where result.item->>'outcome' = 'unavailable'
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001',
      detail = '{"dependencyClass":"preflight"}';
  end if;

  -- 7. the open review and its dependency index
  policy := rebuilt->'schema'->'workflowPolicy';
  begin
    insert into platform_private.cms_editorial_reviews(
      id, owner_id, revision_id, state, version, risk_class, frozen_hash, dependency_manifest,
      dependency_hash, activation_evidence, workflow_policy_key, workflow_policy_version,
      workflow_policy_hash, required_capabilities, required_decision_count,
      recorded_decision_count, approval_evidence_hash, submitted_by, submitted_at,
      invalidated_reason, decided_at, entry_id, created_at, updated_at
    ) values (
      review_id, entry_row.owner_id, revision_row.id, 'open', 1, policy->>'riskClass',
      revision_row.payload_hash::text, rebuilt, rebuilt_hash, rebuilt->'schema'->'activationEvidence',
      policy->>'key', (policy->>'version')::bigint, policy->>'policyHash',
      policy->'requiredCapabilities', (policy->>'requiredDecisionCount')::smallint, 0,
      policy->>'approvalEvidenceHash', submitter_person, submitted_at, null, null,
      entry_row.id, submitted_at, submitted_at
    );
  exception
    when unique_violation then
      raise exception 'revision_not_submittable' using errcode = 'P0001';
  end;
  insert into platform_private.cms_editorial_review_dependencies(
    owner_id, state, version, review_id, kind, ref_id, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, review_id, refs.kind, refs.ref_id, submitted_at, submitted_at
    from platform_private.cms_review_dependency_refs(revision_row.id, rebuilt) refs;

  event_id := platform_private.cms_emit_event(
    'cms.editorial.review.submit', actor_id, acting_party_id,
    'cms_editorial_review', review_id, 'CMS_EDITORIAL_REVIEW_SUBMITTED',
    'cms.entry.review-changed.v1', 'cms_editorial_review', review_id, 1,
    pg_catalog.jsonb_build_object('reviewId', review_id, 'revisionId', revision_row.id),
    correlation_id
  );
  -- DEC-159 (5): the accessibility audit summary of the evidence this command received.
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-05', review_id, revision_row.id, event_id, correlation_id, evidence);
  response := platform_private.cms_editorial_review_resource(review_id);
  perform platform_private.cms_complete(reservation.id, review_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_submit_review(jsonb) is
  'CMS-03B-05: an entry assignee freezes the current draft revision for review: recomputed payload hash, rebuilt dependency manifest equal to the submitted one, submit-phase preflight with the Worker accessibility evidence, then the open review, its dependency index, audit, outbox and idempotency record in one transaction. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_submit_review(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  begin
    rpc_result := platform_private.cms_submit_review(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: what the command reads and writes, held by the definer role only.
grant insert, select, update on table platform_private.cms_editorial_reviews to wejammin_cms_definer;
grant insert, select on table platform_private.cms_editorial_review_dependencies to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_submit_review(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_submit_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_submit_review(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_submit_review(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_submit_review(jsonb) to service_role;

commit;
