commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 (BE01a "Observability and Abuse Controls", AUTH-API-18 and
-- AUTH-API-21): enrollment and step-up verification failures share ONE
-- account-scoped budget (the key never carries an operation id).  Ten failures
-- inside any sliding 15 minutes persist a 15-minute lock; while it is held both
-- verify-prepare RPCs refuse with MFA_VERIFICATION_LOCKED:<seconds> before the
-- Worker can contact the provider.  Failures are charged atomically under the
-- account binding lock, a failure while locked never extends the lock, and an
-- expired lock starts a fresh budget.

\ir phase_02_slice_09_dec111/00-support.sqlinc

create or replace function pg_temp.m_cbegin(p_label text, p_n integer, p_factor uuid default null)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_begin', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n),
    'p_method', 'totp', 'p_factor_id', p_factor)) $body$;
create or replace function pg_temp.m_cfinish(p_label text, p_n integer, p_factor uuid)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_finish', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n), 'p_factor_id', p_factor,
    'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes')) $body$;
create or replace function pg_temp.m_chal(p_n integer) returns uuid language plpgsql as $body$
declare f uuid;
begin
  perform pg_temp.m_cbegin('mc:b', p_n);
  f := (pg_temp.m_resp('mc:b')->>'factorId')::uuid;
  perform pg_temp.m_cfinish('mc:f', p_n, f);
  return (pg_temp.m_resp('mc:f')->>'challengeId')::uuid;
end;
$body$;
create or replace function pg_temp.m_cprep(p_label text, p_n integer, p_challenge uuid)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_verify_prepare', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n), 'p_challenge_id', p_challenge)) $body$;
create or replace function pg_temp.m_cfail(p_label text, p_n integer, p_challenge uuid, p_outcome text)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_failure_record', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n),
    'p_challenge_id', p_challenge, 'p_outcome', p_outcome)) $body$;
create or replace function pg_temp.m_efail(p_label text, p_n integer, p_outcome text default 'incorrect')
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_verification_failure_record', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_outcome', p_outcome)) $body$;
create or replace function pg_temp.m_lock_of(p_n integer, p_column text) returns text language plpgsql stable as $body$
declare result text;
begin
  execute format('select %s from identity.mfa_verification_lockouts where auth_user_id = $1', p_column)
    into result using pg_temp.m_uid(p_n);
  return result;
exception when others then
  return null;
end;
$body$;
-- A rolled-back time warp of the real lock row (guard-free table, owner session).
create or replace function pg_temp.m_set_lock(p_n integer, p_set text) returns void language plpgsql as $body$
begin
  execute format('update identity.mfa_verification_lockouts set %s where auth_user_id = $1', p_set) using pg_temp.m_uid(p_n);
end;
$body$;

select pg_temp.m_user(n) from generate_series(1, 4) n;
select pg_temp.m_enroll(1, 'Phone');
select pg_temp.m_enroll(2, 'Phone');
select pg_temp.m_enroll(3, 'Phone');
select pg_temp.m_enroll(4, 'Phone');

-- ---- table surface ----------------------------------------------------------
select has_table('identity', 'mfa_verification_lockouts', 'identity.mfa_verification_lockouts exists');
select ok(pg_temp.m_rls('mfa_verification_lockouts'), 'the lockout table forces row level security');
select ok(pg_temp.m_no_grants('mfa_verification_lockouts'), 'the lockout table has no direct grant for any API role');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.mfa_verification_lockouts')
    and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (auth_user_id)'),
  'the budget key is the account alone: there is no operation id column');
select ok(not exists (select 1 from information_schema.columns where table_schema = 'identity'
    and table_name = 'mfa_verification_lockouts' and column_name like '%operation%'),
  'no operation id is stored or keyed');
select ok(pg_temp.m_service_only('platform_api.auth_mfa_verification_failure_record(uuid,text,uuid,uuid)'),
  'auth_mfa_verification_failure_record is service-role only');

-- ---- request validation -----------------------------------------------------
select pg_temp.m_efail('v:outcome', 1, 'success');
select is(pg_temp.m_out('v:outcome'), 'INVALID_REQUEST', 'an outcome other than incorrect|ambiguous is INVALID_REQUEST');
select pg_temp.m('v:unauth', 'auth_mfa_verification_failure_record', jsonb_build_object(
  'p_auth_user_id', extensions.gen_random_uuid(), 'p_outcome', 'incorrect'));
select is(pg_temp.m_out('v:unauth'), 'UNAUTHENTICATED', 'an unknown account is UNAUTHENTICATED');
select is(pg_temp.m_lock_of(1, 'count(*)'), '0', 'refused charges wrote no lockout row');

-- ---- fixtures: user 1 holds a pending factor and a live challenge ------------
select pg_temp.m_pending(1, 'Draft');
select pg_temp.m_cbegin('c1:b', 1);
select pg_temp.m_cfinish('c1:f', 1, pg_temp.m_fid(1));
select is(pg_temp.m_out('c1:f'), 'OK', 'fixture: user 1 has a live step-up challenge');
create temp table m_ids(k text primary key, v text) on commit drop;
insert into m_ids values ('chal1', pg_temp.m_resp('c1:f')->>'challengeId');
insert into m_ids values ('pend1', pg_temp.m_pending(1, 'Pending')::text);
create or replace function pg_temp.m_id(p_k text) returns uuid language sql stable as $body$
  select v::uuid from m_ids where k = p_k $body$;
create or replace function pg_temp.m_eprep(p_label text, p_n integer, p_factor uuid)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_enrollment_verify_prepare', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor, 'p_expected_version', pg_temp.m_ver(p_n))) $body$;

-- ---- nothing is locked before the budget is spent ----------------------------
select pg_temp.m_eprep('p0:enroll', 1, pg_temp.m_id('pend1'));
select is(pg_temp.m_out('p0:enroll'), 'OK', 'enrollment verify-prepare is admitted while unlocked');
select pg_temp.m_cprep('p0:step', 1, pg_temp.m_id('chal1'));
select is(pg_temp.m_out('p0:step'), 'OK', 'step-up verify-prepare is admitted while unlocked');

-- ---- one shared budget across AUTH-API-18 and AUTH-API-21 --------------------
select pg_temp.m_efail('f:e1', 1);
select pg_temp.m_efail('f:e2', 1);
select pg_temp.m_efail('f:e3', 1);
select pg_temp.m_efail('f:e4', 1, 'ambiguous');
select pg_temp.m_efail('f:e5', 1);
select is(pg_temp.m_resp('f:e5'), jsonb_build_object('recorded', true, 'locked', false, 'retryAfterSeconds', 0),
  'five enrollment failures are recorded and do not lock [P2-S09-AC-778]');
select pg_temp.m_cfail('f:s1', 1, pg_temp.m_id('chal1'), 'incorrect');
select pg_temp.m_cfail('f:s2', 1, pg_temp.m_id('chal1'), 'incorrect');
select pg_temp.m_cfail('f:s3', 1, pg_temp.m_id('chal1'), 'incorrect');
select pg_temp.m_cfail('f:s4', 1, pg_temp.m_id('chal1'), 'incorrect');
select is(pg_temp.m_lock_of(1, 'cardinality(failure_times)'), '9',
  'four step-up failures add to the five enrollment failures in the same account budget (9 of 10) [P2-S09-AC-778] [P2-S09-AC-865]');
select is(pg_temp.m_one(format('select failed_attempt_count::text from identity.step_up_challenges where id = %L', pg_temp.m_id('chal1'))), '4',
  'the per-challenge counter still counts only its own four wrong codes');
select pg_temp.m_eprep('p9:enroll', 1, pg_temp.m_id('pend1'));
select is(pg_temp.m_out('p9:enroll'), 'OK', 'nine failures do not lock enrollment verification');
select pg_temp.m_cprep('p9:step', 1, pg_temp.m_id('chal1'));
select is(pg_temp.m_out('p9:step'), 'OK', 'nine failures do not lock step-up verification');

select pg_temp.m_cfail('f:s5', 1, pg_temp.m_id('chal1'), 'incorrect');
select is(pg_temp.m_out('f:s5'), 'OK', 'the tenth failure, charged through AUTH-API-21 bookkeeping, is recorded');
select is(pg_temp.m_resp('f:s5'), jsonb_build_object('recorded', true),
  'the step-up failure response keeps its existing contract');
select ok(pg_temp.m_lock_of(1, 'locked_until') is not null, 'the tenth failure across both endpoints locks the account [P2-S09-AC-778] [P2-S09-AC-865]');
select ok(pg_temp.m_lock_of(1, 'locked_until')::timestamptz between clock_timestamp() + interval '14 minutes 58 seconds' and clock_timestamp() + interval '15 minutes 1 second',
  'the lock is persisted for 15 minutes [P2-S09-AC-778] [P2-S09-AC-865]');
select is(pg_temp.m_lock_of(1, 'cardinality(failure_times)'), '0', 'a persisted lock clears the in-window failure list');

select pg_temp.m_eprep('pl:enroll', 1, pg_temp.m_id('pend1'));
select ok(pg_temp.m_out('pl:enroll') ~ '^MFA_VERIFICATION_LOCKED:(89[0-9]|900)$',
  'enrollment verify-prepare is refused while locked, before any provider contact [P2-S09-AC-778]');
select pg_temp.m_cprep('pl:step', 1, pg_temp.m_id('chal1'));
select ok(pg_temp.m_out('pl:step') ~ '^MFA_VERIFICATION_LOCKED:(89[0-9]|900)$',
  'step-up verify-prepare is refused while locked, before any provider contact [P2-S09-AC-865]');
select is(pg_temp.m_fstate(pg_temp.m_id('pend1')), 'pending', 'the refused enrollment prepare left the factor pending');
select is(pg_temp.m_one(format('select state::text from identity.step_up_challenges where id = %L', pg_temp.m_id('chal1'))), 'pending',
  'the refused step-up prepare left the challenge pending');

-- A failure while locked is not charged and never extends the lock.
create temp table m_lock_pin on commit drop as select pg_temp.m_lock_of(1, 'locked_until') as locked_until;
select pg_temp.m_efail('fl:again', 1);
select is(pg_temp.m_resp('fl:again')->>'locked', 'true', 'a failure recorded while locked reports locked');
select is(pg_temp.m_lock_of(1, 'locked_until'), (select locked_until from m_lock_pin), 'a failure while locked does not extend the lock');
select is(pg_temp.m_lock_of(1, 'cardinality(failure_times)'), '0', 'and is not added to the budget');

-- Account scope: another account keeps its own budget.
insert into m_ids values ('pend2', pg_temp.m_pending(2, 'Spare')::text);
select pg_temp.m_eprep('po:enroll', 2, pg_temp.m_id('pend2'));
select is(pg_temp.m_out('po:enroll'), 'OK', 'another account is not locked');

-- ---- lock expiry starts a fresh budget ---------------------------------------
select pg_temp.m_set_lock(1, $$locked_until = clock_timestamp() - interval '1 second'$$);
select pg_temp.m_eprep('px:enroll', 1, pg_temp.m_id('pend1'));
select is(pg_temp.m_out('px:enroll'), 'OK', 'an elapsed lock no longer refuses enrollment verification');
select pg_temp.m_cprep('px:step', 1, pg_temp.m_id('chal1'));
select is(pg_temp.m_out('px:step'), 'OK', 'an elapsed lock no longer refuses step-up verification');
select pg_temp.m_efail('fx:first', 1);
select is(pg_temp.m_resp('fx:first'), jsonb_build_object('recorded', true, 'locked', false, 'retryAfterSeconds', 0),
  'the first failure after expiry is a fresh budget of one');
select is(pg_temp.m_lock_of(1, 'cardinality(failure_times)'), '1', 'the budget holds exactly the new failure');
select is(pg_temp.m_lock_of(1, 'locked_until'), null, 'and the elapsed lock is cleared');

-- ---- sliding 15-minute window boundary (user 3) ------------------------------
select pg_temp.m_efail('w:seed', 3);
select pg_temp.m_set_lock(3, $$failure_times = array(select clock_timestamp() - interval '15 minutes 1 second' from generate_series(1, 9))$$);
select pg_temp.m_efail('w:late', 3);
select is(pg_temp.m_resp('w:late')->>'locked', 'false',
  'nine failures older than 15 minutes plus one new failure do not lock (window boundary)');
select is(pg_temp.m_lock_of(3, 'cardinality(failure_times)'), '1', 'the stale failures are pruned: only the new one remains');
select pg_temp.m_set_lock(3, $$failure_times = array(select clock_timestamp() - interval '14 minutes 58 seconds' from generate_series(1, 9))$$);
select pg_temp.m_efail('w:edge', 3);
select is(pg_temp.m_resp('w:edge')->>'locked', 'true',
  'nine failures inside 15 minutes plus one new failure lock (just inside the boundary)');

-- ---- atomic with the per-challenge bookkeeping ---------------------------------
select pg_temp.m_enroll(4, 'Extra');
select pg_temp.m_chal(4);
select pg_temp.m_cfail('a:bad', 4, extensions.gen_random_uuid(), 'incorrect');
select isnt(pg_temp.m_out('a:bad'), 'OK', 'a failure for an unknown challenge is refused');
select is(pg_temp.m_lock_of(4, 'count(*)'), '0', 'and charged nothing to the account budget (one transaction)');
select pg_temp.m_cfail('a:bad2', 4, pg_temp.m_id('chal1'), 'incorrect');
select isnt(pg_temp.m_out('a:bad2'), 'OK', 'a failure for another account''s challenge is refused');
select is(pg_temp.m_lock_of(4, 'count(*)'), '0', 'and charged nothing to this account either');

-- ---- lockout while a verification is in flight (AC-778, AC-865) ---------------
-- Both verify-prepare RPCs check the persisted lock BEFORE the Worker contacts
-- the provider; the lock can still be set by concurrent failures after a prepare
-- and before the matching settle.  Both settle RPCs therefore re-check the
-- persisted lock after acquiring the account binding lock: prepare (unlocked)
-- -> concurrent lockout -> settle is refused and commits nothing.
select pg_temp.m_user(5);
select pg_temp.m_enroll(5, 'Phone');
insert into m_ids values ('chal5', pg_temp.m_chal(5)::text);
insert into m_ids values ('pend5', pg_temp.m_pending(5, 'InFlight')::text);
create or replace function pg_temp.m_csettle_lk(p_label text, p_n integer, p_challenge uuid)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_step_up_challenge_verify_settle', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_session_id', pg_temp.m_sid(p_n),
    'p_challenge_id', p_challenge, 'p_new_session_id', pg_temp.m_sid(p_n),
    'p_issued_at', clock_timestamp())) $body$;
select pg_temp.m_eprep('if:prep:e', 5, pg_temp.m_id('pend5'));
select is(pg_temp.m_out('if:prep:e'), 'OK', 'in flight: the enrollment verification is prepared while unlocked [P2-S09-AC-778]');
select pg_temp.m_cprep('if:prep:s', 5, pg_temp.m_id('chal5'));
select is(pg_temp.m_out('if:prep:s'), 'OK', 'in flight: the step-up verification is prepared while unlocked [P2-S09-AC-865]');
select pg_temp.m_efail('if:f' || n, 5) from generate_series(1, 10) n;
select ok(pg_temp.m_lock_of(5, 'locked_until') is not null,
  'concurrent failures lock the account after both prepares and before either settle [P2-S09-AC-778] [P2-S09-AC-865]');
create temp table m_if_before on commit drop as
  select pg_temp.m_fstate(pg_temp.m_id('pend5')) as factor_state,
         pg_temp.m_fv(pg_temp.m_id('pend5')) as factor_version,
         pg_temp.m_ver(5) as mfa_version,
         pg_temp.m_one(format('select state::text from identity.step_up_challenges where id = %L', pg_temp.m_id('chal5'))) as challenge_state,
         pg_temp.m_events(5, 'mfa.enroll.verified') as enroll_events,
         pg_temp.m_events(5, 'step_up.verified') as step_events,
         pg_temp.m_one(format('select last_used_at::text from identity.mfa_factor_registry where id = %L', pg_temp.m_fid(5))) as last_used;
select pg_temp.m_settle('if:settle:e', 5, pg_temp.m_id('pend5'), pg_temp.m_ver(5));
select ok(pg_temp.m_out('if:settle:e') ~ '^MFA_VERIFICATION_LOCKED:(89[0-9]|900)$',
  'the enrollment settle is refused once the persisted lock is held, even though its prepare was admitted [P2-S09-AC-778]');
select pg_temp.m_csettle_lk('if:settle:s', 5, pg_temp.m_id('chal5'));
select ok(pg_temp.m_out('if:settle:s') ~ '^MFA_VERIFICATION_LOCKED:(89[0-9]|900)$',
  'the step-up settle is refused once the persisted lock is held, even though its prepare was admitted [P2-S09-AC-865]');
select is(pg_temp.m_fstate(pg_temp.m_id('pend5')), (select factor_state from m_if_before),
  'the refused enrollment settle left the factor pending [P2-S09-AC-778]');
select is(pg_temp.m_fv(pg_temp.m_id('pend5')), (select factor_version from m_if_before), 'and its version [P2-S09-AC-778]');
select is(pg_temp.m_ver(5), (select mfa_version from m_if_before), 'and the account MFA version (no session rotation) [P2-S09-AC-778]');
select is(pg_temp.m_one(format('select state::text from identity.step_up_challenges where id = %L', pg_temp.m_id('chal5'))), (select challenge_state from m_if_before),
  'the refused step-up settle left the challenge unconsumed [P2-S09-AC-865]');
select is(pg_temp.m_events(5, 'mfa.enroll.verified'), (select enroll_events from m_if_before), 'no enrollment verified event was written [P2-S09-AC-778]');
select is(pg_temp.m_events(5, 'step_up.verified'), (select step_events from m_if_before), 'no step-up verified event was written [P2-S09-AC-865]');
select is(pg_temp.m_one(format('select last_used_at::text from identity.mfa_factor_registry where id = %L', pg_temp.m_fid(5))), (select last_used from m_if_before),
  'and the verified factor''s last_used_at did not move [P2-S09-AC-865]');
-- positive controls: once the lock has elapsed the same settles commit
select pg_temp.m_set_lock(5, $$locked_until = clock_timestamp() - interval '1 second'$$);
select pg_temp.m_csettle_lk('if:ok:s', 5, pg_temp.m_id('chal5'));
select is(pg_temp.m_out('if:ok:s'), 'OK', 'positive control: with no lock held the step-up settle commits [P2-S09-AC-865]');
select pg_temp.m_settle('if:ok:e', 5, pg_temp.m_id('pend5'), pg_temp.m_ver(5));
select is(pg_temp.m_out('if:ok:e'), 'OK', 'positive control: with no lock held the enrollment settle commits [P2-S09-AC-778]');
select is(pg_temp.m_fstate(pg_temp.m_id('pend5')), 'verified', 'and the factor is verified [P2-S09-AC-778]');

select * from finish();
rollback;
