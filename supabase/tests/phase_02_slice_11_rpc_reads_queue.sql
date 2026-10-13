-- Slice 11 lane S11-3c: platform_api.cms_list_editorial_reviews (CMS-03B-17; tracker P2-S11-AC-061 ..
-- AC-066, DEC-140).  The reviewer queue: a safe read of the reviews the caller holds a non-revoked assignment
-- on (`assigned`, default) or submitted (`submitted`), newest update first, paged by a signed cursor bound to
-- the complete query and acting scope.  A review outside the scope is never listed, a caller outside the acting
-- party gets the empty page, and the cursor fault classes are the DEC-140 ones: a structurally malformed cursor
-- is INVALID_REQUEST (400); an expired, tampered, foreign-bound or over-lived one is CONFLICT (409).
-- RED before 20261005017890.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(33);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_signed_read/000-cursor-helpers.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/020-decision.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc
\ir phase_02_slice_11_rpc_reads/000-world.sqlinc

create temp table r11_snap(label text primary key, effects text not null) on commit drop;
create temp table r11_cur(label text primary key, cursor text not null) on commit drop;

select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only CMS-03B-17 test key');

-- Reviews (each on its own entry/revision).  Assigned to rvA: l1 open, l2 approved, l3 rejected, l4 invalidated,
-- l7 and l8 (open, the same millisecond).  Assigned to rvB only: l5.  Submitted by rvB: l1, l2, l6; by editor: the rest.
select pg_temp.r11_entry('l' || n) from generate_series(1, 8) n;
select pg_temp.r11r_review('l1', 'l1', 'rvB');
select pg_temp.r11r_review('l2', 'l2', 'rvB');
select pg_temp.r11r_review('l3', 'l3', 'editor');
select pg_temp.r11r_review('l4', 'l4', 'editor');
select pg_temp.r11r_review('l5', 'l5', 'editor');
select pg_temp.r11r_review('l6', 'l6', 'rvB');
-- l7 / l8: ids chosen so the larger id has the EARLIER microsecond within one millisecond.
select pg_temp.r11r_review('l7', 'l7', 'editor', jsonb_build_object('id', 'a9300000-0000-4000-8000-0000000000f2'));
select pg_temp.r11r_review('l8', 'l8', 'editor', jsonb_build_object('id', 'a9300000-0000-4000-8000-0000000000f1'));
update s11_ids set value = 'a9300000-0000-4000-8000-0000000000f2' where key = 'l7';
update s11_ids set value = 'a9300000-0000-4000-8000-0000000000f1' where key = 'l8';
select pg_temp.r11_assign_now('l1-rvA', 'l1', 'rvA');
select pg_temp.r11_assign_now('l2-rvA', 'l2', 'rvA');
select pg_temp.r11_assign_now('l3-rvA', 'l3', 'rvA');
select pg_temp.r11_assign_now('l4-rvA', 'l4', 'rvA');
select pg_temp.r11_assign_now('l5-rvB', 'l5', 'rvB');
select pg_temp.r11_assign_now('l7-rvA', 'l7', 'rvA');
select pg_temp.r11_assign_now('l8-rvA', 'l8', 'rvA');
select pg_temp.r11_decide_now('l2-dec', 'l2', 'rvA', 'l2-rvA', 'approve');
select pg_temp.r11_decide_now('l3-dec', 'l3', 'rvA', 'l3-rvA', 'reject');
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews',
  format($$update platform_private.cms_editorial_reviews set state = 'invalidated', invalidated_reason = 'dependency_changed', version = version + 1 where id = %L$$,
         pg_temp.s11_id('l4')));
-- Update instants (the queue order): l1 newest, then l2, l3, l4, l5, l6, and the tie pair at the bottom.
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $$update platform_private.cms_editorial_reviews review set updated_at = case review.id
       when %L then timestamptz '2026-10-08 12:10:00.100000+00'
       when %L then timestamptz '2026-10-08 12:09:00.100000+00'
       when %L then timestamptz '2026-10-08 12:08:00.100000+00'
       when %L then timestamptz '2026-10-08 12:07:00.100000+00'
       when %L then timestamptz '2026-10-08 12:06:00.100000+00'
       when %L then timestamptz '2026-10-08 12:05:00.100000+00'
       when %L then timestamptz '2026-10-08 12:04:00.123456+00'
       when %L then timestamptz '2026-10-08 12:04:00.123789+00' end
     where review.id in (%L, %L, %L, %L, %L, %L, %L, %L)$$,
  pg_temp.s11_id('l1'), pg_temp.s11_id('l2'), pg_temp.s11_id('l3'), pg_temp.s11_id('l4'), pg_temp.s11_id('l5'),
  pg_temp.s11_id('l6'), pg_temp.s11_id('l7'), pg_temp.s11_id('l8'),
  pg_temp.s11_id('l1'), pg_temp.s11_id('l2'), pg_temp.s11_id('l3'), pg_temp.s11_id('l4'), pg_temp.s11_id('l5'),
  pg_temp.s11_id('l6'), pg_temp.s11_id('l7'), pg_temp.s11_id('l8')));

-- Three hundred NEWER reviews of other people (submitted by reviewer05, assigned to nobody): the hidden population
-- must change nothing a caller sees and must not be read to build their page.
select pg_temp.h11_raw_exec('platform_private.cms_editorial_reviews', format(
  $q$insert into platform_private.cms_editorial_reviews(id, owner_id, revision_id, state, version, risk_class, frozen_hash,
       dependency_manifest, dependency_hash, activation_evidence, workflow_policy_key, workflow_policy_version, workflow_policy_hash,
       required_capabilities, required_decision_count, recorded_decision_count, approval_evidence_hash, submitted_by, submitted_at,
       invalidated_reason, decided_at, entry_id, created_at, updated_at)
     select extensions.gen_random_uuid(), review.owner_id, review.revision_id, 'invalidated', 2, review.risk_class, review.frozen_hash,
            review.dependency_manifest, review.dependency_hash, review.activation_evidence, review.workflow_policy_key,
            review.workflow_policy_version, review.workflow_policy_hash, review.required_capabilities, review.required_decision_count,
            0, review.approval_evidence_hash, %L, review.submitted_at, 'dependency_changed', null, review.entry_id, review.created_at,
            timestamptz '2026-10-08 12:30:00+00'
       from platform_private.cms_editorial_reviews review, generate_series(1, 300) n
      where review.id = %L$q$,
  pg_temp.s11_id('reviewer05'), pg_temp.s11_id('l5')));

create or replace function pg_temp.r11l_rq(p_extra jsonb default '{}'::jsonb)
returns jsonb language sql as $body$
  select jsonb_build_object('context', pg_temp.r11_ctx()) || p_extra
$body$;

create or replace function pg_temp.r11l_call(p_label text, p_actor text, p_extra jsonb default '{}'::jsonb)
returns void language sql as $body$
  select pg_temp.r11r_call(p_label, 'cms_list_editorial_reviews', p_actor, pg_temp.r11l_rq(p_extra))
$body$;

-- The review ids of a probe's items, in page order, as the keys 'l1'.. joined.
create or replace function pg_temp.r11l_keys_of(p_label text)
returns text language sql stable as $body$
  select coalesce(string_agg(k.key, ',' order by item.ordinality), '')
    from jsonb_array_elements(pg_temp.r11_resp(p_label)->'items') with ordinality item(value, ordinality)
    left join s11_ids k on k.value = item.value->>'reviewId' and k.key ~ '^l[0-9]$'
$body$;

-- Posture independent of the owner: no PUBLIC/anon/authenticated grant; service_role only on the API wrapper.
create or replace function pg_temp.r11l_posture(p_schema text, p_signature text)
returns boolean language sql stable as $body$
  select coalesce(bool_and(
    p.prosecdef and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
    and has_function_privilege('service_role', p.oid, 'execute') = (p_schema = 'platform_api')
    and not has_function_privilege('anon', p.oid, 'execute')
    and not has_function_privilege('authenticated', p.oid, 'execute')
    and not exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
                     where acl.grantee = 0 and acl.privilege_type = 'EXECUTE')), false)
    from pg_proc p where p.oid = to_regprocedure(p_schema || '.' || p_signature)
$body$;

select ok(pg_temp.r11l_posture('platform_private', 'cms_list_editorial_reviews(jsonb)')
    and pg_temp.r11l_posture('platform_private', 'cms_list_editorial_reviews_signed(jsonb)')
    and pg_temp.r11l_posture('platform_api', 'cms_list_editorial_reviews(jsonb)'),
  'the keyset reader and the signed wrapper are private SECURITY DEFINERs nobody can execute; the platform_api wrapper is executable by service_role only [P2-S11-AC-064]');

insert into r11_snap(label, effects) values ('before', pg_temp.r11r_effects());

-- ---------------------------------------------------------------------------
-- Scope and order.
-- ---------------------------------------------------------------------------
select pg_temp.r11l_call('a-default', 'rvA');
select is(pg_temp.r11_out('a-default'), '00000:', 'a reviewer reads the default (assigned) queue with no scope or limit given [P2-S11-AC-061]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('a-default')), 'items,nextCursor,pageVersion',
  'the page is exactly ReviewQueuePage: items, nextCursor, pageVersion [P2-S11-AC-061]');
select is(pg_temp.r11l_keys_of('a-default'), 'l1,l2,l3,l4,l7,l8',
  'the assigned scope lists exactly the reviews the caller holds an assignment on, newest update first (the tie pair ordered by review id) [P2-S11-AC-063]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('a-default')->'items'->0),
  'assignmentEndsAt,contentTypeLabel,entryId,locale,myDecision,recordedDecisionCount,requiredDecisionCount,reviewId,revisionId,revisionNumber,riskClass,state,submittedAt,updatedAt',
  'an item is exactly ReviewQueueItem (14 members) [P2-S11-AC-061]');
select ok(
  pg_temp.r11_resp('a-default')->'items'->0->>'state' = 'open' and pg_temp.r11_resp('a-default')->'items'->0->>'riskClass' = 'ordinary'
    and pg_temp.r11_resp('a-default')->'items'->0->>'myDecision' = 'none'
    and pg_temp.r11_resp('a-default')->'items'->0->>'contentTypeLabel' = 'H11 document'
    and pg_temp.r11_resp('a-default')->'items'->0->>'revisionNumber' = '1' and pg_temp.r11_resp('a-default')->'items'->0->>'locale' = 'en-US'
    and pg_temp.r11_resp('a-default')->'items'->0->>'updatedAt' = '2026-10-08T12:10:00.100Z'
    and pg_temp.r11_resp('a-default')->'items'->0->>'assignmentEndsAt' = (select platform_private.auth_iso_time(ends_at)
          from platform_private.cms_editorial_review_assignments where id = pg_temp.s11_id('l1-rvA'))
    and pg_temp.r11_resp('a-default')->'items'->1->>'myDecision' = 'approve' and pg_temp.r11_resp('a-default')->'items'->1->>'state' = 'approved'
    and pg_temp.r11_resp('a-default')->'items'->2->>'myDecision' = 'reject' and pg_temp.r11_resp('a-default')->'items'->2->>'state' = 'rejected'
    and pg_temp.r11_resp('a-default')->'items'->3->>'state' = 'invalidated',
  'items carry the review state, the caller''s own decision (none / approve / reject), the content type label, the revision number and locale and the caller''s assignment end [P2-S11-AC-061]');
select ok(
  (select bool_and(
      (lag_ts > cur_ts) or (lag_ts = cur_ts and lag_id > cur_id))
     from (
       select date_trunc('milliseconds', (item.value->>'updatedAt')::timestamptz) as cur_ts, (item.value->>'reviewId')::uuid as cur_id,
              lag(date_trunc('milliseconds', (item.value->>'updatedAt')::timestamptz)) over (order by item.ordinality) as lag_ts,
              lag((item.value->>'reviewId')::uuid) over (order by item.ordinality) as lag_id
         from jsonb_array_elements(pg_temp.r11_resp('a-default')->'items') with ordinality item(value, ordinality)
     ) walked where lag_ts is not null),
  'consecutive items strictly descend by (updatedAt at millisecond precision, reviewId): the contract''s keyset check holds even for two rows of one millisecond [P2-S11-AC-061]');
select ok(
  (select pg_temp.r11_resp('a-default')->'items'->4->>'reviewId' = 'a9300000-0000-4000-8000-0000000000f2'
          and pg_temp.r11_resp('a-default')->'items'->5->>'reviewId' = 'a9300000-0000-4000-8000-0000000000f1'),
  'the tie pair (the larger id has the earlier microsecond) is ordered by id, not by microsecond [P2-S11-AC-061]');
select ok(
  pg_temp.r11_resp('a-default')->>'pageVersion' = floor(extract(epoch from timestamptz '2026-10-08 12:10:00.100000+00') * 1000000)::bigint::text
    and pg_temp.r11_resp('a-default')->'nextCursor' = 'null'::jsonb,
  'pageVersion is the page high-water mark in UTC microseconds and a page that fits has no cursor [P2-S11-AC-064]');

select pg_temp.r11l_call('s-rvB', 'rvB', '{"scope":"submitted"}');
select pg_temp.r11l_call('s-editor', 'editor', '{"scope":"submitted"}');
select pg_temp.r11l_call('a-rvB', 'rvB', '{"scope":"assigned"}');
select ok(pg_temp.r11l_keys_of('s-rvB') = 'l1,l2,l6' and pg_temp.r11l_keys_of('s-editor') = 'l3,l4,l5,l7,l8'
    and pg_temp.r11l_keys_of('a-rvB') = 'l5',
  'the submitted scope lists only reviews the caller submitted; the assigned scope of another reviewer lists only theirs: no review outside the scope is ever listed [P2-S11-AC-063]');
select ok(
  (select bool_and(item->'assignmentEndsAt' = 'null'::jsonb) from jsonb_array_elements(pg_temp.r11_resp('s-rvB')->'items') item)
    and (select bool_and(item->'assignmentEndsAt' <> 'null'::jsonb) from jsonb_array_elements(pg_temp.r11_resp('a-rvB')->'items') item),
  'assignmentEndsAt is the caller''s assignment end for the assigned scope and null for the submitted scope [P2-S11-AC-061]');

select pg_temp.r11l_call('f-open', 'rvA', '{"state":"open"}');
select pg_temp.r11l_call('f-approved', 'rvA', '{"state":"approved"}');
select pg_temp.r11l_call('f-invalidated', 'rvA', '{"state":"invalidated"}');
select pg_temp.r11l_call('f-rejected-sub', 'rvB', '{"scope":"submitted","state":"rejected"}');
select ok(pg_temp.r11l_keys_of('f-open') = 'l1,l7,l8' and pg_temp.r11l_keys_of('f-approved') = 'l2'
    and pg_temp.r11l_keys_of('f-invalidated') = 'l4' and pg_temp.r11l_keys_of('f-rejected-sub') = '',
  'the state filter narrows the scope: open, approved and invalidated select the right rows and a state with none is the empty page [P2-S11-AC-062]');

select pg_temp.r11l_call('n-null', 'rvA', '{"cursor":null,"limit":null,"scope":null,"state":null}');
select ok(pg_temp.r11_out('n-null') = '00000:' and pg_temp.r11_resp('n-null') = pg_temp.r11_resp('a-default'),
  'explicit nulls for cursor, limit, scope and state are the defaults [P2-S11-AC-062]');

select pg_temp.r11l_call('x-stranger', 'stranger');
select pg_temp.r11l_call('x-outsider', 'outsider');
select pg_temp.r11l_call('x-pub', 'pub', '{"scope":"submitted"}');
select ok(
  pg_temp.r11_resp('x-stranger') = '{"items":[],"nextCursor":null,"pageVersion":"1"}'::jsonb
    and pg_temp.r11_resp('x-outsider') = '{"items":[],"nextCursor":null,"pageVersion":"1"}'::jsonb
    and pg_temp.r11_resp('x-pub') = '{"items":[],"nextCursor":null,"pageVersion":"1"}'::jsonb,
  'a non-member, a member with no assignment and a member who submitted nothing get the empty page (pageVersion 1), never an error [P2-S11-AC-063]');
select pg_temp.r11r_call('x-party', 'cms_list_editorial_reviews', 'rvA',
  jsonb_build_object('context', pg_temp.r11_ctx(interval '60 seconds', true, pg_temp.s11_id('creator'))));
select ok(pg_temp.r11_resp('x-party') = '{"items":[],"nextCursor":null,"pageVersion":"1"}'::jsonb,
  'another acting party lists nothing of this organisation [P2-S11-AC-063]');

-- ---------------------------------------------------------------------------
-- Paging with the signed cursor.
-- ---------------------------------------------------------------------------
select pg_temp.r11l_call('p1', 'rvA', '{"limit":2}');
insert into r11_cur select 'p1', pg_temp.r11_resp('p1')->>'nextCursor';
select pg_temp.r11l_call('p2', 'rvA', (select jsonb_build_object('limit', 2, 'cursor', cursor) from r11_cur where label = 'p1'));
insert into r11_cur select 'p2', pg_temp.r11_resp('p2')->>'nextCursor';
select pg_temp.r11l_call('p3', 'rvA', (select jsonb_build_object('limit', 2, 'cursor', cursor) from r11_cur where label = 'p2'));
insert into r11_cur select 'p3', pg_temp.r11_resp('p3')->>'nextCursor' where pg_temp.r11_resp('p3')->>'nextCursor' is not null;
select ok(pg_temp.r11l_keys_of('p1') = 'l1,l2' and pg_temp.r11l_keys_of('p2') = 'l3,l4' and pg_temp.r11l_keys_of('p3') = 'l7,l8'
    and not exists (select 1 from r11_cur where label = 'p3'),
  'three pages of two walk the whole scope exactly once and the last page has no cursor [P2-S11-AC-061]');
select ok(
  (select length(cursor) between 1 and 512 from r11_cur where label = 'p1')
    and (select pg_temp.r11_keys(convert_from(decode(cursor, 'base64'), 'utf8')::jsonb) = 'expiresAt,keyId,lastReviewId,lastUpdatedAt,queryHash,signature'
           from r11_cur where label = 'p1'),
  'the cursor is at most 512 characters and a signed six-member envelope (query binding, last position, expiry, key id, signature) [P2-S11-AC-064]');

-- ---------------------------------------------------------------------------
-- Cursor faults (DEC-140): 409 for an expired, tampered, foreign-bound or over-lived cursor; 400 for a malformed one.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.r11l_forge(p_patch jsonb, p_resign boolean default true)
returns text language sql stable as $body$
  select pg_temp.s10_cursor_forge((select cursor from r11_cur where label = 'p1'), p_patch, array[]::text[],
    case when p_resign then 'cms-03b-17' end, case when p_resign then repeat('a1', 32) end)
$body$;
select pg_temp.r11l_call('c-foreign-actor', 'rvB', (select jsonb_build_object('limit', 2, 'cursor', cursor) from r11_cur where label = 'p1'));
select pg_temp.r11l_call('c-scope', 'rvA', (select jsonb_build_object('limit', 2, 'scope', 'submitted', 'cursor', cursor) from r11_cur where label = 'p1'));
select pg_temp.r11l_call('c-state', 'rvA', (select jsonb_build_object('limit', 2, 'state', 'open', 'cursor', cursor) from r11_cur where label = 'p1'));
select pg_temp.r11l_call('c-limit', 'rvA', (select jsonb_build_object('limit', 3, 'cursor', cursor) from r11_cur where label = 'p1'));
select pg_temp.r11l_call('c-tamper-sig', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('signature', repeat('0', 64)), false)));
select pg_temp.r11l_call('c-tamper-payload', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('lastReviewId', extensions.gen_random_uuid()), false)));
select pg_temp.r11l_call('c-forged-hash', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('queryHash', repeat('b', 64)))));
select pg_temp.r11l_call('c-expired', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('expiresAt', (floor(extract(epoch from clock_timestamp())) - 5)::bigint::text))));
select pg_temp.r11l_call('c-overlived', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('expiresAt', (floor(extract(epoch from clock_timestamp())) + 86400 + 60)::bigint::text))));
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label collate "C") from r11_probe where label like 'c-%'),
  'c-expired=P0001:CONFLICT c-foreign-actor=P0001:CONFLICT c-forged-hash=P0001:CONFLICT c-limit=P0001:CONFLICT c-overlived=P0001:CONFLICT c-scope=P0001:CONFLICT c-state=P0001:CONFLICT c-tamper-payload=P0001:CONFLICT c-tamper-sig=P0001:CONFLICT',
  'a cursor of another caller, scope, state or page size, a tampered signature or payload, a correctly signed forgery with a foreign binding, an expired and an over-lived cursor are all CONFLICT (restart from the first page) [P2-S11-AC-065]');

select pg_temp.r11l_call('m-garbage', 'rvA', '{"cursor":"not base64 !!"}');
select pg_temp.r11l_call('m-number', 'rvA', '{"cursor":7}');
select pg_temp.r11l_call('m-empty', 'rvA', '{"cursor":""}');
select pg_temp.r11l_call('m-long', 'rvA', jsonb_build_object('cursor', repeat('A', 513)));
select pg_temp.r11l_call('m-extra-key', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('extra', 1))));
select pg_temp.r11l_call('m-bad-ts', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('lastUpdatedAt', '2026-10-08'))));
select pg_temp.r11l_call('m-bad-id', 'rvA', jsonb_build_object('limit', 2, 'cursor',
  pg_temp.r11l_forge(jsonb_build_object('lastReviewId', 'not-a-uuid'))));
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label), ' ' order by label) from r11_probe where label like 'm-%'),
  'm-bad-id=P0001:INVALID_REQUEST m-bad-ts=P0001:INVALID_REQUEST m-empty=P0001:INVALID_REQUEST m-extra-key=P0001:INVALID_REQUEST m-garbage=P0001:INVALID_REQUEST m-long=P0001:INVALID_REQUEST m-number=P0001:INVALID_REQUEST',
  'a non-base64, non-string, empty or over-long cursor, an envelope with an unknown member and a correctly signed payload with a malformed position are INVALID_REQUEST (400) [P2-S11-AC-065]');

-- ---------------------------------------------------------------------------
-- Query validation, the signing key, and the safe-read guarantee.
-- ---------------------------------------------------------------------------
select pg_temp.r11l_call('q-limit-0', 'rvA', '{"limit":0}');
select pg_temp.r11l_call('q-limit-51', 'rvA', '{"limit":51}');
select pg_temp.r11l_call('q-limit-text', 'rvA', '{"limit":"25"}');
select pg_temp.r11l_call('q-limit-frac', 'rvA', '{"limit":1.5}');
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(detail, ''), ' ' order by label) from r11_probe where label like 'q-limit%'),
  'q-limit-0=P0001:VALIDATION_FAILED["/limit"] q-limit-51=P0001:VALIDATION_FAILED["/limit"] q-limit-frac=P0001:VALIDATION_FAILED["/limit"] q-limit-text=P0001:VALIDATION_FAILED["/limit"]',
  'a limit outside 1..50, a string or a fraction is VALIDATION_FAILED at /limit [P2-S11-AC-062]');
select pg_temp.r11l_call('q-scope', 'rvA', '{"scope":"all"}');
select pg_temp.r11l_call('q-state', 'rvA', '{"state":"bogus"}');
select pg_temp.r11l_call('q-unknown', 'rvA', '{"reviewId":"x"}');
select pg_temp.r11l_call('q-owner', 'rvA', jsonb_build_object('ownerId', pg_temp.s11_id('org')));
select is(
  (select string_agg(label || '=' || pg_temp.r11_out(label) || coalesce(detail, ''), ' ' order by label) from r11_probe where label in ('q-scope', 'q-state', 'q-unknown', 'q-owner')),
  'q-owner=P0001:INVALID_REQUEST q-scope=P0001:VALIDATION_FAILED["/scope"] q-state=P0001:VALIDATION_FAILED["/state"] q-unknown=P0001:INVALID_REQUEST',
  'an unknown scope or state is VALIDATION_FAILED at its pointer and any other query member (also an ownership claim) is INVALID_REQUEST [P2-S11-AC-062]');

delete from vault.secrets where name = 'cms_editorial_history_cursor_active';
select pg_temp.r11l_call('k-missing', 'rvA');
select is(pg_temp.r11_out('k-missing'), 'P0001:DEPENDENCY_UNAVAILABLE',
  'without an active Vault signing key the queue fails closed with DEPENDENCY_UNAVAILABLE [P2-S11-AC-065]');
select vault.create_secret(repeat('a1', 32), 'cms_editorial_history_cursor_active', 'pgTAP transaction-only CMS-03B-17 test key');

select ok(pg_temp.r11r_effects() = (select effects from r11_snap where label = 'before')
    and (select count(*) from platform_private.cms_editorial_reviews) > 300,
  'listing never writes: reservations, audit records, events, tokens, schedules and publications are untouched [P2-S11-AC-064]');
select ok(
  not exists (select 1 from platform_private.idempotency_records where operation like 'CMS-03B-17%')
    and (select count(*) from audit_private.audit_events where action like 'cms.%review%list%') = 0,
  'the queue leaves no idempotency record and no audit record [P2-S11-AC-064]');

select * from finish();
rollback;
