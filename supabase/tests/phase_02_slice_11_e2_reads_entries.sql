-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085, P2-S11-AC-086): the CMS-03B-13 entry list projects the DERIVED
-- EntryRevisionState of every entry's current draft revision and evaluates its
-- `state` filter over the derived state.
--
-- The physical cms_entry_revisions.state is the constant `draft`; before the
-- Slice 11 forward migrations the reader copied that column, so a submitted,
-- approved, rejected, scheduled or published revision was reported (and filtered)
-- as `draft`.  Entries E1..E8 carry the evidence of each derived state; an
-- invalidated review (E7) returns its revision to draft.  The keyset order, the
-- cursor payload and the collection epoch never depend on the derived state.
--
--   E1 draft            no evidence
--   E2 submitted        an open review
--   E3 approved         an approved review
--   E4 rejected         a rejected review
--   E5 scheduled        an approved review plus a pending publish schedule
--   E6 published        a publish lineage row
--   E7 draft            an invalidated review (resubmittable)
--   E8 (the 001 entry)  draft, the oldest

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

\ir phase_02_slice_10_entry_list_keyset/000-helpers.sqlinc

create or replace function pg_temp.e2_eid(p_n integer) returns uuid language sql immutable as $$
  select ('a9120000-0000-4000-8000-0000000e00' || lpad(p_n::text, 2, '0'))::uuid $$;
create or replace function pg_temp.e2_rid(p_n integer) returns uuid language sql immutable as $$
  select ('a9120000-0000-4000-8000-0000000e10' || lpad(p_n::text, 2, '0'))::uuid $$;

select pg_temp.s10k_seed(pg_temp.e2_eid(1), pg_temp.e2_rid(1), timestamptz '2026-10-01T12:00:08Z', 'cms.author', 'active', 'active', 'draft');
select pg_temp.s10k_seed(pg_temp.e2_eid(2), pg_temp.e2_rid(2), timestamptz '2026-10-01T12:00:07Z', 'cms.author', 'active', 'active', 'submitted');
select pg_temp.s10k_seed(pg_temp.e2_eid(3), pg_temp.e2_rid(3), timestamptz '2026-10-01T12:00:06Z', 'cms.author', 'active', 'active', 'approved');
select pg_temp.s10k_seed(pg_temp.e2_eid(4), pg_temp.e2_rid(4), timestamptz '2026-10-01T12:00:05Z', 'cms.author', 'active', 'active', 'rejected');
select pg_temp.s10k_seed(pg_temp.e2_eid(5), pg_temp.e2_rid(5), timestamptz '2026-10-01T12:00:04Z', 'cms.author', 'active', 'active', 'scheduled');
select pg_temp.s10k_seed(pg_temp.e2_eid(6), pg_temp.e2_rid(6), timestamptz '2026-10-01T12:00:03Z', 'cms.author', 'active', 'active', 'published');
select pg_temp.s10k_seed(pg_temp.e2_eid(7), pg_temp.e2_rid(7), timestamptz '2026-10-01T12:00:02Z', 'cms.author', 'active', 'active', 'invalidated');
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_entries set updated_at = timestamptz '2026-09-26T12:00:00Z'
 where id = 'a9100000-0000-4000-8000-000000000301';

-- 'E<n>=<state>' per listed item, in page order; the 001 entry is E8.
create or replace function pg_temp.e2_states(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg(
    case when (item->>'entryId')::uuid = 'a9100000-0000-4000-8000-000000000301'::uuid then 'E8'
         else 'E' || ((right(item->>'entryId', 2))::integer)::text end
    || '=' || (item->>'state'), ',' order by ord), '')
  from s10k_calls call,
       jsonb_array_elements(coalesce(call.response->'items', '[]'::jsonb)) with ordinality as t(item, ord)
  where call.label = p_label
$body$;
create or replace function pg_temp.e2_cursor(p_label text)
returns text language sql stable as $body$
  select response->>'nextCursor' from s10k_calls where label = p_label
$body$;

-- ---------------------------------------------------------------- the seed ----
select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_entry_revisions where state <> 'draft'),
  0, 'the seeded revisions are all stored as the constant draft; the other states are evidence [P2-S11-AC-085]');
select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_editorial_reviews),
  5, 'the evidence is five reviews (open, approved, rejected, scheduled-approved, invalidated) [P2-S11-AC-085]');

-- ------------------------------------------------- unfiltered: derived state ----
select pg_temp.s10k_list('all', '{"limit":50}'::jsonb);
select is(pg_temp.e2_states('all'),
  'E1=draft,E2=submitted,E3=approved,E4=rejected,E5=scheduled,E6=published,E7=draft,E8=draft',
  'every listed item carries the DERIVED state of its current draft revision [P2-S11-AC-085]');
select is(
  (select pg_catalog.count(*)::integer from s10k_calls call,
     jsonb_array_elements(call.response->'items') as t(item),
     jsonb_object_keys(t.item) as k(key_name)
    where call.label = 'all' and (t.item->>'entryId')::uuid = pg_temp.e2_eid(2)),
  10, 'the list item keeps its ten-member shape; only the state value is derived [P2-S11-AC-085]');

-- ------------------------------------------------- filtered: derived state ----
select pg_temp.s10k_list('f-draft', '{"limit":50,"state":"draft"}'::jsonb);
select is(pg_temp.e2_states('f-draft'), 'E1=draft,E7=draft,E8=draft',
  'state=draft selects the revisions with no review and the one whose latest review was invalidated [P2-S11-AC-086]');
select pg_temp.s10k_list('f-submitted', '{"limit":50,"state":"submitted"}'::jsonb);
select is(pg_temp.e2_states('f-submitted'), 'E2=submitted', 'state=submitted selects the open review [P2-S11-AC-086]');
select pg_temp.s10k_list('f-approved', '{"limit":50,"state":"approved"}'::jsonb);
select is(pg_temp.e2_states('f-approved'), 'E3=approved',
  'state=approved selects the approved review and not the scheduled revision (scheduled outranks approved) [P2-S11-AC-086]');
select pg_temp.s10k_list('f-rejected', '{"limit":50,"state":"rejected"}'::jsonb);
select is(pg_temp.e2_states('f-rejected'), 'E4=rejected', 'state=rejected selects the rejected review [P2-S11-AC-086]');
select pg_temp.s10k_list('f-scheduled', '{"limit":50,"state":"scheduled"}'::jsonb);
select is(pg_temp.e2_states('f-scheduled'), 'E5=scheduled', 'state=scheduled selects the live publish schedule [P2-S11-AC-086]');
select pg_temp.s10k_list('f-published', '{"limit":50,"state":"published"}'::jsonb);
select is(pg_temp.e2_states('f-published'), 'E6=published', 'state=published selects the publish lineage row [P2-S11-AC-086]');
select pg_temp.s10k_list('f-none', jsonb_build_object('limit', 50, 'state', 'approved',
  'contentTypeId', '00000000-0000-4000-8000-000000000000'));
select is(pg_temp.e2_states('f-none') || '|' || coalesce(pg_temp.e2_cursor('f-none'), 'no-cursor'), '|no-cursor',
  'a filter that matches nothing lists nothing and carries no cursor [P2-S11-AC-086]');

-- ------------------------------------- a filtered walk pages without gap/repeat ----
select pg_temp.s10k_list('w-1', '{"limit":1,"state":"draft"}'::jsonb);
select is(pg_temp.e2_states('w-1'), 'E1=draft', 'filtered page one holds the first matching entry [P2-S11-AC-086]');
select isnt(pg_temp.e2_cursor('w-1'), null, 'and a cursor because a later entry matches [P2-S11-AC-086]');
select pg_temp.s10k_list('w-2', jsonb_build_object('limit', 1, 'state', 'draft', 'cursor', pg_temp.e2_cursor('w-1')));
select is(pg_temp.e2_states('w-2'), 'E7=draft',
  'page two skips the five non-matching entries between E1 and E7 and lists the next match [P2-S11-AC-086]');
select pg_temp.s10k_list('w-3', jsonb_build_object('limit', 1, 'state', 'draft', 'cursor', pg_temp.e2_cursor('w-2')));
select is(pg_temp.e2_states('w-3') || '|' || coalesce(pg_temp.e2_cursor('w-3'), 'no-cursor'), 'E8=draft|no-cursor',
  'page three lists the last match and ends the walk with no cursor [P2-S11-AC-086]');

-- A cursor issued under one filter is not valid under another (queryHash binds the filter).
select pg_temp.s10k_list('w-bound', jsonb_build_object('limit', 1, 'state', 'submitted', 'cursor', pg_temp.e2_cursor('w-1')));
select is((select message from s10k_calls where label = 'w-bound'), 'CONFLICT',
  'a cursor issued for state=draft is refused under state=submitted [P2-S11-AC-086]');

-- ------------------- the CMS-03B-11 draft detail reports the derived state too ----
create or replace function pg_temp.e2_draft_state(p_entry uuid)
returns text
language plpgsql
as $body$
declare
  detail jsonb;
begin
  detail := pg_temp.s10_rpc_exec(pg_catalog.format(
    'select platform_private.cms_get_entry_draft(%L::jsonb)',
    jsonb_build_object('entryId', p_entry, 'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text));
  return coalesce(detail->>'state', 'ERR:' || pg_temp.s10_last_error_message());
end;
$body$;
select is(
  (select string_agg('E' || n::text || '=' || pg_temp.e2_draft_state(
            case when n = 8 then 'a9100000-0000-4000-8000-000000000301'::uuid else pg_temp.e2_eid(n) end),
          ',' order by n)
     from generate_series(1, 8) n),
  'E1=draft,E2=submitted,E3=approved,E4=rejected,E5=scheduled,E6=published,E7=draft,E8=draft',
  'the CMS-03B-11 draft detail answers the derived state of the current draft revision [P2-S11-AC-085]');

-- ----------------- the cursor and the epoch never depend on the derived state ----
-- (a cursor is bound to its window: every page of a walk uses the same limit)
select pg_temp.s10k_list('u-1', '{"limit":2}'::jsonb);
select is(pg_temp.e2_states('u-1'), 'E1=draft,E2=submitted', 'unfiltered page one [P2-S11-AC-086]');
select pg_temp.e2_evidence(pg_temp.e2_rid(1), 'approved');      -- an entry the walk already passed changes state
select pg_temp.e2_evidence(pg_temp.e2_rid(7), 'rejected');      -- an unseen entry behind the cursor changes state
select pg_temp.s10k_list('u-2', jsonb_build_object('limit', 2, 'cursor', pg_temp.e2_cursor('u-1')));
select is((select message from s10k_calls where label = 'u-2'), null,
  'a derived-state change on entries ahead of and behind the cursor is not a collection change: no CONFLICT [P2-S11-AC-086]');
select pg_temp.s10k_list('u-3', jsonb_build_object('limit', 2, 'cursor', pg_temp.e2_cursor('u-2')));
select pg_temp.s10k_list('u-4', jsonb_build_object('limit', 2, 'cursor', pg_temp.e2_cursor('u-3')));
select is(
  pg_temp.e2_states('u-2') || '|' || pg_temp.e2_states('u-3') || '|' || pg_temp.e2_states('u-4')
    || '|' || coalesce(pg_temp.e2_cursor('u-4'), 'no-cursor'),
  'E3=approved,E4=rejected|E5=scheduled,E6=published|E7=rejected,E8=draft|no-cursor',
  'the walk continues in the unchanged keyset order and reports the state at read time [P2-S11-AC-086]');
select pg_temp.s10k_list('u-again', '{"limit":50}'::jsonb);
select is(pg_temp.e2_states('u-again'),
  'E1=approved,E2=submitted,E3=approved,E4=rejected,E5=scheduled,E6=published,E7=rejected,E8=draft',
  'the sort is the same keyset order after the state changes [P2-S11-AC-086]');

select is(
  (select string_agg(label || ': ' || message, ', ' order by label) from s10k_calls
    where message is not null and label <> 'w-bound'),
  null, 'no reader call of this suite raised an unintended error');

select * from finish();
rollback;
