-- Slice 12 gap lane claude_s12_db9b, item 2 (pattern half): P2-S12-AC-108 clause 3 "or other-owner version is never listed" and P2-S12-AC-190
-- clause 2 "selectors".  The FOREIGN row is an ACTIVE pattern version of the first organization (the CMS owner), produced by the REAL path:
-- CMS-03C-12 create, then the governed chain CMS-03C-06 submit, 08 assign, 07 approve, 09 activate (s12pl_pattern).  The CALLER is the second
-- organization's author.  No active row is inserted and no state is written by hand.
--
-- BOUNDARY (why the caller, not the foreign row, is the second organization): an ACTIVE pattern of the second organization cannot be produced by the
-- real path.  CMS-03C-08 (assign) and CMS-03C-09 (activate) require the `owner` scope of the review, which platform_private.cms_governed_review_scopes
-- grants only to the holder of a platform_private.cms_owner_initialization receipt of the review's organization
-- (20261013300500_cms_governed_review_support.sql:92-99); the receipt is issued once by platform_private.initialize_cms_owner, which refuses a second
-- initialization (20260910023405_isolate_owner_bootstrap_context.sql:39-41, BOOTSTRAP_ALREADY_INITIALIZED).  The test below PROVES the gate: the second
-- organization's submit succeeds and its assign is refused capability_missing.  Forging a receipt would forge authority evidence, so none is forged.
-- Honest limit 2: CMS-03C-12 refuses a compatibleTypeIds member that is not an active type of the caller's owner scope (BE03c 405, AC-101 clause 3), so
-- no version of the first organization can name the second organization's type: the reader's owner predicate cannot be isolated from its content-type
-- predicate for patterns.  The taxonomy selector CAN isolate it (allowlists name type KEYS): phase_02_slice_12_gaps_db9b_taxonomy_selector_foreign.sql.
--
-- LABELLED FIXTURES (the repository has no command that grants a CMS capability of a non-initialized organization, nor one that creates a content type
-- outside the owner chain; the S09 world, gaps_pattern/020-cross-owner and gaps_db1_pattern_types forge them the same way):
--   * `other` (owner of the second organization) holds cms.template_designer and cms.author there: organization_actor_grant rows;
--   * the second organization's one ACTIVE compiled content type (a clone of chain type 1, as gaps_pattern/020-cross-owner builds it).
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

-- ------------------------------------------------------------------------------------------ the second organization --
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, capability, current_date, current_date + 1, true
  from s09d_actor, (values ('cms.template_designer'), ('cms.author')) caps(capability) where key = 'other';
create or replace function pg_temp.d9p_foreign_type(out o_type uuid, out o_version uuid) language plpgsql as $body$
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
      || jsonb_build_object('id', o_type, 'owner_id', org, 'type_key', 'd9pforeign', 'state', 'retired', 'version', 1,
        'created_at', stamp, 'updated_at', stamp))).*;
  insert into platform_private.cms_content_type_versions
    select (jsonb_populate_record(null::platform_private.cms_content_type_versions, to_jsonb(src_version)
      || jsonb_build_object('id', o_version, 'owner_id', org, 'content_type_id', o_type, 'schema_artifact_id', new_artifact,
        'state', 'draft', 'version', 1, 'version_no', 1, 'created_at', stamp, 'updated_at', stamp, 'supersedes_id', null,
        'dry_run_id', null, 'approved_at', null, 'definition_hash', md5('d9pforeign' || 'd') || md5('d9pforeign' || 'e'),
        'activation_workflow_policy_key', null, 'activation_workflow_policy_version', null, 'activation_workflow_policy_hash', null,
        'activation_required_decision_count', null, 'activation_required_capabilities', null,
        'activation_approval_evidence_hash', null))).*;
  insert into platform_private.cms_schema_artifacts
    select (jsonb_populate_record(null::platform_private.cms_schema_artifacts, to_jsonb(src_artifact)
      || jsonb_build_object('id', new_artifact, 'owner_id', org, 'content_type_version_id', o_version, 'created_at', stamp,
        'updated_at', stamp, 'compiled_at', stamp, 'artifact_hash', md5('d9pforeign' || 'a') || md5('d9pforeign' || 'b')))).*;
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
create temp table d9p_type on commit drop as select * from pg_temp.d9p_foreign_type();
select ok((select c.state = 'active' and c.owner_id = pg_temp.s09d_id('otherOrg') from platform_private.cms_content_types c where c.id = (select o_type from d9p_type))
    and exists (select 1 from platform_private.cms_content_type_versions v where v.content_type_id = (select o_type from d9p_type) and v.state = 'active'),
  'fixture: the second organization has one ACTIVE content type with an active version [P2-S12-AC-108]');

-- A definition as the SECOND organization (CMS-03C-12, real producer).
create or replace function pg_temp.d9p_req(p_key text, p_tree jsonb, p_expected text, p_idem text) returns jsonb language sql stable as $body$
  select pg_temp.s12pd_request(p_key, p_tree, p_expected, p_idem, null, p_expected)
    || jsonb_build_object('compatibleTypeIds', jsonb_build_array((select o_type from d9p_type)),
         'context', pg_temp.s09d_context('other', true)) $body$;

-- ------------------------------------------------------------------ active patterns of the FIRST owner (real chain) --
select * from pg_temp.s12pl_pattern('a-only', 'd9p-a-only', jsonb_build_array(pg_temp.s12pd_block('hero')));
select * from pg_temp.s12pl_pattern('a-shared', 'd9p-shared', jsonb_build_array(pg_temp.s12pd_block('hero')));
-- the second organization's own definition of the same key: a real DRAFT (CMS-03C-12), then its real submit
select pg_temp.s12pd_run('b-shared', pg_temp.d9p_req('d9p-shared', jsonb_build_array(pg_temp.s12pd_block('hero')), null, 'd9p-b-shared-create'), 'other');
select is(pg_temp.s12pd_state('b-shared'), '00000', 'setup: the second organization defines d9p-shared (a key the first owner holds) through CMS-03C-12: no conflict [P2-S12-AC-190]');
select pg_temp.s12pd_run('b-shared:submit', jsonb_build_object('subjectKind', 'pattern_version', 'subjectId', pg_temp.s12pd_body('b-shared')->'id',
    'subjectHash', pg_temp.s12pd_body('b-shared')->'contentHash', 'idempotencyKey', 'd9p-b-shared-submit', 'context', pg_temp.s09d_context('other', true)),
  'other', 'service_role', 'submit');
select is(pg_temp.s12pd_state('b-shared:submit'), '00000', 'the second organization''s designer submits its pattern through CMS-03C-06 [P2-S12-AC-190]');
-- the gate that makes an active row of the second organization unproducible (BOUNDARY above)
select pg_temp.s12pd_run('b-shared:assign', jsonb_build_object('reviewId', pg_temp.s12pd_body('b-shared:submit')->'id', 'action', 'create',
    'expectedVersion', pg_temp.s12pd_body('b-shared:submit')->'version', 'ifMatch', pg_temp.s12pd_body('b-shared:submit')->'version',
    'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'),
    'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reason', 'Second organization fixture', 'idempotencyKey', 'd9p-b-shared-assign', 'context', pg_temp.s09d_context('other', true)),
  'other', 'service_role', 'assign');
select is((select state || ':' || message from s12pd_out where label = 'b-shared:assign'), 'P0001:capability_missing',
  'BOUNDARY fact: the second organization''s designer cannot assign a reviewer: the owner scope needs a cms_owner_initialization receipt of that organization [P2-S12-AC-108]');
select ok(not exists (select 1 from platform_private.cms_owner_initialization where organization_id = pg_temp.s09d_id('otherOrg'))
    and exists (select 1 from platform_private.cms_owner_initialization where organization_id = pg_temp.s09d_id('ownerOrg')),
  'BOUNDARY fact: only the first organization holds an owner-initialization receipt [P2-S12-AC-108]');
select ok((select count(*) = 3 and count(*) filter (where owner_id = pg_temp.s09d_id('ownerOrg') and state = 'active' and activated_at is not null) = 2
                and count(*) filter (where owner_id = pg_temp.s09d_id('otherOrg') and state <> 'active') = 1
           from platform_private.cms_pattern_versions where pattern_key like 'd9p-%')
    and (select count(distinct pattern_id) = 3 from platform_private.cms_pattern_versions where pattern_key like 'd9p-%'),
  'fixture: two real ACTIVE versions of the first owner and one non-active version of the second owner; d9p-shared is held by both owners as two lineages [P2-S12-AC-190]');

-- ------------------------------------------------------------------------------------------------- the selectors --

create or replace function pg_temp.d9p_keys(p_page jsonb) returns text[] language sql stable as $body$
  select coalesce(array_agg(item->>'patternKey' || '@' || (item->>'patternVersion') order by ordinality), array[]::text[])
    from jsonb_array_elements(coalesce(p_page->'items', '[]'::jsonb)) with ordinality t(item, ordinality) $body$;
create or replace function pg_temp.d9p_item(p_label text) returns jsonb language sql stable as $body$
  select jsonb_build_object('patternId', pg_temp.s12pd_body(p_label)->'patternId', 'patternVersionId', pg_temp.s12pd_body(p_label)->'id',
    'patternKey', pg_temp.s12pd_body(p_label)->'patternKey', 'patternVersion', pg_temp.s12pd_body(p_label)->'patternVersion',
    'nodeCount', pg_temp.s12pd_body(p_label)->'nodeCount', 'blockRegistryDigest', pg_temp.s12pd_body(p_label)->'blockRegistryDigest') $body$;
-- This key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only gap lane test key');
create or replace function pg_temp.d9p_sel(p_label text, p_type uuid, p_actor text) returns void language sql as $body$
  select pg_temp.s12pu_call(p_label, 'platform_api.cms_list_pattern_selector', jsonb_build_object(
    'contentTypeId', p_type, 'context', pg_temp.s09d_context(p_actor, true), 'correlationId', 'a9120000-0000-4000-8000-00000000c0d3'), p_actor)
$body$;
select pg_temp.d9p_sel('sel-a', (select id from s12pd_types where ordinal = 1), 'owner');
select pg_temp.d9p_sel('sel-b', (select o_type from d9p_type), 'other');
select is(pg_temp.s12pu_oc('sel-a') || '/' || pg_temp.s12pu_oc('sel-b'), 'ok/ok',
  'both organizations'' authors read the selector of their own content type [P2-S12-AC-108]');
select is(pg_temp.d9p_keys(pg_temp.s12pu_body('sel-a')), array['d9p-a-only@1', 'd9p-shared@1'],
  'positive control: the first owner''s author lists its two active versions [P2-S12-AC-108]');
select is(pg_temp.s12pu_body('sel-a')->'items', (select jsonb_agg(pg_temp.d9p_item(l) order by k collate "C") from (values ('d9p-a-only', 'a-only'), ('d9p-shared', 'a-shared')) t(k, l)),
  'positive control: each listed item equals the independently built row of its CMS-03C-12 response [P2-S12-AC-108]');
select ok(pg_temp.s12pu_body('sel-b') = jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'pageVersion', pg_temp.s12pu_body('sel-b')->>'pageVersion')
    and jsonb_array_length(pg_temp.s12pu_body('sel-b')->'items') = 0,
  'the second organization''s author lists NOTHING for its own type: the first owner''s two ACTIVE versions are never listed to another owner [P2-S12-AC-108]');
select ok((select count(*) = 2 from platform_private.cms_pattern_versions where owner_id = pg_temp.s09d_id('ownerOrg') and state = 'active' and pattern_key like 'd9p-%')
    and not exists (select 1 from jsonb_array_elements(pg_temp.s12pu_body('sel-b')->'items') item
                     where (item->>'patternVersionId')::uuid in (select id from platform_private.cms_pattern_versions where owner_id = pg_temp.s09d_id('ownerOrg'))),
  'independent oracle: the two active rows exist in the store and none of their ids is in the second organization''s page [P2-S12-AC-108]');
select ok(pg_temp.s12pu_body('sel-b')->>'pageVersion' = floor(extract(epoch from (select max(updated_at) from platform_private.cms_pattern_versions
         where owner_id = pg_temp.s09d_id('otherOrg') and compatible_type_ids ? lower((select o_type from d9p_type)::text))) * 1000000)::bigint::text
    and pg_temp.s12pu_body('sel-b')->>'pageVersion' <> pg_temp.s12pu_body('sel-a')->>'pageVersion',
  'the second organization''s pageVersion is the high-water update instant of ITS OWN compatible versions only, never the first owner''s [P2-S12-AC-109]');
select ok(pg_temp.s12pu_unchanged('sel-a') and pg_temp.s12pu_unchanged('sel-b'), 'both selector reads changed no store: no audit, no outbox, no idempotency record [P2-S12-AC-110]');

-- concealment: each owner naming the OTHER owner's active type gets exactly the outcome of an absent type
select pg_temp.d9p_sel('sel-a-names-b', (select o_type from d9p_type), 'owner');
select pg_temp.d9p_sel('sel-b-names-a', (select id from s12pd_types where ordinal = 1), 'other');
select pg_temp.d9p_sel('sel-a-absent', 'a9120000-0000-4000-8000-0000000000bb'::uuid, 'owner');
select pg_temp.d9p_sel('sel-b-absent', 'a9120000-0000-4000-8000-0000000000bb'::uuid, 'other');
select is(pg_temp.s12pu_oc('sel-a-names-b'), 'P0001:NOT_FOUND', 'the first owner naming the second organization''s ACTIVE type is the concealed NOT_FOUND [P2-S12-AC-190]');
select is(pg_temp.s12pu_oc('sel-b-names-a'), 'P0001:NOT_FOUND', 'the second organization naming the first owner''s ACTIVE type is the concealed NOT_FOUND [P2-S12-AC-190]');
select ok(pg_temp.s12pu_oc('sel-a-names-b') = pg_temp.s12pu_oc('sel-a-absent') and pg_temp.s12pu_oc('sel-b-names-a') = pg_temp.s12pu_oc('sel-b-absent')
    and pg_temp.s12pu_body('sel-a-names-b') is null and pg_temp.s12pu_body('sel-b-names-a') is null,
  'each cross-owner type outcome equals that caller''s outcome for an ABSENT type, message and DETAIL, with no body [P2-S12-AC-190]');

-- the list follows the data of its own owner: a real successor of the first owner's shared key replaces ITS version and moves nothing for the second
select * from pg_temp.s12pl_pattern('a-shared-2', 'd9p-shared', jsonb_build_array(pg_temp.s12pd_block('hero', '[]'::jsonb, '{"title":"v2"}'::jsonb)), null, true, '1');
select pg_temp.d9p_sel('sel-a-2', (select id from s12pd_types where ordinal = 1), 'owner');
select pg_temp.d9p_sel('sel-b-2', (select o_type from d9p_type), 'other');
select is(pg_temp.d9p_keys(pg_temp.s12pu_body('sel-a-2')), array['d9p-a-only@1', 'd9p-shared@2'],
  'the first owner''s new active version replaces its predecessor in the first owner''s page [P2-S12-AC-108]');
select is(pg_temp.s12pu_body('sel-b-2'), pg_temp.s12pu_body('sel-b'),
  'the second organization''s page is byte-identical after the first owner''s activation: same (empty) items and the same pageVersion [P2-S12-AC-109]');
select ok(pg_temp.s12pu_body('sel-a-2')->>'pageVersion' <> pg_temp.s12pu_body('sel-a')->>'pageVersion',
  'control: the first owner''s own pageVersion moved with its activation [P2-S12-AC-109]');

select finish();
rollback;
