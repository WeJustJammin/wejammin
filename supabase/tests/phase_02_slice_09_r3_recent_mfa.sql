\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): "recent binding-bound MFA" is the verified
-- step-up instant carried by the service-role envelope (context.stepUpVerified
-- and context.stepUpAt, from the aal2 proof), never the acting-context binding
-- heartbeat (acting_context_binding.last_seen_at, refreshed on every session
-- read).  BE01a freshness: -30 s <= now - stepUpAt <= 600 s.  Every operation
-- below keeps a FRESH heartbeat and varies only the step-up proof, so a
-- heartbeat-only binding cannot pass.  Covers CMS-03A-04/12/14/15/16/17.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.r3_at(p_offset interval) returns text language sql as $body$
  select to_char((clock_timestamp() + p_offset) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$body$;
create or replace function pg_temp.r3_proof(p_offset interval) returns jsonb language sql as $body$
  select jsonb_build_object('stepUpVerified', true, 'stepUpAt', pg_temp.r3_at(p_offset))
$body$;

select pg_temp.s09g_member('rev1');
select pg_temp.s09g_member('rev2');

-- The harness heartbeat is fresh for every actor: staleness below is ONLY the proof.
select ok(not exists (
  select 1 from platform_private.acting_context_binding
   where id in (select binding_id from s09d_actor) and last_seen_at < clock_timestamp() - interval '1 minute'),
  'every actor binding heartbeat is fresh, so only the step-up proof can be stale [P2-S09-AC-421]');

-- CMS-03A-15 grant: the step-up proof, not the heartbeat.
create temp table r3_grants_before on commit drop as
select (select count(*) from platform_private.cms_capability_grants) as grants,
       (select count(*) from platform_private.cms_capability_grant_events) as events;
select pg_temp.s09g_grant('r:old', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, pg_temp.r3_proof(interval '-11 minutes'));
select is(pg_temp.s09d_outcome('r:old'), 'STEP_UP_REQUIRED',
  'a fresh heartbeat with a step-up proof 11 minutes old is 401 STEP_UP_REQUIRED on grant [P2-S09-AC-523] [P2-S09-AC-091]');
select pg_temp.s09g_grant('r:edge', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, pg_temp.r3_proof(interval '-601 seconds'));
select is(pg_temp.s09d_outcome('r:edge'), 'STEP_UP_REQUIRED',
  'a step-up proof 601 seconds old is refused on grant: the freshness window is 600 seconds [P2-S09-AC-523]');
select pg_temp.s09g_grant('r:future', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, pg_temp.r3_proof(interval '31 seconds'));
select is(pg_temp.s09d_outcome('r:future'), 'STEP_UP_REQUIRED',
  'a step-up proof 31 seconds in the future exceeds the 30 second forward tolerance and is refused [P2-S09-AC-523] [P2-S09-AC-545]');
select pg_temp.s09g_grant('r:unverified', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, jsonb_build_object('stepUpVerified', false));
select is(pg_temp.s09d_outcome('r:unverified'), 'STEP_UP_REQUIRED',
  'stepUpVerified=false is refused on grant even with a fresh heartbeat and fresh stepUpAt [P2-S09-AC-523]');
select pg_temp.s09g_grant('r:nullat', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, jsonb_build_object('stepUpAt', null));
select is(pg_temp.s09d_outcome('r:nullat'), 'STEP_UP_REQUIRED',
  'a null stepUpAt is refused on grant: a heartbeat alone proves no MFA [P2-S09-AC-523]');
select pg_temp.s09g_grant('r:badat', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, jsonb_build_object('stepUpAt', 'not-a-timestamp'));
select is(pg_temp.s09d_outcome('r:badat'), 'STEP_UP_REQUIRED',
  'a malformed stepUpAt is refused on grant [P2-S09-AC-523]');
select is((select count(*) from platform_private.cms_capability_grants), (select grants from r3_grants_before),
  'every refused grant left no grant row');
select is((select count(*) from platform_private.cms_capability_grant_events), (select events from r3_grants_before),
  'every refused grant left no grant event');

-- Positive controls: the proof boundary values are accepted and the recorded
-- MFA instant is the proof, never the heartbeat.
select pg_temp.r3_at(interval '-9 minutes') as proof_at \gset
select pg_temp.s09g_grant('r:ok', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, jsonb_build_object('stepUpVerified', true, 'stepUpAt', :'proof_at'));
select is(pg_temp.s09d_outcome('r:ok'), 'OK',
  'a 9 minute old step-up proof with a fresh heartbeat is accepted on grant [P2-S09-AC-523]');
select is((select event.mfa_verified_at from platform_private.cms_capability_grant_events event
            where event.grant_id = (pg_temp.s09d_resp('r:ok')->>'id')::uuid),
          :'proof_at'::timestamptz,
  'the recorded grant MFA instant is the verified step-up instant, not the binding heartbeat [P2-S09-AC-523] [P2-S09-AC-091]');
select ok((select event.mfa_verified_at from platform_private.cms_capability_grant_events event
            where event.grant_id = (pg_temp.s09d_resp('r:ok')->>'id')::uuid)
          < (select binding.last_seen_at from platform_private.acting_context_binding binding
              where binding.id = pg_temp.s09d_actor_id('owner', 'binding')::uuid) - interval '8 minutes',
  'the heartbeat is more than 8 minutes newer than the recorded MFA instant, so the two are distinct [P2-S09-AC-091]');
select pg_temp.s09g_grant('r:okedge', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3),
  '{}', null, true, pg_temp.r3_proof(interval '-590 seconds'));
select is(pg_temp.s09d_outcome('r:okedge'), 'OK', 'a proof 590 seconds old is inside the 600 second window [P2-S09-AC-523]');
select pg_temp.s09g_grant('r:okfwd', 'owner', 'rev2', 'cms.reviewer.policy', pg_temp.s09g_day(3),
  '{}', null, true, pg_temp.r3_proof(interval '20 seconds'));
select is(pg_temp.s09d_outcome('r:okfwd'), 'OK', 'a proof 20 seconds ahead is inside the 30 second forward tolerance [P2-S09-AC-523]');

-- Heartbeat remains a separate binding-liveness check (not an MFA instant).
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '20 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09g_grant('r:deadbeat', 'owner', 'rev1', 'cms.reviewer.legal', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('r:deadbeat'), 'STEP_UP_REQUIRED',
  'a dead binding heartbeat is refused even when the step-up proof is fresh (binding liveness stays separate) [P2-S09-AC-523]');
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;

-- CMS-03A-16 renew and CMS-03A-17 revoke.
select pg_temp.s09g_grant('r:base', 'owner', 'rev2', 'cms.reviewer.security', pg_temp.s09g_day(3));
select pg_temp.s09d_rpc('r:renew:old', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', (pg_temp.s09d_resp('r:base')->>'id')::uuid, 'expectedVersion', (pg_temp.s09d_resp('r:base')->>'version'),
    'validThrough', pg_temp.s09g_day(5), 'idempotencyKey', pg_temp.s09g_key('r-renew')), true,
  pg_temp.r3_proof(interval '-11 minutes'));
select is(pg_temp.s09d_outcome('r:renew:old'), 'STEP_UP_REQUIRED',
  'renewal with a fresh heartbeat and a stale step-up proof is 401 STEP_UP_REQUIRED [P2-S09-AC-556]');
select pg_temp.s09d_rpc('r:renew:unverified', 'platform_api.cms_renew_capability_grant', 'owner',
  jsonb_build_object('grantId', (pg_temp.s09d_resp('r:base')->>'id')::uuid, 'expectedVersion', (pg_temp.s09d_resp('r:base')->>'version'),
    'validThrough', pg_temp.s09g_day(5), 'idempotencyKey', pg_temp.s09g_key('r-renew2')), true,
  jsonb_build_object('stepUpVerified', false));
select is(pg_temp.s09d_outcome('r:renew:unverified'), 'STEP_UP_REQUIRED', 'renewal with stepUpVerified=false is refused [P2-S09-AC-556]');
select pg_temp.s09d_rpc('r:revoke:old', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', (pg_temp.s09d_resp('r:base')->>'id')::uuid, 'expectedVersion', (pg_temp.s09d_resp('r:base')->>'version'),
    'idempotencyKey', pg_temp.s09g_key('r-revoke')), true, pg_temp.r3_proof(interval '-11 minutes'));
select is(pg_temp.s09d_outcome('r:revoke:old'), 'STEP_UP_REQUIRED',
  'revocation with a fresh heartbeat and a stale step-up proof is 401 STEP_UP_REQUIRED [P2-S09-AC-585]');
select pg_temp.s09d_rpc('r:revoke:unverified', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', (pg_temp.s09d_resp('r:base')->>'id')::uuid, 'expectedVersion', (pg_temp.s09d_resp('r:base')->>'version'),
    'idempotencyKey', pg_temp.s09g_key('r-revoke2')), true, jsonb_build_object('stepUpVerified', false));
select is(pg_temp.s09d_outcome('r:revoke:unverified'), 'STEP_UP_REQUIRED', 'revocation with stepUpVerified=false is refused [P2-S09-AC-585]');
select is((select version::text from platform_private.cms_capability_grants where id = (pg_temp.s09d_resp('r:base')->>'id')::uuid),
          pg_temp.s09d_resp('r:base')->>'version', 'refused renew/revoke left the grant unchanged');
select pg_temp.s09d_rpc('r:revoke:ok', 'platform_api.cms_revoke_capability_grant', 'owner',
  jsonb_build_object('grantId', (pg_temp.s09d_resp('r:base')->>'id')::uuid, 'expectedVersion', (pg_temp.s09d_resp('r:base')->>'version'),
    'idempotencyKey', pg_temp.s09g_key('r-revoke3')), true, pg_temp.r3_proof(interval '-5 minutes'));
select is(pg_temp.s09d_outcome('r:revoke:ok'), 'OK', 'revocation with a 5 minute old proof is accepted [P2-S09-AC-585]');

-- CMS-03A-14 assignment, CMS-03A-12 decision, CMS-03A-04 activation.
select pg_temp.s09d_create_type('a', 'r3mfa');
select pg_temp.s09d_to_review('a');
create or replace function pg_temp.r3_assign(p_label text, p_override jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_assign_schema_review', 'owner',
    jsonb_build_object('reviewId', pg_temp.s09d_id('a:review'), 'action', 'create',
      'expectedVersion', pg_temp.s09d_review_version('a'),
      'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'),
      'expiresAt', pg_temp.r3_at(interval '1 day'), 'reason', 'r3 mfa',
      'idempotencyKey', pg_temp.s09g_key(p_label)), true, p_override)
$body$;
select pg_temp.r3_assign('a:assign:old', pg_temp.r3_proof(interval '-11 minutes'));
select is(pg_temp.s09d_outcome('a:assign:old'), 'STEP_UP_REQUIRED',
  'assignment with a fresh heartbeat and a stale step-up proof is 401 STEP_UP_REQUIRED [P2-S09-AC-484]');
select pg_temp.r3_assign('a:assign:unverified', jsonb_build_object('stepUpVerified', false));
select is(pg_temp.s09d_outcome('a:assign:unverified'), 'STEP_UP_REQUIRED', 'assignment with stepUpVerified=false is refused [P2-S09-AC-484]');
select pg_temp.s09d_assign('a', 'rev1');
select is(pg_temp.s09d_outcome('a:assign:rev1'), 'OK', 'assignment with the harness proof still succeeds [P2-S09-AC-484]');

select pg_temp.s09d_decide('a', 'rev1', 'approve', pg_temp.r3_proof(interval '-11 minutes'), 'a:decide:old');
select is(pg_temp.s09d_outcome('a:decide:old'), 'STEP_UP_REQUIRED',
  'a decision with a fresh heartbeat and a stale step-up proof is 401 STEP_UP_REQUIRED [P2-S09-AC-421] [P2-S09-AC-091]');
select pg_temp.s09d_decide('a', 'rev1', 'approve', jsonb_build_object('stepUpVerified', false), 'a:decide:unverified');
select is(pg_temp.s09d_outcome('a:decide:unverified'), 'STEP_UP_REQUIRED', 'a decision with stepUpVerified=false is refused [P2-S09-AC-421]');
select is((select count(*) from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('a:review')), 0::bigint,
  'refused decisions persisted no decision row');
select pg_temp.r3_at(interval '-4 minutes') as decide_at \gset
select pg_temp.s09d_decide('a', 'rev1', 'approve', jsonb_build_object('stepUpAt', :'decide_at'), 'a:decide:ok');
select is(pg_temp.s09d_outcome('a:decide:ok'), 'OK', 'a decision with a 4 minute old proof is accepted [P2-S09-AC-421]');
select is((select mfa_verified_at from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('a:review')),
          :'decide_at'::timestamptz,
  'the decision records the verified step-up instant, not the binding heartbeat [P2-S09-AC-421] [P2-S09-AC-091]');

select pg_temp.s09d_activate('a', 'owner', pg_temp.r3_proof(interval '-11 minutes'), 'a:activate:old');
select is(pg_temp.s09d_outcome('a:activate:old'), 'STEP_UP_REQUIRED',
  'an activation with a fresh heartbeat and a stale step-up proof is 401 STEP_UP_REQUIRED [P2-S09-AC-089]');
select pg_temp.s09d_activate('a', 'owner', jsonb_build_object('stepUpVerified', false), 'a:activate:unverified');
select is(pg_temp.s09d_outcome('a:activate:unverified'), 'STEP_UP_REQUIRED', 'an activation with stepUpVerified=false is refused [P2-S09-AC-089]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'approved',
  'refused activations left the candidate approved');
select pg_temp.s09d_activate('a', 'owner', pg_temp.r3_proof(interval '-5 minutes'), 'a:activate:ok');
select is(pg_temp.s09d_outcome('a:activate:ok'), 'OK', 'an activation with a 5 minute old proof succeeds [P2-S09-AC-089]');

-- The CFG-11/CFG-05B step-up gate (admin MFA reset, configuration commands) uses the
-- same BE01a window: -30 s <= now - stepUpAt <= 600 s, stepUpVerified required.
create or replace function pg_temp.r3_cfg_gate(p_offset interval, p_verified boolean default true) returns text language plpgsql as $body$
begin
  perform platform_private.cfg_require_fresh_step_up(jsonb_build_object('context', jsonb_build_object(
    'stepUpVerified', p_verified, 'stepUpAt', clock_timestamp() + p_offset)));
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
select is(pg_temp.r3_cfg_gate(interval '-9 minutes'), 'OK', 'the configuration step-up gate accepts a 9 minute old proof [P2-S09-AC-937]');
select is(pg_temp.r3_cfg_gate(interval '-601 seconds'), 'STEP_UP_REQUIRED', 'and refuses a proof 601 seconds old [P2-S09-AC-937]');
select is(pg_temp.r3_cfg_gate(interval '20 seconds'), 'OK', 'and accepts a proof 20 seconds ahead of the database clock (the 30 s forward tolerance) [P2-S09-AC-937]');
select is(pg_temp.r3_cfg_gate(interval '31 seconds'), 'STEP_UP_REQUIRED', 'and refuses a proof 31 seconds ahead [P2-S09-AC-937]');
select is(pg_temp.r3_cfg_gate(interval '-1 minute', false), 'STEP_UP_REQUIRED', 'and refuses stepUpVerified=false [P2-S09-AC-937]');

select * from finish();
rollback;
