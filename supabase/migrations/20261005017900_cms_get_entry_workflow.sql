-- Slice 11 lane S11-3c, CMS-03B-15 (BE03b Route Registry, E1/E2, "Publication preflight registry (D19)",
-- Per-operation authorization matrix, EntryWorkflowResource; tracker P2-S11-AC-049 .. AC-054, AC-089, AC-096):
-- platform_private.cms_get_entry_workflow(p_request jsonb) returns jsonb with the platform_api wrapper the
-- Worker calls (service_role only), and the read-scope helper CMS-03B-15 and the quality-gate load share.
--
-- A SAFE READ: it appends no audit, outbox or idempotency row and stores nothing it computes (the
-- preparation is recomputed on every read; building the manifest records the E7 settings snapshot
-- insert-if-absent, like every manifest build).  The state of the entry, revision, latest review,
-- schedules and publications comes from ONE statement (one snapshot).
--
-- Read scopes (cms_workflow_read_scopes): an entry assignee (active cms.author / cms.editor assignment with
-- the standing grant), an owner-party cms.publisher, or a non-revoked reviewer assignee of a review of the
-- revision.  An absent entry, an entry of another acting party, a caller who is not a confirmed member of
-- the owner organisation, an entry that is neither `active` nor `held`, and a revision of another entry
-- are ONE concealed NOT_FOUND; a confirmed member with no read scope is 403 capability_missing.
--
-- The revision is the one named by revisionId, else the entry's current draft.  Its `state` is the derived
-- effective state (E2).  `preparation` is non-null only for the CURRENT draft whose effective state is
-- `draft` and only for an entry assignee (who alone may submit): the frozen content hash, the rebuilt
-- dependency manifest and hash, the version set, the risk class and workflow policy of the manifest and the
-- submit-phase preflight report (17 results in registry order).  The Worker's accessibility evidence (or
-- null) rides in; stale or mis-bound evidence degrades the accessibility result to unavailable /
-- checker_failed instead of failing the read.  `review` is the latest review of the revision with its
-- frozen candidate; `schedules` the revision's newest 16; `publications` the entry's newest 64 lineage rows
-- (projectionState `pending` until a Shard 04 consumer reports, DEC-158(e)).  permittedNextActions is a
-- hint in the enum order submit_review, assign_reviewer, record_decision, schedule, preview, publish, empty
-- when the entry is not `active`.
-- Forward-only.
begin;

set local lock_timeout = '5s';

create or replace function platform_private.cms_workflow_read_scopes(
  p_actor_id uuid, p_acting_party_id uuid, p_entry_id uuid, p_revision_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  person uuid;
  scopes text[] := array[]::text[];
begin
  if p_actor_id is null or p_acting_party_id is null or p_entry_id is null then
    return scopes;
  end if;
  begin
    person := platform_private.identity_actor_person(p_actor_id);
  exception when others then
    person := null;
  end;
  if person is null then
    return scopes;
  end if;
  if platform_private.cms_authority_origin(p_actor_id, p_acting_party_id, 'cms.author', p_entry_id) is not null
     or platform_private.cms_authority_origin(p_actor_id, p_acting_party_id, 'cms.editor', p_entry_id) is not null then
    scopes := scopes || 'assignee'::text;
  end if;
  if platform_private.cms_person_holds_capability(p_acting_party_id, person, 'cms.publisher') then
    scopes := scopes || 'publisher'::text;
  end if;
  if p_revision_id is not null and exists (
    select 1
      from platform_private.cms_editorial_review_assignments assignment_item
      join platform_private.cms_editorial_reviews review_item on review_item.id = assignment_item.review_id
     where assignment_item.reviewer_person_id = person
       and assignment_item.state = 'active'
       and review_item.revision_id = p_revision_id
       and review_item.owner_id = p_acting_party_id
  ) then
    scopes := scopes || 'reviewer'::text;
  end if;
  return scopes;
end;
$body$;

comment on function platform_private.cms_workflow_read_scopes(uuid, uuid, uuid, uuid) is
  'BE03b CMS-03B-15 workflow read scopes of an actor on an entry/revision in an acting party, from {assignee, publisher, reviewer}; the empty array means no read scope. Private; STABLE.';

create or replace function platform_private.cms_get_entry_workflow(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  person uuid;
  requested_entry uuid;
  requested_revision uuid;
  evidence jsonb;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  scopes text[];
  head jsonb;
  effective text;
  content_hash text;
  review_id uuid;
  review_scopes text[];
  manifest jsonb;
  policy jsonb;
  report jsonb;
  preparation jsonb := 'null'::jsonb;
  actions text[] := array[]::text[];
  review_actions text[];
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Structure: the entry, an optional revision and the Worker's optional proof; the proof is never a browser input.
  if not platform_private.cms_exact_keys(
       p_request, array['entryId']::text[],
       array['entryId', 'revisionId', 'evidence', 'context', 'correlationId']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or (p_request ? 'revisionId' and p_request->'revisionId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true))
     or (p_request ? 'evidence' and pg_catalog.jsonb_typeof(p_request->'evidence') not in ('object', 'null')) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry := (p_request->>'entryId')::uuid;
  if p_request ? 'revisionId' and p_request->'revisionId' <> 'null'::jsonb then
    requested_revision := (p_request->>'revisionId')::uuid;
  end if;
  if p_request ? 'evidence' and p_request->'evidence' <> 'null'::jsonb then
    evidence := p_request->'evidence';
  end if;

  -- Concealment, then the read scope.
  begin
    person := platform_private.identity_actor_person(actor_id);
  exception when others then
    person := null;
  end;
  select entry_item.* into entry_row
    from platform_private.cms_content_entries entry_item
   where entry_item.id = requested_entry;
  if not found
     or person is null
     or entry_row.owner_party_id is distinct from acting_party_id
     or entry_row.lifecycle not in ('active', 'held')
     or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select revision_item.* into revision_row
    from platform_private.cms_entry_revisions revision_item
   where revision_item.id = coalesce(requested_revision, entry_row.current_draft_revision_id)
     and revision_item.entry_id = entry_row.id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  scopes := platform_private.cms_workflow_read_scopes(actor_id, acting_party_id, entry_row.id, revision_row.id);
  if pg_catalog.cardinality(scopes) = 0 then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;

  -- One statement, one snapshot: the entry, the revision, its derived state, the latest review, the
  -- schedules and the publications.
  content_hash := platform_private.cms_revision_content_hash(
    revision_row.id, revision_row.payload_hash::text, revision_row.locale, revision_row.schema_version_id);
  select pg_catalog.jsonb_build_object(
           'entry', pg_catalog.jsonb_build_object(
             'id', entry_item.id, 'version', entry_item.version::text,
             'createdAt', platform_private.auth_iso_time(entry_item.created_at),
             'updatedAt', platform_private.auth_iso_time(entry_item.updated_at)),
           'effective', platform_private.cms_revision_effective_state(revision_row.id),
           'lifecycle', entry_item.lifecycle,
           'isCurrentDraft', entry_item.current_draft_revision_id = revision_row.id,
           'reviewId', latest.id,
           'review', case when latest.id is null then null else
             platform_private.cms_editorial_review_resource(latest.id) || pg_catalog.jsonb_build_object(
               'frozen', pg_catalog.jsonb_build_object(
                 'frozenHash', latest.frozen_hash::text,
                 'dependencyHash', latest.dependency_hash::text,
                 'versionSet', platform_private.cms_version_set_of(
                   latest.dependency_manifest, revision_row.taxonomy_version_ids))) end,
           'schedules', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'id', listed.id, 'version', listed.version::text, 'state', listed.state,
                      'action', listed.action, 'audience', listed.audience,
                      'resolvedUtc', platform_private.auth_iso_time(listed.resolved_at_utc),
                      'reasonCode', case when listed.state in ('blocked', 'cancelled') then listed.reason_code end
                    ) order by listed.created_at desc, listed.id desc)
               from (
                 select schedule_item.*
                   from platform_private.cms_publication_schedules schedule_item
                  where schedule_item.revision_id = revision_row.id
                  order by schedule_item.created_at desc, schedule_item.id desc
                  limit 16
               ) listed
           ), '[]'::jsonb),
           'publications', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'publicationId', listed.publication_id, 'publicationVersionId', listed.id,
                      'version', listed.version::text,
                      'state', platform_private.cms_publication_row_state(listed.id),
                      'action', listed.action, 'revisionId', listed.revision_id, 'locale', listed.locale,
                      'audience', listed.audience, 'publicationHash', listed.publication_hash::text,
                      'projectionState', 'pending',
                      'createdAt', platform_private.auth_iso_time(listed.created_at)
                    ) order by listed.created_at desc, listed.id desc)
               from (
                 select publication_item.*
                   from platform_private.cms_publication_versions publication_item
                  where publication_item.entry_id = entry_item.id
                  order by publication_item.created_at desc, publication_item.id desc
                  limit 64
               ) listed
           ), '[]'::jsonb)
         )
    into head
    from platform_private.cms_content_entries entry_item
    left join lateral (
      select review_item.*
        from platform_private.cms_editorial_reviews review_item
       where review_item.revision_id = revision_row.id
       order by review_item.submitted_at desc, review_item.id desc
       limit 1
    ) latest on true
   where entry_item.id = entry_row.id;
  effective := head->>'effective';
  review_id := (head->>'reviewId')::uuid;

  -- The preparation: only for the current draft an assignee may submit.
  if effective = 'draft'
     and (head->>'isCurrentDraft')::boolean
     and 'assignee' = any (scopes) then
    manifest := platform_private.cms_build_dependency_manifest(revision_row.id);
    policy := manifest->'schema'->'workflowPolicy';
    begin
      report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
        'phase', 'submit', 'revisionId', revision_row.id, 'actingPartyId', acting_party_id,
        'actorPersonId', person,
        'effectiveAt', platform_private.auth_iso_time(pg_catalog.clock_timestamp()),
        'frozenManifest', manifest, 'evidence', evidence));
    exception
      when raise_exception then
        -- A proof that is stale, from another provider or bound to other rows is not a failure of the read:
        -- the accessibility category reports unavailable / checker_failed.
        if sqlerrm in ('preflight_evidence_stale', 'dependency_changed') then
          report := platform_private.cms_evaluate_preflight(pg_catalog.jsonb_build_object(
            'phase', 'submit', 'revisionId', revision_row.id, 'actingPartyId', acting_party_id,
            'actorPersonId', person,
            'effectiveAt', platform_private.auth_iso_time(pg_catalog.clock_timestamp()),
            'frozenManifest', manifest, 'evidence', null));
        else
          raise;
        end if;
    end;
    preparation := pg_catalog.jsonb_build_object(
      'frozenHash', content_hash,
      'dependencyManifest', manifest,
      'dependencyHash', platform_private.cms_jcs_sha256(manifest),
      'versionSet', platform_private.cms_revision_version_set(revision_row.id, manifest),
      'riskClass', policy->>'riskClass',
      'workflowPolicy', policy,
      'preflight', report
    );
  end if;

  -- permittedNextActions, in the enum order, for an `active` entry only.
  if entry_row.lifecycle = 'active' then
    if preparation <> 'null'::jsonb then
      actions := actions || 'submit_review'::text;
    end if;
    if review_id is not null then
      review_scopes := platform_private.cms_editorial_review_scopes(review_id, actor_id, acting_party_id);
      review_actions := platform_private.cms_review_next_actions(review_id, actor_id, acting_party_id, review_scopes);
      if 'assign_reviewer' = any (review_actions) then
        actions := actions || 'assign_reviewer'::text;
      end if;
      if 'record_decision' = any (review_actions) then
        actions := actions || 'record_decision'::text;
      end if;
      if 'schedule' = any (review_actions) then
        actions := actions || 'schedule'::text;
      end if;
    end if;
    if platform_private.cms_preview_scope_holds(person, acting_party_id, entry_row.id, revision_row.id) then
      actions := actions || 'preview'::text;
    end if;
    if review_id is not null and 'publish' = any (review_actions) then
      actions := actions || 'publish'::text;
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'entry', head->'entry',
    'revision', pg_catalog.jsonb_build_object(
      'id', revision_row.id,
      'revisionNumber', revision_row.revision_number::text,
      'locale', revision_row.locale,
      'schemaVersionId', revision_row.schema_version_id,
      'state', effective,
      'contentHash', content_hash,
      'validationState', revision_row.validation_state::text,
      'isCurrentDraft', (head->>'isCurrentDraft')::boolean
    ),
    'preparation', preparation,
    'review', head->'review',
    'schedules', head->'schedules',
    'publications', head->'publications',
    'permittedNextActions', pg_catalog.to_jsonb(actions)
  );
end;
$body$;

comment on function platform_private.cms_get_entry_workflow(jsonb) is
  'CMS-03B-15: the entry workflow and submission preparation read. The entry meta, the revision with its derived state (E2), the latest review with its frozen candidate, up to 16 schedules and 64 publications from one snapshot, and for a current draft an assignee may submit the recomputed preparation (rebuilt manifest and version set, risk class, 17-result submit-phase preflight). Writes no audit, outbox or idempotency row. Private; the Worker calls the platform_api wrapper.';

create or replace function platform_api.cms_get_entry_workflow(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_get_entry_workflow(p_request);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_get_entry_workflow(jsonb) is
  'CMS-03B-15 (GET /api/v1/cms/entries/{entryId}/workflow): EntryWorkflowQuery (+ the Worker accessibility proof) -> EntryWorkflowResource. Safe read; executable by service_role only.';

-- SEC-2: what the read names, held by the definer role only.
grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_entry_revisions,
  platform_private.cms_editorial_reviews,
  platform_private.cms_editorial_review_assignments,
  platform_private.cms_publication_schedules,
  platform_private.cms_publication_versions
  to wejammin_cms_definer;
grant create on schema platform_private, platform_api to wejammin_cms_definer;
alter function platform_private.cms_workflow_read_scopes(uuid, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_get_entry_workflow(jsonb) owner to wejammin_cms_definer;
alter function platform_api.cms_get_entry_workflow(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private, platform_api from wejammin_cms_definer;

revoke all on function platform_private.cms_workflow_read_scopes(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_get_entry_workflow(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_api.cms_get_entry_workflow(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_get_entry_workflow(jsonb) to service_role;

commit;
