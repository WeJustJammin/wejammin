commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select has_function('platform_api', 'cms_template_latest', array['jsonb'],
  'CMS-11 current template detail has a named protected RPC');
select ok(
  not coalesce(has_function_privilege('anon',
    to_regprocedure('platform_api.cms_template_latest(jsonb)'), 'execute'), false)
  and not coalesce(has_function_privilege('authenticated',
    to_regprocedure('platform_api.cms_template_latest(jsonb)'), 'execute'), false),
  'browser roles cannot execute the detail RPC directly'
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

create temp table s12_detail_request on commit drop as
select jsonb_build_object(
  'templateKey', 's12-detail-template',
  'context', jsonb_build_object(
    'actingPartyId', (select value from s10_ids where key = 'organization'),
    'actingContextId', 'a9120000-0000-4000-8000-000000000001',
    'correlationId', 'a9120000-0000-4000-8000-000000000002'
  )
) as request;

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_latest(' ||
  quote_literal(request::text) || '::jsonb)'
) from s12_detail_request;
select is(pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'missing template is concealed as not found');

create temp table s12_detail_create on commit drop as
select jsonb_build_object(
  'templateKey', 's12-detail-template',
  'compatibleTypeIds', jsonb_build_array(
    (select value from s10_ids where key = 'typeId')
  ),
  'slots', '[]'::jsonb,
  'reservedRegions', jsonb_build_array(
    'header', 'now', 'record', 'detail', 'provenance'
  ),
  'bindings', '{}'::jsonb,
  'locale', 'en-US', 'audience', 'public',
  'expectedVersion', null,
  'idempotencyKey', 's12-detail-create-0001',
  'context', (select request->'context' from s12_detail_request)
) as request;
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template(' ||
  quote_literal(request::text) || '::jsonb)'
) from s12_detail_create;
select is(pg_temp.s10_last_error_state(), '00000',
  'fixture creates first real private template draft');

create temp table s12_detail_first on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_latest(' ||
  quote_literal(request::text) || '::jsonb)'
) as response from s12_detail_request;
select is(pg_temp.s10_last_error_state(), '00000',
  'authorized designer reads the current template definition');
select ok((select
  response->>'templateKey' = 's12-detail-template'
  and response->>'version' = '1'
  and response->>'templateVersion' = '1'
  and response->'slots' = '[]'::jsonb
  and response->'bindings' = '{}'::jsonb
  and response->>'locale' = 'en-US'
  and response->>'audience' = 'public'
  and response->>'state' = 'draft'
  and not response ? 'ownerId'
  and not response ? 'createdBy'
  from s12_detail_first),
  'detail carries exact editable fields but no private authority data');

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template(' ||
  quote_literal((request || jsonb_build_object(
    'expectedVersion', '1', 'ifMatch', '1',
    'audience', 'members',
    'idempotencyKey', 's12-detail-create-0002'
  ))::text) || '::jsonb)'
) from s12_detail_create;
select is(pg_temp.s10_last_error_state(), '00000',
  'fixture creates second real private template version');

create temp table s12_detail_latest on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_latest(' ||
  quote_literal(request::text) || '::jsonb)'
) as response from s12_detail_request;
select ok((select response->>'version' = '2'
  and response->>'audience' = 'members' from s12_detail_latest),
  'read returns the current version, not a stale first draft');

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_latest(' ||
  quote_literal((request || jsonb_build_object('templateKey', 'unknown-template'))::text)
  || '::jsonb)'
) from s12_detail_request;
select is(pg_temp.s10_last_error_message(), 'NOT_FOUND',
  'unknown key has the same not-found result as a missing draft');

update identity_private.organization_actor_grant set active = false
 where organization_id = (select value::uuid from s10_ids where key = 'organization')
   and person_id = (select value::uuid from s10_ids where key = 'creatorPerson')
   and capability_code = 'cms.template_designer';
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_template_latest(' ||
  quote_literal(request::text) || '::jsonb)'
) from s12_detail_request;
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'revoked designer grant denies the current template read');

select finish();
rollback;
