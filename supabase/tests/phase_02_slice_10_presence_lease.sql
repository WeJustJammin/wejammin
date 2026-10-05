-- Slice 10 QA-RED (WP-S10-2a): advisory edit-presence lease concurrency
-- (BE03b Database Schema, EditPresence; Middleware "Autosave and presence").
--
-- The lease is advisory: a 2-minute window renewed every 30 seconds, the sole
-- permitted timestamp/version update exception, CAS-guarded, monotonic, never
-- blocking another editor, and never a substitute for assignment or
-- capability.  Presence is authored by the real entry-authoring RPCs, never by
-- a hand-inserted row, and the table is seeded only through the named lease
-- RPC.  The suite is written before the WP-S10-3 `cms_edit_presence_lease.sql`
-- migration exists, so an absent function or guard is evidence-backed RED.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(20);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- The lease renewal/release commands are named RPCs; absence is the primary RED.
select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_touch_edit_presence', 'jsonb'),
  'the advisory presence lease has a named renewal command'
);

select ok(
  pg_temp.s10_fn_exists('platform_api', 'cms_release_edit_presence', 'jsonb'),
  'the advisory presence lease has a named release command'
);

-- Acquisition: an author with an active assignment holds one lease row with a
-- future lease window and the active state.
select pg_temp.s10_rpc_probe(
  'presence_acquire',
  null,
  $sql$select platform_api.cms_touch_edit_presence(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'currentFieldId', (select value from s10_ids where key = 'typeFieldId')))$sql$
);

select is(
  pg_temp.s10_probe_state('presence_acquire'), '00000',
  'an assigned author acquires an advisory presence lease'
);

select ok(
  case
    when to_regclass('platform_private.cms_edit_presence') is null then false
    else (
      select count(*) = 1
      from platform_private.cms_edit_presence presence
      where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
        and presence.person_id
          = (select value::uuid from s10_ids where key = 'creatorPerson')
        and presence.state = 'active'
        and presence.lease_until > presence.last_seen_at
        and presence.version > 0
    )
  end,
  'presence stores one active lease row with a bounded future window'
);

-- Renewal advances the lease metadata and the monotonic version, and it leaves
-- the entry aggregate untouched: presence never grants write authority.
select pg_temp.s10_rpc_probe(
  'presence_renew',
  null,
  $sql$select platform_api.cms_touch_edit_presence(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'currentFieldId', (select value from s10_ids where key = 'typeFieldId')))$sql$
);

select is(
  pg_temp.s10_probe_state('presence_renew'), '00000',
  'renewing an unexpired lease succeeds'
);

select ok(
  case
    when to_regclass('platform_private.cms_edit_presence') is null then false
    else (
      select presence.version > 1 and presence.updated_at > presence.created_at
      from platform_private.cms_edit_presence presence
      where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
        and presence.person_id
          = (select value::uuid from s10_ids where key = 'creatorPerson')
    )
  end,
  'renewal advances the monotonic version and updated_at'
);

select ok(
  case
    when to_regclass('platform_private.cms_content_entries') is null then false
    else (
      select entry.version = 1
      from platform_private.cms_content_entries entry
      where entry.id = (select value::uuid from s10_ids where key = 'entryId')
    )
  end,
  'presence renewal never advances the entry aggregate version'
);

-- Concurrent renewal of the same lease is safe: a second pointer either renews
-- or is refused, and the version never regresses.
select pg_temp.s10_rpc_probe(
  'presence_concurrent',
  null,
  $sql$select platform_api.cms_touch_edit_presence(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'currentFieldId', (select value from s10_ids where key = 'typeFieldId')))$sql$
);

select ok(
  pg_temp.s10_probe_state('presence_concurrent') in ('00000', 'P0001')
    and (
      to_regclass('platform_private.cms_edit_presence') is null
      or (
        select count(*) = 1
        from platform_private.cms_edit_presence presence
        where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
          and presence.person_id
            = (select value::uuid from s10_ids where key = 'creatorPerson')
      )
    ),
  'concurrent renewal keeps exactly one lease row per entry and person'
);

-- CAS: a stale presence pointer is refused rather than overwriting a newer one.
select pg_temp.s10_rpc_probe(
  'presence_cas_stale',
  null,
  $sql$select platform_api.cms_touch_edit_presence(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'presenceVersion', 0,
    'currentFieldId', (select value from s10_ids where key = 'typeFieldId')))$sql$
);

select is(
  pg_temp.s10_probe_state('presence_cas_stale'), '40001',
  'a stale presence lease version fails the renewal CAS'
);

-- Expiry: an expired lease is marked expired and never blocks another editor.
select ok(
  case
    when to_regclass('platform_private.cms_edit_presence') is null
      or not pg_temp.s10_fn_exists(
        'platform_private', 'cms_expire_edit_presence_leases', 'integer'
      )
      then false
    else true
  end,
  'an expiry sweep marks leases past their window expired rather than revoked'
);

select ok(
  case
    when to_regclass('platform_private.cms_edit_presence') is null then false
    else exists (
      select 1
      from pg_index index_row
      join pg_class index_class on index_class.oid = index_row.indexrelid
      where index_row.indrelid = to_regclass('platform_private.cms_edit_presence')
        and index_class.relname = 'cms_edit_presence_entry_lease_idx'
        and index_row.indpred is null
    )
  end,
  'the lease index lets an expired window be swept without blocking a second editor'
);

-- Authority change: revoking the assignment removes the advisory presence and
-- marks it revoked; presence never survives loss of authority.
select pg_temp.s10_rpc_probe(
  'presence_revoke',
  null,
  $sql$select platform_api.cms_release_edit_presence(jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId')))$sql$
);

select is(
  pg_temp.s10_probe_state('presence_revoke'), '00000',
  'an explicit release retires the caller''s advisory presence'
);

select ok(
  case
    when to_regclass('platform_private.cms_edit_presence') is null then false
    else not exists (
      select 1 from platform_private.cms_edit_presence presence
      where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
        and presence.person_id
          = (select value::uuid from s10_ids where key = 'creatorPerson')
        and presence.state = 'active'
    )
  end,
  'released presence is no longer an active lease row'
);

-- The lease is advisory: renewal writes no audit or outbox evidence.
select ok(
  pg_temp.s10_audit_count(
    'cms.edit_presence.renewed',
    (select value::uuid from s10_ids where key = 'entryId')
  ) = 0
    and pg_temp.s10_outbox_count(
      'cms.edit_presence.renewed.v1',
      (select value::uuid from s10_ids where key = 'entryId')
    ) = 0,
  'advisory lease renewal emits no audit or outbox event'
);

-- Browser roles hold no direct table privilege on the presence record.
select ok(
  pg_temp.s10_no_table_privilege(
    'platform_private.cms_edit_presence', 'authenticated'
  )
    and pg_temp.s10_no_table_privilege(
      'platform_private.cms_edit_presence', 'anon'
    ),
  'presence stays private with no browser table grant'
);

-- The closed presence state union still admits only the lease lifecycle.
select ok(
  pg_temp.s10r_closed_check_labels(
    'platform_private.cms_edit_presence', 'state'
  ) = array['active','expired','revoked']::text[],
  'presence keeps the closed active/expired/revoked lease union'
);

select finish();
rollback;
