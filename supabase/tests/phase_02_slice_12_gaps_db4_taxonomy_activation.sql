-- Slice 12 gap lane claude_s12_gaps_db4: a declared canonical domain that has lost its provider after approval is refused at the
-- CMS-03C-09 taxonomy-version ACTIVATION and SCHEDULE commands (BE03c "Governed activation, retirement and scheduled activation" step 5:
-- "taxonomy: a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with the domain";
-- Route Registry row CMS-03C-16 and the Registry invariants table, taxonomy_version: "every declared canonical domain has a registered
-- provider (else 422 `canonical_source_unavailable` with `details.domain`)"; DEC-135).
--   P2-S12-AC-210 clause 0  activating or scheduling a taxonomy_version requires a registered provider for every declared canonical domain,
--                           else 422 canonical_source_unavailable with details.domain (the SQL token is P0001:canonical_source_unavailable
--                           with DETAIL {"domain":...}; the 422 mapping is the Worker's, proven by its token-mapping tests).
--   P2-S12-AC-223 clause 0  the same refusal at taxonomy-version activation.
-- Real producers throughout (CMS-03A-15 grants, CMS-03C-16 create, CMS-03C-06 submit, CMS-03C-08 assign, CMS-03C-07 approve, CMS-03C-09).
-- The one labelled fixture is how an owning shard changes its provider state: an append-only registry row of a NEWER version, the way
-- phase_02_slice_12_gaps_db1_schedule_fire.sql (the fire-time analogue, CMS-03C-19) and phase_02_slice_12_taxonomy_terms/099-registry-drift
-- do it; no trigger is disabled and no governed row is written by hand.
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

create temp table g4_setup(key text primary key, outcome text not null) on commit drop;
insert into g4_setup(key, outcome) values
  ('rev1:reviewer', pg_temp.s12ga_grant('rev1', 'cms.reviewer', 1)),
  ('owner:curator', pg_temp.s12ga_grant('owner', 'cms.taxonomy_curator', 1));
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key in ('rev1');
select ok((select count(*) = 2 and bool_and(outcome = 'OK') from g4_setup),
  'fixture: rev1 holds cms.reviewer and the owner holds cms.taxonomy_curator through the real CMS-03A-15 command [P2-S12-AC-210]');

-- A vocabulary through the real producers: create, submit, assign rev1, approve.  g4_tx(tag, taxonomyKey, domains) leaves it approved.
create or replace function pg_temp.g4_tx(p_tag text, p_domains jsonb) returns void language plpgsql as $body$
begin
  perform pg_temp.s12ga_rpc('tx-create-' || p_tag, 'platform_api.cms_create_taxonomy_version', 'owner', jsonb_build_object(
    'taxonomyKey', 'g4-' || p_tag, 'shape', 'flat',
    'allowedTypeKeys', jsonb_build_array((select type_key from platform_private.cms_content_types
                                            where id = (select value::uuid from s12gov_ids where key = 'typeA'))),
    'allowedFieldKeys', jsonb_build_array('g4field'), 'canonicalOverlapDomains', p_domains,
    'expectedVersion', null, 'idempotencyKey', 's12ga-g4-create-' || p_tag));
  insert into s12gov_ids(key, value) select p_tag || ':subject', pg_temp.s12ga_body('tx-create-' || p_tag)->>'id'
   where pg_temp.s12ga_body('tx-create-' || p_tag)->>'id' is not null;
  perform pg_temp.s12ga_rpc('tx-submit-' || p_tag, 'platform_api.cms_submit_governed_review', 'owner', jsonb_build_object(
    'subjectKind', 'taxonomy_version', 'subjectId', pg_temp.s12ga_subject(p_tag),
    'subjectHash', (select content_hash::text from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject(p_tag)),
    'idempotencyKey', 's12ga-g4-submit-' || p_tag));
  insert into s12gov_ids(key, value) select p_tag || ':review', pg_temp.s12ga_body('tx-submit-' || p_tag)->>'id'
   where pg_temp.s12ga_body('tx-submit-' || p_tag)->>'id' is not null;
  perform pg_temp.s12ga_assign('as-' || p_tag, 'owner', pg_temp.s12ga_review(p_tag), 'rev1', interval '20 hours');
  perform pg_temp.s12ga_decide('ap-' || p_tag, 'rev1', pg_temp.s12ga_review(p_tag), 'approve');
end;
$body$;
-- WRITE WITNESSES.  Every command below is called through a nested EXCEPTION block that rolls back whatever the command wrote, so comparing
-- row contents or counts after a raised refusal can never show an effect.  A sequence's nextval is NOT rolled back, so a temporary BEFORE
-- trigger on each store that bumps its own sequence counts the write ATTEMPTS a call made, including those the raise then undid.  No product
-- trigger is disabled; the six witness triggers and sequences die with the rolled-back transaction.  The controls further down prove the
-- witnesses see a real activation and a real schedule.
create function platform_private.g4_witness() returns trigger language plpgsql security definer set search_path = '' as $body$
begin
  perform pg_catalog.nextval(tg_argv[0]::pg_catalog.regclass);
  return coalesce(new, old);
end;
$body$;
create sequence platform_private.g4_w_review;
create sequence platform_private.g4_w_subject;
create sequence platform_private.g4_w_schedule;
create sequence platform_private.g4_w_outbox;
create sequence platform_private.g4_w_audit;
create sequence platform_private.g4_w_idem;
create trigger a_g4_witness before insert or update or delete on platform_private.cms_governed_reviews
  for each row execute function platform_private.g4_witness('platform_private.g4_w_review');
create trigger a_g4_witness before insert or update or delete on platform_private.cms_taxonomy_versions
  for each row execute function platform_private.g4_witness('platform_private.g4_w_subject');
create trigger a_g4_witness before insert or update or delete on platform_private.cms_governed_activation_schedules
  for each row execute function platform_private.g4_witness('platform_private.g4_w_schedule');
create trigger a_g4_witness before insert or update or delete on platform_private.outbox_events
  for each row execute function platform_private.g4_witness('platform_private.g4_w_outbox');
create trigger a_g4_witness before insert or update or delete on audit_private.audit_events
  for each row execute function platform_private.g4_witness('platform_private.g4_w_audit');
create trigger a_g4_witness before insert or update or delete on platform_private.idempotency_records
  for each row execute function platform_private.g4_witness('platform_private.g4_w_idem');
create or replace function pg_temp.g4_w(p_name text) returns bigint language plpgsql as $body$
declare v bigint;
begin
  execute pg_catalog.format('select case when is_called then last_value else 0 end from platform_private.%I', 'g4_w_' || p_name) into v;
  return v;
end;
$body$;
-- the five stores a governed activation or schedule changes, as one string; the idempotency store separately
create or replace function pg_temp.g4_wcore() returns text language sql volatile as $body$
  select pg_temp.g4_w('review') || '/' || pg_temp.g4_w('subject') || '/' || pg_temp.g4_w('schedule') || '/' || pg_temp.g4_w('outbox') || '/' || pg_temp.g4_w('audit') $body$;
create temp table g4_marks(label text primary key, core text not null, idem bigint not null) on commit drop;
create or replace function pg_temp.g4_wmark(p_label text) returns void language sql volatile as $body$
  insert into g4_marks(label, core, idem) values (p_label, pg_temp.g4_wcore(), pg_temp.g4_w('idem')) $body$;
create or replace function pg_temp.g4_core_untouched(p_label text) returns boolean language sql volatile as $body$
  select pg_temp.g4_wcore() = core from g4_marks where label = p_label $body$;
create or replace function pg_temp.g4_idem_untouched(p_label text) returns boolean language sql volatile as $body$
  select pg_temp.g4_w('idem') = idem from g4_marks where label = p_label $body$;
-- how many of review / subject / schedule / outbox / audit advanced since the mark (a real write moves its own witness)
create or replace function pg_temp.g4_advanced(p_label text, p_store text) returns boolean language sql volatile as $body$
  select pg_temp.g4_w(p_store) > split_part(core, '/', array_position(array['review', 'subject', 'schedule', 'outbox', 'audit'], p_store))::bigint
    from g4_marks where label = p_label $body$;
create or replace function pg_temp.g4_events(p_tag text) returns bigint language sql stable as $body$
  select count(*) from platform_private.outbox_events where aggregate_id = pg_temp.s12ga_subject(p_tag) $body$;

-- ta1 is activated and ta2 scheduled under drift; ta3 declares no domain; tctl is the control approved after the provider returns.
select pg_temp.g4_tx('ta1', jsonb_build_array('role'));
select pg_temp.g4_tx('ta2', jsonb_build_array('role'));
select pg_temp.g4_tx('ta3', '[]'::jsonb);
select ok((select count(*) = 3 and bool_and(review.state = 'approved' and review.version = 2 and review.subject_kind = 'taxonomy_version')
     from platform_private.cms_governed_reviews review
    where review.id in (select pg_temp.s12ga_review(t) from unnest(array['ta1', 'ta2', 'ta3']) t))
  and (select count(*) = 2 from platform_private.cms_governed_review_dependencies dependency
        where dependency.kind = 'canonical_domain'
          and dependency.review_id in (select pg_temp.s12ga_review(t) from unnest(array['ta1', 'ta2', 'ta3']) t))
  and (select count(*) = 3 and bool_and(subject.state = 'approved')
         from platform_private.cms_taxonomy_versions subject
        where subject.id in (select pg_temp.s12ga_subject(t) from unnest(array['ta1', 'ta2', 'ta3']) t)),
  'fixture: three real approved taxonomy reviews, two declaring the built role domain (frozen canonical_domain dependency) and one declaring none [P2-S12-AC-210]');

-- the owning shard (here: a forward-migration-like insert) de-registers the role provider after the approvals
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 2, 'role', 'unbuilt', null, null;
select is((select provider_state from platform_private.cms_canonical_domain_current('role')), 'unbuilt',
  'control: the current registry row of the role domain is now the unbuilt version 2 [P2-S12-AC-210]');
select set_config('app.cms_rpc', '', true);

-- ------------------------------------------------------------------- the order of the refusals before the provider --
-- context-cleared: a call that carries no step-up proof is STEP_UP_REQUIRED before anything reads the registry (step 1 precedes step 5)
select pg_temp.g4_wmark('early');
select pg_temp.s12gb_act('d-nostepup', 'owner', pg_temp.s12ga_review('ta1'), 'activate', '{}'::jsonb, array[]::text[],
  pg_temp.s12ga_ctx('owner', interval '1 minute', false));
select is(pg_temp.s12gb_oc('d-nostepup'), 'P0001:STEP_UP_REQUIRED',
  'under provider drift a call without a step-up proof is STEP_UP_REQUIRED, not canonical_source_unavailable: the proof is verified before anything else [P2-S12-AC-210]');
-- an assigned reviewer without the curator capability meets the capability gate (step 2), not the provider check
select pg_temp.s12gb_act('d-reviewer', 'rev1', pg_temp.s12ga_review('ta1'), 'activate');
select is(pg_temp.s12gb_oc('d-reviewer'), 'P0001:capability_missing',
  'under provider drift a reviewer who lacks cms.taxonomy_curator is 403 capability_missing, not canonical_source_unavailable [P2-S12-AC-210]');
select ok(pg_temp.g4_core_untouched('early') and pg_temp.g4_idem_untouched('early'),
  'the step-up and capability refusals attempt no write at all: no review, subject, schedule, event, audit or idempotency row is touched, not even transiently [P2-S12-AC-210]');
-- a stale review version meets the CAS (step 3), not the provider check
select pg_temp.s12gb_act('d-stale', 'owner', pg_temp.s12ga_review('ta1'), 'activate', jsonb_build_object('expectedVersion', '1', 'ifMatch', '1'));
select is(pg_temp.s12ga_out('d-stale'), 'P0001:VERSION_MISMATCH',
  'under provider drift a stale review version is VERSION_MISMATCH, not canonical_source_unavailable [P2-S12-AC-210]');
select ok(pg_temp.g4_core_untouched('early'),
  'the stale-version refusal attempts no write to the review, subject, schedule, event or audit stores [P2-S12-AC-210]');

-- ---------------------------------------------------------------------------------------- the refusal itself --
select pg_temp.g4_wmark('act');
select pg_temp.s12gb_act('d-activate', 'owner', pg_temp.s12ga_review('ta1'), 'activate');
select is(pg_temp.s12gb_oc('d-activate'), 'P0001:canonical_source_unavailable#{"domain": "role"}',
  'activating an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-223]');
select ok(pg_temp.g4_core_untouched('act'),
  'the refused activation attempts no write to the review, the subject, the schedules, the outbox or the audit log: no invalidation, no switch, no event [P2-S12-AC-223]');

select pg_temp.g4_wmark('sched');
select pg_temp.s12gb_act('d-schedule', 'owner', pg_temp.s12ga_review('ta2'), 'schedule');
select is(pg_temp.s12gb_oc('d-schedule'), 'P0001:canonical_source_unavailable#{"domain": "role"}',
  'scheduling an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-210]');
select ok(pg_temp.g4_core_untouched('sched'),
  'the refused schedule attempts no write to the schedules, the subject, the review, the outbox or the audit log: no schedule row, subject never scheduled, no event [P2-S12-AC-210]');
select pg_temp.s12gb_act('d-activate', 'owner', pg_temp.s12ga_review('ta1'), 'activate');
select is(pg_temp.s12gb_oc('d-activate'), 'P0001:canonical_source_unavailable#{"domain": "role"}',
  'a repeat of the activation with the same idempotency key is refused canonical_source_unavailable again, never answered as a success [P2-S12-AC-223]');

-- ------------------------------------------------------ only the DECLARED domains are asked (the negative) --
select pg_temp.g4_wmark('undeclared');
select pg_temp.s12gb_act('d-undeclared', 'owner', pg_temp.s12ga_review('ta3'), 'activate');
select ok(pg_temp.s12ga_out('d-undeclared') = 'ok' and pg_temp.s12ga_body('d-undeclared')->>'subjectState' = 'active'
    and pg_temp.g4_events('ta3') = 1
    and (select state = 'active' from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('ta3')),
  'a vocabulary that declares no canonical domain activates while role is unbuilt: only the declared domains are checked [P2-S12-AC-210]');
select ok(pg_temp.g4_advanced('undeclared', 'review') and pg_temp.g4_advanced('undeclared', 'subject')
    and pg_temp.g4_advanced('undeclared', 'outbox') and pg_temp.g4_advanced('undeclared', 'audit') and not pg_temp.g4_core_untouched('undeclared'),
  'control: a real activation moves the review, subject, outbox and audit witnesses, so the "attempts no write" assertions above are able to fail [P2-S12-AC-223]');

-- ------------------------------------------------------------ the control: the provider returns, activation passes --
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 3, 'role', 'built', 'shard02.role_facet_assertion', 2;
select set_config('app.cms_rpc', '', true);
select pg_temp.g4_tx('tctl', jsonb_build_array('role'));
select ok((select review.state = 'approved' from platform_private.cms_governed_reviews review where id = pg_temp.s12ga_review('tctl')),
  'control: with a newer built role row (version 3) a vocabulary declaring role is submitted and approved again [P2-S12-AC-210]');
select pg_temp.s12gb_act('d-control', 'owner', pg_temp.s12ga_review('tctl'), 'activate');
select ok(pg_temp.s12ga_out('d-control') = 'ok' and pg_temp.s12ga_body('d-control')->>'subjectState' = 'active'
    and pg_temp.g4_events('tctl') = 1,
  'control: once a built provider row is current again the same command activates a role-declaring vocabulary: the refusals above were caused by the registry state, nothing else [P2-S12-AC-223]');

-- ---------------------------------------------- "EVERY declared canonical domain": two declared domains, role and instrument --
-- role is built (version 3); the owning shard of instrument registers a provider (version 2, built).  Four vocabularies declare BOTH
-- domains and are approved while both are built: tm2 is activated and tm4 scheduled as controls, then instrument (the SECOND declared
-- domain) loses its provider (version 3, unbuilt) and tm1 (activate) and tm3 (schedule) are refused naming instrument although role,
-- the first declared domain, is still built.  A check of only the first declared domain, or of role alone, would let them through.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 2, 'instrument', 'built', 'shard-x.instrument', 1;
select set_config('app.cms_rpc', '', true);
select pg_temp.g4_tx('tm1', jsonb_build_array('role', 'instrument'));
select pg_temp.g4_tx('tm2', jsonb_build_array('role', 'instrument'));
select pg_temp.g4_tx('tm3', jsonb_build_array('role', 'instrument'));
select pg_temp.g4_tx('tm4', jsonb_build_array('role', 'instrument'));
select ok((select count(*) = 4 and bool_and(review.state = 'approved') from platform_private.cms_governed_reviews review
    where review.id in (select pg_temp.s12ga_review(t) from unnest(array['tm1', 'tm2', 'tm3', 'tm4']) t))
  and (select count(*) = 8 from platform_private.cms_governed_review_dependencies dependency
        where dependency.kind = 'canonical_domain'
          and dependency.review_id in (select pg_temp.s12ga_review(t) from unnest(array['tm1', 'tm2', 'tm3', 'tm4']) t)),
  'fixture: four approved vocabularies declaring role and instrument, each freezing two canonical_domain dependencies [P2-S12-AC-210]');
select pg_temp.g4_wmark('both-built');
select pg_temp.s12gb_act('m-activate-ok', 'owner', pg_temp.s12ga_review('tm2'), 'activate');
select pg_temp.s12gb_act('m-schedule-ok', 'owner', pg_temp.s12ga_review('tm4'), 'schedule');
select ok(pg_temp.s12ga_out('m-activate-ok') = 'ok' and pg_temp.s12ga_body('m-activate-ok')->>'subjectState' = 'active'
    and pg_temp.s12ga_out('m-schedule-ok') = 'ok' and pg_temp.s12ga_body('m-schedule-ok')->>'subjectState' = 'scheduled'
    and (select state = 'active' from platform_private.cms_taxonomy_versions where id = pg_temp.s12ga_subject('tm2'))
    and (select count(*) = 1 from platform_private.cms_governed_activation_schedules where review_id = pg_temp.s12ga_review('tm4') and state = 'pending'),
  'with both declared domains built a vocabulary declaring both activates and another is scheduled (a pending schedule row) [P2-S12-AC-210]');
select ok(pg_temp.g4_advanced('both-built', 'schedule') and pg_temp.g4_advanced('both-built', 'review') and pg_temp.g4_advanced('both-built', 'outbox'),
  'control: the schedule witness moves for a real schedule, the review and outbox witnesses for a real activation [P2-S12-AC-210]');
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_canonical_domain_registry(owner_id, version, domain, provider_state, provider_key, provider_version)
select '0d6a0d6a-0000-4000-8000-000000000135'::uuid, 3, 'instrument', 'unbuilt', null, null;
select set_config('app.cms_rpc', '', true);
select pg_temp.g4_wmark('one-unbuilt');
select pg_temp.s12gb_act('m-activate', 'owner', pg_temp.s12ga_review('tm1'), 'activate');
select is(pg_temp.s12gb_oc('m-activate'), 'P0001:canonical_source_unavailable#{"domain": "instrument"}',
  'activating a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]');
select pg_temp.s12gb_act('m-schedule', 'owner', pg_temp.s12ga_review('tm3'), 'schedule');
select is(pg_temp.s12gb_oc('m-schedule'), 'P0001:canonical_source_unavailable#{"domain": "instrument"}',
  'scheduling a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]');
select ok(pg_temp.g4_core_untouched('one-unbuilt'),
  'neither refusal attempts a write to the review, subject, schedule, event or audit stores [P2-S12-AC-210]');

select * from finish();
rollback;
