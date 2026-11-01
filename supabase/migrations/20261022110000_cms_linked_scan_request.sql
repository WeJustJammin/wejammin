-- Slice 12 lane linked-scan (BE03c "Linked update (diff, accept, detach)", "Job transport (DEC-166, DEC-180 G9)"; tracker P2-S12-AC-212,
-- AC-213): the request of the database half of the typed platform-queue job `cms.pattern.linked_update_scan`.
--
--   platform_private.cms_linked_scan_request(request) returns jsonb
--       Pure validation and normalization.  Exact keys: { patternId, patternVersionId, cursor } plus the optional `batch` (integer
--       1..500, default 500: the bound a test or a caller may lower, never raise) and `correlationId` (uuid).  Both identifiers are
--       canonical uuids.  `cursor` is null (the start) or the opaque continuation a previous run answered:
--       `<entry uuid>.<hex of the UTF-8 octets of a composition path>` (lower-case hex, 1 to 512 octets, the decoded path begins with `/`
--       and holds no control character), the position after which the next run takes its instances (ascending entry id, then bytewise
--       path).  Answers { patternId, versionId, cursorEntry, cursorPath, batch, correlationId } with the cursor already decoded.
--       Anything else is the closed token INVALID_REQUEST (P0001).
-- Private SECURITY DEFINER of the CMS definer role with an empty search_path.  Forward-only.
begin;
set local lock_timeout = '5s';

create or replace function platform_private.cms_linked_scan_request(p_request jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  batch_max constant integer := 500;
  cursor_text text;
  cursor_parts text[];
  cursor_entry uuid;
  cursor_path text;
begin
  if p_request is null
     or pg_catalog.jsonb_typeof(p_request) is distinct from 'object'
     or not platform_private.cms_exact_keys(
       p_request,
       array['patternId', 'patternVersionId', 'cursor']::text[],
       array['patternId', 'patternVersionId', 'cursor', 'batch', 'correlationId']::text[]
     )
     or pg_catalog.jsonb_typeof(p_request->'patternId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'patternId') is not true
     or pg_catalog.jsonb_typeof(p_request->'patternVersionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'patternVersionId') is not true
     or (p_request ? 'batch'
         and (pg_catalog.jsonb_typeof(p_request->'batch') is distinct from 'number'
              or (p_request->>'batch') !~ '^[1-9][0-9]{0,2}$'
              or (p_request->>'batch')::integer > batch_max))
     or (p_request ? 'correlationId'
         and (pg_catalog.jsonb_typeof(p_request->'correlationId') is distinct from 'string'
              or platform_private.cms_valid_uuid(p_request->>'correlationId') is not true))
     or (pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'null'
         and pg_catalog.jsonb_typeof(p_request->'cursor') is distinct from 'string') then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'cursor') = 'string' then
    cursor_text := p_request->>'cursor';
    -- (a POSIX repetition count is capped at 255, so the 1 to 512 octets are bounded by length below)
    cursor_parts := pg_catalog.regexp_match(
      cursor_text, '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]+)$');
    if cursor_parts is null or platform_private.cms_valid_uuid(cursor_parts[1]) is not true
       or pg_catalog.length(cursor_parts[2]) not between 2 and 1024 or pg_catalog.length(cursor_parts[2]) % 2 <> 0 then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
    cursor_entry := cursor_parts[1]::uuid;
    begin
      cursor_path := pg_catalog.convert_from(pg_catalog.decode(cursor_parts[2], 'hex'), 'UTF8');
    exception when others then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end;
    -- the grammar of cms_composition_instances.path (its CHECK: 1 to 512 octets, a leading slash, no control character)
    if pg_catalog.octet_length(cursor_path) not between 1 and 512 or cursor_path !~ '^/[^[:cntrl:]]*$' then
      raise exception 'INVALID_REQUEST' using errcode = 'P0001';
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'patternId', p_request->>'patternId',
    'versionId', p_request->>'patternVersionId',
    'cursorEntry', cursor_entry,
    'cursorPath', cursor_path,
    'batch', case when p_request ? 'batch' then (p_request->>'batch')::integer else batch_max end,
    'correlationId', p_request->'correlationId'
  );
end;
$body$;

comment on function platform_private.cms_linked_scan_request(jsonb) is
  'BE03c linked-update scan job request: exact keys { patternId, patternVersionId, cursor } plus optional batch (1..500) and correlationId; the cursor is null or <entry uuid>.<hex of a composition path>, decoded here. Anything else is INVALID_REQUEST. Pure, private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_linked_scan_request(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_linked_scan_request(jsonb) from public, anon, authenticated, service_role;

do $closure$
declare
  callee text;
  callee_oid regprocedure;
begin
  foreach callee in array array[
    'platform_private.cms_exact_keys(jsonb,text[],text[])', 'platform_private.cms_valid_uuid(text)'
  ] loop
    callee_oid := pg_catalog.to_regprocedure(callee);
    if callee_oid is null then
      raise exception 'linked scan request callee is missing: %', callee using errcode = '55000';
    end if;
    if not pg_catalog.has_function_privilege('wejammin_cms_definer', callee_oid, 'EXECUTE') then
      execute pg_catalog.format('grant execute on function %s to wejammin_cms_definer', callee_oid::text);
    end if;
  end loop;
end;
$closure$;

commit;
