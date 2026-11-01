-- Slice 12 FIX (BE03c E13, E14, E4 and the lineage id; P2-S12-AC-022, AC-025, AC-189 to AC-192).
--
-- CMS-03C-01 shipped with a GLOBAL UNIQUE (template_key, version): a second owner defining a key
-- another owner held got a CONFLICT, which disclosed that the key exists.  This migration makes the
-- key unique per owner, adds the stable lineage id (templateId) the locked resource carries, and adds
-- the table-level CHECKs of the reserved route keys (E13) and the audience grammar (E4).  The RPC
-- bodies follow in 20261013100100 to 20261013100300.  Forward-only.
--
-- It runs on a POPULATED table: the lineage id is backfilled from the supersedes_id chain before it
-- is made NOT NULL, the old global unique is replaced by a strictly weaker per-owner one (every
-- existing row satisfies it), and both new CHECKs are added NOT VALID and validated only when no
-- existing row violates them, so a legacy row (a 1 to 64 character audience such as 'Public Members',
-- or a key named like a fixed route) never aborts the deploy; it simply cannot be updated again.
-- The DDL between the BEGIN/END markers is replayed and witnessed against a populated table by
-- supabase/tests/phase_02_slice_12_fix_template_populated.sql.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- BEGIN FIX-TEMPLATE-LINEAGE-DDL

-- 1. The lineage id: the id of the version-1 row of (owner, key), carried by every successor.
alter table platform_private.cms_template_versions add column template_id uuid;

-- The backfill UPDATE re-evaluates every CHECK of the table on the rows it touches, and a legacy row
-- may sit outside a rule a later migration tightens, so the definition CHECK is paused for the
-- backfill and restored below exactly as it was created (NOT VALID, then validated when no row
-- violates it).  The definition guard refuses every UPDATE of a terminal row, so it is paused too and
-- restored before this transaction ends.
alter table platform_private.cms_template_versions
  drop constraint cms_template_versions_definition_valid;
alter table platform_private.cms_template_versions disable trigger cms_template_versions_guard_trigger;
with recursive lineage(id, root_id) as (
  select root.id, root.id
    from platform_private.cms_template_versions root
   where root.supersedes_id is null
  union all
  select child.id, lineage.root_id
    from platform_private.cms_template_versions child
    join lineage on child.supersedes_id = lineage.id
)
update platform_private.cms_template_versions version_row
   set template_id = lineage.root_id
  from lineage
 where version_row.id = lineage.id;

do $selfcheck$
begin
  if exists (select 1 from platform_private.cms_template_versions where template_id is null) then
    raise exception 'template lineage backfill left rows without a root (supersedes_id cycle or orphan)'
      using errcode = '55000';
  end if;
  if exists (
    select 1
      from platform_private.cms_template_versions child
      join platform_private.cms_template_versions parent on parent.id = child.supersedes_id
     where child.template_id <> parent.template_id
        or child.owner_id <> parent.owner_id
        or child.template_key <> parent.template_key
  ) then
    raise exception 'template lineage crosses an owner or a key'
      using errcode = '55000';
  end if;
end;
$selfcheck$;

alter table platform_private.cms_template_versions
  add constraint cms_template_versions_definition_valid check (
    platform_private.cms_template_manifest_valid(pg_catalog.jsonb_build_object(
      'templateKey', template_key,
      'compatibleTypeIds', compatible_type_ids,
      'slots', slots,
      'reservedRegions', reserved_regions,
      'bindings', bindings,
      'locale', locale,
      'audience', audience
    ))
  ) not valid;
alter table platform_private.cms_template_versions alter column template_id set not null;

-- 2. E14: a version number is unique within a lineage, and the key is unique PER OWNER.
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_lineage_version_unique unique (template_id, version);
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_owner_key_version_unique unique (owner_id, template_key, version);
alter table platform_private.cms_template_versions
  drop constraint cms_template_versions_key_version_unique;
create unique index cms_template_versions_active_lineage_idx
  on platform_private.cms_template_versions (template_id) where state = 'active';

-- 3. E13 and E4 as table CHECKs.  NOT VALID enforces them on every new and updated row; they are
-- validated at once when no existing row violates them.
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_template_key_not_reserved
  check (template_key not in ('context', 'versions', 'new')) not valid;
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_audience_grammar
  check (audience ~ '^[a-z0-9_-]{1,48}$') not valid;

do $validate$
begin
  if not exists (
    select 1 from platform_private.cms_template_versions version_row
     where not platform_private.cms_template_manifest_valid(pg_catalog.jsonb_build_object(
       'templateKey', version_row.template_key,
       'compatibleTypeIds', version_row.compatible_type_ids,
       'slots', version_row.slots,
       'reservedRegions', version_row.reserved_regions,
       'bindings', version_row.bindings,
       'locale', version_row.locale,
       'audience', version_row.audience))
  ) then
    alter table platform_private.cms_template_versions
      validate constraint cms_template_versions_definition_valid;
  end if;
  if not exists (
    select 1 from platform_private.cms_template_versions
     where template_key in ('context', 'versions', 'new')
  ) then
    alter table platform_private.cms_template_versions
      validate constraint cms_template_versions_template_key_not_reserved;
  end if;
  if not exists (
    select 1 from platform_private.cms_template_versions
     where audience !~ '^[a-z0-9_-]{1,48}$'
  ) then
    alter table platform_private.cms_template_versions
      validate constraint cms_template_versions_audience_grammar;
  end if;
end;
$validate$;

-- 4. The lineage guard, folded into the existing definition guard (no new trigger).  A first version
-- is its own lineage; a successor carries its parent's lineage and must directly follow a row of the
-- SAME owner and key.  A direct insert that omits the lineage id gets the right one (existing
-- fixtures and tools keep working); a wrong one is refused; the lineage id of a stored row never
-- changes.  Everything else is the body of 20260927200000 unchanged.
create or replace function platform_private.cms_template_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
declare
  parent platform_private.cms_template_versions%rowtype;
  expected_lineage uuid;
begin
  if pg_catalog.current_setting('app.cms_rpc', true) is distinct from 'true' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    if new.supersedes_id is null then
      expected_lineage := new.id;
    else
      select * into parent
        from platform_private.cms_template_versions candidate
       where candidate.id = new.supersedes_id;
      if not found
         or parent.owner_id <> new.owner_id
         or parent.template_key <> new.template_key
         or parent.version + 1 <> new.version then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
      end if;
      expected_lineage := parent.template_id;
    end if;
    if new.template_id is null then
      new.template_id := expected_lineage;
    elsif new.template_id <> expected_lineage then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active','superseded','retired','blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if new.id <> old.id or new.owner_id <> old.owner_id
     or new.template_key <> old.template_key or new.version <> old.version
     or new.template_id is distinct from old.template_id
     or new.compatible_type_ids <> old.compatible_type_ids
     or new.slots <> old.slots or new.reserved_regions <> old.reserved_regions
     or new.bindings <> old.bindings or new.locale <> old.locale
     or new.audience <> old.audience or new.content_hash <> old.content_hash
     or new.block_registry_digest <> old.block_registry_digest
     or new.supersedes_id is distinct from old.supersedes_id
     or new.created_by <> old.created_by or new.created_at <> old.created_at
     or new.updated_at < old.updated_at then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

-- The body now names a forced CMS table, so (SEC-2) the definer role owns it and the forced policies
-- apply to the statements it runs.
grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_template_versions_guard() owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

alter table platform_private.cms_template_versions enable trigger cms_template_versions_guard_trigger;

comment on column platform_private.cms_template_versions.template_id is
  'BE03c lineage id (templateId): the id of the version-1 row of (owner_id, template_key), carried by every successor.';
comment on constraint cms_template_versions_owner_key_version_unique
  on platform_private.cms_template_versions is
  'BE03c E14: a template key is unique per owner, so a key held by another owner is indistinguishable from an unused one.';

-- END FIX-TEMPLATE-LINEAGE-DDL

commit;
