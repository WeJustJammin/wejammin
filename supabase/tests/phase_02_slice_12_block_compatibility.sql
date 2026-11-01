-- Slice 12 lane block-compat: block compatibility of templates and patterns (BE03c 396, 1361, 209, 321, 1567;
-- BE03a 1098-1101, 2761; IA03 44-45, 65-66).  A block is compatible with a content type when it is registered,
-- its lifecycle admits it (templates: supported; patterns: not withdrawn) and its registered
-- compatibility {minSchemaCompiler, maxSchemaCompiler} covers the compiler_version of the type's ACTIVE schema
-- artifact, compared dotted-numerically over the closed compiler registry.  Real producers only: signed block
-- registration, S09 type chains, platform_api.cms_define_template and platform_api.cms_create_pattern_version.
-- Two documented fixture clones (types with another compiler_version; blocks the producer cannot register).
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_block_compatibility/000-fixtures.sqlinc
\ir phase_02_slice_12_block_compatibility/010-patterns.sqlinc
\ir phase_02_slice_12_block_compatibility/020-templates.sqlinc

select finish();
rollback;
