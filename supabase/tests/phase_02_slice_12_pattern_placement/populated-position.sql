\ir ../support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Populated-table witness for 20261014110000_cms_composition_instance_position.sql (PAT-025 populated-DB migration
-- witness; BE03c Canonical records 1426, DEC-185, AC-258).  A fresh reset applies the migration to an EMPTY table, so it
-- can never show that the backfill meets rows that already exist.  This suite
--   (1) reverts the table to its pre-migration shape (drops the column, its CHECK and its index),
--   (2) stands in legacy rows with several versions of one path, two slots, two revisions and paths that sort
--       differently bytewise and by locale,
--   (3) replays the migration's DDL, the text between the BEGIN/END COMPOSITION-POSITION-DDL markers copied
--       verbatim (the two copies must stay byte-identical, checked by the lane report's diff and by a contract test),
--   (4) asserts the dense bytewise rank from 0 per (revision_id, slot_key), one position for every version of a path,
--       NOT NULL, the CHECK, the index, both row guards enabled again, and a stored row still append-only.
-- Nothing is forged: the legacy rows are guarded inserts under app.cms_rpc as every fixture of this suite writes them.
select set_config('s12pd.type_count', '2', true);
\ir ../phase_02_slice_09_dec108/00-helpers.sqlinc
\ir ../phase_02_slice_09_dec108/01-actors.sqlinc
\ir ../phase_02_slice_09_dec108/02-chain.sqlinc
\ir ../phase_02_slice_09_p240/01-block.sqlinc
\ir ../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir ../phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir 000-fixtures.sqlinc
\ir 010-oracles.sqlinc

-- (1) the pre-migration shape: no position column (its CHECK and index go with it)
alter table platform_private.cms_composition_instances drop column position;
select is((select count(*)::integer from pg_attribute where attrelid = 'platform_private.cms_composition_instances'::regclass
  and attname = 'position' and not attisdropped), 0, 'setup: the table is reverted to its pre-migration shape');

-- (2) legacy rows: s12pl_row falls back to the column-less insert while the column is absent
select pg_temp.s12pl_entry('w1');
select pg_temp.s12pl_entry('w2');
select pg_temp.s12pl_row('w1', '/main/a', 'main', 0);
select pg_temp.s12pl_row('w1', '/main/B', 'main', 0);
select pg_temp.s12pl_row('w1', '/main/b', 'main', 0);
select pg_temp.s12pl_row('w1', '/main/a', 'main', 0, 'superseded', 2);
select pg_temp.s12pl_row('w1', '/side/z', 'side', 0);
select pg_temp.s12pl_row('w1', '/side/y', 'side', 0);
select pg_temp.s12pl_row('w2', '/main/q', 'main', 0);
select is((select count(*)::integer from platform_private.cms_composition_instances
  where revision_id in (pg_temp.s12pl_rev('w1'), pg_temp.s12pl_rev('w2'))), 7, 'setup: seven legacy rows exist before the replay');

create temp table s12pp_ddl(body text not null) on commit drop;
insert into s12pp_ddl values ($ddl$
-- BEGIN COMPOSITION-POSITION-DDL
alter table platform_private.cms_composition_instances add column position integer;

do $backfill$
begin
  if exists (select 1 from platform_private.cms_composition_instances) then
    alter table platform_private.cms_composition_instances disable trigger cms_composition_instances_write_guard;
    alter table platform_private.cms_composition_instances disable trigger cms_composition_instances_immutable_guard;
    update platform_private.cms_composition_instances target
       set position = ranked.slot_rank
      from (
        select instance.id,
               (pg_catalog.dense_rank() over (
                  partition by instance.revision_id, instance.slot_key
                  order by instance.path collate "C") - 1)::integer as slot_rank
          from platform_private.cms_composition_instances instance
      ) ranked
     where target.id = ranked.id;
    alter table platform_private.cms_composition_instances enable trigger cms_composition_instances_write_guard;
    alter table platform_private.cms_composition_instances enable trigger cms_composition_instances_immutable_guard;
  end if;
end;
$backfill$;

alter table platform_private.cms_composition_instances alter column position set not null;
alter table platform_private.cms_composition_instances
  add constraint cms_composition_instances_position_check check (position >= 0);
create index cms_composition_instances_revision_slot_position_idx
  on platform_private.cms_composition_instances (revision_id, slot_key, position);
-- END COMPOSITION-POSITION-DDL
$ddl$);

-- (3) the replay (the migration's transaction control is outside the markers; this suite owns the transaction)
do $replay$ begin execute (select body from s12pp_ddl); end; $replay$;

-- (4) the observed result
select is((select jsonb_object_agg(r.revision_label || r.path || '@' || r.version, r.position order by r.revision_label || r.path || '@' || r.version)
  from (select case instance.revision_id when pg_temp.s12pl_rev('w1') then 'w1' else 'w2' end as revision_label,
               instance.path, instance.version, instance.position
          from platform_private.cms_composition_instances instance
         where instance.revision_id in (pg_temp.s12pl_rev('w1'), pg_temp.s12pl_rev('w2'))) r),
  jsonb_build_object('w1/main/B@1', 0, 'w1/main/a@1', 1, 'w1/main/a@2', 1, 'w1/main/b@1', 2,
    'w1/side/y@1', 0, 'w1/side/z@1', 1, 'w2/main/q@1', 0),
  'the backfill is the dense bytewise rank from 0 per (revision, slot), shared by every version of a path [DEC-185]');
select is((select format_type(atttypid, atttypmod) || ':' || attnotnull::text from pg_attribute
  where attrelid = 'platform_private.cms_composition_instances'::regclass and attname = 'position' and not attisdropped),
  'integer:true', 'position is integer NOT NULL after the replay');
select ok(exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_composition_instances'::regclass
  and conname = 'cms_composition_instances_position_check'), 'the CHECK (position >= 0) exists after the replay');
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private' and tablename = 'cms_composition_instances'
  and indexname = 'cms_composition_instances_revision_slot_position_idx'), 'the slot-greatest index exists after the replay');
select is((select string_agg(tgname || ':' || tgenabled::text, ',' order by tgname) from pg_trigger
  where tgrelid = 'platform_private.cms_composition_instances'::regclass and not tgisinternal
    and tgname in ('cms_composition_instances_write_guard', 'cms_composition_instances_immutable_guard')),
  'cms_composition_instances_immutable_guard:O,cms_composition_instances_write_guard:O',
  'both row guards are enabled again after the one-time load');
select is(pg_temp.s12pl_try(format($sql$update platform_private.cms_composition_instances set position = 9
  where revision_id = %L::uuid$sql$, pg_temp.s12pl_rev('w2'))), 'P0001', 'a stored row is append-only again after the replay');
select is(pg_temp.s12pl_try('delete from platform_private.cms_composition_instances where true'), 'P0001',
  'a stored row cannot be deleted after the replay');

select finish();
rollback;
