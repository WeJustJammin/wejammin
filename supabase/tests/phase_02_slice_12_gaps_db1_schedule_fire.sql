-- Slice 12 gap lane claude_s12_gaps_db1: what CMS-03C-19 re-reads at the fire instant (BE03c "Scheduled activation", line 188).
--   P2-S12-AC-143 clause 3  the subject, the policy basis, the canonical providers and the creator's authority are re-read at fire.
--   P2-S12-AC-144 clauses 3+4  a grant END (valid_through passed, not revoked) before the fire instant blocks
--                           activation_authority_ended, a grant that ends after the fire instant still executes, and MFA
--                           is never rechecked at fire (DEC-120).
--   P2-S12-AC-147 clauses 3+4+7  atomicity of switch, event, audit and schedule CAS; every reasonCode driven here.
-- Real producers throughout.  The suite REALLY WAITS about 75 s for the schedules to fall due (no clock is forged).  The
-- two labelled fixtures are accepted ones: the calendar lapse of 002-lapse-helpers (a grant term that passes without any
-- write) and an append-only canonical-domain registry row (how an owning shard changes its provider state).  The
-- atomicity fault is a temporary BEFORE UPDATE trigger that refuses the final schedule CAS and is dropped again; no trigger
-- of the product is disabled.
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
\ir phase_02_slice_12_governed_recheck/002-lapse-helpers.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

create temp table gf_setup(key text primary key, outcome text not null) on commit drop;
insert into gf_setup(key, outcome) values
  ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1)),
  ('rev2:reviewer', pg_temp.s12ga_grant('rev2', 'cms.reviewer', 1)),
  ('rev2:designer', pg_temp.s12ga_grant('rev2', 'cms.template_designer', 1)),
  ('designer2:reviewer', pg_temp.s12ga_grant('designer2', 'cms.reviewer', 1)),
  ('owner:curator', pg_temp.s12ga_grant('owner', 'cms.taxonomy_curator', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key in ('rev1', 'rev2');
select ok((select count(*) = 5 and bool_and(outcome = 'OK') from gf_setup),
  'fixture: reviewer, designer and curator grants were issued by the real CMS-03A-15 command [P2-S12-AC-144]');

-- A taxonomy version declaring the built `role` canonical domain, approved by rev1.
select pg_temp.s12ga_rpc('tx-create', 'platform_api.cms_create_taxonomy_version', 'owner', jsonb_build_object(
  'taxonomyKey', 'gap-fire-tax', 'shape', 'flat',
  'allowedTypeKeys', jsonb_build_array((select type_key from platform_private.cms_content_types
                                          where id = (select value::uuid from s12gov_ids where key = 'typeA'))),
  'allowedFieldKeys', jsonb_build_array('gapfield'), 'canonicalOverlapDomains', jsonb_build_array('role'),
  'expectedVersion', null, 'idempotencyKey', 's12ga-gf-tx-create'));
insert into s12gov_ids(key, value) select 'f4:subject', pg_temp.s12ga_body('tx-create')->>'id'
 where pg_temp.s12ga_body('tx-create')->>'id' is not null;
select pg_temp.s12ga_rpc('tx-submit', 'platform_api.cms_submit_governed_review', 'owner', jsonb_build_object(
  'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject('f4'),
  'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('f4')),
  'idempotencyKey', 's12ga-gf-tx-submit'));
insert into s12gov_ids(key, value) select 'f4:review', pg_temp.s12ga_body('tx-submit')->>'id'
 where pg_temp.s12ga_body('tx-submit')->>'id' is not null;
select pg_temp.s12ga_assign('as-f4', 'owner', pg_temp.s12ga_review('f4'), 'rev1', interval '20 hours');
select pg_temp.s12ga_decide('ap-f4', 'rev1', pg_temp.s12ga_review('f4'), 'approve');

-- Five approved template reviews: f1 scheduled by rev2 (designer), f2/f3/f6 by the owner, f5 approved by designer2.
select pg_temp.s12gb_approved('f1');
select pg_temp.s12gb_approved('f2');
select pg_temp.s12gb_approved('f3');
select pg_temp.s12gb_approved('f6');
select pg_temp.s12gb_approved('f5', array['typeA'], 'designer2');
select ok(
  (select count(*) = 6 and bool_and(state = 'approved') from platform_private.cms_governed_reviews
    where id in (select pg_temp.s12ga_review(t) from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) t)),
  'fixture: six real approved governed reviews (five templates, one taxonomy with the built role domain) [P2-S12-AC-143]');

create temp table gf_clock(started timestamptz not null) on commit drop;
insert into gf_clock values (clock_timestamp());
-- f3: the scheduler's step-up is 9 min 50 s old at acceptance (inside the 10 minute window), so it is far older than 600 s at fire.
create temp table gf_mfa(instant timestamptz not null) on commit drop;
insert into gf_mfa values (clock_timestamp() - interval '9 minutes 50 seconds');
select pg_temp.s12gb_act('sch-f1', 'rev2', pg_temp.s12ga_review('f1'), 'schedule', p_after => interval '62 seconds');
select pg_temp.s12gb_act('sch-f2', 'owner', pg_temp.s12ga_review('f2'), 'schedule', p_after => interval '63 seconds');
select pg_temp.s12gb_act('sch-f3', 'owner', pg_temp.s12ga_review('f3'), 'schedule', '{}'::jsonb, array[]::text[],
  pg_temp.s12ga_ctx('owner', interval '9 minutes 50 seconds'), interval '64 seconds');
select pg_temp.s12gb_act('sch-f4', 'owner', pg_temp.s12ga_review('f4'), 'schedule', p_after => interval '65 seconds');
select pg_temp.s12gb_act('sch-f5', 'owner', pg_temp.s12ga_review('f5'), 'schedule', p_after => interval '66 seconds');
select pg_temp.s12gb_act('sch-f6', 'owner', pg_temp.s12ga_review('f6'), 'schedule', p_after => interval '67 seconds');
select ok((select count(*) = 6 and bool_and(pg_temp.s12ga_out('sch-' || t) = 'ok') from unnest(array['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) t)
    and (select count(*) = 6 and bool_and(state = 'pending') from platform_private.cms_governed_activation_schedules),
  'fixture: six real pending schedules were accepted by CMS-03C-09 [P2-S12-AC-143]');
select ok(clock_timestamp() - (select instant from gf_mfa) < interval '10 minutes 5 seconds'
    and (select schedule.created_by = pg_temp.s12ga_person('rev2') from platform_private.cms_governed_activation_schedules schedule
          where schedule.review_id = pg_temp.s12ga_review('f1')),
  'fixture: the f3 step-up was inside the window at acceptance and the f1 schedule belongs to rev2 [P2-S12-AC-144]');

select pg_sleep(greatest(0, 70 - extract(epoch from (clock_timestamp() - (select started from gf_clock)))));
select pg_temp.s12gb_claim('claim-f', '100'::jsonb);
create or replace function pg_temp.gf_cver(p_tag text) returns text language sql stable as $body$
  select pg_temp.s12gb_claimed('claim-f', p_tag)->>'expectedVersion' $body$;
create or replace function pg_temp.gf_lease(p_tag text) returns uuid language sql stable as $body$
  select (pg_temp.s12gb_claimed('claim-f', p_tag)->>'leaseId')::uuid $body$;
create or replace function pg_temp.gf_exec(p_label text, p_tag text) returns void language sql as $body$
  select pg_temp.s12gb_exec(p_label, pg_temp.s12gb_sid(p_tag), pg_temp.gf_cver(p_tag), pg_temp.gf_lease(p_tag)) $body$;
select ok(pg_temp.s12gb_sout('claim-f') = 'ok' and jsonb_array_length(pg_temp.s12gb_sbody('claim-f')) = 6
    and (select count(*) = 6 from platform_private.cms_governed_activation_schedules where state = 'executing'),
  'control: the six due schedules were claimed under a lease [P2-S12-AC-149]');

-- f1: the creator's designer grant ENDS by the calendar before the fire instant; it is not revoked, so nothing cancelled the
-- schedule or invalidated the review.
select pg_temp.s12fr_lapse(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('rev2'), 'cms.template_designer');
select pg_temp.gf_exec('x-f1', 'f1');
select pg_temp.s12fr_restore();
select ok(pg_temp.s12gb_sout('x-f1') = 'ok'
    and pg_temp.s12gb_sbody('x-f1') = jsonb_build_object('scheduleId', pg_temp.s12gb_sid('f1'), 'outcome', 'blocked',
          'reasonCode', 'activation_authority_ended', 'actualUtc', null, 'deviationSeconds', null)
    and (select state = 'blocked' and reason_code = 'activation_authority_ended' and version = 3 and lease_id is null
         from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('f1'))
    and (select state = 'blocked' and activated_at is null from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('f1'))
    and (select state = 'approved' and version = 2 from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('f1'))
    and pg_temp.s12gb_events('f1') = 0
    and (select count(*) = 1 from audit_private.audit_events
          where action = 'cms.governed.schedule.block' and target_id = pg_temp.s12gb_sid('f1')),
  'a creator grant that ENDED (term passed, not revoked) before the fire instant blocks the schedule activation_authority_ended: subject blocked, review untouched, no event, one audit record [P2-S12-AC-144]');
select ok(platform_private.cms_person_holds_capability(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('rev2'), 'cms.template_designer'),
  'control: the lapse fixture is restored, rev2 holds the designer capability again, so the grant had only lapsed in the fixture, never been revoked [P2-S12-AC-144]');

-- f2: the grant ends AFTER the fire instant (valid through tomorrow), so the same execution completes.
select pg_temp.gf_exec('x-f2', 'f2');
select ok(pg_temp.s12gb_sout('x-f2') = 'ok' and pg_temp.s12gb_sbody('x-f2')->>'outcome' = 'completed'
    and (select state = 'active' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('f2'))
    and pg_temp.s12gb_events('f2') = 1,
  'a creator grant that ends after the fire instant still executes the schedule: completed, subject active, one event [P2-S12-AC-144]');

-- f3: MFA is never rechecked at fire (DEC-120).
select pg_temp.gf_exec('x-f3', 'f3');
select ok(clock_timestamp() - (select instant from gf_mfa) > interval '10 minutes'
    and pg_temp.s12gb_sout('x-f3') = 'ok' and pg_temp.s12gb_sbody('x-f3')->>'outcome' = 'completed'
    and (select state = 'active' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('f3'))
    and pg_temp.s12gb_events('f3') = 1,
  'a schedule whose creator step-up is older than the 600 s window at fire still completes: MFA is never rechecked [P2-S12-AC-144]');
select ok(
  (select p.prosrc !~* '(step_up|mfa)' from pg_proc p where p.oid = 'platform_private.cms_execute_governed_activation(jsonb)'::regprocedure),
  'the execute function reads no step-up or MFA input at all [P2-S12-AC-144]');

-- f4: a declared canonical domain loses its provider between acceptance and fire.  The registry is append-only; a NEWER row
-- of the domain is how an owning shard changes its provider state.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 2, 'role', 'unbuilt', null, null;
select ok((select provider_state = 'unbuilt' from platform_private.cms_canonical_domain_current('role')),
  'control: the current registry row of the role domain is now unbuilt (version 2) [P2-S12-AC-143]');
select pg_temp.gf_exec('x-f4', 'f4');
select ok(pg_temp.s12gb_sout('x-f4') = 'ok'
    and pg_temp.s12gb_sbody('x-f4') = jsonb_build_object('scheduleId', pg_temp.s12gb_sid('f4'), 'outcome', 'blocked',
          'reasonCode', 'canonical_source_unavailable', 'actualUtc', null, 'deviationSeconds', null)
    and (select state = 'blocked' and reason_code = 'canonical_source_unavailable' from platform_private.cms_governed_activation_schedules
          where review_id = pg_temp.s12ga_review('f4'))
    and (select state = 'blocked' and activated_at is null from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('f4'))
    and (select count(*) = 0 from platform_private.outbox_events where aggregate_id = pg_temp.s12ga_subject('f4'))
    and (select count(*) = 1 from audit_private.audit_events
          where action = 'cms.governed.schedule.block' and target_id = pg_temp.s12gb_sid('f4')),
  'a declared canonical domain with an unbuilt provider at fire time blocks the schedule canonical_source_unavailable: subject blocked, no event, one audit record [P2-S12-AC-143]');

-- f5: the approval stops counting AFTER the claim (the only approver''s reviewer grant is revoked by the real CMS-03A-17 command):
-- the review is invalidated and the subject returns to draft, but the claimed (executing) schedule is not cancelled.
select is(pg_temp.s09d_revoke_via_rpc('designer2', 'cms.reviewer'), 'OK',
  'control: the real CMS-03A-17 command revokes the only approver''s reviewer grant after the claim [P2-S12-AC-143]');
select ok((select state = 'invalidated' from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('f5'))
    and (select state = 'draft' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('f5'))
    and (select state = 'executing' from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('f5')),
  'control: the review is invalidated and the subject is no longer scheduled, while the claimed schedule survives [P2-S12-AC-143]');
select pg_temp.gf_exec('x-f5', 'f5');
select ok(pg_temp.s12gb_sout('x-f5') = 'ok'
    and pg_temp.s12gb_sbody('x-f5') = jsonb_build_object('scheduleId', pg_temp.s12gb_sid('f5'), 'outcome', 'blocked',
          'reasonCode', 'approval_invalidated', 'actualUtc', null, 'deviationSeconds', null)
    and (select state = 'blocked' and reason_code = 'approval_invalidated' from platform_private.cms_governed_activation_schedules
          where review_id = pg_temp.s12ga_review('f5'))
    and pg_temp.s12gb_events('f5') = 0,
  'a subject that is no longer scheduled / an approval that is no longer approved at fire blocks the schedule approval_invalidated with no event [P2-S12-AC-143]');

-- f6: atomicity.  A temporary BEFORE UPDATE trigger refuses ONLY the final CAS of the schedule (the update to completed), which
-- runs after the activation switch, the event and the audit record have been written inside the same call.
create function platform_private.gf_fault_cas() returns trigger language plpgsql as $body$
begin
  raise exception 'gap_fault_after_switch' using errcode = 'P0001';
end;
$body$;
select pg_temp.s12gb_mark('f6:before', 'f6');
create trigger a_gf_fault_cas before update on platform_private.cms_governed_activation_schedules
  for each row when (new.state = 'completed') execute function platform_private.gf_fault_cas();
select pg_temp.gf_exec('x-f6-fault', 'f6');
drop trigger a_gf_fault_cas on platform_private.cms_governed_activation_schedules;
drop function platform_private.gf_fault_cas();
select ok(pg_temp.s12gb_sout('x-f6-fault') = 'P0001:gap_fault_after_switch',
  'control: the injected fault refused the final schedule CAS of the execution [P2-S12-AC-147]');
select ok(pg_temp.s12gb_same('f6:before', 'f6')
    and (select state = 'scheduled' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('f6'))
    and (select state = 'executing' from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('f6'))
    and pg_temp.s12gb_events('f6') = 0 and pg_temp.s12gb_audits('cms.governed.activate', 'f6') = 0,
  'a failure of the final schedule CAS leaves no event, no audit record and no state change: the switch, event, audit and CAS are one atomic unit [P2-S12-AC-147]');
select pg_temp.gf_exec('x-f6-ok', 'f6');
select ok(pg_temp.s12gb_sout('x-f6-ok') = 'ok' and pg_temp.s12gb_sbody('x-f6-ok')->>'outcome' = 'completed'
    and pg_temp.s12gb_events('f6') = 1 and pg_temp.s12gb_audits('cms.governed.activate', 'f6') = 1
    and not exists (select 1 from pg_trigger where tgname = 'a_gf_fault_cas'),
  'control: without the fault the same lease completes the schedule with one event and one audit record, and the fault trigger is gone [P2-S12-AC-147]');

-- every reason code of the closed list
select ok((select array_agg(distinct reason_code order by reason_code) from platform_private.cms_governed_activation_schedules
            where state = 'blocked') = array['activation_authority_ended', 'approval_invalidated', 'canonical_source_unavailable'],
  'this suite drove the blocked reason codes activation_authority_ended, approval_invalidated and canonical_source_unavailable [P2-S12-AC-147]');

select finish();
rollback;
