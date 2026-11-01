-- Slice 11 shared helpers: editorial review invalidation (BE03b "Review
-- invalidation", "Preview token and verification"; tracker P2-S11-AC-111,
-- AC-112, AC-118).  RED before 20261005017580, GREEN after.
--
-- cms_invalidate_editorial_review(request) is the ONE invalidation core: a live
-- review (open|approved) becomes `invalidated` with exactly one closed reason under
-- CAS, in the same transaction its pending|failed_retryable schedules are cancelled
-- (approval_invalidated, or entry_unavailable for that reason) and, for
-- entry_unavailable, the entry's unexpired preview tokens are revoked; one
-- cms.entry.review-changed.v1 and the audit row commit with it.  Producers wired
-- here (new triggers only): a revision appended to the entry (revision_superseded),
-- the entry leaving `active` (entry_unavailable), and the loss of a counted
-- approver's authority (reviewer_authority_changed).  The preview scope of the
-- minting person is re-proved at every authority change (DEC-143 pattern).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(92);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

create or replace function pg_temp.h11i_inv(p_review text, p_reason text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
as $body$
begin
  return platform_private.cms_invalidate_editorial_review(jsonb_build_object(
    'reviewId', pg_temp.s11_id(p_review), 'reasonCode', p_reason,
    'correlationId', 'a9200000-0000-4000-8000-0000000000c1') || p_extra);
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

create or replace function pg_temp.h11i_state(p_review text)
returns text
language sql
as $body$
  select state || '/' || coalesce(invalidated_reason, '-') || '/v' || version::text || '/' || (decided_at is not null)::text
    from platform_private.cms_editorial_reviews where id = pg_temp.s11_id(p_review)
$body$;

create or replace function pg_temp.h11i_events()
returns text
language sql
as $body$
  select coalesce(string_agg(payload::text || '@' || aggregate_version::text, ',' order by occurred_at, id), '')
    from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1'
$body$;

-- fixtures ---------------------------------------------------------------------------
select pg_temp.h11r_member('reviewer01', array['cms.reviewer', 'cms.reviewer.policy']);
select pg_temp.h11r_member('reviewer02', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer03', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer04', array['cms.publisher']);

-- A review in each state on different revisions of entries A and B:
--   open   : revA1  (review `rv-open`)
--   approved: revA2 (review `rv-appr`, approver reviewer01 / cms.reviewer)
--   rejected: revB1 (review `rv-rej`)
select pg_temp.h11r_review('rv-open', jsonb_build_object('revision_id', pg_temp.s11_id('revA1'), 'entry_id', pg_temp.s11_id('entryA')));
select pg_temp.h11r_approved('rv-appr', pg_temp.s11_id('revA2'), pg_temp.s11_id('entryA'), 'reviewer01');
select pg_temp.h11r_review('rv-rej', jsonb_build_object('revision_id', pg_temp.s11_id('revB1'), 'entry_id', pg_temp.s11_id('entryB')));
select pg_temp.h11r_assign('rv-rej-asg', 'rv-rej', 'reviewer02');
select pg_temp.h11r_decide('rv-rej-dec', 'rv-rej', 'reviewer02', 'rv-rej-asg', 'reject');

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_invalidate_editorial_review(jsonb)')
    and pg_temp.h11_private_definer('cms_invalidate_reviews_for_person(uuid, text)')
    and pg_temp.h11_private_definer('cms_revoke_active_preview_tokens(uuid, uuid)')
    and pg_temp.h11_private_definer('cms_preview_scope_holds(uuid, uuid, uuid, uuid)'),
  'the invalidation helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-111]');
select ok(
  pg_temp.h11_volatility('cms_invalidate_editorial_review(jsonb)') = 'v'
    and pg_temp.h11_volatility('cms_invalidate_reviews_for_person(uuid, text)') = 'v'
    and pg_temp.h11_volatility('cms_revoke_active_preview_tokens(uuid, uuid)') = 'v'
    and pg_temp.h11_volatility('cms_preview_scope_holds(uuid, uuid, uuid, uuid)') = 's',
  'the writers are VOLATILE and the scope predicate is a STABLE read [P2-S11-AC-111]');
select is(pg_temp.h11_rettype('cms_invalidate_reviews_for_person(uuid, text)'), 'integer',
  'the authority-loss entry point returns the number of reviews transitioned [P2-S11-AC-112]');

-- ---------------------------------------------------------------------------
-- Request discipline.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed', '{"surprise":1}'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'an unknown request member is INVALID_REQUEST (server-built request only) [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'because'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a reason outside the closed four is INVALID_REQUEST [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed', '{"reviewId":"nope"}'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a malformed review id is INVALID_REQUEST [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed', '{"correlationId":7}'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a malformed correlation id is INVALID_REQUEST [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed', '{"actorId":"nope"}'), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a malformed actor id is INVALID_REQUEST [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed', '{"reviewId":"a9200000-0000-4000-8000-0000000000ee"}'), jsonb_build_object('error', 'P0001:NOT_FOUND'),
  'an absent review is NOT_FOUND [P2-S11-AC-111]');
select is(pg_temp.h11i_state('rv-open'), 'open/-/v1/false', 'control: the failed requests changed nothing [P2-S11-AC-111]');
select is(pg_temp.h11i_events(), '', 'control: no event was emitted by the failed requests [P2-S11-AC-111]');

-- ---------------------------------------------------------------------------
-- Closed reasons on an open review.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed'),
  jsonb_build_object('reviewId', pg_temp.s11_id('rv-open'), 'invalidated', true, 'cancelledSchedules', 0, 'revokedPreviewTokens', 0),
  'an open review is invalidated and the result names the review, the transition and the cascade counts [P2-S11-AC-111]');
select is(pg_temp.h11i_state('rv-open'), 'invalidated/dependency_changed/v2/false',
  'state invalidated, the reason recorded, version + 1 [P2-S11-AC-111]');
select is(pg_temp.h11i_events(),
  jsonb_build_object('reviewId', pg_temp.s11_id('rv-open'), 'revisionId', pg_temp.s11_id('revA1'))::text || '@2',
  'one cms.entry.review-changed.v1 { reviewId, revisionId } at the new review version [P2-S11-AC-111]');
select is(
  (select count(*)::integer from audit_private.audit_events where target_id = pg_temp.s11_id('rv-open')
     and action = 'cms.entry.review.invalidate' and reason_code = 'CMS_REVIEW_INVALIDATED'),
  1, 'one audit row records the invalidation (no actor for a system producer) [P2-S11-AC-111]');
select is(
  (select actor_id from audit_private.audit_events where target_id = pg_temp.s11_id('rv-open') and action = 'cms.entry.review.invalidate'),
  null, 'a system invalidation records no actor [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-open', 'dependency_changed'),
  jsonb_build_object('reviewId', pg_temp.s11_id('rv-open'), 'invalidated', false, 'cancelledSchedules', 0, 'revokedPreviewTokens', 0),
  'invalidating an already invalidated review is an idempotent no-op [P2-S11-AC-113]');
select is(pg_temp.h11i_state('rv-open'), 'invalidated/dependency_changed/v2/false', 'the no-op did not touch the review [P2-S11-AC-113]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1'), 1,
  'the no-op emitted no second event [P2-S11-AC-113]');

-- approved review: decided_at is cleared by the transition
select is(pg_temp.h11i_state('rv-appr'), 'approved/-/v2/true', 'control: rv-appr is approved at version 2 with decided_at [P2-S11-AC-111]');
select is(pg_temp.h11i_inv('rv-appr', 'reviewer_authority_changed', jsonb_build_object('actorId', pg_temp.s11_id('creatorAuth'))) ->> 'invalidated', 'true',
  'an approved review is invalidated as well [P2-S11-AC-111]');
select is(pg_temp.h11i_state('rv-appr'), 'invalidated/reviewer_authority_changed/v3/false',
  'approved -> invalidated clears decided_at and advances the version [P2-S11-AC-111]');
select is(
  (select actor_id from audit_private.audit_events where target_id = pg_temp.s11_id('rv-appr') and action = 'cms.entry.review.invalidate'),
  pg_temp.s11_id('creatorAuth'), 'a supplied actor is recorded on the audit row [P2-S11-AC-111]');

-- terminal rejected review: untouched
select is(pg_temp.h11i_inv('rv-rej', 'dependency_changed') ->> 'invalidated', 'false', 'a rejected review is terminal and is never invalidated [P2-S11-AC-111]');
select is(pg_temp.h11i_state('rv-rej'), 'rejected/-/v2/true', 'the rejected review is unchanged [P2-S11-AC-111]');

-- each of the four closed reasons is accepted
select pg_temp.h11w_revision('c1'); select pg_temp.h11w_revision('c2'); select pg_temp.h11w_revision('c3'); select pg_temp.h11w_revision('c4');
select pg_temp.h11r_review('rv-c1', jsonb_build_object('revision_id', pg_temp.h11w_uuid('c1:revision'), 'entry_id', pg_temp.h11w_uuid('c1:entry')));
select pg_temp.h11r_review('rv-c2', jsonb_build_object('revision_id', pg_temp.h11w_uuid('c2:revision'), 'entry_id', pg_temp.h11w_uuid('c2:entry')));
select pg_temp.h11r_review('rv-c3', jsonb_build_object('revision_id', pg_temp.h11w_uuid('c3:revision'), 'entry_id', pg_temp.h11w_uuid('c3:entry')));
select pg_temp.h11r_review('rv-c4', jsonb_build_object('revision_id', pg_temp.h11w_uuid('c4:revision'), 'entry_id', pg_temp.h11w_uuid('c4:entry')));
select pg_temp.h11i_inv('rv-c1', 'revision_superseded');
select pg_temp.h11i_inv('rv-c2', 'dependency_changed');
select pg_temp.h11i_inv('rv-c3', 'reviewer_authority_changed');
select pg_temp.h11i_inv('rv-c4', 'entry_unavailable');
select is(
  (select string_agg(invalidated_reason, ',' order by invalidated_reason) from platform_private.cms_editorial_reviews
    where id in (pg_temp.s11_id('rv-c1'), pg_temp.s11_id('rv-c2'), pg_temp.s11_id('rv-c3'), pg_temp.s11_id('rv-c4'))),
  'dependency_changed,entry_unavailable,reviewer_authority_changed,revision_superseded',
  'all four closed reasons are accepted and recorded [P2-S11-AC-111]');
select is(platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('c1:revision')), 'draft',
  'an invalidated review returns its revision to draft (E2) [P2-S11-AC-085]');

-- ---------------------------------------------------------------------------
-- Schedules of the review.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('sc');
select pg_temp.h11r_approved('rv-sc', pg_temp.h11w_uuid('sc:revision'), pg_temp.h11w_uuid('sc:entry'), 'reviewer02');
select pg_temp.h11w_revision('sc-other');
select pg_temp.h11r_approved('rv-sc-other', pg_temp.h11w_uuid('sc-other:revision'), pg_temp.h11w_uuid('sc-other:entry'), 'reviewer02');
create or replace function pg_temp.h11i_sched2(p_key text, p_tag text, p_review text, p_state text, p_extra jsonb default '{}'::jsonb, p_action text default 'publish')
returns void
language plpgsql
as $body$
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text) on conflict (key) do nothing;
  perform pg_temp.h11_raw_insert('platform_private.cms_publication_schedules',
    pg_temp.s11_schedule_row(jsonb_build_object(
      'id', pg_temp.s11_id(p_key), 'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
      'revision_id', pg_temp.h11w_uuid(p_tag || ':revision'), 'review_id', pg_temp.s11_id(p_review),
      'state', p_state, 'action', p_action, 'created_by', pg_temp.s11_id('reviewer04'),
      'audience', 'aud' || (abs(hashtext(p_key)) % 100000)::text,
      'resolved_at_utc', timestamptz '2027-01-15T08:00:00Z') || p_extra));
end;
$body$;
select pg_temp.h11i_sched2('s-pending', 'sc', 'rv-sc', 'pending');
select pg_temp.h11i_sched2('s-retry', 'sc', 'rv-sc', 'failed_retryable', '{"attempt_count":1,"next_attempt_at":"2027-01-15T08:01:00Z"}', 'unpublish');
select pg_temp.h11i_sched2('s-exec', 'sc', 'rv-sc', 'executing', jsonb_build_object('lease_id', extensions.gen_random_uuid(), 'lease_until', timestamptz '2027-01-15T08:05:00Z'), 'expire');
select pg_temp.h11i_sched2('s-done', 'sc', 'rv-sc', 'completed', '{"actual_at_utc":"2027-01-15T08:00:03Z","deviation_seconds":3}', 'archive');
select pg_temp.h11i_sched2('s-other', 'sc-other', 'rv-sc-other', 'pending');
select is(pg_temp.h11i_inv('rv-sc', 'dependency_changed') ->> 'cancelledSchedules', '2',
  'the review''s pending and failed_retryable schedules are cancelled in the same transaction [P2-S11-AC-111]');
select is((select state || '/' || reason_code || '/v' || version::text || '/' || (next_attempt_at is null)::text from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-pending')),
  'cancelled/approval_invalidated/v2/true', 'a cancelled schedule records approval_invalidated and advances its version [P2-S11-AC-111]');
select is((select state || '/' || reason_code from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-retry')),
  'cancelled/approval_invalidated', 'a failed_retryable schedule is cancelled too [P2-S11-AC-111]');
select is((select state from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-exec')), 'executing',
  'an executing schedule is left to finish (the executor re-reads the approval) [P2-S11-AC-111]');
select is((select state from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-done')), 'completed',
  'a completed schedule is history [P2-S11-AC-111]');
select is((select state from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-other')), 'pending',
  'another review''s schedule is untouched [P2-S11-AC-111]');

select pg_temp.h11w_revision('sc2');
select pg_temp.h11r_approved('rv-sc2', pg_temp.h11w_uuid('sc2:revision'), pg_temp.h11w_uuid('sc2:entry'), 'reviewer02');
select pg_temp.h11i_sched2('s2-pending', 'sc2', 'rv-sc2', 'pending');
select is(pg_temp.h11i_inv('rv-sc2', 'entry_unavailable') ->> 'cancelledSchedules', '1', 'entry_unavailable cancels the schedule as well [P2-S11-AC-111]');
select is((select reason_code from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s2-pending')), 'entry_unavailable',
  'with the schedule reason entry_unavailable, not approval_invalidated [P2-S11-AC-111]');

-- ---------------------------------------------------------------------------
-- Preview tokens: revoked for entry_unavailable only.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11i_token(p_key text, p_entry uuid, p_revision uuid, p_person text default 'creator', p_age interval default interval '0 minutes')
returns void
language plpgsql
as $body$
declare
  created timestamptz := clock_timestamp() - p_age;
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text) on conflict (key) do nothing;
  execute pg_temp.s11_insert_sql('platform_private.cms_preview_tokens', pg_temp.s11_token_row(jsonb_build_object(
    'id', pg_temp.s11_id(p_key), 'entry_id', p_entry, 'revision_id', p_revision,
    'person_id', pg_temp.s11_id(p_person), 'created_at', created, 'updated_at', created,
    'expires_at', created + interval '15 minutes')));
end;
$body$;
create or replace function pg_temp.h11i_tok(p_key text)
returns text
language sql
as $body$
  select state || '/v' || version::text || '/' || (revoked_at is not null)::text
    from platform_private.cms_preview_tokens where id = pg_temp.s11_id(p_key)
$body$;

select pg_temp.h11w_revision('tk');
select pg_temp.h11r_approved('rv-tk', pg_temp.h11w_uuid('tk:revision'), pg_temp.h11w_uuid('tk:entry'), 'reviewer02');
select pg_temp.h11i_token('t-live', pg_temp.h11w_uuid('tk:entry'), pg_temp.h11w_uuid('tk:revision'));
select pg_temp.h11i_token('t-expired', pg_temp.h11w_uuid('tk:entry'), pg_temp.h11w_uuid('tk:revision'), 'creator', interval '2 hours');
select pg_temp.h11i_token('t-other-entry', pg_temp.s11_id('entryB'), pg_temp.s11_id('revB1'));
select is(pg_temp.h11i_inv('rv-tk', 'dependency_changed') ->> 'revokedPreviewTokens', '0',
  'a dependency change revokes no preview token (a version-set movement does not revoke it) [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t-live'), 'active/v1/false', 'the live token is still active [P2-S11-AC-118]');

select pg_temp.h11w_revision('tk2');
select pg_temp.h11r_approved('rv-tk2', pg_temp.h11w_uuid('tk2:revision'), pg_temp.h11w_uuid('tk2:entry'), 'reviewer02');
select pg_temp.h11i_token('t2-live', pg_temp.h11w_uuid('tk2:entry'), pg_temp.h11w_uuid('tk2:revision'));
select pg_temp.h11i_token('t2-live-b', pg_temp.h11w_uuid('tk2:entry'), pg_temp.h11w_uuid('tk2:revision'), 'editor');
select pg_temp.h11i_token('t2-expired', pg_temp.h11w_uuid('tk2:entry'), pg_temp.h11w_uuid('tk2:revision'), 'creator', interval '2 hours');
select is(pg_temp.h11i_inv('rv-tk2', 'entry_unavailable') ->> 'revokedPreviewTokens', '2',
  'entry_unavailable revokes the entry''s unexpired active tokens (all minters) [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t2-live'), 'revoked/v2/true', 'a revoked token is state revoked, revoked_at set, version + 1 (CAS) [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t2-live-b'), 'revoked/v2/true', 'every minter''s token on the entry is revoked [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t2-expired'), 'active/v1/false', 'an already expired token is left alone (expiry is derived) [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t-other-entry'), 'active/v1/false', 'another entry''s token is untouched [P2-S11-AC-118]');

-- the token primitive
select is(pg_temp.h11_text(format('select platform_private.cms_revoke_active_preview_tokens(%L::uuid, null)', pg_temp.s11_id('entryB'))), '1',
  'cms_revoke_active_preview_tokens(entry, null) revokes the entry''s active unexpired tokens and counts them [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t-other-entry'), 'revoked/v2/true', 'the token is revoked [P2-S11-AC-118]');
select is(pg_temp.h11_text(format('select platform_private.cms_revoke_active_preview_tokens(%L::uuid, null)', pg_temp.s11_id('entryB'))), '0',
  'a repeat is idempotent [P2-S11-AC-118]');
select is(pg_temp.h11_text('select platform_private.cms_revoke_active_preview_tokens(null, null)'), 'ERR:P0001:INVALID_REQUEST',
  'neither an entry nor a person is a malformed call [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Producer 1: a revision appended to the entry supersedes older live reviews.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('sup');
select pg_temp.h11r_review('rv-sup', jsonb_build_object('revision_id', pg_temp.h11w_uuid('sup:revision'), 'entry_id', pg_temp.h11w_uuid('sup:entry')));
select pg_temp.h11w_revision('sup-fr', 'creatorPerson', 'fr-FR', '[]'::jsonb, 'sup', 2);
select is(pg_temp.h11i_state('rv-sup'), 'open/-/v1/false',
  'a revision of another locale does not supersede the review (the chain is per locale) [P2-S11-AC-112]');
select pg_temp.h11w_revision('sup2', 'creatorPerson', 'en-US', '[]'::jsonb, 'sup', 3);
select is(pg_temp.h11i_state('rv-sup'), 'invalidated/revision_superseded/v2/false',
  'appending a newer revision of the same locale invalidates the older live review revision_superseded [P2-S11-AC-112]');
select is(pg_temp.h11i_events() like '%' || pg_temp.h11w_uuid('sup:revision')::text || '%', true,
  'the invalidation emitted its review-changed event [P2-S11-AC-112]');
select pg_temp.h11r_review('rv-sup2', jsonb_build_object('revision_id', pg_temp.h11w_uuid('sup2:revision'), 'entry_id', pg_temp.h11w_uuid('sup:entry')));
select pg_temp.h11w_revision('sup3', 'creatorPerson', 'en-US', '[]'::jsonb, 'sup', 4);
select is(pg_temp.h11i_state('rv-sup2'), 'invalidated/revision_superseded/v2/false',
  'the newest review is superseded by the next append in turn [P2-S11-AC-112]');
select pg_temp.h11r_review('rv-sup3', jsonb_build_object('revision_id', pg_temp.h11w_uuid('sup3:revision'), 'entry_id', pg_temp.h11w_uuid('sup:entry')));
select is(pg_temp.h11i_state('rv-sup3'), 'open/-/v1/false', 'a review of the newest revision stays live until a newer one lands [P2-S11-AC-112]');

select pg_temp.h11w_revision('sup-rej');
select pg_temp.h11r_review('rv-suprej', jsonb_build_object('revision_id', pg_temp.h11w_uuid('sup-rej:revision'), 'entry_id', pg_temp.h11w_uuid('sup-rej:entry')));
select pg_temp.h11r_assign('suprej-asg', 'rv-suprej', 'reviewer02');
select pg_temp.h11r_decide('suprej-dec', 'rv-suprej', 'reviewer02', 'suprej-asg', 'reject');
select pg_temp.h11w_revision('sup-rej2', 'creatorPerson', 'en-US', '[]'::jsonb, 'sup-rej', 2);
select is(pg_temp.h11i_state('rv-suprej'), 'rejected/-/v2/true', 'a rejected review is terminal and is not touched by a newer revision [P2-S11-AC-112]');

select pg_temp.h11w_revision('first');
select is((select count(*)::integer from platform_private.cms_editorial_reviews where entry_id = pg_temp.h11w_uuid('first:entry')), 0,
  'the first revision of an entry supersedes nothing [P2-S11-AC-112]');

-- ---------------------------------------------------------------------------
-- Producer 2: the entry leaving active.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('life');
select pg_temp.h11r_approved('rv-life', pg_temp.h11w_uuid('life:revision'), pg_temp.h11w_uuid('life:entry'), 'reviewer02');
select pg_temp.h11i_sched2('life-pending', 'life', 'rv-life', 'pending');
select pg_temp.h11i_token('t-life', pg_temp.h11w_uuid('life:entry'), pg_temp.h11w_uuid('life:revision'));
update platform_private.cms_content_entries set version = version + 1 where id = pg_temp.h11w_uuid('life:entry');
select is(pg_temp.h11i_state('rv-life'), 'approved/-/v2/true', 'an entry update that keeps the entry active invalidates nothing [P2-S11-AC-112]');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('life:entry');
select is(pg_temp.h11i_state('rv-life'), 'invalidated/entry_unavailable/v3/false', 'the entry leaving active invalidates its live review entry_unavailable [P2-S11-AC-112]');
select is((select state || '/' || reason_code from platform_private.cms_publication_schedules where id = pg_temp.s11_id('life-pending')), 'cancelled/entry_unavailable',
  'and cancels its schedule with entry_unavailable [P2-S11-AC-112]');
select is(pg_temp.h11i_tok('t-life'), 'revoked/v2/true', 'and revokes the entry''s unexpired preview token [P2-S11-AC-118]');

select pg_temp.h11w_revision('life2');
select pg_temp.h11i_token('t-life2', pg_temp.h11w_uuid('life2:entry'), pg_temp.h11w_uuid('life2:revision'));
update platform_private.cms_content_entries set lifecycle = 'held', version = version + 1 where id = pg_temp.h11w_uuid('life2:entry');
select is(pg_temp.h11i_tok('t-life2'), 'revoked/v2/true',
  'an entry with no live review still has its tokens revoked when it leaves active (held) [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Producer 3: loss of a counted approver's authority (cms_invalidate_reviews_for_person).
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('auth1'); select pg_temp.h11w_revision('auth2'); select pg_temp.h11w_revision('auth3');
select pg_temp.h11r_approved('rv-auth1', pg_temp.h11w_uuid('auth1:revision'), pg_temp.h11w_uuid('auth1:entry'), 'reviewer01');
select pg_temp.h11r_approved('rv-auth2', pg_temp.h11w_uuid('auth2:revision'), pg_temp.h11w_uuid('auth2:entry'), 'reviewer01');
select pg_temp.h11r_approved('rv-auth3', pg_temp.h11w_uuid('auth3:revision'), pg_temp.h11w_uuid('auth3:entry'), 'reviewer02');
select is(pg_temp.h11_text(format('select platform_private.cms_invalidate_reviews_for_person(%L::uuid, null)', pg_temp.s11_id('reviewer01'))), '0',
  'while the approver still qualifies nothing is invalidated (the call is safe to repeat) [P2-S11-AC-112]');
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer01') and capability_code = 'cms.reviewer.policy';
select is(pg_temp.h11i_state('rv-auth1'), 'approved/-/v2/true',
  'losing a capability the approver did not rely on (the policy slot) leaves the review approved [P2-S11-AC-112]');
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer01') and capability_code = 'cms.reviewer';
select is(pg_temp.h11i_state('rv-auth1'), 'invalidated/reviewer_authority_changed/v3/false',
  'revoking the standing capability of the satisfied slot invalidates the approved review in the revoking transaction [P2-S11-AC-112]');
select is(pg_temp.h11i_state('rv-auth2'), 'invalidated/reviewer_authority_changed/v3/false',
  'every live review the approver counted in is invalidated [P2-S11-AC-112]');
select is(pg_temp.h11i_state('rv-auth3'), 'approved/-/v2/true', 'a review counted by another approver is untouched [P2-S11-AC-112]');
select is(pg_temp.h11_text(format('select platform_private.cms_invalidate_reviews_for_person(%L::uuid, null)', pg_temp.s11_id('reviewer01'))), '0',
  'a repeat after the trigger finds no live review: idempotent [P2-S11-AC-113]');

update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer02');
select is(pg_temp.h11i_state('rv-auth3'), 'invalidated/reviewer_authority_changed/v3/false',
  'ending the approver''s tenure invalidates the reviews they counted in [P2-S11-AC-112]');

-- capability filter of the direct call
select pg_temp.h11w_revision('auth4');
select pg_temp.h11r_member('reviewer03', array['cms.reviewer']);
select pg_temp.h11r_review('rv-auth4', jsonb_build_object('revision_id', pg_temp.h11w_uuid('auth4:revision'), 'entry_id', pg_temp.h11w_uuid('auth4:entry'),
  'risk_class', 'protected', 'required_decision_count', 2, 'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')));
select pg_temp.h11r_assign('auth4-asg', 'rv-auth4', 'reviewer03');
select pg_temp.h11r_decide('auth4-dec', 'rv-auth4', 'reviewer03', 'auth4-asg', 'approve', 'cms.reviewer');
update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('auth4-asg');
select is(pg_temp.h11_text(format('select platform_private.cms_invalidate_reviews_for_person(%L::uuid, %L)', pg_temp.s11_id('reviewer03'), 'cms.reviewer.policy')), '0',
  'the capability argument filters by the slot a decision satisfied: a policy-slot call ignores a base-slot approve [P2-S11-AC-112]');
select is(pg_temp.h11_text(format('select platform_private.cms_invalidate_reviews_for_person(%L::uuid, %L)', pg_temp.s11_id('reviewer03'), 'cms.reviewer')), '1',
  'the base-slot call finds the approve whose assignment is revoked and invalidates its review [P2-S11-AC-112]');
select is(pg_temp.h11i_state('rv-auth4'), 'invalidated/reviewer_authority_changed/v3/false', 'the review is invalidated [P2-S11-AC-112]');
select is(pg_temp.h11_outcome('select platform_private.cms_invalidate_reviews_for_person(null, null)'), 'P0001:INVALID_REQUEST',
  'a null person is a malformed call [P2-S11-AC-112]');

-- Assignment revocation alone does NOT invalidate (CMS-03B-18 only recounts): see NOTES, spec contradiction.
select pg_temp.h11w_revision('asg');
select pg_temp.h11r_review('rv-asg', jsonb_build_object('revision_id', pg_temp.h11w_uuid('asg:revision'), 'entry_id', pg_temp.h11w_uuid('asg:entry'),
  'risk_class', 'protected', 'required_decision_count', 2, 'required_capabilities', jsonb_build_array('cms.reviewer', 'cms.reviewer.policy')));
select pg_temp.h11r_assign('asg-asg', 'rv-asg', 'reviewer01');
select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
select pg_temp.h11r_decide('asg-dec', 'rv-asg', 'reviewer01', 'asg-asg', 'approve', 'cms.reviewer');
update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp() where id = pg_temp.s11_id('asg-asg');
select is(pg_temp.h11i_state('rv-asg'), 'open/-/v2/false',
  'revoking a counted approver''s assignment on an open review only recounts: no review version bump (CMS-03B-18) [P2-S11-AC-119]');

-- ---------------------------------------------------------------------------
-- Preview scope (assignee, reviewer assignee, owner-party publisher) and its loss.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11i_scope(p_person text, p_entry uuid, p_revision uuid)
returns text
language sql
as $body$
  select pg_temp.h11_text(format('select platform_private.cms_preview_scope_holds(%L::uuid, %L::uuid, %L::uuid, %L::uuid)',
    pg_temp.s11_id(p_person), pg_temp.s11_id('org'), p_entry, p_revision))
$body$;

select is(pg_temp.h11i_scope('creator', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1')), 'true', 'an entry assignee with the standing capability holds preview scope [P2-S11-AC-118]');
select is(pg_temp.h11i_scope('outsider', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1')), 'false', 'a member with no assignment, review assignment or publisher grant does not [P2-S11-AC-118]');
select is(pg_temp.h11i_scope('reviewer04', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1')), 'true', 'an owner-party cms.publisher holds preview scope without an assignment [P2-S11-AC-118]');
select is(pg_temp.h11i_scope('creator', pg_temp.s11_id('entryB'), pg_temp.s11_id('revA1')), 'false', 'a revision that does not belong to the entry never carries scope [P2-S11-AC-118]');
select is(pg_temp.h11i_scope('reviewer01', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA2')), 'true',
  'an active reviewer assignee of a review of the revision holds preview scope [P2-S11-AC-118]');
select is(pg_temp.h11i_scope('reviewer01', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1')), 'false',
  '... only for the revision that review is of [P2-S11-AC-118]');
select is(pg_temp.h11_text('select platform_private.cms_preview_scope_holds(null, null, null, null)'), 'false', 'null arguments hold no scope [P2-S11-AC-118]');

-- DEC-143 pattern: losing the assignment revokes the minter's tokens on that entry, in the same transaction.
select pg_temp.h11i_token('t-scope-c', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1'), 'creator');
select pg_temp.h11i_token('t-scope-e', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1'), 'editor');
select pg_temp.h11i_token('t-scope-p', pg_temp.s11_id('entryA'), pg_temp.s11_id('revA1'), 'reviewer04');
update platform_private.cms_entry_assignments set state = 'revoked', version = version + 1
 where entry_id = pg_temp.s11_id('entryA') and assignee_person_id = pg_temp.s11_id('creator');
select is(pg_temp.h11i_tok('t-scope-c'), 'revoked/v2/true', 'revoking the creator''s assignment revokes the creator''s token on that entry [P2-S11-AC-118]');
select is(pg_temp.h11i_tok('t-scope-e'), 'active/v1/false', 'the editor''s token (own assignment) is untouched [P2-S11-AC-118]');
update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('reviewer04');
select is(pg_temp.h11i_tok('t-scope-p'), 'revoked/v2/true', 'ending the publisher''s tenure revokes the publisher''s token [P2-S11-AC-118]');
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.s11_id('org') and person_id = pg_temp.s11_id('editor') and capability_code = 'cms.editor';
select is(pg_temp.h11i_tok('t-scope-e'), 'revoked/v2/true', 'deactivating the editor''s standing grant (which also revokes the assignment, DEC-143) revokes the editor''s token [P2-S11-AC-118]');

-- ---------------------------------------------------------------------------
-- Posture.
-- ---------------------------------------------------------------------------
select is(
  (select string_agg(t.tgname, ',' order by t.tgname) from pg_trigger t
    where not t.tgisinternal and t.tgname in ('cms_content_entries_review_invalidation', 'cms_entry_revisions_review_invalidation',
      'cms_membership_tenure_review_authority', 'cms_organization_actor_grant_review_authority')),
  'cms_content_entries_review_invalidation,cms_entry_revisions_review_invalidation,cms_membership_tenure_review_authority,cms_organization_actor_grant_review_authority',
  'the producer triggers exist on the entry, the revision, the tenure and the actor grant [P2-S11-AC-112]');
select is(
  (select string_agg(t.tgname, ',' order by t.tgname) from pg_trigger t
    where not t.tgisinternal and t.tgname like 'cms_%_preview_scope'),
  'cms_editorial_review_assignments_preview_scope,cms_entry_assignments_preview_scope',
  'the preview-scope triggers exist on the entry and review assignments [P2-S11-AC-118]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_invalidate_editorial_review', 'cms_invalidate_reviews_for_person', 'cms_revoke_active_preview_tokens',
                        'cms_preview_scope_holds', 'cms_revoke_tokens_without_scope')),
  5, 'exactly one overload of each invalidation helper exists [P2-S11-AC-111]');

select * from finish();
rollback;
