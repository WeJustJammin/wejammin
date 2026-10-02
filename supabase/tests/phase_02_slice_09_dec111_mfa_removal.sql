commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a AUTH-API-19 and "Last verified factor"):
-- factor removal reserves `reconciling` before the provider effect and
-- confirms `removed` after it; idempotent by key hash; `factor_compromise`
-- revokes every other session by exact id; the last verified factor of an
-- account that holds a step-up capability is refused (fail closed).

\ir phase_02_slice_09_dec111/00-support.sqlinc

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

select pg_temp.m_user(n) from generate_series(1, 4) n;

-- user 1: two verified factors.
create temp table m_f(n integer, name text, id uuid, pid uuid) on commit drop;
insert into m_f select 1, 'One', pg_temp.m_enroll(1, 'One'), null;
insert into m_f select 1, 'Two', pg_temp.m_enroll(1, 'Two'), null;
update m_f set pid = pg_temp.m_one(format('select provider_factor_id::text from identity.mfa_factor_registry where id = %L', id))::uuid;

select pg_temp.m_rbegin('rb:reason', 1, (select id from m_f where name = 'One'), 'bogus', pg_temp.m_ver(1));
select is(pg_temp.m_out('rb:reason'), 'INVALID_REQUEST', 'an unknown removal reason is INVALID_REQUEST');
select pg_temp.m('rb:hash', 'auth_mfa_removal_begin', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from m_f where name = 'One'), 'p_reason', 'user_request',
  'p_expected_version', pg_temp.m_ver(1), 'p_session_id', pg_temp.m_sid(1),
  'p_key_hash', '\x' || repeat('a1', 16), 'p_request_hash', pg_temp.m_h('b2')));
select is(pg_temp.m_out('rb:hash'), 'INVALID_REQUEST', 'a key hash that is not 32 bytes is INVALID_REQUEST');
select pg_temp.m_rbegin('rb:stale', 1, (select id from m_f where name = 'One'), 'user_request', '1');
select is(pg_temp.m_out('rb:stale'), 'VERSION_MISMATCH', 'a stale If-Match is VERSION_MISMATCH');
select pg_temp.m_rbegin('rb:other', 2, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(2));
select is(pg_temp.m_out('rb:other'), 'NOT_FOUND', 'another user''s factor id is NOT_FOUND');
select pg_temp.m_rbegin('rb:nosess', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1), 'a1', 'b2', extensions.gen_random_uuid());
select is(pg_temp.m_out('rb:nosess'), 'UNAUTHENTICATED', 'an unknown session is 401');
select is(pg_temp.m_fstate((select id from m_f where name = 'One')), 'verified', 'refused removals change nothing');

create temp table m_v0 on commit drop as select pg_temp.m_ver(1)::bigint as v;
select pg_temp.m_rbegin('rb:ok', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1));
select is(pg_temp.m_out('rb:ok'), 'OK', 'removal begin reserves the removal');
select is(pg_temp.m_resp('rb:ok'), jsonb_build_object('providerFactorId', (select pid from m_f where name = 'One'), 'replay', null),
  'begin returns the protected provider factor id and no replay');
select is(pg_temp.m_fstate((select id from m_f where name = 'One')), 'reconciling', 'the factor is reconciling before the provider effect');
select is(pg_temp.m_ver(1)::bigint, (select v + 1 from m_v0), 'the reservation bumps the MFA version once');
select is(pg_temp.m_events(1, 'mfa.factor.removed'), 1, 'security evidence is committed with the reservation');
select is(pg_temp.m_one(format($$select count(*)::text from audit_private.audit_events where action = 'identity.mfa.factor.removal_reserved' and target_id = %L$$, (select id from m_f where name = 'One'))), '1',
  'audit evidence is committed with the reservation');
select ok(pg_temp.m_outbox('identity.mfa-factor.changed.v1', (select id from m_f where name = 'One')) >= 2,
  'the factor-changed outbox row (after the enrollment one) is committed with the reservation');
select is((select state::text from platform_private.idempotency_records where actor_id = pg_temp.m_uid(1) and operation = 'AUTH-API-19' and key_hash = decode(repeat('a1', 32), 'hex')),
  'reserved', 'the AUTH-API-19 idempotency record is reserved');
select pg_temp.m_rbegin('rb:retry', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1));
select is(pg_temp.m_out('rb:retry'), 'FACTOR_STATE_CONFLICT', 'a retry while the provider effect is unresolved is blocked (no blind resend)');
select pg_temp.m_rbegin('rb:mismatch', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1), 'a1', 'c3');
select is(pg_temp.m_out('rb:mismatch'), 'IDEMPOTENCY_MISMATCH', 'the same key with a different request hash is IDEMPOTENCY_MISMATCH');
select pg_temp.m_rbegin('rb:newkey', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1), 'd4', 'e5');
select is(pg_temp.m_out('rb:newkey'), 'FACTOR_STATE_CONFLICT', 'a new key for a reconciling factor is FACTOR_STATE_CONFLICT');

select pg_temp.m_rfinish('rf:other', 2, (select id from m_f where name = 'One'), 'user_request');
select is(pg_temp.m_out('rf:other'), 'NOT_FOUND', 'finish by another user is NOT_FOUND');
select pg_temp.m_rfinish('rf:notrec', 1, (select id from m_f where name = 'Two'), 'user_request', 'f6');
select is(pg_temp.m_out('rf:notrec'), 'FACTOR_STATE_CONFLICT', 'finish on a factor that was never reserved is FACTOR_STATE_CONFLICT');
create temp table m_v1 on commit drop as select pg_temp.m_ver(1)::bigint as v;
select pg_temp.m_rfinish('rf:ok', 1, (select id from m_f where name = 'One'), 'user_request');
select is(pg_temp.m_out('rf:ok'), 'OK', 'finish confirms the removal');
select is(pg_temp.m_fstate((select id from m_f where name = 'One')), 'removed', 'the factor is removed');
select ok(pg_temp.m_one(format('select (removed_at is not null)::text from identity.mfa_factor_registry where id = %L', (select id from m_f where name = 'One'))) = 'true',
  'removed_at is recorded');
select is(pg_temp.m_ver(1)::bigint, (select v + 1 from m_v1), 'confirmation bumps the MFA version once');
select is(jsonb_array_length(pg_temp.m_resp('rf:ok')->'factors'), 1, 'the snapshot omits the removed factor');
select is(pg_temp.m_resp('rf:ok')#>>'{factors,0,friendlyName}', 'Two', 'and keeps the other');
select ok(position((select pid::text from m_f where name = 'One') in pg_temp.m_resp('rf:ok')::text) = 0, 'the snapshot never carries the provider factor id');
select is((select state::text from platform_private.idempotency_records where actor_id = pg_temp.m_uid(1) and operation = 'AUTH-API-19' and key_hash = decode(repeat('a1', 32), 'hex')),
  'completed', 'the idempotency record is completed');
select is(pg_temp.m_events(1, 'mfa.factor.removed'), 2, 'completion adds a second security event');
select is((select count(*)::integer from identity.security_events where action = 'mfa.factor.removed' and actor_auth_user_id = pg_temp.m_uid(1) and reason_code = 'MFA_FACTOR_REMOVED'), 1,
  'the completion event carries the generic factor-removed reason');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'identity.security-notification.requested.v1'
            and payload->>'securityEventId' in (select id::text from identity.security_events where action = 'mfa.factor.removed' and reason_code = 'MFA_FACTOR_REMOVED' and actor_auth_user_id = pg_temp.m_uid(1))), 1,
  'a security notification is requested on confirmed removal');
select pg_temp.m_rfinish('rf:twice', 1, (select id from m_f where name = 'One'), 'user_request');
select is(pg_temp.m_out('rf:twice'), 'OK', 'finish is idempotent after completion');
select is(pg_temp.m_events(1, 'mfa.factor.removed'), 2, 'and adds no further evidence');
select pg_temp.m_rbegin('rb:replay', 1, (select id from m_f where name = 'One'), 'user_request', '1');
select is(pg_temp.m_out('rb:replay'), 'OK', 'the same key and hash after completion replays');
select is(pg_temp.m_resp('rb:replay')#>>'{replay,factors,0,friendlyName}', 'Two', 'the replay carries the current snapshot');
select is(pg_temp.m_resp('rb:replay')->>'providerFactorId', (select pid::text from m_f where name = 'One'), 'and the provider id');
select pg_temp.m_rbegin('rb:gone', 1, (select id from m_f where name = 'One'), 'user_request', pg_temp.m_ver(1), 'a7', 'a8');
select is(pg_temp.m_out('rb:gone'), 'FACTOR_STATE_CONFLICT', 'removing an already removed factor with a new key is FACTOR_STATE_CONFLICT');

-- user_request does not touch other sessions.
select platform_api.auth_session_register(pg_temp.m_uid(1), pg_temp.m_sid(1, 2), clock_timestamp(), extensions.gen_random_uuid(), extensions.gen_random_uuid());
select pg_temp.m_rbegin('rb:two', 1, (select id from m_f where name = 'Two'), 'user_request', pg_temp.m_ver(1), 'a9', 'b0');
select is(pg_temp.m_out('rb:two'), 'OK', 'with no step-up capability held the last verified factor may be removed');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(1, 2)), 'active',
  'a user_request removal leaves every session untouched');

-- pending cancel.
select pg_temp.m_pending(2, 'Draft');
create temp table m_pend2 on commit drop as select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(2) and state = 'pending';
select pg_temp.m_rbegin('pc:b', 2, (select id from m_pend2), 'user_request', pg_temp.m_ver(2));
select is(pg_temp.m_out('pc:b'), 'OK', 'a pending factor can be cancelled');
select is(pg_temp.m_fstate((select id from m_pend2)), 'reconciling', 'cancel goes through reconciling');
select pg_temp.m_rfinish('pc:f', 2, (select id from m_pend2), 'user_request');
select is(pg_temp.m_fstate((select id from m_pend2)), 'removed', 'and ends removed');

-- factor_compromise: every OTHER active session of this user, by exact id.
select pg_temp.m_enroll(3, 'A');
select pg_temp.m_enroll(3, 'B');
select platform_api.auth_session_register(pg_temp.m_uid(3), pg_temp.m_sid(3, 2), clock_timestamp(), extensions.gen_random_uuid(), extensions.gen_random_uuid());
select platform_api.auth_session_register(pg_temp.m_uid(3), pg_temp.m_sid(3, 3), clock_timestamp(), extensions.gen_random_uuid(), extensions.gen_random_uuid());
select pg_temp.m_rbegin('cp:b', 3, pg_temp.m_fid(3), 'factor_compromise', pg_temp.m_ver(3));
select is(pg_temp.m_out('cp:b'), 'OK', 'a compromise removal is accepted');
select is((select count(*)::integer from identity.auth_session_index where auth_user_id = pg_temp.m_uid(3) and state = 'active'), 1,
  'every other active session is revoked');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(3, 1)), 'active', 'the current session is retained');
select is((select count(*)::integer from identity.auth_session_index where auth_user_id = pg_temp.m_uid(1) and state = 'active'), 2,
  'sessions of other accounts are untouched');
select ok((select bool_and(revocation_reason is not null and revoked_at is not null) from identity.auth_session_index
            where auth_user_id = pg_temp.m_uid(3) and state = 'revoked'), 'revoked rows record time and reason');

-- last verified factor with a step-up capability: see the guard suite; here the
-- fail-closed behavior when the capability read is unavailable.
select pg_temp.m_enroll(4, 'Only');
alter table identity_private.organization_actor_grant rename to organization_actor_grant_unavailable;
select pg_temp.m_rbegin('lf:down', 4, pg_temp.m_fid(4), 'user_request', pg_temp.m_ver(4));
alter table identity_private.organization_actor_grant_unavailable rename to organization_actor_grant;
select is(pg_temp.m_out('lf:down'), 'LAST_FACTOR_REQUIRED', 'an unavailable capability read refuses the last-factor removal (fail closed)');
select is(pg_temp.m_fstate(pg_temp.m_fid(4)), 'verified', 'and mutates nothing');
select pg_temp.m_enroll(4, 'Second');
select pg_temp.m_rbegin('lf:two', 4, pg_temp.m_fid(4), 'user_request', pg_temp.m_ver(4));
select is(pg_temp.m_out('lf:two'), 'OK', 'with another verified factor present the removal is not "last"');

select * from finish();

rollback;
