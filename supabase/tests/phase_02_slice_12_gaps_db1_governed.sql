-- Slice 12 gap lane claude_s12_gaps_db1: governed review clauses no earlier suite proves
-- (docs/handoffs/2026-10-22-claude-s12/gaps/inventory.json).
--   P2-S12-AC-065 clause 1  CMS-03C-06 `subjectId` is the exact version row id in the caller's owner scope (a version row
--                           of another organization and an absent id are concealed; a first version's lineage id IS its row id).
--   P2-S12-AC-066 clause 2  a hidden or absent subject is the concealed NOT_FOUND from the submit RPC; the per-kind
--                           owner capability map (template/pattern -> designer, taxonomy -> curator) is enforced by SQL.
--   P2-S12-AC-072 clause 5  a subject CREATOR who holds a standing reviewer grant is refused the decision (403).
--   P2-S12-AC-084 clause 2  CMS-03C-09: the capability is the SUBJECT KIND's own owner capability.
--   P2-S12-AC-088 clause 2  CMS-03C-10 serves the policyBasis array sorted by label then policy key.
-- Real producers only (CMS-03A-15 grants, CMS-03C-01/-14 definitions, CMS-03C-06/08/07/09); no trigger is disabled
-- and no governed row is inserted by hand.
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

-- The three labelled content types of the AC-088 case are built FIRST, through the real DEC-108 chain: the chain's
-- reviewer acts in its own party, which the governed setup below changes.
create or replace function pg_temp.gg_type(p_tag text, p_key text, p_label text, p_workflow text, p_reviewers text[])
returns void language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':create', 'platform_api.cms_create_type_draft', 'owner', jsonb_build_object(
    'typeKey', p_key, 'label', p_label, 'ownerCapability', 'cms.schema_designer', 'sourceLocale', 'en-US',
    'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
    'workflowKey', p_workflow, 'workflowVersion', '1', 'defaultTemplateVersionId', null,
    'fields', jsonb_build_array(jsonb_build_object(
      'stableFieldId', extensions.gen_random_uuid(), 'key', 'title', 'kind', 'short_text',
      'constraints', '{}'::jsonb, 'required', true, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Title', 'order', 0), 'lifecycle', 'active')),
    'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb,
    'idempotencyKey', pg_temp.s09d_idem(p_tag, 'create')));
  perform pg_temp.s09d_remember(p_tag || ':type', (resource->>'contentTypeId')::uuid);
  perform pg_temp.s09d_remember(p_tag || ':version', (resource->>'id')::uuid);
  perform pg_temp.s09d_to_active(p_tag, p_reviewers);
  insert into s12gov_ids(key, value) values (p_tag, pg_temp.s09d_id(p_tag || ':type')::text);
end;
$body$;
select pg_temp.gg_type('gapa', 'gapatype', 'gap a', 'editorial', array['rev1']);
select pg_temp.gg_type('gapb1', 'gapb1type', 'Gap B', 'cms.disclosure.policy', array['rev1', 'designer2']);
select pg_temp.gg_type('gapb2', 'gapb2type', 'Gap B', 'editorial', array['rev1']);

-- ------------------------------------------------------------------------------------------------ setup --
-- owner: receipt owner and cms.template_designer.  rev1: independent reviewer.  rev2: reviewer AND curator-only (no
-- designer grant).  designer2: reviewer, designer (the creator of the AC-072 subject) and the policy specialist.
create temp table gg_setup(key text primary key, outcome text not null) on commit drop;
insert into gg_setup(key, outcome) values
  ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1)),
  ('rev2:reviewer', pg_temp.s12ga_grant('rev2', 'cms.reviewer', 1)),
  ('rev2:curator', pg_temp.s12ga_grant('rev2', 'cms.taxonomy_curator', 1)),
  ('designer2:reviewer', pg_temp.s12ga_grant('designer2', 'cms.reviewer', 1)),
  ('designer2:designer', pg_temp.s12ga_grant('designer2', 'cms.template_designer', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key in ('rev1', 'rev2', 'rev3');
select ok((select count(*) = 5 and bool_and(outcome = 'OK') from gg_setup),
  'fixture: the five reviewer, curator and designer grants were issued by the real CMS-03A-15 command [P2-S12-AC-066]');
select ok(
  not platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('rev2'), 'cms.template_designer')
  and platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('rev2'), 'cms.taxonomy_curator')
  and platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('owner'), 'cms.template_designer')
  and not platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('owner'), 'cms.taxonomy_curator'),
  'fixture: rev2 is curator-only and the owner is designer-only, so each kind has exactly one valid capability holder [P2-S12-AC-066]');

-- A taxonomy version through the real CMS-03C-14 producer (no declared canonical domain: a submit needs no provider).
create or replace function pg_temp.gg_tax(p_tag text, p_creator text) returns uuid language plpgsql as $body$
declare v_id uuid;
begin
  perform pg_temp.s12ga_rpc('tx-create:' || p_tag, 'platform_api.cms_create_taxonomy_version', p_creator, jsonb_build_object(
    'taxonomyKey', 'gap-tax-' || p_tag, 'shape', 'flat',
    'allowedTypeKeys', jsonb_build_array((select type_key from platform_private.cms_content_types
                                            where id = (select value::uuid from s12gov_ids where key = 'typeA'))),
    'allowedFieldKeys', jsonb_build_array('gapfield'), 'canonicalOverlapDomains', '[]'::jsonb,
    'expectedVersion', null, 'idempotencyKey', 's12ga-gg-tx-' || p_tag));
  v_id := (pg_temp.s12ga_body('tx-create:' || p_tag)->>'id')::uuid;
  if v_id is null then
    raise exception 'gaps fixture: the real taxonomy producer failed for %: %', p_tag, pg_temp.s12ga_out('tx-create:' || p_tag);
  end if;
  insert into s12gov_ids(key, value) values (p_tag || ':subject', v_id::text)
    on conflict (key) do update set value = excluded.value;
  return v_id;
end;
$body$;
create or replace function pg_temp.gg_tax_submit(p_label text, p_tag text, p_submitter text) returns void language plpgsql as $body$
begin
  perform pg_temp.s12ga_rpc(p_label, 'platform_api.cms_submit_governed_review', p_submitter, jsonb_build_object(
    'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject(p_tag),
    'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject(p_tag)),
    'idempotencyKey', 's12ga-' || p_label));
  if pg_temp.s12ga_state(p_label) = '00000' then
    insert into s12gov_ids(key, value) values (p_tag || ':review', pg_temp.s12ga_body(p_label)->>'id')
      on conflict (key) do update set value = excluded.value;
  end if;
end;
$body$;

-- The store image a refusal must leave identical: the subject row (any kind), its reviews, the CMS-03C-06 and
-- CMS-03C-09 reservations, and the append-only audit and outbox sizes.
create or replace function pg_temp.gg_snap(p_kind text, p_subject uuid) returns text language sql stable as $body$
  select jsonb_build_object(
    'subject', case p_kind
      when 'taxonomy_version' then (select to_jsonb(t)::text from platform_private.cms_taxonomy_versions t where t.id = p_subject)
      else (select to_jsonb(t)::text from platform_private.cms_template_versions t where t.id = p_subject) end,
    'reviews', (select coalesce(string_agg(to_jsonb(r)::text, '|' order by r.id), '')
                  from platform_private.cms_governed_reviews r where r.subject_id = p_subject),
    'idempotency', (select md5(coalesce(string_agg(to_jsonb(i)::text, '|' order by i.id), ''))
                      from platform_private.idempotency_records i),
    'audit', (select count(*) from audit_private.audit_events),
    'outbox', (select count(*) from platform_private.outbox_events))::text
$body$;
create temp table gg_snaps(label text primary key, snapshot text not null) on commit drop;
create or replace function pg_temp.gg_mark(p_label text, p_kind text, p_subject uuid) returns void language sql as $body$
  insert into gg_snaps values (p_label, pg_temp.gg_snap(p_kind, p_subject))
  on conflict (label) do update set snapshot = excluded.snapshot $body$;
create or replace function pg_temp.gg_same(p_label text, p_kind text, p_subject uuid) returns boolean language sql stable as $body$
  select pg_temp.gg_snap(p_kind, p_subject) = (select snapshot from gg_snaps where label = p_label) $body$;

-- ----------------------------------------------------------------------- AC-065/066: the submit subject id --
select pg_temp.s12ga_mint('sa', 'owner', array['typeA']);
-- A first version is its own lineage (the lineage id of a first version IS its row id), so a lineage id and an exact
-- version row id can differ only for a successor; the cases below are the ones that can be separated: another
-- organization's row and an absent id.
select ok(
  (select version_row.state = 'draft' and version_row.template_id = version_row.id
     from platform_private.cms_template_versions version_row where version_row.id = pg_temp.s12ga_subject('sa')),
  'control: the minted subject is a draft first version whose lineage id is its own row id [P2-S12-AC-065]');
select pg_temp.gg_mark('sa', 'template_version', pg_temp.s12ga_subject('sa'));

create or replace function pg_temp.gg_submit_raw(p_label text, p_actor text, p_subject uuid, p_hash text) returns void language sql as $body$
  select pg_temp.s12ga_rpc(p_label, 'platform_api.cms_submit_governed_review', p_actor, jsonb_build_object(
    'subjectKind', 'template_version', 'subjectId', p_subject, 'subjectHash', p_hash, 'idempotencyKey', 's12ga-' || p_label))
$body$;
select pg_temp.gg_submit_raw('sb-absent', 'owner', 'a9121000-0000-4000-8000-0000000000e1'::uuid, repeat('a', 64));
select pg_temp.gg_submit_raw('sb-other-org', 'other', pg_temp.s12ga_subject('sa'),
  (select content_hash::text from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('sa')));
select is(
  (select string_agg(l || '=' || pg_temp.s12ga_out(l), ';' order by l collate "C")
     from unnest(array['sb-absent', 'sb-other-org']) l),
  'sb-absent=P0001:NOT_FOUND;sb-other-org=P0001:NOT_FOUND',
  'an absent id and a version row of another organization meet the same concealed NOT_FOUND [P2-S12-AC-066]');
select ok(pg_temp.gg_same('sa', 'template_version', pg_temp.s12ga_subject('sa'))
    and (select count(*) = 0 from platform_private.cms_governed_reviews where subject_id = pg_temp.s12ga_subject('sa'))
    and (select count(*) = 0 from platform_private.idempotency_records
          where operation = 'CMS-03C-06' and key_hash in (select platform_private.cms_key_hash('s12ga-' || l)
            from unnest(array['sb-absent', 'sb-other-org']) l)),
  'the two concealed refusals leave the subject, reviews, reservations, audit and outbox unchanged [P2-S12-AC-065]');
select ok(
  (select count(distinct detail) <= 1 from s12ga_rcpt where label in ('sb-absent', 'sb-other-org')),
  'the concealed refusals carry the same DETAIL (none), so nothing distinguishes hidden from absent [P2-S12-AC-066]');

-- ------------------------------------------------------------- AC-066: the per-kind owner capability map --
select is(
  (select string_agg(kind || '=' || platform_private.cms_governed_owner_capability(kind), ';' order by kind)
     from unnest(array['template_version', 'pattern_version', 'taxonomy_version']) kind),
  'pattern_version=cms.template_designer;taxonomy_version=cms.taxonomy_curator;template_version=cms.template_designer',
  'the owner capability of a subject kind is cms.template_designer for a template or pattern version and cms.taxonomy_curator for a taxonomy version [P2-S12-AC-066]');
-- a template version submitted by a curator-only holder
select pg_temp.gg_submit_raw('sc-curator-on-template', 'rev2', pg_temp.s12ga_subject('sa'),
  (select content_hash::text from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('sa')));
select is(pg_temp.s12ga_out('sc-curator-on-template'), 'P0001:capability_missing',
  'a taxonomy curator without the designer capability is refused 403 capability_missing on a template version [P2-S12-AC-066]');
select ok(pg_temp.gg_same('sa', 'template_version', pg_temp.s12ga_subject('sa')),
  'that capability refusal changes nothing [P2-S12-AC-066]');
-- a taxonomy version submitted by a designer-only holder
select pg_temp.gg_tax('ta', 'rev2');
select pg_temp.gg_mark('ta', 'taxonomy_version', pg_temp.s12ga_subject('ta'));
select pg_temp.gg_tax_submit('sd-designer-on-taxonomy', 'ta', 'owner');
select is(pg_temp.s12ga_out('sd-designer-on-taxonomy'), 'P0001:capability_missing',
  'a template designer without the curator capability is refused 403 capability_missing on a taxonomy version [P2-S12-AC-066]');
select ok(pg_temp.gg_same('ta', 'taxonomy_version', pg_temp.s12ga_subject('ta')),
  'the taxonomy capability refusal changes nothing [P2-S12-AC-066]');
-- controls: each kind accepts its own capability holder
select pg_temp.gg_tax_submit('se-curator-on-taxonomy', 'ta', 'rev2');
select pg_temp.s12ga_submit('sa', 'owner');
select ok(pg_temp.s12ga_out('se-curator-on-taxonomy') = 'ok' and pg_temp.s12ga_out('submit:sa') = 'ok',
  'controls: the curator submits the taxonomy version and the designer submits the template version [P2-S12-AC-066]');

-- ---------------------------------------------------------------- AC-072: the subject creator is refused --
-- designer2 CREATES the template and holds a standing cms.reviewer grant; the owner submits it, so creator and
-- submitter are two different people (the decision suite makes the owner both).
select pg_temp.s12ga_open('cr', 'designer2', array['typeA'], 'owner');
select ok(
  (select review.submitted_by = pg_temp.s12ga_person('owner')
      and subject.created_by = pg_temp.s12ga_auth('designer2')
      and review.submitted_by is distinct from pg_temp.s12ga_person('designer2')
     from platform_private.cms_governed_reviews review
     join platform_private.cms_template_versions subject on subject.id = review.subject_id
    where review.id = pg_temp.s12ga_review('cr')),
  'control: the owner submitted a template that designer2 created, so the creator is not the submitter [P2-S12-AC-072]');
select pg_temp.s12ga_mark('cr:gates', pg_temp.s12ga_review('cr'));
select pg_temp.s12ga_assign('cr-assign-creator', 'owner', pg_temp.s12ga_review('cr'), 'designer2', interval '1 hour');
select is(pg_temp.s12ga_out('cr-assign-creator'), 'P0001:reviewer_not_eligible',
  'the creator cannot be assigned: reviewer_not_eligible even with a standing cms.reviewer grant [P2-S12-AC-072]');
select pg_temp.s12ga_decide('cr-decide-creator', 'designer2', pg_temp.s12ga_review('cr'), 'approve');
select is(pg_temp.s12ga_out('cr-decide-creator'), 'P0001:capability_missing',
  'the subject creator holding the standing reviewer grant is refused the decision with the 403 capability_missing [P2-S12-AC-072]');
select ok(pg_temp.s12ga_same('cr:gates', pg_temp.s12ga_review('cr'))
    and (select count(*) = 0 from platform_private.cms_governed_review_decisions where review_id = pg_temp.s12ga_review('cr')),
  'the creator refusals write no assignment, decision, reservation, audit or outbox row [P2-S12-AC-072]');
select pg_temp.s12ga_assign('cr-assign-rev1', 'owner', pg_temp.s12ga_review('cr'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('cr-decide-rev1', 'rev1', pg_temp.s12ga_review('cr'), 'approve');
select ok(pg_temp.s12ga_out('cr-assign-rev1') = 'ok' and pg_temp.s12ga_out('cr-decide-rev1') = 'ok'
    and (select state from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('cr')) = 'approved',
  'control: an independent assigned reviewer approves the same review, so the creator refusal was identity-specific [P2-S12-AC-072]');

-- ------------------------------------------------------------ AC-084: activation needs the kind''s capability --
-- Two approved template reviews (rev2 is assigned on the second) and one approved taxonomy review.
select pg_temp.s12ga_open('b1', 'owner', array['typeA'], 'owner');
select pg_temp.s12ga_assign('as-b1', 'owner', pg_temp.s12ga_review('b1'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('ap-b1', 'rev1', pg_temp.s12ga_review('b1'), 'approve');
select pg_temp.s12ga_open('b2', 'owner', array['typeA'], 'owner');
select pg_temp.s12ga_assign('as-b2-rev2', 'owner', pg_temp.s12ga_review('b2'), 'rev2', interval '20 hours');
select pg_temp.s12ga_assign('as-b2-rev1', 'owner', pg_temp.s12ga_review('b2'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('ap-b2', 'rev1', pg_temp.s12ga_review('b2'), 'approve');
-- Assigning on a taxonomy review needs the kind's own capability, so the owner receives the curator grant now (after
-- the designer-only submit refusal above).  designer2 (designer + reviewer, no curator) is the visible-but-incapable holder.
select pg_temp.s12ga_grant('owner', 'cms.taxonomy_curator', 1);
select pg_temp.s12gb_act('act-designer2-unassigned', 'designer2', pg_temp.s12ga_review('ta'), 'activate');
select pg_temp.s12ga_assign('as-ta-d2', 'owner', pg_temp.s12ga_review('ta'), 'designer2', interval '20 hours');
select pg_temp.s12ga_assign('as-ta', 'owner', pg_temp.s12ga_review('ta'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('ap-ta', 'rev1', pg_temp.s12ga_review('ta'), 'approve');
select ok(
  (select count(*) = 3 and bool_and(state = 'approved') from platform_private.cms_governed_reviews
    where id in (pg_temp.s12ga_review('b1'), pg_temp.s12ga_review('b2'), pg_temp.s12ga_review('ta'))),
  'fixture: two template reviews and one taxonomy review are approved through the real producers [P2-S12-AC-084]');

select pg_temp.gg_mark('b1', 'template_version', pg_temp.s12ga_subject('b1'));
select pg_temp.gg_mark('b2', 'template_version', pg_temp.s12ga_subject('b2'));
select pg_temp.gg_mark('ta2', 'taxonomy_version', pg_temp.s12ga_subject('ta'));
select pg_temp.s12gb_act('act-curator-unassigned', 'rev2', pg_temp.s12ga_review('b1'), 'activate');
select pg_temp.s12gb_act('act-curator-assigned', 'rev2', pg_temp.s12ga_review('b2'), 'activate');
select pg_temp.s12gb_act('act-designer2-on-taxonomy', 'designer2', pg_temp.s12ga_review('ta'), 'activate');
select is(
  (select string_agg(l || '=' || pg_temp.s12ga_out(l), ';' order by l collate "C")
     from unnest(array['act-curator-unassigned', 'act-curator-assigned', 'act-designer2-unassigned', 'act-designer2-on-taxonomy']) l),
  'act-curator-assigned=P0001:capability_missing;act-curator-unassigned=P0001:NOT_FOUND;'
    || 'act-designer2-on-taxonomy=P0001:capability_missing;act-designer2-unassigned=P0001:NOT_FOUND',
  'a curator is refused on a template review (hidden 404 when unassigned, 403 when assigned) and a designer is refused on a taxonomy review the same way: the capability is the subject kind''s own [P2-S12-AC-084]');
select ok(pg_temp.gg_same('b1', 'template_version', pg_temp.s12ga_subject('b1'))
    and pg_temp.gg_same('b2', 'template_version', pg_temp.s12ga_subject('b2'))
    and pg_temp.gg_same('ta2', 'taxonomy_version', pg_temp.s12ga_subject('ta')),
  'the wrong-kind capability refusals leave subjects, reviews, reservations, audit and outbox unchanged [P2-S12-AC-084]');
select pg_temp.s12gb_act('act-designer-on-template', 'owner', pg_temp.s12ga_review('b2'), 'activate');
select pg_temp.s12gb_act('act-curator-on-taxonomy', 'rev2', pg_temp.s12ga_review('ta'), 'activate');
select ok(pg_temp.s12ga_out('act-designer-on-template') = 'ok' and pg_temp.s12ga_out('act-curator-on-taxonomy') = 'ok'
    and (select state from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('b2')) = 'active'
    and (select state from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('ta')) = 'active',
  'controls: the designer activates the template review and the curator activates the taxonomy review [P2-S12-AC-084]');

-- ------------------------------------------------------------ AC-088: the served policyBasis order --
-- Three real types: label 'gap a' (lower case, editorial), 'Gap B' (protected disclosure policy) and 'Gap B' (editorial).
-- The reader sorts by label then policy key, both in C collation: 'Gap B' < 'gap a', and within the shared label
-- cms.disclosure.policy < editorial.  Neither the creation order nor a locale collation produces that order.
select diag('type chain failures: ' || coalesce((select string_agg(label || '=' || state || ':' || coalesce(message,''), ', ' order by label)
  from s09d_probe where label like 'gap%' and state <> '00000'), 'none'));
select ok(
  (select count(*) = 3 and bool_and(c.state = 'active' and v.state = 'active')
     from platform_private.cms_content_types c
     join platform_private.cms_content_type_versions v on v.content_type_id = c.id
    where c.id in (pg_temp.s09d_id('gapa:type'), pg_temp.s09d_id('gapb1:type'), pg_temp.s09d_id('gapb2:type'))),
  'fixture: the three labelled content types are active through the real DEC-108 chain [P2-S12-AC-088]');
select pg_temp.s12ga_open('pb', 'owner', array['gapa', 'gapb1', 'gapb2'], 'owner');
select pg_temp.s12ga_get('pb-get', 'owner', pg_temp.s12ga_review('pb'));
select is(pg_temp.s12ga_out('pb-get'), 'ok', 'control: the receipt owner reads the three-member review detail [P2-S12-AC-088]');
select is(
  (select jsonb_agg(jsonb_build_array(element->>'contentTypeLabel', element->>'policyKey') order by ord)
     from jsonb_array_elements(pg_temp.s12ga_body('pb-get')->'policyBasis') with ordinality e(element, ord)),
  '[["Gap B","cms.disclosure.policy"],["Gap B","editorial"],["gap a","editorial"]]'::jsonb,
  'the served policyBasis is ordered by contentTypeLabel then policyKey (C collation), not by creation order or policy key alone [P2-S12-AC-088]');

select finish();
rollback;
