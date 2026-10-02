commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select has_function('platform_api', 'cms_template_context', array['jsonb'],
  'CMS-11 context has a protected named read RPC');
select ok(
  not coalesce(has_function_privilege('anon',
    to_regprocedure('platform_api.cms_template_context(jsonb)'), 'execute'), false)
  and not coalesce(has_function_privilege('authenticated',
    to_regprocedure('platform_api.cms_template_context(jsonb)'), 'execute'), false),
  'browser roles cannot execute the context RPC directly'
);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc

insert into identity_private.organization_actor_grant(
  organization_id, person_id, capability_code, valid_from, valid_through, active
)
select (select value::uuid from s10_ids where key = 'organization'),
       (select value::uuid from s10_ids where key = 'creatorPerson'),
       'cms.template_designer', current_date, current_date + 1, true;

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
create temp table s12_context on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_context(' ||
  quote_literal(jsonb_build_object('context', jsonb_build_object(
    'actingPartyId', (select value from s10_ids where key = 'organization'),
    'actingContextId', 'a9120000-0000-4000-8000-000000000001',
    'correlationId', 'a9120000-0000-4000-8000-000000000002'
  ))::text) || '::jsonb)'
) as response;
select is(pg_temp.s10_last_error_state(), '00000',
  'authorized template designer can read context');
select ok(
  (select jsonb_typeof(response->'contentTypes') = 'array'
    and jsonb_typeof(response->'registeredBlocks') = 'array'
    and jsonb_array_length(response->'contentTypes') >= 1
    and response->'contentTypes'->0 ? 'activeVersionId'
    and not response ? 'ownerId'
    from s12_context),
  'context contains only bounded safe active type and block selectors'
);

update identity_private.organization_actor_grant set active = false
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
   and capability_code = 'cms.template_designer';
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_context(' ||
  quote_literal(jsonb_build_object('context', jsonb_build_object(
    'actingPartyId', (select value from s10_ids where key = 'organization'),
    'actingContextId', 'a9120000-0000-4000-8000-000000000001',
    'correlationId', 'a9120000-0000-4000-8000-000000000002'
  ))::text) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'revoked designer grant denies context without disclosing records');

select finish();
rollback;
