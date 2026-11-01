-- Slice 12 CMS-03C-04 locale variant authoring, completed (BE03c Route Registry 162, route
-- field validation matrix 382-388, Locale field resolution and fan-out (D12) 1387-1397,
-- LocaleVariant table 1431, Event schemas 1555).  Criteria: P2-S12-AC-054..057, AC-233..237,
-- AC-260.  RED before the 20261014050xxx locale migrations, GREEN after.
--
-- Fixture: the Slice 10 RPC world (organisation, creator with author and editor grants, an
-- active `article` type with fr-FR/de-DE chains to en-US, an entry with one en-US source
-- revision).  Variants are authored through the real RPC; the only hand-written rows are the
-- thirty-one further locale variants of the ceiling case (labelled in 002) and the source
-- revisions appended exactly as phase_02_slice_12_locale_source_stale.sql appends them.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(97);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_locale_variant/000-helpers.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

\ir phase_02_slice_12_locale_variant/001-persistence-and-write.sqlinc
\ir phase_02_slice_12_locale_variant/003-contract-and-idempotency.sqlinc
\ir phase_02_slice_12_locale_variant/002-limit-and-fanout.sqlinc
\ir phase_02_slice_12_locale_variant/004-relay-source-race-grants.sqlinc
\ir phase_02_slice_12_locale_variant/005-fanout-trigger-and-writers.sqlinc

select * from finish();
rollback;
