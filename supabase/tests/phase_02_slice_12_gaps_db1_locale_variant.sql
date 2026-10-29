-- Slice 12 gap lane claude_s12_gaps_db1: CMS-03C-04 locale variant authoring.
--   P2-S12-AC-033 clause 2 / AC-055 clause 2  `sourceRevisionId` must EXIST and be readable by the caller: a revision that
--                           exists but belongs to an entry the caller cannot read (or to another entry) is the concealed
--                           NOT_FOUND (404 LOCALE_SOURCE_NOT_FOUND) with no effect (BE03c 382-388).
--   P2-S12-AC-056 clause 9  "answers a changed actor": a stored key replayed by a DIFFERENT server-resolved actor never
--                           replays the first actor's response; the reservation is bound to the actor (BE03c 149, 1671).
-- Fixture: the Slice 10 RPC world plus two direct guarded entry+revision inserts under app.cms_rpc (the way the Slice 10
-- fixture itself seeds its entry): one entry of the caller's own organization and one owned by another party.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc

select pg_temp.s10_rpc_as((select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- An active, compiled content type with an active version owned by p_owner (the foreign party), built like the Slice 12
-- block fixture builds one: inserted retired, a draft version and its artifact, then the two state updates the guards allow.
create or replace function pg_temp.gl_type(p_owner uuid) returns uuid language plpgsql as $body$
declare
  type_id uuid := 'a9123000-0000-4000-8000-000000000301';
  version_id uuid := 'a9123000-0000-4000-8000-000000000302';
  artifact_id uuid := 'a9123000-0000-4000-8000-000000000303';
  creator uuid := (select value::uuid from s10_ids where key = 'creatorAuth');
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_content_types(id, owner_id, state, type_key, owner_capability, created_by)
  values (type_id, p_owner, 'retired', 'gaplocaleforeign', 'cms.schema_designer', creator);
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, content_type_id, version_no, labels, workflow_key, workflow_version,
    source_locale, default_locale, supported_locales, fallback_chains, locale_config_hash,
    schema_artifact_id, definition_hash, compatibility, created_by)
  values (version_id, p_owner, 'draft', type_id, 1, '{}'::jsonb, 'editorial', 1, 'en-US', 'en-US', '["en-US"]'::jsonb,
    '{}'::jsonb, '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860', artifact_id,
    encode(extensions.digest('gap-locale-def', 'sha256'), 'hex'), 'additive', creator);
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, content_type_version_id, compiler_version, zod_contract_ref, editor_manifest,
    renderer_manifest, artifact_hash, compiled_at)
  values (artifact_id, p_owner, version_id, '1', 'cms/s12-gap-locale', '{}'::jsonb,
    jsonb_build_object('relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb),
    encode(extensions.digest('gap-locale-art', 'sha256'), 'hex'), clock_timestamp());
  update platform_private.cms_content_type_versions
     set state = 'active', version = version + 1,
         activation_workflow_policy_key = 'cms.entry.author', activation_workflow_policy_version = 1,
         activation_workflow_policy_hash = repeat('a', 64), activation_required_decision_count = 1,
         activation_required_capabilities = jsonb_build_array('cms.author'),
         activation_approval_evidence_hash = repeat('b', 64), updated_at = clock_timestamp()
   where id = version_id;
  update platform_private.cms_content_types
     set state = 'active', version = version + 1, updated_at = clock_timestamp() where id = type_id;
  return version_id;
end;
$body$;

-- A second entry with one en-US revision, owned by p_owner (the org for the readable case, a person party for the foreign one).
create or replace function pg_temp.gl_entry(p_n integer, p_owner uuid, p_version uuid, p_type uuid) returns uuid language plpgsql as $body$
declare
  entry_id uuid := ('a9123000-0000-4000-8000-0000000001' || lpad(p_n::text, 2, '0'))::uuid;
  revision_id uuid := ('a9123000-0000-4000-8000-0000000002' || lpad(p_n::text, 2, '0'))::uuid;
  stamp timestamptz := timestamptz '2026-09-26T12:00:00Z';
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_content_entries(
    id, owner_id, content_type_id, owner_party_id, lifecycle, current_draft_revision_id, version, created_by, created_at, updated_at)
  values (entry_id, p_owner, p_type, p_owner, 'active', null, 1,
    (select value::uuid from s10_ids where key = 'creatorAuth'), stamp, stamp);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id, template_version_id, taxonomy_version_ids,
    parent_revision_ids, locale, payload_hash, author_person_id, acting_party_id, state, version,
    validation_state, validation_report, created_at, updated_at)
  values (revision_id, p_owner, entry_id, 1, p_version, null,
    '[]'::jsonb, '[]'::jsonb, 'en-US',
    platform_private.cms_jcs_sha256(jsonb_build_object(pg_temp.l12_field('typeFieldId')::text, 'Other entry title'))::char(64),
    (select value::uuid from s10_ids where key = 'creatorPerson'), p_owner, 'draft', 1, 'valid', '{}'::jsonb, stamp, stamp);
  update platform_private.cms_content_entries set current_draft_revision_id = revision_id where id = entry_id;
  return revision_id;
end;
$body$;
create temp table gl_rev(key text primary key, id uuid not null) on commit drop;
insert into gl_rev values
  ('own-other-entry', pg_temp.gl_entry(1, (select value::uuid from s10_ids where key = 'organization'),
    (select value::uuid from s10_ids where key = 'draftVersionId'), (select value::uuid from s10_ids where key = 'typeId'))),
  ('foreign-entry', pg_temp.gl_entry(2, (select value::uuid from s10_ids where key = 'strangerPerson'),
    pg_temp.gl_type((select value::uuid from s10_ids where key = 'strangerPerson')), 'a9123000-0000-4000-8000-000000000301'));
select ok(
  (select e.owner_party_id = (select value::uuid from s10_ids where key = 'strangerPerson')
     from platform_private.cms_entry_revisions r join platform_private.cms_content_entries e on e.id = r.entry_id
    where r.id = (select id from gl_rev where key = 'foreign-entry'))
  and (select e.owner_party_id = (select value::uuid from s10_ids where key = 'organization')
     from platform_private.cms_entry_revisions r join platform_private.cms_content_entries e on e.id = r.entry_id
    where r.id = (select id from gl_rev where key = 'own-other-entry')),
  'control: one existing revision belongs to an entry of another party, one to a second entry of the caller''s own organization [P2-S12-AC-033]');

create temp table gl_before on commit drop as
select (select count(*) from platform_private.cms_locale_variants) as variants,
       (select count(*) from platform_private.cms_entry_revisions) as revisions,
       (select count(*) from platform_private.outbox_events) as events,
       (select count(*) from audit_private.audit_events) as audits,
       (select count(*) from platform_private.idempotency_records) as reservations,
       (select version from platform_private.cms_content_entries where id = pg_temp.l12_entry()) as entry_version;

select is(
  pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)',
    pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('x'), 'gap-src-foreign-0001',
      jsonb_build_object('sourceRevisionId', (select id from gl_rev where key = 'foreign-entry')))::text)),
  'P0001:NOT_FOUND',
  'a source revision that EXISTS but belongs to an entry the caller cannot read is the concealed NOT_FOUND [P2-S12-AC-033]');
select is(
  pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)',
    pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('x'), 'gap-src-own-other-0002',
      jsonb_build_object('sourceRevisionId', (select id from gl_rev where key = 'own-other-entry')))::text)),
  'P0001:NOT_FOUND',
  'a readable revision of another entry is not a source for this entry: the same concealed NOT_FOUND [P2-S12-AC-055]');
select is(
  pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)',
    pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('x'), 'gap-src-absent-0003',
      jsonb_build_object('sourceRevisionId', extensions.gen_random_uuid()))::text)),
  'P0001:NOT_FOUND', 'control: an absent source revision is the same outcome [P2-S12-AC-055]');
select is(
  coalesce(pg_temp.l12_detail(format('select platform_api.cms_author_locale_variant(%L::jsonb)',
    pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('x'), 'gap-src-foreign-0004',
      jsonb_build_object('sourceRevisionId', (select id from gl_rev where key = 'foreign-entry')))::text)),
  ''), '', 'the concealed refusal carries no DETAIL that could reveal the foreign revision [P2-S12-AC-055]');
select ok(
  (select (select count(*) from platform_private.cms_locale_variants) = variants
      and (select count(*) from platform_private.cms_entry_revisions) = revisions
      and (select count(*) from platform_private.outbox_events) = events
      and (select count(*) from audit_private.audit_events) = audits
      and (select count(*) from platform_private.idempotency_records) = reservations
      and (select version from platform_private.cms_content_entries where id = pg_temp.l12_entry()) = entry_version
   from gl_before),
  'the unreadable-source refusals leave no variant, revision, event, audit or reservation and keep the entry version [P2-S12-AC-033]');
create temp table gl_req on commit drop as
select pg_temp.l12_req('fr-FR', pg_temp.l12_title_field('Titre'), 'gap-src-ok-0005') as request;
create temp table gl_ok on commit drop as
select pg_temp.l12_author(request) as response from gl_req;
select ok((select response->>'state' = 'draft' and response->>'locale' = 'fr-FR' from gl_ok),
  'control: the same request over the entry''s own readable source revision authors the draft [P2-S12-AC-033]');

-- ------------------------------------------------------------------------------------------- AC-056 clause 9 --
-- The creator committed 'gap-src-ok-0005'.  The editor (a different server-resolved actor, assigned to the same entry) sends
-- the identical request bytes under the same Idempotency-Key.
create temp table gl_replay on commit drop as
select (select version from platform_private.cms_content_entries where id = pg_temp.l12_entry()) as entry_version_now,
       (request->>'expectedVersion')::bigint as sent_version from gl_req;
select pg_temp.s10_rpc_as((select value::uuid from s10_ids where key = 'editorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
create temp table gl_editor on commit drop as
select pg_temp.l12_try(format('select platform_api.cms_author_locale_variant(%L::jsonb)', request::text)) as outcome from gl_req;
select diag('editor replay outcome: ' || (select outcome from gl_editor) || ' entry_version_now=' || (select entry_version_now from gl_replay) || ' sent=' || (select sent_version from gl_replay));
select ok(
  (select entry_version_now > sent_version from gl_replay)
  and (select outcome = 'P0001:VERSION_MISMATCH' and outcome <> (select response::text from gl_ok) from gl_editor),
  'a different actor sending the creator''s key and body is never served the creator''s stored response: it is the 409 VERSION_MISMATCH of the now-stale entry version [P2-S12-AC-056]');
select ok(
  (select count(*) = 1 from platform_private.idempotency_records
    where operation = 'CMS-03C-04' and key_hash = platform_private.cms_key_hash('gap-src-ok-0005')
      and actor_id = (select value::uuid from s10_ids where key = 'creatorAuth'))
  and (select count(*) = 0 from platform_private.idempotency_records
        where operation = 'CMS-03C-04' and key_hash = platform_private.cms_key_hash('gap-src-ok-0005')
          and actor_id = (select value::uuid from s10_ids where key = 'editorAuth')),
  'the creator''s reservation is untouched and the refused editor attempt reserved nothing: the key is bound to the actor [P2-S12-AC-056]');

select finish();
rollback;
