-- Slice 11 criteria: P2-S11-AC-112, review invalidation producers: "... the entry lifecycle leaving `active`
-- (`archived`, `deletion_pending`, `held`) yields `entry_unavailable`."  The older suite asserts `archived` for a live
-- review and `held` only for the tokens of an entry with no live review.  This suite drives all three states, for an
-- approved and an open review, with a pending schedule and an unexpired preview token on the entry:
--   review  invalidated / entry_unavailable (version + 1)       schedule  cancelled / entry_unavailable
--   token   revoked (version + 1, revoked_at)                   one review-changed event and one audit record
-- and proves the trigger fires only on the transition OUT of `active` (a later move between non-active states and an
-- update that keeps the entry active invalidate nothing further).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

select pg_temp.h11r_member('reviewer02', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer04', array['cms.publisher']);

create or replace function pg_temp.c11_state(p_review text)
returns text
language sql
as $body$
  select state || '/' || coalesce(invalidated_reason, '-') || '/v' || version::text || '/' || (decided_at is not null)::text
    from platform_private.cms_editorial_reviews where id = pg_temp.s11_id(p_review)
$body$;

create or replace function pg_temp.c11_schedule(p_key text, p_tag text, p_review text, p_state text)
returns void
language plpgsql
as $body$
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text) on conflict (key) do nothing;
  perform pg_temp.h11_raw_insert('platform_private.cms_publication_schedules',
    pg_temp.s11_schedule_row(jsonb_build_object(
      'id', pg_temp.s11_id(p_key), 'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
      'revision_id', pg_temp.h11w_uuid(p_tag || ':revision'), 'review_id', pg_temp.s11_id(p_review),
      'state', p_state, 'action', 'publish', 'created_by', pg_temp.s11_id('reviewer04'),
      'audience', 'aud' || (abs(hashtext(p_key)) % 100000)::text,
      'resolved_at_utc', timestamptz '2027-01-15T08:00:00Z')));
end;
$body$;

create or replace function pg_temp.c11_token(p_key text, p_entry uuid, p_revision uuid)
returns void
language plpgsql
as $body$
declare
  created timestamptz := clock_timestamp();
begin
  insert into s11_ids(key, value) values (p_key, extensions.gen_random_uuid()::text) on conflict (key) do nothing;
  execute pg_temp.s11_insert_sql('platform_private.cms_preview_tokens', pg_temp.s11_token_row(jsonb_build_object(
    'id', pg_temp.s11_id(p_key), 'entry_id', p_entry, 'revision_id', p_revision,
    'person_id', pg_temp.s11_id('creator'), 'created_at', created, 'updated_at', created,
    'expires_at', created + interval '15 minutes')));
end;
$body$;

create or replace function pg_temp.c11_token_state(p_key text)
returns text
language sql
as $body$
  select state || '/v' || version::text || '/' || (revoked_at is not null)::text
    from platform_private.cms_preview_tokens where id = pg_temp.s11_id(p_key)
$body$;

-- The review, its schedule and its token as one string, plus the number of events and audit rows for the review.
create or replace function pg_temp.c11_effects(p_tag text)
returns text
language sql
as $body$
  select pg_temp.c11_state('rv-' || p_tag)
    || '|' || coalesce((select state || '/' || coalesce(reason_code, '-') from platform_private.cms_publication_schedules
                         where id = pg_temp.s11_id('s-' || p_tag)), 'no-schedule')
    || '|' || coalesce(pg_temp.c11_token_state('t-' || p_tag), 'no-token')
    || '|' || (select count(*) from platform_private.outbox_events event
                where event.event_type = 'cms.entry.review-changed.v1' and event.payload->>'reviewId' = pg_temp.s11_id('rv-' || p_tag)::text)::text
    || '|' || (select count(*) from audit_private.audit_events audit
                where audit.target_id = pg_temp.s11_id('rv-' || p_tag) and audit.action = 'cms.entry.review.invalidate')::text
$body$;

-- ---------------------------------------------------------------------------
-- Fixtures: an approved review (with a pending schedule and a token) and an open review per target lifecycle.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision(tag) from (values ('lc-archived'), ('lc-deletion_pending'), ('lc-held'),
  ('lo-archived'), ('lo-deletion_pending'), ('lo-held'), ('lc-keep')) as t(tag);
select pg_temp.h11r_approved('rv-' || tag, pg_temp.h11w_uuid(tag || ':revision'), pg_temp.h11w_uuid(tag || ':entry'), 'reviewer02')
  from (values ('lc-archived'), ('lc-deletion_pending'), ('lc-held'), ('lc-keep')) as t(tag);
select pg_temp.h11r_review('rv-' || tag, jsonb_build_object('revision_id', pg_temp.h11w_uuid(tag || ':revision'), 'entry_id', pg_temp.h11w_uuid(tag || ':entry')))
  from (values ('lo-archived'), ('lo-deletion_pending'), ('lo-held')) as t(tag);
select pg_temp.c11_schedule('s-' || tag, tag, 'rv-' || tag, 'pending')
  from (values ('lc-archived'), ('lc-deletion_pending'), ('lc-held'), ('lc-keep')) as t(tag);
select pg_temp.c11_token('t-' || tag, pg_temp.h11w_uuid(tag || ':entry'), pg_temp.h11w_uuid(tag || ':revision'))
  from (values ('lc-archived'), ('lc-deletion_pending'), ('lc-held'), ('lc-keep')) as t(tag);

select is(
  (select string_agg(tag || '=' || pg_temp.c11_effects(tag), ' ' order by tag)
     from (values ('lc-archived'), ('lc-deletion_pending'), ('lc-held')) as t(tag)),
  'lc-archived=approved/-/v2/true|pending/-|active/v1/false|0|0 lc-deletion_pending=approved/-/v2/true|pending/-|active/v1/false|0|0 lc-held=approved/-/v2/true|pending/-|active/v1/false|0|0',
  'control: three approved reviews, each with a pending schedule and an unexpired token, on active entries [P2-S11-AC-112]');

-- An update that keeps the entry active invalidates nothing.
update platform_private.cms_content_entries set version = version + 1 where id = pg_temp.h11w_uuid('lc-keep:entry');
select is(pg_temp.c11_effects('lc-keep'), 'approved/-/v2/true|pending/-|active/v1/false|0|0',
  'an entry update that keeps the entry active invalidates nothing [P2-S11-AC-112]');

-- ---------------------------------------------------------------------------
-- The entry leaves `active`.
-- ---------------------------------------------------------------------------
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('lc-archived:entry');
select is(pg_temp.c11_effects('lc-archived'), 'invalidated/entry_unavailable/v3/false|cancelled/entry_unavailable|revoked/v2/true|1|1',
  'archived: the approved review is invalidated entry_unavailable, its pending schedule cancelled, its token revoked, one event, one audit row [P2-S11-AC-112]');
update platform_private.cms_content_entries set lifecycle = 'deletion_pending', version = version + 1 where id = pg_temp.h11w_uuid('lc-deletion_pending:entry');
select is(pg_temp.c11_effects('lc-deletion_pending'), 'invalidated/entry_unavailable/v3/false|cancelled/entry_unavailable|revoked/v2/true|1|1',
  'deletion_pending: the same cascade [P2-S11-AC-112]');
update platform_private.cms_content_entries set lifecycle = 'held', version = version + 1 where id = pg_temp.h11w_uuid('lc-held:entry');
select is(pg_temp.c11_effects('lc-held'), 'invalidated/entry_unavailable/v3/false|cancelled/entry_unavailable|revoked/v2/true|1|1',
  'held: the same cascade for an entry with a live approved review, a pending schedule and a token [P2-S11-AC-112]');

update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('lo-archived:entry');
update platform_private.cms_content_entries set lifecycle = 'deletion_pending', version = version + 1 where id = pg_temp.h11w_uuid('lo-deletion_pending:entry');
update platform_private.cms_content_entries set lifecycle = 'held', version = version + 1 where id = pg_temp.h11w_uuid('lo-held:entry');
select is(
  (select string_agg(tag || '=' || pg_temp.c11_state('rv-' || tag), ' ' order by tag)
     from (values ('lo-archived'), ('lo-deletion_pending'), ('lo-held')) as t(tag)),
  'lo-archived=invalidated/entry_unavailable/v2/false lo-deletion_pending=invalidated/entry_unavailable/v2/false lo-held=invalidated/entry_unavailable/v2/false',
  'an open review is invalidated entry_unavailable (version 2) when its entry becomes archived, deletion_pending or held [P2-S11-AC-112]');
select is(
  (select count(*) from platform_private.outbox_events event
    where event.event_type = 'cms.entry.review-changed.v1'
      and event.payload->>'reviewId' in (select pg_temp.s11_id('rv-' || tag)::text from (values ('lo-archived'), ('lo-deletion_pending'), ('lo-held')) as t(tag))
      and event.aggregate_version = 2),
  3::bigint,
  'each open review emitted exactly one review-changed event at its new version [P2-S11-AC-112]');

-- The trigger fires only on the transition out of `active`.
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('lc-held:entry');
select is(pg_temp.c11_effects('lc-held'), 'invalidated/entry_unavailable/v3/false|cancelled/entry_unavailable|revoked/v2/true|1|1',
  'a later move between non-active states (held to archived) invalidates nothing further and emits no second event [P2-S11-AC-112]');
update platform_private.cms_content_entries set lifecycle = 'active', version = version + 1 where id = pg_temp.h11w_uuid('lc-held:entry');
select is(pg_temp.c11_effects('lc-held'), 'invalidated/entry_unavailable/v3/false|cancelled/entry_unavailable|revoked/v2/true|1|1',
  'returning the entry to active does not revive the invalidated review, the cancelled schedule or the revoked token [P2-S11-AC-112]');
select is(pg_temp.c11_effects('lc-keep'), 'approved/-/v2/true|pending/-|active/v1/false|0|0',
  'control: the review of the entry that never left active is still approved with its schedule pending and token active [P2-S11-AC-112]');

select * from finish();
rollback;
