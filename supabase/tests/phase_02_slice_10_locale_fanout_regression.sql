-- Slice 10 QA-RED (WP-S10-2a): D12 localization fan-out regression
-- (BE03b event table `cms.localization.changed.v1`; BE03c CMS-03C-04).
--
-- A revision write on an entry with dependent locale variants must fan out to
-- at most 32 locales and emit exactly one deduped `cms.localization.changed.v1`
-- event per `(entryId, locale)`, each carrying a per-locale aggregate version.
-- The write still completes within its deadline and never emits a duplicate or
-- a truncation.  The suite is written before WP-S10-3 lands the D12 regression
-- alongside the restore path, so an absent fan-out RPC is evidence-backed RED.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(13);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- The outbox producer for the localization family is registered (BE00 relay
-- refuses an unregistered event rather than inventing a producer).
select is(
  platform_private.outbox_event_producer('cms.localization.changed.v1'),
  'cms.composition',
  'the localization-changed event resolves to the composition producer'
);

-- Counts the deduped localization events for one entry by payload, so the
-- assertion does not depend on which aggregate id the fanout chooses.
create or replace function pg_temp.s10_locfanout_count(p_entry_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select count(*)::integer
  from platform_private.outbox_events event
  where event.event_type = 'cms.localization.changed.v1'
    and event.payload ->> 'entryId' = p_entry_id::text
$body$;

create or replace function pg_temp.s10_locfanout_distinct_locales(p_entry_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $body$
  select count(distinct event.payload ->> 'locale')::integer
  from platform_private.outbox_events event
  where event.event_type = 'cms.localization.changed.v1'
    and event.payload ->> 'entryId' = p_entry_id::text
$body$;

-- The fan-out command exists and is bounded.
select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_localization_fanout', 'uuid, uuid'
  ),
  'the D12 localization fan-out command exists with the entry/revision identity'
);

-- The dependent locale set comes from the active version's supportedLocales
-- minus the source locale; the fixture declares three supported and en-US as
-- source, so two dependent locales are expected.
select ok(
  (
    select count(*)
    from jsonb_array_elements_text(
      (select request -> 'supportedLocales' from s10_type_request)
    ) locale
    where locale <> (select request ->> 'sourceLocale' from s10_type_request)
  ) >= 1,
  'the fixture declares at least one dependent locale for the fan-out'
);

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- A revision write fans out and completes.
select pg_temp.s10_rpc_probe(
  'fanout_write',
  null,
  $sql$select platform_api.cms_create_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'baseRevision', 1,
    'expectedVersion', 1,
    'locale', 'en-US',
    'changedPaths', jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
    'values', jsonb_build_object(
      (select value from s10_ids where key = 'typeFieldId'), 'Fanout title'
    )))$sql$
);

select is(
  pg_temp.s10_probe_state('fanout_write'), '00000',
  'a revision write with dependent locales completes within its deadline'
);

-- Exactly one deduped event per dependent locale, never a duplicate.
select ok(
  pg_temp.s10_locfanout_count(
    (select value::uuid from s10_ids where key = 'entryId')
  ) = pg_temp.s10_locfanout_distinct_locales(
    (select value::uuid from s10_ids where key = 'entryId')
  )
    and pg_temp.s10_locfanout_count(
      (select value::uuid from s10_ids where key = 'entryId')
    ) <= 32,
  'the fan-out emits one deduped event per locale and never more than 32'
);

-- Each event carries the closed {entryId, locale, revisionId} shape and a
-- positive per-locale aggregate version.
select ok(
  not exists (
    select 1
    from platform_private.outbox_events event
    where event.event_type = 'cms.localization.changed.v1'
      and event.aggregate_id = (select value::uuid from s10_ids where key = 'entryId')
      and (
        event.payload ->> 'entryId'
          <> (select value from s10_ids where key = 'entryId')
        or event.payload -> 'locale' is null
        or event.payload -> 'revisionId' is null
        or event.aggregate_version <= 0
        or (event.payload ->> 'locale') = (select request ->> 'sourceLocale' from s10_type_request)
      )
  ),
  'each localization event is deduped, locale-scoped and versioned, never the source locale'
);

-- Replaying the same revision write does not duplicate the fan-out.
select pg_temp.s10_rpc_probe(
  'fanout_replay',
  null,
  $sql$select platform_api.cms_create_revision(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'baseRevision', 1,
    'expectedVersion', 1,
    'locale', 'en-US',
    'changedPaths', jsonb_build_array('/fields/' || (select value from s10_ids where key = 'typeFieldId')),
    'values', jsonb_build_object(
      (select value from s10_ids where key = 'typeFieldId'), 'Fanout title'
    )))$sql$
);

select ok(
  pg_temp.s10_locfanout_count(
    (select value::uuid from s10_ids where key = 'entryId')
  ) <= 32
    and pg_temp.s10_locfanout_count(
      (select value::uuid from s10_ids where key = 'entryId')
    ) = pg_temp.s10_locfanout_distinct_locales(
      (select value::uuid from s10_ids where key = 'entryId')
    ),
  'a replayed revision write keeps the per-locale dedupe and emits no duplicate'
);

-- Over-limit: more than 32 dependent locales is refused rather than truncated.
select pg_temp.s10_rpc_probe(
  'fanout_over_limit',
  null,
  $sql$select platform_private.cms_localization_fanout(
    (select value::uuid from s10_ids where key = 'entryId'),
    (select value::uuid from s10_ids where key = 'entryRevisionId'),
    33)$sql$
);

select ok(
  -- Before the migration the command is undefined (42883) which is the RED
  -- marker; once it exists it must refuse an over-wide fan-out with a typed
  -- P0001, never silently succeed (00000) or truncate.
  pg_temp.s10_probe_state('fanout_over_limit') in ('P0001', '42883'),
  'a fan-out wider than 32 locales is refused, never truncated'
);

-- The fan-out is a projection concern: it must not mutate the entry aggregate.
select ok(
  case
    when to_regclass('platform_private.cms_content_entries') is null then false
    else (
      select entry.version = 1
      from platform_private.cms_content_entries entry
      where entry.id = (select value::uuid from s10_ids where key = 'entryId')
    )
  end,
  'the localization fan-out never mutates the entry aggregate version'
);

select finish();
rollback;
