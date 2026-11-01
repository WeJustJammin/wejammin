-- Slice 11 lane last-gaps: the delivery of the CMS-03B-18 review event (BE03b operation coverage,
-- CMS-03B-18: "assignment event retries idempotently"; BE03b "Event schemas": consumers are
-- at-least-once and deduplicated by event identity; BE00 "Event and Consumer Contracts": the
-- dispatcher leases an undispatched outbox row, sends it and finalizes `dispatched_at` once, a duplicate
-- send stays correct; tracker P2-S11-AC-071).  The pgTAP file phase_02_slice_11_rpc_review_assign.sql
-- proves that an exact replay of the COMMAND adds no second event; this file proves what the event
-- itself guarantees a consumer: one stable identity per accepted change, untouched by a client retry
-- that carries fresh transport identifiers, and unchanged by a redelivery, which moves only the
-- dispatch columns of its one outbox row and completes it once.
--
-- THE SEAM.  Slice 11 registers no consumer of cms.entry.review-changed.v1 (the task and notification
-- consumers are a later shard), so claim_outbox_batch does not select this family
-- (phase_02_slice_11_recheck_relay.sql pins its allowlist) and assertion 4 pins that.  The delivery
-- attempts below therefore place the lease exactly as that function's UPDATE does (token, expiry and the
-- attempt counter + 1) and then run the production completion function and the production outbox guard
-- on the event the command really committed.  When a consumer is registered, assertion 4 fails and this
-- file is the place to extend with the real claim.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(18);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/010-assign.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table e11_note(label text primary key, value text not null) on commit drop;
-- One correlation id per command, so each committed event is found by the id its command carried.
create temp table e11_corr(label text primary key, id uuid not null default extensions.gen_random_uuid()) on commit drop;
insert into e11_corr(label) values ('create'), ('revoke'), ('retry-1'), ('retry-2');

select pg_temp.h11r_review('r1');

-- The review-changed events of r1, by the correlation id of the command that committed them.
create or replace function pg_temp.e11_where(p_label text) returns text language sql stable as $body$
  select format('event_type = %L and aggregate_id = %L and correlation_id = %L',
    'cms.entry.review-changed.v1', pg_temp.s11_id('r1'), (select id from e11_corr where label = p_label)) $body$;
create or replace function pg_temp.e11_id(p_label text) returns uuid language plpgsql stable as $body$
declare found uuid;
begin
  execute 'select id from platform_private.outbox_events where ' || pg_temp.e11_where(p_label) into found;
  return found;
end;
$body$;
-- The whole committed row (dispatch columns included) and its identity (everything a consumer receives).
create or replace function pg_temp.e11_row(p_label text) returns text language plpgsql stable as $body$
declare digest text;
begin
  execute 'select md5(to_jsonb(e)::text) from platform_private.outbox_events e where ' || pg_temp.e11_where(p_label) into digest;
  return digest;
end;
$body$;
create or replace function pg_temp.e11_identity(p_label text) returns text language plpgsql stable as $body$
declare digest text;
begin
  execute 'select md5(jsonb_build_array(e.id, e.event_type, e.schema_version, e.aggregate_type, e.aggregate_id, '
    || 'e.aggregate_version, e.correlation_id, e.causation_id, e.payload, e.occurred_at)::text) '
    || 'from platform_private.outbox_events e where ' || pg_temp.e11_where(p_label) into digest;
  return digest;
end;
$body$;
create or replace function pg_temp.e11_dispatch(p_label text) returns text language plpgsql stable as $body$
declare state text;
begin
  execute 'select concat_ws(''/'', e.dispatch_attempt_count, (e.dispatch_lease_token is not null)::text, (e.dispatched_at is not null)::text) '
    || 'from platform_private.outbox_events e where ' || pg_temp.e11_where(p_label) into state;
  return state;
end;
$body$;
-- The canonical rows an event delivery must never touch: every row of the review, assignment, decision,
-- dependency, idempotency and audit tables, order-independent.
create or replace function pg_temp.e11_canonical() returns text language sql stable security definer set search_path = '' as $body$
  select md5(concat_ws('|',
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from platform_private.cms_editorial_reviews x),
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from platform_private.cms_editorial_review_assignments x),
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from platform_private.cms_editorial_decisions x),
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from platform_private.cms_editorial_review_dependencies x),
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from platform_private.idempotency_records x where x.operation like 'CMS-03B-%'),
    (select coalesce(string_agg(md5(to_jsonb(x)::text), ',' order by md5(to_jsonb(x)::text)), '') from audit_private.audit_events x where x.action like 'cms.editorial.review.%')))
$body$;
-- A request with the SAME key and body but the transport identifiers of a new attempt: a fresh context
-- (step-up instant and correlation id), which the idempotency binding ignores.
create or replace function pg_temp.e11_retry(p_label text, p_correlation text) returns jsonb language sql stable as $body$
  select jsonb_set(request, '{context}',
    jsonb_set(pg_temp.r11_ctx(), '{correlationId}', to_jsonb((select id from e11_corr where label = p_correlation))))
  from r11_req where label = p_label $body$;

-- ---------------------------------------------------------------------------
-- Two accepted changes: a create and a revoke, each carrying its own correlation id.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('c1',
  jsonb_set(pg_temp.r11_areq('r1', 'create'), '{context,correlationId}', to_jsonb((select id from e11_corr where label = 'create'))));
select pg_temp.r11_acall('c1', 'owner', (select request from r11_req where label = 'c1'));
insert into r11_req(label, request) values ('v1',
  jsonb_set(pg_temp.r11_areq('r1', 'revoke', jsonb_build_object('assignmentId', pg_temp.r11_resp('c1')->>'id')),
    '{context,correlationId}', to_jsonb((select id from e11_corr where label = 'revoke'))));
select pg_temp.r11_acall('v1', 'owner', (select request from r11_req where label = 'v1'));

select ok(
  pg_temp.r11_out('c1') = '00000:' and pg_temp.r11_out('v1') = '00000:'
    and (select count(*) = 2 and count(distinct e.id) = 2
              and bool_and(e.aggregate_type = 'cms_editorial_review' and e.aggregate_version = 1 and e.schema_version = 1)
              and bool_and(e.payload = jsonb_build_object('reviewId', pg_temp.s11_id('r1'), 'revisionId', pg_temp.s11_id('revA1')))
           from platform_private.outbox_events e
          where e.event_type = 'cms.entry.review-changed.v1' and e.aggregate_id = pg_temp.s11_id('r1'))
    and pg_temp.e11_id('create') is not null and pg_temp.e11_id('revoke') is not null
    and pg_temp.e11_id('create') <> pg_temp.e11_id('revoke'),
  'each accepted assignment change commits exactly one identifier-only review-changed event with an identity of its own, though both are aggregated on the unchanged review version [P2-S11-AC-071]');

insert into e11_note(label, value) values
  ('identity-create', pg_temp.e11_identity('create')), ('identity-revoke', pg_temp.e11_identity('revoke')),
  ('row-create', pg_temp.e11_row('create')), ('row-revoke', pg_temp.e11_row('revoke')),
  ('canonical', pg_temp.e11_canonical());

-- ---------------------------------------------------------------------------
-- A client retry of the lost create response, with fresh transport identifiers.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('c1-retry-1', 'owner', pg_temp.e11_retry('c1', 'retry-1'));
select ok(
  pg_temp.r11_out('c1-retry-1') = '00000:' and pg_temp.r11_resp('c1-retry-1') = pg_temp.r11_resp('c1'),
  'a retry of the create with the same key, a fresh correlation id and a fresh step-up instant returns the stored response, though the assignment was revoked since [P2-S11-AC-071]');
select ok(
  (select count(*) = 2 from platform_private.outbox_events
    where event_type = 'cms.entry.review-changed.v1' and aggregate_id = pg_temp.s11_id('r1'))
    and not exists (select 1 from platform_private.outbox_events
                     where correlation_id = (select id from e11_corr where label = 'retry-1'))
    and pg_temp.e11_row('create') = (select value from e11_note where label = 'row-create')
    and pg_temp.e11_row('revoke') = (select value from e11_note where label = 'row-revoke')
    and pg_temp.e11_canonical() = (select value from e11_note where label = 'canonical'),
  'the retry committed no second event and left both committed events, and every review, assignment, idempotency and audit row, byte-identical: the event keeps the correlation id of the attempt that committed it [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- The relay and the seam.
-- ---------------------------------------------------------------------------
create temp table e11_claim on commit drop as
  select * from platform_api.claim_outbox_batch('e1100000-0000-4000-8000-0000000000a1', 60, 100);
select ok(
  not exists (select 1 from e11_claim where event_type = 'cms.entry.review-changed.v1')
    and pg_temp.e11_dispatch('create') = '0/false/false' and pg_temp.e11_dispatch('revoke') = '0/false/false',
  'the relay claims neither review-changed event while no consumer is registered for the family: both stay unleased at attempt 0 [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- Delivery attempt 1 of the create event: the lease is placed as the claim places it, the sender
-- does not finish before the lease ends.
-- ---------------------------------------------------------------------------
update platform_private.outbox_events
   set dispatch_lease_token = 'e1100000-0000-4000-8000-0000000000b1',
       dispatch_lease_until = clock_timestamp() + interval '60 seconds',
       dispatch_attempt_count = dispatch_attempt_count + 1
 where id = pg_temp.e11_id('create');
update platform_private.outbox_events
   set dispatch_lease_until = clock_timestamp() - interval '1 second'
 where id = pg_temp.e11_id('create');
select ok(
  not platform_api.complete_outbox_event(pg_temp.e11_id('create'), 'e1100000-0000-4000-8000-0000000000b1')
    and pg_temp.e11_dispatch('create') = '1/true/false',
  'a delivery whose lease ended before it completed cannot finalize the event: the late completion is refused and the event stays undispatched [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- Delivery attempt 2 (the redelivery): a new lease on the same row.
-- ---------------------------------------------------------------------------
update platform_private.outbox_events
   set dispatch_lease_token = 'e1100000-0000-4000-8000-0000000000b2',
       dispatch_lease_until = clock_timestamp() + interval '60 seconds',
       dispatch_attempt_count = dispatch_attempt_count + 1
 where id = pg_temp.e11_id('create');
select ok(
  pg_temp.e11_identity('create') = (select value from e11_note where label = 'identity-create')
    and pg_temp.e11_dispatch('create') = '2/true/false',
  'the redelivery carries the identical event - id, type, schema version, aggregate, aggregate version, correlation, causation, payload and occurrence instant - and moves only the attempt counter [P2-S11-AC-071]');

-- Each completion is its own statement: the order of the calls is the evidence, and SQL does not
-- evaluate the operands of one AND in a promised order.  Step 1 is the first sender, whose lease was
-- superseded and is still unexpired in the sense that matters: the redelivery's lease is live.
create temp table e11_completion(step integer primary key, accepted boolean not null) on commit drop;
insert into e11_completion select 1, platform_api.complete_outbox_event(pg_temp.e11_id('create'), 'e1100000-0000-4000-8000-0000000000b1');
insert into e11_completion select 2, platform_api.complete_outbox_event(pg_temp.e11_id('create'), 'e1100000-0000-4000-8000-0000000000b2');
insert into e11_completion select 3, platform_api.complete_outbox_event(pg_temp.e11_id('create'), 'e1100000-0000-4000-8000-0000000000b2');
insert into e11_completion select 4, platform_api.complete_outbox_event(pg_temp.e11_id('create'), 'e1100000-0000-4000-8000-0000000000b1');
select is(
  (select string_agg(accepted::text, ',' order by step) from e11_completion) || ' ' || pg_temp.e11_dispatch('create'),
  'false,true,false,false 2/false/true',
  'the redelivery finalizes the event once: the earlier sender cannot complete it while the redelivery holds the lease, and after the redelivery completes it a second completion with either lease is refused [P2-S11-AC-071]');
insert into e11_note(label, value) values
  ('dispatched-at', (select dispatched_at::text from platform_private.outbox_events where id = pg_temp.e11_id('create')));

select ok(
  pg_temp.e11_identity('create') = (select value from e11_note where label = 'identity-create')
    and pg_temp.e11_dispatch('revoke') = '0/false/false'
    and pg_temp.e11_identity('revoke') = (select value from e11_note where label = 'identity-revoke')
    and pg_temp.e11_canonical() = (select value from e11_note where label = 'canonical'),
  'across the whole delivery the identity of both events and every canonical row are untouched, and the other event of the review was not dispatched with it [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- A delivered event is immutable.
-- ---------------------------------------------------------------------------
select throws_ok(
  format('update platform_private.outbox_events set dispatched_at = null where id = %L', pg_temp.e11_id('create')),
  'P0001', 'dispatched outbox events cannot be reopened',
  'a delivered review-changed event cannot be reopened for another dispatch [P2-S11-AC-071]');
select throws_ok(
  format('update platform_private.outbox_events set payload = %L::jsonb where id = %L', '{}', pg_temp.e11_id('create')),
  'P0001', 'outbox identity and payload are immutable',
  'a delivered review-changed event cannot have its payload rewritten by a consumer [P2-S11-AC-071]');
select throws_ok(
  format('update platform_private.outbox_events set aggregate_version = 2 where id = %L', pg_temp.e11_id('create')),
  'P0001', 'outbox identity and payload are immutable',
  'a delivered review-changed event cannot have its aggregate version rewritten, so a consumer deduplicating by identity and ordering by version sees one fixed pair [P2-S11-AC-071]');

-- ---------------------------------------------------------------------------
-- A client retry AFTER the event was delivered.
-- ---------------------------------------------------------------------------
select pg_temp.r11_acall('c1-retry-2', 'owner', pg_temp.e11_retry('c1', 'retry-2'));
select ok(
  pg_temp.r11_out('c1-retry-2') = '00000:' and pg_temp.r11_resp('c1-retry-2') = pg_temp.r11_resp('c1')
    and (select count(*) = 2 from platform_private.outbox_events
          where event_type = 'cms.entry.review-changed.v1' and aggregate_id = pg_temp.s11_id('r1'))
    and not exists (select 1 from platform_private.outbox_events
                     where correlation_id = (select id from e11_corr where label = 'retry-2'))
    and (select dispatched_at::text from platform_private.outbox_events where id = pg_temp.e11_id('create'))
          = (select value from e11_note where label = 'dispatched-at')
    and pg_temp.e11_dispatch('create') = '2/false/true'
    and pg_temp.e11_canonical() = (select value from e11_note where label = 'canonical'),
  'a retry of the command after its event was delivered answers the stored response, emits no event and leaves the delivered event and every canonical row as they were [P2-S11-AC-071]');

select * from finish();
rollback;
