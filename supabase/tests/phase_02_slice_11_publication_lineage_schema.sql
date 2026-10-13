-- Slice 11 data model, lane S11-2: the append-only PublicationVersion lineage
-- (BE03b E3 "Publication lineage", Database Schema "PublicationVersion", Separation
-- of duties E11; tracker P2-S11-AC-114, AC-115, AC-116).  RED before
-- 20261005017080, GREEN after.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(49);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc

insert into s11_ids(key, value) values
  ('approvedA1', 'a9110000-0000-4000-8000-000000000301'),
  ('approvedA2', 'a9110000-0000-4000-8000-000000000302'),
  ('approvedB', 'a9110000-0000-4000-8000-000000000303'),
  ('pub1', 'a9110000-0000-4000-8000-000000000601'),
  ('pub2', 'a9110000-0000-4000-8000-000000000602'),
  ('pub3', 'a9110000-0000-4000-8000-000000000603'),
  ('pub4', 'a9110000-0000-4000-8000-000000000604'),
  ('memberA', 'a9110000-0000-4000-8000-000000000611'),
  ('memberB', 'a9110000-0000-4000-8000-000000000612');

-- Approved reviews: revision A1, revision A2 and revision B1 (entry B).
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('approvedA1')))));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('approvedA2'),
    'revision_id', pg_temp.s11_id('revA2')))));
select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_editorial_reviews',
  pg_temp.s11_review_row(jsonb_build_object('id', pg_temp.s11_id('approvedB'),
    'revision_id', pg_temp.s11_id('revB1'), 'entry_id', pg_temp.s11_id('entryB')))));
select pg_temp.s11_seed_review_update(format(
  'update platform_private.cms_editorial_reviews set state = ''approved'', recorded_decision_count = 1, decided_at = clock_timestamp(), version = 2, updated_at = clock_timestamp() where id in (%L, %L, %L)',
  pg_temp.s11_id('approvedA1'), pg_temp.s11_id('approvedA2'), pg_temp.s11_id('approvedB')));

-- A lineage row image whose publication_hash is the JCS SHA-256 of its own
-- members (BE03b E3), unless the override names another hash.
create or replace function pg_temp.s11_pub(p_overrides jsonb default '{}'::jsonb)
returns jsonb
language sql
as $body$
  select base
         || jsonb_build_object('publication_hash', platform_private.cms_jcs_sha256(
              jsonb_build_object(
                'action', base->'action', 'audience', base->'audience',
                'dependencyHash', base->'dependency_hash', 'entryId', base->'entry_id',
                'locale', base->'locale', 'publicationId', base->'publication_id',
                'revisionId', base->'revision_id', 'supersedesId', base->'supersedes_id',
                'version', base->'version', 'versionSet', base->'version_set')))
         || p_overrides
  from (select pg_temp.s11_publication_row(p_overrides) as base) as shaped
$body$;

create or replace function pg_temp.s11_pub_ins(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_outcome(pg_temp.s11_insert_sql('platform_private.cms_publication_versions', pg_temp.s11_pub(p_overrides)))
$body$;

create or replace function pg_temp.s11_pub_bare(p_overrides jsonb)
returns text
language sql
as $body$
  select pg_temp.s11_bare_outcome('platform_private.cms_publication_versions',
    pg_temp.s11_insert_sql('platform_private.cms_publication_versions', pg_temp.s11_pub(p_overrides)))
$body$;

-- A tombstone / successor image on top of pub1 (the default evidence is pub1's).
create or replace function pg_temp.s11_tomb(p_id text, p_version int, p_supersedes text, p_overrides jsonb default '{}'::jsonb)
returns jsonb
language sql
as $body$
  select jsonb_build_object('id', p_id::uuid, 'version', p_version, 'supersedes_id', p_supersedes::uuid,
    'state', 'revoked', 'action', 'unpublish', 'activated_at', null,
    'revoked_at', '2026-10-01T16:00:00Z'::timestamptz) || p_overrides
$body$;

-- ---------------------------------------------------------------------------
-- Shape.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.s10r_column_type('platform_private.cms_publication_versions', 'publication_id') = 'uuid'
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_versions', 'publication_id')
    and pg_temp.s10r_column_type('platform_private.cms_publication_versions', 'supersedes_id') = 'uuid'
    and not pg_temp.s10r_col_notnull('platform_private.cms_publication_versions', 'supersedes_id')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_versions', 'action')
    and not pg_temp.s10r_col_notnull('platform_private.cms_publication_versions', 'schedule_id')
    and pg_temp.s10r_col_notnull('platform_private.cms_publication_versions', 'publisher_person_id'),
  'lineage: the lineage id, predecessor, action, schedule and publisher columns exist [P2-S11-AC-114]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_state_check',
    array['active', 'revoked'])
    and pg_temp.s11_condef('platform_private.cms_publication_versions', 'cms_publication_versions_state_check') !~ 'superseded|pending'
    and pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_action_check',
      array['publish', 'unpublish', 'expire', 'archive']),
  'lineage: the physical state is active or revoked (superseded is derived) and the action is the closed four [P2-S11-AC-114]'
);

select ok(
  pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_lineage_version_key',
    array['UNIQUE (entry_id, locale, audience, version)'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_publication_version_key',
      array['UNIQUE (publication_id, version)'])
    and to_regclass('platform_private.cms_publication_versions_active_identity_unique') is null,
  'lineage: one row per lineage version replaces the one-active-row partial index [P2-S11-AC-115]'
);

select ok(
  pg_temp.s10r_fk_target('platform_private.cms_publication_versions', 'supersedes_id')
      = 'platform_private.cms_publication_versions.id'
    and pg_temp.s10r_fk_target('platform_private.cms_publication_versions', 'schedule_id')
      = 'platform_private.cms_publication_schedules.id'
    and pg_temp.s10r_fk_target('platform_private.cms_publication_versions', 'publisher_person_id')
      = 'platform_private.person_party.party_id'
    and pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_entry_owner_fkey',
      array['FOREIGN KEY (entry_id, owner_id)', 'cms_content_entries(id, owner_id)'])
    and pg_temp.s11_constraint_has('platform_private.cms_publication_versions', 'cms_publication_versions_revision_entry_fkey',
      array['FOREIGN KEY (revision_id, entry_id)', 'cms_entry_revisions(id, entry_id)']),
  'lineage: predecessor, schedule, publisher, entry owner and revision-of-entry are real references [P2-S11-AC-114]'
);

select ok(
  pg_temp.s11_index_has('platform_private.cms_publication_versions', 'cms_publication_versions_lineage_head_idx',
    array['(entry_id, locale, audience, version DESC)'])
    and pg_temp.s11_index_has('platform_private.cms_publication_versions', 'cms_publication_versions_schedule_idx',
      array['(schedule_id)', 'schedule_id IS NOT NULL']),
  'lineage: the head lookup and the schedule back-reference indexes exist [P2-S11-AC-115]'
);

-- ---------------------------------------------------------------------------
-- Constraints in isolation.
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_pub_bare('{}'::jsonb), '00000',
  'lineage: control - the first publish row image is accepted [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"state":"superseded"}'::jsonb), '23514',
  'lineage: superseded is derived and never stored [P2-S11-AC-115]');
select is(pg_temp.s11_pub_bare('{"state":"pending"}'::jsonb), '23514',
  'lineage: pending is not a physical publication state [P2-S11-AC-115]');
select is(pg_temp.s11_pub_bare('{"state":"revoked","revoked_at":"2026-10-01T16:00:00Z","activated_at":null}'::jsonb), '23514',
  'lineage: a publish row is active, never revoked [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"action":"unpublish"}'::jsonb), '23514',
  'lineage: a tombstone action is revoked, never active [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"activated_at":null}'::jsonb), '23514',
  'lineage: an active row records when it was activated [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"revoked_at":"2026-10-01T16:00:00Z"}'::jsonb), '23514',
  'lineage: an active row records no revocation [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"state":"revoked","action":"expire","activated_at":null}'::jsonb), '23514',
  'lineage: a revoked row records when it was revoked [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"version":2}'::jsonb), '23514',
  'lineage: only the first row of a lineage has no predecessor [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare(jsonb_build_object('version', 2, 'supersedes_id', pg_temp.s11_id('pub1'),
    'id', pg_temp.s11_id('pub1'))), '23514',
  'lineage: a row never supersedes itself [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"audience":"Public"}'::jsonb), '23514',
  'lineage: the audience follows ^[a-z0-9_-]{1,48}$ (E4) [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare(jsonb_build_object('audience', repeat('a', 49))), '23514',
  'lineage: the audience is at most 48 characters [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare('{"settings_version":0}'::jsonb), '23514',
  'lineage: the settings snapshot ordinal is positive [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare(jsonb_build_object('revision_id', pg_temp.s11_id('revB1'))), '23503',
  'lineage: a revision of another entry cannot be published under this entry [P2-S11-AC-114]');
select is(pg_temp.s11_pub_bare(jsonb_build_object('owner_id', pg_temp.s11_id('stranger'))), '23503',
  'lineage: the owner is the entry owner, never another party [P2-S11-AC-114]');

-- ---------------------------------------------------------------------------
-- Append guard (triggers enabled).
-- ---------------------------------------------------------------------------
select is(
  (select r->>'publication_hash'
     from (select pg_temp.s11_pub('{}'::jsonb) as r) as shaped),
  encode(sha256(convert_to(format(
    '{"action":"publish","audience":"public","dependencyHash":"%s","entryId":"%s","locale":"en-US","publicationId":"%s","revisionId":"%s","supersedesId":null,"version":1,"versionSet":{"settingsVersion":1}}',
    pg_temp.s11_hex('s11-dependency'), pg_temp.s11_id('entryA'), pg_temp.s11_id('pub1'), pg_temp.s11_id('revA1')),
    'UTF8')), 'hex'),
  'lineage: control - the fixture hash equals the SHA-256 of the hand-written canonical JSON (sorted keys, null predecessor) [P2-S11-AC-116]'
);
select is(pg_temp.s11_pub_ins(jsonb_build_object('publication_hash', pg_temp.s11_hex('not the publication hash'))),
  'P0001:VALIDATION_FAILED', 'lineage: the stored publication hash is recomputed from the row [P2-S11-AC-116]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('publication_id', pg_temp.s11_id('pub2'))),
  'P0001:VALIDATION_FAILED', 'lineage: the lineage id of a first row is its own id [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('locale', 'fr-FR')),
  'P0001:VALIDATION_FAILED', 'lineage: the lineage locale is the revision locale [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('state', 'revoked', 'action', 'unpublish',
    'activated_at', null, 'revoked_at', '2026-10-01T16:00:00Z'::timestamptz)),
  'P0001:VALIDATION_FAILED', 'lineage: a lineage cannot begin with a tombstone [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('publisher_person_id', pg_temp.s11_id('creator'))),
  'P0001:separation_of_duties', 'lineage: the author of the revision never publishes it (E11) [P2-S11-AC-107]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('revision_id', pg_temp.s11_id('revA2'),
    'dependency_hash', pg_temp.s11_hex('a different dependency set'))),
  'P0001:CONFLICT', 'lineage: only an approved review with the same dependency hash can be published [P2-S11-AC-114]');
select pg_temp.s11_archive_entry(pg_temp.s11_id('entryB'));
select is(pg_temp.s11_pub_ins(jsonb_build_object('entry_id', pg_temp.s11_id('entryB'),
    'revision_id', pg_temp.s11_id('revB1'), 'publication_id', pg_temp.s11_id('pub1'))),
  'P0001:entry_unavailable', 'lineage: a publish row is not appended for an entry that is no longer active [P2-S11-AC-114]');

select is(pg_temp.s11_pub_ins('{}'::jsonb), '00000',
  'lineage: the first publish row opens the lineage at version 1 [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('id', pg_temp.s11_id('pub4'), 'publication_id', pg_temp.s11_id('pub4'))),
  '23505', 'lineage: a second lineage for the same entry, locale and audience is refused by the lineage key [P2-S11-AC-115]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('id', pg_temp.s11_id('pub4'), 'publication_id', pg_temp.s11_id('pub4'),
    'audience', 'staff')), '00000',
  'lineage: another audience is another lineage [P2-S11-AC-115]');

select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000602', 3, 'a9110000-0000-4000-8000-000000000601')),
  'P0001:CONFLICT', 'lineage: a successor continues the sequence with the previous version + 1 [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000602', 2, 'a9110000-0000-4000-8000-000000000601',
    jsonb_build_object('audience', 'staff'))),
  'P0001:CONFLICT', 'lineage: a successor stays in the lineage of its predecessor [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000602', 2, 'a9110000-0000-4000-8000-000000000601',
    jsonb_build_object('revision_id', pg_temp.s11_id('revA2')))),
  'P0001:VALIDATION_FAILED', 'lineage: a tombstone copies the ended row''s revision and evidence [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000602', 2, 'a9110000-0000-4000-8000-000000000601',
    jsonb_build_object('settings_version', 2))),
  'P0001:VALIDATION_FAILED', 'lineage: a tombstone copies the settings ordinal too [P2-S11-AC-114]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000602', 2, 'a9110000-0000-4000-8000-000000000601')),
  '00000', 'lineage: an unpublish of the active head appends one revoked tombstone [P2-S11-AC-115]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000603', 3, 'a9110000-0000-4000-8000-000000000602',
    jsonb_build_object('action', 'expire'))),
  'P0001:publication_not_active', 'lineage: expiry, archive and unpublish need an active head [P2-S11-AC-115]');
select is(pg_temp.s11_pub_ins(pg_temp.s11_tomb('a9110000-0000-4000-8000-000000000603', 2, 'a9110000-0000-4000-8000-000000000601',
    jsonb_build_object('action', 'expire'))),
  'P0001:publication_conflict', 'lineage: a successor of a row that is no longer the head loses with publication_conflict [P2-S11-AC-115]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('id', pg_temp.s11_id('pub3'), 'version', 3,
    'supersedes_id', pg_temp.s11_id('pub2'), 'revision_id', pg_temp.s11_id('revA2'))),
  '00000', 'lineage: a revoked lineage is published again with a new head row [P2-S11-AC-115]');

-- A publish that follows an active head supersedes it by derivation.
select is(pg_temp.s11_pub_ins(jsonb_build_object('id', pg_temp.s11_id('memberA'),
    'publication_id', pg_temp.s11_id('memberA'), 'audience', 'members')), '00000',
  'lineage: the members lineage opens at version 1 [P2-S11-AC-115]');
select is(pg_temp.s11_pub_ins(jsonb_build_object('id', pg_temp.s11_id('memberB'),
    'publication_id', pg_temp.s11_id('memberA'), 'audience', 'members', 'version', 2,
    'supersedes_id', pg_temp.s11_id('memberA'), 'revision_id', pg_temp.s11_id('revA2'))), '00000',
  'lineage: a publish after an active head appends the next head row; the earlier row is superseded by derivation [P2-S11-AC-115]');
select is(
  (select string_agg(version::text || ':' || state, ',' order by version)
     from platform_private.cms_publication_versions
    where publication_id = pg_temp.s11_id('pub1')),
  '1:active,2:revoked,3:active',
  'lineage: physical rows stay active/revoked; the sequence is 1, 2, 3 with no gap [P2-S11-AC-115]'
);

-- ---------------------------------------------------------------------------
-- Append-only.
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_outcome(format(
    'update platform_private.cms_publication_versions set revoked_at = clock_timestamp() where id = %L', pg_temp.s11_id('pub1'))),
  'P0001:IMMUTABLE_RECORD', 'lineage: a prior row is never updated, supersession is derived [P2-S11-AC-114]');
select is(pg_temp.s11_outcome(format(
    'delete from platform_private.cms_publication_versions where id = %L', pg_temp.s11_id('pub1'))),
  'P0001:IMMUTABLE_RECORD', 'lineage: a prior row is never deleted [P2-S11-AC-114]');

select * from finish();
rollback;
