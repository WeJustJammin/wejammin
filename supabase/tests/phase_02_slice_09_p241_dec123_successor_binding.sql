\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P241 (DEC-123 completion; AC003 / AC045 / AC049): a content type is
-- created WITHOUT a template and gains its first template binding only through a
-- successor version (CMS-03A-09).  The successor request carries the default
-- template and the template bindings with the OD-4 pair semantics (both null
-- clones the source, both present replaces it); every referenced template is
-- resolved through the BE03c compatibility resolver against the exact candidate
-- version, the bindings are frozen into the definition hash and the review
-- evidence, and activation carries them.  No binding, review or decision row is
-- ever inserted by hand: every one comes from a named command.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_grant_specialist('owner', 'cms.template_designer');

create or replace function pg_temp.s09t_raw_successor(p_label text, p_source_tag text, p_extra jsonb) returns jsonb
language plpgsql as $body$
begin
  return pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_schema_successor', 'owner',
    jsonb_build_object(
      'contentTypeId', pg_temp.s09d_id(p_source_tag || ':type'),
      'versionId', pg_temp.s09d_id(p_source_tag || ':version'),
      'expectedVersion', pg_temp.s09d_version(p_source_tag),
      'supportedLocales', null, 'fallbackChains', null,
      'idempotencyKey', pg_temp.s09d_idem(p_label, 'successor')) || p_extra);
end;
$body$;
create or replace function pg_temp.s09t_bindings(p_version uuid) returns text
language sql stable as $body$
  select coalesce(string_agg(binding.template_version_id::text, ',' order by binding.template_version_id), '')
    from platform_private.cms_content_type_template_bindings binding
   where binding.content_type_version_id = p_version
$body$;
create or replace function pg_temp.s09t_state() returns text
language sql stable as $body$
  select (select count(*) from platform_private.cms_content_type_template_bindings)::text || '|'
      || (select count(*) from platform_private.cms_content_type_versions)::text || '|'
      || pg_temp.s09d_fingerprint()
$body$;

-- ---------------------------------------------------------------- fixtures ----
select pg_temp.s09d_create_type('a', 'p241src');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_create_type('x', 'p241other');
select pg_temp.s09d_to_active('x');
select pg_temp.s09d_template('t1', 'p241-template-one', 'a');
select pg_temp.s09d_template('t2', 'p241-template-two', 'a');
select pg_temp.s09d_template('ti', 'p241-template-other', 'x');
select pg_temp.s09d_template('tw', 'p241-template-withdrawn', 'a');
select pg_temp.s09d_timewarp('cms_template_versions', format($q$update platform_private.cms_template_versions
   set state = 'retired' where id = %L$q$, pg_temp.s09d_id('tw:templateVersion')));
select ok(pg_temp.s09d_outcome('t1:template') = 'OK' and pg_temp.s09d_outcome('t2:template') = 'OK'
    and pg_temp.s09d_outcome('ti:template') = 'OK' and pg_temp.s09d_outcome('tw:template') = 'OK',
  'fixture: the templates are real CMS-03C-01 definitions that declare compatibility with their type ids [P2-S09-AC-003]');
select is((select default_template_version_id::text from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')), null,
  'the type was created without a default template [P2-S09-AC-045]');
select is(pg_temp.s09t_bindings(pg_temp.s09d_id('a:version')), '',
  'the type was created without a template binding [P2-S09-AC-049]');
create temp table s09t_baseline on commit drop as select pg_temp.s09t_state() as state;

-- ------------------------------------------------ refusals commit nothing ----
select pg_temp.s09t_raw_successor('r:default-only', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion')));
select is(pg_temp.s09d_outcome('r:default-only'), 'VALIDATION_FAILED',
  'a default template without bindings breaks the both-null-or-both-present pair (422) [P2-S09-AC-045]');
select pg_temp.s09t_raw_successor('r:bindings-only', 'a',
  jsonb_build_object('templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')))));
select is(pg_temp.s09d_outcome('r:bindings-only'), 'VALIDATION_FAILED',
  'bindings without a default template break the pair (422) [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:malformed', 'a',
  jsonb_build_object('defaultTemplateVersionId', 'nope', 'templateBindings', '[]'::jsonb));
select is(pg_temp.s09d_outcome('r:malformed'), 'VALIDATION_FAILED', 'a malformed default template id is refused (422) [P2-S09-AC-045]');
select pg_temp.s09t_raw_successor('r:shape', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion'), 'position', 3))));
select is(pg_temp.s09d_outcome('r:shape'), 'VALIDATION_FAILED', 'a binding with an unknown member is refused (422) [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:duplicate', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')),
      jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')))));
select ok(pg_temp.s09d_outcome('r:duplicate') = 'VALIDATION_FAILED'
    and (pg_temp.s09d_detail('r:duplicate')::jsonb)->'violations'->0->>'path' = '/templateBindings/1/templateVersionId',
  'the same template listed twice is refused (422) naming the second occurrence [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:uppercase', 'a',
  jsonb_build_object('defaultTemplateVersionId', upper(pg_temp.s09d_id('t1:templateVersion')::text), 'templateBindings', '[]'::jsonb));
select is(pg_temp.s09d_outcome('r:uppercase'), 'VALIDATION_FAILED',
  'a non-canonical (upper-case) template version id is refused (422) like every other identifier [P2-S09-AC-045]');
select pg_temp.s09t_raw_successor('r:many', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', (select jsonb_agg(jsonb_build_object('templateVersionId', extensions.gen_random_uuid())) from generate_series(1, 33))));
select is(pg_temp.s09d_outcome('r:many'), 'VALIDATION_FAILED', 'more than 32 bindings are refused (422) before any template is read [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:incompatible-default', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('ti:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')))));
select ok(pg_temp.s09d_outcome('r:incompatible-default') = 'VALIDATION_FAILED'
    and (pg_temp.s09d_detail('r:incompatible-default')::jsonb)->'violations'->0->>'path' = '/defaultTemplateVersionId',
  'a default template whose compatible types exclude the type is the resolver INCOMPATIBLE mapped to 422 naming /defaultTemplateVersionId [P2-S09-AC-045]');
select pg_temp.s09t_raw_successor('r:incompatible-binding', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')),
      jsonb_build_object('templateVersionId', pg_temp.s09d_id('ti:templateVersion')))));
select ok(pg_temp.s09d_outcome('r:incompatible-binding') = 'VALIDATION_FAILED'
    and (pg_temp.s09d_detail('r:incompatible-binding')::jsonb)->'violations'->0->>'path' = '/templateBindings/1/templateVersionId',
  'an incompatible binding is 422 naming its own position /templateBindings/1/templateVersionId [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:absent', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', extensions.gen_random_uuid()))));
select is(pg_temp.s09d_outcome('r:absent'), 'NOT_FOUND',
  'an absent or concealed template is the resolver NOT_FOUND, concealed as 404 [P2-S09-AC-049]');
select pg_temp.s09t_raw_successor('r:withdrawn', 'a',
  jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
    'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('tw:templateVersion')))));
select is(pg_temp.s09d_outcome('r:withdrawn'), 'CONFLICT',
  'a withdrawn template is the resolver WITHDRAWN mapped to 409 CONFLICT [P2-S09-AC-049]');
select is(pg_temp.s09t_state(), (select state from s09t_baseline),
  'every refusal committed nothing: no version, no binding, no idempotency, audit or outbox row [P2-S09-AC-003]');

-- ----------------------------------- the first successor binds the template ----
select pg_temp.s09d_successor('b', 'a', 'owner', 'p241-successor-bind-0001', null, null,
  pg_temp.s09d_id('t1:templateVersion'),
  jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')),
    jsonb_build_object('templateVersionId', pg_temp.s09d_id('t2:templateVersion'))));
select is(pg_temp.s09d_outcome('b:successor'), 'OK',
  'a successor with both template members present replaces the source template configuration [P2-S09-AC-003]');
select ok(pg_temp.s09d_resp('b:successor')->>'defaultTemplateVersionId' = pg_temp.s09d_id('t1:templateVersion')::text
    and (select default_template_version_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version')) = pg_temp.s09d_id('t1:templateVersion'),
  'the successor draft holds the requested default template and the resource reports it [P2-S09-AC-045]');
select is(pg_temp.s09t_bindings(pg_temp.s09d_id('b:version')),
  (select string_agg(id::text, ',' order by id) from (values (pg_temp.s09d_id('t1:templateVersion')), (pg_temp.s09d_id('t2:templateVersion'))) v(id)),
  'the successor draft holds exactly the two requested template bindings [P2-S09-AC-049]');
select ok(pg_temp.s09t_bindings(pg_temp.s09d_id('a:version')) = ''
    and (select default_template_version_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')) is null,
  'the immutable source still has no default template and no binding [P2-S09-AC-003]');
select ok(pg_temp.s09d_rpc('b:replay', 'platform_api.cms_create_schema_successor', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
      'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', null, 'fallbackChains', null,
      'defaultTemplateVersionId', pg_temp.s09d_id('t1:templateVersion'),
      'templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t1:templateVersion')),
        jsonb_build_object('templateVersionId', pg_temp.s09d_id('t2:templateVersion'))),
      'idempotencyKey', 'p241-successor-bind-0001')) = pg_temp.s09d_resp('b:successor'),
  'a same-key replay returns the original successor and binds nothing twice [P2-S09-AC-003]');
select is((select count(*)::integer from platform_private.cms_content_type_template_bindings where content_type_version_id = pg_temp.s09d_id('b:version')), 2,
  'the replay left the two bindings unchanged');

-- ------------------------------------- bindings are frozen into the evidence ----
select is(pg_temp.s09d_scalar(format($q$select platform_private.cms_definition_artifact_hash(
    platform_private.cms_candidate_definition_request(%1$L), 2) = definition_hash
  from platform_private.cms_content_type_versions where id = %1$L$q$, pg_temp.s09d_id('b:version'))), 'true',
  'the successor definition hash is the deterministic hash of the definition including the default template and the bindings [P2-S09-AC-003]');
select is(pg_temp.s09d_scalar(format($q$select platform_private.cms_definition_artifact_hash(
    platform_private.cms_candidate_definition_request(%1$L)
      || jsonb_build_object('defaultTemplateVersionId', null, 'templateBindings', '[]'::jsonb), 2) <> definition_hash
  from platform_private.cms_content_type_versions where id = %1$L$q$, pg_temp.s09d_id('b:version'))), 'true',
  'dropping the bindings from the definition changes the hash: the bindings are frozen into it [P2-S09-AC-049]');
select is((select jsonb_array_length(artifact.renderer_manifest->'templateBindings')
    from platform_private.cms_schema_artifacts artifact where artifact.content_type_version_id = pg_temp.s09d_id('b:version')), 2,
  'the compiled artifact manifests the two template bindings [P2-S09-AC-049]');
select is((select artifact.editor_manifest->'schema'->>'defaultTemplateVersionId'
    from platform_private.cms_schema_artifacts artifact where artifact.content_type_version_id = pg_temp.s09d_id('b:version')),
  pg_temp.s09d_id('t1:templateVersion')::text,
  'the compiled artifact manifests the default template [P2-S09-AC-045]');

-- ----------------------------- dry run -> review -> decision -> activation ----
select pg_temp.s09d_to_approved('b');
select ok(pg_temp.s09d_outcome('b:dryRun') is not null and pg_temp.s09d_outcome('b:submit') = 'OK',
  'the candidate with bindings passes the real dry run and review submission [P2-S09-AC-003]');
select is((select review.definition_hash::text = version.definition_hash::text
    from platform_private.cms_schema_reviews review
    join platform_private.cms_content_type_versions version on version.id = review.content_type_version_id
   where review.id = pg_temp.s09d_id('b:review')), true,
  'the review freezes the definition hash that includes the bindings [P2-S09-AC-049]');
select is((select state from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version')), 'approved',
  'the review decision approved the candidate [P2-S09-AC-003]');
select pg_temp.s09d_activate('b');
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'activation succeeds for the candidate that carries the bindings [P2-S09-AC-003]');
select ok((select state from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version')) = 'active'
    and (select default_template_version_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('b:version')) = pg_temp.s09d_id('t1:templateVersion')
    and pg_temp.s09t_bindings(pg_temp.s09d_id('b:version')) =
      (select string_agg(id::text, ',' order by id) from (values (pg_temp.s09d_id('t1:templateVersion')), (pg_temp.s09d_id('t2:templateVersion'))) v(id)),
  'the active version carries the default template and both template bindings [P2-S09-AC-003] [P2-S09-AC-045] [P2-S09-AC-049]');
select is((select state from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')), 'superseded',
  'the source version is superseded by the activation');

-- --------------------------------- both null clones the bound configuration ----
select pg_temp.s09d_successor('d', 'b');
select is(pg_temp.s09d_outcome('d:successor'), 'OK', 'a clone successor of the bound version is created [P2-S09-AC-003]');
select ok((select default_template_version_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('d:version')) = pg_temp.s09d_id('t1:templateVersion')
    and pg_temp.s09t_bindings(pg_temp.s09d_id('d:version')) = pg_temp.s09t_bindings(pg_temp.s09d_id('b:version')),
  'both template members null clones the source default template and bindings unchanged [P2-S09-AC-003]');

-- ------------------------------ both present with an empty binding list ----
select pg_temp.s09d_create_type('e', 'p241empty');
select pg_temp.s09d_to_active('e');
select pg_temp.s09d_template('te', 'p241-template-empty', 'e');
select pg_temp.s09d_successor('f', 'e', 'owner', null, null, null, pg_temp.s09d_id('te:templateVersion'), '[]'::jsonb);
select ok(pg_temp.s09d_outcome('f:successor') = 'OK'
    and (select default_template_version_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('f:version')) = pg_temp.s09d_id('te:templateVersion')
    and pg_temp.s09t_bindings(pg_temp.s09d_id('f:version')) = '',
  'a default template with an empty binding list is a valid replacement [P2-S09-AC-045]');

-- --------------------- AC169: the producer-made binding rows (named compatibility RPC) ----
-- The bindings of the activated successor 'b' were written by CMS-03A-09 only after the BE03c
-- compatibility RPC resolved every template against the exact candidate; here the persisted rows are
-- read back, re-resolved through that same named RPC, and held to the table contract.
create or replace function pg_temp.s09t_err(p_sql text) returns text language plpgsql as $body$
begin
  execute p_sql;
  return 'ACCEPTED';
exception when others then
  return sqlerrm;
end;
$body$;
create or replace function pg_temp.s09t_resolve(p_label text, p_template uuid, p_type uuid, p_version uuid) returns jsonb
language plpgsql as $body$
begin
  perform pg_temp.s09d_session('owner');
  return pg_temp.s09d_call(p_label, 'platform_api.cms_resolve_template_compatibility', jsonb_build_object(
    'templateVersionId', p_template, 'contentTypeId', p_type, 'contentTypeVersionId', p_version,
    'context', pg_temp.s09d_context('owner')));
end;
$body$;
select ok((select count(*) = 2
      and bool_and(binding.owner_id = pg_temp.s09d_id('ownerOrg') and binding.content_type_version_id = pg_temp.s09d_id('b:version') and binding.version = 1)
      and (array_agg(binding.template_version_id order by binding.position))
        = array[pg_temp.s09d_id('t1:templateVersion'), pg_temp.s09d_id('t2:templateVersion')]
      and (array_agg(binding.position order by binding.position)) = array[0, 1]
    from platform_private.cms_content_type_template_bindings binding where binding.content_type_version_id = pg_temp.s09d_id('b:version')),
  'the producer persisted each binding with its owner, parent version, template UUID and request-order position [P2-S09-AC-169]');
select pg_temp.s09t_resolve('b:r1', pg_temp.s09d_id('t1:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select pg_temp.s09t_resolve('b:r2', pg_temp.s09d_id('t2:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select pg_temp.s09t_resolve('b:ri', pg_temp.s09d_id('ti:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select ok(pg_temp.s09d_outcome('b:r1') = 'OK' and pg_temp.s09d_resp('b:r1')->>'compatible' = 'true'
    and pg_temp.s09d_outcome('b:r2') = 'OK' and pg_temp.s09d_resp('b:r2')->>'compatible' = 'true',
  'both persisted bindings resolve as compatible for their exact parent version through the named compatibility RPC [P2-S09-AC-169]');
select isnt(pg_temp.s09d_outcome('b:ri'), 'OK',
  'a template that excludes the type, which no binding row names, is refused by the same named RPC [P2-S09-AC-169]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.s09t_err(format($q$update platform_private.cms_content_type_template_bindings set position = 5, version = version + 1
    where content_type_version_id = %L$q$, pg_temp.s09d_id('b:version'))), 'IMMUTABLE_RECORD',
  'UPDATE of a producer-made binding of the activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]');
select is(pg_temp.s09t_err(format($q$delete from platform_private.cms_content_type_template_bindings where content_type_version_id = %L$q$, pg_temp.s09d_id('b:version'))), 'IMMUTABLE_RECORD',
  'DELETE of a producer-made binding of the activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]');
-- NEGATIVE CONTROL: direct write against a producer-made binding (CMS-03A-09) of an activated or draft successor is refused; no binding is claimed.
select is(pg_temp.s09t_err(format($q$insert into platform_private.cms_content_type_template_bindings(owner_id, content_type_version_id, template_version_id, position)
    values (%L, %L, %L, 2)$q$, pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('b:version'), pg_temp.s09d_id('tw:templateVersion'))), 'IMMUTABLE_RECORD',
  'INSERT of a further binding into the activated version raises IMMUTABLE_RECORD [P2-S09-AC-169]');
-- NEGATIVE CONTROL: direct write against a producer-made binding (CMS-03A-09) of an activated or draft successor is refused; no binding is claimed.
select is(pg_temp.s09t_err(format($q$insert into platform_private.cms_content_type_template_bindings(owner_id, content_type_version_id, template_version_id, position)
    values (%L, %L, %L, 2)$q$, pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('d:version'), pg_temp.s09d_id('t1:templateVersion'))),
  'duplicate key value violates unique constraint "cms_content_type_template_bindings_unique"',
  'a second binding of one template to the draft successor d is rejected by the unique parent/template pair [P2-S09-AC-169]');
-- NEGATIVE CONTROL: direct write against a producer-made binding (CMS-03A-09) of an activated or draft successor is refused; no binding is claimed.
select is(pg_temp.s09t_err(format($q$insert into platform_private.cms_content_type_template_bindings(owner_id, content_type_version_id, template_version_id, position)
    values (%L, %L, %L, 2)$q$, pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('d:version'), pg_temp.s09d_id('ti:templateVersion'))),
  'VALIDATION_FAILED', 'a direct binding of an incompatible template to the draft is refused by the compatibility guard [P2-S09-AC-169]');
select set_config('app.cms_rpc', '', true);
select is((select count(*)::integer from platform_private.cms_content_type_template_bindings where content_type_version_id = pg_temp.s09d_id('b:version')), 2,
  'after every refused write the activated version still has exactly its two producer-made bindings [P2-S09-AC-169]');

select * from finish();
rollback;
