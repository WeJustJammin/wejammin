\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- P2-S05-AC-084..090, P2-S05-AC-113, P2-S05-AC-114, P2-S05-AC-117.
-- Opaque fixture IDs stand in for Shard 01/06 references.  Every row is
-- admitted through the private boundary before route behavior is exercised.
select pg_temp.set_jwt_claim('sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id', '20000000-0000-4000-8000-000000000001', true);
select set_config('app.acting_party_id', '10000000-0000-4000-8000-000000000001', true);
insert into platform_private.party(id, kind) values ('10000000-0000-4000-8000-000000000001', 'alias'),
  ('10000000-0000-4000-8000-000000000002', 'alias');
select lives_ok($$insert into profile_private.shadow_party_contexts(
  id, owner_id, party_id, creator_person_id, creator_acting_party_id,
  source_domain, source_entity_id, role_code, instrument_ref, contact_route_id,
  state, pointer_digest, version
) values ('30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'fixture.example', 'shadow-001',
  'drums', 'instrument-001', '40000000-0000-4000-8000-000000000001',
  'created', extensions.digest(pg_catalog.convert_to('rM8p2V6q9Yw4aBcDeFgHiJkLmNoPqRsTuVwXyZ1AbCd', 'utf8'), 'sha256'), 1)$$,
  'seed shadow context with owner equal to party');
select lives_ok($$insert into profile_private.shadow_suppressions(
  id, owner_id, party_id, route_fingerprint, remedy_action, scope, state,
  case_id, evidence_ref, version
) values ('31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', decode(repeat('11', 32), 'hex'),
  'suppress', 'both', 'active',
  '50000000-0000-4000-8000-000000000001', 'evidence-001', 1)$$,
  'seed suppression with shadow aggregate owner');
select lives_ok($$insert into profile_private.invitation_dispatches(
  id, owner_id, shadow_id, route_id, attempt_no, trigger, state, scheduled_at,
  version
) values ('32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002', 1, 'initial', 'queued',
  clock_timestamp() + interval '1 hour', 1)$$,
  'seed invitation with shadow aggregate owner');
select lives_ok($$insert into profile_private.claim_cases(
  id, owner_id, target_party_id, claimant_person_id, claim_kind,
  recipient_person_id, state, control_level, window_expires_at, version
) values
  ('33000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', 'self', null, 'started', 'none',
   clock_timestamp() + interval '7 days', 1),
  ('33000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', 'representation', null,
   'proving', 'provisional', clock_timestamp() + interval '7 days', 1),
  ('33000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', 'representation', null,
   'proving', 'provisional', clock_timestamp() + interval '7 days', 1)$$,
  'seed incumbent and same-person challenger claims');
select lives_ok($$insert into profile_private.claim_proof_attempts(
  id, owner_id, claim_id, tier, method, challenge_hash, evidence_ref,
  attester_ids, independence_result, state, attempts_used, expires_at, version
) values
  ('34000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '33000000-0000-4000-8000-000000000002', 'A', 'domain_challenge',
   extensions.digest(pg_catalog.convert_to('482901', 'utf8'), 'sha256'), 'proof-evidence-001',
   array['20000000-0000-4000-8000-000000000003'::uuid], 'pending', 'pending',
   0, clock_timestamp() + interval '1 hour', 1),
  ('34000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   '33000000-0000-4000-8000-000000000002', 'B', 'business_phone',
   decode(repeat('33', 32), 'hex'), 'proof-evidence-002', '{}', 'pending',
   'pending', 0, clock_timestamp() + interval '1 hour', 1)$$,
  'seed pending proofs bound to the claim target party');
select lives_ok($$insert into profile_private.ownership_contests(
  id, owner_id, party_id, incumbent_claim_id, challenger_claim_id, state,
  response_due_at, shard06_case_id, version
) values ('35000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002', 'open',
  clock_timestamp() + interval '7 days',
  '50000000-0000-4000-8000-000000000002', 1)$$,
  'seed open contest with target-party owner');
select lives_ok($$insert into profile_private.party_ownership_periods(
  id, owner_id, party_id, owner_person_id, basis_kind, basis_id, starts_at,
  ends_at, control_level, state, case_id, version
) values ('36000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 'claim',
  '33000000-0000-4000-8000-000000000001', clock_timestamp(), null, 'full',
  'active', '50000000-0000-4000-8000-000000000003', 1)$$,
  'seed active ownership period with subject-party owner');
-- P2-S05-AC-084..090: private rows are forced-RLS and have no direct role
-- CRUD.  Owner IDs are checked both in rows and through their parent claim.
select ok(
  (select count(*) = 7 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
     from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'profile_private' and c.relname in
      ('shadow_party_contexts','shadow_suppressions','invitation_dispatches',
       'claim_cases','claim_proof_attempts','ownership_contests',
       'party_ownership_periods')),
  'all seven profile records force RLS');
select ok(
  (select count(*) = 28 and bool_and(
      not has_table_privilege(r.role_name, t.table_name, 'select')
      and not has_table_privilege(r.role_name, t.table_name, 'insert')
      and not has_table_privilege(r.role_name, t.table_name, 'update')
      and not has_table_privilege(r.role_name, t.table_name, 'delete'))
     from (values ('public'::name),('anon'::name),('authenticated'::name),
                  ('service_role'::name)) r(role_name)
     cross join (values ('profile_private.shadow_party_contexts'::text),
       ('profile_private.shadow_suppressions'),('profile_private.invitation_dispatches'),
       ('profile_private.claim_cases'),('profile_private.claim_proof_attempts'),
       ('profile_private.ownership_contests'),('profile_private.party_ownership_periods')) t(table_name)),
  'browser and service roles have no direct profile CRUD');
select ok((select owner_id = party_id from profile_private.shadow_party_contexts
  where id = '30000000-0000-4000-8000-000000000001'), 'shadow owner maps to party');
select ok((select owner_id = shadow_id from profile_private.invitation_dispatches
  where id = '32000000-0000-4000-8000-000000000001'), 'invitation owner maps to shadow');
select ok((select owner_id = target_party_id from profile_private.claim_cases
  where id = '33000000-0000-4000-8000-000000000002'), 'claim owner maps to target party');
select ok((select p.owner_id = c.target_party_id from profile_private.claim_proof_attempts p
  join profile_private.claim_cases c on c.id = p.claim_id
  where p.id = '34000000-0000-4000-8000-000000000001'), 'proof owner maps to claim target');
select throws_ok($$insert into profile_private.claim_cases(
  owner_id, target_party_id, claimant_person_id, claim_kind, state, control_level, version
) values ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000009', 'self', 'started', 'none', 1)$$,
  '23514', null, 'caller cannot forge a claim owner');
-- P2-S05-AC-091, P2-S05-AC-107, P2-S05-AC-108, P2-S05-AC-122,
-- P2-S05-AC-125, P2-S05-AC-128, P2-S05-AC-129: source/proof identity and
-- history are immutable at the row boundary.
select throws_ok($$update profile_private.shadow_party_contexts
  set source_entity_id = 'rewritten', version = 2
  where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'shadow source identity cannot be rewritten');
select throws_ok($$update profile_private.shadow_suppressions
  set route_fingerprint = decode(repeat('33', 32), 'hex'), version = 2
  where id = '31000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'suppression route fingerprint cannot be rewritten');
select throws_ok($$update profile_private.claim_proof_attempts
  set challenge_hash = decode(repeat('44', 32), 'hex'), version = 2
  where id = '34000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'proof challenge hash cannot be rewritten');
select throws_ok($$delete from profile_private.party_ownership_periods
  where id = '36000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'ownership periods cannot be deleted');

-- P2-S05-AC-122, P2-S05-AC-123, P2-S05-AC-125, P2-S05-AC-126,
-- P2-S05-AC-128, P2-S05-AC-129: proof attempts burn on terminal expiry and
-- never exceed five attempts or accept an unrelated target owner.
select throws_ok($$insert into profile_private.claim_proof_attempts(
  owner_id, claim_id, tier, method, attester_ids, independence_result, state,
  attempts_used, expires_at, version
) values ('10000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002', 'A', 'attester_route', '{}',
  'pending', 'pending', 6, clock_timestamp() + interval '1 hour', 1)$$,
  '23514', null, 'proof attempts cannot exceed five');
select throws_ok($$insert into profile_private.claim_proof_attempts(
  owner_id, claim_id, tier, method, attester_ids, independence_result, state,
  attempts_used, expires_at, version
) values ('10000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000002', 'A', 'postal', '{}', 'pending',
  'pending', 0, clock_timestamp() + interval '1 hour', 1)$$,
  '23514', null, 'proof owner cannot bind a different target party');
select lives_ok($$update profile_private.claim_proof_attempts
  set state = 'expired', attempts_used = 5, version = 2
  where id = '34000000-0000-4000-8000-000000000002'$$,
  'expired proof closes after the bounded attempt ceiling');
select throws_ok($$update profile_private.claim_proof_attempts
  set state = 'pending', version = 3
  where id = '34000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'expired proof cannot be reopened');

-- P2-S05-AC-001..008, P2-S05-AC-107, P2-S05-AC-108, P2-S05-AC-113,
-- P2-S05-AC-114, P2-S05-AC-116, P2-S05-AC-117, P2-S05-AC-122,
-- P2-S05-AC-123, P2-S05-AC-125, P2-S05-AC-126, P2-S05-AC-128,
-- P2-S05-AC-129, P2-S05-AC-132, P2-S05-AC-133, P2-S05-AC-135,
-- P2-S05-AC-136, P2-S05-AC-137, P2-S05-AC-246.
-- These are real command envelopes, not name-only checks.  The current
-- fail-closed command migration makes each happy-path call RED.
create temp table p2_s05_requests(op text primary key, request jsonb not null);
insert into p2_s05_requests values
  ('cmd01', jsonb_build_object(
    'sourceDomain','projects','sourceEntityId','work-812','sourceVersion','3',
    'creatorPersonId','20000000-0000-4000-8000-000000000001',
    'actingPartyId','10000000-0000-4000-8000-000000000001',
    'roleCode','performer','idempotencyKey','shadow-create-20260828')),
  ('match', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','match-key-20260828'),
    'body',jsonb_build_object('partyId','10000000-0000-4000-8000-000000000001',
      'sourceDomain','fixture.example','sourceEntityId','shadow-001','sourceVersion','1',
      'roleCode','drums'))),
  ('invite', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','invite-key-20260828','ifMatch','"1"'),
    'shadowId','30000000-0000-4000-8000-000000000001',
    'body',jsonb_build_object('contactRouteId','40000000-0000-4000-8000-000000000001','trigger','initial'))),
  ('remedy', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','remedy-key-20260828'),
    'body',jsonb_build_object('pointerToken','rM8p2V6q9Yw4aBcDeFgHiJkLmNoPqRsTuVwXyZ1AbCd',
      'action','suppress','scope','both','proof',jsonb_build_object('kind','route_code','code','482901')))),
  ('claim', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','claim-key-20260828','ifMatch','"1"'),
    'body',jsonb_build_object('targetPartyId','10000000-0000-4000-8000-000000000002','claimKind','self'))),
  ('read', jsonb_build_object('claimId','33000000-0000-4000-8000-000000000002')),
  ('challenge', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','challenge-key-20260828','ifMatch','"1"'),
    'claimId','33000000-0000-4000-8000-000000000003',
    'body',jsonb_build_object('method','domain_challenge','routeId','40000000-0000-4000-8000-000000000002'))),
  ('proof', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','proof-key-20260828','ifMatch','"1"'),
    'claimId','33000000-0000-4000-8000-000000000002',
    'body',jsonb_build_object('kind','challenge_code','challengeId','34000000-0000-4000-8000-000000000001',
      'code','482901','reasonCode','claim_proof'))),
  ('convert', jsonb_build_object(
    'headers',jsonb_build_object('contentType','application/json','idempotencyKey','convert-key-20260828','ifMatch','"2"'),
    'claimId','33000000-0000-4000-8000-000000000002',
    'body',jsonb_build_object('reasonCode','claim_conversion')));

select set_config('app.actor_person_id',
  '20000000-0000-4000-8000-000000000001', true);
select lives_ok($$select platform_api.rpc_create_shadow_by_reference(request)
  from p2_s05_requests where op = 'cmd01'$$, 'CMD-01 happy path creates a shadow by source reference');
select lives_ok($$select platform_api.rpc_match_shadow(request)
  from p2_s05_requests where op = 'match'$$, 'PRF-API-01 happy path matches a source tuple');
select lives_ok($$select platform_api.rpc_dispatch_invitation(request)
  from p2_s05_requests where op = 'invite'$$, 'PRF-API-02 happy path queues one invitation attempt');
select pg_temp.set_jwt_claim('sub', '', true);
select lives_ok($$select platform_api.rpc_submit_remedy(request)
  from p2_s05_requests where op = 'remedy'$$, 'PRF-API-03 anonymous remedy happy path remains account-free');
select pg_temp.set_jwt_claim('sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id', '20000000-0000-4000-8000-000000000002', true);
select set_config('app.acting_party_id',
  '10000000-0000-4000-8000-000000000002', true);
select set_config('app.step_up_verified', 'true', true);
select lives_ok($$select platform_api.rpc_start_claim(request)
  from p2_s05_requests where op = 'claim'$$, 'PRF-API-04 happy path starts a server-bound claim');
select lives_ok($$select platform_api.rpc_read_claim(request)
  from p2_s05_requests where op = 'read'$$, 'PRF-API-05 happy path returns claimant projection');
select lives_ok($$select platform_api.rpc_issue_claim_challenge(request)
  from p2_s05_requests where op = 'challenge'$$, 'PRF-API-06 happy path issues a hashed challenge');
select lives_ok($$select platform_api.rpc_submit_claim_proof(request)
  from p2_s05_requests where op = 'proof'$$, 'PRF-API-07 happy path evaluates proof without raw code return');
select lives_ok($$select platform_api.rpc_convert_claim(request)
  from p2_s05_requests where op = 'convert'$$, 'PRF-API-08 happy path converts only after proof policy');
update p2_s05_requests set request = jsonb_set(jsonb_set(request,
  '{headers,idempotencyKey}', '"proof-expired-key"'::jsonb),
  '{body,challengeId}', '"34000000-0000-4000-8000-000000000002"'::jsonb)
 where op = 'proof';
update p2_s05_requests set request = jsonb_set(request, '{headers,ifMatch}', '"2"'::jsonb)
 where op = 'proof';
select throws_ok($$select platform_api.rpc_submit_claim_proof(request)
  from p2_s05_requests where op = 'proof'$$, 'P0001', 'CHALLENGE_EXPIRED',
  'PRF-API-07 expired challenge is burned and cannot be replayed');
-- Replay must return the exact prior resource; a changed body with the same
-- key must conflict, and a stale If-Match must lose the version CAS race.
create temp table p2_s05_replay_results(op text primary key, first_response jsonb, replay_response jsonb);
select set_config('app.acting_party_id', '10000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into p2_s05_replay_results
  select 'match', platform_api.rpc_match_shadow(request), platform_api.rpc_match_shadow(request)
    from p2_s05_requests where op = 'match'$$,
  'PRF-API-01 exact replay invokes the same command twice');
select ok((select first_response = replay_response from p2_s05_replay_results
  where op = 'match'), 'PRF-API-01 replay returns byte-for-byte equivalent JSON');
update p2_s05_requests set request = jsonb_set(request, '{body,sourceEntityId}', '"shadow-002"'::jsonb)
 where op = 'match';
select throws_ok($$select platform_api.rpc_match_shadow(request)
  from p2_s05_requests where op = 'match'$$, 'P0001', 'IDEMPOTENCY_MISMATCH',
  'PRF-API-01 mismatched replay is rejected');
update p2_s05_requests set request = jsonb_set(jsonb_set(request,
  '{headers,ifMatch}', '"999"'::jsonb),
  '{headers,idempotencyKey}', '"claim-stale-key-20260828"'::jsonb)
 where op = 'claim';
select throws_ok($$select platform_api.rpc_start_claim(request)
  from p2_s05_requests where op = 'claim'$$, 'P0001', 'VERSION_MISMATCH',
  'PRF-API-04 stale target version loses CAS');

-- P2-S05-AC-107, P2-S05-AC-108, P2-S05-AC-113, P2-S05-AC-114,
-- P2-S05-AC-135, P2-S05-AC-136, P2-S05-AC-137: canonical ledgers remain
-- immutable and paired writes disappear together on rollback.
select lives_ok($$insert into platform_private.idempotency_records(
  id, actor_id, operation, key_hash, request_hash, state, created_at, expires_at
) values ('61000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002', 'profile.fixture',
  decode(repeat('44', 32), 'hex'), decode(repeat('55', 32), 'hex'), 'reserved',
  clock_timestamp(), clock_timestamp() + interval '1 day')$$,
  'canonical idempotency reservation is seeded');
select lives_ok($$insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, payload
) values ('62000000-0000-4000-8000-000000000001', 'profile.fixture', 1, 'claim',
  '33000000-0000-4000-8000-000000000002', 1,
  '63000000-0000-4000-8000-000000000001', '{"id":"fixture"}'::jsonb)$$,
  'canonical outbox event is seeded with identifier-only payload');
select lives_ok($$insert into audit_private.audit_events(
  id, action, actor_id, acting_party_id, target_type, target_id, decision,
  reason_code, correlation_id
) values ('64000000-0000-4000-8000-000000000001', 'profile.fixture',
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002', 'claim',
  '33000000-0000-4000-8000-000000000002', 'allowed', 'FIXTURE',
  '63000000-0000-4000-8000-000000000001')$$,
  'canonical audit event is seeded');
select throws_ok($$update platform_private.outbox_events
  set payload = '{"id":"tampered"}'::jsonb
  where id = '62000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'outbox payload is immutable');
select throws_ok($$delete from audit_private.audit_events
  where id = '64000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'audit event is append-only');
savepoint p2_s05_atomic_fixture;
insert into platform_private.outbox_events(
  id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, payload
) values ('62000000-0000-4000-8000-000000000002', 'profile.rollback', 1, 'claim',
  '33000000-0000-4000-8000-000000000002', 2,
  '63000000-0000-4000-8000-000000000002', '{"id":"rollback"}'::jsonb);
insert into audit_private.audit_events(
  id, action, acting_party_id, target_type, target_id, decision, reason_code,
  correlation_id
) values ('64000000-0000-4000-8000-000000000002', 'profile.rollback',
  '10000000-0000-4000-8000-000000000002', 'claim',
  '33000000-0000-4000-8000-000000000002', 'allowed', 'ROLLBACK',
  '63000000-0000-4000-8000-000000000002');
rollback to savepoint p2_s05_atomic_fixture;
select is((select count(*)::integer from platform_private.outbox_events
  where id = '62000000-0000-4000-8000-000000000002'), 0,
  'rollback removes the paired outbox event');
select is((select count(*)::integer from audit_private.audit_events
  where id = '64000000-0000-4000-8000-000000000002'), 0,
  'rollback removes the paired audit event');

-- P2-S05-AC-089, P2-S05-AC-090, P2-S05-AC-132, P2-S05-AC-133.
select throws_ok($$insert into profile_private.party_ownership_periods(
  owner_id, party_id, owner_person_id, basis_kind, basis_id, starts_at,
  control_level, state, version
) values ('10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004', 'transfer',
  '33000000-0000-4000-8000-000000000002', clock_timestamp() + interval '1 hour',
  'provisional', 'active', 1)$$, '23P01', null,
  'live ownership periods cannot overlap for one party');
select throws_ok($$insert into profile_private.ownership_contests(
  owner_id, party_id, incumbent_claim_id, challenger_claim_id, state,
  response_due_at, version
) values ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000002', 'open',
  clock_timestamp() + interval '1 day', 1)$$, '23505', null,
  'one open contest cannot repeat the same challenger claim');
select throws_ok($$insert into profile_private.ownership_contests(
  owner_id, party_id, incumbent_claim_id, challenger_claim_id, state,
  response_due_at, version
) values ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '33000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000003', 'open',
  clock_timestamp() + interval '1 day', 1)$$, '23505', null,
  'one open contest cannot repeat the same challenger person');

-- P2-S05-AC-225, P2-S05-AC-246, P2-S05-AC-247, P2-S05-AC-252,
-- P2-S05-AC-253: fixed search_path protects functions; private contest and
-- transfer/public registry routes remain deferred from this slice.
select ok(
  (select count(*) = 9 and bool_and(coalesce(array_to_string(p.proconfig, ','), '') ~* 'search_path[=]')
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api' and p.proname in
      ('rpc_match_shadow','rpc_dispatch_invitation','rpc_submit_remedy','rpc_start_claim',
       'rpc_read_claim','rpc_issue_claim_challenge','rpc_submit_claim_proof',
       'rpc_convert_claim','rpc_create_shadow_by_reference')),
  'all active profile wrappers set an explicit search_path');
select set_config('app.actor_person_id', '20000000-0000-4000-8000-000000000009', true);
select throws_ok($$select platform_api.rpc_read_claim(request)
  from p2_s05_requests where op = 'read'$$, 'P0001', 'NOT_FOUND',
  'unauthorized claim read is concealed as not found');
select ok(
  not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public_api' and c.relkind in ('v','m')
      and pg_catalog.pg_get_viewdef(c.oid, true) ~* '(shadow_|claim_|ownership_)'),
  'private records have no public registry projection');
select ok(
  not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api' and p.proname in
      ('rpc_create_contest','rpc_read_contest','rpc_submit_contest_evidence',
       'rpc_withdraw_contest','rpc_create_transfer','rpc_read_transfer',
       'rpc_decide_transfer','rpc_reverse_transfer')),
  'deferred contest and transfer RPCs remain absent');

select * from finish();
rollback;
