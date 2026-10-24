-- DEC-201 regression: retaining a compatible superseded template is not publish.
-- Author UNRUN. Root may run candidate445/446/bad447 under a forced outer rollback.
-- The NEW template-bound revision below is an explicitly authorized STORAGE SEAM,
-- not a public binding producer, ordinary append, audit or workflow proof.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select ok(to_regprocedure(signature) is not null, 'TG-CONTRACT: exact private ' || signature)
from (values
  ('platform_private.cms_restore_composition_heads(uuid)'),
  ('platform_private.cms_restore_composition_refs(platform_private.cms_composition_instances)'),
  ('platform_private.cms_restore_composition_plan(uuid)'),
  ('platform_private.cms_restore_composition_registry(platform_private.cms_composition_instances,uuid,uuid[],uuid[])'),
  ('platform_private.cms_restore_composition_copy(uuid,uuid,timestamptz,platform_private.cms_composition_instances[],uuid[],uuid[])')
) expected(signature);

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.template_designer'), 'OK',
  'TG-SETUP: real owner designer grant');
select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.author'), 'OK',
  'TG-SETUP: real owner author grant');
select pg_temp.s09d_create_type('tg-type', 's12tgtype');
select pg_temp.s09d_to_active('tg-type');
select is(pg_temp.s09d_outcome('tg-type:activate'), 'OK',
  'TG-SETUP: real compiled/reviewed/activated ordinary type');
insert into s12gov_ids values ('typeA', pg_temp.s09d_id('tg-type:type')::text);
select is(pg_temp.s12ga_grant('rev1', 'cms.reviewer'), 'OK',
  'TG-SETUP: independent reviewer receives a real standing grant');
-- Existing governed-test actor selection, not a new identity or forged grant.
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';

create temp table s12tg_world(tag text primary key, entry_id uuid, source_id uuid,
  destination_id uuid, source_image jsonb) on commit drop;
create temp table s12tg_calls(label text primary key, call_role text, state text,
  message text, response jsonb, before_image jsonb, after_image jsonb) on commit drop;

create function pg_temp.s12tg_image() returns jsonb language plpgsql as $body$
declare store record; rows_image jsonb; answer jsonb := '{}'::jsonb;
begin
  for store in select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and (
      (n.nspname = 'platform_private' and (c.relname like 'cms\_%' escape '\'
        or c.relname in ('idempotency_records', 'outbox_events')))
      or (n.nspname = 'audit_private' and c.relname = 'audit_events'))
    order by n.nspname, c.relname loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from %I.%I r',
      store.nspname, store.relname) into rows_image;
    answer := answer || jsonb_build_object(store.nspname || '.' || store.relname,
      platform_private.cms_jcs_sha256(rows_image));
  end loop;
  return answer;
end;
$body$;
create function pg_temp.s12tg_source(p_id uuid) returns jsonb language sql stable as $body$
  select jsonb_build_object('revision', (select to_jsonb(r)
    from platform_private.cms_entry_revisions r where r.id = p_id),
    'fields', (select coalesce(jsonb_agg(to_jsonb(v) order by v.id), '[]'::jsonb)
    from platform_private.cms_entry_field_values v where v.revision_id = p_id))
$body$;

create function pg_temp.s12tg_call(p_label text, p_function text, p_request jsonb)
returns jsonb language plpgsql security invoker as $body$
declare prior_role text := current_setting('role'); invoked text;
  answer jsonb; code text := '00000'; msg text; before_rows jsonb; request jsonb;
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  request := p_request || jsonb_build_object('context', pg_temp.s09d_context('owner', true));
  before_rows := pg_temp.s12tg_image();
  begin
    set local role service_role;
    invoked := current_user;
    begin
      execute format('select platform_api.%I($1)', p_function) into answer
        using request;
    exception when others then
      get stacked diagnostics code = returned_sqlstate, msg = message_text;
    end;
    perform set_config('role', prior_role, true);
  exception when others then
    perform set_config('role', prior_role, true);
    raise;
  end;
  insert into s12tg_calls values (p_label, invoked, code, msg, answer,
    before_rows, pg_temp.s12tg_image());
  return answer;
end;
$body$;

create function pg_temp.s12tg_create_request(p_tag text) returns jsonb
language plpgsql as $body$
declare version_row platform_private.cms_content_type_versions;
  artifact platform_private.cms_schema_artifacts; field_id uuid; answer jsonb;
  prior_rpc text := coalesce(current_setting('app.cms_rpc', true), '');
  context_request jsonb; actor uuid;
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  context_request := jsonb_build_object('context', pg_temp.s09d_context('owner', true));
  perform set_config('app.cms_rpc', 'true', true);
  actor := platform_private.cms_actor(context_request);
  perform platform_private.cms_acting_party(context_request, actor);
  select * into version_row from platform_private.cms_content_type_versions
    where id = pg_temp.s09d_id('tg-type:version');
  select * into artifact from platform_private.cms_schema_artifacts
    where id = version_row.schema_artifact_id;
  select stable_field_id into field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = version_row.id and field_key = 'title';
  answer := jsonb_build_object('contentTypeId', version_row.content_type_id,
    'contentTypeVersionId', version_row.id, 'locale', 'en-US',
    'changedPaths', jsonb_build_array('/fields/' || field_id::text),
    'values', jsonb_build_object(field_id::text, 'TG SOURCE'), 'validatorRefs', '[]'::jsonb,
    'schemaArtifact', jsonb_build_object('id', artifact.id, 'contentTypeVersionId', version_row.id,
      'artifactHash', btrim(artifact.artifact_hash::text), 'compilerVersion', artifact.compiler_version,
      'zodContractRef', artifact.zod_contract_ref),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence',
    'workflowPolicy', platform_private.cms_editorial_workflow_policy_evidence(version_row.id),
    'idempotencyKey', 's12tg-' || p_tag || '-create');
  perform set_config('app.cms_rpc', prior_rpc, true);
  return answer;
exception when others then
  perform set_config('app.cms_rpc', prior_rpc, true);
  raise;
end;
$body$;

create function pg_temp.s12tg_prepare(p_tag text) returns setof text language plpgsql as $body$
declare created jsonb; appended jsonb; original platform_private.cms_entry_revisions;
  source_id uuid := extensions.gen_random_uuid(); source_template uuid := pg_temp.s12ga_subject(p_tag);
  field_id uuid; stamp timestamptz; old_image jsonb;
  prior_rpc text := coalesce(current_setting('app.cms_rpc', true), '');
begin
  created := pg_temp.s12tg_call(p_tag || ':create', 'cms_create_entry', pg_temp.s12tg_create_request(p_tag));
  return next is((select state from s12tg_calls where label = p_tag || ':create'), '00000',
    p_tag || ': real public entry creation succeeds');
  if created is null then return; end if;
  select * into original from platform_private.cms_entry_revisions
    where id = (created->'revision'->>'id')::uuid;
  old_image := pg_temp.s12tg_source(original.id);
  return next ok(original.template_version_id is null,
    p_tag || ': public create has no template operand; no missing producer is claimed');
  stamp := clock_timestamp();
  -- AUTHORIZED RECEIVING-STORAGE SEAM: insert a NEW valid bound revision and
  -- its copied field rows; seed ONLY this test entry's mutable head/version.
  -- No old immutable revision/field is updated or deleted, and every guard runs.
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_entry_revisions select (jsonb_populate_record(
    null::platform_private.cms_entry_revisions, to_jsonb(original) || jsonb_build_object(
      'id', source_id, 'revision_number', 2, 'template_version_id', source_template,
      'parent_revision_ids', jsonb_build_array(original.id), 'created_at', stamp, 'updated_at', stamp))).*;
  insert into platform_private.cms_entry_field_values select (jsonb_populate_record(
    null::platform_private.cms_entry_field_values, to_jsonb(v) || jsonb_build_object(
      'id', extensions.gen_random_uuid(), 'revision_id', source_id, 'created_at', stamp, 'updated_at', stamp))).*
    from platform_private.cms_entry_field_values v where v.revision_id = original.id;
  update platform_private.cms_content_entries set current_draft_revision_id = source_id,
    version = version + 1, updated_at = stamp where id = original.entry_id;
  perform set_config('app.cms_rpc', prior_rpc, true);
  insert into s12tg_world values (p_tag, original.entry_id, source_id, null, pg_temp.s12tg_source(source_id));
  return next is(pg_temp.s12tg_source(original.id), old_image, p_tag || ': seam leaves original full immutable rows unchanged');
  select stable_field_id into field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = original.schema_version_id and field_key = 'title';
  appended := pg_temp.s12tg_call(p_tag || ':append', 'cms_create_revision', jsonb_build_object(
    'entryId', original.entry_id, 'baseRevision', '2', 'expectedVersion', '2', 'ifMatch', '2',
    'changedPaths', jsonb_build_array('/fields/' || field_id::text),
    'values', jsonb_build_object(field_id::text, 'TG CURRENT'), 'locale', original.locale,
    'idempotencyKey', 's12tg-' || p_tag || '-append'));
  return next is((select state from s12tg_calls where label = p_tag || ':append'), '00000',
    p_tag || ': real public append consumes the explicitly labelled seeded source');
  return next ok((select template_version_id = source_template and revision_number = 3
    from platform_private.cms_entry_revisions where id = (appended->>'id')::uuid),
    p_tag || ': actual appended draft retains T1 binding');
  return next is((select count(*) from s12tg_calls where label in (p_tag || ':create', p_tag || ':append')
    and call_role = 'service_role' and state = '00000'), 2::bigint, p_tag || ': both actual service-role public producers');
end;
$body$;

create function pg_temp.s12tg_copy(p_source uuid, p_destination uuid) returns jsonb
language plpgsql security invoker as $body$
declare signature text := 'platform_private.cms_restore_composition_copy(uuid,uuid,timestamptz,platform_private.cms_composition_instances[],uuid[],uuid[])';
  code text := '00000'; msg text; invoked text; seen jsonb; stamp timestamptz;
  request jsonb := jsonb_build_object('context', pg_temp.s09d_context('owner', true)); actor uuid;
begin
  if to_regprocedure(signature) is null then return jsonb_build_object('state', 'MISSING_FUNCTION'); end if;
  if p_source is null or p_destination is null then return jsonb_build_object('state', 'MISSING_FIXTURE'); end if;
  begin
    set local role wejammin_cms_definer;
    invoked := current_user;
    perform set_config('app.cms_rpc', 'true', true);
    actor := platform_private.cms_actor(request);
    perform platform_private.cms_acting_party(request, actor);
    select created_at into stamp from platform_private.cms_entry_revisions where id = p_destination;
    seen := jsonb_build_object('source', (select to_jsonb(r) from platform_private.cms_entry_revisions r where id = p_source),
      'destination', (select to_jsonb(r) from platform_private.cms_entry_revisions r where id = p_destination),
      'heads', (select count(*) from platform_private.cms_composition_instances
        where revision_id in (p_source, p_destination)));
    begin
      execute 'select platform_private.cms_restore_composition_copy($1,$2,$3,$4,$5,$6)'
        using p_source, p_destination, stamp, '{}'::platform_private.cms_composition_instances[], '{}'::uuid[], '{}'::uuid[];
    exception when others then
      get stacked diagnostics code = returned_sqlstate, msg = message_text;
    end;
    -- Roll back ALL probe role/context changes and any unexpected body effect.
    raise exception using errcode = 'ZT001', message = 'rollback private template-gate probe';
  exception when sqlstate 'ZT001' then null;
    when others then get stacked diagnostics code = returned_sqlstate, msg = message_text;
  end;
  return jsonb_build_object('state', code, 'message', msg, 'role', invoked, 'seen', seen);
end;
$body$;

create function pg_temp.s12tg_check(p_tag text, p_state text, p_success boolean)
returns setof text language plpgsql as $body$
declare world s12tg_world; source platform_private.cms_entry_revisions; request jsonb;
  answer jsonb; probe jsonb; expected_version text; current_id uuid; field_id uuid;
  v_label text := p_tag || ':' || p_state; before_rows jsonb; prior_user text := current_user;
begin
  select * into world from s12tg_world where tag = p_tag;
  return next ok(found, v_label || ': complete prepared world exists');
  if not found then return; end if;
  select * into source from platform_private.cms_entry_revisions where id = world.source_id;
  select version::text, current_draft_revision_id into expected_version, current_id
    from platform_private.cms_content_entries where id = world.entry_id;
  return next is((select state from platform_private.cms_template_versions where id = source.template_version_id),
    p_state, v_label || ': actual governed source-template state, not an expected DTO');
  return next is((select count(*) from platform_private.cms_composition_instances where revision_id = source.id),
    0::bigint, v_label || ': exact empty selected-head premise');
  request := jsonb_build_object('entryId', world.entry_id, 'revisionId', source.id,
    'expectedVersion', expected_version, 'idempotencyKey', 's12tg-' || replace(v_label, ':', '-') || '-restore',
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(platform_private.cms_restore_chain_derive(
      pg_temp.s09d_id('tg-type:type'), source.schema_version_id, source.schema_version_id)->>'hash'));
  answer := pg_temp.s12tg_call(v_label, 'cms_restore_revision', request);
  return next is((select call_role from s12tg_calls where s12tg_calls.label = v_label), 'service_role',
    v_label || ': actual public restore SQL role');
  return next is((select state from s12tg_calls where s12tg_calls.label = v_label),
    case when p_success then '00000' else 'P0001' end, v_label || ': existing public restore outcome');
  if p_success and answer is not null then
    update s12tg_world set destination_id = (answer->'resource'->>'id')::uuid where tag = p_tag;
    world.destination_id := (answer->'resource'->>'id')::uuid;
    return next is((select array_agg(k order by k) from jsonb_object_keys(answer) k),
      array['resource', 'restoreVerification'], v_label || ': unchanged public envelope');
    return next ok((select owner_id = source.owner_id and entry_id = source.entry_id
      and locale = source.locale and schema_version_id = source.schema_version_id
      and template_version_id = source.template_version_id and template_version_id = pg_temp.s12ga_subject(p_tag)
      and created_at = updated_at and state = 'draft'
      from platform_private.cms_entry_revisions where id = world.destination_id), v_label || ': real destination retains SOURCE T1');
    return next is(answer->'resource'->'parentRevisionIds', jsonb_build_array(current_id, source.id), v_label || ': exact restore parents');
    return next is(answer->'resource'->>'entryVersion', (expected_version::bigint + 1)::text, v_label || ': one public CAS advance');
    select stable_field_id into field_id from platform_private.cms_field_definition_versions
      where content_type_version_id = source.schema_version_id and field_key = 'title';
    return next is(answer->'resource'->>'contentHash', platform_private.cms_jcs_sha256(
      jsonb_build_object(field_id::text, 'TG SOURCE')), v_label || ': literal source-field hash, never current title');
  elsif not p_success then
    return next is((select message from s12tg_calls where s12tg_calls.label = v_label), 'template_incompatible',
      v_label || ': existing non-disclosing withdrawn-template refusal');
    return next ok((select before_image = after_image from s12tg_calls where s12tg_calls.label = v_label),
      v_label || ': public refusal preserves every full CMS/reservation/audit/outbox store');
  end if;
  before_rows := pg_temp.s12tg_image();
  probe := pg_temp.s12tg_copy(source.id, world.destination_id);
  return next is(probe->>'role', 'wejammin_cms_definer', v_label || ': direct447 actually runs as CMS invoker');
  return next ok((probe#>'{seen,source}') = to_jsonb(source)
    and (probe#>>'{seen,destination,id}') = world.destination_id::text
    and (probe#>>'{seen,destination,template_version_id}') = source.template_version_id::text
    and (probe#>>'{seen,destination,created_at}') is not null and probe#>>'{seen,heads}' = '0',
    v_label || ': actual CMS sees exact source/destination and zero heads; no supplied-list authority');
  return next is(probe->>'state', case when p_success then '00000' else 'P0001' end,
    v_label || ': direct447 permits compatible superseded T1 as well as active T1');
  if probe->>'state' is distinct from (case when p_success then '00000' else 'P0001' end) then
    return next diag(v_label || ': private observation ' || probe::text);
  end if;
  if not p_success then return next is(probe->>'message', 'template_incompatible', v_label || ': direct447 retired refusal token'); end if;
  return next is(pg_temp.s12tg_image(), before_rows, v_label || ': zero-head private probe changes no durable row');
  return next is(current_user::text, prior_user, v_label || ': complete probe scope restores SQL caller');
  return next is(pg_temp.s12tg_source(source.id), world.source_image, v_label || ': source revision/fields remain completely immutable');
end;
$body$;

select pg_temp.s12gb_approved('tg-live');
select pg_temp.s12gb_act('tg-live-activate', 'owner', pg_temp.s12ga_review('tg-live'));
select is(pg_temp.s12ga_out('tg-live-activate'), 'ok', 'TG-T1: genuine governed activation');
select * from pg_temp.s12tg_prepare('tg-live');
select * from pg_temp.s12tg_check('tg-live', 'active', true);
select pg_temp.s12gb_successor('tg-live-v2', 'tg-live', array['typeA']);
select pg_temp.s12gb_approve('tg-live-v2');
select pg_temp.s12gb_act('tg-live-v2-activate', 'owner', pg_temp.s12ga_review('tg-live-v2'));
select is(pg_temp.s12ga_out('tg-live-v2-activate'), 'ok', 'TG-T2: genuine successor activation supersedes T1');
select ok((select old.template_id = newer.template_id and old.state = 'superseded' and newer.state = 'active'
  and old.version = 1 and newer.version = 2 from platform_private.cms_template_versions old
  join platform_private.cms_template_versions newer on newer.id = pg_temp.s12ga_subject('tg-live-v2')
  where old.id = pg_temp.s12ga_subject('tg-live')), 'TG-T2: exact real same-lineage T1/T2 state premise');
select * from pg_temp.s12tg_check('tg-live', 'superseded', true);

select pg_temp.s12gb_approved('tg-retire');
select pg_temp.s12gb_act('tg-retire-activate', 'owner', pg_temp.s12ga_review('tg-retire'));
select is(pg_temp.s12ga_out('tg-retire-activate'), 'ok', 'TG-RETIRE: real active control before retirement');
select * from pg_temp.s12tg_prepare('tg-retire');
select * from pg_temp.s12tg_check('tg-retire', 'active', true);
select pg_temp.s12gb_act('tg-retire-action', 'owner', pg_temp.s12ga_review('tg-retire'), 'retire',
  jsonb_build_object('reason', 'Restore template gate contrast'));
select is(pg_temp.s12ga_out('tg-retire-action'), 'ok', 'TG-RETIRE: real public retirement, no forged lifecycle');
select * from pg_temp.s12tg_check('tg-retire', 'retired', false);
-- Blocked is HELD for a legitimate due-scheduled producer fixture. No skip,
-- fabricated state, schedule backdating, time warp or acceptance credit here.
select * from finish();
rollback;
