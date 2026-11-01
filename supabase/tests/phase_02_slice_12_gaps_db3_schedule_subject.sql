-- Slice 12 gap lane claude_s12_gaps_db3: P2-S12-AC-143 clause 3, "the subject (`scheduled` with an equal hash)" re-read at fire
-- (BE03c "Scheduled activation", line 188; CMS-03C-19 execute, 20261014070600 step 3).  The executor ORs four conditions into one
-- approval_invalidated block: review.state <> 'approved', review.version <> schedule.expected_version, subject state <> 'scheduled',
-- subject contentHash <> frozen subject_hash.  The existing producer states (a revoked approver) flip the two REVIEW disjuncts and
-- the subject state together, so they cannot isolate the SUBJECT disjuncts; and no lawful producer changes a scheduled subject's
-- state or content hash while its review stays approved at its version (the hash is immutable, every state move goes through the
-- review close/decision/schedule commands that also move the review or the schedule).
-- LABELLED SEAM (the same technique and accepted shape as gaps_db1_recheck.sql for AC-083): the CURRENT-side reader
-- platform_private.cms_governed_subject_resolve is renamed aside and replaced by a transparent wrapper that, ONLY for the locked
-- read the executor makes and only while the GUC gap.fault names it, alters one member of the answer (state or contentHash); both
-- are restored byte for byte.  The executor, the guards and every table are the unmodified product.  Real producers elsewhere: the
-- schedules are real CMS-03C-09 schedules over real approved reviews, claimed by CMS-03C-19; the suite REALLY WAITS ~75 s.
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

select ok(pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1) = 'OK', 'fixture: rev1 holds the real reviewer grant [P2-S12-AC-143]');
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';
select pg_temp.s12gb_approved('k1');
select pg_temp.s12gb_approved('k2');
select pg_temp.s12gb_approved('k3');
select ok((select count(*) = 3 and bool_and(state = 'approved' and version = 2) from platform_private.cms_governed_reviews
            where id in (select pg_temp.s12ga_review(t) from unnest(array['k1', 'k2', 'k3']) t)),
  'fixture: three real approved template reviews at version 2 [P2-S12-AC-143]');

create temp table g3s_clock(started timestamptz not null) on commit drop;
insert into g3s_clock values (clock_timestamp());
select pg_temp.s12gb_act('sch-k1', 'owner', pg_temp.s12ga_review('k1'), 'schedule', p_after => interval '62 seconds');
select pg_temp.s12gb_act('sch-k2', 'owner', pg_temp.s12ga_review('k2'), 'schedule', p_after => interval '63 seconds');
select pg_temp.s12gb_act('sch-k3', 'owner', pg_temp.s12ga_review('k3'), 'schedule', p_after => interval '64 seconds');
select ok((select count(*) = 3 and bool_and(pg_temp.s12ga_out('sch-' || t) = 'ok') from unnest(array['k1', 'k2', 'k3']) t)
    and (select count(*) = 3 and bool_and(state = 'pending') from platform_private.cms_governed_activation_schedules)
    and (select count(*) = 3 and bool_and(state = 'scheduled') from platform_private.cms_template_versions
          where id in (select pg_temp.s12ga_subject(t) from unnest(array['k1', 'k2', 'k3']) t)),
  'fixture: three real pending schedules were accepted by CMS-03C-09 and their subjects are scheduled [P2-S12-AC-143]');
select pg_sleep(greatest(0, 70 - extract(epoch from (clock_timestamp() - (select started from g3s_clock)))));
select pg_temp.s12gb_claim('claim-k', '100'::jsonb);
create or replace function pg_temp.g3s_cver(p_tag text) returns text language sql stable as $body$
  select pg_temp.s12gb_claimed('claim-k', p_tag)->>'expectedVersion' $body$;
create or replace function pg_temp.g3s_lease(p_tag text) returns uuid language sql stable as $body$
  select (pg_temp.s12gb_claimed('claim-k', p_tag)->>'leaseId')::uuid $body$;
create or replace function pg_temp.g3s_exec(p_label text, p_tag text, p_fault text) returns void language plpgsql as $body$
begin
  perform set_config('gap.fault', p_fault, true);
  perform pg_temp.s12gb_exec(p_label, pg_temp.s12gb_sid(p_tag), pg_temp.g3s_cver(p_tag), pg_temp.g3s_lease(p_tag));
  perform set_config('gap.fault', '', true);
end;
$body$;
select ok(pg_temp.s12gb_sout('claim-k') = 'ok' and jsonb_array_length(pg_temp.s12gb_sbody('claim-k')) = 3
    and (select count(*) = 3 from platform_private.cms_governed_activation_schedules where state = 'executing'),
  'control: the three due schedules were claimed under a lease [P2-S12-AC-143]');
-- The other two disjuncts are false for every claimed schedule: the review is approved AT the version the schedule relied on.
select ok((select count(*) = 3 and bool_and(review.state = 'approved' and review.version = schedule.expected_version)
             from platform_private.cms_governed_activation_schedules schedule
             join platform_private.cms_governed_reviews review on review.id = schedule.review_id),
  'control: every claimed schedule has its review approved at exactly the version the schedule relied on, so only the subject disjuncts can differ [P2-S12-AC-143]');

-- ---- the labelled substitution of the CURRENT subject read ---------------------------------------------------------------
create temp table g3s_saved(def text not null, owner_before text not null, acl_before text, md5_src text not null) on commit drop;
create or replace function pg_temp.g3s_install() returns void language plpgsql as $body$
declare v_resolve constant regprocedure := 'platform_private.cms_governed_subject_resolve(text,uuid,boolean)'::regprocedure;
begin
  if current_user <> 'postgres' then raise exception 'substitution requires the test-admin'; end if;
  insert into g3s_saved select pg_get_functiondef(p.oid), pg_get_userbyid(p.proowner), p.proacl::text, md5(p.prosrc)
    from pg_proc p where p.oid = v_resolve;
  alter function platform_private.cms_governed_subject_resolve(text,uuid,boolean) rename to cms_governed_subject_resolve_orig;
  execute $f$
    create function platform_private.cms_governed_subject_resolve(p_kind text, p_id uuid, p_lock boolean default false)
    returns jsonb language plpgsql security definer set search_path = '' as $g$
    declare r jsonb;
    begin
      r := platform_private.cms_governed_subject_resolve_orig(p_kind, p_id, p_lock);
      if r is not null and p_lock then
        if pg_catalog.current_setting('gap.fault', true) = 'state' then
          r := r || pg_catalog.jsonb_build_object('state', 'approved');
        elsif pg_catalog.current_setting('gap.fault', true) = 'hash' then
          r := r || pg_catalog.jsonb_build_object('contentHash', pg_catalog.repeat('0', 64));
        end if;
      end if;
      return r;
    end;
    $g$ $f$;
end;
$body$;
create or replace function pg_temp.g3s_restore() returns boolean language plpgsql as $body$
declare ok_resolve boolean;
begin
  perform set_config('gap.fault', '', true);
  drop function platform_private.cms_governed_subject_resolve(text,uuid,boolean);
  alter function platform_private.cms_governed_subject_resolve_orig(text,uuid,boolean) rename to cms_governed_subject_resolve;
  select md5(p.prosrc) = s.md5_src and pg_get_userbyid(p.proowner) = s.owner_before and p.proacl::text is not distinct from s.acl_before
    into ok_resolve from pg_proc p, g3s_saved s
   where p.oid = 'platform_private.cms_governed_subject_resolve(text,uuid,boolean)'::regprocedure;
  return coalesce(ok_resolve, false);
end;
$body$;
select pg_temp.g3s_install();

-- k3: the control.  The wrapper is installed and names no fault: the same schedule shape executes normally.
select pg_temp.g3s_exec('x-k3', 'k3', '');
select ok(pg_temp.s12gb_sout('x-k3') = 'ok' and pg_temp.s12gb_sbody('x-k3')->>'outcome' = 'completed'
    and (select state = 'active' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('k3'))
    and pg_temp.s12gb_events('k3') = 1,
  'control: with the transparent wrapper installed and no fault named the claimed schedule completes, the subject is active, one event [P2-S12-AC-143]');

-- k1: the subject re-read at fire is no longer `scheduled` (review approved at its version, hash equal)
select pg_temp.g3s_exec('x-k1', 'k1', 'state');
select ok(pg_temp.s12gb_sout('x-k1') = 'ok'
    and pg_temp.s12gb_sbody('x-k1') = jsonb_build_object('scheduleId', pg_temp.s12gb_sid('k1'), 'outcome', 'blocked',
          'reasonCode', 'approval_invalidated', 'actualUtc', null, 'deviationSeconds', null)
    and (select state = 'blocked' and reason_code = 'approval_invalidated' and lease_id is null
           from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('k1'))
    and (select state = 'approved' and version = 2 and invalidated_reason is null
           from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('k1'))
    and (select state = 'blocked' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('k1'))
    and pg_temp.s12gb_events('k1') = 0
    and (select count(*) = 1 from audit_private.audit_events
          where action = 'cms.governed.schedule.block' and target_id = pg_temp.s12gb_sid('k1')),
  'a subject that is not `scheduled` at fire, with its review approved at its version, blocks the schedule approval_invalidated: review untouched, subject blocked, no event, one audit record [P2-S12-AC-143]');

-- k2: the subject hash re-read at fire differs from the frozen one (review approved at its version, subject still scheduled)
select pg_temp.g3s_exec('x-k2', 'k2', 'hash');
select ok(pg_temp.s12gb_sout('x-k2') = 'ok'
    and pg_temp.s12gb_sbody('x-k2') = jsonb_build_object('scheduleId', pg_temp.s12gb_sid('k2'), 'outcome', 'blocked',
          'reasonCode', 'approval_invalidated', 'actualUtc', null, 'deviationSeconds', null)
    and (select state = 'blocked' and reason_code = 'approval_invalidated' and lease_id is null
           from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('k2'))
    and (select state = 'approved' and version = 2 and invalidated_reason is null
           from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('k2'))
    and (select state = 'blocked' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('k2'))
    and pg_temp.s12gb_events('k2') = 0
    and (select count(*) = 1 from audit_private.audit_events
          where action = 'cms.governed.schedule.block' and target_id = pg_temp.s12gb_sid('k2')),
  'a subject whose content hash differs from the frozen one at fire, with its review approved at its version, blocks the schedule approval_invalidated: review untouched, subject blocked, no event, one audit record [P2-S12-AC-143]');
select ok((select content_hash::text = (select subject_hash::text from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review('k2'))
           from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('k2')),
  'control: the stored subject hash really equals the frozen hash, so the difference came only from the substituted read [P2-S12-AC-143]');

select is(pg_temp.g3s_restore()::text, 'true',
  'control: the pinned reader is restored byte for byte (source, owner, ACL) [P2-S12-AC-143]');
select ok(not exists (select 1 from pg_proc where proname = 'cms_governed_subject_resolve_orig'),
  'control: no renamed-aside reader remains [P2-S12-AC-143]');

select finish();
rollback;
