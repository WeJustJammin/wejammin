\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 12 FIX lane: populated-table witness for 20261013100000_cms_template_per_owner_keys_lineage.sql
-- (PAT-025). A fresh reset can never show that a forward migration succeeds on rows that already
-- exist, so this suite (1) builds a POPULATED table in its pre-migration shape (no template_id,
-- the global UNIQUE (template_key, version), the old definition guard, rows in every lifecycle
-- state including legacy rows the new rules refuse: the audience 'Public Members' and the keys
-- 'context' and 'new'), (2) replays the migration's DDL, which is the text between the
-- BEGIN/END FIX-TEMPLATE-LINEAGE-DDL markers copied verbatim (tests/contracts/
-- phase-02-slice-12-fix-template-witness-parity.test.ts fails if the two copies differ), and (3)
-- asserts the outcome row by row. [P2-S12-AC-190] [P2-S12-AC-191] [P2-S12-AC-192] [P2-S12-AC-189]

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_fix/000-owners.sqlinc

-- ------------------------------------------------ 1. the real rows (A chain of 3, B one)
select pg_temp.s12fix_as('A');
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12wit-chain', 's12wit-a-chain-0001'));
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12wit-chain', 's12wit-a-chain-0002', '1', 'members'));
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12wit-chain', 's12wit-a-chain-0003', '2', 'members'));
select pg_temp.s12fix_as('B');
select pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12wit-other', 's12wit-b-other-0001'));

-- ------------------------------------------------ 2. revert the table to its legacy shape
alter table platform_private.cms_template_versions disable trigger cms_template_versions_guard_trigger;
drop index platform_private.cms_template_versions_active_lineage_idx;
alter table platform_private.cms_template_versions
  drop constraint cms_template_versions_audience_grammar,
  drop constraint cms_template_versions_template_key_not_reserved,
  drop constraint cms_template_versions_owner_key_version_unique,
  drop constraint cms_template_versions_lineage_version_unique,
  drop constraint cms_template_versions_definition_valid;
alter table platform_private.cms_template_versions drop column template_id;
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_key_version_unique unique (template_key, version);
-- The definition guard exactly as 20260927200000 created it.
create or replace function platform_private.cms_template_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $body$
begin
  if pg_catalog.current_setting('app.cms_rpc', true) is distinct from 'true' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'draft' or new.updated_at <> new.created_at then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.state in ('active','superseded','retired','blocked') then
    raise exception 'CONFLICT' using errcode = 'P0001';
  end if;
  if new.id <> old.id or new.owner_id <> old.owner_id
     or new.template_key <> old.template_key or new.version <> old.version
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
alter table platform_private.cms_template_versions enable trigger cms_template_versions_guard_trigger;

-- ------------------------------------------------ 3. legacy rows the new rules refuse
select set_config('app.cms_rpc', 'true', true);
select pg_temp.s12fix_clone(
  (select id from platform_private.cms_template_versions where template_key = 's12wit-other'),
  'context', 'public');
select pg_temp.s12fix_clone(
  (select id from platform_private.cms_template_versions where template_key = 's12wit-other'),
  'new', 'public');
select pg_temp.s12fix_clone(
  (select id from platform_private.cms_template_versions where template_key = 's12wit-other'),
  's12wit-legacy-aud', 'Public Members');
-- every lifecycle state: v1 superseded, v2 retired, v3 active, 'new' retired, 'context' left a draft
update platform_private.cms_template_versions set state = 'superseded'
 where template_key = 's12wit-chain' and version = 1;
update platform_private.cms_template_versions set state = 'retired'
 where template_key = 's12wit-chain' and version = 2;
update platform_private.cms_template_versions set state = 'active'
 where template_key = 's12wit-chain' and version = 3;
update platform_private.cms_template_versions set state = 'retired' where template_key = 'new';
-- The definition CHECK as 20260927200000 created it, over the legacy audience rule is not needed:
-- the legacy rows predate the new audience grammar, so it returns NOT VALID like a deployed table.
alter table platform_private.cms_template_versions
  add constraint cms_template_versions_definition_valid check (
    platform_private.cms_template_manifest_valid(pg_catalog.jsonb_build_object(
      'templateKey', template_key, 'compatibleTypeIds', compatible_type_ids,
      'slots', slots, 'reservedRegions', reserved_regions, 'bindings', bindings,
      'locale', locale, 'audience', audience))) not valid;

create temp table s12wit_before on commit drop as
select id, owner_id, template_key, version, state, audience, supersedes_id
  from platform_private.cms_template_versions;
select is((select count(*)::integer from s12wit_before), 7,
  'the populated legacy table holds 7 rows in 4 lifecycle states before the migration');
select is(
  (select count(*)::integer from pg_catalog.pg_attribute
    where attrelid = 'platform_private.cms_template_versions'::regclass
      and attname = 'template_id' and not attisdropped),
  0, 'the legacy table has no lineage column yet');

-- ------------------------------------------------ 4. the migration DDL, replayed verbatim
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

-- ------------------------------------------------ 5. the outcome
select is((select count(*)::integer from platform_private.cms_template_versions), 7,
  'the migration kept all 7 rows [P2-S12-AC-191]');
select is(
  (select count(*)::integer from s12wit_before b
     join platform_private.cms_template_versions v using (id)
    where v.owner_id = b.owner_id and v.template_key = b.template_key and v.version = b.version
      and v.state = b.state and v.audience = b.audience
      and v.supersedes_id is not distinct from b.supersedes_id),
  7, 'no existing column of any row changed [P2-S12-AC-191]');
select is(
  (select count(*)::integer from platform_private.cms_template_versions where template_id is null),
  0, 'every row, in every lifecycle state, has a lineage id [P2-S12-AC-191]');
select is(
  (select count(distinct template_id)::integer from platform_private.cms_template_versions
    where template_key = 's12wit-chain'),
  1, 'the three versions of the chain share one lineage [P2-S12-AC-191]');
select is(
  (select template_id from platform_private.cms_template_versions
    where template_key = 's12wit-chain' and version = 1),
  (select id from platform_private.cms_template_versions
    where template_key = 's12wit-chain' and version = 1),
  'the lineage of a chain is the id of its version-1 row [P2-S12-AC-191]');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_id = id),
  5, 'the five version-1 rows (chain, other, context, new, legacy-aud) are each their own lineage [P2-S12-AC-191]');
select is(
  (select count(distinct template_id)::integer from platform_private.cms_template_versions),
  5, 'there are exactly five lineages: the three-version chain and the four single-row keys [P2-S12-AC-191]');
select ok(
  not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'platform_private.cms_template_versions'::regclass
       and conname = 'cms_template_versions_key_version_unique'),
  'the global UNIQUE (template_key, version) was dropped [P2-S12-AC-190]');
select is(
  (select convalidated from pg_catalog.pg_constraint
    where conname = 'cms_template_versions_template_key_not_reserved'),
  false, 'a legacy row named context or new keeps the reserved-key CHECK NOT VALID instead of aborting the deploy [P2-S12-AC-189]');
select is(
  (select convalidated from pg_catalog.pg_constraint
    where conname = 'cms_template_versions_audience_grammar'),
  false, 'a legacy audience outside the grammar keeps the audience CHECK NOT VALID instead of aborting the deploy [P2-S12-AC-192]');
select is(
  (select pg_get_userbyid(proowner)::text from pg_catalog.pg_proc
    where oid = 'platform_private.cms_template_versions_guard()'::regprocedure),
  'wejammin_cms_definer', 'the definition guard is owned by the definer role (SEC-2) [P2-S12-AC-191]');
select is(
  (select tgenabled::text from pg_catalog.pg_trigger
    where tgrelid = 'platform_private.cms_template_versions'::regclass
      and tgname = 'cms_template_versions_guard_trigger'),
  'O', 'the definition guard trigger is enabled again after the backfill');

-- New and updated rows are governed by the new rules even though legacy rows exist.
select set_config('app.cms_rpc', 'true', true);
select is(
  pg_temp.s12fix_clone((select id from s12wit_before where template_key = 's12wit-other'),
    'versions')->>'constraint',
  'cms_template_versions_template_key_not_reserved',
  'a NEW row named versions is still refused on the populated table [P2-S12-AC-189]');
select is(
  pg_temp.s12fix_clone((select id from s12wit_before where template_key = 's12wit-other'),
    's12wit-new-aud', 'Public')->>'constraint',
  'cms_template_versions_audience_grammar',
  'a NEW row with a legacy-style audience is still refused on the populated table [P2-S12-AC-192]');
select is(
  pg_temp.s12fix_try(format(
    $u$update platform_private.cms_template_versions set state = 'approved' where id = %L::uuid returning jsonb_build_object('id', id)$u$,
    (select id from s12wit_before where template_key = 's12wit-other')))->>'state',
  '00000',
  'a conforming legacy row can still advance its state after the migration');
select is(
  pg_temp.s12fix_try(format(
    $u$update platform_private.cms_template_versions set state = 'approved' where id = %L::uuid returning jsonb_build_object('id', id)$u$,
    (select id from s12wit_before where template_key = 'context')))->>'constraint',
  'cms_template_versions_template_key_not_reserved',
  'a legacy row named like a fixed route cannot advance, so it can never be activated [P2-S12-AC-189]');
select is(
  pg_temp.s12fix_try(format(
    $u$update platform_private.cms_template_versions set state = 'approved' where id = %L::uuid returning jsonb_build_object('id', id)$u$,
    (select id from s12wit_before where template_key = 's12wit-legacy-aud')))->>'constraint',
  'cms_template_versions_audience_grammar',
  'a legacy row with an audience outside the grammar cannot advance either [P2-S12-AC-192]');

-- Per-owner keys on the populated table: a second owner can now hold a legacy key.
select pg_temp.s12fix_as('B');
select is(
  pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12wit-chain', 's12wit-b-chain-0001'))->>'state',
  '00000',
  'owner B defines the key owner A already holds on the populated table [P2-S12-AC-190]');

select finish();
rollback;
