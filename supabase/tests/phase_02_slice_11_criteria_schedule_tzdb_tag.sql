-- Slice 11 criteria: P2-S11-AC-103, Time authority (E8): "... `platform_private.cms_tzdb_version()` ... advanced only by
-- code plus a forward migration, with stored schedules keeping the version and instant they were accepted with and
-- recording the tag only."  The older suites prove that acceptance stores the pinned tag and that the accepted instant
-- is immutable; this suite proves the rest of the clause:
--   * the stored tag is itself immutable (the guard refuses any UPDATE of `tzdb_version`) and its grammar CHECK refuses
--     an empty tag and one over 32 bytes;
--   * after the pin advances (a forward migration redefines `cms_tzdb_version()`, simulated inside the test
--     transaction) a schedule accepted under the older tag keeps that tag and its accepted instant, the command refuses
--     a request that still names the older tag (422 tzdb_version_mismatch carrying the new pin) and accepts the new one,
--     and a schedule accepted under the older tag is claimed and executed against its STORED instant, keeping the tag.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(22);

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

select pg_temp.p11_approved(tag) from (values ('tz-accepted'), ('tz-old'), ('tz-bare')) as t(tag);

-- A schedule row image of an approved review (what p11_schedule_row inserts), for the CHECK probes.
create or replace function pg_temp.c11_image(p_tag text, p_overrides jsonb)
returns jsonb
language plpgsql
as $body$
declare
  review platform_private.cms_editorial_reviews := pg_temp.p11_review(p_tag);
  due timestamptz := date_trunc('second', clock_timestamp()) - interval '1 minute';
begin
  perform set_config('app.cms_rpc', 'true', true);
  return pg_temp.s11_schedule_row(jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'entry_id', review.entry_id, 'revision_id', review.revision_id,
    'review_id', review.id, 'dependency_hash', review.dependency_hash,
    'activation_evidence_hash', platform_private.cms_activation_evidence_hash(review.id),
    'expected_version', review.version, 'created_by', pg_temp.s11_id('pub'),
    'local_datetime', due at time zone 'UTC', 'timezone', 'UTC', 'resolved_at_utc', due) || p_overrides);
end;
$body$;

-- '<tzdb_version>@<resolved_at_utc>@<local_datetime>@<timezone>' of a schedule row.
create or replace function pg_temp.c11_stored(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select schedule.tzdb_version || '@' || schedule.resolved_at_utc::text || '@' || schedule.local_datetime::text || '@' || schedule.timezone
    from platform_private.cms_publication_schedules schedule where schedule.id = p_id
$body$;

-- The release this suite starts from, and a schedule accepted under it through the real command (CMS-03B-07).
create temp table c11_pin on commit drop as select platform_private.cms_tzdb_version() as tag;
create temp table c11_req on commit drop as select pg_temp.p11_sreq('tz-accepted') as request;
select pg_temp.p11_call('accept-old', 'pub', 'cms_schedule_publication', (select request from c11_req));
-- A second schedule, stored under an earlier release tag by the row builder (due a minute ago, so it is claimable).
select pg_temp.p11_schedule_row('s-tz-old', 'tz-old', jsonb_build_object('tzdb_version', '2025c'));
create temp table c11_old on commit drop as
  select pg_temp.c11_stored(pg_temp.s11_id('s-tz-old')) as stored;

select is(pg_temp.r11_out('accept-old') || '|' || coalesce(pg_temp.r11_resp('accept-old')->>'tzdbVersion', '-'),
  '00000:|' || (select tag from c11_pin),
  'control: the command stores the pinned tag it was accepted under [P2-S11-AC-103]');
select is((select stored from c11_old), '2025c@' || (select resolved_at_utc::text from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-tz-old'))
    || '@' || (select local_datetime::text from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-tz-old')) || '@UTC',
  'control: the second schedule is stored under the earlier release tag 2025c [P2-S11-AC-103]');

-- ---------------------------------------------------------------------------
-- The stored tag is immutable and its grammar is checked.
-- ---------------------------------------------------------------------------
select is(pg_temp.s11_outcome(format(
    'update platform_private.cms_publication_schedules set tzdb_version = %L, version = version + 1, updated_at = clock_timestamp() where id = %L',
    (select tag from c11_pin), pg_temp.s11_id('s-tz-old'))),
  'P0001:IMMUTABLE_RECORD',
  'a stored schedule''s tzdb_version cannot be moved to the current pin: IMMUTABLE_RECORD [P2-S11-AC-103]');
select is(pg_temp.s11_outcome(format(
    'update platform_private.cms_publication_schedules set tzdb_version = %L, version = version + 1, updated_at = clock_timestamp() where id = %L',
    'rewritten', pg_temp.s11_id('s-tz-old'))),
  'P0001:IMMUTABLE_RECORD',
  'nor to any other tag: IMMUTABLE_RECORD, and the stored row is unchanged [P2-S11-AC-103]');
select is(pg_temp.c11_stored(pg_temp.s11_id('s-tz-old')), (select stored from c11_old),
  'after the refused updates the stored tag, instant, local time and zone are exactly as accepted [P2-S11-AC-103]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_publication_schedules',
    pg_temp.s11_insert_sql('platform_private.cms_publication_schedules', pg_temp.c11_image('tz-bare', jsonb_build_object('tzdb_version', '')))),
  '23514', 'an empty tzdb tag violates cms_publication_schedules_tzdb_version_check [P2-S11-AC-103]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_publication_schedules',
    pg_temp.s11_insert_sql('platform_private.cms_publication_schedules', pg_temp.c11_image('tz-bare', jsonb_build_object('tzdb_version', repeat('a', 33))))),
  '23514', 'a 33-byte tzdb tag violates the same check [P2-S11-AC-103]');
select is(pg_temp.s11_bare_outcome('platform_private.cms_publication_schedules',
    pg_temp.s11_insert_sql('platform_private.cms_publication_schedules', pg_temp.c11_image('tz-bare', jsonb_build_object('tzdb_version', repeat('a', 32))))),
  '00000', 'control: a 32-byte tag is accepted [P2-S11-AC-103]');

-- ---------------------------------------------------------------------------
-- The pin advances (a forward migration redefines the function); stored schedules keep what they were accepted with.
-- ---------------------------------------------------------------------------
select pg_temp.p11_claim('claim', '100'::jsonb);
create or replace function pg_temp.c11_advance_pin(p_tag text)
returns text
language plpgsql
as $body$
begin
  execute format($f$create or replace function platform_private.cms_tzdb_version()
    returns text language sql immutable security definer set search_path = '' as $b$ select %L::text $b$$f$, p_tag);
  return platform_private.cms_tzdb_version();
exception when others then
  return 'ERR ' || sqlstate || ':' || sqlerrm;
end;
$body$;
select is(pg_temp.c11_advance_pin('2026f'), '2026f',
  'control: the pin advances to 2026f the way a forward migration advances it (the function is redefined) [P2-S11-AC-103]');
select is(
  pg_temp.c11_stored((pg_temp.r11_resp('accept-old')->>'id')::uuid)
    = (select tag from c11_pin) || '@' || (pg_temp.r11_resp('accept-old')->>'resolvedUtc')::timestamptz::text
      || '@' || (select local_datetime::text from platform_private.cms_publication_schedules where id = (pg_temp.r11_resp('accept-old')->>'id')::uuid)
      || '@UTC',
  true,
  'a schedule accepted before the pin advanced keeps its tag and its accepted instant [P2-S11-AC-103]');
select pg_temp.p11_call('stale-pin', 'pub', 'cms_schedule_publication',
  pg_temp.p11_sreq('tz-bare', jsonb_build_object('tzdbVersion', (select tag from c11_pin)), '{}'::text[], null, interval '4 days'), false);
select ok(pg_temp.r11_out('stale-pin') = 'P0001:tzdb_version_mismatch'
    and pg_temp.r11_detail('stale-pin')::jsonb = '{"pinnedVersion":"2026f"}'::jsonb,
  'after the advance a request that still names the earlier tag is refused tzdb_version_mismatch carrying the new pin [P2-S11-AC-103]');
select pg_temp.p11_call('accept-new', 'pub', 'cms_schedule_publication', pg_temp.p11_sreq('tz-bare', '{}'::jsonb, '{}'::text[], null, interval '4 days'));
select is(pg_temp.r11_out('accept-new') || '|' || coalesce((select tzdb_version from platform_private.cms_publication_schedules where id = (pg_temp.r11_resp('accept-new')->>'id')::uuid), '-'),
  '00000:|2026f',
  'a schedule accepted after the advance records the new tag [P2-S11-AC-103]');

-- ---------------------------------------------------------------------------
-- Execution runs against the STORED instant and leaves the tag alone.
-- ---------------------------------------------------------------------------
select pg_temp.p11_exec('exec-old', pg_temp.p11_xreq('s-tz-old'));
select is(
  pg_temp.r11_out('exec-old') || '|' || coalesce(pg_temp.r11_resp('exec-old')->>'outcome', '-') || '|'
    || (select tzdb_version || '/' || (resolved_at_utc::text = split_part((select stored from c11_old), '@', 2))::text
               || '/' || (deviation_seconds between 59 and 120)::text || '/' || state
          from platform_private.cms_publication_schedules where id = pg_temp.s11_id('s-tz-old')),
  '00000:|completed|2025c/true/true/completed',
  'a schedule accepted under 2025c executes after the pin advanced: completed, deviation measured from its stored instant, tag still 2025c [P2-S11-AC-103]');

select * from finish();
rollback;
