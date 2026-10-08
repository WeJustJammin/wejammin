-- Slice 10 QA-RED/GREEN: keyed tamper-evident cursor signature.
--
-- Findings 24/27/28: the entry-list (10700) and draft-detail/compare-history
-- cursors are plain base64 JSON, so a reader can decode and replay them across
-- scopes. This suite proves the cursor envelope is signed with the repository's
-- canonical Vault-backed HMAC mechanism (20260927170000), bound to the exact
-- actor/acting party/filter/window, and refuses empty/unsigned/tampered/
-- foreign/expired cursors.
--
-- The probes cover both RPCs: platform_api.cms_list_entries (CMS-03B-13) and
-- platform_api.cms_list_revisions (CMS-03B-03).
--
-- Harness: the environment signing key is a per-environment Vault secret that
-- no migration provisions (BE03b CMS-03B-03/13: signed cursor; 20260927170000
-- header), so this suite creates its own transaction-local key exactly as the
-- history suite (rpc/005-history.sqlinc) does.  A limit-1 first page only
-- carries a next cursor when a second visible row exists, so
-- phase_02_slice_10_signed_read/001-cursor-fixtures.sqlinc seeds a second
-- authorised entry (list) and a second revision (history).  The entry-list
-- cursor signs under the 'cms-03b-13' domain and the history cursor under
-- 'cms-03b-03', so the re-sign probes use the matching domain.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_signed_read/000-cursor-helpers.sqlinc

-- The canonical signing function exists (20260927170000): signed-envelope
-- admission/signing helper used by both cursors.
select ok(
  pg_temp.s10_fn_exists(
    'platform_private', 'cms_history_cursor_mac_equal', 'bytea, bytea'
  ),
  'canonical constant-time cursor MAC helper exists (guard)'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- Fail closed: an environment with no provisioned Vault signing key refuses
-- both reads outright rather than minting or accepting an unsigned cursor.
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql()), 'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-13 refuses the list with the dependency-unavailable token while no Vault signing key is provisioned'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_history_sql()), 'DEPENDENCY_UNAVAILABLE',
  'CMS-03B-03 refuses history with the dependency-unavailable token while no Vault signing key is provisioned'
);

-- This fixed key exists only inside the rolled-back pgTAP transaction. It is
-- never a hosted or owner-approved operational signing value.
select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03/13 test key'
);

\ir phase_02_slice_10_signed_read/001-cursor-fixtures.sqlinc

-- 1. A first list page returns a signed envelope with the canonical seven keys (the
-- unsigned keyset payload carries the collection epoch `aheadDigest`, round 2 item 3).
create temp table s10_cursor_list_page on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10_list_sql()) as response;

select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-03B-13 first page succeeds with the signed-cursor migration'
);

select ok(
  (
    select response is not null
       and platform_private.cms_exact_keys(
             convert_from(decode(response->>'nextCursor', 'base64'), 'utf8')::jsonb,
             array[
               'queryHash', 'lastUpdatedAt', 'lastEntryId', 'aheadDigest', 'expiresAt',
               'keyId', 'signature'
             ]::text[],
             array[
               'queryHash', 'lastUpdatedAt', 'lastEntryId', 'aheadDigest', 'expiresAt',
               'keyId', 'signature'
             ]::text[]
           )
   from s10_cursor_list_page
  ),
  'CMS-03B-13 nextCursor is a seven-key signed envelope (keyId+signature present, collection epoch included)'
);

-- The signed cursor stays inside the 512-character contract and each item
-- carries the canonical owning entryId beside the revision identity (the
-- EntryListItem contract the Worker parses).
select ok(
  (select octet_length(response->>'nextCursor') <= 512
      and response->'items'->0->>'entryId'
        = 'a9100000-0000-4000-8000-000000000311'
      and response->'items'->0->>'id'
        = 'a9100000-0000-4000-8000-000000000312'
      and platform_private.cms_exact_keys(
            response->'items'->0,
            array[
              'id', 'entryId', 'entryLifecycle', 'entryUpdatedAt', 'revisionNumber',
              'locale', 'state', 'contentHash', 'createdAt', 'authorClass'
            ]::text[],
            array[
              'id', 'entryId', 'entryLifecycle', 'entryUpdatedAt', 'revisionNumber',
              'locale', 'state', 'contentHash', 'createdAt', 'authorClass'
            ]::text[]
          )
   from s10_cursor_list_page),
  'CMS-03B-13 signed cursor is within 512 chars and items carry entryId, entryLifecycle and entryUpdatedAt (DEC-145, lane G contract; cascade) beside the revision id'
);

-- The valid signed cursor continues the keyset walk to the remaining entry:
-- the tamper probes below refuse because of the tampering, not because a
-- signed cursor never works.
create temp table s10_cursor_list_page_two on commit drop as
select pg_temp.s10_rpc_exec(pg_temp.s10_list_sql(
  (select response->>'nextCursor' from s10_cursor_list_page)
)) as response;
select is(
  pg_temp.s10_last_error_state(), '00000',
  'CMS-03B-13 accepts its own signed cursor on the continuation page'
);
select ok(
  (select response->'items'->0->>'entryId'
        = 'a9100000-0000-4000-8000-000000000301'
      and jsonb_array_length(response->'items') = 1
      and response->'nextCursor' = 'null'::jsonb
   from s10_cursor_list_page_two),
  'CMS-03B-13 signed continuation returns the remaining entry and no further cursor'
);

-- 2. Tampering with the envelope (changed lastEntryId) is refused.
select ok(
  pg_temp.s10_rpc_call(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    '{"lastEntryId":"a9100000-0000-4000-8000-000000000999"}'
  ))),
  'CMS-03B-13 refuses a tampered signed cursor'
);
select is(
  pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03B-13 tampered cursor is the typed conflict refusal'
);

-- 3. Empty cursor string refused.
select ok(
  pg_temp.s10_rpc_call(
    $sql$select platform_api.cms_list_entries('{"cursor":""}'::jsonb)$sql$
  ),
  'CMS-03B-13 refuses an empty cursor'
);
select is(
  pg_temp.s10_last_error_message(), 'INVALID_REQUEST',
  'CMS-03B-13 empty cursor is the malformed-query token'
);

-- 3b. A cursor that is not a string, or exceeds 512 characters, is malformed.
select is(
  pg_temp.s10_cursor_refusal(
    $sql$select platform_api.cms_list_entries('{"cursor":7}'::jsonb)$sql$
  ), 'INVALID_REQUEST',
  'CMS-03B-13 non-string cursor is the malformed-query token'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(repeat('A', 513))),
  'INVALID_REQUEST',
  'CMS-03B-13 over-long cursor is the malformed-query token'
);

-- 3c. The page window stays a closed 1..50 integer bound behind the signed
-- wrapper: 0 and a fractional limit are typed refusals, 50 is the inclusive cap.
select is(
  pg_temp.s10_cursor_refusal(
    $sql$select platform_api.cms_list_entries('{"limit":0}'::jsonb)$sql$
  ), 'VALIDATION_FAILED',
  'CMS-03B-13 a zero page limit is the typed bounds refusal'
);
select is(
  pg_temp.s10_cursor_refusal(
    $sql$select platform_api.cms_list_entries('{"limit":1.5}'::jsonb)$sql$
  ), 'VALIDATION_FAILED',
  'CMS-03B-13 a fractional page limit is the typed bounds refusal'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(null, 50)), 'accepted',
  'CMS-03B-13 a page limit of 50 is accepted'
);

-- 4. Foreign keyId refused: a signed envelope whose keyId does not resolve to
-- an active/retired Vault signing secret is CONFLICT.  The id is a well-formed
-- UUID that no Vault secret carries (a malformed keyId is a caller fault and is
-- INVALID_REQUEST per 20260927490000; see 4b).
select ok(
  pg_temp.s10_rpc_call(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    '{"keyId":"a9100000-0000-4000-8000-00000000beef"}'
  ))),
  'CMS-03B-13 refuses a foreign-keyId signed cursor'
);
select is(
  pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03B-13 foreign keyId is the conflict token'
);

-- 4b. A structurally malformed envelope is INVALID_REQUEST, never CONFLICT: a
-- keyId that is not a UUID, a non-hex signature, a missing signature, and an
-- extra key.
select ok(
  (select bool_and(pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(
     pg_temp.s10_cursor_forge(
       (select response->>'nextCursor' from s10_cursor_list_page),
       fixture.patch, fixture.removal
     ))) = 'INVALID_REQUEST')
   from (values
     ('{"keyId":"a9100000-0000-4000-8000-000000000beef"}'::jsonb, array[]::text[]),
     ('{"signature":"zz"}'::jsonb, array[]::text[]),
     ('{}'::jsonb, array['signature']),
     ('{"extra":"x"}'::jsonb, array[]::text[])
   ) as fixture(patch, removal)),
  'CMS-03B-13 a malformed signed envelope is INVALID_REQUEST, never CONFLICT'
);

-- 4c. A valid-shaped envelope whose MAC fails stays CONFLICT.
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    jsonb_build_object('signature', repeat('ff', 32))
  ))), 'CONFLICT',
  'CMS-03B-13 valid-shaped unverifiable cursor stays the conflict token'
);

-- 5. Expired cursor refused: expire the envelope within its 24h max, re-sign
-- with the fixture test key under the entry-list domain, and the read must
-- refuse by expiry not signature.
select ok(
  pg_temp.s10_rpc_call(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    jsonb_build_object('expiresAt',
      (floor(extract(epoch from clock_timestamp())) - 10)::bigint::text),
    array[]::text[], 'cms-03b-13', repeat('a1', 32)
  ))),
  'CMS-03B-13 refuses an expired signed cursor'
);
select is(
  pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03B-13 expired cursor is the conflict token'
);

-- 5b. A correctly signed cursor beyond the 24-hour maximum is refused (a valid
-- MAC must not turn an issued cursor into a longer-lived credential), and a
-- correctly signed cursor under the history domain does not verify as an
-- entry-list cursor (domain separation).
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    jsonb_build_object('expiresAt',
      (floor(extract(epoch from clock_timestamp())) + 172800)::bigint::text),
    array[]::text[], 'cms-03b-13', repeat('a1', 32)
  ))), 'CONFLICT',
  'CMS-03B-13 a correctly signed cursor beyond the 24-hour maximum is the conflict token'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(pg_temp.s10_cursor_forge(
    (select response->>'nextCursor' from s10_cursor_list_page),
    '{}'::jsonb, array[]::text[], 'cms-03b-03', repeat('a1', 32)
  ))), 'CONFLICT',
  'CMS-03B-13 a cursor signed under the history signature domain is the conflict token'
);

-- 6. A cursor bound to one query scope cannot be replayed in another
-- (filters/window mismatch), even with a valid signature.
select ok(
  pg_temp.s10_rpc_call(pg_temp.s10_list_sql(
    (select response->>'nextCursor' from s10_cursor_list_page), 2
  )),
  'CMS-03B-13 binds a valid cursor to its original query scope'
);
select is(
  pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03B-13 scope mismatch is the conflict token'
);

-- 6b. The binding also covers the acting read scope: the same signed cursor
-- replayed by another principal is a context mismatch, never a continuation.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'editorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_list_sql(
    (select response->>'nextCursor' from s10_cursor_list_page)
  )), 'CONFLICT',
  'CMS-03B-13 a signed cursor replayed by a different principal is the conflict token'
);
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- 7. DEC-140 (P2-S10-AC-035/097/098): the keyset payload inside the envelope
-- follows the same two-class rule as the envelope.  A structural fault in the
-- unsigned payload (a non-UUID lastEntryId, a malformed lastUpdatedAt or
-- expiresAt) is INVALID_REQUEST even when the binding also differs; a
-- well-formed payload bound to another scope, or already expired, is CONFLICT.
-- The signed envelope makes these unreachable for a client, so the probes call
-- the private keyset reader directly with a hand-built unsigned cursor.
create or replace function pg_temp.s10_unsigned_list_sql(p_patch jsonb)
returns text
language sql
as $body$
  select 'select platform_private.cms_list_entries('
    || quote_literal(jsonb_build_object(
         'limit', 1,
         'cursor', replace(encode(convert_to(platform_private.cms_jcs(
           jsonb_build_object(
             'queryHash', repeat('0', 64),
             'lastUpdatedAt', '2026-01-01T00:00:00.000000Z',
             'lastEntryId', 'a9100000-0000-4000-8000-000000000301',
             'aheadDigest', repeat('0', 32),
             'expiresAt', (floor(extract(epoch from clock_timestamp())) + 3600)::bigint::text
           ) || p_patch
         ), 'utf8'), 'base64'), E'\n', '')
       )::text)
    || '::jsonb)'
$body$;

select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_unsigned_list_sql(
    '{"lastEntryId":"not-a-uuid"}'::jsonb)),
  'INVALID_REQUEST',
  'CMS-03B-13 a non-UUID lastEntryId is a structural cursor fault: INVALID_REQUEST [DEC-140]'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_unsigned_list_sql(
    '{"lastUpdatedAt":"yesterday"}'::jsonb)),
  'INVALID_REQUEST',
  'CMS-03B-13 a malformed lastUpdatedAt is a structural cursor fault: INVALID_REQUEST [DEC-140]'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_unsigned_list_sql(
    '{"expiresAt":"soon"}'::jsonb)),
  'INVALID_REQUEST',
  'CMS-03B-13 a malformed expiresAt is a structural cursor fault: INVALID_REQUEST [DEC-140]'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_unsigned_list_sql('{}'::jsonb)),
  'CONFLICT',
  'CMS-03B-13 a well-formed payload bound to another scope is CONFLICT [DEC-140]'
);
select is(
  pg_temp.s10_cursor_refusal(pg_temp.s10_unsigned_list_sql(jsonb_build_object(
    'expiresAt', (floor(extract(epoch from clock_timestamp())) - 10)::bigint::text))),
  'CONFLICT',
  'CMS-03B-13 an expired well-formed payload is CONFLICT [DEC-140]'
);

\ir phase_02_slice_10_signed_read/003-history-cursor.sqlinc
\ir phase_02_slice_10_signed_read/004-key-handling.sqlinc

select finish();
rollback;
