commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-119 (CMS-03A-15) membership tenure start: a CONFIRMED membership
-- whose starts_on is after the current UTC date confers nothing yet.  Subject
-- eligibility for a grant and EVERY effective-capability predicate (the CMS
-- holds/require/read/origin/visibility/template predicates, the CFG predicate,
-- the organization actor predicate and the step-up designation) require
-- starts_on <= the current UTC date, exactly as they already require ends_on to
-- be unreached.  Issuance locks the subject's tenure row and rechecks it.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- A real confirmed membership of the owner organization that starts N days from today.
create or replace function pg_temp.s09t_member_starting(p_actor text, p_days integer) returns void language plpgsql as $body$
begin
  insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
    starts_on, accepted_at, actor_id, version)
  select pg_temp.s09d_id('ownerOrg'), subject.person_id, 'confirmed', 'invitation', 'ungoverned',
         current_date + p_days, clock_timestamp(), owner.person_id, 1
  from s09d_actor subject, s09d_actor owner where subject.key = p_actor and owner.key = 'owner';
end;
$body$;
-- Moves the tenure start of a REAL row (time travel only) with the user triggers off for one statement.
create or replace function pg_temp.s09t_warp_start(p_actor text, p_days integer) returns boolean language plpgsql as $body$
begin
  begin
    alter table identity_private.membership_tenure disable trigger user;
    update identity_private.membership_tenure
       set starts_on = current_date + p_days
     where organization_id = pg_temp.s09d_id('ownerOrg')
       and person_id = (select person_id from s09d_actor where key = p_actor);
    alter table identity_private.membership_tenure enable trigger user;
  exception when others then
    return false;
  end;
  return true;
end;
$body$;
create or replace function pg_temp.s09t_person(p_actor text) returns uuid language sql stable as $body$
  select person_id from s09d_actor where key = p_actor $body$;

select pg_temp.s09g_member('rev1');
select pg_temp.s09t_member_starting('rev2', 5);
select is((select starts_on from identity_private.membership_tenure
   where organization_id = pg_temp.s09d_id('ownerOrg') and person_id = pg_temp.s09t_person('rev2')), current_date + 5,
  'fixture: rev2 holds a confirmed membership that starts in five days');

-- ------------------------------------------------ grant subject eligibility ----
select ok(platform_private.cms_grant_subject_eligible(pg_temp.s09d_id('ownerOrg'), pg_temp.s09t_person('rev1')),
  'control: a member whose tenure started today is an eligible subject');
select ok(not platform_private.cms_grant_subject_eligible(pg_temp.s09d_id('ownerOrg'), pg_temp.s09t_person('rev2')),
  'a member whose tenure starts in the future is not an eligible subject');
select pg_temp.s09g_fingerprint() as before_fp \gset
select pg_temp.s09g_grant('t:future', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('t:future'), 'NOT_FOUND',
  'CMS-03A-15 refuses a future-start member as an indistinguishable 404 [P2-S09-AC-507]');
select is(pg_temp.s09g_fingerprint(), :'before_fp', 'the refused grant left no grant, event, projection, audit, outbox or idempotency row');
select ok(pg_temp.s09g_projection('rev2', 'cms.author') is null and not pg_temp.s09g_holds('rev2', 'cms.author'),
  'no actor-grant projection exists, so the future member holds nothing');
select pg_temp.s09g_grant('t:control', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('t:control'), 'OK', 'control: the same grant to a member whose tenure started is accepted');
-- The tenure start moves into the past: eligible (the boundary is inclusive).
select ok(pg_temp.s09t_warp_start('rev2', 0), 'fixture: the tenure start is today');
select pg_temp.s09g_grant('t:today', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('t:today'), 'OK', 'a tenure that starts today is eligible (starts_on <= today is inclusive)');

-- ------------------- every effective-capability predicate, member not yet started ----
select pg_temp.s09g_grant('t:designer', 'owner', 'rev1', 'cms.schema_designer', pg_temp.s09g_day(3));
select pg_temp.s09g_grant('t:template', 'owner', 'rev1', 'cms.template_designer', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('t:designer') || pg_temp.s09d_outcome('t:template'), 'OKOK',
  'fixture: rev1 holds cms.author, cms.schema_designer and cms.template_designer through CMS-03A-15');
create or replace function pg_temp.s09t_predicates(p_actor text) returns text language plpgsql as $body$
declare
  org uuid := pg_temp.s09d_id('ownerOrg');
  actor_id uuid := (select auth_user_id from s09d_actor where key = p_actor);
  person uuid := pg_temp.s09t_person(p_actor);
  verdicts text[] := '{}';
begin
  verdicts := verdicts || format('holds=%s', platform_private.cms_person_holds_capability(org, person, 'cms.author'));
  verdicts := verdicts || format('require=%s', pg_temp.s09d_try(format(
    'select platform_private.cms_require_capability(%L, %L, %L)', actor_id, org, 'cms.schema_designer')));
  verdicts := verdicts || format('read=%s', pg_temp.s09d_try(format(
    'select platform_private.cms_require_read(%L, %L)', actor_id, org)));
  verdicts := verdicts || format('origin=%s', platform_private.cms_authority_origin(actor_id, org, 'cms.author', null) is not null);
  verdicts := verdicts || format('visible=%s', platform_private.cms_entry_tenant_visible(actor_id, org));
  verdicts := verdicts || format('template=%s', platform_private.cms_template_designer_authorized(actor_id, org));
  verdicts := verdicts || format('cfg=%s', pg_temp.s09d_try(format(
    'select platform_private.cfg_require_capability(%L, %L, %L)', actor_id, org, 'cms.schema_designer')));
  verdicts := verdicts || format('stepup=%s', platform_private.mfa_step_up_capability_held(person));
  return array_to_string(verdicts, ',');
end;
$body$;
select is(pg_temp.s09t_predicates('rev1'),
  'holds=t,require=t,read=t,origin=t,visible=t,template=t,cfg=t,stepup=t',
  'control: an already-started member holds the capabilities every predicate reads ');
select ok(pg_temp.s09t_warp_start('rev1', 3), 'fixture: the SAME member''s tenure start moves three days into the future');
select is(pg_temp.s09t_predicates('rev1'),
  'holds=f,require=f,read=f,origin=f,visible=f,template=f,cfg=f,stepup=f',
  'with the tenure not yet started every effective-capability predicate refuses, whatever grant exists');
select ok(pg_temp.s09t_warp_start('rev1', 0), 'fixture: the tenure start returns to today');
select is(pg_temp.s09t_predicates('rev1'),
  'holds=t,require=t,read=t,origin=t,visible=t,template=t,cfg=t,stepup=t',
  'the predicates accept again once starts_on <= today');

-- The organization actor predicate (membership administration) shares the rule.
select pg_temp.s09d_session('owner', 'authenticated');
select ok(pg_temp.s09d_try(format('select identity_private.require_organization_actor(%L, %L, %L)',
    pg_temp.s09d_id('ownerOrg'), pg_temp.s09t_person('owner'), 'organization.admin')),
  'control: the started owner passes the organization actor predicate');
select ok(pg_temp.s09t_warp_start('owner', 4), 'fixture: the owner''s tenure start moves into the future');
select ok(not pg_temp.s09d_try(format('select identity_private.require_organization_actor(%L, %L, %L)',
    pg_temp.s09d_id('ownerOrg'), pg_temp.s09t_person('owner'), 'organization.admin')),
  'a tenure that has not started refuses the organization actor predicate');

select * from finish();
rollback;
