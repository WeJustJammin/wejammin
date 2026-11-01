-- Slice 12 gap lane claude_s12_db9b, item 3 (the retries_exhausted reason code): P2-S12-AC-146 clause 5, "with the prior active version intact".
-- The companion phase_02_slice_12_gaps_db9b_fire_prior_active.sql drives activation_authority_ended, approval_invalidated,
-- canonical_source_unavailable and dependency_changed; this file drives the fifth closed reason, retries_exhausted, which needs the real retry ladder
-- (15 s, 60 s, 300 s; BE03c "Scheduled activation") and therefore about 7 minutes of real waiting.  Run it separately.
-- The lineage r has a REAL prior active version r0 (activated by CMS-03C-09 `activate`); its successor r1 is approved and scheduled; the policy
-- evidence resolver is made unavailable for the whole ladder by the accepted labelled fault of the schedule suites (s12gb_fault_on / _off: one
-- existing function's source replaced and restored byte for byte, no row DML, no trigger toggle).  After the fourth failure r1 is blocked
-- retries_exhausted and r0 must be the same row, still active, with no event and no audit record of its own.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

create temp table d9r_setup(key text primary key, outcome text not null) on commit drop;
insert into d9r_setup(key, outcome) values ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';

select pg_temp.s12gb_approved('r0');
select pg_temp.s12gb_act('act-r0', 'owner', pg_temp.s12ga_review('r0'), 'activate');
select pg_temp.s12gb_successor('r1', 'r0', array['typeA']);
select pg_temp.s12gb_approve('r1');
select ok(pg_temp.s12ga_out('act-r0') = 'ok'
    and (select state = 'active' and lifecycle_version = 4 and activated_at is not null
           from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('r0'))
    and (select successor.supersedes_id = predecessor.id and successor.version = 2 and successor.state = 'approved'
                and successor.template_id = predecessor.template_id
           from platform_private.cms_template_versions successor
           join platform_private.cms_template_versions predecessor on predecessor.id = pg_temp.s12ga_subject('r0')
          where successor.id = pg_temp.s12ga_subject('r1')),
  'fixture: r0 is a REAL active version 1 and r1 its real approved successor in the same lineage [P2-S12-AC-146]');

create temp table d9r_before on commit drop as
  select to_jsonb(v) as prior_row,
         (select count(*) from audit_private.audit_events where target_id = v.id) as prior_audits,
         (select count(*) from platform_private.outbox_events where aggregate_id = v.id) as prior_events
    from platform_private.cms_template_versions v where v.id = pg_temp.s12ga_subject('r0');
select ok((select prior_events = 1 and prior_row->>'state' = 'active' from d9r_before),
  'fixture: before any fire r0 is active with exactly one activation event [P2-S12-AC-146]');

create temp table d9r_clock(started timestamptz not null) on commit drop;
insert into d9r_clock values (clock_timestamp());
select pg_temp.s12gb_act('sch-r1', 'owner', pg_temp.s12ga_review('r1'), 'schedule', p_after => interval '62 seconds');
select ok(pg_temp.s12ga_out('sch-r1') = 'ok' and (select state = 'pending' from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1')),
  'fixture: the real pending schedule of r1 was accepted by CMS-03C-09 [P2-S12-AC-146]');

create or replace function pg_temp.d9r_expected(p_claim text) returns text language sql stable as $body$
  select pg_temp.s12gb_claimed(p_claim, 'r1')->>'expectedVersion' $body$;
create or replace function pg_temp.d9r_lease(p_claim text) returns uuid language sql stable as $body$
  select (pg_temp.s12gb_claimed(p_claim, 'r1')->>'leaseId')::uuid $body$;
create or replace function pg_temp.d9r_exec(p_label text, p_claim text) returns void language sql as $body$
  select pg_temp.s12gb_exec(p_label, pg_temp.s12gb_sid('r1'), pg_temp.d9r_expected(p_claim), pg_temp.d9r_lease(p_claim)) $body$;
-- r0 is the same row, still active, and has gained no event and no audit record.
create or replace function pg_temp.d9r_intact() returns boolean language sql stable as $body$
  select (select to_jsonb(v) from platform_private.cms_template_versions v where v.id = pg_temp.s12ga_subject('r0')) = (select prior_row from d9r_before)
     and (select count(*) from audit_private.audit_events where target_id = pg_temp.s12ga_subject('r0')) = (select prior_audits from d9r_before)
     and (select count(*) from platform_private.outbox_events where aggregate_id = pg_temp.s12ga_subject('r0')) = (select prior_events from d9r_before)
$body$;

select pg_sleep(greatest(0, 66 - extract(epoch from (clock_timestamp() - (select started from d9r_clock)))));
select pg_temp.s12gb_claim('c0');
select ok(pg_temp.s12gb_sout('c0') = 'ok' and jsonb_array_length(pg_temp.s12gb_sbody('c0')) = 1
    and (select state = 'executing' and attempt_count = 0 from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1')),
  'control: the due schedule is claimed under a lease [P2-S12-AC-152]');

select pg_temp.s12gb_fault_on();
-- failure 1 -> 15 s
select pg_temp.d9r_exec('f1', 'c0');
select ok(pg_temp.s12gb_sbody('f1')->>'outcome' = 'failed_retryable'
    and (select state = 'failed_retryable' and attempt_count = 1 from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1'))
    and pg_temp.d9r_intact(),
  'after failure 1 (retry in 15 s) the prior active version is the same row [P2-S12-AC-146]');
select pg_sleep(16);
select pg_temp.s12gb_claim('c1');
select pg_temp.d9r_exec('f2', 'c1');
select ok(pg_temp.s12gb_sbody('f2')->>'outcome' = 'failed_retryable'
    and (select state = 'failed_retryable' and attempt_count = 2 from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1'))
    and pg_temp.d9r_intact(),
  'after failure 2 (retry in 60 s) the prior active version is the same row [P2-S12-AC-146]');
select pg_sleep(61);
select pg_temp.s12gb_claim('c2');
select pg_temp.d9r_exec('f3', 'c2');
select ok(pg_temp.s12gb_sbody('f3')->>'outcome' = 'failed_retryable'
    and (select state = 'failed_retryable' and attempt_count = 3 from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1'))
    and pg_temp.d9r_intact(),
  'after failure 3 (the last retry in 300 s) the prior active version is the same row [P2-S12-AC-146]');
select pg_sleep(301);
select pg_temp.s12gb_claim('c3');
select pg_temp.d9r_exec('f4', 'c3');
select is(pg_temp.s12gb_sbody('f4'),
  jsonb_build_object('scheduleId', pg_temp.s12gb_sid('r1'), 'outcome', 'blocked', 'reasonCode', 'retries_exhausted', 'actualUtc', null, 'deviationSeconds', null),
  'the fourth failure answers blocked with the closed reasonCode retries_exhausted [P2-S12-AC-146]');
select ok((select state = 'blocked' and reason_code = 'retries_exhausted' and attempt_count = 3
           from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('r1'))
    and (select state = 'blocked' and activated_at is null from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('r1'))
    and pg_temp.s12gb_events('r1') = 0,
  'the schedule is blocked retries_exhausted and the scheduled successor is blocked, never activated, with no event [P2-S12-AC-146]');
select is(pg_temp.s12gb_fault_off()::text, 'true', 'control: the policy-evidence resolver is restored byte for byte [P2-S12-AC-152]');
select ok(pg_temp.d9r_intact(),
  'the PRIOR active version is byte-for-byte the same row after the terminal block (state, activated_at, lifecycle_version, version, updated_at), with no event and no audit record [P2-S12-AC-146]');
select ok((select state = 'active' and retired_at is null and activated_at = ((select prior_row->>'activated_at' from d9r_before)::timestamptz)
           from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('r0'))
    and (select count(*) = 1 from platform_private.cms_template_versions
          where template_id = (select template_id from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('r0')) and state = 'active')
    and (select count(*) = 0 from platform_private.cms_template_versions
          where template_id = (select template_id from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('r0')) and state = 'superseded'),
  'the lineage still has exactly one active member, r0 with its activated_at unchanged, and no superseded member: no supersession happened [P2-S12-AC-146]');

select finish();
rollback;
