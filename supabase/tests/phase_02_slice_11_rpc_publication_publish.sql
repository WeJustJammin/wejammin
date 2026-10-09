-- Slice 11 lane S11-3b: platform_api.cms_publish_revision / platform_private (CMS-03B-09, E3 publication
-- lineage, E6 step-up, E11 separation of duties, DEC-156..159; tracker P2-S11-AC-029 .. AC-034, AC-048,
-- AC-107, AC-114 .. AC-116).  An owner-party publisher publishes a revision whose latest review is
-- approved: step-up, the approved review's version as the CAS operand, the frozen hash and the frozen
-- version set echoed back, frozen-dependency currency, the publish-phase preflight, then ONE lineage row
-- (append-only head), its audit record, exactly one cms.publication.changed.v1 and the completed
-- idempotency record in one transaction.  202 with projectionState `pending`: committed, not proof of
-- public visibility.  This file covers the contract, the committed effects, the lineage and replay; the
-- refusals are in phase_02_slice_11_rpc_publication_publish_refusals.sql.
-- RED before 20261005017720.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(29);

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

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.p11_approved(tag) from (values ('pa-main'), ('pa-lineage'), ('pa-step')) as t(tag);

select is(
  (select string_agg(tag || '=' || platform_private.cms_revision_effective_state(pg_temp.h11w_uuid(tag || ':revision'))
                      || '/' || (pg_temp.p11_review(tag)).state || '/' || (pg_temp.p11_review(tag)).version, ';' order by tag)
     from (values ('pa-main'), ('pa-lineage')) as t(tag)),
  'pa-lineage=approved/approved/2;pa-main=approved/approved/2',
  'control: every fixture revision is approved under an approved review at version 2');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(pg_temp.r11_posture('platform_private', 'cms_publish_revision(jsonb)'),
  'cms_publish_revision is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-034]');
select ok(pg_temp.r11_posture('platform_api', 'cms_publish_revision(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-034]');

-- ---------------------------------------------------------------------------
-- The first publication of a lineage: the committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('p1', pg_temp.p11_preq('pa-main'));
insert into r11_snap(label, effects) values ('before-p1', pg_temp.p11_effects());
select pg_temp.p11_call('p1', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'p1'));
select is(pg_temp.r11_out('p1'), '00000:', 'the owner-party publisher publishes an approved revision [P2-S11-AC-029]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('p1')),
  'action,audience,createdAt,entryId,eventType,id,locale,projectionState,publicationHash,publicationVersionId,revisionId,state,updatedAt,version',
  'the response is exactly PublicationResource (14 members) [P2-S11-AC-029]');
select ok(
  pg_temp.r11_resp('p1')->>'state' = 'active' and pg_temp.r11_resp('p1')->>'action' = 'publish'
    and pg_temp.r11_resp('p1')->>'version' = '1' and pg_temp.r11_resp('p1')->>'projectionState' = 'pending'
    and pg_temp.r11_resp('p1')->>'eventType' = 'cms.publication.changed.v1'
    and pg_temp.r11_resp('p1')->>'locale' = 'en-US' and pg_temp.r11_resp('p1')->>'audience' = 'public'
    and pg_temp.r11_resp('p1')->>'id' = pg_temp.r11_resp('p1')->>'publicationVersionId'
    and pg_temp.r11_resp('p1')->>'entryId' = pg_temp.h11w_uuid('pa-main:entry')::text
    and pg_temp.r11_resp('p1')->>'revisionId' = pg_temp.h11w_uuid('pa-main:revision')::text
    and pg_temp.r11_resp('p1')->>'publicationHash' ~ '^[a-f0-9]{64}$'
    and pg_temp.r11_resp('p1')->>'createdAt' = pg_temp.r11_resp('p1')->>'updatedAt',
  'the first row of a lineage is an active head at version 1 whose lineage id is its own id, with projectionState pending [P2-S11-AC-114]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('p1'), array[
    pg_temp.s11_id('pub')::text, pg_temp.s11_id('creator')::text, pg_temp.s11_id('editor')::text, pg_temp.s11_id('rvA')::text,
    pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'pub'),
    (pg_temp.p11_review('pa-main')).id::text]),
  'the response carries no publisher, author, submitter, reviewer, party, account or review identifier [P2-S11-AC-031]');
select ok(
  exists (
    select 1 from platform_private.cms_publication_versions row_item
     where row_item.id = (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid
       and row_item.publication_id = row_item.id and row_item.owner_id = pg_temp.s11_id('org')
       and row_item.entry_id = pg_temp.h11w_uuid('pa-main:entry') and row_item.revision_id = pg_temp.h11w_uuid('pa-main:revision')
       and row_item.state = 'active' and row_item.action = 'publish' and row_item.version = 1 and row_item.supersedes_id is null
       and row_item.locale = 'en-US' and row_item.audience = 'public' and row_item.schedule_id is null
       and row_item.publisher_person_id = pg_temp.s11_id('pub')
       and row_item.dependency_hash = (pg_temp.p11_review('pa-main')).dependency_hash
       and row_item.activation_evidence_hash = platform_private.cms_jcs_sha256((pg_temp.p11_review('pa-main')).activation_evidence)
       and row_item.version_set = platform_private.cms_revision_version_set(
             pg_temp.h11w_uuid('pa-main:revision'), (pg_temp.p11_review('pa-main')).dependency_manifest)
       and row_item.publication_hash = pg_temp.r11_resp('p1')->>'publicationHash'
       and row_item.revoked_at is null and row_item.activated_at is not null),
  'the lineage row stores the server-derived publisher, the review''s dependency hash and activation evidence hash, the frozen version set and the publication hash [P2-S11-AC-114]');
select ok(
  (select count(*) = 1 from platform_private.outbox_events event
    where event.event_type = 'cms.publication.changed.v1' and event.aggregate_type = 'cms_publication'
      and event.aggregate_id = (pg_temp.r11_resp('p1')->>'id')::uuid and event.aggregate_version = 1
      and event.payload = jsonb_build_object('entryId', pg_temp.h11w_uuid('pa-main:entry'),
            'publicationVersionId', (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid))
    and (select count(*) from platform_private.outbox_events where event_type = 'cms.publication.changed.v1') = 1,
  'exactly one identifier-only cms.publication.changed.v1 with the row id as publicationVersionId commits [P2-S11-AC-116]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.publication.publish' and audit.target_type = 'cms_publication_version'
      and audit.target_id = (pg_temp.r11_resp('p1')->>'publicationVersionId')::uuid
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'pub')
      and audit.reason_code = 'CMS_PUBLICATION_APPENDED'),
  'exactly one audit record commits with the lineage row [P2-S11-AC-034]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 'p1')), 'completed/202',
  'the idempotency reservation is completed with the 202 acceptance [P2-S11-AC-032]');
select ok(
  platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('pa-main:revision')) = 'published'
    and (pg_temp.p11_review('pa-main')).state = 'approved' and (pg_temp.p11_review('pa-main')).version = 2
    and (select count(*) = 0 from platform_private.cms_publication_schedules),
  'the revision is published (E2) while the review stays approved at its version; publishing creates no schedule [P2-S11-AC-114]');

-- ---------------------------------------------------------------------------
-- Replay and idempotency.
-- ---------------------------------------------------------------------------
insert into r11_snap(label, effects) values ('after-p1', pg_temp.p11_effects());
select pg_temp.p11_call('p1-replay', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'p1'));
select ok(pg_temp.r11_out('p1-replay') = '00000:' and pg_temp.r11_resp('p1-replay') = pg_temp.r11_resp('p1')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-p1')
    and current_setting('response.headers', true) = '[{"x-cms-idempotent-replay": "true"}]',
  'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no lineage row, audit record, event or reservation [P2-S11-AC-032]');
select pg_temp.p11_call('p1-fresh', 'pub', 'cms_publish_revision',
  jsonb_set((select request from r11_req where label = 'p1'), '{evidence}',
    pg_temp.r11_evidence(pg_temp.h11w_uuid('pa-main:revision'), 'healthy', interval '20 seconds')));
select ok(pg_temp.r11_out('p1-fresh') = '00000:' and pg_temp.r11_resp('p1-fresh') = pg_temp.r11_resp('p1')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'after-p1'),
  'a lost-response retry with the same key and a freshly evaluated accessibility proof is a replay, not an IDEMPOTENCY_MISMATCH [P2-S11-AC-032]');
select pg_temp.p11_call('p1-mismatch', 'pub', 'cms_publish_revision',
  jsonb_set((select request from r11_req where label = 'p1'), '{audience}', '"partners"'));
select is(pg_temp.r11_out('p1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH', 'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-032]');
select pg_temp.p11_call('p1-stale-replay', 'pub', 'cms_publish_revision',
  jsonb_set((select request from r11_req where label = 'p1'), '{context}', pg_temp.r11_ctx(interval '2 hours')));
select is(pg_temp.r11_out('p1-stale-replay'), 'P0001:STEP_UP_REQUIRED',
  'even a replay needs a fresh step-up proof (E6: evaluated before the reservation) [P2-S11-AC-048]');

-- ---------------------------------------------------------------------------
-- The lineage: a second publication supersedes by derivation, another audience is another lineage.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('l1', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pa-lineage'));
select pg_temp.p11_call('l2', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pa-lineage'));
select pg_temp.p11_call('l3', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pa-lineage', jsonb_build_object('audience', 'partners')));
select ok(
  pg_temp.r11_out('l1') = '00000:' and pg_temp.r11_out('l2') = '00000:' and pg_temp.r11_out('l3') = '00000:'
    and pg_temp.r11_resp('l2')->>'version' = '2' and pg_temp.r11_resp('l2')->>'id' = pg_temp.r11_resp('l1')->>'id'
    and pg_temp.r11_resp('l2')->>'publicationVersionId' <> pg_temp.r11_resp('l1')->>'publicationVersionId'
    and pg_temp.r11_resp('l2')->>'state' = 'active'
    and pg_temp.r11_resp('l3')->>'version' = '1' and pg_temp.r11_resp('l3')->>'id' <> pg_temp.r11_resp('l1')->>'id',
  'a second publish appends version 2 of the same lineage (stable id, new row id); another audience starts its own lineage at version 1 [P2-S11-AC-114]');
select ok(
  platform_private.cms_publication_row_state((pg_temp.r11_resp('l1')->>'publicationVersionId')::uuid) = 'superseded'
    and platform_private.cms_publication_row_state((pg_temp.r11_resp('l2')->>'publicationVersionId')::uuid) = 'active'
    and platform_private.cms_publication_row_state((pg_temp.r11_resp('l3')->>'publicationVersionId')::uuid) = 'active'
    and (select supersedes_id from platform_private.cms_publication_versions where id = (pg_temp.r11_resp('l2')->>'publicationVersionId')::uuid)
          = (pg_temp.r11_resp('l1')->>'publicationVersionId')::uuid,
  'the prior head is superseded by derivation (no row changed) and the successor names it [P2-S11-AC-115]');
select is((select count(*)::integer from platform_private.outbox_events
            where event_type = 'cms.publication.changed.v1' and aggregate_id in
              ((pg_temp.r11_resp('l1')->>'id')::uuid, (pg_temp.r11_resp('l3')->>'id')::uuid)),
  3, 'each appended row emitted exactly one cms.publication.changed.v1 (three rows, three events) [P2-S11-AC-116]');

-- Step-up edges (600 s window, 30 s skew).
select pg_temp.p11_call('u-edge', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pa-step', jsonb_build_object('context', pg_temp.r11_ctx(interval '590 seconds'))));
select is(pg_temp.r11_out('u-edge'), '00000:', 'a proof 590 s old is accepted [P2-S11-AC-048]');

select * from finish();
rollback;
