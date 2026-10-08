-- Slice 10 WP-S10-3 (BE03b EditPresence; Middleware "Autosave and presence";
-- IA03 Presence and Edge Cases "Authority revoked during autosave/review"):
-- the advisory edit-presence lease, wired to its real producers.
--
-- The presence row itself is created by 20260927090000_cms_editorial_support_
-- authority.sql.  FE03 keeps EditPresence physical-only ("non-browser
-- identifiers that must remain outside the unions: ... EditPresence,
-- lease_until, last_seen_at") and BE03b's route registry has no presence
-- endpoint, so presence is never a browser or PostgREST command.  The lease
-- is strictly advisory and has three producers, none of them a caller:
--
--   * renewal: every authorized CMS-03B-01 autosave renews the author's
--     two-minute lease inside the write transaction (cms_create_revision calls
--     the private cms_touch_edit_presence command after its capability,
--     tenant, lifecycle, CAS and path-validation gates).  Renewal is the sole
--     permitted timestamp/version update exception, guarded by a monotonic CAS
--     on the presence version, never advances the entry aggregate, never
--     blocks another editor (one row per entry and person) and never grants
--     write authority;
--   * revocation: losing authority releases the active lease (state revoked)
--     in the same transaction as the loss.  The authority sources are the
--     organization actor-grant projection, the membership tenure and the entry
--     assignment; an AFTER ROW trigger on each calls the one release helper,
--     which re-proves each active lease against the canonical authority
--     resolver (cms_authority_origin) so only leases that no longer hold
--     author or editor authority over their entry are released.  The rejected
--     autosave itself is already refused by cms_create_revision's capability
--     gate, and the browser keeps the unsent value (apps/web autosave runtime);
--   * expiry: the service-role Worker sweep marks lapsed leases expired (never
--     revoked: expiry records lapse, not loss of authority) in bounded
--     batches, exactly like the review-authority sweep.
--
-- Renewal and release emit no audit or outbox evidence, and the browser roles
-- hold no direct table privilege on the private presence record.  Forward-only.

begin;

create or replace function platform_private.cms_touch_edit_presence(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  actor_id uuid;
  acting_party_id uuid;
  person_id uuid;
  entry_id uuid;
  entry_row platform_private.cms_content_entries%rowtype;
  presence_row platform_private.cms_edit_presence%rowtype;
  presence_found boolean;
  current_field_id uuid;
  expected_version bigint;
  new_version bigint;
  now_ts timestamptz := pg_catalog.clock_timestamp();
  lease_window constant interval := interval '2 minutes';
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);

  -- Resource is addressed by entry plus an optional advisory field pointer and
  -- CAS version.  context and correlationId are transport control fields, never
  -- authority; any other key has no slot and is refused before any write.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId']::text[],
    array['entryId', 'presenceVersion', 'currentFieldId', 'context', 'correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;

  if not platform_private.cms_valid_uuid(p_request->>'entryId') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  entry_id := (p_request->>'entryId')::uuid;

  if p_request ? 'currentFieldId' and p_request->'currentFieldId' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'currentFieldId') <> 'string'
       or not platform_private.cms_valid_uuid(p_request->>'currentFieldId') then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    current_field_id := (p_request->>'currentFieldId')::uuid;
  end if;

  -- The CAS pointer is advisory and monotonic: any non-negative integer is a
  -- legal presented version (0 is a legitimate stale pointer), so it is parsed
  -- rather than clamped; a mismatch is a typed serialization failure, never a
  -- validation error.
  if p_request ? 'presenceVersion' and p_request->'presenceVersion' <> 'null'::jsonb then
    if pg_catalog.jsonb_typeof(p_request->'presenceVersion') <> 'number'
       or (p_request->>'presenceVersion')::numeric < 0
       or (p_request->>'presenceVersion')::numeric
            <> pg_catalog.floor((p_request->>'presenceVersion')::numeric) then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    expected_version := (p_request->>'presenceVersion')::bigint;
  end if;

  -- Serialize presence authority with the entry aggregate.  Assignment
  -- revocation is an entry-scoped state transition, so locking the aggregate
  -- before the second authority check prevents a revoke racing between the
  -- initial check and the lease mutation from being bypassed.
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = entry_id
  for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.editor', entry_row.id
     ) is null
     and platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.author', entry_row.id
     ) is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  person_id := platform_private.identity_actor_person(actor_id);

  -- One lease row per entry and person.  The row is locked so concurrent
  -- renewals serialize: each either advances the monotonic version or is
  -- refused by the CAS, and two pointers can never fork a second row.
  select * into presence_row
  from platform_private.cms_edit_presence presence
  where presence.entry_id = entry_id
    and presence.person_id = person_id
  for update;
  presence_found := found;

  -- Re-read authority after the row/aggregate locks.  The first check above
  -- is an early concealment/forbidden gate; this one is the TOCTOU boundary
  -- that refuses a renewal or first insert if assignment/grant authority was
  -- revoked while the request waited on either lock.
  if platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.editor', entry_row.id
     ) is null
     and platform_private.cms_authority_origin(
       actor_id, acting_party_id, 'cms.author', entry_row.id
     ) is null then
    if platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- BE03b EditPresence: current_field_id is a stable field UUID revalidated
  -- against the active schema.  The pointer is advisory, but it is never stored
  -- unless it names an active field of the schema the entry's current draft is
  -- written against, so a stale or foreign field id cannot be recorded.
  if current_field_id is not null
     and not exists (
       select 1
       from platform_private.cms_entry_revisions revision
       join platform_private.cms_field_definition_versions field
         on field.content_type_version_id = revision.schema_version_id
       where revision.id = entry_row.current_draft_revision_id
         and field.stable_field_id = current_field_id
         and field.state = 'active'
     ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if presence_found then
    if expected_version is not null and presence_row.version <> expected_version then
      raise exception 'STALE_EDIT_PRESENCE' using errcode = '40001';
    end if;
    update platform_private.cms_edit_presence presence
    set state = 'active',
        version = presence.version + 1,
        owner_id = entry_row.owner_id,
        acting_party_id = acting_party_id,
        current_field_id = coalesce(current_field_id, presence.current_field_id),
        last_seen_at = now_ts,
        lease_until = now_ts + lease_window,
        updated_at = now_ts
    where presence.id = presence_row.id
      returning presence.version into new_version;
    presence_row.version := new_version;
  else
    -- An absent row has the conceptual version zero.  A supplied CAS pointer
    -- therefore may acquire only with zero; accepting any other value would
    -- turn an insert into an unconditional write and make a stale client look
    -- current.
    if expected_version is not null and expected_version <> 0 then
      raise exception 'STALE_EDIT_PRESENCE' using errcode = '40001';
    end if;
    insert into platform_private.cms_edit_presence(
      owner_id, state, version, entry_id, person_id, acting_party_id,
      lease_until, last_seen_at, current_field_id, created_at, updated_at
    ) values (
      entry_row.owner_id, 'active', 1, entry_id, person_id, acting_party_id,
      now_ts + lease_window, now_ts, current_field_id, now_ts, now_ts
    )
    returning * into presence_row;
  end if;

  -- Advisory only: no entry aggregate touch, no audit row, no outbox event.
  return pg_catalog.jsonb_build_object(
    'entryId', entry_id,
    'personId', person_id,
    'state', presence_row.state::text,
    'version', presence_row.version::text,
    'leaseUntil', platform_private.auth_iso_time(presence_row.lease_until),
    'lastSeenAt', platform_private.auth_iso_time(presence_row.last_seen_at)
  );
end;
$body$;

-- Release helper: the one place a lease is retired for lost authority.  It is
-- called by the revocation triggers below with the party and person whose
-- authority changed (and the entry, when the change is entry-scoped).  Every
-- still-active lease of that person in that party is re-proven through the
-- canonical resolver with the person's own actor, so a change that leaves the
-- person authorized (for example an unrelated capability) releases nothing.
-- Rows are locked so a concurrent renewal serializes with the release: the
-- renewal's own second authority read then refuses, and a release can never be
-- overwritten by a stale renewal.  The helper restores the RPC-context flag it
-- found, because it runs inside other commands' statements.
create or replace function platform_private.cms_revoke_edit_presence_without_authority(
  p_acting_party_id uuid,
  p_person_id uuid,
  p_entry_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  actor_id uuid;
  candidate record;
  revoked_count integer := 0;
  revoke_time timestamptz := pg_catalog.clock_timestamp();
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
begin
  if p_acting_party_id is null or p_person_id is null then
    return 0;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  -- The person's authenticated principal.  A person with no usable principal
  -- (unclaimed or suspended) has no authority at all, so every lease releases.
  select person.auth_user_id into actor_id
  from platform_private.person_party person
  where person.party_id = p_person_id
    and person.account_state in ('claimed', 'active');

  for candidate in
    select presence.id, presence.entry_id
    from platform_private.cms_edit_presence presence
    where presence.person_id = p_person_id
      and presence.acting_party_id = p_acting_party_id
      and presence.state = 'active'
      and (p_entry_id is null or presence.entry_id = p_entry_id)
    order by presence.id
    for update of presence
  loop
    if platform_private.cms_authority_origin(
         actor_id, p_acting_party_id, 'cms.editor', candidate.entry_id
       ) is null
       and platform_private.cms_authority_origin(
         actor_id, p_acting_party_id, 'cms.author', candidate.entry_id
       ) is null then
      update platform_private.cms_edit_presence presence
      set state = 'revoked',
          version = presence.version + 1,
          updated_at = revoke_time
      where presence.id = candidate.id;
      revoked_count := revoked_count + 1;
    end if;
  end loop;

  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return revoked_count;
end;
$body$;

-- Revocation seams.  Actor-grant and tenure rows are keyed by organization and
-- person; an entry assignment is keyed by owner, assignee and entry.  A row
-- that moves between parties or people changes authority for both the old and
-- the new identity.  The triggers are AFTER ROW so the release sees the
-- statement's final authority state.
create or replace function platform_private.cms_edit_presence_org_authority_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_revoke_edit_presence_without_authority(
    old.organization_id, old.person_id, null
  );
  if tg_op = 'UPDATE'
     and (new.organization_id, new.person_id)
       is distinct from (old.organization_id, old.person_id) then
    perform platform_private.cms_revoke_edit_presence_without_authority(
      new.organization_id, new.person_id, null
    );
  end if;
  return null;
end;
$body$;

create or replace function platform_private.cms_edit_presence_assignment_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  perform platform_private.cms_revoke_edit_presence_without_authority(
    old.owner_id, old.assignee_person_id, old.entry_id
  );
  if tg_op = 'UPDATE'
     and (new.owner_id, new.assignee_person_id, new.entry_id)
       is distinct from (old.owner_id, old.assignee_person_id, old.entry_id) then
    perform platform_private.cms_revoke_edit_presence_without_authority(
      new.owner_id, new.assignee_person_id, new.entry_id
    );
  end if;
  return null;
end;
$body$;

drop trigger if exists cms_organization_actor_grant_edit_presence_revocation
  on identity_private.organization_actor_grant;
create trigger cms_organization_actor_grant_edit_presence_revocation
after update or delete on identity_private.organization_actor_grant
for each row execute function platform_private.cms_edit_presence_org_authority_trigger();

drop trigger if exists cms_membership_tenure_edit_presence_revocation
  on identity_private.membership_tenure;
create trigger cms_membership_tenure_edit_presence_revocation
after update or delete on identity_private.membership_tenure
for each row execute function platform_private.cms_edit_presence_org_authority_trigger();

drop trigger if exists cms_entry_assignments_edit_presence_revocation
  on platform_private.cms_entry_assignments;
create trigger cms_entry_assignments_edit_presence_revocation
after update or delete on platform_private.cms_entry_assignments
for each row execute function platform_private.cms_edit_presence_assignment_trigger();

-- Expiry sweep: an expired window is marked 'expired', never 'revoked', so it
-- records lapse rather than loss of authority and never blocks another editor.
-- Bounded and idempotent, the same shape as cms_sweep_expired_review_authority:
-- a full batch leaves the remainder for the next scheduled tick, and rows a
-- concurrent renewal holds are skipped rather than waited on.  Answers exactly
-- {"expiredLeases": n}.
create or replace function platform_private.cms_expire_edit_presence_leases(
  p_batch integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
#variable_conflict use_variable
declare
  expired_count integer;
  sweep_time timestamptz := pg_catalog.clock_timestamp();
begin
  if p_batch is null or p_batch not between 1 and 5000 then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  with lapsed as materialized (
    select presence.id
    from platform_private.cms_edit_presence presence
    where presence.state = 'active'
      and presence.lease_until < sweep_time
    order by presence.lease_until, presence.id
    limit p_batch
    for update of presence skip locked
  )
  update platform_private.cms_edit_presence presence
  set state = 'expired',
      version = presence.version + 1,
      updated_at = sweep_time
  from lapsed
  where presence.id = lapsed.id;

  get diagnostics expired_count = row_count;
  return pg_catalog.jsonb_build_object('expiredLeases', expired_count);
end;
$body$;


-- CMS-03B-01 autosave with presence renewal.  This is the latest definition of
-- platform_private.cms_create_revision (20260930140000_cms_enum_field_
-- authoring.sql) reproduced exactly, with three additions and no change to any
-- existing guard: the advisory current-field pointer variable, its assignment
-- from each validated changed path, and the presence renewal after validation.
create or replace function platform_private.cms_create_revision(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  author_person_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  base_row platform_private.cms_entry_revisions%rowtype;
  current_row platform_private.cms_entry_revisions%rowtype;
  version_row platform_private.cms_content_type_versions%rowtype;
  artifact_row platform_private.cms_schema_artifacts%rowtype;
  field_row platform_private.cms_field_definition_versions%rowtype;
  open_conflict platform_private.cms_conflict_records%rowtype;
  presence_field_id uuid;
  editorial_policy jsonb;
  active_version_count integer;
  requested_entry_id uuid;
  requested_base_number bigint;
  requested_entry_version bigint;
  new_revision_id uuid := extensions.gen_random_uuid();
  conflict_id uuid;
  snapshot_time timestamptz := pg_catalog.now();
  base_values jsonb;
  current_values jsonb;
  next_values jsonb;
  path_input text;
  value_field_id_text text;
  value_input jsonb;
  payload_hash text;
  candidate_hash text;
  conflict_hash text;
  changed_overlaps boolean := false;
  parent_ids jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  author_person_id := platform_private.identity_actor_person(actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  if not platform_private.cms_exact_keys(
    p_request,
    array[
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey'
    ]::text[],
    array[
      'entryId', 'baseRevision', 'changedPaths', 'values', 'locale',
      'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'correlationId'
    ]::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or coalesce(p_request->>'locale', '') !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or platform_private.cms_valid_version(p_request->>'baseRevision') is not true
     or platform_private.cms_valid_version(p_request->>'expectedVersion') is not true
     or platform_private.cms_valid_version(p_request->>'ifMatch') is not true
     or pg_catalog.length(p_request->>'baseRevision') > 19
     or pg_catalog.length(p_request->>'expectedVersion') > 19
     or pg_catalog.length(p_request->>'ifMatch') > 19
     or (pg_catalog.length(p_request->>'baseRevision') = 19
         and p_request->>'baseRevision' > '9223372036854775807')
     or (pg_catalog.length(p_request->>'expectedVersion') = 19
         and p_request->>'expectedVersion' > '9223372036854775807')
     or (pg_catalog.length(p_request->>'ifMatch') = 19
         and p_request->>'ifMatch' > '9223372036854775807') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if p_request->>'expectedVersion' <> p_request->>'ifMatch' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_base_number := (p_request->>'baseRevision')::bigint;
  requested_entry_version := (p_request->>'expectedVersion')::bigint;

  -- Establish tenant visibility before probing assignment or reserving a key.
  select * into entry_row
  from platform_private.cms_content_entries candidate
  where candidate.id = requested_entry_id
  for update;
  if not found or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_require_entry_capability(
    actor_id, acting_party_id, array['cms.author', 'cms.editor']::text[], entry_row.id
  );
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- A replay must return the exact first outcome even when the parent has
  -- since advanced.  Reservation therefore precedes the entry-version CAS.
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03B-01');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if entry_row.version <> requested_entry_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  select * into current_row
  from platform_private.cms_entry_revisions candidate
  where candidate.id = entry_row.current_draft_revision_id
    and candidate.entry_id = entry_row.id
    and candidate.locale = p_request->>'locale'
  for share;
  if not found or current_row.state <> 'draft' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  select * into base_row
  from platform_private.cms_entry_revisions candidate
  where candidate.entry_id = entry_row.id
    and candidate.revision_number = requested_base_number
    and candidate.locale = p_request->>'locale'
  for share;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A schema migration needs its own immutable chain.  The write must not
  -- silently reinterpret an older revision against a newer active schema.
  select count(*) into active_version_count
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if active_version_count <> 1 then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into version_row
  from platform_private.cms_content_type_versions candidate
  where candidate.content_type_id = entry_row.content_type_id
    and candidate.state::text = 'active';
  if version_row.id is distinct from current_row.schema_version_id
     or version_row.id is distinct from base_row.schema_version_id
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        is null
     or platform_private.cms_type_version_resource(version_row.id)->'activationEvidence'
        = 'null'::jsonb then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  editorial_policy := platform_private.cms_editorial_workflow_policy_evidence(version_row.id);
  if platform_private.cms_exact_keys(
       editorial_policy,
       array[
         'key', 'version', 'policyHash', 'riskClass',
         'requiredDecisionCount', 'requiredCapabilities', 'approvalEvidenceHash'
       ]::text[],
       array[
         'key', 'version', 'policyHash', 'riskClass',
         'requiredDecisionCount', 'requiredCapabilities', 'approvalEvidenceHash'
       ]::text[]
     ) is not true
     or pg_catalog.jsonb_typeof(editorial_policy->'key') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'version') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'policyHash') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'riskClass') is distinct from 'string'
     or pg_catalog.jsonb_typeof(editorial_policy->'requiredDecisionCount')
        is distinct from 'number'
     or pg_catalog.jsonb_typeof(editorial_policy->'approvalEvidenceHash')
        is distinct from 'string'
     or coalesce(editorial_policy->>'key', '') !~ '^[a-z][a-z0-9._-]{0,127}$'
     or platform_private.cms_valid_version(editorial_policy->>'version') is not true
     or pg_catalog.length(editorial_policy->>'version') > 19
     or (pg_catalog.length(editorial_policy->>'version') = 19
         and editorial_policy->>'version' > '9223372036854775807')
     or coalesce(editorial_policy->>'policyHash', '') !~ '^[a-f0-9]{64}$'
     or coalesce(editorial_policy->>'approvalEvidenceHash', '') !~ '^[a-f0-9]{64}$'
     or coalesce(editorial_policy->>'riskClass', '') not in ('ordinary', 'protected')
     or coalesce(editorial_policy->>'requiredDecisionCount', '') !~ '^[1-8]$'
     or pg_catalog.jsonb_typeof(editorial_policy->'requiredCapabilities')
        is distinct from 'array' then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_array_length(editorial_policy->'requiredCapabilities') > 16
     or (editorial_policy->>'riskClass' = 'protected'
         and ((editorial_policy->>'requiredDecisionCount')::integer < 2
              or pg_catalog.jsonb_array_length(editorial_policy->'requiredCapabilities') = 0))
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(editorial_policy->'requiredCapabilities') cap(value)
       where pg_catalog.jsonb_typeof(cap.value) <> 'string'
          or platform_private.cms_capability_registry_valid(cap.value #>> '{}', null)
             is not true
     ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  select * into artifact_row
  from platform_private.cms_schema_artifacts candidate
  where candidate.id = version_row.schema_artifact_id
    and candidate.content_type_version_id = version_row.id
    and candidate.state::text = 'compiled';
  if not found or artifact_row.artifact_hash is distinct from version_row.definition_hash
     or artifact_row.compiler_version is null
     or artifact_row.zod_contract_ref is null then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.validator_key is not null
      and not platform_private.cms_validator_registry_valid(
        field.validator_key, field.validator_version
      )
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'changedPaths') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_request->'values') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_array_length(p_request->'changedPaths') not between 1 and 128 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  if not platform_private.cms_json_bounded(p_request->'values', 262144, 8, 128, 128)
     or (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values')) > 128
     or (select count(distinct path) <> count(*)
         from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') path) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  -- A revision request is a patch over the immutable current snapshot.  A
  -- changed path must have exactly one matching stable-field value, and no
  -- unmentioned value may be silently ignored or accepted as a hidden edit.
  if (select count(*) from pg_catalog.jsonb_object_keys(p_request->'values'))
     <> pg_catalog.jsonb_array_length(p_request->'changedPaths') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  for path_input in
    select value from pg_catalog.jsonb_array_elements_text(p_request->'changedPaths') value
  loop
    if path_input !~ '^/fields/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(path_input) > 256 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    value_field_id_text := pg_catalog.substr(path_input, 9);
    if not (p_request->'values' ? value_field_id_text) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    if not found or field_row.state <> 'active' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    -- The advisory presence pointer follows the last validated changed field.
    presence_field_id := field_row.stable_field_id;
    -- The draft helper proves scalar, calendar, and bounded enum constraints for admitted kinds.
    -- Other kinds need their active-schema value or target validator before
    -- this RPC may persist them; a broad JSON container check is insufficient.
    if field_row.kind not in (
      'short_text', 'long_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum'
    ) then
      raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
    end if;
    value_input := p_request->'values'->value_field_id_text;
    if not platform_private.cms_draft_field_value_valid(
      version_row.id, value_field_id_text::uuid, value_input,
      case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end
    ) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
  end loop;

  -- BE03b EditPresence / IA03 Presence: every authorized autosave that reaches
  -- the write renews the author's advisory two-minute lease inside this
  -- transaction, after the capability, tenant, lifecycle, CAS and per-path
  -- validation gates above have all passed.  The renewal re-proves authority
  -- under the entry lock it shares with this write, writes only the private
  -- presence row, never advances the entry aggregate, never blocks another
  -- editor and grants nothing.  A conflict disposition is still an authorized
  -- autosave and renews; a refused or failed write raises before this point.
  perform platform_private.cms_touch_edit_presence(
    pg_catalog.jsonb_build_object(
      'entryId', entry_row.id,
      'currentFieldId', presence_field_id
    )
    || case when p_request ? 'context'
         then pg_catalog.jsonb_build_object('context', p_request->'context')
         else '{}'::jsonb end
  );

  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into base_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = base_row.id and field.locale = base_row.locale;
  select coalesce(pg_catalog.jsonb_object_agg(field.field_id::text, field.value), '{}'::jsonb)
    into current_values
  from platform_private.cms_entry_field_values field
  where field.revision_id = current_row.id and field.locale = current_row.locale;
  if platform_private.cms_jcs_sha256(base_values) <> base_row.payload_hash::text
     or platform_private.cms_jcs_sha256(current_values) <> current_row.payload_hash::text then
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from platform_private.cms_entry_field_values old
    left join platform_private.cms_field_definition_versions definition
      on definition.id = old.field_definition_id
     and definition.content_type_version_id = version_row.id
     and definition.stable_field_id = old.field_id
    where old.revision_id in (base_row.id, current_row.id)
      and (definition.id is null
           or definition.state <> 'active'
           or definition.kind not in (
             'short_text', 'long_text', 'boolean', 'integer', 'decimal',
      'date', 'datetime', 'enum'
           )
           or platform_private.cms_draft_field_value_valid(
             version_row.id, old.field_id, old.value, old.provenance
           ) is not true)
  ) then
    raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(p_request->'values') item(key)
  loop
    if base_values->value_field_id_text is distinct from current_values->value_field_id_text
       and p_request->'values'->value_field_id_text is distinct from current_values->value_field_id_text then
      changed_overlaps := true;
    end if;
  end loop;
  if changed_overlaps then
    -- The unsuccessful candidate is never represented as a committed revision.
    -- Return a successful *private* disposition so the conflict INSERT and
    -- idempotency result commit; the Worker maps it to a public BE00 409.
    candidate_hash := platform_private.cms_jcs_sha256(base_values || (p_request->'values'));
    select * into open_conflict
    from platform_private.cms_conflict_records conflict
    where conflict.entry_id = entry_row.id and conflict.state = 'open'
    for update;
    if found then
      conflict_id := open_conflict.id;
      conflict_hash := open_conflict.conflict_hash::text;
    else
      conflict_hash := platform_private.cms_jcs_sha256(
        pg_catalog.jsonb_build_object(
          'entryId', entry_row.id, 'baseRevisionId', base_row.id,
          'theirsRevisionId', current_row.id, 'yoursHash', candidate_hash,
          'changedPaths', p_request->'changedPaths'
        )
      );
      insert into platform_private.cms_conflict_records(
        owner_id, entry_id, base_revision_id, theirs_revision_id,
        yours_source, proposed_values, proposed_values_hash, changed_paths,
        base_hash, theirs_hash, yours_hash, conflict_hash, state,
        version, created_at, updated_at
      ) values (
        entry_row.owner_id, entry_row.id, base_row.id, current_row.id,
        'proposed', p_request->'values',
        platform_private.cms_jcs_sha256(p_request->'values')::char(64),
        p_request->'changedPaths', base_row.payload_hash,
        current_row.payload_hash, candidate_hash::char(64),
        conflict_hash::char(64), 'open', 1, snapshot_time, snapshot_time
      ) returning id into conflict_id;
    end if;
    response := pg_catalog.jsonb_build_object(
      'kind', 'conflict', 'code', 'VERSION_MISMATCH',
      'details', pg_catalog.jsonb_build_object(
        'expectedVersion', requested_entry_version::text,
        'currentVersion', entry_row.version::text,
        'conflictHash', conflict_hash
      )
    );
    perform platform_private.cms_complete(reservation.id, conflict_id, 409, response);
    return response;
  end if;

  -- Preserve unaffected normalized relations on this new immutable snapshot.
  -- A self-reference is pinned to the entry version being committed, so an
  -- ordinary subsequent edit cannot strand the author behind its own stale
  -- expected-target version; an external target still requires exact match.
  -- No relation value from this request reaches this branch: changed relation
  -- paths are fenced above until their typed encoding is owner-approved.
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_relation_definitions definition
      on definition.field_definition_id = relation.field_definition_id
    where relation.revision_id = current_row.id
      and (definition.id is null
           or definition.target_kind <> relation.target_kind
           or definition.on_unavailable <> relation.on_unavailable)
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;
  if exists (
    select 1
    from platform_private.cms_entry_relations relation
    left join platform_private.cms_content_entries target
      on relation.target_kind = 'content' and target.id = relation.target_id
    where relation.revision_id = current_row.id
      and (relation.target_kind <> 'content'
           or target.id is null
           or target.owner_party_id is distinct from entry_row.owner_party_id
           or target.lifecycle <> 'active'
           or (relation.expected_target_version is not null
               and target.id <> entry_row.id
               and target.version <> relation.expected_target_version))
  ) then raise exception 'DEPENDENCY_UNAVAILABLE' using errcode = 'P0001'; end if;

  next_values := current_values || (p_request->'values');
  payload_hash := platform_private.cms_jcs_sha256(next_values);
  parent_ids := case when base_row.id = current_row.id
    then pg_catalog.jsonb_build_array(current_row.id)
    else pg_catalog.jsonb_build_array(current_row.id, base_row.id) end;

  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id,
    template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
    payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at
  ) values (
    new_revision_id, entry_row.owner_id, entry_row.id,
    current_row.revision_number + 1, version_row.id,
    current_row.template_version_id, current_row.taxonomy_version_ids,
    parent_ids, p_request->>'locale', payload_hash::char(64),
    author_person_id, acting_party_id, 'draft', 1, 'valid', '{}'::jsonb,
    snapshot_time, snapshot_time
  );
  insert into platform_private.cms_entry_field_values(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    locale, value, provenance, value_hash, created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
         old.field_definition_id, old.locale, old.value, old.provenance,
         old.value_hash, snapshot_time, snapshot_time
  from platform_private.cms_entry_field_values old
  where old.revision_id = current_row.id
    and old.locale = current_row.locale
    and not (p_request->'values' ? old.field_id::text);
  for value_field_id_text in
    select item.key from pg_catalog.jsonb_object_keys(p_request->'values') item(key)
  loop
    select * into field_row
    from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = version_row.id
      and field.stable_field_id = value_field_id_text::uuid;
    value_input := p_request->'values'->value_field_id_text;
    insert into platform_private.cms_entry_field_values(
      owner_id, state, version, revision_id, field_id, field_definition_id,
      locale, value, provenance, value_hash, created_at, updated_at
    ) values (
      entry_row.owner_id, 'active', 1, new_revision_id, value_field_id_text::uuid,
      field_row.id, p_request->>'locale', value_input,
      case when value_input = 'null'::jsonb then 'explicit_null' else 'authored' end,
      case when value_input = 'null'::jsonb then null
        else platform_private.cms_jcs_sha256(value_input)::char(64) end,
      snapshot_time, snapshot_time
    );
  end loop;
  insert into platform_private.cms_entry_relations(
    owner_id, state, version, revision_id, field_id, field_definition_id,
    target_kind, target_id, expected_target_version, position, on_unavailable,
    created_at, updated_at
  )
  select entry_row.owner_id, 'active', 1, new_revision_id, old.field_id,
         old.field_definition_id, old.target_kind, old.target_id,
         case
           when old.target_kind = 'content' and old.target_id = entry_row.id
             then requested_entry_version + 1
           else old.expected_target_version
         end,
         old.position, old.on_unavailable,
         snapshot_time, snapshot_time
  from platform_private.cms_entry_relations old
  where old.revision_id = current_row.id;

  update platform_private.cms_content_entries
  set current_draft_revision_id = new_revision_id,
      version = version + 1,
      updated_at = snapshot_time
  where id = entry_row.id and version = requested_entry_version;
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  perform platform_private.cms_emit_event(
    'cms.entry.revision.create', actor_id, acting_party_id,
    'cms_content_entry', entry_row.id, 'CMS_ENTRY_REVISION_CREATED',
    'cms.entry.revision-created.v1', 'cms_content_entry', entry_row.id,
    requested_entry_version + 1,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'revisionId', new_revision_id),
    correlation_id
  );
  response := pg_catalog.jsonb_build_object(
    'id', new_revision_id, 'version', '1',
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft', 'entryId', entry_row.id,
    'revisionNumber', (current_row.revision_number + 1)::text,
    'schemaVersionId', version_row.id,
    'templateVersionId', current_row.template_version_id,
    'taxonomyVersionIds', current_row.taxonomy_version_ids,
    'locale', p_request->>'locale', 'contentHash', payload_hash,
    'parentRevisionIds', parent_ids, 'validationState', 'valid',
    'conflictId', null
  );
  perform platform_private.cms_complete(reservation.id, new_revision_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_touch_edit_presence(jsonb) is
  'Advisory edit-presence lease renew/acquire, called only from inside an authorized write transaction (cms_create_revision). Server-derives actor and acting party, requires a proven cms.editor/cms.author grant plus an active entry assignment (concealed entry as NOT_FOUND, visible-but-unscoped as FORBIDDEN), revalidates the optional current-field pointer against the entry''s active schema, locks the one entry/person row, and advances the monotonic lease version under an optional CAS pointer (a mismatch is a 40001 serialization failure). Writes only the private presence record; never advances the entry aggregate and emits no audit or outbox row. Not executable by any API role.';

comment on function platform_private.cms_revoke_edit_presence_without_authority(uuid, uuid, uuid) is
  'Advisory edit-presence release for lost authority. Re-proves every active lease of the person in the party (and entry, when scoped) through cms_authority_origin and retires those that no longer hold cms.author or cms.editor authority as state revoked under a monotonic version. Called only by the actor-grant, tenure and entry-assignment revocation triggers in the transaction of the change; restores the RPC-context flag; emits no audit or outbox row.';

comment on function platform_private.cms_expire_edit_presence_leases(integer) is
  'Advisory edit-presence expiry sweep. Marks up to p_batch (1..5000) active leases past their window as state expired (never revoked) under a monotonic version, skipping rows a concurrent renewal holds; answers {"expiredLeases": n}; emits no audit or outbox row.';

comment on function platform_private.cms_edit_presence_org_authority_trigger() is
  'AFTER ROW UPDATE/DELETE trigger function on the organization actor-grant projection and the membership tenure: releases the affected person''s leases that lost authority, in the transaction of the change.';

comment on function platform_private.cms_edit_presence_assignment_trigger() is
  'AFTER ROW UPDATE/DELETE trigger function on the entry assignment: releases the assignee''s lease on that entry when the assignment no longer carries authority, in the transaction of the change.';

-- SEC-2: the definer functions name the forced-RLS presence record, so they are
-- owned by the non-BYPASSRLS definer role (the context gate and RLS then apply
-- to every statement they run).  ALTER FUNCTION ... OWNER TO requires the new
-- owner to hold CREATE on the function's schema, and the owning function must
-- itself hold the table privileges its body uses.  Both are granted for the
-- length of this transaction, and the schema CREATE is revoked again after the
-- ownership moves, exactly as 20261003120500_cms_definer_function_ownership
-- establishes for every other definer-owned command.  cms_create_revision is
-- already definer-owned; CREATE OR REPLACE keeps its owner and ACL.
grant create on schema platform_private to wejammin_cms_definer;
grant insert, select, update on table platform_private.cms_edit_presence
  to wejammin_cms_definer;

alter function platform_private.cms_touch_edit_presence(jsonb)
  owner to wejammin_cms_definer;
alter function platform_private.cms_revoke_edit_presence_without_authority(uuid, uuid, uuid)
  owner to wejammin_cms_definer;
alter function platform_private.cms_expire_edit_presence_leases(integer)
  owner to wejammin_cms_definer;
alter function platform_private.cms_edit_presence_org_authority_trigger()
  owner to wejammin_cms_definer;
alter function platform_private.cms_edit_presence_assignment_trigger()
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_touch_edit_presence(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_revoke_edit_presence_without_authority(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_expire_edit_presence_leases(integer)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_edit_presence_org_authority_trigger()
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_edit_presence_assignment_trigger()
  from public, anon, authenticated, service_role;

-- The advisory expiry sweep is reachable only through the established
-- service/worker boundary: the private command stays unreachable from every
-- role, and this named wrapper is the sole caller-facing presence entry,
-- exposed to service_role alone (mirroring
-- platform_api.cms_sweep_expired_review_authority).  The wrapper restores the
-- transaction-local RPC-context flag to its prior value so the write gate never
-- leaks into the rest of the transaction.  Renewal and release have no wrapper:
-- no caller of either exists outside the database transaction that owns it.
create or replace function platform_api.cms_expire_edit_presence_leases(
  p_batch integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  rpc_previous text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), '');
  rpc_result jsonb;
begin
  rpc_result := platform_private.cms_expire_edit_presence_leases(p_batch);
  perform pg_catalog.set_config('app.cms_rpc', rpc_previous, true);
  return rpc_result;
end;
$body$;

comment on function platform_api.cms_expire_edit_presence_leases(integer) is
  'Service/worker-only entry to the advisory edit-presence expiry sweep. Forwards to platform_private.cms_expire_edit_presence_leases and restores the transaction-local RPC-context flag so the write gate does not leak.';

revoke all on function platform_api.cms_expire_edit_presence_leases(integer)
  from public, anon, authenticated, service_role;
grant execute on function platform_api.cms_expire_edit_presence_leases(integer)
  to service_role;

commit;
