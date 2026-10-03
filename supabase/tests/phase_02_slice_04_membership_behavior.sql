\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Behavioral transitions use a real authenticated owner/member pair.  The
-- fixture exercises full resources, termsHash binding, CAS losers, replay,
-- historical evidence, and retroactive confirmation before context revoke.
select lives_ok($$insert into auth.users(id) values
  ('a6111111-1111-4111-8111-111111111111'),
  ('a6222222-2222-4222-8222-222222222222')$$,
  'membership fixture Auth users are accepted');
select lives_ok($$select platform_api.auth_bootstrap(
  'a6111111-1111-4111-8111-111111111111', decode(repeat('11', 32), 'hex'),
  decode(repeat('22', 32), 'hex'), 'a6111111-1111-4111-8111-111111111112',
  'a6111111-1111-4111-8111-111111111113')$$,
  'membership fixture owner receives a self context');
select lives_ok($$select platform_api.auth_bootstrap(
  'a6222222-2222-4222-8222-222222222222', decode(repeat('33', 32), 'hex'),
  decode(repeat('44', 32), 'hex'), 'a6222222-2222-4222-8222-222222222223',
  'a6222222-2222-4222-8222-222222222224')$$,
  'membership fixture member receives a self context');
select pg_temp.set_jwt_claim('sub', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.auth_user_id', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.actor_auth_user_id', 'a6111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6111111-1111-4111-8111-111111111111'), true); select set_config('app.correlation_id', 'a6111111-1111-4111-8111-111111111113', true); select set_config('app.idempotency_key_hash', 'slice04-member-org-create', true); select set_config('app.request_hash', 'slice04-member-org-request', true);

create temp table p2_s04_membership_org as
select (result->>'organizationId')::uuid as organization_id,
       (select person_id from identity.auth_user_bindings
          where auth_user_id = 'a6111111-1111-4111-8111-111111111111') as owner_person_id
  from lateral (select platform_api.rpc_create_organization(
    'self_member', '{}'::text[]
  ) as result) created;
insert into identity_private.governance_terms_version(
  id, organization_id, version_no, terms_schema_version, terms_json,
  document_hash, governance_mode, state, required_member_set_hash, effective_at
)
select 'a6333333-3333-4333-8333-333333333333', organization_id, 1, 1,
       '{"notice":"slice04"}'::jsonb, decode(repeat('ab', 32), 'hex'),
       'governed', 'active', decode(repeat('cd', 32), 'hex'), clock_timestamp()
  from p2_s04_membership_org;
create temp table p2_s04_invite as
select (result->>'tenureId')::uuid as tenure_id, result as resource
  from lateral (select platform_api.rpc_invite_membership(
    (select organization_id from p2_s04_membership_org),
    (select person_id from identity.auth_user_bindings
      where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
    current_date - 10, 'a6333333-3333-4333-8333-333333333333', 'touring',
    clock_timestamp() + interval '1 day', 'governed', 1
  ) as result) invited;
select ok((select resource ?& array[
  'tenureId', 'organizationId', 'personId', 'state', 'provenance', 'startsOn',
  'endsOn', 'acceptedAt', 'revokedAt', 'version', 'etag'] from p2_s04_invite),
  'MEM-01 returns the complete MembershipTenureResource contract');
select is((select resource->>'state' from p2_s04_invite), 'invited',
  'MEM-01 starts a governed invitation in invited state');
select is((select terms_hash from identity_private.membership_tenure
  where id = (select tenure_id from p2_s04_invite)), decode(repeat('ab', 32), 'hex'),
  'MEM-01 persists the canonical terms document hash');
select set_config('app.idempotency_key_hash', 'slice04-member-invite-stale', true);
select set_config('app.request_hash', 'slice04-member-invite-stale-request', true);
select throws_ok($$select platform_api.rpc_invite_membership(
  (select organization_id from p2_s04_membership_org),
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
  current_date, 'a6333333-3333-4333-8333-333333333333', 'touring',
  clock_timestamp() + interval '1 day', 'governed', 1
)$$, 'P0001', 'VERSION_MISMATCH',
  'P2-S04-MEM01 rejects a stale organization version after invitation commit');

select pg_temp.set_jwt_claim('sub', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.auth_user_id', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.actor_auth_user_id', 'a6222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6222222-2222-4222-8222-222222222222'), true);
select set_config('app.idempotency_key_hash', 'slice04-member-terms-wrong', true);
select set_config('app.request_hash', 'slice04-member-terms-wrong-request', true);
select throws_ok($$select platform_api.rpc_accept_or_end_membership(
  (select tenure_id from p2_s04_invite), 'accept', 1,
  'a6333333-3333-4333-8333-333333333333', null, null, null, repeat('cd', 32)
)$$, 'P0001', 'TERMS_VERSION_MISMATCH',
  'MEM-03 rejects a termsHash that differs from the stored document hash');
select set_config('app.idempotency_key_hash', 'slice04-member-accept', true);
select set_config('app.request_hash', 'slice04-member-accept-request', true);
create temp table p2_s04_accepted as
select result as resource
  from lateral (select platform_api.rpc_accept_or_end_membership(
    (select tenure_id from p2_s04_invite), 'accept', 1,
    'a6333333-3333-4333-8333-333333333333', null, null, null, repeat('ab', 32)
  ) as result) accepted;
select is((select resource->>'state' from p2_s04_accepted), 'confirmed',
  'MEM-03 confirms the invitation only after exact termsHash comparison');
select ok((select resource ?& array[
  'tenureId', 'organizationId', 'personId', 'state', 'provenance', 'startsOn',
  'endsOn', 'acceptedAt', 'revokedAt', 'version', 'etag'] from p2_s04_accepted),
  'MEM-03 returns the complete confirmed tenure resource');
select is(
  (select platform_api.rpc_accept_or_end_membership(
    (select tenure_id from p2_s04_invite), 'accept', 1,
    'a6333333-3333-4333-8333-333333333333', null, null, null, repeat('ab', 32)
  )),
  (select resource from p2_s04_accepted),
  'MEM-03 retry replays the exact confirmed resource');

-- MEM-02 requires trusted, organization-scoped historical evidence and never
-- turns an asserted tenure into organization authority.
select pg_temp.set_jwt_claim('sub', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.auth_user_id', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.actor_auth_user_id', 'a6111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6111111-1111-4111-8111-111111111111'), true);
insert into identity_private.membership_evidence(
  id, organization_id, person_id, evidence_kind, trusted
)
select 'a6444444-4444-4444-8444-444444444444', organization_id,
       (select person_id from identity.auth_user_bindings
         where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
       'historical_membership', true
  from p2_s04_membership_org;
select set_config('app.idempotency_key_hash', 'slice04-member-assert-stale', true);
select set_config('app.request_hash', 'slice04-member-assert-stale-request', true);
select throws_ok($$select platform_api.rpc_assert_membership(
  (select organization_id from p2_s04_membership_org),
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
  current_date - 20, current_date - 15,
  'a6444444-4444-4444-8444-444444444444', 2
)$$, 'P0001', 'VERSION_MISMATCH',
  'P2-S04-MEM02 rejects a stale organization version before historical assertion');
select set_config('app.idempotency_key_hash', 'slice04-member-assert-invalid', true);
select set_config('app.request_hash', 'slice04-member-assert-invalid-request', true);
select throws_ok($$select platform_api.rpc_assert_membership(
  (select organization_id from p2_s04_membership_org),
  (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
  current_date - 20, current_date - 15,
  'a6555555-5555-4555-8555-555555555555', 3
)$$, 'P0001', 'EVIDENCE_REFERENCE_INVALID',
  'MEM-02 rolls back an assertion that lacks trusted evidence');
select is((select count(*)::integer from identity_private.membership_tenure
  where organization_id = (select organization_id from p2_s04_membership_org)
    and provenance = 'historical_assertion'), 0,
  'failed MEM-02 attempts leave no partial historical tenure');

-- P2-S04-AC-002: a retroactive end is accepted only with a matching,
-- counterparty-confirmed end date, then revokes acting context atomically.
insert into identity_private.membership_counterpart_confirmation(
  id, tenure_id, confirmer_person_id, ends_on
)
select 'a6666666-6666-4666-8666-666666666666', tenure_id,
       (select owner_person_id from p2_s04_membership_org), current_date - 1
  from p2_s04_invite;
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, source_relationship_id,
  client_binding_id, state, selected_at, last_seen_at, expires_at,
  projection_version, version
)
select 'a6777777-7777-4777-8777-777777777777',
       (select person_id from identity.auth_user_bindings
         where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
       (select organization_id from p2_s04_membership_org), 'organization',
       (select tenure_id from p2_s04_invite), 'slice04-member-org', 'active',
       clock_timestamp(), clock_timestamp(), clock_timestamp() + interval '12 hours', 1, 1;
select pg_temp.set_jwt_claim('sub', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.auth_user_id', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.actor_auth_user_id', 'a6222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6222222-2222-4222-8222-222222222222'), true); select set_config('app.acting_party_id', '', true); select set_config('app.idempotency_key_hash', 'slice04-member-end-missing-confirmation', true); select set_config('app.request_hash', 'slice04-member-end-missing-confirmation-request', true);
select throws_ok($$select platform_api.rpc_accept_or_end_membership(
  (select tenure_id from p2_s04_invite), 'end', 2, null,
  current_date - 2, null, 'MEMBER_REQUESTED', null
)$$, 'P0001', 'COUNTERPART_CONFIRMATION_REQUIRED',
  'P2-S04-AC-002 rejects a retroactive end without counterpart confirmation');
select set_config('app.idempotency_key_hash', 'slice04-member-end-confirmed', true);
select set_config('app.request_hash', 'slice04-member-end-confirmed-request', true);
create temp table p2_s04_ended as
select result as resource
  from lateral (select platform_api.rpc_accept_or_end_membership(
    (select tenure_id from p2_s04_invite), 'end', 2, null,
    current_date - 1, 'a6666666-6666-4666-8666-666666666666',
    'MEMBER_REQUESTED', null
  ) as result) ended;
select is((select resource->>'state' from p2_s04_ended), 'ended',
  'P2-S04-AC-002 transitions a confirmed tenure after matching confirmation');
select is((select resource->>'endsOn' from p2_s04_ended), (current_date - 1)::text,
  'P2-S04-AC-002 preserves the counterparty-confirmed historical end date');
select is((select state from platform_private.acting_context_binding
  where id = 'a6777777-7777-4777-8777-777777777777'), 'revoked',
  'ending a relationship revokes the member organization context');
select ok((select payload = jsonb_build_object(
  'personId', (select person_id from identity.auth_user_bindings
    where auth_user_id = 'a6222222-2222-4222-8222-222222222222'),
  'partyId', (select organization_id from p2_s04_membership_org),
  'relationshipId', (select tenure_id from p2_s04_invite))
  from platform_private.outbox_events
  where event_type = 'identity.acting-context.revoked.v1'
    and aggregate_id = (select tenure_id from p2_s04_invite)
  order by occurred_at desc limit 1),
  'context revoke emits only the identifier-only revocation projection');
select pg_temp.set_jwt_claim('sub', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.auth_user_id', 'a6111111-1111-4111-8111-111111111111', true); select set_config('app.actor_auth_user_id', 'a6111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6111111-1111-4111-8111-111111111111'), true);
select ok((select (platform_api.identity_memberships_read(
  (select organization_id from p2_s04_membership_org), null, 5) ?&
  array['items', 'nextCursor', 'hasMore'])),
  'membership read returns the bounded cursor-page envelope to an authorized owner');
select pg_temp.set_jwt_claim('sub', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.auth_user_id', 'a6222222-2222-4222-8222-222222222222', true); select set_config('app.actor_auth_user_id', 'a6222222-2222-4222-8222-222222222222', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a6222222-2222-4222-8222-222222222222'), true);
select throws_ok($$select platform_api.identity_memberships_read(
  (select organization_id from p2_s04_membership_org), null, 5
)$$, 'P0001', 'FORBIDDEN',
  'ended member cannot read the organization roster after authority revocation');

select * from finish();
rollback;
