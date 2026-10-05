-- Slice 09 (D-IDEM, audit SEC-4; AC300, AC308, AC354, AC396, AC433, AC495, AC537,
-- AC566, AC594): a key reused with a changed body is the BE00 idempotency mismatch.
-- cms_reserve_conflict rewrote the database's IDEMPOTENCY_MISMATCH into a bare
-- CONFLICT for the nine commands that call it (CMS-03A-04, 09, 10, 11, 12, 14, 15,
-- 16, 17), and a bare CONFLICT reaches the wire as
-- { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' }: the client was
-- told to refresh and retry with the same key instead of using a new one.  BE00
-- (Error codes, CONFLICT) lists 'IDEMPOTENCY_MISMATCH' as its own conflict.  The
-- reservation now lets the typed refusal through unchanged, as every command that
-- calls cms_reserve directly already did, so the Worker maps it to
-- { conflict: 'IDEMPOTENCY_MISMATCH', recoveryAction: 'use_new_idempotency_key' }.
-- The function keeps its name and signature because nine bodies call it; it is a
-- pass-through of cms_reserve.  Forward-only.
begin;

create or replace function platform_private.cms_reserve_conflict(
  p_request jsonb, p_actor_id uuid, p_operation text
)
returns platform_private.idempotency_records
language plpgsql
security definer
set search_path = ''
as $body$
begin
  return platform_private.cms_reserve(p_request, p_actor_id, p_operation);
end;
$body$;

commit;
