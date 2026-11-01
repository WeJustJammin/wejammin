-- Slice 12 lane taxonomy-def (BE03c E14 at 218, lineage ids at 219, DEC-135 at 1375, DEC-188 at 208, TaxonomyVersion
-- row at 1427; P2-S12-AC-124..128, AC-177..182): the storage a taxonomy vocabulary lineage needs.
--
-- cms_taxonomy_versions shipped with a GLOBAL UNIQUE (taxonomy_key, version), no lineage id, no parent
-- pointer and no declared-domain column.  A second owner defining a key another owner held would have been
-- answered CONFLICT, which discloses that the key exists.  This migration adds
--   * taxonomy_id   the stable lineage id: the id of the version-1 row of (owner, key), on every successor;
--   * supersedes_id the parent version row (NULL on the first version), same owner;
--   * canonical_overlap_domains  the DEC-135 declared domains: a unique list of at most six of the closed set;
--     (the closed set is the one cms_canonical_domain_registry_domain_check pins in 20261013300100; the producer
--     also reads the registry at create, so a seventh registered domain must be added to this validator and CHECK);
-- makes the key unique PER OWNER (replacing the global unique), makes a version number unique within its
-- lineage, and allows at most one active version per vocabulary.  The terms stay keyed to the version row
-- they were created under (CMS-03C-03 re-keys them to the lineage in its own migration; a version row is never
-- deleted or re-pointed, so that foreign key stays valid in the meantime).
--
-- It runs on a POPULATED table.  Legacy rows carry no parent pointer, so the lineage is reconstructed
-- deterministically from (owner_id, taxonomy_key) ordered by version; that is only unambiguous when the
-- versions of a key are exactly 1..n and at most one is active.  Any other shape is refused with SQLSTATE 55000
-- and a message naming the count, so a deploy fails loudly instead of guessing.  The DDL between the
-- BEGIN/END markers is what the populated-table witness replays.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

-- The producer inserts rows; reads and locks were granted by the governed lifecycle migration.
grant insert on table platform_private.cms_taxonomy_versions to wejammin_cms_definer;

comment on column platform_private.cms_taxonomy_versions.taxonomy_id is
  'BE03c lineage id (taxonomyId): the id of the version-1 row of (owner_id, taxonomy_key), carried by every successor.';
comment on column platform_private.cms_taxonomy_versions.supersedes_id is
  'BE03c: the parent version row (same owner, same key, definition number - 1); NULL on the first version.';
comment on column platform_private.cms_taxonomy_versions.canonical_overlap_domains is
  'DEC-135: the canonical overlap domains this vocabulary declares, frozen into the reviewed version.';
comment on constraint cms_taxonomy_versions_owner_key_version_unique
  on platform_private.cms_taxonomy_versions is
  'BE03c E14: a taxonomy key is unique per owner, so a key held by another owner is indistinguishable from an unused one.';

commit;
