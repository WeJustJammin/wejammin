commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the CMS-03A-01
-- aggregate.  The create command is exercised end to end (every child table,
-- the artifact reference, replay, atomic rollback of a late failure, a forced
-- audit or outbox failure, the declared failure tokens) and every claim about
-- authority is checked against the live catalog and a second human.  Rows come
-- only from the named RPCs.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc

create or replace function pg_temp.p_full(p_key text, p_over jsonb default '{}'::jsonb) returns jsonb language plpgsql as $body$
declare rel_field jsonb := pg_temp.p_field('related', 'relation');
begin
  return pg_temp.p_base(p_key, jsonb_build_object(
    'fields', jsonb_build_array(pg_temp.p_field('title', 'short_text', '{"required":true}'), rel_field,
      pg_temp.p_field('summary', 'long_text', '{"localizationMode":"localized"}')),
    'relations', jsonb_build_array(jsonb_build_object('fieldId', rel_field->>'stableFieldId', 'targetKind', 'domain', 'targetType', 'profile',
      'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder')),
    'capabilityBindings', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1'),
      jsonb_build_object('capabilityKey', 'cms.reviewer', 'capabilityVersion', '1')),
    'supportedLocales', '["en-US","fr-FR"]'::jsonb, 'fallbackChains', '{"fr-FR":["en-US"]}'::jsonb) || p_over);
end;
$body$;
create or replace function pg_temp.p_children(p_key text) returns text language sql stable as $body$
  select concat_ws('|',
    (select count(*) from platform_private.cms_content_types t where t.type_key = p_key),
    (select count(*) from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = p_key),
    (select count(*) from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
       join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = p_key),
    (select count(*) from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
       join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = p_key),
    (select count(*) from platform_private.cms_content_type_capability_bindings b join platform_private.cms_content_type_versions v on v.id = b.content_type_version_id
       join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = p_key),
    (select count(*) from platform_private.cms_schema_artifacts a join platform_private.cms_content_type_versions v on v.id = a.content_type_version_id
       join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = p_key))
$body$;

-- ================================================================ AC003 aggregate ====
create temp table p_req on commit drop as select pg_temp.p_full('p240_agg_ok', '{"idempotencyKey":"p240-agg-ok-0001"}') as req;
select pg_temp.s09d_rpc('agg', 'platform_api.cms_create_type_draft', 'owner', (select req from p_req));
select is(pg_temp.s09d_outcome('agg'), 'OK', 'CMS-03A-01 accepts the complete aggregate request [P2-S09-AC-003]');
select is(pg_temp.p_children('p240_agg_ok'), '1|1|3|1|2|1',
  'one commit created exactly one type, one initial version, three fields, one relation, two capability bindings and one artifact [P2-S09-AC-003]');
select ok((select v.version_no = 1 and v.state = 'draft' and v.workflow_key = 'editorial' and v.workflow_version = 1
      and v.source_locale = 'en-US' and v.default_locale = 'en-US' and v.supported_locales = '["en-US","fr-FR"]'::jsonb
      and v.fallback_chains = '{"fr-FR":["en-US"]}'::jsonb and v.locale_config_hash ~ '^[a-f0-9]{64}$' and v.default_template_version_id is null
      and v.dry_run_id is null and v.owner_id = pg_temp.s09d_id('ownerOrg')
    from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_agg_ok'),
  'the initial version records the workflow and locale references the request named, version 1, draft, no dry run, the acting owner [P2-S09-AC-003]');
-- AC054: the 201 body is the strict ContentTypeVersionResource produced by the database itself (no port stub):
-- exactly the declared members, the locale configuration, and counts that match the committed children.
select is((select string_agg(k, ',' order by k) from jsonb_object_keys(pg_temp.s09d_resp('agg')) k),
  'activationEvidence,capabilityBindingCount,compatibility,contentHash,contentTypeId,createdAt,defaultLocale,defaultTemplateVersionId,dryRunId,fallbackChains,fieldCount,id,label,localeConfigHash,ownerCapability,relationCount,resourceKind,schemaArtifactId,sourceLocale,state,supportedLocales,typeKey,updatedAt,version,workflowKey,workflowVersion',
  'the create response carries exactly the declared ContentTypeVersionResource members and no ownership or release evidence [P2-S09-AC-054]');
select ok(pg_temp.s09d_resp('agg')->>'resourceKind' = 'content_type_version' and pg_temp.s09d_resp('agg')->>'state' = 'draft'
    and pg_temp.s09d_resp('agg')->>'version' = '1' and pg_temp.s09d_resp('agg')->>'typeKey' = 'p240_agg_ok'
    and pg_temp.s09d_resp('agg')->>'ownerCapability' = 'cms.schema_designer' and pg_temp.s09d_resp('agg')->>'workflowKey' = 'editorial'
    and pg_temp.s09d_resp('agg')->>'workflowVersion' = '1' and pg_temp.s09d_resp('agg')->>'compatibility' = 'additive'
    and pg_temp.s09d_resp('agg')->'dryRunId' = 'null'::jsonb and pg_temp.s09d_resp('agg')->'activationEvidence' = 'null'::jsonb
    and pg_temp.s09d_resp('agg')->'defaultTemplateVersionId' = 'null'::jsonb,
  'the response states the draft identity, workflow, additive compatibility and no dry run, template or activation evidence [P2-S09-AC-054]');
select ok(pg_temp.s09d_resp('agg')->>'sourceLocale' = 'en-US' and pg_temp.s09d_resp('agg')->>'defaultLocale' = 'en-US'
    and pg_temp.s09d_resp('agg')->'supportedLocales' = '["en-US","fr-FR"]'::jsonb
    and pg_temp.s09d_resp('agg')->'fallbackChains' = '{"fr-FR":["en-US"]}'::jsonb
    and pg_temp.s09d_resp('agg')->>'localeConfigHash' ~ '^[a-f0-9]{64}$',
  'the response carries sourceLocale, defaultLocale, the sorted supportedLocales, fallbackChains and a 64-hex localeConfigHash [P2-S09-AC-054]');
select ok((select r.resp->>'id' = v.id::text and r.resp->>'contentTypeId' = t.id::text and r.resp->>'schemaArtifactId' = v.schema_artifact_id::text
      and r.resp->>'contentHash' = v.definition_hash and r.resp->>'localeConfigHash' = v.locale_config_hash
      and r.resp->>'label' = v.labels->>'label'
      and (r.resp->>'fieldCount')::integer = 3 and (r.resp->>'relationCount')::integer = 1 and (r.resp->>'capabilityBindingCount')::integer = 2
      and (r.resp->>'createdAt')::timestamptz = v.created_at and (r.resp->>'updatedAt')::timestamptz = v.updated_at
    from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id,
      lateral (select pg_temp.s09d_resp('agg') as resp) r where t.type_key = 'p240_agg_ok'),
  'every projected identifier, hash, timestamp and count equals the committed rows [P2-S09-AC-054]');
select ok((select a.id = v.schema_artifact_id and a.content_type_version_id = v.id and a.zod_contract_ref = 'cms/content-type/p240_agg_ok/v1'
      and a.artifact_hash = v.definition_hash and a.state = 'compiled' and a.owner_id = v.owner_id
    from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id
    join platform_private.cms_schema_artifacts a on a.content_type_version_id = v.id where t.type_key = 'p240_agg_ok'),
  'the version carries the compiled artifact reference: the artifact is the version''s own, its contract ref names the type and v1 and its hash is the definition hash [P2-S09-AC-003]');
select ok((select bool_and(f.owner_id = v.owner_id and f.content_type_version_id = v.id)
    from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_agg_ok'),
  'every child is stamped with the owner and parent version the server derived, none from the request [P2-S09-AC-003]');
create temp table p_state on commit drop as select pg_temp.p_rows() as rows, pg_temp.p_children('p240_agg_ok') as kids;
select pg_temp.s09d_rpc('agg:replay', 'platform_api.cms_create_type_draft', 'owner', (select req from p_req));
select is(pg_temp.s09d_resp('agg:replay'), pg_temp.s09d_resp('agg'), 'replay of the exact request and key returns the original resource [P2-S09-AC-003]');
select is(pg_temp.p_rows(), (select rows from p_state), 'the replay committed nothing: every table, the outbox, the audit trail and idempotency records are unchanged [P2-S09-AC-003]');
select pg_temp.s09d_rpc('agg:changed', 'platform_api.cms_create_type_draft', 'owner', (select req from p_req) || '{"label":"Different label"}');
select is(pg_temp.s09d_outcome('agg:changed'), 'IDEMPOTENCY_MISMATCH', 'the same key with a changed body is a typed conflict, not a second create [P2-S09-AC-003]');
select is(pg_temp.p_rows(), (select rows from p_state), 'the mismatched replay committed nothing [P2-S09-AC-003]');
-- atomic: a late child failure (the last capability binding) leaves nothing of the earlier inserts
select is(pg_temp.p_run('agg:late', pg_temp.p_full('p240_agg_late', jsonb_build_object('capabilityBindings', jsonb_build_array(
    jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1'), jsonb_build_object('capabilityKey', 'cms.unknown', 'capabilityVersion', '1')))),
    'VALIDATION_FAILED'), 'ok',
  'a defect in the last child leaves no type, version, field, relation, binding or artifact behind: the aggregate is atomic [P2-S09-AC-003]');
select is(pg_temp.p_children('p240_agg_late'), '0|0|0|0|0|0', 'the failed aggregate left zero rows in every child table [P2-S09-AC-003]');
select is(pg_temp.p_run('agg:latefield', pg_temp.p_full('p240_agg_latefield', jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('title', 'short_text'), pg_temp.p_field('bad_one', 'short_text', '{"lifecycle":"gone"}')))), 'VALIDATION_FAILED'), 'ok',
  'a defective field after a valid one also commits nothing [P2-S09-AC-003]');

-- ================================================== AC006 registries, no caller authority ====
select is(pg_temp.p_run('reg:' || c.n, pg_temp.p_full(pg_temp.p_key('reg' || c.n), c.o), 'VALIDATION_FAILED'), 'ok',
  'a caller-supplied ' || c.n || ' that is not a protected registry member is refused and nothing is committed [P2-S09-AC-006]')
from (values
  ('workflow key', '{"workflowKey":"caller.invented"}'::jsonb), ('workflow version', '{"workflowVersion":"3"}'),
  ('owner capability', '{"ownerCapability":"cms.invented"}'),
  ('capability binding', '{"capabilityBindings":[{"capabilityKey":"cms.invented","capabilityVersion":"1"}]}'),
  ('validator pair', jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('title', 'short_text', '{"validatorKey":"caller.regex","validatorVersion":1}')))),
  ('relation projection', jsonb_build_object('fields', jsonb_build_array(pg_temp.p_field('rel', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0010"}')),
    'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0010', 'targetKind', 'domain', 'targetType', 'profile',
      'projectionKey', 'caller.projection', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')))) ) c(n, o);
select is(pg_temp.p_run('reg:auth:' || k, pg_temp.p_base(pg_temp.p_key('regauth' || k), jsonb_build_object(k, to_jsonb('caller-value'::text))), 'INVALID_REQUEST'), 'ok',
  'the caller key ' || k || ' is an unknown key: policy, authority and ownership are never request input [P2-S09-AC-006]')
from unnest(array['policyHash', 'requiredCapabilities', 'ownerId', 'createdBy', 'builtIn', 'grants', 'authority']) k;
select is((select count(*)::integer from platform_private.cms_workflow_policies), 8, 'the policy registry holds exactly the eight code-seeded members, none from a caller [P2-S09-AC-006]');
select is((select string_agg(distinct v.workflow_key, ',' order by v.workflow_key) from platform_private.cms_content_type_versions v), 'editorial',
  'every persisted version in this run binds a seeded registry member (editorial) [P2-S09-AC-006]');
select ok(not exists (select 1 from platform_private.cms_content_types t where t.owner_capability not in (
    'cms.schema_designer', 'cms.editor')), 'every persisted owner capability is a registry member [P2-S09-AC-006]');

-- ================================================== AC051 bindings never grant authority ====
create temp table p_grants_before on commit drop as select
  (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from identity_private.organization_actor_grant g) as actor_grants,
  (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from platform_private.cms_capability_grants g) as cms_grants;
select pg_temp.s09d_rpc('bind', 'platform_api.cms_create_type_draft', 'designer2', pg_temp.p_base('p240_bind_auth', jsonb_build_object('capabilityBindings', jsonb_build_array(
  jsonb_build_object('capabilityKey', 'cms.template_designer', 'capabilityVersion', '1'), jsonb_build_object('capabilityKey', 'cms.publisher', 'capabilityVersion', '1'),
  jsonb_build_object('capabilityKey', 'cms.schema_review.assign', 'capabilityVersion', '1')))));
select is(pg_temp.s09d_outcome('bind'), 'OK', 'fixture: a second designer binds three capabilities she does not hold [P2-S09-AC-051]');
select is((select count(*)::integer from platform_private.cms_content_type_capability_bindings b join platform_private.cms_content_type_versions v on v.id = b.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_bind_auth'), 3, 'the three bindings are stored as references [P2-S09-AC-051]');
select ok((select actor_grants = (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from identity_private.organization_actor_grant g)
      and cms_grants = (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from platform_private.cms_capability_grants g) from p_grants_before),
  'creating the bindings changed no actor grant and no CMS capability grant [P2-S09-AC-051]');
select pg_temp.s09d_rpc('bind:tpl', 'platform_api.cms_define_template', 'designer2', jsonb_build_object('templateKey', 'p240-no-authority',
  'compatibleTypeIds', '[]'::jsonb, 'slots', '[]'::jsonb, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null, 'idempotencyKey', 'p240-bind-tpl-0001'));
select is(pg_temp.s09d_outcome('bind:tpl'), 'FORBIDDEN', 'the capability the type binds still grants its designer nothing: the template command is refused (403) [P2-S09-AC-051]');
select is((select string_agg(n.nspname || '.' || p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prokind = 'f' and n.nspname in ('platform_private', 'platform_api', 'identity_private', 'identity', 'public_api')
        and pg_get_functiondef(p.oid) ~ 'cms_content_type_capability_bindings'),
  'platform_private.cms_activation_references_valid,platform_private.cms_activation_review_invalidation_trigger,platform_private.cms_active_parent_guard,platform_private.cms_candidate_definition_request,platform_private.cms_create_schema_successor,platform_private.cms_create_type_draft,platform_private.cms_get_content_type_version,platform_private.cms_list_content_types,platform_private.cms_lock_activation_graph,platform_private.cms_type_version_resource',
  'exactly ten functions read or write the binding table and none is an authority resolver, so no code path turns a binding into an allow [P2-S09-AC-051]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prokind = 'f' and n.nspname in ('platform_private', 'platform_api', 'identity_private', 'identity')
      and p.proname in ('cms_require_capability', 'cms_capability_allowed', 'cms_actor_capabilities', 'cms_capability_grant_read_current')
      and pg_get_functiondef(p.oid) ~ 'cms_content_type_capability_bindings'), 0,
  'the capability authority functions never read the binding table [P2-S09-AC-051]');

-- ======================================== AC052 no parent path, no If-Match, key uniqueness ====
select is(pg_temp.p_run('np:' || k, pg_temp.p_base(pg_temp.p_key('np' || k), jsonb_build_object(k, '1')), 'INVALID_REQUEST'), 'ok',
  'CMS-03A-01 has no ' || k || ' input: a new type takes no parent and no create precondition [P2-S09-AC-052]')
from unnest(array['ifMatch', 'expectedVersion', 'contentTypeId', 'parentId', 'versionId']) k;
select is((select v.version || '/' || v.version_no || '/' || t.version from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id
    where t.type_key = 'p240_agg_ok'), '1/1/1', 'a created type starts at CAS version 1 and version number 1 with no parent version [P2-S09-AC-052]');
select ok(exists (select 1 from pg_constraint c where c.conrelid = 'platform_private.cms_content_types'::regclass and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (type_key)'), 'the type key is unique at the storage level, the lock-then-check below is the typed path to it [P2-S09-AC-052]');
select is(pg_temp.p_run('np:dup', pg_temp.p_full('p240_agg_ok'), 'CONFLICT'), 'ok', 'a second create of an existing key is the typed 409 and commits nothing [P2-S09-AC-052]');

-- ================================== AC053 deferred composite foreign key, one transaction ====
select ok((select c.condeferrable and c.condeferred and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (schema_artifact_id, id) REFERENCES platform_private.cms_schema_artifacts(id, content_type_version_id)%'
    from pg_constraint c where c.conrelid = 'platform_private.cms_content_type_versions'::regclass and c.contype = 'f' and c.confrelid = 'platform_private.cms_schema_artifacts'::regclass),
  'the version-to-artifact composite foreign key is DEFERRABLE INITIALLY DEFERRED over (schema_artifact_id, id) [P2-S09-AC-053]');
create or replace function pg_temp.p_mismatch() returns text language plpgsql as $body$
declare other_artifact uuid; target_version uuid; result text;
begin
  select a.id into other_artifact from platform_private.cms_schema_artifacts a
    join platform_private.cms_content_type_versions v on v.id = a.content_type_version_id join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_bind_auth';
  select v.id into target_version from platform_private.cms_content_type_versions v join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_agg_ok';
  begin
    set constraints all immediate;
    alter table platform_private.cms_content_type_versions disable trigger user;
    update platform_private.cms_content_type_versions set schema_artifact_id = other_artifact where id = target_version;
    result := 'ACCEPTED';
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return sqlstate;
  end;
end;
$body$;
select is(pg_temp.p_mismatch(), '23503', 'pointing a version at another version''s artifact is rejected by the composite foreign key (23503) [P2-S09-AC-053]');
select ok((select count(*) = 0 from platform_private.cms_content_type_versions v left join platform_private.cms_schema_artifacts a
      on a.id = v.schema_artifact_id and a.content_type_version_id = v.id where a.id is null),
  'every committed version in this run is paired with its matching artifact [P2-S09-AC-053]');
select is(pg_temp.p_children('p240_agg_ok'), '1|1|3|1|2|1', 'type, version and artifact were committed by the one create call (the aggregate above) [P2-S09-AC-053]');

-- =========================== AC183 / AC193: atomic audit and outbox, declared failure tokens ====
create function public.p240_fail() returns trigger language plpgsql as $body$
begin
  if tg_table_name = current_setting('p240.fail_table', true) then
    raise exception 'P240_FORCED_FAILURE' using errcode = coalesce(nullif(current_setting('p240.fail_state', true), ''), 'P0001');
  end if;
  return new;
end;
$body$;
create trigger p240_fail_outbox before insert on platform_private.outbox_events for each row execute function public.p240_fail();
create trigger p240_fail_audit before insert on audit_private.audit_events for each row execute function public.p240_fail();
create or replace function pg_temp.p_forced(p_table text, p_key text, p_state text default '') returns text language plpgsql as $body$
declare before_rows text := pg_temp.p_rows(); outcome text; req jsonb := pg_temp.p_full(p_key, jsonb_build_object('idempotencyKey', 'p240-forced-' || p_table || '-' || p_state || '0001'));
begin
  perform set_config('p240.fail_table', p_table, true);
  perform set_config('p240.fail_state', p_state, true);
  perform pg_temp.s09d_rpc('forced:' || p_table || p_state, 'platform_api.cms_create_type_draft', 'owner', req);
  outcome := pg_temp.s09d_outcome('forced:' || p_table || p_state);
  perform set_config('p240.fail_table', '', true);
  perform set_config('p240.fail_state', '', true);
  return outcome || ' ' || (before_rows = pg_temp.p_rows())::text || ' ' || pg_temp.p_children(p_key);
end;
$body$;
select is(pg_temp.p_forced('outbox_events', 'p240_fo'), 'P240_FORCED_FAILURE true 0|0|0|0|0|0',
  'a failed outbox write rolls back the whole aggregate: no type, version, field, relation, binding, artifact, audit row or idempotency record remains [P2-S09-AC-183]');
select is(pg_temp.p_forced('audit_events', 'p240_fa'), 'P240_FORCED_FAILURE true 0|0|0|0|0|0',
  'a failed audit write rolls back the whole aggregate [P2-S09-AC-183]');
-- AC193 (the 503 row): an infrastructure-class database failure inside the create (SQLSTATE class 53
-- insufficient resources, class 08 connection exception: the classes PostgREST answers with 5xx and the
-- Worker maps to 503 RPC unavailable) is never swallowed into a contract token or a false success, and the
-- whole aggregate rolls back.  The failure is injected at the outbox and audit writes, after every child
-- row of the create was written.
select is(pg_temp.p_forced('outbox_events', 'p240_f53', '53300'), 'P240_FORCED_FAILURE true 0|0|0|0|0|0',
  'a class 53 (insufficient resources) failure at the outbox write rolls the whole create back and surfaces unmapped [P2-S09-AC-193]');
select is((select state from s09d_probe where label = 'forced:outbox_events53300'), '53300',
  'the SQLSTATE of the class 53 failure reaches the caller unchanged (not rewritten to a validation or conflict token) [P2-S09-AC-193]');
select is(pg_temp.p_forced('audit_events', 'p240_f08', '08006'), 'P240_FORCED_FAILURE true 0|0|0|0|0|0',
  'a class 08 (connection failure) at the audit write rolls the whole create back and surfaces unmapped [P2-S09-AC-193]');
select is((select state from s09d_probe where label = 'forced:audit_events08006'), '08006',
  'the SQLSTATE of the class 08 failure reaches the caller unchanged [P2-S09-AC-193]');
select pg_temp.s09d_rpc('forced:retry', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_full('p240_fo', '{"idempotencyKey":"p240-forced-outbox_events-0001"}'));
select is(pg_temp.s09d_outcome('forced:retry'), 'OK', 'after the forced failure the same key and request commits (the failed attempt reserved nothing) [P2-S09-AC-183]');
select ok((select count(*) = 1 from audit_private.audit_events a where a.target_id = (pg_temp.s09d_resp('forced:retry')->>'id')::uuid and a.action = 'cms.schema.draft.create' and a.decision = 'allowed')
    and (select count(*) = 1 from platform_private.outbox_events o where o.event_type = 'cms.schema.draft.created.v1' and o.aggregate_id = (pg_temp.s09d_resp('forced:retry')->>'id')::uuid),
  'the committed create wrote exactly one audit row and one cms.schema.draft.created.v1 outbox row with the aggregate [P2-S09-AC-183]');
select is((select count(*)::integer from platform_private.idempotency_records r where r.state = 'completed' and r.operation = 'CMS-03A-01' and r.response_ref->>'resourceRef' = (pg_temp.s09d_resp('forced:retry')->>'id')), 1,
  'idempotency completion is recorded in the same transaction as the aggregate [P2-S09-AC-183]');
drop trigger p240_fail_outbox on platform_private.outbox_events;
drop trigger p240_fail_audit on audit_private.audit_events;

select is(pg_temp.p_run('f:val', pg_temp.p_base(pg_temp.p_key('fval'), '{"label":"x"}'), 'VALIDATION_FAILED'), 'ok', 'a validation failure is 422 VALIDATION_FAILED with no partial aggregate [P2-S09-AC-193]');
select is(pg_temp.p_run('f:unk', pg_temp.p_base(pg_temp.p_key('funk'), '{"extra":true}'), 'INVALID_REQUEST'), 'ok', 'an unknown request key is 400 INVALID_REQUEST with no partial aggregate [P2-S09-AC-193]');
select is(pg_temp.p_run('f:key', pg_temp.p_base('p240_agg_ok'), 'CONFLICT'), 'ok', 'a type-key collision is 409 CONFLICT with no partial aggregate [P2-S09-AC-193]');
select pg_temp.s09d_rpc('f:forbid', 'platform_api.cms_create_type_draft', 'rev1', pg_temp.p_base(pg_temp.p_key('fforbid')));
select is(pg_temp.s09d_outcome('f:forbid'), 'FORBIDDEN', 'an authenticated human without cms.schema_designer is refused 403 FORBIDDEN [P2-S09-AC-193]');
select is(pg_temp.p_children(pg_temp.p_key('fforbid')), '0|0|0|0|0|0', 'the forbidden create committed nothing [P2-S09-AC-193]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), set_config('request.jwt.claim.sub', '', true);
select pg_temp.s09d_call('f:anon', 'platform_api.cms_create_type_draft', pg_temp.p_base(pg_temp.p_key('fanon')));
select is(pg_temp.s09d_outcome('f:anon'), 'UNAUTHENTICATED', 'a call with no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-193]');
select is(pg_temp.p_children(pg_temp.p_key('fanon')), '0|0|0|0|0|0', 'the unauthenticated create committed nothing [P2-S09-AC-193]');
-- AC034 (CMS-03A-01, BE03a row 160): a human who belongs to the target registry scope but holds no
-- schema_designer capability is refused 403 FORBIDDEN, while a human naming a scope he is not a member
-- of (a foreign organization, or none at all) is refused 404 NOT_FOUND with one byte-identical body:
-- the refusal never discloses whether the named scope exists.  Nothing is committed in either case.
select pg_temp.s09d_grant_specialist('designer2', 'cms.schema_registry.read');
select pg_temp.s09d_revoke_via_rpc('designer2', 'cms.schema_designer');
select pg_temp.s09d_rpc('f:member', 'platform_api.cms_create_type_draft', 'designer2', pg_temp.p_base(pg_temp.p_key('fmember')));
select is(pg_temp.s09d_outcome('f:member'), 'FORBIDDEN',
  'a member of the owner organization with only registry read, no schema_designer, is 403 FORBIDDEN on CMS-03A-01 [P2-S09-AC-034] [P2-S09-AC-193]');
select pg_temp.s09d_rpc('f:scope', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base(pg_temp.p_key('fscope')), false,
  jsonb_build_object('actingPartyId', pg_temp.s09d_id('otherOrg')));
select pg_temp.s09d_rpc('f:scope:foreign', 'platform_api.cms_create_type_draft', 'other', pg_temp.p_base(pg_temp.p_key('fscopeforeign')), false,
  jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')));
select pg_temp.s09d_rpc('f:scope:absent', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base(pg_temp.p_key('fscopeabsent')), false,
  jsonb_build_object('actingPartyId', extensions.gen_random_uuid()));
select is(pg_temp.s09d_outcome('f:scope'), 'NOT_FOUND',
  'a designer naming another organization as the target scope is refused 404 NOT_FOUND and nothing is created [P2-S09-AC-034] [P2-S09-AC-193]');
select is(pg_temp.s09d_outcome('f:scope:foreign'), 'NOT_FOUND',
  'a designer of another organization naming the owner organization as the target scope is refused 404 NOT_FOUND [P2-S09-AC-034]');
select is(pg_temp.s09d_outcome('f:scope:absent'), 'NOT_FOUND',
  'a designer naming a scope that does not exist is refused with the same 404 NOT_FOUND [P2-S09-AC-034]');
select ok(pg_temp.s09d_resp('f:scope') is not distinct from pg_temp.s09d_resp('f:scope:absent')
    and pg_temp.s09d_detail('f:scope') is not distinct from pg_temp.s09d_detail('f:scope:absent')
    and pg_temp.s09d_resp('f:scope:foreign') is not distinct from pg_temp.s09d_resp('f:scope:absent')
    and pg_temp.s09d_detail('f:scope:foreign') is not distinct from pg_temp.s09d_detail('f:scope:absent'),
  'the 404 refusal is byte-identical for a real foreign scope and an absent one: scope existence is not disclosed [P2-S09-AC-034]');
select ok(to_regprocedure('platform_private.cms_require_scope_member(uuid,uuid)') is not null
    and not has_function_privilege('service_role', 'platform_private.cms_require_scope_member(uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'platform_private.cms_require_scope_member(uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'platform_private.cms_require_scope_member(uuid,uuid)', 'execute'),
  'the scope-concealment gate is private: no client or service role can execute it directly [P2-S09-AC-034]');
select is(pg_temp.p_children(pg_temp.p_key('fscope')) || pg_temp.p_children(pg_temp.p_key('fscopeforeign')) || pg_temp.p_children(pg_temp.p_key('fscopeabsent')),
  '0|0|0|0|0|00|0|0|0|0|00|0|0|0|0|0', 'the out-of-scope creates committed nothing [P2-S09-AC-193]');
select pg_temp.s09d_rpc('f:idem1', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base(pg_temp.p_key('fidem1'), '{"idempotencyKey":"p240-idem-fail-0001"}'));
select pg_temp.s09d_rpc('f:idem2', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base(pg_temp.p_key('fidem2'), '{"idempotencyKey":"p240-idem-fail-0001"}'));
select is(pg_temp.s09d_outcome('f:idem2'), 'IDEMPOTENCY_MISMATCH', 'a reused key with a different request is a typed idempotency conflict, not a second aggregate [P2-S09-AC-193]');
select is(pg_temp.p_children(pg_temp.p_key('fidem2')), '0|0|0|0|0|0', 'the mismatched key created no aggregate [P2-S09-AC-193]');
select is(pg_temp.p_run('f:short', pg_temp.p_base(pg_temp.p_key('fshort'), '{"idempotencyKey":"short"}'), 'INVALID_REQUEST'), 'ok', 'an idempotency key shorter than 8 characters is 400 INVALID_REQUEST [P2-S09-AC-193]');
select is(pg_temp.p_run('f:loc', pg_temp.p_base(pg_temp.p_key('floc'), '{"supportedLocales":["en-US"],"fallbackChains":{"fr-FR":["en-US"]}}'), 'VALIDATION_FAILED'), 'ok',
  'an OD-4 locale configuration refusal is 422 with no partial aggregate [P2-S09-AC-193]');
select is(pg_temp.p_run('f:wf', pg_temp.p_base(pg_temp.p_key('fwf'), '{"workflowKey":"caller.invented"}'), 'VALIDATION_FAILED'), 'ok',
  'a DEC-109 workflow registry refusal is 422 with no partial aggregate [P2-S09-AC-193]');

select * from finish();
rollback;
