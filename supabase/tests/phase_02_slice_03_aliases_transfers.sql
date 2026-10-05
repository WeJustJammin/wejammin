\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S03-AC-027..068 / BE01b-05..11.  These are intentionally RED until
-- the Slice 03 alias authority migration exists.  The assertions use catalog
-- metadata for absent relations so the RED run reports every missing surface
-- instead of aborting on the first undefined table.

-- The canonical alias/handle/transfer state lives in platform_private.
select has_table('platform_private', 'handle_reservation',
  'BE01b handle reservation table exists');
select has_table('platform_private', 'alias_party',
  'BE01b alias party table exists');
select has_table('platform_private', 'alias_transfer_offer',
  'BE01b transfer offer table exists');
select has_table('platform_private', 'alias_ownership_period',
  'BE01b immutable ownership-period table exists');

select ok(
  coalesce((select array_agg(enumlabel order by enumsortorder)::text[]
    from pg_enum where enumtypid = to_regtype('platform_private.alias_lifecycle')),
    '{}'::text[]) = array['active', 'transfer_pending', 'transferred', 'retired']::text[],
  'alias lifecycle is the closed four-state enum'
);
select ok(
  coalesce((select array_agg(enumlabel order by enumsortorder)::text[]
    from pg_enum where enumtypid = to_regtype('platform_private.public_link_state')),
    '{}'::text[]) = array['private', 'public']::text[],
  'public link state is the closed private/public enum'
);
select ok(
  coalesce((select array_agg(enumlabel order by enumsortorder)::text[]
    from pg_enum where enumtypid = to_regtype('platform_private.handle_state')),
    '{}'::text[]) = array['active', 'redirect', 'retired']::text[],
  'handle state is the closed active/redirect/retired enum'
);
select ok(
  coalesce((select array_agg(enumlabel order by enumsortorder)::text[]
    from pg_enum where enumtypid = to_regtype('platform_private.transfer_offer_state')),
    '{}'::text[]) = array['pending', 'accepted', 'declined', 'expired', 'cancelled']::text[],
  'transfer offer state is the closed offer-state enum'
);

select ok(
  coalesce((select array_agg(column_name::text order by column_name)
    from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'handle_reservation'),
    '{}'::text[]) @> array[
      'id', 'normalized_handle', 'display_handle', 'party_id', 'state',
      'successor_handle_id', 'first_used_at', 'last_used_at', 'retired_at',
      'version', 'created_at', 'updated_at'
    ]::text[],
  'handle reservations expose the immutable normalized and redirect fields'
);
select ok(
  coalesce((select array_agg(column_name::text order by column_name)
    from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'alias_party'),
    '{}'::text[]) @> array[
      'party_id', 'display_name', 'current_handle_id', 'lifecycle',
      'public_link_state', 'version', 'created_at', 'updated_at'
    ]::text[],
  'alias parties expose lifecycle, public-link, handle, and version fields'
);
select ok(
  coalesce((select array_agg(column_name::text order by column_name)
    from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'alias_transfer_offer'),
    '{}'::text[]) @> array[
      'id', 'alias_id', 'offering_person_id', 'recipient_person_id', 'state',
      'offered_at', 'expires_at', 'accepted_at', 'declined_at', 'closed_at',
      'version', 'created_at', 'updated_at'
    ]::text[],
  'transfer offers retain named parties, seven-day timestamps, and CAS fields'
);
select ok(
  coalesce((select array_agg(column_name::text order by column_name)
    from information_schema.columns
    where table_schema = 'platform_private' and table_name = 'alias_ownership_period'),
    '{}'::text[]) @> array[
      'id', 'alias_id', 'owner_person_id', 'starts_at', 'ends_at', 'transfer_id',
      'version', 'created_at', 'updated_at'
    ]::text[],
  'ownership periods retain dated owner history and transfer attribution'
);

-- Reservation, history, and transfer race constraints are catalog-visible.
select has_index('platform_private', 'handle_reservation', 'handle_party_state',
  'handle lookup is indexed by party and lifecycle state');
select has_index('platform_private', 'handle_reservation', 'handle_successor',
  'permanent handle redirects have a successor index');
select has_index('platform_private', 'alias_party', 'alias_public_lookup',
  'public alias projection lookup is bounded by handle/lifecycle/public state');
select has_index('platform_private', 'alias_transfer_offer', 'one_pending_alias_transfer',
  'one pending transfer offer is enforced per alias');
select has_index('platform_private', 'alias_transfer_offer', 'transfer_recipient_pending',
  'pending offers are indexed by named recipient and expiry');
select has_index('platform_private', 'alias_ownership_period', 'alias_one_current_owner',
  'at most one open ownership period exists per alias');
select has_index('platform_private', 'alias_ownership_period', 'alias_owner_history',
  'ownership history is indexed by owner and start time');
select ok(
  exists (
    select 1 from pg_index
    where indrelid = to_regclass('platform_private.handle_reservation')
      and indisunique
      and pg_get_indexdef(indexrelid) like '%normalized_handle%'
  ),
  'normalized handle reservation is globally unique and never reissued'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.alias_ownership_period')
      and contype = 'x' and conname = 'alias_periods_do_not_overlap'
  ),
  'ownership periods use a GiST exclusion constraint for non-overlap'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('platform_private.alias_party')
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%current_handle_id%'
      and pg_get_constraintdef(oid) like '%handle_reservation%'
  ),
  'an alias current handle must reference a reservation row'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = to_regclass('platform_private.handle_reservation')
      and not tgisinternal and (tgtype & 8) <> 0 and (tgtype & 16) <> 0
  ),
  'handle reservation history rejects update and delete rewrites'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = to_regclass('platform_private.alias_ownership_period')
      and not tgisinternal and (tgtype & 8) <> 0 and (tgtype & 16) <> 0
  ),
  'ownership periods are immutable append-only history'
);

-- All seven commands are named API RPCs.  They read actor/idempotency context
-- server-side; no caller-supplied owner or recipient shortcut is acceptable.
select ok((select count(distinct p.proname) = 7
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'platform_api'
    and p.proname in (
      'identity_alias_create', 'identity_alias_patch', 'identity_handle_change',
      'identity_alias_retire', 'identity_transfer_offer_create',
      'identity_transfer_accept', 'identity_transfer_decline'
    )), 'all BE01b-05..11 named API RPCs exist');
select ok(
  (select count(distinct p.proname) = 7 and bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_api'
     and p.proname in (
       'identity_alias_create', 'identity_alias_patch', 'identity_handle_change',
       'identity_alias_retire', 'identity_transfer_offer_create',
       'identity_transfer_accept', 'identity_transfer_decline'
     )),
  'authenticated callers execute alias and transfer commands through named RPCs'
);
select ok(
  (select count(distinct p.proname) = 7 and bool_and(not has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_api'
     and p.proname in (
       'identity_alias_create', 'identity_alias_patch', 'identity_handle_change',
       'identity_alias_retire', 'identity_transfer_offer_create',
       'identity_transfer_accept', 'identity_transfer_decline'
     )),
  'anonymous callers cannot execute alias or transfer commands'
);
select ok(
  (select count(distinct p.proname) = 7 and bool_and(not has_function_privilege('service_role', p.oid, 'execute'))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_api'
     and p.proname in (
       'identity_alias_create', 'identity_alias_patch', 'identity_handle_change',
       'identity_alias_retire', 'identity_transfer_offer_create',
       'identity_transfer_accept', 'identity_transfer_decline'
     )),
  'service role has no blanket alias or transfer API bypass'
);
select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api' and p.proname = 'identity_alias_create'
      and pg_get_functiondef(p.oid) ~ 'ALIAS_QUOTA_EXCEEDED'
      and pg_get_functiondef(p.oid) ~* '30[[:space:]]+days'),
  'alias creation RPC enforces five creations per rolling thirty days'
);
select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api' and p.proname = 'identity_handle_change'
      and pg_get_functiondef(p.oid) ~ 'HANDLE_QUOTA_EXCEEDED'
      and pg_get_functiondef(p.oid) ~* '12[[:space:]]+months'),
  'handle change RPC enforces two changes per rolling twelve months'
);
select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api' and p.proname = 'identity_transfer_offer_create'
      and pg_get_functiondef(p.oid) ~* '7[[:space:]]+days'),
  'transfer-offer RPC sets an exact seven-day expiry window'
);
select ok(
  (select count(*) = 7
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'platform_api'
     and p.proname in (
       'identity_alias_create', 'identity_alias_patch', 'identity_handle_change',
       'identity_alias_retire', 'identity_transfer_offer_create',
       'identity_transfer_accept', 'identity_transfer_decline'
     )
     and pg_get_functiondef(p.oid) like '%idempot%'),
  'every alias/transfer command binds its mutation to idempotency state'
);

-- Private state is force-RLS protected and never writable/readable through a
-- table grant.  Only narrow platform_api RPCs expose participant projections.
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = to_regclass('platform_private.handle_reservation')), false),
  'handle reservations enable and force RLS');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = to_regclass('platform_private.alias_party')), false),
  'alias parties enable and force RLS');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = to_regclass('platform_private.alias_transfer_offer')), false),
  'transfer offers enable and force RLS');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class
  where oid = to_regclass('platform_private.alias_ownership_period')), false),
  'ownership periods enable and force RLS');
select ok(
  (select count(*) = 12 and bool_and(case when to_regclass(t.table_name) is null then false
    else not has_table_privilege(r.role_name, t.table_name, 'select')
      and not has_table_privilege(r.role_name, t.table_name, 'insert')
      and not has_table_privilege(r.role_name, t.table_name, 'update')
      and not has_table_privilege(r.role_name, t.table_name, 'delete') end)
   from (values ('anon'::name), ('authenticated'::name), ('service_role'::name)) r(role_name)
   cross join (values
     ('platform_private.handle_reservation'::text), ('platform_private.alias_party'::text),
     ('platform_private.alias_transfer_offer'::text), ('platform_private.alias_ownership_period'::text)
   ) t(table_name)),
  'browser and service roles receive no direct alias/handle/transfer table grants'
);
select ok(exists (select 1 from pg_policies where schemaname = 'platform_private'
  and tablename = 'alias_party' and policyname = 'alias_owner_rows'),
  'alias visibility is restricted to the current owner period');
select ok(exists (select 1 from pg_policies where schemaname = 'platform_private'
  and tablename = 'alias_transfer_offer' and policyname = 'transfer_participant_rows'),
  'transfer visibility is restricted to the named participants');
select ok(exists (select 1 from pg_policies where schemaname = 'platform_private'
  and tablename = 'alias_ownership_period' and policyname = 'alias_period_owner_rows'),
  'ownership history visibility is restricted to named owners');

-- A minimal active-person fixture allows the RED calls to become executable
-- once the alias migration lands.  It contains no client-selected authority.
select lives_ok($$insert into auth.users(id)
  values ('93222222-2222-4222-8222-222222222222')$$,
  'the alias RED fixture Auth subject is accepted');
select lives_ok($$insert into platform_private.party(id, kind)
  values
    ('93222222-2222-4222-8222-222222222223', 'person'),
    ('93222222-2222-4222-8222-222222222224', 'person')$$,
  'the alias RED fixture creates two canonical person parties');
select lives_ok($$insert into platform_private.person_party(party_id, auth_user_id, account_state)
  values
    ('93222222-2222-4222-8222-222222222223', '93222222-2222-4222-8222-222222222222', 'active'),
    ('93222222-2222-4222-8222-222222222224', null, 'claimed')$$,
  'the alias RED fixture has one active actor and one recipient person');
select pg_temp.set_jwt_claim('sub', '93222222-2222-4222-8222-222222222222', true);
select set_config('app.auth_user_id', '93222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_auth_user_id', '93222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_person_id', '93222222-2222-4222-8222-222222222223', true);
select set_config('app.request_id', '93222222-2222-4222-8222-222222222225', true);
select set_config('app.correlation_id', '93222222-2222-4222-8222-222222222226', true);

-- BE01b-05: valid creation, normalized collision, display-name collision,
-- five-per-thirty-day quota, and replay/mismatch behavior.
select set_config('app.idempotency_key', 'slice03-alias-create-01', true);
select set_config('app.idempotency_key_hash', repeat('91', 32), true);
select set_config('app.request_hash', repeat('a1', 32), true);
select lives_ok($$select platform_api.identity_alias_create(
  'Neon Harbor', 'neon.harbor', 'private')$$,
  'P2-S03-AC-027 creates an owned alias with a server-normalized handle');
select set_config('app.idempotency_key', 'slice03-alias-create-collision', true);
select set_config('app.idempotency_key_hash', repeat('92', 32), true);
select set_config('app.request_hash', repeat('a2', 32), true);
select throws_ok($$select platform_api.identity_alias_create(
  'Other Display', 'Ｎｅｏｎ.Ｈａｒｂｏｒ', 'private')$$,
  'P0001', 'HANDLE_TAKEN',
  'P2-S03-AC-153 rejects a Unicode confusable-normalized handle without owner disclosure');
select set_config('app.idempotency_key', 'slice03-alias-create-02', true);
select set_config('app.idempotency_key_hash', repeat('93', 32), true);
select set_config('app.request_hash', repeat('a3', 32), true);
select lives_ok($$select platform_api.identity_alias_create(
  'Neon Harbor', 'neon.beat', 'private')$$,
  'display-name collisions remain allowed when the normalized handle is unique');
select set_config('app.idempotency_key', 'slice03-alias-create-replay', true);
select set_config('app.idempotency_key_hash', repeat('91', 32), true);
select set_config('app.request_hash', repeat('a1', 32), true);
select lives_ok($$select platform_api.identity_alias_create(
  'Neon Harbor', 'neon.harbor', 'private')$$,
  'same alias-create idempotency binding replays the original result');
select set_config('app.idempotency_key', 'slice03-alias-create-mismatch', true);
select set_config('app.idempotency_key_hash', repeat('91', 32), true);
select set_config('app.request_hash', repeat('af', 32), true);
select throws_ok($$select platform_api.identity_alias_create(
  'Changed Request', 'neon.other', 'private')$$,
  'P0001', 'IDEMPOTENCY_MISMATCH',
  'same alias-create key with a different request hash is rejected');

-- BE01b-06..08: owner/CAS, permanent handle history, and terminal retirement.
select throws_ok($$select platform_api.identity_alias_patch(
  '93222222-2222-4222-8222-222222222299', 'Changed', 'private', 0)$$,
  'P0001', 'ALIAS_NOT_FOUND',
  'P2-S03-AC-034 conceals an unreadable alias patch target');
select throws_ok($$select platform_api.identity_handle_change(
  '93222222-2222-4222-8222-222222222299', 'new-handle', 0)$$,
  'P0001', 'ALIAS_NOT_FOUND',
  'P2-S03-AC-040 conceals an unreadable alias handle target');
select throws_ok($$select platform_api.identity_alias_retire(
  '93222222-2222-4222-8222-222222222299', 0)$$,
  'P0001', 'ALIAS_NOT_FOUND',
  'P2-S03-AC-046 conceals an unreadable alias retirement target');

-- BE01b-09..11: offer creation and separately named accept/decline commands.
select throws_ok($$select platform_api.identity_transfer_offer_create(
  '93222222-2222-4222-8222-222222222299',
  '93222222-2222-4222-8222-222222222224')$$,
  'P0001', 'ALIAS_NOT_FOUND',
  'P2-S03-AC-052 conceals an unreadable transfer-offer target');
select throws_ok($$select platform_api.identity_transfer_accept(
  '93222222-2222-4222-8222-222222222299', 0)$$,
  'P0001', 'TRANSFER_NOT_FOUND',
  'P2-S03-AC-058 uses a named recipient-only transfer accept command');
select throws_ok($$select platform_api.identity_transfer_decline(
  '93222222-2222-4222-8222-222222222299', 0)$$,
  'P0001', 'TRANSFER_NOT_FOUND',
  'P2-S03-AC-064 uses a named recipient/owner transfer decline command');

-- Audit/outbox effects must be one transaction with the source mutation and
-- identifier-only payloads.  Failed calls above must not create effects.
select ok(
  exists (select 1 from audit_private.audit_events
    where action in ('identity.alias.create', 'identity.alias.patch',
      'identity.handle.change', 'identity.alias.retire',
      'identity.transfer.offer', 'identity.transfer.accept',
      'identity.transfer.decline')),
  'alias/transfer mutations write durable audit events when committed'
);
select ok(
  exists (select 1 from platform_private.outbox_events
    where event_type = 'identity.alias.changed.v1'
      and aggregate_type = 'alias')
  and not exists (select 1 from platform_private.outbox_events
    where event_type = 'identity.alias.changed.v1'
      and (payload ? 'displayName' or payload ? 'handle'
        or payload ? 'ownerPersonId' or payload ? 'recipientPersonId')),
  'alias events are transactional and identifier-only/redacted'
);
select ok(
  not exists (select 1 from audit_private.audit_events
    where action in ('identity.alias.patch', 'identity.handle.change',
      'identity.alias.retire', 'identity.transfer.offer',
      'identity.transfer.accept', 'identity.transfer.decline')
      and target_id = '93222222-2222-4222-8222-222222222299'),
  'not-found, stale, and unauthorized mutations emit no audit effect'
);

select * from finish();
rollback;
