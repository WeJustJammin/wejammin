-- Slice 11 dependency recheck, the locale-source consumer (BE03b "Review invalidation / Dependency
-- recheck", "Approval can never survive a changed dependency"; tracker P2-S11-AC-113; review B-01;
-- DEC-170).  The consumer of cms.localization.changed.v1 enqueues a recheck of the reviews whose
-- frozen manifest names the SOURCE revision of the changed locale variant.  That recheck was inert:
-- the source-stale producer (CMS-03C-04, 20260927450000) appends a `stale` variant row that COPIES the
-- previous row's source_revision_id and source_hash, so the rebuilt manifest was byte-equal to the
-- frozen one, and cms_manifest_identities_current never looked at localeSources.
--
-- DEC-170: a frozen locale-source identity { locale, revisionId, hash } is current only while the source
-- still serves exactly that revision and hash: the source revision exists in that locale with that
-- payload hash, the latest revision of that locale of the entry carries that hash (a different current
-- source hash makes it non-current), and no variant sourced from that revision and hash is marked
-- `stale` (a stale marking is never lifted, so a source edited and then reverted stays non-current).
-- A newer source revision with the SAME payload hash changes nothing (the producer's own rule).
--
-- RED before the in-place change of cms_manifest_identities_current (20261005017560), GREEN after.
-- Six approved reviews of fr-FR variants, each frozen from the real manifest with its dependency index
-- rows, each over its own entry whose en-US source the REAL producer then stales:
--   lr  source edited          -> the recheck job invalidates dependency_changed
--   lc  source untouched       -> control: the identity stays current, the run leaves the review alone
--   ln  newer source, same hash-> no stale marking, still current
--   lv  edited, then reverted  -> the hash is back but the stale marking stays: not current
--   lp  source edited          -> CMS-03B-09 refuses 409 version_set_stale and commits the invalidation
--   ls  source edited          -> CMS-03B-07 refuses 409 version_set_stale and commits the invalidation

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(32);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_publication/000-world.sqlinc

-- An approved review of the fr-FR variant revision <tag>: its entry <tag>-e has an en-US source revision
-- (r11_entry) and the variant revision (the entry's current draft), the variant row names the source
-- revision and its payload hash, and the review freezes the real manifest.  Returns the variant revision.
create or replace function pg_temp.lr_fixture(p_tag text)
returns uuid
language plpgsql
as $body$
declare
  entry_tag text := p_tag || '-e';
  source_revision uuid;
  variant_revision uuid;
  manifest jsonb;
  policy jsonb;
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  source_revision := pg_temp.r11_entry(entry_tag, 'creator', 'Source of ' || p_tag, '[]'::jsonb);
  variant_revision := pg_temp.h11w_revision(p_tag, 'creatorPerson', 'fr-FR', '[]'::jsonb, entry_tag, 2);
  insert into platform_private.cms_locale_variants(
    id, owner_id, state, version, entry_id, revision_id, source_revision_id,
    locale, source_locale, source_hash, created_by
  ) values (
    pg_temp.h11w_uuid(p_tag || ':variant'), pg_temp.h11w_org(), 'draft', 1,
    pg_temp.h11w_uuid(entry_tag || ':entry'), variant_revision, source_revision, 'fr-FR', 'en-US',
    (select revision.payload_hash from platform_private.cms_entry_revisions revision where revision.id = source_revision),
    (select value::uuid from s10_ids where key = 'creatorAuth'));
  manifest := pg_temp.r11_manifest(variant_revision);
  policy := manifest->'schema'->'workflowPolicy';
  perform pg_temp.h11r_review('rv-' || p_tag, jsonb_build_object(
    'revision_id', variant_revision, 'entry_id', pg_temp.h11w_uuid(entry_tag || ':entry'),
    'frozen_hash', (select revision.payload_hash from platform_private.cms_entry_revisions revision where revision.id = variant_revision),
    'dependency_manifest', manifest, 'dependency_hash', platform_private.cms_jcs_sha256(manifest),
    'activation_evidence', manifest->'schema'->'activationEvidence',
    'workflow_policy_key', policy->>'key', 'workflow_policy_version', (policy->>'version')::bigint,
    'workflow_policy_hash', policy->>'policyHash', 'risk_class', policy->>'riskClass',
    'required_decision_count', (policy->>'requiredDecisionCount')::integer,
    'required_capabilities', policy->'requiredCapabilities',
    'approval_evidence_hash', policy->>'approvalEvidenceHash',
    'submitted_by', pg_temp.s11_id('editor')));
  insert into platform_private.cms_editorial_review_dependencies(
    owner_id, state, version, review_id, kind, ref_id, created_at, updated_at)
  select pg_temp.h11w_org(), 'active', 1, pg_temp.s11_id('rv-' || p_tag), refs.kind, refs.ref_id, stamp, stamp
    from platform_private.cms_review_dependency_refs(variant_revision, manifest) refs;
  perform pg_temp.r11_assign_now('rv-' || p_tag || '-asg', 'rv-' || p_tag, 'rvA');
  perform pg_temp.r11_decide_now('rv-' || p_tag || '-dec', 'rv-' || p_tag, 'rvA', 'rv-' || p_tag || '-asg', 'approve');
  return variant_revision;
end;
$body$;

-- A source-locale (en-US) revision of the entry with an explicit payload hash.
create or replace function pg_temp.lr_source_revision(
  p_tag text, p_entry_tag text, p_number bigint, p_hash text
)
returns uuid
language plpgsql
as $body$
declare
  revision_uuid uuid := pg_temp.h11w_uuid(p_tag || ':revision');
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_revisions(
    id, owner_id, entry_id, revision_number, schema_version_id, template_version_id,
    taxonomy_version_ids, parent_revision_ids, locale, payload_hash, author_person_id,
    acting_party_id, state, version, validation_state, validation_report, created_at, updated_at
  ) values (
    revision_uuid, pg_temp.h11w_org(), pg_temp.h11w_uuid(p_entry_tag || ':entry'), p_number,
    pg_temp.h11w_version(), null, '[]'::jsonb, '[]'::jsonb, 'en-US', p_hash,
    pg_temp.h11w_person('creatorPerson'), pg_temp.h11w_org(), 'draft', 1, 'valid', '{}'::jsonb, stamp, stamp);
  -- The source-change fan-out now runs when a writer moves the draft head to the revision (20261014050310,
  -- after the revision values exist), not on the revision insert.  This fixture writes no values and moves no
  -- head (the entry version stays as the reviews froze it), so it runs the same real producer directly.
  perform platform_private.cms_stale_locale_dependents(revision_uuid, false);
  return revision_uuid;
end;
$body$;

-- '<status>/<identities current>' of the review of tag p_tag against today's canonical state.
create or replace function pg_temp.lr_state(p_tag text)
returns text
language plpgsql
as $body$
declare
  review platform_private.cms_editorial_reviews := pg_temp.p11_review(p_tag);
begin
  perform set_config('app.cms_rpc', 'true', true);
  return platform_private.cms_frozen_dependencies_status(review.revision_id, review.dependency_manifest)
    || '/' || platform_private.cms_manifest_identities_current(review.dependency_manifest)::text;
end;
$body$;

-- The review as 'state/reason/version'.
create or replace function pg_temp.lr_review(p_tag text)
returns text
language sql
stable
as $body$
  select review.state || '/' || coalesce(review.invalidated_reason, '-') || '/v' || review.version::text
    from platform_private.cms_editorial_reviews review where review.id = pg_temp.s11_id('rv-' || p_tag)
$body$;

-- One run of the recheck job over the reviews that froze the SOURCE revision of variant tag p_tag.
create or replace function pg_temp.lr_run(p_tag text, p_event uuid)
returns jsonb
language plpgsql
as $body$
begin
  return platform_private.cms_dependency_recheck_run(jsonb_build_object(
    'eventId', p_event, 'kind', 'locale_source', 'refId', pg_temp.h11w_uuid(p_tag || '-e:revision'),
    'cursor', null));
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

create or replace function pg_temp.lr_source_hash(p_tag text)
returns text
language sql
stable
as $body$
  select revision.payload_hash::text from platform_private.cms_entry_revisions revision
   where revision.id = pg_temp.h11w_uuid(p_tag || '-e:revision')
$body$;

select pg_temp.lr_fixture(t) from unnest(array['lr', 'lc', 'ln', 'lv', 'lp', 'ls']) t;

-- ---------------------------------------------------------------------------
-- Before any source changes: every review holds, and its manifest names its own source.
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(t || '=' || pg_temp.lr_review(t) || '|' || pg_temp.lr_state(t) || '|'
                       || jsonb_array_length((pg_temp.p11_review(t)).dependency_manifest->'localeSources')::text,
                     ',' order by t)
     from unnest(array['lr', 'lc', 'ln', 'lv', 'lp', 'ls']) t),
  'lc=approved/-/v2|current/true|1,ln=approved/-/v2|current/true|1,lp=approved/-/v2|current/true|1,'
  || 'lr=approved/-/v2|current/true|1,ls=approved/-/v2|current/true|1,lv=approved/-/v2|current/true|1',
  'precondition: six approved reviews of fr-FR variants, each frozen with one localeSources entry, all current [P2-S11-AC-113]');
select is(
  (select (pg_temp.p11_review('lr')).dependency_manifest->'localeSources'),
  jsonb_build_array(jsonb_build_object(
    'locale', 'en-US', 'revisionId', pg_temp.h11w_uuid('lr-e:revision'), 'hash', pg_temp.lr_source_hash('lr'))),
  'the frozen identity is { locale, revisionId, hash } of the source revision [P2-S11-AC-113]');
select is(
  (select array_agg(dependency.ref_id) from platform_private.cms_editorial_review_dependencies dependency
    where dependency.review_id = pg_temp.s11_id('rv-lr') and dependency.kind = 'locale_source'),
  array[pg_temp.h11w_uuid('lr-e:revision')],
  'the dependency index names the source revision under locale_source [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The real source changes: inserting a source revision fires the CMS-03C-04 producer.
-- ---------------------------------------------------------------------------
select pg_temp.r11_session('owner');
select pg_temp.h11w_revision(t || '-s2', 'creatorPerson', 'en-US', '[]'::jsonb, t || '-e', 3)
  from unnest(array['lr', 'lv', 'lp', 'ls']) t;
-- ln: a newer source revision with exactly the same payload hash (no stale marking).
select pg_temp.lr_source_revision('ln-s2', 'ln-e', 3, pg_temp.lr_source_hash('ln'));
-- lv: the source goes back to the hash the review froze.
select pg_temp.lr_source_revision('lv-s3', 'lv-e', 4, pg_temp.lr_source_hash('lv'));

select is(
  (select string_agg(t || '=' || (select count(*) from platform_private.cms_locale_variants variant
                                   where variant.revision_id = pg_temp.h11w_uuid(t || ':revision') and variant.state = 'stale')::text,
                     ',' order by t)
     from unnest(array['lr', 'lc', 'ln', 'lv', 'lp', 'ls']) t),
  'lc=0,ln=0,lp=1,lr=1,ls=1,lv=1',
  'the real producer appended one stale variant row for each edited source, none for the untouched and the same-hash ones [P2-S11-AC-113]');
select is(
  (select bool_and(variant.source_revision_id = pg_temp.h11w_uuid(t || '-e:revision')
                   and variant.source_hash::text = pg_temp.lr_source_hash(t))
     from unnest(array['lr', 'lv', 'lp', 'ls']) t
     join platform_private.cms_locale_variants variant
       on variant.revision_id = pg_temp.h11w_uuid(t || ':revision') and variant.state = 'stale'),
  true,
  'each stale row copies the source revision and hash of the row it follows [P2-S11-AC-113]');
select ok(
  platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('lr:revision')) = (pg_temp.p11_review('lr')).dependency_manifest
    and platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('lv:revision')) = (pg_temp.p11_review('lv')).dependency_manifest,
  'precondition: the rebuilt manifest of an edited, or edited and reverted, source equals the frozen manifest bit for bit, so only the currency of the identity can tell [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Currency of the frozen identity (DEC-170).
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(t || '=' || pg_temp.lr_state(t), ',' order by t) from unnest(array['lr', 'lc', 'ln', 'lv', 'lp', 'ls']) t),
  'lc=current/true,ln=current/true,lp=stale/false,lr=stale/false,ls=stale/false,lv=stale/false',
  'an edited source, and one edited then reverted to the frozen hash, make the frozen locale-source identity non-current; an untouched source and a newer revision with the same hash do not [P2-S11-AC-113]');
select is(
  (select string_agg(label || '=' || platform_private.cms_manifest_identities_current(manifest)::text, ',' order by label)
     from (values
       ('absent source', jsonb_set((pg_temp.p11_review('lc')).dependency_manifest, '{localeSources,0,revisionId}',
          to_jsonb('a9200000-0000-4000-8000-0000000fffe1'::text))),
       ('foreign hash', jsonb_set((pg_temp.p11_review('lc')).dependency_manifest, '{localeSources,0,hash}',
          to_jsonb(repeat('0', 64)))),
       ('other locale', jsonb_set((pg_temp.p11_review('lc')).dependency_manifest, '{localeSources,0,locale}', to_jsonb('de-DE'::text))),
       ('control', (pg_temp.p11_review('lc')).dependency_manifest)
     ) as probe(label, manifest)),
  'absent source=false,control=true,foreign hash=false,other locale=false',
  'a locale source that does not exist, carries another hash or is another locale is not current; the unchanged manifest is [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The recheck job: the consumer of cms.localization.changed.v1 resolves the source revision and the run
-- invalidates the reviews that froze it.
-- ---------------------------------------------------------------------------
create temp table lr_event on commit drop as
select event.id, event.correlation_id
  from platform_private.outbox_events event
 where event.event_type = 'cms.localization.changed.v1'
   and event.payload->>'revisionId' = pg_temp.h11w_uuid('lr:revision')::text;
select is((select count(*)::integer from lr_event), 1,
  'the producer committed one cms.localization.changed.v1 for the edited variant [P2-S11-AC-113]');
select is(
  platform_private.cms_dependency_recheck_event_ref((select id from lr_event)),
  jsonb_build_object('found', true, 'kind', 'locale_source', 'refId', pg_temp.h11w_uuid('lr-e:revision')),
  'the consumer resolves the event to the source revision the review froze, not to the variant revision [P2-S11-AC-113]');

select is(pg_temp.lr_run('lc', (select id from lr_event)),
  jsonb_build_object('examined', 1, 'invalidated', 0, 'nextCursor', null),
  'control: the run examines the review of the untouched source and invalidates nothing [P2-S11-AC-113]');
select is(pg_temp.lr_run('ln', (select id from lr_event)),
  jsonb_build_object('examined', 1, 'invalidated', 0, 'nextCursor', null),
  'a newer source revision with the same payload hash invalidates nothing [P2-S11-AC-113]');
select is(pg_temp.lr_review('lc') || ',' || pg_temp.lr_review('ln'), 'approved/-/v2,approved/-/v2',
  'the reviews that still hold are untouched [P2-S11-AC-113]');

select is(pg_temp.lr_run('lr', (select id from lr_event)),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'the run invalidates the review whose frozen source changed [P2-S11-AC-113]');
select is(pg_temp.lr_review('lr'), 'invalidated/dependency_changed/v3',
  'the approved review is invalidated dependency_changed at its next version [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-lr')
      and event.aggregate_version = 3 and event.correlation_id = (select correlation_id from lr_event))
  + (select count(*)::integer from audit_private.audit_events audit
      where audit.action = 'cms.entry.review.invalidate' and audit.target_id = pg_temp.s11_id('rv-lr')
        and audit.correlation_id = (select correlation_id from lr_event)),
  2,
  'the invalidation committed one review-changed event and one audit record carrying the correlation id of the source event [P2-S11-AC-113]');
select is(pg_temp.lr_run('lr', (select id from lr_event)),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'idempotent: a repeated run finds no live review [P2-S11-AC-113]');
select is(pg_temp.lr_run('lv', (select id from lr_event)),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'a source reverted to the frozen hash is still invalidated: the stale marking is never lifted [P2-S11-AC-113]');
select is(pg_temp.lr_review('lv'), 'invalidated/dependency_changed/v3',
  'the review of the reverted source is invalidated dependency_changed [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The commands: CMS-03B-09 (publish) and CMS-03B-07 (schedule) find the frozen identity non-current
-- before the preflight, commit the invalidation and answer the committed refusal version_set_stale.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('publish', 'pub', 'cms_publish_revision', pg_temp.p11_preq('lp'));
select ok(
  pg_temp.r11_out('publish') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('publish')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('publish')->>'kind' = 'refusal' and pg_temp.r11_resp('publish')->>'reasonCode' = 'version_set_stale'
    and pg_temp.r11_resp('publish')->'details' = '{}'::jsonb,
  'CMS-03B-09 over an edited locale source answers the committed refusal { kind refusal, reasonCode version_set_stale, details {} } [P2-S11-AC-113]');
select is(
  pg_temp.lr_review('lp') || '|lineage=' || (select count(*) from platform_private.cms_publication_versions
      where entry_id = pg_temp.h11w_uuid('lp-e:entry'))::text
    || '|review-events=' || (select count(*) from platform_private.outbox_events event
      where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-lp'))::text,
  'invalidated/dependency_changed/v3|lineage=0|review-events=1',
  'CMS-03B-09 committed the dependency_changed invalidation and appended no publication [P2-S11-AC-113]');

select pg_temp.p11_call('schedule', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('ls'));
select ok(
  pg_temp.r11_out('schedule') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('schedule')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('schedule')->>'kind' = 'refusal' and pg_temp.r11_resp('schedule')->>'reasonCode' = 'version_set_stale'
    and pg_temp.r11_resp('schedule')->'details' = '{}'::jsonb,
  'CMS-03B-07 over an edited locale source answers the committed refusal { kind refusal, reasonCode version_set_stale, details {} } [P2-S11-AC-113]');
select is(
  pg_temp.lr_review('ls') || '|schedules=' || (select count(*) from platform_private.cms_publication_schedules
      where revision_id = pg_temp.h11w_uuid('ls:revision'))::text,
  'invalidated/dependency_changed/v3|schedules=0',
  'CMS-03B-07 committed the dependency_changed invalidation and scheduled nothing [P2-S11-AC-113]');

select * from finish();
rollback;
