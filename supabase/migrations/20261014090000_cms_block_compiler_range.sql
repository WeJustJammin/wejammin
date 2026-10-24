-- Slice 12 lane block-compat (root ruling B, review-blockcompat.md): the schema-compiler compatibility range of a
-- registered block, evaluated against the compiler_version of a content type's active schema artifact.
-- BE03a 1098-1101 (BlockRegistrationRequest.compatibility { minSchemaCompiler, maxSchemaCompiler }), 2761 ("03c:
-- expose immutable BlockDefinitionVersion metadata and compatibility ranges"); BE03c 209, 321, 1567; IA03 44, 65;
-- IA deep dive 227, 400.  The range is DB-internal evidence (the safe record never carries it, P2-S09-AC-145).
--
--   cms_compiler_version_rank(version)   the dotted-numeric position of a member of the CLOSED compiler registry
--                                        (cms_compiler_registry_valid: '1', '1.0', '1.0.0', '1.9') as integer[3],
--                                        missing components 0, so 1 = 1.0 = 1.0.0 < 1.9.  NULL for any value outside
--                                        the registry.  Implementation decision (BE03a does not spell the ordering
--                                        out): numeric per component, never string order ('1' < '1.0.0' as text).
--   cms_block_range_covers(range, v)     true when range has BOTH keys, both registry-valid, v is registry-valid and
--                                        min <= v <= max.  FAIL CLOSED: a range lacking either key, a non-string
--                                        key, a bound or version outside the registry, or an inverted range covers
--                                        nothing.  Implementation decision: the real producer (cms_register_block)
--                                        always writes both registry-valid keys, so only raw legacy fixtures can
--                                        hold a defective range.
-- Private; owned by the CMS definer role like the callers; no API role may execute.  Forward-only.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function platform_private.cms_compiler_version_rank(p_version text)
returns integer[]
language sql
immutable
set search_path = ''
as $body$
  select case when platform_private.cms_compiler_registry_valid(p_version)
    then array[
      pg_catalog.split_part(p_version, '.', 1)::integer,
      coalesce(nullif(pg_catalog.split_part(p_version, '.', 2), ''), '0')::integer,
      coalesce(nullif(pg_catalog.split_part(p_version, '.', 3), ''), '0')::integer]
  end
$body$;

comment on function platform_private.cms_compiler_version_rank(text) is
  'Dotted-numeric position (integer[3], missing components 0) of a member of the closed schema-compiler registry (1, 1.0, 1.0.0, 1.9); NULL outside the registry. 1 = 1.0 = 1.0.0 < 1.9. Private.';

create or replace function platform_private.cms_block_range_covers(p_range jsonb, p_compiler_version text)
returns boolean
language sql
stable
set search_path = ''
as $body$
  select coalesce(
    pg_catalog.jsonb_typeof(p_range) = 'object'
    and pg_catalog.jsonb_typeof(p_range->'minSchemaCompiler') = 'string'
    and pg_catalog.jsonb_typeof(p_range->'maxSchemaCompiler') = 'string'
    and platform_private.cms_compiler_version_rank(p_range->>'minSchemaCompiler') is not null
    and platform_private.cms_compiler_version_rank(p_range->>'maxSchemaCompiler') is not null
    and platform_private.cms_compiler_version_rank(p_compiler_version) is not null
    and platform_private.cms_compiler_version_rank(p_range->>'minSchemaCompiler')
          <= platform_private.cms_compiler_version_rank(p_compiler_version)
    and platform_private.cms_compiler_version_rank(p_compiler_version)
          <= platform_private.cms_compiler_version_rank(p_range->>'maxSchemaCompiler'),
    false)
$body$;

comment on function platform_private.cms_block_range_covers(jsonb, text) is
  'BE03a 1098-1101, BE03c 209 and 1567: true when a registered block compatibility range {minSchemaCompiler, maxSchemaCompiler} covers a schema artifact compiler_version, compared dotted-numerically over the closed compiler registry. Fails closed: a range lacking either key, or any value outside the registry, covers nothing. Private.';

grant create on schema platform_private to wejammin_cms_definer;
alter function platform_private.cms_compiler_version_rank(text) owner to wejammin_cms_definer;
alter function platform_private.cms_block_range_covers(jsonb, text) owner to wejammin_cms_definer;
revoke create on schema platform_private from wejammin_cms_definer;
revoke all on function
  platform_private.cms_compiler_version_rank(text),
  platform_private.cms_block_range_covers(jsonb, text)
  from public, anon, authenticated, service_role;

commit;
