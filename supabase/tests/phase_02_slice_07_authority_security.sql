\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id) values
  ('a7111111-1111-4111-8111-111111111111'),
  ('a7222222-2222-4222-8222-222222222222');

select pg_temp.set_jwt_claim('role', 'authenticated', true);
select pg_temp.set_jwt_claim('sub', 'a7111111-1111-4111-8111-111111111111', true);

select throws_ok(
  $$select platform_private.cfg_actor(jsonb_build_object(
    'context', jsonb_build_object(
      'authUserId', 'a7222222-2222-4222-8222-222222222222',
      'actorPersonId', 'a7222222-2222-4222-8222-222222222222'
    )
  ))$$,
  'P0001',
  'UNAUTHENTICATED',
  'P2-S07-AC-019 authenticated request context cannot impersonate another JWT subject'
);

select is(
  platform_private.cfg_actor(jsonb_build_object(
    'context', jsonb_build_object(
      'authUserId', 'a7111111-1111-4111-8111-111111111111',
      'actorPersonId', 'a7111111-1111-4111-8111-111111111111'
    )
  )),
  'a7111111-1111-4111-8111-111111111111'::uuid,
  'P2-S07-AC-013 matching authenticated JWT context resolves the canonical actor'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'platform_api.cfg_propose_change(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'platform_api.cfg_change_action(jsonb)',
    'EXECUTE'
  ),
  'P2-S07-AC-025 authenticated Data API callers cannot invoke privileged configuration mutations'
);

select ok(
  has_function_privilege(
    'service_role',
    'platform_api.cfg_propose_change(jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'platform_api.cfg_change_action(jsonb)',
    'EXECUTE'
  ),
  'P2-S07-AC-007 verified Worker service role retains the named configuration RPC boundary'
);

select lives_ok(
  $$select platform_private.cfg_require_fresh_step_up(jsonb_build_object(
    'context', jsonb_build_object(
      'stepUpVerified', true,
      'stepUpAt', clock_timestamp()
    )
  ))$$,
  'P2-S07-AC-003 a current server-verified MFA instant satisfies the step-up boundary'
);

select throws_ok(
  $$select platform_private.cfg_require_fresh_step_up(jsonb_build_object(
    'context', jsonb_build_object(
      'stepUpVerified', true,
      'stepUpAt', clock_timestamp() - interval '11 minutes'
    )
  ))$$,
  'P0001',
  'STEP_UP_REQUIRED',
  'P2-S07-AC-040 stale MFA is rejected at the transactional boundary'
);

select lives_ok(
  $$select platform_api.auth_bootstrap(
    'a7111111-1111-4111-8111-111111111111',
    decode(repeat('71', 32), 'hex'),
    decode(repeat('72', 32), 'hex'),
    'a7333333-3333-4333-8333-333333333333',
    'a7444444-4444-4444-8444-444444444444'
  )$$,
  'Slice 07 capability fixture bootstraps an authenticated person party'
);

select set_config('app.auth_user_id', 'a7111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', 'a7111111-1111-4111-8111-111111111111', true);
select set_config(
  'app.actor_person_id',
  (select person_id::text from identity.auth_user_bindings
    where auth_user_id = 'a7111111-1111-4111-8111-111111111111'),
  true
);
select set_config('app.correlation_id', 'a7555555-5555-4555-8555-555555555555', true);
select set_config('app.idempotency_key_hash', 'slice07-capability-org', true);
select set_config('app.request_hash', 'slice07-capability-org-request', true);

create temp table p2_s07_authority_org as
select (result->>'organizationId')::uuid as organization_id,
       (select person_id from identity.auth_user_bindings
         where auth_user_id = 'a7111111-1111-4111-8111-111111111111') as person_id
  from lateral (
    select platform_api.rpc_create_organization('self_member', '{}'::text[]) as result
  ) created;

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
select organization_id, person_id, 'settings.profile.write', current_date,
       current_date + 1, true
  from p2_s07_authority_org;

select lives_ok(
  $$select platform_private.cfg_require_capability(
    'a7111111-1111-4111-8111-111111111111',
    (select organization_id from p2_s07_authority_org),
    'settings.profile.write'
  )$$,
  'P2-S07-AC-019 exact current capability and organization scope authorize a settings editor'
);

update identity_private.organization_actor_grant
   set active = false
 where organization_id = (select organization_id from p2_s07_authority_org)
   and capability_code = 'settings.profile.write';

select throws_ok(
  $$select platform_private.cfg_require_capability(
    'a7111111-1111-4111-8111-111111111111',
    (select organization_id from p2_s07_authority_org),
    'settings.profile.write'
  )$$,
  'P0001',
  'FORBIDDEN',
  'P2-S07-AC-039 revoked grants fail closed before configuration mutation'
);

select throws_ok(
  $$insert into platform_private.cfg_config_change_reviews(
    candidate_type, candidate_id, candidate_version, frozen_hash,
    impact_manifest, impact_manifest_hash, rollback_value, rollback_hash,
    risk_class, required_approvals, state, submitted_by
  ) values (
    'setting_value', 'a7666666-6666-4666-8666-666666666666', 1,
    repeat('a', 64), '{}'::jsonb, repeat('b', 64),
    jsonb_build_object('enabled', false), repeat('c', 64),
    'high', 2, 'draft', 'a7111111-1111-4111-8111-111111111111'
  )$$,
  '23514',
  'new row for relation "cfg_config_change_reviews" violates check constraint "cfg_review_rollback_pair_check"',
  'P2-S07-AC-003 rollback candidate hashes are immutable and content-addressed'
);

select * from finish();

rollback;
