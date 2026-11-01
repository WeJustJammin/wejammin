-- Slice 12 lane placement-perf (defect D1): the single-revision derived state (cms_revision_effective_state, rewritten as one
-- SQL query in 20261024150200) agrees with the set form (cms_revision_effective_states, untouched) for every evidence
-- combination of BE03b "Derived revision workflow state (E2)": draft, submitted, approved, rejected, invalidated, scheduled,
-- published, an absent id and NULL.  The evidence builders are the Slice 11 E2 fixtures.  Stage lane `placement-perf`.
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

create or replace function pg_temp.pe_rev(p_n integer) returns uuid language sql immutable as $$
  select ('a9170000-0000-4000-8000-0000000e20' || lpad(p_n::text, 2, '0'))::uuid $$;

-- every revision is appended FIRST (a revision insert invalidates older live reviews), then the evidence is attached
select pg_temp.e2_revision('a9100000-0000-4000-8000-000000000301', pg_temp.pe_rev(n), n) from generate_series(2, 8) n;
select pg_temp.e2_evidence(pg_temp.pe_rev(2), 'approved');
select pg_temp.e2_evidence(pg_temp.pe_rev(3), 'rejected');
select pg_temp.e2_evidence(pg_temp.pe_rev(4), 'submitted');
select pg_temp.e2_evidence(pg_temp.pe_rev(5), 'invalidated');
select pg_temp.e2_evidence(pg_temp.pe_rev(6), 'scheduled');
select pg_temp.e2_evidence(pg_temp.pe_rev(7), 'published');

select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(2)), 'approved', 'single form: approved review derives approved');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(3)), 'rejected', 'single form: rejected review derives rejected');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(4)), 'submitted', 'single form: open review derives submitted');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(5)), 'draft', 'single form: an invalidated review returns the revision to draft');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(6)), 'scheduled', 'single form: an approved revision with a pending publish schedule derives scheduled');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(7)), 'published', 'single form: a publish lineage row derives published');
select is(platform_private.cms_revision_effective_state(pg_temp.pe_rev(8)), 'draft', 'single form: a revision with no evidence derives draft');
select is(
  (select pg_catalog.count(*)::integer
     from (select r.id from platform_private.cms_entry_revisions r) revision
    where platform_private.cms_revision_effective_state(revision.id)
          is distinct from (select s.state from platform_private.cms_revision_effective_states(array[revision.id]) s)), 0,
  'agreement: for every stored revision the single form equals the set form');
select ok((select pg_catalog.count(*) >= 8 from platform_private.cms_entry_revisions),
  'agreement: the comparison covered at least the eight fixture revisions');
select is(platform_private.cms_revision_effective_state('a9170000-0000-4000-8000-0000000e2fff'::uuid), null,
  'agreement: an absent revision id derives NULL (the set form yields no row)');
select is((select pg_catalog.count(*)::integer from platform_private.cms_revision_effective_states(array['a9170000-0000-4000-8000-0000000e2fff'::uuid])), 0,
  'agreement: the set form yields no row for an absent id');
select is(platform_private.cms_revision_effective_state(null), null, 'agreement: a NULL id derives NULL');

select * from finish();
rollback;
