\ir support/jwt-claims.sqlinc
begin;

select plan(22);

-- BE01b candidate-list contract: self, active aliases, and accepted organizations.
-- This suite owns and rolls back its fixtures.
select has_function('platform_api', 'identity_contexts_read', array['text'],
  'context list RPC keeps its public signature');
select has_function('platform_api', 'identity_context_bind', array['uuid', 'boolean', 'text'],
  'context bind RPC keeps its public signature');
select has_function('platform_api', 'auth_session_read', array['uuid', 'uuid'],
  'auth session read keeps its public signature');
select ok(has_function_privilege('service_role', 'platform_api.auth_session_read(uuid,uuid)', 'execute'),
  'auth session read remains service-role executable');
select ok(not has_function_privilege('authenticated', 'platform_api.auth_session_read(uuid,uuid)', 'execute'),
  'authenticated cannot execute auth session read');
select ok(has_function_privilege('authenticated', 'platform_api.identity_contexts_read(text)', 'execute'),
  'authenticated can read context candidates');
select ok(not has_function_privilege('service_role', 'platform_api.identity_contexts_read(text)', 'execute'),
  'service role cannot execute context list');
select ok(has_function_privilege('authenticated', 'platform_api.identity_context_bind(uuid,boolean,text)', 'execute'),
  'authenticated can deliberately bind a context');
select ok(not has_function_privilege('service_role', 'platform_api.identity_context_bind(uuid,boolean,text)', 'execute'),
  'service role cannot execute context bind');
select ok(
   (select count(*) = 3 and bool_and(prosecdef and proconfig @> array['search_path=""']::text[])
     from pg_proc
    where oid = any(array[
      to_regprocedure('platform_api.identity_contexts_read(text)'),
      to_regprocedure('platform_api.identity_context_bind(uuid,boolean,text)'),
      to_regprocedure('platform_api.auth_session_read(uuid,uuid)')
    ])),
  'context and session security-definer RPCs use a fixed empty search path'
);

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
select extensions.gen_random_uuid() from generate_series(1, 53);
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

create temporary table context_switch_excluded_orgs (
  org_key text primary key,
  party_id uuid not null,
  lifecycle text not null
);
insert into context_switch_excluded_orgs(org_key, party_id, lifecycle)
values ('pending', extensions.gen_random_uuid(), 'active'),
       ('ended', extensions.gen_random_uuid(), 'active'),
       ('closed', extensions.gen_random_uuid(), 'closed'),
       ('future', extensions.gen_random_uuid(), 'active');
insert into platform_private.party(id, kind)
select party_id, 'organization' from context_switch_excluded_orgs;
insert into identity_private.organization_party(party_id, lifecycle)
select party_id, lifecycle from context_switch_excluded_orgs;
insert into identity_private.membership_tenure(
  organization_id, person_id, state, provenance, governance_mode,
  starts_on, ends_on, accepted_at, revoked_at, invite_expires_at, actor_id
)
select party_id,
       (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
        case org_key when 'pending' then 'invited' when 'ended' then 'ended' else 'confirmed' end,
        'invitation', 'ungoverned',
        case when org_key = 'ended' then current_date - 10 else current_date - 1 end,
        case when org_key = 'ended' then current_date - 1 else null end,
        case when org_key = 'pending' then null
             when org_key = 'future' then clock_timestamp() + interval '1 day'
             else clock_timestamp() - interval '1 day' end,
       case when org_key = 'ended' then clock_timestamp() else null end,
       case when org_key = 'pending' then clock_timestamp() + interval '1 day' else null end,
       (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')
from context_switch_excluded_orgs;

create temporary table context_switch_pages(page_no integer primary key, response jsonb not null);
insert into context_switch_pages values (1, platform_api.identity_contexts_read(null));
insert into context_switch_pages
select 2, platform_api.identity_contexts_read(response->>'nextCursor')
from context_switch_pages where page_no = 1;

select ok(
  (select response ?& array['projectionVersion', 'items', 'nextCursor', 'hasMore']
      from context_switch_pages where page_no = 1),
  'candidate list keeps the cursor-page response envelope'
);
select is(
  (select jsonb_typeof(response->'projectionVersion') from context_switch_pages where page_no = 1),
  'string',
  'candidate projection version is serialized as a decimal string'
);
select is((select jsonb_array_length(response->'items') from context_switch_pages where page_no = 1), 50,
  'candidate list returns no more than fifty items');
select ok(
  (select response->>'hasMore' = 'true'
       and response->>'nextCursor' is not null
       and response->>'nextCursor' !~ '^[0-9]+$'
     from context_switch_pages where page_no = 1),
  'candidate list returns an opaque continuation cursor when more items exist'
);
select ok(
  (select jsonb_array_length(response->'items') = 5
       and response->>'hasMore' = 'false'
       and response->'nextCursor' = 'null'::jsonb
     from context_switch_pages where page_no = 2),
  'candidate cursor returns the remaining items without duplicates'
);
select ok(
  (select response->'items' @> jsonb_build_array(jsonb_build_object(
      'contextId', person_id::text, 'partyId', person_id::text, 'kind', 'person'))
     from context_switch_pages, context_switch_actors
    where page_no = 1 and auth_user_id = 'a3111111-1111-4111-8111-111111111111'),
  'self candidate uses the canonical person party UUID'
);
select ok(
  (select response->'items' @> jsonb_build_array(jsonb_build_object(
      'contextId', party_id::text, 'partyId', party_id::text, 'kind', 'alias'))
     from context_switch_pages, context_switch_aliases
    where page_no = 1 and alias_key = 'owned'),
  'current active owned alias is a candidate with its canonical party UUID'
);
select is(
  (select count(*)::integer from context_switch_pages p
          cross join lateral jsonb_array_elements(p.response->'items') item
    where p.page_no in (1, 2) and item->>'kind' = 'organization'),
  53,
  'only confirmed accepted current memberships produce organization candidates'
);
select ok(
  (select not exists (
     select 1 from context_switch_pages p
     cross join lateral jsonb_array_elements(p.response->'items') item
     where p.page_no in (1, 2)
       and item->>'contextId' in (
         select party_id::text from context_switch_aliases where alias_key in ('foreign', 'retired')
       )
   )),
  'foreign-owned and retired aliases are not candidates'
);
select ok(
  (select not exists (
     select 1 from context_switch_pages p
     cross join lateral jsonb_array_elements(p.response->'items') item
     where p.page_no in (1, 2)
       and item->>'contextId' in (select party_id::text from context_switch_excluded_orgs)
   )),
  'invited, ended, not-yet-accepted, and closed-organization memberships are not candidates'
);
select ok(
  (select not exists (
     select 1 from context_switch_pages p
     cross join lateral jsonb_array_elements(p.response->'items') item
     where p.page_no in (1, 2)
       and (item->>'kind' = 'representation' or item->>'contextId' <> item->>'partyId')
   )),
  'candidate IDs are party UUIDs and unsupported representation rows are absent'
);
select is(
  (select count(*)::integer from platform_private.acting_context_binding
    where person_id = (select person_id from context_switch_actors where auth_user_id = 'a3111111-1111-4111-8111-111111111111')),
  1,
  'candidate reads create no binding selectors'
);

select * from finish();
rollback;
