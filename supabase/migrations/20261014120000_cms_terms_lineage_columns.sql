-- Slice 12 lane taxonomy-terms (BE03c 1371 "the terms belong to the vocabulary, not to a version ... `cms_terms` carries `taxonomy_id` and
-- `UNIQUE (taxonomy_id, term_key, version)`, so a successor version never duplicates or re-keys a term", 1428 TaxonomyTerm row, 1539;
-- P2-S12-AC-003, AC-016): the storage CMS-03C-03 needs.
--
-- cms_terms shipped keyed to the VERSION row (taxonomy_version_id): a term key was unique per version row, and a parent or merge successor had
-- to share the version row of its child.  A successor taxonomy version (CMS-03C-16 / -09) would have orphaned every term.  This migration
-- keys the vocabulary to its LINEAGE (taxonomy_id, the id of the version-1 row, carried by every successor, 20261014030000):
--   * adds taxonomy_id (backfilled from the version row each term was written under, NOT NULL, immutable);
--   * re-keys, under their existing names, the stable-key uniques to (taxonomy_id, term_key, version) and (taxonomy_id, term_key), and the
--     parent and successor foreign keys to (id, taxonomy_id, owner_id), so those links stay inside one vocabulary across taxonomy versions;
--   * pins taxonomy_version_id (the version in force when the row was written) to the term's own lineage and owner;
--   * keeps (id, taxonomy_version_id, owner_id) unique and the assignment foreign key unchanged: an assignment still names the write-version.
-- A BEFORE INSERT trigger fills an omitted taxonomy_id from the version row, so a direct insert that names only the version (existing
-- fixtures and tools) keeps working.  It runs on a POPULATED table: the backfill is deterministic (one version row per term) and the
-- migration refuses, with SQLSTATE 55000, any row it cannot place and any term key that repeats across the versions of one vocabulary (the
-- old unique was per version row, the new one is per lineage).  The lifecycle guard is paused for the backfill UPDATE only and restored.  The
-- other stored term guards need no pause: the hierarchy guard fires on `UPDATE OF parent_term_id, lifecycle` and the successor guard on
-- `UPDATE OF lifecycle, successor_id`, and the backfill sets taxonomy_id only, so a merged row whose survivor was later deprecated is
-- backfilled like any other.  populated-terms-lineage.sql replays the marked DDL below on a populated table to prove all of it.
-- The keyset index orders (taxonomy_id, term_key COLLATE "C", id), the order cmsTaxonomyTermsRead and the selector expose.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

comment on column platform_private.cms_terms.taxonomy_id is
  'BE03c lineage id (taxonomyId): the vocabulary the term belongs to; stable across taxonomy versions and merges, immutable.';
comment on column platform_private.cms_terms.taxonomy_version_id is
  'The taxonomy version row in force when the term row was first written; never re-pointed. The term belongs to taxonomy_id, not to this version.';

-- The producers write these stores as the CMS definer role (SEC-2: exactly the verbs the functions need).
grant select, insert, update on table platform_private.cms_terms to wejammin_cms_definer;
grant select, insert on table platform_private.cms_term_labels to wejammin_cms_definer;
grant select, insert on table platform_private.cms_term_assignments to wejammin_cms_definer;
grant execute on function platform_private.cms_json_bounded(jsonb, integer, integer, integer, integer) to wejammin_cms_definer;
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_terms_lineage_fill() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_terms_lineage_fill() from public, anon, authenticated, service_role;

-- The continuation job of a merge that outgrew its transaction (BE03c 1334, 1377).
select pg_catalog.set_config('app.cms_rpc', 'true', true);
insert into platform_private.job_type_registry (job_type) values ('cms.taxonomy.merge_converge') on conflict (job_type) do nothing;

commit;
