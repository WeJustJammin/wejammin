-- Slice 11 shared helpers: the E3 publication lineage append
-- (BE03b "Publication lineage (E3)"; tracker P2-S11-AC-114, AC-115, AC-116).
-- RED before 20261005017590, GREEN after.
--
-- cms_append_publication_lineage(request) takes the lineage advisory lock (lock
-- position 7), appends the next append-only row of (entry, locale, audience) --
-- a `publish` head (supersession is derived) or a `revoked` tombstone that copies
-- the ended head's revision and evidence -- and emits the audit row and exactly
-- one cms.publication.changed.v1 in the caller's transaction.  It returns the
-- PublicationResource of the appended row.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(101);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);

\ir phase_02_slice_11_helpers/004-lineage.sqlinc


-- ---------------------------------------------------------------------------
-- Shape, privileges, registration.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_append_publication_lineage(jsonb)')
    and pg_temp.h11_private_definer('cms_publication_lineage_lock(uuid, text, text)')
    and pg_temp.h11_private_definer('cms_publication_row_state(uuid)'),
  'the lineage helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-114]');
select ok(
  pg_temp.h11_volatility('cms_append_publication_lineage(jsonb)') = 'v'
    and pg_temp.h11_volatility('cms_publication_lineage_lock(uuid, text, text)') = 'v'
    and pg_temp.h11_volatility('cms_publication_row_state(uuid)') = 's',
  'append and lock are VOLATILE, the derived row state is a STABLE read [P2-S11-AC-114]');
select is(pg_temp.h11_text($$select platform_private.outbox_event_producer('cms.publication.changed.v1')$$), 'cms.editorial',
  'the cms.publication. event prefix is registered to the cms.editorial producer [P2-S11-AC-116]');
select is(pg_temp.h11_text($$select platform_private.outbox_event_producer('cms.entry.review-changed.v1')$$), 'cms.editorial',
  'control: the existing cms.entry. prefix is untouched [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- The first publish of a lineage.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('p1');
select pg_temp.h11l_review('p1');
create temp table h11l_first on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_publish('p1')) as resource;

select is((select array_agg(k order by k) from jsonb_object_keys((select resource from h11l_first)) k),
  array['action', 'audience', 'createdAt', 'entryId', 'eventType', 'id', 'locale', 'projectionState', 'publicationHash',
        'publicationVersionId', 'revisionId', 'state', 'updatedAt', 'version'],
  'the answer is exactly the PublicationResource members [P2-S11-AC-116]');
select is((select resource->>'state' || '/' || (resource->>'action') || '/' || (resource->>'version') || '/' || (resource->>'projectionState') || '/' || (resource->>'eventType')
  from h11l_first), 'active/publish/1/pending/cms.publication.changed.v1',
  'the first publish is active, version 1, projectionState pending (no Shard 04 consumer, DEC-158e) and names its event [P2-S11-AC-116]');
select is((select resource->>'id' = resource->>'publicationVersionId' from h11l_first), true,
  'for the first row the lineage id is the row id (the stable publication_id is the first row''s id) [P2-S11-AC-114]');
select is(pg_temp.h11l_rows('p1'), '1:publish:active:-', 'exactly one append-only row exists: version 1, publish, active, no predecessor [P2-S11-AC-114]');
select is((select entry_id = pg_temp.h11w_uuid('p1:entry') and revision_id = pg_temp.h11w_uuid('p1:revision') and owner_id = pg_temp.h11w_org()
             and publisher_person_id = pg_temp.s11_id('reviewer04') and locale = 'en-US' and audience = 'public'
             and activated_at is not null and revoked_at is null and schedule_id is null and updated_at = created_at
          from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('p1:entry')),
  true, 'the row carries the entry owner, the publisher, the lineage keys and an activation instant; updated_at = created_at [P2-S11-AC-114]');
select is((select schema_version_id = pg_temp.h11w_version() and (version_set = pg_temp.h11l_vs('p1'))
             and settings_version = (version_set->>'settingsVersion')::bigint
             and schema_artifact_id = (version_set->'schemaArtifact'->>'id')::uuid
             and schema_artifact_hash = version_set->'schemaArtifact'->>'artifactHash'
             and template_version_id is null and taxonomy_version_ids = '[]'::jsonb
             and dependency_hash = pg_temp.h11l_dep('p1') and activation_evidence_hash = repeat('b', 64)
          from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('p1:entry')),
  true, 'the evidence columns are projected from the version set and the request evidence [P2-S11-AC-114]');
select is((select publication_hash::text from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('p1:entry') and version = 1),
  pg_temp.h11_sha256(
    '{"action":"publish","audience":"public","dependencyHash":"' || pg_temp.h11l_dep('p1')
    || '","entryId":"' || pg_temp.h11w_uuid('p1:entry') || '","locale":"en-US","publicationId":"'
    || (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('p1:entry'))
    || '","revisionId":"' || pg_temp.h11w_uuid('p1:revision') || '","supersedesId":null,"version":1,"versionSet":'
    || platform_private.cms_jcs(pg_temp.h11l_vs('p1')) || '}'),
  'publication_hash is the SHA-256 of the literal JCS { action, audience, dependencyHash, entryId, locale, publicationId, revisionId, supersedesId, version, versionSet } [P2-S11-AC-116]');
select is((select resource->>'publicationHash' from h11l_first),
  (select publication_hash::text from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('p1:entry') and version = 1),
  'the resource names the stored publication hash [P2-S11-AC-116]');
select is(
  (select count(*)::integer from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'), 1,
  'exactly one cms.publication.changed.v1 is emitted for the appended row [P2-S11-AC-116]');
select is(
  (select payload from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'),
  jsonb_build_object('entryId', pg_temp.h11w_uuid('p1:entry'),
    'publicationVersionId', (select (resource->>'publicationVersionId')::uuid from h11l_first)),
  'the payload is identifiers only: { entryId, publicationVersionId = the appended row id } [P2-S11-AC-116]');
select is(
  (select aggregate_type || '/' || (aggregate_id = (select (resource->>'id')::uuid from h11l_first))::text || '/' || aggregate_version::text
     from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'),
  'cms_publication/true/1', 'the aggregate is cms_publication keyed by the lineage id at the lineage sequence [P2-S11-AC-116]');
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'cms.publication.publish'
     and target_id = (select (resource->>'publicationVersionId')::uuid from h11l_first)),
  1, 'one audit row records the append [P2-S11-AC-116]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_row_state(%L::uuid)', (select resource->>'publicationVersionId' from h11l_first))), 'active',
  'the head publish row is derived active [P2-S11-AC-115]');

-- ---------------------------------------------------------------------------
-- A newer publish supersedes the head (derived), never updates it.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('p2', 'creatorPerson', 'en-US', '[]'::jsonb, 'p1', 2);
select pg_temp.h11l_review('p2', 'p1');
create temp table h11l_second on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_publish('p2', 'public', '{}', 'p1')) as resource;
select is((select resource->>'version' || '/' || (resource->>'state') from h11l_second), '2/active', 'the second publish is lineage version 2, active [P2-S11-AC-115]');
select is((select resource->>'id' from h11l_second), (select resource->>'id' from h11l_first),
  'the lineage id is stable across rows (the first row''s id) [P2-S11-AC-114]');
select is((select resource->>'publicationVersionId' <> resource->>'id' from h11l_second), true, 'publicationVersionId is the new row''s own id [P2-S11-AC-114]');
select is(pg_temp.h11l_rows('p1'), '1:publish:active:-,2:publish:active:S',
  'the superseded head stays physically active (no UPDATE, no new row for supersession) [P2-S11-AC-114]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_row_state(%L::uuid)', (select resource->>'publicationVersionId' from h11l_first))), 'superseded',
  'the previous head is derived superseded [P2-S11-AC-115]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_row_state(%L::uuid)', (select resource->>'publicationVersionId' from h11l_second))), 'active',
  'the new head is derived active [P2-S11-AC-115]');
select is((select supersedes_id from platform_private.cms_publication_versions where id = (select (resource->>'publicationVersionId')::uuid from h11l_second)),
  (select (resource->>'publicationVersionId')::uuid from h11l_first), 'the new row supersedes the previous head [P2-S11-AC-114]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'), 2,
  'one event per appended row [P2-S11-AC-116]');
select is((select aggregate_version::text from platform_private.outbox_events where event_type = 'cms.publication.changed.v1' order by aggregate_version desc limit 1), '2',
  'the second event carries the lineage sequence 2 [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- A tombstone ends an active head and copies its evidence.
-- ---------------------------------------------------------------------------
create temp table h11l_tomb on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_tombstone('p1', 'unpublish')) as resource;
select is((select resource->>'version' || '/' || (resource->>'state') || '/' || (resource->>'action') from h11l_tomb), '3/revoked/unpublish',
  'an unpublish appends a revoked tombstone, lineage version 3 [P2-S11-AC-115]');
select is(pg_temp.h11l_rows('p1'), '1:publish:active:-,2:publish:active:S,3:unpublish:revoked:S', 'the lineage is three append-only rows [P2-S11-AC-114]');
select is((select tomb.revision_id = head.revision_id and tomb.dependency_hash = head.dependency_hash
             and tomb.activation_evidence_hash = head.activation_evidence_hash and tomb.version_set = head.version_set
             and tomb.schema_artifact_hash = head.schema_artifact_hash and tomb.settings_version = head.settings_version
             and tomb.activated_at is null and tomb.revoked_at is not null and tomb.state = 'revoked'
          from platform_private.cms_publication_versions tomb, platform_private.cms_publication_versions head
         where tomb.id = (select (resource->>'publicationVersionId')::uuid from h11l_tomb)
           and head.id = (select (resource->>'publicationVersionId')::uuid from h11l_second)),
  true, 'the tombstone copies the ended head''s revision and evidence; revoked_at set, activated_at null [P2-S11-AC-114]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_row_state(%L::uuid)', (select resource->>'publicationVersionId' from h11l_tomb))), 'revoked',
  'a tombstone is derived revoked [P2-S11-AC-115]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'), 3, 'the tombstone emitted its own event [P2-S11-AC-116]');
select is((select count(*)::integer from audit_private.audit_events where action = 'cms.publication.unpublish'), 1, 'and its audit row (action named after the lineage action) [P2-S11-AC-116]');

-- an unpublish/expire/archive needs an ACTIVE head
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('p1', 'expire')), jsonb_build_object('error', 'P0001:publication_not_active'),
  'a second tombstone on a revoked head is 409 publication_not_active [P2-S11-AC-115]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('p1', 'archive')), jsonb_build_object('error', 'P0001:publication_not_active'),
  'archive on a revoked head is publication_not_active as well [P2-S11-AC-115]');
select is(pg_temp.h11l_rows('p1'), '1:publish:active:-,2:publish:active:S,3:unpublish:revoked:S', 'the refused appends wrote nothing [P2-S11-AC-115]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('p1', 'unpublish', 'beta')), jsonb_build_object('error', 'P0001:publication_not_active'),
  'a lineage with no head at all (another audience) is publication_not_active [P2-S11-AC-115]');

-- a revoked lineage may be published again
select pg_temp.h11w_revision('p3', 'creatorPerson', 'en-US', '[]'::jsonb, 'p1', 3);
select pg_temp.h11l_review('p3', 'p1');
create temp table h11l_third on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_publish('p3', 'public', '{}', 'p1')) as resource;
select is((select resource->>'version' || '/' || (resource->>'state') || '/' || (resource->>'id' = (select resource->>'id' from h11l_first))::text from h11l_third),
  '4/active/true', 'publish may follow a revoked head: version 4, the same lineage id [P2-S11-AC-115]');
select is(pg_temp.h11l_rows('p1'), '1:publish:active:-,2:publish:active:S,3:unpublish:revoked:S,4:publish:active:S', 'four rows, one head [P2-S11-AC-115]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_row_state(%L::uuid)', (select resource->>'publicationVersionId' from h11l_second))), 'superseded',
  'the earlier publish row stays superseded [P2-S11-AC-115]');

-- the other tombstone actions
select pg_temp.h11w_revision('q1');
select pg_temp.h11l_review('q1');
select pg_temp.h11l_append(pg_temp.h11l_publish('q1'));
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('q1', 'expire')) ->> 'action', 'expire', 'expire appends a tombstone [P2-S11-AC-115]');
select pg_temp.h11w_revision('q2');
select pg_temp.h11l_review('q2');
select pg_temp.h11l_append(pg_temp.h11l_publish('q2'));
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('q2', 'archive')) ->> 'state', 'revoked', 'archive appends a revoked tombstone [P2-S11-AC-115]');

-- lineages are independent per audience and locale
select pg_temp.h11w_revision('b1');
select pg_temp.h11l_review('b1');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('b1', 'beta')) ->> 'version', '1', 'another audience starts its own lineage at version 1 [P2-S11-AC-115]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('b1', 'public')) ->> 'version', '1', 'and so does the public audience of that entry [P2-S11-AC-115]');
select isnt((select count(distinct publication_id)::integer from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('b1:entry')), 1,
  'two audiences of one entry are two lineages with two stable ids [P2-S11-AC-114]');

-- ---------------------------------------------------------------------------
-- Guarded refusals (the data-model guard is the backstop, the helper raises first where it can).
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('g1');
select pg_temp.h11l_review('g1');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('g1', 'public', '{}', null, 'creator')), jsonb_build_object('error', 'P0001:separation_of_duties'),
  'the revision author never publishes their own revision (E11) [P2-S11-AC-107]');
select pg_temp.h11w_revision('g2');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('g2')), jsonb_build_object('error', 'P0001:CONFLICT'),
  'a revision without an approved review at that dependency hash cannot be published [P2-S11-AC-115]');
select pg_temp.h11w_revision('g3');
select pg_temp.h11l_review('g3');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('g3', 'public', jsonb_build_object('dependencyHash', repeat('e', 64)))), jsonb_build_object('error', 'P0001:CONFLICT'),
  'an approved review at another dependency hash does not authorize the publish [P2-S11-AC-115]');
select pg_temp.h11w_revision('g4');
select pg_temp.h11l_review('g4');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('g4:entry');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('g4')) ->> 'error', 'P0001:entry_unavailable',
  'an entry that left active cannot be published (and its review was invalidated by the lifecycle producer) [P2-S11-AC-115]');
select is(pg_temp.h11i_review_state('rv-g4'), 'invalidated/entry_unavailable',
  'control: the entry leaving active invalidated the approved review entry_unavailable [P2-S11-AC-112]');

-- ---------------------------------------------------------------------------
-- Request discipline.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('v1');
select pg_temp.h11l_review('v1');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1') || '{"surprise":1}'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'an unknown member is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1') - 'versionSet'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'a publish without its version set is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1') - 'dependencyHash'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'a publish without its dependency hash is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('p1', 'unpublish') || jsonb_build_object('revisionId', pg_temp.h11w_uuid('p1:revision'))),
  jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'a tombstone never accepts evidence from the caller (it copies the head) [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'Public')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'an audience outside ^[a-z0-9_-]{1,48}$ is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', '{"locale":"en us"}')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'a malformed locale is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', '{"action":"delete"}')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'an action outside the four is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', '{"entryId":"nope"}')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'), 'a malformed entry id is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('entryId', 'a9200000-0000-4000-8000-0000000000ee'))), jsonb_build_object('error', 'P0001:NOT_FOUND'),
  'an absent entry is NOT_FOUND [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('revisionId', 'a9200000-0000-4000-8000-0000000000ee'))), jsonb_build_object('error', 'P0001:NOT_FOUND'),
  'an absent revision is NOT_FOUND [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('revisionId', pg_temp.h11w_uuid('p1:revision')))), jsonb_build_object('error', 'P0001:VALIDATION_FAILED'),
  'a revision that belongs to another entry is VALIDATION_FAILED [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('locale', 'fr-FR'))), jsonb_build_object('error', 'P0001:VALIDATION_FAILED'),
  'a lineage locale that is not the revision locale is VALIDATION_FAILED [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('versionSet', jsonb_set(pg_temp.h11l_vs('v1'), '{schemaVersionId}', '"a9200000-0000-4000-8000-0000000000ee"')))),
  jsonb_build_object('error', 'P0001:VALIDATION_FAILED'), 'a version set naming another schema version is VALIDATION_FAILED [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', jsonb_build_object('versionSet', jsonb_set(pg_temp.h11l_vs('v1'), '{taxonomyVersionIds}', '["a9200000-0000-4000-8000-0000000000ee"]')))),
  jsonb_build_object('error', 'P0001:VALIDATION_FAILED'), 'a version set naming taxonomy versions the revision does not record is VALIDATION_FAILED [P2-S11-AC-114]');
select is((pg_temp.h11l_append(pg_temp.h11l_publish('v1', 'public', '{"publisherPersonId":"a9200000-0000-4000-8000-0000000000ee"}'))->>'error') like '23503:%', true,
  'an unknown publisher person violates the foreign key [P2-S11-AC-114]');
select is(pg_temp.h11l_rows('v1'), '', 'none of the refused requests appended a row [P2-S11-AC-114]');

-- a scheduled append records its schedule
select pg_temp.h11w_revision('sch');
select pg_temp.h11l_review('sch');
select pg_temp.h11_raw_insert('platform_private.cms_publication_schedules', pg_temp.s11_schedule_row(jsonb_build_object(
  'id', pg_temp.h11w_uuid('schedule'), 'entry_id', pg_temp.h11w_uuid('sch:entry'), 'revision_id', pg_temp.h11w_uuid('sch:revision'),
  'review_id', pg_temp.s11_id('rv-sch'), 'created_by', pg_temp.s11_id('reviewer04'),
  'dependency_hash', pg_temp.h11l_dep('sch'), 'state', 'executing',
  'lease_id', extensions.gen_random_uuid(), 'lease_until', timestamptz '2027-01-15T08:05:00Z')));
select is(pg_temp.h11l_append(pg_temp.h11l_publish('sch', 'public', jsonb_build_object('scheduleId', pg_temp.h11w_uuid('schedule')))) ->> 'state', 'active',
  'an executor append names its schedule [P2-S11-AC-116]');
select is((select schedule_id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('sch:entry')), pg_temp.h11w_uuid('schedule'),
  'the schedule id is stored on the row [P2-S11-AC-116]');
select is((pg_temp.h11l_append(pg_temp.h11l_tombstone('sch', 'unpublish', 'public', jsonb_build_object('scheduleId', pg_temp.h11w_uuid('p1:entry'))))->>'error') like '23503:%', true,
  'an unknown schedule violates the foreign key [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- BE03b E3: the head a command OBSERVED before it serialized (expectedHead: {id, version}, both null for an absent head)
-- is compared with the head under the lineage lock; any difference is 409 publication_conflict and nothing commits.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('x1');
select pg_temp.h11l_review('x1');
select is(platform_private.cms_lineage_head_observation(pg_temp.h11w_uuid('x1:entry'), 'en-US', 'public'),
  '{"id": null, "version": null}'::jsonb,
  'an empty lineage is observed as an explicit absent head (null id, null version) [P2-S11-AC-114]');
create temp table h11l_x1 on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_publish('x1', 'public', '{"expectedHead": {"id": null, "version": null}}')) as resource;
select is((select resource->>'version' || '/' || (resource->>'state') from h11l_x1), '1/active',
  'a publish that observed an absent head and still finds none appends version 1 [P2-S11-AC-114]');
select is(platform_private.cms_lineage_head_observation(pg_temp.h11w_uuid('x1:entry'), 'en-US', 'public'),
  jsonb_build_object('id', (select resource->>'publicationVersionId' from h11l_x1), 'version', '1'),
  'the observation of a lineage is its head: the head row id and its decimal lineage version [P2-S11-AC-114]');
select pg_temp.h11w_revision('x2', 'creatorPerson', 'en-US', '[]'::jsonb, 'x1', 2);
select pg_temp.h11l_review('x2', 'x1');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": {"id": null, "version": null}}', 'x1')),
  jsonb_build_object('error', 'P0001:publication_conflict'),
  'a command that observed the lineage before it had a head loses once the head exists: publication_conflict, not a second row [P2-S11-AC-114]');
select is(pg_temp.h11l_rows('x1'), '1:publish:active:-', 'the loser committed no row [P2-S11-AC-114]');
select is((select count(*)::integer from platform_private.outbox_events
            where event_type = 'cms.publication.changed.v1' and payload->>'entryId' = pg_temp.h11w_uuid('x1:entry')::text)
        + (select count(*)::integer from audit_private.audit_events audit
            where audit.action = 'cms.publication.publish' and audit.target_id in (select id from platform_private.cms_publication_versions
                                                                                    where entry_id = pg_temp.h11w_uuid('x1:entry'))),
  2, 'and no event or audit record: still exactly the winner''s one event and one audit record [P2-S11-AC-116]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', jsonb_build_object('expectedHead',
    jsonb_build_object('id', (select resource->>'publicationVersionId' from h11l_x1), 'version', '2')), 'x1'))->>'error',
  'P0001:publication_conflict', 'the right head id with another version is a different head: publication_conflict [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', jsonb_build_object('expectedHead',
    jsonb_build_object('id', extensions.gen_random_uuid(), 'version', '1')), 'x1'))->>'error',
  'P0001:publication_conflict', 'the right version with another head id is a different head: publication_conflict [P2-S11-AC-114]');
create temp table h11l_x2 on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', jsonb_build_object('expectedHead',
  platform_private.cms_lineage_head_observation(pg_temp.h11w_uuid('x1:entry'), 'en-US', 'public')), 'x1')) as resource;
select is((select resource->>'version' from h11l_x2), '2',
  'a command that observed the current head appends the next version (a genuinely later command succeeds as H+1) [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('x1', 'unpublish', 'public', jsonb_build_object('expectedHead',
    jsonb_build_object('id', (select resource->>'publicationVersionId' from h11l_x1), 'version', '1')))),
  jsonb_build_object('error', 'P0001:publication_conflict'),
  'a tombstone that observed the superseded head loses as well (it would end a head that is no longer the head) [P2-S11-AC-115]');
create temp table h11l_x3 on commit drop as
select pg_temp.h11l_append(pg_temp.h11l_tombstone('x1', 'unpublish', 'public', jsonb_build_object('expectedHead',
  platform_private.cms_lineage_head_observation(pg_temp.h11w_uuid('x1:entry'), 'en-US', 'public')))) as resource;
select is((select resource->>'version' || '/' || (resource->>'state') from h11l_x3), '3/revoked',
  'a tombstone that observed the current head appends the revoked row [P2-S11-AC-115]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('x1', 'expire', 'public', jsonb_build_object('expectedHead',
    jsonb_build_object('id', (select resource->>'publicationVersionId' from h11l_x2), 'version', '2')))),
  jsonb_build_object('error', 'P0001:publication_conflict'),
  'a stale observation is a conflict BEFORE the head is judged not active: the premise is refused first [P2-S11-AC-115]');
select is(pg_temp.h11l_append(pg_temp.h11l_tombstone('x1', 'expire', 'public', jsonb_build_object('expectedHead',
    platform_private.cms_lineage_head_observation(pg_temp.h11w_uuid('x1:entry'), 'en-US', 'public')))),
  jsonb_build_object('error', 'P0001:publication_not_active'),
  'a fresh observation of a revoked head is publication_not_active (the conflict check does not hide it) [P2-S11-AC-115]');
select is(pg_temp.h11l_rows('x1'), '1:publish:active:-,2:publish:active:S,3:unpublish:revoked:S', 'the refused observations wrote nothing [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": {"id": null}}', 'x1')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'an observation naming only an id is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": {"id": null, "version": "1"}}', 'x1')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'an absent id with a version (or the reverse) is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": {"id": null, "version": "0"}}', 'x1')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a version that is not a positive decimal is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": {"id": null, "version": null, "extra": 1}}', 'x1')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'an observation with an unknown member is INVALID_REQUEST [P2-S11-AC-114]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('x2', 'public', '{"expectedHead": "none"}', 'x1')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'an observation that is not an object is INVALID_REQUEST [P2-S11-AC-114]');

-- The caller may choose the audit and outbox ids of the row it appends (so an evidence summary can name them).
select pg_temp.h11w_revision('y1');
select pg_temp.h11l_review('y1');
create temp table h11l_y1(audit uuid, outbox uuid) on commit drop;
insert into h11l_y1 values (extensions.gen_random_uuid(), extensions.gen_random_uuid());
select is((pg_temp.h11l_append(pg_temp.h11l_publish('y1', 'public', jsonb_build_object(
    'auditEventId', (select audit from h11l_y1), 'outboxEventId', (select outbox from h11l_y1)))) ->> 'version'), '1',
  'an append accepts a caller-chosen audit event id and outbox event id [P2-S11-AC-116]');
select ok(
  exists (select 1 from audit_private.audit_events audit
           where audit.id = (select audit from h11l_y1) and audit.action = 'cms.publication.publish'
             and audit.target_id = (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('y1:entry')))
    and exists (select 1 from platform_private.outbox_events event
                 where event.id = (select outbox from h11l_y1) and event.event_type = 'cms.publication.changed.v1'),
  'the appended row''s audit record and event carry exactly the chosen ids [P2-S11-AC-116]');
select is(pg_temp.h11l_append(pg_temp.h11l_publish('y1', 'beta', '{"auditEventId": "not-a-uuid"}')), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a malformed audit event id is INVALID_REQUEST [P2-S11-AC-116]');

-- ---------------------------------------------------------------------------
-- Lock discipline and posture.
-- ---------------------------------------------------------------------------
select pg_temp.h11l_append(pg_temp.h11l_tombstone('sch', 'unpublish'));
select is(
  (select count(*)::integer from pg_catalog.pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
      and l.classid = (((pg_catalog.hashtextextended('cms.publication.lineage:' || pg_temp.h11w_uuid('sch:entry')::text || ':en-US:public', 0)) >> 32) & 4294967295)::oid
      and l.objid = ((pg_catalog.hashtextextended('cms.publication.lineage:' || pg_temp.h11w_uuid('sch:entry')::text || ':en-US:public', 0)) & 4294967295)::oid),
  1, 'the lineage advisory transaction lock (position 7) is held after the append [P2-S11-AC-115]');
select is(pg_temp.h11_text(format('select platform_private.cms_publication_lineage_lock(%L::uuid, %L, %L)', pg_temp.h11w_uuid('sch:entry'), 'en-US', 'public')), '',
  'taking the lock again in the same transaction is idempotent [P2-S11-AC-115]');
select is((select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'platform_private'
              and p.proname in ('cms_append_publication_lineage', 'cms_publication_lineage_lock', 'cms_publication_row_state')),
  3, 'exactly one overload of each lineage helper exists [P2-S11-AC-114]');

select * from finish();
rollback;
