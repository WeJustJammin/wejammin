\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 12 FIX lane, CMS-03C-01 and cmsTemplateLatestRead: BE03c E14 (a template key is unique
-- PER OWNER and another owner's key is indistinguishable from an unused one), the lineage id
-- (templateId) and the owner-scoped latest read. Runs against the rolled-back Slice 10 fixtures
-- plus a second organization (owner B). [P2-S12-AC-022] [P2-S12-AC-190] [P2-S12-AC-191]
-- [P2-S12-AC-006] [P2-S12-AC-166] [P2-S12-AC-167]

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_fix/000-owners.sqlinc

-- ---------------------------------------------------------------- catalog shape --
select ok(
  not exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'platform_private.cms_template_versions'::regclass
       and conname = 'cms_template_versions_key_version_unique'),
  'E14: the global UNIQUE (template_key, version) is gone [P2-S12-AC-190]');
select is(
  (select pg_catalog.array_agg(att.attname::text order by k.ord)
     from pg_catalog.pg_constraint con
     cross join lateral unnest(con.conkey) with ordinality k(attnum, ord)
     join pg_catalog.pg_attribute att
       on att.attrelid = con.conrelid and att.attnum = k.attnum
    where con.conrelid = 'platform_private.cms_template_versions'::regclass
      and con.contype = 'u' and con.conname = 'cms_template_versions_owner_key_version_unique'),
  array['owner_id', 'template_key', 'version'],
  'E14: UNIQUE (owner_id, template_key, version) is the key constraint [P2-S12-AC-190]');
select is(
  (select att.attnotnull and format_type(att.atttypid, att.atttypmod) = 'uuid'
     from pg_catalog.pg_attribute att
    where att.attrelid = 'platform_private.cms_template_versions'::regclass
      and att.attname = 'template_id' and not att.attisdropped),
  true,
  'the lineage id template_id is a NOT NULL uuid [P2-S12-AC-191]');
select ok(
  exists (
    select 1 from pg_catalog.pg_indexes
     where schemaname = 'platform_private' and tablename = 'cms_template_versions'
       and indexdef ilike '%unique%(template_id)%where%state%active%'),
  'at most one active version per lineage: partial UNIQUE (template_id) WHERE state = active [P2-S12-AC-191]');
select ok(
  exists (
    select 1 from pg_catalog.pg_constraint
     where conrelid = 'platform_private.cms_template_versions'::regclass
       and contype = 'u' and conname = 'cms_template_versions_lineage_version_unique'),
  'a version number is unique within its lineage [P2-S12-AC-191]');

-- ---------------------------------------------------------------- owner A defines --
select pg_temp.s12fix_as('A');
create temp table s12fix_a1 on commit drop as
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-shared', 's12fix-a-shared-0001')) as outcome;
select is((select outcome->>'state' from s12fix_a1), '00000',
  'owner A defines version 1 of a key');
select is(
  (select outcome->'response'->>'templateId' from s12fix_a1),
  (select outcome->'response'->>'id' from s12fix_a1),
  'a first version is its own lineage: templateId equals the version-1 id [P2-S12-AC-191]');

-- ---------------------------------------------------------------- owner B, same key --
select pg_temp.s12fix_as('B');
create temp table s12fix_b1 on commit drop as
select pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12fix-shared', 's12fix-b-shared-0001')) as outcome;
select is((select outcome->>'state' from s12fix_b1), '00000',
  'E14: owner B defines version 1 of the SAME key without a conflict [P2-S12-AC-190]');
select is((select outcome->'response'->>'version' from s12fix_b1), '1',
  'E14: owner B starts its own lineage at version 1 [P2-S12-AC-190]');
select isnt(
  (select outcome->'response'->>'templateId' from s12fix_b1),
  (select outcome->'response'->>'templateId' from s12fix_a1),
  'the same key under a different owner has a different lineage [P2-S12-AC-191]');
select is(
  (select pg_catalog.array_agg(owner_id::text order by owner_id::text)
     from platform_private.cms_template_versions where template_key = 's12fix-shared'),
  (select pg_catalog.array_agg(value order by value)
     from s12fix_ids where key in ('orgA', 'orgB')),
  'both owners hold their own row for the shared key [P2-S12-AC-190]');

-- Owner B collides only with ITS OWN definitions (a second first-create is the CAS conflict).
create temp table s12fix_b_dup on commit drop as
select pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12fix-shared', 's12fix-b-shared-0002')) as outcome;
select is(
  (select outcome->>'state' || ':' || (outcome->>'message') from s12fix_b_dup),
  'P0001:CONFLICT',
  'owner B re-creating its own key with expectedVersion null is a CONFLICT [P2-S12-AC-190]');

-- ----------------------------------------- non-disclosure of another owner's key --
-- Owner B names a key only owner A holds as a SUCCESSOR, and a key nobody holds: the refusals
-- must be byte-identical (SQLSTATE, message, DETAIL, constraint).
select pg_temp.s12fix_as('A');
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-a-only', 's12fix-a-only-0001'));
select pg_temp.s12fix_as('B');
create temp table s12fix_hidden on commit drop as
select pg_temp.s12fix_define(
         pg_temp.s12fix_req('B', 's12fix-a-only', 's12fix-b-succ-held-0001', '1')) as held,
       pg_temp.s12fix_define(
         pg_temp.s12fix_req('B', 's12fix-nobody', 's12fix-b-succ-unused-0001', '1')) as unused;
select is((select held->>'message' from s12fix_hidden), 'NOT_FOUND',
  'a successor of a key only another owner holds is NOT_FOUND [P2-S12-AC-006]');
select is((select held from s12fix_hidden), (select unused from s12fix_hidden),
  'a key held by another owner is indistinguishable from an unused key on a successor [P2-S12-AC-006] [P2-S12-AC-190]');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key in ('s12fix-a-only', 's12fix-nobody')
      and owner_id = (select value::uuid from s12fix_ids where key = 'orgB')),
  0,
  'the refused successor writes no row for owner B [P2-S12-AC-006]');

-- First-create of a key another owner holds is NOT a conflict (no existence signal).
create temp table s12fix_b_takes on commit drop as
select pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12fix-a-only', 's12fix-b-takes-0001')) as outcome;
select is((select outcome->>'state' from s12fix_b_takes), '00000',
  'owner B first-creating a key owner A holds succeeds, so no 409 leaks A''s key [P2-S12-AC-190]');

-- A stale CAS on owner B's own lineage never reveals owner A's newer version.
select pg_temp.s12fix_as('A');
create temp table s12fix_a2 on commit drop as
select pg_temp.s12fix_define(
  pg_temp.s12fix_req('A', 's12fix-shared', 's12fix-a-shared-0002', '1', 'members')) as outcome;
select is((select outcome->>'state' from s12fix_a2), '00000',
  'owner A defines the successor version 2');
select ok(
  (select outcome->'response'->>'templateId' from s12fix_a2) is not null
  and (select outcome->'response'->>'templateId' from s12fix_a2)
    = (select outcome->'response'->>'templateId' from s12fix_a1),
  'a successor carries the lineage of version 1 [P2-S12-AC-191]');
select is(
  (select newer.supersedes_id = older.id
     from platform_private.cms_template_versions newer
     join platform_private.cms_template_versions older
       on older.owner_id = newer.owner_id and older.template_key = newer.template_key
      and older.version = 1
    where newer.id = (select (outcome->'response'->>'id')::uuid from s12fix_a2)),
  true,
  'the successor names its same-owner parent through supersedes_id [P2-S12-AC-191]');
select pg_temp.s12fix_as('B');
create temp table s12fix_b_stale on commit drop as
select pg_temp.s12fix_define(
  pg_temp.s12fix_req('B', 's12fix-shared', 's12fix-b-shared-stale-0001', '2', 'members')) as outcome;
select is((select outcome->>'message' from s12fix_b_stale), 'CONFLICT',
  'owner B naming version 2 while it holds only version 1 is a CAS CONFLICT');
select is((select outcome->>'detail' from s12fix_b_stale), '',
  'the CAS refusal carries no DETAIL that could name the other owner''s version [P2-S12-AC-190]');
create temp table s12fix_b2 on commit drop as
select pg_temp.s12fix_define(
  pg_temp.s12fix_req('B', 's12fix-shared', 's12fix-b-shared-0003', '1', 'members')) as outcome;
select is((select outcome->'response'->>'version' from s12fix_b2), '2',
  'owner B advances its own lineage to version 2 independently of owner A [P2-S12-AC-190]');
select ok(
  (select outcome->'response'->>'templateId' from s12fix_b2) is not null
  and (select outcome->'response'->>'templateId' from s12fix_b2)
    = (select outcome->'response'->>'templateId' from s12fix_b1),
  'owner B''s successor stays in owner B''s lineage [P2-S12-AC-191]');

-- ------------------------------------------------------- latest read, owner scoped --
select pg_temp.s12fix_as('A');
create temp table s12fix_latest_a on commit drop as
select pg_temp.s12fix_latest('A', 's12fix-shared') as outcome;
select is((select outcome->'response'->>'version' from s12fix_latest_a), '2',
  'cmsTemplateLatestRead returns owner A''s latest version of the shared key [P2-S12-AC-167]');
select ok(
  (select outcome->'response'->>'templateId' from s12fix_latest_a) is not null
  and (select outcome->'response'->>'templateId' from s12fix_latest_a)
    = (select outcome->'response'->>'templateId' from s12fix_a1),
  'the latest read carries the lineage id [P2-S12-AC-191]');
select pg_temp.s12fix_as('B');
create temp table s12fix_latest_b on commit drop as
select pg_temp.s12fix_latest('B', 's12fix-shared') as outcome;
select ok(
  (select outcome->'response'->>'templateId' from s12fix_latest_b) is not null
  and (select outcome->'response'->>'templateId' from s12fix_latest_b)
    = (select outcome->'response'->>'templateId' from s12fix_b1),
  'owner B reads ITS OWN definition of the shared key, never owner A''s [P2-S12-AC-166]');
-- A key that only A holds ('s12fix-a-only' was taken by B above, so use a fresh A-only key).
select pg_temp.s12fix_as('A');
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-a-secret', 's12fix-a-secret-0001'));
select pg_temp.s12fix_as('B');
create temp table s12fix_latest_hidden on commit drop as
select pg_temp.s12fix_latest('B', 's12fix-a-secret') as held,
       pg_temp.s12fix_latest('B', 's12fix-nobody-holds-this') as unused;
select is((select held->>'message' from s12fix_latest_hidden), 'NOT_FOUND',
  'a latest read of a key only another owner holds is NOT_FOUND [P2-S12-AC-167]');
select is((select held from s12fix_latest_hidden), (select unused from s12fix_latest_hidden),
  'a key held by another owner is indistinguishable from an unused key on the latest read [P2-S12-AC-166] [P2-S12-AC-167]');

-- ---------------------------------------------------------- lineage guard (direct) --
select set_config('app.cms_rpc', 'true', true);
-- template_id is read through to_jsonb so the suite also runs (and fails per assertion) against a
-- schema that has no lineage column yet.
create temp table s12fix_rows on commit drop as
select owner_id, id, to_jsonb(v)->>'template_id' as template_id, version, template_key
  from platform_private.cms_template_versions v where template_key = 's12fix-shared';
select is(
  (select count(*)::integer from s12fix_rows where template_id is null), 0,
  'no row of the table has a null lineage id [P2-S12-AC-191]');
select is(
  (select outcome->'response'->>'templateId' from s12fix_a1),
  (select template_id from s12fix_rows
    where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 1),
  'the stored lineage id of version 1 is its own id [P2-S12-AC-191]');
select is(
  (select pg_temp.s12fix_clone(
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 1),
     's12fix-lineage-forged', null, 1, null,
     'a9130000-0000-4000-8000-0000000000ff')->>'state'),
  'P0001',
  'a first version whose template_id is not its own id is refused [P2-S12-AC-191]');
select is(
  (select pg_temp.s12fix_clone(
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 1),
     's12fix-shared', null, 3,
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 1),
     null)->>'state'),
  'P0001',
  'a successor that does not directly follow its parent version is refused [P2-S12-AC-191]');
select pg_temp.s12fix_as('A');
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12fix-xparent', 's12fix-a-xparent-0001'));
select is(
  (select pg_temp.s12fix_clone(
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgB') and version = 1),
     's12fix-xparent', null, 2,
     (select id from platform_private.cms_template_versions
       where template_key = 's12fix-xparent'
         and owner_id = (select value::uuid from s12fix_ids where key = 'orgA')),
     null)->>'state'),
  'P0001',
  'a successor naming another owner''s row as its parent is refused [P2-S12-AC-191]');
select is(
  (select pg_temp.s12fix_try(format(
     $u$update platform_private.cms_template_versions set template_id = %L::uuid where id = %L::uuid returning jsonb_build_object('id', id)$u$,
     'a9130000-0000-4000-8000-0000000000fe',
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 2)))->>'state'),
  'P0001',
  'the lineage id of a stored row can never change [P2-S12-AC-191]');
select is(
  (select pg_temp.s12fix_try(format(
     $u$update platform_private.cms_template_versions set owner_id = %L::uuid where id = %L::uuid returning jsonb_build_object('id', id)$u$,
     (select value from s12fix_ids where key = 'orgB'),
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 2)))->>'state'),
  'P0001',
  'the owner of a stored row can never change, so the per-owner key cannot be transplanted [P2-S12-AC-190]');

-- Two active versions in one lineage are impossible.
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_template_versions set state = 'active'
 where id = (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 1);
select is(
  (select pg_temp.s12fix_try(format(
     $u$update platform_private.cms_template_versions set state = 'active' where id = %L::uuid returning jsonb_build_object('id', id)$u$,
     (select id from s12fix_rows where owner_id = (select value::uuid from s12fix_ids where key = 'orgA') and version = 2)))->>'state'),
  '23505',
  'a second active version in the same lineage violates the partial unique index [P2-S12-AC-191]');

select finish();
rollback;
