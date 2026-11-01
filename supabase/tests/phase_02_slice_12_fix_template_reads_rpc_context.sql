\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 12 FIX lane: cmsTemplateContextRead and cmsTemplateLatestRead on a request that begins the way
-- a real PostgREST request does, with NO RPC-context flag. Both private reads select from forced-RLS
-- CMS tables through a definer-owned function (SEC-2), whose policies admit a row only while
-- app.cms_rpc = 'true'; the reads never set it, so over the real API the context listed no content
-- type and the latest read answered NOT_FOUND for the caller's own template. Every earlier suite ran
-- in a transaction whose fixtures left the flag set, which is why none of them saw it. The wrappers
-- also restore the flag (SEC-2: an RPC does not leave the RPC-context flag set).
-- [P2-S12-AC-159] [P2-S12-AC-161] [P2-S12-AC-165] [P2-S12-AC-167]

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_12_fix/000-owners.sqlinc

select pg_temp.s12fix_as('A');
select pg_temp.s12fix_define(pg_temp.s12fix_req('A', 's12rls-own', 's12rls-a-own-0001'));
select pg_temp.s12fix_as('B');
select pg_temp.s12fix_define(pg_temp.s12fix_req('B', 's12rls-b-own', 's12rls-b-own-0001'));

create or replace function pg_temp.s12rls_context(p_owner text) returns jsonb
language sql as $body$
  select pg_temp.s12fix_try(format('select platform_api.cms_template_context(%L::jsonb)',
    jsonb_build_object('context', jsonb_build_object(
      'actingPartyId', (select value from s12fix_ids where key = 'org' || p_owner),
      'actingContextId', 'a9130000-0000-4000-8000-000000000001',
      'correlationId', 'a9130000-0000-4000-8000-000000000004'))::text))
$body$;

-- ---------------------------------------------------------------- latest read
select pg_temp.s12fix_as('A');
select set_config('app.cms_rpc', '', true);
create temp table s12rls_latest on commit drop as
select pg_temp.s12fix_latest('A', 's12rls-own') as outcome;
select is((select outcome->>'state' from s12rls_latest), '00000',
  'the latest read finds the caller''s own definition when the request starts without the RPC flag [P2-S12-AC-165]');
select is((select outcome->'response'->>'templateKey' from s12rls_latest), 's12rls-own',
  'it answers that definition, not an empty or foreign row [P2-S12-AC-165]');
select is(current_setting('app.cms_rpc', true), '',
  'the latest read does not leave the RPC-context flag set [P2-S12-AC-165]');

-- Another owner's key stays indistinguishable from an unused key on this path too.
select pg_temp.s12fix_as('B');
select set_config('app.cms_rpc', '', true);
create temp table s12rls_hidden on commit drop as
select pg_temp.s12fix_latest('B', 's12rls-own') as held,
       pg_temp.s12fix_latest('B', 's12rls-nobody') as unused;
select is((select held->>'message' from s12rls_hidden), 'NOT_FOUND',
  'owner B reading owner A''s key is NOT_FOUND [P2-S12-AC-167]');
select is((select held from s12rls_hidden), (select unused from s12rls_hidden),
  'and it is identical to an unused key [P2-S12-AC-167]');
select is(
  pg_temp.s12fix_latest('B', 's12rls-b-own')->>'state', '00000',
  'owner B still reads its own key on the same path [P2-S12-AC-167]');

-- ---------------------------------------------------------------- context read
select pg_temp.s12fix_as('A');
select set_config('app.cms_rpc', '', true);
create temp table s12rls_context on commit drop as
select pg_temp.s12rls_context('A') as outcome;
select is((select outcome->>'state' from s12rls_context), '00000',
  'the context read succeeds when the request starts without the RPC flag [P2-S12-AC-159]');
select is(
  (select outcome->'response'->'contentTypes'->0->>'id' from s12rls_context),
  (select value from s12fix_ids where key = 'typeA'),
  'it lists the caller owner''s active compiled content type [P2-S12-AC-159]');
select is(
  (select jsonb_array_length(outcome->'response'->'contentTypes') from s12rls_context), 1,
  'and only that one: no content type of another owner [P2-S12-AC-159]');
select is(current_setting('app.cms_rpc', true), '',
  'the context read does not leave the RPC-context flag set [P2-S12-AC-161]');

select finish();
rollback;
