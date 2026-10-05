\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the CMS-03A-01
-- request grammar the SQL boundary itself enforces.  Every refusal is produced
-- through the real named RPC, expects the token BE03a "Route field validation
-- matrix" names (422 VALIDATION_FAILED or 409 CONFLICT, 400 INVALID_REQUEST for
-- an unknown key), and proves "no partial insert": a row-count fingerprint of
-- the type, version, field, relation, binding and artifact tables, the outbox,
-- audit trail and idempotency records is identical before and after the call.
-- Each refusal is paired with an accepted control built from the same base so
-- the rejection is attributable to the one varied clause.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

\ir phase_02_slice_09_p240/00-a01.sqlinc

-- ============================================================ AC040 typeKey ====
select is(pg_temp.p_run('k:ok', pg_temp.p_base('p240_ok_key'), 'OK'), 'ok',
  'control: a lowercase ASCII key matching the grammar is accepted [P2-S09-AC-040]');
select is(pg_temp.p_run('k:max', pg_temp.p_base('a' || repeat('b', 63)), 'OK'), 'ok',
  'a 64-character key (first letter plus 63) is the longest accepted key [P2-S09-AC-040]');
select is(pg_temp.p_run('k:' || c.n, pg_temp.p_base(c.v), 'VALIDATION_FAILED'), 'ok',
  'typeKey ' || c.n || ' is refused with 422 and nothing is committed [P2-S09-AC-040]')
from (values ('uppercase', 'P240upper'), ('leading digit', '1p240digit'), ('one character', 'a'),
  ('65 characters', 'a' || repeat('b', 64)), ('hyphen', 'p240-hyphen'), ('dot', 'p240.dot'),
  ('space', 'p240 space'), ('empty', ''), ('non-ASCII letter', 'p240caf' || chr(233))) c(n, v);
select is(pg_temp.p_run('k:res:' || r, pg_temp.p_base(r), 'VALIDATION_FAILED'), 'ok',
  'the reserved canonical concept key ' || r || ' is refused [P2-S09-AC-040]')
from unnest(array['user', 'person', 'account', 'session', 'identity', 'party', 'profile', 'asset', 'menu', 'comment',
  'credit', 'right', 'money', 'mandate', 'dispute', 'entitlement', 'credential', 'evidence', 'institution', 'course',
  'lesson', 'authority', 'permission', 'role', 'billing', 'payment', 'transaction']) r;
select is(pg_temp.p_run('k:res:upper', pg_temp.p_base('Role'), 'VALIDATION_FAILED'), 'ok',
  'a reserved concept is refused regardless of case [P2-S09-AC-040]');
select is(pg_temp.p_run('k:dup', pg_temp.p_base('p240_ok_key'), 'CONFLICT'), 'ok',
  'an already used key is refused with 409 CONFLICT and nothing is committed [P2-S09-AC-040]');
select is((select state from platform_private.cms_content_types where type_key = 'p240_ok_key'), 'retired',
  'fixture: a never activated type is physically retired, so the key below is a retired key [P2-S09-AC-040]');
select is(pg_temp.p_run('k:retired', pg_temp.p_base('p240_ok_key', jsonb_build_object('label', 'Reuse after retirement')), 'CONFLICT'), 'ok',
  'a retired type key is never reused: the same key is refused with 409 CONFLICT [P2-S09-AC-040]');
select is((select built_in from platform_private.cms_content_types where type_key = 'p240_ok_key'), false,
  'a human-created type is never built-in [P2-S09-AC-040]');
select is(pg_temp.p_run('k:builtin', pg_temp.p_base('p240_builtin_try', jsonb_build_object('builtIn', true)), 'INVALID_REQUEST'), 'ok',
  'a caller cannot declare a type built-in: builtIn is an unknown key (400) [P2-S09-AC-040]');
select is((select count(*)::integer from platform_private.cms_content_types where built_in), 0,
  'no built-in type row exists for a caller to collide with or create [P2-S09-AC-040]');

-- ================================================== AC042 ownerCapability ====
select is(pg_temp.p_run('oc:ok', pg_temp.p_base('p240_oc_ok', '{"ownerCapability":"cms.editor"}'), 'OK'), 'ok',
  'control: a protected registry member other than the default is accepted [P2-S09-AC-042]');
select is(pg_temp.p_run('oc:' || c.n, pg_temp.p_base(pg_temp.p_key('oc' || c.n), jsonb_build_object('ownerCapability', c.v)), 'VALIDATION_FAILED'), 'ok',
  'ownerCapability ' || c.n || ' is refused with 422 and nothing is committed [P2-S09-AC-042]')
from (values ('unregistered', 'cms.not_a_capability'), ('empty', ''), ('wildcard', 'cms.*'), ('uppercase', 'CMS.EDITOR'),
  ('admin key', 'admin.platform'), ('129 characters', 'a' || repeat('b', 128)),
  ('registry member with suffix', 'cms.editor.extra')) c(n, v);
select is(pg_temp.p_run('oc:128', pg_temp.p_base('p240_oc_128', jsonb_build_object('ownerCapability', 'a' || repeat('b', 127))), 'VALIDATION_FAILED'), 'ok',
  'a 128-character key passes the length bound but is still refused because it is not a registry member [P2-S09-AC-042]');
select is(pg_temp.p_run('oc:null', pg_temp.p_base('p240_oc_null', '{"ownerCapability":null}'), 'VALIDATION_FAILED'), 'ok',
  'a null ownerCapability is refused [P2-S09-AC-042]');
select is((select owner_capability from platform_private.cms_content_types where type_key = 'p240_oc_ok'), 'cms.editor',
  'the accepted capability is stored exactly as the registry member [P2-S09-AC-042]');

-- =========================================== AC044 workflowKey / workflowVersion ====
select is(pg_temp.p_run('wf:ok', pg_temp.p_base('p240_wf_ok', '{"workflowKey":"cms.disclosure.policy"}'), 'OK'), 'ok',
  'control: a seeded protected policy member and version 1 is accepted [P2-S09-AC-044]');
select is((select workflow_key || '/' || workflow_version from platform_private.cms_content_type_versions v
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_wf_ok'), 'cms.disclosure.policy/1',
  'the version persists the bound workflow key and positive decimal version [P2-S09-AC-044]');
select is(pg_temp.p_run('wf:' || c.n, pg_temp.p_base(pg_temp.p_key('wf' || c.n), c.o), 'VALIDATION_FAILED'), 'ok',
  'workflow ' || c.n || ' is refused with 422 and nothing is committed [P2-S09-AC-044]')
from (values
  ('uppercase key', '{"workflowKey":"Editorial"}'::jsonb), ('leading digit key', '{"workflowKey":"1editorial"}'),
  ('space in key', '{"workflowKey":"edit orial"}'), ('empty key', '{"workflowKey":""}'),
  ('129 character key', jsonb_build_object('workflowKey', 'a' || repeat('b', 128))),
  ('unseeded well-formed key', '{"workflowKey":"no.such.policy"}'), ('null key', '{"workflowKey":null}'),
  ('version zero', '{"workflowVersion":"0"}'), ('negative version', '{"workflowVersion":"-1"}'),
  ('padded version', '{"workflowVersion":"01"}'), ('non-numeric version', '{"workflowVersion":"one"}'),
  ('seeded key with unseeded version', '{"workflowVersion":"2"}'),
  ('null version', '{"workflowVersion":null}'), ('decimal point version', '{"workflowVersion":"1.0"}')) c(n, o);

-- ============================================ AC045 defaultTemplateVersionId ====
select pg_temp.s09d_grant_specialist('owner', 'cms.template_designer');
select pg_temp.s09d_create_type('t', 'p240_tplbase');
select pg_temp.s09d_to_active('t');
select pg_temp.s09d_rpc('t:template', 'platform_api.cms_define_template', 'owner',
  jsonb_build_object('templateKey', 'p240-template', 'compatibleTypeIds', jsonb_build_array(pg_temp.s09d_id('t:type')),
    'slots', '[]'::jsonb, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
    'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
    'idempotencyKey', 'p240-template-define-0001'));
select pg_temp.s09d_remember('t:templateVersion', (pg_temp.s09d_resp('t:template')->>'id')::uuid);
select is(pg_temp.s09d_outcome('t:template'), 'OK', 'fixture: a real template version is defined through CMS-03C-01 [P2-S09-AC-045]');
select is(pg_temp.p_run('tpl:own', pg_temp.p_base(pg_temp.p_key('tplown'), jsonb_build_object('defaultTemplateVersionId', pg_temp.s09d_id('t:templateVersion'))), 'VALIDATION_FAILED'), 'ok',
  'a present reference to a real template version of the same owner is refused whole (DEC-123: a new type is created without a template; its compatible_type_ids cannot contain a type that does not exist yet) [P2-S09-AC-045]');
select is((select count(*)::integer from platform_private.cms_template_versions tv
    where tv.id = pg_temp.s09d_id('t:templateVersion') and tv.owner_id = pg_temp.s09d_id('ownerOrg')
      and tv.compatible_type_ids = jsonb_build_array(pg_temp.s09d_id('t:type')::text)), 1,
  'fixture: that template is compatible only with the already active type, so the refusal is the DEC-123 no-template rule, not a missing template [P2-S09-AC-045]');
select is(pg_temp.p_run('tpl:null', pg_temp.p_base('p240_tpl_null', '{"defaultTemplateVersionId":null}'), 'OK'), 'ok',
  'null is accepted: a type may have no default template [P2-S09-AC-045]');
select is(pg_temp.p_run('tpl:' || c.n, pg_temp.p_base(pg_temp.p_key('tpl' || c.n), jsonb_build_object('defaultTemplateVersionId', c.v)), 'VALIDATION_FAILED'), 'ok',
  'defaultTemplateVersionId ' || c.n || ' is refused and nothing is committed [P2-S09-AC-045]')
from (values ('malformed uuid', to_jsonb('not-a-uuid'::text)), ('unknown uuid', to_jsonb(extensions.gen_random_uuid()::text)),
  ('the type version of another aggregate', to_jsonb(pg_temp.s09d_id('t:version')::text)), ('empty string', to_jsonb(''::text)),
  ('number', to_jsonb(7))) c(n, v);

-- ================================================================ AC046 fields ====
select is(pg_temp.p_run('f:zero', pg_temp.p_base('p240_f_zero', '{"fields":[]}'), 'OK'), 'ok',
  'control: zero fields is a valid aggregate [P2-S09-AC-046]');
select is((select count(*)::integer from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_f_zero'), 0, 'zero fields persists zero field rows [P2-S09-AC-046]');
select is(pg_temp.p_run('f:128', pg_temp.p_base('p240_f_128', jsonb_build_object('fields',
    (select jsonb_agg(pg_temp.p_field('f' || lpad(g::text, 3, '0'), 'short_text')) from generate_series(1, 128) g))), 'OK'), 'ok',
  '128 fields is the largest accepted array [P2-S09-AC-046]');
select is((select count(*)::integer from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_f_128'), 128, 'all 128 fields are persisted [P2-S09-AC-046]');
select is(pg_temp.p_run('f:129', pg_temp.p_base('p240_f_129', jsonb_build_object('fields',
    (select jsonb_agg(pg_temp.p_field('f' || lpad(g::text, 3, '0'), 'short_text')) from generate_series(1, 129) g))), 'VALIDATION_FAILED'), 'ok',
  '129 fields is refused and no field row is inserted [P2-S09-AC-046]');
select is(pg_temp.p_run('f:partial', pg_temp.p_base('p240_f_partial', jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('first', 'short_text'), pg_temp.p_field('second', 'integer'), pg_temp.p_field('third', 'not_a_kind'),
    pg_temp.p_field('fourth', 'boolean')))), 'VALIDATION_FAILED'), 'ok',
  'a defect in the third field leaves no type, version, artifact or the two valid fields behind (no partial aggregate insertion) [P2-S09-AC-046]');
select is(pg_temp.p_run('f:notarray', pg_temp.p_base('p240_f_obj', '{"fields":{}}'), 'VALIDATION_FAILED'), 'ok',
  'fields as an object instead of an array is refused [P2-S09-AC-046]');
select is(pg_temp.p_run('f:null', pg_temp.p_base('p240_f_null', '{"fields":null}'), 'VALIDATION_FAILED'), 'ok',
  'a null fields value is refused [P2-S09-AC-046]');
select is(pg_temp.p_run('f:dupid', pg_temp.p_base('p240_f_dupid', jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('one', 'short_text', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0001"}'),
    pg_temp.p_field('two', 'short_text', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0001"}')))), 'VALIDATION_FAILED'), 'ok',
  'two fields claiming one stableFieldId are refused whole [P2-S09-AC-046]');
select is(pg_temp.p_run('f:dupkey', pg_temp.p_base('p240_f_dupkey', jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('same', 'short_text'), pg_temp.p_field('same', 'integer')))), 'VALIDATION_FAILED'), 'ok',
  'two fields with one key are refused whole [P2-S09-AC-046]');

-- ============================================== AC047 each initial field ====
select is(pg_temp.p_run('fe:ok', pg_temp.p_base('p240_fe_ok', jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('amount', 'decimal', jsonb_build_object('constraints', '{"minimum":0,"maximum":100}'::jsonb, 'required', true,
      'validatorKey', 'cms.decimal', 'validatorVersion', 1, 'defaultMode', 'literal', 'defaultValue', 5, 'localizationMode', 'none')),
    pg_temp.p_field('body', 'long_text', jsonb_build_object('localizationMode', 'localized', 'defaultMode', 'inherited')),
    pg_temp.p_field('only', 'short_text', jsonb_build_object('localizationMode', 'no_fallback', 'lifecycle', 'deprecated',
      'editorConfig', jsonb_build_object('label', 'Only', 'helpText', 'Help', 'order', 10000)))))), 'OK'), 'ok',
  'control: a field carrying every declared attribute (validator pair, literal default, localization modes, lifecycle, editorConfig) is accepted [P2-S09-AC-047]');
select ok((select f.constraints = '{"minimum":0,"maximum":100}'::jsonb and f.validator_key = 'cms.decimal' and f.validator_version = 1 and f.required
      and f.default_mode = 'literal' and f.default_value = '5'::jsonb and f.localization_mode = 'none' and f.state = 'active'
      and f.editor_config = '{"label":"Amount","order":0}'::jsonb and f.stable_field_id = f.id and f.kind = 'decimal'
    from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_fe_ok' and f.field_key = 'amount'),
  'every declared attribute of the initial field is persisted exactly: stable id, key, kind, constraints, validator pair, required, default, localization, editor config, lifecycle [P2-S09-AC-047]');
select is((select string_agg(f.field_key || ':' || f.localization_mode || ':' || f.state, ',' order by f.field_key)
    from platform_private.cms_field_definition_versions f join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_fe_ok'),
  'amount:none:active,body:localized:active,only:no_fallback:deprecated', 'the three localization modes and the lifecycle are stored as declared [P2-S09-AC-047]');
select is(pg_temp.p_run('fe:' || c.n, pg_temp.p_base(pg_temp.p_key('fe' || c.n), jsonb_build_object('fields', jsonb_build_array(c.f))), c.e), 'ok',
  'an initial field with ' || c.n || ' is refused with ' || c.e || ' and nothing is committed [P2-S09-AC-047]')
from (values
  ('a missing stableFieldId', pg_temp.p_field('a1', 'short_text') - 'stableFieldId', 'VALIDATION_FAILED'),
  ('a malformed stableFieldId', pg_temp.p_field('a2', 'short_text', '{"stableFieldId":"nope"}'), 'VALIDATION_FAILED'),
  ('a missing key', pg_temp.p_field('a3', 'short_text') - 'key', 'VALIDATION_FAILED'),
  ('an uppercase key', pg_temp.p_field('A4', 'short_text'), 'VALIDATION_FAILED'),
  ('a one-letter key', pg_temp.p_field('a', 'short_text'), 'VALIDATION_FAILED'),
  ('a reserved key', pg_temp.p_field('role', 'short_text'), 'VALIDATION_FAILED'),
  ('an unknown kind', pg_temp.p_field('a5', 'markdown'), 'VALIDATION_FAILED'),
  ('a missing kind', pg_temp.p_field('a6', 'short_text') - 'kind', 'VALIDATION_FAILED'),
  ('a missing constraints object', pg_temp.p_field('a7', 'short_text') - 'constraints', 'VALIDATION_FAILED'),
  ('a constraint key outside the closed set', pg_temp.p_field('a8', 'short_text', '{"constraints":{"pattern":"^a+$"}}'), 'VALIDATION_FAILED'),
  ('minLength above maxLength', pg_temp.p_field('a9', 'short_text', '{"constraints":{"minLength":5,"maxLength":2}}'), 'VALIDATION_FAILED'),
  ('minimum above maximum', pg_temp.p_field('b1', 'integer', '{"constraints":{"minimum":9,"maximum":1}}'), 'VALIDATION_FAILED'),
  ('a validatorKey without a version', pg_temp.p_field('b2', 'short_text', '{"validatorKey":"cms.text"}'), 'VALIDATION_FAILED'),
  ('a validatorVersion without a key', pg_temp.p_field('b3', 'short_text', '{"validatorVersion":1}'), 'VALIDATION_FAILED'),
  ('an unregistered validator pair', pg_temp.p_field('b4', 'short_text', '{"validatorKey":"cms.custom","validatorVersion":1}'), 'VALIDATION_FAILED'),
  ('a registered validator at an unregistered version', pg_temp.p_field('b5', 'short_text', '{"validatorKey":"cms.text","validatorVersion":9}'), 'VALIDATION_FAILED'),
  ('literal default mode without a value', pg_temp.p_field('b6', 'short_text', '{"defaultMode":"literal"}'), 'VALIDATION_FAILED'),
  ('none default mode with an explicit null value (a present key is a default)', pg_temp.p_field('b7', 'short_text', '{"defaultMode":"none","defaultValue":null}'), 'VALIDATION_FAILED'),
  ('none default mode with a value', pg_temp.p_field('b8', 'short_text', '{"defaultMode":"none","defaultValue":"x"}'), 'VALIDATION_FAILED'),
  ('inherited default mode with a value', pg_temp.p_field('b9', 'short_text', '{"defaultMode":"inherited","defaultValue":"x"}'), 'VALIDATION_FAILED'),
  ('an unknown default mode', pg_temp.p_field('c1', 'short_text', '{"defaultMode":"computed"}'), 'VALIDATION_FAILED'),
  ('an unknown localization mode', pg_temp.p_field('c2', 'short_text', '{"localizationMode":"fallback"}'), 'VALIDATION_FAILED'),
  ('a null defaultMode', pg_temp.p_field('n1', 'short_text', '{"defaultMode":null}'), 'VALIDATION_FAILED'),
  ('a null localizationMode', pg_temp.p_field('n2', 'short_text', '{"localizationMode":null}'), 'VALIDATION_FAILED'),
  ('a null lifecycle', pg_temp.p_field('n3', 'short_text', '{"lifecycle":null}'), 'VALIDATION_FAILED'),
  ('an unknown lifecycle', pg_temp.p_field('c3', 'short_text', '{"lifecycle":"draft"}'), 'VALIDATION_FAILED'),
  ('a missing lifecycle', pg_temp.p_field('c4', 'short_text') - 'lifecycle', 'VALIDATION_FAILED'),
  ('an editorConfig missing its label', pg_temp.p_field('c5', 'short_text', '{"editorConfig":{"order":0}}'), 'VALIDATION_FAILED'),
  ('an editorConfig with an unknown key', pg_temp.p_field('c6', 'short_text', '{"editorConfig":{"label":"X","order":0,"html":"<b>"}}'), 'VALIDATION_FAILED'),
  ('an editorConfig order above 10000', pg_temp.p_field('c7', 'short_text', '{"editorConfig":{"label":"X","order":10001}}'), 'VALIDATION_FAILED'),
  ('a 121 character editorConfig label', pg_temp.p_field('c8', 'short_text', jsonb_build_object('editorConfig', jsonb_build_object('label', repeat('x', 121), 'order', 0))), 'VALIDATION_FAILED'),
  ('a 501 character editorConfig helpText', pg_temp.p_field('c9', 'short_text', jsonb_build_object('editorConfig', jsonb_build_object('label', 'X', 'helpText', repeat('x', 501), 'order', 0))), 'VALIDATION_FAILED'),
  ('an unknown attribute on the field', pg_temp.p_field('d1', 'short_text', '{"script":"alert(1)"}'), 'VALIDATION_FAILED'),
  ('an executable expression in place of a validator', pg_temp.p_field('d2', 'short_text', '{"validatorKey":"return 1","validatorVersion":1}'), 'VALIDATION_FAILED')
) c(n, f, e);

-- BE03a types defaultValue as Json.nullable().optional() and derives hasDefault from the key being
-- present: an explicit JSON null is a literal default, only a missing key is not (AC064).
select is(pg_temp.p_run('fe:literalnull', pg_temp.p_base(pg_temp.p_key('felitnull'), jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('nulldef', 'short_text', '{"defaultMode":"literal","defaultValue":null}')))), 'OK'), 'ok',
  'an initial field whose literal default is an explicit JSON null is committed [P2-S09-AC-047] [P2-S09-AC-064]');
select ok((select f.default_mode = 'literal' and f.default_value = 'null'::jsonb
    from platform_private.cms_field_definition_versions f where f.field_key = 'nulldef'),
  'the literal null is stored as the JSON null value and stays distinct from a missing default [P2-S09-AC-064]');

-- ====================================================== AC048 relations ====
create or replace function pg_temp.p_relation_request(p_key text, p_relation jsonb, p_field_kind text default 'relation') returns jsonb
language plpgsql as $body$
declare field jsonb := pg_temp.p_field('related', p_field_kind);
begin
  return pg_temp.p_base(p_key, jsonb_build_object(
    'fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), field),
    'relations', jsonb_build_array(jsonb_build_object('fieldId', field->>'stableFieldId', 'targetKind', 'domain', 'targetType', 'profile',
      'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder') || p_relation)));
end;
$body$;
select is(pg_temp.p_run('r:ok', pg_temp.p_relation_request('p240_r_ok', '{}'), 'OK'), 'ok',
  'control: a complete relation binding over a relation-kind field is committed with the aggregate [P2-S09-AC-048]');
select is((select count(*)::integer from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    join platform_private.cms_content_type_versions v on v.id = f.content_type_version_id join platform_private.cms_content_types t on t.id = v.content_type_id
    where t.type_key = 'p240_r_ok' and r.target_kind = 'domain' and r.target_type = 'profile' and r.projection_key = 'profile.summary'
      and r.cardinality = 'many' and r.min_count = 0 and r.max_count = 3 and not r.ordered and r.on_unavailable = 'placeholder'), 1,
  'the relation row stores every declared attribute [P2-S09-AC-048]');
select is(pg_temp.p_run('r:' || c.n, pg_temp.p_relation_request(pg_temp.p_key('r' || c.n), c.o), 'VALIDATION_FAILED'), 'ok',
  'a relation with ' || c.n || ' is refused and nothing is committed [P2-S09-AC-048]')
from (values
  ('a projection key outside the code allowlist', '{"projectionKey":"profile.secret"}'::jsonb),
  ('a target type outside the allowlist for the kind', '{"targetType":"payments"}'),
  ('an arbitrary SQL projection key', '{"projectionKey":"select 1"}'),
  ('a table name as the projection', '{"projectionKey":"platform_private.users"}'),
  ('an unknown target kind', '{"targetKind":"table"}'),
  ('an unknown cardinality', '{"cardinality":"several"}'),
  ('min above max', '{"min":4,"max":3}'),
  ('max zero', '{"max":0}'),
  ('max above 128', '{"max":129}'),
  ('min above 128', '{"min":129,"max":129}'),
  ('cardinality one with max 2', '{"cardinality":"one","min":0,"max":2}'),
  ('cardinality one with min 2', '{"cardinality":"one","min":2,"max":1}'),
  ('a non-boolean ordered', '{"ordered":"yes"}'),
  ('an unknown onUnavailable', '{"onUnavailable":"hide"}'),
  ('a null min', '{"min":null}'), ('a null max', '{"max":null}'), ('a null onUnavailable', '{"onUnavailable":null}'),
  ('a null cardinality', '{"cardinality":null}'), ('a null projectionKey', '{"projectionKey":null}'), ('a null targetType', '{"targetType":null}'),
  ('an unknown extra key', '{"authority":"grant"}'),
  ('a field id that names no field of this aggregate', jsonb_build_object('fieldId', extensions.gen_random_uuid())),
  ('a malformed field id', '{"fieldId":"nope"}')) c(n, o);
select is(pg_temp.p_run('r:nonrel', pg_temp.p_relation_request('p240_r_nonrel', '{}', 'short_text'), 'VALIDATION_FAILED'), 'ok',
  'a relation bound to a field that is not relation-kind is refused whole [P2-S09-AC-048]');
select is(pg_temp.p_run('r:256', pg_temp.p_base('p240_r_129', jsonb_build_object('relations', (select jsonb_agg(jsonb_build_object('fieldId', extensions.gen_random_uuid())) from generate_series(1, 129)))), 'VALIDATION_FAILED'), 'ok',
  'more than 128 relations is refused before any insert [P2-S09-AC-048]');

select is(pg_temp.p_run('r:dup', pg_temp.p_base(pg_temp.p_key('rdup'), jsonb_build_object('fields', jsonb_build_array(
    pg_temp.p_field('title', 'short_text'), pg_temp.p_field('related', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0002"}')),
    'relations', jsonb_build_array(
      jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0002', 'targetKind', 'domain', 'targetType', 'profile',
        'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder'),
      jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0002', 'targetKind', 'domain', 'targetType', 'person',
        'projectionKey', 'public.summary', 'cardinality', 'one', 'min', 0, 'max', 1, 'ordered', false, 'onUnavailable', 'omit')))),
    'VALIDATION_FAILED'), 'ok',
  'two relation bindings for one field are refused with a typed 422 and nothing is committed [P2-S09-AC-048]');

-- ======================================================= AC049 templateBindings ====
select is(pg_temp.p_run('tb:real', pg_temp.p_base(pg_temp.p_key('tbreal'), jsonb_build_object('templateBindings',
    jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion'))))), 'VALIDATION_FAILED'), 'ok',
  'a binding to a real template version of the same owner is refused whole (DEC-123: a new type binds no template; it is bound through a successor), and nothing is committed [P2-S09-AC-049]');
select is(pg_temp.p_run('tb:' || c.n, pg_temp.p_base(pg_temp.p_key('tb' || c.n), jsonb_build_object('templateBindings', c.v)), 'VALIDATION_FAILED'), 'ok',
  'templateBindings ' || c.n || ' is refused and nothing is committed [P2-S09-AC-049]')
from (values
  ('with an unknown template version', jsonb_build_array(jsonb_build_object('templateVersionId', extensions.gen_random_uuid()))),
  ('with a malformed id', jsonb_build_array(jsonb_build_object('templateVersionId', 'nope'))),
  ('with an object instead of an id', jsonb_build_array(jsonb_build_object('templateVersionId', jsonb_build_object('id', 1)))),
  ('with an unknown key beside the id', jsonb_build_array(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion'), 'inline', '<div/>'))),
  ('with an empty binding object', jsonb_build_array('{}'::jsonb)),
  ('as an object', '{}'::jsonb),
  ('with a bare uuid string', jsonb_build_array(pg_temp.s09d_id('t:templateVersion')::text))) c(n, v);
select is(pg_temp.p_run('tb:dup', pg_temp.p_base(pg_temp.p_key('tbdup'), jsonb_build_object('templateBindings', jsonb_build_array(
    jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion')),
    jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion'))))), 'VALIDATION_FAILED'), 'ok',
  'the same template version bound twice is refused with a typed 422 and nothing is committed [P2-S09-AC-049]');
select is(pg_temp.p_run('tb:32', pg_temp.p_base('p240_tb_32', jsonb_build_object('templateBindings',
    (select jsonb_agg(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion'))) from generate_series(1, 32)))), 'VALIDATION_FAILED'), 'ok',
  'a 32-entry array of one repeated reference is refused as a duplicate, not as an over-long array, and commits nothing [P2-S09-AC-049]');
select is(pg_temp.p_run('tb:33', pg_temp.p_base('p240_tb_33', jsonb_build_object('templateBindings',
    (select jsonb_agg(jsonb_build_object('templateVersionId', pg_temp.s09d_id('t:templateVersion'))) from generate_series(1, 33)))), 'VALIDATION_FAILED'), 'ok',
  'a 33-entry array exceeds the maximum of 32 and is refused before any insert [P2-S09-AC-049]');

-- ===================================================== AC050 capabilityBindings ====
select is(pg_temp.p_run('cb:ok', pg_temp.p_base('p240_cb_ok', jsonb_build_object('capabilityBindings', jsonb_build_array(
    jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1'),
    jsonb_build_object('capabilityKey', 'cms.publisher', 'capabilityVersion', '1')))), 'OK'), 'ok',
  'control: protected capability key/version references are committed with the aggregate [P2-S09-AC-050]');
select is((select string_agg(b.capability_key || '@' || b.capability_version, ',' order by b.capability_key)
    from platform_private.cms_content_type_capability_bindings b join platform_private.cms_content_type_versions v on v.id = b.content_type_version_id
    join platform_private.cms_content_types t on t.id = v.content_type_id where t.type_key = 'p240_cb_ok'), 'cms.editor@1,cms.publisher@1',
  'both bindings are stored with their versions [P2-S09-AC-050]');
select is(pg_temp.p_run('cb:' || c.n, pg_temp.p_base(pg_temp.p_key('cb' || c.n), jsonb_build_object('capabilityBindings', c.v)), 'VALIDATION_FAILED'), 'ok',
  'capabilityBindings ' || c.n || ' is refused and nothing is committed [P2-S09-AC-050]')
from (values
  ('with an unregistered key', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.root', 'capabilityVersion', '1'))),
  ('with a registered key at an unregistered version', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '2'))),
  ('with a version of zero', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '0'))),
  ('with a missing version', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.editor'))),
  ('with an unknown key beside the pair', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1', 'grant', true))),
  ('with a wildcard key', jsonb_build_array(jsonb_build_object('capabilityKey', 'cms.*', 'capabilityVersion', '1'))),
  ('as an object', '{}'::jsonb)) c(n, v);
select is(pg_temp.p_run('cb:dup', pg_temp.p_base(pg_temp.p_key('cbdup'), jsonb_build_object('capabilityBindings', jsonb_build_array(
    jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1'),
    jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1')))), 'VALIDATION_FAILED'), 'ok',
  'the same capability reference bound twice is refused with a typed 422 and nothing is committed [P2-S09-AC-050]');
select is(pg_temp.p_run('cb:33', pg_temp.p_base('p240_cb_33', jsonb_build_object('capabilityBindings',
    (select jsonb_agg(jsonb_build_object('capabilityKey', 'cms.editor', 'capabilityVersion', '1')) from generate_series(1, 33)))), 'VALIDATION_FAILED'), 'ok',
  'a 33-entry array exceeds the maximum of 32 and is refused before any insert [P2-S09-AC-050]');

select * from finish();
rollback;
