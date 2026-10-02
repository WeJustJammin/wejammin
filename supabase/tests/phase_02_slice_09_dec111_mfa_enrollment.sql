commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a AUTH-API-16/17/18): factor list read,
-- enrollment start (transaction A + B), enrollment verify (prepare + settle
-- with first-party session rotation), reconciliation, the 10-live-factor
-- bound, the MFA version CAS and the audit/security/outbox evidence.

\ir phase_02_slice_09_dec111/00-support.sqlinc

select pg_temp.m_user(1);  -- main path
select pg_temp.m_user(2);  -- cross-user isolation, rotation
select pg_temp.m_user(4);  -- ten-factor bound
select pg_temp.m_user(5);  -- reconciliation

-- ---- AUTH-API-16 read ------------------------------------------------------
select pg_temp.m('rd0', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1)));
select is(pg_temp.m_resp('rd0'), jsonb_build_object('factors', '[]'::jsonb, 'version', '1'),
  'a new account reads an empty factor list at MFA version "1"');
select pg_temp.m('rd:none', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', extensions.gen_random_uuid()));
select is(pg_temp.m_out('rd:none'), 'UNAUTHENTICATED', 'an Auth UUID with no binding reads 401');
update identity.auth_user_bindings set state = 'suspended' where auth_user_id = pg_temp.m_uid(5);
select pg_temp.m('rd:susp', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5)));
select is(pg_temp.m_out('rd:susp'), 'ACCOUNT_NOT_ELIGIBLE', 'a suspended account is not eligible (403 account_not_eligible)');
update identity.auth_user_bindings set state = 'active' where auth_user_id = pg_temp.m_uid(5);

-- ---- AUTH-API-17 transaction A (begin) ------------------------------------
select pg_temp.m_begin('b:stale', 1, 'Phone', '7');
select is(pg_temp.m_out('b:stale'), 'VERSION_MISMATCH', 'a stale If-Match is VERSION_MISMATCH [P2-S09-AC-889]');
select pg_temp.m_begin('b:badver', 1, 'Phone', '01');
select is(pg_temp.m_out('b:badver'), 'INVALID_REQUEST', 'a malformed version is INVALID_REQUEST');
select pg_temp.m_begin('bn1', 1, '');
select pg_temp.m_begin('bn2', 1, ' padded');
select pg_temp.m_begin('bn3', 1, repeat('x', 81));
select pg_temp.m_begin('bn4', 1, E'bad\nname');
select pg_temp.m_begin('bn5', 1, E'café');
select is(pg_temp.m_out(l), 'INVALID_REQUEST', 'friendly name ' || l || ' is refused')
from unnest(array['bn1', 'bn2', 'bn3', 'bn4', 'bn5']) l;
select pg_temp.m_begin('b:ok', 1, 'Phone');
select is(pg_temp.m_resp('b:ok'), jsonb_build_object('supersededProviderFactorId', null, 'version', '1'),
  'begin with no pending row supersedes nothing and leaves the MFA version at 1');
select is(pg_temp.m_ver(1), '1', 'begin alone does not change the stored MFA version [P2-S09-AC-750]');
select pg_temp.m_begin('b:user2', 2, 'Phone');
select is(pg_temp.m_out('b:user2'), 'OK', 'a begin for user 2 is independent of user 1 (the version is per account)');

-- ---- transaction B (finish) -------------------------------------------------
select pg_temp.m_finish('f:stale', 1, 'Phone', '9');
select is(pg_temp.m_out('f:stale'), 'VERSION_MISMATCH', 'finish with a stale version is VERSION_MISMATCH');
select pg_temp.m('f:badsession', 'auth_mfa_enrollment_finish', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(1), 'p_provider_factor_id', extensions.gen_random_uuid(),
  'p_friendly_name', 'Phone', 'p_expected_version', '1', 'p_session_id', pg_temp.m_sid(2)));
select is(pg_temp.m_out('f:badsession'), 'UNAUTHENTICATED', 'finish with another user''s session is 401');
select is(pg_temp.m_ver(1), '1', 'a refused finish leaves the MFA version unchanged');
select pg_temp.m_finish('f:ok', 1, 'Phone', '1');
select is(pg_temp.m_out('f:ok'), 'OK', 'finish inserts the pending row [P2-S09-AC-750]');
select ok(pg_temp.m_resp('f:ok')->>'factorId' ~ '^[0-9a-f-]{36}$' and pg_temp.m_resp('f:ok')->>'version' = '2',
  'finish returns the application factor id and the bumped version "2"');
select ok((pg_temp.m_resp('f:ok')->>'expiresAt')::timestamptz between clock_timestamp() + interval '9 minutes 50 seconds'
    and clock_timestamp() + interval '10 minutes',
  'the pending window is created_at + 10 minutes [P2-S09-AC-744]');
select is(pg_temp.m_ver(1), '2', 'finish bumps the MFA version exactly once [P2-S09-AC-750] [P2-S09-AC-889] [P2-S09-AC-902]');
select is(pg_temp.m_fstate(pg_temp.m_fid(1)), 'pending', 'the registry row is pending');
select is(pg_temp.m_one(format('select friendly_name from identity.mfa_factor_registry where id = %L', pg_temp.m_fid(1))), 'Phone',
  'the friendly name is stored as given');
select is(pg_temp.m_events(1, 'mfa.enroll.started'), 1, 'one mfa.enroll.started security event [P2-S09-AC-750] [P2-S09-AC-907]');
select is(pg_temp.m_one(format($$select count(*)::text from audit_private.audit_events where action = 'identity.mfa.enroll.started' and target_id = %L$$, pg_temp.m_fid(1))), '1',
  'one BE00 audit row for the enrollment start [P2-S09-AC-750]');
select pg_temp.m('rd1', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1)));
select is(pg_temp.m_resp('rd1')->>'version', '2', 'the read reports the bumped version');
select is(pg_temp.m_resp('rd1')#>>'{factors,0,state}', 'pending', 'the read lists the pending factor');
select ok(pg_temp.m_resp('rd1')#>>'{factors,0,pendingExpiresAt}' is not null
    and pg_temp.m_resp('rd1')#>>'{factors,0,verifiedAt}' is null
    and pg_temp.m_resp('rd1')#>>'{factors,0,lastUsedAt}' is null
    and pg_temp.m_resp('rd1')#>>'{factors,0,method}' = 'totp',
  'the pending projection carries pendingExpiresAt and no verified/last-used time');
select ok(pg_temp.m_resp('rd1')#>>'{factors,0,pendingExpiresAt}' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$',
  'times are ISO-8601 UTC with milliseconds');
select ok(position(pg_temp.m_pfid(1)::text in pg_temp.m_resp('rd1')::text) = 0
    and position(pg_temp.m_pfid(1)::text in pg_temp.m_resp('f:ok')::text) = 0,
  'neither the read nor finish exposes the provider factor id');
select is((select count(*)::integer from jsonb_object_keys(pg_temp.m_resp('rd1')#>'{factors,0}')), 7,
  'the factor projection has exactly the 7 contract fields');

-- one pending row: a second finish without begin collides.
select pg_temp.m_finish('f:dup', 1, 'Other', pg_temp.m_ver(1));
select is(pg_temp.m_out('f:dup'), 'FACTOR_STATE_CONFLICT', 'a second pending row for the same account is FACTOR_STATE_CONFLICT');

-- ---- AUTH-API-18 prepare ----------------------------------------------------
select pg_temp.m_prepare('p:other', 2, pg_temp.m_fid(1), pg_temp.m_ver(2));
select is(pg_temp.m_out('p:other'), 'NOT_FOUND', 'another user''s factor id is NOT_FOUND (no existence oracle)');
select pg_temp.m_prepare('p:stale', 1, pg_temp.m_fid(1), '1');
select is(pg_temp.m_out('p:stale'), 'VERSION_MISMATCH', 'prepare with a stale version is VERSION_MISMATCH');
select pg_temp.m_prepare('p:ok', 1, pg_temp.m_fid(1), pg_temp.m_ver(1));
select is(pg_temp.m_resp('p:ok'), jsonb_build_object('providerFactorId', pg_temp.m_pfid(1)),
  'prepare returns exactly the protected provider factor id');
select is(pg_temp.m_ver(1), '2', 'prepare is read-only (no version change)');

-- expired pending window
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 second'$$,
  format('id = %L', pg_temp.m_fid(1)));
select pg_temp.m_prepare('p:exp', 1, pg_temp.m_fid(1), pg_temp.m_ver(1));
select is(pg_temp.m_out('p:exp'), 'ENROLLMENT_EXPIRED', 'prepare on an expired pending row is ENROLLMENT_EXPIRED');
select pg_temp.m_settle('s:exp', 1, pg_temp.m_fid(1), pg_temp.m_ver(1));
select is(pg_temp.m_out('s:exp'), 'ENROLLMENT_EXPIRED', 'settle on an expired pending row is ENROLLMENT_EXPIRED');
select pg_temp.m('rd:exp', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1)));
select is(jsonb_array_length(pg_temp.m_resp('rd:exp')->'factors'), 0, 'an expired pending row is hidden from the list');

-- supersession: begin expires the stale pending row and returns its provider id.
select pg_temp.m_begin('b:sup', 1, 'Phone');
select is(pg_temp.m_resp('b:sup')->>'supersededProviderFactorId', pg_temp.m_pfid(1)::text,
  'begin returns the superseded unverified provider factor id for cleanup [P2-S09-AC-748]');
select is(pg_temp.m_resp('b:sup')->>'version', '3', 'superseding a pending row bumps the version (2 -> 3) [P2-S09-AC-748]');
select is(pg_temp.m_fstate(pg_temp.m_fid(1)), 'expired', 'the superseded row is expired [P2-S09-AC-748]');
select is(pg_temp.m_events(1, 'mfa.enroll.expired'), 1, 'one mfa.enroll.expired security event');
select pg_temp.m_finish('f:again', 1, 'Phone', '3');
select is(pg_temp.m_out('f:again'), 'OK', 'the replacement pending row may reuse the name of the expired one');
select is(pg_temp.m_ver(1), '4', 'the second finish bumps to 4');

-- ---- settle -----------------------------------------------------------------
create temp table m_pending_user1 on commit drop as
  select id, provider_factor_id from identity.mfa_factor_registry
   where auth_user_id = pg_temp.m_uid(1) and state = 'pending';
select pg_temp.m_settle('s:stale', 1, (select id from m_pending_user1), '2');
select is(pg_temp.m_out('s:stale'), 'VERSION_MISMATCH', 'settle with a stale version is VERSION_MISMATCH');
-- a new session id that already belongs to another user cannot be rotated onto.
select pg_temp.m_settle('s:badrot', 1, (select id from m_pending_user1), '4', pg_temp.m_sid(2));
select is(pg_temp.m_out('s:badrot'), 'UNAUTHENTICATED', 'rotating onto another user''s session id is refused');
select is(pg_temp.m_fstate((select id from m_pending_user1)), 'pending', 'a refused rotation rolls the settlement back (factor still pending)');
select is(pg_temp.m_ver(1), '4', 'a refused rotation leaves the MFA version unchanged');
select pg_temp.m('s:nosess', 'auth_mfa_enrollment_verify_settle', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from m_pending_user1), 'p_expected_version', '4',
  'p_session_id', extensions.gen_random_uuid(), 'p_new_session_id', extensions.gen_random_uuid(),
  'p_issued_at', clock_timestamp()));
select is(pg_temp.m_out('s:nosess'), 'UNAUTHENTICATED', 'an unknown initiating session is 401');

-- Same-session settle: touch, no new row.
select pg_temp.m_warp('auth_session_index', $$last_seen_at = clock_timestamp() - interval '1 hour'$$, format('session_id = %L', pg_temp.m_sid(1)));
select pg_temp.m_settle('s:ok', 1, (select id from m_pending_user1), '4');
select is(pg_temp.m_out('s:ok'), 'OK', 'settle verifies the factor [P2-S09-AC-776]');
select is(pg_temp.m_fstate((select id from m_pending_user1)), 'verified', 'the factor is verified');
select ok(pg_temp.m_one(format('select (verified_at is not null and last_used_at is not null and pending_expires_at is null)::text from identity.mfa_factor_registry where id = %L', (select id from m_pending_user1))) = 'true',
  'verified_at and last_used_at are set and the pending window is cleared [P2-S09-AC-776]');
select is(pg_temp.m_ver(1), '5', 'settle bumps the MFA version exactly once [P2-S09-AC-776] [P2-S09-AC-902]');
select is(pg_temp.m_resp('s:ok')->>'version', '5', 'the snapshot carries the new version');
select is(pg_temp.m_resp('s:ok')#>>'{factors,0,state}', 'verified', 'the snapshot lists the verified factor');
select ok(position((select provider_factor_id::text from m_pending_user1) in pg_temp.m_resp('s:ok')::text) = 0,
  'the settle response never carries the provider factor id');
select ok((select last_seen_at > clock_timestamp() - interval '1 minute' and state = 'active'
             from identity.auth_session_index where session_id = pg_temp.m_sid(1)),
  'same-session settle touches the index row and keeps it active [P2-S09-AC-880]');
select is((select count(*)::integer from identity.auth_session_index where auth_user_id = pg_temp.m_uid(1)), 1,
  'same-session settle registers no second row [P2-S09-AC-880]');
select is(pg_temp.m_events(1, 'mfa.enroll.verified'), 1, 'one mfa.enroll.verified security event [P2-S09-AC-776] [P2-S09-AC-907]');
select is(pg_temp.m_one(format($$select reason_code from identity.security_events where action = 'mfa.enroll.verified' and actor_auth_user_id = %L$$, pg_temp.m_uid(1))),
  'MFA_FACTOR_ADDED', 'the security event carries the generic factor-added reason');
select is(pg_temp.m_one(format($$select count(*)::text from audit_private.audit_events where action = 'identity.mfa.enroll.verified' and target_id = %L$$, (select id from m_pending_user1))), '1',
  'one BE00 audit row for the verification [P2-S09-AC-776]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', (select id from m_pending_user1)), 1, 'one identity.mfa-factor.changed.v1 outbox row [P2-S09-AC-776] [P2-S09-AC-906]');
select is((select payload from platform_private.outbox_events where event_type = 'identity.mfa-factor.changed.v1'
            and aggregate_id = (select id from m_pending_user1)),
  jsonb_build_object('mfaFactorId', (select id from m_pending_user1),
    'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(1))),
  'the factor event payload is identifiers only [P2-S09-AC-906]');
select is((select payload from platform_private.outbox_events where event_type = 'identity.security-notification.requested.v1'
            and payload->>'securityEventId' = (select id::text from identity.security_events where action = 'mfa.enroll.verified' and actor_auth_user_id = pg_temp.m_uid(1))),
  jsonb_build_object('securityEventId', (select id from identity.security_events where action = 'mfa.enroll.verified' and actor_auth_user_id = pg_temp.m_uid(1)),
    'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(1))),
  'a security-notification request references the security event only (no email, no body) [P2-S09-AC-776]');
select pg_temp.m_settle('s:again', 1, (select id from m_pending_user1), pg_temp.m_ver(1));
select is(pg_temp.m_out('s:again'), 'FACTOR_NOT_PENDING', 'settling a verified factor again is FACTOR_NOT_PENDING');
select pg_temp.m_prepare('p:again', 1, (select id from m_pending_user1), pg_temp.m_ver(1));
select is(pg_temp.m_out('p:again'), 'FACTOR_NOT_PENDING', 'preparing a verified factor is FACTOR_NOT_PENDING');

-- name collision with the verified factor, case-insensitively.
select pg_temp.m_begin('b:name', 1, 'PHONE');
select is(pg_temp.m_out('b:name'), 'FACTOR_NAME_TAKEN', 'a live friendly name collides case-insensitively (409 factor_name_taken) [P2-S09-AC-736]');

-- ---- settle with session rotation -------------------------------------------
select pg_temp.m_pending(2, 'Laptop');
create temp table m_pending_user2 on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(2) and state = 'pending';
select pg_temp.m_settle('s:rot', 2, (select id from m_pending_user2), pg_temp.m_ver(2), pg_temp.m_sid(2, 2));
select is(pg_temp.m_out('s:rot'), 'OK', 'settle rotates the first-party session in the same transaction [P2-S09-AC-776]');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(2, 1)), 'revoked',
  'the initiating session row is revoked by exact session id [P2-S09-AC-880]');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(2, 2)), 'active',
  'the rotated session row is active [P2-S09-AC-880]');
select is((select count(*)::integer from identity.auth_session_index where auth_user_id = pg_temp.m_uid(2) and state = 'active'), 1,
  'one step-up never leaves two live rows [P2-S09-AC-880]');
select ok((select binding_id is not null and binding_id = (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(2))
             from identity.auth_session_index where session_id = pg_temp.m_sid(2, 2)),
  'the rotated row carries the account binding');
select ok((select revocation_reason is not null and revoked_at is not null
             from identity.auth_session_index where session_id = pg_temp.m_sid(2, 1)),
  'the revoked row records its time and reason');
select pg_temp.m_settle('s:revoked', 2, (select id from m_pending_user2), pg_temp.m_ver(2), pg_temp.m_sid(2, 3), pg_temp.m_sid(2, 1));
select is(pg_temp.m_out('s:revoked'), 'UNAUTHENTICATED', 'a revoked initiating session can no longer settle');

-- ---- ten-live-factor bound ---------------------------------------------------
select pg_temp.m_enroll(4, 'F' || n) from generate_series(1, 10) n;
select is((select count(*)::integer from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(4) and state = 'verified'), 10,
  'ten verified factors can exist [P2-S09-AC-737]');
select pg_temp.m_begin('lim:b', 4, 'Eleventh');
select is(pg_temp.m_out('lim:b'), 'MFA_FACTOR_LIMIT', 'the eleventh live factor is refused at begin (409 mfa_factor_limit) [P2-S09-AC-737]');
select pg_temp.m_finish('lim:f', 4, 'Eleventh', pg_temp.m_ver(4));
select is(pg_temp.m_out('lim:f'), 'MFA_FACTOR_LIMIT', 'and refused again at finish [P2-S09-AC-737]');
select is((select count(*)::integer from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(4)), 10, 'no eleventh row exists [P2-S09-AC-737]');

-- ---- reconciliation ------------------------------------------------------------
select pg_temp.m_pending(5, 'Recon');
create temp table m_pending_user5 on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(5) and state = 'pending';
select pg_temp.m('mr:other', 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(1), 'p_factor_id', (select id from m_pending_user5)));
select is(pg_temp.m_out('mr:other'), 'NOT_FOUND', 'marking another user''s factor reconciling is NOT_FOUND');
select pg_temp.m('mr:ok', 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5)));
select is(pg_temp.m_fstate((select id from m_pending_user5)), 'reconciling', 'a post-send ambiguity marks the row reconciling');
select is(pg_temp.m_ver(5), '3', 'reconciling bumps the MFA version [P2-S09-AC-889]');
select pg_temp.m('mr:again', 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5)));
select is(pg_temp.m_out('mr:again'), 'OK', 'marking an already-reconciling row is idempotent');
select is(pg_temp.m_ver(5), '3', 'and does not bump the version again');
select pg_temp.m_settle('s:recon', 5, (select id from m_pending_user5), pg_temp.m_ver(5));
select is(pg_temp.m_out('s:recon'), 'FACTOR_NOT_PENDING', 'a reconciling row cannot be settled by the user');
select pg_temp.m('rd:recon', 'auth_mfa_factors_read', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(5)));
select is(pg_temp.m_resp('rd:recon')#>>'{factors,0,state}', 'reconciling', 'the list shows the reconciling factor');
select pg_temp.m('rc:bad', 'auth_mfa_factor_reconcile', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5), 'p_outcome', 'bogus'));
select is(pg_temp.m_out('rc:bad'), 'INVALID_REQUEST', 'an unknown reconcile outcome is INVALID_REQUEST');
select pg_temp.m('rc:pending', 'auth_mfa_factor_reconcile', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5), 'p_outcome', 'pending'));
select is(pg_temp.m_fstate((select id from m_pending_user5)), 'pending', 'the reconciler returns the row to pending while the window is open [P2-S09-AC-904]');
select pg_temp.m('mr:again2', 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5)));
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 second'$$, format('id = %L', (select id from m_pending_user5)));
select pg_temp.m('rc:expired', 'auth_mfa_factor_reconcile', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5), 'p_outcome', 'pending'));
select is(pg_temp.m_fstate((select id from m_pending_user5)), 'expired', 'a pending outcome after the window closed settles to expired [P2-S09-AC-904]');
select pg_temp.m('rc:term', 'auth_mfa_factor_reconcile', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5), 'p_outcome', 'verified'));
select is(pg_temp.m_out('rc:term'), 'FACTOR_STATE_CONFLICT', 'reconciling a terminal row is FACTOR_STATE_CONFLICT [P2-S09-AC-904]');
select pg_temp.m_pending(5, 'Recon2');
create temp table m_pending_user5b on commit drop as
  select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(5) and state = 'pending';
select pg_temp.m('mr:b', 'auth_mfa_factor_mark_reconciling', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5b)));
select pg_temp.m('rc:verified', 'auth_mfa_factor_reconcile', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(5), 'p_factor_id', (select id from m_pending_user5b), 'p_outcome', 'verified'));
select is(pg_temp.m_fstate((select id from m_pending_user5b)), 'verified', 'the reconciler settles a provider-verified factor to verified [P2-S09-AC-904]');
select ok(pg_temp.m_one(format('select (verified_at is not null)::text from identity.mfa_factor_registry where id = %L', (select id from m_pending_user5b))) = 'true',
  'and sets verified_at');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', (select id from m_pending_user5b)) >= 1, true,
  'every reconciliation emits the factor-changed event');

select * from finish();

rollback;
