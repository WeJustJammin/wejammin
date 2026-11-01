-- Slice 11, independent SQL review finding 4: the accessibility checker input must carry the rich text of
-- DEC-133 object properties and follow ONE canonical render order (BE05c "Document order", BE03b preflight
-- category 11).  platform_private.cms_revision_render_plan is that single derivation: the load builds its nodes
-- and its renderPlanHash from the plan rows and from nothing else.  Stable location identity of a node:
--   a whole rich_text value      { kind: field, fieldId }
--   a rich_text object property  { kind: field, fieldId, propertyKey }
--   a composition instance       { kind: block, pointer, blockKey, blockVersion }
-- Order: the revision's fields by editor position (editorConfig.order, then field key, then stable id) with an
-- object field's properties in the order its structure DECLARES them, then composition instances by template slot,
-- path and id.  RED before the 20261005017910 plan function; apps/worker/.../render-plan.test.ts pins the same hash.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select * from no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table rp_snap(label text primary key, effects text not null) on commit drop;

create or replace function pg_temp.rp_call(p_label text, p_tag text)
returns void language sql as $body$
  select pg_temp.r11r_call(p_label, 'cms_load_quality_gate_input', 'owner',
    jsonb_build_object('phase', 'submit', 'entryId', pg_temp.h11w_uuid(p_tag || ':entry'), 'context', pg_temp.r11_ctx()))
$body$;
-- 'fieldId' or 'fieldId#propertyKey' (or the pointer of a block) of every node, in node order
create or replace function pg_temp.rp_nodes(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg(
    case node->>'kind' when 'field' then node->>'fieldId' || coalesce('#' || (node->>'propertyKey'), '')
                       else node->>'pointer' end, ',' order by ordinality), '')
    from jsonb_array_elements(pg_temp.r11_resp(p_label)->'nodes') with ordinality n(node, ordinality)
$body$;
-- the plan of a tag's revision as one jsonb array of identities in plan order (an error is kept, not raised)
create or replace function pg_temp.rp_plan(p_label text, p_tag text)
returns void language sql as $body$
  select pg_temp.r11_try(p_label, format(
    'select coalesce(jsonb_agg(plan.identity order by plan.plan_position), %L::jsonb) from platform_private.cms_revision_render_plan(%L::uuid) plan',
    '[]', pg_temp.h11w_uuid(p_tag || ':revision')))
$body$;
create or replace function pg_temp.rp_doc(p_head jsonb, p_tail text default null)
returns jsonb language sql immutable as $body$
  select jsonb_build_object('format', 'rich_text.v1', 'blocks',
    p_head || case when p_tail is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object('text', p_tail, 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'https://example.org/guide'))))) end)
$body$;
create or replace function pg_temp.rp_heading(p_level integer, p_text text)
returns jsonb language sql immutable as $body$
  select jsonb_build_array(jsonb_build_object('type', 'heading', 'level', p_level,
    'spans', jsonb_build_array(jsonb_build_object('text', p_text, 'marks', '[]'::jsonb))))
$body$;

-- The world's object field `meta` becomes the DEC-133 object this suite needs: DECLARED order note, label, lead
-- (two rich_text properties around a scalar), editor position 1, ahead of body (3) although `body` sorts first by key.
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions', $q$
  update platform_private.cms_field_definition_versions
     set constraints = '{"objectStructure":{"properties":[{"key":"note","kind":"rich_text","required":false,"constraints":{}},{"key":"label","kind":"scalar","required":false,"constraints":{}},{"key":"lead","kind":"rich_text","required":false,"constraints":{}}]}}'::jsonb,
         editor_config = jsonb_set(editor_config, '{order}', '1'::jsonb)
   where field_key = 'meta' $q$);

select pg_temp.r11_entry(tag) from (values ('rp-1'), ('rp-2'), ('rp-tpl')) as t(tag);
-- rp-1 and rp-tpl: meta holds note (h2 + a generic link), label and lead (h3); body gets an h2.
select pg_temp.h11w_value(pg_temp.h11w_uuid(tag || ':revision'), 'meta', jsonb_build_object(
  'lead', pg_temp.rp_doc(pg_temp.rp_heading(3, 'Lead')),
  'label', 'Hero',
  'note', pg_temp.rp_doc(pg_temp.rp_heading(2, 'Note'), 'click here')))
  from (values ('rp-1'), ('rp-tpl')) as t(tag);
-- the same revisions also carry a German value of meta: another locale is never part of the plan
select pg_temp.h11w_value(pg_temp.h11w_uuid('rp-1:revision'), 'meta', jsonb_build_object(
  'note', pg_temp.rp_doc(pg_temp.rp_heading(4, 'Notiz'))), 'de');
select pg_temp.h11_raw_exec('platform_private.cms_entry_field_values', format(
  $q$update platform_private.cms_entry_field_values set value = %L::jsonb where revision_id = %L and field_id = %L and locale = 'en-US'$q$,
  pg_temp.rp_doc(pg_temp.rp_heading(2, 'Body'))::text, pg_temp.h11w_uuid(tag || ':revision'), pg_temp.h11w_fid('body')))
  from (values ('rp-1'), ('rp-tpl')) as t(tag);
-- rp-2: an object whose rich_text properties are all absent
select pg_temp.h11w_value(pg_temp.h11w_uuid('rp-2:revision'), 'meta', jsonb_build_object('label', 'Only a scalar'));
-- rp-tpl: a template with one slot and two live blocks (path order differs from creation order)
select pg_temp.h11_raw_exec('platform_private.cms_entry_revisions',
  format($$update platform_private.cms_entry_revisions set template_version_id = 'a9200000-0000-4000-8000-0000000d0001' where id = %L$$, pg_temp.h11w_uuid('rp-tpl:revision')));
select pg_temp.h11m_instance('rp-i1', pg_temp.h11w_uuid('rp-tpl:revision'), '/b/2', 'h11.first');
select pg_temp.h11m_instance('rp-i2', pg_temp.h11w_uuid('rp-tpl:revision'), '/b/1', 'h11.second');
select pg_temp.r11_manifest(pg_temp.h11w_uuid(tag || ':revision')) from (values ('rp-1'), ('rp-2'), ('rp-tpl')) as t(tag);

select ok(
  (select array(select k from jsonb_object_keys(value) k) = array['lead', 'note', 'label']
     from platform_private.cms_entry_field_values
    where revision_id = pg_temp.h11w_uuid('rp-1:revision') and field_id = pg_temp.h11w_fid('meta') and locale = 'en-US'),
  'fixture: the stored key order of the object value (lead, note, label) differs from the order its structure declares (note, label, lead)');

-- ---------------------------------------------------------------------------
-- The load: nested properties are nodes, in plan order.
-- ---------------------------------------------------------------------------
select pg_temp.rp_call('rp1', 'rp-1');
select is(pg_temp.r11_out('rp1'), '00000:', 'an object field with rich text loads for the submit phase [P2-S11-AC-101]');
select is(pg_temp.rp_nodes('rp1'),
  pg_temp.h11w_fid('meta')::text || '#note,' || pg_temp.h11w_fid('meta')::text || '#lead,' || pg_temp.h11w_fid('body')::text,
  'the nodes are meta#note, meta#lead, body: object properties in DECLARED order at the field''s editor position (1), ahead of body (3) although body sorts first by key and meta is stored lead-first [P2-S11-AC-100] [P2-S11-AC-101]');
select ok(
  (select node from jsonb_array_elements(pg_temp.r11_resp('rp1')->'nodes') node where node->>'propertyKey' = 'note')
    = jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('meta')::text, 'propertyKey', 'note', 'fieldKind', 'rich_text',
        'value', pg_temp.rp_doc(pg_temp.rp_heading(2, 'Note'), 'click here')),
  'a property node is exactly { kind, fieldId, propertyKey, fieldKind rich_text, value } with the stored rich_text.v1 of that property verbatim: its heading and its link reach the checker [P2-S11-AC-101]');
select ok(
  (select node from jsonb_array_elements(pg_temp.r11_resp('rp1')->'nodes') node where node->>'fieldId' = pg_temp.h11w_fid('body')::text)
    = jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('body')::text, 'fieldKind', 'rich_text',
        'value', pg_temp.rp_doc(pg_temp.rp_heading(2, 'Body'))),
  'a whole rich_text value keeps its four-member node shape (no propertyKey) [P2-S11-AC-101]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.r11_resp('rp1')->'nodes') node where node::text like '%Hero%' or node::text like '%Notiz%'), 0,
  'a scalar property and another locale''s value are never nodes [P2-S11-AC-101]');
-- PARITY FIXTURE: the nodes and the render-plan hash the load answers for rp-1.  apps/worker/src/cms-editorial/
-- a11y-structural/sql-parity.test.ts parses this literal, schema-validates it, recomputes the hash in TypeScript and
-- runs the checker over it, so the database output and the Worker input cannot drift apart.
select is(
  jsonb_build_object('renderPlanHash', pg_temp.r11_resp('rp1')->>'renderPlanHash', 'nodes', pg_temp.r11_resp('rp1')->'nodes'),
  $j$
  {
    "renderPlanHash": "f3d272796d1aaf02f85371c23a5634981a561eb261768ed347270258d7728809",
    "nodes": [
      {"kind": "field", "fieldId": "a9200000-0000-4000-8000-000000000c35", "propertyKey": "note", "fieldKind": "rich_text",
       "value": {"format": "rich_text.v1", "blocks": [
         {"type": "heading", "level": 2, "spans": [{"text": "Note", "marks": []}]},
         {"type": "paragraph", "spans": [{"text": "click here", "marks": [], "link": {"kind": "https", "href": "https://example.org/guide"}}]}]}},
      {"kind": "field", "fieldId": "a9200000-0000-4000-8000-000000000c35", "propertyKey": "lead", "fieldKind": "rich_text",
       "value": {"format": "rich_text.v1", "blocks": [{"type": "heading", "level": 3, "spans": [{"text": "Lead", "marks": []}]}]}},
      {"kind": "field", "fieldId": "a9200000-0000-4000-8000-000000000c34", "fieldKind": "rich_text",
       "value": {"format": "rich_text.v1", "blocks": [{"type": "heading", "level": 2, "spans": [{"text": "Body", "marks": []}]}]}}
    ]
  }
  $j$::jsonb,
  'the whole document of the object-field revision is the checked-in parity fixture: nodes with their identities and payloads, and the render-plan hash [P2-S11-AC-100] [P2-S11-AC-101]');
select pg_temp.rp_call('rp1-again', 'rp-1');
select ok(pg_temp.r11_resp('rp1-again') = pg_temp.r11_resp('rp1'), 'loading twice answers the identical document [P2-S11-AC-101]');
select pg_temp.rp_call('rp2', 'rp-2');
select is(pg_temp.rp_nodes('rp2'), pg_temp.h11w_fid('body')::text,
  'an object field without any rich_text property value adds no node [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- The one render-plan derivation.
-- ---------------------------------------------------------------------------
select ok(pg_temp.h11_private_definer('cms_revision_render_plan(uuid)'),
  'cms_revision_render_plan is a private SECURITY DEFINER nobody (not even service_role) can execute [P2-S11-AC-101]');
select pg_temp.s10_rpc_clear_actor();
select pg_temp.rp_plan('plan1', 'rp-1');
select is(pg_temp.r11_resp('plan1'), jsonb_build_array(
    jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('meta')::text, 'propertyKey', 'note'),
    jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('meta')::text, 'propertyKey', 'lead'),
    jsonb_build_object('kind', 'field', 'fieldId', pg_temp.h11w_fid('body')::text)),
  'the plan rows are the stable location identities in render order [P2-S11-AC-100]');
select is((select jsonb_agg(node - 'fieldKind' - 'value' order by ordinality) from jsonb_array_elements(pg_temp.r11_resp('rp1')->'nodes') with ordinality n(node, ordinality)),
  pg_temp.r11_resp('plan1'),
  'every node is its plan identity plus its payload: the load adds no order and no identity of its own [P2-S11-AC-100]');
select is(pg_temp.r11_resp('rp1')->>'renderPlanHash', 'f3d272796d1aaf02f85371c23a5634981a561eb261768ed347270258d7728809',
  'renderPlanHash is the independent vector sha256 of {"nodes":[meta#note,meta#lead,body],"templateVersionId":null}: the value the Worker render-plan test pins [P2-S11-AC-100]');
select ok(
  pg_temp.r11_resp('rp1')->>'renderPlanHash' = pg_temp.h11_sha256(
    '{"nodes":[{"fieldId":"' || pg_temp.h11w_fid('meta') || '","kind":"field","propertyKey":"note"},{"fieldId":"' || pg_temp.h11w_fid('meta')
    || '","kind":"field","propertyKey":"lead"},{"fieldId":"' || pg_temp.h11w_fid('body') || '","kind":"field"}],"templateVersionId":null}'),
  'and it is the hash of exactly the plan the rows name [P2-S11-AC-100]');

-- Template slot order, blocks after the root fields, path order inside a slot.
select pg_temp.rp_call('tpl', 'rp-tpl');
select is(pg_temp.rp_nodes('tpl'),
  pg_temp.h11w_fid('meta')::text || '#note,' || pg_temp.h11w_fid('meta')::text || '#lead,' || pg_temp.h11w_fid('body')::text
    || ',/composition/' || pg_temp.h11w_uuid('rp-i2') || ',/composition/' || pg_temp.h11w_uuid('rp-i1'),
  'with a template the plan is the fields (properties nested at their field), then the instances by slot and path [P2-S11-AC-100]');
select is(pg_temp.r11_resp('tpl')->>'renderPlanHash', '2cb8fc5df5fde344dea2c1aba67fa6bcbabf963ec06265fc10b42440ff817111',
  'the render-plan hash binds the template version and the block identities (independent vector) [P2-S11-AC-100]');
select pg_temp.r11_try('plan-positions', format(
  'select coalesce(jsonb_agg(plan.plan_position order by plan.plan_position), %L::jsonb) from platform_private.cms_revision_render_plan(%L::uuid) plan',
  '[]', pg_temp.h11w_uuid('rp-tpl:revision')));
select is(pg_temp.r11_resp('plan-positions'), '[1,2,3,4,5]'::jsonb, 'plan positions are 1..n without a gap [P2-S11-AC-100]');

-- Moving a declared property, or the field itself, moves the node, the plan and the hash.
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions', $q$
  update platform_private.cms_field_definition_versions
     set constraints = '{"objectStructure":{"properties":[{"key":"lead","kind":"rich_text","required":false,"constraints":{}},{"key":"label","kind":"scalar","required":false,"constraints":{}},{"key":"note","kind":"rich_text","required":false,"constraints":{}}]}}'::jsonb
   where field_key = 'meta' $q$);
select pg_temp.rp_call('rp1-declared', 'rp-1');
select ok(pg_temp.rp_nodes('rp1-declared') = pg_temp.h11w_fid('meta')::text || '#lead,' || pg_temp.h11w_fid('meta')::text || '#note,' || pg_temp.h11w_fid('body')::text
    and pg_temp.r11_resp('rp1-declared')->>'renderPlanHash' <> pg_temp.r11_resp('rp1')->>'renderPlanHash',
  'declaring lead before note moves the nodes and changes the render-plan hash [P2-S11-AC-100]');
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $q$update platform_private.cms_field_definition_versions set editor_config = jsonb_set(editor_config, '{order}', '0'::jsonb) where field_key = 'body'$q$);
select pg_temp.rp_call('rp1-position', 'rp-1');
select ok(pg_temp.rp_nodes('rp1-position') = pg_temp.h11w_fid('body')::text || ',' || pg_temp.h11w_fid('meta')::text || '#lead,' || pg_temp.h11w_fid('meta')::text || '#note',
  'giving body the editor position 0 renders it ahead of the object field [P2-S11-AC-100]');

-- The load stays a safe read.
insert into rp_snap(label, effects) values ('final', pg_temp.r11r_effects());
select pg_temp.rp_call('f1', 'rp-1');
select pg_temp.rp_call('f2', 'rp-tpl');
select ok(pg_temp.r11r_effects() = (select effects from rp_snap where label = 'final'),
  'the load writes nothing: no audit record, event, reservation, review, schedule or publication is created or changed [P2-S11-AC-101]');

select * from finish();
rollback;
