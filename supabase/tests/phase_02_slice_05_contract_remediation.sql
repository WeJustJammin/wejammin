\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- P2-S05-AC-010, P2-S05-AC-044, P2-S05-AC-091..092.
-- This focused fixture exercises the two response-contract repairs without
-- widening the active PRF01..08 database boundary.
select pg_temp.set_jwt_claim('sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('app.actor_person_id', '20000000-0000-4000-8000-000000000001', true);
select set_config('app.acting_party_id', '10000000-0000-4000-8000-000000000001', true);
insert into platform_private.party(id, kind) values
  ('10000000-0000-4000-8000-000000000001', 'alias'),
  ('10000000-0000-4000-8000-000000000002', 'alias');

select lives_ok($$insert into profile_private.shadow_party_contexts(
  id, owner_id, party_id, creator_person_id, creator_acting_party_id,
  source_domain, source_entity_id, role_code, instrument_ref, contact_route_id,
  state, pointer_digest, version
) values ('70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'fixture.example', 'job-shadow-001',
  'drums', 'instrument-001', '71000000-0000-4000-8000-000000000001',
  'created', extensions.digest(pg_catalog.convert_to('job-pointer', 'utf8'), 'sha256'), 1)$$,
  'seed invitation shadow for JobStatus response');

create temp table p2_s05_invitation_response(response jsonb not null);
select lives_ok($$insert into p2_s05_invitation_response
  select platform_api.rpc_dispatch_invitation(jsonb_build_object(
    'headers', jsonb_build_object('contentType','application/json',
      'idempotencyKey','job-status-key','ifMatch','"1"'),
    'shadowId','70000000-0000-4000-8000-000000000001',
    'body', jsonb_build_object('contactRouteId','71000000-0000-4000-8000-000000000001',
      'trigger','initial')))$$,
  'PRF-API-02 returns a queued JobStatus response');
select ok((select response ?& array['id','type','state','progress','resultRef','error','createdAt','updatedAt']
  and response->>'type' = 'profile.invitation' and response->>'state' = 'queued'
  and not response ? 'attemptNo' and not response ? 'jobId'
  from p2_s05_invitation_response),
  'PRF-API-02 excludes the legacy InvitationResource fields');
select is((select count(*)::integer from platform_private.jobs j
  join p2_s05_invitation_response r on j.id = (r.response->>'id')::uuid
  where j.job_type = 'profile.invitation' and j.state = 'queued'), 1,
  'PRF-API-02 persists the returned queued job');

select lives_ok($$insert into profile_private.claim_cases(
  id, owner_id, target_party_id, claimant_person_id, claim_kind, state,
  control_level, window_expires_at, version
) values
  ('72000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', 'representation', 'proving', 'provisional',
   clock_timestamp() + interval '7 days', 1),
  ('72000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', 'representation', 'proving', 'provisional',
   clock_timestamp() + interval '7 days', 1),
  ('72000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000002', 'representation', 'proving', 'provisional',
   clock_timestamp() + interval '7 days', 1)$$,
  'seed claims for committed proof conflict results');
select lives_ok($$insert into profile_private.claim_proof_attempts(
  id, owner_id, claim_id, tier, method, challenge_hash, evidence_ref,
  attester_ids, independence_result, state, attempts_used, expires_at, version
) values
  ('73000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001',
   '72000000-0000-4000-8000-000000000001', 'A', 'domain_challenge',
   extensions.digest(pg_catalog.convert_to('482901', 'utf8'), 'sha256'), 'expired-proof', '{}',
   'pending', 'pending', 0, clock_timestamp() - interval '1 minute', 1),
  ('73000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001',
   '72000000-0000-4000-8000-000000000002', 'A', 'domain_challenge',
   extensions.digest(pg_catalog.convert_to('482901', 'utf8'), 'sha256'), 'rejected-proof', '{}',
   'pending', 'pending', 0, clock_timestamp() + interval '1 hour', 1),
  ('73000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001',
   '72000000-0000-4000-8000-000000000003', 'A', 'domain_challenge',
   extensions.digest(pg_catalog.convert_to('482901', 'utf8'), 'sha256'), 'exhausted-proof', '{}',
   'pending', 'pending', 5, clock_timestamp() + interval '1 hour', 1)$$,
  'seed expired, rejected, and exhausted proof attempts');

select pg_temp.set_jwt_claim('sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('app.actor_person_id', '20000000-0000-4000-8000-000000000002', true);
select set_config('app.acting_party_id', '10000000-0000-4000-8000-000000000002', true);
create temp table p2_s05_proof_failures(kind text primary key, response jsonb not null);
select lives_ok($$insert into p2_s05_proof_failures
  select 'expired', platform_api.rpc_submit_claim_proof(jsonb_build_object(
    'headers', jsonb_build_object('contentType','application/json',
      'idempotencyKey','proof-expired-key','ifMatch','"1"'),
    'claimId','72000000-0000-4000-8000-000000000001', 'body',
    jsonb_build_object('kind','challenge_code','challengeId','73000000-0000-4000-8000-000000000001',
      'code','482901','reasonCode','claim_proof')))$$,
  'expired proof returns a committed typed failure result');
select lives_ok($$insert into p2_s05_proof_failures
  select 'rejected', platform_api.rpc_submit_claim_proof(jsonb_build_object(
    'headers', jsonb_build_object('contentType','application/json',
      'idempotencyKey','proof-rejected-key','ifMatch','"1"'),
    'claimId','72000000-0000-4000-8000-000000000002', 'body',
    jsonb_build_object('kind','challenge_code','challengeId','73000000-0000-4000-8000-000000000002',
      'code','000000','reasonCode','claim_proof')))$$,
  'rejected proof returns a committed typed failure result');
select lives_ok($$insert into p2_s05_proof_failures
  select 'exhausted', platform_api.rpc_submit_claim_proof(jsonb_build_object(
    'headers', jsonb_build_object('contentType','application/json',
      'idempotencyKey','proof-exhausted-key','ifMatch','"1"'),
    'claimId','72000000-0000-4000-8000-000000000003', 'body',
    jsonb_build_object('kind','challenge_code','challengeId','73000000-0000-4000-8000-000000000003',
      'code','482901','reasonCode','claim_proof')))$$,
  'exhausted proof returns a committed typed failure result');
select ok((select (response->>'accepted')::boolean = false
  from p2_s05_proof_failures where kind = 'expired'),
  'expired proof is not reported as a successful resource');
select is((select response->>'errorCode' from p2_s05_proof_failures where kind = 'expired'),
  'CHALLENGE_EXPIRED', 'expired proof carries the conflict code');
select is((select response->>'errorCode' from p2_s05_proof_failures where kind = 'rejected'),
  'PROOF_REJECTED', 'rejected proof carries the conflict code');
select is((select (response->>'attemptsRemaining')::integer from p2_s05_proof_failures where kind = 'rejected'),
  4, 'rejected proof carries bounded remaining attempts');
select is((select response->>'errorCode' from p2_s05_proof_failures where kind = 'exhausted'),
  'PROOF_ATTEMPTS_EXHAUSTED', 'exhausted proof carries the conflict code');

select * from finish();
rollback;
