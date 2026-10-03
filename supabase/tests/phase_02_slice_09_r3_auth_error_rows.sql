commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): database halves of the AUTH-API-16..21 error
-- rows the Worker lane proves only by mapping.  Each assertion PRODUCES the
-- condition through the real RPC (an unknown Auth UUID, a suspended account, a
-- malformed version) and expects the exact token the Worker maps to the HTTP
-- status (production-mfa-failures.ts / production-mfa-persistence): UNAUTHENTICATED
-- 401, ACCOUNT_NOT_ELIGIBLE 403, INVALID_REQUEST 400, plus AC906 outbox payloads.

\ir phase_02_slice_09_dec111/00-support.sqlinc

-- Shared call helpers (same bodies as the challenge and removal suites).
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

create or replace function pg_temp.m_h(p_byte text) returns text language sql immutable as $body$
  select '\x' || repeat(p_byte, 32) $body$;

create or replace function pg_temp.m_rbegin(
  p_label text, p_n integer, p_factor uuid, p_reason text, p_ver text,
  p_key text default 'a1', p_req text default 'b2', p_session uuid default null)
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_removal_begin', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor, 'p_reason', p_reason,
    'p_expected_version', p_ver, 'p_session_id', coalesce(p_session, pg_temp.m_sid(p_n)),
    'p_key_hash', pg_temp.m_h(p_key), 'p_request_hash', pg_temp.m_h(p_req))) $body$;

create or replace function pg_temp.m_rfinish(
  p_label text, p_n integer, p_factor uuid, p_reason text, p_key text default 'a1')
returns jsonb language sql as $body$
  select pg_temp.m(p_label, 'auth_mfa_removal_finish', jsonb_build_object(
    'p_auth_user_id', pg_temp.m_uid(p_n), 'p_factor_id', p_factor, 'p_reason', p_reason,
    'p_session_id', pg_temp.m_sid(p_n), 'p_key_hash', pg_temp.m_h(p_key))) $body$;


select pg_temp.m_user(n) from generate_series(1, 3) n;
-- user 1: one verified factor and a pending one is not needed; user 2 is the suspended account.
create temp table r3_f on commit drop as select pg_temp.m_enroll(1, 'Primary') as id;
create temp table r3_f2 on commit drop as select pg_temp.m_enroll(2, 'Secondary') as id;
select pg_temp.m_begin('r3:pend', 2, 'Pending');
create temp table r3_v on commit drop as select pg_temp.m_ver(2) as v;
select pg_temp.m_finish('r3:pendfin', 2, 'Pending', (select v from r3_v));
create temp table r3_pending on commit drop as
select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(2) and state = 'pending';
select ok((select count(*) = 1 from r3_pending), 'fixture: user 2 has a verified factor and a pending enrollment');
select pg_temp.m_cbegin('r3:cb2', 2, (select id from r3_f2));
select pg_temp.m_cfinish('r3:cf2', 2, (select id from r3_f2));
create temp table r3_chal on commit drop as
select id from identity.step_up_challenges where auth_user_id = pg_temp.m_uid(2) and state = 'pending';
select ok((select count(*) = 1 from r3_chal), 'fixture: user 2 has a pending step-up challenge');
update identity.auth_user_bindings set state = 'suspended' where auth_user_id = pg_temp.m_uid(2);

-- 403: an account that is not eligible.
select pg_temp.m_begin('e17:begin', 2, 'Blocked', pg_temp.m_ver(2));
select is(pg_temp.m_out('e17:begin'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-17 begin for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-754]');
select pg_temp.m_finish('e17:finish', 2, 'Blocked', pg_temp.m_ver(2));
select is(pg_temp.m_out('e17:finish'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-17 finish for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-754]');
select pg_temp.m_prepare('e18:prep', 2, (select id from r3_pending), pg_temp.m_ver(2));
select is(pg_temp.m_out('e18:prep'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-18 verify-prepare for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-781]');
select pg_temp.m_settle('e18:settle', 2, (select id from r3_pending), pg_temp.m_ver(2));
select is(pg_temp.m_out('e18:settle'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-18 verify-settle for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-781]');
select pg_temp.m_rbegin('e19:begin', 2, (select id from r3_f2), 'user_request', pg_temp.m_ver(2));
select is(pg_temp.m_out('e19:begin'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-19 removal begin for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-812]');
select pg_temp.m_rfinish('e19:finish', 2, (select id from r3_f2), 'user_request');
select is(pg_temp.m_out('e19:finish'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-19 removal finish for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-812]');
select pg_temp.m_cbegin('e20:begin', 2, (select id from r3_f2));
select is(pg_temp.m_out('e20:begin'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-20 challenge begin for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-842]');
select pg_temp.m_cfinish('e20:finish', 2, (select id from r3_f2));
select is(pg_temp.m_out('e20:finish'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-20 challenge finish for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-842]');
select pg_temp.m_cprep('e21:prep', 2, (select id from r3_chal));
select is(pg_temp.m_out('e21:prep'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-21 verify-prepare for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-868]');
select pg_temp.m_cfail('e21:fail', 2, (select id from r3_chal), 'incorrect');
select is(pg_temp.m_out('e21:fail'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-21 failure record for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-868]');
select pg_temp.m_csettle('e21:settle', 2, (select id from r3_chal));
select is(pg_temp.m_out('e21:settle'), 'ACCOUNT_NOT_ELIGIBLE', 'AUTH-API-21 verify-settle for a suspended account raises ACCOUNT_NOT_ELIGIBLE (403) [P2-S09-AC-868]');
update identity.auth_user_bindings set state = 'active' where auth_user_id = pg_temp.m_uid(2);

-- 401: an Auth UUID with no binding (no session) is UNAUTHENTICATED on every operation.
create temp table r3_ghost on commit drop as select extensions.gen_random_uuid() as uid;
select pg_temp.m('u17', 'auth_mfa_enrollment_begin', jsonb_build_object('p_auth_user_id', (select uid from r3_ghost), 'p_friendly_name', 'Ghost', 'p_expected_version', '1'));
select is(pg_temp.m_out('u17'), 'UNAUTHENTICATED', 'AUTH-API-17 begin for an Auth UUID with no binding raises UNAUTHENTICATED (401) [P2-S09-AC-753]');
select pg_temp.m('u18', 'auth_mfa_enrollment_verify_prepare', jsonb_build_object('p_auth_user_id', (select uid from r3_ghost), 'p_factor_id', (select id from r3_f), 'p_expected_version', '1'));
select is(pg_temp.m_out('u18'), 'UNAUTHENTICATED', 'AUTH-API-18 verify-prepare for an Auth UUID with no binding raises UNAUTHENTICATED (401) [P2-S09-AC-780]');
select pg_temp.m('u19', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', (select uid from r3_ghost), 'p_factor_id', (select id from r3_f), 'p_reason', 'user_request',
  'p_expected_version', '1', 'p_session_id', extensions.gen_random_uuid(), 'p_key_hash', pg_temp.m_h('a1'), 'p_request_hash', pg_temp.m_h('b2')));
select is(pg_temp.m_out('u19'), 'UNAUTHENTICATED', 'AUTH-API-19 removal begin for an Auth UUID with no binding raises UNAUTHENTICATED (401) [P2-S09-AC-811]');
select pg_temp.m('u20', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', (select uid from r3_ghost), 'p_session_id', extensions.gen_random_uuid(), 'p_method', 'totp', 'p_factor_id', null));
select is(pg_temp.m_out('u20'), 'UNAUTHENTICATED', 'AUTH-API-20 challenge begin for an Auth UUID with no binding raises UNAUTHENTICATED (401) [P2-S09-AC-841]');
select pg_temp.m('u21', 'auth_step_up_challenge_verify_prepare', jsonb_build_object('p_auth_user_id', (select uid from r3_ghost), 'p_session_id', extensions.gen_random_uuid(), 'p_challenge_id', (select id from r3_chal)));
select is(pg_temp.m_out('u21'), 'UNAUTHENTICATED', 'AUTH-API-21 verify-prepare for an Auth UUID with no binding raises UNAUTHENTICATED (401) [P2-S09-AC-867]');
select pg_temp.m_cfinish('u20:foreignsession', 1, (select id from r3_f), interval '5 minutes', 7);
select is(pg_temp.m_out('u20:foreignsession'), 'UNAUTHENTICATED', 'AUTH-API-20 challenge finish bound to a session that does not belong to the caller raises UNAUTHENTICATED (401) [P2-S09-AC-841]');

-- 400: malformed versions and identifiers.
select pg_temp.m_prepare('b18:ver01', 1, (select id from r3_f), '01');
select is(pg_temp.m_out('b18:ver01'), 'INVALID_REQUEST', 'AUTH-API-18 verify-prepare with a version that is not a positive decimal raises INVALID_REQUEST (400) [P2-S09-AC-779]');
select pg_temp.m_prepare('b18:ver0', 1, (select id from r3_f), '0');
select is(pg_temp.m_out('b18:ver0'), 'INVALID_REQUEST', 'and so does version 0 [P2-S09-AC-779]');
select pg_temp.m_rbegin('b19:ver', 1, (select id from r3_f), 'user_request', 'x');
select is(pg_temp.m_out('b19:ver'), 'INVALID_REQUEST', 'AUTH-API-19 removal begin with a malformed If-Match version raises INVALID_REQUEST (400) [P2-S09-AC-796] [P2-S09-AC-810]');
select pg_temp.m_rbegin('b19:ver0', 1, (select id from r3_f), 'user_request', '0');
select is(pg_temp.m_out('b19:ver0'), 'INVALID_REQUEST', 'and version 0 is not a strong positive decimal either [P2-S09-AC-796]');
select pg_temp.m_rbegin('b19:ver01', 1, (select id from r3_f), 'user_request', '01');
select is(pg_temp.m_out('b19:ver01'), 'INVALID_REQUEST', 'and neither is a leading-zero version [P2-S09-AC-796]');
select pg_temp.m_cprep('b21:nochal', 1, null);
select is(pg_temp.m_out('b21:nochal'), 'NOT_FOUND', 'AUTH-API-21 verify-prepare without a challenge id is the concealed NOT_FOUND (404), never a 5xx [P2-S09-AC-869]');

-- AC906: identity.mfa-factor.changed.v1 carries exactly { mfaFactorId, authBindingId }
-- for every producer, with the aggregate version equal to the factor version.
select ok((select count(*) > 0 from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1'),
  'fixture: factor-changed events were produced by the enrollment fixtures');
select is((select count(*) from platform_private.outbox_events o
            where o.event_type = 'identity.mfa-factor.changed.v1'
              and (select array_agg(k order by k) from jsonb_object_keys(o.payload) k) is distinct from array['authBindingId', 'mfaFactorId']),
  0::bigint, 'every factor-changed payload has exactly the keys authBindingId and mfaFactorId [P2-S09-AC-906]');
select is((select count(*) from platform_private.outbox_events o
            where o.event_type = 'identity.mfa-factor.changed.v1'
              and not exists (select 1 from identity.mfa_factor_registry f
                               join identity.auth_user_bindings b on b.auth_user_id = f.auth_user_id
                              where f.id = (o.payload->>'mfaFactorId')::uuid and b.id = (o.payload->>'authBindingId')::uuid
                                and o.aggregate_id = f.id and f.version >= o.aggregate_version)),
  0::bigint, 'every payload id resolves to the factor and the binding of the same account, and the aggregate version is not ahead of the factor [P2-S09-AC-906]');
select is((select count(*) from platform_private.outbox_events o
            where o.event_type = 'identity.mfa-factor.changed.v1'
              and o.payload::text ~* '(secret|otpauth|provider|totp|code|token|uri)'), 0::bigint,
  'no payload carries a secret, URI, code, token or provider id [P2-S09-AC-906]');
-- Per producer: one event with the post-change factor version.
create or replace function pg_temp.r3_last_event_version(p_factor uuid) returns bigint language sql as $body$
  select max(aggregate_version) from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = p_factor $body$;
select is(pg_temp.r3_last_event_version((select id from r3_f)), (select version from identity.mfa_factor_registry where id = (select id from r3_f)),
  'the verify-settle producer emitted an event at the factor version [P2-S09-AC-906]');
select pg_temp.m('mr:906', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from r3_f)));
select is(pg_temp.r3_last_event_version((select id from r3_f)), (select version from identity.mfa_factor_registry where id = (select id from r3_f)),
  'the mark-reconciling producer emitted an event at the new factor version [P2-S09-AC-906]');
select pg_temp.m('rc:906:verified', 'auth_mfa_factor_reconcile', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from r3_f), 'p_outcome', 'verified'));
select is(pg_temp.r3_last_event_version((select id from r3_f)), (select version from identity.mfa_factor_registry where id = (select id from r3_f)),
  'the reconcile producer (outcome verified) emitted an event at the new factor version [P2-S09-AC-906]');
select is((select payload from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = (select id from r3_f)
            and aggregate_version = (select version from identity.mfa_factor_registry where id = (select id from r3_f))),
  jsonb_build_object('mfaFactorId', (select id from r3_f), 'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(1))),
  'the reconcile (verified) payload is exactly { mfaFactorId, authBindingId } with those values [P2-S09-AC-906]');
select pg_temp.m('mr:906b', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from r3_f)));
select pg_temp.m('rc:906:removed', 'auth_mfa_factor_reconcile', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from r3_f), 'p_outcome', 'removed'));
select is((select payload from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = (select id from r3_f)
            and aggregate_version = (select version from identity.mfa_factor_registry where id = (select id from r3_f))),
  jsonb_build_object('mfaFactorId', (select id from r3_f), 'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(1))),
  'the reconcile (removed) payload is exactly { mfaFactorId, authBindingId } with those values [P2-S09-AC-906]');
select is((select state::text from identity.mfa_factor_registry where id = (select id from r3_f)), 'removed', 'the removed outcome settled the factor to removed');
select pg_temp.m_pending(3, 'ReconPending');
create temp table r3_p3 on commit drop as select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(3) and state = 'pending';
select pg_temp.m('mr:906c', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(3), 'p_factor_id', (select id from r3_p3)));
select pg_temp.m('rc:906:pending', 'auth_mfa_factor_reconcile', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(3), 'p_factor_id', (select id from r3_p3), 'p_outcome', 'pending'));
select is((select payload from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = (select id from r3_p3)
            and aggregate_version = (select version from identity.mfa_factor_registry where id = (select id from r3_p3))),
  jsonb_build_object('mfaFactorId', (select id from r3_p3), 'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(3))),
  'the reconcile (pending) payload is exactly { mfaFactorId, authBindingId } with those values [P2-S09-AC-906]');
select is((select state::text from identity.mfa_factor_registry where id = (select id from r3_p3)), 'pending', 'the pending outcome settled the factor to pending');
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 second'$$, format('id = %L', (select id from r3_p3)));
select pg_temp.m('sw:906', 'auth_mfa_registry_sweep', jsonb_build_object('p_batch', 100, '_notrace', true));
select is((select payload from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = (select id from r3_p3)
            and aggregate_version = (select version from identity.mfa_factor_registry where id = (select id from r3_p3))),
  jsonb_build_object('mfaFactorId', (select id from r3_p3), 'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(3))),
  'the registry-sweep expiry producer emits the same exact payload at the expired version [P2-S09-AC-906]');

select * from finish();
rollback;
