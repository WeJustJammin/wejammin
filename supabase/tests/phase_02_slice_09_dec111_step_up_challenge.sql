commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a AUTH-API-20/21): step-up challenge create
-- (supersede + insert), verify prepare, failure bookkeeping and verify settle
-- with first-party session rotation.  A challenge is bound to the Auth UUID,
-- the exact session id and the factor at creation; it expires at the earlier
-- of the provider expiry and created_at + 10 minutes; it is consumed once.

\ir phase_02_slice_09_dec111/00-support.sqlinc

create or replace function pg_temp.m_cbegin(p_label text, p_n integer, p_factor uuid default null, p_method text default 'totp', p_k integer default 1)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_begin', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n, p_k),
    'p_method', p_method, 'p_factor_id', p_factor)) $body$;
create or replace function pg_temp.m_cfinish(
  p_label text, p_n integer, p_factor uuid, p_expires interval default interval '5 minutes', p_k integer default 1)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_finish', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n, p_k), 'p_factor_id', p_factor,
    'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + p_expires)) $body$;
create or replace function pg_temp.m_cprep(p_label text, p_n integer, p_challenge uuid, p_k integer default 1)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_verify_prepare', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n, p_k), 'p_challenge_id', p_challenge)) $body$;
create or replace function pg_temp.m_cfail(p_label text, p_n integer, p_challenge uuid, p_outcome text, p_k integer default 1)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_failure_record', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n, p_k),
    'p_challenge_id', p_challenge, 'p_outcome', p_outcome)) $body$;
create or replace function pg_temp.m_csettle(p_label text, p_n integer, p_challenge uuid, p_k integer default 1, p_new uuid default null)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_verify_settle', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n, p_k),
    'p_challenge_id', p_challenge, 'p_new_session_id', coalesce(p_new, pg_temp.m_sid(p_n, p_k)),
    'p_issued_at', clock_timestamp())) $body$;
-- A full create: begin + finish; returns the challenge id.
create or replace function pg_temp.m_chal(p_n integer, p_factor uuid default null, p_k integer default 1) returns uuid
language plpgsql as $body$
declare f uuid;
begin
  perform pg_temp.m_cbegin('mc:b', p_n, p_factor, 'totp', p_k);
  f := (pg_temp.m_resp('mc:b')->>'factorId')::uuid;
  perform pg_temp.m_cfinish('mc:f', p_n, f, interval '5 minutes', p_k);
  return (pg_temp.m_resp('mc:f')->>'challengeId')::uuid;
end;
$body$;
create or replace function pg_temp.m_cstate(p_challenge uuid) returns text language plpgsql stable as $body$
declare result text;
begin
  execute 'select state::text from identity.step_up_challenges where id = $1' into result using p_challenge;
  return result;
exception when others then
  return null;
end;
$body$;

select pg_temp.m_user(n) from generate_series(1, 6) n;
select pg_temp.m_enroll(1, 'Phone');
select pg_temp.m_enroll(2, 'One');
select pg_temp.m_enroll(2, 'Two');
select pg_temp.m_pending(4, 'Draft');
select pg_temp.m_enroll(5, 'Solo');
select pg_temp.m_enroll(6, 'Solo');
select platform_api.auth_session_register(pg_temp.m_uid(1), pg_temp.m_sid(1, 2), clock_timestamp(), extensions.gen_random_uuid(), extensions.gen_random_uuid());
create temp table m_ver_before on commit drop as select n, pg_temp.m_ver(n) v from generate_series(1, 6) n;

-- ---- AUTH-API-20 begin ------------------------------------------------------
select pg_temp.m_cbegin('cb:method', 1, null, 'sms');
select is(pg_temp.m_out('cb:method'), 'INVALID_REQUEST', 'a method outside the registry is INVALID_REQUEST');
select pg_temp.m_cbegin('cb:nosess', 1, null, 'totp', 9);
select is(pg_temp.m_out('cb:nosess'), 'UNAUTHENTICATED', 'an unregistered session is 401');
select pg_temp.m_cbegin('cb:none', 3);
select is(pg_temp.m_out('cb:none'), 'NO_VERIFIED_FACTOR', 'an account with no factor is NO_VERIFIED_FACTOR');
select pg_temp.m_cbegin('cb:pendonly', 4);
select is(pg_temp.m_out('cb:pendonly'), 'NO_VERIFIED_FACTOR', 'an account with only a pending factor is NO_VERIFIED_FACTOR');
select pg_temp.m_cbegin('cb:many', 2);
select is(pg_temp.m_out('cb:many'), 'FACTOR_ID_REQUIRED', 'two verified factors without a factorId is FACTOR_ID_REQUIRED');
select pg_temp.m_cbegin('cb:foreign', 1, pg_temp.m_fid(2));
select is(pg_temp.m_out('cb:foreign'), 'NOT_FOUND', 'another user''s factor id is NOT_FOUND');
select pg_temp.m_cbegin('cb:pending', 4, pg_temp.m_fid(4));
select is(pg_temp.m_out('cb:pending'), 'FACTOR_NOT_VERIFIED', 'a pending factor is FACTOR_NOT_VERIFIED');
select pg_temp.m_cbegin('cb:ok', 1);
select is(pg_temp.m_resp('cb:ok'), jsonb_build_object('factorId', pg_temp.m_fid(1), 'providerFactorId', pg_temp.m_pfid(1), 'friendlyName', 'Phone'),
  'begin resolves the single verified factor and returns the protected ids');
select pg_temp.m_cbegin('cb:explicit', 2, pg_temp.m_fid(2));
select is(pg_temp.m_out('cb:explicit'), 'OK', 'an explicit owned verified factor id is accepted');
select is(pg_temp.m_one('select count(*)::text from identity.step_up_challenges where auth_user_id = ' || quote_literal(pg_temp.m_uid(1)))::integer, 0,
  'begin alone inserts no challenge');

-- ---- finish -----------------------------------------------------------------
select pg_temp.m_cfinish('cf:past', 1, pg_temp.m_fid(1), interval '-1 second');
select is(pg_temp.m_out('cf:past'), 'CHALLENGE_EXPIRED', 'a provider challenge that is already expired is CHALLENGE_EXPIRED');
select pg_temp.m_cfinish('cf:notver', 4, pg_temp.m_fid(4));
select is(pg_temp.m_out('cf:notver'), 'FACTOR_NOT_VERIFIED', 'finish on a non-verified factor is FACTOR_NOT_VERIFIED');
select pg_temp.m_cfinish('cf:foreign', 1, pg_temp.m_fid(2));
select is(pg_temp.m_out('cf:foreign'), 'NOT_FOUND', 'finish with another user''s factor is NOT_FOUND');
select pg_temp.m_cfinish('cf:ok', 1, pg_temp.m_fid(1), interval '5 minutes');
select is(pg_temp.m_out('cf:ok'), 'OK', 'finish inserts the pending challenge');
select ok(pg_temp.m_resp('cf:ok')->>'challengeId' ~ '^[0-9a-f-]{36}$'
    and (pg_temp.m_resp('cf:ok')->>'expiresAt')::timestamptz between clock_timestamp() + interval '4 minutes 50 seconds' and clock_timestamp() + interval '5 minutes 1 second',
  'expiresAt is the provider expiry when it is earlier than 10 minutes');
select is(pg_temp.m_one(format('select state::text || session_id::text || factor_id::text from identity.step_up_challenges where id = %L', pg_temp.m_resp('cf:ok')->>'challengeId')),
  'pending' || pg_temp.m_sid(1)::text || pg_temp.m_fid(1)::text, 'the challenge is pending and bound to the exact session and factor [P2-S09-AC-900]');
select is(pg_temp.m_one(format('select auth_user_id::text from identity.step_up_challenges where id = %L', pg_temp.m_resp('cf:ok')->>'challengeId')),
  pg_temp.m_uid(1)::text, 'and to the Auth UUID [P2-S09-AC-900]');
select is(pg_temp.m_events(1, 'step_up.challenge.created'), 1, 'one step_up.challenge.created security event [P2-S09-AC-907]');
select ok(position(pg_temp.m_one(format('select provider_challenge_id::text from identity.step_up_challenges where id = %L', pg_temp.m_resp('cf:ok')->>'challengeId')) in pg_temp.m_resp('cf:ok')::text) = 0,
  'the provider challenge id is never returned');
select is(pg_temp.m_ver(1), (select v from m_ver_before where n = 1), 'creating a challenge never changes the MFA version [P2-S09-AC-889]');
select pg_temp.m_cfinish('cf:long', 2, pg_temp.m_fid(2), interval '30 minutes');
select ok((pg_temp.m_resp('cf:long')->>'expiresAt')::timestamptz <= clock_timestamp() + interval '10 minutes 1 second',
  'a later provider expiry is clamped to created_at + 10 minutes');

-- supersession by a new begin (same session + factor); another session is independent.
create temp table m_c1 on commit drop as select (pg_temp.m_resp('cf:ok')->>'challengeId')::uuid id;
select pg_temp.m_cbegin('cs:b', 1);
select is(pg_temp.m_cstate((select id from m_c1)), 'expired', 'a new challenge for the same session and factor supersedes the pending one [P2-S09-AC-837]');
select pg_temp.m_cfinish('cs:f', 1, pg_temp.m_fid(1));
create temp table m_c2 on commit drop as select (pg_temp.m_resp('cs:f')->>'challengeId')::uuid id;
select is(pg_temp.m_cstate((select id from m_c2)), 'pending', 'the replacement is pending [P2-S09-AC-837]');
select pg_temp.m_cbegin('cs:b2', 1, null, 'totp', 2);
select pg_temp.m_cfinish('cs:f2', 1, pg_temp.m_fid(1), interval '5 minutes', 2);
select is(pg_temp.m_cstate((select id from m_c2)), 'pending', 'a challenge on another session of the same user is independent');
create temp table m_c3 on commit drop as select (pg_temp.m_resp('cs:f2')->>'challengeId')::uuid id;
select is(pg_temp.m_one(format($$select count(*)::text from identity.step_up_challenges where auth_user_id = %L and state = 'pending'$$, pg_temp.m_uid(1)))::integer, 2,
  'one pending challenge per (session, factor): two sessions, two pending');

-- ---- prepare -----------------------------------------------------------------
select pg_temp.m_cprep('cp:othersession', 1, (select id from m_c2), 2);
select is(pg_temp.m_out('cp:othersession'), 'NOT_FOUND', 'another session of the same user cannot use the challenge (404)');
select pg_temp.m_cprep('cp:otheruser', 2, (select id from m_c2));
select is(pg_temp.m_out('cp:otheruser'), 'NOT_FOUND', 'another user cannot use the challenge (404)');
select pg_temp.m_cprep('cp:ok', 1, (select id from m_c2));
select is(pg_temp.m_resp('cp:ok')->>'providerChallengeId',
  pg_temp.m_one(format('select provider_challenge_id::text from identity.step_up_challenges where id = %L', (select id from m_c2))),
  'prepare returns the protected provider challenge id');
select ok(pg_temp.m_resp('cp:ok')->>'factorId' = pg_temp.m_fid(1)::text and pg_temp.m_resp('cp:ok')->>'providerFactorId' = pg_temp.m_pfid(1)::text
    and pg_temp.m_resp('cp:ok')->>'expiresAt' is not null, 'and the factor ids and expiry');
select is(pg_temp.m_cstate((select id from m_c2)), 'pending', 'prepare is read-only');
select pg_temp.m_cprep('cp:old', 1, (select id from m_c1));
select is(pg_temp.m_out('cp:old'), 'CHALLENGE_EXPIRED', 'a superseded (expired) challenge is CHALLENGE_EXPIRED');

-- failure bookkeeping
select pg_temp.m_cfail('fl:bad', 1, (select id from m_c2), 'bogus');
select is(pg_temp.m_out('fl:bad'), 'INVALID_REQUEST', 'an unknown failure outcome is INVALID_REQUEST');
select pg_temp.m_cfail('fl:other', 1, (select id from m_c2), 'incorrect', 2);
select is(pg_temp.m_out('fl:other'), 'NOT_FOUND', 'recording a failure from another session is NOT_FOUND');
select pg_temp.m_cfail('fl:1', 1, (select id from m_c2), 'incorrect');
select pg_temp.m_cfail('fl:2', 1, (select id from m_c2), 'incorrect');
select is(pg_temp.m_one(format('select failed_attempt_count::text || state::text from identity.step_up_challenges where id = %L', (select id from m_c2))), '2pending',
  'a wrong code leaves the challenge pending and increments failed_attempt_count [P2-S09-AC-905]');
select is(pg_temp.m_events(1, 'step_up.failed'), 2, 'each wrong code is security evidence [P2-S09-AC-907]');
select is((select count(*)::integer from identity.security_events where action = 'step_up.failed' and reason_code = 'CODE_INCORRECT'), 2,
  'with the generic CODE_INCORRECT reason [P2-S09-AC-907]');
select pg_temp.m_cprep('fl:still', 1, (select id from m_c2));
select is(pg_temp.m_out('fl:still'), 'OK', 'the challenge remains usable after wrong codes');
select pg_temp.m_cfail('fl:amb', 1, (select id from m_c3), 'ambiguous', 2);
select is(pg_temp.m_cstate((select id from m_c3)), 'failed', 'an ambiguous provider outcome fails the challenge [P2-S09-AC-905]');
select is(pg_temp.m_one(format('select (failed_at is not null)::text from identity.step_up_challenges where id = %L', (select id from m_c3))), 'true', 'failed_at is recorded');
select pg_temp.m_cprep('fl:after', 1, (select id from m_c3), 2);
select is(pg_temp.m_out('fl:after'), 'CHALLENGE_CONSUMED', 'a failed challenge is CHALLENGE_CONSUMED (start a new one) [P2-S09-AC-905]');
select pg_temp.m_cfail('fl:nonpending', 1, (select id from m_c3), 'incorrect', 2);
select is(pg_temp.m_out('fl:nonpending'), 'CHALLENGE_CONSUMED', 'a failure cannot be recorded on a non-pending challenge');

-- expired window
select pg_temp.m_cbegin('ex:b', 2, pg_temp.m_fid(2));
select pg_temp.m_cfinish('ex:f', 2, pg_temp.m_fid(2));
create temp table m_cx on commit drop as select (pg_temp.m_resp('ex:f')->>'challengeId')::uuid id;
select pg_temp.m_warp('step_up_challenges', $$expires_at = clock_timestamp() - interval '1 second'$$, format('id = %L', (select id from m_cx)));
select pg_temp.m_cprep('ex:prep', 2, (select id from m_cx));
select is(pg_temp.m_out('ex:prep'), 'CHALLENGE_EXPIRED', 'prepare after the window is CHALLENGE_EXPIRED');
select pg_temp.m_csettle('ex:settle', 2, (select id from m_cx));
select is(pg_temp.m_out('ex:settle'), 'CHALLENGE_EXPIRED', 'settle after the window is CHALLENGE_EXPIRED');
select pg_temp.m_cfail('ex:fail', 2, (select id from m_cx), 'incorrect');
select is(pg_temp.m_out('ex:fail'), 'CHALLENGE_EXPIRED', 'a failure after the window is CHALLENGE_EXPIRED');

-- ---- AUTH-API-21 settle -------------------------------------------------------
create temp table m_lu on commit drop as
  select pg_temp.m_one(format('select last_used_at::text from identity.mfa_factor_registry where id = %L', pg_temp.m_fid(1))) v;
select pg_temp.m_csettle('st:badrot', 1, (select id from m_c2), 1, pg_temp.m_sid(2));
select is(pg_temp.m_out('st:badrot'), 'UNAUTHENTICATED', 'rotating onto another user''s session id is refused');
select is(pg_temp.m_cstate((select id from m_c2)), 'pending', 'a refused rotation rolls the consumption back');
select pg_temp.m_csettle('st:othersess', 1, (select id from m_c2), 2);
select is(pg_temp.m_out('st:othersess'), 'NOT_FOUND', 'settle from another session is NOT_FOUND');
select pg_temp.m_csettle('st:ok', 1, (select id from m_c2));
select is(pg_temp.m_out('st:ok'), 'OK', 'settle consumes the challenge [P2-S09-AC-862]');
select is(pg_temp.m_cstate((select id from m_c2)), 'consumed', 'the challenge is consumed');
select is(pg_temp.m_one(format('select (consumed_at is not null)::text from identity.step_up_challenges where id = %L', (select id from m_c2))), 'true', 'consumed_at is recorded [P2-S09-AC-862]');
select ok(pg_temp.m_one(format('select last_used_at::text from identity.mfa_factor_registry where id = %L', pg_temp.m_fid(1))) is distinct from (select v from m_lu),
  'the factor''s last_used_at advances [P2-S09-AC-862]');
select is(pg_temp.m_ver(1), (select v from m_ver_before where n = 1),
  'a successful step-up does not bump the MFA version (no enrollment or removal in progress is invalidated) [P2-S09-AC-889]');
select is(pg_temp.m_events(1, 'step_up.verified'), 1, 'one step_up.verified security event [P2-S09-AC-862] [P2-S09-AC-907]');
select is(pg_temp.m_one(format($$select count(*)::text from audit_private.audit_events where action = 'identity.step_up.verified' and target_id = %L$$, (select id from m_c2))), '1',
  'one BE00 audit row for the verification [P2-S09-AC-862]');
select pg_temp.m_csettle('st:again', 1, (select id from m_c2));
select is(pg_temp.m_out('st:again'), 'CHALLENGE_CONSUMED', 'a challenge is consumed once (replay is CHALLENGE_CONSUMED) [P2-S09-AC-905]');
select pg_temp.m_cprep('st:prep', 1, (select id from m_c2));
select is(pg_temp.m_out('st:prep'), 'CHALLENGE_CONSUMED', 'a consumed challenge cannot be prepared again');

-- settle with rotation to a new session
select pg_temp.m_cbegin('rt:b', 5);
select pg_temp.m_cfinish('rt:f', 5, pg_temp.m_fid(5));
create temp table m_cr on commit drop as select (pg_temp.m_resp('rt:f')->>'challengeId')::uuid id;
select pg_temp.m_csettle('rt:ok', 5, (select id from m_cr), 1, pg_temp.m_sid(5, 2));
select is(pg_temp.m_out('rt:ok'), 'OK', 'settle rotates the first-party session in the same transaction [P2-S09-AC-862]');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(5, 1)), 'revoked', 'the initiating row is revoked by exact id [P2-S09-AC-880]');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(5, 2)), 'active', 'the rotated row is active [P2-S09-AC-880]');
select is((select count(*)::integer from identity.auth_session_index where auth_user_id = pg_temp.m_uid(5) and state = 'active'), 1, 'one step-up never leaves two live rows [P2-S09-AC-880]');

-- factor no longer verified at settle time
select pg_temp.m_cbegin('nv:b', 6);
select pg_temp.m_cfinish('nv:f', 6, pg_temp.m_fid(6));
create temp table m_cn on commit drop as select (pg_temp.m_resp('nv:f')->>'challengeId')::uuid id;
select pg_temp.m('nv:mark', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_factor_id', pg_temp.m_fid(6)));
select pg_temp.m_csettle('nv:settle', 6, (select id from m_cn));
select is(pg_temp.m_out('nv:settle'), 'FACTOR_NOT_VERIFIED', 'settle for a factor that is no longer verified is FACTOR_NOT_VERIFIED');
select pg_temp.m_cprep('nv:prep', 6, (select id from m_cn));
select is(pg_temp.m_out('nv:prep'), 'FACTOR_NOT_VERIFIED', 'prepare for a factor that is no longer verified is FACTOR_NOT_VERIFIED');
select pg_temp.m_cbegin('nv:begin', 6, pg_temp.m_fid(6));
select is(pg_temp.m_out('nv:begin'), 'FACTOR_STATE_CONFLICT', 'a reconciling factor cannot start a challenge (409 factor_state_conflict)');

select * from finish();

rollback;
