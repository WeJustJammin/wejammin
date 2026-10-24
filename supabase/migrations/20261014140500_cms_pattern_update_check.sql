-- Slice 12 lane pattern-updates (BE03c route field validation matrix row 400, Zod CompositionUpdateRequest, typed refusals 1268;
-- tracker P2-S12-AC-118, AC-119): the store-free request check of CMS-03C-15.
--
--   platform_private.cms_pattern_update_check(p_request jsonb) returns void
--
-- It needs no stored data and runs first, so a malformed request consumes no lock and no idempotency key:
--   * the exact Worker envelope (INVALID_REQUEST): action, instances, expectedVersion, ifMatch, idempotencyKey and context; optionally
--     targetPatternVersion (accept only) and correlationId; a decimal-string expectedVersion equal to the unquoted ifMatch operand and a
--     printable idempotency key of 8 to 128 characters;
--   * VALIDATION_FAILED with the offending JSON pointer array as DETAIL: action (accept | detach), targetPatternVersion (an integer 1 to
--     2147483647, required for accept), instances (an array of 1 to 32 members, the bound being per request), each member's instanceId
--     (UUID, unique case-insensitively) and expectedVersion (decimal string), unknown members, and choices (at most 128, each exactly a
--     normalized node path and `yours` or `theirs`, paths unique; allowed only for a single-instance accept request).
--   A target for detach is a member the request does not have (INVALID_REQUEST).
--   DEC-193 / BE03c 1487: a choice address is an expanded node path of at most 72 anchored ASCII key segments and 4680 characters.
-- Private; STABLE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_update_check(p_request jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_action text;
  v_target numeric;
  v_instances jsonb;
  v_count integer;
  v_item jsonb;
  v_choices jsonb;
  v_choice jsonb;
  v_seen text[] := array[]::text[];
  v_paths text[];
  i integer;
  j integer;
begin
  if not platform_private.cms_exact_keys(
    p_request,
    array['action', 'instances', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'context']::text[],
    array['action', 'instances', 'expectedVersion', 'ifMatch', 'idempotencyKey', 'context', 'targetPatternVersion', 'correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'idempotencyKey') is distinct from 'string'
     or (p_request->>'idempotencyKey') !~ '^[ -~]{8,128}$'
     or (p_request->>'expectedVersion') !~ '^[1-9][0-9]{0,18}$'
     or (pg_catalog.length(p_request->>'expectedVersion') = 19 and p_request->>'expectedVersion' > '9223372036854775807')
     or p_request->>'ifMatch' <> p_request->>'expectedVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'action') is distinct from 'string' or p_request->>'action' not in ('accept', 'detach') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/action"]';
  end if;
  v_action := p_request->>'action';
  if v_action = 'detach' and p_request ? 'targetPatternVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;
  if v_action = 'accept' then
    if pg_catalog.jsonb_typeof(p_request->'targetPatternVersion') is distinct from 'number' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/targetPatternVersion"]';
    end if;
    v_target := (p_request->>'targetPatternVersion')::numeric;
    if v_target <> pg_catalog.trunc(v_target) or v_target < 1 or v_target > 2147483647 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/targetPatternVersion"]';
    end if;
  end if;

  v_instances := p_request->'instances';
  if pg_catalog.jsonb_typeof(v_instances) is distinct from 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/instances"]';
  end if;
  v_count := pg_catalog.jsonb_array_length(v_instances);
  if v_count < 1 or v_count > 32 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/instances"]';
  end if;
  for i in 0 .. v_count - 1 loop
    v_item := v_instances -> i;
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s', i))::text;
    end if;
    if pg_catalog.jsonb_typeof(v_item->'instanceId') is distinct from 'string' or platform_private.cms_valid_uuid(v_item->>'instanceId') is not true then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', i))::text;
    end if;
    if pg_catalog.jsonb_typeof(v_item->'expectedVersion') is distinct from 'string'
       or (v_item->>'expectedVersion') !~ '^[1-9][0-9]{0,18}$'
       or (pg_catalog.length(v_item->>'expectedVersion') = 19 and v_item->>'expectedVersion' > '9223372036854775807') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/expectedVersion', i))::text;
    end if;
    if exists (select 1 from pg_catalog.jsonb_object_keys(v_item) member(key) where member.key not in ('instanceId', 'expectedVersion', 'choices')) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s', i))::text;
    end if;
    if pg_catalog.lower(v_item->>'instanceId') = any (v_seen) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/instanceId', i))::text;
    end if;
    v_seen := v_seen || pg_catalog.lower(v_item->>'instanceId');
    if v_item ? 'choices' then
      v_choices := v_item->'choices';
      if pg_catalog.jsonb_typeof(v_choices) is distinct from 'array' or pg_catalog.jsonb_array_length(v_choices) > 128 then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices', i))::text;
      end if;
      v_paths := array[]::text[];
      for j in 0 .. pg_catalog.jsonb_array_length(v_choices) - 1 loop
        v_choice := v_choices -> j;
        if pg_catalog.jsonb_typeof(v_choice) is distinct from 'object' then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices/%s', i, j))::text;
        end if;
        if pg_catalog.jsonb_typeof(v_choice->'path') is distinct from 'string'
           or (v_choice->>'path') !~ '^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63}){0,71}$'
           or pg_catalog.char_length(v_choice->>'path') > 4680 then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices/%s/path', i, j))::text;
        end if;
        if pg_catalog.jsonb_typeof(v_choice->'choice') is distinct from 'string' or v_choice->>'choice' not in ('yours', 'theirs') then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices/%s/choice', i, j))::text;
        end if;
        if exists (select 1 from pg_catalog.jsonb_object_keys(v_choice) member(key) where member.key not in ('path', 'choice')) then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices/%s', i, j))::text;
        end if;
        if v_choice->>'path' = any (v_paths) then
          raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices/%s/path', i, j))::text;
        end if;
        v_paths := v_paths || (v_choice->>'path');
      end loop;
    end if;
  end loop;
  -- choices exist only for a single-instance accept request
  for i in 0 .. v_count - 1 loop
    if (v_instances -> i) ? 'choices' and pg_catalog.jsonb_array_length(v_instances -> i -> 'choices') > 0 and (v_count > 1 or v_action = 'detach') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = pg_catalog.jsonb_build_array(format('/instances/%s/choices', i))::text;
    end if;
  end loop;
end;
$body$;

comment on function platform_private.cms_pattern_update_check(jsonb) is
  'CMS-03C-15: the store-free request check (exact envelope, version operands, action, target version, 1-32 unique instances with their own CAS operand, choices only for a single-instance accept). Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_update_check(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_update_check(jsonb) from public, anon, authenticated, service_role;

commit;
