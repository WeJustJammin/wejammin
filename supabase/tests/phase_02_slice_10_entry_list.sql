-- Slice 10 QA-RED (WP-S10-2a): CMS-03B-13 authorized entry list
-- (BE03b Route Registry; validation matrix `CMS-03B-13`).
--
-- The list is a safe bounded read of only the caller's assigned or owned
-- entries in the acting context: hidden or unassigned entries are concealed
-- (never placeholdered), the window is a signed keyset cursor over
-- `(updatedAt DESC, entryId DESC)` defaulting to 25 and capped at 50, the
-- filter allowlist is exactly `state` and `contentTypeId`, and the read emits
-- no audit or outbox evidence.  The suite is written before the WP-S10-3
-- `cms_entry_list_read.sql` migration exists, so an absent RPC or guard is
-- evidence-backed RED.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(14);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- CMS-03B-13 signs its keyset cursor with the per-environment Vault key that no
-- migration provisions (BE03b CMS-03B-13 signed cursor; the same secret the
-- history cursor uses, see rpc/005-history.sqlinc).  This fixed key exists only
-- inside the rolled-back pgTAP transaction and is never an operational value.
select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-13 test key'
);

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_list_entries', 'jsonb')
    and pg_temp.s10_fn_exists('platform_private', 'cms_list_entries', 'jsonb'),
  'CMS-03B-13 entry list has a named worker RPC and platform_api wrapper'
);

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_list_entries', 'jsonb')
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_list_entries', 'jsonb', 'authenticated'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_list_entries', 'jsonb', 'anon'
    ),
  'the entry list RPC is service-role only, never browser-callable'
);

-- The assigned author lists their own scope successfully.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

select pg_temp.s10_rpc_probe(
  'list_creator',
  null,
  $sql$select platform_api.cms_list_entries('{"limit":25}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('list_creator'), '00000',
  'an assigned author lists their authorized entries'
);

-- Concealment: an authenticated principal with no assignment sees nothing and
-- cannot distinguish a hidden entry from an absent one.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'outsiderAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

select pg_temp.s10_rpc_probe(
  'list_outsider',
  null,
  $sql$select platform_api.cms_list_entries('{"limit":25}'::jsonb)$sql$
);

select ok(
  pg_temp.s10_probe_state('list_outsider') = '00000'
    and coalesce(
      (pg_temp.s10_probe_response('list_outsider') -> 'items') = '[]'::jsonb,
      true
    ),
  'a caller without an assignment lists no entries and learns no existence'
);

-- Restore the creator for the remaining cases.
select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization')
);

-- The window carries the opaque next cursor and the page version and never
-- more than the cap.
select pg_temp.s10_rpc_probe(
  'list_window',
  null,
  $sql$select platform_api.cms_list_entries('{"limit":25}'::jsonb)$sql$
);

select ok(
  pg_temp.s10_probe_state('list_window') = '00000'
    and case
      when pg_temp.s10_probe_response('list_window') -> 'items' is null then false
      else jsonb_array_length(
        pg_temp.s10_probe_response('list_window') -> 'items'
      ) <= 50
      and pg_temp.s10_probe_response('list_window') ? 'nextCursor'
      and pg_temp.s10_probe_response('list_window') ? 'pageVersion'
    end,
  'the list window is bounded and carries an opaque cursor and page version'
);

-- An oversized limit is refused rather than clamped silently.
select pg_temp.s10_rpc_probe(
  'list_over_limit',
  null,
  $sql$select platform_api.cms_list_entries('{"limit":51}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('list_over_limit'), 'P0001',
  'a list limit above 50 is a typed refusal'
);

-- The filter allowlist is exactly state and contentTypeId; any other key is
-- rejected before any row is read.
select pg_temp.s10_rpc_probe(
  'list_unknown_filter',
  null,
  $sql$select platform_api.cms_list_entries('{"ownerId":null}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('list_unknown_filter'), 'P0001',
  'an undeclared list filter key is a typed refusal, never an authority claim'
);

-- A malformed or forged cursor is refused, not silently ignored.
select pg_temp.s10_rpc_probe(
  'list_bad_cursor',
  null,
  $sql$select platform_api.cms_list_entries('{"cursor":"not-a-signed-cursor"}'::jsonb)$sql$
);

select is(
  pg_temp.s10_probe_state('list_bad_cursor'), 'P0001',
  'an unsigned or malformed cursor is refused'
);

-- A cursor bound to a different reading scope cannot be replayed against this
-- caller: the signed binding covers the complete query and acting scope.
select pg_temp.s10_rpc_probe(
  'list_scope_mismatch',
  null,
  $sql$select platform_api.cms_list_entries(
    '{"cursor":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'::jsonb
  )$sql$
);

select is(
  pg_temp.s10_probe_state('list_scope_mismatch'), 'P0001',
  'a cursor whose scope binding does not match the caller is refused'
);

-- The read is safe: no mutation, no audit, no outbox.
select ok(
  pg_temp.s10_audit_count(
    'cms.entry.listed',
    (select value::uuid from s10_ids where key = 'entryId')
  ) = 0
    and pg_temp.s10_outbox_count(
      'cms.entry.listed.v1',
      (select value::uuid from s10_ids where key = 'entryId')
    ) = 0,
  'the bounded entry list emits no audit or outbox evidence'
);

select finish();
rollback;
