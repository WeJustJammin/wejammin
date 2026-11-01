-- Slice 12 gap lane claude_s12_gaps_db2: P2-S12-AC-276 (BE03c "Slice 12 lock order", row "CMS-03C-01, CMS-03C-12, CMS-03C-16": 1 the caller's
-- designer or curator grant rows FOR SHARE; 3 the parent version row FOR UPDATE; 4 the content-type version rows the definition names FOR SHARE).
-- Review V13-05 / root decision 2026-10-28: CMS-03C-01 and CMS-03C-16 take position 4 after positions 1 and 3; CMS-03C-12 already does.
-- STATIC source-order oracle in the style of phase_02_slice_12_gaps_lock_sources.sql (comments stripped, whitespace collapsed, FIRST occurrence
-- of each anchor strictly increasing) with a reversed-anchor control per writer, plus the two cheapest dynamic facts a source scan cannot give:
-- the lock covers the rows the definition NAMES (each writer's lock statement reads the request's own list) and the compatibility is proved
-- again under the lock.  Two simultaneous sessions are phase_02_slice_12_gaps_lock_position4_race.sql.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

create or replace function pg_temp.g2_src(p_proc text) returns text language sql stable as $body$
  select pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.regexp_replace(prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
    from pg_catalog.pg_proc where oid = pg_catalog.to_regprocedure(p_proc)
$body$;
create or replace function pg_temp.g2_ordered(p_src text, p_anchors text[]) returns boolean language plpgsql immutable as $body$
declare previous integer := 0; anchor text; at_pos integer;
begin
  if p_src is null then return false; end if;
  foreach anchor in array p_anchors loop
    at_pos := pg_catalog.strpos(p_src, pg_catalog.lower(anchor));
    if at_pos = 0 or at_pos <= previous then return false; end if;
    previous := at_pos;
  end loop;
  return true;
end;
$body$;
-- the number of occurrences of p_needle in p_src
create or replace function pg_temp.g2_count(p_src text, p_needle text) returns integer language sql immutable as $body$
  select (pg_catalog.length(p_src) - pg_catalog.length(pg_catalog.replace(p_src, pg_catalog.lower(p_needle), ''))) / pg_catalog.length(p_needle)
$body$;
-- true when the position-4 lock statement (from its FROM to its FOR SHARE clause) mentions p_needle: it reads the writer's own list of named types
create or replace function pg_temp.g2_lock_names(p_src text, p_needle text) returns boolean language sql immutable as $body$
  select pg_catalog.strpos(p_src, 'from platform_private.cms_content_type_versions version_row') > 0
     and pg_catalog.strpos(p_src, 'for share of version_row') > pg_catalog.strpos(p_src, 'from platform_private.cms_content_type_versions version_row')
     and pg_catalog.strpos(pg_catalog.substr(p_src, pg_catalog.strpos(p_src, 'from platform_private.cms_content_type_versions version_row'),
           pg_catalog.strpos(p_src, 'for share of version_row') - pg_catalog.strpos(p_src, 'from platform_private.cms_content_type_versions version_row')),
         pg_catalog.lower(p_needle)) > 0
$body$;

-- ---- CMS-03C-01 define: 1 grant rows, 3 parent row FOR UPDATE, 4 content type version rows FOR SHARE, then the draft insert
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['cms_lock_governed_authority(', 'limit 1 for update', 'for share of version_row', 'insert into platform_private.cms_template_versions']),
  'CMS-03C-01 takes the designer grant rows (1), the parent version row (3) and the named content type version rows FOR SHARE (4) before it writes [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['for share of version_row', 'limit 1 for update', 'cms_lock_governed_authority(']),
  'control: the reversed CMS-03C-01 order is rejected by the detector [P2-S12-AC-276]');
select is(pg_temp.g2_count(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'), 'for share of version_row'), 1,
  'CMS-03C-01 has exactly one position-4 lock statement [P2-S12-AC-276]');
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'),
    array['for share of version_row', 'raise exception ''validation_failed'' using errcode = ''p0001''; end if; new_row_id :=']),
  'CMS-03C-01 proves the compatibility again under the position-4 lock, before the new row id exists [P2-S12-AC-276]');
select ok(pg_temp.g2_lock_names(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'), 'definition->''compatibleTypeIds'''),
  'CMS-03C-01 locks the version rows of the types the definition names (compatibleTypeIds) [P2-S12-AC-276]');
select ok(not pg_temp.g2_lock_names(pg_temp.g2_src('platform_private.cms_define_template(jsonb)'), 'allowedTypeKeys'),
  'control: the lock-statement detector rejects a list the writer does not read [P2-S12-AC-276]');

-- ---- CMS-03C-12 pattern create: 1, 3 (parent FOR UPDATE, nested FOR SHARE), 4, then the draft insert (already in the promoted source)
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'),
    array['cms_lock_governed_authority(', 'limit 1 for update', 'for share of version_row', 'insert into platform_private.cms_pattern_versions']),
  'CMS-03C-12 takes the grant rows (1), the parent and nested rows (3) and the named content type version rows FOR SHARE (4) before it writes [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'),
    array['insert into platform_private.cms_pattern_versions', 'for share of version_row', 'limit 1 for update', 'cms_lock_governed_authority(']),
  'control: the reversed CMS-03C-12 order is rejected by the detector [P2-S12-AC-276]');
select ok(pg_temp.g2_lock_names(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'), 'v_types') and pg_temp.g2_count(pg_temp.g2_src('platform_private.cms_create_pattern_version(jsonb)'), 'for share of version_row') = 1,
  'CMS-03C-12 has exactly one position-4 lock statement, over the types its own compatibleTypeIds name [P2-S12-AC-276]');

-- ---- CMS-03C-16 taxonomy create: 1 curator grant rows, 3 parent row FOR UPDATE, 4 content type version rows FOR SHARE, then the draft insert
select ok(pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_taxonomy_version(jsonb)'),
    array['cms_lock_governed_authority(', 'limit 1 for update', 'for share of version_row', 'insert into platform_private.cms_taxonomy_versions']),
  'CMS-03C-16 takes the curator grant rows (1), the parent version row (3) and the named content type version rows FOR SHARE (4) before it writes [P2-S12-AC-276]');
select ok(not pg_temp.g2_ordered(pg_temp.g2_src('platform_private.cms_create_taxonomy_version(jsonb)'),
    array['for share of version_row', 'limit 1 for update', 'cms_lock_governed_authority(']),
  'control: the reversed CMS-03C-16 order is rejected by the detector [P2-S12-AC-276]');
select is(pg_temp.g2_count(pg_temp.g2_src('platform_private.cms_create_taxonomy_version(jsonb)'), 'for share of version_row'), 1,
  'CMS-03C-16 has exactly one position-4 lock statement [P2-S12-AC-276]');
select ok(pg_temp.g2_lock_names(pg_temp.g2_src('platform_private.cms_create_taxonomy_version(jsonb)'), 'allowedTypeKeys'),
  'CMS-03C-16 locks the version rows of the types its allowedTypeKeys name [P2-S12-AC-276]');

select * from finish();
rollback;
