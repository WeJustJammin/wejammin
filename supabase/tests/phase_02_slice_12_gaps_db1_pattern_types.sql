-- Slice 12 gap lane claude_s12_gaps_db1: content types of ANOTHER owner organization.
--   P2-S12-AC-101 clause 3  CMS-03C-12: each compatibleTypeIds member is the id of an ACTIVE content type of the
--                           caller's owner scope (BE03c 405); another owner's active type is VALIDATION_FAILED at
--                           /compatibleTypeIds with no effect.
--   P2-S12-AC-107 clauses 1+3  CMS-03C-13: the named content type must be in the caller's owner scope; another owner's
--                           ACTIVE type answers the same NOT_FOUND as an absent id (BE03c 175, 1266, 1474).
--   P2-S12-AC-108 clause 3  an other-owner pattern version is never listed (the owner-axis negative control).
-- The foreign content type is built exactly like the Slice 12 block fixture does (a type row inserted retired, a draft
-- version, its compiled artifact, then the two state updates the guards allow); no trigger is disabled.
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

-- An ACTIVE, compiled content type of the second organization (`other`), with an active version.
create or replace function pg_temp.gp_foreign_type(p_n integer, p_key text, p_state text) returns uuid language plpgsql as $body$
declare
  owner_party uuid := pg_temp.s09d_id('otherOrg');
  type_id uuid := ('a9122000-0000-4000-8000-0000000001' || lpad(p_n::text, 2, '0'))::uuid;
  version_id uuid := ('a9122000-0000-4000-8000-0000000002' || lpad(p_n::text, 2, '0'))::uuid;
  artifact_id uuid := ('a9122000-0000-4000-8000-0000000003' || lpad(p_n::text, 2, '0'))::uuid;
  creator uuid := (select auth_user_id from s09d_actor where key = 'other');
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_content_types(id, owner_id, state, type_key, owner_capability, created_by)
  values (type_id, owner_party, 'retired', p_key, 'cms.schema_designer', creator);
  insert into platform_private.cms_content_type_versions(
    id, owner_id, state, content_type_id, version_no, labels, workflow_key, workflow_version,
    source_locale, default_locale, supported_locales, fallback_chains, locale_config_hash,
    schema_artifact_id, definition_hash, compatibility, created_by)
  values (version_id, owner_party, 'draft', type_id, 1, '{}'::jsonb, 'editorial', 1,
    'en-US', 'en-US', '["en-US"]'::jsonb, '{}'::jsonb,
    '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860', artifact_id,
    encode(extensions.digest('gap-foreign-def-' || p_n, 'sha256'), 'hex'), 'additive', creator);
  insert into platform_private.cms_schema_artifacts(
    id, owner_id, content_type_version_id, compiler_version, zod_contract_ref, editor_manifest,
    renderer_manifest, artifact_hash, compiled_at)
  values (artifact_id, owner_party, version_id, '1', 'cms/s12-gap-foreign-' || p_n, '{}'::jsonb,
    jsonb_build_object('relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb),
    encode(extensions.digest('gap-foreign-art-' || p_n, 'sha256'), 'hex'), clock_timestamp());
  update platform_private.cms_content_type_versions
     set state = 'active', version = version + 1,
         activation_workflow_policy_key = 'cms.entry.author', activation_workflow_policy_version = 1,
         activation_workflow_policy_hash = repeat('a', 64), activation_required_decision_count = 1,
         activation_required_capabilities = jsonb_build_array('cms.author'),
         activation_approval_evidence_hash = repeat('b', 64), updated_at = clock_timestamp()
   where id = version_id;
  if p_state = 'active' then
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp() where id = type_id;
  end if;
  return type_id;
end;
$body$;

create temp table gp_types(key text primary key, id uuid not null) on commit drop;
insert into gp_types values ('foreign', pg_temp.gp_foreign_type(1, 'gapforeigntype', 'active'));
select ok(
  (select c.state = 'active' and c.owner_id = pg_temp.s09d_id('otherOrg') and c.owner_id <> pg_temp.s09d_id('ownerOrg')
      and exists (select 1 from platform_private.cms_content_type_versions v
                   where v.content_type_id = c.id and v.state = 'active')
     from platform_private.cms_content_types c where c.id = (select id from gp_types where key = 'foreign')),
  'control: the foreign content type is ACTIVE with an active version, owned by the other organization [P2-S12-AC-101]');

-- ------------------------------------------------------------------------------------------------ AC-101 --
select * from pg_temp.s12pd_refused('type-foreign-owner', pg_temp.s12pd_request('s12pd-type-foreign',
  pg_temp.s12pd_forest(1), null, 's12pd-type-foreign') || jsonb_build_object('compatibleTypeIds',
    jsonb_build_array((select id from gp_types where key = 'foreign'))), 'VALIDATION_FAILED');
select is((select detail::jsonb from s12pd_out where label = 'type-foreign-owner'), '["/compatibleTypeIds"]'::jsonb,
  'another owner''s ACTIVE content type is refused at the /compatibleTypeIds pointer [P2-S12-AC-101]');
select * from pg_temp.s12pd_refused('type-foreign-mixed', pg_temp.s12pd_request('s12pd-type-foreign-mixed',
  pg_temp.s12pd_forest(1), null, 's12pd-type-foreign-mixed') || jsonb_build_object('compatibleTypeIds',
    jsonb_build_array((select id from s12pd_types where ordinal = 1), (select id from gp_types where key = 'foreign'))),
  'VALIDATION_FAILED');
select is((select detail::jsonb from s12pd_out where label = 'type-foreign-mixed'), '["/compatibleTypeIds"]'::jsonb,
  'one foreign member among owned active types refuses the whole list at /compatibleTypeIds [P2-S12-AC-101]');
select pg_temp.s12pd_run('type-own-control', pg_temp.s12pd_request('s12pd-type-own',
  pg_temp.s12pd_forest(1), null, 's12pd-type-own'));
select is(pg_temp.s12pd_state('type-own-control'), '00000',
  'control: the same definition over the caller''s own active types is accepted [P2-S12-AC-101]');

-- ------------------------------------------------------------------------------------------------ AC-107 --
-- This key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only gap lane test key');
create or replace function pg_temp.gp_sel(p_label text, p_type uuid, p_actor text default 'owner') returns void language sql as $body$
  select pg_temp.s12pu_call(p_label, 'platform_api.cms_list_pattern_selector', jsonb_build_object(
    'contentTypeId', p_type, 'context', pg_temp.s09d_context(p_actor, true),
    'correlationId', 'a9120000-0000-4000-8000-00000000c0d3'), p_actor)
$body$;
select * from pg_temp.s12pl_pattern('gp-a', 's12pl-gp-a', jsonb_build_array(pg_temp.s12pd_block('hero')));
select pg_temp.gp_sel('sel-own', (select id from s12pd_types where ordinal = 1));
select pg_temp.gp_sel('sel-absent', 'a9120000-0000-4000-8000-0000000000bb'::uuid);
select pg_temp.gp_sel('sel-foreign', (select id from gp_types where key = 'foreign'));
select is(pg_temp.s12pu_oc('sel-own'), 'ok', 'control: an author lists the selector for its own content type [P2-S12-AC-107]');
select is(pg_temp.s12pu_oc('sel-foreign'), 'P0001:NOT_FOUND',
  'another owner''s ACTIVE content type answers the concealed NOT_FOUND [P2-S12-AC-107]');
select is(pg_temp.s12pu_oc('sel-foreign'), pg_temp.s12pu_oc('sel-absent'),
  'it is exactly the outcome of an absent content type: message, DETAIL and all [P2-S12-AC-107]');
select ok(pg_temp.s12pu_unchanged('sel-foreign') and pg_temp.s12pu_body('sel-foreign') is null,
  'the concealed read returns no list and changes no store [P2-S12-AC-107]');
select ok(
  pg_temp.s12pu_body('sel-own')->'items' @> jsonb_build_array(jsonb_build_object('patternKey', 's12pl-gp-a')),
  'control: the own-type list contains the active pattern the author defined [P2-S12-AC-107]');

-- ------------------------------------------------------------------------------------------------ AC-108 --
-- A pattern version row of the OTHER organization that names the same pattern key sorts into the owner''s list if the
-- owner predicate were missing: it is a draft clone (the only state a raw insert may take), compatible with the
-- owner''s type, and it must never appear.  Note: an ACTIVE foreign version cannot be produced without the foreign
-- organization''s own governed chain (see the lane report, BOUNDARY), so this control cannot isolate the state filter.
create or replace function pg_temp.gp_clone_pattern(p_owner uuid, p_key text) returns uuid language plpgsql as $body$
declare
  source_row platform_private.cms_pattern_versions%rowtype;
  new_id uuid := extensions.gen_random_uuid();
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  select * into source_row from platform_private.cms_pattern_versions
   where pattern_id = (pg_temp.s12pd_body('gp-a')->>'patternId')::uuid order by version limit 1;
  insert into platform_private.cms_pattern_versions
  select (jsonb_populate_record(null::platform_private.cms_pattern_versions, to_jsonb(source_row)
    || jsonb_build_object('id', new_id, 'owner_id', p_owner, 'state', 'draft', 'version', 1, 'pattern_key', p_key,
         'pattern_id', null, 'supersedes_id', null, 'created_at', stamp, 'updated_at', stamp,
         'lifecycle_version', 1, 'activated_at', null, 'retired_at', null))).*;
  return new_id;
end;
$body$;
select pg_temp.gp_clone_pattern(pg_temp.s09d_id('otherOrg'), 's12pl-gp-a');
select pg_temp.gp_clone_pattern(pg_temp.s09d_id('otherOrg'), 's12pl-gp-0');
select pg_temp.gp_sel('sel-own-2', (select id from s12pd_types where ordinal = 1));
select ok(
  (select count(*) = 1 and bool_and(item->>'patternKey' = 's12pl-gp-a')
     from jsonb_array_elements(pg_temp.s12pu_body('sel-own-2')->'items') item
    where item->>'patternKey' like 's12pl-gp-%')
  and (select count(*) = 0 from jsonb_array_elements(pg_temp.s12pu_body('sel-own-2')->'items') item
        where (item->>'patternVersionId')::uuid in (
          select id from platform_private.cms_pattern_versions where owner_id = pg_temp.s09d_id('otherOrg'))),
  'a pattern version row of the other organization is not listed: only the owner''s version of the key appears [P2-S12-AC-108]');

-- ------------------------------------------------------------------------------------------------ AC-173 --
-- cmsPatternLatestRead resolves the key ONLY within the caller's owner scope: a key another owner holds is the same NOT_FOUND
-- as an unused key, and an owner that shares the key reads its own lineage.  The second organization's designer grant is the
-- labelled fixture forgery 01-actors documents for `other` (the repository has no command that grants a CMS capability of a
-- non-initialized organization); `other` exists only as the cross-owner actor.
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, 'cms.template_designer', current_date, current_date + 1, true
  from s09d_actor where key = 'other';
create or replace function pg_temp.gp_latest(p_key text, p_actor text) returns jsonb language sql stable as $body$
  select jsonb_build_object('patternKey', p_key, 'context', pg_temp.s09d_context(p_actor, true)) $body$;
-- 's12pd-type-own' is held by the owner only; 's12pl-gp-a' by both (the other organization's is a draft version row);
-- 's12pl-gp-0' by the other organization only.
select * from pg_temp.s12pd_refused('latest-foreign-key', pg_temp.gp_latest('s12pd-type-own', 'other'),
  'NOT_FOUND', null, 'other', 'service_role', 'latest');
select * from pg_temp.s12pd_refused('latest-unused-key', pg_temp.gp_latest('gap-unused-key', 'other'),
  'NOT_FOUND', null, 'other', 'service_role', 'latest');
select is((select message || coalesce(detail, '') from s12pd_out where label = 'latest-foreign-key'),
  (select message || coalesce(detail, '') from s12pd_out where label = 'latest-unused-key'),
  'a key another owner holds is exactly the outcome of an unused key [P2-S12-AC-173]');
select pg_temp.s12pd_run('latest-shared-other', pg_temp.gp_latest('s12pl-gp-a', 'other'), 'other', 'service_role', 'latest');
select pg_temp.s12pd_run('latest-shared-owner', pg_temp.gp_latest('s12pl-gp-a', 'owner'), 'owner', 'service_role', 'latest');
select ok(pg_temp.s12pd_state('latest-shared-other') = '00000' and pg_temp.s12pd_state('latest-shared-owner') = '00000'
    and pg_temp.s12pd_body('latest-shared-owner')->>'patternId' = pg_temp.s12pd_body('gp-a')->>'patternId'
    and pg_temp.s12pd_body('latest-shared-other')->>'patternId' <> pg_temp.s12pd_body('gp-a')->>'patternId'
    and (select owner_id = pg_temp.s09d_id('otherOrg') from platform_private.cms_pattern_versions
          where id = (pg_temp.s12pd_body('latest-shared-other')->>'id')::uuid)
    and (select owner_id = pg_temp.s09d_id('ownerOrg') from platform_private.cms_pattern_versions
          where id = (pg_temp.s12pd_body('latest-shared-owner')->>'id')::uuid),
  'with a shared key each organization reads its OWN lineage: the owner its active pattern, the other organization its own row [P2-S12-AC-173]');
select * from pg_temp.s12pd_refused('latest-other-only-key', pg_temp.gp_latest('s12pl-gp-0', 'owner'),
  'NOT_FOUND', null, 'owner', 'service_role', 'latest');
select pg_temp.s12pd_run('latest-other-own', pg_temp.gp_latest('s12pl-gp-0', 'other'), 'other', 'service_role', 'latest');
select is(pg_temp.s12pd_state('latest-other-own'), '00000',
  'control: the key held only by the other organization is readable by that organization and hidden from the owner [P2-S12-AC-173]');

select finish();
rollback;
