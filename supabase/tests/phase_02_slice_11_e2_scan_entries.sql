-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)", tracker
-- P2-S11-AC-086: the CMS-03B-13 `state` filter is evaluated over keyset candidates
-- read in batches of 200 and returns up to `limit` matching rows; the RPC scans at
-- most 1,000 candidates per request and, on reaching that bound, returns the rows
-- found with a cursor positioned after the last scanned candidate (a filtered page
-- may be shorter than `limit` while `nextCursor` is non-null).  The cursor, the sort
-- and the collection epoch never depend on the derived state.
--
-- 1,231 authorized entries (rank 1 = newest, rank 1231 = the S10 fixture entry),
-- every current draft revision stored as the constant `draft`.  Evidence:
--   approved  ranks 3, 450, 1001, 1100        published  rank 1150
-- The batches are counted with the statistics of the set-form helper
-- (track_functions), so "batches of 200" is observed, not assumed.

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

create or replace function pg_temp.e2_eid(p_rank integer) returns uuid language sql immutable as $$
  select ('a9140000-0000-4000-8000-' || lpad(p_rank::text, 12, '0'))::uuid $$;
create or replace function pg_temp.e2_rid(p_rank integer) returns uuid language sql immutable as $$
  select ('a9141000-0000-4000-8000-' || lpad(p_rank::text, 12, '0'))::uuid $$;

select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_content_entries(
  id, owner_id, content_type_id, owner_party_id, lifecycle,
  current_draft_revision_id, version, created_by, created_at, updated_at
)
select pg_temp.e2_eid(series.n), org.value::uuid, article.value::uuid, org.value::uuid, 'active',
       null, 1, actor.value::uuid,
       timestamptz '2026-10-02T00:00:00Z' - series.n * interval '1 second',
       timestamptz '2026-10-02T00:00:00Z' - series.n * interval '1 second'
from generate_series(1, 1230) series(n), s10_ids org, s10_ids article, s10_ids actor
where org.key = 'organization' and article.key = 'typeId' and actor.key = 'creatorAuth';
insert into platform_private.cms_entry_revisions(
  id, owner_id, entry_id, revision_number, schema_version_id,
  template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
  payload_hash, author_person_id, acting_party_id, state, version,
  validation_state, validation_report, created_at, updated_at
)
select pg_temp.e2_rid(series.n), org.value::uuid, pg_temp.e2_eid(series.n), 1, version_row.value::uuid,
       null, '[]'::jsonb, '[]'::jsonb, 'en-US',
       platform_private.cms_jcs_sha256('{}'::jsonb)::char(64),
       person.value::uuid, org.value::uuid, 'draft', 1, 'valid', '{}'::jsonb,
       timestamptz '2026-10-02T00:00:00Z' - series.n * interval '1 second',
       timestamptz '2026-10-02T00:00:00Z' - series.n * interval '1 second'
from generate_series(1, 1230) series(n), s10_ids org, s10_ids version_row, s10_ids person
where org.key = 'organization' and version_row.key = 'draftVersionId' and person.key = 'creatorPerson';
update platform_private.cms_content_entries entry_row
   set current_draft_revision_id = pg_temp.e2_rid(substring(entry_row.id::text from 25)::integer)
 where entry_row.id::text like 'a9140000-0000-4000-8000-%';
insert into platform_private.cms_entry_assignments(
  owner_id, entry_id, assignee_person_id, capability_key, state, version, created_at, updated_at
)
select org.value::uuid, pg_temp.e2_eid(series.n), person.value::uuid, 'cms.author', 'active', 1,
       timestamptz '2026-10-02T00:00:00Z', timestamptz '2026-10-02T00:00:00Z'
from generate_series(1, 1230) series(n), s10_ids org, s10_ids person
where org.key = 'organization' and person.key = 'creatorPerson';
analyze platform_private.cms_content_entries;
analyze platform_private.cms_entry_revisions;
analyze platform_private.cms_entry_assignments;

select pg_temp.e2_evidence(pg_temp.e2_rid(r), 'approved') from unnest(array[3, 450, 1001, 1100]) r;
select pg_temp.e2_evidence(pg_temp.e2_rid(1150), 'published');

create temp table e2_scan_calls(label text primary key, response jsonb, message text, batches bigint) on commit drop;
create or replace function pg_temp.e2_batches() returns bigint language sql stable as $$
  select coalesce((select calls from pg_stat_xact_user_functions
                    where funcname = 'cms_revision_effective_states'), 0)::bigint $$;
create or replace function pg_temp.e2_list(p_label text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
  before_batches bigint := pg_temp.e2_batches();
  result jsonb;
begin
  begin
    select platform_private.cms_list_entries(
      p_request || jsonb_build_object('context', jsonb_build_object(
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
-- Rank of every listed item ('F' = the S10 fixture entry, rank 1231), in page order.
create or replace function pg_temp.e2_ranks(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg(
    case when item->>'entryId' = 'a9100000-0000-4000-8000-000000000301' then 'F'
         else (substring(item->>'entryId' from 25)::integer)::text end
    || ':' || (item->>'state'), ',' order by ord), '')
  from e2_scan_calls call,
       jsonb_array_elements(coalesce(call.response->'items', '[]'::jsonb)) with ordinality as t(item, ord)
  where call.label = p_label
$body$;
create or replace function pg_temp.e2_cursor(p_label text)
returns text language sql stable as $$ select response->>'nextCursor' from e2_scan_calls where label = p_label $$;
create or replace function pg_temp.e2_cursor_entry(p_label text)
returns text language sql stable as $$
  select convert_from(decode(response->>'nextCursor', 'base64'), 'utf8')::jsonb->>'lastEntryId'
    from e2_scan_calls where label = p_label $$;

select is((select count(*)::integer from platform_private.cms_entry_assignments
            where assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
              and capability_key = 'cms.author' and state = 'active'), 1231,
  'the creator is assigned 1,231 entries as author (1,230 seeded plus the fixture entry) [P2-S11-AC-086]');

-- ---------------------------------------------------- the scan bound (1,000) ----
select pg_temp.e2_list('a-1', '{"limit":25,"state":"approved"}'::jsonb);
select is(pg_temp.e2_ranks('a-1'), '3:approved,450:approved',
  'the first filtered page lists the matches among the first 1,000 candidates and not the one at rank 1001 [P2-S11-AC-086]');
select isnt(pg_temp.e2_cursor('a-1'), null,
  'the page is shorter than the limit while nextCursor is non-null: the scan bound was reached [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_entry('a-1'), pg_temp.e2_eid(1000)::text,
  'the cursor is positioned after the last scanned candidate (rank 1000), not after the last match [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'a-1'), 5::bigint,
  'a 1,000-candidate scan evaluates the derived state in five batches of 200 [P2-S11-AC-086]');
select pg_temp.e2_list('a-2', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.e2_cursor('a-1')));
select is(pg_temp.e2_ranks('a-2') || '|' || coalesce(pg_temp.e2_cursor('a-2'), 'no-cursor'),
  '1001:approved,1100:approved|no-cursor',
  'the resumed page starts at rank 1001, lists the remaining matches and ends the walk with no cursor [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'a-2'), 2::bigint,
  '231 remaining candidates are two batches (200 + 31) [P2-S11-AC-086]');

-- --------------------------------------- a page with NO match inside the bound ----
select pg_temp.e2_list('p-1', '{"limit":25,"state":"published"}'::jsonb);
select is(pg_temp.e2_ranks('p-1') || '|' || (pg_temp.e2_cursor('p-1') is not null)::text, '|true',
  'a filtered page may be empty while nextCursor is non-null (no match in the first 1,000 candidates) [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_entry('p-1'), pg_temp.e2_eid(1000)::text,
  'and the cursor is after the 1,000th scanned candidate [P2-S11-AC-086]');
select pg_temp.e2_list('p-2', jsonb_build_object('limit', 25, 'state', 'published', 'cursor', pg_temp.e2_cursor('p-1')));
select is(pg_temp.e2_ranks('p-2') || '|' || coalesce(pg_temp.e2_cursor('p-2'), 'no-cursor'), '1150:published|no-cursor',
  'the next page finds the published entry at rank 1150 and ends [P2-S11-AC-086]');

-- ------------------------------------------------- early stop at limit + 1 matches ----
select pg_temp.e2_list('l-1', '{"limit":1,"state":"approved"}'::jsonb);
select is(pg_temp.e2_ranks('l-1'), '3:approved', 'limit 1 returns the first match [P2-S11-AC-086]');
select is(pg_temp.e2_cursor_entry('l-1'), pg_temp.e2_eid(3)::text,
  'the cursor is after the LAST RETURNED match when the probe for another match succeeded [P2-S11-AC-086]');
select is((select batches from e2_scan_calls where label = 'l-1'), 3::bigint,
  'the scan stopped at the probe match (rank 450, third batch): 3 batches, not 5 [P2-S11-AC-086]');
select pg_temp.e2_list('l-2', jsonb_build_object('limit', 1, 'state', 'approved', 'cursor', pg_temp.e2_cursor('l-1')));
select is(pg_temp.e2_ranks('l-2'), '450:approved', 'the probe match is not skipped by the next page [P2-S11-AC-086]');
select pg_temp.e2_list('u-1', '{"limit":25}'::jsonb);
select is((select batches from e2_scan_calls where label = 'u-1'), 1::bigint,
  'an unfiltered page derives the states of its 26 candidates in ONE batch [P2-S11-AC-085]');
select is(pg_temp.e2_ranks('u-1'),
  (select string_agg(n::text || ':' || case when n = 3 then 'approved' else 'draft' end, ',' order by n)
     from generate_series(1, 25) n),
  'the unfiltered items carry their derived states [P2-S11-AC-085]');
select pg_temp.e2_list('d-1', '{"limit":25,"state":"draft"}'::jsonb);
select is((select batches from e2_scan_calls where label = 'd-1'), 1::bigint,
  'a filter that matches densely stops inside the first batch [P2-S11-AC-086]');
select is(pg_temp.e2_ranks('d-1'),
  (select string_agg(n::text || ':draft', ',' order by n) from generate_series(1, 26) n where n <> 3),
  'the dense filtered page lists the first 25 draft entries in keyset order [P2-S11-AC-086]');

-- ------------------ the cursor and the epoch never depend on the derived state ----
select pg_temp.e2_list('c-1', '{"limit":25,"state":"approved"}'::jsonb);
select pg_temp.e2_evidence(pg_temp.e2_rid(5), 'approved');       -- scanned already
select pg_temp.e2_evidence(pg_temp.e2_rid(1200), 'approved');    -- not scanned yet
select pg_temp.e2_list('c-2', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.e2_cursor('c-1')));
select is((select message from e2_scan_calls where label = 'c-2'), null,
  'derived-state changes on scanned and unscanned entries are not a collection change [P2-S11-AC-086]');
select is(pg_temp.e2_ranks('c-2'), '1001:approved,1100:approved,1200:approved',
  'the continuation reports the state at read time [P2-S11-AC-086]');
-- ... but a real collection change is still a conflict: an unseen entry moves ahead of the cursor.
select pg_temp.e2_list('x-1', '{"limit":25,"state":"approved"}'::jsonb);
update platform_private.cms_content_entries
   set updated_at = timestamptz '2026-10-03T00:00:00Z', version = version + 1
 where id = pg_temp.e2_eid(1100);
select pg_temp.e2_list('x-2', jsonb_build_object('limit', 25, 'state', 'approved', 'cursor', pg_temp.e2_cursor('x-1')));
select is((select message from e2_scan_calls where label = 'x-2'), 'CONFLICT',
  'an unseen entry that moved ahead of the cursor is still a 409 CONFLICT under a state filter [P2-S11-AC-086]');

select is(
  (select string_agg(label || ': ' || message, ', ' order by label) from e2_scan_calls
    where message is not null and label <> 'x-2'),
  null, 'no list call of this suite raised an unintended error');

select * from finish();
rollback;
