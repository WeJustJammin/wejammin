-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-193 clause 2, BE03c "digest invariants": the block registry digest folds the
-- deduplicated reachable tuples ordered by key (byte order) THEN NUMERIC blockVersion.  The earlier SQL cases use versions 1 and 2
-- only, which a text sort orders identically; here one key is registered at versions 1, 2 and 10 (a text sort puts 10 before 2) and
-- both production digest functions - cms_governed_current_digest (pattern branch) and cms_template_block_digest (CMS-03C-01 and the
-- governed template branch) - must fold [.. @1, .. @2, .. @10].  Real signed CMS-03A-05 registrations; expected values are built
-- independently from the stored rows, never from the function under test.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.template_designer'), 'OK',
  'setup: owner holds the designer authority the registered blocks are owned under');
select pg_temp.p_register('gapd:a1', pg_temp.p_block_request('gapd.a', 1));
select pg_temp.p_register('gapd:b1', pg_temp.p_block_request('gapd.b', 1));
select pg_temp.p_register('gapd:b2', pg_temp.p_block_request('gapd.b', 2));
select pg_temp.p_register('gapd:b10', pg_temp.p_block_request('gapd.b', 10));
select is((select string_agg(pg_temp.s09d_outcome(label), ',' order by label)
             from (values ('gapd:a1'), ('gapd:b1'), ('gapd:b10'), ('gapd:b2')) v(label)),
  'OK,OK,OK,OK', 'setup: gapd.b is registered at versions 1, 2 and 10 and gapd.a at version 1 through the signed production command');

create temp table gapd_owner(id uuid) on commit drop;
insert into gapd_owner select pg_temp.s09d_id('ownerOrg');
create or replace function pg_temp.gapd_tuple(p_key text, p_version integer) returns jsonb
language sql stable as $body$
  select jsonb_build_object('blockKey', b.block_key, 'blockVersion', b.block_version,
    'releaseDigest', pg_catalog.btrim(b.release_digest::text), 'propsSchemaHash', pg_catalog.btrim(b.props_schema_hash::text),
    'rendererRef', b.renderer_ref, 'lifecycle', 'supported')
    from platform_private.cms_block_definition_versions b
   where b.block_key = p_key and b.block_version = p_version
$body$;
create or replace function pg_temp.gapd_node(p_key text, p_version integer) returns jsonb
language sql immutable as $body$
  select jsonb_build_object('kind', 'block', 'key', 'k' || replace(p_key, '.', '') || p_version, 'blockKey', p_key,
    'blockVersion', p_version, 'children', '[]'::jsonb)
$body$;
-- Run a digest call inside the RPC context the producers set first; a raise becomes a comparable value.
create or replace function pg_temp.gapd_digest(p_sql text) returns text
language plpgsql volatile as $body$
declare prior text := coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''); result text;
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  begin
    execute p_sql into result;
  exception when others then
    result := 'RAISED ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_catalog.set_config('app.cms_rpc', prior, true);
  return result;
end;
$body$;

-- control: the stored rows really carry versions 1, 2 and 10 as integers (a text sort would put 10 before 2)
select is((select array_agg(block_version order by block_version) from platform_private.cms_block_definition_versions
            where block_key = 'gapd.b'), array[1, 2, 10],
  'control: gapd.b holds the integer versions 1, 2 and 10 in numeric order');
select is((select array_agg(block_version::text order by block_version::text) from platform_private.cms_block_definition_versions
            where block_key = 'gapd.b'), array['1', '10', '2'],
  'control: the same versions sorted as text would fold 10 before 2, so the numeric order below is observable');

-- ---- pattern branch (cms_governed_current_digest)
select is(
  pg_temp.gapd_digest(format('select platform_private.cms_governed_current_digest(%L, %L::uuid, %L::jsonb)',
    'pattern_version', (select id from gapd_owner), jsonb_build_object('blockTree', jsonb_build_array(
      pg_temp.gapd_node('gapd.b', 10), pg_temp.gapd_node('gapd.a', 1), pg_temp.gapd_node('gapd.b', 2),
      pg_temp.gapd_node('gapd.b', 1)))::text)),
  platform_private.cms_jcs_sha256(jsonb_build_array(
    pg_temp.gapd_tuple('gapd.a', 1), pg_temp.gapd_tuple('gapd.b', 1), pg_temp.gapd_tuple('gapd.b', 2), pg_temp.gapd_tuple('gapd.b', 10))),
  'the pattern digest folds one key at versions 1, 2 and 10 in numeric order, not text order [P2-S12-AC-193]');
select isnt(
  pg_temp.gapd_digest(format('select platform_private.cms_governed_current_digest(%L, %L::uuid, %L::jsonb)',
    'pattern_version', (select id from gapd_owner), jsonb_build_object('blockTree', jsonb_build_array(
      pg_temp.gapd_node('gapd.b', 10), pg_temp.gapd_node('gapd.a', 1), pg_temp.gapd_node('gapd.b', 2),
      pg_temp.gapd_node('gapd.b', 1)))::text)),
  platform_private.cms_jcs_sha256(jsonb_build_array(
    pg_temp.gapd_tuple('gapd.a', 1), pg_temp.gapd_tuple('gapd.b', 1), pg_temp.gapd_tuple('gapd.b', 10), pg_temp.gapd_tuple('gapd.b', 2))),
  'the pattern digest is not the text-order fold [.. @1, .. @10, .. @2] [P2-S12-AC-193]');
select is(
  pg_temp.gapd_digest(format('select platform_private.cms_governed_current_digest(%L, %L::uuid, %L::jsonb)',
    'pattern_version', (select id from gapd_owner), jsonb_build_object('blockTree', jsonb_build_array(
      pg_temp.gapd_node('gapd.b', 1), pg_temp.gapd_node('gapd.b', 2), pg_temp.gapd_node('gapd.b', 10),
      pg_temp.gapd_node('gapd.a', 1)))::text)),
  pg_temp.gapd_digest(format('select platform_private.cms_governed_current_digest(%L, %L::uuid, %L::jsonb)',
    'pattern_version', (select id from gapd_owner), jsonb_build_object('blockTree', jsonb_build_array(
      pg_temp.gapd_node('gapd.a', 1), pg_temp.gapd_node('gapd.b', 10), pg_temp.gapd_node('gapd.b', 1),
      pg_temp.gapd_node('gapd.b', 2)))::text)),
  'the pattern digest does not depend on the node order of the tree [P2-S12-AC-193]');

-- ---- template branch (cms_template_block_digest and the governed template branch)
select is(
  pg_temp.gapd_digest(format('select platform_private.cms_template_block_digest(%L::jsonb, %L::jsonb, %L::uuid)',
    jsonb_build_array(jsonb_build_object('key', 'main', 'required', true, 'maxCount', 1, 'allowedBlocks', jsonb_build_array(
      jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 10), jsonb_build_object('blockKey', 'gapd.a', 'blockVersion', 1),
      jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 2), jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 1))))::text,
    '[]', (select id from gapd_owner))),
  platform_private.cms_jcs_sha256(jsonb_build_array(
    pg_temp.gapd_tuple('gapd.a', 1), pg_temp.gapd_tuple('gapd.b', 1), pg_temp.gapd_tuple('gapd.b', 2), pg_temp.gapd_tuple('gapd.b', 10))),
  'the template digest folds one key at versions 1, 2 and 10 in numeric order, not text order [P2-S12-AC-193]');
select is(
  pg_temp.gapd_digest(format('select platform_private.cms_governed_current_digest(%L, %L::uuid, %L::jsonb)',
    'template_version', (select id from gapd_owner), jsonb_build_object('typeIds', '[]'::jsonb, 'slots', jsonb_build_array(
      jsonb_build_object('key', 'main', 'required', true, 'maxCount', 1, 'allowedBlocks', jsonb_build_array(
      jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 10), jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 2),
      jsonb_build_object('blockKey', 'gapd.a', 'blockVersion', 1)))))::text)),
  platform_private.cms_jcs_sha256(jsonb_build_array(
    pg_temp.gapd_tuple('gapd.a', 1), pg_temp.gapd_tuple('gapd.b', 2), pg_temp.gapd_tuple('gapd.b', 10))),
  'the governed template branch delegates to the same numeric fold (versions 2 and 10) [P2-S12-AC-193]');
select isnt(
  pg_temp.gapd_digest(format('select platform_private.cms_template_block_digest(%L::jsonb, %L::jsonb, %L::uuid)',
    jsonb_build_array(jsonb_build_object('key', 'main', 'required', true, 'maxCount', 1, 'allowedBlocks', jsonb_build_array(
      jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 2), jsonb_build_object('blockKey', 'gapd.b', 'blockVersion', 10))))::text,
    '[]', (select id from gapd_owner))),
  platform_private.cms_jcs_sha256(jsonb_build_array(pg_temp.gapd_tuple('gapd.b', 10), pg_temp.gapd_tuple('gapd.b', 2))),
  'the template digest is not the text-order fold [.. @10, .. @2] [P2-S12-AC-193]');

select * from finish();
rollback;
