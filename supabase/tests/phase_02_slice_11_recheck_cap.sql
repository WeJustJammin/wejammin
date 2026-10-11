-- Slice 11 dependency recheck, the 500-review bound and the continuation cursor (BE03b
-- "Review invalidation / Dependency recheck"; tracker P2-S11-AC-113): "handles at most 500
-- reviews per run with a continuation cursor".  RED before 20261010164100, GREEN after.
--
-- 501 live reviews freeze the same schema version.  The first run handles exactly 500 and
-- hands back the id of the 500th as its cursor; a run that continues after it finishes the
-- 501st; a run that starts so that exactly 500 remain ends with no cursor.  Then the schema
-- version is superseded and the same walk invalidates all 501, one event each.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(25);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc

create temp table cap_timing(label text, milliseconds numeric) on commit drop;
create or replace function pg_temp.cap_run(p_cursor uuid default null, p_api boolean default false)
returns jsonb
language plpgsql
as $body$
declare
  request jsonb := jsonb_build_object(
    'eventId', 'a1130000-0000-4000-8000-0000000000ee', 'kind', 'schema',
    'refId', pg_temp.h11w_version(), 'cursor', p_cursor);
  started timestamptz := clock_timestamp();
  result jsonb;
begin
  if p_api then
    result := platform_api.cms_dependency_recheck_run(request);
  else
    result := platform_private.cms_dependency_recheck_run(request);
  end if;
  insert into cap_timing values (
    result::text, extract(epoch from clock_timestamp() - started) * 1000);
  return result;
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

-- 501 revisions of the world type (one entry each) and one review each.  The manifest names no
-- revision, so the 501 frozen manifests are the same document and the same index rows.
select pg_temp.h11w_revision('cap' || n) from generate_series(1, 501) n;
select set_config('app.cms_rpc', 'true', true);
create temp table cap_manifest on commit drop as
select platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('cap1:revision')) as manifest;
create temp table cap_stamp on commit drop as select clock_timestamp() as at;

insert into platform_private.cms_editorial_reviews
select (jsonb_populate_record(null::platform_private.cms_editorial_reviews, pg_temp.s11_review_row(jsonb_build_object(
    'id', pg_temp.h11w_uuid('cap' || n || ':review'), 'owner_id', pg_temp.h11w_org(),
    'revision_id', pg_temp.h11w_uuid('cap' || n || ':revision'),
    'entry_id', pg_temp.h11w_uuid('cap' || n || ':entry'),
    'frozen_hash', (select payload_hash::text from platform_private.cms_entry_revisions
                     where id = pg_temp.h11w_uuid('cap' || n || ':revision')),
    'dependency_manifest', (select manifest from cap_manifest),
    'dependency_hash', platform_private.cms_jcs_sha256((select manifest from cap_manifest)),
    'activation_evidence', (select manifest->'schema'->'activationEvidence' from cap_manifest),
    'submitted_by', pg_temp.h11w_person('creatorPerson'),
    'submitted_at', (select at from cap_stamp), 'created_at', (select at from cap_stamp),
    'updated_at', (select at from cap_stamp))))).*
  from generate_series(1, 501) n;

insert into platform_private.cms_editorial_review_dependencies(
  owner_id, state, version, review_id, kind, ref_id, created_at, updated_at)
select pg_temp.h11w_org(), 'active', 1, pg_temp.h11w_uuid('cap' || n || ':review'), refs.kind, refs.ref_id,
       (select at from cap_stamp), (select at from cap_stamp)
  from generate_series(1, 501) n
 cross join platform_private.cms_review_dependency_refs(
   pg_temp.h11w_uuid('cap1:revision'), (select manifest from cap_manifest)) refs;

create temp table cap_ids on commit drop as
select array_agg(review.id order by review.id) as ids
  from platform_private.cms_editorial_reviews review
 where review.entry_id in (
   select pg_temp.h11w_uuid('cap' || n || ':entry') from generate_series(1, 501) n);
create temp table cap_baseline on commit drop as
select (select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1') as events,
       (select count(*) from audit_private.audit_events where action = 'cms.entry.review.invalidate') as audits;

select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews review
    join platform_private.cms_editorial_review_dependencies dependency on dependency.review_id = review.id
   where review.state = 'open' and dependency.kind = 'schema' and dependency.ref_id = pg_temp.h11w_version()),
  501,
  'precondition: 501 live reviews name the schema version in the dependency index [P2-S11-AC-113]');
select is((select cardinality(ids) from cap_ids), 501, 'precondition: the walk order has 501 reviews [P2-S11-AC-113]');

-- ---- every manifest still holds: examined is bounded, the cursor walks the rest ----------
select is(pg_temp.cap_run(),
  jsonb_build_object('examined', 500, 'invalidated', 0, 'nextCursor', (select ids[500] from cap_ids)),
  'a run handles at most 500 of the 501 live reviews and returns the 500th review id as its continuation cursor [P2-S11-AC-113]');
select is(pg_temp.cap_run((select ids[500] from cap_ids)),
  jsonb_build_object('examined', 1, 'invalidated', 0, 'nextCursor', null),
  'the run that continues after the cursor handles the 501st review and returns no cursor [P2-S11-AC-113]');
select is(pg_temp.cap_run((select ids[1] from cap_ids)),
  jsonb_build_object('examined', 500, 'invalidated', 0, 'nextCursor', null),
  'a run with exactly 500 reviews left handles all of them and returns no cursor [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews review
    where review.id = any((select ids from cap_ids)::uuid[]) and review.state = 'open' and review.version = 1),
  501,
  'while every manifest holds, no review changes state or version [P2-S11-AC-113]');
select is(
  (select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1')
    - (select events from cap_baseline),
  0::bigint,
  'while every manifest holds, a walk of the whole index emits no event [P2-S11-AC-113]');

-- ---- the schema version is superseded: the same walk invalidates all 501 ----------------
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format('update platform_private.cms_content_type_versions set state = ''superseded'' where id = %L::uuid', pg_temp.h11w_version()));
select is(pg_temp.cap_run(),
  jsonb_build_object('examined', 500, 'invalidated', 500, 'nextCursor', (select ids[500] from cap_ids)),
  'a run that invalidates handles at most 500 reviews too: 500 invalidated and a cursor [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews review
    where review.id = any((select ids from cap_ids)::uuid[]) and review.state = 'invalidated'
      and review.invalidated_reason = 'dependency_changed' and review.version = 2),
  500,
  'exactly 500 reviews are invalidated dependency_changed at the next CAS version [P2-S11-AC-113]');
select is(
  (select review.state from platform_private.cms_editorial_reviews review where review.id = (select ids[501] from cap_ids)),
  'open',
  'the 501st review is still live after the first run [P2-S11-AC-113]');
select is(pg_temp.cap_run((select ids[500] from cap_ids), true),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'the continuation, called through the platform_api wrapper, invalidates the 501st review and returns no cursor [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.cms_editorial_reviews review
    where review.id = any((select ids from cap_ids)::uuid[]) and review.state = 'invalidated'
      and review.invalidated_reason = 'dependency_changed' and review.version = 2),
  501,
  'all 501 reviews are invalidated dependency_changed [P2-S11-AC-113]');
select is(
  (select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1')
    - (select events from cap_baseline),
  501::bigint,
  'one cms.entry.review-changed.v1 per invalidated review [P2-S11-AC-113]');
select is(
  (select count(distinct target_id) from audit_private.audit_events where action = 'cms.entry.review.invalidate')
    - (select audits from cap_baseline),
  501::bigint,
  'one audit record per invalidated review [P2-S11-AC-113]');
select is(pg_temp.cap_run(),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'idempotent: a repeated run finds no live review [P2-S11-AC-113]');
select is(
  (select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1')
    - (select events from cap_baseline),
  501::bigint,
  'idempotent: the repeated run emitted nothing [P2-S11-AC-113]');
select is(pg_temp.cap_run((select ids[250] from cap_ids)),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'idempotent: a run from a cursor in the middle finds none either [P2-S11-AC-113]');

-- Diagnostic only (no assertion): how long a full 500-review run takes here.
select diag(format('run %s took %s ms', label, round(milliseconds))) from cap_timing;

select * from finish();
rollback;
