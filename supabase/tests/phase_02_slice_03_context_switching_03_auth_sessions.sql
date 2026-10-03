\ir support/jwt-claims.sqlinc
begin;

select plan(13);

-- BE01b authentication-session context resolution and fail-closed selectors.
-- Each suite owns and rolls back its own fixtures.
insert into auth.users(id) values
  ('a3111111-1111-4111-8111-111111111111'),
  ('b3111111-1111-4111-8111-111111111111');
select platform_api.auth_bootstrap(
  'a3111111-1111-4111-8111-111111111111', decode(repeat('ab', 32), 'hex'),
  decode(repeat('ac', 32), 'hex'), 'a3111111-1111-4111-8111-111111111112',
  'a3111111-1111-4111-8111-111111111113'
);
select platform_api.auth_bootstrap(
  'b3111111-1111-4111-8111-111111111111', decode(repeat('ba', 32), 'hex'),
  decode(repeat('bb', 32), 'hex'), 'b3111111-1111-4111-8111-111111111112',
  'b3111111-1111-4111-8111-111111111113'
);

create temporary table context_switch_actors as
select auth_user_id, person_id from identity.auth_user_bindings
where auth_user_id in (
  'a3111111-1111-4111-8111-111111111111',
  'b3111111-1111-4111-8111-111111111111'
);

select pg_temp.set_jwt_claim('sub', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.auth_user_id', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'), true);
select set_config('app.request_id', 'a3111111-1111-4111-8111-111111111112', true);
select set_config('app.correlation_id', 'a3111111-1111-4111-8111-111111111113', true);
select set_config('app.idempotency_key_hash', '', true);
select set_config('app.request_hash', '', true);
select set_config('request.headers', '{}', true);

create temporary table context_switch_valid_orgs (party_id uuid primary key);
insert into context_switch_valid_orgs(party_id)
select extensions.gen_random_uuid() from generate_series(1, 1);
insert into platform_private.party(id, kind)
select party_id, 'organization' from context_switch_valid_orgs;
insert into identity_private.organization_party(party_id)
select party_id from context_switch_valid_orgs;
insert into identity_private.membership_tenure(
  organization_id, person_id, state, provenance, governance_mode,
  starts_on, ends_on, accepted_at, revoked_at, accepted_terms_version_id,
  terms_hash, invite_expires_at, evidence_ref, actor_id
)
select party_id,
       (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
       'confirmed', 'invitation', 'ungoverned', current_date - 1, null,
       clock_timestamp() - interval '1 day', null, null, null, null, null,
       (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
from context_switch_valid_orgs;

create temporary table context_switch_org_choices as
select party_id, row_number() over (order by party_id)::integer as ordinal
from context_switch_valid_orgs;

insert into platform_private.acting_context_binding(
  person_id, acting_party_id, context_kind, source_relationship_id,
  client_binding_id, state, selected_at, last_seen_at, expires_at,
  projection_version, version
)
select actor.person_id, org.party_id, 'organization', tenure.id,
       'tab-a', 'active', clock_timestamp(), clock_timestamp(),
       clock_timestamp() + interval '12 hours', 1, 1
from context_switch_actors actor
join context_switch_org_choices org on org.ordinal = 1
join identity_private.membership_tenure tenure
  on tenure.organization_id = org.party_id and tenure.person_id = actor.person_id
where actor.auth_user_id = 'a3111111-1111-4111-8111-111111111111';
insert into platform_private.acting_context_binding(
  person_id, acting_party_id, context_kind, client_binding_id, state,
  selected_at, last_seen_at, expires_at, projection_version, version
)
select person_id, person_id, 'person', 'tab-b', 'active',
       clock_timestamp(), clock_timestamp(), 'infinity'::timestamptz, 1, 1
from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111';
select platform_api.auth_session_register(
  'a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141',
  clock_timestamp() - interval '1 minute', 'a3111111-1111-4111-8111-111111111142',
  'a3111111-1111-4111-8111-111111111143'
);
select platform_api.auth_session_register(
  'b3111111-1111-4111-8111-111111111111', 'b3111111-1111-4111-8111-111111111141',
  clock_timestamp() - interval '1 minute', 'b3111111-1111-4111-8111-111111111142',
  'b3111111-1111-4111-8111-111111111143'
);
insert into platform_private.acting_context_binding(
  person_id, acting_party_id, context_kind, client_binding_id, state, selected_at, last_seen_at, expires_at
)
select person_id, person_id, 'person', 'foreign-tab', 'active', clock_timestamp(), clock_timestamp(), 'infinity'::timestamptz
from context_switch_actors where auth_user_id = 'b3111111-1111-4111-8111-111111111111';
create function pg_temp.context_request(
  p_key text, p_request_id text, p_correlation_id text,
  p_client_binding_id text default null
)
returns void language plpgsql as $fn$
declare request_headers jsonb;
begin
  request_headers := pg_catalog.jsonb_build_object(
    'idempotency-key', p_key,
    'x-request-id', p_request_id,
    'x-correlation-id', p_correlation_id
  );
  if p_client_binding_id is not null then
    request_headers := request_headers || pg_catalog.jsonb_build_object(
      'x-client-binding-id', p_client_binding_id
    );
  end if;
  perform set_config('request.headers', request_headers::text, true);
  perform set_config('app.idempotency_key_hash', '', true);
  perform set_config('app.request_hash', '', true);
  perform set_config('app.request_id', '', true);
  perform set_config('app.correlation_id', '', true);
end;
$fn$;
create function pg_temp.try_auth_session_read(p_auth_user_id uuid, p_session_id uuid)
returns jsonb language plpgsql as $fn$
declare returned_state text;
begin
  return platform_api.auth_session_read(p_auth_user_id, p_session_id);
exception when others then
  get stacked diagnostics returned_state = returned_sqlstate;
  return pg_catalog.jsonb_build_object('error', sqlerrm, 'sqlstate', returned_state);
end;
$fn$;
select set_config('request.headers', '{}', true);
create temporary table context_switch_self_read(response jsonb);
insert into context_switch_self_read
select platform_api.auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141');
select is(
  (select response->>'actingPartyId' from context_switch_self_read),
  (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
  'missing client binding header resolves auth session to self'
);
select ok(
  (select response ? 'actingContextId'
       and response->'actingContextId' = 'null'::jsonb
     from context_switch_self_read),
  'absent client binding selector returns explicit null actingContextId'
);
select ok(
  not exists (
    select 1 from platform_private.acting_context_binding
     where client_binding_id = 'd3111111-1111-4111-8111-111111111177'
  ),
  'fresh browser tab UUID has never been recorded by any person'
);
select set_config('request.headers', '{"x-client-binding-id":"d3111111-1111-4111-8111-111111111177"}', true);
create temporary table context_switch_unseen_read(response jsonb);
insert into context_switch_unseen_read
select pg_temp.try_auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141');
select is(
  (select response->>'actingPartyId' from context_switch_unseen_read),
  (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
  'globally unseen client binding UUID resolves to self before the first deliberate bind'
);
select ok(
  (select response ? 'actingContextId'
       and response->'actingContextId' = 'null'::jsonb
     from context_switch_unseen_read),
  'unbound client binding selector returns explicit null actingContextId'
);
update platform_private.acting_context_binding
set last_seen_at = clock_timestamp() - interval '10 minutes', expires_at = clock_timestamp() + interval '1 day'
where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
  and client_binding_id = 'tab-a' and state = 'active';
select set_config('request.headers', '{"x-client-binding-id":"tab-a"}', true);
create temporary table context_switch_session_result(response jsonb);
insert into context_switch_session_result
select platform_api.auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141');
select ok(
  (select response->>'actingPartyId' from context_switch_session_result)
    = (select party_id::text from context_switch_org_choices where ordinal = 1)
  and (select last_seen_at > clock_timestamp() - interval '1 minute'
       from platform_private.acting_context_binding
       where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
         and client_binding_id = 'tab-a' and state = 'active'),
  'active tab header resolves the selected party and touches binding freshness'
);
select is(
  (select response->>'actingContextId' from context_switch_session_result),
  (select id::text from platform_private.acting_context_binding
    where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
      and client_binding_id = 'tab-a' and state = 'active'),
  'validated active tab binding id is returned as actingContextId'
);
select ok(
  (select response ?& array['accountState', 'bootstrapState', 'personId', 'actingPartyId']
       and response->>'accountState' = 'active'
       and response->>'bootstrapState' = 'complete'
       and response->>'personId' = (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
     from context_switch_session_result),
  'existing public session projection fields remain unchanged with a tab selector'
);
select set_config('request.headers', '{"x-client-binding-id":"foreign-tab"}', true);
select throws_ok($$select platform_api.auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141')$$,
  'P0001', 'CONTEXT_NOT_FOUND', 'foreign tab binding is not selectable by another person');
update platform_private.acting_context_binding
set last_seen_at = clock_timestamp() - interval '13 hours', expires_at = clock_timestamp() + interval '1 day'
where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
  and client_binding_id = 'tab-a' and state = 'active';
select set_config('request.headers', '{"x-client-binding-id":"tab-a"}', true);
select throws_ok($$select platform_api.auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141')$$,
  'P0001', 'CONTEXT_RECONFIRM_REQUIRED', 'stale tab binding fails closed in auth session read');
select pg_temp.context_request('context-bind-stale-legacy', 'c3111111-1111-4111-8111-111111111151', 'c3111111-1111-4111-8111-111111111152');
select throws_ok(
  format('select platform_api.identity_context_bind(%L::uuid, true, %L)',
    (select id::text from platform_private.acting_context_binding
      where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
        and client_binding_id = 'tab-a' and state = 'active'), 'tab-stale-copy'),
  'P0001', 'CONTEXT_RECONFIRM_REQUIRED', 'stale legacy binding ID cannot be reused to select a context'
);
update platform_private.acting_context_binding
set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
  and client_binding_id = 'tab-b' and state = 'active';
select set_config('request.headers', '{"x-client-binding-id":"tab-b"}', true);
select throws_ok($$select platform_api.auth_session_read('a3111111-1111-4111-8111-111111111111', 'a3111111-1111-4111-8111-111111111141')$$,
  'P0001', 'CONTEXT_REVOKED', 'revoked tab binding fails closed in auth session read');
select ok(
  not has_table_privilege('authenticated', 'platform_private.acting_context_binding', 'select')
  and not has_table_privilege('service_role', 'platform_private.acting_context_binding', 'select'),
  'context binding rows remain inaccessible through direct table grants'
);

select * from finish();
rollback;
