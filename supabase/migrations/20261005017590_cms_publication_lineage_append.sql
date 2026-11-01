-- Slice 11 shared helpers (lane S11-3s, BE03b "Publication lineage (E3)", Write-path
-- lock order position 7; tracker P2-S11-AC-114, AC-115, AC-116): the lineage append.
--
-- A lineage is the sequence of cms_publication_versions rows of one (entry, locale,
-- audience); it carries a stable publication_id (the id of its first row) and a
-- lineage version (1, then + 1 per successor).  cms_append_publication_lineage appends
-- the NEXT row under the lineage advisory lock:
--   publish                    an `active` head carrying the full evidence (revision, version set,
--                              dependency hash, activation evidence hash and the schema artifact,
--                              template, taxonomy and settings members projected from the version
--                              set); supersession of the previous head is DERIVED, no row changes
--   unpublish | expire | archive   a `revoked` tombstone that COPIES the ended head's revision and
--                              evidence (the caller supplies none); an absent or revoked head is
--                              409 publication_not_active
-- Every appended row writes the audit row and exactly one cms.publication.changed.v1
-- { entryId, publicationVersionId } (producer cms.editorial, aggregate cms_publication keyed by the
-- lineage id at the lineage sequence) in the caller's transaction.  The answer is the
-- PublicationResource of the appended row (projectionState `pending` until a Shard 04 consumer
-- reports, DEC-158e).  The data-model guard cms_lineage_append_guard stays the backstop (hash
-- recomputation, predecessor and head checks, separation of duties, active entry, approved review at
-- the same dependency hash); a unique-key collision of two racing appends is 409 publication_conflict.
--
-- Racing commands (BE03b E3, finding 8 of the 2026-10-09 SQL2 reverification).  Taking the lineage lock and THEN
-- reading the head would serialize two racing commands and let both commit (H+1, H+2).  A command therefore
-- carries the head it OBSERVED (cms_lineage_head_observation: { id, version }, both null for an absent head)
-- BEFORE the earliest shared serialization point (before the entry, authority, schema and review locks), and the
-- append compares it with the head read under the lineage lock: any difference is 409 publication_conflict and
-- nothing commits (the loser's reservation, audit record and event roll back with it).  A command that starts
-- after the winner committed observes the new head and succeeds as the next version.  The observation is
-- optional on the helper (a caller with no earlier premise appends to whatever the head is); the named commands
-- always send it.  The caller may also choose the audit event id and the outbox event id of the row it appends
-- (auditEventId, outboxEventId) so that the evidence summary of its command is keyed to them (DEC-159 (5)).
--
--   cms_record_audit_event(...)            the audit record cms_record_audit writes, ANSWERING its id
--   cms_emit_event_ids(...)                the audit record + outbox event cms_emit_event writes, ANSWERING both ids
--   cms_lineage_head_observation(entry, locale, audience)  the unlocked read of the head: { id, version }
--   cms_publication_lineage_lock(entry, locale, audience)  position 7: the lineage advisory
--       transaction lock (held to commit; idempotent per transaction); a leaf lock.
--   cms_publication_row_state(row)  the DERIVED browser state: revoked (tombstone), superseded (a
--       publish row that is not the head of its lineage) or active (the head publish row).
-- Also registers the `cms.publication.` event prefix to the cms.editorial producer.
-- Private; callers hold every earlier lock position and run under the CMS RPC context.  Forward-only.
begin;

select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.outbox_event_producers(event_type_prefix, producer)
values ('cms.publication.', 'cms.editorial');

create or replace function platform_private.cms_publication_lineage_lock(
  p_entry_id uuid,
  p_locale text,
  p_audience text
)
returns void
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if p_entry_id is null or p_locale is null or p_audience is null then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'cms.publication.lineage:' || p_entry_id::text || ':' || p_locale || ':' || p_audience, 0
  ));
end;
$body$;

comment on function platform_private.cms_publication_lineage_lock(uuid, text, text) is
  'BE03b E3 lock position 7: the lineage advisory transaction lock of (entry, locale, audience); idempotent per transaction; a leaf lock. Private.';

create or replace function platform_private.cms_record_audit_event(
  p_action text,
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_correlation_id uuid,
  p_audit_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $body$
declare
  audit_id uuid := coalesce(p_audit_event_id, extensions.gen_random_uuid());
begin
  -- The same row cms_record_audit writes, with a known id (the definer holds INSERT only, so the id is chosen
  -- here instead of read back).
  insert into audit_private.audit_events(
    id, action, actor_id, acting_party_id, target_type, target_id,
    decision, reason_code, correlation_id
  ) values (
    audit_id, p_action, p_actor_id, coalesce(p_acting_party_id, p_actor_id), p_target_type,
    p_target_id, 'allowed'::platform_private.audit_decision, p_reason_code,
    p_correlation_id
  );
  return audit_id;
end;
$body$;

comment on function platform_private.cms_record_audit_event(text, uuid, uuid, text, uuid, text, uuid, uuid) is
  'DEC-159 (5): writes the audit record cms_record_audit writes and ANSWERS its id (the caller may choose it with p_audit_event_id), so an evidence summary can be keyed to the exact audit event. The shared audit table and payload are untouched. Private.';

create or replace function platform_private.cms_emit_event_ids(
  p_action text,
  p_actor_id uuid,
  p_acting_party_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_aggregate_version bigint,
  p_payload jsonb,
  p_correlation_id uuid,
  p_audit_event_id uuid default null,
  p_outbox_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  audit_id uuid;
  outbox_id uuid := coalesce(p_outbox_event_id, extensions.gen_random_uuid());
begin
  audit_id := platform_private.cms_record_audit_event(
    p_action, p_actor_id, p_acting_party_id, p_target_type, p_target_id, p_reason_code, p_correlation_id,
    p_audit_event_id
  );
  -- The same row cfg_emit_effects (cms_emit_event) writes, with a known id.
  insert into platform_private.outbox_events(
    id, event_type, schema_version, aggregate_type, aggregate_id,
    aggregate_version, correlation_id, payload
  ) values (
    outbox_id, p_event_type, 1, p_aggregate_type, p_aggregate_id,
    p_aggregate_version, p_correlation_id, p_payload
  );
  return pg_catalog.jsonb_build_object('auditEventId', audit_id, 'outboxEventId', outbox_id);
end;
$body$;

comment on function platform_private.cms_emit_event_ids(text, uuid, uuid, text, uuid, text, text, text, uuid, bigint, jsonb, uuid, uuid, uuid) is
  'DEC-159 (5): writes the audit record and the outbox event cms_emit_event writes and ANSWERS { auditEventId, outboxEventId } (the caller may choose either id). Private.';

create or replace function platform_private.cms_lineage_head_observation(
  p_entry_id uuid,
  p_locale text,
  p_audience text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select pg_catalog.jsonb_build_object('id', head.id, 'version', head.version::text)
       from platform_private.cms_publication_versions head
      where head.entry_id = p_entry_id and head.locale = p_locale and head.audience = p_audience
      order by head.version desc
      limit 1),
    pg_catalog.jsonb_build_object('id', null, 'version', null)
  )
$body$;

comment on function platform_private.cms_lineage_head_observation(uuid, text, text) is
  'BE03b E3: the head of an (entry, locale, audience) lineage as { id, version } (the head row id and its decimal lineage version), both null for an absent head. An unlocked read: a command takes it BEFORE the earliest shared serialization point and the lineage append compares it under the lineage lock. Private; STABLE.';

create or replace function platform_private.cms_publication_row_state(p_row_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select case
           when row_item.state = 'revoked' then 'revoked'
           when exists (
             select 1
               from platform_private.cms_publication_versions later
              where later.entry_id = row_item.entry_id
                and later.locale = row_item.locale
                and later.audience = row_item.audience
                and later.version > row_item.version
           ) then 'superseded'
           else 'active'
         end
    from platform_private.cms_publication_versions row_item
   where row_item.id = p_row_id
$body$;

comment on function platform_private.cms_publication_row_state(uuid) is
  'BE03b E3: the derived browser state of a lineage row: revoked for a tombstone, superseded for a publish row that is not its lineage head, else active. NULL for an absent row. Private; STABLE.';

create or replace function platform_private.cms_append_publication_lineage(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  action_value text;
  is_publish boolean;
  entry_row platform_private.cms_content_entries%rowtype;
  revision_row platform_private.cms_entry_revisions%rowtype;
  head_row platform_private.cms_publication_versions%rowtype;
  locale_value text;
  audience_value text;
  publisher uuid;
  actor uuid;
  correlation uuid;
  schedule uuid;
  version_set jsonb;
  dependency_hash text;
  activation_hash text;
  revision_id uuid;
  schema_artifact_id uuid;
  schema_artifact_hash text;
  schema_version_id uuid;
  template_version_id uuid;
  taxonomy_ids jsonb;
  settings_version bigint;
  new_id uuid := extensions.gen_random_uuid();
  lineage_id uuid;
  next_version bigint;
  supersedes uuid;
  stamp timestamptz := pg_catalog.clock_timestamp();
  physical_state text;
  digest text;
  expected_head_id uuid;
  expected_head_version bigint;
  observes_head boolean := false;
begin
  -- ---- request: exact members per action; a tombstone never carries evidence --------
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string'
     or (p_request->>'action') not in ('publish', 'unpublish', 'expire', 'archive') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  action_value := p_request->>'action';
  is_publish := action_value = 'publish';
  if not platform_private.cms_exact_keys(
       p_request,
       case when is_publish
         then array['entryId', 'revisionId', 'locale', 'audience', 'action', 'publisherPersonId',
                    'versionSet', 'dependencyHash', 'activationEvidenceHash', 'correlationId']::text[]
         else array['entryId', 'locale', 'audience', 'action', 'publisherPersonId', 'correlationId']::text[]
       end,
       case when is_publish
         then array['entryId', 'revisionId', 'locale', 'audience', 'action', 'publisherPersonId',
                    'versionSet', 'dependencyHash', 'activationEvidenceHash', 'correlationId',
                    'scheduleId', 'actorId', 'expectedHead', 'auditEventId', 'outboxEventId']::text[]
         else array['entryId', 'locale', 'audience', 'action', 'publisherPersonId', 'correlationId',
                    'scheduleId', 'actorId', 'expectedHead', 'auditEventId', 'outboxEventId']::text[]
       end
     )
     or pg_catalog.jsonb_typeof(p_request->'entryId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'entryId')
     or pg_catalog.jsonb_typeof(p_request->'publisherPersonId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'publisherPersonId')
     or pg_catalog.jsonb_typeof(p_request->'correlationId') is distinct from 'string'
     or not platform_private.cms_valid_uuid(p_request->>'correlationId')
     or pg_catalog.jsonb_typeof(p_request->'locale') is distinct from 'string'
     or p_request->>'locale' !~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
     or pg_catalog.jsonb_typeof(p_request->'audience') is distinct from 'string'
     or p_request->>'audience' !~ '^[a-z0-9_-]{1,48}$'
     or (p_request ? 'scheduleId' and p_request->'scheduleId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'scheduleId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'scheduleId')))
     or (p_request ? 'actorId' and p_request->'actorId' <> 'null'::jsonb
         and (pg_catalog.jsonb_typeof(p_request->'actorId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'actorId')))
     or (p_request ? 'auditEventId'
         and (pg_catalog.jsonb_typeof(p_request->'auditEventId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'auditEventId')))
     or (p_request ? 'outboxEventId'
         and (pg_catalog.jsonb_typeof(p_request->'outboxEventId') is distinct from 'string'
              or not platform_private.cms_valid_uuid(p_request->>'outboxEventId')))
     or (p_request ? 'expectedHead'
         and (pg_catalog.jsonb_typeof(p_request->'expectedHead') is distinct from 'object'
              or not platform_private.cms_exact_keys(
                p_request->'expectedHead', array['id', 'version']::text[], array['id', 'version']::text[])
              or (pg_catalog.jsonb_typeof(p_request->'expectedHead'->'id') = 'null')
                 is distinct from (pg_catalog.jsonb_typeof(p_request->'expectedHead'->'version') = 'null')
              or (pg_catalog.jsonb_typeof(p_request->'expectedHead'->'id') <> 'null'
                  and (pg_catalog.jsonb_typeof(p_request->'expectedHead'->'id') is distinct from 'string'
                       or not platform_private.cms_valid_uuid(p_request->'expectedHead'->>'id')
                       or pg_catalog.jsonb_typeof(p_request->'expectedHead'->'version') is distinct from 'string'
                       or p_request->'expectedHead'->>'version' !~ '^[1-9][0-9]{0,17}$')))) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if is_publish and (
       pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
       or not platform_private.cms_valid_uuid(p_request->>'revisionId')
       or pg_catalog.jsonb_typeof(p_request->'dependencyHash') is distinct from 'string'
       or p_request->>'dependencyHash' !~ '^[a-f0-9]{64}$'
       or pg_catalog.jsonb_typeof(p_request->'activationEvidenceHash') is distinct from 'string'
       or p_request->>'activationEvidenceHash' !~ '^[a-f0-9]{64}$'
       or pg_catalog.jsonb_typeof(p_request->'versionSet') is distinct from 'object'
       or not platform_private.cms_exact_keys(
         p_request->'versionSet',
         array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
               'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
               'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[],
         array['schemaVersionId', 'schemaHash', 'schemaArtifact', 'validatorRefs', 'workflowPolicy',
               'activationEvidence', 'templateVersionId', 'templateHash', 'taxonomyVersionIds',
               'blockVersionIds', 'patternVersionIds', 'settingsVersion', 'compilerVersion']::text[]
       )
       or pg_catalog.jsonb_typeof(p_request->'versionSet'->'schemaVersionId') is distinct from 'string'
       or not platform_private.cms_valid_uuid(p_request->'versionSet'->>'schemaVersionId')
       or pg_catalog.jsonb_typeof(p_request->'versionSet'->'schemaArtifact') is distinct from 'object'
       or pg_catalog.jsonb_typeof(p_request->'versionSet'->'schemaArtifact'->'id') is distinct from 'string'
       or not platform_private.cms_valid_uuid(p_request->'versionSet'->'schemaArtifact'->>'id')
       or p_request->'versionSet'->'schemaArtifact'->>'artifactHash' !~ '^[a-f0-9]{64}$'
       or pg_catalog.jsonb_typeof(p_request->'versionSet'->'taxonomyVersionIds') is distinct from 'array'
       or pg_catalog.jsonb_typeof(p_request->'versionSet'->'settingsVersion') is distinct from 'string'
       or p_request->'versionSet'->>'settingsVersion' !~ '^[1-9][0-9]{0,17}$'
       or (pg_catalog.jsonb_typeof(p_request->'versionSet'->'templateVersionId') <> 'null'
           and (pg_catalog.jsonb_typeof(p_request->'versionSet'->'templateVersionId') is distinct from 'string'
                or not platform_private.cms_valid_uuid(p_request->'versionSet'->>'templateVersionId')))
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  locale_value := p_request->>'locale';
  audience_value := p_request->>'audience';
  publisher := (p_request->>'publisherPersonId')::uuid;
  correlation := (p_request->>'correlationId')::uuid;
  if p_request ? 'scheduleId' and p_request->'scheduleId' <> 'null'::jsonb then
    schedule := (p_request->>'scheduleId')::uuid;
  end if;
  if p_request ? 'actorId' and p_request->'actorId' <> 'null'::jsonb then
    actor := (p_request->>'actorId')::uuid;
  end if;
  if p_request ? 'expectedHead' then
    observes_head := true;
    expected_head_id := (p_request->'expectedHead'->>'id')::uuid;
    expected_head_version := (p_request->'expectedHead'->>'version')::bigint;
  end if;
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  select entry.* into entry_row
    from platform_private.cms_content_entries entry
   where entry.id = (p_request->>'entryId')::uuid;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  -- ---- position 7: the lineage lock, then the head --------------------------------
  perform platform_private.cms_publication_lineage_lock(entry_row.id, locale_value, audience_value);
  select head.* into head_row
    from platform_private.cms_publication_versions head
   where head.entry_id = entry_row.id
     and head.locale = locale_value
     and head.audience = audience_value
   order by head.version desc
   limit 1;

  -- The premise the command was built on (the head it observed before it serialized) must still be the head.
  if observes_head and (head_row.id is distinct from expected_head_id
                        or head_row.version is distinct from expected_head_version) then
    raise exception 'publication_conflict' using errcode = 'P0001';
  end if;

  if not is_publish then
    if head_row.id is null or head_row.state <> 'active' then
      raise exception 'publication_not_active' using errcode = 'P0001';
    end if;
    revision_id := head_row.revision_id;
    version_set := head_row.version_set;
    dependency_hash := head_row.dependency_hash;
    activation_hash := head_row.activation_evidence_hash;
    schema_artifact_id := head_row.schema_artifact_id;
    schema_artifact_hash := head_row.schema_artifact_hash;
    schema_version_id := head_row.schema_version_id;
    template_version_id := head_row.template_version_id;
    taxonomy_ids := head_row.taxonomy_version_ids;
    settings_version := head_row.settings_version;
    physical_state := 'revoked';
  else
    select revision.* into revision_row
      from platform_private.cms_entry_revisions revision
     where revision.id = (p_request->>'revisionId')::uuid;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
    version_set := p_request->'versionSet';
    if revision_row.entry_id <> entry_row.id
       or revision_row.locale <> locale_value
       or (version_set->>'schemaVersionId')::uuid <> revision_row.schema_version_id
       or (pg_catalog.jsonb_typeof(version_set->'templateVersionId') = 'null') is distinct from (revision_row.template_version_id is null)
       or (pg_catalog.jsonb_typeof(version_set->'templateVersionId') <> 'null'
           and (version_set->>'templateVersionId')::uuid <> revision_row.template_version_id)
       or version_set->'taxonomyVersionIds' is distinct from coalesce((
         select pg_catalog.jsonb_agg(recorded.id order by recorded.id collate "C")
           from pg_catalog.jsonb_array_elements_text(revision_row.taxonomy_version_ids) recorded(id)
       ), '[]'::jsonb) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    revision_id := revision_row.id;
    dependency_hash := p_request->>'dependencyHash';
    activation_hash := p_request->>'activationEvidenceHash';
    schema_artifact_id := (version_set->'schemaArtifact'->>'id')::uuid;
    schema_artifact_hash := version_set->'schemaArtifact'->>'artifactHash';
    schema_version_id := (version_set->>'schemaVersionId')::uuid;
    template_version_id := revision_row.template_version_id;
    taxonomy_ids := version_set->'taxonomyVersionIds';
    settings_version := (version_set->>'settingsVersion')::bigint;
    physical_state := 'active';
  end if;

  next_version := coalesce(head_row.version, 0) + 1;
  lineage_id := coalesce(head_row.publication_id, new_id);
  supersedes := head_row.id;
  digest := platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'action', action_value,
    'audience', audience_value,
    'dependencyHash', dependency_hash,
    'entryId', entry_row.id,
    'locale', locale_value,
    'publicationId', lineage_id,
    'revisionId', revision_id,
    'supersedesId', supersedes,
    'version', next_version,
    'versionSet', version_set
  ));
  begin
    insert into platform_private.cms_publication_versions(
      id, owner_id, state, version, publication_id, supersedes_id, action, entry_id, revision_id,
      schedule_id, publisher_person_id, dependency_hash, activation_evidence_hash,
      schema_artifact_id, schema_artifact_hash, version_set, schema_version_id,
      template_version_id, taxonomy_version_ids, settings_version, locale, audience,
      publication_hash, activated_at, revoked_at, created_at, updated_at
    ) values (
      new_id, entry_row.owner_id, physical_state, next_version, lineage_id, supersedes, action_value,
      entry_row.id, revision_id, schedule, publisher, dependency_hash, activation_hash,
      schema_artifact_id, schema_artifact_hash, version_set, schema_version_id,
      template_version_id, taxonomy_ids, settings_version, locale_value, audience_value,
      digest,
      case when is_publish then stamp end,
      case when is_publish then null else stamp end,
      stamp, stamp
    );
  exception
    when unique_violation then
      raise exception 'publication_conflict' using errcode = 'P0001';
  end;

  perform platform_private.cms_emit_event_ids(
    'cms.publication.' || action_value, actor, entry_row.owner_id,
    'cms_publication_version', new_id, 'CMS_PUBLICATION_APPENDED',
    'cms.publication.changed.v1', 'cms_publication', lineage_id, next_version,
    pg_catalog.jsonb_build_object('entryId', entry_row.id, 'publicationVersionId', new_id),
    correlation,
    case when p_request ? 'auditEventId' then (p_request->>'auditEventId')::uuid end,
    case when p_request ? 'outboxEventId' then (p_request->>'outboxEventId')::uuid end
  );
  return pg_catalog.jsonb_build_object(
    'id', lineage_id,
    'version', next_version::text,
    'createdAt', platform_private.auth_iso_time(stamp),
    'updatedAt', platform_private.auth_iso_time(stamp),
    'state', case when is_publish then 'active' else 'revoked' end,
    'action', action_value,
    'publicationVersionId', new_id,
    'entryId', entry_row.id,
    'revisionId', revision_id,
    'locale', locale_value,
    'audience', audience_value,
    'publicationHash', digest,
    'projectionState', 'pending',
    'eventType', 'cms.publication.changed.v1'
  );
end;
$body$;

comment on function platform_private.cms_append_publication_lineage(jsonb) is
  'BE03b E3: appends the next append-only row of an (entry, locale, audience) lineage under the lineage advisory lock: a publish head, or an unpublish/expire/archive tombstone copying the ended head (publication_not_active without an active head); audit + exactly one cms.publication.changed.v1; answers the PublicationResource of the appended row. A unique-key collision is publication_conflict. Private.';

grant select, insert on table platform_private.cms_publication_versions to wejammin_cms_definer;
grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_entry_revisions
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_record_audit_event(text, uuid, uuid, text, uuid, text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_emit_event_ids(text, uuid, uuid, text, uuid, text, text, text, uuid, bigint, jsonb, uuid, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_lineage_head_observation(uuid, text, text) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_lineage_lock(uuid, text, text) owner to wejammin_cms_definer;
alter function platform_private.cms_publication_row_state(uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_append_publication_lineage(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_record_audit_event(text, uuid, uuid, text, uuid, text, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_emit_event_ids(text, uuid, uuid, text, uuid, text, text, text, uuid, bigint, jsonb, uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_lineage_head_observation(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_publication_lineage_lock(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_publication_row_state(uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_append_publication_lineage(jsonb) from public, anon, authenticated, service_role;

commit;
