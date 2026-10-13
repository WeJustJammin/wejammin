-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" (tracker
-- P2-S11-AC-085) and Slice 12 CMSCOMP-DRAFT-TARGET: "only a draft entry revision
-- may host a composition instance".  Entry revisions are immutable snapshots whose
-- physical state is the constant `draft`, so the admission guard reads the DERIVED
-- state: a revision under review, approved, rejected, scheduled or published is
-- not a draft target; one whose latest review was invalidated is a draft again.
-- RED before 20261005018060: the guard read the physical column and admitted an
-- instance on every revision.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_e2/000-derived-evidence.sqlinc

create or replace function pg_temp.e2_rev(p_n integer) returns uuid language sql immutable as $$
  select ('a9160000-0000-4000-8000-0000000e10' || lpad(p_n::text, 2, '0'))::uuid $$;

-- Appended first, evidence second (a revision INSERT invalidates older live reviews).
select pg_temp.e2_revision('a9100000-0000-4000-8000-000000000301', pg_temp.e2_rev(n), n)
  from generate_series(2, 8) n;
select pg_temp.e2_evidence(pg_temp.e2_rev(3), 'submitted');
select pg_temp.e2_evidence(pg_temp.e2_rev(4), 'approved');
select pg_temp.e2_evidence(pg_temp.e2_rev(5), 'rejected');
select pg_temp.e2_evidence(pg_temp.e2_rev(6), 'scheduled');
select pg_temp.e2_evidence(pg_temp.e2_rev(7), 'published');
select pg_temp.e2_evidence(pg_temp.e2_rev(8), 'invalidated');

-- Outcome of writing one detached composition instance on a revision:
-- 'ok', 'P0001:<token>' for a guard refusal, otherwise the bare SQLSTATE.
create or replace function pg_temp.e2_instance(p_revision uuid, p_tag text)
returns text
language plpgsql
as $body$
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    insert into platform_private.cms_composition_instances(
      id, owner_id, version, revision_id, path, slot_key,
      block_key, block_version, block_registry_digest, link_mode, created_by
    )
    select extensions.gen_random_uuid(),
           (select value::uuid from s10_ids where key = 'organization'),
           1, p_revision, '/' || p_tag, 'primary', 'profile.header', 1,
           repeat('a', 64), 'detached',
           (select value::uuid from s10_ids where key = 'creatorAuth');
    return 'ok';
  exception when others then
    if sqlstate = 'P0001' then return 'P0001:' || sqlerrm; end if;
    return sqlstate;
  end;
end;
$body$;

select is(
  (select string_agg(label || '=' || pg_temp.e2_instance(revision, label), ',' order by ord)
     from (values
       (1, 'fixture-draft', 'a9100000-0000-4000-8000-000000000302'::uuid),
       (2, 'draft', pg_temp.e2_rev(2)),
       (3, 'submitted', pg_temp.e2_rev(3)),
       (4, 'approved', pg_temp.e2_rev(4)),
       (5, 'rejected', pg_temp.e2_rev(5)),
       (6, 'scheduled', pg_temp.e2_rev(6)),
       (7, 'published', pg_temp.e2_rev(7)),
       (8, 'invalidated', pg_temp.e2_rev(8))) as t(ord, label, revision)),
  'fixture-draft=ok,draft=ok,submitted=P0001:VALIDATION_FAILED,approved=P0001:VALIDATION_FAILED,rejected=P0001:VALIDATION_FAILED,scheduled=P0001:VALIDATION_FAILED,published=P0001:VALIDATION_FAILED,invalidated=ok',
  'a composition instance is admitted only on a revision whose DERIVED state is draft (an invalidated review returns the revision to draft) [P2-S11-AC-085]');

select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_composition_instances
    where revision_id in (pg_temp.e2_rev(3), pg_temp.e2_rev(4), pg_temp.e2_rev(5), pg_temp.e2_rev(6), pg_temp.e2_rev(7))),
  0, 'no instance row was written for a non-draft revision [P2-S11-AC-085]');
select is(pg_temp.e2_instance('a9160000-0000-4000-8000-0000000e1099'::uuid, 'absent'), '23503',
  'an absent revision keeps the owner-bound foreign key boundary (the guard returns NEW) [P2-S11-AC-085]');

select ok(
  (select p.prosrc ~ 'cms_revision_effective_state'
      and p.prosrc !~ 'revision\.state'
     from pg_proc p
    where p.oid = 'platform_private.cms_composition_instance_guards()'::regprocedure),
  'the guard reads the one derived-state helper and no longer reads the physical column [P2-S11-AC-085]');

select * from finish();
rollback;
