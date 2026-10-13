-- Slice 11 lane S11-3a regression (CMS-03B-05, BE03b E1/E7, DEC-159 (3); tracker P2-S11-AC-005,
-- AC-007, AC-008, AC-009, AC-101): the idempotency identity of cms_submit_review is the BROWSER
-- request, never the server-built accessibility evidence.  The Worker rebuilds PreflightEvidence on
-- every retry (a fresh evaluatedAt, and a fresh inputHash whenever the checker input changed), so
-- binding the reservation to the evidence made a genuine same-key retry a spurious 409
-- IDEMPOTENCY_MISMATCH and dropped the frozen review response the client needed.  cms_schedule_publication
-- (CMS-03B-07) and cms_publish_revision (CMS-03B-09) already reserve with `p_request - 'evidence'`;
-- this file pins the same identity for submit and proves the browser payload and the actor /
-- acting-party boundary are unchanged.  RED before 20261005017640.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(22);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_s11fx(label text primary key, digest text not null) on commit drop;

-- A COMPLETE relevant-effects digest local to this file: for each of the nine tables a
-- { count, sha256 } pair, where sha256 is over the rows' canonical full-row text
-- (to_jsonb(row)::text, concatenated in that text's sort order).  Every column is covered -- a
-- same-count row change, or a same-length rewrite of a bytea / jsonb member such as request_hash or
-- response_ref, changes the fingerprint.  The inherited r11_effects() filters audit/outbox/idempotency
-- by name and omits the settings snapshots and the accessibility summaries, so a differently named
-- side effect could hide from it.  The hash is computed internally; raw row data is never printed.
create or replace function pg_temp.r11_s11_fp(p_mutate boolean)
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_catalog.jsonb_build_array(
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_editorial_reviews t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_editorial_review_dependencies t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_editorial_decisions t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_editorial_review_assignments t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_command_accessibility_evidence t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.cms_publication_settings_snapshots t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(
          case when p_mutate then pg_catalog.jsonb_set(pg_catalog.to_jsonb(t), '{request_hash}',
                 pg_catalog.to_jsonb(pg_catalog.decode(pg_catalog.repeat('ab', 32), 'hex')))::text
               else pg_catalog.to_jsonb(t)::text end,
          E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.idempotency_records t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from audit_private.audit_events t),
    (select pg_catalog.jsonb_build_object('count', pg_catalog.count(*), 'sha256',
        extensions.digest(pg_catalog.string_agg(pg_catalog.to_jsonb(t)::text, E'\n' order by pg_catalog.to_jsonb(t)::text), 'sha256')::text)
       from platform_private.outbox_events t)
  )::text
$body$;

create or replace function pg_temp.r11_s11_digest()
returns text
language sql
stable
security definer
set search_path = ''
as $body$
  select pg_temp.r11_s11_fp(false)
$body$;

select pg_temp.r11_entry('er-1');

-- ---------------------------------------------------------------------------
-- The browser request commits once; the Worker then rebuilds its evidence.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('er-1', pg_temp.r11_sreq('er-1'));
insert into r11_s11fx(label, digest) values ('er-before', pg_temp.r11_s11_digest());
select pg_temp.r11_scall('er-submit', 'owner', (select request from r11_req where label = 'er-1'));
select is(pg_temp.r11_out('er-submit'), '00000:',
  'control: the assignee browser request with freshly built healthy evidence freezes the draft for review [P2-S11-AC-005]');
insert into r11_s11fx(label, digest) values ('er-after', pg_temp.r11_s11_digest());

-- The same browser body under the same key, with evidence the Worker just rebuilt: a distinct
-- evaluatedAt and a distinct (still valid) inputHash, exactly what a lost-response retry carries.
insert into r11_req(label, request) values ('er-replay',
  jsonb_set((select request from r11_req where label = 'er-1'), '{evidence}',
    pg_temp.r11_evidence(pg_temp.h11w_uuid('er-1:revision'), 'healthy', interval '2 seconds',
      jsonb_build_object('inputHash', repeat('b', 64)))));
select ok(
  (select request->'evidence' from r11_req where label = 'er-replay')
    is distinct from (select request->'evidence' from r11_req where label = 'er-1')
    and (select request->'evidence'->>'inputHash' from r11_req where label = 'er-replay')
      <> (select request->'evidence'->>'inputHash' from r11_req where label = 'er-1')
    and (select request->'evidence'->>'evaluatedAt' from r11_req where label = 'er-replay')
      <> (select request->'evidence'->>'evaluatedAt' from r11_req where label = 'er-1'),
  'control: the retry is the same browser body under the same key but carries evidence the Worker rebuilt (a distinct inputHash and evaluatedAt)');

select set_config('response.headers', '', true);
select pg_temp.r11_scall('er-replay-call', 'owner', (select request from r11_req where label = 'er-replay'));
select is(pg_temp.r11_out('er-replay-call'), '00000:',
  'a same-key retry whose only change is the freshly rebuilt Worker evidence replays the stored response instead of a spurious 409 IDEMPOTENCY_MISMATCH [P2-S11-AC-008]');
select is(pg_temp.r11_resp('er-replay-call'), pg_temp.r11_resp('er-submit'),
  'the replayed response is byte-for-byte the stored review resource [P2-S11-AC-008]');
select is(current_setting('response.headers', true), '[{"x-cms-idempotent-replay": "true"}]',
  'the evidence-only retry marks x-cms-idempotent-replay like any exact replay [P2-S11-AC-008]');
select is(pg_temp.r11_s11_digest(), (select digest from r11_s11fx where label = 'er-after'),
  'the evidence-only retry left every relevant row byte-identical: the nine-table {count, full-row sha256} digest is unchanged, so no review, dependency, decision, assignment, settings snapshot, idempotency reservation (including its request_hash bytes and response_ref), audit record or outbox event of any name was added or rewritten [P2-S11-AC-008]');
select is((select count(*)::integer from platform_private.cms_command_accessibility_evidence), 1,
  'the evidence-only retry wrote no second accessibility audit summary row [P2-S11-AC-101]');

-- ---------------------------------------------------------------------------
-- A changed browser business member is still the idempotency mismatch.
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('er-mismatch', 'owner',
  jsonb_set((select request from r11_req where label = 'er-1'), '{frozenHash}', to_jsonb(repeat('1', 64))));
select is(pg_temp.r11_out('er-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH',
  'the same key with a changed browser business member (frozenHash) is still IDEMPOTENCY_MISMATCH [P2-S11-AC-008]');
select isnt(pg_temp.r11_s11_fp(true), (select digest from r11_s11fx where label = 'er-after'),
  'comparator control (guard-free, in-memory): the same nine-table fingerprint over the idempotency rows with one request_hash rewritten to a same-length value differs from the captured digest, so a same-count, same-length hash mutation is detected rather than hidden [P2-S11-AC-008]');

-- ---------------------------------------------------------------------------
-- The actor and the acting party stay bound: neither is silently replayed.
-- ---------------------------------------------------------------------------
select pg_temp.r11_scall('er-actor', 'editor', (select request from r11_req where label = 'er-1'));
select is(pg_temp.r11_out('er-actor'), 'P0001:revision_not_submittable',
  'another assignee reusing the key and the body does not receive the stored response: the reservation is per actor, so the live review is re-proved [P2-S11-AC-007]');
select pg_temp.r11_scall('er-party', 'owner',
  jsonb_set((select request from r11_req where label = 'er-1'), '{context}',
    pg_temp.r11_ctx(interval '60 seconds', true, pg_temp.s11_id('creator'))));
select is(pg_temp.r11_out('er-party'), 'P0001:NOT_FOUND',
  'the same actor and key under another acting party is NOT_FOUND: the acting-party boundary is re-proved before the reservation, so no response is replayed across parties [P2-S11-AC-007]');
select is(pg_temp.r11_s11_digest(), (select digest from r11_s11fx where label = 'er-after'),
  'the changed-body, changed-actor and changed-acting-party retries left every relevant row byte-identical: the nine-table {count, full-row sha256} digest is unchanged [P2-S11-AC-009]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 'er-1')), 'completed',
  'the one reservation for the browser key stays completed with the frozen review [P2-S11-AC-008]');

select * from finish();
rollback;
