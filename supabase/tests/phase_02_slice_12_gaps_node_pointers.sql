-- Slice 12 gap lane claude_s12_web_impl, P2-S12-AC-105 / DEC-228: CMS-03C-12 names the offending request node.
--   BE03c field matrix CMS-03C-12 `blockTree` row, 1525 ("at the offending node's pointer in the request `blockTree`,
--   `/blockTree/{i}(/children/{j})*`, like the operation's other `blockTree` refusals"); FE03 885 (the designer renders it
--   inline with the node path).  DEC-228: depth = the first request node in preorder at level 9; node count = the request node
--   whose expansion first takes the expanded total past 512; cycle = the nested `pattern` node whose lineage closes the cycle.
-- The refusal tokens and statuses are unchanged; only the DETAIL pointer moves from the root `/blockTree` to the node.
-- Fixtures are the pattern-definition suite's own (real signed block, real governed activation); no trigger is touched.
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

-- A block whose descendants form a single chain of p_levels levels counting itself (p_levels 1 is a leaf).
create or replace function pg_temp.s12np_chain(p_levels integer, p_key text default 'chain')
returns jsonb language plpgsql immutable as $body$
declare node jsonb := pg_temp.s12pd_block('level' || p_levels); n integer;
begin
  for n in reverse p_levels - 1 .. 1 loop
    node := pg_temp.s12pd_block('level' || n, jsonb_build_array(node));
  end loop;
  return jsonb_set(node, '{key}', to_jsonb(p_key));
end;
$body$;
-- 16 roots; the first root takes one extra child: 16 + 32 + 15 * 31 = 513 literal nodes.
create or replace function pg_temp.s12np_nodes() returns jsonb language sql immutable as $body$
  select jsonb_agg(pg_temp.s12pd_block('root' || n, pg_temp.s12pd_forest(case when n = 1 then 32 else 31 end)) order by n)
    from generate_series(1, 16) n
$body$;
create or replace function pg_temp.s12np_ref(p_label text, p_key text) returns jsonb language sql stable as $body$
  select jsonb_build_object('kind', 'pattern', 'key', p_key,
    'patternId', pg_temp.s12pd_body(p_label)->'patternId', 'patternVersion', pg_temp.s12pd_body(p_label)->'patternVersion')
$body$;
create or replace function pg_temp.s12np_detail(p_label text) returns text language sql stable as $body$
  select detail from s12pd_out where label = p_label $body$;

-- The pattern-definition suite keeps its activation chain in 050-nested.sqlinc (it also runs that file's own cases and
-- advances the child lineage), so this file carries the same four governed steps: real submit, assign, decide and activate.
create or replace function pg_temp.s12np_refs(p_label text, p_count integer) returns jsonb
language sql stable as $body$
  select jsonb_agg(jsonb_build_object('kind', 'pattern', 'key', 'nested' || n,
    'patternId', pg_temp.s12pd_body(p_label)->'patternId',
    'patternVersion', pg_temp.s12pd_body(p_label)->'patternVersion') order by n)
    from generate_series(1, p_count) n
$body$;
create or replace function pg_temp.s12np_activate(p_label text) returns setof text
language plpgsql as $body$
declare body jsonb := pg_temp.s12pd_body(p_label); review jsonb; decision jsonb;
begin
  perform pg_temp.s12pd_run(p_label || ':submit', jsonb_build_object('subjectKind', 'pattern_version',
    'subjectId', body->'id', 'subjectHash', body->'contentHash', 'idempotencyKey', 's12np-' || p_label || '-submit',
    'context', pg_temp.s09d_context('owner', true)), 'owner', 'service_role', 'submit');
  review := pg_temp.s12pd_body(p_label || ':submit');
  return next extensions.is(pg_temp.s12pd_state(p_label || ':submit'), '00000', p_label || ': real governed submission');
  perform pg_temp.s12pd_run(p_label || ':assign', jsonb_build_object('reviewId', review->'id', 'action', 'create',
    'expectedVersion', review->'version', 'ifMatch', review->'version',
    'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'),
    'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'reason', 'Node pointer fixture', 'idempotencyKey', 's12np-' || p_label || '-assign',
    'context', pg_temp.s09d_context('owner', true)), 'owner', 'service_role', 'assign');
  return next extensions.is(pg_temp.s12pd_state(p_label || ':assign'), '00000', p_label || ': real reviewer assignment');
  perform pg_temp.s12pd_run(p_label || ':decide', jsonb_build_object('reviewId', review->'id', 'decision', 'approve',
    'reason', 'Node pointer fixture approved', 'expectedVersion', review->'version', 'ifMatch', review->'version',
    'idempotencyKey', 's12np-' || p_label || '-decide', 'context', pg_temp.s09d_context('rev1', true)),
    'rev1', 'service_role', 'decide');
  decision := pg_temp.s12pd_body(p_label || ':decide');
  return next extensions.is(pg_temp.s12pd_state(p_label || ':decide'), '00000', p_label || ': real independent approval');
  perform pg_temp.s12pd_run(p_label || ':activate', jsonb_build_object('reviewId', review->'id', 'action', 'activate',
    'expectedVersion', decision->'version', 'ifMatch', decision->'version',
    'idempotencyKey', 's12np-' || p_label || '-activate', 'context', pg_temp.s09d_context('owner', true)),
    'owner', 'service_role', 'activate');
  return next extensions.is(pg_temp.s12pd_state(p_label || ':activate'), '00000', p_label || ': real governed activation');
  return next extensions.is(pg_temp.s12pd_row(p_label)->>'state', 'active', p_label || ': the version is active');
end;
$body$;

-- Missing members are ordinary failing assertions, never parse failures (the helper does not exist before the migration).
create or replace function pg_temp.s12np_pointer(p_path integer[]) returns text language plpgsql as $body$
declare answer text;
begin
  execute 'select platform_private.cms_pattern_node_pointer($1)' into answer using p_path;
  return answer;
exception when undefined_function then return 'MISSING';
end;
$body$;

-- The pointer helper itself: a root index, then one `/children/{j}` per descent.
select is(pg_temp.s12np_pointer(array[3]), '/blockTree/3',
  'a root node is /blockTree/{i} [DEC-228]');
select is(pg_temp.s12np_pointer(array[1, 0, 31]), '/blockTree/1/children/0/children/31',
  'a nested node descends through /children/{j} [DEC-228]');

-- Literal depth: the first node in preorder at level 9 (BE03c field matrix CMS-03C-12 blockTree row).
select * from pg_temp.s12pd_refused('np-depth-simple', pg_temp.s12pd_request('s12np-depth-simple',
  jsonb_build_array(pg_temp.s12np_chain(10, 'deep')), null, 's12np-depth-simple'),
  'VALIDATION_FAILED', 'pattern_depth_exceeded');
select is(pg_temp.s12np_detail('np-depth-simple'), '["/blockTree/0' || repeat('/children/0', 8) || '"]',
  'a depth-10 chain is refused at its level 9 node, not at the root [P2-S12-AC-105, DEC-228]');
select * from pg_temp.s12pd_refused('np-depth-second', pg_temp.s12pd_request('s12np-depth-second',
  jsonb_build_array(pg_temp.s12np_chain(8, 'ok'),
    pg_temp.s12pd_block('b', jsonb_build_array(pg_temp.s12pd_block('c0'), pg_temp.s12np_chain(8, 'c1')))),
  null, 's12np-depth-second'), 'VALIDATION_FAILED', 'pattern_depth_exceeded');
select is(pg_temp.s12np_detail('np-depth-second'), '["/blockTree/1/children/1' || repeat('/children/0', 7) || '"]',
  'the first level 9 node in preorder is named, not an earlier depth-8 chain [P2-S12-AC-105, DEC-228]');

-- Literal node count: the 513th node in preorder.
select * from pg_temp.s12pd_refused('np-nodes-literal', pg_temp.s12pd_request('s12np-nodes-literal',
  pg_temp.s12np_nodes(), null, 's12np-nodes-literal'), 'VALIDATION_FAILED', 'pattern_nodes_exceeded');
select is(pg_temp.s12np_detail('np-nodes-literal'), '["/blockTree/15/children/30"]',
  'the 513th literal node in preorder is the offending node [P2-S12-AC-105, DEC-228]');

-- Governed fixtures for the nested cases: child (16 blocks), nested (one reference to child), a draft and a nine-pattern chain.
select pg_temp.s12pd_run('child', pg_temp.s12pd_request('s12pd-child', pg_temp.s12pd_forest(16), null, 's12pd-child'));
select is(pg_temp.s12pd_state('child'), '00000', 'fixture: child draft created');
select * from pg_temp.s12np_activate('child');
select pg_temp.s12pd_run('nested', pg_temp.s12pd_request('s12pd-nested', pg_temp.s12np_refs('child', 1), null, 's12pd-nested'));
select is(pg_temp.s12pd_state('nested'), '00000', 'fixture: nested reference created');
select * from pg_temp.s12np_activate('nested');
select pg_temp.s12pd_run('drafty', pg_temp.s12pd_request('s12np-drafty', pg_temp.s12pd_forest(1), null, 's12np-drafty'));
select is(pg_temp.s12pd_state('drafty'), '00000', 'fixture: a pattern left in draft');

-- Expanded node count: the request node whose expansion first takes the total past 512.
select * from pg_temp.s12pd_refused('np-nodes-wrapper', pg_temp.s12pd_request('s12np-nodes-wrapper',
  jsonb_build_array(pg_temp.s12pd_block('wrapper', pg_temp.s12np_refs('child', 32))), null, 's12np-nodes-wrapper'),
  'VALIDATION_FAILED', 'pattern_nodes_exceeded');
select is(pg_temp.s12np_detail('np-nodes-wrapper'), '["/blockTree/0/children/31"]',
  'wrapper 1 + 32 references of 16 blocks: the 32nd reference crosses 512 [P2-S12-AC-105, DEC-228]');
select * from pg_temp.s12pd_refused('np-nodes-mixed', pg_temp.s12pd_request('s12np-nodes-mixed',
  pg_temp.s12np_refs('child', 31) || jsonb_build_array(pg_temp.s12pd_block('wrap',
    jsonb_build_array(pg_temp.s12np_ref('child', 'inner')))), null, 's12np-nodes-mixed'),
  'VALIDATION_FAILED', 'pattern_nodes_exceeded');
select is(pg_temp.s12np_detail('np-nodes-mixed'), '["/blockTree/31/children/0"]',
  '31 references (496) + a wrapper (497) + a nested reference (513): the nested reference is named [P2-S12-AC-105, DEC-228]');

-- Cycle: the nested pattern node whose lineage closes the cycle, first in preorder.
select * from pg_temp.s12pd_refused('np-cycle-direct', pg_temp.s12pd_request('s12pd-child',
  jsonb_build_array(pg_temp.s12pd_block('a'), pg_temp.s12pd_block('wrap', jsonb_build_array(pg_temp.s12np_ref('child', 'loop')))),
  '1', 's12np-cycle-direct', null, '1'), 'CONFLICT', 'pattern_cycle');
select is(pg_temp.s12np_detail('np-cycle-direct'), '["/blockTree/1/children/0"]',
  'a successor of child that nests child is refused at the nested reference [P2-S12-AC-105, DEC-228]');
select * from pg_temp.s12pd_refused('np-cycle-indirect', pg_temp.s12pd_request('s12pd-nested',
  jsonb_build_array(pg_temp.s12np_ref('child', 'ok'),
    pg_temp.s12pd_block('wrap', jsonb_build_array(pg_temp.s12np_ref('nested', 'loop')))),
  '1', 's12np-cycle-indirect', null, '1'), 'CONFLICT', 'pattern_cycle');
select is(pg_temp.s12np_detail('np-cycle-indirect'), '["/blockTree/1/children/0"]',
  'the harmless reference to child is skipped; the reference to nested closes the cycle [P2-S12-AC-105, DEC-228]');
select * from pg_temp.s12pd_refused('np-cycle-first', pg_temp.s12pd_request('s12pd-child',
  jsonb_build_array(pg_temp.s12pd_block('x', jsonb_build_array(pg_temp.s12np_ref('child', 'one'))),
    pg_temp.s12np_ref('child', 'two')),
  '1', 's12np-cycle-first', null, '1'), 'CONFLICT', 'pattern_cycle');
select is(pg_temp.s12np_detail('np-cycle-first'), '["/blockTree/0/children/0"]',
  'two references close the cycle: the first in preorder is named [P2-S12-AC-105, DEC-228]');

-- Tokens DEC-228 does not move keep the root pointer.
select * from pg_temp.s12pd_refused('np-not-active', pg_temp.s12pd_request('s12np-not-active',
  jsonb_build_array(pg_temp.s12np_ref('drafty', 'draft-ref')), null, 's12np-not-active'),
  'VALIDATION_FAILED', 'nested_pattern_not_active');
select is(pg_temp.s12np_detail('np-not-active'), '["/blockTree"]',
  'nested_pattern_not_active keeps the /blockTree pointer (DEC-228 moves only cycle, depth and node count)');

-- Nested chain depth: a request that reaches a ninth pattern level; the reference whose own chain is nine deep is named.
create or replace function pg_temp.s12np_make(p_n integer) returns setof text language plpgsql as $body$
begin
  perform pg_temp.s12pd_run('p' || p_n, pg_temp.s12pd_request('s12np-p' || p_n,
    case when p_n = 1 then pg_temp.s12pd_forest(1)
         else jsonb_build_array(pg_temp.s12np_ref('p' || (p_n - 1), 'nested1')) end,
    null, 's12np-p' || p_n));
  return next extensions.is(pg_temp.s12pd_state('p' || p_n), '00000', 'fixture: nested level ' || p_n || ' created');
  return query select * from pg_temp.s12np_activate('p' || p_n);
end;
$body$;
select * from pg_temp.s12np_make(1);
select * from pg_temp.s12np_make(2);
select * from pg_temp.s12np_make(3);
select * from pg_temp.s12np_make(4);
select * from pg_temp.s12np_make(5);
select * from pg_temp.s12np_make(6);
select * from pg_temp.s12np_make(7);
select * from pg_temp.s12np_make(8);
select * from pg_temp.s12np_make(9);
select is((select count(*)::integer from s12pd_out where label ~ '^p[0-9]$' and state = '00000'), 9,
  'fixture: nine nested levels created');
select is((select count(*)::integer from platform_private.cms_pattern_versions where pattern_key ~ '^s12np-p[0-9]$' and state = 'active'), 9,
  'fixture: nine nested levels active through the governed path');
select * from pg_temp.s12pd_refused('np-chain-depth', pg_temp.s12pd_request('s12np-chain-top',
  jsonb_build_array(pg_temp.s12np_ref('p8', 'ok'),
    pg_temp.s12pd_block('wrap', jsonb_build_array(pg_temp.s12np_ref('p9', 'deep')))),
  null, 's12np-chain-top'), 'VALIDATION_FAILED', 'pattern_depth_exceeded');
select is(pg_temp.s12np_detail('np-chain-depth'), '["/blockTree/1/children/0"]',
  'the reference whose pattern chain is nine levels deep is named; the eight-deep reference before it is not [P2-S12-AC-105, DEC-228]');

select finish();
rollback;
