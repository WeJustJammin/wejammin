-- Slice 12 gap lane claude_s12_db9b, item 2 (taxonomy half): P2-S12-AC-190 clause 2 "selectors" for the taxonomy selector (CMS-03C-17,
-- platform_api.cms_list_taxonomy_selector).  The FOREIGN rows are ACTIVE vocabularies of the first organization with ACTIVE terms, produced by the REAL
-- path (CMS-03C-16 create, 06 submit, 08 assign, 07 approve, 09 activate; CMS-03C-03 term actions).  Their allowlists name the type KEY and field key
-- the second organization's author asks for, so the reader's owner predicate is ISOLATED: the only reason the second organization's page is empty is the
-- owner scope.  (The pattern selector cannot isolate it: phase_02_slice_12_gaps_db9b_pattern_selector_foreign.sql.)
--
-- BOUNDARY (why the caller, not the foreign row, is the second organization): an ACTIVE vocabulary of the second organization cannot be produced by the
-- real path.  CMS-03C-08 (assign) requires the `owner` scope of the review, which platform_private.cms_governed_review_scopes grants only to the holder of
-- a platform_private.cms_owner_initialization receipt of the review's organization (20261013300500_cms_governed_review_support.sql:92-99); the receipt is
-- issued once and a second initialization is refused (20260910023405_isolate_owner_bootstrap_context.sql:39-41, BOOTSTRAP_ALREADY_INITIALIZED).  The
-- test proves the gate on the second organization's real draft vocabulary `vo`: its submit succeeds and its assign is refused capability_missing.  No
-- receipt is forged.
--
-- LABELLED FIXTURE: `other` holds cms.author in the second organization (an organization_actor_grant row; the repository has no command that grants a
-- CMS capability of a non-initialized organization, and 010-setup forges its curator grant the same way).  The control before the grant is the refusal.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms/010-setup.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_terms_reads/010-fixtures.sqlinc

-- This key exists only inside the rolled-back pgTAP transaction; it is never an operational signing value.
select vault.create_secret(repeat('b2', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only gap lane test key');

-- ------------------------------------------------------------------------------------------------ the world --
select ok((select count(*) >= 3 and bool_and(owner_id = pg_temp.s09d_id('ownerOrg') and allowlisted_type_keys ? 's12govordinary' and allowlisted_field_keys ? 'title')
           from platform_private.cms_taxonomy_versions where state = 'active' and taxonomy_key in ('s12tt-vf', 's12tt-vh', 's12tt-vr', 's12tt-vs')),
  'fixture: the first organization has real ACTIVE vocabularies whose allowlists name the type key s12govordinary and the field key title [P2-S12-AC-190]');
select ok((select count(*) >= 10 from platform_private.cms_terms term
            join platform_private.cms_taxonomy_versions v on v.taxonomy_id = term.taxonomy_id and v.state = 'active' and v.owner_id = pg_temp.s09d_id('ownerOrg')
           where term.lifecycle = 'active' and v.allowlisted_type_keys ? 's12govordinary' and v.allowlisted_field_keys ? 'title'),
  'fixture: those vocabularies hold at least ten ACTIVE terms (real CMS-03C-03 actions) [P2-S12-AC-190]');
select ok(exists (select 1 from platform_private.cms_taxonomy_versions v where v.taxonomy_id = pg_temp.s12tt_lineage('vo')
                   and v.owner_id = pg_temp.s09d_id('otherOrg') and v.state = 'draft'
                   and v.allowlisted_type_keys ? 's12govordinary' and v.allowlisted_field_keys ? 'title'),
  'fixture: the second organization''s real vocabulary `vo` is a DRAFT whose allowlists name the very same type key and field key [P2-S12-AC-190]');

-- ------------------------------------------------------ the gate that makes an ACTIVE second-organization row unproducible --
select pg_temp.s12ga_rpc('vo-submit', 'platform_api.cms_submit_governed_review', 'other', jsonb_build_object(
  'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject('vo'),
  'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('vo')),
  'idempotencyKey', 'd9t-vo-submit'));
select is(pg_temp.s12ga_out('vo-submit'), 'ok', 'the second organization''s curator submits its vocabulary through CMS-03C-06 [P2-S12-AC-190]');
select pg_temp.s12ga_assign('vo-assign', 'other', (pg_temp.s12ga_body('vo-submit')->>'id')::uuid, 'rev1', interval '20 hours');
select is(pg_temp.s12ga_out('vo-assign'), 'P0001:capability_missing',
  'BOUNDARY fact: the second organization''s curator cannot assign a reviewer: the owner scope needs a cms_owner_initialization receipt of that organization [P2-S12-AC-190]');
select ok(not exists (select 1 from platform_private.cms_owner_initialization where organization_id = pg_temp.s09d_id('otherOrg'))
    and exists (select 1 from platform_private.cms_owner_initialization where organization_id = pg_temp.s09d_id('ownerOrg')),
  'BOUNDARY fact: only the first organization holds an owner-initialization receipt [P2-S12-AC-190]');

-- ------------------------------------------------------------------------------------------------------ the reads --
select pg_temp.s12tr_sel('a-sel', 'rev2');
select ok(pg_temp.s12tt_oc('a-sel') = 'ok' and jsonb_array_length(pg_temp.s12ga_body('a-sel')->'items') >= 10
    and pg_temp.s12ga_body('a-sel')->'items' = pg_temp.s12tr_selector_oracle('s12govordinary', 'title', 'en-US'),
  'positive control: the first organization''s author lists the active terms of its active vocabularies, equal to the independent oracle (non-empty) [P2-S12-AC-190]');

-- before the grant: the second organization's curator is no author
select pg_temp.s12tr_sel('b-sel-ungranted', 'other');
select is(pg_temp.s12tt_oc('b-sel-ungranted'), 'P0001:capability_missing',
  'control: a curator of the second organization without cms.author or cms.editor is 403 capability_missing, so the grant below is what opens the read [P2-S12-AC-190]');
-- FIXTURE FORGERY (labelled above): the second organization's author grant
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('otherOrg'), person_id, 'cms.author', current_date, current_date + 1, true from s09d_actor where key = 'other';
select ok(platform_private.cms_person_holds_capability(pg_temp.s09d_id('otherOrg'), pg_temp.s12ga_person('other'), 'cms.author')
    and not platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('other'), 'cms.author'),
  'fixture: `other` holds cms.author in the second organization only [P2-S12-AC-190]');

select pg_temp.s12tr_sel('b-sel', 'other');
select is(pg_temp.s12tt_oc('b-sel'), 'ok', 'a verified author of the second organization reads the selector [P2-S12-AC-190]');
select ok(pg_temp.s12ga_body('b-sel') = jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'pageVersion', '1'),
  'the second organization''s page is EMPTY, pageVersion "1": the first organization''s ACTIVE vocabularies and terms, whose allowlists name the requested type and field, are never listed to another owner [P2-S12-AC-190]');
select ok(jsonb_array_length(pg_temp.s12ga_body('a-sel')->'items') >= 10 and jsonb_array_length(pg_temp.s12ga_body('b-sel')->'items') = 0
    and pg_temp.s12ga_body('a-sel')->>'pageVersion' <> pg_temp.s12ga_body('b-sel')->>'pageVersion',
  'the same query (type s12govordinary, field title, locale en-US) answers a non-empty page to the first organization and an empty one to the second: the owner predicate is the sole difference [P2-S12-AC-190]');
select ok(not exists (select 1 from jsonb_array_elements(pg_temp.s12ga_body('b-sel')->'items') item
                       where (item->>'taxonomyId')::uuid in (select taxonomy_id from platform_private.cms_taxonomy_versions where owner_id = pg_temp.s09d_id('ownerOrg'))),
  'no vocabulary lineage of the first organization appears in the second organization''s page [P2-S12-AC-190]');
-- the second organization's own draft vocabulary (same keys) is not listed either: the state filter holds beside the owner filter
select ok(not exists (select 1 from jsonb_array_elements(pg_temp.s12ga_body('b-sel')->'items') item
                       where (item->>'taxonomyId')::uuid = pg_temp.s12tt_lineage('vo')),
  'the second organization''s own DRAFT vocabulary is not listed either (only an active vocabulary is) [P2-S12-AC-190]');

-- the list follows the data of its own owner: a new active term of the first organization moves its page and nothing of the second organization's
select pg_temp.s12tt_act('d9t-new-term', 'owner', pg_temp.s12tt_lineage('vf'), 'create', 'd9t-new', '{"labels":[{"locale":"en-US","label":"D9T New"}]}'::jsonb);
select pg_temp.s12tr_sel('a-sel-2', 'rev2');
select pg_temp.s12tr_sel('b-sel-2', 'other');
select ok(pg_temp.s12tt_oc('d9t-new-term') = 'ok' and pg_temp.s12tr_sel_keys(pg_temp.s12ga_body('a-sel-2')) @> array['s12tt-vf/d9t-new']
    and jsonb_array_length(pg_temp.s12ga_body('a-sel-2')->'items') = jsonb_array_length(pg_temp.s12ga_body('a-sel')->'items') + 1,
  'control: a new active term of the first organization appears in the first organization''s page [P2-S12-AC-190]');
select is(pg_temp.s12ga_body('b-sel-2'), pg_temp.s12ga_body('b-sel'),
  'the second organization''s page is byte-identical after the first organization''s change: same (empty) items, same pageVersion [P2-S12-AC-190]');

-- concealment of the page by no-effect: a read writes nothing
select pg_temp.s12tt_mark('d9t-before-read');
select pg_temp.s12tr_sel('b-sel-3', 'other');
select ok(pg_temp.s12tt_same('d9t-before-read'), 'the second organization''s read changed no store: no term, vocabulary, assignment, idempotency, audit, outbox or job row [P2-S12-AC-190]');

select finish();
rollback;
