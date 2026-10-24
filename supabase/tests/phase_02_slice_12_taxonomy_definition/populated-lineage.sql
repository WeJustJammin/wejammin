\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261014030000_cms_taxonomy_lineage_columns.sql (PAT-025; BE03c E14, lineage ids).
-- A fresh reset can never show that a forward migration succeeds on rows that already exist. This suite
-- (1) creates real versions through the producer, (2) reverts the table to its pre-migration shape (no
-- taxonomy_id, supersedes_id or canonical_overlap_domains, the global UNIQUE (taxonomy_key, version)) and adds
-- legacy rows, including shapes the backfill must refuse, (3) replays the migration's DDL, the text between
-- the BEGIN/END TAXONOMY-LINEAGE-DDL markers copied verbatim (the two copies must stay byte-identical), and
-- (4) asserts the outcome row by row and that the producer still works on the migrated rows.
\ir 000-harness.sqlinc
\ir 010-identities.sqlinc

create temp table s12tw_ddl(body text not null) on commit drop;
insert into s12tw_ddl values ($ddl$
-- BEGIN TAXONOMY-LINEAGE-DDL

create or replace function platform_private.cms_canonical_domains_valid(p_domains jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select case
    when pg_catalog.jsonb_typeof(p_domains) is distinct from 'array' then false
    when pg_catalog.jsonb_array_length(p_domains) > 6 then false
    else not exists (
      select 1
        from pg_catalog.jsonb_array_elements(p_domains) with ordinality member(value, ord)
       where pg_catalog.jsonb_typeof(member.value) is distinct from 'string'
          or (member.value #>> '{}') not in ('role', 'instrument', 'gear', 'place', 'rights', 'jurisdiction')
          or exists (
            select 1
              from pg_catalog.jsonb_array_elements(p_domains) with ordinality other(value, ord)
             where other.value = member.value and other.ord < member.ord)
    )
  end
$body$;

comment on function platform_private.cms_canonical_domains_valid(jsonb) is
  'DEC-135: true when the value is a JSON array of at most six unique members of the closed canonical domain set (role, instrument, gear, place, rights, jurisdiction). Private; IMMUTABLE.';

revoke all on function platform_private.cms_canonical_domains_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_canonical_domains_valid(jsonb) to wejammin_cms_definer;

-- Refuse an ambiguous legacy shape before touching anything.
do $legacy$
declare
  bad_keys bigint;
  bad_active bigint;
begin
  select pg_catalog.count(*) into bad_keys from (
    select 1
      from platform_private.cms_taxonomy_versions
     group by owner_id, taxonomy_key
    having pg_catalog.min(version) <> 1
        or pg_catalog.max(version) <> pg_catalog.count(*)
  ) ambiguous;
  if bad_keys > 0 then
    raise exception 'taxonomy lineage backfill refused: % (owner, key) group(s) do not hold exactly versions 1..n', bad_keys
      using errcode = '55000';
  end if;
  select pg_catalog.count(*) into bad_active from (
    select 1
      from platform_private.cms_taxonomy_versions
     where state = 'active'
     group by owner_id, taxonomy_key
    having pg_catalog.count(*) > 1
  ) ambiguous;
  if bad_active > 0 then
    raise exception 'taxonomy lineage backfill refused: % (owner, key) group(s) hold more than one active version', bad_active
      using errcode = '55000';
  end if;
end;
$legacy$;

alter table platform_private.cms_taxonomy_versions
  add column taxonomy_id uuid,
  add column supersedes_id uuid,
  add column canonical_overlap_domains jsonb not null default '[]'::jsonb;

-- The backfill UPDATE passes the RPC write guard (migration context) and must not meet the definition
-- guard, which refuses every UPDATE of an active or terminal row; it is paused and restored below.
select pg_catalog.set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_taxonomy_versions disable trigger cms_taxonomy_versions_lifecycle_guard;
with ordered as (
  select id,
         pg_catalog.first_value(id) over lineage as root_id,
         pg_catalog.lag(id) over lineage as parent_id
    from platform_private.cms_taxonomy_versions
  window lineage as (partition by owner_id, taxonomy_key order by version)
)
update platform_private.cms_taxonomy_versions version_row
   set taxonomy_id = ordered.root_id,
       supersedes_id = ordered.parent_id
  from ordered
 where version_row.id = ordered.id;

do $selfcheck$
begin
  if exists (select 1 from platform_private.cms_taxonomy_versions where taxonomy_id is null) then
    raise exception 'taxonomy lineage backfill left rows without a root' using errcode = '55000';
  end if;
  if exists (
    select 1
      from platform_private.cms_taxonomy_versions child
      join platform_private.cms_taxonomy_versions parent on parent.id = child.supersedes_id
     where child.taxonomy_id <> parent.taxonomy_id
        or child.owner_id <> parent.owner_id
        or child.taxonomy_key <> parent.taxonomy_key
        or child.version <> parent.version + 1
  ) then
    raise exception 'taxonomy lineage crosses an owner, a key or a version gap' using errcode = '55000';
  end if;
end;
$selfcheck$;

alter table platform_private.cms_taxonomy_versions alter column taxonomy_id set not null;

-- E14: a version number is unique within a lineage; the key is unique PER OWNER.
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_lineage_version_unique unique (taxonomy_id, version);
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_owner_key_version_unique unique (owner_id, taxonomy_key, version);
alter table platform_private.cms_taxonomy_versions
  drop constraint cms_taxonomy_versions_key_version_key;
create unique index cms_taxonomy_versions_active_lineage_idx
  on platform_private.cms_taxonomy_versions (taxonomy_id) where state = 'active';

-- The lineage root and the parent belong to the same owner; a first row is its own root.
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_lineage_owner_fkey
  foreign key (taxonomy_id, owner_id) references platform_private.cms_taxonomy_versions (id, owner_id);
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_supersedes_owner_fkey
  foreign key (supersedes_id, owner_id) references platform_private.cms_taxonomy_versions (id, owner_id);
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_canonical_domains_valid
  check (platform_private.cms_canonical_domains_valid(canonical_overlap_domains));

alter table platform_private.cms_taxonomy_versions enable trigger cms_taxonomy_versions_lifecycle_guard;

-- END TAXONOMY-LINEAGE-DDL
$ddl$);
create temp table s12tw_attempt(label text primary key, state text, message text) on commit drop;
create function pg_temp.s12tw_replay(p_label text) returns void language plpgsql as $body$
declare state text := '00000'; msg text := '';
begin
  begin
    execute (select body from s12tw_ddl);
  exception when others then
    get stacked diagnostics state = returned_sqlstate, msg = message_text;
  end;
  insert into s12tw_attempt values (p_label, state, msg);
end;
$body$;

-- 1. real rows: A chain of 3, A solo, B one
select pg_temp.s12td_as('A');
select pg_temp.s12td_run('w-chain-1', pg_temp.s12td_request('wit-chain', 'wit-chain-0001'));
select pg_temp.s12td_run('w-chain-2', pg_temp.s12td_request('wit-chain', 'wit-chain-0002', '{}', '1'));
select pg_temp.s12td_run('w-chain-3', pg_temp.s12td_request('wit-chain', 'wit-chain-0003', '{}', '2'));
select pg_temp.s12td_run('w-solo', pg_temp.s12td_request('wit-solo', 'wit-solo-0001'));
select pg_temp.s12td_as('B', 'B');
select pg_temp.s12td_run('w-other', pg_temp.s12td_request('wit-other', 'wit-other-0001'));
select is((select count(*)::integer from s12td_calls where label like 'w-%' and sqlstate = '00000'), 5,
  'SETUP five real versions exist through the producer before the table is reverted');

-- 2. revert to the legacy shape, then add legacy rows the backfill must judge
select set_config('app.cms_rpc', 'true', true);
alter table platform_private.cms_terms drop constraint cms_terms_version_lineage_fkey;
alter table platform_private.cms_taxonomy_versions disable trigger cms_taxonomy_versions_lifecycle_guard;
alter table platform_private.cms_taxonomy_versions
  drop constraint cms_taxonomy_versions_owner_key_version_unique,
  drop constraint cms_taxonomy_versions_canonical_domains_valid;
drop index platform_private.cms_taxonomy_versions_active_lineage_idx;
alter table platform_private.cms_taxonomy_versions
  drop column taxonomy_id, drop column supersedes_id, drop column canonical_overlap_domains;
alter table platform_private.cms_taxonomy_versions
  add constraint cms_taxonomy_versions_key_version_key unique (taxonomy_key, version);
select ok(not exists(select 1 from information_schema.columns where table_schema = 'platform_private'
  and table_name = 'cms_taxonomy_versions' and column_name in ('taxonomy_id', 'supersedes_id', 'canonical_overlap_domains')),
  'SETUP the table is in its pre-migration shape');

insert into platform_private.cms_taxonomy_versions(id, owner_id, state, version, taxonomy_key, owner_capability,
  shape, allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by)
select legacy.id::uuid, (select value::uuid from s12td_ids where key = 'org' || legacy.who), legacy.state, legacy.version,
  legacy.key, 'cms.taxonomy_curator', 'flat', '[]'::jsonb, '[]'::jsonb, repeat('a', 64),
  (select value::uuid from s12td_ids where key = 'auth' || legacy.who)
from (values
  ('a9126000-0000-4000-8000-00000000b001', 'B', 'superseded', 1, 'wit-legacy'),
  ('a9126000-0000-4000-8000-00000000b002', 'B', 'active', 2, 'wit-legacy'),
  ('a9126000-0000-4000-8000-00000000b003', 'B', 'draft', 3, 'wit-legacy'),
  ('a9126000-0000-4000-8000-00000000c001', 'A', 'draft', 1, 'wit-gap'),
  ('a9126000-0000-4000-8000-00000000c003', 'A', 'draft', 3, 'wit-gap'),
  ('a9126000-0000-4000-8000-00000000d001', 'A', 'active', 1, 'wit-two-active'),
  ('a9126000-0000-4000-8000-00000000d002', 'A', 'active', 2, 'wit-two-active')
) legacy(id, who, state, version, key);
insert into platform_private.cms_terms(id, owner_id, version, taxonomy_version_id, taxonomy_id, term_key, created_by)
select 'a9126000-0000-4000-8000-00000000e001', owner_id, 1, id, id, 'wit-term', created_by
from platform_private.cms_taxonomy_versions where taxonomy_key = 'wit-chain' and version = 1
  and owner_id = (select value::uuid from s12td_ids where key = 'orgA');

-- 3. ambiguous legacy shapes are refused loudly, and nothing changes
select pg_temp.s12tw_replay('gap');
select is((select state from s12tw_attempt where label = 'gap'), '55000', 'a version gap is refused with SQLSTATE 55000');
select matches((select message from s12tw_attempt where label = 'gap'), 'do not hold exactly versions 1\.\.n',
  'the refusal names the cause');
select ok(not exists(select 1 from information_schema.columns where table_schema = 'platform_private'
  and table_name = 'cms_taxonomy_versions' and column_name = 'taxonomy_id')
  and exists(select 1 from pg_constraint where conname = 'cms_taxonomy_versions_key_version_key'),
  'a refused migration leaves the legacy table untouched');
delete from platform_private.cms_taxonomy_versions where taxonomy_key = 'wit-gap';
select pg_temp.s12tw_replay('two-active');
select is((select state from s12tw_attempt where label = 'two-active'), '55000',
  'two active versions of one key are refused with SQLSTATE 55000');
select matches((select message from s12tw_attempt where label = 'two-active'), 'more than one active version',
  'the second refusal names its cause');
delete from platform_private.cms_taxonomy_versions where taxonomy_key = 'wit-two-active';

-- 4. the migration on a populated, unambiguous table
select pg_temp.s12tw_replay('migrate');
select is((select state || ':' || message from s12tw_attempt where label = 'migrate'), '00000:',
  'the DDL succeeds on the populated table');
select is((select count(*)::integer from platform_private.cms_taxonomy_versions v
  where to_jsonb(v)->>'taxonomy_id' is distinct from (select r.id::text from platform_private.cms_taxonomy_versions r
    where r.owner_id = v.owner_id and r.taxonomy_key = v.taxonomy_key and r.version = 1)), 0,
  'every row is in the lineage of its (owner, key) version one');
select is((select to_jsonb(v)->>'taxonomy_id' from platform_private.cms_taxonomy_versions v
  where v.id::text = pg_temp.s12td_body('w-chain-3')->>'id'), pg_temp.s12td_body('w-chain-1')->>'id',
  'the backfilled lineage equals the lineage the producer assigned');
select is((select jsonb_agg(to_jsonb(v)->>'supersedes_id' order by version) from platform_private.cms_taxonomy_versions v
  where v.id::text in (select pg_temp.s12td_body(l)->>'id' from (values ('w-chain-1'),('w-chain-2'),('w-chain-3')) x(l))),
  jsonb_build_array(null, pg_temp.s12td_body('w-chain-1')->>'id', pg_temp.s12td_body('w-chain-2')->>'id'),
  'the parent pointers follow the definition numbers');
select is((select jsonb_agg(to_jsonb(v)->>'supersedes_id' order by version) from platform_private.cms_taxonomy_versions v
  where taxonomy_key = 'wit-legacy'),
  '[null,"a9126000-0000-4000-8000-00000000b001","a9126000-0000-4000-8000-00000000b002"]'::jsonb,
  'legacy rows without a parent pointer are chained by definition number');
select is((select jsonb_agg(to_jsonb(v)->'canonical_overlap_domains') from platform_private.cms_taxonomy_versions v
  where taxonomy_key = 'wit-legacy'), '[[],[],[]]'::jsonb, 'legacy rows declare no canonical domain');
select is((select count(*)::integer from pg_constraint where conname = 'cms_taxonomy_versions_key_version_key'), 0,
  'the global unique is gone');
select is((select count(*)::integer from platform_private.cms_terms where term_key = 'wit-term'
  and taxonomy_version_id::text = pg_temp.s12td_body('w-chain-1')->>'id'), 1,
  'a term keeps its version-row foreign key through the migration');
select is((select count(*)::integer from platform_private.cms_taxonomy_versions where lifecycle_version <> 1), 0,
  'the migration leaves every lifecycle counter alone');

-- 5. the guard is back on and the producer works on the migrated rows
select pg_temp.s12td_as('B', 'B');
select pg_temp.s12td_run('w-legacy-next', pg_temp.s12td_request('wit-legacy', 'wit-legacy-0004', '{}', '3'));
select is((select sqlstate from s12td_calls where label = 'w-legacy-next'), '00000',
  'a successor of a legacy row is created');
select is(pg_temp.s12td_body('w-legacy-next')->>'taxonomyId', 'a9126000-0000-4000-8000-00000000b001',
  'the successor joins the backfilled lineage');
select pg_temp.s12td_run('w-legacy-read', pg_temp.s12td_read_request('a9126000-0000-4000-8000-00000000b001'), 'read');
select is((select jsonb_agg(item->>'state' order by ord) from jsonb_array_elements(
  coalesce(pg_temp.s12td_body('w-legacy-read')#>'{page,items}', '[]'::jsonb)) with ordinality items(item, ord)),
  '["draft","draft","active","superseded"]'::jsonb, 'the read serves legacy rows newest first with their legacy states');
select pg_temp.s12td_run('w-b-same-key', pg_temp.s12td_request('wit-chain', 'wit-b-same-0001'));
select is((select sqlstate from s12td_calls where label = 'w-b-same-key'), '00000',
  'another owner may now hold a key the first owner holds (E14)');
select isnt(pg_temp.s12td_body('w-b-same-key')->>'taxonomyId', pg_temp.s12td_body('w-chain-1')->>'id',
  'and starts its own lineage');
select pg_temp.s12td_as('A');
select pg_temp.s12td_run('w-chain-4', pg_temp.s12td_request('wit-chain', 'wit-chain-0004', '{}', '3'));
select is(pg_temp.s12td_body('w-chain-4')->>'taxonomyId', pg_temp.s12td_body('w-chain-1')->>'id',
  'the producer extends the lineage the producer created before the migration');
select is(pg_temp.s12td_attempt('update platform_private.cms_taxonomy_versions set shape = ''hierarchical'' '
  || 'where taxonomy_key = ''wit-legacy'' and version = 3'), 'P0001:CONFLICT',
  'the definition guard is enabled again after the migration');

select finish();
rollback;
