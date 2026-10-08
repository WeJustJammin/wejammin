-- Slice 10 round 2 (lane H, Codex SQL review 3 findings 1 and 2): ONE lock order shared
-- by the entry/revision writers, both schema activation commands and authority
-- revocation.
--
-- The deadlocks (reproduced with the real RPCs by the race runners 010 and 014):
--   1. A writer (20261005012300/012400) takes the entry row, the actor's authority rows
--      FOR SHARE, then the active version row FOR SHARE.  The activation took the
--      candidate and the active version FOR UPDATE and only THEN the authority rows
--      (cms_lock_activation_authority FOR UPDATE on every tenure and grant of the owner):
--      writer holds authority (S) and wants the version (S), activation holds the
--      version (X) and wants authority (X) -> SQLSTATE 40P01.
--   2. A revocation updates a grant or tenure row of a counted approver; its AFTER ROW
--      trigger (cms_activation_review_invalidation_trigger) locks the reviews and then
--      updates the candidate.  The activation held the candidate and waited for that
--      grant or tenure row -> SQLSTATE 40P01, so revocation did not deterministically win.
--
-- The one global order is
--     acting context binding -> membership tenure -> actor grants      (authority rows)
--     -> entry assignments / presence (authority-loss seams)
--     -> candidate version -> dependency graph -> active version        (schema rows)
--     -> review rows -> review assignments -> migration plan
-- with the entry row ahead of the authority rows for the entry writers (no activation
-- command locks an entry row).  Writers already follow it (entry, authority S, version S).
-- Revocation follows it: its own UPDATE is the authority row, its seams then lock
-- assignments and presence, and cms_invalidate_activation_reviews now locks the CANDIDATE
-- before the reviews (it took the reviews first), the order the submit, decide and
-- activation commands already use.  Both activation commands now take the authority rows
-- first: cms_lock_activation_authority is split into
--   cms_lock_activation_identity_authority(owner, actor, binding)  binding, tenure, grants
--   cms_lock_activation_review_rows(candidate)                     reviews, review assignments
-- (the old function remains as their composite).  The human switch locks the identity
-- rows before its candidate row and proves the activator's capability again under them;
-- the Worker switch and cms_worker_human_approval_valid do the same.  A replay of an
-- already-active candidate takes no authority lock.
--
-- Defense in depth: PostgreSQL's deadlock detector remains for any pair of commands
-- outside this order; the lock helpers below convert a deadlock into the typed
-- retryable CONFLICT (nothing committed) instead of a raw 40P01 (20261005013100 does the
-- same for the six command wrappers).
--
-- cms_worker_human_approval_valid no longer reports a lock failure as "not approved":
-- only a real evidence failure is APPROVAL_INVALID; a deadlock or lock failure is CONFLICT.
--
-- Signatures, SECURITY DEFINER attributes, search_path, owners and grants of the
-- redefined functions are unchanged (CREATE OR REPLACE); the two new functions follow
-- the definer discipline (fixed search_path, owner wejammin_cms_definer, no public
-- execute).  Forward-only.
begin;

create or replace function platform_private.cms_lock_activation_identity_authority(
  p_owner_id uuid, p_actor_id uuid, p_context_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_person_id uuid;
begin
  if p_owner_id is null then
    return;
  end if;
  -- An actor with no resolvable person has no acting-context binding to lock; the
  -- owner's tenure and grant rows are still locked.
  begin
    actor_person_id := platform_private.identity_actor_person(p_actor_id);
  exception
    when others then
      actor_person_id := null;
  end;
  begin
    if p_context_id is not null then
      perform 1
        from platform_private.acting_context_binding context_binding
       where context_binding.id = p_context_id
       order by context_binding.id
       for update;
    elsif actor_person_id is not null then
      perform 1
        from platform_private.acting_context_binding context_binding
       where context_binding.person_id = actor_person_id
         and context_binding.acting_party_id = p_owner_id
         and context_binding.state = 'active'
       order by context_binding.id
       for update;
    end if;
    perform 1
      from identity_private.membership_tenure tenure
     where tenure.organization_id = p_owner_id
     order by tenure.id
     for update;
    perform 1
      from identity_private.organization_actor_grant actor_grant
     where actor_grant.organization_id = p_owner_id
     order by actor_grant.organization_id, actor_grant.person_id,
              actor_grant.capability_code
     for update;
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
end;
$body$;

comment on function platform_private.cms_lock_activation_identity_authority(uuid, uuid, uuid) is
  'First step of the schema-activation lock order: FOR UPDATE on the activator''s acting-context binding, every membership tenure and every actor grant of the owner organization, in that order. Taken before the candidate row so writers, revocations and activations share one order; a deadlock is the typed retryable CONFLICT. Private.';

create or replace function platform_private.cms_lock_activation_review_rows(
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  begin
    perform 1
      from platform_private.cms_schema_reviews review
     where review.content_type_version_id = p_candidate_id
     order by review.id
     for update;
    perform 1
      from platform_private.cms_schema_review_assignments assignment
      join platform_private.cms_schema_reviews review on review.id = assignment.review_id
     where review.content_type_version_id = p_candidate_id
     order by assignment.id
     for update of assignment;
  exception
    when deadlock_detected then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
end;
$body$;

comment on function platform_private.cms_lock_activation_review_rows(uuid) is
  'Last lock step of the schema-activation order: FOR UPDATE on the candidate''s review rows and their reviewer assignments, after the candidate and its graph. A deadlock is the typed retryable CONFLICT. Private.';

-- The composite the earlier migrations call: identity authority, then review rows.
create or replace function platform_private.cms_lock_activation_authority(
  p_candidate_id uuid, p_actor_id uuid, p_context_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
declare
  owner_id uuid;
begin
  select version_row.owner_id into owner_id
    from platform_private.cms_content_type_versions version_row
   where version_row.id = p_candidate_id;
  if owner_id is null then
    return;
  end if;
  perform platform_private.cms_lock_activation_identity_authority(
    owner_id, p_actor_id, p_context_id
  );
  perform platform_private.cms_lock_activation_review_rows(p_candidate_id);
end;
$body$;

-- The invalidation locks the CANDIDATE first, then its reviews (the order of the
-- submit, decide and activation commands), and only if the candidate is still in
-- review or approved once the lock is held.
create or replace function platform_private.cms_invalidate_activation_reviews(
  p_candidate_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  invalidated_count integer;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  perform 1
    from platform_private.cms_content_type_versions version_row
   where version_row.id = p_candidate_id
     and version_row.state in (
       'review'::platform_private.cms_definition_state,
       'approved'::platform_private.cms_definition_state
     )
   for update;
  if not found then
    return 0;
  end if;
  with locked_reviews as materialized (
    select review.id
      from platform_private.cms_schema_reviews review
      join platform_private.cms_content_type_versions version_row
        on version_row.id = review.content_type_version_id
     where review.content_type_version_id = p_candidate_id
       and review.state in ('open', 'approved')
       and version_row.state in (
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       )
     order by review.id
     for update of review
  )
  update platform_private.cms_schema_reviews review
     set state = 'invalidated',
         version = review.version + 1,
         updated_at = pg_catalog.clock_timestamp()
    from locked_reviews
   where review.id = locked_reviews.id;
  get diagnostics invalidated_count = row_count;
  if invalidated_count > 0 then
    update platform_private.cms_content_type_versions version_row
       set state = 'draft'::platform_private.cms_definition_state,
           version = version_row.version + 1,
           updated_at = pg_catalog.clock_timestamp(),
           activation_workflow_policy_key = null,
           activation_workflow_policy_version = null,
           activation_workflow_policy_hash = null,
           activation_required_decision_count = null,
           activation_required_capabilities = null,
           activation_approval_evidence_hash = null
     where version_row.id = p_candidate_id
       and version_row.state in (
         'review'::platform_private.cms_definition_state,
         'approved'::platform_private.cms_definition_state
       );
  end if;
  return invalidated_count;
end;
$body$;

-- Worker-side recheck of the same evidence for the second atomic switch: authority
-- rows first, then the candidate.  Only an evidence failure is "not approved".
create or replace function platform_private.cms_worker_human_approval_valid(p_candidate_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $body$
declare
  candidate platform_private.cms_content_type_versions%rowtype;
  candidate_owner_id uuid;
  candidate_creator uuid;
begin
  select version_row.owner_id, version_row.created_by
    into candidate_owner_id, candidate_creator
    from platform_private.cms_content_type_versions version_row
   where version_row.id = p_candidate_id;
  if not found then
    return false;
  end if;
  perform platform_private.cms_lock_activation_identity_authority(
    candidate_owner_id, candidate_creator, null
  );
  select * into candidate from platform_private.cms_content_type_versions
   where id = p_candidate_id for update;
  if not found then
    return false;
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  perform platform_private.cms_lock_activation_review_rows(candidate.id);
  perform platform_private.cms_resolve_activation_review(candidate.id, null);
  return true;
exception
  when deadlock_detected then
    raise exception 'CONFLICT' using errcode = 'P0001';
  when others then
    -- A lock failure converted by the helpers above is not an evidence failure.
    if sqlerrm = 'CONFLICT' then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    return false;
end;
$body$;

CREATE OR REPLACE FUNCTION platform_private.cms_activate_schema(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
<<activation_block>>
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  candidate platform_private.cms_content_type_versions%rowtype;
  current_active platform_private.cms_content_type_versions%rowtype;
  review_row platform_private.cms_schema_reviews%rowtype;
  binding record;
  expected_version bigint;
  approval_ids uuid[];
  review_id uuid;
  migration_plan_id uuid;
  evidence jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  correlation_id := platform_private.cms_correlation(p_request);
  reservation := platform_private.cms_reserve_conflict(
    p_request, actor_id, 'CMS-03A-04:' || coalesce(p_request->>'versionId', ''));
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    return jsonb_build_object('state', 'active', 'contentTypeVersionId',
      (reservation.response_ref->>'resourceRef')::uuid, 'eventType', 'cms.schema.activated.v1');
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId']::text[],
    array['contentTypeId','versionId','expectedVersion','dryRunId','approvalIds','migrationPlanId',
          'expectedActivationEvidenceHash','idempotencyKey','ifMatch','context','correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := platform_private.cms_expected_version(p_request);
  if not platform_private.cms_valid_uuid(p_request->>'contentTypeId')
     or not platform_private.cms_valid_uuid(p_request->>'versionId')
     or not platform_private.cms_valid_uuid(p_request->>'dryRunId')
     or pg_catalog.jsonb_typeof(p_request->'approvalIds') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request->'approvalIds') not between 1 and 8 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_request->'approvalIds') a
     where not platform_private.cms_valid_uuid(a)
  ) or (select count(distinct value) from jsonb_array_elements_text(p_request->'approvalIds') value)
         <> jsonb_array_length(p_request->'approvalIds') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  select array_agg(value::uuid order by value::uuid) into approval_ids
    from jsonb_array_elements_text(p_request->'approvalIds') as approval(value);
  -- LOCK ORDER (Codex SQL review 3, findings 1 and 2).  The one global order is
  --   authority rows (acting context binding, membership tenure, actor grants)
  --   -> candidate version -> dependency graph -> active version -> review rows.
  -- Writers (entry row, then these authority rows shared, then the active version
  -- shared) and authority revocation (the authority row it updates, then the
  -- candidate and reviews its AFTER trigger invalidates) walk the same order, so no two
  -- of them can wait for each other.  The authority rows are locked here, BEFORE the
  -- candidate row, and the activator's own capability is proven again under the locks:
  -- a revocation that committed first is seen, one that follows waits for this
  -- transaction.  Only a candidate of the caller's own organization is ever locked on
  -- (an unknown or foreign id falls through to the NOT_FOUND below with nothing
  -- locked), so the early pass is no lock lever over another organization.
  if exists (
    select 1 from platform_private.cms_content_type_versions early_version
     where early_version.id = (p_request->>'versionId')::uuid
       and early_version.content_type_id = (p_request->>'contentTypeId')::uuid
       and early_version.owner_id = acting_party_id
  ) then
    perform platform_private.cms_lock_activation_identity_authority(
      acting_party_id, actor_id,
      (select early_binding.id
         from platform_private.acting_context_binding early_binding
        where early_binding.id = case
                when platform_private.cms_valid_uuid(p_request->'context'->>'actingContextId')
                then (p_request->'context'->>'actingContextId')::uuid end
          and early_binding.acting_party_id = activation_block.acting_party_id
          and early_binding.person_id = platform_private.identity_actor_person(actor_id))
    );
    perform platform_private.cms_require_capability(actor_id, acting_party_id, 'cms.schema_designer');
  end if;
  select * into candidate from platform_private.cms_content_type_versions
   where id = (p_request->>'versionId')::uuid
     and content_type_id = (p_request->>'contentTypeId')::uuid
     and owner_id = acting_party_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.version <> expected_version then
    perform platform_private.cms_raise_version_mismatch(expected_version, candidate.version);
  end if;
  if candidate.state <> 'approved' or candidate.version <> expected_version then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.dry_run_id is distinct from (p_request->>'dryRunId')::uuid then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from platform_private.cms_schema_artifacts artifact
     where artifact.id = candidate.schema_artifact_id
       and artifact.content_type_version_id = candidate.id
       and artifact.artifact_hash = candidate.definition_hash
       and artifact.state = 'compiled'
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  current_active := null;
  select * into current_active from platform_private.cms_content_type_versions active_version
   where active_version.content_type_id = candidate.content_type_id
     and active_version.owner_id = candidate.owner_id
     and active_version.state = 'active'
     and active_version.id <> candidate.id
   order by active_version.id
   for update;
  if candidate.supersedes_id is distinct from current_active.id then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if candidate.compatibility in ('conditional', 'breaking')
     and nullif(p_request->>'migrationPlanId', '') is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->'migrationPlanId' <> 'null'::jsonb
     and not platform_private.cms_valid_uuid(p_request->>'migrationPlanId') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- Only the activator's own binding-bound MFA is rechecked; the server-verified
  -- envelope's step-up flags and timestamps are never authority.
  select * into binding from platform_private.cms_review_binding(
    p_request, actor_id, acting_party_id, true);
  perform platform_private.cms_lock_activation_authority(candidate.id, actor_id, binding.binding_id);
  review_id := platform_private.cms_resolve_activation_review(candidate.id, approval_ids);
  select * into review_row from platform_private.cms_schema_reviews where id = review_id;
  -- The review froze the candidate's locale configuration hash; the candidate
  -- row must still recompute to exactly that value.
  if review_row.locale_config_hash is distinct from platform_private.cms_locale_config_hash(
       candidate.source_locale, candidate.default_locale,
       candidate.supported_locales, candidate.fallback_chains) then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if not platform_private.cms_activation_references_valid(candidate.id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  evidence := jsonb_build_object(
    'key', review_row.policy_key,
    'version', review_row.policy_version::text,
    'policyHash', review_row.policy_hash,
    'riskClass', review_row.risk_class,
    'requiredDecisionCount', review_row.required_decision_count,
    'requiredCapabilities', review_row.required_capabilities,
    'approvalEvidenceHash', review_row.approval_evidence_hash
  );
  if p_request ? 'expectedActivationEvidenceHash'
     and p_request->'expectedActivationEvidenceHash' <> 'null'::jsonb
     and p_request->>'expectedActivationEvidenceHash' <> review_row.approval_evidence_hash then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  migration_plan_id := platform_private.cms_advance_activation_plan(
    candidate.id, current_active.id,
    case when p_request->'migrationPlanId' = 'null'::jsonb
      then null else (p_request->>'migrationPlanId')::uuid end,
    (p_request->>'dryRunId')::uuid
  );
  -- The previous active version is superseded first: at most one version of a
  -- type may be active at any instant.
  if current_active.id is not null then
    update platform_private.cms_content_type_versions
       set state = 'superseded', updated_at = now(), version = version + 1
     where id = current_active.id;
  end if;
  update platform_private.cms_content_type_versions
     set state = 'active', version = version + 1, updated_at = now(),
         approved_at = coalesce(approved_at, now())
   where id = candidate.id and version = expected_version;
  if not found then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1, updated_at = now()
   where id = candidate.content_type_id;
  perform platform_private.cms_emit_event(
    'cms.schema.activate', actor_id, acting_party_id, 'cms_content_type_version', candidate.id,
    'CMS_SCHEMA_ACTIVATED', 'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    expected_version + 1,
    jsonb_build_object(
      'contentTypeId', candidate.content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', migration_plan_id,
      'localeConfigHash', review_row.locale_config_hash,
      'activationEvidence', evidence
    ), correlation_id
  );
  -- The SchemaActivationResource: the common resource metadata plus the
  -- activation facts; the committed event id is never part of the resource.
  response := platform_private.cms_with_content_hash(jsonb_build_object(
    'id', candidate.id, 'version', (expected_version + 1)::text,
    'createdAt', candidate.created_at, 'updatedAt', pg_catalog.clock_timestamp(),
    'contentTypeVersionId', candidate.id, 'state', 'active',
    'activatedAt', pg_catalog.clock_timestamp(),
    'migrationPlanId', migration_plan_id, 'activationEvidence', evidence,
    'localeConfigHash', review_row.locale_config_hash,
    'jobId', null, 'eventType', 'cms.schema.activated.v1'
  ));
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$function$;

CREATE OR REPLACE FUNCTION platform_private.cms_worker_activate_schema(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  plan_id uuid;
  request_content_type_id uuid;
  schema_version_id uuid;
  expected_active_version_id uuid;
  expected_version bigint;
  plan_row platform_private.cms_schema_migration_plans%rowtype;
  candidate platform_private.cms_content_type_versions%rowtype;
  current_active platform_private.cms_content_type_versions%rowtype;
  actor_id uuid;
  reservation platform_private.idempotency_records;
  response jsonb;
  event_id uuid;
  risk_class text;
begin
  perform platform_private.cms_worker_require_request(
    p_request,
    array[
      'migrationPlanId', 'contentTypeId', 'schemaVersionId', 'expectedVersion',
      'expectedActiveVersionId', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash', 'idempotencyKey',
      'switchOnlyOnce'
    ]::text[],
    array[
      'migrationPlanId', 'contentTypeId', 'schemaVersionId', 'expectedVersion',
      'expectedActiveVersionId', 'transformKey', 'transformVersion',
      'compilerHash', 'sourceHash', 'targetHash', 'idempotencyKey',
      'switchOnlyOnce'
    ]::text[]
  );
  if p_request->'switchOnlyOnce' is distinct from 'true'::jsonb then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  plan_id := platform_private.cms_worker_uuid(p_request->>'migrationPlanId');
  request_content_type_id := platform_private.cms_worker_uuid(p_request->>'contentTypeId');
  schema_version_id := platform_private.cms_worker_uuid(p_request->>'schemaVersionId');
  expected_active_version_id := platform_private.cms_worker_uuid(p_request->>'expectedActiveVersionId');
  expected_version := platform_private.cms_worker_positive(p_request->>'expectedVersion');
  -- Read the plan only to discover the candidate owner.  Do not hold the
  -- plan lock yet: human activation takes candidate/graph/active locks first,
  -- so taking plan -> candidate here would deadlock a concurrent switch.
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.content_type_id <> request_content_type_id
     or plan_row.to_version_id <> schema_version_id
     or plan_row.from_version_id <> expected_active_version_id
     or plan_row.version <> expected_version
     or plan_row.state <> 'completed' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  -- LOCK ORDER (Codex SQL review 3, findings 1 and 2): the identity authority rows
  -- (the creator's acting context binding, every membership tenure and actor grant of
  -- the owner) are taken BEFORE the candidate row, exactly as the human switch does,
  -- so a writer or a revocation holding those rows can never wait for a row this
  -- switch already holds.  An already-active candidate (a replay) needs no authority
  -- lock.
  if exists (
    select 1 from platform_private.cms_content_type_versions early_version
     where early_version.id = schema_version_id
       and early_version.content_type_id = request_content_type_id
       and early_version.owner_id = plan_row.owner_id
       and early_version.state <> 'active'::platform_private.cms_definition_state
  ) then
    perform platform_private.cms_lock_activation_identity_authority(
      plan_row.owner_id,
      (select early_version.created_by
         from platform_private.cms_content_type_versions early_version
        where early_version.id = schema_version_id),
      null
    );
  end if;
  select * into candidate
    from platform_private.cms_content_type_versions version_row
   where version_row.id = schema_version_id
     and version_row.content_type_id = request_content_type_id
     and version_row.owner_id = plan_row.owner_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  actor_id := coalesce(candidate.created_by, plan_row.created_by, plan_id);
  -- The class is the FROZEN one (strictest-of review snapshot, or the exact frozen
  -- registry member): a newer version of the same policy key never changes it.
  risk_class := platform_private.cms_activation_frozen_risk_class(candidate.id);
  -- Keep the worker's lock order identical to human activation:
  -- candidate -> dependency graph -> current active -> authority/review /
  -- context -> migration plan.  The initial plan read above is unlocked;
  -- this order prevents a human switch (which reaches the plan after its
  -- source row) from deadlocking against a worker holding plan first.
  perform platform_private.cms_lock_activation_graph(candidate.id);
  if candidate.state = 'active'::platform_private.cms_definition_state then
    -- An active replay has no source row or fresh human decision to acquire;
    -- it still rechecks the immutable dependency graph below.
    null;
  else
    if candidate.state <> 'approved'::platform_private.cms_definition_state then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select * into current_active
      from platform_private.cms_content_type_versions version_row
     where version_row.id = expected_active_version_id
       and version_row.content_type_id = request_content_type_id
       and version_row.owner_id = plan_row.owner_id
       and version_row.state = 'active'::platform_private.cms_definition_state
     for update;
    if not found then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not platform_private.cms_worker_human_approval_valid(candidate.id) then
      raise exception 'APPROVAL_INVALID' using errcode = 'P0001';
    end if;
    if (select review.locale_config_hash
          from platform_private.cms_schema_reviews review
         where review.content_type_version_id = candidate.id
           and review.state = 'approved'
         order by review.decided_at desc, review.id desc
         limit 1) is distinct from platform_private.cms_locale_config_hash(
           candidate.source_locale, candidate.default_locale,
           candidate.supported_locales, candidate.fallback_chains) then
      raise exception 'CONFLICT' using errcode = 'P0001';
    end if;
    if not platform_private.cms_activation_references_valid(candidate.id) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end if;
  -- The plan lock is acquired only after the same graph/source/authority
  -- locks as the human path.  Revalidate every unlocked snapshot before use.
  select * into plan_row
    from platform_private.cms_schema_migration_plans plan
   where plan.id = plan_id
   for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if plan_row.content_type_id <> request_content_type_id
     or plan_row.to_version_id <> schema_version_id
     or plan_row.from_version_id <> expected_active_version_id
     or plan_row.version <> expected_version
     or plan_row.state <> 'completed' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  perform platform_private.cms_worker_validate_fingerprint(plan_row, p_request);
  if not platform_private.cms_migration_plan_ready(
    plan_id, request_content_type_id, schema_version_id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if candidate.state <> 'active'::platform_private.cms_definition_state
     and not platform_private.cms_migration_source_unchanged(plan_row) then
    raise exception 'CONFLICT' using detail = 'MIGRATION_SOURCE_DRIFT', errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(
    p_request, actor_id, 'CMS-03A-WORKER-ACTIVATE:' || plan_id::text
  );
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if candidate.state = 'active'::platform_private.cms_definition_state then
    -- A replay/status call must not turn an already-active row into a blind
    -- bypass of the immutable artifact/reference boundary.  Human approval
    -- is intentionally not recomputed here: the active row's server-owned
    -- activation evidence is the replay authority, while the first switch
    -- below requires the fresh review path.
    if not platform_private.cms_activation_references_valid(candidate.id) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if candidate.activation_workflow_policy_key is null
       or candidate.activation_workflow_policy_version is null
       or candidate.activation_workflow_policy_hash is null
       or candidate.activation_required_decision_count is null
       or candidate.activation_required_capabilities is null
       or candidate.activation_approval_evidence_hash is null then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select event.id into event_id
      from platform_private.outbox_events event
     where event.event_type = 'cms.schema.activated.v1'
       and event.aggregate_id = candidate.id
     order by event.occurred_at desc, event.id desc
     limit 1;
    response := jsonb_build_object(
      'activated', false,
      'status', 'already_active',
      'migrationPlanId', plan_id,
      'schemaVersionId', candidate.id,
      'eventId', event_id,
      'activationEvidence', jsonb_build_object(
        'key', candidate.activation_workflow_policy_key,
        'version', candidate.activation_workflow_policy_version::text,
        'policyHash', candidate.activation_workflow_policy_hash,
        'riskClass', risk_class,
        'requiredDecisionCount', candidate.activation_required_decision_count,
        'requiredCapabilities', candidate.activation_required_capabilities,
        'approvalEvidenceHash', candidate.activation_approval_evidence_hash
      )
    );
    perform platform_private.cms_complete(reservation.id, candidate.id, 200, response);
    return response;
  end if;
  update platform_private.cms_content_type_versions
     set state = 'superseded', version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
   where id = current_active.id;
  update platform_private.cms_content_type_versions
     set state = 'active',
         version = version + 1,
         updated_at = pg_catalog.clock_timestamp(),
         approved_at = coalesce(approved_at, pg_catalog.clock_timestamp())
   where id = candidate.id;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1,
         updated_at = pg_catalog.clock_timestamp()
     where id = request_content_type_id;
  event_id := platform_private.cms_emit_event(
    'cms.schema.activate.worker', actor_id, plan_row.owner_id,
    'cms_content_type_version', candidate.id, 'CMS_SCHEMA_ACTIVATED',
    'cms.schema.activated.v1', 'cms_content_type_version', candidate.id,
    candidate.version + 1,
    jsonb_build_object(
      'contentTypeId', request_content_type_id,
      'schemaVersionId', candidate.id,
      'migrationPlanId', plan_id,
      'localeConfigHash', candidate.locale_config_hash,
      'activationEvidence', jsonb_build_object(
        'key', candidate.activation_workflow_policy_key,
        'version', candidate.activation_workflow_policy_version::text,
        'policyHash', candidate.activation_workflow_policy_hash,
        'riskClass', risk_class,
        'requiredDecisionCount', candidate.activation_required_decision_count,
        'requiredCapabilities', candidate.activation_required_capabilities,
        'approvalEvidenceHash', candidate.activation_approval_evidence_hash
      )
    ),
    plan_id
  );
  response := jsonb_build_object(
    'activated', true,
    'status', 'activated',
    'migrationPlanId', plan_id,
    'schemaVersionId', candidate.id,
    'eventId', event_id,
    'activationEvidence', jsonb_build_object(
      'key', candidate.activation_workflow_policy_key,
      'version', candidate.activation_workflow_policy_version::text,
      'policyHash', candidate.activation_workflow_policy_hash,
      'riskClass', risk_class,
      'requiredDecisionCount', candidate.activation_required_decision_count,
      'requiredCapabilities', candidate.activation_required_capabilities,
      'approvalEvidenceHash', candidate.activation_approval_evidence_hash
    )
  );
  perform platform_private.cms_complete(reservation.id, candidate.id, 202, response);
  return response;
end;
$function$;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_lock_activation_identity_authority(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_lock_activation_review_rows(uuid)
  owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_lock_activation_identity_authority(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lock_activation_review_rows(uuid)
  from public, anon, authenticated, service_role;

commit;
