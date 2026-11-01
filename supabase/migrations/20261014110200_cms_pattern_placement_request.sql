-- Slice 12 lane placement (BE03c route field validation matrix 375-378, Zod PatternInstanceRequest 518, typed
-- refusals 1304; DEC-175, DEC-186; tracker P2-S12-AC-011, AC-218): the store-free request check of CMS-03C-02.
--
--   platform_private.cms_pattern_placement_check(p_request jsonb) returns text   the slot key the request addresses
--
-- The check needs no stored data and runs first, so a malformed request consumes no lock and no idempotency key:
--   * the exact Worker envelope (INVALID_REQUEST): revisionId, patternId, patternVersion, linkMode, slotPath, overrides,
--     expectedVersion, ifMatch, idempotencyKey and context; optionally blockRegistryDigest and correlationId;
--     UUIDs, a decimal-string expectedVersion equal to the unquoted ifMatch operand, a printable idempotency key;
--   * VALIDATION_FAILED with the offending JSON pointer array as DETAIL: patternVersion (an integer 1 to 2147483647),
--     linkMode (linked | detached), slotPath, blockRegistryDigest (64 lowercase hex), overrides;
--   * slotPath is the normalized path of the Zod contract: 1 to 512 characters, a leading `/`, no control character,
--     no empty, `.` or `..` segment and no trailing `/`.  Its first segment is the slot key (the template slot the
--     render plan orders by) and must match the slot-key grammar ^[a-z][a-z0-9_-]{1,63}$; the root path `/` addresses
--     the slot `root`, which only an entry with NO template may use (the producer refuses `/` on a templated entry and
--     any other path on a template-less one; BE03c 1365, AC-218; lane report, BOUNDARY B1 as ruled);
--   * overrides: at most 64 keys, each a normalized node path (/{nodeKey}(/{nodeKey})*, at most 512 characters, node
--     keys ^[a-z][a-z0-9_-]{0,63}$), a document no deeper than 8 containers.  That a key names a node of the pinned
--     tree needs the tree and is the producer's check.
-- Private; STABLE SECURITY DEFINER with an empty search_path, owned by the CMS definer.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_pattern_placement_check(p_request jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $body$
declare
  v_slot text;
  v_key text;
  v_version numeric;
begin
  if not platform_private.cms_exact_keys(
    p_request,
    array['revisionId','patternId','patternVersion','linkMode','slotPath','overrides','expectedVersion','ifMatch',
      'idempotencyKey','context']::text[],
    array['revisionId','patternId','patternVersion','linkMode','slotPath','overrides','expectedVersion','ifMatch',
      'idempotencyKey','context','blockRegistryDigest','correlationId']::text[]
  ) then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if pg_catalog.jsonb_typeof(p_request->'revisionId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'revisionId') is not true
     or pg_catalog.jsonb_typeof(p_request->'patternId') is distinct from 'string'
     or platform_private.cms_valid_uuid(p_request->>'patternId') is not true
     or pg_catalog.jsonb_typeof(p_request->'expectedVersion') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'ifMatch') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_request->'idempotencyKey') is distinct from 'string'
     or (p_request->>'idempotencyKey') !~ '^[ -~]{8,128}$'
     or (p_request->>'expectedVersion') !~ '^[1-9][0-9]{0,18}$'
     or (pg_catalog.length(p_request->>'expectedVersion') = 19 and p_request->>'expectedVersion' > '9223372036854775807')
     or p_request->>'ifMatch' <> p_request->>'expectedVersion' then
    raise exception 'INVALID_REQUEST' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'patternVersion') is distinct from 'number' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/patternVersion"]';
  end if;
  v_version := (p_request->>'patternVersion')::numeric;
  if v_version <> pg_catalog.trunc(v_version) or v_version < 1 or v_version > 2147483647 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/patternVersion"]';
  end if;
  if pg_catalog.jsonb_typeof(p_request->'linkMode') is distinct from 'string'
     or p_request->>'linkMode' not in ('linked', 'detached') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/linkMode"]';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'slotPath') is distinct from 'string' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;
  v_slot := p_request->>'slotPath';
  if pg_catalog.char_length(v_slot) not between 1 and 512 or v_slot !~ '^/' or v_slot ~ '[[:cntrl:]]'
     or (v_slot <> '/' and (v_slot ~ '//' or v_slot ~ '/$'
        or exists (select 1 from pg_catalog.regexp_split_to_table(pg_catalog.substr(v_slot, 2), '/') segment(value)
                    where segment.value in ('.', '..')))) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;
  v_key := case when v_slot = '/' then 'root' else pg_catalog.split_part(pg_catalog.substr(v_slot, 2), '/', 1) end;
  if v_key !~ '^[a-z][a-z0-9_-]{1,63}$' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/slotPath"]';
  end if;

  if p_request ? 'blockRegistryDigest'
     and (pg_catalog.jsonb_typeof(p_request->'blockRegistryDigest') is distinct from 'string'
          or p_request->>'blockRegistryDigest' !~ '^[a-f0-9]{64}$') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/blockRegistryDigest"]';
  end if;

  if pg_catalog.jsonb_typeof(p_request->'overrides') is distinct from 'object' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/overrides"]';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_request->'overrides')) > 64
     or exists (select 1 from pg_catalog.jsonb_object_keys(p_request->'overrides') override_key(value)
                 where override_key.value !~ '^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63})*$'
                    or pg_catalog.char_length(override_key.value) > 512)
     or not platform_private.cms_json_bounded(p_request->'overrides', 262144, 8, 128, 128) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = '["/overrides"]';
  end if;
  return v_key;
end;
$body$;

comment on function platform_private.cms_pattern_placement_check(jsonb) is
  'CMS-03C-02: the store-free request check (exact envelope, ids, version operands, linkMode, normalized slotPath, digest shape, override keys and bounds) and the slot key the request addresses. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_pattern_placement_check(jsonb) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function platform_private.cms_pattern_placement_check(jsonb)
  from public, anon, authenticated, service_role;

commit;
