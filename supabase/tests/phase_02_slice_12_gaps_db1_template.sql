-- Slice 12 gap lane claude_s12_gaps_db1: template authority and designer context clauses that no earlier
-- suite proves (docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json).
--   P2-S12-AC-023 clause 1  compatibleTypeIds members must be owned, ACTIVE content types with an ACTIVE version.
--   P2-S12-AC-159 clauses 4+6  cmsTemplateContextRead lists only active/compiled types and <=128 owned,
--                           registered, currently supported block selectors.
--   P2-S12-AC-161 clauses 1+3+8  the read rechecks actor, acting party, confirmed membership and grant, and
--                           reserves nothing for a later write.
-- Own fixtures only (the Slice 10 rolled-back world); nothing here edits an existing suite.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_gaps_db1_template/000-fixtures.sqlinc
-- ---------------------------------------------------------------------------------------------- AC-023 --
select pg_temp.gt_creator();
create temp table gt_tpl_before on commit drop as
select count(*)::integer as n from platform_private.cms_template_versions;

select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('gap-tpl-retired',
  jsonb_build_array('a9121000-0000-4000-8000-000000000101'), 'gap-tpl-retired-0001'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'a caller-owned content type whose state is retired (with an active version) is refused VALIDATION_FAILED [P2-S12-AC-023]');
select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('gap-tpl-noversion',
  jsonb_build_array('a9121000-0000-4000-8000-000000000102'), 'gap-tpl-noversion-0002'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'an active caller-owned content type with no active version is refused VALIDATION_FAILED [P2-S12-AC-023]');
select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('gap-tpl-mixed',
  jsonb_build_array('a9121000-0000-4000-8000-000000000103', 'a9121000-0000-4000-8000-000000000101'), 'gap-tpl-mixed-0003'));
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'one inactive member among valid members refuses the whole list [P2-S12-AC-023]');
select is((select count(*)::integer from platform_private.cms_template_versions), (select n from gt_tpl_before),
  'the three refusals created no template row [P2-S12-AC-023]');
select is(
  (select count(*)::integer from platform_private.idempotency_records where operation = 'CMS-03C-01'
     and key_hash in (platform_private.cms_key_hash('gap-tpl-retired-0001'),
                      platform_private.cms_key_hash('gap-tpl-noversion-0002'),
                      platform_private.cms_key_hash('gap-tpl-mixed-0003'))),
  0, 'the refusals reserved no idempotency key [P2-S12-AC-023]');

select pg_temp.s10_rpc_exec(pg_temp.gt_template_sql('gap-tpl-good',
  jsonb_build_array('a9121000-0000-4000-8000-000000000103'), 'gap-tpl-good-0004'));
select is(pg_temp.s10_last_error_state(), '00000',
  'control: an active owned content type with an active version defines a draft template [P2-S12-AC-023]');
select is((select count(*)::integer from platform_private.cms_template_versions), (select n from gt_tpl_before) + 1,
  'control: exactly one template row was created by the accepted call [P2-S12-AC-023]');

-- ---------------------------------------------------------------------------------------------- AC-159 --
-- The Slice 10 fixture type is active, compiled and owned: it is the other listed selector.
select pg_temp.gt_creator();
create temp table gt_ctx_types on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql()) as response;
select is(pg_temp.s10_last_error_state(), '00000', 'control: the designer reads the context [P2-S12-AC-159]');
select ok(
  (select response->'contentTypes' @> jsonb_build_array(jsonb_build_object(
      'id', 'a9121000-0000-4000-8000-000000000103',
      'typeKey', 'gap_type_good',
      'activeVersionId', 'a9121000-0000-4000-8000-000000000203',
      'activeVersion', 1,
      'sourceLocale', 'en-US'))
     from gt_ctx_types),
  'an active type with an active version and a compiled artifact lists typeKey, activeVersionId and activeVersion equal to the stored rows [P2-S12-AC-159]');
select ok(
  (select not exists (select 1 from jsonb_array_elements(response->'contentTypes') item
     where item->>'id' in ('a9121000-0000-4000-8000-000000000101', 'a9121000-0000-4000-8000-000000000102'))
   from gt_ctx_types),
  'a retired type and an active type with no active version are excluded [P2-S12-AC-159]');
select ok(
  (select not exists (select 1 from jsonb_array_elements(response->'contentTypes') item
     where item->>'id' = 'a9121000-0000-4000-8000-000000000104')
   from gt_ctx_types),
  'an active compiled type of ANOTHER owner is excluded [P2-S12-AC-159]');
select matches(
  (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
    where c.conrelid = 'platform_private.cms_schema_artifacts'::regclass and c.conname = 'cms_schema_artifacts_state_check'),
  $$state = 'compiled'$$,
  'a stored schema artifact can only be compiled, so every listed active version has a compiled artifact [P2-S12-AC-159]');
select is(
  (select jsonb_agg(item->>'typeKey' order by item->>'typeKey' collate "C")
     from gt_ctx_types, jsonb_array_elements(response->'contentTypes') item
    where item->>'typeKey' like 'gap\_type\_%'),
  '["gap_type_good"]'::jsonb,
  'among the gap fixture types only the active, owned, active-version type is listed [P2-S12-AC-159]');

-- Blocks: 129 supported owned candidates (gap.b000..gap.b128), one deprecated (gap.a000, sorts first), one
-- owned by another party (gap.a001, sorts second) and one withdrawn (gap.a002).
select set_config('app.cms_rpc', 'true', true);
create or replace function pg_temp.gt_block(p_key text, p_owner uuid) returns uuid language plpgsql as $body$
declare block_id uuid := extensions.gen_random_uuid();
begin
  insert into platform_private.cms_block_definition_versions(
    id, owner_id, block_key, block_version, props_schema_ref, props_schema_hash, props_schema_snapshot,
    props_snapshot_hash, props_snapshot_attestation, props_attestation_key_id,
    props_attestation_signature_hash, props_attestation_verified_at, renderer_ref, allowed_children,
    slot_rules, data_source_permissions, accessibility_contract, compatibility_range, release_digest,
    release_principal_id, release_key_id, release_raw_body_hash, release_signature_hash,
    release_nonce_hash, release_verified_at)
  values (block_id, p_owner, p_key, 1, 'cms/s12/' || p_key, repeat('2', 64), '{}'::jsonb, repeat('4', 64),
    '{}'::jsonb, 's12-test-key', repeat('5', 64), clock_timestamp(), 'cms.' || p_key, '[]'::jsonb,
    '{}'::jsonb, '[]'::jsonb, '{}'::jsonb, '{"minSchemaCompiler":"1","maxSchemaCompiler":"1"}'::jsonb,
    repeat('3', 64), 'a9120000-0000-4000-8000-000000000302', 's12-release-key', repeat('6', 64),
    repeat('7', 64), encode(extensions.digest(p_key, 'sha256'), 'hex'), clock_timestamp());
  return block_id;
end;
$body$;
create temp table gt_blocks(key text primary key, id uuid not null) on commit drop;
insert into gt_blocks
select 'gap.b' || lpad(i::text, 3, '0'),
       pg_temp.gt_block('gap.b' || lpad(i::text, 3, '0'), (select value::uuid from s10_ids where key = 'organization'))
  from generate_series(0, 128) i;
insert into gt_blocks values
  ('gap.a000', pg_temp.gt_block('gap.a000', (select value::uuid from s10_ids where key = 'organization'))),
  ('gap.a001', pg_temp.gt_block('gap.a001', 'a9121000-0000-4000-8000-0000000009ff'::uuid)),
  ('gap.a002', pg_temp.gt_block('gap.a002', (select value::uuid from s10_ids where key = 'organization')));
create or replace function pg_temp.gt_lifecycle(p_key text, p_from text, p_to text, p_second integer) returns void language sql as $body$
  insert into platform_private.cms_block_definition_lifecycle_events(
    id, owner_id, created_at, updated_at, block_definition_version_id, block_key, block_version,
    from_lifecycle, to_lifecycle, release_digest, release_principal_id, release_key_id,
    release_raw_body_hash, release_signature_hash, release_nonce_hash, release_verified_at)
  select extensions.gen_random_uuid(), block.owner_id,
         now() + p_second * interval '1 second', now() + p_second * interval '1 second', block.id,
         block.block_key, 1, p_from, p_to, repeat('9', 64), 'a9120000-0000-4000-8000-000000000302',
         's12-release-key', repeat('a', 64), repeat('b', 64),
         encode(extensions.digest(p_key || p_to, 'sha256'), 'hex'), clock_timestamp()
    from platform_private.cms_block_definition_versions block where block.block_key = p_key
$body$;
select pg_temp.gt_lifecycle('gap.a000', 'supported', 'deprecated', 0);
select pg_temp.gt_lifecycle('gap.a002', 'supported', 'deprecated', 0);
select pg_temp.gt_lifecycle('gap.a002', 'deprecated', 'withdrawn', 1);

select pg_temp.gt_creator();
create temp table gt_ctx_blocks on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.gt_context_sql()) as response;
select is(pg_temp.s10_last_error_state(), '00000', 'control: the block-heavy context read succeeds [P2-S12-AC-159]');
select is((select jsonb_array_length(response->'registeredBlocks') from gt_ctx_blocks), 128,
  '129 owned supported candidates are cut at exactly 128 selectors [P2-S12-AC-159]');
select is(
  (select response->'registeredBlocks'->0 from gt_ctx_blocks),
  '{"blockKey":"gap.b000","blockVersion":1}'::jsonb,
  'the first selector is the lowest owned supported key: the deprecated, foreign and withdrawn blocks sort before it and are absent [P2-S12-AC-159]');
select is(
  (select response->'registeredBlocks'->127 from gt_ctx_blocks),
  '{"blockKey":"gap.b127","blockVersion":1}'::jsonb,
  'the cut keeps the first 128 keys in C-collation order, dropping gap.b128 [P2-S12-AC-159]');
select ok(
  (select not exists (select 1 from jsonb_array_elements(response->'registeredBlocks') item
     where item->>'blockKey' in ('gap.a000', 'gap.a001', 'gap.a002', 'gap.b128'))
   from gt_ctx_blocks),
  'a deprecated block, a withdrawn block and another owner''s block are not selectors [P2-S12-AC-159]');
select ok(
  (select bool_and((select count(*) from jsonb_object_keys(item)) = 2
                   and item ? 'blockKey' and item ? 'blockVersion')
     from gt_ctx_blocks, jsonb_array_elements(response->'registeredBlocks') item),
  'every block selector is exactly {blockKey, blockVersion} [P2-S12-AC-159]');

select finish();
rollback;
