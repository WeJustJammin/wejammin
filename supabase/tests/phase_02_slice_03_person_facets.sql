\ir support/jwt-claims.sqlinc
begin;
select plan(55);

-- P2-S03-AC-138..145 / AC150..153: the Slice 03 person/facet authority
-- surface extends the Slice 01 party spine. It must not create a second
-- person model, and all writes must pass through the named API RPCs.
select has_table('platform_private', 'party', 'Slice 01 party spine is reused');
select has_table('platform_private', 'person_party', 'Slice 01 person table is reused');
select has_table('platform_private', 'acting_context_binding', 'Slice 01 context table is reused');
select has_table(
  'platform_private',
  'role_facet_assertion',
  'the role facet assertion history table exists'
);

select ok(
  to_regtype('platform_private.facet_state') is not null,
  'facet state is a closed database enum'
);
select ok(
  to_regtype('platform_private.facet_source') is not null,
  'facet source is a closed database enum'
);
select has_index(
  'platform_private',
  'role_facet_assertion',
  'facet_one_active_per_person',
  'one active assertion per person/facet is enforced'
);
select has_index(
  'platform_private',
  'role_facet_assertion',
  'facet_person_history',
  'facet history has a deterministic person timeline index'
);
select ok(
  coalesce(
    (
      select relrowsecurity and relforcerowsecurity
      from pg_class
      where oid = to_regclass('platform_private.person_party')
    ),
    false
  ),
  'the reused person table remains force-RLS protected'
);
select ok(
  coalesce(
    (
      select relrowsecurity and relforcerowsecurity
      from pg_class
      where oid = to_regclass('platform_private.role_facet_assertion')
    ),
    false
  ),
  'facet assertions force RLS'
);
select ok(
  not has_table_privilege('anon', 'platform_private.person_party', 'select'),
  'anonymous callers cannot read person rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'platform_private.person_party', 'select'),
  'authenticated callers cannot read person rows directly'
);
select ok(
  case
    when to_regclass('platform_private.role_facet_assertion') is null then false
    else not has_table_privilege('anon', 'platform_private.role_facet_assertion', 'select')
  end,
  'anonymous callers cannot read facet rows directly'
);
select ok(
  case
    when to_regclass('platform_private.role_facet_assertion') is null then false
    else not has_table_privilege('authenticated', 'platform_private.role_facet_assertion', 'select')
  end,
  'authenticated callers cannot read facet rows directly'
);
select ok(
  case
    when to_regclass('platform_private.role_facet_assertion') is null then false
    else not has_table_privilege('service_role', 'platform_private.role_facet_assertion', 'insert')
  end,
  'service role cannot bypass the facet API with a direct insert'
);

select has_function(
  'platform_api',
  'identity_create',
  array[]::text[],
  'identity create RPC exists'
);
select has_function(
  'platform_api',
  'identity_facet_add',
  array['text']::text[],
  'facet add RPC exists'
);
select has_function(
  'platform_api',
  'identity_facet_remove',
  array['text', 'bigint']::text[],
  'facet remove RPC exists'
);
select ok(
  case
    when to_regprocedure('platform_api.identity_create()') is null then false
    else has_function_privilege('authenticated', 'platform_api.identity_create()', 'execute')
  end,
  'authenticated callers may execute identity create only through the API'
);
select ok(
  case
    when to_regprocedure('platform_api.identity_create()') is null then false
    else not has_function_privilege('anon', 'platform_api.identity_create()', 'execute')
  end,
  'anonymous callers cannot execute identity create'
);

-- A verified Auth subject starts with no person. The context settings model
-- the authenticated request boundary used by the Hono adapter.
select lives_ok(
  $$insert into auth.users(id) values ('93111111-1111-4111-8111-111111111111')$$,
  'the verified Auth fixture is accepted'
);
select pg_temp.set_jwt_claim('sub', '93111111-1111-4111-8111-111111111111', true);
select set_config('app.auth_user_id', '93111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', '93111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', '', true);
select set_config('app.request_id', '93111111-1111-4111-8111-111111111112', true);
select set_config('app.correlation_id', '93111111-1111-4111-8111-111111111113', true);
select set_config('app.idempotency_key', 'slice03-person-create-a', true);
select set_config('app.idempotency_key_hash', repeat('11', 32), true);
select set_config('app.request_hash', repeat('22', 32), true);

select lives_ok(
  $$select platform_api.identity_create()$$,
  'P2-S03-AC-138 creates one person and its self acting context'
);
select is(
  (select count(*)::integer from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111'),
  1,
  'one person is bound to the Auth UUID'
);
select is(
  (
    select count(*)::integer
    from platform_private.party p
    join platform_private.person_party person on person.party_id = p.id
    where person.auth_user_id = '93111111-1111-4111-8111-111111111111'
      and p.kind = 'person'
  ),
  1,
  'person creation reuses exactly one person party'
);
select is(
  (
    select count(*)::integer
    from platform_private.acting_context_binding context
    join platform_private.person_party person on person.party_id = context.person_id
    where person.auth_user_id = '93111111-1111-4111-8111-111111111111'
      and context.acting_party_id = context.person_id
  ),
  1,
  'person creation creates exactly one self acting context'
);
select is(
  (
    select count(*)::integer
    from audit_private.audit_events audit
    join platform_private.person_party person on person.party_id = audit.target_id
    where person.auth_user_id = '93111111-1111-4111-8111-111111111111'
      and audit.action = 'identity.person.create'
  ),
  1,
  'person creation writes one durable audit event'
);
select is(
  (
    select count(*)::integer
    from platform_private.outbox_events event
    join platform_private.person_party person on person.party_id = event.aggregate_id
    where person.auth_user_id = '93111111-1111-4111-8111-111111111111'
      and event.aggregate_type = 'person'
  ),
  1,
  'person creation writes one durable outbox event'
);
select lives_ok(
  $$select platform_api.identity_create()$$,
  'P2-S03-AC-138 repeats the same idempotency key safely'
);
select is(
  (select count(*)::integer from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111'),
  1,
  'the create replay cannot create a duplicate person'
);
select is(
  (
    select count(*)::integer
    from platform_private.outbox_events event
    join platform_private.person_party person on person.party_id = event.aggregate_id
    where person.auth_user_id = '93111111-1111-4111-8111-111111111111'
      and event.aggregate_type = 'person'
  ),
  1,
  'the create replay emits no duplicate outbox effect'
);
select set_config('app.idempotency_key', 'slice03-person-create-b', true);
select set_config('app.idempotency_key_hash', repeat('33', 32), true);
select throws_ok(
  $$select platform_api.identity_create()$$,
  'P0001',
  'PERSON_ALREADY_EXISTS',
  'P2-S03-AC-139 rejects a duplicate Auth UUID with a typed refusal'
);
select set_config(
  'app.actor_person_id',
  coalesce(
    (select party_id::text from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111'),
    ''
  ),
  true
);
select set_config('app.idempotency_key', 'slice03-facet-add-a', true);
select set_config('app.idempotency_key_hash', repeat('44', 32), true);
select set_config('app.request_hash', repeat('55', 32), true);
select lives_ok(
  $$select platform_api.identity_facet_add('performer')$$,
  'P2-S03-AC-141 adds one registered self asserted facet'
);
select is(
  (
    select count(*)::integer
    from platform_private.role_facet_assertion facet
    where facet.person_id = (select party_id from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111')
      and facet.facet_code = 'performer'
      and facet.state = 'active'
  ),
  1,
  'facet add creates exactly one active assertion'
);
select is(
  (
    select count(*)::integer
    from platform_private.role_facet_assertion facet
    where facet.person_id = (select party_id from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111')
      and facet.facet_code = 'performer'
      and facet.source = 'self_asserted'
  ),
  1,
  'facet add cannot choose a curation or operator source'
);
select is(
  (
    select count(*)::integer
    from audit_private.audit_events audit
    where audit.action = 'identity.facet.add'
      and audit.target_id = (select party_id from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111')
  ),
  1,
  'facet add writes one durable audit event'
);
select is(
  (
    select count(*)::integer
    from platform_private.outbox_events event
    where event.event_type = 'identity.facet.changed.v1'
      and event.aggregate_id = (select party_id from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111')
      and event.payload ? 'personId'
      and event.payload ? 'facetCode'
      and not (event.payload ? 'source')
  ),
  1,
  'facet add emits a redacted canonical facet event'
);
select throws_ok(
  $$select platform_api.identity_facet_add('director')$$,
  'P0001',
  'FACET_UNKNOWN',
  'P2-S03-AC-141 rejects a facet outside the current registry'
);
set local role authenticated;
select throws_ok(
  $$insert into platform_private.role_facet_assertion(person_id, facet_code, state, source, asserted_at)
    values ('93111111-1111-4111-8111-111111111111', 'performer', 'active', 'curation_approved', clock_timestamp())$$,
  '42501',
  null,
  'P2-S03-AC-141 denies direct curation-source insertion to callers'
);
reset role;
select pg_temp.set_jwt_claim('sub', '93111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', coalesce((select party_id::text from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111'), ''), true);
select throws_ok(
  $$select platform_api.identity_facet_add('performer')$$,
  'P0001',
  'FACET_EXISTS',
  'P2-S03-AC-142 rejects a duplicate active facet without mutation'
);
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'identity.facet.add'),
  1,
  'duplicate and unknown facet attempts write no audit event'
);
select is(
  (select count(*)::integer from platform_private.outbox_events where event_type = 'identity.facet.changed.v1'),
  1,
  'duplicate and unknown facet attempts write no outbox event'
);

select throws_ok(
  $$select platform_api.identity_facet_remove('performer', 0)$$,
  'P0001',
  'VERSION_MISMATCH',
  'P2-S03-AC-151 rejects a stale single-facet compare-and-swap'
);
select is(
  (select count(*)::integer from platform_private.role_facet_assertion where facet_code = 'performer' and state = 'active'),
  1,
  'a stale facet remove leaves the active assertion intact'
);
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'identity.facet.remove'),
  0,
  'a stale facet remove writes no audit event'
);
select lives_ok(
  $remove$select platform_api.identity_facet_remove(
    'performer',
    (select version from platform_private.person_party where auth_user_id = '93111111-1111-4111-8111-111111111111')
  )$remove$,
  'P2-S03-AC-141 removes one active facet with the current person version'
);
select is(
  (select count(*)::integer from platform_private.role_facet_assertion where facet_code = 'performer' and state = 'active'),
  0,
  'successful facet removal closes the active assertion'
);
select is(
  (select count(*)::integer from platform_private.role_facet_assertion where facet_code = 'performer'),
  1,
  'P2-S03-AC-142 retains the removed facet history'
);
select ok(
  (
    select state = 'removed' and removed_at is not null
    from platform_private.role_facet_assertion
    where facet_code = 'performer'
  ),
  'removed facet history records its terminal timestamp'
);
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'identity.facet.remove'),
  1,
  'facet removal writes one durable audit event'
);
select is(
  (select count(*)::integer from platform_private.outbox_events where event_type = 'identity.facet.changed.v1'),
  2,
  'facet removal emits one additional canonical facet event'
);
select lives_ok(
  $$select platform_api.identity_facet_add('performer')$$,
  'a removed facet may be reasserted without deleting history'
);
select is(
  (select count(*)::integer from platform_private.role_facet_assertion where facet_code = 'performer' and state = 'active'),
  1,
  'reassertion restores one active facet only'
);
select is(
  (select count(*)::integer from platform_private.role_facet_assertion where facet_code = 'performer'),
  2,
  'reassertion preserves both assertion history rows'
);
select is(
  (select count(*)::integer from audit_private.audit_events where action = 'identity.facet.add'),
  2,
  'reassertion writes exactly one new add audit event'
);
select is(
  (select count(*)::integer from platform_private.outbox_events where event_type = 'identity.facet.changed.v1'),
  3,
  'reassertion writes exactly one new facet event'
);

select finish();
rollback;
