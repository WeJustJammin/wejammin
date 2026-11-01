-- Slice 12 lane related, CMS-03C-05 (BE03c route row 163, validation rows 385-387, Related-content eligibility
-- and derived rules (D11, OD-5) 1379-1383, Slice 12 lock order 1337-1340, Transaction 1510, Canonical records
-- 1432; tracker P2-S12-AC-036 .. AC-038, AC-059 .. AC-062, AC-227 .. AC-230):
--
--   platform_private.cms_curate_related_content(p_request jsonb) returns jsonb   the RelatedContentResource.
--
-- Request { entryId, pins[], exclusions[], derivedRule|null, expectedVersion, ifMatch, idempotencyKey,
-- context, correlationId? }.  Ordered steps, one transaction:
--   1  strict envelope (INVALID_REQUEST) and the actor (UNAUTHENTICATED); schema failures of pins, exclusions and
--      derivedRule are VALIDATION_FAILED with the pointer array as DETAIL; a derivedRule that is not the registry
--      value is the typed derived_rule_unknown (DETAIL: the pointer);
--   2  position 0: the entry row FOR UPDATE; a source outside the caller's owner organization is NOT_FOUND;
--   3  position 1: the caller's authority rows FOR SHARE, then the capability (cms.author or cms.editor with an
--      active assignment on the source) re-proved under the locks: a visible source without edit is the typed
--      capability_missing (403); an inactive source is INVALID_TRANSITION;
--   4  the idempotency reservation (replay answers the stored resource; another body is IDEMPOTENCY_MISMATCH);
--   5  CAS: the strong If-Match is the entry aggregate version, VERSION_MISMATCH with DETAIL
--      { expectedVersion, currentVersion } when stale;
--   6  position 2: the pin and exclusion target entries FOR SHARE in ascending id order, then eligibility under
--      the locks (D11): a pin exists in the caller's owner party, is not the source, is `active` and is readable
--      by the caller (author or editor assignment); an exclusion exists in that party and is readable.  Any other
--      target, absent, hidden, inactive, other-owner or self, is the ONE uniform related_target_ineligible with
--      every offending pointer (/pins/{n}, /exclusions/{n}) as DETAIL, so a write is never an existence oracle;
--   7  position 4: the content-type version of the source revision FOR SHARE;
--   8  the whole rule set is replaced by APPENDING rows: `revoked` for a removed pin/exclusion/rule, a revoked
--      row then an `active` row for a pin whose position or a rule whose bound changed, `active` for a new item;
--      versions are max + 1 per (source, target, mode) and per (source, derived); nothing is updated;
--   9  eligibleCount = min(128, pins + derived candidates) for the source revision locale and the audience of the
--      source's most recent active publication (0 derived when it has none); the entry version advances by one
--      (CAS); one audit record; NO outbox event (the command emits none until publication).
-- Pin rows are stored with reason MANUAL_PIN, exclusions MANUAL_EXCLUSION, the derived row with upper(registry
-- reason).  The answer's `version` is the NEW entry aggregate version (the next If-Match operand) and its `id`
-- the source entry id.  Private, SECURITY DEFINER owned by the CMS definer (SEC-2).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_curate_related_content(p_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  actor_id uuid;
  acting_party_id uuid;
  correlation_id uuid;
  reservation platform_private.idempotency_records;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  requested_entry_id uuid;
  requested_version bigint;
  pin_ids uuid[];
  exclusion_ids uuid[];
  rule_json jsonb;
  rule_key text;
  rule_version bigint;
  rule_bound integer;
  pointers jsonb;
  readable_ids uuid[];
  offending jsonb := '[]'::jsonb;
  item_no integer;
  target uuid;
  snapshot_time timestamptz := pg_catalog.clock_timestamp();
  eligible_count integer;
  rule_state text;
  derived_object jsonb;
  hash_rule jsonb;
  response jsonb;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  if pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  actor_id := platform_private.cms_actor(p_request);
  acting_party_id := platform_private.cms_acting_party(p_request, actor_id);
  correlation_id := platform_private.cms_correlation(p_request);

  -- 1: envelope.
  if not platform_private.cms_exact_keys(
    p_request,
    array['entryId','pins','exclusions','derivedRule','expectedVersion','ifMatch','idempotencyKey']::text[],
    array['entryId','pins','exclusions','derivedRule','expectedVersion','ifMatch','idempotencyKey',
          'context','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'entryId') is not true
     or pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'idempotencyKey') is distinct from 'string'
     or (p_request->>'idempotencyKey') !~ '^[ -~]{8,128}$' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if (p_request->>'expectedVersion') !~ '^[1-9][0-9]{0,18}$'
     or (pg_catalog.length(p_request->>'expectedVersion') = 19 and p_request->>'expectedVersion' > '9223372036854775807')
     or p_request->>'ifMatch' <> p_request->>'expectedVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  requested_entry_id := (p_request->>'entryId')::uuid;
  requested_version := (p_request->>'expectedVersion')::bigint;
  pointers := platform_private.cms_related_content_pointers(p_request);
  if pointers <> '[]'::jsonb then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pointers::text;
  end if;
  rule_json := p_request->'derivedRule';
  if pg_catalog.jsonb_typeof(rule_json) = 'object' then
    pointers := platform_private.cms_related_rule_pointers(rule_json);
    if pointers <> '[]'::jsonb then
      raise exception 'derived_rule_unknown' using errcode = 'P0001', detail = pointers::text;
    end if;
    rule_key := rule_json->>'key';
    rule_version := (rule_json->>'version')::bigint;
    rule_bound := (rule_json->>'maxCandidates')::numeric::integer;
  end if;
  select coalesce(pg_catalog.array_agg((element.value #>> '{}')::uuid order by element.ord), array[]::uuid[])
    into pin_ids
    from pg_catalog.jsonb_array_elements(p_request->'pins') with ordinality element(value, ord);
  select coalesce(pg_catalog.array_agg((element.value #>> '{}')::uuid order by element.ord), array[]::uuid[])
    into exclusion_ids
    from pg_catalog.jsonb_array_elements(p_request->'exclusions') with ordinality element(value, ord);

  -- 2-3: position 0 (the entry), position 1 (the authority rows), capability re-proved under the locks.
  select * into entry_row from platform_private.cms_content_entries entry
   where entry.id = requested_entry_id for update;
  if not found or not platform_private.cms_entry_tenant_visible(actor_id, entry_row.owner_party_id)
     or entry_row.owner_party_id is distinct from acting_party_id then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  perform platform_private.cms_lock_entry_authority(actor_id, acting_party_id, entry_row.id);
  if platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.editor', entry_row.id) is null
     and platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.author', entry_row.id) is null then
    raise exception 'capability_missing' using errcode = 'P0001';
  end if;
  if entry_row.lifecycle <> 'active' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  -- 4: idempotency.
  reservation := platform_private.cms_reserve(p_request, actor_id, 'CMS-03C-05');
  if reservation.state = 'completed'::platform_private.idempotency_state then
    if reservation.response_ref->'safeHeaders' ? 'response' then
      return reservation.response_ref->'safeHeaders'->'response';
    end if;
    raise exception 'INTERNAL_ERROR' using errcode = 'P0001';
  end if;

  -- 5: CAS on the entry aggregate version.
  if entry_row.version <> requested_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001',
      detail = pg_catalog.jsonb_build_object(
        'expectedVersion', requested_version::text, 'currentVersion', entry_row.version::text)::text;
  end if;

  -- 6: position 2, the targets FOR SHARE in ascending id order (only entries of the caller's own party that the
  -- caller can read are locked, so an unreadable entry is never a lock lever), then eligibility under the locks.
  select coalesce(pg_catalog.array_agg(candidate.id), array[]::uuid[]) into readable_ids
    from platform_private.cms_content_entries candidate
   where candidate.id = any(pin_ids || exclusion_ids)
     and candidate.id <> entry_row.id
     and candidate.owner_party_id = acting_party_id
     and (platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.editor', candidate.id) is not null
          or platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.author', candidate.id) is not null);
  perform platform_private.cms_lock_entry_rows_shared(readable_ids);
  item_no := 0;
  foreach target in array pin_ids loop
    if not exists (
      select 1 from platform_private.cms_content_entries candidate
       where candidate.id = target and candidate.id <> entry_row.id
         and candidate.owner_party_id = acting_party_id and candidate.lifecycle = 'active'
         and (platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.editor', candidate.id) is not null
              or platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.author', candidate.id) is not null)
    ) then
      offending := offending || pg_catalog.jsonb_build_array('/pins/' || item_no);
    end if;
    item_no := item_no + 1;
  end loop;
  item_no := 0;
  foreach target in array exclusion_ids loop
    if not exists (
      select 1 from platform_private.cms_content_entries candidate
       where candidate.id = target and candidate.owner_party_id = acting_party_id
         and (platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.editor', candidate.id) is not null
              or platform_private.cms_authority_origin(actor_id, acting_party_id, 'cms.author', candidate.id) is not null)
    ) then
      offending := offending || pg_catalog.jsonb_build_array('/exclusions/' || item_no);
    end if;
    item_no := item_no + 1;
  end loop;
  if offending <> '[]'::jsonb then
    raise exception 'related_target_ineligible' using errcode = 'P0001', detail = offending::text;
  end if;

  -- 7: position 4, the content-type version of the source revision.
  select * into revision_row from platform_private.cms_entry_revisions revision
   where revision.id = entry_row.current_draft_revision_id;
  if found then
    perform 1 from platform_private.cms_content_type_versions version_row
     where version_row.id = revision_row.schema_version_id for share;
  end if;

  -- 8: replace the whole rule set by appending rows (cms_related_rules_replace).
  perform platform_private.cms_related_rules_replace(
    entry_row.id, entry_row.owner_id, actor_id, snapshot_time, pin_ids, exclusion_ids,
    rule_key, rule_version, rule_bound);

  -- 9: eligibleCount, the entry CAS, the audit record and the answer.
  eligible_count := platform_private.cms_related_eligible_count(
    entry_row.id, pin_ids, exclusion_ids, rule_key, rule_bound);
  update platform_private.cms_content_entries
     set version = version + 1, updated_at = snapshot_time
   where id = entry_row.id and version = requested_version;
  if not found then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;
  perform platform_private.cms_record_audit(
    'cms.related_content.curate', actor_id, acting_party_id, 'cms_content_entry', entry_row.id,
    'CMS_RELATED_CONTENT_CURATED', correlation_id);

  derived_object := case when rule_key is null then null
    else pg_catalog.jsonb_build_object('key', rule_key, 'version', rule_version::text) end;
  -- BE03c states no hash recipe for RelatedContentResource.contentHash; the lane's recipe covers every stored
  -- rule input, so a change to any of pins, exclusions, rule key, rule version or maxCandidates changes it.
  hash_rule := case when rule_key is null then null
    else pg_catalog.jsonb_build_object('key', rule_key, 'version', rule_version::text, 'maxCandidates', rule_bound) end;
  rule_state := case when pg_catalog.cardinality(pin_ids) > 0 or pg_catalog.cardinality(exclusion_ids) > 0
                       or rule_key is not null then 'active' else 'revoked' end;
  response := pg_catalog.jsonb_build_object(
    'id', entry_row.id,
    'version', (requested_version + 1)::text,
    'contentHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
      'pins', pg_catalog.to_jsonb(pin_ids), 'exclusions', pg_catalog.to_jsonb(exclusion_ids),
      'derivedRule', hash_rule)),
    'createdAt', platform_private.auth_iso_time(snapshot_time),
    'updatedAt', platform_private.auth_iso_time(snapshot_time),
    'state', rule_state,
    'sourceEntryId', entry_row.id,
    'pins', pg_catalog.to_jsonb(pin_ids),
    'exclusions', pg_catalog.to_jsonb(exclusion_ids),
    'derivedRule', derived_object,
    'eligibleCount', eligible_count);
  perform platform_private.cms_complete(reservation.id, entry_row.id, 201, response);
  return response;
end;
$body$;

comment on function platform_private.cms_curate_related_content(jsonb) is
  'CMS-03C-05 (D11, OD-5): an assigned author or editor replaces the related-content rule set of one source entry as append-only revoked/active rows under If-Match = the entry aggregate version; uniform related_target_ineligible refusal, registry-checked derived rule, eligibleCount, idempotency and audit, no outbox event. Private; the Worker calls the platform_api wrapper.';

commit;
