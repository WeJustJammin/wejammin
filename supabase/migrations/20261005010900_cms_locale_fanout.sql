-- D12 localization fan-out: the canonical producer
-- platform_private.cms_stale_locale_dependents(source_id, true) owns all
-- staleness semantics. This migration adds the locked D12 named wrapper
-- (entry, revision identity, limit argument for the RED probe) that the
-- Slice 10 QA-RED suite calls, and delegates to the canonical producer.
-- Forward-only; no seeding, no diagnostics, no duplicated logic.
begin;

grant create on schema platform_private to wejammin_cms_definer;

create or replace function platform_private.cms_localization_fanout(
  p_entry_id uuid,
  p_source_revision_id uuid,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $body$
declare
  -- Variables carry a v_ prefix so no name can shadow a cms_locale_variants column
  -- (source_locale, source_hash) inside the preflight query: an unqualified column of
  -- the same name raised 42702 on every call that reached the count.
  v_source_entry_id uuid;
  v_source_locale text;
  v_source_hash text;
  v_dependent_count integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 32 then
    raise exception 'LOCALE_FANOUT_LIMIT' using errcode = 'P0001';
  end if;

  if p_entry_id is null or p_source_revision_id is null then
    raise exception 'LOCALE_FANOUT_REQUEST' using errcode = 'P0001';
  end if;

  -- Bind both caller-supplied identities before the canonical producer is
  -- reached.  A revision from another entry must never be usable to fan out
  -- the requested entry's locales.
  select revision.entry_id, revision.locale, revision.payload_hash::text
    into v_source_entry_id, v_source_locale, v_source_hash
  from platform_private.cms_entry_revisions revision
  where revision.id = p_source_revision_id;
  if not found or v_source_entry_id is distinct from p_entry_id then
    raise exception 'LOCALE_FANOUT_ENTRY_MISMATCH' using errcode = 'P0001';
  end if;

  -- Serialize the preflight with the canonical producer's entry lock.  Count
  -- latest dependent locales before writing so p_limit is a hard ceiling and
  -- no over-limit fan-out is silently truncated.
  perform 1
  from platform_private.cms_content_entries entry_row
  where entry_row.id = p_entry_id
  for update;
  if not found then
    raise exception 'LOCALE_FANOUT_ENTRY_MISMATCH' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_dependent_count
  from (
    select distinct on (pg_catalog.lower(variant.locale))
      variant.state, variant.source_hash
    from platform_private.cms_locale_variants variant
    where variant.entry_id = p_entry_id
      and pg_catalog.lower(variant.source_locale) = pg_catalog.lower(v_source_locale)
    order by pg_catalog.lower(variant.locale), variant.version desc,
             variant.created_at desc, variant.id desc
  ) latest
  where latest.state <> 'stale'
    and latest.source_hash::text is distinct from v_source_hash;

  if v_dependent_count > p_limit then
    raise exception 'LOCALE_FANOUT_LIMIT' using errcode = 'P0001';
  end if;

  return platform_private.cms_stale_locale_dependents(p_source_revision_id, true);
end;
$body$;

alter function platform_private.cms_localization_fanout(uuid, uuid, integer)
  owner to wejammin_cms_definer;

revoke create on schema platform_private from wejammin_cms_definer;

revoke all on function platform_private.cms_localization_fanout(uuid, uuid, integer)
  from public, anon, authenticated, service_role;

commit;
