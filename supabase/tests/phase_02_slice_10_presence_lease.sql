-- Slice 10 WP-S10-3 (lane E): the advisory edit-presence lease.
--
-- BE03b Database Schema (EditPresence) and Middleware "Autosave and presence":
-- presence is a 2-minute advisory lease renewed by each autosave, "expires
-- without blocking another editor, and never grants write authority";
-- IA03 Edge Cases: "Authority revoked during autosave/review ... Reject commit,
-- preserve local unsent value, remove active presence/assignment."  FE03 keeps
-- EditPresence physical-only, so there is no HTTP or PostgREST presence
-- command.  Renewal therefore rides the authorized CMS-03B-01 write
-- transaction, release rides authority revocation, and expiry is the
-- service-role Worker sweep.  Every presence row below is produced by those
-- real producers; no row is hand-inserted.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(67);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

-- ---------------------------------------------------------------------------
-- Helpers.  The autosave helper derives the CAS pair from the live entry so a
-- sequence of authorized writes never carries a stale pointer by accident.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.s10p_autosave(
  p_label text,
  p_actor_auth uuid,
  p_base_override bigint default null
)
returns void
language plpgsql
as $body$
declare
  request jsonb;
  base_revision bigint;
  entry_version bigint;
begin
  select revision.revision_number, entry.version
    into base_revision, entry_version
  from platform_private.cms_content_entries entry
  join platform_private.cms_entry_revisions revision
    on revision.id = entry.current_draft_revision_id
  where entry.id = (select value::uuid from s10_ids where key = 'entryId');

  perform pg_temp.s10_rpc_as(
    p_actor_auth, (select value::uuid from s10_ids where key = 'organization')
  );
  request := jsonb_build_object(
    'entryId', (select value from s10_ids where key = 'entryId'),
    'baseRevision', coalesce(p_base_override, base_revision)::text,
    'changedPaths', jsonb_build_array(
      '/fields/' || (select value from s10_ids where key = 'typeFieldId')
    ),
    'values', jsonb_build_object(
      (select value from s10_ids where key = 'typeFieldId'),
      'Presence title ' || p_label
    ),
    'locale', 'en-US',
    'expectedVersion', entry_version::text,
    'ifMatch', entry_version::text,
    'idempotencyKey', 's10-presence-autosave-' || p_label,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'
    )
  );
  perform pg_temp.s10_rpc_probe_persist(
    p_label, null,
    'select platform_api.cms_create_revision('
      || quote_literal(request::text) || '::jsonb)'
  );
end;
$body$;

create or replace function pg_temp.s10p_state(p_person_key text)
returns text
language sql
as $body$
  select presence.state
  from platform_private.cms_edit_presence presence
  where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and presence.person_id = (select value::uuid from s10_ids where key = p_person_key)
$body$;

-- The state of one person's entry assignment for a capability (DEC-143).
create or replace function pg_temp.s10p_assignment(p_person_key text, p_capability text)
returns text
language sql
as $body$
  select assignment.state
  from platform_private.cms_entry_assignments assignment
  where assignment.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and assignment.assignee_person_id = (select value::uuid from s10_ids where key = p_person_key)
    and assignment.capability_key = p_capability
$body$;

create or replace function pg_temp.s10p_assignment_version(p_person_key text, p_capability text)
returns bigint
language sql
as $body$
  select assignment.version
  from platform_private.cms_entry_assignments assignment
  where assignment.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and assignment.assignee_person_id = (select value::uuid from s10_ids where key = p_person_key)
    and assignment.capability_key = p_capability
$body$;

create or replace function pg_temp.s10p_version(p_person_key text)
returns bigint
language sql
as $body$
  select presence.version
  from platform_private.cms_edit_presence presence
  where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and presence.person_id = (select value::uuid from s10_ids where key = p_person_key)
$body$;

create or replace function pg_temp.s10p_row_count(p_person_key text)
returns integer
language sql
as $body$
  select count(*)::integer
  from platform_private.cms_edit_presence presence
  where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and presence.person_id = (select value::uuid from s10_ids where key = p_person_key)
$body$;

create or replace function pg_temp.s10p_revision_count()
returns integer
language sql
as $body$
  select count(*)::integer
  from platform_private.cms_entry_revisions revision
  where revision.entry_id = (select value::uuid from s10_ids where key = 'entryId')
$body$;

-- The fixed request used by the private renewal command: the session carries
-- the actor, and the command derives the person and acting party itself.
create or replace function pg_temp.s10p_touch_sql(p_extra text)
returns text
language sql
as $body$
  select 'select platform_private.cms_touch_edit_presence(jsonb_build_object('
    || '''entryId'', ' || quote_literal((select value from s10_ids where key = 'entryId'))
    || coalesce(', ' || p_extra, '') || '))'
$body$;

-- Time travel for a lease window.  No clock injection exists, so the only way
-- to reach "the window elapsed" is to move the stored window; the expiry
-- producer under test is then the real sweep.
create or replace function pg_temp.s10p_lapse_lease(p_person_key text)
returns void
language plpgsql
as $body$
begin
  perform pg_catalog.set_config('app.cms_rpc', 'true', true);
  update platform_private.cms_edit_presence presence
  set lease_until = pg_catalog.clock_timestamp() - interval '1 second'
  where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
    and presence.person_id = (select value::uuid from s10_ids where key = p_person_key);
end;
$body$;

create temp table s10p_counts(
  key text primary key,
  value integer
) on commit drop;

create temp table s10p_marks(
  key text primary key,
  last_seen_at timestamptz,
  lease_until timestamptz,
  version bigint
) on commit drop;

-- ---------------------------------------------------------------------------
-- Command surface: no browser/PostgREST-callable presence command exists.
-- ---------------------------------------------------------------------------
select ok(
  not pg_temp.s10_fn_exists('platform_api', 'cms_touch_edit_presence', 'jsonb')
    and not pg_temp.s10_fn_exists('platform_api', 'cms_release_edit_presence', 'jsonb'),
  'presence has no platform_api renewal or release command (FE03 keeps EditPresence physical-only)'
);

select ok(
  pg_temp.s10_fn_exists('platform_private', 'cms_touch_edit_presence', 'jsonb')
    and pg_temp.s10_fn_exists(
      'platform_private', 'cms_revoke_edit_presence_without_authority',
      'uuid, uuid, uuid'
    )
    and pg_temp.s10_fn_exists('platform_private', 'cms_expire_edit_presence_leases', 'integer')
    and not pg_temp.s10_fn_exists('platform_private', 'cms_release_edit_presence', 'jsonb'),
  'the private presence commands are renewal, revocation release and the expiry sweep'
);

select ok(
  not exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    cross join unnest(array['public', 'anon', 'authenticated', 'service_role']) role_name
    where namespace.nspname = 'platform_private'
      and proc.proname in (
        'cms_touch_edit_presence',
        'cms_revoke_edit_presence_without_authority',
        'cms_expire_edit_presence_leases',
        'cms_edit_presence_org_authority_trigger',
        'cms_edit_presence_assignment_trigger'
      )
      and has_function_privilege(role_name, proc.oid, 'execute')
  ),
  'no browser, anon, service or PUBLIC role can execute a private presence function'
);

select ok(
  pg_temp.s10_fn_privilege(
    'platform_api', 'cms_expire_edit_presence_leases', 'integer', 'service_role'
  )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_expire_edit_presence_leases', 'integer', 'authenticated'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_expire_edit_presence_leases', 'integer', 'anon'
    )
    and not pg_temp.s10_fn_privilege(
      'platform_api', 'cms_expire_edit_presence_leases', 'integer', 'public'
    ),
  'the expiry sweep wrapper is the only presence function a role can execute, and only service_role'
);

select ok(
  (
    select count(*) = 5
       and bool_and(proc.prosecdef)
       and bool_and(pg_get_userbyid(proc.proowner) = 'wejammin_cms_definer')
       and bool_and(coalesce(proc.proconfig, array[]::text[]) @> array['search_path=""'])
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'platform_private'
      and proc.proname in (
        'cms_touch_edit_presence',
        'cms_revoke_edit_presence_without_authority',
        'cms_expire_edit_presence_leases',
        'cms_edit_presence_org_authority_trigger',
        'cms_edit_presence_assignment_trigger'
      )
  ),
  'every presence definer is owned by the non-BYPASSRLS CMS definer and pins an empty search_path'
);

-- Revocation seams: the grant projection, the membership tenure and the entry
-- assignment each release presence in the same statement transaction.
select ok(
  (
    select count(*) = 3
    from pg_trigger trigger_row
    join pg_class table_class on table_class.oid = trigger_row.tgrelid
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    join pg_proc function_row on function_row.oid = trigger_row.tgfoid
    where not trigger_row.tgisinternal
      and trigger_row.tgenabled = 'O'
      -- AFTER ROW UPDATE OR DELETE: ROW 1 + DELETE 8 + UPDATE 16.
      and trigger_row.tgtype = 25
      and (table_namespace.nspname, table_class.relname, trigger_row.tgname, function_row.proname) in (
        ('identity_private', 'organization_actor_grant',
         'cms_organization_actor_grant_edit_presence_revocation',
         'cms_edit_presence_org_authority_trigger'),
        ('identity_private', 'membership_tenure',
         'cms_membership_tenure_edit_presence_revocation',
         'cms_edit_presence_org_authority_trigger'),
        ('platform_private', 'cms_entry_assignments',
         'cms_entry_assignments_edit_presence_revocation',
         'cms_edit_presence_assignment_trigger')
      )
  ),
  'actor-grant, tenure and entry-assignment changes each fire an AFTER ROW presence revocation trigger'
);

-- ---------------------------------------------------------------------------
-- Data path.  The editorial policy projection is fail-closed in production; the
-- same rolled-back test-only projection as the revision-write suite lets the
-- real CMS-03B-01 write run.
-- ---------------------------------------------------------------------------
savepoint s10_presence_write;
create or replace function platform_private.cms_editorial_workflow_policy_evidence(p_version_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $body$
  select jsonb_build_object(
    'key', 's10-rolled-back-fixture', 'version', '1',
    'policyHash', repeat('c', 64), 'riskClass', 'ordinary',
    'requiredDecisionCount', 1, 'requiredCapabilities', '[]'::jsonb,
    'approvalEvidenceHash', repeat('d', 64)
  )
  where p_version_id is not null
$body$;

-- The private renewal command keeps its authority proof and its CAS contract
-- even though no role can call it: it is the named lease renewal command.
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

select pg_temp.s10_rpc_probe(
  'presence_insert_cas_stale', null,
  pg_temp.s10p_touch_sql('''presenceVersion'', 1')
);
select is(
  pg_temp.s10_probe_state('presence_insert_cas_stale'), '40001',
  'a non-zero CAS pointer cannot create an absent presence row'
);

select pg_temp.s10_rpc_probe(
  'presence_unknown_field', null,
  pg_temp.s10p_touch_sql(
    '''currentFieldId'', ''a9100000-0000-4000-8000-0000000009ff'''
  )
);
select is(
  pg_temp.s10_probe_message('presence_unknown_field'), 'INVALID_REQUEST',
  'a current-field pointer that is not an active field of the entry schema is refused'
);

select pg_temp.s10_rpc_probe(
  'presence_unknown_key', null,
  pg_temp.s10p_touch_sql('''ownerId'', ''a9100000-0000-4000-8000-0000000009fe''')
);
select is(
  pg_temp.s10_probe_message('presence_unknown_key'), 'INVALID_REQUEST',
  'renewal accepts no caller-supplied owner, person or authority key'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000003'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_probe(
  'presence_touch_unassigned', null, pg_temp.s10p_touch_sql(null)
);
select is(
  pg_temp.s10_probe_message('presence_touch_unassigned'), 'FORBIDDEN',
  'a visible tenant member without edit authority cannot hold presence'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000004'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_probe(
  'presence_touch_stranger', null, pg_temp.s10p_touch_sql(null)
);
select is(
  pg_temp.s10_probe_message('presence_touch_stranger'), 'NOT_FOUND',
  'a non-member sees the entry as absent when it asks for presence'
);

select is(
  (select count(*)::integer from platform_private.cms_edit_presence presence
   where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')),
  0,
  'refused renewals leave no presence row'
);

-- ---------------------------------------------------------------------------
-- Touch-on-write: the first authorized autosave acquires the lease.
-- ---------------------------------------------------------------------------
select pg_temp.s10p_autosave('creator-1', 'a9100000-0000-4000-8000-000000000001');
select is(
  pg_temp.s10_probe_state('creator-1'), '00000',
  'the assigned author autosaves a revision through the real CMS-03B-01 write'
);

select ok(
  pg_temp.s10p_state('creatorPerson') = 'active'
    and pg_temp.s10p_version('creatorPerson') = 1,
  'the authorized write acquired one active presence lease at version one'
);

select ok(
  (
    select presence.lease_until - presence.last_seen_at = interval '2 minutes'
       and presence.current_field_id
         = (select value::uuid from s10_ids where key = 'typeFieldId')
       and presence.owner_id = (select value::uuid from s10_ids where key = 'organization')
       and presence.acting_party_id
         = (select value::uuid from s10_ids where key = 'organization')
    from platform_private.cms_edit_presence presence
    where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
      and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'the lease is two minutes wide, follows the edited field and copies the entry owner'
);

select is(
  (select entry.version
   from platform_private.cms_content_entries entry
   where entry.id = (select value::uuid from s10_ids where key = 'entryId')),
  pg_temp.s10p_revision_count()::bigint,
  'the entry version equals the committed revision count: presence added no aggregate version'
);

select ok(
  not exists (
    select 1 from audit_private.audit_events event
    where event.action like 'cms.edit_presence%'
  )
    and not exists (
      select 1 from platform_private.outbox_events outbox
      where outbox.event_type like 'cms.edit_presence%'
    ),
  'advisory renewal emits no audit or outbox event'
);

insert into s10p_marks(key, last_seen_at, lease_until, version)
select 'creator-1', presence.last_seen_at, presence.lease_until, presence.version
from platform_private.cms_edit_presence presence
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson');

select pg_temp.s10p_autosave('creator-2', 'a9100000-0000-4000-8000-000000000001');
select is(
  pg_temp.s10_probe_state('creator-2'), '00000',
  'a second autosave from the same author succeeds'
);

select ok(
  (
    select presence.version = mark.version + 1
       and presence.last_seen_at > mark.last_seen_at
       and presence.lease_until > mark.lease_until
       and presence.updated_at > presence.created_at
    from platform_private.cms_edit_presence presence
    join s10p_marks mark on mark.key = 'creator-1'
    where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
      and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'each autosave renews the lease: monotonic version, later heartbeat and later expiry'
);

select is(
  pg_temp.s10p_row_count('creatorPerson'), 1,
  'renewal keeps exactly one lease row per entry and person'
);

-- Renewal CAS on the private command: a stale pointer is refused, the current
-- pointer renews.
select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_probe(
  'presence_cas_stale', null,
  pg_temp.s10p_touch_sql('''presenceVersion'', 0')
);
select is(
  pg_temp.s10_probe_state('presence_cas_stale'), '40001',
  'a stale presence version fails the renewal CAS'
);

select pg_temp.s10_rpc_probe_persist(
  'presence_cas_current', null,
  pg_temp.s10p_touch_sql(
    '''presenceVersion'', ' || pg_temp.s10p_version('creatorPerson')::text
  )
);
select ok(
  pg_temp.s10_probe_state('presence_cas_current') = '00000'
    and pg_temp.s10p_version('creatorPerson') = 3,
  'the current presence version renews the lease'
);

-- A second editor is never blocked and never touches the first lease.
insert into s10p_marks(key, last_seen_at, lease_until, version)
select 'creator-3', presence.last_seen_at, presence.lease_until, presence.version
from platform_private.cms_edit_presence presence
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson');

select pg_temp.s10p_autosave('editor-1', 'a9100000-0000-4000-8000-000000000002');
select is(
  pg_temp.s10_probe_state('editor-1'), '00000',
  'a second assigned editor writes while the first author holds an active lease'
);

select ok(
  pg_temp.s10p_state('editorPerson') = 'active'
    and pg_temp.s10p_version('editorPerson') = 1
    and pg_temp.s10p_state('creatorPerson') = 'active',
  'both editors hold their own active lease: a lease never blocks another editor'
);

select ok(
  (
    select presence.version = mark.version
       and presence.last_seen_at = mark.last_seen_at
       and presence.lease_until = mark.lease_until
    from platform_private.cms_edit_presence presence
    join s10p_marks mark on mark.key = 'creator-3'
    where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
      and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'the second editor''s write leaves the first editor''s lease row untouched'
);

select is(
  (select entry.version
   from platform_private.cms_content_entries entry
   where entry.id = (select value::uuid from s10_ids where key = 'entryId')),
  pg_temp.s10p_revision_count()::bigint,
  'two editors'' leases still add no aggregate version beyond the committed revisions'
);

-- Authority is proven by the write, never by presence: a refused autosave
-- grants nothing and leaves no lease.
select pg_temp.s10p_autosave('outsider-1', 'a9100000-0000-4000-8000-000000000003');
select pg_temp.s10p_autosave('stranger-1', 'a9100000-0000-4000-8000-000000000004');
select ok(
  pg_temp.s10_probe_message('outsider-1') = 'FORBIDDEN'
    and pg_temp.s10_probe_message('stranger-1') = 'NOT_FOUND',
  'an unassigned member is refused FORBIDDEN and a non-member NOT_FOUND on the autosave'
);
select ok(
  pg_temp.s10p_row_count('outsiderPerson') = 0
    and pg_temp.s10p_row_count('strangerPerson') = 0,
  'a refused autosave never creates presence'
);

-- ---------------------------------------------------------------------------
-- Authority revoked during autosave/review: reject the commit and remove the
-- active presence in the same transaction as the revocation.
-- ---------------------------------------------------------------------------
select set_config('app.cms_rpc', 'true', true);

-- DEC-143 partial revocation fixture: the creator also holds a cms.editor
-- assignment on this entry beside the cms.author one, so a single grant can be
-- revoked while the other capability still authorizes the person.
insert into platform_private.cms_entry_assignments(
  owner_id, entry_id, assignee_person_id, capability_key, state, version,
  created_at, updated_at
)
select (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'entryId'),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       'cms.editor', 'active', 1, clock_timestamp(), clock_timestamp();

-- The creator never relied on a cms.editor grant for the lease (the author
-- assignment still authorizes), so revoking it must not over-release the lease.
update identity_private.organization_actor_grant
set active = false, updated_at = clock_timestamp()
where organization_id = (select value::uuid from s10_ids where key = 'organization')
  and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_code = 'cms.editor';
select ok(
  pg_temp.s10p_state('creatorPerson') = 'active',
  'revoking a capability the lease did not rely on leaves it active'
);
select ok(
  pg_temp.s10p_assignment('creatorPerson', 'cms.editor') = 'revoked'
    and pg_temp.s10p_assignment_version('creatorPerson', 'cms.editor') = 2
    and pg_temp.s10p_assignment('creatorPerson', 'cms.author') = 'active'
    and pg_temp.s10p_assignment('editorPerson', 'cms.editor') = 'active',
  'partial revocation revokes only the assignment of the capability whose grant was revoked [DEC-143]'
);

insert into s10p_marks(key, last_seen_at, lease_until, version)
select 'creator-pre-revoke', presence.last_seen_at, presence.lease_until, presence.version
from platform_private.cms_edit_presence presence
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson');

update identity_private.organization_actor_grant
set active = false, updated_at = clock_timestamp()
where organization_id = (select value::uuid from s10_ids where key = 'organization')
  and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_code = 'cms.author';
select ok(
  (
    select presence.state = 'revoked' and presence.version = mark.version + 1
    from platform_private.cms_edit_presence presence
    join s10p_marks mark on mark.key = 'creator-pre-revoke'
    where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
      and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'deactivating the author grant revokes the author''s active lease in the same statement'
);
select is(
  pg_temp.s10p_state('editorPerson'), 'active',
  'the revocation releases only the revoked person''s presence'
);
select ok(
  pg_temp.s10p_assignment('creatorPerson', 'cms.author') = 'revoked'
    and pg_temp.s10p_assignment_version('creatorPerson', 'cms.author') = 2
    and pg_temp.s10p_assignment('editorPerson', 'cms.editor') = 'active',
  'revoking the author grant revokes that person''s author assignment in the same statement and no one else''s [DEC-143]'
);

select pg_temp.s10p_autosave('creator-revoked', 'a9100000-0000-4000-8000-000000000001');
select is(
  pg_temp.s10_probe_message('creator-revoked'), 'FORBIDDEN',
  'an autosave after the authority was revoked is rejected'
);
select ok(
  pg_temp.s10p_revision_count() = 4
    and pg_temp.s10p_state('creatorPerson') = 'revoked',
  'the rejected autosave commits no revision and cannot revive the revoked presence'
);

-- DEC-143: re-granting a capability does not resurrect the revoked assignment;
-- authority over the entry needs the grant AND an active assignment, so the
-- author stays refused until an assignment is made again.
update identity_private.organization_actor_grant
set active = true, updated_at = clock_timestamp()
where organization_id = (select value::uuid from s10_ids where key = 'organization')
  and person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
select pg_temp.s10p_autosave('creator-regranted-unassigned', 'a9100000-0000-4000-8000-000000000001');
select is(
  pg_temp.s10_probe_message('creator-regranted-unassigned'), 'FORBIDDEN',
  'a re-granted capability does not restore the revoked entry assignment [DEC-143]'
);
-- Making the assignment again (the cascade of this fixture) restores the write.
update platform_private.cms_entry_assignments
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_key = 'cms.author';
select pg_temp.s10p_autosave('creator-regranted', 'a9100000-0000-4000-8000-000000000001');
select ok(
  pg_temp.s10_probe_state('creator-regranted') = '00000'
    and pg_temp.s10p_state('creatorPerson') = 'active',
  'restored authority re-acquires the lease on the next authorized write'
);

-- Entry-assignment revocation.
update platform_private.cms_entry_assignments
set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
where entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_key = 'cms.author';
select ok(
  pg_temp.s10p_state('creatorPerson') = 'revoked'
    and pg_temp.s10p_state('editorPerson') = 'active',
  'revoking the entry assignment releases that assignee''s lease'
);
update platform_private.cms_entry_assignments
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_key = 'cms.author';

-- Membership tenure ended.
update identity_private.membership_tenure
set state = 'ended', revoked_at = clock_timestamp(), updated_at = clock_timestamp()
where id = 'a9100000-0000-4000-8000-000000000201';
select ok(
  pg_temp.s10p_state('editorPerson') = 'revoked',
  'ending the membership tenure releases the editor''s lease'
);
select ok(
  pg_temp.s10p_assignment('editorPerson', 'cms.editor') = 'revoked',
  'ending the membership tenure revokes the editor''s entry assignment in the same statement [DEC-143]'
);
update identity_private.membership_tenure
set state = 'confirmed', updated_at = clock_timestamp()
where id = 'a9100000-0000-4000-8000-000000000201';
-- Restoring tenure restores authority only through a fresh assignment (DEC-143).
update platform_private.cms_entry_assignments
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and assignee_person_id = (select value::uuid from s10_ids where key = 'editorPerson')
  and capability_key = 'cms.editor';

-- Grant deletion.
select pg_temp.s10p_autosave('creator-reacquire', 'a9100000-0000-4000-8000-000000000001');
select pg_temp.s10p_autosave('editor-reacquire', 'a9100000-0000-4000-8000-000000000002');
select ok(
  pg_temp.s10p_state('creatorPerson') = 'active'
    and pg_temp.s10p_state('editorPerson') = 'active',
  'both editors re-acquire after assignment and tenure are restored'
);
delete from identity_private.organization_actor_grant
where organization_id = (select value::uuid from s10_ids where key = 'organization')
  and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_code = 'cms.author';
select ok(
  pg_temp.s10p_state('creatorPerson') = 'revoked'
    and pg_temp.s10p_state('editorPerson') = 'active',
  'deleting the author grant releases the author''s lease'
);
select ok(
  pg_temp.s10p_assignment('creatorPerson', 'cms.author') = 'revoked'
    and pg_temp.s10p_assignment('editorPerson', 'cms.editor') = 'active',
  'deleting the author grant revokes only that person''s author assignment [DEC-143]'
);
insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
values (
  (select value::uuid from s10_ids where key = 'organization'),
  (select value::uuid from s10_ids where key = 'creatorPerson'),
  'cms.author', current_date, current_date + 1, true
);
-- The re-inserted grant restores authority only through a fresh assignment.
update platform_private.cms_entry_assignments
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and assignee_person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_key = 'cms.author';

-- ---------------------------------------------------------------------------
-- Expiry: the service-role sweep marks lapsed leases expired (never revoked),
-- is bounded, idempotent, and an expired lease never blocks anyone.
-- ---------------------------------------------------------------------------
select pg_temp.s10p_autosave('creator-sweep', 'a9100000-0000-4000-8000-000000000001');
select ok(
  pg_temp.s10_probe_state('creator-sweep') = '00000'
    and pg_temp.s10p_state('creatorPerson') = 'active',
  'the author holds an active lease before the window lapses'
);

insert into s10p_marks(key, last_seen_at, lease_until, version)
select 'creator-pre-expire', presence.last_seen_at, presence.lease_until, presence.version
from platform_private.cms_edit_presence presence
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson');

select is(
  (pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(10)'))
    ->> 'expiredLeases',
  '0',
  'a sweep over only unexpired leases retires nothing'
);

select pg_temp.s10p_lapse_lease('creatorPerson');
create temp table s10p_sweep_result on commit drop as
select pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(10)') as result;
select is(
  (select result - 'activeLeases' from s10p_sweep_result),
  '{"expiredLeases": 1}'::jsonb,
  'the sweep answers the retired lease count (plus the activeLeases gauge, lane I request)'
);
select is(
  (select (result->>'activeLeases')::integer from s10p_sweep_result),
  (select count(*)::integer from platform_private.cms_edit_presence where state = 'active'),
  'the sweep answers the number of leases still active after it (the cms_presence_active gauge)'
);

select ok(
  (
    select presence.state = 'expired' and presence.version = mark.version + 1
    from platform_private.cms_edit_presence presence
    join s10p_marks mark on mark.key = 'creator-pre-expire'
    where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
      and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  ),
  'a lapsed lease is marked expired under a monotonic version, never revoked'
);

select is(
  pg_temp.s10p_state('editorPerson'), 'active',
  'the sweep leaves an unexpired lease active'
);

select is(
  (pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(10)'))
    ->> 'expiredLeases',
  '0',
  'the sweep is idempotent: an expired lease is not retired twice'
);

select pg_temp.s10p_autosave('creator-after-expiry', 'a9100000-0000-4000-8000-000000000001');
select ok(
  pg_temp.s10_probe_state('creator-after-expiry') = '00000'
    and pg_temp.s10p_state('creatorPerson') = 'active',
  'an expired lease never blocks its holder: the next authorized write re-acquires it'
);

select pg_temp.s10p_lapse_lease('creatorPerson');
select pg_temp.s10p_lapse_lease('editorPerson');
select is(
  (pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(1)'))
    ->> 'expiredLeases',
  '1',
  'the sweep honours its batch bound'
);
select is(
  (pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(1)'))
    ->> 'expiredLeases',
  '1',
  'a full batch leaves the remainder for the next tick'
);
select is(
  (pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(1)'))
    ->> 'expiredLeases',
  '0',
  'a drained sweep retires nothing'
);
select ok(
  pg_temp.s10p_state('creatorPerson') = 'expired'
    and pg_temp.s10p_state('editorPerson') = 'expired',
  'both lapsed leases ended expired'
);

select pg_temp.s10_rpc_probe(
  'sweep_batch_zero', null, 'select platform_api.cms_expire_edit_presence_leases(0)'
);
select pg_temp.s10_rpc_probe(
  'sweep_batch_over', null, 'select platform_api.cms_expire_edit_presence_leases(5001)'
);
select pg_temp.s10_rpc_probe(
  'sweep_batch_null', null, 'select platform_api.cms_expire_edit_presence_leases(null)'
);
select ok(
  pg_temp.s10_probe_message('sweep_batch_zero') = 'INVALID_REQUEST'
    and pg_temp.s10_probe_message('sweep_batch_over') = 'INVALID_REQUEST'
    and pg_temp.s10_probe_message('sweep_batch_null') = 'INVALID_REQUEST',
  'the sweep refuses a batch outside 1..5000'
);

-- A same-field conflict is still an authorized autosave: the durable conflict
-- disposition commits and the lease renews, while no revision is appended.
insert into s10p_marks(key, last_seen_at, lease_until, version)
select 'editor-pre-conflict', presence.last_seen_at, presence.lease_until, presence.version
from platform_private.cms_edit_presence presence
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'editorPerson');
insert into s10p_counts(key, value)
values ('revisions-pre-conflict', pg_temp.s10p_revision_count());

select pg_temp.s10p_autosave(
  'editor-conflict', 'a9100000-0000-4000-8000-000000000002', 1
);
select ok(
  pg_temp.s10_probe_state('editor-conflict') = '00000'
    and pg_temp.s10_probe_response('editor-conflict') ->> 'kind' = 'conflict'
    and pg_temp.s10_probe_response('editor-conflict') ->> 'code' = 'VERSION_MISMATCH',
  'a same-field divergence returns the committed private conflict disposition'
);
select ok(
  pg_temp.s10p_state('editorPerson') = 'active'
    and pg_temp.s10p_version('editorPerson') = (
      select mark.version + 1
      from s10p_marks mark where mark.key = 'editor-pre-conflict'
    )
    and pg_temp.s10p_revision_count() = (
      select value from s10p_counts where key = 'revisions-pre-conflict'
    ),
  'the conflict disposition renews the lease and appends no revision'
);

-- NEGATIVE CONTROL: presence is never authority.  A forged active lease on a
-- person whose authority was revoked (the row is put back by hand, which no
-- producer does) must not let the write through.
select set_config('app.cms_rpc', 'true', true);
update identity_private.organization_actor_grant
set active = false, updated_at = clock_timestamp()
where organization_id = (select value::uuid from s10_ids where key = 'organization')
  and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
  and capability_code = 'cms.author';
update platform_private.cms_edit_presence presence
set state = 'active',
    lease_until = pg_catalog.clock_timestamp() + interval '2 minutes'
where presence.entry_id = (select value::uuid from s10_ids where key = 'entryId')
  and presence.person_id = (select value::uuid from s10_ids where key = 'creatorPerson');
insert into s10p_counts(key, value)
values ('revisions-pre-forged', pg_temp.s10p_revision_count());
select pg_temp.s10p_autosave('creator-forged-lease', 'a9100000-0000-4000-8000-000000000001');
select ok(
  pg_temp.s10_probe_message('creator-forged-lease') = 'FORBIDDEN'
    and pg_temp.s10p_state('creatorPerson') = 'active'
    and pg_temp.s10p_revision_count() = (
      select value from s10p_counts where key = 'revisions-pre-forged'
    ),
  'an active lease alone grants no write authority: the revoked author is refused'
);

-- The wrapper must hand the RPC-context flag back exactly as it found it.
select set_config('app.cms_rpc', '', true);
select pg_temp.s10_rpc_exec('select platform_api.cms_expire_edit_presence_leases(5)');
select is(
  coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''), '',
  'the sweep wrapper restores the transaction-local RPC-context flag'
);
select set_config('app.cms_rpc', 'true', true);

rollback to savepoint s10_presence_write;
release savepoint s10_presence_write;

-- ---------------------------------------------------------------------------
-- Closed schema facts that must survive the wiring.
-- ---------------------------------------------------------------------------
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

select ok(
  pg_temp.s10_no_table_privilege(
    'platform_private.cms_edit_presence', 'authenticated'
  )
    and pg_temp.s10_no_table_privilege(
      'platform_private.cms_edit_presence', 'anon'
    ),
  'presence stays private with no browser table grant'
);

select ok(
  pg_temp.s10r_closed_check_labels(
    'platform_private.cms_edit_presence', 'state'
  ) = array['active','expired','revoked']::text[],
  'presence keeps the closed active/expired/revoked lease union'
);

select finish();
rollback;
