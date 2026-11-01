-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085, P2-S11-AC-086): the CMS-03B-03 revision history projects the
-- DERIVED EntryRevisionState of every revision, evaluates its `state` filter over
-- the derived state, and the concealment classifier (a scheduled or published
-- revision is visible only to its acting party or a confirmed member of it)
-- reads the derived state too.
--
-- Entry 301 (the S10 fixture entry, revision 302 = R1) gains ten more revisions.
-- A revision under ANOTHER acting party is "foreign": a draft or submitted foreign
-- revision stays visible (entry read authority is enough), a scheduled or
-- published one is concealed as though it did not exist.
--
--   R1 draft | R2 submitted | R3 approved | R4 rejected | R5 scheduled | R6 published
--   R7 invalidated review (derives draft)
--   R8 published, foreign (concealed)  | R9 scheduled, foreign (concealed)
--   R10 submitted, foreign (visible)   | R11 draft, foreign (visible)
-- Revisions are appended first and the evidence is attached afterwards (a revision
-- INSERT invalidates older live reviews of the entry).

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

create or replace function pg_temp.e2_rev(p_n integer) returns uuid language sql immutable as $$
  select case when p_n = 1 then 'a9100000-0000-4000-8000-000000000302'::uuid
              else ('a9130000-0000-4000-8000-0000000e10' || lpad(p_n::text, 2, '0'))::uuid end $$;

select pg_temp.e2_revision('a9100000-0000-4000-8000-000000000301', pg_temp.e2_rev(n), n)
  from generate_series(2, 7) n;
select pg_temp.e2_revision('a9100000-0000-4000-8000-000000000301', pg_temp.e2_rev(n), n,
         (select value::uuid from s10_ids where key = 'strangerPerson'))
  from generate_series(8, 11) n;

select pg_temp.e2_evidence(pg_temp.e2_rev(2), 'submitted');
select pg_temp.e2_evidence(pg_temp.e2_rev(3), 'approved');
select pg_temp.e2_evidence(pg_temp.e2_rev(4), 'rejected');
select pg_temp.e2_evidence(pg_temp.e2_rev(5), 'scheduled');
select pg_temp.e2_evidence(pg_temp.e2_rev(6), 'published');
select pg_temp.e2_evidence(pg_temp.e2_rev(7), 'invalidated');
select pg_temp.e2_evidence(pg_temp.e2_rev(8), 'published');
select pg_temp.e2_evidence(pg_temp.e2_rev(9), 'scheduled');
select pg_temp.e2_evidence(pg_temp.e2_rev(10), 'submitted');

create temp table e2_hist_calls(label text primary key, response jsonb, message text) on commit drop;
create or replace function pg_temp.e2_hist(p_label text, p_request jsonb)
returns void
language plpgsql
as $body$
declare
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
    insert into e2_hist_calls values (p_label, result, null)
    on conflict (label) do update set response = excluded.response, message = null;
  exception when others then
    insert into e2_hist_calls values (p_label, null, sqlerrm)
    on conflict (label) do update set response = null, message = excluded.message;
  end;
end;
$body$;
-- 'R<number>=<state>' per listed item in page order.
create or replace function pg_temp.e2_hist_states(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg('R' || (item->>'revisionNumber') || '=' || (item->>'state'), ',' order by ord), '')
  from e2_hist_calls call,
       jsonb_array_elements(coalesce(call.response->'items', '[]'::jsonb)) with ordinality as t(item, ord)
  where call.label = p_label
$body$;
create or replace function pg_temp.e2_hist_cursor(p_label text)
returns text language sql stable as $body$
  select response->>'nextCursor' from e2_hist_calls where label = p_label
$body$;

select is((select pg_catalog.count(*)::integer from platform_private.cms_entry_revisions where state <> 'draft'),
  0, 'all eleven revisions are stored as the constant draft [P2-S11-AC-085]');

-- ------------------------------------------------------ derived projection ----
select pg_temp.e2_hist('all', '{"limit":50}'::jsonb);
select is((select message from e2_hist_calls where label = 'all'), null, 'the history read succeeds');
select is(pg_temp.e2_hist_states('all'),
  'R11=draft,R10=submitted,R7=draft,R6=published,R5=scheduled,R4=rejected,R3=approved,R2=submitted,R1=draft',
  'every visible revision carries its DERIVED state; the scheduled and published foreign revisions are concealed [P2-S11-AC-085]');

-- -------------------------------------------------------- derived filtering ----
select pg_temp.e2_hist('f-draft', '{"limit":50,"state":"draft"}'::jsonb);
select is(pg_temp.e2_hist_states('f-draft'), 'R11=draft,R7=draft,R1=draft',
  'state=draft selects no-evidence revisions and the one whose latest review was invalidated [P2-S11-AC-086]');
select pg_temp.e2_hist('f-submitted', '{"limit":50,"state":"submitted"}'::jsonb);
select is(pg_temp.e2_hist_states('f-submitted'), 'R10=submitted,R2=submitted',
  'state=submitted selects every open-review revision, the foreign one included (visible) [P2-S11-AC-086]');
select pg_temp.e2_hist('f-approved', '{"limit":50,"state":"approved"}'::jsonb);
select is(pg_temp.e2_hist_states('f-approved'), 'R3=approved', 'state=approved [P2-S11-AC-086]');
select pg_temp.e2_hist('f-rejected', '{"limit":50,"state":"rejected"}'::jsonb);
select is(pg_temp.e2_hist_states('f-rejected'), 'R4=rejected', 'state=rejected [P2-S11-AC-086]');
select pg_temp.e2_hist('f-scheduled', '{"limit":50,"state":"scheduled"}'::jsonb);
select is(pg_temp.e2_hist_states('f-scheduled'), 'R5=scheduled',
  'state=scheduled omits the concealed foreign scheduled revision [P2-S11-AC-086]');
select pg_temp.e2_hist('f-published', '{"limit":50,"state":"published"}'::jsonb);
select is(pg_temp.e2_hist_states('f-published'), 'R6=published',
  'state=published omits the concealed foreign published revision [P2-S11-AC-086]');
select is(pg_temp.e2_hist_states('f-published') || '|' || coalesce(pg_temp.e2_hist_cursor('f-published'), 'no-cursor'),
  'R6=published|no-cursor',
  'a concealed match is skipped without becoming a probe: the filtered walk ends with no cursor [P2-S11-AC-086]');

-- ------------------------------------------------------------------ paging ----
select pg_temp.e2_hist('p-1', '{"limit":3}'::jsonb);
select is(pg_temp.e2_hist_states('p-1'), 'R11=draft,R10=submitted,R7=draft',
  'page one walks past the two concealed revisions and holds the three newest visible ones [P2-S11-AC-086]');
select pg_temp.e2_hist('p-2', jsonb_build_object('limit', 3, 'cursor', pg_temp.e2_hist_cursor('p-1')));
select is(pg_temp.e2_hist_states('p-2'), 'R6=published,R5=scheduled,R4=rejected', 'page two [P2-S11-AC-086]');
select pg_temp.e2_hist('p-3', jsonb_build_object('limit', 3, 'cursor', pg_temp.e2_hist_cursor('p-2')));
select is(pg_temp.e2_hist_states('p-3') || '|' || coalesce(pg_temp.e2_hist_cursor('p-3'), 'no-cursor'),
  'R3=approved,R2=submitted,R1=draft|no-cursor', 'page three ends the walk [P2-S11-AC-086]');
select pg_temp.e2_hist('pf-1', '{"limit":1,"state":"draft"}'::jsonb);
select pg_temp.e2_hist('pf-2', jsonb_build_object('limit', 1, 'state', 'draft', 'cursor', pg_temp.e2_hist_cursor('pf-1')));
select pg_temp.e2_hist('pf-3', jsonb_build_object('limit', 1, 'state', 'draft', 'cursor', pg_temp.e2_hist_cursor('pf-2')));
select is(
  pg_temp.e2_hist_states('pf-1') || '|' || pg_temp.e2_hist_states('pf-2') || '|' || pg_temp.e2_hist_states('pf-3')
    || '|' || coalesce(pg_temp.e2_hist_cursor('pf-3'), 'no-cursor'),
  'R11=draft|R7=draft|R1=draft|no-cursor',
  'a filtered walk pages the draft revisions without gap or repeat [P2-S11-AC-086]');

-- ------------------------------------- the concealment classifier is derived ----
create or replace function pg_temp.e2_disposition(p_n integer)
returns text language sql stable as $body$
  select platform_private.cms_revision_page_disposition(
    (select value::uuid from s10_ids where key = 'creatorAuth'),
    (select value::uuid from s10_ids where key = 'organization'),
    revision)
  from platform_private.cms_entry_revisions revision where revision.id = pg_temp.e2_rev(p_n)
$body$;
select is(
  (select string_agg('R' || n::text || '=' || pg_temp.e2_disposition(n), ',' order by n) from generate_series(1, 11) n),
  'R1=visible,R2=visible,R3=visible,R4=visible,R5=visible,R6=visible,R7=visible,R8=absent,R9=absent,R10=visible,R11=visible',
  'the classifier conceals exactly the DERIVED scheduled/published revisions of another acting party [P2-S11-AC-085]');
select pg_temp.e2_hist('c-8', jsonb_build_object('compareRevisionId', pg_temp.e2_rev(8)));
select is((select message from e2_hist_calls where label = 'c-8'), 'NOT_FOUND',
  'a comparison target that is derived-published under another acting party is concealed as absent [P2-S11-AC-085]');

select * from finish();
rollback;
