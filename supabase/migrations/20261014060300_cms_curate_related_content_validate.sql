-- Slice 12 lane related, request validation of CMS-03C-05 (BE03c route field validation matrix 385-387, Derived
-- rules (OD-5) 1383; tracker P2-S12-AC-036 .. AC-038, AC-229):
--
--   cms_related_content_pointers(p_request jsonb) returns jsonb
--       the RFC 6901 pointers of every schema failure of pins, exclusions and derivedRule, in request order
--       (pins, then exclusions, then derivedRule), '[]' when the request is well formed:
--         /pins            not an array, or more than 32;       /pins/{n}        not a UUID string, or a repeat
--         /exclusions      not an array, or more than 64;       /exclusions/{n}  not a UUID string, a repeat, or
--                          a target that is also a pin
--         /derivedRule     neither null nor an object with exactly key, version, reasonCode, maxCandidates;
--         /derivedRule/key|version|reasonCode|maxCandidates     the member violates its grammar
--   cms_related_rule_pointers(p_rule jsonb) returns jsonb
--       for a well-formed derivedRule, '[]' when it is a registry member at its registered version with the
--       registry reason, else the pointer of the first member that is not (/derivedRule/key, /version or
--       /reasonCode): the typed derived_rule_unknown.
--
-- Pure: no table is read or written.  The command raises VALIDATION_FAILED for the first list and
-- derived_rule_unknown for the second, DETAIL being the pointer array.  Private, IMMUTABLE, executable by the
-- CMS definer only.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function platform_private.cms_related_content_pointers(p_request jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $body$
declare
  pointers jsonb := '[]'::jsonb;
  pin_ids text[] := array[]::text[];
  seen text[] := array[]::text[];
  item jsonb;
  item_text text;
  item_no integer;
  rule_value jsonb := p_request->'derivedRule';
  version_text text;
begin
  -- pins
  if (case when pg_catalog.jsonb_typeof(p_request->'pins') = 'array'
          then pg_catalog.jsonb_array_length(p_request->'pins') > 32 else true end) then
    pointers := pointers || pg_catalog.jsonb_build_array('/pins');
  else
    item_no := 0;
    for item in select element.value from pg_catalog.jsonb_array_elements(p_request->'pins') element(value) loop
      item_text := case when pg_catalog.jsonb_typeof(item) = 'string' then item #>> '{}' end;
      if platform_private.cms_valid_uuid(item_text) is not true then
        pointers := pointers || pg_catalog.jsonb_build_array('/pins/' || item_no);
      elsif pg_catalog.lower(item_text) = any(seen) then
        pointers := pointers || pg_catalog.jsonb_build_array('/pins/' || item_no);
      else
        seen := seen || pg_catalog.lower(item_text);
        pin_ids := pin_ids || pg_catalog.lower(item_text);
      end if;
      item_no := item_no + 1;
    end loop;
  end if;
  -- exclusions
  seen := array[]::text[];
  if (case when pg_catalog.jsonb_typeof(p_request->'exclusions') = 'array'
          then pg_catalog.jsonb_array_length(p_request->'exclusions') > 64 else true end) then
    pointers := pointers || pg_catalog.jsonb_build_array('/exclusions');
  else
    item_no := 0;
    for item in select element.value from pg_catalog.jsonb_array_elements(p_request->'exclusions') element(value) loop
      item_text := case when pg_catalog.jsonb_typeof(item) = 'string' then item #>> '{}' end;
      if platform_private.cms_valid_uuid(item_text) is not true
         or pg_catalog.lower(item_text) = any(seen)
         or pg_catalog.lower(item_text) = any(pin_ids) then
        pointers := pointers || pg_catalog.jsonb_build_array('/exclusions/' || item_no);
      else
        seen := seen || pg_catalog.lower(item_text);
      end if;
      item_no := item_no + 1;
    end loop;
  end if;
  -- derivedRule
  if pg_catalog.jsonb_typeof(rule_value) = 'null' then
    return pointers;
  end if;
  if pg_catalog.jsonb_typeof(rule_value) is distinct from 'object'
     or not platform_private.cms_exact_keys(
          rule_value, array['key', 'version', 'reasonCode', 'maxCandidates']::text[],
          array['key', 'version', 'reasonCode', 'maxCandidates']::text[]) then
    return pointers || pg_catalog.jsonb_build_array('/derivedRule');
  end if;
  if pg_catalog.jsonb_typeof(rule_value->'key') is distinct from 'string'
     or (rule_value->>'key') !~ '^[a-z][a-z0-9_-]{1,63}$' then
    pointers := pointers || pg_catalog.jsonb_build_array('/derivedRule/key');
  end if;
  version_text := case when pg_catalog.jsonb_typeof(rule_value->'version') = 'string' then rule_value->>'version' end;
  if version_text is null or version_text !~ '^[1-9][0-9]{0,18}$'
     or (pg_catalog.length(version_text) = 19 and version_text > '9223372036854775807') then
    pointers := pointers || pg_catalog.jsonb_build_array('/derivedRule/version');
  end if;
  if pg_catalog.jsonb_typeof(rule_value->'reasonCode') is distinct from 'string'
     or (rule_value->>'reasonCode') !~ '^[a-z][a-z0-9._-]{0,63}$' then
    pointers := pointers || pg_catalog.jsonb_build_array('/derivedRule/reasonCode');
  end if;
  if (case when pg_catalog.jsonb_typeof(rule_value->'maxCandidates') = 'number'
          then (rule_value->>'maxCandidates')::numeric <> pg_catalog.trunc((rule_value->>'maxCandidates')::numeric)
               or (rule_value->>'maxCandidates')::numeric not between 1 and 128
          else true end) then
    pointers := pointers || pg_catalog.jsonb_build_array('/derivedRule/maxCandidates');
  end if;
  return pointers;
end;
$body$;

create function platform_private.cms_related_rule_pointers(p_rule jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $body$
  select case
    when pg_catalog.jsonb_typeof(p_rule) is distinct from 'object' then '[]'::jsonb
    when platform_private.cms_related_rule_reason(p_rule->>'key') is null
      then pg_catalog.jsonb_build_array('/derivedRule/key')
    when not platform_private.cms_related_rule_valid(p_rule->>'key', (p_rule->>'version')::bigint)
      then pg_catalog.jsonb_build_array('/derivedRule/version')
    when p_rule->>'reasonCode' is distinct from platform_private.cms_related_rule_reason(p_rule->>'key')
      then pg_catalog.jsonb_build_array('/derivedRule/reasonCode')
    else '[]'::jsonb
  end
$body$;

comment on function platform_private.cms_related_content_pointers(jsonb) is
  'CMS-03C-05: the RFC 6901 pointers of every schema failure of pins, exclusions and derivedRule (bounds, UUIDs, repeats, pin/exclusion overlap, rule shape and member grammar). Pure; private; IMMUTABLE.';
comment on function platform_private.cms_related_rule_pointers(jsonb) is
  'CMS-03C-05 OD-5: the pointer of the first derivedRule member that is not the registry value (key, version, reasonCode), [] for a registry member. Pure; private; IMMUTABLE.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_related_content_pointers(jsonb) owner to wejammin_cms_definer;
alter function platform_private.cms_related_rule_pointers(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_related_content_pointers(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function platform_private.cms_related_rule_pointers(jsonb)
  from public, anon, authenticated, service_role;

commit;
