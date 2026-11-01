-- Slice 12 lane governed-b (BE03c "Slice 12 lock order" 1336-1348, "Governed activation ..." 1324-1326; tracker P2-S12-AC-087, AC-153): the lineage
-- advisory lock helpers CMS-03C-09 (activate, schedule) and CMS-03C-19 (execute) share.  The advisory lock is the LAST lock position (1338: a
-- command never acquires an earlier position after a later one), so the conflict re-read under it takes no row lock.
--
--   cms_governed_read_lineage_active(kind, lineage, except)  the lineage's current `active` version row WITHOUT a row lock (NULL when none): under
--       the advisory lock every writer of the active row is serialized out, so a plain read is exact (volatile: a fresh snapshot per query)
--   cms_governed_lineage_lock_key(kind, lineage)             the one place the advisory key is derived
--   cms_governed_take_lineage_advisory(kind, lineage)        pg_advisory_xact_lock(key), transaction-scoped
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_read_lineage_active(p_kind text, p_lineage_id uuid, p_except_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_id uuid;
begin
  -- volatile on purpose: every query takes a fresh snapshot, so a version committed while the caller waited for the advisory lock is seen
  if p_kind = 'template_version' then
    select item.id into v_id from platform_private.cms_template_versions item
     where item.template_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id;
  elsif p_kind = 'pattern_version' then
    select item.id into v_id from platform_private.cms_pattern_versions item
     where item.pattern_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id;
  elsif p_kind = 'taxonomy_version' then
    select item.id into v_id from platform_private.cms_taxonomy_versions item
     where item.taxonomy_id = p_lineage_id and item.state = 'active' and item.id <> p_except_id;
  else
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return v_id;
end;
$body$;

comment on function platform_private.cms_governed_read_lineage_active(text, uuid, uuid) is
  'BE03c Slice 12 lock order: the current active version row of a lineage other than the subject, read WITHOUT a row lock (NULL when none). For the re-read under the lineage advisory lock, which is the last lock position. Private.';

create or replace function platform_private.cms_governed_lineage_lock_key(p_kind text, p_lineage_id uuid)
returns bigint
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.hashtextextended('cms.governed.lineage:' || p_kind || ':' || p_lineage_id::text, 0)
$body$;

comment on function platform_private.cms_governed_lineage_lock_key(text, uuid) is
  'The lineage advisory lock key shared by CMS-03C-09 (activate, schedule) and CMS-03C-19 (execute): hashtextextended(''cms.governed.lineage:<kind>:<lineage>'', 0). NULL for a NULL argument. Private.';

create or replace function platform_private.cms_governed_take_lineage_advisory(p_kind text, p_lineage_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $body$
declare
  v_key bigint := platform_private.cms_governed_lineage_lock_key(p_kind, p_lineage_id);
begin
  if v_key is null then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(v_key);
end;
$body$;

comment on function platform_private.cms_governed_take_lineage_advisory(text, uuid) is
  'BE03c Slice 12 lock order, last position: the transaction-scoped advisory lock of one lineage (cms_governed_lineage_lock_key). Taken by CMS-03C-09 activate and schedule and by CMS-03C-19 execute after every row lock, so racing switchers of one lineage serialize. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_read_lineage_active(text, uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_lineage_lock_key(text, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_governed_take_lineage_advisory(text, uuid) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_governed_read_lineage_active(text, uuid, uuid),
  platform_private.cms_governed_lineage_lock_key(text, uuid),
  platform_private.cms_governed_take_lineage_advisory(text, uuid)
  from public, anon, authenticated, service_role;

commit;
