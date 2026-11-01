-- Slice 12 gap lane claude_s12_db9a (follow-up round, refute9db 6.3): the MATCHED PAIR for P2-S12-AC-108 clause 3 "or other-owner version is never listed" and
-- P2-S12-AC-190 clause 2 "selectors" (the pattern half: CMS-03C-13 `cms_list_pattern_selector` and the nestable read `cms_list_pattern_nestable`, 20261027100000).
-- db9b's phase_02_slice_12_gaps_db9b_pattern_selector_foreign.sql lists a first-owner ACTIVE version that is also INCOMPATIBLE with the second organization's type
-- (CMS-03C-12 accepts only the caller's own active types), so its empty page does not isolate the owner predicate.  Here the foreign row IS compatible:
--   * the FIRST organization (owner A) holds a pattern version whose compatibleTypeIds name BOTH its own active type and the SECOND organization's (B) active type;
--   * so the owner predicate (`version_row.owner_id = v_party_id`) is the ONLY thing that can keep it out of B's page for B's type;
--   * it is a LABELLED CLONE of a real pattern row inserted as a DRAFT (the producer refuses a foreign type id; the guarded lifecycle admits a draft only, as db9b
--     legacy_forest/000-world.sqlinc d9l_draft does).  d9l_draft makes its rows ACTIVE through the real governed chain; HERE THE REAL CHAIN REFUSES the foreign type id
--     at submit (BOUNDARY, asserted below: 20261014100000:36-38 over 20261014090200 `content_type.owner_id = p_owner_id`), so the clone is made ACTIVE by the
--     FALLBACK the refutation names: the guarded lifecycle seam (app.cms_governed_lifecycle) walked draft > review > approved > active under a labelled forgery;
--   * B's author lists NOTHING of it (selector, with cms.author) and B's template designer lists nothing of it (nestable read, with cms.template_designer);
--   * the control is the same row listed to its owner A, by the same functions, in the same transaction;
--   * the negative arm is proven SENSITIVE: a scratch copy of each reader under a test-only name (created from pg_get_functiondef inside this rolled-back
--     transaction, never a migration) with the owner predicate removed LISTS the row to B.
-- LABELLED FIXTURES (the repository has no command that grants a CMS capability of a non-initialized organization, nor one that creates a content type outside the
-- owner chain; the S09 world, gaps_pattern/020-cross-owner and db9b forge them the same way): `other` holds cms.template_designer and cms.author in the second
-- organization (organization_actor_grant rows) and the second organization has one ACTIVE compiled content type (a clone of chain type 1).
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_nestable_read/000-helpers.sqlinc

-- ------------------------------------------------------------------------------------------ the second organization (labelled fixtures) --
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, capability, current_date, current_date + 1, true
  from s09d_actor, (values ('cms.template_designer'), ('cms.author')) caps(capability) where key = 'other';
create or replace function pg_temp.d9c_foreign_type(out o_type uuid, out o_version uuid) language plpgsql as $body$
declare
  src_type platform_private.cms_content_types%rowtype;
  src_version platform_private.cms_content_type_versions%rowtype;
  src_artifact platform_private.cms_schema_artifacts%rowtype;
  new_artifact uuid := extensions.gen_random_uuid();
  stamp timestamptz := clock_timestamp();
  org uuid := pg_temp.s09d_id('otherOrg');
begin
  perform set_config('app.cms_rpc', 'true', true);
  o_type := extensions.gen_random_uuid();
  o_version := extensions.gen_random_uuid();
  select c.* into src_type from platform_private.cms_content_types c where c.id = (select id from s12pd_chain_types where ordinal = 1);
  select v.* into src_version from platform_private.cms_content_type_versions v where v.id = (select version_id from s12pd_chain_types where ordinal = 1);
  select a.* into src_artifact from platform_private.cms_schema_artifacts a where a.id = src_version.schema_artifact_id;
  insert into platform_private.cms_content_types
    select (jsonb_populate_record(null::platform_private.cms_content_types, to_jsonb(src_type)
      || jsonb_build_object('id', o_type, 'owner_id', org, 'type_key', 'd9cforeign', 'state', 'retired', 'version', 1,
        'created_at', stamp, 'updated_at', stamp))).*;
  insert into platform_private.cms_content_type_versions
    select (jsonb_populate_record(null::platform_private.cms_content_type_versions, to_jsonb(src_version)
      || jsonb_build_object('id', o_version, 'owner_id', org, 'content_type_id', o_type, 'schema_artifact_id', new_artifact,
        'state', 'draft', 'version', 1, 'version_no', 1, 'created_at', stamp, 'updated_at', stamp, 'supersedes_id', null,
        'dry_run_id', null, 'approved_at', null, 'definition_hash', md5('d9cforeign' || 'd') || md5('d9cforeign' || 'e'),
        'activation_workflow_policy_key', null, 'activation_workflow_policy_version', null, 'activation_workflow_policy_hash', null,
        'activation_required_decision_count', null, 'activation_required_capabilities', null,
        'activation_approval_evidence_hash', null))).*;
  insert into platform_private.cms_schema_artifacts
    select (jsonb_populate_record(null::platform_private.cms_schema_artifacts, to_jsonb(src_artifact)
      || jsonb_build_object('id', new_artifact, 'owner_id', org, 'content_type_version_id', o_version, 'created_at', stamp,
        'updated_at', stamp, 'compiled_at', stamp, 'artifact_hash', md5('d9cforeign' || 'a') || md5('d9cforeign' || 'b')))).*;
  update platform_private.cms_content_type_versions version_row
     set state = 'active', version = version_row.version + 1, updated_at = clock_timestamp(),
         activation_workflow_policy_key = src_version.activation_workflow_policy_key,
         activation_workflow_policy_version = src_version.activation_workflow_policy_version,
         activation_workflow_policy_hash = src_version.activation_workflow_policy_hash,
         activation_required_decision_count = src_version.activation_required_decision_count,
         activation_required_capabilities = src_version.activation_required_capabilities,
         activation_approval_evidence_hash = src_version.activation_approval_evidence_hash
   where version_row.id = o_version;
  update platform_private.cms_content_types type_row
     set state = 'active', version = type_row.version + 1, updated_at = clock_timestamp() where type_row.id = o_type;
  perform set_config('app.cms_rpc', '', true);
end;
$body$;
create temp table d9c_type on commit drop as select * from pg_temp.d9c_foreign_type();
select ok((select c.state = 'active' and c.owner_id = pg_temp.s09d_id('otherOrg') from platform_private.cms_content_types c where c.id = (select o_type from d9c_type))
    and exists (select 1 from platform_private.cms_content_type_versions v where v.content_type_id = (select o_type from d9c_type) and v.state = 'active'),
  'fixture: the second organization has one ACTIVE content type with an active version [P2-S12-AC-108]');

-- ------------------------------------------------------------------ the first owner's patterns: one real, one labelled clone --
select * from pg_temp.s12pl_pattern('base', 'd9c-base', jsonb_build_array(pg_temp.s12pd_block('hero')));
-- A DRAFT clone of the real row whose compatibleTypeIds name the owner's type AND the second organization's active type (hand-built: see the header).
create or replace function pg_temp.d9c_clone_draft(p_label text, p_key text, p_types jsonb) returns uuid language plpgsql as $body$
declare base_row platform_private.cms_pattern_versions%rowtype; stamp timestamptz := clock_timestamp(); digest text; hash text; new_id uuid := extensions.gen_random_uuid();
begin
  select * into base_row from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('base')->>'id')::uuid;
  perform set_config('app.cms_rpc', 'true', true);
  digest := platform_private.cms_pattern_registry_digest(pg_temp.s09d_id('ownerOrg'), base_row.block_tree);
  perform set_config('app.cms_rpc', '', true);
  hash := platform_private.cms_jcs_sha256(jsonb_build_object('patternKey', p_key, 'compatibleTypeIds', p_types,
    'blockTree', base_row.block_tree, 'blockRegistryDigest', digest));
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_pattern_versions
  select (jsonb_populate_record(null::platform_private.cms_pattern_versions, to_jsonb(base_row) || jsonb_build_object(
    'id', new_id, 'pattern_id', new_id, 'pattern_key', p_key, 'compatible_type_ids', p_types, 'state', 'draft', 'version', 1, 'supersedes_id', null,
    'created_at', stamp, 'updated_at', stamp, 'lifecycle_version', 1, 'activated_at', null, 'retired_at', null,
    'block_registry_digest', digest, 'content_hash', hash))).*;
  perform set_config('app.cms_rpc', '', true);
  insert into s12pd_out(label, response, state) values (p_label, jsonb_build_object('id', new_id, 'contentHash', hash, 'patternId', new_id,
    'patternVersion', 1, 'patternKey', p_key, 'nodeCount', base_row.node_count, 'blockRegistryDigest', digest), '00000');
  return new_id;
end;
$body$;
select pg_temp.d9c_clone_draft('pair', 'd9c-pair', jsonb_build_array(lower((select id from s12pd_types where ordinal = 1)::text), lower((select o_type from d9c_type)::text)));
-- BOUNDARY (the real chain refuses a foreign type id): the governed submit recomputes the block registry digest, whose pattern branch calls
-- cms_pattern_blocks_compatible (20261014090200: `content_type.owner_id = p_owner_id`), so a compatibleTypeIds member that is not an active type of the owner
-- fails closed: P0001 VALIDATION_FAILED ["/blockTree"] (20261014100000:36-38).  No real chain can therefore activate the clone.
select pg_temp.s12pd_run('pair:submit', jsonb_build_object('subjectKind', 'pattern_version', 'subjectId', pg_temp.s12pd_body('pair')->'id',
    'subjectHash', pg_temp.s12pd_body('pair')->'contentHash', 'idempotencyKey', 'd9c-pair-submit', 'context', pg_temp.s09d_context('owner', true)),
  'owner', 'service_role', 'submit');
select is((select state || ':' || message || '|' || detail from s12pd_out where label = 'pair:submit'), 'P0001:VALIDATION_FAILED|["/blockTree"]',
  'BOUNDARY fact: the first owner''s real governed submit refuses a pattern version that names the second organization''s content type (cms_pattern_blocks_compatible fails closed on a type outside the owner scope) [P2-S12-AC-108]');
-- FALLBACK (labelled forgery, refute9db 6.3.2): the guarded lifecycle seam.  The clone stays an unchanged definition row; only its lifecycle columns move, one legal
-- step at a time (draft > review > approved > active, lifecycle_version + 1, activated_at stamped), under the governed flag that the governed RPCs set.  No review,
-- decision or approval row is written, no trigger is disabled.
create or replace function pg_temp.d9c_walk_to_active(p_id uuid) returns void language plpgsql as $body$
declare step text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform set_config('app.cms_governed_lifecycle', 'true', true);
  foreach step in array array['review', 'approved', 'active'] loop
    update platform_private.cms_pattern_versions set state = step, lifecycle_version = lifecycle_version + 1,
        updated_at = clock_timestamp(), activated_at = case when step = 'active' then clock_timestamp() else activated_at end
     where id = p_id;
  end loop;
  perform set_config('app.cms_governed_lifecycle', '', true);
  perform set_config('app.cms_rpc', '', true);
end;
$body$;
select pg_temp.d9c_walk_to_active((pg_temp.s12pd_body('pair')->>'id')::uuid);
select ok((select count(*) = 1 and bool_and(owner_id = pg_temp.s09d_id('ownerOrg') and state = 'active' and activated_at is not null
              and compatible_type_ids ? lower((select o_type from d9c_type)::text) and compatible_type_ids ? lower((select id from s12pd_types where ordinal = 1)::text))
            from platform_private.cms_pattern_versions where pattern_key = 'd9c-pair'),
  'fixture: the clone is ACTIVE, owned by the first organization, and compatible with BOTH its own type and the second organization''s active type (made active by the guarded lifecycle seam, the real chain refusing the foreign type) [P2-S12-AC-108]');

-- ------------------------------------------------------------------------------------------- the real readers --
-- This key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('b3', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only gap lane test key');
create or replace function pg_temp.d9c_keys(p_page jsonb) returns text[] language sql stable as $body$
  select coalesce(array_agg(item->>'patternKey' || '@' || (item->>'patternVersion') order by ordinality), array[]::text[])
    from jsonb_array_elements(coalesce(p_page->'items', '[]'::jsonb)) with ordinality t(item, ordinality) $body$;
create or replace function pg_temp.d9c_sel(p_label text, p_type uuid, p_actor text) returns void language sql as $body$
  select pg_temp.s12nr_call(p_label, 'platform_api.cms_list_pattern_selector', jsonb_build_object(
    'contentTypeId', p_type, 'context', pg_temp.s09d_context(p_actor, true), 'correlationId', 'a9120000-0000-4000-8000-00000000c0d3'), p_actor)
$body$;
create or replace function pg_temp.d9c_nest(p_label text, p_type uuid, p_actor text) returns void language sql as $body$
  select pg_temp.s12nr_call(p_label, 'platform_api.cms_list_pattern_nestable', jsonb_build_object(
    'contentTypeId', jsonb_build_array(p_type), 'context', pg_temp.s09d_context(p_actor, true), 'correlationId', 'a9120000-0000-4000-8000-00000000c0d3'), p_actor)
$body$;
select pg_temp.d9c_sel('sel-a', (select id from s12pd_types where ordinal = 1), 'owner');
select pg_temp.d9c_sel('sel-b', (select o_type from d9c_type), 'other');
select pg_temp.d9c_nest('nest-a', (select id from s12pd_types where ordinal = 1), 'owner');
select pg_temp.d9c_nest('nest-b', (select o_type from d9c_type), 'other');
select is(pg_temp.s12pu_oc('sel-a') || '/' || pg_temp.s12pu_oc('sel-b') || '/' || pg_temp.s12pu_oc('nest-a') || '/' || pg_temp.s12pu_oc('nest-b'), 'ok/ok/ok/ok',
  'all four reads succeed: each organization''s author reads the selector, and each template designer the nestable read, of its own content type [P2-S12-AC-108]');
select is(pg_temp.d9c_keys(pg_temp.s12pu_body('sel-a')), array['d9c-base@1', 'd9c-pair@1'],
  'control: the owner lists the clone through the selector, next to its real pattern [P2-S12-AC-108]');
select is(pg_temp.d9c_keys(pg_temp.s12pu_body('nest-a')), array['d9c-base@1', 'd9c-pair@1'],
  'control: the owner lists the clone through the nestable read [P2-S12-AC-190]');
select is(pg_temp.s12pu_body('sel-b')->'items', '[]'::jsonb,
  'the second organization''s author lists NOTHING for its own type although the first owner''s ACTIVE clone names that very type: only the owner predicate excludes it (selector) [P2-S12-AC-108]');
select is(pg_temp.s12pu_body('nest-b')->'items', '[]'::jsonb,
  'the second organization''s template designer lists NOTHING for its own type although the first owner''s ACTIVE clone names that very type (nestable read) [P2-S12-AC-190]');
select ok(not exists (select 1 from jsonb_array_elements(pg_temp.s12pu_body('sel-b')->'items' || pg_temp.s12pu_body('nest-b')->'items') item
                       where (item->>'patternVersionId')::uuid in (select id from platform_private.cms_pattern_versions where owner_id = pg_temp.s09d_id('ownerOrg')))
    and (select count(*) = 1 from platform_private.cms_pattern_versions where pattern_key = 'd9c-pair' and state = 'active' and compatible_type_ids ? lower((select o_type from d9c_type)::text)),
  'independent oracle: the active clone compatible with the second organization''s type exists in the store and none of the first owner''s ids is in either page of the second organization [P2-S12-AC-190]');

-- ------------------------------------------------------------------------- the negative arm is SENSITIVE (scratch copies) --
-- Test-only copies of the two unsigned readers with the owner predicate removed, created inside this rolled-back transaction from the installed definitions.
create or replace function pg_temp.d9c_scratch(p_source regprocedure, p_name text) returns text language plpgsql as $body$
declare def text := pg_get_functiondef(p_source); pred constant text := 'version_row.owner_id = v_party_id and version_row.state = ''active''';
  before_count integer; after_count integer;
begin
  before_count := (length(def) - length(replace(def, 'version_row.owner_id = v_party_id', ''))) / length('version_row.owner_id = v_party_id');
  if position(pred in def) = 0 then raise exception 'owner predicate not found in %', p_source; end if;
  def := replace(def, pred, 'version_row.state = ''active''');
  after_count := (length(def) - length(replace(def, 'version_row.owner_id = v_party_id', ''))) / length('version_row.owner_id = v_party_id');
  def := regexp_replace(def, 'FUNCTION platform_private\.cms_list_pattern_[a-z]+\(', 'FUNCTION platform_private.' || p_name || '(');
  execute def;
  return before_count || '->' || after_count;
end;
$body$;
select pg_temp.d9c_scratch('platform_private.cms_list_pattern_selector(jsonb)'::regprocedure, 'd9c_selector_without_owner_predicate') as selector_scratch \gset
select pg_temp.d9c_scratch('platform_private.cms_list_pattern_nestable(jsonb)'::regprocedure, 'd9c_nestable_without_owner_predicate') as nestable_scratch \gset
select is(:'selector_scratch'::text, '2->1'::text, 'scratch copy of the selector: the owner predicate of the page query is removed and nothing else (the water-mark query keeps its own) [P2-S12-AC-108]');
select is(:'nestable_scratch'::text, '2->1'::text, 'scratch copy of the nestable read: the owner predicate of the page query is removed and nothing else [P2-S12-AC-190]');
create or replace function pg_temp.d9c_scratch_call(p_fn text, p_request jsonb, p_actor text) returns jsonb language plpgsql as $body$
declare answer jsonb;
begin
  perform pg_temp.s09d_session(p_actor, 'service_role');
  execute format('select platform_private.%I($1)', p_fn) into answer using p_request;
  return answer;
exception when others then
  return jsonb_build_object('__error', sqlstate || ':' || sqlerrm);
end;
$body$;
create temp table d9c_scratch_out on commit drop as
select 'sel-b' as label, pg_temp.d9c_scratch_call('d9c_selector_without_owner_predicate', (select request from s12pu_out where label = 'sel-b'), 'other') as response
union all select 'sel-a', pg_temp.d9c_scratch_call('d9c_selector_without_owner_predicate', (select request from s12pu_out where label = 'sel-a'), 'owner')
union all select 'nest-b', pg_temp.d9c_scratch_call('d9c_nestable_without_owner_predicate', (select request from s12pu_out where label = 'nest-b'), 'other')
union all select 'nest-a', pg_temp.d9c_scratch_call('d9c_nestable_without_owner_predicate', (select request from s12pu_out where label = 'nest-a'), 'owner');
select is((select response->>'__error' from d9c_scratch_out where label = 'sel-b'), null,
  'the scratch selector accepts the second organization''s request (a refusal would make the next row meaningless) [P2-S12-AC-108]');
select ok(pg_temp.d9c_keys((select response from d9c_scratch_out where label = 'sel-b')) = array['d9c-pair@1'],
  'NEGATIVE ARM FAILS WITHOUT THE OWNER PREDICATE: the scratch selector lists the first owner''s clone to the second organization for its own type [P2-S12-AC-108]');
select ok(pg_temp.d9c_keys((select response from d9c_scratch_out where label = 'nest-b')) = array['d9c-pair@1'],
  'NEGATIVE ARM FAILS WITHOUT THE OWNER PREDICATE: the scratch nestable read lists the first owner''s clone to the second organization for its own type [P2-S12-AC-190]');
select ok(pg_temp.d9c_keys((select response from d9c_scratch_out where label = 'sel-a')) = pg_temp.d9c_keys(pg_temp.s12pu_body('sel-a'))
    and pg_temp.d9c_keys((select response from d9c_scratch_out where label = 'nest-a')) = pg_temp.d9c_keys(pg_temp.s12pu_body('nest-a')),
  'control: the scratch copies answer the owner exactly as the installed readers do, so the only difference is the removed predicate [P2-S12-AC-108]');

select finish();
rollback;
