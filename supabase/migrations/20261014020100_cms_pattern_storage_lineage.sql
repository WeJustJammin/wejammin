-- Slice 12 lane pattern-def (BE03c Database Schema 1425, Registry invariants 215-219, E13, E14, DEC-188;
-- tracker P2-S12-AC-100 to AC-104, AC-211): the PatternVersion storage of CMS-03C-12.
--
-- cms_pattern_versions shipped (20260927290000) with the Slice 09 object-tree/global-key structure.  This
-- forward migration, run against a POPULATED table, makes it the locked PatternVersion record:
--   * pattern_id (the stable lineage id: the id of the version-1 row of (owner, key)), compatible_type_ids,
--     node_count and supersedes_id are added, all NOT NULL except supersedes_id (a first version has no parent);
--   * block_tree is the ordered PatternNode forest (a JSON array, BE03c 1425 "the bounded PatternNode forest"),
--     compatible_type_ids holds 1 to 64 UUIDs and node_count 1 to 512: EVERY row, with no grandfathered shape;
--   * (pattern_key, version) becomes unique PER OWNER (E14).  The constraint keeps its original NAME
--     cms_pattern_versions_key_version_key (a frozen suite asserts that name) and a new unique key
--     (pattern_id, version[, owner_id]) makes a version number unique within its lineage;
--   * the composition instance foreign key onto a VERSION ROW (id, version) is replaced by a LINEAGE key
--     (pattern_id, version, owner_id), because a placement pins the stable (patternId, patternVersion) of
--     PatternPlacementRequest and a successor's row id differs from its lineage id (BE03c 1426);
--   * the reserved route keys of E13 become a table CHECK.
-- Populated-table rule.  The only shape the table could hold before this migration is the legacy object tree
-- `{"nodes":[...]}` (the old CHECK admits nothing else): no PatternNode kind, key or blockVersion and no
-- compatible content types, so a legacy row can be converted to NO valid PatternVersion without inventing data.
-- The DDL therefore refuses, before it changes anything and with SQLSTATE 55000 and a message naming the count,
--   (1) a lineage (owner, key) that does not hold exactly versions 1..n: a lineage must root at its version-1 row
--       (BE03c 217), so it is never rooted at another version and no parent pointer skips a gap;
--   (2) a lineage with more than one active version;
--   (3) any remaining row (a clean 1..n chain of legacy object trees is still unconvertible).
-- On an empty table nothing is backfilled.  No producer ever wrote a pattern row, so a real database is empty.
-- The DDL between the BEGIN/END markers is replayed against a populated table by
-- supabase/tests/phase_02_slice_12_pattern_definition/populated-lineage.sql (kept byte-identical by a parity
-- test).  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

comment on column platform_private.cms_pattern_versions.pattern_id is
  'BE03c lineage id (patternId): the id of the version-1 row of (owner_id, pattern_key), carried by every successor.';
comment on column platform_private.cms_pattern_versions.compatible_type_ids is
  'BE03c OD-2: 1 to 64 distinct content type ids whose entries may use the pattern.';
comment on column platform_private.cms_pattern_versions.node_count is
  'BE03c: the node count after expanding nested pattern references (1 to 512).';
comment on column platform_private.cms_pattern_versions.supersedes_id is
  'BE03c: the exact parent version row a successor was created from; NULL for the first version.';
comment on constraint cms_pattern_versions_key_version_key on platform_private.cms_pattern_versions is
  'BE03c E14: a pattern key is unique per owner (owner_id, pattern_key, version), so a key held by another owner is indistinguishable from an unused one. The name predates E14 and is kept for the frozen composition authority suite.';

grant insert on table platform_private.cms_pattern_versions to wejammin_cms_definer;

commit;
