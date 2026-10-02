commit;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
commit;

begin;

select no_plan();

-- CMS-03C-01 authority surface. These catalog assertions deliberately run
-- before the migration for RED evidence and do not assume the relation exists.
select ok(
  platform_private.cms_capability_registry_valid('cms.template_designer', 1),
  'template designer is a closed v1 capability, not an arbitrary request key'
);
select has_table('platform_private', 'cms_template_versions',
  'template versions are persisted in the private schema');
select has_column('platform_private', 'cms_template_versions', 'owner_id',
  'template versions retain their owning party');
select has_column('platform_private', 'cms_template_versions', 'state',
  'template versions have a closed state');
select has_column('platform_private', 'cms_template_versions', 'version',
  'template versions carry a positive version');
select has_column('platform_private', 'cms_template_versions', 'template_key',
  'template keys are persisted');
select has_column('platform_private', 'cms_template_versions', 'compatible_type_ids',
  'compatible content-type IDs are persisted');
select has_column('platform_private', 'cms_template_versions', 'slots',
  'bounded slot definitions are persisted');
select has_column('platform_private', 'cms_template_versions', 'reserved_regions',
  'protected reserved-region declarations are persisted');
select has_column('platform_private', 'cms_template_versions', 'bindings',
  'strict projection bindings are persisted');
select has_column('platform_private', 'cms_template_versions', 'locale',
  'template locale is persisted');
select has_column('platform_private', 'cms_template_versions', 'audience',
  'safe audience is persisted');
select has_column('platform_private', 'cms_template_versions', 'content_hash',
  'immutable definition hash is persisted');
select has_column('platform_private', 'cms_template_versions', 'block_registry_digest',
  'server-computed block digest is persisted');
select has_column('platform_private', 'cms_template_versions', 'supersedes_id',
  'new template candidates point to the prior version');
select has_column('platform_private', 'cms_template_versions', 'created_by',
  'template author identity is persisted');
select ok(
  coalesce((
    select c.relrowsecurity and c.relforcerowsecurity
    from pg_catalog.pg_class c
    where c.oid = to_regclass('platform_private.cms_template_versions')
  ), false),
  'template table has enabled and forced row-level security'
);
select ok(
  not coalesce(pg_catalog.has_table_privilege(
    'authenticated', to_regclass('platform_private.cms_template_versions'),
    'INSERT, UPDATE, DELETE'
  ), false),
  'authenticated browser role cannot write template versions directly'
);
select ok(
  not coalesce(pg_catalog.has_table_privilege(
    'anon', to_regclass('platform_private.cms_template_versions'),
    'INSERT, UPDATE, DELETE'
  ), false),
  'anonymous browser role cannot write template versions directly'
);
select has_function('platform_api', 'cms_define_template', array['jsonb'],
  'template draft mutation has a named platform API RPC');
select has_function('platform_private', 'cms_define_template', array['jsonb'],
  'template draft mutation has an atomic private implementation');
select is(
  (select p.provolatile::text from pg_catalog.pg_proc p
    where p.oid = to_regprocedure(
      'platform_private.cms_template_designer_authorized(uuid, uuid)'
    )),
  'v',
  'template designer authority helper is volatile across grant and membership changes'
);
select ok(
  coalesce((
    select pg_catalog.bool_and(
      not pg_catalog.has_function_privilege(role_name, p.oid, 'EXECUTE')
    )
    from (values ('public'::name), ('anon'::name),
      ('authenticated'::name), ('service_role'::name)) roles(role_name)
    cross join pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in (
        'cms_template_manifest_valid', 'cms_template_versions_guard',
        'cms_template_designer_authorized', 'cms_template_block_digest',
        'cms_define_template'
      )
  ), false),
  'all Slice 12 private functions are inaccessible to API roles'
);

-- Reuse the rolled-back Slice 10 authority fixture: its confirmed owner,
-- active compiled content type, and artifact are genuine local schema rows.
-- No synthetic identity or authorization escapes this test transaction.
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

create temp table s12_request on commit drop as
select jsonb_build_object(
  'templateKey', 's12-test-template',
  'compatibleTypeIds', jsonb_build_array(
    (select value from s10_ids where key = 'typeId')
  ),
  'slots', '[]'::jsonb,
  'reservedRegions', jsonb_build_array(
    'header', 'now', 'record', 'detail', 'provenance'
  ),
  'bindings', '{}'::jsonb,
  'locale', 'en-US',
  'audience', 'public',
  'expectedVersion', null,
  'idempotencyKey', 's12-template-create-0001',
  'context', jsonb_build_object(
    'actingPartyId', (select value from s10_ids where key = 'organization'),
    'actingContextId', 'a9120000-0000-4000-8000-000000000001',
    'correlationId', 'a9120000-0000-4000-8000-000000000002'
  )
) as request;

select ok(
  platform_private.cms_template_manifest_valid(
    (select (request - 'expectedVersion' - 'idempotencyKey' - 'context')
      || jsonb_build_object('slots', jsonb_build_array(jsonb_build_object(
        'key', 'primary', 'required', true,
        'allowedBlocks', jsonb_build_array(jsonb_build_object(
          'blockKey', 'profile.header', 'blockVersion', 1
        )),
        'maxCount', 1
      )))
     from s12_request)
  ),
  'CMS-03C-01 valid nonempty allowed-block manifest is structurally accepted'
);
select ok(
  not platform_private.cms_template_manifest_valid(
    (select (request - 'expectedVersion' - 'idempotencyKey' - 'context')
      || jsonb_build_object('compatibleTypeIds', jsonb_build_array(
        (select value from s10_ids where key = 'typeId'),
        upper((select value from s10_ids where key = 'typeId'))
      )) from s12_request)
  ),
  'CMS-03C-01 same UUID with different letter case is one compatible type'
);
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-case-dup-template',
      'compatibleTypeIds', jsonb_build_array(
        (select value from s10_ids where key = 'typeId'),
        upper((select value from s10_ids where key = 'typeId'))
      ),
      'idempotencyKey', 's12-template-case-dup-0001'
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'CMS-03C-01 named RPC refuses the same compatible type in mixed case');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-case-dup-template'),
  0,
  'CMS-03C-01 mixed-case duplicate refusal leaves no template row'
);

create temp table s12_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal(request::text) || '::jsonb)'
) as response
from s12_request;

select is(pg_temp.s10_last_error_state(), '00000',
  'CMS-03C-01 authorized template create succeeds');
select ok(
  (select response->>'state' = 'draft'
    and response->>'templateKey' = 's12-test-template'
    and response->>'version' = '1'
    and response->>'blockRegistryDigest' ~ '^[a-f0-9]{64}$'
   from s12_created),
  'CMS-03C-01 returns safe v1 draft and server-derived digest'
);
select is(
  (select response->>'blockRegistryDigest' from s12_created),
  pg_catalog.encode(extensions.digest('[]'::bytea, 'sha256'), 'hex'),
  'CMS-03C-01 empty reachable-block set hashes exact canonical JSON []'
);
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-test-template'), 1,
  'CMS-03C-01 commits exactly one private draft'
);

-- A second backend holds the key's transaction lock while this transaction
-- owns the uncommitted authority fixtures. The RPC must wait on that lock
-- before its first-create read, rather than racing to a raw 23505 unique
-- violation. After release the same request must create exactly one draft.
select extensions.dblink_connect(
  's12_template_key_gate',
  'host=db port=5432 dbname=postgres user=postgres password=postgres'
);
select extensions.dblink_exec('s12_template_key_gate', 'begin');
select extensions.dblink_exec(
  's12_template_key_gate',
  $gate$do $body$ begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('cms.template:s12-lock-probe', 0)
    );
  end $body$;$gate$
);
set local lock_timeout = '1s';
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-lock-probe',
      'idempotencyKey', 's12-template-lock-probe-0001'
    ))::text from s12_request)) || '::jsonb)'
);
set local lock_timeout = '0';
select is(pg_temp.s10_last_error_state(), '55P03',
  'CMS-03C-01 waits for the same-key transaction lock before first-create read');
select extensions.dblink_exec('s12_template_key_gate', 'rollback');
select extensions.dblink_disconnect('s12_template_key_gate');
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-lock-probe',
      'idempotencyKey', 's12-template-lock-probe-0001'
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_state(), '00000',
  'CMS-03C-01 same-key create succeeds after the competing transaction ends');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-lock-probe'), 1,
  'CMS-03C-01 lock probe leaves one version after release'
);

create temp table s12_replayed on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal(request::text) || '::jsonb)'
) as response
from s12_request;
select is((select response from s12_replayed),
  (select response from s12_created),
  'CMS-03C-01 exact idempotency replay returns identical safe response');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-test-template'), 1,
  'CMS-03C-01 replay does not create another version'
);
select is(
  (select count(*)::integer from audit_private.audit_events
    where action = 'cms.template.define'
      and target_type = 'cms_template_version'
      and target_id = (select (response->>'id')::uuid from s12_created)), 1,
  'CMS-03C-01 replay does not duplicate the atomic audit event'
);

-- A real lost-response retry receives new trace IDs from the Worker. They are
-- transport metadata, not a changed template command or acting party.
create temp table s12_trace_retry on commit drop as
select request || jsonb_build_object(
  'context', request->'context' || jsonb_build_object(
    'requestId', 'a9120000-0000-4000-8000-000000000003',
    'correlationId', 'a9120000-0000-4000-8000-000000000004'
  ),
  'correlationId', 'a9120000-0000-4000-8000-000000000004'
) as request
from s12_request;

select is(
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request from s12_request)), 'hex'),
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request from s12_trace_retry)), 'hex'),
  'CMS-03C-01 trace IDs do not change the idempotency business hash'
);
select isnt(
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request from s12_request)), 'hex'),
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request || jsonb_build_object(
      'context', request->'context' || jsonb_build_object(
        'actingPartyId', 'a9120000-0000-4000-8000-000000000005'
      )
    ) from s12_request)), 'hex'),
  'CMS-03C-01 acting-party changes remain bound to the idempotency hash'
);
select isnt(
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request from s12_request)), 'hex'),
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request || jsonb_build_object(
      'context', request->'context' || jsonb_build_object(
        'actingContextId', 'a9120000-0000-4000-8000-000000000006'
      )
    ) from s12_request)), 'hex'),
  'CMS-03A-04 acting-context authority changes remain bound to the hash'
);
select is(
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request - 'context' || jsonb_build_object(
      'correlationId', 'a9120000-0000-4000-8000-000000000007'
    ) from s12_request)), 'hex'),
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request - 'context' || jsonb_build_object(
      'correlationId', 'a9120000-0000-4000-8000-000000000008'
    ) from s12_request)), 'hex'),
  'CMS request hash ignores top-level trace IDs without a context object'
);
select isnt(
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request || jsonb_build_object('context', 'malformed-one')
      from s12_request)), 'hex'),
  pg_catalog.encode(platform_private.cms_request_hash(
    (select request || jsonb_build_object('context', 'malformed-two')
      from s12_request)), 'hex'),
  'CMS request hash does not normalize malformed context into valid authority'
);

-- A request can omit context.actingPartyId and use the server-resolved party.
-- Reusing its key under a different server acting party must not return the
-- first party's reserved or completed result.
create temp table s12_guc_party_request on commit drop as
select jsonb_build_object(
  'templateKey', 's12-guc-party-probe',
  'idempotencyKey', 's12-guc-party-probe-0001',
  'context', jsonb_build_object(
    'actingContextId', 'a9120000-0000-4000-8000-000000000001'
  )
) as request;
create temp table s12_guc_party_first on commit drop as
select platform_private.cms_reserve(
  request,
  'a9100000-0000-4000-8000-000000000001'::uuid,
  'CMS-03C-01'
) as reservation
from s12_guc_party_request;
select is((select (reservation).state::text from s12_guc_party_first),
  'reserved', 'CMS first server-resolved acting party reserves the key');
select pg_catalog.set_config('app.acting_party_id',
  'a9100000-0000-4000-8000-000000000001', true);
select pg_temp.s10_rpc_exec(
  'select to_jsonb(platform_private.cms_reserve('
    || quote_literal((select request::text from s12_guc_party_request))
    || '::jsonb, ''a9100000-0000-4000-8000-000000000001''::uuid, '
    || '''CMS-03C-01''))'
);
select is(pg_temp.s10_last_error_message(), 'IDEMPOTENCY_MISMATCH',
  'CMS same key cannot replay across server-resolved acting parties');
select pg_catalog.set_config('app.acting_party_id',
  (select value from s10_ids where key = 'organization'), true);

create temp table s12_trace_replayed on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal(request::text) || '::jsonb)'
) as response
from s12_trace_retry;
select is(pg_temp.s10_last_error_state(), '00000',
  'CMS-03C-01 same-key retry with fresh trace IDs succeeds');
select is((select response from s12_trace_replayed),
  (select response from s12_created),
  'CMS-03C-01 same-key retry replays the original 201 draft');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-test-template'), 1,
  'CMS-03C-01 trace-ID retry creates no second template version'
);
select is(
  (select count(*)::integer from audit_private.audit_events
    where action = 'cms.template.define'
      and target_type = 'cms_template_version'
      and target_id = (select (response->>'id')::uuid from s12_created)), 1,
  'CMS-03C-01 trace-ID retry creates no second audit event'
);
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select request || jsonb_build_object(
      'audience', 'private'
    ) from s12_trace_retry)::text) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'IDEMPOTENCY_MISMATCH',
  'CMS-03C-01 changed business body still rejects same-key replay');

-- Rejections must leave the private version count unchanged.
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-bad-regions-0002',
      'reservedRegions', jsonb_build_array(
        'now', 'header', 'record', 'detail', 'provenance'
      )
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'CMS-03C-01 rejects movement of protected regions');

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-stale-digest-0003',
      'blockRegistryDigest', repeat('f', 64)
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03C-01 refuses caller digest that differs from current registry');

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000003'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-no-grant-0004'
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'FORBIDDEN',
  'CMS-03C-01 confirmed member without designer grant cannot define templates');

select pg_temp.s10_rpc_clear_actor();
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-no-actor-0005'
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'UNAUTHENTICATED',
  'CMS-03C-01 anonymous caller cannot define templates');

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-inactive-type-0006',
      'compatibleTypeIds', jsonb_build_array(
        'a9120000-0000-4000-8000-000000000099'
      )
    ))::text from s12_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'CMS-03C-01 refuses nonexistent or inactive compatible types');

create temp table s12_v2_request on commit drop as
select request || jsonb_build_object(
  'expectedVersion', '1',
  'ifMatch', '1',
  'audience', 'members',
  'idempotencyKey', 's12-template-version-0007'
) as request
from s12_request;
create temp table s12_v2_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal(request::text) || '::jsonb)'
) as response
from s12_v2_request;
select is(pg_temp.s10_last_error_state(), '00000',
  'CMS-03C-01 matching If-Match creates a new candidate');
select ok(
  (select response->>'version' = '2' and response->>'templateVersion' = '2'
   from s12_v2_created),
  'CMS-03C-01 successor increments the version');
select ok(
  (select newer.supersedes_id = older.id
   from platform_private.cms_template_versions newer
   join platform_private.cms_template_versions older
     on older.template_key = newer.template_key and older.version = 1
   where newer.template_key = 's12-test-template' and newer.version = 2),
  'CMS-03C-01 successor retains exact prior-version provenance');
select is(
  (select count(*)::integer from audit_private.audit_events
    where action = 'cms.template.define'
      and target_type = 'cms_template_version'
      and target_id = (select (response->>'id')::uuid from s12_v2_created)), 1,
  'CMS-03C-01 successor commits one audit event with its draft'
);

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'idempotencyKey', 's12-template-stale-cas-0008'
    ))::text from s12_v2_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03C-01 stale If-Match cannot create a third version');

select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key = 's12-test-template'), 2,
  'CMS-03C-01 rejected calls leave no partial template version'
);

-- Rolled-back registry/type fixtures exercise the nonempty digest path. They
-- are local test rows, not a claim of signed hosted release provenance.
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_block_definition_versions(
  id, owner_id, block_key, block_version, props_schema_ref,
  props_schema_hash, props_schema_snapshot, props_snapshot_hash,
  props_snapshot_attestation, props_attestation_key_id,
  props_attestation_signature_hash, props_attestation_verified_at,
  renderer_ref, allowed_children, slot_rules, data_source_permissions,
  accessibility_contract, compatibility_range, release_digest,
  release_principal_id, release_key_id, release_raw_body_hash,
  release_signature_hash, release_nonce_hash, release_verified_at
)
select
  'a9120000-0000-4000-8000-000000000301',
  (select value::uuid from s10_ids where key = 'organization'),
  'profile.header', 1, 'cms/s12/profile-header',
  repeat('2', 64), '{}'::jsonb, repeat('4', 64),
  '{}'::jsonb, 's12-test-key', repeat('5', 64), clock_timestamp(),
  'cms.profile.header', '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
  '{}'::jsonb, '{}'::jsonb, repeat('3', 64),
  'a9120000-0000-4000-8000-000000000302', 's12-release-key',
  repeat('6', 64), repeat('7', 64), repeat('8', 64), clock_timestamp();

insert into platform_private.cms_content_types(
  id, owner_id, state, type_key, owner_capability, created_by
)
select 'a9120000-0000-4000-8000-000000000303',
       (select value::uuid from s10_ids where key = 'organization'),
       'retired', 's12_block_test', 'cms.schema_designer',
       'a9100000-0000-4000-8000-000000000001';
insert into platform_private.cms_content_type_versions(
  id, owner_id, state, content_type_id, version_no, labels,
  workflow_key, workflow_version, source_locale, default_locale,
  supported_locales, fallback_chains, locale_config_hash,
  schema_artifact_id, definition_hash, compatibility, created_by
)
select 'a9120000-0000-4000-8000-000000000304',
       (select value::uuid from s10_ids where key = 'organization'),
       'draft', 'a9120000-0000-4000-8000-000000000303', 1, '{}'::jsonb,
       'editorial', 1, 'en-US', 'en-US',
       '["en-US"]'::jsonb, '{}'::jsonb, '604d53ba01396a82109c25c8a156b96d1ccf3af7cda0777b55579ef6d1a38860',
       'a9120000-0000-4000-8000-000000000305', repeat('c', 64),
       'additive', 'a9100000-0000-4000-8000-000000000001';
insert into platform_private.cms_schema_artifacts(
  id, owner_id, content_type_version_id, compiler_version,
  zod_contract_ref, editor_manifest, renderer_manifest, artifact_hash,
  compiled_at
)
select 'a9120000-0000-4000-8000-000000000305',
       (select value::uuid from s10_ids where key = 'organization'),
       'a9120000-0000-4000-8000-000000000304', 's12-test',
       'cms/s12-block-test', '{}'::jsonb,
       jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object(
         'blockKey', 'profile.header', 'blockVersion', 1
       ))), repeat('c', 64), clock_timestamp();
update platform_private.cms_content_type_versions
set state = 'active', version = version + 1,
    activation_workflow_policy_key = 'cms.entry.author',
    activation_workflow_policy_version = 1,
    activation_workflow_policy_hash = repeat('a', 64),
    activation_required_decision_count = 1,
    activation_required_capabilities = jsonb_build_array('cms.author'),
    activation_approval_evidence_hash = repeat('b', 64),
    updated_at = clock_timestamp()
where id = 'a9120000-0000-4000-8000-000000000304';
update platform_private.cms_content_types
set state = 'active', version = version + 1, updated_at = clock_timestamp()
where id = 'a9120000-0000-4000-8000-000000000303';

create temp table s12_block_request on commit drop as
select request || jsonb_build_object(
  'templateKey', 's12-block-template',
  'compatibleTypeIds', jsonb_build_array(
    'a9120000-0000-4000-8000-000000000303'
  ),
  'slots', jsonb_build_array(jsonb_build_object(
    'key', 'primary', 'required', true,
    'allowedBlocks', jsonb_build_array(jsonb_build_object(
      'blockKey', 'profile.header', 'blockVersion', 1
    )),
    'maxCount', 1
  )),
  'idempotencyKey', 's12-block-template-0009'
) as request
from s12_request;
create temp table s12_block_created on commit drop as
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal(request::text) || '::jsonb)'
) as response
from s12_block_request;
select is(pg_temp.s10_last_error_state(), '00000',
  'CMS-03C-01 current registered compatible block creates a draft');
select is(
  (select response->>'blockRegistryDigest' from s12_block_created),
  platform_private.cms_jcs_sha256(jsonb_build_array(jsonb_build_object(
    'blockKey', 'profile.header', 'blockVersion', 1,
    'releaseDigest', repeat('3', 64), 'propsSchemaHash', repeat('2', 64),
    'rendererRef', 'cms.profile.header', 'lifecycle', 'supported'
  ))),
  'CMS-03C-01 persisted digest equals exact server-derived safe tuple hash'
);

select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-incompatible-template',
      'compatibleTypeIds', jsonb_build_array(
        (select value from s10_ids where key = 'typeId')
      ),
      'idempotencyKey', 's12-block-incompatible-0010'
    ))::text from s12_block_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'VALIDATION_FAILED',
  'CMS-03C-01 rejects a registered block absent from the active type renderer');

insert into platform_private.cms_block_definition_lifecycle_events(
  id, owner_id, created_at, updated_at, block_definition_version_id,
  block_key, block_version, from_lifecycle, to_lifecycle, release_digest,
  release_principal_id, release_key_id, release_raw_body_hash,
  release_signature_hash, release_nonce_hash, release_verified_at
)
select 'a9120000-0000-4000-8000-000000000306',
       (select value::uuid from s10_ids where key = 'organization'),
       now(), now(), 'a9120000-0000-4000-8000-000000000301',
       'profile.header', 1, 'supported', 'deprecated', repeat('9', 64),
       'a9120000-0000-4000-8000-000000000302', 's12-release-key',
       repeat('a', 64), repeat('b', 64), repeat('c', 64), clock_timestamp();
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-deprecated-template',
      'idempotencyKey', 's12-block-deprecated-0011'
    ))::text from s12_block_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03C-01 refuses a block after its supported lifecycle ends');

insert into platform_private.cms_block_definition_lifecycle_events(
  id, owner_id, created_at, updated_at, block_definition_version_id,
  block_key, block_version, from_lifecycle, to_lifecycle, release_digest,
  release_principal_id, release_key_id, release_raw_body_hash,
  release_signature_hash, release_nonce_hash, release_verified_at
)
select 'a9120000-0000-4000-8000-000000000307',
       (select value::uuid from s10_ids where key = 'organization'),
       now() + interval '1 second', now() + interval '1 second',
       'a9120000-0000-4000-8000-000000000301',
       'profile.header', 1, 'deprecated', 'withdrawn', repeat('d', 64),
       'a9120000-0000-4000-8000-000000000302', 's12-release-key',
       repeat('e', 64), repeat('f', 64), repeat('0', 64), clock_timestamp();
select pg_temp.s10_rpc_exec(
  'select platform_api.cms_define_template('
    || quote_literal((select (request || jsonb_build_object(
      'templateKey', 's12-withdrawn-template',
      'idempotencyKey', 's12-block-withdrawn-0012'
    ))::text from s12_block_request)) || '::jsonb)'
);
select is(pg_temp.s10_last_error_message(), 'CONFLICT',
  'CMS-03C-01 refuses a withdrawn block without inserting a template');
select is(
  (select count(*)::integer from platform_private.cms_template_versions
    where template_key in (
      's12-block-template', 's12-incompatible-template',
      's12-deprecated-template', 's12-withdrawn-template'
    )), 1,
  'CMS-03C-01 incompatible and retired block calls remain atomic refusals'
);

select finish();

rollback;
