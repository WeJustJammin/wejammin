-- Slice 10 Round 2 item 5 (Codex lint finding): cms_localization_fanout runs its
-- dependent-locale preflight branch.
--
-- The wrapper (20261005010900) declared PL/pgSQL variables named source_locale and
-- source_hash and then read cms_locale_variants.source_locale / .source_hash
-- unqualified inside the preflight count, so PostgreSQL raised 42702 (column
-- reference is ambiguous) on EVERY call that passed the argument guards.  The
-- earlier regression only reached the argument guards and the structural
-- pg_get_functiondef check, so the branch that counts latest dependent locales
-- against p_limit and delegates to the canonical producer never executed.
--
-- This suite executes that branch end to end against real locale variants:
-- an empty fan-out answers 0; an over-limit fan-out is refused before anything is
-- written; an exact-limit fan-out appends one stale variant and one deduped
-- outbox event per dependent locale and answers the count; a replay appends nothing.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(15);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select set_config('app.cms_rpc', 'true', true);

-- No dependent locale exists yet: the preflight runs and the producer appends none.
select is(
  platform_private.cms_localization_fanout(
    (select value::uuid from s10_ids where key = 'entryId'),
    (select value::uuid from s10_ids where key = 'entryRevisionId'),
    32
  ),
  0,
  'a fan-out over an entry with no dependent locale runs its preflight and answers 0'
);

-- Three approved dependent locales of the en-US source revision 302.  A variant binds
-- a translation revision of its own locale to the source revision and pins the source
-- payload hash it was translated from.
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select dependent.revision_id::uuid,
       (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'entryId'),
       dependent.revision_number, (select value::uuid from s10_ids where key = 'draftVersionId'),
       null, '[]'::jsonb, '[]'::jsonb, dependent.locale, repeat(dependent.hash_digit, 64),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       (select value::uuid from s10_ids where key = 'organization'),
       'draft', 1, 'unknown', '{}'::jsonb,
       timestamptz '2026-09-27T12:00:00Z', timestamptz '2026-09-27T12:00:00Z'
from (values
  ('a9160000-0000-4000-8000-000000000002', 2, 'de-DE', 'b'),
  ('a9160000-0000-4000-8000-000000000003', 3, 'fr-FR', 'c'),
  ('a9160000-0000-4000-8000-000000000004', 4, 'es-ES', 'd')
) dependent(revision_id, revision_number, locale, hash_digit);

insert into platform_private.cms_locale_variants(
  id, owner_id, state, version, created_at, updated_at, entry_id, revision_id,
  source_revision_id, locale, source_locale, source_hash, created_by
)
select extensions.gen_random_uuid(),
       (select value::uuid from s10_ids where key = 'organization'),
       'approved', 1, timestamptz '2026-09-27T12:00:00Z', timestamptz '2026-09-27T12:00:00Z',
       (select value::uuid from s10_ids where key = 'entryId'),
       dependent.revision_id::uuid,
       (select value::uuid from s10_ids where key = 'entryRevisionId'),
       dependent.locale, 'en-US',
       (select payload_hash from platform_private.cms_entry_revisions
         where id = (select value::uuid from s10_ids where key = 'entryRevisionId')),
       (select value::uuid from s10_ids where key = 'creatorAuth')
from (values
  ('a9160000-0000-4000-8000-000000000002', 'de-DE'),
  ('a9160000-0000-4000-8000-000000000003', 'fr-FR'),
  ('a9160000-0000-4000-8000-000000000004', 'es-ES')
) dependent(revision_id, locale);

-- A newer en-US source revision with a different payload.  Its insert trigger
-- (cms_entry_revisions_locale_stale) would stale the dependents at once, so the
-- fixture inserts it with triggers disabled to hold the state the wrapper's
-- preflight must count: three latest dependents still pinned to the old hash.
set local session_replication_role = replica;
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select 'a9160000-0000-4000-8000-000000000005',
       (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'entryId'),
       5, (select value::uuid from s10_ids where key = 'draftVersionId'),
       null, '[]'::jsonb, '[]'::jsonb, 'en-US', repeat('e', 64),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       (select value::uuid from s10_ids where key = 'organization'),
       'draft', 1, 'unknown', '{}'::jsonb,
       timestamptz '2026-09-27T12:30:00Z', timestamptz '2026-09-27T12:30:00Z';
set local session_replication_role = origin;
create temp table fanout_source on commit drop as
select 'a9160000-0000-4000-8000-000000000005'::uuid as revision_id;

create temp table fanout_before on commit drop as
select (select count(*) from platform_private.cms_locale_variants) as variants,
       (select count(*) from platform_private.outbox_events
         where event_type = 'cms.localization.changed.v1') as events;

select throws_ok(
  $$select platform_private.cms_localization_fanout(
      (select value::uuid from s10_ids where key = 'entryId'),
      (select revision_id from fanout_source), 2)$$,
  'P0001', 'LOCALE_FANOUT_LIMIT',
  'three dependent locales over a limit of two are refused, never truncated'
);

select ok(
  (select variants from fanout_before)
    = (select count(*) from platform_private.cms_locale_variants)
  and (select events from fanout_before)
    = (select count(*) from platform_private.outbox_events
        where event_type = 'cms.localization.changed.v1'),
  'the over-limit refusal appended no stale variant and no outbox event'
);

select is(
  platform_private.cms_localization_fanout(
    (select value::uuid from s10_ids where key = 'entryId'),
    (select revision_id from fanout_source),
    3
  ),
  3,
  'a fan-out at exactly the limit answers the number of dependent locales'
);

select is(
  (select count(*)::integer from platform_private.cms_locale_variants
    where state = 'stale'
      and entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  3,
  'one stale variant is appended per dependent locale'
);

select is(
  (select count(*)::integer - (select events::integer from fanout_before)
     from platform_private.outbox_events
    where event_type = 'cms.localization.changed.v1'),
  3,
  'one localization event is emitted per dependent locale'
);

select is(
  (select count(distinct event.payload ->> 'locale')::integer
     from platform_private.outbox_events event
    where event.event_type = 'cms.localization.changed.v1'
      and event.payload ->> 'entryId'
        = (select value from s10_ids where key = 'entryId')),
  3,
  'the events name three distinct locales'
);

select is(
  platform_private.cms_localization_fanout(
    (select value::uuid from s10_ids where key = 'entryId'),
    (select revision_id from fanout_source),
    1
  ),
  0,
  'a replay finds every latest dependent already stale and answers 0 within any limit'
);

select is(
  (select count(*)::integer from platform_private.cms_locale_variants
    where state = 'stale'
      and entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  3,
  'the replay appended no further stale variant'
);

select throws_ok(
  $$select platform_private.cms_localization_fanout(
      'a9100000-0000-4000-8000-000000000399'::uuid,
      (select value::uuid from s10_ids where key = 'entryRevisionId'), 32)$$,
  'P0001', 'LOCALE_FANOUT_ENTRY_MISMATCH',
  'a revision of another entry cannot fan out the requested entry'
);

select throws_ok(
  $$select platform_private.cms_localization_fanout(
      (select value::uuid from s10_ids where key = 'entryId'),
      (select value::uuid from s10_ids where key = 'entryRevisionId'), 0)$$,
  'P0001', 'LOCALE_FANOUT_LIMIT',
  'a limit below one is refused'
);

select finish();
rollback;
