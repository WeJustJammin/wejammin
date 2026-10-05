\ir support/jwt-claims.sqlinc
begin;

select plan(23);

-- BE01b deliberate context binding, per-tab switching, and idempotency.
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

create temporary table context_switch_aliases (
  alias_key text primary key,
  party_id uuid not null,
  owner_person_id uuid not null,
  lifecycle platform_private.alias_lifecycle not null
);
insert into context_switch_aliases(alias_key, party_id, owner_person_id, lifecycle)
select v.alias_key, extensions.gen_random_uuid(),
       case when v.alias_key = 'foreign' then
         (select person_id from context_switch_actors where auth_user_id = 'b3111111-1111-4111-8111-111111111111')
       else (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111') end,
       v.lifecycle::platform_private.alias_lifecycle
from (values ('owned', 'active'), ('foreign', 'active'), ('retired', 'retired')) v(alias_key, lifecycle);
insert into platform_private.party(id, kind)
select party_id, 'alias' from context_switch_aliases;
insert into platform_private.handle_reservation(normalized_handle, display_handle, party_id)
select 'ctx-' || alias_key, 'ctx-' || alias_key, party_id from context_switch_aliases;
insert into platform_private.alias_party(party_id, display_name, current_handle_id, lifecycle)
select a.party_id, 'Context ' || a.alias_key, h.id, a.lifecycle
from context_switch_aliases a
join platform_private.handle_reservation h on h.party_id = a.party_id;
insert into platform_private.alias_ownership_period(alias_id, owner_person_id, starts_at)
select party_id, owner_person_id, clock_timestamp() - interval '1 day'
from context_switch_aliases;

create temporary table context_switch_valid_orgs (party_id uuid primary key);
insert into context_switch_valid_orgs(party_id)
select extensions.gen_random_uuid() from generate_series(1, 2);
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
create function pg_temp.try_context_bind(p_context_id uuid, p_confirm boolean, p_client_binding_id text)
returns jsonb language plpgsql as $fn$
declare returned_state text;
begin
  return platform_api.identity_context_bind(p_context_id, p_confirm, p_client_binding_id);
exception when others then
  get stacked diagnostics returned_state = returned_sqlstate;
  return pg_catalog.jsonb_build_object('error', sqlerrm, 'sqlstate', returned_state);
end;
$fn$;
create temporary table context_switch_bind_results(step text primary key, result jsonb not null);

select pg_temp.context_request('context-bind-auth-user-mismatch', 'c3111111-1111-4111-8111-111111111181', 'c3111111-1111-4111-8111-111111111182', 'tab-auth-user-mismatch');
select set_config('app.auth_user_id', 'b3111111-1111-4111-8111-111111111111', true);
select throws_ok(
  format('select platform_api.identity_context_bind(%L::uuid, true, %L)',
    (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
    'tab-auth-user-mismatch'),
  'P0001', 'UNAUTHENTICATED', 'authenticated context bind rejects mismatched app user and JWT subject'
);
select set_config('app.auth_user_id', 'a3111111-1111-4111-8111-111111111111', true);
select ok(
  not exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and key_hash = extensions.digest(convert_to('context-bind-auth-user-mismatch', 'UTF8'), 'sha256')
  )
  and not exists (
    select 1 from platform_private.acting_context_binding
     where client_binding_id = 'tab-auth-user-mismatch'
  )
  and not exists (
    select 1 from identity.security_events
     where request_id = 'c3111111-1111-4111-8111-111111111181'
  ),
  'mismatched authenticated identity fails before binding, idempotency, or security-event side effects'
);

select pg_temp.context_request('forged-context-key', 'c3111111-1111-4111-8111-111111111112', 'c3111111-1111-4111-8111-111111111113');
select throws_ok($$select platform_api.identity_context_bind('f3999999-9999-4999-8999-999999999999', true, 'tab-forged')$$,
  'P0001', 'CONTEXT_NOT_FOUND', 'caller-forged party UUID is rejected');
select pg_temp.context_request('missing-confirmation-key', 'c3111111-1111-4111-8111-111111111114', 'c3111111-1111-4111-8111-111111111115');
select throws_ok($$select platform_api.identity_context_bind((select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'), false, 'tab-no-confirm')$$,
  'P0001', 'INVALID_REQUEST', 'context selection requires deliberate confirmation');

select pg_temp.context_request('context-bind-malformed-client-header', 'c3111111-1111-4111-8111-111111111171', 'c3111111-1111-4111-8111-111111111172');
select set_config('request.headers', pg_catalog.jsonb_build_object(
  'idempotency-key', 'context-bind-malformed-client-header',
  'x-request-id', 'c3111111-1111-4111-8111-111111111171',
  'x-correlation-id', 'c3111111-1111-4111-8111-111111111172',
  'x-client-binding-id', 17
)::text, true);
select throws_ok(
  format('select platform_api.identity_context_bind(%L::uuid, true, %L)',
    (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
    'tab-malformed-header'),
  'P0001', 'INVALID_REQUEST', 'non-string client-binding header is rejected'
);
select pg_temp.context_request('context-bind-mismatched-client-header', 'c3111111-1111-4111-8111-111111111173', 'c3111111-1111-4111-8111-111111111174', 'tab-mismatch-header');
select throws_ok(
  format('select platform_api.identity_context_bind(%L::uuid, true, %L)',
    (select person_id::text from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
    'tab-mismatch-body'),
  'P0001', 'INVALID_REQUEST', 'client-binding header must exactly match the RPC selector'
);
select ok(
  not exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and key_hash in (
         extensions.digest(convert_to('context-bind-malformed-client-header', 'UTF8'), 'sha256'),
         extensions.digest(convert_to('context-bind-mismatched-client-header', 'UTF8'), 'sha256')
       )
  )
  and not exists (
    select 1 from platform_private.acting_context_binding
     where client_binding_id in ('tab-malformed-header', 'tab-mismatch-body')
  )
  and not exists (
    select 1 from identity.security_events
     where request_id in (
       'c3111111-1111-4111-8111-111111111171',
       'c3111111-1111-4111-8111-111111111173'
     )
  ),
  'invalid binding headers fail before idempotency or binding side effects'
);

select pg_temp.context_request('context-bind-first-tab-a', '019cc000-0000-7000-8000-000000000001', '019cc000-0000-7000-8000-000000000002', 'tab-a');
insert into context_switch_bind_results
select 'first', pg_temp.try_context_bind(party_id, true, 'tab-a')
from context_switch_aliases where alias_key = 'owned';
select ok(
  (select result->>'selectedPartyId' = party_id::text and not result ? 'error'
     from context_switch_bind_results, context_switch_aliases
    where step = 'first' and alias_key = 'owned'),
  'matching client-binding header permits a first deliberate bind of a current canonical alias'
);
select is(
  (select jsonb_typeof(result->'projectionVersion') from context_switch_bind_results where step = 'first'),
  'string',
  'binding projection version is serialized as a decimal string'
);
select is(
  (select jsonb_typeof(result->'version') from context_switch_bind_results where step = 'first'),
  'string',
  'binding version is serialized as a decimal string'
);
select ok(
  exists (
    select 1 from identity.security_events
     where action = 'identity.context.bind'
       and actor_auth_user_id = 'a3111111-1111-4111-8111-111111111111'
       and request_id = '019cc000-0000-7000-8000-000000000001'
       and correlation_id = '019cc000-0000-7000-8000-000000000002'
  ),
  'RFC 9562 version 7 request and correlation IDs are accepted and recorded'
);
select ok(
  (select count(*) = 1 and bool_and(acting_party_id = (select party_id from context_switch_aliases where alias_key = 'owned'))
       and bool_and(id <> acting_party_id)
     from platform_private.acting_context_binding
    where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
      and client_binding_id = 'tab-a' and state = 'active'),
  'first bind creates one opaque per-tab binding row distinct from the candidate ID'
);

select pg_temp.context_request('context-bind-same-target', 'c3111111-1111-4111-8111-111111111123', 'c3111111-1111-4111-8111-111111111124');
insert into context_switch_bind_results
select 'same-target', pg_temp.try_context_bind(party_id, true, 'tab-a')
from context_switch_aliases where alias_key = 'owned';
select ok(
  (select result->>'bindingId' = (select result->>'bindingId' from context_switch_bind_results where step = 'first')
       and (select count(*) = 1 from platform_private.acting_context_binding
             where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
                and client_binding_id = 'tab-a' and state = 'active')
       and exists (
         select 1 from platform_private.idempotency_records
          where actor_id = 'a3111111-1111-4111-8111-111111111111'
            and operation = 'identity.context.bind.tab-a'
            and key_hash = extensions.digest(convert_to('context-bind-same-target', 'UTF8'), 'sha256')
            and response_ref->>'status' = '201'
            and response_ref->'receipt' = (select result from context_switch_bind_results where step = 'same-target')
       )
     from context_switch_bind_results where step = 'same-target'),
  'same-target bind reuses the tab binding and stores HTTP 201 receipt metadata'
);

select pg_temp.context_request('context-bind-legacy-tab', 'c3111111-1111-4111-8111-111111111125', 'c3111111-1111-4111-8111-111111111126');
insert into context_switch_bind_results
select 'legacy', pg_temp.try_context_bind((select (result->>'bindingId')::uuid from context_switch_bind_results where step = 'first'), true, 'tab-legacy');
select ok(
  (select result->>'selectedPartyId' = (select party_id::text from context_switch_aliases where alias_key = 'owned')
       and not result ? 'error'
     from context_switch_bind_results where step = 'legacy'),
  'legacy active owned binding ID is accepted only through deliberate POST revalidation'
);

select pg_temp.context_request('context-bind-switch-tab-a', 'c3111111-1111-4111-8111-111111111127', 'c3111111-1111-4111-8111-111111111128');
insert into context_switch_bind_results
select 'switch', pg_temp.try_context_bind((select party_id from context_switch_org_choices where ordinal = 1), true, 'tab-a');
select ok(
  (select result->>'selectedPartyId' = (select party_id::text from context_switch_org_choices where ordinal = 1)
       and not result ? 'error'
       and (select count(*) = 1 from platform_private.acting_context_binding
             where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
               and client_binding_id = 'tab-a' and state = 'active')
       and (select state = 'revoked' from platform_private.acting_context_binding
             where id = (select (result->>'bindingId')::uuid from context_switch_bind_results where step = 'first'))
     from context_switch_bind_results where step = 'switch'),
  'switch replaces and revokes only the previous binding on the same tab'
);
select ok(
  (select (select acting_party_id = (select party_id from context_switch_aliases where alias_key = 'owned')
            from platform_private.acting_context_binding
           where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
             and client_binding_id = 'tab-legacy' and state = 'active')
        and (select acting_party_id = (select party_id from context_switch_org_choices where ordinal = 1)
            from platform_private.acting_context_binding
           where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
             and client_binding_id = 'tab-a' and state = 'active')),
  'switching one tab leaves another tab’s active context unchanged'
);

select pg_temp.context_request('context-bind-tab-b', 'c3111111-1111-4111-8111-111111111129', 'c3111111-1111-4111-8111-111111111130');
insert into context_switch_bind_results
select 'tab-b', pg_temp.try_context_bind((select party_id from context_switch_org_choices where ordinal = 2), true, 'tab-b');
select ok(
  (select result->>'selectedPartyId' = (select party_id::text from context_switch_org_choices where ordinal = 2)
       and not result ? 'error'
        and (select acting_party_id = (select party_id from context_switch_org_choices where ordinal = 1)
            from platform_private.acting_context_binding
           where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
             and client_binding_id = 'tab-a' and state = 'active')
     from context_switch_bind_results where step = 'tab-b'),
  'a second tab may bind independently without changing the first tab'
);

select pg_temp.context_request('context-bind-first-tab-a', 'c3111111-1111-4111-8111-111111111121', 'c3111111-1111-4111-8111-111111111122');
insert into context_switch_bind_results
select 'replay', pg_temp.try_context_bind(party_id, true, 'tab-a')
from context_switch_aliases where alias_key = 'owned';
select ok(
  (select result->>'bindingId' = (select result->>'bindingId' from context_switch_bind_results where step = 'first')
        and result->>'selectedPartyId' = (select party_id::text from context_switch_aliases where alias_key = 'owned')
        and result->>'version' = (select result->>'version' from context_switch_bind_results where step = 'first')
        and (select state = 'revoked' from platform_private.acting_context_binding
             where id = (result->>'bindingId')::uuid)
        and (select acting_party_id = (select party_id from context_switch_org_choices where ordinal = 1)
            from platform_private.acting_context_binding
           where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
             and client_binding_id = 'tab-a' and state = 'active')
     from context_switch_bind_results where step = 'replay'),
  'idempotency replay returns its original receipt without reactivating a later-revoked binding'
);
select ok(
  (select result = (select result from context_switch_bind_results where step = 'first')
     from context_switch_bind_results where step = 'replay')
  and exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and operation = 'identity.context.bind.tab-a'
       and key_hash = extensions.digest(convert_to('context-bind-first-tab-a', 'UTF8'), 'sha256')
       and response_ref->>'status' = '201'
       and response_ref->'receipt' = (select result from context_switch_bind_results where step = 'first')
  ),
  'identical replay preserves the original 201 status and exact receipt metadata'
);
select pg_temp.context_request('context-bind-first-tab-a', 'c3111111-1111-4111-8111-111111111131', 'c3111111-1111-4111-8111-111111111132');
select throws_ok(
  format('select platform_api.identity_context_bind(%L::uuid, true, %L)',
     (select party_id::text from context_switch_org_choices where ordinal = 2), 'tab-a'),
  'P0001', 'IDEMPOTENCY_MISMATCH', 'same idempotency key rejects a different canonical bind request'
);

select pg_temp.context_request('context-bind-boundary-106', 'c3111111-1111-4111-8111-111111111161', 'c3111111-1111-4111-8111-111111111162');
insert into context_switch_bind_results
select 'boundary-106', pg_temp.try_context_bind(person_id, true, repeat('a', 106))
from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111';
select ok(
  (select not result ? 'error' from context_switch_bind_results where step = 'boundary-106')
  and exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and key_hash = extensions.digest(convert_to('context-bind-boundary-106', 'UTF8'), 'sha256')
       and operation = 'identity.context.bind.' || repeat('a', 106)
       and char_length(operation) = 128
  ),
  '106-character selector uses the full 128-character idempotency operation limit'
);

select pg_temp.context_request('context-bind-boundary-107', 'c3111111-1111-4111-8111-111111111163', 'c3111111-1111-4111-8111-111111111164');
insert into context_switch_bind_results
select 'boundary-107', pg_temp.try_context_bind(person_id, true, repeat('b', 107))
from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111';
select ok(
  (select not result ? 'error' from context_switch_bind_results where step = 'boundary-107')
  and exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and key_hash = extensions.digest(convert_to('context-bind-boundary-107', 'UTF8'), 'sha256')
       and operation = 'identity.context.bind.' || pg_catalog.encode(
         extensions.digest(convert_to(repeat('b', 107), 'UTF8'), 'sha256'), 'hex'
       )
       and char_length(operation) <= 128
  ),
  '107-character selector hashes before it exceeds the operation length limit'
);

select pg_temp.context_request('context-bind-boundary-128', 'c3111111-1111-4111-8111-111111111165', 'c3111111-1111-4111-8111-111111111166');
insert into context_switch_bind_results
select 'boundary-128', pg_temp.try_context_bind(person_id, true, repeat('c', 128))
from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111';
select ok(
  (select not result ? 'error' from context_switch_bind_results where step = 'boundary-128')
  and exists (
    select 1 from platform_private.idempotency_records
     where actor_id = 'a3111111-1111-4111-8111-111111111111'
       and key_hash = extensions.digest(convert_to('context-bind-boundary-128', 'UTF8'), 'sha256')
       and operation = 'identity.context.bind.' || pg_catalog.encode(
         extensions.digest(convert_to(repeat('c', 128), 'UTF8'), 'sha256'), 'hex'
       )
       and char_length(operation) <= 128
  ),
  'maximum 128-character selector remains accepted through a hashed idempotency operation'
);

select * from finish();
rollback;
