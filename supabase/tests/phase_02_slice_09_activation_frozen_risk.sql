\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a worker switch): the risk class a worker activation
-- reports (response and cms.schema.activated.v1 payload, switch and
-- already-active replay) is the FROZEN one: the strictest-of class the approved
-- review snapshot stored for the exact policy key, version and hash the
-- candidate was reviewed under.  A newer registry version of the same policy
-- key, added after approval, never changes it.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

-- A newer registry version of an existing key, shipped after the review.  The
-- registry is code-owned: the row is inserted the way a release migration would.
-- FIXTURE FORGERY (release-migration stand-in): the workflow policy registry is code-owned and written only by a release migration; this inserts the member a later migration would add, so it claims no producer path.
create or replace function pg_temp.s09r_newer_version(p_key text, p_risk text) returns void language plpgsql as $body$
declare caps jsonb := case when p_risk = 'protected' then '["cms.reviewer","cms.reviewer.policy"]'::jsonb
                           else '["cms.reviewer"]'::jsonb end;
        decisions integer := case when p_risk = 'protected' then 2 else 1 end;
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_workflow_policies(
    owner_id, version, policy_key, policy_version, policy_hash, risk_class,
    required_decision_count, required_capabilities
  ) values (
    '0d6a0d6a-0000-4000-8000-000000000108'::uuid, 2, p_key, 2,
    platform_private.cms_workflow_policy_hash(p_key, 2, p_risk, decisions, caps),
    p_risk, decisions, caps);
end;
$body$;

-- ----------------------------- ordinary candidate, newer protected version ----
select pg_temp.s09d_create_type('a', 'frozenrisk');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09d_seal('b');
select pg_temp.s09d_submit('b');
select pg_temp.s09d_assign('b', 'rev1');
select pg_temp.s09d_decide('b', 'rev1');
select pg_temp.s09d_complete_plan('b');
select is((select review.risk_class from platform_private.cms_schema_reviews review where review.id = pg_temp.s09d_id('b:review')),
  'ordinary', 'fixture: the approved review froze riskClass ordinary under editorial v1');
select is((select version_row.state::text from platform_private.cms_content_type_versions version_row where version_row.id = pg_temp.s09d_id('b:version')),
  'approved', 'fixture: the candidate is approved and its plan is worker-completed');
select pg_temp.s09r_newer_version('editorial', 'protected');
select is((select count(*)::integer from platform_private.cms_workflow_policies where policy_key = 'editorial'), 2,
  'fixture: a newer protected version of the editorial key exists');
select is(platform_private.cms_activation_risk_class('editorial'), 'protected',
  'precondition: the key-level latest-version default now says protected');
select pg_temp.s09d_worker_activate('b', 'a', 'frozen-risk-switch-001');
select is(pg_temp.s09d_outcome('b:wk.activate'), 'OK', 'the worker switch succeeds');
select is(pg_temp.s09d_resp('b:wk.activate')->>'status', 'activated', 'the first call activates');
select is(pg_temp.s09d_resp('b:wk.activate')->'activationEvidence'->>'riskClass', 'ordinary',
  'the activation response reports the frozen ordinary class, not the newer registry version''s');
select is((select event.payload->'activationEvidence'->>'riskClass' from platform_private.outbox_events event
    where event.event_type = 'cms.schema.activated.v1' and event.aggregate_id = pg_temp.s09d_id('b:version')),
  'ordinary', 'cms.schema.activated.v1 carries the frozen ordinary class');
select is(pg_temp.s09d_resp('b:wk.activate')->'activationEvidence'->>'policyHash',
  (select policy_hash::text from platform_private.cms_workflow_policies where policy_key = 'editorial' and policy_version = 1),
  'the evidence still names the exact frozen v1 policy hash after a newer registry version exists: the evidence is frozen, not re-derived (precondition for the class being frozen too) [P2-S09-AC-090]');
select pg_temp.s09d_worker_activate('b', 'a', 'frozen-risk-replay-002');
select is(pg_temp.s09d_resp('b:wk.activate')->>'status', 'already_active', 'a second request over the active candidate is an already-active replay');
select is(pg_temp.s09d_resp('b:wk.activate')->'activationEvidence'->>'riskClass', 'ordinary',
  'the already-active replay reports the frozen ordinary class');

-- ---------------------------- the other direction: newer ordinary version ----
select pg_temp.s09d_create_type('c', 'frozenrisk2', 'cms.standard');
select pg_temp.s09d_to_active('c');
select pg_temp.s09d_successor('d', 'c');
select pg_temp.s09d_dry_run('d');
select pg_temp.s09d_seal('d');
select pg_temp.s09d_submit('d');
select pg_temp.s09d_assign('d', 'rev1');
select pg_temp.s09d_decide('d', 'rev1');
select pg_temp.s09d_complete_plan('d');
select pg_temp.s09d_worker_activate('d', 'c', 'frozen-risk-switch-003');
select is(pg_temp.s09d_resp('d:wk.activate')->'activationEvidence'->>'riskClass', 'ordinary',
  'an ordinary key activates ordinary before any newer version exists (control)');
select pg_temp.s09r_newer_version('cms.standard', 'protected');
select pg_temp.s09d_worker_activate('d', 'c', 'frozen-risk-replay-004');
select is(pg_temp.s09d_resp('d:wk.activate')->>'status', 'already_active', 'control: the second request is an already-active replay');
select is(pg_temp.s09d_resp('d:wk.activate')->'activationEvidence'->>'riskClass', 'ordinary',
  'the replay stays ordinary after a newer protected version of cms.standard is registered');

select * from finish();
rollback;
