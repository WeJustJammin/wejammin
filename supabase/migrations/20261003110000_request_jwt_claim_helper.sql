-- SEC-1: one reader for the caller's verified JWT claims.
--
-- PostgREST v10+ publishes the verified token as ONE setting,
-- `request.jwt.claims` (a JSON object), and never the pre-v10 per-claim
-- settings (one setting per claim name). Every authority gate
-- reads claims through this function so there is exactly one source: reading
-- both would let a stale or hand-set legacy value contradict the real token.
-- It is deliberately fail-closed: a missing, empty, non-JSON or non-object
-- setting, and any claim that is absent or empty, yields NULL (no identity).
create or replace function platform_private.request_jwt_claim(p_name text)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  raw_claims text := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
  claims pg_catalog.jsonb;
begin
  if p_name is null or raw_claims is null then
    return null;
  end if;
  begin
    claims := raw_claims::pg_catalog.jsonb;
  exception when invalid_text_representation then
    return null;
  end;
  if pg_catalog.jsonb_typeof(claims) <> 'object' then
    return null;
  end if;
  return nullif(claims ->> p_name, '');
end;
$function$;

revoke all on function platform_private.request_jwt_claim(text)
  from public, anon, authenticated, service_role;

comment on function platform_private.request_jwt_claim(text)
  is 'Reads one claim from the request.jwt.claims JSON setting PostgREST publishes. The only JWT claim reader; the pre-v10 per-claim settings are never read.';
