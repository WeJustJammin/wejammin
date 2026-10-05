\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 AC215 evidence helper (s09e_fk_probe): the base row it moves must not depend on heap
-- order.  A row that another table references fails the probe for the wrong constraint (the
-- referencing table's foreign key fires first), so the probe reported a flaky
-- "probed=N-1;bad=<fk>=23503/<referencing fk>" for cms_content_type_versions whenever the
-- physically-first row was one that cms_entry_revisions cites.  The scratch tables model exactly
-- that shape: a referenced parent row is physically first, an unreferenced one second.

\ir phase_02_slice_09_dec108/05-probes.sqlinc

create schema s09fkp;
create table s09fkp.owner_org(id uuid primary key);
create table s09fkp.parent(
  id uuid primary key, owner_id uuid not null references s09fkp.owner_org(id), unique (id, owner_id));
create table s09fkp.child(
  id uuid primary key, parent_id uuid not null, owner_id uuid not null,
  foreign key (parent_id, owner_id) references s09fkp.parent(id, owner_id));
create table s09fkp.leaf(id uuid primary key, owner_id uuid not null references s09fkp.owner_org(id));
insert into s09fkp.owner_org values ('0f000000-0000-4000-8000-000000000001');
-- Physically first and referenced; its id sorts last.
insert into s09fkp.parent values ('ffffffff-0000-4000-8000-000000000001', '0f000000-0000-4000-8000-000000000001');
insert into s09fkp.child values ('c0000000-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', '0f000000-0000-4000-8000-000000000001');
-- Physically second and unreferenced.
insert into s09fkp.parent values ('00000000-0000-4000-8000-000000000002', '0f000000-0000-4000-8000-000000000001');
insert into s09fkp.leaf values ('1ea00000-0000-4000-8000-000000000001', '0f000000-0000-4000-8000-000000000001');

select is(pg_temp.s09e_fk_probe('s09fkp', 'parent'), 'probed=1;bad=',
  'the foreign-key probe moves an unreferenced base row even when the physically-first row is referenced [P2-S09-AC-215]');
select is(pg_temp.s09e_fk_probe('s09fkp', 'leaf'), 'probed=1;bad=',
  'control: a table nothing references is probed as before [P2-S09-AC-215]');
select is(pg_temp.s09e_fk_probe('s09fkp', 'child'), 'probed=1;bad=',
  'control: a referencing table whose rows nothing references is probed as before [P2-S09-AC-215]');

-- Every row referenced: no unreferenced base exists (cms_content_type_versions when each version is
-- cited by an entry revision), so the probe must copy a row instead of moving a referenced one.
create table s09fkp.parent_all(
  id uuid primary key, owner_id uuid not null references s09fkp.owner_org(id), unique (id, owner_id));
create table s09fkp.child_all(
  id uuid primary key, parent_id uuid not null, owner_id uuid not null,
  foreign key (parent_id, owner_id) references s09fkp.parent_all(id, owner_id));
insert into s09fkp.parent_all values ('a0000000-0000-4000-8000-000000000001', '0f000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002', '0f000000-0000-4000-8000-000000000001');
insert into s09fkp.child_all values ('c1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '0f000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', '0f000000-0000-4000-8000-000000000001');
select is(pg_temp.s09e_fk_probe('s09fkp', 'parent_all'), 'probed=1;bad=',
  'the foreign-key probe copies a row when every row of the table is referenced [P2-S09-AC-215]');

select * from finish();
rollback;
