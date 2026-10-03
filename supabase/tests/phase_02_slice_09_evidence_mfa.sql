\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): DEC-111 clauses the MFA suites do not
-- pin: the live-factor bound across states, the unreplayable enrollment start,
-- no provider call inside a PostgreSQL transaction, login methods untouched by a
-- removal, the admin reset being exempt from last_factor_required, the reset's
-- one-transaction atomicity and its table CHECKs.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

insert into m_alias values
  (11, pg_temp.s09d_actor_id('owner', 'auth')::uuid), (12, pg_temp.s09d_actor_id('designer2', 'auth')::uuid),
  (13, pg_temp.s09d_actor_id('rev1', 'auth')::uuid), (14, pg_temp.s09d_actor_id('rev2', 'auth')::uuid),
  (15, pg_temp.s09d_actor_id('rev3', 'auth')::uuid), (16, pg_temp.s09d_actor_id('other', 'auth')::uuid);
select pg_temp.m_session(n) from generate_series(11, 16) n;
select pg_temp.m_user(21);
select pg_temp.m_user(22);
select pg_temp.m_user(23);

create or replace function pg_temp.m_member(p_actor text) returns void language plpgsql as $body$
begin
  -- FIXTURE FORGERY: no command confirms an ungoverned membership (rpc_accept_or_end_membership accepts governed tenures only).
  insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
    starts_on, accepted_at, actor_id, version)
  select pg_temp.s09d_id('ownerOrg'), member.person_id, 'confirmed', 'invitation', 'ungoverned', current_date,
         clock_timestamp(), owner.person_id, 1
  from s09d_actor member, s09d_actor owner where member.key = p_actor and owner.key = 'owner';
end;
$body$;
create or replace function pg_temp.m_grant(p_actor text, p_org uuid, p_actions text[] default array['reset'],
  p_state text default 'active', p_ends interval default interval '1 day') returns uuid language plpgsql as $body$
declare gid uuid := extensions.gen_random_uuid();
begin
  -- FIXTURE FORGERY: no command in this repository grants an admin capability (CFG-11 record).
  insert into platform_private.admin_capability_grants(id, subject_person_id, capability_key, resource_type, resource_id,
    scope, actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant, state, version_no)
  values (gid, pg_temp.s09d_actor_id(p_actor, 'person')::uuid, 'admin.identity.mfa_reset', 'organization', p_org,
    jsonb_build_object('actingPartyId', p_org), p_actions, clock_timestamp() - interval '2 hours',
    clock_timestamp() + p_ends, pg_temp.s09d_actor_id('owner', 'person')::uuid, 'dec111 evidence', false, p_state, 1);
  return gid;
end;
$body$;
create or replace function pg_temp.m_sync(p_label text) returns void language sql as $body$
  insert into m_probe select label, state, message, response from s09d_probe where label = p_label
  on conflict (label) do update
    set state = excluded.state, message = excluded.message, response = excluded.response $body$;
create or replace function pg_temp.m_reset(p_label text, p_actor text, p_target text, p_key text,
  p_reason text default 'lost every factor') returns jsonb language plpgsql as $body$
declare result jsonb;
begin
  result := pg_temp.s09d_rpc(p_label, 'platform_api.admin_mfa_factor_reset', p_actor,
    jsonb_build_object('targetPersonId', pg_temp.s09d_actor_id(p_target, 'person'), 'reason', p_reason, 'idempotencyKey', p_key), true);
  perform pg_temp.m_sync(p_label);
  return result;
end;
$body$;
select pg_temp.m_member('rev1');
select pg_temp.m_member('rev2');
select pg_temp.m_grant('designer2', pg_temp.s09d_id('ownerOrg'));

-- ------------------------------------------------ AC737: reconciling counts toward the bound ----
select pg_temp.m_enroll(21, 'F' || n) from generate_series(1, 9) n;
create temp table m21 on commit drop as
select id from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(21) order by created_at, id limit 1;
select pg_temp.m('lim:rmb', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(21),
  'p_factor_id', (select id from m21), 'p_reason', 'user_request', 'p_expected_version', pg_temp.m_ver(21),
  'p_session_id', pg_temp.m_sid(21), 'p_key_hash', '\x' || repeat('d1', 32), 'p_request_hash', '\x' || repeat('d2', 32)));
select is(pg_temp.m_fstate((select id from m21)), 'reconciling', 'fixture: one of nine verified factors is reconciling (8 verified + 1 reconciling = 9 live)');
select pg_temp.m_begin('lim:nine', 21, 'Tenth');
select is(pg_temp.m_out('lim:nine'), 'OK', 'nine live factors (verified and reconciling together) are below the bound: enrollment may start [P2-S09-AC-737]');
select pg_temp.m_enroll(21, 'Tenth');
select is((select count(*)::integer from identity.mfa_factor_registry where auth_user_id = pg_temp.m_uid(21) and state in ('pending', 'verified', 'reconciling')), 10,
  'fixture: ten live factors across verified and reconciling');
select pg_temp.m_begin('lim:ten', 21, 'Eleventh');
select is(pg_temp.m_out('lim:ten'), 'MFA_FACTOR_LIMIT',
  'verified and reconciling factors together reach the bound: 409 mfa_factor_limit [P2-S09-AC-737]');

-- ------------------------------------------------ AC744: the enrollment start is not replayable ----
select count(*) as idem_before from platform_private.idempotency_records \gset
select pg_temp.m_begin('ie:b', 22, 'Idem');
select pg_temp.m_finish('ie:f', 22, 'Idem', pg_temp.m_resp('ie:b')->>'version');
select is(pg_temp.m_out('ie:f'), 'OK', 'fixture: the enrollment start commits a pending row');
select is((select count(*)::integer from platform_private.idempotency_records) - :idem_before, 0,
  'AUTH-API-17 reserves no idempotency record, so no response (which carries the TOTP secret) is stored for replay [P2-S09-AC-744]');
select pg_temp.m_finish('ie:again', 22, 'Idem', pg_temp.m_ver(22));
select is(pg_temp.m_out('ie:again'), 'FACTOR_STATE_CONFLICT',
  'repeating the same start is refused as a state conflict, never replayed with the earlier response [P2-S09-AC-744]');

-- ------------------------------------------------ AC750: no provider call inside a PostgreSQL transaction ----
select is((select count(*)::integer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prokind = 'f'
     and ((n.nspname = 'platform_api' and (p.proname like 'auth_mfa_%' or p.proname like 'auth_step_up_%' or p.proname like 'admin_mfa_%'))
       or (n.nspname = 'platform_private' and (p.proname like 'mfa_%' or p.proname like 'step_up_%'))
       or (n.nspname = 'identity' and p.proname like '%mfa%'))
     and pg_get_functiondef(p.oid) ~* '(pg_net|net\.http|http_get|http_post|http_request|dblink|\mcurl\M|extensions\.http)'), 0,
  'no MFA or step-up function references a network extension: the provider is never called inside a PostgreSQL transaction [P2-S09-AC-750]');
select ok((select count(*) >= 12 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prokind = 'f' and ((n.nspname = 'platform_api' and (p.proname like 'auth_mfa_%' or p.proname like 'auth_step_up_%')))),
  'precondition: the scanned MFA and step-up RPC set is non-empty');

-- ------------------------------------------------ AC774: expired pending verification ----
select pg_temp.m_warp('mfa_factor_registry', $$pending_expires_at = clock_timestamp() - interval '1 second'$$,
  format('id = %L', pg_temp.m_fid(22)));
select pg_temp.m_prepare('ex:p', 22, pg_temp.m_fid(22), pg_temp.m_ver(22));
select is(pg_temp.m_out('ex:p'), 'ENROLLMENT_EXPIRED', 'verify on an out-of-window pending factor is 409 enrollment_expired [P2-S09-AC-774]');
select is(pg_temp.m_fstate(pg_temp.m_fid(22)), 'pending',
  'the refusing RPC raises, so its own transaction cannot persist the expiry: the row is still pending until the reconciler or the sweep runs');
select pg_temp.m('ex:sweep', 'auth_mfa_registry_sweep', jsonb_build_object('p_batch', 500, '_notrace', true));
select ok(pg_temp.m_fstate(pg_temp.m_fid(22)) = 'expired'
  and exists (select 1 from identity.security_events where action = 'mfa.enroll.expired' and reason_code = 'ENROLLMENT_EXPIRED' and actor_auth_user_id = pg_temp.m_uid(22))
  and pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid(22)) >= 1,
  'the registry sweep (the persisted half of the transition) marks the out-of-window pending factor expired with security evidence and queues the factor-changed event that drives provider cleanup [P2-S09-AC-774]');

-- ------------------------------------------------ AC806: a removal never touches login methods ----
select pg_temp.m_enroll(23, 'A');
select pg_temp.m_enroll(23, 'B');
create temp table m_login_before on commit drop as
select (select count(*) from identity.login_identity_registry where auth_user_id = pg_temp.m_uid(23)) as identities,
       (select coalesce(md5(string_agg(t::text, ',' order by id)), '') from identity.login_identity_registry t where t.auth_user_id = pg_temp.m_uid(23)) as digest,
       (select md5(concat_ws('|', id, auth_user_id, person_id, state)) from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(23)) as binding;
select pg_temp.m('lm:rb', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(23), 'p_factor_id', pg_temp.m_fid(23),
  'p_reason', 'factor_compromise', 'p_expected_version', pg_temp.m_ver(23), 'p_session_id', pg_temp.m_sid(23),
  'p_key_hash', '\x' || repeat('e1', 32), 'p_request_hash', '\x' || repeat('e2', 32)));
select pg_temp.m('lm:rf', 'auth_mfa_removal_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(23), 'p_factor_id', pg_temp.m_fid(23),
  'p_reason', 'factor_compromise', 'p_session_id', pg_temp.m_sid(23), 'p_key_hash', '\x' || repeat('e1', 32)));
select ok(pg_temp.m_out('lm:rb') = 'OK' and pg_temp.m_out('lm:rf') = 'OK'
  and (select identities = (select count(*) from identity.login_identity_registry where auth_user_id = pg_temp.m_uid(23))
        and digest = (select coalesce(md5(string_agg(t::text, ',' order by id)), '') from identity.login_identity_registry t where t.auth_user_id = pg_temp.m_uid(23))
        and binding = (select md5(concat_ws('|', id, auth_user_id, person_id, state)) from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(23))
      from m_login_before),
  'a compromise removal leaves every login method row and the account binding identity unchanged: login methods and the recovery baseline derived from them are never affected [P2-S09-AC-806]');


-- ------------------------------------------------ AC897: the admin reset is not subject to last_factor_required ----
select pg_temp.m_enroll(14, 'Only');
select pg_temp.s09g_grant('t:designer', 'owner', 'rev2', 'cms.schema_designer', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('t:designer'), 'OK', 'fixture: the target holds an effective step-up-gated capability (cms.schema_designer) and one verified factor');
select pg_temp.m('lf:rb', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(14), 'p_factor_id', pg_temp.m_fid(14),
  'p_reason', 'user_request', 'p_expected_version', pg_temp.m_ver(14), 'p_session_id', pg_temp.m_sid(14),
  'p_key_hash', '\x' || repeat('f1', 32), 'p_request_hash', '\x' || repeat('f2', 32)));
select is(pg_temp.m_out('lf:rb'), 'LAST_FACTOR_REQUIRED', 'control: the holder cannot remove their own last verified factor');
select pg_temp.m_reset('lf:reset', 'designer2', 'rev2', 'reset-key-evidence-0001');
select ok(pg_temp.m_out('lf:reset') = 'OK' and pg_temp.m_fstate(pg_temp.m_fid(14)) = 'reconciling',
  'the administrative reset moves the holder''s last verified factor to reconciling: it is not subject to last_factor_required [P2-S09-AC-897]');
select is(pg_temp.m_out('lf:reset'), 'OK', 'the reset is accepted for a target that is not the operator [P2-S09-AC-897]');
select pg_temp.m_reset('lf:self', 'designer2', 'designer2', 'reset-key-evidence-0002');
select is(pg_temp.m_out('lf:self'), 'MFA_RESET_INVALID', 'the operator cannot target their own account [P2-S09-AC-897]');

-- ------------------------------------------------ AC931: the reservation is one transaction ----
select pg_temp.m_enroll(13, 'V1');
select pg_temp.m_enroll(13, 'V2');
create function public.s09e_fail_outbox() returns trigger language plpgsql as $body$
begin
  if new.event_type = current_setting('s09e.fail_event', true) then raise exception 'S09E_FORCED_OUTBOX_FAILURE'; end if;
  return new;
end;
$body$;
create trigger s09e_fail_outbox before insert on platform_private.outbox_events
for each row execute function public.s09e_fail_outbox();
create or replace function pg_temp.m_reset_fp() returns text language sql stable as $body$
  select md5(concat_ws('|',
    (select count(*) from platform_private.admin_mfa_factor_resets),
    (select coalesce(md5(string_agg(t::text, ',' order by id)), '') from identity.mfa_factor_registry t where t.auth_user_id = pg_temp.m_uid(13)),
    (select mfa_version from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13)),
    (select count(*) from audit_private.audit_events),
    (select count(*) from identity.security_events),
    (select count(*) from platform_private.outbox_events),
    (select count(*) from platform_private.idempotency_records),
    (select count(*) from identity.step_up_challenges where state = 'pending')))
$body$;
select set_config('s09e.fail_event', 'admin.mfa-factor.reset.v1', true);
select pg_temp.m_reset_fp() as reset_before \gset
select pg_temp.m_reset('rt:fail', 'designer2', 'rev1', 'reset-key-evidence-0003');
select ok(pg_temp.m_out('rt:fail') = 'S09E_FORCED_OUTBOX_FAILURE', 'a failing outbox write fails the reset reservation [P2-S09-AC-931]');
select is(pg_temp.m_reset_fp(), :'reset_before',
  'the failure rolled back the reset row, every factor move, the version bump, the audit, security evidence, notification intent, outbox and idempotency rows together [P2-S09-AC-931]');
select set_config('s09e.fail_event', '', true);
select pg_temp.m_reset('rt:ok', 'designer2', 'rev1', 'reset-key-evidence-0003');
select ok(pg_temp.m_out('rt:ok') = 'OK' and (select count(*) = 1 from platform_private.admin_mfa_factor_resets where target_person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid),
  'the same key succeeds once the failure is removed (no stuck reservation) [P2-S09-AC-931]');

-- ------------------------------------------------ AC945: the reset record CHECKs ----
create temp table m_reset_ids on commit drop as
select id from platform_private.admin_mfa_factor_resets where target_person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid;
select is(pg_temp.s09e_check('admin_mfa_factor_resets', c.name, (select id from m_reset_ids), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'admin_mfa_factor_resets CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-945]')
from (values
  ('admin_mfa_factor_resets_reason_check', '{"reason":""}'::jsonb),
  ('admin_mfa_factor_resets_reason_check', jsonb_build_object('reason', repeat('x', 513))),
  ('admin_mfa_factor_resets_state_check', '{"state":"cancelled"}'::jsonb),
  ('admin_mfa_factor_resets_idempotency_key_check', jsonb_build_object('idempotency_key', repeat('k', 15))),
  ('admin_mfa_factor_resets_idempotency_key_check', jsonb_build_object('idempotency_key', repeat('k', 8))),
  ('admin_mfa_factor_resets_idempotency_key_check', jsonb_build_object('idempotency_key', repeat('k', 129))),
  ('admin_mfa_factor_resets_removed_factor_count_check', '{"removed_factor_count":-1}'::jsonb),
  ('admin_mfa_factor_resets_removed_factor_count_check', '{"removed_factor_count":11}'::jsonb),
  ('admin_mfa_factor_resets_version_no_check', '{"version_no":0}'::jsonb),
  ('admin_mfa_factor_resets_check1', jsonb_build_object('completed_at', now()::text)),
  ('admin_mfa_factor_resets_check1', '{"state":"completed"}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('admin_mfa_factor_resets', 'admin_mfa_factor_resets_check', (select id from m_reset_ids),
    (select jsonb_build_object('operator_person_id', target_person_id) from platform_private.admin_mfa_factor_resets where id = (select id from m_reset_ids))),
  'control:ACCEPTED|override:REJECTED:23514:admin_mfa_factor_resets_check', 'the operator may not equal the target [P2-S09-AC-945]');
select is(pg_temp.s09e_check('admin_mfa_factor_resets', 'admin_mfa_factor_resets_check1', (select id from m_reset_ids),
    jsonb_build_object('state', 'completed', 'completed_at', now()::text)), 'control:ACCEPTED|override:ACCEPTED',
  'completed_at is set exactly when the state is completed [P2-S09-AC-945]');
select is(pg_temp.s09e_check('admin_mfa_factor_resets', 'admin_mfa_factor_resets_removed_factor_count_check', (select id from m_reset_ids),
    '{"removed_factor_count":10}'), 'control:ACCEPTED|override:ACCEPTED', 'removed_factor_count accepts its upper bound 10 [P2-S09-AC-945]');
select is(pg_temp.s09e_check('admin_mfa_factor_resets', 'admin_mfa_factor_resets_idempotency_key_check', (select id from m_reset_ids),
    jsonb_build_object('idempotency_key', repeat('k', 16))), 'control:ACCEPTED|override:ACCEPTED',
  'the idempotency key accepts its lower bound 16 [P2-S09-AC-945]');
select is(pg_temp.s09e_check('admin_mfa_factor_resets', 'admin_mfa_factor_resets_idempotency_key_check', (select id from m_reset_ids),
    jsonb_build_object('idempotency_key', repeat('k', 128))), 'control:ACCEPTED|override:ACCEPTED',
  'the idempotency key accepts its upper bound 128 [P2-S09-AC-945]');
select pg_temp.m_reset('k:15', 'designer2', 'rev2', repeat('k', 15));
select is(pg_temp.m_out('k:15'), 'INVALID_REQUEST', 'the reset RPC refuses a 15-character idempotency key (BE05b 16..128) [P2-S09-AC-945]');
select pg_temp.m_reset('k:8', 'designer2', 'rev2', repeat('k', 8));
select is(pg_temp.m_out('k:8'), 'INVALID_REQUEST', 'the reset RPC refuses an 8-character idempotency key [P2-S09-AC-945]');
select pg_temp.m_reset('k:129', 'designer2', 'rev2', repeat('k', 129));
select is(pg_temp.m_out('k:129'), 'INVALID_REQUEST', 'the reset RPC refuses a 129-character idempotency key [P2-S09-AC-945]');
select pg_temp.m_reset('k:16', 'designer2', 'rev2', repeat('k', 16));
select is(pg_temp.m_out('k:16'), 'MFA_RESET_IN_PROGRESS', 'the reset RPC accepts a 16-character key as well-formed: it passes the key gate and is refused only by the live-reset predicate that follows [P2-S09-AC-945]');
select pg_temp.m_reset('k:128', 'designer2', 'rev2', repeat('k', 128));
select is(pg_temp.m_out('k:128'), 'MFA_RESET_IN_PROGRESS', 'the reset RPC accepts a 128-character key as well-formed: it passes the key gate and is refused only by the live-reset predicate that follows [P2-S09-AC-945]');
select ok(pg_temp.s09d_has_columns('admin_mfa_factor_resets', array['target_person_id','organization_id','operator_person_id','grant_id','reason',
    'idempotency_key','state','removed_factor_count','completed_at']), 'the reset record persists target, organization, operator, grant, reason, idempotency key, state, removed count and completed_at [P2-S09-AC-945]');

select * from finish();
rollback;
