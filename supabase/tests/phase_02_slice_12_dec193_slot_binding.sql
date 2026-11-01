-- DEC-193 slot/root binding. TEST ONLY; native author execution UNRUN.
-- Stage the existing pattern-updates WIPs and DEC-193 storage foundation.
-- Real, exact template slots expose the shortest-prefix bug without an invalid
-- nested slotPath or an invented requirement for new private anchor metadata.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();
select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc

-- All nested versions are real active governed patterns. Both expanded roots
-- have the SAME registered block identity; only their key chains differ.
select * from pg_temp.s12pl_pattern('s12sb-leaf-b', 's12sb-leaf-b',
  jsonb_build_array(pg_temp.s12pd_block('b', '[]', '{"title":"B"}')));
select * from pg_temp.s12pl_pattern('s12sb-leaf-t', 's12sb-leaf-t',
  jsonb_build_array(pg_temp.s12pd_block('b', '[]', '{"title":"T"}')));
select * from pg_temp.s12pl_pattern('s12sb-nested-a', 's12sb-nested-a',
  jsonb_build_array(jsonb_build_object('kind', 'pattern', 'key', 'a',
    'patternId', pg_temp.s12pd_body('s12sb-leaf-b')->'patternId', 'patternVersion', 1)));
select * from pg_temp.s12pl_pattern('s12sb-v1', 's12sb-anchor', jsonb_build_array(
  jsonb_build_object('kind', 'pattern', 'key', 'a',
    'patternId', pg_temp.s12pd_body('s12sb-leaf-b')->'patternId', 'patternVersion', 1),
  jsonb_build_object('kind', 'pattern', 'key', 'main',
    'patternId', pg_temp.s12pd_body('s12sb-nested-a')->'patternId', 'patternVersion', 1)));

-- Flat slots only: the main template declares exactly main, not main/more.
-- The second template makes a literal root slot distinct from no template.
select pg_temp.s09d_rpc(label, 'platform_api.cms_define_template', 'owner',
  jsonb_build_object('templateKey', template_key,
    'compatibleTypeIds', jsonb_build_array((select id from s12pd_types where ordinal = 1)),
    'slots', jsonb_build_array(jsonb_build_object('key', slot_key, 'required', false,
      'allowedBlocks', '[]'::jsonb, 'maxCount', 128)),
    'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
    'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public',
    'expectedVersion', null, 'idempotencyKey', label || '-0001'), true)
from (values ('s12sb-main-template', 's12sb-main', 'main'),
  ('s12sb-root-template', 's12sb-root', 'root')) templates(label, template_key, slot_key);
select is(pg_temp.s09d_outcome(label), 'OK', label || ': real template declares its one flat slot')
from (values ('s12sb-main-template'), ('s12sb-root-template')) templates(label);
select is((select slots from platform_private.cms_template_versions
  where id = (pg_temp.s09d_resp('s12sb-main-template')->>'id')::uuid),
  '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":128}]'::jsonb,
  'slot premise: the bound template contains only the exact flat main slot');

select pg_temp.s12pl_tentry('s12sb-main', 'owner', 's12sb-main-template');
select pg_temp.s12pl_run('s12sb-place-main', pg_temp.s12pl_request(
  's12sb-main', 's12sb-v1', '/main', '{}', 's12sb-place-main-0001'));
select * from pg_temp.s12pl_check('s12sb-place-main', 's12sb-main', 's12sb-v1',
  array['/main/a/b', '/main/main/a/b'], 0);
select is((select jsonb_agg(jsonb_build_object('path', path, 'blockKey', block_key,
  'blockVersion', block_version, 'patternVersion', pattern_version) order by position)
  from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('s12sb-main')),
  '[{"path":"/main/a/b","blockKey":"s12pd.block","blockVersion":1,"patternVersion":1},
    {"path":"/main/main/a/b","blockKey":"s12pd.block","blockVersion":1,"patternVersion":1}]'::jsonb,
  'conforming ambiguity premise: exact /main placement writes both same-identity root chains');

-- Fresh entry, valid active pattern and fresh CAS/key isolate slot existence.
-- This is not a collision with the conforming placement above.
select pg_temp.s12pl_tentry('s12sb-missing-slot', 'owner', 's12sb-main-template');
select * from pg_temp.s12pl_refused('s12sb-nested-slot', pg_temp.s12pl_request(
  's12sb-missing-slot', 's12sb-v1', '/main/more', '{}', 's12sb-nested-slot-0001'),
  'VALIDATION_FAILED', '["/slotPath"]'::jsonb);

select pg_temp.s12pl_entry('s12sb-no-template');
select * from pg_temp.s12pl_refused('s12sb-root-name-without-template', pg_temp.s12pl_request(
  's12sb-no-template', 's12sb-v1', '/root', '{}', 's12sb-no-template-bad-0001'),
  'VALIDATION_FAILED', '["/slotPath"]'::jsonb);
select pg_temp.s12pl_run('s12sb-place-no-template', pg_temp.s12pl_request(
  's12sb-no-template', 's12sb-v1', '/', '{}', 's12sb-no-template-0001'));
select * from pg_temp.s12pl_check('s12sb-place-no-template', 's12sb-no-template', 's12sb-v1',
  array['/a/b', '/main/a/b'], 0);

select pg_temp.s12pl_tentry('s12sb-root', 'owner', 's12sb-root-template');
select * from pg_temp.s12pl_refused('s12sb-slash-with-template', pg_temp.s12pl_request(
  's12sb-root', 's12sb-v1', '/', '{}', 's12sb-with-template-bad-0001'),
  'VALIDATION_FAILED', '["/slotPath"]'::jsonb);
select pg_temp.s12pl_run('s12sb-place-root', pg_temp.s12pl_request(
  's12sb-root', 's12sb-v1', '/root', '{}', 's12sb-root-0001'));
select * from pg_temp.s12pl_check('s12sb-place-root', 's12sb-root', 's12sb-v1',
  array['/root/a/b', '/root/main/a/b'], 0);
select ok((select template_version_id is null from platform_private.cms_entry_revisions
    where id = pg_temp.s12pl_rev('s12sb-no-template'))
  and (select template_version_id = (pg_temp.s09d_resp('s12sb-root-template')->>'id')::uuid
    from platform_private.cms_entry_revisions where id = pg_temp.s12pl_rev('s12sb-root')),
  'root-slot premise: template-less slash and a bound literal root slot are different worlds');

-- Only /a/b changes. The other complete root /main/a/b remains B. For the
-- first /main placement row, the old shortest-prefix view incorrectly chooses
-- /main/a/b with slot "" and therefore compares the UNCHANGED second root.
select * from pg_temp.s12pl_pattern('s12sb-v2', 's12sb-anchor', jsonb_build_array(
  jsonb_build_object('kind', 'pattern', 'key', 'a',
    'patternId', pg_temp.s12pd_body('s12sb-leaf-t')->'patternId', 'patternVersion', 1),
  jsonb_build_object('kind', 'pattern', 'key', 'main',
    'patternId', pg_temp.s12pd_body('s12sb-nested-a')->'patternId', 'patternVersion', 1)),
  null, true, '1');
select ok(pg_temp.s12pd_row('s12sb-v1')->>'state' = 'superseded'
  and pg_temp.s12pd_row('s12sb-v2')->>'state' = 'active',
  'target premise: real active v2 replaces v1 without changing any placed v1 pin');

-- Independent literal expected public bodies. Only source IDs/revision IDs are
-- read from immutable fixture metadata; no actual response/view/plan supplies
-- expected root addresses, props, topology, slot, pin, target or eligibility.
create temp table s12sb_cases(ordinal integer primary key, label text unique,
  tag text, row_path text, slot_path text, changed boolean) on commit drop;
insert into s12sb_cases values
  (1, 's12sb-diff-main-first', 's12sb-main', '/main/a/b', '/main', true),
  (2, 's12sb-diff-main-second', 's12sb-main', '/main/main/a/b', '/main', false),
  (3, 's12sb-diff-no-template', 's12sb-no-template', '/a/b', '/', true),
  (4, 's12sb-diff-root', 's12sb-root', '/root/a/b', '/root', true);
create temp table s12sb_expected on commit drop as
select cases.ordinal, cases.label, inst.id as instance_id,
  jsonb_build_object('instance', jsonb_build_object('id', inst.id, 'version', '1',
    'revisionId', pg_temp.s12pl_rev(cases.tag), 'path', cases.row_path,
    'state', 'active', 'linkMode', 'linked', 'pinnedPatternVersion', 1),
    'slotPath', cases.slot_path, 'targetPatternVersion', 2,
    'paths', case when cases.changed then
      '[{"path":"/a/b","base":{"blockKey":"s12pd.block","blockVersion":1,
        "props":{"title":"B"},"children":[]},
        "theirs":{"blockKey":"s12pd.block","blockVersion":1,
        "props":{"title":"T"},"children":[]},"yours":null,
        "collision":false,"collisionKind":null}]'::jsonb else '[]'::jsonb end,
    'newRoots', '[]'::jsonb, 'collisionCount', 0, 'bulkEligible', true) as body
from s12sb_cases cases left join platform_private.cms_composition_instances inst
  on inst.id = pg_temp.s12pu_head(cases.tag, cases.row_path);
select ok((select count(*) = 4 and count(instance_id) = 4 from s12sb_expected),
  'all four expected resources name actual independently placed instance rows');
select ok((select count(*) = 4 and bool_and(inst.version = 1 and inst.pattern_version = 1
  and inst.state = 'active' and inst.link_mode = 'linked')
  from s12sb_expected expected join platform_private.cms_composition_instances inst
    on inst.id = expected.instance_id), 'every read source retains its real active linked v1 pin');

select pg_temp.s12pu_diff(label, instance_id) from s12sb_expected order by ordinal;
select is(pg_temp.s12pu_oc(label), 'ok', label || ': actual public RPC succeeds')
from s12sb_expected order by ordinal;
select is(pg_temp.s12pu_body(label), body,
  label || ': exact typed body binds the real slot and corresponding pinned/target root')
from s12sb_expected order by ordinal;
select ok(pg_temp.s12pu_unchanged(label), label || ': read preserves every captured full store row')
from s12sb_expected order by ordinal;
select is(pg_temp.s12pu_body('s12sb-diff-main-first')->>'slotPath', '/main',
  'conforming first root keeps the actual /main slot, never an inferred empty prefix');
select is(pg_temp.s12pu_body('s12sb-diff-main-first')->'paths',
  (select body->'paths' from s12sb_expected where label = 's12sb-diff-main-first'),
  'conforming first root compares typed /a/b B-to-T, not unchanged /main/a/b');
select is(pg_temp.s12pu_body('s12sb-diff-main-second')->'paths', '[]'::jsonb,
  'adjacent same-identity root is independently unchanged, not aliased to the first root');
select ok((select count(*) = 4 and bool_and(before_rows = after_rows
  and requested_role = 'service_role' and call_role = requested_role and role_restored)
  from s12pu_out), 'every GET uses/restores the actual service role and leaves full stores unchanged');

select finish();
rollback;
