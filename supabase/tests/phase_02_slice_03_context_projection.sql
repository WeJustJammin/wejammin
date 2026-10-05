\ir support/jwt-claims.sqlinc
begin;
select plan(61);

-- P2-S03-AC-069..074 / BE01b-12: bounded list projection, canonical
-- candidate derivation, and private-table isolation.
select has_table('platform_private', 'acting_context_binding', 'context binding table is reused');
select has_column('platform_private', 'acting_context_binding', 'person_id', 'binding retains the human owner');
select has_column('platform_private', 'acting_context_binding', 'acting_party_id', 'binding retains selected party');
select has_column('platform_private', 'acting_context_binding', 'context_kind', 'binding persists context kind');
select has_column('platform_private', 'acting_context_binding', 'client_binding_id', 'binding persists opaque tab id');
select has_column('platform_private', 'acting_context_binding', 'state', 'binding has revoked and expired states');
select has_column('platform_private', 'acting_context_binding', 'last_seen_at', 'binding tracks idle activity');
select has_column('platform_private', 'acting_context_binding', 'expires_at', 'binding persists server expiry');
select has_column('platform_private', 'acting_context_binding', 'projection_version', 'binding carries projection version');
select has_column('platform_private', 'acting_context_binding', 'version', 'binding is versioned');
select has_index('platform_private', 'acting_context_binding', 'one_active_context_binding_per_client', 'one active binding per person and tab');
select has_index('platform_private', 'acting_context_binding', 'context_binding_person', 'binding reads have person/state/idle index');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('platform_private.acting_context_binding')), false), 'context binding is force-RLS protected');
select ok(not has_table_privilege('anon', 'platform_private.acting_context_binding', 'select'), 'anon cannot read bindings directly');
select ok(not has_table_privilege('authenticated', 'platform_private.acting_context_binding', 'select'), 'authenticated cannot read bindings directly');
select ok(not has_table_privilege('service_role', 'platform_private.acting_context_binding', 'insert'), 'service role cannot insert context grants directly');
select ok(not has_schema_privilege('anon', 'platform_private', 'usage'), 'anon cannot use private schema');
select ok(not has_schema_privilege('authenticated', 'platform_private', 'usage'), 'authenticated cannot use private schema');
select has_function('platform_api', 'identity_contexts_read', array['text'], 'BE01b-12 list RPC accepts only an optional opaque cursor');
select has_function('platform_api', 'identity_context_bind', array['uuid', 'boolean', 'text'], 'BE01b-13 bind RPC receives context, confirmation, and tab id');
select has_function('platform_api', 'get_public_party_projection', array['uuid'], 'BE01b-18 exposes named public projection RPC');
select ok(case when to_regprocedure('platform_api.identity_contexts_read(text)') is null then false else has_function_privilege('authenticated', 'platform_api.identity_contexts_read(text)', 'execute') end, 'authenticated can execute context list only through platform_api');
select ok(case when to_regprocedure('platform_api.identity_context_bind(uuid,boolean,text)') is null then false else has_function_privilege('authenticated', 'platform_api.identity_context_bind(uuid,boolean,text)', 'execute') end, 'authenticated can execute deliberate bind RPC');
select ok(case when to_regprocedure('platform_api.get_public_party_projection(uuid)') is null then false else has_function_privilege('anon', 'platform_api.get_public_party_projection(uuid)', 'execute') end, 'anon receives only named public projection RPC');
select ok(case when to_regprocedure('platform_api.get_public_party_projection(uuid)') is null then false else has_function_privilege('authenticated', 'platform_api.get_public_party_projection(uuid)', 'execute') end, 'authenticated receives named public projection RPC');
select ok(case when to_regprocedure('platform_api.get_public_party_projection(uuid)') is null then false else (select prosecdef and pg_get_functiondef(oid) ~ $$set search_path = ''$$ from pg_proc where oid = to_regprocedure('platform_api.get_public_party_projection(uuid)')) end, 'public projection is a fixed-search-path security-definer boundary');
select ok(to_regclass('platform_private.identity_public_projection') is not null, 'public projection has a named derived view');
select ok(to_regclass('platform_private.identity_public_person_projection') is not null, 'person projection stays separate from private identity data');

-- Fixture uses the existing authentication boundary, leaving the Slice 03
-- RPCs themselves absent so this file is intentionally RED.
select lives_ok($$insert into auth.users(id) values ('a3111111-1111-4111-8111-111111111111')$$, 'projection fixture Auth user is accepted');
select lives_ok($$select platform_api.auth_bootstrap('a3111111-1111-4111-8111-111111111111', decode(repeat('ab', 32), 'hex'), decode(repeat('cd', 32), 'hex'), 'a3111111-1111-4111-8111-111111111112', 'a3111111-1111-4111-8111-111111111113')$$, 'fixture receives canonical self context');
select pg_temp.set_jwt_claim('sub', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.auth_user_id', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_auth_user_id', 'a3111111-1111-4111-8111-111111111111', true);
select set_config('app.actor_person_id', (select person_id::text from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111'), true);
select set_config('app.request_id', 'a3111111-1111-4111-8111-111111111112', true);
select set_config('app.correlation_id', 'a3111111-1111-4111-8111-111111111113', true);
select set_config('app.idempotency_key', 'slice03-context-bind-a', true);
select set_config('app.idempotency_key_hash', repeat('44', 32), true);
select set_config('app.request_hash', repeat('55', 32), true);

-- Dynamic helpers retain TAP output when an expected RED function is absent.
create or replace function pg_temp.context_list_json(p_cursor text) returns jsonb language plpgsql as $fn$
declare result jsonb;
begin
  execute 'select to_jsonb(row_value) from (select platform_api.identity_contexts_read($1) as row_value) q' into result using p_cursor;
  return result;
exception when others then return null;
end;
$fn$;
create or replace function pg_temp.context_bind_json(p_context_id uuid, p_confirm boolean, p_client_binding_id text) returns jsonb language plpgsql as $fn$
declare result jsonb;
begin
  execute 'select to_jsonb(row_value) from (select platform_api.identity_context_bind($1, $2, $3) as row_value) q' into result using p_context_id, p_confirm, p_client_binding_id;
  return result;
exception when others then return null;
end;
$fn$;
create or replace function pg_temp.public_projection_json(p_party_id uuid) returns jsonb language plpgsql as $fn$
declare result jsonb;
begin
  execute 'select to_jsonb(row_value) from (select platform_api.get_public_party_projection($1) as row_value) q' into result using p_party_id;
  return result;
exception when others then return null;
end;
$fn$;

select lives_ok($$select platform_api.identity_contexts_read(null)$$, 'P2-S03-AC-069 list returns server-derived projection');
select ok(coalesce(pg_temp.context_list_json(null) ?& array['projectionVersion', 'items', 'nextCursor', 'hasMore'], false), 'list response contains the cursor-page envelope');
select ok(coalesce(jsonb_array_length(pg_temp.context_list_json(null)->'items') <= 50, false), 'list never returns more than fifty candidates');
select ok(coalesce(pg_temp.context_list_json(null) is not null and (pg_temp.context_list_json(null)->>'nextCursor' is null or pg_temp.context_list_json(null)->>'nextCursor' !~ '^[0-9]+$'), false), 'nextCursor is opaque rather than an offset');
select ok(coalesce(pg_temp.context_list_json(null)->'items' @> jsonb_build_array(jsonb_build_object('partyId', current_setting('app.actor_person_id'), 'kind', 'person')), false), 'list derives canonical self candidate from current records');
select ok(coalesce(pg_temp.context_list_json(null)::text !~* 'owner(_|)person|relationship(_|)id|mandate|capabilityClasses', false), 'list redacts owner, relationship, mandate, and capability evidence');

-- P2-S03-AC-075..080 / BE01b-13: one deliberate, server-revalidated
-- selection per tab; expiry and revocation fail closed to self.
select throws_ok($$select platform_api.identity_context_bind((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), false, 'tab-no-confirm')$$, 'P0001', 'INVALID_REQUEST', 'P2-S03-AC-099 rejects missing deliberate confirmation');
select throws_ok($$select platform_api.identity_context_bind('a3999999-9999-4999-8999-999999999999', true, 'tab-deep-link')$$, 'P0001', 'CONTEXT_NOT_FOUND', 'bind rejects deep-link or caller-built non-candidate');
select lives_ok($$select platform_api.identity_context_bind((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), true, 'tab-a')$$, 'deliberate bind succeeds for tab-a');
select ok(coalesce(pg_temp.context_bind_json((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), true, 'tab-a') ?& array['bindingId', 'selectedPartyId', 'expiresAt', 'projectionVersion', 'version'], false), 'bind returns bounded binding projection');
select ok(coalesce(not (pg_temp.context_bind_json((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), true, 'tab-a') ? 'clientBindingId') and not (pg_temp.context_bind_json((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), true, 'tab-a') ? 'client_binding_id'), false), 'bind never echoes clientBindingId or persistence name');
select is((select count(*)::integer from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-a' and state = 'active'), 1, 'bind creates one active tab-a row');
select lives_ok($$select platform_api.identity_context_bind((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid order by created_at limit 1), true, 'tab-b')$$, 'independent deliberate bind succeeds for tab-b');
select is((select count(*)::integer from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and state = 'active' and client_binding_id in ('tab-a', 'tab-b')), 2, 'active selections are isolated by tab id');
select is((select count(*)::integer from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and state = 'active' and client_binding_id = 'tab-a'), 1, 'same-tab retry does not duplicate active rows');
select lives_ok($$update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '12 hours' - interval '1 second' where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-a'$$, 'fixture advances tab-a beyond twelve-hour idle limit');
select lives_ok($$select platform_api.identity_contexts_read(null)$$, 'list reconciles an idle binding before returning authority');
select is((select state from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-a' order by updated_at desc limit 1), 'expired', 'idle context expires after twelve hours');
select throws_ok($$select platform_api.identity_context_bind((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-a' order by created_at limit 1), true, 'tab-a')$$, 'P0001', 'CONTEXT_RECONFIRM_REQUIRED', 'expired context requires fresh confirmation');
select lives_ok($$update platform_private.acting_context_binding set state = 'revoked' where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-b'$$, 'fixture revokes tab-b authority');
select throws_ok($$select platform_api.identity_context_bind((select id from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'tab-b' order by created_at limit 1), true, 'tab-b')$$, 'P0001', 'CONTEXT_REVOKED', 'revoked context fails closed at bind time');
select is((select count(*)::integer from platform_private.acting_context_binding where person_id = current_setting('app.actor_person_id')::uuid and client_binding_id = 'self' and state = 'active'), 1, 'revoked or expired tabs retain active self fallback');

-- P2-S03-AC-081..086 / BE01b-18: public identity is a fixed allowlist,
-- never a private-table read or an owner/legal/relationship disclosure.
select lives_ok($$select platform_api.get_public_party_projection((select person_id from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111'))$$, 'public projection returns approved party data');
select ok(coalesce(pg_temp.public_projection_json((select person_id from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111')) ?& array['partyId', 'kind', 'displayName', 'handle', 'profileRef', 'publicLinkState', 'lifecycle', 'version', 'facetLabels'], false), 'public response contains strict projection fields');
select ok(coalesce(pg_temp.public_projection_json((select person_id from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111')) is not null and not exists (select 1 from jsonb_object_keys(pg_temp.public_projection_json((select person_id from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111'))) key where key not in ('partyId', 'kind', 'displayName', 'handle', 'profileRef', 'publicLinkState', 'lifecycle', 'version', 'facetLabels')), false), 'public response has no undeclared fields');
select ok(coalesce(not (pg_temp.public_projection_json((select person_id from identity.auth_user_bindings where auth_user_id = 'a3111111-1111-4111-8111-111111111111')) ?| array['ownerPersonId', 'owner_person_id', 'legalIdentityId', 'legal_identity_id', 'privateFacets', 'relationshipId', 'mandateId', 'disclosureHistory']), false), 'public response redacts owner, legal, relationship, mandate, and disclosure data');
select throws_ok($$select platform_api.get_public_party_projection('a3999999-9999-4999-8999-999999999999')$$, 'P0001', 'NOT_FOUND', 'public projection conceals an absent or unpublished party');
select ok(not has_table_privilege('anon', 'platform_private.person_party', 'select') and not has_table_privilege('anon', 'platform_private.party', 'select') and not has_table_privilege('authenticated', 'platform_private.person_party', 'select'), 'public projection cannot be replaced by direct base-table grants');

-- Context effects are durable, atomic, and identifier-only.
select ok((select count(*) from audit_private.audit_events where action in ('identity.context.bind', 'identity.acting-context.bind') and acting_party_id = current_setting('app.actor_person_id')::uuid) >= 1, 'context bind writes a durable audit record');
select ok((select count(*) from platform_private.outbox_events where event_type like 'identity.%context%' and aggregate_id = current_setting('app.actor_person_id')::uuid) >= 1, 'context bind writes a transactional outbox event');
select ok(coalesce((select not (payload ? 'clientBindingId') and not (payload ? 'client_binding_id') from platform_private.outbox_events where event_type like 'identity.%context%' and aggregate_id = current_setting('app.actor_person_id')::uuid order by occurred_at desc limit 1), false), 'context outbox payload carries no tab binding identifier');

select finish();
rollback;
