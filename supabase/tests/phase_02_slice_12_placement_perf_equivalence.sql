-- Slice 12 lane placement-perf (defect D1, BE03c 1813: CMS-03C-02 placement of 512 rows inside the RPC < 300 ms bound):
-- the equivalence of the faster helpers with the bodies they replace.  Each old body is embedded VERBATIM below as a
-- pg_temp function (cms_pattern_placement_path_allocation of 20261016043600, cms_block_rules_violation of 20261022080000,
-- cms_composition_instance_resource of 20261016041300) and compared with the installed new body on the same inputs, so a
-- behaviour change cannot hide in the rewrite.  Stage lane `placement-perf` (migrations 20261024150000..150400).
--   1 path allocation   retired heads reuse position at the next version; new paths number above every slot history position;
--                       a non-retired head, a version at the ceiling and a position past the ceiling are CONFLICT
--   2 block rules       handcrafted cases, then 400 seeded random forests (explicit parents, chain parents, duplicate chains,
--                       missing and non-integer limits, unlisted children)
--   3 resource          old projection = new projection = hashed projection(content hash) for linked, overridden and detached rows
--   4 overrides         the per-root override map of a real placement (the producer's rewritten statement)
--   5 attributes        owner, security mode, volatility, search_path, ACL and comment of the changed and the new functions
\set ON_ERROR_STOP on
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
\ir phase_02_slice_12_gaps_perf_common/000-timing.sqlinc
\ir phase_02_slice_12_gaps_perf_patterns/010-lean.sqlinc

-- ---------------------------------------------------------------- the old bodies, verbatim ----
create function pg_temp.old_alloc(p_revision_id uuid, p_slot_key text, p_slot_path text, p_nodes jsonb)
returns jsonb language plpgsql stable set search_path = '' as $oldfn$
declare
  v_next bigint;
  v_item jsonb;
  v_path text;
  v_version bigint;
  v_position integer;
  v_head platform_private.cms_composition_instances%rowtype;
  v_result jsonb := '[]'::jsonb;
begin
  select coalesce(pg_catalog.max(instance.position)::bigint, -1) + 1 into v_next
    from platform_private.cms_composition_instances instance
   where instance.revision_id = p_revision_id and instance.slot_key = p_slot_key;
  for v_item in
    select item.value from pg_catalog.jsonb_array_elements(p_nodes) with ordinality item(value, ordinality)
     order by item.ordinality
  loop
    if (v_item->>'isRoot')::boolean then
      v_path := case when p_slot_path = '/' then v_item->>'root' else p_slot_path || (v_item->>'root') end;
      select instance.* into v_head from platform_private.cms_composition_instances instance
       where instance.revision_id = p_revision_id and instance.path = v_path
       order by instance.version desc, instance.id desc limit 1;
      if found then
        if v_head.state <> 'retired' or v_head.version >= 2147483647 then
          raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
        end if;
        v_version := v_head.version + 1;
        v_position := v_head.position;
      else
        if v_next > 2147483647 then
          raise exception 'CONFLICT' using errcode = 'P0001', detail = '["/slotPath"]';
        end if;
        v_version := 1;
        v_position := v_next::integer;
        v_next := v_next + 1;
      end if;
      v_item := v_item || pg_catalog.jsonb_build_object(
        'placementVersion', v_version, 'placementPosition', v_position);
    end if;
    v_result := v_result || pg_catalog.jsonb_build_array(v_item);
  end loop;
  return v_result;
end;
$oldfn$;
create function pg_temp.old_violation(p_nodes jsonb, p_rules jsonb)
returns jsonb language sql immutable set search_path = '' as $oldfn$
  with recursive nodes as (
    select (item.ordinal - 1)::integer as idx, item.node as node,
           item.node->>'chain' as chain, item.node->>'blockKey' as block_key,
           item.node->>'blockVersion' as block_version
      from pg_catalog.jsonb_array_elements(
             case when pg_catalog.jsonb_typeof(p_nodes) = 'array' then p_nodes else '[]'::jsonb end
           ) with ordinality item(node, ordinal)
  ), linked as (
    select child.idx, child.block_key,
           case when child.node ? 'parent'
                then case when pg_catalog.jsonb_typeof(child.node->'parent') = 'number'
                          then (child.node->>'parent')::numeric::integer end
                else (select candidate.idx from nodes candidate
                       where candidate.idx <> child.idx
                         and pg_catalog.starts_with(child.chain, candidate.chain || '/')
                       order by pg_catalog.char_length(candidate.chain) desc, candidate.idx limit 1)
           end as parent_idx
      from nodes child
  ), reach(ancestor, descendant, depth) as (
    select linked.idx, linked.idx, 1 from linked
    union all
    select reach.ancestor, child.idx, reach.depth + 1
      from reach join linked child on child.parent_idx = reach.descendant
     where reach.depth < 64
  ), totals as (
    select reach.ancestor as idx, pg_catalog.count(*) as node_count, pg_catalog.max(reach.depth) as depth
      from reach group by reach.ancestor
  ), judged as (
    select nodes.idx,
           (select pg_catalog.min(child.idx) from linked child
             where child.parent_idx = nodes.idx
               and coalesce((rule.value->'children') ? child.block_key, false) is not true) as bad_child,
           coalesce(totals.node_count > case when rule.value#>>'{limits,maxNodes}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxNodes}')::integer end, false) as nodes_over,
           coalesce(totals.depth > case when rule.value#>>'{limits,maxDepth}' ~ '^[0-9]{1,9}$'
             then (rule.value#>>'{limits,maxDepth}')::integer end, false) as depth_over
      from nodes
      cross join lateral (select p_rules->(nodes.block_key || ':' || nodes.block_version) as value) rule
      join totals on totals.idx = nodes.idx
     where rule.value is not null
  )
  select pg_catalog.jsonb_build_object('index', judged.idx,
           'reason', case when judged.bad_child is not null then 'children'
                          when judged.nodes_over then 'nodes' else 'depth' end,
           'child', judged.bad_child)
    from judged
   where judged.bad_child is not null or judged.nodes_over or judged.depth_over
   order by judged.idx
   limit 1
$oldfn$;
create function pg_temp.old_resource(p_row platform_private.cms_composition_instances)
returns jsonb language sql stable set search_path = '' as $oldfn$
  select pg_catalog.jsonb_build_object(
    'id', p_row.id, 'version', p_row.version::text,
    'contentHash', platform_private.cms_jcs_sha256(platform_private.cms_composition_instance_content(p_row)),
    'createdAt', platform_private.auth_iso_time(p_row.created_at),
    'updatedAt', platform_private.auth_iso_time(p_row.updated_at),
    'state', p_row.state, 'revisionId', p_row.revision_id, 'path', p_row.path, 'position', p_row.position,
    'blockKey', p_row.block_key, 'blockVersion', p_row.block_version, 'patternId', p_row.pattern_id,
    'patternVersion', p_row.pattern_version, 'blockRegistryDigest', pg_catalog.btrim(p_row.block_registry_digest::text),
    'linkMode', p_row.link_mode, 'conflictState', case p_row.link_mode when 'linked' then 'none' else null end)
$oldfn$;

-- ---------------------------------------------------------------- 1 path allocation ----
select pg_temp.s12pl_entry('al');
create or replace function pg_temp.al_row(p_path text, p_slot text, p_version bigint, p_state text, p_position integer)
returns void language plpgsql as $b$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_composition_instances(id, owner_id, state, version, revision_id, path, slot_key, block_key,
    block_version, block_registry_digest, link_mode, created_by, position)
  values (extensions.gen_random_uuid(), pg_temp.s09d_id('ownerOrg'), p_state, p_version, pg_temp.s12pl_rev('al'), p_path, p_slot,
    's12pd.block', 1, repeat('a', 64), 'linked', (select auth_user_id from s09d_actor where key = 'owner'), p_position);
end;
$b$;
-- slot main: /a retired twice (head v2, position 3), /b active, /e retired at the version ceiling; slot side holds a high position
select pg_temp.al_row('/a', 'main', 1, 'retired', 3);
select pg_temp.al_row('/a', 'main', 2, 'retired', 3);
select pg_temp.al_row('/b', 'main', 1, 'active', 4);
select pg_temp.al_row('/e', 'main', 2147483647, 'retired', 5);
select pg_temp.al_row('/s1', 'side', 1, 'active', 40);
select pg_temp.al_row('/t1', 'tail', 1, 'active', 2147483647);

create or replace function pg_temp.al_nodes(p_roots text[], p_extra boolean default true) returns jsonb language sql immutable as $b$
  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from (
    select r.ord * 2 as ord, jsonb_build_object('chain', r.root, 'root', r.root, 'isRoot', true, 'node', jsonb_build_object('key', r.root)) as item
      from unnest(p_roots) with ordinality r(root, ord)
    union all
    select r.ord * 2 + 1, jsonb_build_object('chain', r.root || '/x', 'root', r.root, 'isRoot', false, 'node', jsonb_build_object('key', 'x'))
      from unnest(p_roots) with ordinality r(root, ord) where p_extra) q $b$;
-- one comparison: the result jsonb, or 'ERR:<state>:<detail>' when the function raised
create or replace function pg_temp.al_run(p_new boolean, p_slot text, p_path text, p_nodes jsonb) returns text language plpgsql as $b$
declare v jsonb; s text; d text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  if p_new then v := platform_private.cms_pattern_placement_path_allocation(pg_temp.s12pl_rev('al'), p_slot, p_path, p_nodes);
  else v := pg_temp.old_alloc(pg_temp.s12pl_rev('al'), p_slot, p_path, p_nodes); end if;
  return v::text;
exception when others then
  get stacked diagnostics s = returned_sqlstate, d = pg_exception_detail;
  return 'ERR:' || s || ':' || sqlerrm || ':' || coalesce(d, '');
end;
$b$;
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/a', '/d', '/f'])), pg_temp.al_run(false, 'main', '/', pg_temp.al_nodes(array['/a', '/d', '/f'])),
  'allocation: a retired head reuses its position at the next version and new paths follow the slot history, with non-root nodes passed through');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/a', '/d', '/f'])) ::jsonb #>> '{0,placementVersion}', '3',
  'allocation: the retired path /a is placed at version 3 (head version 2 + 1)');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/a', '/d', '/f'])) ::jsonb #>> '{2,placementPosition}', '6',
  'allocation: the first new path takes position 6, one above the greatest position (5) of the slot');
select is(pg_temp.al_run(true, 'main', '/m', pg_temp.al_nodes(array['/a', '/b', '/c'])), pg_temp.al_run(false, 'main', '/m', pg_temp.al_nodes(array['/a', '/b', '/c'])),
  'allocation: under a slot path prefix no existing head applies and every root is new');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/d', '/b'])), pg_temp.al_run(false, 'main', '/', pg_temp.al_nodes(array['/d', '/b'])),
  'allocation: an active head is CONFLICT (same token and detail as the old body)');
select alike(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/d', '/b'])), 'ERR:P0001:CONFLICT:%/slotPath%',
  'allocation: the active head raises CONFLICT at /slotPath');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/e'])), pg_temp.al_run(false, 'main', '/', pg_temp.al_nodes(array['/e'])),
  'allocation: a retired head at the version ceiling is CONFLICT');
select alike(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/e'])), 'ERR:P0001:CONFLICT:%', 'allocation: the version ceiling raises CONFLICT');
select is(pg_temp.al_run(true, 'tail', '/', pg_temp.al_nodes(array['/n'])), pg_temp.al_run(false, 'tail', '/', pg_temp.al_nodes(array['/n'])),
  'allocation: a new path past the position ceiling is CONFLICT');
select alike(pg_temp.al_run(true, 'tail', '/', pg_temp.al_nodes(array['/n'])), 'ERR:P0001:CONFLICT:%', 'allocation: the position ceiling raises CONFLICT');
select is(pg_temp.al_run(true, 'side', '/', pg_temp.al_nodes(array['/n1', '/n2'], false)), pg_temp.al_run(false, 'side', '/', pg_temp.al_nodes(array['/n1', '/n2'], false)),
  'allocation: another slot numbers from its own greatest position');
select is(pg_temp.al_run(true, 'main', '/', '[]'::jsonb), pg_temp.al_run(false, 'main', '/', '[]'::jsonb), 'allocation: an empty plan answers an empty array');
select is(pg_temp.al_run(true, 'main', '/', '[{"chain":"/a","root":"/a","node":{}}]'::jsonb), pg_temp.al_run(false, 'main', '/', '[{"chain":"/a","root":"/a","node":{}}]'::jsonb),
  'allocation: a node without isRoot is passed through unchanged');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes(array['/d', '/d'], false)), pg_temp.al_run(false, 'main', '/', pg_temp.al_nodes(array['/d', '/d'], false)),
  'allocation: a repeated new root path gets consecutive positions exactly as the old body numbered it');
select is(pg_temp.al_run(true, 'main', '/', pg_temp.al_nodes((select array_agg('/r' || n) from generate_series(1, 512) n))),
          pg_temp.al_run(false, 'main', '/', pg_temp.al_nodes((select array_agg('/r' || n) from generate_series(1, 512) n))),
  'allocation: the plan of the 512-root bound (with a child node per root) allocates identically');

-- ---------------------------------------------------------------- 2 block rules ----
create or replace function pg_temp.vi_nodes(p jsonb) returns jsonb language sql immutable as $b$ select p $b$;
create temp table vi_case(label text, nodes jsonb, rules jsonb) on commit drop;
insert into vi_case values
  ('empty', '[]', '{}'),
  ('single no rule', '[{"chain":"/a","blockKey":"k","blockVersion":1}]', '{}'),
  ('chain child allowed', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":["j"],"limits":{"maxNodes":9,"maxDepth":9}}}'),
  ('chain child refused', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":["z"],"limits":{"maxNodes":9,"maxDepth":9}}}'),
  ('empty list admits no child', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":[],"limits":{}}}'),
  ('maxNodes', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1},{"chain":"/a/c","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":["j"],"limits":{"maxNodes":2,"maxDepth":9}}}'),
  ('maxDepth', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"k","blockVersion":1},{"chain":"/a/b/c","blockKey":"k","blockVersion":1}]',
     '{"k:1":{"children":["k"],"limits":{"maxNodes":99,"maxDepth":2}}}'),
  ('longest prefix parent', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1},{"chain":"/a/b/c","blockKey":"m","blockVersion":1}]',
     '{"j:1":{"children":["q"],"limits":{}}}'),
  ('reference gap: grandchild hangs off nearest block', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/ref/b","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":[],"limits":{}}}'),
  ('explicit parents', '[{"blockKey":"k","blockVersion":1,"parent":null},{"blockKey":"j","blockVersion":1,"parent":0},{"blockKey":"j","blockVersion":1,"parent":0}]',
     '{"k:1":{"children":["j"],"limits":{"maxNodes":2}}}'),
  ('explicit parent non-number', '[{"blockKey":"k","blockVersion":1,"parent":"x"},{"blockKey":"j","blockVersion":1,"parent":0}]',
     '{"k:1":{"children":[],"limits":{}}}'),
  ('duplicate chains', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1}]',
     '{"k:1":{"children":["z"],"limits":{}}}'),
  ('null chain', '[{"blockKey":"k","blockVersion":1},{"chain":"/a","blockKey":"k","blockVersion":1}]', '{"k:1":{"children":[],"limits":{}}}'),
  ('non-array nodes', '{"x":1}', '{}'),
  ('non-integer limits', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"k","blockVersion":1}]',
     '{"k:1":{"children":["k"],"limits":{"maxNodes":"x","maxDepth":1.5}}}'),
  ('missing children member', '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"k","blockVersion":1}]', '{"k:1":{"limits":{}}}');
select is((select pg_catalog.count(*)::integer from vi_case where pg_temp.old_violation(nodes, rules) is distinct from platform_private.cms_block_rules_violation(nodes, rules)), 0,
  'block rules: every handcrafted case answers exactly what the old body answered');
select ok((select pg_catalog.count(*) from vi_case where platform_private.cms_block_rules_violation(nodes, rules) is not null) >= 6,
  'block rules: at least six handcrafted cases are real violations (children, nodes, depth), so the comparison is not vacuous');
select is(platform_private.cms_block_rules_violation(
    '[{"chain":"/a","blockKey":"k","blockVersion":1},{"chain":"/a/b","blockKey":"j","blockVersion":1}]',
    '{"k:1":{"children":["z"],"limits":{}}}'),
  '{"index":0,"reason":"children","child":1}'::jsonb, 'block rules: the first disallowed child is reported by index');
select setseed(0.4271);
create temp table vi_random(n integer, nodes jsonb, rules jsonb) on commit drop;
insert into vi_random
select g,
  (select coalesce(jsonb_agg(
            case when mode = 0 then jsonb_build_object('chain', chain, 'blockKey', bk, 'blockVersion', 1)
                 when mode = 1 then jsonb_build_object('blockKey', bk, 'blockVersion', 1, 'parent', par)
                 else jsonb_build_object('chain', chain, 'blockKey', bk, 'blockVersion', 1 + (random() < 0.2)::int) end
            order by i), '[]'::jsonb)
     from (select i, case when random() < 0.12 then 1 else case when random() < 0.1 then 2 else 0 end end as mode,
                  (array['k','j','m'])[1 + floor(random() * 3)::int] as bk,
                  case when random() < 0.3 then null else (floor(random() * i))::int - 1 end as par,
                  '/' || (array['a','b','c'])[1 + floor(random() * 3)::int]
                      || case when random() < 0.55 then '/' || (array['a','b','c','d'])[1 + floor(random() * 4)::int] else '' end
                      || case when random() < 0.3 then '/' || (array['a','b'])[1 + floor(random() * 2)::int] else '' end as chain
             from generate_series(1, 2 + floor(random() * 13)::int) i where g > 0) nodes_q),
  (select coalesce(jsonb_object_agg(key || ':' || ver, jsonb_build_object(
            'children', case when random() < 0.1 then null else (select coalesce(jsonb_agg(c), '[]'::jsonb) from unnest(array['k','j','m']) c where random() < 0.7) end,
            'limits', case when random() < 0.15 then jsonb_build_object('maxNodes', 'x')
                      else jsonb_build_object('maxNodes', 2 + floor(random() * 10)::int, 'maxDepth', 1 + floor(random() * 4)::int) end))
          filter (where random() < 0.8), '{}'::jsonb)
     from unnest(array['k','j','m']) key cross join generate_series(1, 2) ver where g > 0)
from generate_series(1, 400) g;
select diag('random forests: violating=' || (select pg_catalog.count(*) filter (where platform_private.cms_block_rules_violation(nodes, rules) is not null) from vi_random)
  || ' clean=' || (select pg_catalog.count(*) filter (where platform_private.cms_block_rules_violation(nodes, rules) is null) from vi_random)
  || ' avg_nodes=' || (select round(avg(jsonb_array_length(nodes)), 1) from vi_random where jsonb_typeof(nodes) = 'array')
  || ' avg_rules=' || (select round(avg((select count(*) from jsonb_object_keys(rules))), 1) from vi_random)
  || ' reasons=' || (select coalesce(string_agg(distinct platform_private.cms_block_rules_violation(nodes, rules)->>'reason', ','), '') from vi_random));
select is((select pg_catalog.count(*)::integer from vi_random where pg_temp.old_violation(nodes, rules) is distinct from platform_private.cms_block_rules_violation(nodes, rules)), 0,
  'block rules: 400 seeded random forests answer exactly what the old body answered');
select ok((select pg_catalog.count(*) filter (where platform_private.cms_block_rules_violation(nodes, rules) is not null) > 25
              and pg_catalog.count(*) filter (where platform_private.cms_block_rules_violation(nodes, rules) is null) > 25 from vi_random),
  'block rules: the random forests hold both violating and clean cases (more than 25 of each)');
select ok((select pg_catalog.count(distinct platform_private.cms_block_rules_violation(nodes, rules)->>'reason') >= 3 from vi_random),
  'block rules: the random forests reach all three violation reasons (children, nodes, depth)');

-- ---------------------------------------------------------------- 3 + 4 resource and overrides on a real placement ----
do $fx$
declare v_base text;
begin
  v_base := pg_temp.g12pp_define_active('pp-three', (
    select jsonb_agg(pg_temp.s12pd_block('root' || r, jsonb_build_array(pg_temp.s12pd_block('c1', '[]'::jsonb, jsonb_build_object('title', 'c1-' || r)),
      pg_temp.s12pd_block('c2', '[]'::jsonb, jsonb_build_object('title', 'c2-' || r))), jsonb_build_object('title', 'root ' || r)) order by r)
      from generate_series(1, 3) r));
  insert into s12pl_ids(key, value) values ('three', v_base);
end;
$fx$;
select pg_temp.s12pl_entry('ov');
create or replace function pg_temp.pp_place_req(p_tag text, p_pattern_label text, p_idem text, p_overrides jsonb) returns jsonb language sql stable as $b$
  select jsonb_build_object('revisionId', pg_temp.s12pl_rev(p_tag), 'patternId', pg_temp.g12p_body(p_pattern_label)->'patternId',
    'patternVersion', pg_temp.g12p_body(p_pattern_label)->'patternVersion', 'linkMode', 'linked', 'slotPath', '/',
    'overrides', p_overrides, 'expectedVersion', pg_temp.s12pl_version(p_tag), 'ifMatch', pg_temp.s12pl_version(p_tag),
    'idempotencyKey', p_idem, 'correlationId', 'a9120000-0000-4000-8000-00000000c0c0') $b$;
select pg_temp.g12p_call('ovplace', 'platform_api.cms_insert_pattern_instance', 'owner',
  pg_temp.pp_place_req('ov', (select value from s12pl_ids where key = 'three'), 'pp-equivalence-override-0001',
    '{"/root1/c1":{"title":"X"},"/root3":{"title":"Z"},"/root3/c2":{"title":"Y"}}'::jsonb), pg_temp.g12pp_ctx('owner'));
select is(pg_temp.g12p_out('ovplace#1'), 'ok', 'overrides: the placement with overrides succeeds');
select is((select jsonb_array_length(body->'items') from g12p_rcpt where label = 'ovplace#1'), 3, 'overrides: three rows, one per block root');
select is((select props from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('ov') and path = '/root1'),
  '{"/root1/c1":{"title":"X"}}'::jsonb, 'overrides: /root1 carries only the override addressing its own subtree');
select is((select props from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('ov') and path = '/root2'),
  '{}'::jsonb, 'overrides: /root2 carries no override');
select is((select props from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('ov') and path = '/root3'),
  '{"/root3":{"title":"Z"},"/root3/c2":{"title":"Y"}}'::jsonb, 'overrides: /root3 carries the override of the root and of its child');
select is((select pg_catalog.count(*)::integer from platform_private.cms_composition_instances where revision_id = pg_temp.s12pl_rev('ov')), 3,
  'overrides: exactly three rows were written');
-- 3 resource: the response items are the projection of the stored rows
select is((select jsonb_agg(pg_temp.old_resource(i) order by i.position) from platform_private.cms_composition_instances i where i.revision_id = pg_temp.s12pl_rev('ov')),
          (select body->'items' from g12p_rcpt where label = 'ovplace#1'),
  'resource: the placement response equals the OLD projection of the stored rows, element for element');
-- a detached row with a canonical tree and one with a null tree (direct fixtures)
select pg_temp.s12pl_entry('dt');
do $fx$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_composition_instances(id, owner_id, state, version, revision_id, path, slot_key, block_key,
    block_version, block_registry_digest, link_mode, created_by, position, props, bindings, detached_tree)
  values (extensions.gen_random_uuid(), pg_temp.s09d_id('ownerOrg'), 'active', 1, pg_temp.s12pl_rev('dt'), '/d1', 'main', 's12pd.block', 1,
    repeat('b', 64), 'detached', (select auth_user_id from s09d_actor where key = 'owner'), 0, '{"title":"t"}', '{}', null),
    (extensions.gen_random_uuid(), pg_temp.s09d_id('ownerOrg'), 'active', 1, pg_temp.s12pl_rev('dt'), '/d2', 'main', 's12pd.block', 1,
    repeat('c', 64), 'detached', (select auth_user_id from s09d_actor where key = 'owner'), 1, '{}', '{"n":1.50}',
    '{"format":"cms.detached_tree.v1","nodes":[{"parent":null,"keySegments":["d2"],"blockKey":"s12pd.block","blockVersion":1,"props":{"title":"a"}}]}');
end;
$fx$;
select is((select pg_catalog.count(*)::integer from platform_private.cms_composition_instances i
            where i.owner_id = pg_temp.s09d_id('ownerOrg')
              and (pg_temp.old_resource(i) is distinct from platform_private.cms_composition_instance_resource(i)
                or pg_temp.old_resource(i) is distinct from platform_private.cms_composition_instance_resource_hashed(
                     i, platform_private.cms_jcs_sha256(platform_private.cms_composition_instance_content(i))))), 0,
  'resource: for every stored row (linked with overrides, detached with null tree, detached with canonical tree) old = new = hashed projection');
select ok((select pg_catalog.count(*) >= 9 from platform_private.cms_composition_instances where owner_id = pg_temp.s09d_id('ownerOrg')),
  'resource: the comparison covered at least nine rows of the three kinds');
select isnt(platform_private.cms_composition_instance_resource_hashed(
    (select i from platform_private.cms_composition_instances i where i.path = '/d1'), repeat('0', 64)) ->> 'contentHash',
  platform_private.cms_composition_instance_resource((select i from platform_private.cms_composition_instances i where i.path = '/d1')) ->> 'contentHash',
  'resource: the hashed projection reports the hash it is given, not a recomputed one');

-- ---------------------------------------------------------------- 5 attributes ----
select is((select pg_catalog.count(*)::integer from pg_catalog.pg_proc p
            where p.oid = any (array[
              'platform_private.cms_pattern_placement_path_allocation(uuid,text,text,jsonb)'::regprocedure,
              'platform_private.cms_block_rules_violation(jsonb,jsonb)'::regprocedure,
              'platform_private.cms_revision_effective_state(uuid)'::regprocedure,
              'platform_private.cms_composition_instance_resource(platform_private.cms_composition_instances)'::regprocedure,
              'platform_private.cms_composition_instance_resource_hashed(platform_private.cms_composition_instances,text)'::regprocedure,
              'platform_private.cms_insert_pattern_instance(jsonb)'::regprocedure])
              and p.proowner = 'wejammin_cms_definer'::regrole
              and p.proconfig = array['search_path=""']::text[]
              and not pg_catalog.has_function_privilege('anon', p.oid, 'execute')
              and not pg_catalog.has_function_privilege('authenticated', p.oid, 'execute')
              and not pg_catalog.has_function_privilege('service_role', p.oid, 'execute')
              and pg_catalog.obj_description(p.oid, 'pg_proc') is not null), 6,
  'attributes: the five changed functions and the new hashed projection are owned by the CMS definer, keep an empty search_path, have no API-role grant and keep a comment');
select is((select (case when p.prosecdef then 't' else 'f' end) || p.provolatile::text from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_composition_instance_resource_hashed(platform_private.cms_composition_instances,text)'::regprocedure),
  'ts', 'attributes: the hashed projection is SECURITY DEFINER and STABLE like its sibling');
select is((select (case when p.prosecdef then 't' else 'f' end) || p.provolatile::text from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_pattern_placement_path_allocation(uuid,text,text,jsonb)'::regprocedure),
  'fs', 'attributes: the allocation stays SECURITY INVOKER and STABLE');
select is((select (case when p.prosecdef then 't' else 'f' end) || p.provolatile::text from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_block_rules_violation(jsonb,jsonb)'::regprocedure),
  'fi', 'attributes: the block rules check stays SECURITY INVOKER and IMMUTABLE');
select is((select (case when p.prosecdef then 't' else 'f' end) || p.provolatile::text from pg_catalog.pg_proc p where p.oid = 'platform_private.cms_revision_effective_state(uuid)'::regprocedure),
  'ts', 'attributes: the single-revision derived state stays SECURITY DEFINER and STABLE');

select * from finish();
rollback;
