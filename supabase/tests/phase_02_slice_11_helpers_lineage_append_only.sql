-- Slice 11 shared helpers: the E3 publication lineage is append-only, observed.
-- (BE03b "Publication lineage (E3)"; tracker P2-S11-AC-114, AC-115.)  The behavioural half of
-- phase_02_slice_11_helpers_lineage.sql: a competing writer that takes the next version first is
-- refused as 409 publication_conflict and leaves nothing behind; an append never changes an
-- earlier row; the helper's role holds no UPDATE or DELETE; the table guard refuses both even
-- for the owner.  The two-session serialization is
-- supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(16);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc

select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
\ir phase_02_slice_11_helpers/004-lineage.sqlinc

-- Behaviour, not source text.  (1) A competing writer commits the next version of the lineage between the
-- helper's head read and its insert -- the interleaving the advisory lock exists to prevent, forced here by a
-- BEFORE INSERT probe because one pgTAP transaction has one session; the real two-session serialization is
-- supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs.  The unique key refuses the helper's row,
-- the helper answers 409 publication_conflict, and nothing is left behind.
select pg_temp.h11w_revision('cmp');
select pg_temp.h11l_review('cmp');
create or replace function public.s11_test_competing_writer()
returns trigger
language plpgsql
as $probe$
begin
  if pg_catalog.current_setting('s11.compete', true) = 'on' then
    perform pg_catalog.set_config('s11.compete', 'off', true);
    -- The competitor is a valid FIRST row of the same lineage: its own id is the lineage id and its
    -- publication hash is the JCS SHA-256 of its own members (the lineage guard checks both).
    insert into platform_private.cms_publication_versions
    select (pg_catalog.jsonb_populate_record(
      null::platform_private.cms_publication_versions,
      pg_catalog.to_jsonb(new) || pg_catalog.jsonb_build_object(
        'id', rival.id, 'publication_id', rival.id,
        'publication_hash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
          'action', new.action, 'audience', new.audience, 'dependencyHash', new.dependency_hash,
          'entryId', new.entry_id, 'locale', new.locale, 'publicationId', rival.id,
          'revisionId', new.revision_id, 'supersedesId', new.supersedes_id, 'version', new.version,
          'versionSet', new.version_set))
      )
    )).*
      from (select extensions.gen_random_uuid() as id) rival;
  end if;
  return new;
end;
$probe$;
create trigger cms_publication_versions_0_s11_test_competitor
  before insert on platform_private.cms_publication_versions
  for each row execute function public.s11_test_competing_writer();
select set_config('s11.compete', 'on', true);
select is(pg_temp.h11l_append(pg_temp.h11l_publish('cmp')) ->> 'error', 'P0001:publication_conflict',
  'an append whose version a competing writer took first is refused as 409 publication_conflict, not a raw unique violation [P2-S11-AC-115]');
select is(pg_temp.h11l_rows('cmp'), '',
  'the refused append leaves no row behind: neither its own nor the competitor''s [P2-S11-AC-115]');
drop trigger cms_publication_versions_0_s11_test_competitor on platform_private.cms_publication_versions;
drop function public.s11_test_competing_writer();

-- (2) Append-only, observed: an append and a tombstone leave every earlier row bit-for-bit unchanged,
-- the CMS definer role the helper runs as holds no UPDATE or DELETE on the table, and even the owner
-- is refused by the table guard.
create temp table h11l_snapshot on commit drop as
select * from platform_private.cms_publication_versions;
select is(pg_temp.h11l_append(pg_temp.h11l_publish('cmp')) ->> 'version', '1',
  'control: without the competitor the same append commits version 1 [P2-S11-AC-115]');
select pg_temp.h11l_append(pg_temp.h11l_tombstone('cmp', 'unpublish'));
select is(
  (select count(*)::integer
     from h11l_snapshot before_row
     left join platform_private.cms_publication_versions after_row on after_row.id = before_row.id
    where after_row.id is null or pg_catalog.to_jsonb(after_row) is distinct from pg_catalog.to_jsonb(before_row)),
  0, 'appending a publish and a tombstone changes or removes no earlier lineage row [P2-S11-AC-114]');

create or replace function pg_temp.h11l_as_definer(p_sql text)
returns text
language plpgsql
as $body$
declare
  outcome text;
begin
  set local role wejammin_cms_definer;
  begin
    execute p_sql;
    outcome := '00000';
  exception when others then
    outcome := sqlstate;
  end;
  reset role;
  return outcome;
end;
$body$;
select is(pg_temp.h11l_as_definer(format('update platform_private.cms_publication_versions set revoked_at = clock_timestamp() where id = %L',
    (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('cmp:entry') and version = 1))),
  '42501', 'the helper''s role cannot UPDATE a lineage row (no privilege) [P2-S11-AC-114]');
select is(pg_temp.h11l_as_definer(format('delete from platform_private.cms_publication_versions where id = %L',
    (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('cmp:entry') and version = 1))),
  '42501', 'the helper''s role cannot DELETE a lineage row (no privilege) [P2-S11-AC-114]');
select is(pg_temp.h11_outcome(format('update platform_private.cms_publication_versions set revoked_at = clock_timestamp() where id = %L',
    (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('cmp:entry') and version = 1))),
  'P0001:IMMUTABLE_RECORD', 'even the table owner''s UPDATE of a lineage row is refused by the append-only guard [P2-S11-AC-114]');
select is(pg_temp.h11_outcome(format('delete from platform_private.cms_publication_versions where id = %L',
    (select id from platform_private.cms_publication_versions where entry_id = pg_temp.h11w_uuid('cmp:entry') and version = 1))),
  'P0001:IMMUTABLE_RECORD', 'even the table owner''s DELETE of a lineage row is refused by the append-only guard [P2-S11-AC-114]');

select * from finish();
rollback;
