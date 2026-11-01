-- Slice 11 dependency recheck, one run of the job (BE03b "Review invalidation / Dependency
-- recheck"; tracker P2-S11-AC-113): platform_private.cms_dependency_recheck_run and its
-- platform_api wrapper.  RED before 20261010164100, GREEN after.
--
-- The run selects the LIVE reviews (open|approved) that the dependency index names under
-- (kind, ref), rebuilds each frozen manifest and invalidates `dependency_changed` on
-- inequality or a non-current identity; it is idempotent and never touches a review that
-- still holds.  Every review below is built from a real revision of the h11 world with the
-- manifest cms_build_dependency_manifest produces and the dependency rows
-- cms_review_dependency_refs derives from it (what cms_submit_review writes).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(52);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc
\ir phase_02_slice_11_pattern_forest.sqlinc

-- A taxonomy version and three terms (as the manifest suite seeds them).
insert into platform_private.cms_taxonomy_versions(
  id, owner_id, version, taxonomy_key, owner_capability, shape,
  allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
) values (pg_temp.h11w_uuid('tax1'), pg_temp.h11w_org(), 1, 'h11-genres', 'cms.taxonomy_curator',
  'flat', '[]'::jsonb, '[]'::jsonb, repeat('a', 64), (select value::uuid from s10_ids where key = 'creatorAuth'));
-- taxonomy_id (BE03c 1371/1428; 20261014120000): h11_raw_exec disables the lineage-fill trigger, so the row names its lineage
-- (the version-1 row's id) itself.
select pg_temp.h11_raw_insert('platform_private.cms_terms', jsonb_build_object(
  'id', t.id, 'owner_id', pg_temp.h11w_org(), 'lifecycle', 'active', 'version', t.version,
  'taxonomy_id', pg_temp.h11w_uuid('tax1'), 'taxonomy_version_id', pg_temp.h11w_uuid('tax1'), 'term_key', t.term_key, 'aliases', '[]'::jsonb,
  'created_by', (select value::uuid from s10_ids where key = 'creatorAuth'),
  'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'))
from (values
  ('a9200000-0000-4000-8000-0000000e0001'::uuid, 1, 'jazz'),
  ('a9200000-0000-4000-8000-0000000e0002'::uuid, 3, 'rock')
) t(id, version, term_key);

create or replace function pg_temp.rc_assign(
  p_tag text, p_revision uuid, p_term uuid
)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_term_assignments(
    id, owner_id, state, version, revision_id, field_definition_id,
    term_id, taxonomy_version_id, position, provenance, created_by
  ) values (
    pg_temp.h11w_uuid(p_tag), pg_temp.h11w_org(), 'active', 1, p_revision, pg_temp.h11w_fdef('tags'),
    p_term, pg_temp.h11w_uuid('tax1'), 0, 'authored',
    (select value::uuid from s10_ids where key = 'creatorAuth'));
end;
$body$;

-- One run of the job, as the platform_private function; an error is reported as a value.
create or replace function pg_temp.rc_run(
  p_kind text, p_ref uuid, p_cursor uuid default null,
  p_event uuid default 'a1130000-0000-4000-8000-0000000000ee'
)
returns jsonb
language plpgsql
as $body$
begin
  return platform_private.cms_dependency_recheck_run(jsonb_build_object(
    'eventId', p_event, 'kind', p_kind, 'refId', p_ref, 'cursor', p_cursor));
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

-- A review of revision <tag> with the real frozen manifest and its dependency index rows.
create or replace function pg_temp.rc_review(p_tag text)
returns void
language plpgsql
as $body$
declare
  revision uuid := pg_temp.h11w_uuid(p_tag || ':revision');
  entry uuid := pg_temp.h11w_uuid(p_tag || ':entry');
  manifest jsonb;
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  manifest := platform_private.cms_build_dependency_manifest(revision);
  perform pg_temp.h11r_review('rc-' || p_tag, jsonb_build_object(
    'owner_id', pg_temp.h11w_org(), 'revision_id', revision, 'entry_id', entry,
    'frozen_hash', (select payload_hash::text from platform_private.cms_entry_revisions where id = revision),
    'dependency_manifest', manifest, 'dependency_hash', platform_private.cms_jcs_sha256(manifest),
    'activation_evidence', manifest->'schema'->'activationEvidence',
    'submitted_by', pg_temp.h11w_person('creatorPerson'),
    'submitted_at', stamp, 'created_at', stamp, 'updated_at', stamp));
  insert into platform_private.cms_editorial_review_dependencies(
    owner_id, state, version, review_id, kind, ref_id, created_at, updated_at)
  select pg_temp.h11w_org(), 'active', 1, pg_temp.s11_id('rc-' || p_tag), refs.kind, refs.ref_id, stamp, stamp
    from platform_private.cms_review_dependency_refs(revision, manifest) refs;
end;
$body$;

create or replace function pg_temp.rc_state(p_tag text)
returns text
language sql
as $body$
  select state || '/' || coalesce(invalidated_reason, '-') || '/v' || version::text
    from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rc-' || p_tag)
$body$;

create or replace function pg_temp.rc_events()
returns bigint
language sql
as $body$
  select count(*) from platform_private.outbox_events where event_type = 'cms.entry.review-changed.v1'
$body$;

create or replace function pg_temp.rc_manifest(p_tag text)
returns jsonb
language sql
as $body$
  select dependency_manifest from platform_private.cms_editorial_reviews where id = pg_temp.s11_id('rc-' || p_tag)
$body$;

select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
select pg_temp.h11r_member('reviewer02', array['cms.reviewer']);

-- r1 open, r2 approved, r3 rejected, r4 invalidated: plain revisions of the world type.
-- r5/r6 compose one block each, r7 holds a term, r8 composes a block and a pattern.
select pg_temp.h11w_revision(t) from unnest(array['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) t;
select pg_temp.h11m_instance('r5:i1', pg_temp.h11w_uuid('r5:revision'), '/a', 'h11.second');
select pg_temp.h11m_instance('r6:i1', pg_temp.h11w_uuid('r6:revision'), '/a', 'h11.third');
select pg_temp.rc_assign('r7:a1', pg_temp.h11w_uuid('r7:revision'), 'a9200000-0000-4000-8000-0000000e0001');
select pg_temp.h11x_forest('a9200000-0000-4000-8000-0000000c0001', 'h11.first', array['a']);  -- DEC-193 / BE03c 1511
select pg_temp.h11m_instance('r8:i1', pg_temp.h11w_uuid('r8:revision'), '/a', 'h11.first',
  'a9200000-0000-4000-8000-0000000c0001');
select pg_temp.rc_review(t) from unnest(array['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) t;

select pg_temp.h11r_assign('rc-r2-asg', 'rc-r2', 'reviewer01');
select pg_temp.h11r_decide('rc-r2-dec', 'rc-r2', 'reviewer01', 'rc-r2-asg', 'approve');
select pg_temp.h11r_assign('rc-r3-asg', 'rc-r3', 'reviewer02');
select pg_temp.h11r_decide('rc-r3-dec', 'rc-r3', 'reviewer02', 'rc-r3-asg', 'reject');
select platform_private.cms_invalidate_editorial_review(jsonb_build_object(
  'reviewId', pg_temp.s11_id('rc-r4'), 'reasonCode', 'revision_superseded',
  'correlationId', 'a1130000-0000-4000-8000-0000000000c9'));

create temp table rc_baseline on commit drop as
select pg_temp.rc_events() as events,
       (select count(*) from audit_private.audit_events where action = 'cms.entry.review.invalidate') as audits;

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_dependency_recheck_run(jsonb)')
    and pg_temp.h11_private_definer('cms_dependency_recheck_event_ref(uuid)')
    and pg_temp.h11_private_definer('cms_dependency_recheck_lineage(text, uuid)'),
  'the run, the event resolver and the lineage helper are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-113]');

select ok(
  (select bool_and(p.prosecdef
      and pg_get_userbyid(p.proowner) = 'wejammin_cms_definer'
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
         where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'))
     from pg_proc p
    where p.pronamespace = 'platform_api'::regnamespace
      and p.proname in ('cms_dependency_recheck_run', 'cms_dependency_recheck_resolve_event'))
    and (select count(*) = 2 from pg_proc p
          where p.pronamespace = 'platform_api'::regnamespace
            and p.proname in ('cms_dependency_recheck_run', 'cms_dependency_recheck_resolve_event')),
  'the two platform_api wrappers are SECURITY DEFINER functions of the CMS definer executable by the service role only [P2-S11-AC-113]');

select is(pg_temp.h11_rettype('cms_dependency_recheck_run(jsonb)'), 'jsonb',
  'the run answers jsonb { examined, invalidated, nextCursor } [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Request discipline.
-- ---------------------------------------------------------------------------
select is(platform_private.cms_dependency_recheck_lineage('block', 'a9200000-0000-4000-8000-0000000b0001'),
  array['a9200000-0000-4000-8000-0000000b0001']::uuid[],
  'lineage: an exact kind stands for the identity itself [P2-S11-AC-113]');

select is(pg_temp.h11_outcome($$select platform_private.cms_dependency_recheck_run('[]'::jsonb)$$),
  'P0001:INVALID_REQUEST', 'a non-object request is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.h11_outcome(format($$select platform_private.cms_dependency_recheck_run(%L::jsonb)$$,
    jsonb_build_object('eventId', 'a1130000-0000-4000-8000-0000000000ee', 'kind', 'schema',
      'refId', pg_temp.h11w_version()))),
  'P0001:INVALID_REQUEST', 'a request without the cursor member is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.rc_run('media', pg_temp.h11w_version()), jsonb_build_object('error', 'P0001:INVALID_REQUEST'),
  'a kind outside the nine is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.h11_outcome(format($$select platform_private.cms_dependency_recheck_run(%L::jsonb)$$,
    jsonb_build_object('eventId', 'x', 'kind', 'schema', 'refId', pg_temp.h11w_version(), 'cursor', null))),
  'P0001:INVALID_REQUEST', 'a malformed event id is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.h11_outcome(format($$select platform_private.cms_dependency_recheck_run(%L::jsonb)$$,
    jsonb_build_object('eventId', 'a1130000-0000-4000-8000-0000000000ee', 'kind', 'schema',
      'refId', 7, 'cursor', null))),
  'P0001:INVALID_REQUEST', 'a non-string reference is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.h11_outcome(format($$select platform_private.cms_dependency_recheck_run(%L::jsonb)$$,
    jsonb_build_object('eventId', 'a1130000-0000-4000-8000-0000000000ee', 'kind', 'schema',
      'refId', pg_temp.h11w_version(), 'cursor', 'nope'))),
  'P0001:INVALID_REQUEST', 'a malformed cursor is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.h11_outcome(format($$select platform_private.cms_dependency_recheck_run(%L::jsonb)$$,
    (jsonb_build_object('eventId', 'a1130000-0000-4000-8000-0000000000ee', 'kind', 'schema',
      'refId', pg_temp.h11w_version(), 'cursor', null) || '{"reviewId":"a1130000-0000-4000-8000-0000000000aa"}'::jsonb))),
  'P0001:INVALID_REQUEST', 'an unknown request member (a caller-named review) is INVALID_REQUEST [P2-S11-AC-113]');
select is(pg_temp.rc_events(), (select events from rc_baseline),
  'control: the refused requests emitted nothing [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Selection through the index: live reviews only, and only reviews that no longer hold.
-- ---------------------------------------------------------------------------
select is(pg_temp.rc_run('schema', pg_temp.h11w_version()),
  jsonb_build_object('examined', 6, 'invalidated', 0, 'nextCursor', null),
  'the run selects the six LIVE reviews that name the schema version and invalidates none while every manifest still holds [P2-S11-AC-113]');
select is(pg_temp.rc_state('r1') || ',' || pg_temp.rc_state('r2') || ',' || pg_temp.rc_state('r3') || ',' || pg_temp.rc_state('r4'),
  'open/-/v1,approved/-/v2,rejected/-/v2,invalidated/revision_superseded/v2',
  'a review that still holds is left untouched, and a rejected or already invalidated review is not selected [P2-S11-AC-113]');
select is(pg_temp.rc_events(), (select events from rc_baseline),
  'a run that invalidates nothing emits no event [P2-S11-AC-113]');
select is(pg_temp.rc_run('block', 'a9200000-0000-4000-8000-0000000b0099'),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'a reference no review froze selects nothing [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- A non-current identity: the block is withdrawn, the rebuilt manifest is byte-equal.
-- ---------------------------------------------------------------------------
insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version, correlation_id, payload)
values ('a1130000-0000-4000-8000-0000000000e1', 'cms.block.lifecycle.changed.v1', 1, 'cms_block_definition_version',
  'a9200000-0000-4000-8000-0000000b0002', 2, 'a1130000-0000-4000-8000-0000000000c1',
  '{"blockDefinitionVersionId":"a9200000-0000-4000-8000-0000000b0002"}'::jsonb);
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0002', 'h11.second', 'withdrawn');
select ok(
  platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('r5:revision')) = pg_temp.rc_manifest('r5')
    and platform_private.cms_manifest_identities_current(pg_temp.rc_manifest('r5')) is false,
  'precondition: the withdrawn block leaves the rebuilt manifest equal to the frozen one but the identity is not current [P2-S11-AC-113]');
select is(pg_temp.rc_run('block', 'a9200000-0000-4000-8000-0000000b0002', null, 'a1130000-0000-4000-8000-0000000000e1'),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'the withdrawn block invalidates the one review that froze it [P2-S11-AC-113]');
select is(pg_temp.rc_state('r5') || ',' || pg_temp.rc_state('r6'),
  'invalidated/dependency_changed/v2,open/-/v1',
  'the review of the withdrawn block is invalidated dependency_changed (CAS version + 1) and the review of another block is untouched [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.outbox_events
    where event_type = 'cms.entry.review-changed.v1' and aggregate_id = pg_temp.s11_id('rc-r5')
      and aggregate_version = 2 and payload = jsonb_build_object(
        'reviewId', pg_temp.s11_id('rc-r5'), 'revisionId', pg_temp.h11w_uuid('r5:revision'))
      and correlation_id = 'a1130000-0000-4000-8000-0000000000c1'),
  1,
  'the invalidation writes one cms.entry.review-changed.v1 at the new version carrying the correlation id of the source event [P2-S11-AC-113]');
select is(
  (select count(*)::integer from audit_private.audit_events
    where action = 'cms.entry.review.invalidate' and target_id = pg_temp.s11_id('rc-r5')
      and correlation_id = 'a1130000-0000-4000-8000-0000000000c1'),
  1,
  'the invalidation writes its audit record with the same correlation id [P2-S11-AC-113]');

-- Idempotent: the review that is already invalidated is skipped and nothing is emitted twice.
select is(pg_temp.rc_run('block', 'a9200000-0000-4000-8000-0000000b0002', null, 'a1130000-0000-4000-8000-0000000000e1'),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'idempotent: a repeated run skips the review that is already invalidated [P2-S11-AC-113]');
select is(pg_temp.rc_events() - (select events from rc_baseline), 1::bigint,
  'idempotent: a repeated run emits no second event [P2-S11-AC-113]');
select is(
  (select count(*) from audit_private.audit_events where action = 'cms.entry.review.invalidate')
    - (select audits from rc_baseline),
  1::bigint,
  'idempotent: a repeated run writes no second audit record [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Inequality: a term changed, every frozen identity still current.
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_terms',
  'update platform_private.cms_terms set lifecycle = ''deprecated'', version = version + 1 where id = ''a9200000-0000-4000-8000-0000000e0001''::uuid');
select ok(
  platform_private.cms_build_dependency_manifest(pg_temp.h11w_uuid('r7:revision')) <> pg_temp.rc_manifest('r7')
    and platform_private.cms_manifest_identities_current(pg_temp.rc_manifest('r7')) is true,
  'precondition: the changed term makes the rebuilt manifest differ from the frozen one while every frozen identity is current [P2-S11-AC-113]');
select is(pg_temp.rc_run('term', 'a9200000-0000-4000-8000-0000000e0001'),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'inequality: the changed term invalidates the review that froze it [P2-S11-AC-113]');
select is(pg_temp.rc_state('r7'), 'invalidated/dependency_changed/v2',
  'inequality: the review is invalidated dependency_changed [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- Lineage: an activation names the new version, the stale review froze its predecessor.
-- ---------------------------------------------------------------------------
-- the one-active-per-lineage index (E14) admits the successor only after its predecessor is superseded
select pg_temp.h11_raw_exec('platform_private.cms_pattern_versions',
  'update platform_private.cms_pattern_versions set state = ''superseded'' where id = ''a9200000-0000-4000-8000-0000000c0001''::uuid');
select pg_temp.h11_raw_insert('platform_private.cms_pattern_versions',
  pg_temp.h11m_pattern_row('a9200000-0000-4000-8000-0000000c0003', 'h11-pattern-a', 2, repeat('7', 64), 'active',
    'a9200000-0000-4000-8000-0000000c0001', 'a9200000-0000-4000-8000-0000000c0001',
    timestamptz '2026-10-09T12:00:00Z'));
select is(platform_private.cms_dependency_recheck_lineage('pattern', 'a9200000-0000-4000-8000-0000000c0003'),
  array['a9200000-0000-4000-8000-0000000c0001', 'a9200000-0000-4000-8000-0000000c0003']::uuid[],
  'lineage: a pattern version stands for every version of its pattern key [P2-S11-AC-113]');
select is(platform_private.cms_dependency_recheck_lineage('pattern', 'a9200000-0000-4000-8000-0000000c0002'),
  array['a9200000-0000-4000-8000-0000000c0002']::uuid[],
  'lineage: another pattern key is not part of it [P2-S11-AC-113]');
select is(platform_private.cms_dependency_recheck_lineage('pattern', 'a9200000-0000-4000-8000-0000000c0099'),
  array['a9200000-0000-4000-8000-0000000c0099']::uuid[],
  'lineage: a version row that does not exist stands for itself [P2-S11-AC-113]');
select is(pg_temp.rc_run('pattern', 'a9200000-0000-4000-8000-0000000c0003'),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'the event of the NEW pattern version reaches the review that froze its superseded predecessor [P2-S11-AC-113]');
select is(pg_temp.rc_state('r8'), 'invalidated/dependency_changed/v2',
  'the review of the superseded pattern version is invalidated dependency_changed [P2-S11-AC-113]');
select is(pg_temp.rc_events() - (select events from rc_baseline), 3::bigint,
  'one event per invalidated review so far: block, term and pattern [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.outbox_events
    where event_type = 'cms.entry.review-changed.v1' and aggregate_id = pg_temp.s11_id('rc-r8')
      and correlation_id is not null and correlation_id <> 'a1130000-0000-4000-8000-0000000000c1'),
  1,
  'with no outbox row behind the event id the invalidation carries a fresh correlation id [P2-S11-AC-113]');

-- ---------------------------------------------------------------------------
-- The continuation cursor and the schema lineage.
-- ---------------------------------------------------------------------------
create temp table rc_live on commit drop as
select array_agg(review.id order by review.id) as ids
  from platform_private.cms_editorial_reviews review
  join platform_private.cms_editorial_review_dependencies dependency on dependency.review_id = review.id
 where dependency.kind = 'schema' and dependency.ref_id = pg_temp.h11w_version()
   and review.state in ('open', 'approved');
-- Review ids are random: rank the three live reviews by id so the expectations are exact.
create temp table rc_rank on commit drop as
select t.tag, row_number() over (order by pg_temp.s11_id('rc-' || t.tag)) as rank
  from unnest(array['r1', 'r2', 'r6']) as t(tag);
select is((select cardinality(ids) from rc_live), 3,
  'precondition: r1, r2 and r6 are the live reviews of the schema version [P2-S11-AC-113]');
select is(pg_temp.rc_run('schema', pg_temp.h11w_version(), (select ids[1] from rc_live)),
  jsonb_build_object('examined', 2, 'invalidated', 0, 'nextCursor', null),
  'a run continues after the cursor: only reviews with a greater id are selected [P2-S11-AC-113]');
select is(pg_temp.rc_run('schema', pg_temp.h11w_version(), (select ids[3] from rc_live)),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'a cursor on the last review selects nothing [P2-S11-AC-113]');

-- Supersede the schema version: every live review that froze it no longer holds.
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format('update platform_private.cms_content_type_versions set state = ''superseded'' where id = %L::uuid', pg_temp.h11w_version()));
select is(pg_temp.rc_run('schema', pg_temp.h11w_version(), (select ids[1] from rc_live)),
  jsonb_build_object('examined', 2, 'invalidated', 2, 'nextCursor', null),
  'a superseded schema version invalidates the live reviews after the cursor [P2-S11-AC-113]');
select is(
  (select string_agg(rank.tag || '=' || pg_temp.rc_state(rank.tag), ',' order by rank.rank) from rc_rank rank),
  -- The review before the cursor keeps its own state: r2 is the approved review at v2, the others are open at v1.
  (select string_agg(rank.tag || '=' || case when rank.rank = 1
        then (case when rank.tag = 'r2' then 'approved/-/v2' else 'open/-/v1' end)
      else 'invalidated/dependency_changed/v' || (case when rank.tag = 'r2' then 3 else 2 end) end, ',' order by rank.rank)
     from rc_rank rank),
  'the approved review is invalidated at its next version, the review before the cursor is untouched [P2-S11-AC-113]');
select is(pg_temp.rc_run('schema', pg_temp.h11w_version()),
  jsonb_build_object('examined', 1, 'invalidated', 1, 'nextCursor', null),
  'the run from the start finishes what is left: the review before the old cursor [P2-S11-AC-113]');
select is(pg_temp.rc_run('schema', pg_temp.h11w_version()),
  jsonb_build_object('examined', 0, 'invalidated', 0, 'nextCursor', null),
  'idempotent: with no live review left a run examines nothing [P2-S11-AC-113]');
select is(
  pg_temp.rc_state('r3') || ',' || pg_temp.rc_state('r4'),
  'rejected/-/v2,invalidated/revision_superseded/v2',
  'a rejected review stays rejected and an earlier invalidation keeps its reason [P2-S11-AC-113]');
select is(pg_temp.rc_events() - (select events from rc_baseline), 6::bigint,
  'exactly one event per invalidated review: six invalidations, no duplicate from any repeated run [P2-S11-AC-113]');
select is(
  (select count(*)::integer from platform_private.cms_editorial_review_dependencies dependency
    join platform_private.cms_editorial_reviews review on review.id = dependency.review_id
   where review.state = 'invalidated' and dependency.review_id in (
     select pg_temp.s11_id('rc-' || t) from unnest(array['r1', 'r2', 'r5', 'r6', 'r7', 'r8']) t)),
  (select count(*)::integer from platform_private.cms_editorial_review_dependencies dependency
    where dependency.review_id in (
      select pg_temp.s11_id('rc-' || t) from unnest(array['r1', 'r2', 'r5', 'r6', 'r7', 'r8']) t)),
  'the dependency rows of the invalidated reviews are retained as history [P2-S11-AC-113]');

select * from finish();
rollback;
