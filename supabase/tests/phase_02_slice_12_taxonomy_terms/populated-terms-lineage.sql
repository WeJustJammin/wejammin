\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261014120000_cms_terms_lineage_columns.sql (PAT-025; BE03c 1371, 1428: cms_terms.taxonomy_id and the lineage keys).
-- A fresh reset can never show that a forward migration succeeds on rows that already exist. This suite
-- (1) creates real taxonomy versions through the producer, (2) reverts cms_terms to its pre-migration shape (no taxonomy_id, the version-keyed
-- uniques and foreign keys, the pre-lineage hierarchy and successor guards) and writes legacy term rows, among them a MERGED row whose survivor
-- was later DEPRECATED and a parented merged row (the shapes the old successor and hierarchy guards would refuse if the backfill woke them),
-- (3) replays the migration's DDL, the text between the BEGIN/END TERMS-LINEAGE-DDL markers copied verbatim (the two copies must stay
-- byte-identical, tests/contracts/phase-02-slice-12-taxonomy-terms-witness-parity.test.ts), and (4) asserts the outcome row by row.
-- The refusals (a term key repeated across the versions of one vocabulary, a term with no version row of its owner, a parent in another
-- vocabulary) are provoked inside always-undone subtransactions, so the populated table is never harmed by them.
\ir ../phase_02_slice_12_taxonomy_definition/000-harness.sqlinc
\ir ../phase_02_slice_12_taxonomy_definition/010-identities.sqlinc

create temp table s12tl_ddl(body text not null) on commit drop;
insert into s12tl_ddl values ($ddl$
-- BEGIN TERMS-LINEAGE-DDL

alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_id_lineage_owner_key unique (id, taxonomy_id, owner_id);

alter table platform_private.cms_terms add column taxonomy_id uuid;

select pg_catalog.set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_terms disable trigger cms_terms_lifecycle_guard;
update platform_private.cms_terms term
   set taxonomy_id = version_row.taxonomy_id
  from platform_private.cms_taxonomy_versions version_row
 where version_row.id = term.taxonomy_version_id and version_row.owner_id = term.owner_id;
alter table platform_private.cms_terms enable trigger cms_terms_lifecycle_guard;

do $selfcheck$
declare orphaned bigint; repeated bigint;
begin
  select pg_catalog.count(*) into orphaned from platform_private.cms_terms where taxonomy_id is null;
  if orphaned > 0 then
    raise exception 'term lineage backfill refused: % term row(s) have no taxonomy version of their owner', orphaned using errcode = '55000';
  end if;
  select pg_catalog.count(*) into repeated from (
    select 1 from platform_private.cms_terms group by taxonomy_id, term_key having pg_catalog.count(*) > 1
  ) duplicated;
  if repeated > 0 then
    raise exception 'term lineage backfill refused: % term key(s) repeat across the versions of one vocabulary', repeated using errcode = '55000';
  end if;
  if exists (
    select 1 from platform_private.cms_terms term
      join platform_private.cms_terms parent on parent.id = term.parent_term_id
     where parent.taxonomy_id <> term.taxonomy_id
  ) or exists (
    select 1 from platform_private.cms_terms term
      join platform_private.cms_terms survivor on survivor.id = term.successor_id
     where survivor.taxonomy_id <> term.taxonomy_id
  ) then
    raise exception 'term lineage backfill refused: a parent or a merge successor lies in another vocabulary' using errcode = '55000';
  end if;
end;
$selfcheck$;

alter table platform_private.cms_terms alter column taxonomy_id set not null;

-- The old version-keyed constraints go; the same names now state the lineage rule (existing suites pin the names).
alter table platform_private.cms_terms drop constraint cms_terms_taxonomy_key_version_key;
alter table platform_private.cms_terms drop constraint cms_terms_taxonomy_stable_key_key;
alter table platform_private.cms_terms drop constraint cms_terms_parent_taxonomy_owner_fkey;
alter table platform_private.cms_terms drop constraint cms_terms_successor_taxonomy_owner_fkey;

alter table platform_private.cms_terms
  add constraint cms_terms_id_lineage_owner_key unique (id, taxonomy_id, owner_id);
alter table platform_private.cms_terms
  add constraint cms_terms_taxonomy_key_version_key unique (taxonomy_id, term_key, version);
alter table platform_private.cms_terms
  add constraint cms_terms_taxonomy_stable_key_key unique (taxonomy_id, term_key);
alter table platform_private.cms_terms
  add constraint cms_terms_version_lineage_fkey
  foreign key (taxonomy_version_id, taxonomy_id, owner_id)
  references platform_private.cms_taxonomy_versions (id, taxonomy_id, owner_id);
alter table platform_private.cms_terms
  add constraint cms_terms_parent_taxonomy_owner_fkey
  foreign key (parent_term_id, taxonomy_id, owner_id)
  references platform_private.cms_terms (id, taxonomy_id, owner_id);
alter table platform_private.cms_terms
  add constraint cms_terms_successor_taxonomy_owner_fkey
  foreign key (successor_id, taxonomy_id, owner_id)
  references platform_private.cms_terms (id, taxonomy_id, owner_id);

create index cms_terms_vocabulary_keyset_idx
  on platform_private.cms_terms (taxonomy_id, (term_key collate "C"), id);

-- A direct insert that omits the lineage gets the one of the version row it names (a wrong or foreign one is refused by the foreign key).
create or replace function platform_private.cms_terms_lineage_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $body$
begin
  if new.taxonomy_id is null then
    select version_row.taxonomy_id into new.taxonomy_id
      from platform_private.cms_taxonomy_versions version_row
     where version_row.id = new.taxonomy_version_id and version_row.owner_id = new.owner_id;
  end if;
  return new;
end;
$body$;

comment on function platform_private.cms_terms_lineage_fill() is
  'BE03c 1371: fills an omitted cms_terms.taxonomy_id from the taxonomy version row the term is written under. BEFORE INSERT; private.';

create trigger cms_terms_00_lineage_fill
before insert on platform_private.cms_terms
for each row execute function platform_private.cms_terms_lineage_fill();

-- END TERMS-LINEAGE-DDL
$ddl$);
create temp table s12tl_attempt(label text primary key, state text, message text) on commit drop;

-- Replays the DDL; returns '<sqlstate>:<message>' ('00000:' when it succeeded).  A refusal leaves nothing behind (the block is a subtransaction).
create function pg_temp.s12tl_replay() returns text language plpgsql as $body$
declare state text := '00000'; msg text := '';
begin
  begin
    execute (select body from s12tl_ddl);
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  return state || ':' || msg;
end;
$body$;

-- Runs a setup statement, replays the DDL and ALWAYS undoes both; returns the replay's '<sqlstate>:<message>'.
create function pg_temp.s12tl_refusal(p_setup text) returns text language plpgsql as $body$
declare result text; undo boolean := false;
begin
  begin
    execute p_setup;
    result := pg_temp.s12tl_replay();
    undo := true;
    raise exception 'S12TL_UNDO';
  exception when others then
    if not undo then raise; end if;
  end;
  return result;
end;
$body$;

-- 1. real rows: vocabulary tw-a with two versions, vocabulary tw-b with one
select pg_temp.s12td_as('A');
select pg_temp.s12td_run('t-a1', pg_temp.s12td_request('tw-a', 'tw-a-0001'));
select pg_temp.s12td_run('t-a2', pg_temp.s12td_request('tw-a', 'tw-a-0002', '{}', '1'));
select pg_temp.s12td_as('B', 'B');
select pg_temp.s12td_run('t-b1', pg_temp.s12td_request('tw-b', 'tw-b-0001'));
select is((select count(*)::integer from s12td_calls where label like 't-%' and sqlstate = '00000'), 3,
  'SETUP three real taxonomy versions exist through the producer before the term store is reverted');
select is(pg_temp.s12td_body('t-a2')->>'taxonomyId', pg_temp.s12td_body('t-a1')->>'id', 'SETUP the second version of tw-a is in the lineage of the first');

-- 2. revert cms_terms to its pre-migration shape (the empty table is the shape the migration met in 2026-09)
select set_config('app.cms_rpc', 'true', true);
drop trigger cms_terms_00_lineage_fill on platform_private.cms_terms;
alter table platform_private.cms_terms
  drop constraint cms_terms_version_lineage_fkey,
  drop constraint cms_terms_parent_taxonomy_owner_fkey,
  drop constraint cms_terms_successor_taxonomy_owner_fkey,
  drop constraint cms_terms_taxonomy_key_version_key,
  drop constraint cms_terms_taxonomy_stable_key_key,
  drop constraint cms_terms_id_lineage_owner_key;
drop index platform_private.cms_terms_vocabulary_keyset_idx;
alter table platform_private.cms_terms drop column taxonomy_id;
alter table platform_private.cms_taxonomy_versions drop constraint cms_taxonomy_versions_id_lineage_owner_key;
alter table platform_private.cms_terms
  add constraint cms_terms_taxonomy_key_version_key unique (taxonomy_version_id, term_key, version),
  add constraint cms_terms_taxonomy_stable_key_key unique (taxonomy_version_id, term_key),
  add constraint cms_terms_parent_taxonomy_owner_fkey foreign key (parent_term_id, taxonomy_version_id, owner_id)
    references platform_private.cms_terms(id, taxonomy_version_id, owner_id),
  add constraint cms_terms_successor_taxonomy_owner_fkey foreign key (successor_id, taxonomy_version_id, owner_id)
    references platform_private.cms_terms(id, taxonomy_version_id, owner_id);
-- the pre-lineage hierarchy and successor guards (20260927390000, 20260927410000), verbatim: they name the VERSION row and an active survivor
create or replace function platform_private.cms_terms_hierarchy_cycle_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  parent_lifecycle text;
begin
  if new.parent_term_id is null and new.lifecycle <> 'merged' then
    return new;
  end if;

  -- The same serialization point guards child attachment and parent merge.
  perform 1
  from platform_private.cms_taxonomy_versions taxonomy
  where taxonomy.id = new.taxonomy_version_id
    and taxonomy.owner_id = new.owner_id
  for update;

  if new.parent_term_id is not null then
    select parent.lifecycle into parent_lifecycle
    from platform_private.cms_terms parent
    where parent.id = new.parent_term_id;
    if parent_lifecycle = 'merged' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;

    if tg_op = 'INSERT' or
       (tg_op = 'UPDATE' and
        new.parent_term_id is distinct from old.parent_term_id) then
      if exists (
        with recursive ancestors as (
          select parent.id, parent.parent_term_id,
                 array[parent.id]::uuid[] as path
          from platform_private.cms_terms parent
          where parent.id = new.parent_term_id
          union all
          select parent.id, parent.parent_term_id,
                 ancestors.path || parent.id
          from ancestors
          join platform_private.cms_terms parent
            on parent.id = ancestors.parent_term_id
          where not parent.id = any(ancestors.path)
        )
        select 1 from ancestors where id = new.id
      ) then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
    end if;
  end if;

  if new.lifecycle = 'merged' and exists (
    select 1
    from platform_private.cms_terms child
    where child.parent_term_id = new.id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;
create or replace function platform_private.cms_terms_successor_guard()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  survivor_lifecycle text;
begin
  if new.lifecycle <> 'merged' then
    return new;
  end if;

  perform 1
  from platform_private.cms_taxonomy_versions taxonomy
  where taxonomy.id = new.taxonomy_version_id
    and taxonomy.owner_id = new.owner_id
  for update;

  if new.successor_id is null or new.successor_id = new.id then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  select survivor.lifecycle into survivor_lifecycle
  from platform_private.cms_terms survivor
  where survivor.id = new.successor_id;
  if survivor_lifecycle is distinct from 'active' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from platform_private.cms_terms retired
    where retired.successor_id = new.id
  ) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  return new;
end;
$body$;
select ok(not exists (select 1 from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_terms' and column_name = 'taxonomy_id')
    and exists (select 1 from pg_constraint where conname = 'cms_terms_taxonomy_stable_key_key' and pg_get_constraintdef(oid) = 'UNIQUE (taxonomy_version_id, term_key)'),
  'SETUP cms_terms is in its pre-migration shape (no taxonomy_id, version-keyed uniques)');

-- legacy rows: written in the order the old model allowed.  tw-root (v1) and tw-child (v1, below tw-root); tw-v2 (v2); tw-survivor (v1)
-- and tw-merged (v1, parent tw-root) merged into it, the survivor deprecated afterwards; tw-solo (the other owner).
insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, term_key, created_by, parent_term_id)
select legacy.id::uuid, version_row.owner_id, 1, version_row.id, legacy.key, version_row.created_by, legacy.parent::uuid
  from (values
    ('a9126000-0000-4000-8000-0000000f0001', 't-a1', 'tw-root', null),
    ('a9126000-0000-4000-8000-0000000f0002', 't-a1', 'tw-child', 'a9126000-0000-4000-8000-0000000f0001'),
    ('a9126000-0000-4000-8000-0000000f0003', 't-a2', 'tw-v2', null),
    ('a9126000-0000-4000-8000-0000000f0004', 't-a1', 'tw-survivor', null),
    ('a9126000-0000-4000-8000-0000000f0005', 't-a1', 'tw-merged', 'a9126000-0000-4000-8000-0000000f0001'),
    ('a9126000-0000-4000-8000-0000000f0006', 't-b1', 'tw-solo', null)) legacy(id, label, key, parent)
  join platform_private.cms_taxonomy_versions version_row on version_row.id::text = pg_temp.s12td_body(legacy.label)->>'id';
insert into platform_private.cms_term_labels(owner_id, version, term_id, locale, label, created_by)
select term.owner_id, 1, term.id, 'en-US', 'Label ' || term.term_key, term.created_by from platform_private.cms_terms term where term.term_key = 'tw-root';
update platform_private.cms_terms
   set lifecycle = 'merged', successor_id = 'a9126000-0000-4000-8000-0000000f0004', version = version + 1, updated_at = clock_timestamp()
 where id = 'a9126000-0000-4000-8000-0000000f0005';
update platform_private.cms_terms
   set lifecycle = 'deprecated', version = version + 1, updated_at = clock_timestamp()
 where id = 'a9126000-0000-4000-8000-0000000f0004';
select is((select count(*)::integer from platform_private.cms_terms), 6, 'SETUP six legacy terms exist');
select ok((select merged.lifecycle = 'merged' and survivor.lifecycle = 'deprecated' and merged.parent_term_id is not null
             from platform_private.cms_terms merged, platform_private.cms_terms survivor
            where merged.id = 'a9126000-0000-4000-8000-0000000f0005' and survivor.id = merged.successor_id),
  'SETUP a parented MERGED legacy row redirects to a DEPRECATED survivor: the shape the pre-lineage successor guard refuses to see an update of');
create temp table s12tl_before on commit drop as
select md5(coalesce(string_agg(to_jsonb(term_row)::text, '|' order by term_row.id), '')) digest, count(*) total
  from platform_private.cms_terms term_row;

-- 3. the refusals, each in an undone subtransaction
select is(pg_temp.s12tl_refusal($sql$
    insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, term_key, created_by)
    select 'a9126000-0000-4000-8000-0000000f0010', version_row.owner_id, 1, version_row.id, 'tw-root', version_row.created_by
      from platform_private.cms_taxonomy_versions version_row where version_row.id::text = pg_temp.s12td_body('t-a2')->>'id'
    $sql$),
  '55000:term lineage backfill refused: 1 term key(s) repeat across the versions of one vocabulary',
  'a term key written under two versions of one vocabulary is refused with SQLSTATE 55000 and names the cause');
select is(pg_temp.s12tl_refusal($sql$
    alter table platform_private.cms_terms drop constraint cms_terms_taxonomy_owner_fkey;
    insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, term_key, created_by)
    select 'a9126000-0000-4000-8000-0000000f0011', owner_id, 1, 'a9126000-0000-4000-8000-0000000f0099', 'tw-orphan', created_by
      from platform_private.cms_terms where id = 'a9126000-0000-4000-8000-0000000f0006'
    $sql$),
  '55000:term lineage backfill refused: 1 term row(s) have no taxonomy version of their owner',
  'a term whose version row does not exist for its owner is refused with SQLSTATE 55000 and names the cause');
select is(pg_temp.s12tl_refusal($sql$
    alter table platform_private.cms_terms drop constraint cms_terms_parent_taxonomy_owner_fkey;
    update platform_private.cms_terms
       set parent_term_id = 'a9126000-0000-4000-8000-0000000f0006', version = version + 1, updated_at = clock_timestamp()
     where id = 'a9126000-0000-4000-8000-0000000f0001'
    $sql$),
  '55000:term lineage backfill refused: a parent or a merge successor lies in another vocabulary',
  'a parent in another vocabulary is refused with SQLSTATE 55000 and names the cause');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'platform_private' and table_name = 'cms_terms' and column_name = 'taxonomy_id')
    and (select md5(coalesce(string_agg(to_jsonb(term_row)::text, '|' order by term_row.id), '')) from platform_private.cms_terms term_row) = (select digest from s12tl_before),
  'the three refusals left the legacy table untouched: no column, no changed row');

-- 4. the migration on the populated table
select is(pg_temp.s12tl_replay(), '00000:', 'the DDL succeeds on the populated table, merged rows with a deprecated survivor and parented rows included');
select is((select count(*)::integer from platform_private.cms_terms term where term.taxonomy_id is not null
            and term.taxonomy_id = (select version_row.taxonomy_id from platform_private.cms_taxonomy_versions version_row where version_row.id = term.taxonomy_version_id)),
  (select total::integer from s12tl_before), 'every one of the 6 legacy rows is in the lineage of the version row it was written under (N/N)');
select is((select jsonb_object_agg(term.term_key, term.taxonomy_id::text) from platform_private.cms_terms term),
  jsonb_build_object('tw-root', pg_temp.s12td_body('t-a1')->>'id', 'tw-child', pg_temp.s12td_body('t-a1')->>'id', 'tw-v2', pg_temp.s12td_body('t-a1')->>'id',
                     'tw-survivor', pg_temp.s12td_body('t-a1')->>'id', 'tw-merged', pg_temp.s12td_body('t-a1')->>'id', 'tw-solo', pg_temp.s12td_body('t-b1')->>'id'),
  'the backfilled lineage equals the lineage the producer assigned: tw-v2, written under version 2, joins the lineage of version 1');
select is((select md5(coalesce(string_agg((to_jsonb(term_row) - 'taxonomy_id')::text, '|' order by term_row.id), '')) from platform_private.cms_terms term_row),
  (select digest from s12tl_before), 'the migration changed no other column of any row: versions, lifecycles, successors, parents and instants are byte-identical');
select is((select jsonb_build_object('lifecycle', merged.lifecycle, 'successor', merged.successor_id, 'parent', merged.parent_term_id, 'survivor', survivor.lifecycle)
             from platform_private.cms_terms merged join platform_private.cms_terms survivor on survivor.id = merged.successor_id
            where merged.id = 'a9126000-0000-4000-8000-0000000f0005'),
  '{"lifecycle":"merged","successor":"a9126000-0000-4000-8000-0000000f0004","parent":"a9126000-0000-4000-8000-0000000f0001","survivor":"deprecated"}'::jsonb,
  'the merged row still redirects to its deprecated survivor and keeps its parent: the pre-lineage successor and hierarchy guards did not misfire');
select ok(exists (select 1 from pg_attribute where attrelid = 'platform_private.cms_terms'::regclass and attname = 'taxonomy_id' and attnotnull and not attisdropped and atttypid = 'uuid'::regtype),
  'taxonomy_id is NOT NULL uuid');
select is((select jsonb_object_agg(conname, pg_get_constraintdef(oid)) from pg_constraint
            where conrelid = 'platform_private.cms_terms'::regclass and conname in ('cms_terms_taxonomy_key_version_key', 'cms_terms_taxonomy_stable_key_key', 'cms_terms_id_lineage_owner_key')),
  '{"cms_terms_taxonomy_key_version_key": "UNIQUE (taxonomy_id, term_key, version)", "cms_terms_taxonomy_stable_key_key": "UNIQUE (taxonomy_id, term_key)",
    "cms_terms_id_lineage_owner_key": "UNIQUE (id, taxonomy_id, owner_id)"}'::jsonb, 'the lineage uniques replace the version-keyed ones');
select ok((select count(*) = 3 and bool_and(convalidated) from pg_constraint where conrelid = 'platform_private.cms_terms'::regclass and contype = 'f'
              and conname in ('cms_terms_version_lineage_fkey', 'cms_terms_parent_taxonomy_owner_fkey', 'cms_terms_successor_taxonomy_owner_fkey')
              and pg_get_constraintdef(oid) like '%(%, taxonomy_id, owner_id)%'),
  'the lineage, parent and successor foreign keys exist, validated, on (…, taxonomy_id, owner_id)');
select ok(exists (select 1 from pg_class where relname = 'cms_terms_vocabulary_keyset_idx' and relnamespace = 'platform_private'::regnamespace)
    and exists (select 1 from pg_trigger where tgrelid = 'platform_private.cms_terms'::regclass and tgname = 'cms_terms_00_lineage_fill' and tgenabled = 'O')
    and (select tgenabled = 'O' from pg_trigger where tgrelid = 'platform_private.cms_terms'::regclass and tgname = 'cms_terms_lifecycle_guard'),
  'the keyset index and the lineage-fill trigger exist, and the lifecycle guard the migration paused is enabled again');
select ok(exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_term_assignments'::regclass and conname = 'cms_term_assignments_term_taxonomy_owner_fkey' and convalidated)
    and exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_term_labels'::regclass and conname = 'cms_term_labels_term_owner_fkey' and convalidated)
    and (select count(*) = 1 from platform_private.cms_term_labels where term_id = 'a9126000-0000-4000-8000-0000000f0001'),
  'the assignment and label foreign keys onto cms_terms are intact and the legacy label row survived');

-- 5. the migrated store works: a direct insert naming only the version gets its lineage, a foreign lineage is refused
insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, term_key, created_by)
select 'a9126000-0000-4000-8000-0000000f0020', version_row.owner_id, 1, version_row.id, 'tw-new', version_row.created_by
  from platform_private.cms_taxonomy_versions version_row where version_row.id::text = pg_temp.s12td_body('t-a2')->>'id';
select is((select taxonomy_id::text from platform_private.cms_terms where id = 'a9126000-0000-4000-8000-0000000f0020'), pg_temp.s12td_body('t-a1')->>'id',
  'a term written naming only its version row (version 2) receives the lineage of that version row from the fill trigger');
select is(pg_temp.s12td_attempt($sql$insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, taxonomy_id, term_key, created_by)
    select 'a9126000-0000-4000-8000-0000000f0022', version_row.owner_id, 1, version_row.id, (pg_temp.s12td_body('t-b1')->>'id')::uuid,
           'tw-wrong', version_row.created_by
      from platform_private.cms_taxonomy_versions version_row where version_row.id::text = pg_temp.s12td_body('t-a1')->>'id'$sql$),
  '23503:insert or update on table "cms_terms" violates foreign key constraint "cms_terms_version_lineage_fkey"',
  'a term whose version row belongs to another lineage is refused by the lineage foreign key');

select finish();
rollback;
