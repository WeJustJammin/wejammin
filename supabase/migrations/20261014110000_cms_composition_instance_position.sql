-- Slice 12 lane placement (BE03c Canonical records 1426, Pattern versions and linked updates 1365; DEC-185; tracker
-- P2-S12-AC-258 position clause): the authored `position` of a composition row.
--
--   position integer NOT NULL CHECK (position >= 0): the authored order of a row within its (revision_id, slot_key).
--   A placement takes consecutive values in forest order appended after the slot's greatest; accept, detach, the
--   linked-update scan, restore and carry-over copy it unchanged, so every version of a path shares one position.
--
-- Populated-table rule (DEC-185): the forward migration backfills every existing row with the dense rank, from 0 and
-- bytewise (COLLATE "C"), of its path among the distinct paths of its (revision_id, slot_key), so all versions of a
-- path share one position and the render order before the migration (slot, path, id) is unchanged.  The table is
-- append-only (an UPDATE is refused by cms_composition_instances_immutable_guard), so the one-time load pauses the two
-- row guards for exactly that statement and re-enables them in the same transaction; nothing else is touched.  On an
-- empty table the block is a no-op.  The DDL between the BEGIN/END markers is replayed against a populated table by
-- supabase/tests/phase_02_slice_12_pattern_placement/populated-position.sql (the two copies must stay byte-identical).
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

comment on column platform_private.cms_composition_instances.position is
  'DEC-185: the authored order of a row within its (revision_id, slot_key); a placement takes consecutive values in forest order after the slot greatest, every other append copies it unchanged; immutable per path.';

commit;
