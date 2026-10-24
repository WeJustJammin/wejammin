-- Producer-only bootstrap RED: FE03:1274 / IA03:279,285–286 / BE03a:206,209.
-- No entry/revision storage seam, immutable-history mutation or activation forgery.
-- Refusal mapping and lock/race policy are outside this bounded happy-path QA.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
begin;
create extension if not exists pgtap with schema extensions;
select plan(141);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_assignment/000-world.sqlinc
\ir phase_02_slice_12_governed_activation/000-world.sqlinc

select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.template_designer'), 'OK',
  'EDT01: real owner template-designer grant');
select is(pg_temp.s09d_grant_via_rpc('owner', 'cms.author'), 'OK',
  'EDT02: real owner entry-author grant');
select pg_temp.s09d_create_type('edt-base', 's12edtbound');
select pg_temp.s09d_to_active('edt-base');
select is(pg_temp.s09d_outcome('edt-base:activate'), 'OK', 'EDT03: real initial active type');
select pg_temp.s09d_create_type('edt-null', 's12edtnull');
select pg_temp.s09d_to_active('edt-null', array['rev2']);
select is(pg_temp.s09d_outcome('edt-null:activate'), 'OK', 'EDT04: separate real active no-default type');
select ok((select default_template_version_id is null
  from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('edt-base:version')),
  'EDT05: original type genuinely starts without a template under DEC-123');
select is(pg_temp.s12ga_grant('rev1', 'cms.reviewer'), 'OK', 'EDT06: real independent template-reviewer grant');
-- Existing local governed-test actor selection; not a new identity/approval row.
update s09d_actor set party_id = pg_temp.s09d_id('ownerOrg') where key = 'rev1';
insert into s12gov_ids values ('typeA', pg_temp.s09d_id('edt-base:type')::text);

select pg_temp.s12ga_rpc('mint:edt-template', 'platform_api.cms_define_template', 'owner', jsonb_build_object(
  'templateKey', 's12edt-template', 'compatibleTypeIds', jsonb_build_array(pg_temp.s09d_id('edt-base:type')),
  'slots', '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]'::jsonb,
  'reservedRegions', ' ["header","now","record","detail","provenance"]'::jsonb,
  'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
  'idempotencyKey', 's12edt-template-create'));
select is(pg_temp.s12ga_out('mint:edt-template'), 'ok', 'EDT07: real template producer accepts literal main slot');
insert into s12gov_ids values ('edt-template:subject', pg_temp.s12ga_body('mint:edt-template')->>'id');
select pg_temp.s12ga_submit('edt-template', 'owner');
select pg_temp.s12gb_approve('edt-template');
select pg_temp.s12gb_act('edt-template-activate', 'owner', pg_temp.s12ga_review('edt-template'));
select ok((select count(*) = 5 and bool_and(state = '00000' and rpc_user = 'service_role'
  and before_user = after_user) from s12ga_rcpt where label in (
    'mint:edt-template', 'submit:edt-template', 'as-edt-template', 'ap-edt-template', 'edt-template-activate')),
  'EDT08: actual service-role template mint/submit/assign/approve/activate all succeed');
select ok((select state = 'active' and version = 1 and lifecycle_version = 4
  and slots = '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]'::jsonb
  and compatible_type_ids = jsonb_build_array(pg_temp.s09d_id('edt-base:type'))
  and activated_at is not null from platform_private.cms_template_versions
  where id = pg_temp.s12ga_subject('edt-template')),
  'EDT09: actual governed compatible T1 has the exact literal slot, not a fabricated state');
select is((select count(*) from platform_private.cms_content_entries
  where content_type_id in (pg_temp.s09d_id('edt-base:type'), pg_temp.s09d_id('edt-null:type'))),
  0::bigint, 'EDT10: no affected entries exist before the genuine successor dry-run');

select pg_temp.s09d_successor('edt-bound', 'edt-base', p_default_template => pg_temp.s12ga_subject('edt-template'),
  p_bindings => '[]'::jsonb);
select is(pg_temp.s09d_outcome('edt-bound:successor'), 'OK',
  'EDT11: real successor binds default T1 with the required explicit empty bindings pair');
select pg_temp.s09d_to_active('edt-bound', array['rev3']);
select ok((select count(*) = 30 and bool_and(coalesce(probe.state = '00000' and probe.response is not null, false))
  from (select tag, step from (values ('edt-base'), ('edt-null'), ('edt-bound')) tags(tag)
    cross join unnest(array['draft', 'dryRun', 'plan.get', 'plan.claim', 'plan.batch', 'plan.seal',
      'submit', 'assignment', 'decision', 'activate']) step) expected
  left join s09d_probe probe on probe.label = expected.tag || ':' || case expected.step
    when 'draft' then case when expected.tag = 'edt-bound' then 'successor' else 'create' end
    when 'assignment' then 'assign:' || case expected.tag when 'edt-base' then 'rev1' when 'edt-null' then 'rev2' else 'rev3' end
    when 'decision' then 'decide:' || case expected.tag when 'edt-base' then 'rev1' when 'edt-null' then 'rev2' else 'rev3' end
    else expected.step end), 'EDT12: all thirty real schema producer/worker/review/activation steps pass');
select ok((select successor.state = 'active' and source.state = 'superseded'
  and successor.content_type_id = source.content_type_id and content_type.state = 'active'
  and successor.owner_id = pg_temp.s09d_id('ownerOrg')
  and successor.default_template_version_id = pg_temp.s12ga_subject('edt-template')
  and artifact.id = successor.schema_artifact_id and artifact.content_type_version_id = successor.id
  and artifact.state = 'compiled' and artifact.artifact_hash = successor.definition_hash
  and artifact.compiler_version is not null and artifact.zod_contract_ref is not null
  and exists (select 1 from platform_private.cms_template_versions template
    where template.id = pg_temp.s12ga_subject('edt-template') and template.state = 'active'
      and template.owner_id = successor.owner_id
      and template.compatible_type_ids @> jsonb_build_array(successor.content_type_id))
  from platform_private.cms_content_type_versions successor
  join platform_private.cms_content_type_versions source on source.id = pg_temp.s09d_id('edt-base:version')
  join platform_private.cms_content_types content_type on content_type.id = successor.content_type_id
  join platform_private.cms_schema_artifacts artifact on artifact.id = successor.schema_artifact_id
  where successor.id = pg_temp.s09d_id('edt-bound:version')),
  'EDT13: exact real active compiled successor persists the independently known T1 default');
select ok((select version_row.state = 'active' and version_row.default_template_version_id is null
  and version_row.owner_id = pg_temp.s09d_id('ownerOrg') and content_type.state = 'active'
  and artifact.id = version_row.schema_artifact_id and artifact.content_type_version_id = version_row.id
  and artifact.state = 'compiled' and artifact.artifact_hash = version_row.definition_hash
  from platform_private.cms_content_type_versions version_row
  join platform_private.cms_content_types content_type on content_type.id = version_row.content_type_id
  join platform_private.cms_schema_artifacts artifact on artifact.id = version_row.schema_artifact_id
  where version_row.id = pg_temp.s09d_id('edt-null:version')),
  'EDT14: no-default control is a different genuine active compiled schema, not a missing dependency');
select ok((select state = 'completed' and source_count = 0 and target_count = 0 and row_error_count = 0
  from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('edt-bound:plan')),
  'EDT15: real successor worker sealed the genuinely empty migration population');
select is((select count(*) from platform_private.cms_content_type_template_bindings
  where content_type_version_id = pg_temp.s09d_id('edt-bound:version')), 0::bigint,
  'EDT16: optional bindings list is empty; default pin does not come from a client-selected binding item');

create temp table s12edt_out(label text primary key, request jsonb, response jsonb,
  state text, message text, call_role text, before_entries bigint, before_revisions bigint,
  metadata_before jsonb, metadata_after jsonb) on commit drop;
create function pg_temp.s12edt_metadata() returns jsonb language sql stable as $body$
  select jsonb_build_object(
    'types', (select jsonb_agg(to_jsonb(t) order by id) from platform_private.cms_content_types t),
    'versions', (select jsonb_agg(to_jsonb(v) order by id) from platform_private.cms_content_type_versions v),
    'artifacts', (select jsonb_agg(to_jsonb(a) order by id) from platform_private.cms_schema_artifacts a),
    'templates', (select jsonb_agg(to_jsonb(t) order by id) from platform_private.cms_template_versions t))
$body$;
create function pg_temp.s12edt_request(p_tag text, p_title text, p_actor text default 'owner')
returns jsonb language plpgsql as $body$
declare version_row platform_private.cms_content_type_versions; artifact platform_private.cms_schema_artifacts;
  field_id uuid; answer jsonb; actor uuid; context_request jsonb;
  prior_rpc text := coalesce(current_setting('app.cms_rpc', true), '');
begin
  perform pg_temp.s09d_session(p_actor, 'service_role');
  context_request := jsonb_build_object('context', pg_temp.s09d_context(p_actor, true));
  perform set_config('app.cms_rpc', 'true', true);
  actor := platform_private.cms_actor(context_request);
  perform platform_private.cms_acting_party(context_request, actor);
  select * into version_row from platform_private.cms_content_type_versions where id = pg_temp.s09d_id(p_tag || ':version');
  select * into artifact from platform_private.cms_schema_artifacts where id = version_row.schema_artifact_id;
  select stable_field_id into field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = version_row.id and field_key = 'title';
  answer := jsonb_build_object('contentTypeId', version_row.content_type_id, 'contentTypeVersionId', version_row.id,
    'locale', 'en-US', 'changedPaths', jsonb_build_array('/fields/' || field_id::text),
    'values', jsonb_build_object(field_id::text, p_title), 'validatorRefs', '[]'::jsonb,
    'schemaArtifact', jsonb_build_object('id', artifact.id, 'contentTypeVersionId', version_row.id,
      'artifactHash', btrim(artifact.artifact_hash::text), 'compilerVersion', artifact.compiler_version,
      'zodContractRef', artifact.zod_contract_ref),
    'activationEvidence', platform_private.cms_type_version_resource(version_row.id)->'activationEvidence',
    'workflowPolicy', platform_private.cms_editorial_workflow_policy_evidence(version_row.id),
    'idempotencyKey', 's12edt-' || p_tag || case when p_actor = 'owner' then '' else '-' || p_actor end || '-create');
  perform set_config('app.cms_rpc', prior_rpc, true);
  return answer;
exception when others then
  perform set_config('app.cms_rpc', prior_rpc, true);
  raise;
end;
$body$;
create function pg_temp.s12edt_run(p_tag text, p_title text, p_actor text default 'owner')
returns void language plpgsql security invoker as $body$
declare request jsonb := pg_temp.s12edt_request(p_tag, p_title, p_actor); answer jsonb; code text := '00000'; msg text;
  prior_role text := current_setting('role'); invoked text; before_entries bigint; before_revisions bigint;
  before_metadata jsonb;
begin
  perform pg_temp.s09d_session(p_actor, 'service_role');
  request := request || jsonb_build_object('context', pg_temp.s09d_context(p_actor, true));
  select count(*) into before_entries from platform_private.cms_content_entries;
  select count(*) into before_revisions from platform_private.cms_entry_revisions;
  before_metadata := pg_temp.s12edt_metadata();
  begin
    set local role service_role;
    invoked := current_user;
    begin
      answer := platform_api.cms_create_entry(request);
    exception when others then get stacked diagnostics code = returned_sqlstate, msg = message_text;
    end;
    perform set_config('role', prior_role, true);
  exception when others then perform set_config('role', prior_role, true); raise;
  end;
  insert into s12edt_out values (p_tag || case when p_actor = 'owner' then '' else ':' || p_actor end,
    request, answer, code, msg, invoked, before_entries,
    before_revisions, before_metadata, pg_temp.s12edt_metadata());
end;
$body$;

create function pg_temp.s12edt_check(p_tag text, p_title text, p_template uuid, p_slots jsonb,
  p_actor text default 'owner', p_assignment text default 'cms.author')
returns setof text language plpgsql as $body$
declare result s12edt_out; entry_row platform_private.cms_content_entries;
  revision_row platform_private.cms_entry_revisions; field_id uuid; expected_hash text;
  case_label text := p_tag || case when p_actor = 'owner' then '' else ':' || p_actor end;
begin
  perform pg_temp.s12edt_run(p_tag, p_title, p_actor);
  select * into result from s12edt_out where label = case_label;
  select * into entry_row from platform_private.cms_content_entries where id = (result.response->'entry'->>'id')::uuid;
  select * into revision_row from platform_private.cms_entry_revisions where id = (result.response->'revision'->>'id')::uuid;
  select stable_field_id into field_id from platform_private.cms_field_definition_versions
    where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = 'title';
  expected_hash := platform_private.cms_jcs_sha256(jsonb_build_object(field_id::text, p_title));
  return next ok(not result.request ?| array['templateVersionId', 'defaultTemplateVersionId', 'templateBindings'],
    case_label || ': strict create request has no client template operand');
  return next is(result.call_role, 'service_role', case_label || ': actual public SQL service-role transport');
  return next is(result.state, '00000', case_label || ': real public bootstrap succeeds with all evidence');
  if result.state is distinct from '00000' then return next diag(coalesce(result.message, 'missing call outcome')); end if;
  return next is((select array_agg(k order by k) from jsonb_object_keys(
    case when jsonb_typeof(result.response) = 'object' then result.response else '{}'::jsonb end) k),
    array['contentHash', 'entry', 'lifecycle', 'locale', 'revision', 'revisionNumber', 'state', 'validationState'],
    case_label || ': unchanged strict EntryCreateResource, no added public template field');
  return next ok((select count(*) from platform_private.cms_content_entries) = result.before_entries + 1
    and (select count(*) from platform_private.cms_entry_revisions) = result.before_revisions + 1,
    case_label || ': exactly one entry and its one first revision appear together');
  return next ok(entry_row.owner_id = pg_temp.s09d_id('ownerOrg') and entry_row.owner_party_id = entry_row.owner_id
    and entry_row.content_type_id = pg_temp.s09d_id(p_tag || ':type') and entry_row.lifecycle = 'active'
    and entry_row.version = 1 and entry_row.current_draft_revision_id = revision_row.id
    and entry_row.created_by = pg_temp.s09d_actor_id(p_actor, 'auth')::uuid
    and (select count(*) = 1 from platform_private.cms_entry_assignments a where a.entry_id = entry_row.id
      and a.owner_id = entry_row.owner_id and a.assignee_person_id = pg_temp.s09d_actor_id(p_actor, 'person')::uuid
      and a.capability_key = p_assignment and a.state = 'active' and a.version = 1),
    case_label || ': persisted first head/owner/creator assignment are server-derived');
  return next ok(revision_row.owner_id = entry_row.owner_id and revision_row.entry_id = entry_row.id
    and revision_row.revision_number = 1 and revision_row.version = 1
    and revision_row.schema_version_id = pg_temp.s09d_id(p_tag || ':version') and revision_row.locale = 'en-US'
    and revision_row.parent_revision_ids = '[]'::jsonb and revision_row.state = 'draft'
    and revision_row.author_person_id = pg_temp.s09d_actor_id(p_actor, 'person')::uuid
    and revision_row.acting_party_id = entry_row.owner_id,
    case_label || ': actual immutable first revision binds the exact active schema and creator context');
  return next is(revision_row.template_version_id::text, p_template::text,
    case_label || ': FIRST revision server-derives the exact expected default template, preserving SQL NULL when absent');
  return next is((select slots from platform_private.cms_template_versions where id = revision_row.template_version_id), p_slots,
    case_label || ': literal slot readback follows the FIRST revision pin, never a direct default-template lookup');
  return next is((select jsonb_object_agg(v.field_id::text, v.value) from platform_private.cms_entry_field_values v
    where v.revision_id = revision_row.id), jsonb_build_object(field_id::text, p_title),
    case_label || ': literal initial field map is preserved exactly');
  return next ok(result.response->>'contentHash' = expected_hash and revision_row.payload_hash::text = expected_hash,
    case_label || ': response and persisted hash match independent literal field preimage');
  return next is(result.metadata_after, result.metadata_before,
    case_label || ': bootstrap never mutates existing type/version/artifact/template full rows');
end;
$body$;

select * from pg_temp.s12edt_check('edt-bound', 'DEFAULT FIRST', pg_temp.s12ga_subject('edt-template'),
  '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]'::jsonb);
select * from pg_temp.s12edt_check('edt-null', 'NULL FIRST', null::uuid, null::jsonb);

-- Additional least-privilege cases run AFTER all original forty assertions.
-- These aliases select existing real rev2/rev3 humans, not new identities or grants.
-- s09d_grant_via_rpc labels its ungoverned membership provisioning; the CMS grant
-- itself and the new organization context below use their actual public producers.
insert into s09d_actor(key, auth_user_id, person_id, party_id)
select selection.actor_key, actor.auth_user_id, actor.person_id, pg_temp.s09d_id('ownerOrg')
from (values ('edt-author', 'rev2'), ('edt-editor', 'rev3')) selection(actor_key, source_key)
join s09d_actor actor on actor.key = selection.source_key;
select is(pg_temp.s09d_grant_via_rpc('edt-author', 'cms.author'), 'OK',
  'EDT17: author-only human receives the real owner-granted cms.author capability');
select is(pg_temp.s09d_grant_via_rpc('edt-editor', 'cms.editor'), 'OK',
  'EDT18: editor-only human receives the real owner-granted cms.editor capability');
select ok(pg_temp.s09d_try($sql$select pg_temp.s09d_bind_context('edt-author')$sql$),
  'EDT19: author-only human selects owner organization through actual identity_context_bind');
select ok(pg_temp.s09d_try($sql$select pg_temp.s09d_bind_context('edt-editor')$sql$),
  'EDT20: editor-only human selects owner organization through actual identity_context_bind');

create function pg_temp.s12edt_least_privilege(p_actor text, p_capability text)
returns setof text language plpgsql as $body$
declare actor s09d_actor;
begin
  select * into actor from s09d_actor where key = p_actor;
  return next ok(actor.auth_user_id <> pg_temp.s09d_actor_id('owner', 'auth')::uuid
    and actor.party_id = pg_temp.s09d_id('ownerOrg')
    and exists (select 1 from identity.auth_user_bindings auth_binding
      where auth_binding.auth_user_id = actor.auth_user_id and auth_binding.person_id = actor.person_id)
    and exists (select 1 from identity_private.membership_tenure tenure
      where tenure.organization_id = actor.party_id and tenure.person_id = actor.person_id
        and tenure.state = 'confirmed' and (tenure.ends_on is null or tenure.ends_on >= current_date))
    and exists (select 1 from platform_private.acting_context_binding binding
      where binding.id = actor.binding_id and binding.person_id = actor.person_id
        and binding.acting_party_id = actor.party_id and binding.context_kind = 'organization'
        and binding.client_binding_id = 's09d-' || p_actor and binding.state = 'active'
        and binding.expires_at > clock_timestamp()
        and binding.last_seen_at > clock_timestamp() - interval '1 hour'),
    p_actor || ': real bound human, confirmed organization membership and freshly produced organization context');
  return next is((select array_agg(grant_row.capability_code order by grant_row.capability_code)
    from platform_private.cms_capability_grants grant_row
    where grant_row.owner_id = actor.party_id and grant_row.subject_person_ref = actor.person_id
      and grant_row.state = 'active' and grant_row.valid_from <= current_date
      and grant_row.valid_through >= current_date), array[p_capability],
    p_actor || ': actual live CMS grants contain ONLY the intended entry capability');
  return next is((select array_agg(grant_row.capability_code order by grant_row.capability_code)
    from identity_private.organization_actor_grant grant_row
    where grant_row.organization_id = actor.party_id and grant_row.person_id = actor.person_id
      and grant_row.active and grant_row.valid_from <= current_date
      and (grant_row.valid_through is null or grant_row.valid_through >= current_date)), array[p_capability],
    p_actor || ': actual live identity grant projection contains ONLY the intended entry capability');
  return next ok(not exists (select 1 from platform_private.cms_capability_grants grant_row
      where grant_row.subject_person_ref = actor.person_id
        and grant_row.capability_code in ('cms.schema_designer', 'cms.template_designer'))
    and not exists (select 1 from identity_private.organization_actor_grant grant_row
      where grant_row.person_id = actor.person_id
        and grant_row.capability_code in ('cms.schema_designer', 'cms.template_designer')),
    p_actor || ': schema_designer and template_designer are explicitly ABSENT in both actual grant stores');
end;
$body$;
select * from pg_temp.s12edt_least_privilege('edt-author', 'cms.author');
select * from pg_temp.s12edt_least_privilege('edt-editor', 'cms.editor');
select * from pg_temp.s12edt_check('edt-bound', 'AUTHOR ONLY FIRST', pg_temp.s12ga_subject('edt-template'),
  '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]'::jsonb, 'edt-author', 'cms.author');
select * from pg_temp.s12edt_check('edt-bound', 'EDITOR ONLY FIRST', pg_temp.s12ga_subject('edt-template'),
  '[{"key":"main","required":false,"allowedBlocks":[],"maxCount":7}]'::jsonb, 'edt-editor', 'cms.editor');
\ir phase_02_slice_12_entry_default_template/000-policy-helpers.sqlinc
\ir phase_02_slice_12_entry_default_template/010-policy-lifecycle.sqlinc
\ir phase_02_slice_12_entry_default_template/020-policy-fault.sqlinc
\ir phase_02_slice_12_entry_default_template/030-policy-gate.sqlinc
select * from finish();
rollback;
