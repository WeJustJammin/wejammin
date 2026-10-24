-- Slice 12 lane locale, CMS-03C-04 / CMS-03C-20 shared helpers (BE03c Locale field resolution (DEC-121,
-- DEC-138) and fan-out (D12) 1387-1395; tracker P2-S12-AC-235, AC-237):
--
--   cms_uuid_v5(namespace, name)             RFC 4122 UUIDv5 (SHA-1), pure.
--   cms_locale_aggregate_id(entry, locale)   the locale aggregate: UUIDv5 over the entry id and the locale
--       under the fixed namespace `cms.locale.aggregate.v1`.  The spec names the namespace but gives no
--       UUID, so the namespace UUID is itself the UUIDv5, under the RFC 4122 DNS namespace
--       (6ba7b810-9dad-11d1-80b4-00c04fd430c8), of the string `cms.locale.aggregate.v1`, and the name is
--       the lowercase entry id, a colon and the lowercase locale (every locale comparison of the
--       aggregate is case-insensitive).  The recipe is an implementation decision recorded in the lane
--       report for ratification.
--   cms_locale_source_field_hash(rev, field) the source value hash of one field in one revision: the stored
--       value_hash, else the JCS hash of the stored value, else the hash of JSON null (an absent value
--       and an explicit null are the same source state).
--   cms_locale_stale_fields(entry, locale)   the translated fields of the locale whose current source value
--       hash differs from the one the latest variant row recorded at write time.  A legacy stale row (no
--       recorded hashes) is stale in every field of its revision.  Sorted jsonb array of field-id strings.
--
-- All are private; the two readers are SECURITY DEFINER owned by the CMS definer (SEC-2) and run under the
-- CMS RPC context, like every other read helper.  Forward-only.
begin;
set local lock_timeout = '5s';

create function platform_private.cms_uuid_v5(p_namespace uuid, p_name text)
returns uuid
language sql
immutable
strict
set search_path = ''
as $body$
  select pg_catalog.encode(
    pg_catalog.set_byte(
      pg_catalog.set_byte(hashed.bytes, 6, (pg_catalog.get_byte(hashed.bytes, 6) & 15) | 80),
      8, (pg_catalog.get_byte(hashed.bytes, 8) & 63) | 128),
    'hex')::uuid
  from (
    select pg_catalog.substr(extensions.digest(
      pg_catalog.decode(pg_catalog.replace(p_namespace::text, '-', ''), 'hex')
        || pg_catalog.convert_to(p_name, 'utf8'), 'sha1'), 1, 16) as bytes
  ) hashed
$body$;

create function platform_private.cms_locale_aggregate_id(p_entry_id uuid, p_locale text)
returns uuid
language sql
immutable
strict
set search_path = ''
as $body$
  select platform_private.cms_uuid_v5(
    platform_private.cms_uuid_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'cms.locale.aggregate.v1'),
    pg_catalog.lower(p_entry_id::text) || ':' || pg_catalog.lower(p_locale))
$body$;

comment on function platform_private.cms_uuid_v5(uuid, text) is
  'RFC 4122 UUIDv5: SHA-1 over the namespace bytes and the UTF-8 name, version 5 and variant bits set. Private; IMMUTABLE.';
comment on function platform_private.cms_locale_aggregate_id(uuid, text) is
  'D12: the id of the locale aggregate (entry, locale), the outbox aggregate id of cms.localization.changed.v1 under aggregate type cms_locale_variant. Private; IMMUTABLE.';

create function platform_private.cms_locale_source_field_hash(p_revision_id uuid, p_field_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select coalesce(
    (select coalesce(value_row.value_hash::text,
                     platform_private.cms_jcs_sha256(coalesce(value_row.value, 'null'::jsonb)))
       from platform_private.cms_entry_field_values value_row
       join platform_private.cms_entry_revisions revision on revision.id = value_row.revision_id
      where value_row.revision_id = p_revision_id
        and value_row.field_id = p_field_id
        and value_row.locale = revision.locale),
    platform_private.cms_jcs_sha256('null'::jsonb))
$body$;

comment on function platform_private.cms_locale_source_field_hash(uuid, uuid) is
  'D12: the source value hash of one field in one revision (stored hash, else the JCS hash of the value, else the hash of JSON null). Private; STABLE; callers run under the CMS RPC context.';

create function platform_private.cms_locale_stale_fields(p_entry_id uuid, p_locale text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  with latest as (
    select variant.*
      from platform_private.cms_locale_variants variant
     where variant.entry_id = p_entry_id
       and pg_catalog.lower(variant.locale) = pg_catalog.lower(p_locale)
     order by variant.version desc, variant.created_at desc, variant.id desc
     limit 1
  ), source as (
    select revision.id
      from latest
      join platform_private.cms_entry_revisions revision
        on revision.entry_id = latest.entry_id
       and pg_catalog.lower(revision.locale) = pg_catalog.lower(latest.source_locale)
     order by revision.revision_number desc, revision.id desc
     limit 1
  )
  select coalesce(
    (select pg_catalog.jsonb_agg(stale.field_id order by stale.field_id)
       from (
         select recorded.key as field_id
           from latest, source, pg_catalog.jsonb_each_text(latest.field_source_hashes) recorded
          where recorded.value is distinct from
                platform_private.cms_locale_source_field_hash(source.id, recorded.key::uuid)
         union
         select value_row.field_id::text
           from latest, platform_private.cms_entry_field_values value_row
          where latest.state = 'stale' and latest.field_source_hashes = '{}'::jsonb
            and value_row.revision_id = latest.revision_id
       ) stale),
    '[]'::jsonb)
$body$;

comment on function platform_private.cms_locale_stale_fields(uuid, text) is
  'D12, DEC-121: the translated fields of the locale whose current source value hash differs from the one recorded when the latest variant row was written (a legacy stale row without recorded hashes is stale in every field of its revision). Sorted jsonb array. Private; STABLE; callers run under the CMS RPC context.';

grant select on table
  platform_private.cms_entry_field_values,
  platform_private.cms_entry_revisions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_source_field_hash(uuid, uuid) owner to wejammin_cms_definer;
alter function platform_private.cms_locale_stale_fields(uuid, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_uuid_v5(uuid, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_locale_aggregate_id(uuid, text) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_locale_source_field_hash(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_locale_stale_fields(uuid, text) from public, anon, authenticated, service_role;
grant execute on function platform_private.cms_uuid_v5(uuid, text) to wejammin_cms_definer;
grant execute on function platform_private.cms_locale_aggregate_id(uuid, text) to wejammin_cms_definer;

commit;
