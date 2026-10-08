-- Slice 10 evidence lane EC, remediation R1b (P2-S10-AC-079): a schema review binds the same
-- bytes as the SchemaArtifact and the definition hash, and those bytes carry the DEC-133 object
-- structure.  Real Slice 09 chain (CMS-03A-01 create, -10 dry run, worker seal, -11 submit) over a
-- type that has an object field; nothing is faked.  New file; mutates nothing outside its own
-- rolled-back transaction.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create temp table ecr_request on commit drop as
select jsonb_build_object(
  'typeKey', 'ecr1breview', 'label', 'EC R1b review binding',
  'ownerCapability', 'cms.schema_designer', 'sourceLocale', 'en-US',
  'defaultLocale', 'en-US', 'supportedLocales', '["en-US"]'::jsonb, 'fallbackChains', '{}'::jsonb,
  'workflowKey', 'editorial', 'workflowVersion', '1', 'defaultTemplateVersionId', null,
  'fields', jsonb_build_array(
    jsonb_build_object('stableFieldId', 'a9100000-0000-4000-8000-000000000f01', 'key', 'title',
      'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', true, 'validatorKey', null,
      'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Title', 'order', 0), 'lifecycle', 'active'),
    jsonb_build_object('stableFieldId', 'a9100000-0000-4000-8000-000000000f02', 'key', 'meta',
      'kind', 'object',
      'constraints', '{"objectStructure":{"properties":[{"key":"label","kind":"scalar","required":true,"constraints":{}}]}}'::jsonb,
      'required', false, 'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none',
      'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Meta', 'order', 1), 'lifecycle', 'active')),
  'relations', '[]'::jsonb, 'templateBindings', '[]'::jsonb, 'capabilityBindings', '[]'::jsonb) as request;

create or replace function pg_temp.ecr_create(p_tag text) returns jsonb language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':create', 'platform_api.cms_create_type_draft', 'owner',
    (select request from ecr_request) || jsonb_build_object('idempotencyKey', pg_temp.s09d_idem(p_tag, 'create')));
  perform pg_temp.s09d_remember(p_tag || ':type', (resource->>'contentTypeId')::uuid);
  perform pg_temp.s09d_remember(p_tag || ':version', (resource->>'id')::uuid);
  return resource;
end;
$body$;

select pg_temp.ecr_create('a');
select is(pg_temp.s09d_outcome('a:create'), 'OK',
  'EC-079 review: a type with a DEC-133 object field is created through CMS-03A-01');
select pg_temp.s09d_dry_run('a');
select pg_temp.s09d_seal('a');
select pg_temp.s09d_submit('a');
select is(pg_temp.s09d_outcome('a:submit'), 'OK',
  'EC-079 review: CMS-03A-11 freezes the sealed dry-run of an object-structure type into a review');

select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    review.definition_hash = version.definition_hash
    and review.schema_artifact_id = version.schema_artifact_id
    and artifact.artifact_hash = version.definition_hash
    and artifact.content_type_version_id = version.id
    and review.definition_hash ~ '^[a-f0-9]{64}$')::text
  from platform_private.cms_schema_reviews review
  join platform_private.cms_content_type_versions version on version.id = review.content_type_version_id
  join platform_private.cms_schema_artifacts artifact on artifact.id = version.schema_artifact_id
  where review.id = %1$L$q$, pg_temp.s09d_id('a:review')))::boolean, false),
  'EC-079 review: the review of an object-structure type freezes the definition hash, which is the compiled artifact hash of the same version');

select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    artifact.editor_manifest::text like '%%"objectStructure"%%'
    and artifact.editor_manifest::text like '%%"label"%%')::text
  from platform_private.cms_content_type_versions version
  join platform_private.cms_schema_artifacts artifact on artifact.id = version.schema_artifact_id
  where version.id = %1$L$q$, pg_temp.s09d_id('a:version')))::boolean, false),
  'EC-079 review: the artifact the review froze carries the object structure bytes in its editor manifest');

select is(
  pg_temp.s09d_scalar(format($q$select review.definition_hash from platform_private.cms_schema_reviews review where review.id = %1$L$q$,
    pg_temp.s09d_id('a:review'))),
  pg_temp.s09d_scalar(format($q$select platform_private.cms_definition_artifact_hash(%L::jsonb, 1)$q$, (select request from ecr_request)::text)),
  'EC-079 review: the frozen review hash equals the definition hash recomputed from the request that carries the structure');

select isnt(
  pg_temp.s09d_scalar(format($q$select review.definition_hash from platform_private.cms_schema_reviews review where review.id = %1$L$q$,
    pg_temp.s09d_id('a:review'))),
  pg_temp.s09d_scalar(format($q$select platform_private.cms_definition_artifact_hash(%L::jsonb, 1)$q$,
    jsonb_set((select request from ecr_request), '{fields,1,constraints,objectStructure,properties,0,required}', 'false'::jsonb)::text)),
  'EC-079 review: the same request with one structure flag flipped hashes differently, so the review binds the structure bytes');

select * from finish();
rollback;
