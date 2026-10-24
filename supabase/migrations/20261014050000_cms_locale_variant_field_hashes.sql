-- Slice 12 lane locale, CMS-03C-04 persistence delta (BE03c LocaleVariant row 1431; tracker
-- P2-S12-AC-054, AC-234, AC-235, AC-260): per-field staleness storage and the two-state physical
-- vocabulary of cms_locale_variants.
--
--   field_source_hashes jsonb NOT NULL DEFAULT '{}'   an object of at most 128 field-id keys to 64-hex
--       hashes: the source value hash of each translated field at write time.
--   stale_field_ids     jsonb NOT NULL DEFAULT '[]'   an array of at most 128 unique UUIDs: the
--       translated fields whose current source value hash differs, written by the source-change
--       fan-out; empty unless the row is `stale`.
--   state               the physical state is `draft` or `stale`; `review`, `approved` and
--       `untranslated` are derived (cms_locale_variant_state) and never stored.
--
-- The table is append-only (updated_at = created_at, UPDATE and DELETE refused), so a row written
-- before this migration keeps the defaults: it records no hashes (the resolver treats a legacy stale
-- row as stale in every field, the conservative reading) and no stale ids.  Adding a column with a
-- constant default does not rewrite the table.  The state restriction needs no data repair: only the
-- `draft` and `stale` states were ever written.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_locale_hashes_valid(p_hashes jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.jsonb_typeof(p_hashes) = 'object'
     and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_hashes)) <= 128
     and not exists (
       select 1 from pg_catalog.jsonb_each(p_hashes) member
        where member.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or pg_catalog.jsonb_typeof(member.value) is distinct from 'string'
           or (member.value #>> '{}') !~ '^[a-f0-9]{64}$')
$body$;

create function platform_private.cms_locale_stale_ids_valid(p_ids jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $body$
  select pg_catalog.jsonb_typeof(p_ids) = 'array'
     and pg_catalog.jsonb_array_length(p_ids) <= 128
     and not exists (
       select 1 from pg_catalog.jsonb_array_elements(p_ids) member
        where pg_catalog.jsonb_typeof(member.value) is distinct from 'string'
           or (member.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
     and (select pg_catalog.count(distinct member.value) from pg_catalog.jsonb_array_elements(p_ids) member)
         = pg_catalog.jsonb_array_length(p_ids)
$body$;

comment on function platform_private.cms_locale_hashes_valid(jsonb) is
  'CMS-03C-04: true for a JSON object of at most 128 lowercase field-id UUID keys to 64-hex hashes. Private; IMMUTABLE.';
comment on function platform_private.cms_locale_stale_ids_valid(jsonb) is
  'CMS-03C-04: true for a JSON array of at most 128 unique lowercase UUID strings. Private; IMMUTABLE.';

revoke all on function platform_private.cms_locale_hashes_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_locale_stale_ids_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_locale_hashes_valid(jsonb) to wejammin_cms_definer;
grant execute on function platform_private.cms_locale_stale_ids_valid(jsonb) to wejammin_cms_definer;

alter table platform_private.cms_locale_variants
  add column field_source_hashes jsonb not null default '{}'::jsonb,
  add column stale_field_ids jsonb not null default '[]'::jsonb;

alter table platform_private.cms_locale_variants
  add constraint cms_locale_variants_field_source_hashes_check
    check (platform_private.cms_locale_hashes_valid(field_source_hashes)),
  add constraint cms_locale_variants_stale_field_ids_check
    check (platform_private.cms_locale_stale_ids_valid(stale_field_ids)),
  add constraint cms_locale_variants_stale_ids_only_stale_check
    check (state = 'stale' or stale_field_ids = '[]'::jsonb);

-- The physical state: replace the five-value CHECK (found by its definition, not its name).
do $state$
declare
  old_name text;
begin
  select constraint_row.conname into old_name
    from pg_catalog.pg_constraint constraint_row
   where constraint_row.conrelid = 'platform_private.cms_locale_variants'::pg_catalog.regclass
     and constraint_row.contype = 'c'
     and pg_catalog.pg_get_constraintdef(constraint_row.oid) like '%untranslated%';
  if old_name is null then
    raise exception 'cms_locale_variants state check not found' using errcode = '55000';
  end if;
  execute pg_catalog.format('alter table platform_private.cms_locale_variants drop constraint %I', old_name);
end;
$state$;
alter table platform_private.cms_locale_variants
  add constraint cms_locale_variants_state_check check (state in ('draft', 'stale'));

commit;
