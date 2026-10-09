-- Slice 11 lane S11-3b, CMS-03B-09 (BE03b "Publication lineage (E3)", "Recent MFA (E6)", "Separation of
-- duties (E11)", "Publication preflight registry (D19)", DEC-157 lock order, DEC-158(e), DEC-159; tracker
-- P2-S11-AC-029 .. AC-034, AC-048, AC-107, AC-114 .. AC-116): platform_private.cms_publish_revision(p_request
-- jsonb) returns jsonb, with the platform_api wrapper the Worker calls (service_role only).
--
-- An owner-party publisher publishes a revision whose LATEST review is approved.  Order of the evaluation (a
-- refusal is a P0001 whose whole message is the token; structured members ride in a JSON-OBJECT DETAIL;
-- nothing a refusal does is committed except the review invalidation of step 7):
--   1. structure: exact keys (a caller action, locale or owner is an unknown key), UUID ids, the field
--      pointers (VALIDATION_FAILED at /frozenHash, /expectedVersionSet, /audience, /expectedVersion,
--      /ifMatch, all reported together);
--   2. the step-up proof (STEP_UP_REQUIRED) before anything is read and before the reservation;
--   3. concealment and authority: a revision outside the caller's workflow scope, or not of the named entry,
--      is NOT_FOUND; a visible one without the owner-party cms.publisher grant is capability_missing; the
--      author of the revision is separation_of_duties;
--   4. global lock order: the entry row FOR SHARE (0), the authority rows of the publisher and of every
--      decider of the latest review (1), the capability re-proved under the locks, then the idempotency
--      reservation (an exact replay returns the stored resource, even with freshly evaluated proof);
--   5. the content-type version FOR SHARE (4) and the latest review FOR UPDATE (5); its version is the CAS
--      operand (VERSION_MISMATCH) and it must be approved (CONFLICT);
--   6. frozenHash equals the review's frozen hash (422 at /frozenHash) and expectedVersionSet equals the
--      version set frozen on the review (409 version_set_stale);
--   7. the frozen manifest is rebuilt and every frozen identity must be current: otherwise the review
--      invalidation (dependency_changed) COMMITS and the committed-refusal envelope is returned and stored;
--   8. the publish-phase preflight (17 categories, no short circuit) with the Worker's accessibility proof;
--   9. cms_append_publication_lineage appends the next row under the lineage advisory lock (position 7) with
--      its audit record and exactly one cms.publication.changed.v1; the accessibility summary of the proof
--      (DEC-159 (5)) and the completed idempotency record (202) commit with it.  projectionState is `pending` until a Shard 04 consumer reports (DEC-158(e)).
-- A lineage collision of two racing publications is publication_conflict (the loser commits nothing).
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_publish_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  violations jsonb := '[]'::jsonb;
  requested_entry uuid;
  requested_revision uuid;
  frozen_hash text;
  expected_set jsonb;
  audience_value text;
  expected_version bigint;
  evidence jsonb;
  target jsonb;
  publisher_person uuid;
  reservation platform_private.idempotency_records;
  review_row platform_private.cms_editorial_reviews%rowtype;
  frozen_set jsonb;
  refusal jsonb;
  appended jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId', 'revisionId', 'frozenHash', 'expectedVersionSet', 'audience', 'expectedVersion', 'ifMatch',
          'idempotencyKey']::text[],
    array['entryId', 'revisionId', 'frozenHash', 'expectedVersionSet', 'audience', 'expectedVersion', 'ifMatch',
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
  evidence := p_request->'evidence';
  if pg_catalog.jsonb_typeof(evidence) = 'null' then
    evidence := null;
  elsif evidence is not null and pg_catalog.jsonb_typeof(evidence) <> 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry := (p_request->>'entryId')::uuid;
  requested_revision := (p_request->>'revisionId')::uuid;
  frozen_hash := p_request->>'frozenHash';
  expected_set := p_request->'expectedVersionSet';
  audience_value := p_request->>'audience';

  if pg_catalog.jsonb_typeof(p_request->'frozenHash') is distinct from 'string'
     or frozen_hash !~ '^[a-f0-9]{64}$' then
    violations := violations || '["/frozenHash"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(expected_set) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       expected_set,
       array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
             'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
             'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[],
       array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
             'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
             'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[]
     ) then
    violations := violations || '["/expectedVersionSet"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'audience') is distinct from 'string'
     or audience_value !~ '^[a-z0-9_-]{1,48}$' then
    violations := violations || '["/audience"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807') then
    violations := violations || '["/expectedVersion"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    violations := violations || '["/ifMatch"]'::jsonb;
  end if;
  if pg_catalog.jsonb_array_length(violations) > 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = violations::text;
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  expected_version := (p_request->>'expectedVersion')::bigint;

  -- 2. the step-up proof (E6): before the review is read and before the reservation
  perform platform_private.cms_editorial_step_up_instant(p_request);

  -- 3. concealment (404) and authority (403)
  target := platform_private.cms_publication_target(actor_id, acting_party_id, requested_revision, requested_entry, 'publish');
  publisher_person := (target->>'personId')::uuid;

  -- 4. global lock order positions 0-1, the capability re-proved under the locks, then the reservation
  perform platform_private.cms_publication_lock_authority(requested_entry, acting_party_id, publisher_person, requested_revision);
  if not platform_private.cms_person_holds_capability(acting_party_id, publisher_person, 'cms.publisher') then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(p_request - 'evidence', actor_id, 'CMS-03B-09');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      perform pg_catalog.set_config(
        'response.headers', '[{"x-cms-idempotent-replay": "true"}]', true);
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5. positions 4-5: the approved review and its CAS operand
  review_row := platform_private.cms_publication_lock_review(requested_revision);
  perform platform_private.cms_publication_review_operand(review_row, expected_version);

  -- 6. the frozen hash and the frozen version set echoed back by the caller
  if frozen_hash <> review_row.frozen_hash then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/frozenHash"]';
  end if;
  frozen_set := platform_private.cms_revision_version_set(review_row.revision_id, review_row.dependency_manifest);
  if expected_set is distinct from frozen_set then
    raise exception 'version_set_stale' using errcode = 'P0001';
  end if;

  -- 7. every frozen identity must still be current: otherwise the invalidation COMMITS
  if platform_private.cms_frozen_dependencies_status(review_row.revision_id, review_row.dependency_manifest)
     is distinct from 'current' then
    refusal := platform_private.cms_publication_stale_refusal(review_row.id, actor_id, correlation_id);
    perform platform_private.cms_complete(reservation.id, review_row.id, 409, refusal);
    return refusal;
  end if;

  -- 8. the publish-phase preflight registry
  perform platform_private.cms_publication_preflight_verdict(
    'publish', review_row, acting_party_id, publisher_person, pg_catalog.clock_timestamp(), evidence);

  -- 9. the lineage row, its audit record and the one cms.publication.changed.v1
  appended := platform_private.cms_append_publication_lineage(pg_catalog.jsonb_build_object(
    'entryId', requested_entry,
    'revisionId', review_row.revision_id,
    'locale', target->>'locale',
    'audience', audience_value,
    'action', 'publish',
    'publisherPersonId', publisher_person,
    'versionSet', frozen_set,
    'dependencyHash', review_row.dependency_hash,
    'activationEvidenceHash', platform_private.cms_activation_evidence_hash(review_row.id),
    'correlationId', correlation_id,
    'actorId', actor_id
  ));
  -- DEC-159 (5): the Worker's proof is summarized against the publication event it accompanied.
  perform platform_private.cms_record_command_accessibility_evidence(
    'CMS-03B-09', (appended->>'publicationVersionId')::uuid, review_row.revision_id,
    (select event.id
       from platform_private.outbox_events event
      where event.event_type = 'cms.publication.changed.v1'
        and event.aggregate_id = (appended->>'id')::uuid
        and event.aggregate_version = (appended->>'version')::bigint),
    correlation_id, evidence);
  perform platform_private.cms_complete(reservation.id, (appended->>'publicationVersionId')::uuid, 202, appended);
  return appended;
end;
$body$;

comment on function platform_private.cms_publish_revision(jsonb) is
  'CMS-03B-09: an owner-party publisher publishes a revision whose latest review is approved: step-up, workflow-scope concealment, the DEC-157 lock order, the approved review''s version as the CAS operand, the frozen hash and version set echoed back, frozen-dependency currency (a stale manifest commits the invalidation and answers the committed refusal), the publish-phase preflight, then one append-only lineage row with its audit record and exactly one cms.publication.changed.v1. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_publish_revision(p_request jsonb)
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
    rpc_result := platform_private.cms_publish_revision(p_request);
  exception
    -- BE03b lock order: a residual deadlock or lock failure is the typed retryable CONFLICT.
    when deadlock_detected or lock_not_available then
      raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

-- SEC-2: the command names no table beyond what its helpers and the lineage append already hold.
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_publish_revision(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_publish_revision(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_publish_revision(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_publish_revision(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_publish_revision(jsonb) to service_role;

commit;
