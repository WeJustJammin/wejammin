-- Slice 12 gap lane claude_s12_db9b, item 3: P2-S12-AC-146 clause 5, "with the prior active version intact".
-- BE03c "Scheduled activation" (CMS-03C-19, line 188): a terminal failure of a fire-time execution blocks the SCHEDULED subject with a closed
-- reasonCode; it never touches the lineage's prior active version.  Each lineage below really HAS a prior active version: version 1 is activated
-- by the real CMS-03C-09 `activate` command, its successor version 2 is approved and scheduled, and the schedule is blocked at fire.
--   a  activation_authority_ended   the scheduler's designer grant lapses by the calendar (the accepted lapse fixture, 002-lapse-helpers)
--   b  approval_invalidated         the only approver's reviewer grant is revoked (real CMS-03A-17) after the claim
--   d  canonical_source_unavailable a taxonomy lineage; the role provider's append-only registry row turns `unbuilt` (accepted fixture)
--   c  dependency_changed           the bound content type gets a real successor (DEC-108 chain), executed LAST because it touches every lineage
--   e  control: the same shape COMPLETES, and then version 1 is superseded; so the assertions below can fail
-- retries_exhausted is driven by phase_02_slice_12_gaps_db9b_fire_prior_retries.sql (its ladder needs minutes of real waiting).
-- Intactness is the full prior row (to_jsonb of the whole row: state, activated_at, lifecycle_version, version, updated_at, supersedes_id, ...)
-- equal to its image taken before the claim, plus its outbox events and audit records unchanged.  The suite REALLY WAITS about 70 s for the schedules
-- to fall due: no clock is forged and no trigger is disabled.
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

create temp table d9f_setup(key text primary key, outcome text not null) on commit drop;
insert into d9f_setup(key, outcome) values
  ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1)),
  ('rev2:reviewer', pg_temp.s12ga_grant('rev2', 'cms.reviewer', 1)),
  ('rev2:designer', pg_temp.s12ga_grant('rev2', 'cms.template_designer', 1)),
  ('designer2:reviewer', pg_temp.s12ga_grant('designer2', 'cms.reviewer', 1)),
  ('owner:curator', pg_temp.s12ga_grant('owner', 'cms.taxonomy_curator', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key in ('rev1', 'rev2');
select ok((select count(*) = 5 and bool_and(outcome = 'OK') from d9f_setup),
  'fixture: reviewer, designer and curator grants were issued by the real CMS-03A-15 command [P2-S12-AC-146]');

-- ----------------------------------------------------------------------------------------------- helpers --
create or replace function pg_temp.d9f_row(p_kind text, p_id uuid) returns jsonb language plpgsql stable as $body$
declare r jsonb;
begin
  if p_kind = 'template' then select to_jsonb(t) into r from platform_private.cms_template_versions t where t.id = p_id;
  else select to_jsonb(t) into r from platform_private.cms_taxonomy_versions t where t.id = p_id; end if;
  return r;
end;
$body$;
-- members of the lineage of version row p_id (same lineage id) in state p_state
create or replace function pg_temp.d9f_members(p_kind text, p_id uuid, p_state text) returns bigint language plpgsql stable as $body$
declare n bigint;
begin
  if p_kind = 'template' then
    select count(*) into n from platform_private.cms_template_versions m
     where m.template_id = (select template_id from platform_private.cms_template_versions where id = p_id) and m.state = p_state;
  else
    select count(*) into n from platform_private.cms_taxonomy_versions m
     where m.taxonomy_id = (select taxonomy_id from platform_private.cms_taxonomy_versions where id = p_id) and m.state = p_state;
  end if;
  return n;
end;
$body$;
create or replace function pg_temp.d9f_audits(p_id uuid) returns bigint language sql stable as $body$
  select count(*) from audit_private.audit_events where target_id = p_id $body$;
create or replace function pg_temp.d9f_outbox(p_id uuid) returns bigint language sql stable as $body$
  select count(*) from platform_private.outbox_events where aggregate_id = p_id $body$;

-- A successor draft of an ACTIVE taxonomy lineage (or a first version), submitted and approved by rev1 through the real producers.
create or replace function pg_temp.d9f_tax(p_tag text, p_key text, p_domains jsonb, p_expected text) returns void language plpgsql as $body$
begin
  perform pg_temp.s12ga_rpc('tc-' || p_tag, 'platform_api.cms_create_taxonomy_version', 'owner', jsonb_build_object(
    'taxonomyKey', p_key, 'shape', 'flat',
    'allowedTypeKeys', jsonb_build_array((select type_key from platform_private.cms_content_types
                                           where id = (select value::uuid from s12gov_ids where key = 'typeA'))),
    'allowedFieldKeys', jsonb_build_array('gapfield'), 'canonicalOverlapDomains', p_domains,
    'expectedVersion', p_expected, 'idempotencyKey', 'd9f-tc-' || p_tag)
    || case when p_expected is null then '{}'::jsonb else jsonb_build_object('ifMatch', p_expected) end);
  if pg_temp.s12ga_out('tc-' || p_tag) <> 'ok' then
    raise exception 'd9f fixture: the real taxonomy producer refused %: %', p_tag, pg_temp.s12ga_out('tc-' || p_tag);
  end if;
  insert into s12gov_ids(key, value) values (p_tag || ':subject', pg_temp.s12ga_body('tc-' || p_tag)->>'id')
    on conflict (key) do update set value = excluded.value;
  perform pg_temp.s12ga_rpc('ts-' || p_tag, 'platform_api.cms_submit_governed_review', 'owner', jsonb_build_object(
    'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject(p_tag),
    'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject(p_tag)),
    'idempotencyKey', 'd9f-ts-' || p_tag));
  if pg_temp.s12ga_out('ts-' || p_tag) <> 'ok' then
    raise exception 'd9f fixture: the real submit producer refused %: %', p_tag, pg_temp.s12ga_out('ts-' || p_tag);
  end if;
  insert into s12gov_ids(key, value) values (p_tag || ':review', pg_temp.s12ga_body('ts-' || p_tag)->>'id')
    on conflict (key) do update set value = excluded.value;
  perform pg_temp.s12ga_assign('as-' || p_tag, 'owner', pg_temp.s12ga_review(p_tag), 'rev1', interval '20 hours');
  perform pg_temp.s12ga_decide('ap-' || p_tag, 'rev1', pg_temp.s12ga_review(p_tag), 'approve');
  if (select state from platform_private.cms_governed_reviews where id = pg_temp.s12ga_review(p_tag)) <> 'approved' then
    raise exception 'd9f fixture: % did not reach approved', p_tag;
  end if;
end;
$body$;

-- ------------------------------------------------------------------ the lineages and their prior active versions --
-- templates: <x>0 is the prior version (activated immediately), <x>1 its successor (scheduled).
select pg_temp.s12gb_approved('a0');
select pg_temp.s12gb_act('act-a0', 'owner', pg_temp.s12ga_review('a0'), 'activate');
select pg_temp.s12gb_successor('a1', 'a0', array['typeA']);
select pg_temp.s12gb_approve('a1');
select pg_temp.s12gb_approved('b0');
select pg_temp.s12gb_act('act-b0', 'owner', pg_temp.s12ga_review('b0'), 'activate');
select pg_temp.s12gb_successor('b1', 'b0', array['typeA']);
select pg_temp.s12gb_approve('b1', 'designer2');
select pg_temp.s12gb_approved('c0');
select pg_temp.s12gb_act('act-c0', 'owner', pg_temp.s12ga_review('c0'), 'activate');
select pg_temp.s12gb_successor('c1', 'c0', array['typeA']);
select pg_temp.s12gb_approve('c1');
select pg_temp.s12gb_approved('e0');
select pg_temp.s12gb_act('act-e0', 'owner', pg_temp.s12ga_review('e0'), 'activate');
select pg_temp.s12gb_successor('e1', 'e0', array['typeA']);
select pg_temp.s12gb_approve('e1');
-- taxonomy: d0 declares no canonical domain, d1 declares the built `role` domain.
select pg_temp.d9f_tax('d0', 'd9f-fire-tax', '[]'::jsonb, null);
select pg_temp.s12gb_act('act-d0', 'owner', pg_temp.s12ga_review('d0'), 'activate');
select pg_temp.d9f_tax('d1', 'd9f-fire-tax', '["role"]'::jsonb, '1');

select ok((select count(*) = 5 and bool_and(pg_temp.s12ga_out('act-' || t) = 'ok') from unnest(array['a0', 'b0', 'c0', 'd0', 'e0']) t)
    and (select count(*) = 4 and bool_and(state = 'active' and lifecycle_version = 4)
           from platform_private.cms_template_versions where id in (select pg_temp.s12ga_subject(t) from unnest(array['a0', 'b0', 'c0', 'e0']) t))
    and (select state = 'active' from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('d0')),
  'fixture: five lineages each have a REAL prior active version 1, activated by the CMS-03C-09 activate command [P2-S12-AC-146]');
select ok((select count(*) = 4 and bool_and(successor.supersedes_id = predecessor.id and successor.version = 2 and successor.state = 'approved'
                                              and successor.template_id = predecessor.template_id)
             from (values ('a'), ('b'), ('c'), ('e')) lineage(x)
             join platform_private.cms_template_versions successor on successor.id = pg_temp.s12ga_subject(lineage.x || '1')
             join platform_private.cms_template_versions predecessor on predecessor.id = pg_temp.s12ga_subject(lineage.x || '0'))
    and (select successor.supersedes_id = pg_temp.s12ga_subject('d0') and successor.version = 2 and successor.state = 'approved'
           from platform_private.cms_taxonomy_versions successor where successor.id = pg_temp.s12ga_subject('d1')),
  'fixture: every successor is a real approved version 2 that supersedes the prior active version by identity in the same lineage [P2-S12-AC-146]');

create temp table d9f_clock(started timestamptz not null) on commit drop;
insert into d9f_clock values (clock_timestamp());
select pg_temp.s12gb_act('sch-a1', 'rev2', pg_temp.s12ga_review('a1'), 'schedule', p_after => interval '62 seconds');
select pg_temp.s12gb_act('sch-b1', 'owner', pg_temp.s12ga_review('b1'), 'schedule', p_after => interval '63 seconds');
select pg_temp.s12gb_act('sch-c1', 'owner', pg_temp.s12ga_review('c1'), 'schedule', p_after => interval '64 seconds');
select pg_temp.s12gb_act('sch-d1', 'owner', pg_temp.s12ga_review('d1'), 'schedule', p_after => interval '65 seconds');
select pg_temp.s12gb_act('sch-e1', 'owner', pg_temp.s12ga_review('e1'), 'schedule', p_after => interval '66 seconds');
select ok((select count(*) = 5 and bool_and(pg_temp.s12ga_out('sch-' || t) = 'ok') from unnest(array['a1', 'b1', 'c1', 'd1', 'e1']) t)
    and (select count(*) = 5 and bool_and(state = 'pending') from platform_private.cms_governed_activation_schedules)
    and (select count(*) = 4 and bool_and(state = 'scheduled') from platform_private.cms_template_versions
          where id in (select pg_temp.s12ga_subject(t) from unnest(array['a1', 'b1', 'c1', 'e1']) t)),
  'fixture: five real pending schedules of the successors were accepted by CMS-03C-09 [P2-S12-AC-146]');

-- The image of every prior active version BEFORE the claim and any fire.
create temp table d9f_before(tag text primary key, kind text not null, prior_id uuid not null, successor_id uuid not null,
  prior_row jsonb not null, prior_audits bigint not null, prior_events bigint not null, successor_events bigint not null) on commit drop;
insert into d9f_before
select x.tag, x.kind, pg_temp.s12ga_subject(x.tag || '0'), pg_temp.s12ga_subject(x.tag || '1'),
       pg_temp.d9f_row(x.kind, pg_temp.s12ga_subject(x.tag || '0')), pg_temp.d9f_audits(pg_temp.s12ga_subject(x.tag || '0')),
       pg_temp.d9f_outbox(pg_temp.s12ga_subject(x.tag || '0')), pg_temp.d9f_outbox(pg_temp.s12ga_subject(x.tag || '1'))
  from (values ('a', 'template'), ('b', 'template'), ('c', 'template'), ('d', 'taxonomy'), ('e', 'template')) x(tag, kind);
select ok((select count(*) = 5 and bool_and(prior_row->>'state' = 'active' and prior_row->>'activated_at' is not null and prior_events = 1)
             from d9f_before),
  'fixture: before any fire each prior version is active with a recorded activated_at and exactly one activation event [P2-S12-AC-146]');

select pg_sleep(greatest(0, 70 - extract(epoch from (clock_timestamp() - (select started from d9f_clock)))));
select pg_temp.s12gb_claim('claim-d9', '100'::jsonb);
create or replace function pg_temp.d9f_cver(p_tag text) returns text language sql stable as $body$
  select pg_temp.s12gb_claimed('claim-d9', p_tag)->>'expectedVersion' $body$;
create or replace function pg_temp.d9f_lease(p_tag text) returns uuid language sql stable as $body$
  select (pg_temp.s12gb_claimed('claim-d9', p_tag)->>'leaseId')::uuid $body$;
create or replace function pg_temp.d9f_exec(p_label text, p_tag text) returns void language sql as $body$
  select pg_temp.s12gb_exec(p_label, pg_temp.s12gb_sid(p_tag || '1'), pg_temp.d9f_cver(p_tag || '1'), pg_temp.d9f_lease(p_tag || '1')) $body$;
select ok(pg_temp.s12gb_sout('claim-d9') = 'ok' and jsonb_array_length(pg_temp.s12gb_sbody('claim-d9')) = 5
    and (select count(*) = 5 and bool_and(state = 'executing') from platform_private.cms_governed_activation_schedules),
  'control: the five due schedules were claimed under a lease [P2-S12-AC-146]');

-- One blocked fire, checked in full: the schedule outcome, the blocked successor, and the prior active version intact.
create or replace function pg_temp.d9f_blocked(p_tag text, p_reason text, p_successor_state text default 'blocked') returns setof text language plpgsql as $body$
declare b d9f_before%rowtype; sid uuid := pg_temp.s12gb_sid(p_tag || '1');
begin
  select * into b from d9f_before where tag = p_tag;
  return next extensions.is(pg_temp.s12gb_sbody('x-' || p_tag),
    jsonb_build_object('scheduleId', sid, 'outcome', 'blocked', 'reasonCode', p_reason, 'actualUtc', null, 'deviationSeconds', null),
    p_tag || ': the fire answers blocked with the closed reasonCode ' || p_reason || ' [P2-S12-AC-146]');
  return next extensions.ok((select state = 'blocked' and reason_code = p_reason from platform_private.cms_governed_activation_schedules where id = sid)
      and (pg_temp.d9f_row(b.kind, b.successor_id)->>'state') = p_successor_state and (pg_temp.d9f_row(b.kind, b.successor_id)->>'activated_at') is null,
    p_tag || ': the schedule is blocked ' || p_reason || ' and the scheduled successor is ' || p_successor_state || ', never activated [P2-S12-AC-146]');
  return next extensions.is(pg_temp.d9f_row(b.kind, b.prior_id), b.prior_row,
    p_tag || ': the PRIOR active version is byte-for-byte the same row after the block (state, activated_at, lifecycle_version, version, updated_at, supersedes_id) [P2-S12-AC-146]');
  return next extensions.ok((pg_temp.d9f_row(b.kind, b.prior_id)->>'state') = 'active'
      and (pg_temp.d9f_row(b.kind, b.prior_id)->>'activated_at') = (b.prior_row->>'activated_at')
      and (pg_temp.d9f_row(b.kind, b.prior_id)->>'retired_at') is null,
    p_tag || ': the prior version is still active with its activated_at unchanged and never retired [P2-S12-AC-146]');
  return next extensions.ok(pg_temp.d9f_members(b.kind, b.prior_id, 'active') = 1 and pg_temp.d9f_members(b.kind, b.prior_id, 'superseded') = 0,
    p_tag || ': the lineage still has exactly one active member and no superseded member: no supersession happened [P2-S12-AC-146]');
  return next extensions.ok(pg_temp.d9f_outbox(b.prior_id) = b.prior_events and pg_temp.d9f_outbox(b.successor_id) = b.successor_events
      and pg_temp.d9f_outbox(b.successor_id) = 0 and pg_temp.d9f_audits(b.prior_id) = b.prior_audits,
    p_tag || ': no event was emitted for either version and the prior version gained no audit record [P2-S12-AC-146]');
end;
$body$;

-- a: the scheduler's designer grant ENDS by the calendar (not revoked) before the fire instant.
select pg_temp.s12fr_lapse(pg_temp.s09d_id('ownerOrg'), pg_temp.s12ga_person('rev2'), 'cms.template_designer');
select pg_temp.d9f_exec('x-a', 'a');
select pg_temp.s12fr_restore();
select * from pg_temp.d9f_blocked('a', 'activation_authority_ended');

-- b: the only approver's reviewer grant is revoked AFTER the claim by the real CMS-03A-17 command: the review is invalidated, the claimed
-- schedule survives and the fire blocks approval_invalidated.
select is(pg_temp.s09d_revoke_via_rpc('designer2', 'cms.reviewer'), 'OK',
  'control: the real CMS-03A-17 command revokes the only approver''s reviewer grant after the claim [P2-S12-AC-146]');
select pg_temp.d9f_exec('x-b', 'b');
-- the committed invalidation of the review already returned the successor from scheduled to draft; the fire then blocks the claimed schedule.
select * from pg_temp.d9f_blocked('b', 'approval_invalidated', 'draft');

-- d: the role provider's registry row turns unbuilt (append-only; a NEWER row is how an owning shard changes provider state).
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 2, 'role', 'unbuilt', null, null;
select set_config('app.cms_rpc', '', true);
select pg_temp.d9f_exec('x-d', 'd');
select * from pg_temp.d9f_blocked('d', 'canonical_source_unavailable');

-- e (control): the same shape without a fault completes, and THEN the prior version is superseded, so the intactness checks are discriminating.
select pg_temp.d9f_exec('x-e', 'e');
select ok(pg_temp.s12gb_sout('x-e') = 'ok' and pg_temp.s12gb_sbody('x-e')->>'outcome' = 'completed'
    and (select state = 'active' from platform_private.cms_template_versions where id = pg_temp.s12ga_subject('e1'))
    and (select v.state = 'superseded' and v.activated_at is not distinct from (select prior_row->>'activated_at' from d9f_before where tag = 'e')::timestamptz
              and v.lifecycle_version = (select (prior_row->>'lifecycle_version')::bigint + 1 from d9f_before where tag = 'e')
         from platform_private.cms_template_versions v where v.id = pg_temp.s12ga_subject('e0'))
    and pg_temp.d9f_members('template', pg_temp.s12ga_subject('e0'), 'active') = 1
    and pg_temp.d9f_row('template', pg_temp.s12ga_subject('e0')) is distinct from (select prior_row from d9f_before where tag = 'e'),
  'control: an execution that completes supersedes the prior version (lifecycle +1, activated_at kept), so the "row unchanged" assertions above would fail on a supersession [P2-S12-AC-146]');

-- c: the bound content type gets a real successor between acceptance and fire; executed last because it changes the dependency of every schedule.
select pg_temp.s09d_successor('ordnew', 's12govordinary');
select pg_temp.s09d_to_active('ordnew', array['rev3']);
select ok(pg_temp.s09d_outcome('ordnew:activate') = 'OK',
  'control: a real successor of the bound content type is activated through the DEC-108 chain after c1 was scheduled [P2-S12-AC-146]');
select pg_temp.d9f_exec('x-c', 'c');
select * from pg_temp.d9f_blocked('c', 'dependency_changed');

-- the closed list: this suite drove four of the five reason codes; retries_exhausted has its own suite.
select is((select array_agg(distinct reason_code order by reason_code) from platform_private.cms_governed_activation_schedules where state = 'blocked'),
  array['activation_authority_ended', 'approval_invalidated', 'canonical_source_unavailable', 'dependency_changed'],
  'this suite drove the blocked reason codes activation_authority_ended, approval_invalidated, canonical_source_unavailable and dependency_changed [P2-S12-AC-146]');

select finish();
rollback;
