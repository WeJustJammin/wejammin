\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S04 organization persistence RED contract.  These catalog assertions
-- stay executable before the migration so RED reports every missing surface.
select has_schema('identity_private', 'Slice 04 identity schema exists');
select has_table('identity_private', 'organization_party',
  'organization party table exists');
select has_table('identity_private', 'organization_type_registry',
  'versioned organization type registry exists');
select has_table('identity_private', 'organization_type_assignment',
  'organization type assignment table exists');
select has_table('identity_private', 'organization_duplicate_review',
  'organization duplicate review table exists');

select ok(
  (select count(*) = 4
     and bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'identity_private'
     and c.relname = any(array[
       'organization_party', 'organization_type_registry',
       'organization_type_assignment', 'organization_duplicate_review']::name[])),
  'all Slice 04 organization tables force RLS'
);

select ok(
  (select count(*) = 12
     and bool_and(
       case when to_regclass(t.table_name) is null then false
            else not has_table_privilege(r.role_name, t.table_name, 'select')
             and not has_table_privilege(r.role_name, t.table_name, 'insert')
             and not has_table_privilege(r.role_name, t.table_name, 'update')
             and not has_table_privilege(r.role_name, t.table_name, 'delete')
       end)
    from (values ('anon'::name), ('authenticated'::name), ('service_role'::name)) r(role_name)
    cross join (values
      ('identity_private.organization_party'::text),
      ('identity_private.organization_type_registry'::text),
      ('identity_private.organization_type_assignment'::text),
      ('identity_private.organization_duplicate_review'::text)) t(table_name)),
  'browser and service roles have no direct organization table grants'
);

select has_column('identity_private', 'organization_party', 'party_id',
  'organization party is keyed by the canonical party id');
select has_column('identity_private', 'organization_party', 'ownership_state',
  'organization ownership state is persisted');
select has_column('identity_private', 'organization_party', 'lifecycle',
  'organization lifecycle is persisted');
select has_column('identity_private', 'organization_party', 'version',
  'organization version supports CAS');
select has_column('identity_private', 'organization_type_registry', 'type_code',
  'registry stores its lowercase type code');
select has_column('identity_private', 'organization_type_registry', 'registry_version',
  'registry stores its version');
select has_column('identity_private', 'organization_type_registry', 'active',
  'registry deactivation preserves history');
select has_column('identity_private', 'organization_type_assignment', 'organization_id',
  'assignment references an organization');
select has_column('identity_private', 'organization_type_assignment', 'type_code',
  'assignment references a registry code');
select has_column('identity_private', 'organization_type_assignment', 'starts_at',
  'assignment stores its start timestamp');
select has_column('identity_private', 'organization_type_assignment', 'ends_at',
  'assignment stores its optional end timestamp');
select has_column('identity_private', 'organization_duplicate_review', 'normalized_input_hash',
  'duplicate review stores only the normalized input digest');

select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.organization_party')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%ownership_state%'
       and pg_get_constraintdef(c.oid) ilike '%unclaimed%'
       and pg_get_constraintdef(c.oid) ilike '%ownerless%'),
  'organization ownership state is closed and constrained'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.organization_party')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%lifecycle%'
       and pg_get_constraintdef(c.oid) ilike '%dissolved%'),
  'organization lifecycle includes the terminal dissolved state'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.organization_type_registry')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%registry_version%'),
  'organization type registry version is positive and constrained'
);
select ok(
  exists (
    select 1
      from pg_constraint c
     where c.conrelid = to_regclass('identity_private.organization_type_assignment')
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%ends_at%'
       and pg_get_constraintdef(c.oid) ilike '%starts_at%'),
  'organization type assignment end follows start'
);

select ok(
  exists (
    select 1
      from pg_index i
     where i.indrelid = to_regclass('identity_private.organization_type_assignment')
       and i.indisunique
       and i.indpred is not null
       and pg_get_indexdef(i.indexrelid) ilike '%organization_id%'
       and pg_get_indexdef(i.indexrelid) ilike '%type_code%'
       and pg_get_indexdef(i.indexrelid) ilike '%ends_at%'),
  'only one active assignment exists per organization and type'
);
select ok(
  exists (
    select 1
      from pg_index i
     where i.indrelid = to_regclass('identity_private.organization_duplicate_review')
       and i.indisunique
       and pg_get_indexdef(i.indexrelid) ilike '%detector_version%'
       and pg_get_indexdef(i.indexrelid) ilike '%normalized_input_hash%'),
  'duplicate review is idempotent per detector and normalized digest'
);

select ok(
  (select count(*) = 6
     and bool_and(prosecdef)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'identity_private'
     and p.proname = any(array[
       'rpc_create_organization', 'rpc_change_organization_type',
       'rpc_invite_membership', 'rpc_assert_membership',
       'rpc_accept_or_end_membership', 'rpc_add_capacity_period']::name[])),
  'Slice 04 organization and membership RPCs are present as protected functions'
);

select ok(
  (select count(*) = 6
     and not exists (
       select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'identity_private'
          and p.proname = any(array[
            'rpc_create_organization', 'rpc_change_organization_type',
            'rpc_invite_membership', 'rpc_assert_membership',
            'rpc_accept_or_end_membership', 'rpc_add_capacity_period']::name[])
          and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute')
            or has_function_privilege('service_role', p.oid, 'execute')))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'identity_private'
     and p.proname = any(array[
       'rpc_create_organization', 'rpc_change_organization_type',
       'rpc_invite_membership', 'rpc_assert_membership',
       'rpc_accept_or_end_membership', 'rpc_add_capacity_period']::name[])),
  'identity private mutation RPCs have no direct role execution bypass'
);

select ok(
  (select count(*) = 6
     and bool_and(
       lower(pg_get_functiondef(p.oid)) like '%idempotenc%'
       and (lower(pg_get_functiondef(p.oid)) like '%outbox_events%'
         or lower(pg_get_functiondef(p.oid)) like '%identity_record_effects%')
       and (lower(pg_get_functiondef(p.oid)) like '%audit_events%'
         or lower(pg_get_functiondef(p.oid)) like '%identity_record_effects%'))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'identity_private'
     and p.proname = any(array[
       'rpc_create_organization', 'rpc_change_organization_type',
       'rpc_invite_membership', 'rpc_assert_membership',
       'rpc_accept_or_end_membership', 'rpc_add_capacity_period']::name[])),
  'mutation RPCs reserve idempotency and atomically record audit/outbox effects'
);

select ok(
  coalesce((select pg_get_functiondef(
    to_regprocedure('platform_private.valid_base_event_payload(text,integer,jsonb)'))
    ilike '%identity.organization.changed.v1%'), false),
  'base event validation admits identity organization changes'
);
select ok(
  coalesce((select pg_get_functiondef(
    to_regprocedure('platform_private.valid_base_event_payload(text,integer,jsonb)'))
    ilike '%identity.relationship.changed.v1%'), false),
  'base event validation admits identity relationship changes'
);

-- Behavioral contract: a verified session receives a complete canonical
-- resource, retries replay that exact resource, and the organization CAS and
-- assignment scope prevent stale or cross-organization writes.
select lives_ok($$insert into auth.users(id) values
  ('a4111111-1111-4111-8111-111111111111')$$,
  'organization fixture owner Auth user is accepted');
select lives_ok($$select platform_api.auth_bootstrap(
  'a4111111-1111-4111-8111-111111111111',
  decode(repeat('ab', 32), 'hex'), decode(repeat('cd', 32), 'hex'),
  'a4111111-1111-4111-8111-111111111112',
  'a4111111-1111-4111-8111-111111111113')$$,
  'organization fixture owner receives a canonical self context');
select pg_temp.set_jwt_claim('sub', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.auth_user_id', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings
  where auth_user_id = 'a4111111-1111-4111-8111-111111111111'), true);
select set_config('app.request_id', 'a4111111-1111-4111-8111-111111111112', true);
select set_config('app.correlation_id', 'a4111111-1111-4111-8111-111111111113', true);
select set_config('app.idempotency_key_hash', 'slice04-org-create-a', true);
select set_config('app.request_hash', 'slice04-org-request-a', true);

create temp table p2_s04_org_fixture (
  organization_id uuid primary key,
  owner_person_id uuid not null,
  resource jsonb not null
);
select lives_ok($$
  insert into p2_s04_org_fixture(organization_id, owner_person_id, resource)
  select (result->>'organizationId')::uuid,
         (select person_id from identity.auth_user_bindings
           where auth_user_id = 'a4111111-1111-4111-8111-111111111111'),
         result
    from lateral (select platform_api.rpc_create_organization(
      'self_member', array['band']::text[]
    ) as result) created
$$, 'P2-S04-AC-001 creates an owned organization through the RPC boundary');
select ok((select resource ?& array[
  'organizationId', 'ownershipState', 'lifecycle', 'typeCodes', 'version', 'etag',
  'createdAt', 'updatedAt'] from p2_s04_org_fixture),
  'ORG-01 returns the complete OrganizationResource contract');
select is((select resource->>'ownershipState' from p2_s04_org_fixture), 'owned',
  'self-member creation establishes owned state');
select is((select resource->'typeCodes' from p2_s04_org_fixture), '["band"]'::jsonb,
  'ORG-01 persists the requested active type');
select is((select count(*)::integer from identity_private.organization_actor_grant g
  join p2_s04_org_fixture f on f.organization_id = g.organization_id
  where g.person_id = f.owner_person_id and g.active), 7,
  'ORG-01 grants the owner only the named organization capabilities');

select is(
  (select platform_api.rpc_create_organization('self_member', array['band']::text[])),
  (select resource from p2_s04_org_fixture),
  'ORG-01 retry replays the exact full resource without creating another row');
select set_config('app.request_hash', 'slice04-org-request-mismatch', true);
select throws_ok($$select platform_api.rpc_create_organization(
  'self_member', array['studio']::text[]
)$$, 'P0001', 'IDEMPOTENCY_MISMATCH',
  'ORG-01 rejects a retry key reused with a different request hash');
select is((select count(*)::integer from identity_private.organization_party o
  join p2_s04_org_fixture f on f.organization_id = o.party_id), 1,
  'idempotent replay leaves organization cardinality unchanged');

create temp table p2_s04_assignment_fixture (
  assignment_id uuid primary key,
  resource jsonb not null
);
select set_config('app.idempotency_key_hash', 'slice04-type-add-a', true);
select set_config('app.request_hash', 'slice04-type-add-request', true);
select lives_ok($$
  insert into p2_s04_assignment_fixture(assignment_id, resource)
  select (result->>'assignmentId')::uuid, result
    from lateral (select platform_api.rpc_change_organization_type(
      (select organization_id from p2_s04_org_fixture),
      'collective', 'add', 1
    ) as result) added
$$, 'TYPE-01 adds a registry-backed organization type');
select ok((select resource ?& array[
  'assignmentId', 'organizationId', 'typeCode', 'startsAt', 'endsAt', 'state',
  'version', 'etag'] from p2_s04_assignment_fixture),
  'TYPE-01 returns the complete OrganizationTypeAssignmentResource contract');
select is((select resource->>'state' from p2_s04_assignment_fixture), 'active',
  'TYPE-01 returns an active assignment');
select is((select version from identity_private.organization_party
  where party_id = (select organization_id from p2_s04_org_fixture)), 2::bigint,
  'TYPE-01 advances the organization version');

select set_config('app.idempotency_key_hash', 'slice04-type-remove-a', true);
select set_config('app.request_hash', 'slice04-type-remove-request', true);
select ok(
  (select (platform_api.rpc_change_organization_type(
    (select organization_id from p2_s04_org_fixture),
    (select assignment_id::text from p2_s04_assignment_fixture), 'remove', 2
  ) ?& array[
    'organizationId', 'ownershipState', 'lifecycle', 'typeCodes', 'version', 'etag',
    'createdAt', 'updatedAt'])),
  'P2-S04-AC-002 TYPE-02 returns a complete organization resource after transition');
select is((select count(*)::integer from identity_private.organization_type_assignment
  where organization_id = (select organization_id from p2_s04_org_fixture)
    and ends_at is null), 1,
  'TYPE-02 ends only the selected active assignment');
select is((select version from identity_private.organization_party
  where party_id = (select organization_id from p2_s04_org_fixture)), 3::bigint,
  'TYPE-02 advances the organization version atomically');
select set_config('app.idempotency_key_hash', 'slice04-type-stale-a', true);
select set_config('app.request_hash', 'slice04-type-stale-request', true);
select throws_ok($$select platform_api.rpc_change_organization_type(
  (select organization_id from p2_s04_org_fixture), 'venue', 'add', 2
)$$, 'P0001', 'VERSION_MISMATCH',
  'TYPE-01 rejects a stale organization version after a competing transition');

-- A second organization supplies a real assignment identifier for the IDOR
-- probe; TYPE-02 must scope the lookup by the requested organization.
select set_config('app.idempotency_key_hash', 'slice04-org-create-b', true);
select set_config('app.request_hash', 'slice04-org-request-b', true);
select lives_ok($$select platform_api.rpc_create_organization(
  'self_member', array['studio']::text[]
)$$, 'fixture creates a second organization for an IDOR probe');
select set_config('app.idempotency_key_hash', 'slice04-type-add-b', true);
select set_config('app.request_hash', 'slice04-type-add-b-request', true);
create temp table p2_s04_other_assignment as
select (result->>'assignmentId')::uuid as assignment_id,
       (result->>'organizationId')::uuid as organization_id
  from lateral (select platform_api.rpc_change_organization_type(
    (select o.party_id from identity_private.organization_party o
      where o.party_id <> (select organization_id from p2_s04_org_fixture)
      order by o.created_at desc limit 1),
    'collective', 'add', 1
  ) as result) added;
select set_config('app.idempotency_key_hash', 'slice04-type-idor-a', true);
select set_config('app.request_hash', 'slice04-type-idor-request', true);
select throws_ok($$select platform_api.rpc_change_organization_type(
  (select organization_id from p2_s04_org_fixture),
  (select assignment_id::text from p2_s04_other_assignment), 'remove', 3
)$$, 'P0001', 'TYPE_ASSIGNMENT_NOT_FOUND',
  'TYPE-02 rejects an assignment identifier owned by another organization');
select is((select ends_at from identity_private.organization_type_assignment
  where id = (select assignment_id from p2_s04_other_assignment)), null::timestamptz,
  'cross-organization TYPE-02 probing cannot end the other assignment');

select lives_ok($$insert into auth.users(id) values
  ('a4222222-2222-4222-8222-222222222222')$$,
  'organization fixture outsider Auth user is accepted');
select lives_ok($$select platform_api.auth_bootstrap(
  'a4222222-2222-4222-8222-222222222222',
  decode(repeat('ef', 32), 'hex'), decode(repeat('12', 32), 'hex'),
  'a4222222-2222-4222-8222-222222222223',
  'a4222222-2222-4222-8222-222222222224')$$,
  'organization fixture outsider receives a self context');
select pg_temp.set_jwt_claim('sub', 'a4222222-2222-4222-8222-222222222222', true);
select set_config('app.auth_user_id', 'a4222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_auth_user_id', 'a4222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings
  where auth_user_id = 'a4222222-2222-4222-8222-222222222222'), true);
select set_config('app.idempotency_key_hash', 'slice04-type-forged-a', true);
select set_config('app.request_hash', 'slice04-type-forged-request', true);
select throws_ok($$select platform_api.rpc_change_organization_type(
  (select organization_id from p2_s04_org_fixture), 'venue', 'add', 3
)$$, 'P0001', 'FORBIDDEN',
  'TYPE-01 denies an outsider without an organization capability grant');
select ok((select (platform_api.identity_organization_read(
  (select organization_id from p2_s04_org_fixture)) ?& array[
    'organizationId', 'typeDisplay', 'lifecycleLabel', 'version'])),
  'organization read returns only the public projection to an outsider');

select pg_temp.set_jwt_claim('sub', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.auth_user_id', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', 'a4111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings
  where auth_user_id = 'a4111111-1111-4111-8111-111111111111'), true);
select set_config('app.idempotency_key_hash', 'slice04-org-create-c', true);
select set_config('app.request_hash', 'slice04-org-request-c', true);
select lives_ok($$select platform_api.rpc_create_organization('self_member', '{}'::text[])$$,
  'friction quota permits the third creation while recording activity');
select set_config('app.idempotency_key_hash', 'slice04-org-create-d', true);
select set_config('app.request_hash', 'slice04-org-request-d', true);
select lives_ok($$select platform_api.rpc_create_organization('self_member', '{}'::text[])$$,
  'friction quota permits the fourth creation with review friction');
select is((select window_count from identity_private.organization_creation_quota
  where actor_id = (select owner_person_id from p2_s04_org_fixture)), 4,
  'ORG-01 increments the actor rolling creation quota under a row lock');
select ok((select count(*) >= 1 from identity_private.organization_duplicate_review
  where status = 'review_required'),
  'ORG-01 routes the fourth creation through review-required friction');

select * from finish();
rollback;
