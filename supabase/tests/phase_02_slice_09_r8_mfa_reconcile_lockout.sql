commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (Codex f3c0736e high, r8-auth NEEDS-DB): the MFA verification
-- lockout (AUTH-API-18 / AUTH-API-21, one account-scoped budget) was re-checked
-- by both verify-prepare RPCs and both settle RPCs, but NOT by the
-- auth-state-reconciler's settlement.  A settle refused with
-- MFA_VERIFICATION_LOCKED followed by a reconcile could therefore still verify
-- the factor, and a provider-ambiguous mark-reconciling followed by a reconcile
-- could verify a factor during the 15-minute lock.  The reconciler must refuse
-- every outcome that makes a factor verifiable (`verified`, `pending`) with
-- MFA_VERIFICATION_LOCKED:<seconds> while the persisted lock is active, leaving
-- the row reconciling and writing nothing; `removed` never verifies anything
-- and stays allowed.  An expired lock no longer refuses.

\ir phase_02_slice_09_dec111/00-support.sqlinc

create or replace function pg_temp.m_reconcile(p_label text, p_n integer, p_factor uuid, p_outcome text, p_version text default null)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_factor_reconcile', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor, 'p_outcome', p_outcome,
    'p_expected_version', coalesce(p_version, pg_temp.m_fv(p_factor)))) $body$;
create or replace function pg_temp.m_mark(p_label text, p_n integer, p_factor uuid)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor)) $body$;
-- Ten shared failures persist the 15-minute lock.
create or replace function pg_temp.m_lock(p_n integer) returns void language plpgsql as $body$
begin
  for i in 1..10 loop
    perform pg_temp.m('lk:' || p_n || ':' || i, 'auth_mfa_verification_failure_record', jsonb_build_object(
      'p_auth_user_id', pg_temp.m_uid(p_n), 'p_outcome', 'incorrect'));
  end loop;
end;
$body$;
create or replace function pg_temp.m_locked(p_n integer) returns boolean language sql stable as $body$
  select coalesce(pg_temp.m_one(format('select (locked_until > clock_timestamp())::text from identity.mfa_verification_lockouts where auth_user_id = %L', pg_temp.m_uid(p_n))), 'false') = 'true' $body$;
create or replace function pg_temp.m_snapshot(p_n integer, p_factor uuid) returns text language sql stable as $body$
  select concat_ws('|', pg_temp.m_fstate(p_factor), pg_temp.m_fv(p_factor), pg_temp.m_ver(p_n),
    pg_temp.m_events(p_n, 'mfa.factor.reconciled')::text, pg_temp.m_outbox('identity.mfa-factor.changed.v1', p_factor)::text) $body$;

-- ---- sequence: settle refused by the lock, then the reconciler (user 1) ----
select pg_temp.m_user(1);
select pg_temp.m_pending(1, 'Phone');
create temp table r8m_f1 on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(1) and state = 'pending';
create temp table r8m_v1 on commit drop as select pg_temp.m_ver(1) as version;
select pg_temp.m_lock(1);
select ok(pg_temp.m_locked(1), 'fixture: ten shared failures persisted the 15-minute lock [P2-S09-AC-778]');
select pg_temp.m_settle('r8:settle', 1, (select id from r8m_f1), (select version from r8m_v1));
select ok(pg_temp.m_out('r8:settle') like 'MFA_VERIFICATION_LOCKED:%',
  'the enrollment settle is refused while the account is locked [P2-S09-AC-778] [P2-S09-AC-865]');
select is(pg_temp.m_fstate((select id from r8m_f1)), 'pending',
  'the refused settle leaves the factor pending, never reconciling [P2-S09-AC-778] [P2-S09-AC-865]');
select pg_temp.m_reconcile('r8:reconcile:notreconciling', 1, (select id from r8m_f1), 'verified');
select ok(pg_temp.m_out('r8:reconcile:notreconciling') like 'MFA_VERIFICATION_LOCKED:%'
    and pg_temp.m_fstate((select id from r8m_f1)) = 'pending',
  'a reconcile straight after the refused settle is refused by the lock and the factor stays pending [P2-S09-AC-778] [P2-S09-AC-904]');
select pg_temp.m_mark('r8:mark', 1, (select id from r8m_f1));
select is(pg_temp.m_out('r8:mark') || '/' || pg_temp.m_fstate((select id from r8m_f1)), 'OK/reconciling',
  'a provider-ambiguous mark-reconciling is still accepted during the lock (it verifies nothing) [P2-S09-AC-904]');
create temp table r8m_s1 on commit drop as select pg_temp.m_snapshot(1, (select id from r8m_f1)) as snapshot;
select pg_temp.m_reconcile('r8:reconcile:verified', 1, (select id from r8m_f1), 'verified');
select ok(pg_temp.m_out('r8:reconcile:verified') like 'MFA_VERIFICATION_LOCKED:%',
  'the reconciler refuses to verify a reconciling factor while the account lock is active [P2-S09-AC-778] [P2-S09-AC-865] [P2-S09-AC-904]');
select pg_temp.m_reconcile('r8:reconcile:pending', 1, (select id from r8m_f1), 'pending');
select ok(pg_temp.m_out('r8:reconcile:pending') like 'MFA_VERIFICATION_LOCKED:%',
  'nor may it return the factor to pending, a verifiable state, while the lock is active [P2-S09-AC-778] [P2-S09-AC-904]');
select is(pg_temp.m_snapshot(1, (select id from r8m_f1)), (select snapshot from r8m_s1),
  'both refusals wrote nothing: factor state and version, MFA version, security events and outbox rows are unchanged [P2-S09-AC-778] [P2-S09-AC-913]');
select pg_temp.m_reconcile('r8:reconcile:stale', 1, (select id from r8m_f1), 'verified', '999');
select ok(pg_temp.m_out('r8:reconcile:stale') like 'MFA_VERIFICATION_LOCKED:%',
  'a stale-version delivery is refused by the lock before any compare-and-set result is revealed [P2-S09-AC-778] [P2-S09-AC-913]');
select is((select (pg_temp.m_one(format('select remaining::text from (select ceil(extract(epoch from (locked_until - clock_timestamp())))::integer as remaining from identity.mfa_verification_lockouts where auth_user_id = %L) r', pg_temp.m_uid(1))))::integer between 1 and 900), true,
  'the lock is still within its 15-minute term [P2-S09-AC-778]');

-- the lock expires: the same reconciling factor now verifies (user 1, same row)
select pg_temp.m_warp('mfa_verification_lockouts', $$locked_until = clock_timestamp() - interval '1 second'$$, format('auth_user_id = %L', pg_temp.m_uid(1)));
select pg_temp.m_reconcile('r8:reconcile:expired', 1, (select id from r8m_f1), 'verified');
select is(pg_temp.m_out('r8:reconcile:expired') || '/' || pg_temp.m_fstate((select id from r8m_f1)), 'OK/verified',
  'positive control: once the lock has expired the reconciler verifies the factor [P2-S09-AC-778] [P2-S09-AC-904]');

-- ---- removed is never a verification: allowed during the lock (user 2) ----
select pg_temp.m_user(2);
select pg_temp.m_pending(2, 'Phone');
create temp table r8m_f2 on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(2) and state = 'pending';
select pg_temp.m_mark('r8:mark2', 2, (select id from r8m_f2));
select pg_temp.m_lock(2);
select ok(pg_temp.m_locked(2), 'fixture: user 2 is locked with a reconciling factor');
select pg_temp.m_reconcile('r8:reconcile:removed', 2, (select id from r8m_f2), 'removed');
select is(pg_temp.m_out('r8:reconcile:removed') || '/' || pg_temp.m_fstate((select id from r8m_f2)), 'OK/removed',
  'a removed outcome settles during the lock: it verifies nothing [P2-S09-AC-904]');

-- ---- an unlocked account is unaffected (user 3), and the lock is per account ----
select pg_temp.m_user(3);
select pg_temp.m_pending(3, 'Phone');
create temp table r8m_f3 on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(3) and state = 'pending';
select pg_temp.m_mark('r8:mark3', 3, (select id from r8m_f3));
select pg_temp.m_reconcile('r8:reconcile:other', 3, (select id from r8m_f3), 'verified');
select is(pg_temp.m_out('r8:reconcile:other') || '/' || pg_temp.m_fstate((select id from r8m_f3)), 'OK/verified',
  'positive control: another account''s lock does not block this account''s reconcile (the lock is per account) [P2-S09-AC-778]');

select * from finish();
rollback;
