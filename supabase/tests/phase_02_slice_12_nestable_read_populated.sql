\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261027100020_cms_pattern_key_reserved_nestable.sql (PAT-025; DEC-232, V14-04).  A fresh reset can never show that
-- a forward CHECK meets rows that already exist.  The old four-key CHECK (context, versions, selector, new) allowed a stored pattern named
-- `nestable`; the migration re-adds the CHECK with five keys, which scans every row.  The migration therefore counts such rows first and refuses
-- with SQLSTATE 55000 and a message naming the count (never a bare 23514).  This suite (1) reverts the CHECK to the four-key shape, (2) seeds
-- `nestable` rows beside a real pattern, (3) replays the migration's DDL, the text between the BEGIN/END NESTABLE-RESERVED-DDL markers copied
-- verbatim (the two copies must stay byte-identical; tests/contracts/phase-02-slice-12-nestable-reserved-witness-parity.test.ts), (4) asserts each
-- refusal names its count and leaves the table and the old CHECK untouched, and (5) shows that once the rows are gone the DDL succeeds on the
-- STILL POPULATED table (the real pattern remains), the CHECK is validated, and the key is refused from then on.  The lifecycle guard is paused
-- only to remove the seeded rows and is asserted enabled again at the end.
select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc

create temp table s12nw_ddl(body text not null) on commit drop;
insert into s12nw_ddl values ($ddl$
-- BEGIN NESTABLE-RESERVED-DDL
do $check$
declare
  stored bigint;
  constraint_text text;
begin
  select pg_catalog.count(*) into stored from platform_private.cms_pattern_versions where pattern_key = 'nestable';
  if stored > 0 then
    raise exception 'DEC-232 refused: % stored pattern version(s) hold the reserved key nestable; re-key or remove them before this migration', stored
      using errcode = '55000';
  end if;
  select pg_catalog.pg_get_constraintdef(con.oid) into constraint_text from pg_catalog.pg_constraint con
   where con.conrelid = 'platform_private.cms_pattern_versions'::pg_catalog.regclass
     and con.conname = 'cms_pattern_versions_pattern_key_not_reserved';
  if constraint_text is null or constraint_text !~ '''context''.*''versions''.*''selector''.*''new''' or constraint_text ~ 'nestable' then
    raise exception 'DEC-232 unexpected installed constraint: %', constraint_text using errcode = '55000';
  end if;
end;
$check$;

alter table platform_private.cms_pattern_versions
  drop constraint cms_pattern_versions_pattern_key_not_reserved,
  add constraint cms_pattern_versions_pattern_key_not_reserved
    check (pattern_key not in ('context', 'versions', 'selector', 'nestable', 'new'));
-- END NESTABLE-RESERVED-DDL
$ddl$);
create temp table s12nw_attempt(label text primary key, state text, message text) on commit drop;
create function pg_temp.s12nw_replay(p_label text) returns void language plpgsql as $body$
declare state text := '00000'; msg text := '';
begin
  begin
    execute (select body from s12nw_ddl);
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  insert into s12nw_attempt values (p_label, state, msg);
end;
$body$;
create function pg_temp.s12nw_error(p_sql text) returns text language plpgsql as $body$
declare code text; msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics code = returned_sqlstate, msg = message_text;
    return code || ':' || msg;
  end;
  return '00000:';
end;
$body$;
create function pg_temp.s12nw_raw(p_id uuid, p_owner uuid, p_key text) returns text language sql stable as $body$
  select format($f$insert into platform_private.cms_pattern_versions(
      id, owner_id, version, pattern_key, block_tree, block_registry_digest, content_hash, owner_capability,
      created_by, compatible_type_ids, node_count, pattern_id)
    values (%L, %L, 1, %L, %L::jsonb, %L, %L, 'cms.template_designer', %L, %L::jsonb, 1, %L)$f$,
    p_id, p_owner, p_key, pg_temp.s12pd_forest(1)::text, repeat('a',64), repeat('b',64),
    pg_temp.s09d_actor_id('owner','auth')::uuid, jsonb_build_array((select id from s12pd_types where ordinal=1))::text, p_id)
$body$;
create function pg_temp.s12nw_constraint() returns text language sql stable as $body$
  select pg_get_constraintdef(oid) from pg_constraint where conname = 'cms_pattern_versions_pattern_key_not_reserved'
    and conrelid = 'platform_private.cms_pattern_versions'::regclass
$body$;
create function pg_temp.s12nw_validated() returns boolean language sql stable as $body$
  select convalidated from pg_constraint where conname = 'cms_pattern_versions_pattern_key_not_reserved'
    and conrelid = 'platform_private.cms_pattern_versions'::regclass
$body$;

-- a real, populated table: one pattern created through the producer before anything is reverted
select pg_temp.s12pd_run('w-other', pg_temp.s12pd_request('wit-other', pg_temp.s12pd_forest(1), null, 'wit-other-0001'));
select is(pg_temp.s12pd_state('w-other'), '00000', 'SETUP a real pattern exists through the producer');
select ok(pg_temp.s12nw_constraint() ~ 'nestable' and pg_temp.s12nw_validated(), 'SETUP the migrated five-key CHECK is installed and validated');

-- 1. revert the CHECK to the pre-migration four-key shape (what 20261014020100 created)
select set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_pattern_versions
  drop constraint cms_pattern_versions_pattern_key_not_reserved,
  add constraint cms_pattern_versions_pattern_key_not_reserved
    check (pattern_key not in ('context', 'versions', 'selector', 'new'));
select ok(pg_temp.s12nw_constraint() ~ 'selector' and pg_temp.s12nw_constraint() !~ 'nestable', 'SETUP the CHECK is in its four-key shape');

-- 2. the old CHECK admitted the key: seed one stored row (a forest, a type list, its own lineage)
select is(pg_temp.s12nw_error(pg_temp.s12nw_raw('a9120000-0000-4000-8000-0000000f0001', pg_temp.s09d_id('ownerOrg'), 'nestable')), '00000:',
  'SETUP the four-key CHECK accepts a stored pattern named nestable');
select is((select count(*)::integer from platform_private.cms_pattern_versions), 2, 'SETUP the table holds the real pattern and the nestable row');

-- 3. one stored row: refused with the named error and the count; nothing changed
select pg_temp.s12nw_replay('one');
select is((select state from s12nw_attempt where label = 'one'), '55000', 'a stored nestable row refuses the migration with SQLSTATE 55000, not 23514');
select matches((select message from s12nw_attempt where label = 'one'), '^DEC-232 refused: 1 stored pattern version\(s\) hold the reserved key nestable',
  'the refusal names the count (1) and the key');
select ok(pg_temp.s12nw_constraint() !~ 'nestable' and pg_temp.s12nw_validated()
  and (select count(*)::integer from platform_private.cms_pattern_versions) = 2,
  'the refusal leaves the old CHECK and every row untouched');

-- 4. two stored rows (another owner may hold the same key): the count follows
select is(pg_temp.s12nw_error(pg_temp.s12nw_raw('a9120000-0000-4000-8000-0000000f0002', pg_temp.s09d_actor_id('other','party')::uuid, 'nestable')), '00000:',
  'SETUP another owner holds a nestable row too (uniqueness is per owner)');
select pg_temp.s12nw_replay('two');
select matches((select state || ':' || message from s12nw_attempt where label = 'two'), '^55000:DEC-232 refused: 2 stored pattern version\(s\)',
  'the refusal counts both owners'' rows');

-- 5. once no such row remains the DDL succeeds on the still populated table
alter table platform_private.cms_pattern_versions disable trigger cms_pattern_versions_lifecycle_guard;
delete from platform_private.cms_pattern_versions where pattern_key = 'nestable';
alter table platform_private.cms_pattern_versions enable trigger cms_pattern_versions_lifecycle_guard;
select is((select count(*)::integer from platform_private.cms_pattern_versions), 1, 'the seeded rows are gone, the real pattern remains');
select pg_temp.s12nw_replay('migrate');
select is((select state || ':' || message from s12nw_attempt where label = 'migrate'), '00000:', 'the DDL succeeds on the populated table once no nestable row remains');
select ok(pg_temp.s12nw_constraint() ~ 'context.*versions.*selector.*nestable.*new' and pg_temp.s12nw_validated(),
  'the five-key CHECK is installed and validated over the populated table');
select is((select tgenabled::text from pg_trigger where tgrelid = 'platform_private.cms_pattern_versions'::regclass
  and tgname = 'cms_pattern_versions_lifecycle_guard'), 'O', 'the lifecycle guard is enabled again');
select is(left(pg_temp.s12nw_error(pg_temp.s12nw_raw('a9120000-0000-4000-8000-0000000f0003', pg_temp.s09d_id('ownerOrg'), 'nestable')), 6), '23514:',
  'a nestable row is refused by the CHECK from now on');

-- 6. the producer still works on the migrated table
select pg_temp.s12pd_run('w-after', pg_temp.s12pd_request('wit-after', pg_temp.s12pd_forest(1), null, 'wit-after-0001'));
select is(pg_temp.s12pd_state('w-after'), '00000', 'a pattern is created through the producer after the migration');

select finish();
rollback;
