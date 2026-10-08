-- Slice 10 CMS-03B-13 entry list: an authorized, indexed keyset read (Codex
-- adversarial review H4; BE03b CMS-03B-13 "safe bounded read of only the caller's
-- assigned entries"; P2-S10-AC-035/097/098).
--
-- The reader used to walk EVERY active entry of the database in
-- (updated_at, id) order and test authority per row in PL/pgSQL, concealing
-- unauthorized rows with `continue`: a caller with no assignments (or a page of
-- entries hidden by tenant or assignment) forced a scan of the whole table, an
-- empty page carried no cursor, and the latency leaked the size of the hidden
-- population.  The reader now drives the page from the caller's own authorized
-- relation (active assignments of the resolved person whose capability is proven
-- at grant level, in the acting party), joins the entries and the current draft
-- revision in SQL (lifecycle, content-type, state and keyset predicates included)
-- and applies LIMIT limit + 1, so the work depends on the caller's authorized
-- population and the page, never on the hidden population.
--
-- This suite proves it with a large hidden population (4000 active entries of the
-- same tenant that the callers hold no assignment on, newer than every authorized
-- row so the old walk reached them first): the transaction-local statistics of
-- cms_content_entries (pg_stat_xact_user_tables: sequential tuples read + index
-- tuples fetched) are bounded by the page, equal with 0 and with 4000 hidden rows,
-- and a caller with zero visible rows gets an empty page and no cursor at the same
-- bounded cost.  Correctness of the authorized walk is asserted against the
-- documented semantics: newest first, active lifecycle, content-type and state
-- filters, grant-level capability proof, revoked assignment and lost grant hide,
-- and the keyset cursor pages the authorized rows without gaps or repeats.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

\ir phase_02_slice_10_entry_list_keyset/000-helpers.sqlinc

select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0001', 'a9100000-0000-4000-8000-0000000e1001', timestamptz '2026-10-01T12:00:07Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0002', 'a9100000-0000-4000-8000-0000000e1002', timestamptz '2026-10-01T12:00:06Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0003', 'a9100000-0000-4000-8000-0000000e1003', timestamptz '2026-10-01T12:00:05Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0004', 'a9100000-0000-4000-8000-0000000e1004', timestamptz '2026-10-01T12:00:04Z', 'cms.editor', 'active', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0005', 'a9100000-0000-4000-8000-0000000e1005', timestamptz '2026-10-01T12:00:03Z', 'cms.author', 'revoked', 'active', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0006', 'a9100000-0000-4000-8000-0000000e1006', timestamptz '2026-10-01T12:00:02Z', 'cms.author', 'active', 'archived', 'draft');
select pg_temp.s10k_seed('a9100000-0000-4000-8000-0000000e0007', 'a9100000-0000-4000-8000-0000000e1007', timestamptz '2026-10-01T12:00:01Z', 'cms.author', 'active', 'active', 'approved');
-- The 001 fixture entry (...301) is older than every seeded row: pin its timestamp.
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set updated_at = timestamptz '2026-09-26T12:00:00Z'
 where id = 'a9100000-0000-4000-8000-000000000301';

-- ---------------------------------------------------------- semantics ----
-- (every reader call is captured, so a raised error would otherwise read as an empty
-- page: the last assertion of the file proves none of them raised.)
select pg_temp.s10k_list('creator-all', '{"limit":50}'::jsonb);
select is(
  pg_temp.s10k_ids('creator-all'),
  'a9100000-0000-4000-8000-0000000e0001,a9100000-0000-4000-8000-0000000e0002,a9100000-0000-4000-8000-0000000e0003,a9100000-0000-4000-8000-0000000e0004,a9100000-0000-4000-8000-0000000e0007,a9100000-0000-4000-8000-000000000301',
  'the creator lists exactly the active entries they hold an active assignment on, newest first (revoked assignment and archived entry omitted)');
select pg_temp.s10k_list('creator-approved', '{"limit":50,"state":"approved"}'::jsonb);
select is(pg_temp.s10k_ids('creator-approved'), 'a9100000-0000-4000-8000-0000000e0007',
  'the state filter selects the entries whose current draft revision is in that state');
select pg_temp.s10k_list('creator-type', jsonb_build_object('limit', 50,
  'contentTypeId', '00000000-0000-4000-8000-000000000000'));
select is(pg_temp.s10k_ids('creator-type'), '', 'a content-type filter matching no entry lists nothing');

-- Keyset paging over the authorized rows: no gap, no repeat.
select pg_temp.s10k_list('page-1', '{"limit":2}'::jsonb);
select is(pg_temp.s10k_ids('page-1'),
  'a9100000-0000-4000-8000-0000000e0001,a9100000-0000-4000-8000-0000000e0002', 'page one holds the two newest authorized entries');
select pg_temp.s10k_list('page-2', jsonb_build_object('limit', 2,
  'cursor', (select response->>'nextCursor' from s10k_calls where label = 'page-1')));
select is(pg_temp.s10k_ids('page-2'),
  'a9100000-0000-4000-8000-0000000e0003,a9100000-0000-4000-8000-0000000e0004', 'the cursor continues with the next two');
select pg_temp.s10k_list('page-3', jsonb_build_object('limit', 2,
  'cursor', (select response->>'nextCursor' from s10k_calls where label = 'page-2')));
select is(pg_temp.s10k_ids('page-3'),
  'a9100000-0000-4000-8000-0000000e0007,a9100000-0000-4000-8000-000000000301', 'the last page ends the walk');
select is((select response->>'nextCursor' from s10k_calls where label = 'page-3'), null,
  'the last authorized page carries no cursor');

-- A caller with a grant but no assignment sees nothing; losing the grant hides everything.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10k_list('outsider-small', '{"limit":50}'::jsonb);
select is(pg_temp.s10k_ids('outsider-small'), '', 'a member with no capability grant lists nothing');
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'editorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10k_list('editor-small', '{"limit":50}'::jsonb);
select is(pg_temp.s10k_ids('editor-small'), 'a9100000-0000-4000-8000-000000000301',
  'the editor lists the one entry they are assigned (cms.editor) and nothing else');
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10k_list('creator-small', '{"limit":50}'::jsonb);
create temp table s10k_baseline on commit drop as
select (select reads from s10k_calls where label = 'outsider-small') as outsider_reads,
       (select reads from s10k_calls where label = 'creator-small') as creator_reads;

-- ---------------------------------------------------- hidden population ----
-- 4000 active entries of the same tenant, newer than every authorized row, that
-- nobody holds an assignment on.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_content_entries(
  id, owner_id, content_type_id, owner_party_id, lifecycle,
  current_draft_revision_id, version, created_by, created_at, updated_at
)
select ('b9100000-0000-4000-8000-' || lpad(series.n::text, 12, '0'))::uuid,
       org.value::uuid, article.value::uuid, org.value::uuid, 'active',
       null, 1, actor.value::uuid,
       timestamptz '2026-10-02T00:00:00Z' + series.n * interval '1 second',
       timestamptz '2026-10-02T00:00:00Z' + series.n * interval '1 second'
from generate_series(1, 4000) series(n), s10_ids org, s10_ids article, s10_ids actor
where org.key = 'organization' and article.key = 'typeId' and actor.key = 'creatorAuth';
analyze platform_private.cms_content_entries;
analyze platform_private.cms_entry_assignments;

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10k_list('outsider-large', '{"limit":50}'::jsonb);
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));
select pg_temp.s10k_list('creator-large', '{"limit":50}'::jsonb);
select pg_temp.s10k_list('creator-large-page', '{"limit":2}'::jsonb);

select is(
  (select response->'items' from s10k_calls where label = 'outsider-large'), '[]'::jsonb,
  'a caller with zero visible rows gets an empty page next to 4000 hidden entries');
select is(
  (select response->>'nextCursor' from s10k_calls where label = 'outsider-large'), null,
  'the empty page carries no cursor, so it reveals nothing about the hidden population');
select cmp_ok(
  (select reads from s10k_calls where label = 'outsider-large'), '<=', 12::bigint,
  'the zero-visible-row call reads at most a handful of entry-table tuples next to 4000 hidden entries (no table walk)');
select cmp_ok(
  (select reads from s10k_calls where label = 'creator-large'), '<=', 60::bigint,
  'listing the creator''s authorized entries next to 4000 hidden entries reads only tuples proportional to the authorized rows');
select cmp_ok(
  (select reads from s10k_calls where label = 'creator-large-page'), '<=', 60::bigint,
  'a two-row page next to 4000 hidden entries reads only tuples proportional to the authorized rows');
select cmp_ok(
  (select reads from s10k_calls where label = 'outsider-large'), '<=',
  (select outsider_reads from s10k_baseline) + 4,
  'the zero-visible-row cost does not grow with the hidden population (4000 hidden rows vs none)');
select cmp_ok(
  (select reads from s10k_calls where label = 'creator-large'), '<=',
  (select creator_reads from s10k_baseline) + 8,
  'the authorized-list cost does not grow with the hidden population (4000 hidden rows vs none)');
select is(pg_temp.s10k_ids('creator-large'), pg_temp.s10k_ids('creator-all'),
  'the hidden population changes nothing the creator sees');
select is(
  (select response->>'pageVersion' from s10k_calls where label = 'creator-large'),
  (select response->>'pageVersion' from s10k_calls where label = 'creator-all'),
  'the page version is unchanged by the hidden population');

select is(
  (select string_agg(label || ': ' || message, ', ' order by label) from s10k_calls where message is not null),
  null, 'no reader call of this suite raised an error');

select diag('entry-table tuples read per call: ' || (
  select string_agg(label || '=' || reads::text, ', ' order by label) from s10k_calls));

select * from finish();
rollback;
