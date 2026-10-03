\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (re-audit AC098, DB WEAK): "CMS-03A-04 never mutates a previously
-- active version; the old active version remains readable until the switch
-- commits."  The earlier proof read only state = 'active' after a refused
-- switch.  Here the whole old row is compared before and after every refused
-- switch (stale CAS, unapproved candidate, replayed key after commit), the old
-- version is read through CMS-03A-08 before the switch commits, and the
-- committed switch is shown to move the previous version by exactly its one
-- supersession (state and CAS version) and to leave every other column and every
-- other row of the type untouched.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.r8u_row(p_tag text) returns text language sql stable as $body$
  select t::text from platform_private.cms_content_type_versions t where t.id = pg_temp.s09d_id(p_tag || ':version') $body$;
create or replace function pg_temp.r8u_row_without_state(p_tag text) returns text language sql stable as $body$
  select (to_jsonb(t) - 'state' - 'version')::text from platform_private.cms_content_type_versions t where t.id = pg_temp.s09d_id(p_tag || ':version') $body$;
create or replace function pg_temp.r8u_read(p_label text, p_tag text) returns jsonb language plpgsql as $body$
begin
  perform pg_temp.s09d_session('owner');
  return pg_temp.s09d_call(p_label, 'platform_api.cms_get_content_type_version',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'),
      'context', pg_temp.s09d_context('owner')));
end;
$body$;

select pg_temp.s09d_create_type('a', 'r8unmutated');
select pg_temp.s09d_to_active('a');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'active', 'fixture: version 1 is active through the real chain [P2-S09-AC-098]');
select pg_temp.s09d_successor('b', 'a');
create temp table r8u_old on commit drop as select pg_temp.r8u_row('a') as whole, pg_temp.r8u_row_without_state('a') as stable_columns;

-- refused switch 1: the candidate is a draft, not approved
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-draft');
select ok(pg_temp.s09d_outcome('b:activate-draft') in ('CONFLICT', 'VALIDATION_FAILED', 'APPROVAL_INVALID', 'INVALID_REQUEST'),
  'an unapproved candidate cannot be switched in (' || pg_temp.s09d_outcome('b:activate-draft') || ') [P2-S09-AC-098]');
select is(pg_temp.r8u_row('a'), (select whole from r8u_old),
  'the refused switch left the previously active row byte-identical: every column, including version and updated_at [P2-S09-AC-098]');

select pg_temp.s09d_to_review('b');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_decide('b', 'rev1');
-- refused switch 2: a stale expected version
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-stale', jsonb_build_object('expectedVersion', '999'));
select is(pg_temp.s09d_outcome('b:activate-stale'), 'VERSION_MISMATCH', 'a stale candidate CAS version is refused with VERSION_MISMATCH [P2-S09-AC-098]');
select is(pg_temp.r8u_row('a'), (select whole from r8u_old),
  'the second refused switch also left the previously active row byte-identical [P2-S09-AC-098]');

-- the old version is readable, as active, until the switch commits
select pg_temp.r8u_read('a:read:before', 'a');
select ok(pg_temp.s09d_outcome('a:read:before') = 'OK'
    and pg_temp.s09d_resp('a:read:before')->'resource'->>'state' = 'active',
  'before the switch commits the previously active version is readable through CMS-03A-08 as active [P2-S09-AC-098]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('b:version')), 'approved',
  'and the candidate is still only approved: it does not serve before the switch [P2-S09-AC-098]');

-- the committed switch
select pg_temp.s09d_activate('b');
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'the approved candidate is switched in [P2-S09-AC-098]');
select ok(pg_temp.r8u_row_without_state('a') = (select stable_columns from r8u_old)
    and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')) = 'superseded',
  'the commit moved the previous version by its supersession alone: every other column, its definition, locale configuration and evidence, is untouched [P2-S09-AC-098]');
select ok(pg_temp.s09d_read('cms_content_type_versions', 'version', pg_temp.s09d_id('a:version'))::bigint
    = (select (regexp_match((select whole from r8u_old), '^\([^,]*,[^,]*,[a-z]+,(\d+),'))[1]::bigint) + 1,
  'its CAS version advanced exactly once, by the supersession [P2-S09-AC-098]');
select pg_temp.r8u_read('a:read:after', 'a');
select ok(pg_temp.s09d_outcome('a:read:after') = 'OK' and pg_temp.s09d_resp('a:read:after')->'resource'->>'state' = 'superseded',
  'after the commit the previous version stays readable, now as superseded [P2-S09-AC-098]');
select is((select count(*)::integer from platform_private.cms_content_type_versions
            where content_type_id = pg_temp.s09d_id('a:type') and state = 'active'), 1,
  'exactly one version of the type is active after the switch [P2-S09-AC-098]');
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate-replay');
select is(pg_temp.r8u_row_without_state('a'), (select stable_columns from r8u_old),
  'a replayed activation after the commit does not touch the superseded version again [P2-S09-AC-098]');

select * from finish();
rollback;
