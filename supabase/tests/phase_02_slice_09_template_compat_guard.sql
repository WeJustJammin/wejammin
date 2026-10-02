commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Local antecedent fixtures only: the Slice 10 fixture marks one compiled type
-- active inside this rolled-back transaction. It is not activation acceptance.
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

create temp table s09_compat_template on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template(' || quote_literal(
    jsonb_build_object(
      'templateKey', 's09-compat-template',
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
      'idempotencyKey', 's09-compat-template-0001',
      'context', jsonb_build_object(
        'actingPartyId', (select value from s10_ids where key = 'organization'),
        'actingContextId', 'a9120000-0000-4000-8000-000000000001',
        'correlationId', 'a9120000-0000-4000-8000-000000000002'
      )
    )::text
  ) || '::jsonb)'
) as response;
select is(pg_temp.s10_last_error_state(), '00000',
  'fixture defines a real draft template compatible only with the existing active type');
select ok((select response->>'id' is not null from s09_compat_template),
  'fixture template ID is available for incompatible references');

create temp table s09_upper_template on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template(' || quote_literal(
    jsonb_build_object(
      'templateKey', 's09-upper-template',
      'compatibleTypeIds', jsonb_build_array(
        upper((select value from s10_ids where key = 'typeId'))
      ),
      'slots', '[]'::jsonb,
      'reservedRegions', jsonb_build_array(
        'header', 'now', 'record', 'detail', 'provenance'
      ),
      'bindings', '{}'::jsonb,
      'locale', 'en-US', 'audience', 'public',
      'expectedVersion', null,
      'idempotencyKey', 's09-compat-upper-0001',
      'context', jsonb_build_object(
        'actingPartyId', (select value from s10_ids where key = 'organization'),
        'actingContextId', 'a9120000-0000-4000-8000-000000000001',
        'correlationId', 'a9120000-0000-4000-8000-000000000002'
      )
    )::text
  ) || '::jsonb)'
) as response;
select is(pg_temp.s10_last_error_state(), '00000',
  'fixture defines a template with an upper-case form of the same type UUID');
select ok(platform_private.cms_template_binding_compatible(
  (select (response->>'id')::uuid from s09_upper_template),
  (select value::uuid from s10_ids where key = 'organization'),
  (select value::uuid from s10_ids where key = 'typeId')
), 'AC169 compatibility compares UUID identity, not JSON string casing');

create temp table s09_incompatible_requests on commit drop as
select request || jsonb_build_object(
  'typeKey', 'compat_b', 'label', 'Compatibility B',
  'idempotencyKey', 's09-compat-binding-0001',
  'fields', jsonb_build_array((request->'fields'->0) || jsonb_build_object(
    'stableFieldId', 'a9120000-0000-4000-8000-000000000301'
  )),
  'relations', '[]'::jsonb,
  'templateBindings', jsonb_build_array(jsonb_build_object(
    'templateVersionId', (select response->>'id' from s09_compat_template)
  ))
) as binding_request,
request || jsonb_build_object(
  'typeKey', 'compat_c', 'label', 'Compatibility C',
  'idempotencyKey', 's09-compat-default-0001',
  'fields', jsonb_build_array((request->'fields'->0) || jsonb_build_object(
    'stableFieldId', 'a9120000-0000-4000-8000-000000000302'
  )),
  'relations', '[]'::jsonb,
  'defaultTemplateVersionId', (select response->>'id' from s09_compat_template)
) as default_request
from s10_type_request;

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft(' || quote_literal(binding_request::text)
    || '::jsonb)'
)
from s09_incompatible_requests;
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'AC169 draft binding rejects a template that excludes the new content type');
select is((select count(*)::integer from platform_private.cms_content_types
  where type_key = 'compat_b'), 0,
  'incompatible binding rejection leaves no type aggregate');

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft(' || quote_literal(default_request::text)
    || '::jsonb)'
)
from s09_incompatible_requests;
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'AC169 default template rejects a version that excludes the new content type');
select is((select count(*)::integer from platform_private.cms_content_types
  where type_key = 'compat_c'), 0,
  'incompatible default rejection leaves no type aggregate');

-- Activation defense-in-depth: this local review fixture deliberately inserts
-- an incompatible binding without using the draft RPC. The final state switch
-- must still reject it; this is not a CMS approval or activation acceptance run.
create temp table s09_review_candidate on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_create_type_draft(' || quote_literal((
    request || jsonb_build_object(
      'typeKey', 'compat_d', 'label', 'Compatibility D',
      'idempotencyKey', 's09-compat-review-0001',
      'fields', jsonb_build_array((request->'fields'->0) || jsonb_build_object(
        'stableFieldId', 'a9120000-0000-4000-8000-000000000303'
      )),
      'relations', '[]'::jsonb
    )
  )::text) || '::jsonb)'
) as response
from s10_type_request;
select is(pg_temp.s10_last_error_state(), '00000',
  'local review antecedent is a real draft with no template reference');
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_type_versions
set state = 'review', version = version + 1, updated_at = clock_timestamp()
where id = (select (response->>'id')::uuid from s09_review_candidate);
insert into platform_private.cms_content_type_template_bindings(
  owner_id, state, version, content_type_version_id, template_version_id, position
)
select (select value::uuid from s10_ids where key = 'organization'),
       'review', 1, (select (response->>'id')::uuid from s09_review_candidate),
       (select (response->>'id')::uuid from s09_compat_template), 0;
select pg_temp.s10_rpc_exec(
  'update platform_private.cms_content_type_versions '
  || 'set state = ''active'', version = version + 1, updated_at = clock_timestamp() '
  || 'where id = ' || quote_literal((
    select response->>'id' from s09_review_candidate
  )) || '::uuid returning to_jsonb(id)'
);
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'AC169 activation state switch rechecks incompatible persisted bindings');
select is((select state::text from platform_private.cms_content_type_versions
  where id = (select (response->>'id')::uuid from s09_review_candidate)),
  'review', 'rejected activation leaves review candidate unchanged');

select finish();
rollback;
