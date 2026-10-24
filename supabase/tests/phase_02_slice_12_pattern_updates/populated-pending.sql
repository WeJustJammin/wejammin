\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261014140000_cms_composition_instance_pending_version.sql (populated-DB migration witness; BE03c
-- Canonical records 1426, AC-258 pending clause).  A fresh reset applies the migration to an EMPTY table, so it can never show how the
-- DDL meets rows that already exist.  This suite
--   (1) reverts the table to its pre-migration shape (drops the column and its CHECK),
--   (2) stands in legacy rows written by the real placement producer's table shape (guarded inserts under app.cms_rpc),
--   (3) replays the migration's DDL, the text between the BEGIN/END COMPOSITION-PENDING-DDL markers copied verbatim (the two copies
--       must stay byte-identical),
--   (4) asserts the refusal on a legacy pending_diff row (SQLSTATE 55000, nothing changed), then the success on a table of ordinary rows:
--       every row keeps NULL, the CHECK holds, a pending_diff row needs a version and no other row may carry one.
select set_config('s12pd.type_count', '2', true);
\ir ../phase_02_slice_09_dec108/00-helpers.sqlinc
\ir ../phase_02_slice_09_dec108/01-actors.sqlinc
\ir ../phase_02_slice_09_dec108/02-chain.sqlinc
\ir ../phase_02_slice_09_p240/01-block.sqlinc
\ir ../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir ../phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir ../phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir ../phase_02_slice_12_pattern_placement/010-oracles.sqlinc

-- (1) the pre-migration shape: no pending_pattern_version column (its CHECK goes with it)
alter table platform_private.cms_composition_instances drop column pending_pattern_version;
select is((select count(*)::integer from pg_attribute where attrelid = 'platform_private.cms_composition_instances'::regclass
  and attname = 'pending_pattern_version' and not attisdropped), 0, 'setup: the table is reverted to its pre-migration shape');

create temp table s12pp_ddl(body text not null) on commit drop;
insert into s12pp_ddl values ($ddl$
-- BEGIN COMPOSITION-PENDING-DDL
do $guard$
declare
  pending_rows bigint;
begin
  select pg_catalog.count(*) into pending_rows
    from platform_private.cms_composition_instances where state = 'pending_diff';
  if pending_rows > 0 then
    raise exception 'pending_pattern_version migration refused: % pending_diff row(s) exist without the version they wait for; they cannot be backfilled without inventing it', pending_rows
      using errcode = '55000';
  end if;
end;
$guard$;

alter table platform_private.cms_composition_instances add column pending_pattern_version integer;
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_pending_version_check check (
    (state = 'pending_diff') = (pending_pattern_version is not null)
    and (pending_pattern_version is null or pending_pattern_version between 1 and 2147483647));
-- END COMPOSITION-PENDING-DDL
$ddl$);

-- (2) legacy rows: ordinary (draft, active, superseded, retired) rows of two revisions
select pg_temp.s12pl_entry('w1');
select pg_temp.s12pl_entry('w2');
select pg_temp.s12pl_row('w1', '/a', 'root', 0);
select pg_temp.s12pl_row('w1', '/a', 'root', 0, 'superseded', 2);
select pg_temp.s12pl_row('w1', '/b', 'root', 1, 'draft');
select pg_temp.s12pl_row('w2', '/c', 'root', 0, 'retired');
select is((select count(*)::integer from platform_private.cms_composition_instances
  where revision_id in (pg_temp.s12pl_rev('w1'), pg_temp.s12pl_rev('w2'))), 4, 'setup: four legacy rows exist before the replay');

-- (4a) a legacy pending_diff row has no version to carry: the DDL refuses before it changes anything (a subtransaction, rolled back)
create or replace function pg_temp.s12pp_probe() returns text language plpgsql as $body$
declare code text;
begin
  perform pg_temp.s12pl_row('w2', '/pending', 'root', 1, 'pending_diff', 1);
  begin
    execute (select body from s12pp_ddl);
    code := 'replayed';
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
  end;
  raise exception 'probe done %', code using errcode = 'P0002';
exception when sqlstate 'P0002' then
  return sqlerrm;
end;
$body$;
select is(pg_temp.s12pp_probe(), 'probe done 55000', 'a legacy pending_diff row makes the DDL refuse with SQLSTATE 55000 before it changes anything');
select is((select count(*)::integer from pg_attribute where attrelid = 'platform_private.cms_composition_instances'::regclass
  and attname = 'pending_pattern_version' and not attisdropped), 0, 'the refused replay left the table in its pre-migration shape');

-- (3) the replay (the migration's transaction control is outside the markers; this suite owns the transaction)
do $replay$ begin execute (select body from s12pp_ddl); end; $replay$;

-- (4b) the observed result
select is((select format_type(atttypid, atttypmod) || ':' || attnotnull::text from pg_attribute
  where attrelid = 'platform_private.cms_composition_instances'::regclass and attname = 'pending_pattern_version' and not attisdropped),
  'integer:false', 'pending_pattern_version is a nullable integer after the replay');
select is((select count(*)::integer from platform_private.cms_composition_instances
  where revision_id in (pg_temp.s12pl_rev('w1'), pg_temp.s12pl_rev('w2')) and pending_pattern_version is null), 4,
  'every legacy row keeps NULL: the DDL invented no number');
select ok(exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_composition_instances'::regclass
  and conname = 'cms_composition_instances_pending_version_check'), 'the CHECK exists after the replay');
select is(pg_temp.s12pl_try(format($sql$update platform_private.cms_composition_instances set pending_pattern_version = 3
  where revision_id = %L::uuid$sql$, pg_temp.s12pl_rev('w2'))), 'P0001', 'a stored row is still append-only after the replay');
create or replace function pg_temp.s12pp_insert(p_state text, p_pending integer) returns text language plpgsql as $body$
declare head_row platform_private.cms_composition_instances;
begin
  perform set_config('app.cms_rpc', 'true', true);
  select * into head_row from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('w1') and path = '/a' order by version desc limit 1;
  begin
    insert into platform_private.cms_composition_instances
    select (jsonb_populate_record(null::platform_private.cms_composition_instances, to_jsonb(head_row)
      || jsonb_build_object('id', extensions.gen_random_uuid(), 'state', p_state, 'version', head_row.version + 10,
           'pending_pattern_version', p_pending, 'created_at', transaction_timestamp(), 'updated_at', transaction_timestamp()))).*;
    raise exception 'inserted' using errcode = 'P0002';
  exception when others then
    return sqlstate;
  end;
end;
$body$;
select is(pg_temp.s12pp_insert('pending_diff', 3), 'P0002', 'a pending_diff row with a version is admitted');
select is(pg_temp.s12pp_insert('pending_diff', null), '23514', 'a pending_diff row without a version is refused');
select is(pg_temp.s12pp_insert('active', 3), '23514', 'an active row carrying a version is refused');
select is(pg_temp.s12pp_insert('pending_diff', 0), '23514', 'a version below 1 is refused');
select is(pg_temp.s12pp_insert('pending_diff', 2147483647), 'P0002', 'the largest integer is admitted');

select finish();
rollback;
