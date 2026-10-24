-- Slice 12 lane governed-b (BE03c Route Registry 171, "Route field validation matrix" CMS-03C-09, contracts governed-activation.ts; tracker
-- P2-S12-AC-082, AC-083, AC-087, AC-142): the structure step of CMS-03C-09.  cms_governed_activation_request(p_request) validates the
-- GovernedActivationRequest and answers the parsed members; it reads nothing and writes nothing.  A refusal is a P0001 whose whole message
-- is the token:
--   INVALID_REQUEST      unknown or missing member for the action (a body capability or stepUpAt, activateAt on activate, reason, a missing
--                        activateAt), a malformed review id, If-Match disagreeing with expectedVersion
--   VALIDATION_FAILED    DETAIL ["/action"] (an unknown action, and `retire`, which is HELD until the owner confirms the retirement policy:
--                        propagation scan 2026-10-13 section R), ["/expectedVersion"] or ["/ifMatch"], ["/activateAt"] (not an exact
--                        five-member object) or ["/activateAt/<member>"] (all malformed members together, in member order)
-- The schedule instant follows the 03b Time authority shapes: an offset-free local time, an IANA-shaped zone, the resolved UTC instant, the
-- pinned tzdb version label and the disambiguation; fractions up to nanoseconds are accepted and floored to the microsecond of the
-- timestamp columns.  The tz rules themselves (pinned version, offset window, horizon) are checked by the caller after the review is read.
-- Answer: { reviewId, action, expectedVersion (text), local, zone, resolved, tzdb, disambiguation } (the last five only for `schedule`).
-- Private; owned by the CMS definer role.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_governed_activation_request(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_action text;
  v_at jsonb;
  v_violations jsonb := '[]'::jsonb;
  v_local text;
  v_resolved text;
  v_zone text;
  v_tzdb text;
  v_disambiguation text;
  v_local_value timestamp;
  v_resolved_value timestamptz;
  v_expected bigint;
  v_answer jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request) is distinct from 'object' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if not platform_private.cms_exact_keys(
    p_request,
    array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey']::text[],
    array['reviewId', 'action', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'activateAt', 'reason', 'context', 'correlationId']::text[]
  ) then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'reviewId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'reviewId') is not true then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string'
     or p_request->>'action' not in ('activate', 'schedule') then
    -- BOUNDARY: `retire` requires the owner's confirmation of the retirement policy (propagation scan section R); until then it is refused
    -- like any action outside the implemented set.
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/action"]';
  end if;
  v_action := p_request->>'action';
  if (v_action = 'schedule') <> (p_request ? 'activateAt') or p_request ? 'reason' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  v_expected := platform_private.cms_governed_cas_operand(p_request);
  v_answer := pg_catalog.jsonb_build_object(
    'reviewId', p_request->>'reviewId', 'action', v_action, 'expectedVersion', v_expected::text);
  if v_action = 'activate' then
    return v_answer;
  end if;

  v_at := p_request->'activateAt';
  if pg_catalog.jsonb_typeof(v_at) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       v_at,
       array['localDateTime', 'timezone', 'resolvedUtc', 'tzdbVersion', 'disambiguation']::text[],
       array['localDateTime', 'timezone', 'resolvedUtc', 'tzdbVersion', 'disambiguation']::text[]) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/activateAt"]';
  end if;
  v_local := v_at->>'localDateTime';
  v_zone := v_at->>'timezone';
  v_resolved := v_at->>'resolvedUtc';
  v_tzdb := v_at->>'tzdbVersion';
  v_disambiguation := v_at->>'disambiguation';
  if pg_catalog.jsonb_typeof(v_at->'localDateTime') is distinct from 'string'
     or v_local !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,9})?)?$' then
    v_violations := v_violations || '["/activateAt/localDateTime"]'::jsonb;
  else
    begin
      v_local_value := pg_catalog.regexp_replace(v_local, '(\.[0-9]{6})[0-9]{1,3}', '\1')::timestamp;
    exception when others then
      v_violations := v_violations || '["/activateAt/localDateTime"]'::jsonb;
    end;
  end if;
  if pg_catalog.jsonb_typeof(v_at->'timezone') is distinct from 'string'
     or pg_catalog.char_length(v_zone) not between 1 and 64
     or v_zone !~ '^[A-Za-z][A-Za-z0-9_+.-]*(/[A-Za-z0-9_+.-]+){0,2}$'
     or v_zone ~ '(^|/)\.{1,2}(/|$)' then
    v_violations := v_violations || '["/activateAt/timezone"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(v_at->'resolvedUtc') is distinct from 'string'
     or v_resolved !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]{1,9})?)?(Z|[+-]([01][0-9]|2[0-3])(:?[0-5][0-9])?)$' then
    v_violations := v_violations || '["/activateAt/resolvedUtc"]'::jsonb;
  else
    begin
      v_resolved_value := pg_catalog.regexp_replace(v_resolved, '(\.[0-9]{6})[0-9]{1,3}', '\1')::timestamptz;
    exception when others then
      v_violations := v_violations || '["/activateAt/resolvedUtc"]'::jsonb;
    end;
  end if;
  if pg_catalog.jsonb_typeof(v_at->'tzdbVersion') is distinct from 'string'
     or v_tzdb !~ '^[A-Za-z0-9._-]{1,32}$' then
    v_violations := v_violations || '["/activateAt/tzdbVersion"]'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(v_at->'disambiguation') is distinct from 'string'
     or v_disambiguation not in ('none', 'earlier', 'later') then
    v_violations := v_violations || '["/activateAt/disambiguation"]'::jsonb;
  end if;
  if pg_catalog.jsonb_array_length(v_violations) > 0 then
    -- each violation is a one-element array; the DETAIL is the flat array of pointers
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = (
      select pg_catalog.jsonb_agg(element.value->>0 order by element.ord)::text
        from pg_catalog.jsonb_array_elements(v_violations) with ordinality element(value, ord));
  end if;
  return v_answer || pg_catalog.jsonb_build_object(
    'local', v_local_value::text, 'zone', v_zone, 'resolved', v_resolved_value::text,
    'tzdb', v_tzdb, 'disambiguation', v_disambiguation);
end;
$body$;

comment on function platform_private.cms_governed_activation_request(jsonb) is
  'BE03c CMS-03C-09 structure step: validates the GovernedActivationRequest (activate | schedule; retire is HELD) and answers the parsed review id, action, expected version and, for schedule, the floored local and resolved instants. Reads and writes nothing. Private; STABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_governed_activation_request(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_governed_activation_request(jsonb)
  from public, anon, authenticated, service_role;

commit;
