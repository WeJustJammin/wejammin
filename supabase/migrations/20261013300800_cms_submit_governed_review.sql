-- Slice 12 lane s12_governed_red GREEN (BE03c "Governed review machinery", "Governed policy basis",
-- "Subject state machine", "Authorization", "Data Flow" CMS-03C-06 at 168, 1345, 1467, 1502; DEC-188;
-- tracker P2-S12-AC-064, AC-197, AC-205, AC-249, AC-251, AC-262): the CMS-03C-06 submit command.
--
--   platform_private.cms_submit_governed_review(p_request jsonb) returns jsonb - the atomic private body;
--   platform_api.cms_submit_governed_review(p_request jsonb)      - the Worker transport (20261013300810).
--
-- Order of the evaluation (a refusal is a P0001 whose whole message is the token; nothing a refusal does is
-- committed): 1. structure (exact keys; closed kind; a NULL/absent subjectKind is refused, not concealed;
-- UUID; 64-hex hash); 2. concealment (an absent, cross-owner or non-member subject is NOT_FOUND); 3. lock
-- order (1345): position 1 cms_lock_governed_authority FOR SHARE, then the subject row FOR UPDATE via
-- cms_governed_subject_resolve(...,true), then the dependency graph and bound content-type versions FOR
-- SHARE via cms_governed_lock_graph; re-prove the authority after the locks (a visible subject without the
-- owner capability is 403 capability_missing); 4. the idempotency identity is resolved BEFORE the state/live
-- guards: a same-key request whose body changed is the exact IDEMPOTENCY_MISMATCH (never aliased to
-- CONFLICT, 20261003130000) even after a prior submit moved the subject to review, and a same-fingerprint
-- completed record returns the original persisted response, but only for a caller that still holds
-- visibility and the owner capability (a revoked or hidden caller never receives the cached body);
-- 5. the subject must be draft, the submitted hash equal to the stored content_hash and no live review,
-- else 409 subject_not_submittable; 6. the strictest-of policy basis is resolved fail-closed, the block
-- digest recomputed, and the kind-specific dependencies rechecked (pattern: every nested pattern active,
-- compatible and acyclic and every bound content type active; taxonomy: a registered provider for EVERY
-- declared canonical domain else 422 canonical_source_unavailable); 7. idempotency is reserved only after
-- the preconditions; 8. the open review, its dependency rows, the subject draft -> review move
-- (lifecycle_version + 1; the definition version is immutable, DEC-188) and one audit record commit
-- atomically. No outbox event. A replay returns the original response and writes no second audit. No step-up
-- and no If-Match (168).
--
-- Dependency on the preserved 20261013300000-00700 helpers (read-only, root reviewing): cms_actor,
-- cms_acting_party, cms_correlation, cms_valid_uuid, cms_exact_keys, cms_reserve, cms_complete,
-- cms_record_audit, cms_jcs_sha256, cms_request_hash, cms_key_hash, cms_entry_tenant_visible,
-- cms_person_holds_capability, identity_actor_person, cms_governed_subject_resolve,
-- cms_governed_lock_graph, cms_governed_policy_basis, cms_governed_current_digest,
-- cms_governed_dependency_refs, cms_governed_review_resource, cms_governed_owner_capability,
-- cms_governed_pattern_closure, cms_canonical_domain_current, and the three version-table lifecycle guards.
-- Forward-only.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_submit_governed_review(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  subject_kind text;
  subject_id uuid;
  subject_hash text;
  subject jsonb;
  owner_id uuid;
  owner_capability text;
  basis jsonb;
  basis_hash text;
  digest text;
  approval_evidence_hash text;
  review_id uuid := extensions.gen_random_uuid();
  prior_lifecycle text := coalesce(pg_catalog.current_setting('app.cms_governed_lifecycle', true), '');
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1. structure: a NULL/absent subjectKind must not fall through to concealment
  if not platform_private.cms_exact_keys(
    p_request,
    array['subjectKind','subjectId','subjectHash']::text[],
    array['subjectKind','subjectId','subjectHash','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(p_request->'subjectKind') is distinct from 'string'
     or (p_request->>'subjectKind') not in ('template_version','pattern_version','taxonomy_version') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'subjectId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'subjectId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'subjectHash') is distinct from 'string'
     or p_request->>'subjectHash' !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  subject_kind := p_request->>'subjectKind';
  subject_id := (p_request->>'subjectId')::uuid;
  subject_hash := p_request->>'subjectHash';

  -- 2. concealment: an absent, cross-owner or non-member subject is NOT_FOUND
  subject := platform_private.cms_governed_subject_resolve(subject_kind, subject_id);
  if subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  owner_id := (subject->>'ownerId')::uuid;
  person_id := platform_private.identity_actor_person(actor_id);
  if person_id is null or owner_id is distinct from acting_party_id
     or not platform_private.cms_entry_tenant_visible(actor_id, owner_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  owner_capability := platform_private.cms_governed_owner_capability(subject_kind);

  -- 3. lock order (1345): position 1 authority rows FOR SHARE, then the subject FOR UPDATE, the dependency
  --    graph and the bound content-type versions FOR SHARE; re-prove the authority under the locks (1467)
  perform platform_private.cms_lock_governed_authority(actor_id, acting_party_id, owner_capability);
  subject := platform_private.cms_governed_subject_resolve(subject_kind, subject_id, true);
  if subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_governed_lock_graph(subject_kind, owner_id, subject);
  if not platform_private.cms_person_holds_capability(owner_id, person_id, owner_capability) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- 4. the idempotency identity is resolved BEFORE the state/live guards: a same-key request whose body
  --    changed is the exact IDEMPOTENCY_MISMATCH even after a prior submit moved the subject to review; a
  --    same-fingerprint completed record returns the original response, but only to a caller that still
  --    holds visibility and the owner capability (both proved above), so a revoked or hidden caller never
  --    receives the cached body.  This never newly reserves; the late reserve below does.
  select record.* into reservation
    from platform_private.idempotency_records record
   where record.actor_id = actor_id
     and record.operation = 'CMS-03C-06'
     and record.key_hash = platform_private.cms_key_hash(nullif(p_request->>'idempotencyKey', ''));
  if found then
    if reservation.request_hash <> extensions.digest(
         platform_private.cms_request_hash(p_request) || pg_catalog.uuid_send(acting_party_id), 'sha256') then
      raise exception 'IDEMPOTENCY_MISMATCH' using errcode = 'P0001';
    end if;
    if reservation.state = 'completed'::platform_private.idempotency_state then
      if reservation.response_ref->'safeHeaders' ? 'response' then
        return reservation.response_ref->'safeHeaders'->'response';
      end if;
      raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
    end if;
  end if;

  -- 5. the subject must be draft with the equal hash and no live review
  if subject->>'state' is distinct from 'draft'
     or subject->>'contentHash' is distinct from subject_hash then
    raise exception 'subject_not_submittable' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_governed_reviews review
     where review.subject_kind = subject_kind and review.subject_id = subject_id
       and review.state in ('open','approved')
  ) then
    raise exception 'subject_not_submittable' using errcode = 'P0001';
  end if;

  -- 6. the strictest-of policy basis (fail-closed) and the kind-specific dependency rechecks
  basis := platform_private.cms_governed_policy_basis(subject_kind, owner_id, subject);
  basis_hash := basis->>'basisHash';
  if subject_kind = 'taxonomy_version' then
    digest := null;
    -- every declared canonical domain must have a current REGISTERED provider, else 422
    if exists (
      select 1 from pg_catalog.jsonb_array_elements_text(coalesce(subject->'canonicalDomains','[]'::jsonb)) declared(value)
       where not exists (
         select 1 from platform_private.cms_canonical_domain_current(declared.value) current_row
          where current_row.provider_state = 'built')
    ) then
      raise exception 'canonical_source_unavailable' using errcode = 'P0001';
    end if;
  elsif subject_kind = 'pattern_version' then
    -- every nested pattern version must be active (and, by construction, compatible and acyclic)
    if exists (
      select 1 from platform_private.cms_governed_pattern_closure(owner_id, subject->'blockTree') closure
       where closure.item_kind = 'pattern' and closure.nested_state is distinct from 'active'
    ) then
      raise exception 'pattern_version_not_active' using errcode = 'P0001';
    end if;
    digest := platform_private.cms_governed_current_digest(subject_kind, owner_id, subject);
    if digest is distinct from subject->>'blockRegistryDigest' then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements_text(coalesce(subject->'typeIds','[]'::jsonb)) bound(value)
       where not exists (
         select 1 from platform_private.cms_governed_bound_versions(subject_kind, owner_id, subject) b
          where b.content_type_id = bound.value::uuid)
    ) then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
  else
    digest := platform_private.cms_governed_current_digest(subject_kind, owner_id, subject);
    if digest is distinct from subject->>'blockRegistryDigest' then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
  end if;

  -- 7. reserve idempotency only after the preconditions; a same-key different-body reservation keeps the
  --    exact IDEMPOTENCY_MISMATCH (cms_reserve raises it; it is never aliased to CONFLICT), and a completed
  --    record (a concurrent winner under the same key) returns the stored response
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-06');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 8. the open review, its dependency rows, the draft -> review move and one audit record, atomically
  approval_evidence_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'policyBasisHash', basis_hash, 'subjectHash', subject_hash,
    'subjectId', subject_id, 'subjectKind', subject_kind));
  begin
    insert into platform_private.cms_governed_reviews(
      id, owner_id, state, version, subject_kind, subject_id, lineage_id, subject_key,
      subject_version, subject_hash, block_registry_digest, risk_class,
      required_decision_count, recorded_decision_count, required_capabilities,
      policy_basis, policy_basis_hash, approval_evidence_hash, submitted_by)
    values (
      review_id, owner_id, 'open', 1, subject_kind, subject_id,
      (subject->>'lineageId')::uuid, subject->>'key',
      (subject->>'versionNumber')::bigint, subject_hash, digest, basis->>'riskClass',
      (basis->>'requiredDecisionCount')::smallint, 0, basis->'requiredCapabilities',
      basis->'basis', basis_hash, approval_evidence_hash, person_id);
  exception when unique_violation then
    raise exception 'subject_not_submittable' using errcode = 'P0001';
  end;
  insert into platform_private.cms_governed_review_dependencies(
    owner_id, state, version, review_id, kind, ref_id)
  select owner_id, 'active', 1, review_id, ref.dependency_kind, ref.dependency_ref
    from platform_private.cms_governed_dependency_refs(subject_kind, owner_id, subject) ref;

  -- the definition version is immutable (DEC-188); only lifecycle_version advances (draft -> review)
  begin
    perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
    if subject_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = subject_id;
    elsif subject_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = subject_id;
    else
      update platform_private.cms_taxonomy_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = subject_id;
    end if;
  exception when others then
    perform pg_catalog.set_config('app.cms_governed_lifecycle', prior_lifecycle, true);
    raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', prior_lifecycle, true);

  perform platform_private.cms_record_audit(
    'cms.governed.review.submit', actor_id, acting_party_id,
    'cms_governed_review', review_id, 'CMS_GOVERNED_REVIEW_SUBMITTED', correlation_id);

  response := platform_private.cms_governed_review_resource(review_id);
  perform platform_private.cms_complete(reservation.id, review_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_submit_governed_review(jsonb) is
  'CMS-03C-06: an owner-capability holder submits a draft template, pattern or taxonomy version for governed review: structure, concealment, the Slice 12 lock order (authority fence first), the authority recheck, a visibility-and-capability-gated completed replay, the draft/equal-hash/no-live-review preconditions, the strictest-of policy basis, the kind-specific dependency rechecks (taxonomy canonical providers, pattern nested/bound state) and the recomputed digest, then the open review, its dependency rows, the draft -> review move (lifecycle_version + 1; the definition version is immutable) and one audit record in one transaction. Private; the Worker calls the platform_api wrapper.';

grant insert, select, update on table platform_private.cms_governed_reviews to wejammin_cms_definer;
grant insert, select on table platform_private.cms_governed_review_dependencies to wejammin_cms_definer;
grant select on table platform_private.idempotency_records to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_submit_governed_review(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_submit_governed_review(jsonb)
  from public, anon, authenticated, service_role;

commit;
