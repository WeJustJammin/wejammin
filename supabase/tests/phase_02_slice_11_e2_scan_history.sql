-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)", tracker
-- P2-S11-AC-086: the CMS-03B-03 `state` filter is evaluated over keyset candidates
-- read in batches of 200 and returns up to `limit` matching rows; the RPC scans at
-- most 1,000 candidates per request (concealed candidates count: a cursor must not
-- become a probe) and, on reaching that bound, returns the rows found with a cursor
-- positioned after the last scanned candidate.
--
-- Entry 301 carries 1,231 revisions, all stored as the constant `draft`; rank 1 is
-- the highest revision number, so number = 1232 - rank.  Evidence:
--   approved  ranks 3, 450, 1001, 1100 (numbers 1229, 782, 231, 132)
--   published rank 1150 (number 82)
--   published rank 10 (number 1222) under ANOTHER acting party: concealed
-- The batches are counted with the statistics of the set-form helper.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_e2/000-derived-evidence.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
set local track_functions = 'all';

create or replace function pg_temp.e2_rev(p_number integer) returns uuid language sql immutable as $$
  select case when p_number = 1 then 'a9100000-0000-4000-8000-000000000302'::uuid
              else ('a9150000-0000-4000-8000-' || lpad(p_number::text, 12, '0'))::uuid end $$;

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select pg_temp.e2_rev(series.n), base.owner_id, base.entry_id, series.n, base.schema_version_id,
       null, '[]'::jsonb, '[]'::jsonb, base.locale,
       platform_private.cms_jcs_sha256('{}'::jsonb)::char(64),
       base.author_person_id,
       case when series.n = 1222 then (select value::uuid from s10_ids where key = 'strangerPerson')
            else base.acting_party_id end,
       'draft', 1, 'valid', '{}'::jsonb,
       base.created_at + series.n * interval '1 second', base.created_at + series.n * interval '1 second'
from generate_series(2, 1231) series(n),
     platform_private.cms_entry_revisions base
where base.id = 'a9100000-0000-4000-8000-000000000302';
analyze platform_private.cms_entry_revisions;

select pg_temp.e2_evidence(pg_temp.e2_rev(1232 - r), 'approved') from unnest(array[3, 450, 1001, 1100]) r;
select pg_temp.e2_evidence(pg_temp.e2_rev(1232 - 1150), 'published');
select pg_temp.e2_evidence(pg_temp.e2_rev(1222), 'published');

create temp table e2_scan_calls(label text primary key, response jsonb, message text, batches bigint) on commit drop;
create or replace function pg_temp.e2_batches() returns bigint language sql stable as $$
  select coalesce((select calls from pg_stat_xact_user_functions
                    where funcname = 'cms_revision_effective_states'), 0)::bigint $$;
create or replace function pg_temp.e2_hist(p_label text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
  before_batches bigint := pg_temp.e2_batches();
  result jsonb;
begin
  begin
    select platform_private.cms_list_revisions(
      jsonb_build_object('entryId', 'a9100000-0000-4000-8000-000000000301') || p_request
      || jsonb_build_object('context', jsonb_build_object(
        'actingPartyId', (select value from s10_ids where key = 'organization'),
        'actingContextId', 'a9100000-0000-4000-8000-000000000094',
        'correlationId', 'a9100000-0000-4000-8000-000000000095'))
    ) into result;
    insert into e2_scan_calls values (p_label, result, null, pg_temp.e2_batches() - before_batches)
    on conflict (label) do update set response = excluded.response, message = null, batches = excluded.batches;
  exception when others then
    insert into e2_scan_calls values (p_label, null, sqlerrm, pg_temp.e2_batches() - before_batches)
    on conflict (label) do update set response = null, message = excluded.message, batches = excluded.batches;
  end;
end;
$body$;
create or replace function pg_temp.e2_numbers(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg((item->>'revisionNumber') || ':' || (item->>'state'), ',' order by ord), '')
  from e2_scan_calls call,
       jsonb_array_elements(coalesce(call.response->'items', '[]'::jsonb)) with ordinality as t(item, ord)
  where call.label = p_label
$body$;
create or replace function pg_temp.e2_cursor(p_label text)
returns text language sql stable as $$ select response->>'nextCursor' from e2_scan_calls where label = p_label $$;
create or replace function pg_temp.e2_cursor_number(p_label text)
returns text language sql stable as $$
  select convert_from(decode(response->>'nextCursor', 'base64'), 'utf8')::jsonb->>'lastRevisionNumber'
    from e2_scan_calls where label = p_label $$;

select is((select count(*)::integer from platform_private.cms_entry_revisions
            where entry_id = 'a9100000-0000-4000-8000-000000000301' and state = 'draft'), 1231,
  'entry 301 holds 1,231 revisions, every one stored as the constant draft [P2-S11-AC-085]');

-- ---------------------------------------------------- the scan bound (1,000) ----
select pg_temp.e2_hist('a-1', '{"limit":25,"state":"approved"}'::jsonb);
select is(pg_temp.e2_numbers('a-1'), '1229:approved,782:approved',
  'the first filtered page lists the matches among the first 1,000 candidates and not rank 1001 [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_number('a-1'), '232',
  'the cursor is positioned after the last scanned candidate (rank 1000 = revision 232) [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'a-1'), 5::bigint,
  'a 1,000-candidate scan evaluates the derived state in five batches of 200 [P2-S11-AC-086]');
select pg_temp.e2_hist('a-2', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.e2_cursor('a-1')));
select is(pg_temp.e2_numbers('a-2') || '|' || coalesce(pg_temp.e2_cursor('a-2'), 'no-cursor'),
  '231:approved,132:approved|no-cursor',
  'the resumed page lists the remaining matches and ends the walk with no cursor [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'a-2'), 2::bigint,
  '231 remaining candidates are two batches (200 + 31) [P2-S11-AC-086]');

-- --------------------------------------- empty page inside the bound; concealed ----
select pg_temp.e2_hist('p-1', '{"limit":25,"state":"published"}'::jsonb);
select is(pg_temp.e2_numbers('p-1') || '|' || (pg_temp.e2_cursor('p-1') is not null)::text, '|true',
  'the concealed published revision at rank 10 is skipped and no visible match is in the first 1,000: empty page, non-null cursor [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_number('p-1'), '232', 'concealed candidates counted as scanned: the cursor is after rank 1000 [P2-S11-AC-086]');
select pg_temp.e2_hist('p-2', jsonb_build_object('limit', 25, 'state', 'published', 'cursor', pg_temp.e2_cursor('p-1')));
select is(pg_temp.e2_numbers('p-2') || '|' || coalesce(pg_temp.e2_cursor('p-2'), 'no-cursor'), '82:published|no-cursor',
  'the next page finds the visible published revision at rank 1150 [P2-S11-AC-086]');

-- ------------------------------------------------- early stop at limit + 1 matches ----
select pg_temp.e2_hist('l-1', '{"limit":1,"state":"approved"}'::jsonb);
select is(pg_temp.e2_numbers('l-1'), '1229:approved', 'limit 1 returns the first match [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_number('l-1'), '1229',
  'the cursor is after the last RETURNED match when the probe for another match succeeded [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'l-1'), 3::bigint,
  'the scan stopped at the probe match (revision 782, third batch) [P2-S11-AC-086]');
select pg_temp.e2_hist('l-2', jsonb_build_object('limit', 1, 'state', 'approved', 'cursor', pg_temp.e2_cursor('l-1')));
select is(pg_temp.e2_numbers('l-2'), '782:approved', 'the probe match is not skipped by the next page [P2-S11-AC-086]');
select pg_temp.e2_hist('u-1', '{"limit":25}'::jsonb);
select is(pg_temp.e2_numbers('u-1'),
  (select string_agg(n::text || ':' || case when n = 1229 then 'approved' else 'draft' end, ',' order by n desc)
     from generate_series(1206, 1231) n where n <> 1222),
  'the unfiltered page walks past the concealed revision and carries derived states [P2-S11-AC-085]');
select ok((select batches between 1 and 2 from e2_scan_calls where label = 'u-1'),
  'an unfiltered page derives states for its candidates only (one batch of limit + 1, one more for the concealed row) [P2-S11-AC-085]');
select pg_temp.e2_hist('d-1', '{"limit":25,"state":"draft"}'::jsonb);
select is((select batches from e2_scan_calls where label = 'd-1'), 1::bigint,
  'a filter that matches densely stops inside the first batch [P2-S11-AC-086]');

select is(
  (select string_agg(label || ': ' || message, ', ' order by label) from e2_scan_calls where message is not null),
  null, 'no history call of this suite raised an error');

select * from finish();
rollback;
