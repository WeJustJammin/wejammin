-- Slice 09 audit remediation (R3, AC-514): a CMS capability grant reason is
-- 1 to 256 Unicode characters counted after NFC normalization (BE03a), the
-- same bound the shared contract enforces (code points, not UTF-8 octets).
-- cms_grant_reason and both table CHECKs counted octets, so 129 composed
-- e-acute characters (258 octets) were refused although 256 characters are
-- allowed, and the rows could hold text the contract would reject.
-- Forward-only.
begin;

create or replace function platform_private.cms_grant_reason(p_request jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $body$
declare
  reason_text text;
begin
  if not p_request ? 'reason' then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reason') <> 'string' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  reason_text := normalize(p_request->>'reason', nfc);
  if pg_catalog.char_length(reason_text) not between 1 and 256 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;
  return reason_text;
end;
$body$;

alter table platform_private.cms_capability_grants
  drop constraint cms_capability_grants_reason_check,
  add constraint cms_capability_grants_reason_check check (
    reason is null or (pg_catalog.char_length(reason) between 1 and 256 and reason is nfc normalized)
  );
alter table platform_private.cms_capability_grant_events
  drop constraint cms_capability_grant_events_reason_check,
  add constraint cms_capability_grant_events_reason_check check (
    reason is null or (pg_catalog.char_length(reason) between 1 and 256 and reason is nfc normalized)
  );

commit;
