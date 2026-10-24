-- CMS-03C-06 forward binding fix: the isolated submit diagnostic reached SQLSTATE 42702
-- for the actor_id local in an idempotency lookup. Prefix only actor_id, subject_kind and
-- subject_id locals; keep table columns, JSON keys, ordering, locks and refusals unchanged.
-- Existing function ownership and privileges are retained, not granted anew. Compare every
-- pg_proc attribute except prosrc before/after replacement, including OID, ACL and security.
-- Historical 20261013300800 and the public wrapper remain unchanged. Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $before$
declare
  private_target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_submit_governed_review(jsonb)');
begin
  if private_target is null then
    raise exception 'governed submit function is missing' using errcode = '55000';
  end if;
  perform pg_catalog.set_config('wejammin.fix_governed_submit_attrs', (
    select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
      from pg_catalog.pg_proc proc where proc.oid = private_target), true);
end;
$before$;

create or replace function platform_private.cms_submit_governed_review(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  v_subject_kind text;
  v_subject_id uuid;
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
  v_actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, v_actor_id);
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
  v_subject_kind := p_request->>'subjectKind';
  v_subject_id := (p_request->>'subjectId')::uuid;
  subject_hash := p_request->>'subjectHash';

  -- 2. concealment: an absent, cross-owner or non-member subject is NOT_FOUND
  subject := platform_private.cms_governed_subject_resolve(v_subject_kind, v_subject_id);
  if subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  owner_id := (subject->>'ownerId')::uuid;
  person_id := platform_private.identity_actor_person(v_actor_id);
  if person_id is null or owner_id is distinct from acting_party_id
     or not platform_private.cms_entry_tenant_visible(v_actor_id, owner_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  owner_capability := platform_private.cms_governed_owner_capability(v_subject_kind);

  -- 3. lock order (1345): position 1 authority rows FOR SHARE, then the subject FOR UPDATE, the dependency
  --    graph and the bound content-type versions FOR SHARE; re-prove the authority under the locks (1467)
  perform platform_private.cms_lock_governed_authority(v_actor_id, acting_party_id, owner_capability);
  subject := platform_private.cms_governed_subject_resolve(v_subject_kind, v_subject_id, true);
  if subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_governed_lock_graph(v_subject_kind, owner_id, subject);
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
   where record.actor_id = v_actor_id
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
     where review.subject_kind = v_subject_kind and review.subject_id = v_subject_id
       and review.state in ('open','approved')
  ) then
    raise exception 'subject_not_submittable' using errcode = 'P0001';
  end if;

  -- 6. the strictest-of policy basis (fail-closed) and the kind-specific dependency rechecks
  basis := platform_private.cms_governed_policy_basis(v_subject_kind, owner_id, subject);
  basis_hash := basis->>'basisHash';
  if v_subject_kind = 'taxonomy_version' then
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
  elsif v_subject_kind = 'pattern_version' then
    -- every nested pattern version must be active (and, by construction, compatible and acyclic)
    if exists (
      select 1 from platform_private.cms_governed_pattern_closure(owner_id, subject->'blockTree') closure
       where closure.item_kind = 'pattern' and closure.nested_state is distinct from 'active'
    ) then
      raise exception 'pattern_version_not_active' using errcode = 'P0001';
    end if;
    digest := platform_private.cms_governed_current_digest(v_subject_kind, owner_id, subject);
    if digest is distinct from subject->>'blockRegistryDigest' then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements_text(coalesce(subject->'typeIds','[]'::jsonb)) bound(value)
       where not exists (
         select 1 from platform_private.cms_governed_bound_versions(v_subject_kind, owner_id, subject) b
          where b.content_type_id = bound.value::uuid)
    ) then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
  else
    digest := platform_private.cms_governed_current_digest(v_subject_kind, owner_id, subject);
    if digest is distinct from subject->>'blockRegistryDigest' then
      raise exception 'subject_not_submittable' using errcode = 'P0001';
    end if;
  end if;

  -- 7. reserve idempotency only after the preconditions; a same-key different-body reservation keeps the
  --    exact IDEMPOTENCY_MISMATCH (cms_reserve raises it; it is never aliased to CONFLICT), and a completed
  --    record (a concurrent winner under the same key) returns the stored response
  reservation := platform_private.cms_reserve(p_request, v_actor_id, 'CMS-03C-06');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 8. the open review, its dependency rows, the draft -> review move and one audit record, atomically
  approval_evidence_hash := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'policyBasisHash', basis_hash, 'subjectHash', subject_hash,
    'subjectId', v_subject_id, 'subjectKind', v_subject_kind));
  begin
    insert into platform_private.cms_governed_reviews(
      id, owner_id, state, version, subject_kind, subject_id, lineage_id, subject_key,
      subject_version, subject_hash, block_registry_digest, risk_class,
      required_decision_count, recorded_decision_count, required_capabilities,
      policy_basis, policy_basis_hash, approval_evidence_hash, submitted_by)
    values (
      review_id, owner_id, 'open', 1, v_subject_kind, v_subject_id,
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
    from platform_private.cms_governed_dependency_refs(v_subject_kind, owner_id, subject) ref;

  -- the definition version is immutable (DEC-188); only lifecycle_version advances (draft -> review)
  begin
    perform pg_catalog.set_config('app.cms_governed_lifecycle', 'true', true);
    if v_subject_kind = 'template_version' then
      update platform_private.cms_template_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = v_subject_id;
    elsif v_subject_kind = 'pattern_version' then
      update platform_private.cms_pattern_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = v_subject_id;
    else
      update platform_private.cms_taxonomy_versions
         set state = 'review', lifecycle_version = lifecycle_version + 1,
             updated_at = pg_catalog.clock_timestamp()
       where id = v_subject_id;
    end if;
  exception when others then
    perform pg_catalog.set_config('app.cms_governed_lifecycle', prior_lifecycle, true);
    raise;
  end;
  perform pg_catalog.set_config('app.cms_governed_lifecycle', prior_lifecycle, true);

  perform platform_private.cms_record_audit(
    'cms.governed.review.submit', v_actor_id, acting_party_id,
    'cms_governed_review', review_id, 'CMS_GOVERNED_REVIEW_SUBMITTED', correlation_id);

  response := platform_private.cms_governed_review_resource(review_id);
  perform platform_private.cms_complete(reservation.id, review_id, 201, response);
  return response;
end;
$body$;

do $after$
declare
  private_target regprocedure := pg_catalog.to_regprocedure('platform_private.cms_submit_governed_review(jsonb)');
begin
  if (select (pg_catalog.to_jsonb(proc) - 'prosrc')::text
        from pg_catalog.pg_proc proc where proc.oid = private_target)
     is distinct from pg_catalog.current_setting('wejammin.fix_governed_submit_attrs', true) then
    raise exception 'governed submit: function metadata changed'
      using errcode = '55000';
  end if;
end;
$after$;

commit;
