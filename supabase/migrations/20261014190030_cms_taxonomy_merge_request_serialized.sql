-- Slice 12 lane taxonomy-terms, CMS-03C-03 (BE03c route registry at 161, validation matrix 372-374 and 408-410, Slice 12 lock order at 1344,
-- D10 / DEC-135 / term actions at 1369-1377, error catalog at 1290 and 1304, grants at 1447, authorization at 1464 and 1478, transaction seam at
-- 1506, term state machine at 1539, event and outbox identity at 1554-1561; P2-S12-AC-016 .. AC-021):
--
--   platform_private.cms_act_taxonomy_term(p_request jsonb) returns jsonb   the atomic private body; the Worker transport is 20261014120510
--
-- Private request (the frozen Worker adapter's payload): the eight TaxonomyTermActionRequest members, the decoded `ifMatch` operand (the strong
-- header repeated as a decimal string and equal to expectedVersion), the idempotencyKey, the server context and the correlationId.  Both
-- operands are the vocabulary's ACTIVE TaxonomyVersion definition number (BE03c 215, "If-Match operands"); term concurrency is the position-6 row lock.
-- Evaluation order; a refusal is a P0001 whose whole message is the token (a lowercase typed reason, or a catalog class that the Worker
-- maps) and nothing a refusal does is committed:
--   1 a non-object body is INVALID_REQUEST;  2 actor and acting party (UNAUTHENTICATED);
--   3 concealment: a caller who cannot read the owner party is NOT_FOUND;
--   4 position 1: the curator's authority rows FOR SHARE, capability re-proved under the lock (`capability_missing`, also before a cached replay);
--   5 the idempotency reservation (IDEMPOTENCY_MISMATCH for another body; a completed one replays the stored resource);
--   6 exact members, member values, the operand (INVALID_REQUEST / VALIDATION_FAILED with DETAIL '["/pointer"]');
--   7 the vocabulary lineage in the caller's owner scope (NOT_FOUND for an absent, foreign or non-lineage id), its ACTIVE version FOR SHARE
--     (position 3; none is `taxonomy_not_active`), the operand against that version's number (CONFLICT);
--   8 position 6: the named term rows (the key, the parent, the survivor) FOR UPDATE in id order, then the action
--     (cms_term_apply_write / cms_term_apply_merge: existence, shape, DEC-135 overlap, hierarchy, the write, label versions, convergence);
--   9 one audit record and one cms.taxonomy.changed.v1 (aggregate cms_term at the term's committed version, payload { taxonomyId,
--     taxonomyVersionId }) and the completed reservation commit atomically with the change.
--
-- DEC-194 / DEC-212 delta over the 20261014120500 and 20261014120300 bodies this file replaces (BE03c "Slice 12 lock order", row
-- cms.taxonomy.merge_converge; "Merge convergence recovery"): a MERGE takes the per-acting-party merge-enqueue mutex
-- platform_private.cms_taxonomy_merge_enqueue_lock (20261014190020) after step 4 (the position-1 authority lock) and before step 5 (the
-- idempotency reservation and every vocabulary/term lock), and the late private enqueue call below takes the same key again (reentrant: the
-- transaction already holds it). The recovery sweep (20261014190050) and the fenced continuation (20261014190040) serialize on the same key, so
-- a recovery decision and the merge's own late enqueue cannot interleave. Nothing else in either body changes. The mutex helper is a no-op
-- for a null party so the enqueue producer keeps raising its own invalid-input error downstream.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_act_taxonomy_term(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  curator constant text := 'cms.taxonomy_curator';
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  lineage_id uuid;
  action_value text;
  active_row platform_private.cms_taxonomy_versions%rowtype;
  locked_id uuid;
  term_id uuid;
  term_version bigint;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  -- 1 and 2
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);
  -- 3 concealment
  begin
    person_id := platform_private.identity_actor_person(actor_id);
  exception when others then
    person_id := null;
  end;
  if person_id is null or not platform_private.cms_entry_tenant_visible(actor_id, acting_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  -- 4 position 1, capability re-proved under the lock
  perform platform_private.cms_lock_governed_authority(actor_id, acting_party_id, curator);
  if not platform_private.cms_person_holds_capability(acting_party_id, person_id, curator) then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  -- 5 idempotency
  if pg_catalog.jsonb_typeof(p_request->'idempotencyKey') is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  -- DEC-194: only a merge can enqueue a convergence job. Take the per-acting-party enqueue mutex AFTER the position-1 authority lock (step 4)
  -- and BEFORE the reservation and the domain locks, so a merge and the recovery sweep/continuation of the same party serialize in one order.
  if p_request->>'action' = 'merge' then
    perform platform_private.cms_taxonomy_merge_enqueue_lock(acting_party_id);
  end if;
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-03');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  -- 6 members, values, operand
  perform platform_private.cms_term_action_values(p_request);
  lineage_id := (p_request->>'taxonomyId')::uuid;
  action_value := p_request->>'action';

  -- 7 the vocabulary and its active version (position 3)
  if not exists (
    select 1 from platform_private.cms_taxonomy_versions root_row
     where root_row.id = lineage_id and root_row.taxonomy_id = lineage_id and root_row.owner_id = acting_party_id
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into active_row
    from platform_private.cms_taxonomy_versions version_row
   where version_row.taxonomy_id = lineage_id and version_row.owner_id = acting_party_id and version_row.state = 'active'
     for share;
  if not found then
    raise exception 'taxonomy_not_active' using errcode = 'P0001';
  end if;
  if active_row.version::text <> p_request->>'expectedVersion' then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;

  -- 8 position 6: the named term rows in ascending id order
  for locked_id in
    select term.id
      from platform_private.cms_terms term
     where term.taxonomy_id = lineage_id and term.owner_id = acting_party_id
       and (term.term_key = p_request->>'termKey'
            or term.id = nullif(p_request->>'parentId', '')::uuid
            or term.id = nullif(p_request->>'survivorId', '')::uuid)
     order by term.id
       for update
  loop
    null;
  end loop;
  if action_value = 'merge' then
    term_id := platform_private.cms_term_apply_merge(actor_id, acting_party_id, active_row.id, p_request, correlation_id);
  else
    term_id := platform_private.cms_term_apply_write(actor_id, acting_party_id, active_row.id, p_request);
  end if;

  -- 9 audit, outbox, completed reservation
  select term.version into term_version from platform_private.cms_terms term where term.id = term_id;
  perform platform_private.cms_emit_event(
    'cms.taxonomy.term.' || action_value, actor_id, acting_party_id, 'cms_term', term_id,
    case action_value when 'create' then 'CMS_TAXONOMY_TERM_CREATED' when 'rename' then 'CMS_TAXONOMY_TERM_RENAMED'
                      when 'alias' then 'CMS_TAXONOMY_TERM_ALIASED' when 'deprecate' then 'CMS_TAXONOMY_TERM_DEPRECATED'
                      else 'CMS_TAXONOMY_TERM_MERGED' end,
    'cms.taxonomy.changed.v1', 'cms_term', term_id, term_version,
    pg_catalog.jsonb_build_object('taxonomyId', lineage_id, 'taxonomyVersionId', active_row.id), correlation_id);
  response := platform_private.cms_term_resource(term_id);
  perform platform_private.cms_complete(reservation.id, term_id, 200, response);
  return response;
end;
$body$;

comment on function platform_private.cms_act_taxonomy_term(jsonb) is
  'CMS-03C-03: a verified taxonomy curator creates, renames, aliases, deprecates or merges a term of a vocabulary under its ACTIVE version: concealment, the position 1 authority fence, the idempotency reservation (a cached replay only for a caller who still holds the capability), strict members and values, the active-version operand, the vocabulary term locks, the DEC-135 canonical overlap check, the write with append-only label versions and the merge convergence, one audit record and one cms.taxonomy.changed.v1 in one transaction. A merge first takes the DEC-194 per-acting-party merge-enqueue mutex (after the position 1 authority lock, before the reservation and the domain locks), the order shared with the continuation and the recovery sweep. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_private.cms_request_taxonomy_merge_converge(
  p_actor_id uuid, p_acting_party_id uuid, p_retired_term_id uuid, p_correlation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  accepted record;
begin
  -- DEC-194: reentrant. The only caller is the merge application (cms_term_apply_merge, 20261014120400), inside cms_act_taxonomy_term, which
  -- already holds this key after its position-1 authority lock; the call keeps this function safe on its own (the BE00 acceptance below
  -- never runs outside the mutex) and a null party is left to the acceptance's own invalid-input error.
  perform platform_private.cms_taxonomy_merge_enqueue_lock(p_acting_party_id);
  select job.job_id, job.replayed into accepted
    from platform_private.accept_job_with_outbox(
      p_actor_id, p_acting_party_id, 'cms.taxonomy.merge_converge', p_correlation_id,
      extensions.digest('cms.taxonomy.merge_converge:' || p_retired_term_id::text, 'sha256'),
      extensions.digest('cms.taxonomy.merge_converge:' || p_acting_party_id::text || ':' || p_retired_term_id::text, 'sha256'),
      pg_catalog.clock_timestamp() + interval '7 days') job;
  return pg_catalog.jsonb_build_object('jobId', accepted.job_id, 'replayed', accepted.replayed);
end;
$body$;

comment on function platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid) is
  'BE03c 1334: enqueues the BE00 job cms.taxonomy.merge_converge for a merge whose assignments outgrew its transaction; one job per retired term (idempotent). Takes (reentrantly for a merge) the DEC-194 per-acting-party merge-enqueue mutex before the acceptance. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_act_taxonomy_term(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_act_taxonomy_term(jsonb) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_request_taxonomy_merge_converge(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;

commit;
