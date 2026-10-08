-- Slice 10 CMS-03B-10 (EVIDENCE GAP EB-AC063, lane H production defect): the initial
-- assignment of the creator carries the capability the creator PROVED.
--
-- cms_create_entry admits an actor holding cms.author OR cms.editor (route policy
-- any_of) but inserted the creator assignment with capability_key hard-coded to
-- 'cms.author' and discarded the capability it had just proven.  Authority on an
-- existing entry needs an active grant AND an assignment of the SAME capability
-- (cms_authority_origin), so an editor-only creator could neither append (CMS-03B-01)
-- nor read the draft (CMS-03B-11) of the entry they had just created.  The create now
-- inserts the matched capability key that cms_require_entry_capability_locked returns.
--
-- The entries are created through the real command over a type produced by the real
-- Slice 09 producers; the actors are provisioned through CMS-03A-15.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(12);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc

select pg_temp.s09d_create_type('cap', 'capsrc');
select pg_temp.s09d_to_active('cap');

create or replace function pg_temp.s10c_create(p_label text, p_actor text)
returns jsonb language plpgsql as $body$
begin
  return pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_entry', p_actor,
    pg_temp.s09w_entry_request(p_label, 'cap', 'Capability ' || p_label));
end;
$body$;
create or replace function pg_temp.s10c_assigned(p_label text, p_actor text)
returns text language sql stable as $body$
  select string_agg(assignment.capability_key, ',' order by assignment.capability_key)
    from platform_private.cms_entry_assignments assignment
   where assignment.entry_id = (pg_temp.s09d_resp(p_label)->'entry'->>'id')::uuid
     and assignment.assignee_person_id = (select person_id from s09d_actor where key = p_actor)
     and assignment.state = 'active'
$body$;
create or replace function pg_temp.s10c_origin(p_label text, p_actor text, p_capability text)
returns boolean language plpgsql as $body$
declare result boolean;
begin
  perform set_config('app.cms_rpc', 'true', true);
  select platform_private.cms_authority_origin(
           (select auth_user_id from s09d_actor where key = p_actor),
           (select party_id from s09d_actor where key = p_actor),
           p_capability, (pg_temp.s09d_resp(p_label)->'entry'->>'id')::uuid) is not null
    into result;
  perform set_config('app.cms_rpc', '', true);
  return result;
end;
$body$;

-- ---------------------------------------------------- an editor-only creator ----
select pg_temp.s09d_grant_via_rpc('designer2', 'cms.editor', 1);
select pg_temp.s10c_create('editor-only', 'designer2');
select is(pg_temp.s09d_outcome('editor-only'), 'OK',
  'an actor holding only cms.editor creates an entry (route policy any_of cms.author/cms.editor)');
select is(pg_temp.s10c_assigned('editor-only', 'designer2'), 'cms.editor',
  'the creator''s initial assignment carries the capability they exercised: cms.editor');
select ok(pg_temp.s10c_origin('editor-only', 'designer2', 'cms.editor'),
  'the editor-only creator holds authority (grant + assignment) on the entry they just created');
select ok(not pg_temp.s10c_origin('editor-only', 'designer2', 'cms.author'),
  'and holds no authority they never had: not cms.author');

-- ------------------------------------------------------ an author-only creator ----
select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s10c_create('author-only', 'owner');
select is(pg_temp.s09d_outcome('author-only'), 'OK', 'an actor holding only cms.author creates an entry');
select is(pg_temp.s10c_assigned('author-only', 'owner'), 'cms.author',
  'the creator''s initial assignment carries cms.author');
select ok(pg_temp.s10c_origin('author-only', 'owner', 'cms.author'),
  'the author-only creator holds authority on the entry they just created');

-- ------------------------------------------------------------ an actor with both ----
select pg_temp.s09d_grant_via_rpc('owner', 'cms.editor', 1);
select pg_temp.s10c_create('both', 'owner');
select is(pg_temp.s09d_outcome('both'), 'OK', 'an actor holding both capabilities creates an entry');
select is(pg_temp.s10c_assigned('both', 'owner'), 'cms.author',
  'with both grants the creator is assigned the author capability (the first in the policy order)');
select ok(pg_temp.s10c_origin('both', 'owner', 'cms.author'),
  'the creator with both grants holds authority on the entry');

-- one assignment only: the create never double-assigns the creator
select is(
  (select count(*)::integer from platform_private.cms_entry_assignments assignment
    where assignment.entry_id = (pg_temp.s09d_resp('both')->'entry'->>'id')::uuid),
  1, 'the create inserts exactly one initial assignment');

-- a creator with neither capability is still refused
select pg_temp.s09d_revoke_via_rpc('designer2', 'cms.editor');
select pg_temp.s10c_create('neither', 'designer2');
select is(pg_temp.s09d_outcome('neither'), 'FORBIDDEN',
  'an actor with neither capability is still refused FORBIDDEN');

select * from finish();
rollback;
