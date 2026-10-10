-- Slice 11 lane S11-3b: cms_publish_revision refusals (CMS-03B-09; tracker P2-S11-AC-030 .. AC-033,
-- AC-048, AC-097, AC-101, AC-102, AC-107, DEC-157, DEC-159).  Order of the evaluation: structure ->
-- step-up -> concealment (404) -> capability and separation (403) -> the reservation (replay) -> the
-- approved review's CAS operand (VERSION_MISMATCH) and state (CONFLICT) -> the frozen hash (422) and the
-- frozen version set (409 version_set_stale) -> frozen-dependency currency (a stale manifest COMMITS the
-- review invalidation dependency_changed and answers the committed-refusal envelope 409 version_set_stale,
-- BE03b E1) -> the publish-phase preflight (a counted approver whose standing grant lapsed is found lazily by
-- the revocation category: that COMMITS the reviewer_authority_changed invalidation and cancels the review's
-- pending schedules, BE03b Review invalidation).  Every raised refusal leaves no partial effect.
-- RED before 20261005017720.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(36);

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

create temp table r11_snap(label text primary key, effects text not null) on commit drop;

create or replace function pg_temp.p11_drift(p_tag text, p_target_tag text)
returns void
language plpgsql
as $body$
declare
  target_revision uuid := pg_temp.h11w_revision(p_target_tag);
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform pg_temp.h11w_relation(pg_temp.h11w_uuid(p_tag || ':revision'), 'rel_omit',
    (select revision_item.entry_id from platform_private.cms_entry_revisions revision_item where revision_item.id = target_revision), 1);
end;
$body$;

select pg_temp.p11_approved(tag) from (values ('pr-main'), ('pr-cas'), ('pr-hash'), ('pr-set'), ('pr-pre'), ('pr-evi'), ('pr-dep'),
  ('pr-grant'), ('pr-media')) as t(tag);
select pg_temp.p11_approved('pr-author', 'pub');
select pg_temp.p11_approved('pr-rejected', 'creator', '{}'::jsonb, '[]'::jsonb, 'reject');
select pg_temp.p11_approved('pr-open', 'creator', '{}'::jsonb, '[]'::jsonb, 'none');
select pg_temp.p11_approved('pr-invalid');
select pg_temp.p11_approved('pr-other');
-- A pending schedule of the review whose counted approver will lapse (cancelled by the lazy invalidation).
select pg_temp.p11_schedule_row('s-pr-grant', 'pr-grant');
select pg_temp.r11_entry('pr-none');
select pg_temp.h11w_value(pg_temp.h11w_uuid('pr-media:revision'), 'hero', jsonb_build_object('assetId', 'a9200000-0000-4000-8000-0000000000a1', 'assetVersion', '1'));
select platform_private.cms_invalidate_editorial_review(jsonb_build_object(
  'reviewId', pg_temp.s11_id('rv-pr-invalid'), 'reasonCode', 'revision_superseded', 'correlationId', extensions.gen_random_uuid()));
select pg_temp.p11_drift('pr-dep', 'pr-dep-target');

select ok(
  (pg_temp.p11_review('pr-main')).state = 'approved' and (pg_temp.p11_review('pr-rejected')).state = 'rejected'
    and (pg_temp.p11_review('pr-open')).state = 'open' and (pg_temp.p11_review('pr-invalid')).state = 'invalidated'
    and platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('pr-dep:revision'), (pg_temp.p11_review('pr-dep')).dependency_manifest) = 'stale'
    and platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('pr-main:revision'), (pg_temp.p11_review('pr-main')).dependency_manifest) = 'current',
  'control: approved, rejected, open and invalidated reviews exist, pr-dep has a stale frozen manifest and pr-main a current one');

insert into r11_snap(label, effects) values ('start', pg_temp.p11_effects());

-- ---------------------------------------------------------------------------
-- Structure.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('x-action', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('action', 'publish')), false);
select pg_temp.p11_call('x-audience-missing', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', '{}'::jsonb, array['audience']), false);
select pg_temp.p11_call('x-set-missing', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', '{}'::jsonb, array['expectedVersionSet']), false);
select pg_temp.p11_call('x-entry', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('entryId', 'nope')), false);
select pg_temp.p11_call('x-revision', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('revisionId', 7)), false);
select pg_temp.p11_call('x-agree', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('ifMatch', '3')), false);
select pg_temp.p11_call('x-evidence', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('evidence', 'healthy')), false);
select is(
  pg_temp.r11_out('x-action') || '|' || pg_temp.r11_out('x-audience-missing') || '|' || pg_temp.r11_out('x-set-missing') || '|'
    || pg_temp.r11_out('x-entry') || '|' || pg_temp.r11_out('x-revision') || '|' || pg_temp.r11_out('x-agree') || '|' || pg_temp.r11_out('x-evidence'),
  'P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST',
  'an unknown key (action), a missing member, malformed ids, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-030]');
select pg_temp.p11_call('v-hash', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('frozenHash', 'ABC')), false);
select pg_temp.p11_call('v-set', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('expectedVersionSet', '{"schemaVersionId":"x"}'::jsonb)), false);
select pg_temp.p11_call('v-set-type', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('expectedVersionSet', '[]'::jsonb)), false);
select pg_temp.p11_call('v-audience', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('audience', 'Public Site')), false);
select pg_temp.p11_call('v-version', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('expectedVersion', '0', 'ifMatch', '0')), false);
select pg_temp.p11_call('v-ifmatch', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('ifMatch', 'W/"2"')), false);
select pg_temp.p11_call('v-many', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('frozenHash', '', 'audience', '')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('v-hash'), ('v-set'), ('v-set-type'), ('v-audience'), ('v-version'), ('v-ifmatch')) as v(label)),
  'v-audience=P0001:VALIDATION_FAILED["/audience"];v-hash=P0001:VALIDATION_FAILED["/frozenHash"];v-ifmatch=P0001:VALIDATION_FAILED["/ifMatch"];'
  || 'v-set=P0001:VALIDATION_FAILED["/expectedVersionSet"];v-set-type=P0001:VALIDATION_FAILED["/expectedVersionSet"];'
  || 'v-version=P0001:VALIDATION_FAILED["/expectedVersion", "/ifMatch"]',
  'every invalid field is VALIDATION_FAILED at its RFC 6901 pointer: frozenHash, the version set shape, the audience grammar, expectedVersion and If-Match [P2-S11-AC-030]');
select is(pg_temp.r11_detail('v-many')::jsonb, '["/frozenHash","/audience"]'::jsonb,
  'several invalid fields are reported together, in request order [P2-S11-AC-030]');

-- ---------------------------------------------------------------------------
-- Step-up (E6).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('t-stale', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select pg_temp.p11_call('t-future', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '-120 seconds'))), false);
select pg_temp.p11_call('t-unverified', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', false))), false);
select pg_temp.p11_call('t-absent', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('context', jsonb_build_object('actingPartyId', pg_temp.s11_id('org')))), false);
select pg_temp.p11_call('t-hidden', 'stranger', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select is(
  pg_temp.r11_out('t-stale') || '|' || pg_temp.r11_out('t-future') || '|' || pg_temp.r11_out('t-unverified') || '|' || pg_temp.r11_out('t-absent')
    || '|' || pg_temp.r11_out('t-hidden'),
  'P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED',
  'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-048]');

-- ---------------------------------------------------------------------------
-- Concealment (404) and the capability gate (403).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('c-stranger', 'stranger', 'cms_publish_revision', pg_temp.p11_preq('pr-main'), false);
select pg_temp.p11_call('c-outsider', 'outsider', 'cms_publish_revision', pg_temp.p11_preq('pr-main'), false);
select pg_temp.p11_call('c-absent', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-main', jsonb_build_object('revisionId', extensions.gen_random_uuid())), false);
select pg_temp.p11_call('c-foreign-entry', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-main', jsonb_build_object('entryId', pg_temp.h11w_uuid('pr-other:entry'))), false);
select ok(
  pg_temp.r11_out('c-stranger') = 'P0001:NOT_FOUND' and pg_temp.r11_out('c-outsider') = pg_temp.r11_out('c-stranger')
    and pg_temp.r11_out('c-absent') = pg_temp.r11_out('c-stranger') and pg_temp.r11_out('c-foreign-entry') = pg_temp.r11_out('c-stranger')
    and pg_temp.r11_detail('c-stranger') is not distinct from pg_temp.r11_detail('c-outsider')
    and pg_temp.r11_detail('c-stranger') is not distinct from pg_temp.r11_detail('c-absent')
    and pg_temp.r11_detail('c-stranger') is not distinct from pg_temp.r11_detail('c-foreign-entry'),
  'a non-member, a member with no scope, an absent revision and a revision of another entry are the same byte-identical NOT_FOUND [P2-S11-AC-031]');
select pg_temp.p11_call('c-editor', 'editor', 'cms_publish_revision', pg_temp.p11_preq('pr-main'), false);
select pg_temp.p11_call('c-reviewer', 'rvA', 'cms_publish_revision', pg_temp.p11_preq('pr-main'), false);
select pg_temp.p11_call('c-owner', 'owner', 'cms_publish_revision', pg_temp.p11_preq('pr-main'), false);
select is(pg_temp.r11_out('c-editor') || '|' || pg_temp.r11_out('c-reviewer') || '|' || pg_temp.r11_out('c-owner'),
  'P0001:capability_missing|P0001:capability_missing|P0001:capability_missing',
  'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]');
select pg_temp.p11_call('c-separation', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-author'), false);
select is(pg_temp.r11_out('c-separation'), 'P0001:separation_of_duties',
  'the human who authored the revision cannot publish it (E11) [P2-S11-AC-107]');

-- ---------------------------------------------------------------------------
-- The review operand and state, the frozen hash and the frozen version set.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('r-stale', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-cas', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1')), false);
select ok(pg_temp.r11_out('r-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('r-stale')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb,
  'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-032]');
select pg_temp.p11_call('r-invalidated-stale', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-invalid', jsonb_build_object('expectedVersion', '2', 'ifMatch', '2')), false);
select ok(pg_temp.r11_out('r-invalidated-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('r-invalidated-stale')::jsonb = '{"expectedVersion":"2","currentVersion":"3"}'::jsonb,
  'an invalidation advances the review version, so a command against an invalidated approval is VERSION_MISMATCH [P2-S11-AC-032]');
select pg_temp.p11_call('r-invalidated', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-invalid'), false);
select pg_temp.p11_call('r-rejected', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-rejected'), false);
select pg_temp.p11_call('r-open', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-open'), false);
select pg_temp.p11_call('r-none', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-main', jsonb_build_object('revisionId', pg_temp.h11w_uuid('pr-none:revision'), 'entryId', pg_temp.h11w_uuid('pr-none:entry'))), false);
select is(pg_temp.r11_out('r-invalidated') || '|' || pg_temp.r11_out('r-rejected') || '|' || pg_temp.r11_out('r-open') || '|' || pg_temp.r11_out('r-none'),
  'P0001:CONFLICT|P0001:CONFLICT|P0001:CONFLICT|P0001:CONFLICT',
  'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be published: CONFLICT [P2-S11-AC-033]');
select pg_temp.p11_call('h-mismatch', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-hash', jsonb_build_object('frozenHash', repeat('0', 64))), false);
select ok(pg_temp.r11_out('h-mismatch') = 'P0001:VALIDATION_FAILED' and pg_temp.r11_detail('h-mismatch')::jsonb = '["/frozenHash"]'::jsonb,
  'a frozenHash that is not the approved review''s frozen hash is 422 at /frozenHash [P2-S11-AC-030]');
select pg_temp.p11_call('s-schema', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-set', jsonb_build_object('expectedVersionSet',
    jsonb_set(platform_private.cms_revision_version_set(pg_temp.h11w_uuid('pr-set:revision'), (pg_temp.p11_review('pr-set')).dependency_manifest),
      '{schemaHash}', to_jsonb(repeat('1', 64))))), false);
select pg_temp.p11_call('s-settings', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-set', jsonb_build_object('expectedVersionSet',
    jsonb_set(platform_private.cms_revision_version_set(pg_temp.h11w_uuid('pr-set:revision'), (pg_temp.p11_review('pr-set')).dependency_manifest),
      '{settingsVersion}', '"99"'))), false);
select pg_temp.p11_call('s-taxonomy', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-set', jsonb_build_object('expectedVersionSet',
    jsonb_set(platform_private.cms_revision_version_set(pg_temp.h11w_uuid('pr-set:revision'), (pg_temp.p11_review('pr-set')).dependency_manifest),
      '{taxonomyVersionIds}', jsonb_build_array(extensions.gen_random_uuid())))), false);
select is(pg_temp.r11_out('s-schema') || '|' || pg_temp.r11_out('s-settings') || '|' || pg_temp.r11_out('s-taxonomy'),
  'P0001:version_set_stale|P0001:version_set_stale|P0001:version_set_stale',
  'an expectedVersionSet that is not exactly the version set frozen on the approved review (schema, settings or taxonomy member) is 409 version_set_stale [P2-S11-AC-033]');

-- ---------------------------------------------------------------------------
-- The publish-phase preflight (D19) and the accessibility proof (D25).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('p-failed', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-media'), false);
select ok(
  pg_temp.r11_out('p-failed') = 'P0001:preflight_failed'
    and jsonb_array_length(pg_temp.r11_detail('p-failed')::jsonb->'preflight') = 17
    and pg_temp.r11_keys(pg_temp.r11_detail('p-failed')::jsonb) = 'preflight'
    and (pg_temp.r11_detail('p-failed')::jsonb->'preflight') @>
        '[{"category":"media","outcome":"failed","reasonCode":"provider_unbuilt_reference"}]'::jsonb
    and (select count(*) from jsonb_array_elements(pg_temp.r11_detail('p-failed')::jsonb->'preflight') entry where entry->>'outcome' = 'passed') = 16,
  'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]');
select pg_temp.p11_call('p-no-evidence', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-pre', jsonb_build_object('evidence', null)), false);
select pg_temp.p11_call('p-failed-run', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-pre', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('pr-pre:revision'), 'failed')), false);
select pg_temp.p11_call('p-blocked-run', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-pre', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('pr-pre:revision'), 'blocked')), false);
select ok(
  pg_temp.r11_out('p-no-evidence') = 'P0001:DEPENDENCY_UNAVAILABLE'
    and pg_temp.r11_detail('p-no-evidence')::jsonb = '{"dependencyClass":"preflight"}'::jsonb
    and pg_temp.r11_out('p-failed-run') = 'P0001:DEPENDENCY_UNAVAILABLE'
    and pg_temp.r11_detail('p-failed-run')::jsonb = '{"dependencyClass":"preflight"}'::jsonb,
  'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]');
select ok(
  pg_temp.r11_out('p-blocked-run') = 'P0001:preflight_failed'
    and (pg_temp.r11_detail('p-blocked-run')::jsonb->'preflight') @>
        '[{"category":"accessibility","outcome":"failed","reasonCode":"blocking_finding"}]'::jsonb,
  'a blocked checker run is a failed accessibility category (blocking_finding): 422 preflight_failed [P2-S11-AC-101]');
select pg_temp.p11_call('e-stale', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-evi', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('pr-evi:revision'), 'healthy', interval '90 seconds')), false);
select pg_temp.p11_call('e-provider', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-evi', '{}'::jsonb, '{}'::text[],
    pg_temp.r11_evidence(pg_temp.h11w_uuid('pr-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('providerVersion', '9'))), false);
select pg_temp.p11_call('e-bound', 'pub', 'cms_publish_revision',
  pg_temp.p11_preq('pr-evi', '{}'::jsonb, '{}'::text[],
    pg_temp.r11_evidence(pg_temp.h11w_uuid('pr-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64)))), false);
select ok(
  pg_temp.r11_out('e-stale') = 'P0001:preflight_evidence_stale' and pg_temp.r11_out('e-provider') = 'P0001:preflight_evidence_stale'
    and pg_temp.r11_out('e-bound') = 'P0001:dependency_changed'
    and pg_temp.r11_detail('e-bound')::jsonb = jsonb_build_object('dependencyHash', (pg_temp.p11_review('pr-evi')).dependency_hash),
  'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]');

select is(pg_temp.p11_effects(), (select effects from r11_snap where label = 'start'),
  'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]');

-- ---------------------------------------------------------------------------
-- A stale frozen manifest COMMITS the review invalidation (DEC-157, DEC-159): the committed-refusal envelope.
-- ---------------------------------------------------------------------------
create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
insert into r11_req(label, request) values ('dep', pg_temp.p11_preq('pr-dep'));
select pg_temp.p11_call('dep', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'dep'));
select ok(
  pg_temp.r11_out('dep') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('dep')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('dep')->>'kind' = 'refusal' and pg_temp.r11_resp('dep')->>'reasonCode' = 'version_set_stale'
    and pg_temp.r11_resp('dep')->'details' = '{}'::jsonb,
  'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode version_set_stale, details {}} (BE03b E1: the command answers 409 version_set_stale) [P2-S11-AC-033]');
select ok(
  (pg_temp.p11_review('pr-dep')).state = 'invalidated' and (pg_temp.p11_review('pr-dep')).version = 3
    and (pg_temp.p11_review('pr-dep')).invalidated_reason = 'dependency_changed'
    and not exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('pr-dep:entry'))
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-pr-dep'))
    and (select count(*) = 0 from platform_private.outbox_events where event_type = 'cms.publication.changed.v1'),
  'the invalidation committed with the reason dependency_changed (review invalidated at version 3, one review-changed event) and no publication row or event exists [P2-S11-AC-111]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 'dep')), 'completed/409',
  'the reservation is completed with the typed refusal (status 409) [P2-S11-AC-032]');
select pg_temp.p11_call('dep-replay', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'dep'));
select ok(pg_temp.r11_out('dep-replay') = '00000:' and pg_temp.r11_resp('dep-replay') = pg_temp.r11_resp('dep'),
  'an exact replay returns the same committed refusal [P2-S11-AC-032]');
select pg_temp.p11_call('dep-again', 'pub', 'cms_publish_revision', pg_temp.p11_preq('pr-dep', jsonb_build_object('expectedVersion', '2', 'ifMatch', '2')), false);
select is(pg_temp.r11_out('dep-again'), 'P0001:VERSION_MISMATCH', 'a fresh attempt against the invalidated approval is VERSION_MISMATCH [P2-S11-AC-032]');

-- ---------------------------------------------------------------------------
-- Revocation category (publish phase): a counted approver whose standing grant lapsed.
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set active = false
            where person_id = %L and capability_code = 'cms.reviewer'$$, pg_temp.s11_id('rvA')));
insert into r11_req(label, request) values ('lapsed', pg_temp.p11_preq('pr-grant'));
select pg_temp.p11_call('rev-lapsed', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'lapsed'));
select ok(
  pg_temp.r11_out('rev-lapsed') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('rev-lapsed')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('rev-lapsed')->>'kind' = 'refusal' and pg_temp.r11_resp('rev-lapsed')->>'reasonCode' = 'preflight_failed'
    and pg_temp.r11_keys(pg_temp.r11_resp('rev-lapsed')->'details') = 'preflight'
    and jsonb_array_length(pg_temp.r11_resp('rev-lapsed')#>'{details,preflight}') = 17
    and (pg_temp.r11_resp('rev-lapsed')#>'{details,preflight}') @>
        '[{"category":"revocation","outcome":"failed","reasonCode":"reviewer_authority_changed"}]'::jsonb,
  'a counted approver whose standing cms.reviewer grant lapsed is found lazily by the revocation category: the command answers the COMMITTED refusal {kind, preflight_failed, details.preflight: 17 entries incl. revocation failed reviewer_authority_changed}, not a rollback [P2-S11-AC-096]');
select ok(
  (pg_temp.p11_review('pr-grant')).state = 'invalidated' and (pg_temp.p11_review('pr-grant')).version = 3
    and (pg_temp.p11_review('pr-grant')).invalidated_reason = 'reviewer_authority_changed'
    and pg_temp.p11_sched('s-pr-grant') = 'cancelled/2/0/approval_invalidated/-'
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-pr-grant'))
    and not exists (select 1 from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('pr-grant:entry')),
  'the reviewer-authority invalidation COMMITTED: the review is invalidated reviewer_authority_changed at version 3 with its one review-changed event, its pending schedule is cancelled approval_invalidated and the refused command published nothing [P2-S11-AC-096]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 'lapsed')), 'completed/422',
  'the reservation is completed with the committed refusal (status 422), so the same key replays it [P2-S11-AC-096]');
insert into r11_snap(label, effects) values ('lapsed', pg_temp.p11_effects());
select pg_temp.p11_call('lapsed-replay', 'pub', 'cms_publish_revision', (select request from r11_req where label = 'lapsed'));
select ok(pg_temp.r11_out('lapsed-replay') = '00000:' and pg_temp.r11_resp('lapsed-replay') = pg_temp.r11_resp('rev-lapsed')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'lapsed'),
  'an exact replay returns the same committed refusal with no further effect [P2-S11-AC-096]');

select * from finish();
rollback;
