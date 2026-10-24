\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261014020100_cms_pattern_storage_lineage.sql (PAT-025; BE03c E13, E14, lineage ids,
-- Database Schema 1425).  A fresh reset can never show that a forward migration meets rows that already exist.
-- Every row a database could hold before the migration is a legacy object-tree row (the old CHECK admits nothing
-- else): it carries no PatternNode kind, key or blockVersion and no compatible content types, so NO row can be
-- converted deterministically (BE03c 1425 demands the forest, 1..64 types and 1..512 nodes of every row).  The
-- migration therefore refuses, with SQLSTATE 55000 and a message naming the count, a lineage that is not exactly
-- versions 1..n (a lineage must root at its version-1 row, BE03c 217), a lineage with more than one active
-- version, and any remaining legacy row; on an empty table it applies every CHECK to every row.  This suite
-- (1) reverts the table and the composition foreign keys to their pre-migration shape, (2) adds legacy rows,
-- (3) replays the migration's DDL, the text between the BEGIN/END PATTERN-LINEAGE-DDL markers copied verbatim
-- (the two copies must stay byte-identical; tests/contracts/phase-02-slice-12-pattern-lineage-witness-parity.test.ts),
-- and (4) asserts each refusal leaves the legacy table untouched, the migration succeeds once the rows are gone,
-- and the producer then works.  The lifecycle trigger is paused only to stand the legacy table in (its function
-- reads the new columns) and is asserted enabled again at the end; nothing it guards is forged.
select set_config('s12pd.type_count', '2', true);
\ir ../phase_02_slice_09_dec108/00-helpers.sqlinc
\ir ../phase_02_slice_09_dec108/01-actors.sqlinc
\ir ../phase_02_slice_09_dec108/02-chain.sqlinc
\ir ../phase_02_slice_09_p240/01-block.sqlinc
\ir 000-fixtures.sqlinc
\ir 010-oracles.sqlinc

create temp table s12pw_ddl(body text not null) on commit drop;
insert into s12pw_ddl values ($ddl$
-- BEGIN PATTERN-LINEAGE-DDL

-- Refuse every populated legacy shape before touching anything.
do $legacy$
declare
  bad_keys bigint;
  bad_active bigint;
  legacy_rows bigint;
begin
  select pg_catalog.count(*) into bad_keys from (
    select 1
      from platform_private.cms_pattern_versions
     group by owner_id, pattern_key
    having pg_catalog.min(version) <> 1
        or pg_catalog.max(version) <> pg_catalog.count(*)
  ) ambiguous;
  if bad_keys > 0 then
    raise exception 'pattern lineage migration refused: % (owner, key) group(s) do not hold exactly versions 1..n', bad_keys
      using errcode = '55000';
  end if;
  select pg_catalog.count(*) into bad_active from (
    select 1
      from platform_private.cms_pattern_versions
     where state = 'active'
     group by owner_id, pattern_key
    having pg_catalog.count(*) > 1
  ) ambiguous;
  if bad_active > 0 then
    raise exception 'pattern lineage migration refused: % (owner, key) group(s) hold more than one active version', bad_active
      using errcode = '55000';
  end if;
  select pg_catalog.count(*) into legacy_rows from platform_private.cms_pattern_versions;
  if legacy_rows > 0 then
    raise exception 'pattern lineage migration refused: % legacy row(s) hold an object-tree block_tree with no PatternNode kinds, keys or block versions and no compatible content types; they cannot be converted deterministically, re-author them through CMS-03C-12 and remove them first', legacy_rows
      using errcode = '55000';
  end if;
end;
$legacy$;

-- The table is empty: the columns are added NOT NULL without a default, so no raw insert can slip past a CHECK.
alter table platform_private.cms_pattern_versions
  add column pattern_id uuid not null,
  add column compatible_type_ids jsonb not null,
  add column node_count smallint not null,
  add column supersedes_id uuid references platform_private.cms_pattern_versions(id);

-- The ordered forest on every row, one constraint per concern.
alter table platform_private.cms_pattern_versions drop constraint cms_pattern_versions_block_tree_check;
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_block_tree_valid check (
    pg_catalog.jsonb_typeof(block_tree) = 'array'
    and platform_private.cms_pattern_forest_check(block_tree) is null
  ),
  add constraint cms_pattern_versions_compatible_types_valid check (
    platform_private.cms_pattern_type_ids_valid(compatible_type_ids)
  ),
  add constraint cms_pattern_versions_node_count_valid check (
    node_count between 1 and 512
  );

-- E14 and the lineage keys.
alter table platform_private.cms_pattern_versions drop constraint cms_pattern_versions_key_version_key;
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_key_version_key unique (owner_id, pattern_key, version);
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_lineage_version_key unique (pattern_id, version);
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_lineage_version_owner_key unique (pattern_id, version, owner_id);
create unique index cms_pattern_versions_active_lineage_idx
  on platform_private.cms_pattern_versions (pattern_id) where state = 'active';
create index cms_pattern_versions_supersedes_idx
  on platform_private.cms_pattern_versions (supersedes_id) where supersedes_id is not null;

-- E13: the keys of the fixed route segments.
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_pattern_key_not_reserved
  check (pattern_key not in ('context', 'versions', 'selector', 'new'));

-- A composition instance pins the stable (patternId, patternVersion): the foreign key reaches the lineage key,
-- not a version row.  It keeps the name cms_composition_instances_pattern_owner_fkey (a frozen suite asserts it).
-- An instance can only name an existing pattern row, so with the pattern table empty there is no instance to
-- violate it and the key is validated at creation.
alter table platform_private.cms_composition_instances
  drop constraint cms_composition_instances_pattern_version_fkey,
  drop constraint cms_composition_instances_pattern_owner_fkey;
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_pattern_owner_fkey
  foreign key (pattern_id, pattern_version, owner_id)
  references platform_private.cms_pattern_versions (pattern_id, version, owner_id);

-- END PATTERN-LINEAGE-DDL
$ddl$);
create temp table s12pw_attempt(label text primary key, state text, message text) on commit drop;
create function pg_temp.s12pw_replay(p_label text) returns void language plpgsql as $body$
declare state text := '00000'; msg text := '';
begin
  begin
    execute (select body from s12pw_ddl);
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  insert into s12pw_attempt values (p_label, state, msg);
end;
$body$;
create function pg_temp.s12pw_error(p_sql text) returns text language plpgsql as $body$
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
create function pg_temp.s12pw_legacy_shape() returns boolean language sql stable as $body$
  select not exists(select 1 from information_schema.columns where table_schema = 'platform_private'
      and table_name = 'cms_pattern_versions'
      and column_name in ('pattern_id', 'compatible_type_ids', 'node_count', 'supersedes_id'))
    and exists(select 1 from pg_constraint where conname = 'cms_pattern_versions_key_version_key'
      and conrelid = 'platform_private.cms_pattern_versions'::regclass
      and pg_get_constraintdef(oid) = 'UNIQUE (pattern_key, version)')
$body$;

select ok(not exists(select 1 from platform_private.cms_pattern_versions),
  'SETUP the fresh database holds no pattern row before the table is reverted');

-- 1. revert to the pre-migration shape (what 20260927290000 and 20260927340000 created)
select set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_pattern_versions disable trigger cms_pattern_versions_lifecycle_guard;
alter table platform_private.cms_composition_instances
  drop constraint cms_composition_instances_pattern_owner_fkey;
alter table platform_private.cms_pattern_versions
  drop constraint cms_pattern_versions_block_tree_valid,
  drop constraint cms_pattern_versions_compatible_types_valid,
  drop constraint cms_pattern_versions_node_count_valid,
  drop constraint cms_pattern_versions_pattern_key_not_reserved,
  drop constraint cms_pattern_versions_key_version_key,
  drop constraint cms_pattern_versions_lineage_version_key,
  drop constraint cms_pattern_versions_lineage_version_owner_key;
drop index platform_private.cms_pattern_versions_active_lineage_idx;
drop index platform_private.cms_pattern_versions_supersedes_idx;
alter table platform_private.cms_pattern_versions
  drop column pattern_id, drop column compatible_type_ids, drop column node_count, drop column supersedes_id;
alter table platform_private.cms_pattern_versions
  add constraint cms_pattern_versions_key_version_key unique (pattern_key, version),
  add constraint cms_pattern_versions_block_tree_check check (platform_private.cms_pattern_tree_keys_valid(block_tree));
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_pattern_version_fkey
    foreign key (pattern_id, pattern_version) references platform_private.cms_pattern_versions (id, version),
  add constraint cms_composition_instances_pattern_owner_fkey
    foreign key (pattern_id, pattern_version, owner_id)
    references platform_private.cms_pattern_versions (id, version, owner_id);
select ok(pg_temp.s12pw_legacy_shape(), 'SETUP the table is in its pre-migration shape');

-- 2. legacy rows the migration must judge: a version gap, two active versions, a clean legacy chain
insert into platform_private.cms_pattern_versions(id, owner_id, state, version, pattern_key, block_tree,
  block_registry_digest, content_hash, owner_capability, created_by)
select legacy.id::uuid, pg_temp.s09d_id('ownerOrg'), legacy.state, legacy.version, legacy.key,
  '{"nodes":[{"blockKey":"profile.header"}]}'::jsonb, repeat('a', 64), repeat('b', 64),
  'cms.template_designer', pg_temp.s09d_actor_id('owner', 'auth')::uuid
from (values
  ('a9120000-0000-4000-8000-00000000c001', 'draft', 1, 'wit-gap'),
  ('a9120000-0000-4000-8000-00000000c003', 'draft', 3, 'wit-gap'),
  ('a9120000-0000-4000-8000-00000000d001', 'active', 1, 'wit-two-active'),
  ('a9120000-0000-4000-8000-00000000d002', 'active', 2, 'wit-two-active'),
  ('a9120000-0000-4000-8000-00000000b001', 'superseded', 1, 'wit-legacy'),
  ('a9120000-0000-4000-8000-00000000b002', 'active', 2, 'wit-legacy'),
  ('a9120000-0000-4000-8000-00000000b003', 'draft', 3, 'wit-legacy')
) legacy(id, state, version, key);
select is((select count(*)::integer from platform_private.cms_pattern_versions), 7,
  'SETUP seven legacy object-tree rows exist across three lineages');

-- 3. every unconvertible shape is refused with 55000 and the legacy table is untouched
select pg_temp.s12pw_replay('gap');
select is((select state from s12pw_attempt where label = 'gap'), '55000',
  'a lineage without exactly versions 1..n is refused with SQLSTATE 55000');
select matches((select message from s12pw_attempt where label = 'gap'), 'do not hold exactly versions 1\.\.n',
  'the refusal names its cause (a lineage must root at its version-1 row)');
select ok(pg_temp.s12pw_legacy_shape(), 'the gap refusal leaves the legacy table untouched');
delete from platform_private.cms_pattern_versions where pattern_key = 'wit-gap';
select pg_temp.s12pw_replay('two-active');
select is((select state from s12pw_attempt where label = 'two-active'), '55000',
  'two active versions of one lineage are refused with SQLSTATE 55000');
select matches((select message from s12pw_attempt where label = 'two-active'), 'more than one active version',
  'the second refusal names its cause');
delete from platform_private.cms_pattern_versions where pattern_key = 'wit-two-active';
select pg_temp.s12pw_replay('legacy-rows');
select is((select state from s12pw_attempt where label = 'legacy-rows'), '55000',
  'a clean 1..n legacy chain is still refused: its object trees cannot become PatternNode forests');
select matches((select message from s12pw_attempt where label = 'legacy-rows'), '3 legacy row',
  'the refusal counts the rows it cannot convert');
select ok(pg_temp.s12pw_legacy_shape()
  and (select count(*)::integer from platform_private.cms_pattern_versions) = 3,
  'the final refusal leaves the legacy table and its rows untouched');

-- 4. once no legacy row remains the migration succeeds
delete from platform_private.cms_pattern_versions where pattern_key = 'wit-legacy';
select pg_temp.s12pw_replay('migrate');
select is((select state || ':' || message from s12pw_attempt where label = 'migrate'), '00000:',
  'the DDL succeeds on the emptied table');
alter table platform_private.cms_pattern_versions enable trigger cms_pattern_versions_lifecycle_guard;
select is((select tgenabled::text from pg_trigger
  where tgrelid = 'platform_private.cms_pattern_versions'::regclass
    and tgname = 'cms_pattern_versions_lifecycle_guard'), 'O', 'the lifecycle guard is enabled again');
select is((select string_agg(column_name || ':' || is_nullable, ',' order by column_name)
  from information_schema.columns where table_schema = 'platform_private'
    and table_name = 'cms_pattern_versions'
    and column_name in ('pattern_id', 'compatible_type_ids', 'node_count', 'supersedes_id')),
  'compatible_type_ids:NO,node_count:NO,pattern_id:NO,supersedes_id:YES',
  'the lineage, type list and node count are NOT NULL; only the first version has no parent');
select is((select count(*)::integer from information_schema.columns where table_schema = 'platform_private'
  and table_name = 'cms_pattern_versions' and column_name in ('compatible_type_ids', 'node_count')
  and column_default is not null), 0, 'neither column has a default that would pass the CHECKs for a raw insert');
select is((select count(*)::integer from pg_constraint where conname = 'cms_pattern_versions_block_tree_check'
  and conrelid = 'platform_private.cms_pattern_versions'::regclass), 0, 'the legacy block_tree CHECK is gone');
select is((select count(*)::integer from pg_constraint where conrelid = 'platform_private.cms_pattern_versions'::regclass
  and conname in ('cms_pattern_versions_block_tree_valid', 'cms_pattern_versions_compatible_types_valid',
    'cms_pattern_versions_node_count_valid', 'cms_pattern_versions_pattern_key_not_reserved')
  and convalidated), 4, 'the forest, type-list, node-count and reserved-key CHECKs exist and are validated');
select is((select pg_get_constraintdef(oid) from pg_constraint where conname = 'cms_pattern_versions_key_version_key'
  and conrelid = 'platform_private.cms_pattern_versions'::regclass), 'UNIQUE (owner_id, pattern_key, version)',
  'the key is unique per owner');
select matches((select pg_get_constraintdef(oid) from pg_constraint
  where conname = 'cms_composition_instances_pattern_owner_fkey'
    and conrelid = 'platform_private.cms_composition_instances'::regclass),
  '^FOREIGN KEY \(pattern_id, pattern_version, owner_id\) REFERENCES .*cms_pattern_versions\(pattern_id, version, owner_id\)$',
  'a composition instance pins the lineage key (pattern_id, version, owner_id)');
select is((select convalidated from pg_constraint where conname = 'cms_composition_instances_pattern_owner_fkey'
  and conrelid = 'platform_private.cms_composition_instances'::regclass), true,
  'the lineage foreign key is validated');
select is((select count(*)::integer from pg_constraint where conname = 'cms_composition_instances_pattern_version_fkey'
  and conrelid = 'platform_private.cms_composition_instances'::regclass), 0,
  'the version-row foreign key is gone');

-- 5. the producer works on the migrated table
select pg_temp.s12pd_run('w-first', pg_temp.s12pd_request('wit-after', pg_temp.s12pd_forest(1), null, 'wit-after-0001'));
select is(pg_temp.s12pd_state('w-first'), '00000', 'a first version is created through the producer');
select is(pg_temp.s12pd_body('w-first')->>'patternId', pg_temp.s12pd_body('w-first')->>'id',
  'a first version is its own lineage');
select pg_temp.s12pd_run('w-second', pg_temp.s12pd_request('wit-after', pg_temp.s12pd_forest(2), '1',
  'wit-after-0002', null, '1'));
select is(pg_temp.s12pd_state('w-second'), '00000', 'a successor is created through the producer');
select is(pg_temp.s12pd_body('w-second')->>'patternId', pg_temp.s12pd_body('w-first')->>'id',
  'the successor joins the lineage of its parent');
select is((select supersedes_id from platform_private.cms_pattern_versions
  where id::text = pg_temp.s12pd_body('w-second')->>'id')::text, pg_temp.s12pd_body('w-first')->>'id',
  'the successor names its parent');
select is(pg_temp.s12pw_error($sql$update platform_private.cms_pattern_versions
  set content_hash = repeat('9', 64) where pattern_key = 'wit-after' and version = 1$sql$), 'P0001:CONFLICT',
  'the definition guard is enforced after the migration');

select finish();
rollback;
