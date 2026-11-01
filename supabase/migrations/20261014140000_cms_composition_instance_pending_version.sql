-- Slice 12 lane pattern-updates (BE03c Canonical records 1426, Pattern versions and linked updates 1367; tracker P2-S12-AC-212,
-- AC-258 pending clause): the `pending_pattern_version` of a composition row.
--
--   pending_pattern_version integer NULL: non-null exactly when state = 'pending_diff'.  The linked-update scan appends a
--   `pending_diff` row pinned to the UNCHANGED version and carrying the newer version it waits for; CMS-03C-14 and CMS-03C-15
--   read and answer such a row.  Every other row carries none.
--
-- Populated-table rule: the column is added nullable, so every existing row carries NULL and the new CHECK holds for every row
-- that is not state `pending_diff`.  No producer has ever written a `pending_diff` row (the scan is a later lane), so a populated
-- database holds none; one that does (a hand-written fixture) would have no version to put in the column and the DDL refuses it
-- with SQLSTATE 55000 before changing anything instead of inventing a number.  The DDL between the BEGIN/END markers is replayed
-- against a populated table by supabase/tests/phase_02_slice_12_pattern_updates/populated-pending.sql.
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

comment on column platform_private.cms_composition_instances.pending_pattern_version is
  'BE03c 1426: the pattern version a pending_diff row waits for; non-null exactly when state = pending_diff. The row stays pinned to its unchanged pattern_version.';

commit;
