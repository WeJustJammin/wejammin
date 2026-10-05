\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE05b CFG-05B-06 / BE01a "Administrative factor
-- reset"), the settlement transaction that records the operator-only provider adapter outcomes.
-- Split by concern from one 430-line file so no test file
-- exceeds the 400-line depth-audit limit: the shared fixture is
-- phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc; the sibling suites are
-- phase_02_slice_09_dec111_admin_mfa_reset{,_reservation,_settlement}.sql.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc

-- Settlement preamble: the same reservation the reservation suite proves, produced here through the
-- real command so the settlement transaction has a live reconciling reset to settle.
select is(pg_temp.s09d_grant_via_rpc('rev1', 'cms.schema_designer', 3), 'OK',
  'fixture: the target holds cms.schema_designer through the real owner grant command (CMS-03A-15)');
select pg_temp.m_reset('r:ok', 'designer2', 'rev1', 'reset-key-ac945-0100', 'lost every verified factor');
select is(pg_temp.m_out('r:ok'), 'OK', 'fixture: the reset is reserved through CFG-05B-06 before settlement');

-- ---- settlement ---------------------------------------------------------------------
create temp table m_reset_id on commit drop as select pg_temp.m_resp('r:ok')->>'resetId' id;
select pg_temp.m_settle_reset('s:op', 'owner', (select id from m_reset_id), '[]'::jsonb);
select is(pg_temp.m_out('s:op'), 'FORBIDDEN', 'only the operator who reserved the reset may settle it');
select pg_temp.m_settle_reset('s:unknown', 'designer2', extensions.gen_random_uuid()::text, '[]'::jsonb);
select is(pg_temp.m_out('s:unknown'), 'TARGET_NOT_FOUND', 'an unknown reset id is 404');
select pg_temp.m_settle_reset('s:badprov', 'designer2', (select id from m_reset_id),
  jsonb_build_array(jsonb_build_object('providerFactorId', extensions.gen_random_uuid(), 'outcome', 'removed')));
select is(pg_temp.m_out('s:badprov'), 'INVALID_REQUEST', 'an outcome for a provider factor the reset did not move is INVALID_REQUEST');
select pg_temp.m_settle_reset('s:badout', 'designer2', (select id from m_reset_id),
  jsonb_build_array(jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V1'), 'outcome', 'maybe')));
select is(pg_temp.m_out('s:badout'), 'INVALID_REQUEST', 'an unknown outcome value is INVALID_REQUEST');
create temp table m_v_res on commit drop as select pg_temp.m_ver(13)::bigint v;
create temp table m_ev_before on commit drop as
  select pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')) as pend,
         pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')) as removed;
select pg_temp.m_settle_reset('s:partial', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V1'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V2'), 'outcome', 'absent'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Gone'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'failed')));
select is(pg_temp.m_out('s:partial'), 'OK', 'a partial provider result settles [P2-S09-AC-933]');
select is(pg_temp.m_resp('s:partial')->>'state', 'reconciling', 'any failed factor leaves the reset reconciling (202) and never rolls back the committed first transaction [P2-S09-AC-933]');
select is(pg_temp.m_resp('s:partial')->>'removedFactorCount', '3', 'removed and absent factors count as removed');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'V1')) || pg_temp.m_fstate(pg_temp.m_fid_named(13, 'V2')) || pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Gone')),
  'removedremovedremoved', 'confirmed factors are removed in the committed first transaction [P2-S09-AC-933]');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Pend')), 'reconciling', 'a failed factor stays reconciling for the reconciler (no rollback, no blind resend) [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')),
  (select pend + 1 from m_ev_before),
  'the settlement emits exactly one identity.mfa-factor.changed.v1 for the factor it leaves reconciling, which wakes auth-state-reconciler [P2-S09-AC-933]');
select is((select payload from platform_private.outbox_events
            where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = pg_temp.m_fid_named(13, 'Pend')
            order by occurred_at desc, id desc limit 1),
  jsonb_build_object('mfaFactorId', pg_temp.m_fid_named(13, 'Pend'),
    'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13))),
  'that event carries exactly the mfaFactorId and authBindingId payload and no provider factor id [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')),
  (select removed + 1 from m_ev_before),
  'a factor the settlement confirms removed emits one change event (the removal) and the failed-factor event adds none to it [P2-S09-AC-933]');
select ok(pg_temp.m_one(format($q$select (completed_at is null and state = 'reconciling')::text from platform_private.admin_mfa_factor_resets where id = %L$q$, (select id from m_reset_id))) = 'true',
  'the reset row stays reconciling with no completed_at [P2-S09-AC-933]');
select is(pg_temp.m_ver(13)::bigint, (select v + 1 from m_v_res), 'the settlement transaction bumps mfa_version once');
select ok(not (pg_temp.m_resp('s:partial')::text ~ ('(' || pg_temp.m_pid_named(13, 'V1')::text || '|' || pg_temp.m_uid(13)::text || ')')),
  'the settle response carries no provider factor id and no Auth UUID');
-- A replay of the same settlement (the Worker retries a settle whose response it never saw) reports the
-- same outcomes for the same factor versions.  The reconciler wake-up is sent once for the first report; a
-- replay is answered with the same reset view and emits nothing (settlement receipt keyed by reset,
-- factor, outcome and factor version).
create temp table m_ev_replay on commit drop as
  select pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')) as pend,
         pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')) as removed,
         pg_temp.m_ver(13)::bigint as mfa_version;
select pg_temp.m_settle_reset('s:replay1', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V1'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V2'), 'outcome', 'absent'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Gone'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'failed')));
select pg_temp.m_settle_reset('s:replay2', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'failed')));
select is(pg_temp.m_out('s:replay1') || pg_temp.m_out('s:replay2'), 'OKOK', 'a replayed settlement is accepted [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')),
  (select pend from m_ev_replay),
  'a replayed failed outcome for the same factor version emits no second reconciler event (exactly one wake-up per factor version) [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')),
  (select removed from m_ev_replay), 'a replayed removal emits no second change event [P2-S09-AC-933]');
select ok(pg_temp.m_resp('s:replay1') = pg_temp.m_resp('s:partial') and pg_temp.m_resp('s:replay2') = pg_temp.m_resp('s:partial'),
  'every replay answers the same reset view as the first settlement [P2-S09-AC-933]');
select is(pg_temp.m_ver(13)::bigint, (select mfa_version from m_ev_replay), 'a replay bumps no mfa_version [P2-S09-AC-933]');
select is((xpath('/row/c/text()', query_to_xml(format(
    $q$select count(*) as c from platform_private.admin_mfa_factor_reset_settlements
        where reset_id = %L and outcome = 'failed' and factor_id = %L$q$,
    (select id from m_reset_id), pg_temp.m_fid_named(13, 'Pend')), false, true, '')))[1]::text, '1',
  'one settlement receipt holds the failed outcome of the factor [P2-S09-AC-933]');
select pg_temp.m_settle_reset('s:final', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'removed')));
select is(pg_temp.m_resp('s:final')->>'state', 'completed', 'the last confirmation completes the reset [P2-S09-AC-918]');
select is(pg_temp.m_resp('s:final')->>'removedFactorCount', '4', 'with all four factors removed');
select ok(pg_temp.m_one(format($q$select (completed_at is not null)::text from platform_private.admin_mfa_factor_resets where id = %L$q$, (select id from m_reset_id))) = 'true', 'completed_at is recorded');
create temp table m_v_fin on commit drop as select pg_temp.m_ver(13)::bigint v;
select pg_temp.m_settle_reset('s:again', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'removed')));
select is(pg_temp.m_resp('s:again')->>'state', 'completed', 'settling again is idempotent');
select is(pg_temp.m_ver(13)::bigint, (select v from m_v_fin), 'and bumps nothing');
select pg_temp.m_reset('r:replay2', 'designer2', 'rev1', 'reset-key-ac945-0100', 'lost every verified factor');
select is(pg_temp.m_resp('r:replay2')->>'state', 'completed', 'a replay after completion reports completed');

-- A target with no live factor: completes immediately, still audited and notified.
select pg_temp.m_reset('r:empty', 'designer2', 'rev1', 'reset-key-ac945-0200');
select is(pg_temp.m_resp('r:empty')->>'state', 'completed', 'a reset with nothing to remove completes in the reservation transaction');
select is(jsonb_array_length(pg_temp.m_resp('r:empty')->'pendingProviderFactorIds'), 0, 'and asks the Worker to remove nothing');
select is(pg_temp.m_events(13, 'mfa.factors.reset'), 2, 'it is still recorded as security evidence');
-- The reset leaves the account able to enroll again under the first-factor rule.
select pg_temp.m_begin('after:begin', 13, 'Fresh');
select is(pg_temp.m_out('after:begin'), 'OK', 'after a reset the target can start a new enrollment');

-- A second target is unaffected, and a concurrent live reset is per target.
select is(pg_temp.m_fstate(pg_temp.m_fid(14)), 'verified', 'another person''s factors are untouched');
select pg_temp.m_reset('r:two', 'designer2', 'rev2', 'reset-key-ac945-0300');
select is(pg_temp.m_out('r:two'), 'OK', 'a reset of a different target is independent');

-- NEGATIVE CONTROL: a settlement receipt is append-only evidence; the guard refuses a rewrite or a delete even from the owner.
select throws_ok($$update platform_private.admin_mfa_factor_reset_settlements set factor_version = factor_version + 1$$,
  'P0001', 'ADMIN_MFA_RESET_SETTLEMENT_APPEND_ONLY', 'a settlement receipt cannot be rewritten [P2-S09-AC-933]');
select throws_ok($$delete from platform_private.admin_mfa_factor_reset_settlements$$,
  'P0001', 'ADMIN_MFA_RESET_SETTLEMENT_APPEND_ONLY', 'a settlement receipt cannot be deleted [P2-S09-AC-933]');

select * from finish();

rollback;
