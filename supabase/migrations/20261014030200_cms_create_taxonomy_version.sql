-- Slice 12 lane taxonomy-def (BE03c route registry CMS-03C-16 at 178, validation matrix at 401, Registry
-- invariants at 208-219, lock order at 1336-1346, D10/DEC-135 at 1369-1375, error catalog at 1295, data flow at
-- 1477; DEC-188; P2-S12-AC-124..128): the CMS-03C-16 command.
--
--   platform_private.cms_create_taxonomy_version(p_request jsonb) returns jsonb  - the atomic private body;
--   platform_api.cms_create_taxonomy_version(p_request jsonb)                    - the Worker transport (030300).
--
-- Private request (the frozen Worker adapter's payload): the six TaxonomyVersionRequest members, the
-- idempotencyKey, the decoded ifMatch operand when editing (header "7" arrives as 7), the server context and
-- the correlationId.  Evaluation order; a refusal is a P0001 whose whole message is the token and nothing a
-- refusal does is committed:
--   1 a non-object body is INVALID_REQUEST;  2 actor and acting party (UNAUTHENTICATED);
--   3 concealment: a caller who cannot read the owner party is NOT_FOUND, whatever they asked for;
--   4 position 1 of the lock order: the curator's authority rows FOR SHARE, then the capability is re-proved under
--     the lock (a visible owner without cms.taxonomy_curator is `capability_missing`, the BE03c:1304 403 reason
--     token, also for a cached replay);
--   5 one transaction-scoped advisory lock per (owner, key) serializes a first version (no row to lock yet);
--   6 the idempotency reservation: a same-key request with another body is IDEMPOTENCY_MISMATCH, a completed
--     one returns the stored resource (only to a caller who passed 3 and 4);
--   7 exact members (INVALID_REQUEST) then member values (VALIDATION_FAILED at the member pointer), then the
--     If-Match operand (INVALID_REQUEST);
--   8 position 3: the latest row of (owner, key) FOR UPDATE and the CAS: a first version needs none (CONFLICT
--     if the key exists), a successor needs the exact definition number (NOT_FOUND if there is no parent,
--     CONFLICT if it is not the latest);
--   9 the draft row (lineage id, parent pointer, lifecycle_version 1), one audit record and the completed
--     reservation commit atomically.  No outbox event: activation is CMS-03C-09.
-- Declared canonical domains are validated for shape and the closed set (cms_canonical_domains_valid, which the
-- table CHECK shares) and then READ from the canonical domain registry (cms_canonical_domain_current, the route
-- row's "canonical domain registry read"): every declared domain must have a current registry row.  A domain whose
-- owning shard has registered no provider (unbuilt) is accepted here and refused at submission, activation and term
-- action (DEC-135).  A domain added to the registry must also be added to the validator and the CHECK in 030000.  The allowlist keys are
-- grammar-checked, not resolved: the content types a vocabulary names are bound at submission (CMS-03C-06).
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_create_taxonomy_version(p_request jsonb)
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
  definition jsonb;
  list_name text;
  list_value jsonb;
  expected jsonb;
  operand_text text;
  previous_row platform_private.cms_taxonomy_versions%rowtype;
  has_previous boolean;
  next_version bigint;
  new_row_id uuid;
  lineage_id uuid;
  content_hash text;
  snapshot_time timestamptz;
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
  -- 5 a hash collision only serializes unrelated keys of one owner; it never lets two writers of one key pass
  if pg_catalog.jsonb_typeof(p_request->'taxonomyKey') = 'string'
     and (p_request->>'taxonomyKey') ~ '^[a-z][a-z0-9-]{1,63}$' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'cms.taxonomy:' || acting_party_id::text || ':' || (p_request->>'taxonomyKey'), 0));
  end if;
  -- 6 idempotency
  if pg_catalog.jsonb_typeof(p_request->'idempotencyKey') is distinct from 'string' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-16');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 7 members, values, operand
  if not platform_private.cms_exact_keys(
    p_request,
    array['taxonomyKey','shape','allowedTypeKeys','allowedFieldKeys','canonicalOverlapDomains',
      'expectedVersion','idempotencyKey','context']::text[],
    array['taxonomyKey','shape','allowedTypeKeys','allowedFieldKeys','canonicalOverlapDomains',
      'expectedVersion','ifMatch','idempotencyKey','context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  definition := p_request - 'expectedVersion' - 'ifMatch' - 'idempotencyKey' - 'context' - 'correlationId';
  if pg_catalog.jsonb_typeof(definition->'taxonomyKey') is distinct from 'string'
     or (definition->>'taxonomyKey') !~ '^[a-z][a-z0-9-]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/taxonomyKey"]';
  end if;
  if pg_catalog.jsonb_typeof(definition->'shape') is distinct from 'string'
     or (definition->>'shape') not in ('flat', 'hierarchical') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/shape"]';
  end if;
  foreach list_name in array array['allowedTypeKeys', 'allowedFieldKeys']::text[] loop
    list_value := definition->list_name;
    if pg_catalog.jsonb_typeof(list_value) is distinct from 'array' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/%s"]', list_name);
    end if;
    if pg_catalog.jsonb_array_length(list_value) not between 1 and 64
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(list_value) member(value)
          where pg_catalog.jsonb_typeof(member.value) is distinct from 'string'
             or (member.value #>> '{}') !~ '^[a-z][a-z0-9_]{1,63}$')
       or (select pg_catalog.count(distinct member.value)
             from pg_catalog.jsonb_array_elements(list_value) member(value))
          <> pg_catalog.jsonb_array_length(list_value) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.format('["/%s"]', list_name);
    end if;
  end loop;
  if not platform_private.cms_canonical_domains_valid(definition->'canonicalOverlapDomains') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/canonicalOverlapDomains"]';
  end if;
  if exists (
    select 1
      from pg_catalog.jsonb_array_elements_text(definition->'canonicalOverlapDomains') declared(domain)
     where not exists (select 1 from platform_private.cms_canonical_domain_current(declared.domain))
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/canonicalOverlapDomains"]';
  end if;
  expected := p_request->'expectedVersion';
  if pg_catalog.jsonb_typeof(expected) = 'null' then
    if p_request ? 'ifMatch' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  else
    -- A decimal string in 1 .. 2^63 - 1, and the If-Match operand equals it exactly.
    operand_text := case when pg_catalog.jsonb_typeof(expected) = 'string' then expected #>> '{}' end;
    if operand_text is null or operand_text !~ '^[1-9][0-9]{0,18}$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    if operand_text::numeric > 9223372036854775807
       or pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
       or p_request->'ifMatch' <> expected then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end if;

  -- 8 position 3 and the CAS
  select * into previous_row
    from platform_private.cms_taxonomy_versions candidate
   where candidate.owner_id = acting_party_id
     and candidate.taxonomy_key = definition->>'taxonomyKey'
   order by candidate.version desc
   limit 1
     for update;
  has_previous := found;
  if pg_catalog.jsonb_typeof(expected) = 'null' then
    if has_previous then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    next_version := 1;
  else
    if not has_previous then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
    if previous_row.version::text <> operand_text then raise exception 'CONFLICT' using errcode = 'P0001'; end if;
    next_version := previous_row.version + 1;
  end if;
  if next_version > 2147483647 then raise exception 'CONFLICT' using errcode = 'P0001'; end if;

  -- 9 the draft, its audit record and the completed reservation
  new_row_id := extensions.gen_random_uuid();
  lineage_id := case when has_previous then previous_row.taxonomy_id else new_row_id end;
  snapshot_time := pg_catalog.clock_timestamp();
  content_hash := platform_private.cms_jcs_sha256(definition);
  begin
    insert into platform_private.cms_taxonomy_versions (
      id, owner_id, state, version, created_at, updated_at, taxonomy_key, owner_capability, shape,
      allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by,
      taxonomy_id, supersedes_id, canonical_overlap_domains
    ) values (
      new_row_id, acting_party_id, 'draft', next_version, snapshot_time, snapshot_time,
      definition->>'taxonomyKey', curator, definition->>'shape',
      definition->'allowedTypeKeys', definition->'allowedFieldKeys', content_hash::char(64), actor_id,
      lineage_id, case when has_previous then previous_row.id end, definition->'canonicalOverlapDomains'
    );
  exception when unique_violation then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end;
  perform platform_private.cms_record_audit(
    'cms.taxonomy.version.define', actor_id, acting_party_id,
    'cms_taxonomy_version', new_row_id, 'CMS_TAXONOMY_VERSION_DRAFT_DEFINED', correlation_id);
  response := pg_catalog.jsonb_build_object(
    'id', new_row_id,
    'version', next_version::text,
    'contentHash', content_hash,
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', 'draft',
    'taxonomyId', lineage_id,
    'taxonomyKey', definition->>'taxonomyKey',
    'taxonomyVersion', next_version,
    'shape', definition->>'shape',
    'allowedTypeKeys', definition->'allowedTypeKeys',
    'allowedFieldKeys', definition->'allowedFieldKeys',
    'canonicalOverlapDomains', definition->'canonicalOverlapDomains');
  perform platform_private.cms_complete(reservation.id, new_row_id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_create_taxonomy_version(jsonb) is
  'CMS-03C-16: a verified taxonomy curator creates a draft TaxonomyVersion (a first version with expectedVersion null, or the successor of the latest version by its exact definition number): concealment, the position 1 authority fence, an advisory lock per (owner, key), the idempotency reservation (a cached replay only for a caller who still holds the capability), strict members and values, the If-Match operand, the CAS under the latest row lock, then the draft with its lineage id, the audit record and the completed reservation in one transaction. Declared canonical domains are accepted whether or not a provider exists. Private; the Worker calls the platform_api wrapper.';

grant insert, select, update on table platform_private.cms_taxonomy_versions to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_create_taxonomy_version(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_create_taxonomy_version(jsonb)
  from public, anon, authenticated, service_role;

commit;
