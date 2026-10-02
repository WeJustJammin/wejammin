commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a "Index, RLS, and retention inventory"):
-- stale pending enrollments and step-up challenges expire; `removed` and
-- `expired` factor rows and non-pending challenges become purge-eligible 30
-- days after their last change and are deleted only by the service-role
-- retention sweep; pending/verified/reconciling rows are never purged.  The
-- AUTH-API-16..21 abuse buckets reuse the identity rate-limit RPC.

\ir phase_02_slice_09_dec111/00-support.sqlinc

create or replace function pg_temp.m_sweep(p_label text, p_batch integer default 500) returns jsonb
language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_registry_sweep', jsonb_build_object('p_batch', p_batch, '_notrace', true)) $body$;

-- ---- rate-limit operation ids ------------------------------------------------
select is(pg_temp.m_one(format($q$select platform_api.auth_rate_limit(%L, repeat('ab', 32), 5, 60)->>'allowed'$q$, 'AUTH-API-' || n)), 'true',
  'AUTH-API-' || n || ' has an abuse bucket in the identity rate limiter')
from generate_series(16, 21) n;
select ok(not pg_temp.m_try($$select platform_api.auth_rate_limit('AUTH-API-22', repeat('ab', 32), 5, 60)$$),
  'an operation id outside AUTH-API-01..21 is still refused');

-- ---- sweep: validation ---------------------------------------------------------
select pg_temp.m_sweep('sw:0', 0);
select is(pg_temp.m_out('sw:0'), 'INVALID_REQUEST', 'a zero batch is INVALID_REQUEST');
select pg_temp.m_sweep('sw:big', 5001);
select is(pg_temp.m_out('sw:big'), 'INVALID_REQUEST', 'a batch above 5000 is INVALID_REQUEST');
select pg_temp.m_sweep('sw:empty');
select is(pg_temp.m_resp('sw:empty'), jsonb_build_object('expiredFactors', 0, 'expiredChallenges', 0, 'purgedChallenges', 0, 'purgedFactors', 0),
  'an empty sweep reports four zero counters');

-- ---- sweep: expiry ----------------------------------------------------------------
select pg_temp.m_user(n) from generate_series(1, 6) n;
select pg_temp.m_pending(1, 'Stale1');
select pg_temp.m_pending(2, 'Stale2');
select pg_temp.m_pending(3, 'Stale3');
select pg_temp.m_pending(4, 'Fresh');
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 minute'$$,
  format('auth_user_id in (%L, %L, %L)', pg_temp.m_uid(1), pg_temp.m_uid(2), pg_temp.m_uid(3)));
create temp table m_vs on commit drop as select n, pg_temp.m_ver(n)::bigint v from generate_series(1, 4) n;
select pg_temp.m_sweep('sw:one', 1);
select is(pg_temp.m_resp('sw:one')->>'expiredFactors', '1', 'the batch bounds the rows expired per call');
select pg_temp.m_sweep('sw:rest');
select is(pg_temp.m_resp('sw:rest')->>'expiredFactors', '2', 'the next sweep expires the remaining stale pending rows');
select is(pg_temp.m_one(format($q$select count(*)::text from identity.mfa_factor_registry where auth_user_id in (%L, %L, %L) and state = 'expired'$q$,
  pg_temp.m_uid(1), pg_temp.m_uid(2), pg_temp.m_uid(3)))::integer, 3, 'all three stale pending rows are expired');
select is(pg_temp.m_fstate(pg_temp.m_fid(4)), 'pending', 'an unexpired pending row is left alone');
select is((select count(*)::integer from m_vs where pg_temp.m_ver(n)::bigint = v + 1 and n <= 3), 3, 'each expiry bumps that account''s MFA version once');
select is(pg_temp.m_ver(4)::bigint, (select v from m_vs where n = 4), 'and nobody else''s');
select is((select count(*)::integer from identity.security_events where action = 'mfa.enroll.expired' and reason_code = 'ENROLLMENT_EXPIRED'
            and actor_auth_user_id in (select pg_temp.m_uid(n) from generate_series(1, 3) n)), 3, 'each expiry is security evidence');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1'
            and aggregate_id in (select id from identity.mfa_factor_registry where state = 'expired')), 3,
  'each expiry emits the factor-changed event so the reconciler can clean the provider factor');

-- stale challenges
select pg_temp.m_enroll(5, 'Solo');
select pg_temp.m('ch:b', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5), 'p_session_id', pg_temp.m_sid(5), 'p_method', 'totp', 'p_factor_id', null));
select pg_temp.m('ch:f', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5), 'p_session_id', pg_temp.m_sid(5),
  'p_factor_id', pg_temp.m_fid(5), 'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select pg_temp.m_warp('step_up_challenges', $$expires_at = clock_timestamp() - interval '1 second'$$, format('auth_user_id = %L', pg_temp.m_uid(5)));
select pg_temp.m_sweep('sw:ch');
select is(pg_temp.m_resp('sw:ch')->>'expiredChallenges', '1', 'a stale pending challenge is expired by the sweep');
select is(pg_temp.m_one(format($q$select state::text from identity.step_up_challenges where auth_user_id = %L$q$, pg_temp.m_uid(5))), 'expired', 'and its state is expired');

-- ---- sweep: 30-day purge eligibility -------------------------------------------------
-- user 6: removed factor 31 days old (purge), expired factor 29 days old (keep),
-- consumed and failed challenges 31 days old (purge), verified factor (never).
select pg_temp.m_enroll(6, 'Keep');
select pg_temp.m_enroll(6, 'RemovedOld');
select pg_temp.m_enroll(6, 'RemovedNew');
select pg_temp.m_pending(6, 'ExpiredNew');
select pg_temp.m('pg:rm1b', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6),
  'p_factor_id', pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedOld'$q$, pg_temp.m_uid(6)))::uuid,
  'p_reason', 'user_request', 'p_expected_version', pg_temp.m_ver(6), 'p_session_id', pg_temp.m_sid(6),
  'p_key_hash', '\x' || repeat('e1', 32), 'p_request_hash', '\x' || repeat('e2', 32)));
select pg_temp.m('pg:rm1f', 'auth_mfa_removal_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6),
  'p_factor_id', pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedOld'$q$, pg_temp.m_uid(6)))::uuid,
  'p_reason', 'user_request', 'p_session_id', pg_temp.m_sid(6), 'p_key_hash', '\x' || repeat('e1', 32)));
select pg_temp.m('pg:rm2b', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6),
  'p_factor_id', pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedNew'$q$, pg_temp.m_uid(6)))::uuid,
  'p_reason', 'user_request', 'p_expected_version', pg_temp.m_ver(6), 'p_session_id', pg_temp.m_sid(6),
  'p_key_hash', '\x' || repeat('e3', 32), 'p_request_hash', '\x' || repeat('e4', 32)));
select pg_temp.m('pg:rm2f', 'auth_mfa_removal_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6),
  'p_factor_id', pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedNew'$q$, pg_temp.m_uid(6)))::uuid,
  'p_reason', 'user_request', 'p_session_id', pg_temp.m_sid(6), 'p_key_hash', '\x' || repeat('e3', 32)));
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 minute'$$,
  format($q$auth_user_id = %L and friendly_name = 'ExpiredNew'$q$, pg_temp.m_uid(6)));
select pg_temp.m_sweep('pg:expire');  -- expires ExpiredNew now
create temp table m_keep on commit drop as
  select pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'Keep'$q$, pg_temp.m_uid(6)))::uuid keep,
         pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedOld'$q$, pg_temp.m_uid(6)))::uuid old_removed,
         pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'RemovedNew'$q$, pg_temp.m_uid(6)))::uuid new_removed,
         pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'ExpiredNew'$q$, pg_temp.m_uid(6)))::uuid new_expired;
-- Two challenges on Keep: one consumed, one failed (sequential: a new begin supersedes).
select pg_temp.m('pc:b1', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6), 'p_method', 'totp', 'p_factor_id', (select keep from m_keep)));
select pg_temp.m('pc:f1', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6),
  'p_factor_id', (select keep from m_keep), 'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select pg_temp.m('pc:s1', 'auth_step_up_challenge_verify_settle', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6),
  'p_challenge_id', pg_temp.m_resp('pc:f1')->>'challengeId', 'p_new_session_id', pg_temp.m_sid(6), 'p_issued_at', clock_timestamp()));
select pg_temp.m('pc:b2', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6), 'p_method', 'totp', 'p_factor_id', (select keep from m_keep)));
select pg_temp.m('pc:f2', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6),
  'p_factor_id', (select keep from m_keep), 'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select pg_temp.m('pc:x2', 'auth_step_up_challenge_failure_record', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6),
  'p_challenge_id', pg_temp.m_resp('pc:f2')->>'challengeId', 'p_outcome', 'ambiguous'));
select pg_temp.m('pc:b3', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6), 'p_method', 'totp', 'p_factor_id', (select keep from m_keep)));
select pg_temp.m('pc:f3', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(6), 'p_session_id', pg_temp.m_sid(6),
  'p_factor_id', (select keep from m_keep), 'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select is(pg_temp.m_one('select count(*)::text from identity.step_up_challenges where auth_user_id = ' || quote_literal(pg_temp.m_uid(6)))::integer, 3,
  'fixture: one consumed, one failed and one pending challenge');
-- Age: consumed + failed 31 days, old removed 31 days, new removed 29 days, new expired 29 days; the pending challenge too (must survive).
select pg_temp.m_warp('step_up_challenges', $$updated_at = clock_timestamp() - interval '31 days'$$,
  format($q$auth_user_id = %L and state in ('consumed', 'failed')$q$, pg_temp.m_uid(6)));
select pg_temp.m_warp('step_up_challenges', $$expires_at = clock_timestamp() - interval '1 second', updated_at = clock_timestamp() - interval '40 days'$$,
  format($q$auth_user_id = %L and state = 'pending'$q$, pg_temp.m_uid(6)));
select pg_temp.m_warp('mfa_factor_registry', $$updated_at = clock_timestamp() - interval '31 days'$$, format('id = %L', (select old_removed from m_keep)));
select pg_temp.m_warp('mfa_factor_registry', $$updated_at = clock_timestamp() - interval '29 days'$$,
  format('id in (%L, %L)', (select new_removed from m_keep), (select new_expired from m_keep)));
select pg_temp.m_warp('mfa_factor_registry', $$updated_at = clock_timestamp() - interval '90 days'$$, format('id = %L', (select keep from m_keep)));
select pg_temp.m_sweep('pg:purge');
select is(pg_temp.m_resp('pg:purge')->>'purgedChallenges', '2', 'consumed and failed challenges older than 30 days are purged');
select is(pg_temp.m_resp('pg:purge')->>'purgedFactors', '1', 'only the removed factor older than 30 days is purged');
select is(pg_temp.m_resp('pg:purge')->>'expiredFactors', '0', 'the purge sweep expires nothing further');
select is(pg_temp.m_one(format('select count(*)::text from identity.mfa_factor_registry where id = %L', (select old_removed from m_keep)))::integer, 0, 'the 31-day removed row is gone');
select is(pg_temp.m_one(format('select count(*)::text from identity.mfa_factor_registry where id in (%L, %L)', (select new_removed from m_keep), (select new_expired from m_keep)))::integer, 2,
  'removed and expired rows inside the 30-day window are kept');
select is(pg_temp.m_fstate((select keep from m_keep)), 'verified', 'a verified factor is never purged, however old');
select is(pg_temp.m_one(format($q$select count(*)::text from identity.step_up_challenges where auth_user_id = %L and state = 'pending'$q$, pg_temp.m_uid(6)))::integer, 0,
  'the 40-day-old pending challenge was expired (not purged) by the same sweep');
select is(pg_temp.m_one(format($q$select count(*)::text from identity.step_up_challenges where auth_user_id = %L$q$, pg_temp.m_uid(6)))::integer, 1,
  'the expired challenge row is retained until it too is 30 days old');
select is(coalesce(current_setting('app.mfa_registry_purge', true), ''), '', 'the purge flag does not leak out of the sweep');
select ok(not pg_temp.m_try($$delete from identity.mfa_factor_registry$$), 'outside the sweep a direct delete is still refused');

select * from finish();

rollback;
