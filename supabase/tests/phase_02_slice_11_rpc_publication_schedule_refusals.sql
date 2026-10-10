-- Slice 11 lane S11-3b: cms_schedule_publication refusals (CMS-03B-07; tracker P2-S11-AC-018 .. AC-021,
-- AC-047, AC-097, AC-101, AC-102, AC-103 .. AC-107, DEC-157, DEC-159).  Order of the evaluation: structure
-- -> step-up -> concealment (404) -> capability and separation (403) -> the reservation (replay) -> the
-- approved review's CAS operand (VERSION_MISMATCH) and state (CONFLICT) -> the time rules -> the publisher's
-- grant end -> frozen-dependency currency (a stale manifest COMMITS the review invalidation dependency_changed and
-- answers the committed-refusal envelope 409 version_set_stale, BE03b E1) -> the schedule-phase preflight (a
-- counted approver whose standing grant lapsed is found lazily by the revocation category: that COMMITS the
-- reviewer_authority_changed invalidation and cancels the review's pending schedules, BE03b Review invalidation).
-- Every raised refusal leaves no partial effect.
-- RED before 20261005017710.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(41);

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

-- A drift that changes the rebuilt manifest: a relation row added to the frozen revision.
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

select pg_temp.p11_approved(tag) from (values ('sr-main'), ('sr-time'), ('sr-edge'), ('sr-pre'), ('sr-evi'), ('sr-cas'),
  ('sr-short'), ('sr-dep'), ('sr-grant'), ('sr-media')) as t(tag);
select pg_temp.p11_approved('sr-author', 'pub');
-- A non-empty media value is a `media` reference: the reference gate fails closed (D19) without touching the manifest.
select pg_temp.h11w_value(pg_temp.h11w_uuid('sr-media:revision'), 'hero', jsonb_build_object('assetId', 'a9200000-0000-4000-8000-0000000000a1', 'assetVersion', '1'));
select pg_temp.p11_approved('sr-rejected', 'creator', '{}'::jsonb, '[]'::jsonb, 'reject');
select pg_temp.p11_approved('sr-open', 'creator', '{}'::jsonb, '[]'::jsonb, 'none');
select pg_temp.p11_approved('sr-invalid');
-- A pending schedule of the review whose counted approver will lapse (cancelled by the lazy invalidation).
select pg_temp.p11_schedule_row('s-sr-grant', 'sr-grant');
select pg_temp.r11_entry('sr-none');
-- A publisher whose grant ends tomorrow.
select pg_temp.h11r_member('rvX', array['cms.reviewer', 'cms.publisher']);
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set valid_through = current_date + 1
            where person_id = %L and capability_code = 'cms.publisher'$$, pg_temp.s11_id('rvX')));
select platform_private.cms_invalidate_editorial_review(jsonb_build_object(
  'reviewId', pg_temp.s11_id('rv-sr-invalid'), 'reasonCode', 'revision_superseded', 'correlationId', extensions.gen_random_uuid()));
select pg_temp.p11_drift('sr-dep', 'sr-dep-target');

select ok(
  (pg_temp.p11_review('sr-main')).state = 'approved' and (pg_temp.p11_review('sr-rejected')).state = 'rejected'
    and (pg_temp.p11_review('sr-open')).state = 'open' and (pg_temp.p11_review('sr-invalid')).state = 'invalidated'
    and (pg_temp.p11_review('sr-invalid')).version = 3
    and platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('sr-dep:revision'), (pg_temp.p11_review('sr-dep')).dependency_manifest) = 'stale'
    and platform_private.cms_frozen_dependencies_status(pg_temp.h11w_uuid('sr-main:revision'), (pg_temp.p11_review('sr-main')).dependency_manifest) = 'current',
  'control: approved, rejected, open and invalidated reviews exist, sr-dep has a stale frozen manifest and sr-main a current one');

insert into r11_snap(label, effects) values ('start', pg_temp.p11_effects());

-- ---------------------------------------------------------------------------
-- Structure: unknown keys and malformed identifiers (400) and the field pointers (422).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('x-entry', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('entryId', pg_temp.h11w_uuid('sr-main:entry'))), false);
select pg_temp.p11_call('x-risk', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('riskClass', 'ordinary')), false);
select pg_temp.p11_call('x-audience-missing', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', '{}'::jsonb, array['audience']), false);
select pg_temp.p11_call('x-revision', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('revisionId', 'not-a-uuid')), false);
select pg_temp.p11_call('x-agree', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('ifMatch', '3')), false);
select pg_temp.p11_call('x-evidence', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('evidence', 'healthy')), false);
select is(
  pg_temp.r11_out('x-entry') || '|' || pg_temp.r11_out('x-risk') || '|' || pg_temp.r11_out('x-audience-missing') || '|'
    || pg_temp.r11_out('x-revision') || '|' || pg_temp.r11_out('x-agree') || '|' || pg_temp.r11_out('x-evidence'),
  'P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST|P0001:INVALID_REQUEST',
  'an unknown key (entryId, riskClass), a missing member, a malformed revision id, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-018]');

select pg_temp.p11_call('v-action', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('action', 'delete')), false);
select pg_temp.p11_call('v-local-day', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('localDateTime', '2026-02-30T10:00')), false);
select pg_temp.p11_call('v-local-second', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('localDateTime', '2026-11-03T10:00:60')), false);
select pg_temp.p11_call('v-local-offset', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('localDateTime', '2026-11-03T10:00:00Z')), false);
select pg_temp.p11_call('v-local-fraction', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('localDateTime', '2026-11-03T10:00:00.1234567890')), false);
select pg_temp.p11_call('v-zone', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('timezone', 'Not A Zone')), false);
select pg_temp.p11_call('v-utc-offset', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('resolvedUtc', '2026-11-03T10:00:00')), false);
select pg_temp.p11_call('v-tzdb', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('tzdbVersion', 'bad version')), false);
select pg_temp.p11_call('v-disambiguation', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('disambiguation', 'sometimes')), false);
select pg_temp.p11_call('v-audience', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('audience', 'Public Site')), false);
select pg_temp.p11_call('v-audience-long', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('audience', repeat('a', 49))), false);
select pg_temp.p11_call('v-version', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('expectedVersion', '0', 'ifMatch', '0')), false);
select pg_temp.p11_call('v-ifmatch', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('ifMatch', 'W/"2"')), false);
select pg_temp.p11_call('v-many', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-main', jsonb_build_object('action', 'x', 'timezone', '', 'audience', '')), false);
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(pg_temp.r11_detail(label), ''), ';' order by label)
     from (values ('v-action'), ('v-local-day'), ('v-local-second'), ('v-local-offset'), ('v-local-fraction'), ('v-zone'), ('v-utc-offset'),
                  ('v-tzdb'), ('v-disambiguation'), ('v-audience'), ('v-audience-long'), ('v-version'), ('v-ifmatch')) as v(label)),
  'v-action=P0001:VALIDATION_FAILED["/action"];v-audience=P0001:VALIDATION_FAILED["/audience"];v-audience-long=P0001:VALIDATION_FAILED["/audience"];'
  || 'v-disambiguation=P0001:VALIDATION_FAILED["/disambiguation"];v-ifmatch=P0001:VALIDATION_FAILED["/ifMatch"];'
  || 'v-local-day=P0001:VALIDATION_FAILED["/localDateTime"];v-local-fraction=P0001:VALIDATION_FAILED["/localDateTime"];'
  || 'v-local-offset=P0001:VALIDATION_FAILED["/localDateTime"];v-local-second=P0001:VALIDATION_FAILED["/localDateTime"];'
  || 'v-tzdb=P0001:VALIDATION_FAILED["/tzdbVersion"];v-utc-offset=P0001:VALIDATION_FAILED["/resolvedUtc"];'
  || 'v-version=P0001:VALIDATION_FAILED["/expectedVersion", "/ifMatch"];v-zone=P0001:VALIDATION_FAILED["/timezone"]',
  'every invalid field is VALIDATION_FAILED at its RFC 6901 pointer: action, a real local date and time without offset or leap second at most nine fraction digits, the zone grammar, an offset instant, the tzdb tag, disambiguation, the audience grammar, expectedVersion and If-Match [P2-S11-AC-018]');
select is(pg_temp.r11_detail('v-many')::jsonb, '["/action","/timezone","/audience"]'::jsonb,
  'several invalid fields are reported together, in request order, and nothing else is echoed [P2-S11-AC-018]');

-- ---------------------------------------------------------------------------
-- Step-up (E6): before the reservation and before the review is read.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('t-stale', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select pg_temp.p11_call('t-future', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '-120 seconds'))), false);
select pg_temp.p11_call('t-unverified', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', false))), false);
select pg_temp.p11_call('t-absent', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('context', jsonb_build_object('actingPartyId', pg_temp.s11_id('org')))), false);
select pg_temp.p11_call('t-hidden', 'stranger', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('context', pg_temp.r11_ctx(interval '700 seconds'))), false);
select is(
  pg_temp.r11_out('t-stale') || '|' || pg_temp.r11_out('t-future') || '|' || pg_temp.r11_out('t-unverified') || '|' || pg_temp.r11_out('t-absent')
    || '|' || pg_temp.r11_out('t-hidden'),
  'P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED|P0001:STEP_UP_REQUIRED',
  'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-047]');

-- ---------------------------------------------------------------------------
-- Concealment (404) and the capability gate (403).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('c-stranger', 'stranger', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main'), false);
select pg_temp.p11_call('c-outsider', 'outsider', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main'), false);
select pg_temp.p11_call('c-absent', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main', jsonb_build_object('revisionId', extensions.gen_random_uuid())), false);
select ok(
  pg_temp.r11_out('c-stranger') = 'P0001:NOT_FOUND' and pg_temp.r11_out('c-outsider') = pg_temp.r11_out('c-stranger')
    and pg_temp.r11_out('c-absent') = pg_temp.r11_out('c-stranger')
    and pg_temp.r11_detail('c-stranger') is not distinct from pg_temp.r11_detail('c-outsider')
    and pg_temp.r11_detail('c-stranger') is not distinct from pg_temp.r11_detail('c-absent'),
  'a non-member, a member with no scope on the entry and an absent revision are the same byte-identical NOT_FOUND [P2-S11-AC-019]');
select pg_temp.p11_call('c-editor', 'editor', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main'), false);
select pg_temp.p11_call('c-reviewer', 'rvA', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main'), false);
select pg_temp.p11_call('c-owner', 'owner', 'cms_schedule_publication', pg_temp.p11_sreq('sr-main'), false);
select is(pg_temp.r11_out('c-editor') || '|' || pg_temp.r11_out('c-reviewer') || '|' || pg_temp.r11_out('c-owner'),
  'P0001:capability_missing|P0001:capability_missing|P0001:capability_missing',
  'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]');
select pg_temp.p11_call('c-separation', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-author'), false);
select is(pg_temp.r11_out('c-separation'), 'P0001:separation_of_duties',
  'the human who authored the revision cannot schedule its publish (E11) [P2-S11-AC-107]');

-- ---------------------------------------------------------------------------
-- The review operand (VERSION_MISMATCH) and the review state (CONFLICT).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('r-stale', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-cas', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1')), false);
select ok(pg_temp.r11_out('r-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('r-stale')::jsonb = '{"expectedVersion":"1","currentVersion":"2"}'::jsonb,
  'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-020]');
select pg_temp.p11_call('r-invalidated-stale', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-invalid', jsonb_build_object('expectedVersion', '2', 'ifMatch', '2')), false);
select ok(pg_temp.r11_out('r-invalidated-stale') = 'P0001:VERSION_MISMATCH'
    and pg_temp.r11_detail('r-invalidated-stale')::jsonb = '{"expectedVersion":"2","currentVersion":"3"}'::jsonb,
  'an invalidation advances the review version, so a command against an invalidated approval is VERSION_MISMATCH [P2-S11-AC-020]');
select pg_temp.p11_call('r-invalidated', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-invalid'), false);
select pg_temp.p11_call('r-rejected', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-rejected'), false);
select pg_temp.p11_call('r-open', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-open'), false);
select pg_temp.p11_call('r-none', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-main', jsonb_build_object('revisionId', pg_temp.h11w_uuid('sr-none:revision'))), false);
select is(pg_temp.r11_out('r-invalidated') || '|' || pg_temp.r11_out('r-rejected') || '|' || pg_temp.r11_out('r-open') || '|' || pg_temp.r11_out('r-none'),
  'P0001:CONFLICT|P0001:CONFLICT|P0001:CONFLICT|P0001:CONFLICT',
  'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be scheduled: CONFLICT [P2-S11-AC-038]');

-- ---------------------------------------------------------------------------
-- The time rules the RPC re-checks (E8): tzdb pin, horizon, offset plausibility.
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('e-tzdb', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-time', jsonb_build_object('tzdbVersion', '2025b')), false);
select ok(pg_temp.r11_out('e-tzdb') = 'P0001:tzdb_version_mismatch'
    and pg_temp.r11_detail('e-tzdb')::jsonb = jsonb_build_object('pinnedVersion', platform_private.cms_tzdb_version()),
  'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]');
select pg_temp.p11_call('e-soon', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-time', '{}'::jsonb, '{}'::text[], null, interval '30 seconds'), false);
select pg_temp.p11_call('e-past', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-time', '{}'::jsonb, '{}'::text[], null, interval '-1 hour'), false);
select pg_temp.p11_call('e-far', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-time', '{}'::jsonb, '{}'::text[], null, interval '367 days'), false);
select ok(
  pg_temp.r11_out('e-soon') = 'P0001:schedule_out_of_horizon' and pg_temp.r11_out('e-past') = 'P0001:schedule_out_of_horizon'
    and pg_temp.r11_out('e-far') = 'P0001:schedule_out_of_horizon'
    and pg_temp.r11_keys(pg_temp.r11_detail('e-soon')::jsonb) = 'maxUtc,minUtc'
    and (pg_temp.r11_detail('e-soon')::jsonb->>'minUtc')::timestamptz between clock_timestamp() + interval '50 seconds' and clock_timestamp() + interval '70 seconds'
    and (pg_temp.r11_detail('e-soon')::jsonb->>'maxUtc')::timestamptz between clock_timestamp() + interval '365 days 23 hours' and clock_timestamp() + interval '366 days 1 hour',
  'a schedule under 60 s ahead, in the past or over 366 days ahead is 422 schedule_out_of_horizon with the minUtc and maxUtc window [P2-S11-AC-105]');
select pg_temp.p11_call('e-plus15', 'pub', 'cms_schedule_publication',
  pg_temp.p11_shifted(pg_temp.p11_sreq('sr-time'), interval '15 hours'), false);
select pg_temp.p11_call('e-minus13', 'pub', 'cms_schedule_publication',
  pg_temp.p11_shifted(pg_temp.p11_sreq('sr-time'), interval '-13 hours'), false);
select is(pg_temp.r11_out('e-plus15') || '|' || pg_temp.r11_out('e-minus13'), 'P0001:resolved_utc_mismatch|P0001:resolved_utc_mismatch',
  'a local time more than 14 h after or 12 h before the resolved UTC (no real zone offset) is 422 resolved_utc_mismatch [P2-S11-AC-105]');
select pg_temp.p11_call('g-ends', 'rvX', 'cms_schedule_publication', pg_temp.p11_sreq('sr-short'), false);
select is(pg_temp.r11_out('g-ends'), 'P0001:authority_ends_before_schedule',
  'a cms.publisher grant that ends before the resolved UTC day is 422 authority_ends_before_schedule [P2-S11-AC-107]');
-- ---------------------------------------------------------------------------
-- The schedule-phase preflight (D19) and the accessibility proof (D25).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('p-failed', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-media'), false);
select ok(
  pg_temp.r11_out('p-failed') = 'P0001:preflight_failed'
    and jsonb_array_length(pg_temp.r11_detail('p-failed')::jsonb->'preflight') = 17
    and pg_temp.r11_keys(pg_temp.r11_detail('p-failed')::jsonb) = 'preflight'
    and (pg_temp.r11_detail('p-failed')::jsonb->'preflight') @>
        '[{"category":"media","outcome":"failed","reasonCode":"provider_unbuilt_reference"}]'::jsonb
    and (select count(*) from jsonb_array_elements(pg_temp.r11_detail('p-failed')::jsonb->'preflight') entry where entry->>'outcome' = 'passed') = 16,
  'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]');
select pg_temp.p11_call('p-no-evidence', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-pre', jsonb_build_object('evidence', null)), false);
select pg_temp.p11_call('p-failed-run', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-pre', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('sr-pre:revision'), 'failed')), false);
select pg_temp.p11_call('p-blocked-run', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-pre', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('sr-pre:revision'), 'blocked')), false);
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
select pg_temp.p11_call('e-stale', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-evi', '{}'::jsonb, '{}'::text[], pg_temp.r11_evidence(pg_temp.h11w_uuid('sr-evi:revision'), 'healthy', interval '90 seconds')), false);
select pg_temp.p11_call('e-provider', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-evi', '{}'::jsonb, '{}'::text[],
    pg_temp.r11_evidence(pg_temp.h11w_uuid('sr-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('providerVersion', '9'))), false);
select pg_temp.p11_call('e-bound', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-evi', '{}'::jsonb, '{}'::text[],
    pg_temp.r11_evidence(pg_temp.h11w_uuid('sr-evi:revision'), 'healthy', interval '0 seconds', jsonb_build_object('bindingHash', repeat('2', 64)))), false);
select ok(
  pg_temp.r11_out('e-stale') = 'P0001:preflight_evidence_stale' and pg_temp.r11_out('e-provider') = 'P0001:preflight_evidence_stale'
    and pg_temp.r11_out('e-bound') = 'P0001:dependency_changed'
    and pg_temp.r11_detail('e-bound')::jsonb = jsonb_build_object('dependencyHash', (pg_temp.p11_review('sr-evi')).dependency_hash),
  'evidence older than 60 s or from another provider version is 409 preflight_evidence_stale; evidence bound to other rows is 409 dependency_changed with the current hash [P2-S11-AC-102]');

select is(pg_temp.p11_effects(), (select effects from r11_snap where label = 'start'),
  'every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]');
select is((select count(*)::integer from platform_private.cms_publication_schedules where revision_id = pg_temp.h11w_uuid('sr-time:revision')), 0,
  'the refused time rules scheduled nothing [P2-S11-AC-105]');

-- ---------------------------------------------------------------------------
-- Accepted at the edges (these commit, so they follow the no-partial-effect assertion).
-- ---------------------------------------------------------------------------
select pg_temp.p11_call('o-min', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-edge', '{}'::jsonb, '{}'::text[], null, interval '90 seconds'));
select pg_temp.p11_call('o-max', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('sr-edge', jsonb_build_object('audience', 'partners'), '{}'::text[], null, interval '366 days' - interval '1 minute'));
select pg_temp.p11_call('o-plus14', 'pub', 'cms_schedule_publication',
  pg_temp.p11_shifted(pg_temp.p11_sreq('sr-edge', jsonb_build_object('audience', 'staff')), interval '14 hours'));
select pg_temp.p11_call('o-minus12', 'pub', 'cms_schedule_publication',
  pg_temp.p11_shifted(pg_temp.p11_sreq('sr-edge', jsonb_build_object('audience', 'press')), interval '-12 hours'));
select is(pg_temp.r11_out('o-min') || '|' || pg_temp.r11_out('o-max') || '|' || pg_temp.r11_out('o-plus14') || '|' || pg_temp.r11_out('o-minus12'),
  '00000:|00000:|00000:|00000:',
  'the bounds are inclusive: 90 s ahead, just under 366 days ahead, a local time exactly 14 h after and exactly 12 h before the resolved UTC are accepted [P2-S11-AC-105]');
select pg_temp.p11_call('g-ends-ok', 'rvX', 'cms_schedule_publication', pg_temp.p11_sreq('sr-short', '{}'::jsonb, '{}'::text[], null, interval '30 minutes'));
select is(pg_temp.r11_out('g-ends-ok'), '00000:',
  'a grant that still covers the resolved UTC day (here: tomorrow) schedules [P2-S11-AC-107]');


-- ---------------------------------------------------------------------------
-- A stale frozen manifest COMMITS the review invalidation (DEC-157, DEC-159): the committed-refusal envelope.
-- ---------------------------------------------------------------------------
create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
insert into r11_req(label, request) values ('dep', pg_temp.p11_sreq('sr-dep'));
select pg_temp.p11_call('dep', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 'dep'));
select ok(
  pg_temp.r11_out('dep') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('dep')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('dep')->>'kind' = 'refusal' and pg_temp.r11_resp('dep')->>'reasonCode' = 'version_set_stale'
    and pg_temp.r11_resp('dep')->'details' = '{}'::jsonb,
  'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode version_set_stale, details {}} (BE03b E1: the command answers 409 version_set_stale) [P2-S11-AC-021]');
select ok(
  (pg_temp.p11_review('sr-dep')).state = 'invalidated' and (pg_temp.p11_review('sr-dep')).version = 3
    and (pg_temp.p11_review('sr-dep')).invalidated_reason = 'dependency_changed'
    and not exists (select 1 from platform_private.cms_publication_schedules where revision_id = pg_temp.h11w_uuid('sr-dep:revision'))
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-sr-dep')),
  'the invalidation committed with the reason dependency_changed (review invalidated at version 3, one review-changed event) and no schedule exists [P2-S11-AC-111]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 'dep')), 'completed/409',
  'the reservation is completed with the typed refusal (status 409) [P2-S11-AC-020]');
select pg_temp.p11_call('dep-replay', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 'dep'));
select ok(pg_temp.r11_out('dep-replay') = '00000:' and pg_temp.r11_resp('dep-replay') = pg_temp.r11_resp('dep'),
  'an exact replay returns the same committed refusal [P2-S11-AC-020]');
select pg_temp.p11_call('dep-again', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('sr-dep', jsonb_build_object('expectedVersion', '2', 'ifMatch', '2')), false);
select is(pg_temp.r11_out('dep-again'), 'P0001:VERSION_MISMATCH', 'a fresh attempt against the invalidated approval is VERSION_MISMATCH [P2-S11-AC-020]');

-- ---------------------------------------------------------------------------
-- Revocation category (schedule phase): a counted approver whose standing grant lapsed.
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('identity_private.organization_actor_grant',
  format($$update identity_private.organization_actor_grant set active = false
            where person_id = %L and capability_code = 'cms.reviewer'$$, pg_temp.s11_id('rvA')));
insert into r11_req(label, request) values ('lapsed', pg_temp.p11_sreq('sr-grant'));
select pg_temp.p11_call('rev-lapsed', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 'lapsed'));
select ok(
  pg_temp.r11_out('rev-lapsed') = '00000:' and pg_temp.r11_keys(pg_temp.r11_resp('rev-lapsed')) = 'details,kind,reasonCode'
    and pg_temp.r11_resp('rev-lapsed')->>'kind' = 'refusal' and pg_temp.r11_resp('rev-lapsed')->>'reasonCode' = 'preflight_failed'
    and pg_temp.r11_keys(pg_temp.r11_resp('rev-lapsed')->'details') = 'preflight'
    and jsonb_array_length(pg_temp.r11_resp('rev-lapsed')#>'{details,preflight}') = 17
    and (pg_temp.r11_resp('rev-lapsed')#>'{details,preflight}') @>
        '[{"category":"revocation","outcome":"failed","reasonCode":"reviewer_authority_changed"}]'::jsonb,
  'a counted approver whose standing cms.reviewer grant lapsed is found lazily by the revocation category: the command answers the COMMITTED refusal {kind, preflight_failed, details.preflight: 17 entries incl. revocation failed reviewer_authority_changed}, not a rollback [P2-S11-AC-096]');
select ok(
  (pg_temp.p11_review('sr-grant')).state = 'invalidated' and (pg_temp.p11_review('sr-grant')).version = 3
    and (pg_temp.p11_review('sr-grant')).invalidated_reason = 'reviewer_authority_changed'
    and pg_temp.p11_sched('s-sr-grant') = 'cancelled/2/0/approval_invalidated/-'
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_id = pg_temp.s11_id('rv-sr-grant'))
    and (select count(*) = 1 from platform_private.cms_publication_schedules where revision_id = pg_temp.h11w_uuid('sr-grant:revision')),
  'the reviewer-authority invalidation COMMITTED: the review is invalidated reviewer_authority_changed at version 3 with its one review-changed event, its pending schedule is cancelled approval_invalidated and the refused command scheduled nothing [P2-S11-AC-096]');
select is(pg_temp.p11_reservation((select request->>'idempotencyKey' from r11_req where label = 'lapsed')), 'completed/422',
  'the reservation is completed with the committed refusal (status 422), so the same key replays it [P2-S11-AC-096]');
insert into r11_snap(label, effects) values ('lapsed', pg_temp.p11_effects());
select pg_temp.p11_call('lapsed-replay', 'pub', 'cms_schedule_publication', (select request from r11_req where label = 'lapsed'));
select ok(pg_temp.r11_out('lapsed-replay') = '00000:' and pg_temp.r11_resp('lapsed-replay') = pg_temp.r11_resp('rev-lapsed')
    and pg_temp.p11_effects() = (select effects from r11_snap where label = 'lapsed'),
  'an exact replay returns the same committed refusal with no further effect [P2-S11-AC-096]');

select * from finish();
rollback;
