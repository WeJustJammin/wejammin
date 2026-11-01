-- Slice 11 lane S11-3d, BE03b "Derived revision workflow state (E2)" and the
-- persistence row for cms_entry_revisions (tracker P2-S11-AC-085): the physical
-- state of an immutable revision snapshot is the constant `draft`.  A forward
-- migration (20261005018090) narrows cms_entry_revisions_state_check from the
-- six-label workflow union to `state = 'draft'`; every browser-visible
-- EntryRevisionState is derived by cms_revision_effective_state instead.  The
-- narrowing ships LAST, after every read and write response adopts the helper
-- and the Slice 10/12 suites seed derived evidence instead of physical states.
--
-- The CHECK is probed in isolation from the guard triggers (every USER trigger
-- of the table disabled inside a rolled-back subtransaction), so what is
-- asserted is the table rule itself.  RED before the narrowing migration: the
-- constraint still admits all six labels.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(17);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- SQLSTATE of inserting a copy of the fixture revision stored with `p_state`
-- (the guard triggers of the table are disabled for the probe), or '00000' when
-- the row is accepted.  Always rolled back.
create or replace function pg_temp.e2_state_insert(p_state text)
returns text
language plpgsql
as $body$
declare
  observed text := '00000';
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  alter table platform_private.cms_entry_revisions disable trigger user;
  begin
    begin
      insert into platform_private.cms_entry_revisions(
        id, owner_id, entry_id, revision_number, schema_version_id,
        template_version_id, taxonomy_version_ids, parent_revision_ids, locale,
        payload_hash, author_person_id, acting_party_id, state, version,
        validation_state, validation_report, created_at, updated_at
      )
      select extensions.gen_random_uuid(), owner_id, entry_id, revision_number + 1,
             schema_version_id, template_version_id, taxonomy_version_ids,
             parent_revision_ids, locale, payload_hash, author_person_id,
             acting_party_id, p_state, version, validation_state, validation_report,
             created_at, updated_at
        from platform_private.cms_entry_revisions
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId');
    exception when others then
      observed := sqlstate;
    end;
    raise exception 'E2_PROBE_SENTINEL' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'E2_PROBE_SENTINEL' then
      alter table platform_private.cms_entry_revisions enable trigger user;
      raise;
    end if;
  end;
  alter table platform_private.cms_entry_revisions enable trigger user;
  return observed;
end;
$body$;

create or replace function pg_temp.e2_state_update(p_state text)
returns text
language plpgsql
as $body$
declare
  observed text := '00000';
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  alter table platform_private.cms_entry_revisions disable trigger user;
  begin
    begin
      update platform_private.cms_entry_revisions set state = p_state
       where id = (select value::uuid from s10_ids where key = 'entryRevisionId');
    exception when others then
      observed := sqlstate;
    end;
    raise exception 'E2_PROBE_SENTINEL' using errcode = 'P0001';
  exception when others then
    if sqlerrm <> 'E2_PROBE_SENTINEL' then
      alter table platform_private.cms_entry_revisions enable trigger user;
      raise;
    end if;
  end;
  alter table platform_private.cms_entry_revisions enable trigger user;
  return observed;
end;
$body$;

select ok(
  (select pg_catalog.count(*) = 1 and pg_catalog.bool_and(c.convalidated)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'platform_private.cms_entry_revisions'::regclass
      and c.conname = 'cms_entry_revisions_state_check'),
  'cms_entry_revisions_state_check exists once and is validated [P2-S11-AC-085]'
);

select is(
  (select pg_catalog.pg_get_constraintdef(c.oid)
     from pg_catalog.pg_constraint c
    where c.conrelid = 'platform_private.cms_entry_revisions'::regclass
      and c.conname = 'cms_entry_revisions_state_check'),
  $$CHECK ((state = 'draft'::text))$$,
  'the stored revision state is closed to the constant draft [P2-S11-AC-085]'
);

select is(pg_temp.e2_state_insert('draft'), '00000',
  'control: a draft revision row is accepted [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('submitted'), '23514',
  'a revision cannot be stored as submitted: that state is derived from review evidence [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('approved'), '23514',
  'a revision cannot be stored as approved [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('rejected'), '23514',
  'a revision cannot be stored as rejected [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('scheduled'), '23514',
  'a revision cannot be stored as scheduled: that state is derived from schedule evidence [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('published'), '23514',
  'a revision cannot be stored as published: that state is derived from the publication lineage [P2-S11-AC-085]');
select is(pg_temp.e2_state_insert('superseded'), '23514',
  'an unknown label is refused too [P2-S11-AC-085]');
select is(pg_temp.e2_state_update('approved'), '23514',
  'an existing revision cannot be moved to another state even with the guard triggers off [P2-S11-AC-085]');

-- The derived union is still fully reachable through evidence: the six labels
-- exist ONLY as helper output.
select is(
  (select pg_catalog.count(*)::integer
     from platform_private.cms_entry_revisions where state <> 'draft'),
  0, 'no stored revision carries a state other than draft [P2-S11-AC-085]'
);
select is(
  (select pg_catalog.count(*)::integer from platform_private.cms_entry_revisions),
  1, 'the probes left no row behind (every probe is rolled back) [P2-S11-AC-085]'
);
select is(
  (select pg_catalog.count(*)::integer
     from pg_catalog.pg_index i
    where i.indrelid = 'platform_private.cms_entry_revisions'::regclass
      and i.indisunique
      and pg_catalog.pg_get_indexdef(i.indexrelid) like '%(id, entry_id)%'),
  1, 'the (id, entry_id) key the Slice 11 composite foreign keys reference survives the narrowing [P2-S11-AC-085]'
);

select * from finish();
rollback;
