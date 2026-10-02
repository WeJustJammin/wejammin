begin;

select plan(16);

-- CMS-03A-04 internal acting-context transport. The production service-role
-- Worker sends the verified server actor envelope (authUserId, sessionId,
-- actorPersonId, actingPartyId, step-up evidence, request/correlation ids)
-- plus the private acting-context binding id. The internal activation gate
-- must admit that envelope and keep re-checking the binding against the
-- persisted owner/person/party/active/recent-MFA facts.
--
-- DEC-108 rewrite: the candidate reaches `approved` ONLY through the named
-- producers (dry-run -> worker seal -> submit -> assign -> decide); no review,
-- decision, dry-run or approved-state row is inserted by hand.  The suite owns
-- and rolls back its own fixtures.  Approval evidence is the CMS review chain.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('b', 'articleb');
select pg_temp.s09d_to_approved('b');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('b:review')), 'approved',
  'fixture: the candidate holds a real approved CMS review before any gate is probed');

-- Another human who shares the owner party, and the owner's person-party binding.
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
select 'a9140000-0000-4000-8000-00000000020b', person_id, pg_temp.s09d_id('ownerOrg'), 'organization',
       's09tb-other-tab', 'active', clock_timestamp(), clock_timestamp(),
       clock_timestamp() + interval '2 hours', 1, 1
from s09d_actor where key = 'designer2';
insert into platform_private.acting_context_binding(
  id, person_id, acting_party_id, context_kind, client_binding_id,
  state, selected_at, last_seen_at, expires_at, projection_version, version
)
select 'a9140000-0000-4000-8000-000000000205', person_id, person_id, 'person', 's09tb-self-tab',
       'active', clock_timestamp(), clock_timestamp(), 'infinity'::timestamptz, 1, 1
from s09d_actor where key = 'owner';

create temp table s09tb_request on commit drop as
select pg_temp.s09d_activation_request('b', 'owner', '{}'::jsonb,
  jsonb_build_object('idempotencyKey', 's09tb-activate-0001')) as request;
create function pg_temp.try_s09tb_activate(p_request jsonb)
returns jsonb language plpgsql as $fn$
declare returned_state text;
begin
  return platform_api.cms_activate_schema(p_request);
exception when others then
  get stacked diagnostics returned_state = returned_sqlstate;
  return pg_catalog.jsonb_build_object('error', sqlerrm, 'sqlstate', returned_state);
end;
$fn$;
create function pg_temp.s09tb_owner() returns void language sql as $fn$
  select pg_temp.s09d_session('owner') $fn$;
create function pg_temp.s09tb_attempt(p_patch jsonb, p_context jsonb default null)
returns jsonb language plpgsql as $fn$
declare body jsonb;
begin
  perform pg_temp.s09d_session('owner');
  select request || p_patch into body from s09tb_request;
  if p_context is not null then body := body || jsonb_build_object('context', p_context); end if;
  return pg_temp.try_s09tb_activate(body);
end;
$fn$;
create temp table s09tb_context on commit drop as
select (request->'context') as context from s09tb_request;

-- A fabricated approval id reaches (and clears) the binding-only step-up gate,
-- then fails closed at the CMS approval evidence.
create temp table s09tb_progress as
select pg_temp.s09tb_attempt(jsonb_build_object('approvalIds',
  jsonb_build_array('a9140000-0000-4000-8000-000000000207'))) as result;
select is(
  (select result->>'error' from s09tb_progress),
  'APPROVAL_INVALID',
  'verified server context with an active binding clears the binding-only step-up gate'
);
select ok(
  (select result->>'error' = 'APPROVAL_INVALID' from s09tb_progress)
  and (select pg_temp.s09tb_attempt(jsonb_build_object('approvalIds',
    jsonb_build_array('a9140000-0000-4000-8000-000000000207')))->>'error') = 'APPROVAL_INVALID',
  'failed activation leaves no completed idempotency record and repeats deterministically'
);

update platform_private.acting_context_binding
set last_seen_at = clock_timestamp() - interval '11 minutes'
where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-stale-0001'))->>'error'),
  'STEP_UP_REQUIRED',
  'stale binding heartbeat still fails closed with STEP_UP_REQUIRED'
);
update platform_private.acting_context_binding
set last_seen_at = clock_timestamp()
where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;

update platform_private.acting_context_binding
set selected_at = clock_timestamp() - interval '1 hour',
    expires_at = clock_timestamp() - interval '1 second'
where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-expired-0001'))->>'error'),
  'STEP_UP_REQUIRED',
  'expired binding still fails closed despite a recent heartbeat'
);
update platform_private.acting_context_binding
set selected_at = clock_timestamp(),
    expires_at = clock_timestamp() + interval '2 hours', state = 'revoked'
where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-revoked-0001'))->>'error'),
  'STEP_UP_REQUIRED',
  'revoked binding still fails closed despite current expiry and heartbeat'
);
update platform_private.acting_context_binding
set state = 'active'
where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;

select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-person-0001'),
     (select context from s09tb_context) || jsonb_build_object(
       'actingContextId', 'a9140000-0000-4000-8000-00000000020b'))->>'error'),
  'STEP_UP_REQUIRED',
  'binding with matching owner party but a different persisted person fails closed'
);
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-party-0001'),
     (select context from s09tb_context) || jsonb_build_object(
       'actingContextId', 'a9140000-0000-4000-8000-000000000205'))->>'error'),
  'STEP_UP_REQUIRED',
  'binding whose acting party is not the candidate owner fails closed'
);
-- Binding-only context: no verified actor field and no actor GUC to fall back on.
select pg_temp.s09tb_owner();
select set_config('app.auth_user_id', '', true);
select set_config('app.actor_auth_user_id', '', true);
select is(
  (select pg_temp.try_s09tb_activate(request || jsonb_build_object(
     'context', jsonb_build_object('actingContextId', pg_temp.s09d_actor_id('owner', 'binding')),
     'idempotencyKey', 's09tb-activate-binding-only-0001'))->>'error' from s09tb_request),
  'UNAUTHENTICATED',
  'binding-only context cannot resolve the service-role actor and fails closed'
);
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-no-binding-0001'),
     (select context from s09tb_context) - 'actingContextId')->>'error'),
  'STEP_UP_REQUIRED',
  'verified context without the private binding id still fails closed'
);
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('idempotencyKey', 's09tb-activate-extra-key-0001'),
     (select context from s09tb_context) || jsonb_build_object('selector', 'tab-a'))->>'error'),
  'STEP_UP_REQUIRED',
  'unknown nested context key still fails closed'
);
select is(
  (select pg_temp.s09tb_attempt(jsonb_build_object('selector', 'tab-a',
     'idempotencyKey', 's09tb-activate-extra-top-0001'))->>'error'),
  'INVALID_REQUEST',
  'unknown top-level request key still fails closed'
);

select ok(
  (select count(*) = 0 from platform_private.cfg_config_change_reviews
    where candidate_id = pg_temp.s09d_id('b:version'))
  and (select state = 'approved' and version = pg_temp.s09d_version('b')::bigint
         and dry_run_id = pg_temp.s09d_id('b:dryRun')
       from platform_private.cms_content_type_versions
       where id = pg_temp.s09d_id('b:version'))
  and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('b:review')) = 'approved',
  'rejected activations leave no CFG review evidence, the CMS review approved, and no partial mutation'
);
select ok(
  has_function_privilege('service_role',
    'platform_api.cms_activate_schema(jsonb)', 'execute')
  and not has_function_privilege('authenticated',
    'platform_private.cms_activate_schema(jsonb)', 'execute'),
  'activation stays service-role-only through the public wrapper'
);

-- With every gate satisfied by the real approval, the same envelope activates.
select pg_temp.s09tb_owner();
select pg_temp.s09d_activate('b', 'owner', '{}'::jsonb, 'b:activate');
select is(pg_temp.s09d_outcome('b:activate'), 'OK',
  'the verified envelope with an active binding and the real CMS approval activates the schema');
select ok(
  (select state = 'active' from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version'))
  and (select count(*) = 0 from platform_private.cfg_config_change_reviews),
  'activation changed the candidate to active without consulting any CFG review row'
);

select * from finish();
rollback;
