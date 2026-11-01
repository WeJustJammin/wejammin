-- Slice 12 lane dec208, database-side locale observability (owner decision DEC-208, mechanism DEC-213; BE03c Observability
-- `Database-side locale observability (DEC-208)`, `Fan-out bound and event key (D12)`; tracker P2-S12-AC-052, AC-263, AC-264):
--   platform_private.cms_locale_observability_read(p_window_start timestamptz, p_window_end timestamptz) returns jsonb
--     { fanoutRows, staleFieldsAppended, staleLegalFields }   three non-negative integers and nothing else
-- The Worker reads it on its `* * * * *` tick with the closed-open window [T - 3 min, T - 2 min).
--   fanoutRows           the cms_locale_variants rows in state `stale` (only the source-change fan-out writes that state) whose
--                        created_at lies in [p_window_start, p_window_end).  created_at is the clock_timestamp() the fan-out
--                        writer (cms_stale_locale_dependents) takes when it starts, never earlier than the writer's transaction
--                        start, so a writer transaction shorter than two minutes still commits inside the window that reads it;
--   staleFieldsAppended  the sum of jsonb_array_length(stale_field_ids) over those rows (a legacy stale row holding [] adds 0);
--   staleLegalFields     a point-in-time count, over the current locale variant of every entry whose lifecycle is `active` (an
--                        archived, deletion_pending or held entry cannot be revalidated, so counting it would hold the alert
--                        open; DEC-216) (the newest row per entry and case-insensitive locale by version, created_at, id
--                        descending: the cmsLocaleVariantRead rule), of the stale_field_ids members whose locale policy is
--                        `no_fallback` in the entry's current (ACTIVE) schema version: the localization_mode predicate
--                        cms_locale_resolutions applies to a requested field of the active version.  A superseded stale row is
--                        never counted; the window does not move this number.
-- Refusal: VALIDATION_FAILED (P0001) with DETAIL {"violations":[{"pointer","message"}]} (the locale-configuration producer
-- convention, 20261002164000) unless both bounds are finite whole minutes and p_window_end - p_window_start is exactly 60 s.
-- RPC context (SEC-2, DEC-216): the four tables it reads are FORCE ROW LEVEL SECURITY with one policy that admits a row only
-- while app.cms_rpc = 'true', and the owner wejammin_cms_definer is NOBYPASSRLS, so the reader sets the transaction-local flag
-- after validating the window; the platform_api transport remembers the caller's value and restores it (20261003120410).
-- A read: no lock, no insert/update/delete, no audit/outbox/receipt row (VOLATILE only because it sets the flag).  The 5 s bound
-- of the call is the Worker's 5,000 ms call deadline (an abort is a failed read); no function-level statement_timeout is set
-- (it cannot bound the calling statement).  Private, SECURITY DEFINER owned by the CMS definer (SEC-2), empty search_path,
-- EXECUTE revoked from PUBLIC, anon, authenticated and service_role (the platform_api transport is 20261022100020).
-- Cost (DEC-219): cms_locale_variants is append-only, so neither count may grow with its history.  The window counts read only
-- the window's rows through INDEX(state, created_at); the gauge (20261022100005) starts from the `active` entries and skip-scans
-- INDEX(entry_id, locale, ...) on the plain column (lower() is not leakproof under forced RLS, 20261022100000) once per distinct
-- raw locale, then keeps the newest row per case-insensitive locale, so a tick costs live entries x locales (at most 32 per entry).
-- Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_locale_observability_read(
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $body$
declare
  v_fanout_rows bigint;
  v_stale_fields_appended bigint;
  v_stale_legal_fields bigint;
begin
  if p_window_start is null or not pg_catalog.isfinite(p_window_start)
     or pg_catalog.mod(extract(epoch from p_window_start), 60) <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = '{"violations":[{"pointer":"/p_window_start","message":"must be a finite whole minute"}]}';
  end if;
  if p_window_end is null or not pg_catalog.isfinite(p_window_end)
     or pg_catalog.mod(extract(epoch from p_window_end), 60) <> 0 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = '{"violations":[{"pointer":"/p_window_end","message":"must be a finite whole minute"}]}';
  end if;
  if p_window_end - p_window_start <> interval '60 seconds' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001',
      detail = '{"violations":[{"pointer":"/p_window_end","message":"must be exactly 60 seconds after p_window_start"}]}';
  end if;

  perform pg_catalog.set_config('app.cms_rpc', 'true', true);

  select pg_catalog.count(*),
         coalesce(pg_catalog.sum(pg_catalog.jsonb_array_length(variant.stale_field_ids)), 0)
    into v_fanout_rows, v_stale_fields_appended
    from platform_private.cms_locale_variants variant
   where variant.state = 'stale'
     and variant.created_at >= p_window_start
     and variant.created_at < p_window_end;

  v_stale_legal_fields := platform_private.cms_locale_stale_legal_field_count();

  return pg_catalog.jsonb_build_object(
    'fanoutRows', v_fanout_rows,
    'staleFieldsAppended', v_stale_fields_appended,
    'staleLegalFields', v_stale_legal_fields);
end;
$body$;

comment on function platform_private.cms_locale_observability_read(timestamptz, timestamptz) is
  'DEC-208 / DEC-213 / DEC-216: the Worker''s per-minute locale observability sample: fan-out rows and stale fields appended in the closed-open one-minute window, and the point-in-time count of stale no_fallback fields on current locale variants of active entries. Three non-negative integers, no identifier or text. A read: no lock, no write; it sets and the transport restores the transaction-local RPC context; the call is bounded by the Worker''s 5,000 ms deadline. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_locale_observability_read(timestamptz, timestamptz) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_locale_observability_read(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

-- The reader uses only pg_catalog and these four tables, which the definer must be able to read; only what is missing is granted.
grant select on table
  platform_private.cms_content_entries,
  platform_private.cms_content_type_versions,
  platform_private.cms_field_definition_versions,
  platform_private.cms_locale_variants
  to wejammin_cms_definer;

commit;
