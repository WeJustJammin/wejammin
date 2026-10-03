\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the authority model of the
-- original operations: 403 versus concealed 404, server-derived context, the RLS helper and
-- the RPC-only write path, service-role confinement, the event envelope and event consumers,
-- the IA common envelope, and atomic audit/outbox rollback for the draft and activation
-- commands.  Every case runs through the named RPCs of a real owner organization, a second
-- organization and a human with no CMS capability.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|', pg_temp.s09d_fingerprint(true),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_relation_definitions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_types t)))
$body$;
create or replace function pg_temp.p_call(p_label text, p_fn text, p_actor text, p_req jsonb, p_override jsonb default '{}'::jsonb) returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  perform pg_temp.s09d_rpc(p_label, p_fn, p_actor, p_req, false, p_override);
  outcome := pg_temp.s09d_outcome(p_label);
  return case when outcome = 'OK' or before_fp = pg_temp.p_fp() then outcome else 'MUTATED:' || outcome end;
end;
$body$;
create or replace function pg_temp.p_a02(p_tag text, p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'),
    'field', jsonb_build_object('key', 'extra_' || substr(md5(random()::text), 1, 8), 'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', 'Extra', 'order', 1), 'lifecycle', 'active'),
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag), 'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over
$body$;

select pg_temp.s09d_create_type('a', 'p240_auth_a');
select pg_temp.s09d_add_relation('a');
select pg_temp.s09d_create_type('o', 'p240_auth_o', 'editorial', 'other');
select pg_temp.s09d_grant_specialist('designer2', 'cms.schema_registry.read');
select pg_temp.s09d_revoke_via_rpc('designer2', 'cms.schema_designer');

-- ============================== AC034 403 for capability, indistinguishable 404 for concealment ====
select is(pg_temp.p_call('a02:ok', 'platform_api.cms_add_field_definition', 'owner', pg_temp.p_a02('a')), 'OK', 'control: the owner designer changes the draft [P2-S09-AC-034]');
select is(pg_temp.p_call('a02:forbid', 'platform_api.cms_add_field_definition', 'rev1', pg_temp.p_a02('a')), 'FORBIDDEN', 'a human without cms.schema_designer is 403 FORBIDDEN on CMS-03A-02 and nothing changes [P2-S09-AC-034]');
select is(pg_temp.p_call('a02:reader', 'platform_api.cms_add_field_definition', 'designer2', pg_temp.p_a02('a')), 'FORBIDDEN', 'a reader with only cms.schema_registry.read is 403 on the write [P2-S09-AC-034]');
select is(pg_temp.p_call('a02:hidden', 'platform_api.cms_add_field_definition', 'other', pg_temp.p_a02('a')), 'NOT_FOUND', 'another organization''s designer gets a 404 for the real draft [P2-S09-AC-034]');
select is(pg_temp.p_call('a02:absent', 'platform_api.cms_add_field_definition', 'other', pg_temp.p_a02('a', jsonb_build_object('versionId', extensions.gen_random_uuid()))), 'NOT_FOUND', 'and the same 404 for an absent draft [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('a02:hidden') is not distinct from pg_temp.s09d_resp('a02:absent') and pg_temp.s09d_detail('a02:hidden') is not distinct from pg_temp.s09d_detail('a02:absent')
    and pg_temp.s09d_outcome('a02:hidden') = pg_temp.s09d_outcome('a02:absent'), 'the concealed and the absent answers are indistinguishable: same token, no body, no detail [P2-S09-AC-034]');
create temp table p_rel on commit drop as select (select id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key = 'title') as field_id;
create or replace function pg_temp.p_a03(p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'fieldId', pg_temp.s09d_id('a:fieldId'),
    'targetKind', 'domain', 'targetType', 'organization', 'projectionKey', 'public.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit',
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over
$body$;
select is(pg_temp.p_call('a03:forbid', 'platform_api.cms_bind_relation', 'rev1', pg_temp.p_a03()), 'FORBIDDEN', 'a human without cms.schema_designer is 403 on CMS-03A-03 [P2-S09-AC-034]');
select is(pg_temp.p_call('a03:hidden', 'platform_api.cms_bind_relation', 'other', pg_temp.p_a03()), 'NOT_FOUND', 'another organization gets a 404 on CMS-03A-03 for a real draft [P2-S09-AC-034]');
select is(pg_temp.p_call('a03:absent', 'platform_api.cms_bind_relation', 'other', pg_temp.p_a03(jsonb_build_object('versionId', extensions.gen_random_uuid()))), 'NOT_FOUND', 'and for an absent one [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('a03:hidden') is not distinct from pg_temp.s09d_resp('a03:absent') and pg_temp.s09d_detail('a03:hidden') is not distinct from pg_temp.s09d_detail('a03:absent'), 'the two 404s are indistinguishable [P2-S09-AC-034]');
select pg_temp.s09d_create_type('g', 'p240_auth_g');
select pg_temp.s09d_to_approved('g');
select is(pg_temp.p_call('a04:forbid', 'platform_api.cms_activate_schema', 'rev1', jsonb_build_object('contentTypeId', pg_temp.s09d_id('g:type'), 'versionId', pg_temp.s09d_id('g:version'), 'expectedVersion', pg_temp.s09d_version('g'),
    'dryRunId', pg_temp.s09d_id('g:dryRun'), 'approvalIds', pg_temp.s09d_approval_ids('g'), 'migrationPlanId', pg_temp.s09d_id('g:plan'), 'idempotencyKey', 'p240-auth-act-forbid-0001')), 'FORBIDDEN',
  'a human without cms.schema_designer is 403 on CMS-03A-04 and the candidate is untouched [P2-S09-AC-034] [P2-S09-AC-629]');
select is(pg_temp.p_call('a04:hidden', 'platform_api.cms_activate_schema', 'other', jsonb_build_object('contentTypeId', pg_temp.s09d_id('g:type'), 'versionId', pg_temp.s09d_id('g:version'), 'expectedVersion', pg_temp.s09d_version('g'),
    'dryRunId', pg_temp.s09d_id('g:dryRun'), 'approvalIds', pg_temp.s09d_approval_ids('g'), 'migrationPlanId', pg_temp.s09d_id('g:plan'), 'idempotencyKey', 'p240-auth-act-hidden-0001')), 'NOT_FOUND',
  'another organization''s designer gets a 404 for the real candidate [P2-S09-AC-034]');
select is(pg_temp.p_call('a04:absent', 'platform_api.cms_activate_schema', 'other', jsonb_build_object('contentTypeId', pg_temp.s09d_id('g:type'), 'versionId', extensions.gen_random_uuid(), 'expectedVersion', '1',
    'dryRunId', pg_temp.s09d_id('g:dryRun'), 'approvalIds', pg_temp.s09d_approval_ids('g'), 'migrationPlanId', pg_temp.s09d_id('g:plan'), 'idempotencyKey', 'p240-auth-act-absent-0001')), 'NOT_FOUND',
  'and the same 404 for an absent candidate [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('a04:hidden') is not distinct from pg_temp.s09d_resp('a04:absent') and pg_temp.s09d_detail('a04:hidden') is not distinct from pg_temp.s09d_detail('a04:absent'), 'the two activation 404s are indistinguishable [P2-S09-AC-034]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('g:version')), 'approved', 'no refusal changed the approved candidate [P2-S09-AC-034]');

-- CMS-03A-07 (protected detail): 403 for a caller without registry read scope, one indistinguishable 404 for
-- an unreadable owner or an absent version/type, and the readers are served.  Every case is read-only.
create or replace function pg_temp.p_a07(p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version')) || p_over
$body$;
select is(pg_temp.p_call('a07:ok', 'platform_api.cms_get_content_type_version', 'owner', pg_temp.p_a07()), 'OK',
  'control: the owner designer reads the version detail [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:reader', 'platform_api.cms_get_content_type_version', 'designer2', pg_temp.p_a07()), 'OK',
  'control: a member holding only cms.schema_registry.read reads the detail [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:forbid', 'platform_api.cms_get_content_type_version', 'rev1', pg_temp.p_a07()), 'FORBIDDEN',
  'a human without registry read scope is 403 FORBIDDEN on CMS-03A-07 [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:forbid:absent', 'platform_api.cms_get_content_type_version', 'rev1', pg_temp.p_a07(jsonb_build_object('versionId', extensions.gen_random_uuid()))), 'FORBIDDEN',
  'the same human gets the same 403 for an absent version: the capability gate never discloses existence [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('a07:forbid') is not distinct from pg_temp.s09d_resp('a07:forbid:absent')
    and pg_temp.s09d_detail('a07:forbid') is not distinct from pg_temp.s09d_detail('a07:forbid:absent'),
  'the 403 for a real and an absent version is byte-identical [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:hidden', 'platform_api.cms_get_content_type_version', 'other', pg_temp.p_a07()), 'NOT_FOUND',
  'another organization''s designer gets a 404 for the real version [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:absent', 'platform_api.cms_get_content_type_version', 'other', pg_temp.p_a07(jsonb_build_object('versionId', extensions.gen_random_uuid()))), 'NOT_FOUND',
  'and the same 404 for an absent version [P2-S09-AC-034]');
select is(pg_temp.p_call('a07:wrongtype', 'platform_api.cms_get_content_type_version', 'owner', pg_temp.p_a07(jsonb_build_object('contentTypeId', extensions.gen_random_uuid()))), 'NOT_FOUND',
  'a real version under a type identifier it does not belong to is 404 even for the owner [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('a07:hidden') is not distinct from pg_temp.s09d_resp('a07:absent')
    and pg_temp.s09d_detail('a07:hidden') is not distinct from pg_temp.s09d_detail('a07:absent')
    and pg_temp.s09d_resp('a07:hidden') is not distinct from pg_temp.s09d_resp('a07:wrongtype')
    and pg_temp.s09d_detail('a07:hidden') is not distinct from pg_temp.s09d_detail('a07:wrongtype'),
  'the concealed, the absent and the mismatched-type answers are indistinguishable [P2-S09-AC-034]');

-- ================================ AC036 authority is derived server-side, caller metadata ignored ====
select is(pg_temp.p_call('d:' || k, 'platform_api.cms_add_field_definition', 'owner', pg_temp.p_a02('a', jsonb_build_object(k, 'caller-value'))), 'INVALID_REQUEST', 'CMS-03A-02 refuses the caller member ' || k || ' as an unknown key and changes nothing [P2-S09-AC-036]')
from unnest(array['ownerId', 'createdBy', 'actingPartyId', 'actorId', 'capability', 'roles', 'authUserId']) k;
select is(pg_temp.p_call('d:rel:' || k, 'platform_api.cms_bind_relation', 'owner', pg_temp.p_a03(jsonb_build_object(k, 'caller-value'))), 'VALIDATION_FAILED', 'CMS-03A-03 refuses the caller member ' || k || ' and changes nothing [P2-S09-AC-036]')
from unnest(array['ownerId', 'createdBy', 'actingPartyId', 'capability']) k;
select is(pg_temp.p_call('d:act:' || k, 'platform_api.cms_activate_schema', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('g:type'), 'versionId', pg_temp.s09d_id('g:version'), 'expectedVersion', pg_temp.s09d_version('g'),
    'dryRunId', pg_temp.s09d_id('g:dryRun'), 'approvalIds', pg_temp.s09d_approval_ids('g'), 'migrationPlanId', pg_temp.s09d_id('g:plan'), 'idempotencyKey', 'p240-auth-act-' || k || '-0001', k, 'caller-value')) , 'INVALID_REQUEST',
  'CMS-03A-04 refuses the caller member ' || k || ' and the candidate stays approved [P2-S09-AC-036]') from unnest(array['ownerId', 'approverCapability', 'actingPartyId', 'policyHash']) k;
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('g:version')), 'approved', 'the candidate is still approved after the refused metadata attempts [P2-S09-AC-036]');
select pg_temp.s09d_rpc('d:ok', 'platform_api.cms_create_type_draft', 'designer2', pg_temp.p_base(pg_temp.p_key('d2')));
select is(pg_temp.s09d_outcome('d:ok'), 'FORBIDDEN', 'control: designer2 lost the designer grant, so the server derives no create authority for her [P2-S09-AC-036]');
select pg_temp.s09d_rpc('d:own', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('p240_auth_derived'));
select ok((select t.owner_id = pg_temp.s09d_id('ownerOrg') and t.created_by = pg_temp.s09d_actor_id('owner', 'auth')::uuid and v.owner_id = t.owner_id and v.created_by = t.created_by
    from platform_private.cms_content_types t join platform_private.cms_content_type_versions v on v.content_type_id = t.id where t.type_key = 'p240_auth_derived'),
  'the stored owner is the acting organization and the creator the verified actor, both derived on the server [P2-S09-AC-036]');
select pg_temp.s09d_session('owner', 'authenticated');
select throws_ok(format($q$select platform_api.cms_list_content_types(%L::jsonb)$q$, jsonb_build_object('context', jsonb_build_object('authUserId', pg_temp.s09d_actor_id('rev1', 'auth')))), 'P0001', 'UNAUTHENTICATED',
  'an authenticated session whose request context names another user is refused: the verified JWT subject wins [P2-S09-AC-036]');
select throws_ok(format($q$select platform_api.cms_list_content_types(%L::jsonb)$q$, jsonb_build_object('context', jsonb_build_object('actorPersonId', pg_temp.s09d_actor_id('rev1', 'person')))), 'P0001', 'UNAUTHENTICATED',
  'nor can it name another person [P2-S09-AC-036]');

-- ====================== AC037 / AC182 the RLS helper, RPC-only writes, service-role confinement ====
select is((select count(*)::integer from pg_policies p where p.schemaname = 'platform_private' and p.tablename in ('cms_content_types', 'cms_content_type_versions', 'cms_content_type_template_bindings', 'cms_content_type_capability_bindings',
      'cms_field_definition_versions', 'cms_relation_definitions', 'cms_schema_migration_plans', 'cms_schema_artifacts', 'cms_schema_dry_run_reports', 'cms_block_definition_versions', 'cms_release_nonce_receipts', 'cms_block_definition_lifecycle_events')
    and p.qual like 'platform_private.cms_rpc_context_valid()%' and p.with_check like 'platform_private.cms_rpc_context_valid()%'), 12,
  'every original BE03a table has one policy whose predicate and check are the schema-qualified RPC-context helper [P2-S09-AC-037]');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] and p.provolatile = 's' from pg_proc p where p.oid = 'platform_private.cms_rpc_context_valid()'::regprocedure),
  'the helper is a SECURITY DEFINER function on an empty search_path; it is STABLE, not IMMUTABLE, because it reads the session context [P2-S09-AC-037]');
select ok(pg_temp.s09d_rls('cms_content_types') and pg_temp.s09d_rls('cms_content_type_versions') and pg_temp.s09d_rls('cms_field_definition_versions') and pg_temp.s09d_rls('cms_relation_definitions')
    and pg_temp.s09d_rls('cms_schema_artifacts') and pg_temp.s09d_rls('cms_schema_migration_plans') and pg_temp.s09d_rls('cms_schema_dry_run_reports') and pg_temp.s09d_rls('cms_block_definition_versions')
    and pg_temp.s09d_rls('cms_release_nonce_receipts') and pg_temp.s09d_rls('cms_block_definition_lifecycle_events') and pg_temp.s09d_rls('cms_content_type_template_bindings') and pg_temp.s09d_rls('cms_content_type_capability_bindings'),
  'RLS is enabled and forced on all twelve tables [P2-S09-AC-037]');
select is((select count(*)::integer from information_schema.role_table_grants g where g.grantee in ('anon', 'authenticated', 'service_role', 'public') and g.table_schema = 'platform_private' and g.table_name like 'cms\_%'
      and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), 0, 'no browser, public or service role may write any cms_ table directly: mutation exists only through the named RPCs [P2-S09-AC-037]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_api' and p.proname like 'cms\_%' and p.prokind = 'f' and p.prosecdef
      and p.proconfig @> array['search_path=""']), (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_api' and p.proname like 'cms\_%' and p.prokind = 'f'),
  'every platform_api cms_ RPC is schema-qualified, SECURITY DEFINER with an empty search_path [P2-S09-AC-037]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_api' and p.proname like 'cms\_%' and p.prokind = 'f' and not (p.prosecdef and p.proconfig @> array['search_path=""'])), 0,
  'and no cms_ RPC is missing either property: the service role reaches only named, pinned functions [P2-S09-AC-182]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_private' and p.proname like 'cms\_%' and p.prokind = 'f'
      and (has_function_privilege('service_role', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))), 0,
  'no platform_private cms_ function is executable by the service role or a browser role: only the platform_api wrappers are [P2-S09-AC-182]');
select is((select count(*)::integer from information_schema.role_table_grants g where g.grantee = 'service_role' and g.table_schema = 'platform_private' and g.table_name like 'cms\_%'), 0,
  'the service role holds no table privilege on any cms_ table: workers cannot mutate or read tables directly [P2-S09-AC-182]');
select is(pg_temp.p_call('w:extra', 'platform_api.cms_get_schema_migration_plan', 'owner', jsonb_build_object('migrationPlanId', pg_temp.s09d_id('g:plan'), 'schemaVersionId', pg_temp.s09d_id('g:version'),
    'expectedVersion', pg_temp.s09d_read('cms_schema_migration_plans', 'version', pg_temp.s09d_id('g:plan')), 'rows', 'select * from users')), 'INVALID_REQUEST',
  'a worker RPC accepts only its bounded identifiers, versions and counters: an unknown member (here SQL text) is refused [P2-S09-AC-182]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('platform_api', 'platform_private') and p.proname like 'cms\_%' and p.prokind = 'f'
      and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(^|[^a-z_])execute[[:space:]]+(format|''|\$)' and p.proname not in ('cms_template_registry_valid') and p.pronamespace = 'platform_api'::regnamespace), 0,
  'no exposed platform_api RPC builds dynamic SQL from request data [P2-S09-AC-182]');

-- ============================================= AC190 the event envelope ====
select pg_temp.s09d_activate('g');
select pg_temp.p_register('ev:blk', pg_temp.p_block_request('p240evt', 1));
select pg_temp.p_advance('ev:adv', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('ev:blk')->>'id')::uuid, 'supported', 'deprecated'));
select pg_temp.s09d_grant_specialist('rev2', 'cms.navigation_editor');
create temp table p_events on commit drop as select o.* from platform_private.outbox_events o where o.event_type like 'cms.%';
select ok((select count(distinct event_type) >= 6 from p_events), 'fixture: the real flows emitted at least six distinct CMS event types [P2-S09-AC-190]');
select ok((select bool_and(e.id is not null and e.event_type ~ '^cms\.[a-z0-9._-]+\.v[1-9][0-9]*$' and e.schema_version = 1 and e.occurred_at is not null and e.correlation_id is not null
      and e.aggregate_type ~ '^cms_[a-z_]+$' and e.aggregate_id is not null and e.aggregate_version > 0 and jsonb_typeof(e.payload) = 'object') from p_events e),
  'every CMS event carries an id, a versioned type, schema version 1, occurrence time, correlation id, aggregate type, aggregate id and a positive aggregate version, with an object payload [P2-S09-AC-190]');
select is((select pg_typeof(aggregate_version)::text from p_events limit 1), 'bigint', 'the aggregate version is a 64-bit integer that crosses the API as a decimal string [P2-S09-AC-190]');
select is((select count(*)::integer from p_events e where e.correlation_id is null), 0, 'a correlation id is never absent; causation is nullable [P2-S09-AC-190]');
select is((select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(e.payload) k from p_events e where e.event_type = 'cms.schema.activated.v1') x), 'activationEvidence,contentTypeId,localeConfigHash,migrationPlanId,schemaVersionId',
  'the activation event payload is exactly the five members of SchemaActivatedEventPayload [P2-S09-AC-190]');
select is((select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(e.payload) k from p_events e where e.event_type = 'cms.block.lifecycle.changed.v1') x),
  'blockDefinitionVersionId,blockKey,blockVersion,fromLifecycle,releaseDigest,releaseKeyId,releaseNonceHash,releaseVerifiedAt,toLifecycle', 'the lifecycle event payload is exactly the nine members of BlockLifecycleChangedEventPayload [P2-S09-AC-190]');
select is((select count(*)::integer from p_events e, jsonb_object_keys(e.payload) k where k = any(array['label', 'labels', 'value', 'values', 'fieldValues', 'content', 'email', 'name', 'displayName', 'phone', 'secret', 'token', 'password', 'body', 'snapshot', 'propsSchemaSnapshot', 'renderer', 'rendererRef', 'source', 'html', 'fields', 'editorManifest', 'rendererManifest'])), 0, 'no payload carries field values, labels, private content, secrets, renderer code or snapshots: identifiers, hashes and enumerations only [P2-S09-AC-190]');
select is((select count(*)::integer from p_events e where e.event_type in ('cms.schema.activated.v1', 'cms.block.lifecycle.changed.v1') and e.payload::text ~* '(authUserId|actorPersonId|actingPartyId|ownerId|owner_id|person)'), 0,
  'events carry no user, person or party identifier beyond the BE00-approved envelope [P2-S09-AC-190]');
select is((select count(*)::integer from information_schema.columns where table_schema = 'platform_private' and table_name = 'outbox_events' and column_name = 'producer'), 0,
  'the shared BE00 outbox has no producer column: the producer is the event-type prefix, a platform-wide shape this shard does not own [P2-S09-AC-190]');

-- ================================================ AC192 consumer rules over the claim/DLQ RPCs ====
create temp table p_act_event on commit drop as select e.id, e.event_type, e.schema_version, e.aggregate_type, e.aggregate_id, e.aggregate_version, e.payload from platform_private.outbox_events e where e.event_type = 'cms.schema.activated.v1' limit 1;
create or replace function pg_temp.p_claim(p_label text, p_token uuid, p_over jsonb default '{}'::jsonb, p_replay boolean default false) returns jsonb language plpgsql as $body$
declare e record;
begin
  select * into e from p_act_event;
  perform pg_temp.s09d_session('owner', 'service_role');
  return pg_temp.s09d_call(p_label, 'platform_api.cms_claim_schema_migration_event', jsonb_build_object('eventId', e.id, 'eventType', e.event_type, 'schemaVersion', e.schema_version,
    'aggregateType', e.aggregate_type, 'aggregateId', e.aggregate_id, 'aggregateVersion', e.aggregate_version::text, 'migrationPlanId', e.payload->'migrationPlanId', 'claimToken', p_token, 'replay', p_replay) || p_over);
end;
$body$;
create temp table p_tokens on commit drop as select extensions.gen_random_uuid() as t1, extensions.gen_random_uuid() as t2;
select pg_temp.p_claim('cl:1', (select t1 from p_tokens));
select is(pg_temp.s09d_resp('cl:1')->>'status', 'new', 'the first consumer claim of an event is new [P2-S09-AC-192]');
select pg_temp.p_claim('cl:1b', (select t1 from p_tokens));
select is(pg_temp.s09d_resp('cl:1b')->>'status', 'in_progress', 'the same claimant asking again while its lease holds is in progress, never a second processing [P2-S09-AC-192]');
select pg_temp.p_claim('cl:2', (select t2 from p_tokens));
select is(pg_temp.s09d_resp('cl:2')->>'status', 'in_progress', 'a second consumer does not process an event whose claim is live: at-least-once delivery, one active processor [P2-S09-AC-192]');
select pg_temp.s09d_call('cl:ack', 'platform_api.cms_acknowledge_schema_migration_event', (select jsonb_build_object('eventId', id, 'eventType', event_type, 'schemaVersion', schema_version, 'aggregateType', aggregate_type,
    'aggregateId', aggregate_id, 'aggregateVersion', aggregate_version::text, 'migrationPlanId', payload->'migrationPlanId', 'claimToken', (select t1 from p_tokens), 'outcome', 'success') from p_act_event));
select is(pg_temp.s09d_outcome('cl:ack') || ' ' || (pg_temp.s09d_resp('cl:ack')->>'accepted'), 'OK true', 'the claimant acknowledges the processed event and the claim completes [P2-S09-AC-192]');
select pg_temp.p_claim('cl:3', (select t2 from p_tokens));
select is(pg_temp.s09d_resp('cl:3')->>'status', 'duplicate', 'a redelivery after completion is a duplicate: events are deduplicated by event identity [P2-S09-AC-192]');
select pg_temp.p_claim('cl:schema', extensions.gen_random_uuid(), '{"schemaVersion":2}');
select is(pg_temp.s09d_outcome('cl:schema'), 'NOT_FOUND', 'an event version the consumer does not know (schema version 2) matches no event and is not processed [P2-S09-AC-192]');
select pg_temp.p_claim('cl:type', extensions.gen_random_uuid(), '{"eventType":"cms.schema.activated.v2"}');
select is(pg_temp.s09d_outcome('cl:type'), 'NOT_FOUND', 'neither is an unknown event type version (v2) [P2-S09-AC-192]');
select pg_temp.p_claim('cl:mismatch', extensions.gen_random_uuid(), jsonb_build_object('migrationPlanId', extensions.gen_random_uuid()));
select is(pg_temp.s09d_outcome('cl:mismatch'), 'CONFLICT', 'a claim whose plan identity differs from the event is a conflict [P2-S09-AC-192]');
select pg_temp.s09d_call('cl:dlq', 'platform_api.cms_dead_letter_schema_migration_event', (select jsonb_build_object('eventId', id, 'eventType', event_type, 'schemaVersion', schema_version, 'aggregateType', aggregate_type,
    'aggregateId', aggregate_id, 'aggregateVersion', aggregate_version::text, 'migrationPlanId', payload->'migrationPlanId', 'claimToken', (select t2 from p_tokens), 'reasonCode', 'UNKNOWN_EVENT_VERSION') from p_act_event));
select is(pg_temp.s09d_outcome('cl:dlq'), 'OK', 'an event routed to the dead-letter queue is answered with exactly the typed OK result [P2-S09-AC-192]');

-- ============================================== AC015 the IA common envelope and exceptions ====
select is((select string_agg(t.table_name || ':' || m.cols, ';' order by t.table_name) from (select distinct table_name from information_schema.tables where table_schema = 'platform_private' and table_name like 'cms\_%' and table_type = 'BASE TABLE') t
    cross join lateral (select string_agg(e, ',' order by e) cols from unnest(array['id', 'owner_id', 'state', 'version', 'created_at', 'updated_at']) e where not exists
      (select 1 from information_schema.columns k where k.table_schema = 'platform_private' and k.table_name = t.table_name and k.column_name = e)) m where m.cols is not null),
  'cms_content_entries:state;cms_operational_alert_deliveries:created_at,owner_id,updated_at,version;cms_owner_initialization:id,owner_id,state,updated_at,version;cms_release_nonce_receipts:owner_id,state,version;cms_schema_dry_run_row_evidence:created_at,owner_id,state,updated_at,version;cms_schema_migration_target_rows:created_at,state,updated_at,version;cms_schema_review_decisions:state;cms_terms:state',
  'every cms_ table carries the IA envelope (id, owner_id, state, version, created_at, updated_at) except exactly the eight documented exceptions: the entry and term lifecycle tables, the operator receipt, the alert delivery log, the append-only evidence tables, the decision log and the nonce receipt [P2-S09-AC-015]');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%' and a.attname = 'state' and a.attnum > 0
      and format_type(a.atttypid, a.atttypmod) = 'text'
      and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ '\mstate\M[^,]*(ANY|IN|=)')), 0,
  'every text state column is closed by a CHECK over a finite list and every other state column is a closed enum [P2-S09-AC-015]');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid join pg_type t on t.oid = a.atttypid
    where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%' and a.attname = 'state' and a.attnum > 0 and t.typtype = 'e' and t.typname <> 'cms_definition_state'), 0,
  'the one shared state enum is cms_definition_state, closed at eight members [P2-S09-AC-015]');
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%' and a.attname = 'version' and a.attnum > 0
      and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'c' and pg_get_constraintdef(k.oid) ~ 'version > 0|version >= 1')), 0, 'every version column is closed to non-positive values [P2-S09-AC-015]');
select is(pg_temp.p_call('own:authority', 'platform_api.cms_add_field_definition', 'other', pg_temp.p_a02('a', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type')))), 'NOT_FOUND',
  'owner_id is an ownership reference, never a grant: a caller who simply names the owner''s identifiers acquires no authority [P2-S09-AC-015]');
select ok(not exists (select 1 from pg_proc p where p.pronamespace in ('platform_private'::regnamespace, 'platform_api'::regnamespace) and p.proname in ('cms_require_capability', 'cms_require_read')
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* 'owner_id'), 'the capability checks never read owner_id: ownership does not authorize [P2-S09-AC-015]');

-- =========================== AC212 a failed audit or outbox write rolls the mutation back ====
create function public.p240_fail() returns trigger language plpgsql as $body$
begin
  if tg_table_name = current_setting('p240.fail_table', true) and new.action is not distinct from coalesce(nullif(current_setting('p240.fail_action', true), ''), new.action) then raise exception 'P240_FORCED_FAILURE'; end if;
  return new;
end;
$body$;
create function public.p240_fail_outbox() returns trigger language plpgsql as $body$
begin
  if tg_table_name = current_setting('p240.fail_table', true) and new.event_type = coalesce(nullif(current_setting('p240.fail_event', true), ''), new.event_type) then raise exception 'P240_FORCED_FAILURE'; end if;
  return new;
end;
$body$;
create trigger p240_fail_audit before insert on audit_private.audit_events for each row execute function public.p240_fail();
create trigger p240_fail_outbox before insert on platform_private.outbox_events for each row execute function public.p240_fail_outbox();
create or replace function pg_temp.p_forced(p_table text, p_action text, p_event text, p_label text, p_fn text, p_actor text, p_req jsonb) returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  perform set_config('p240.fail_table', p_table, true); perform set_config('p240.fail_action', p_action, true); perform set_config('p240.fail_event', p_event, true);
  perform pg_temp.s09d_rpc(p_label, p_fn, p_actor, p_req, true);
  outcome := pg_temp.s09d_outcome(p_label);
  perform set_config('p240.fail_table', '', true);
  return outcome || ' ' || (before_fp = pg_temp.p_fp())::text;
end;
$body$;
select pg_temp.s09d_create_type('h', 'p240_auth_h');
select pg_temp.s09d_add_field_only('h');
select is(pg_temp.p_forced('audit_events', 'cms.schema.relation.bind', '', 'f:a03a', 'platform_api.cms_bind_relation', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('h:type'), 'versionId', pg_temp.s09d_id('h:version'),
    'fieldId', pg_temp.s09d_id('h:fieldId'), 'targetKind', 'domain', 'targetType', 'organization', 'projectionKey', 'public.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit', 'expectedVersion', pg_temp.s09d_version('h'), 'idempotencyKey', 'p240-force-a03-0001')), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-03: no relation row, no version bump, no idempotency record [P2-S09-AC-212]');
select pg_temp.s09d_create_type('k', 'p240_auth_k');
select pg_temp.s09d_to_approved('k');
create temp table p_act_req on commit drop as select jsonb_build_object('contentTypeId', pg_temp.s09d_id('k:type'), 'versionId', pg_temp.s09d_id('k:version'), 'expectedVersion', pg_temp.s09d_version('k'),
  'dryRunId', pg_temp.s09d_id('k:dryRun'), 'approvalIds', pg_temp.s09d_approval_ids('k'), 'migrationPlanId', pg_temp.s09d_id('k:plan'), 'idempotencyKey', 'p240-force-a04-0001') as req;
select is(pg_temp.p_forced('outbox_events', '', 'cms.schema.activated.v1', 'f:a04o', 'platform_api.cms_activate_schema', 'owner', (select req from p_act_req)), 'P240_FORCED_FAILURE true',
  'a failed outbox write rolls back CMS-03A-04: the candidate stays approved, no version supersedes, no plan advances [P2-S09-AC-212]');
select is(pg_temp.p_forced('audit_events', 'cms.schema.activate', '', 'f:a04a', 'platform_api.cms_activate_schema', 'owner', (select req from p_act_req)), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-04 as well [P2-S09-AC-212]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('k:version')), 'approved', 'after both rollbacks the candidate is still approved and not active [P2-S09-AC-212]');
select pg_temp.s09d_rpc('f:a04ok', 'platform_api.cms_activate_schema', 'owner', (select req from p_act_req), true);
select is(pg_temp.s09d_outcome('f:a04ok'), 'OK', 'the same request then commits: the failed attempts reserved nothing [P2-S09-AC-212]');
-- The remaining original operations: CMS-03A-01 (create), CMS-03A-02 (field), CMS-03A-05 (block registration) and
-- CMS-03A-08 (lifecycle advance).  For each, a failed audit write and a failed outbox write leave the fingerprint of
-- every aggregate, nonce, event, audit, outbox and idempotency row untouched, and the same request then commits.
create temp table p_a01_req on commit drop as select pg_temp.p_base('p240_force_a01', '{"idempotencyKey":"p240-force-a01-0001"}') as req;
select is(pg_temp.p_forced('audit_events', '', '', 'f:a01a', 'platform_api.cms_create_type_draft', 'owner', (select req from p_a01_req)), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-01: no type, version, field, artifact, audit row or idempotency record [P2-S09-AC-212]');
select is(pg_temp.p_forced('outbox_events', '', '', 'f:a01o', 'platform_api.cms_create_type_draft', 'owner', (select req from p_a01_req)), 'P240_FORCED_FAILURE true',
  'a failed outbox write rolls back CMS-03A-01 as well [P2-S09-AC-212]');
select is((select count(*)::integer from platform_private.cms_content_types where type_key = 'p240_force_a01'), 0, 'after both rollbacks no part of the CMS-03A-01 aggregate exists [P2-S09-AC-212]');
select pg_temp.s09d_rpc('f:a01ok', 'platform_api.cms_create_type_draft', 'owner', (select req from p_a01_req), true);
select is(pg_temp.s09d_outcome('f:a01ok'), 'OK', 'the same CMS-03A-01 request then commits: the failed attempts reserved nothing [P2-S09-AC-212]');

select pg_temp.s09d_create_type('m', 'p240_auth_m');
create temp table p_a02_req on commit drop as select pg_temp.p_a02('m', jsonb_build_object('idempotencyKey', 'p240-force-a02-0001')) as req;
select is(pg_temp.p_forced('audit_events', '', '', 'f:a02a', 'platform_api.cms_add_field_definition', 'owner', (select req from p_a02_req)), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-02: no field row, no version bump, no idempotency record [P2-S09-AC-212]');
-- BE03a (CMS-03A-02 "no event; prior draft remains"): the field command writes an audit row and no outbox event,
-- so only the audit write is part of its atomic boundary; the retry below proves the audit failure left nothing.
create temp table p_a02_outbox on commit drop as select count(*) as n from platform_private.outbox_events;
select pg_temp.s09d_rpc('f:a02ok', 'platform_api.cms_add_field_definition', 'owner', (select req from p_a02_req), true);
select is(pg_temp.s09d_outcome('f:a02ok'), 'OK', 'the same CMS-03A-02 request then commits [P2-S09-AC-212]');
select is((select count(*) from platform_private.outbox_events), (select n from p_a02_outbox),
  'CMS-03A-02 emits no outbox event, so there is no outbox write whose failure could orphan the field row [P2-S09-AC-212]');

create or replace function pg_temp.p_forced_block(p_table text, p_label text, p_request jsonb, p_lifecycle boolean) returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_block_rows(); outcome text;
begin
  perform set_config('p240.fail_table', p_table, true); perform set_config('p240.fail_action', '', true); perform set_config('p240.fail_event', '', true);
  if p_lifecycle then perform pg_temp.p_advance(p_label, p_request); else perform pg_temp.p_register(p_label, p_request); end if;
  outcome := pg_temp.s09d_outcome(p_label);
  perform set_config('p240.fail_table', '', true);
  return outcome || ' ' || (before_rows = pg_temp.p_block_rows())::text;
end;
$body$;
create temp table p_a05_req on commit drop as select pg_temp.p_block_request('p240force', 1) as req;
select is(pg_temp.p_forced_block('audit_events', 'f:a05a', (select req from p_a05_req), false), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-05: no block row, no nonce claim, no outbox row or idempotency record [P2-S09-AC-212]');
select is(pg_temp.p_forced_block('outbox_events', 'f:a05o', (select req from p_a05_req), false), 'P240_FORCED_FAILURE true',
  'a failed outbox write rolls back CMS-03A-05 as well [P2-S09-AC-212]');
select is(pg_temp.p_block_expect('f:a05ok', (select req from p_a05_req), 'OK'), 'ok',
  'the same signed CMS-03A-05 request then commits: the nonce was never consumed by the failed attempts [P2-S09-AC-212]');
create temp table p_a08_block on commit drop as select id from platform_private.cms_block_definition_versions where block_key = 'p240force' and block_version = 1;
create temp table p_a08_req on commit drop as select pg_temp.p_lifecycle_request((select id from p_a08_block), 'supported', 'deprecated') as req;
select is(pg_temp.p_forced_block('audit_events', 'f:a08a', (select req from p_a08_req), true), 'P240_FORCED_FAILURE true',
  'a failed audit write rolls back CMS-03A-08: no lifecycle event, no nonce claim, no outbox row or idempotency record [P2-S09-AC-212]');
select is(pg_temp.p_forced_block('outbox_events', 'f:a08o', (select req from p_a08_req), true), 'P240_FORCED_FAILURE true',
  'a failed outbox write rolls back CMS-03A-08 as well [P2-S09-AC-212]');
select is(pg_temp.p_block_expect('f:a08ok', (select req from p_a08_req), 'OK', true), 'ok',
  'the same signed CMS-03A-08 request then commits all four effects together [P2-S09-AC-212]');
drop trigger p240_fail_audit on audit_private.audit_events;
drop trigger p240_fail_outbox on platform_private.outbox_events;

select * from finish();
rollback;
