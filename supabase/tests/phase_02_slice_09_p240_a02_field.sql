commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): CMS-03A-02
-- (field change on an unactivated draft).  Every case is a real RPC call on a
-- draft built by the producer chain; each refusal is compared with a row-level
-- fingerprint of the draft aggregate (fields, versions, outbox, audit,
-- idempotency) so "no partial field row or aggregate mutation" is observed, and
-- every refusal has an accepted control on the same draft.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|',
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_type_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select count(*) from platform_private.outbox_events), (select count(*) from audit_private.audit_events),
    (select count(*) from platform_private.idempotency_records)))
$body$;
create or replace function pg_temp.p_efield(p_key text, p_kind text, p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('key', p_key, 'kind', p_kind, 'constraints', '{}'::jsonb, 'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', initcap(p_key), 'order', 1), 'lifecycle', 'active') || p_over
$body$;
-- CMS-03A-02 as p_actor on the draft of p_tag; p_req overrides top-level members, p_field replaces the field object.
create or replace function pg_temp.p_a02(p_label text, p_tag text, p_field jsonb, p_over jsonb default '{}'::jsonb, p_actor text default 'owner')
returns text language plpgsql as $body$
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_add_field_definition', p_actor, jsonb_build_object(
    'contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'), 'field', p_field,
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag),
    'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over);
  return pg_temp.s09d_outcome(p_label);
end;
$body$;
-- 'ok' when the call returned the expected token and (for a refusal) changed nothing at all.
create or replace function pg_temp.p_expect(p_label text, p_tag text, p_field jsonb, p_expected text, p_over jsonb default '{}'::jsonb, p_actor text default 'owner')
returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  outcome := pg_temp.p_a02(p_label, p_tag, p_field, p_over, p_actor);
  return case when outcome = p_expected and (p_expected = 'OK' or before_fp = pg_temp.p_fp()) then 'ok'
    else 'bad:' || outcome || case when p_expected <> 'OK' and before_fp <> pg_temp.p_fp() then ' (state changed)' else '' end end;
end;
$body$;
create or replace function pg_temp.p_title_id(p_tag text) returns uuid language sql stable as $body$
  select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = 'title'
$body$;
create or replace function pg_temp.p_field_row(p_tag text, p_key text) returns text language sql stable as $body$
  select t::text from platform_private.cms_field_definition_versions t where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = p_key
$body$;

select pg_temp.s09d_create_type('a', 'p240_a02a');
select pg_temp.s09d_create_type('z', 'p240_a02z');

-- ============================================== AC057 path identifiers ====
select is(pg_temp.p_expect('pid:ok', 'a', pg_temp.p_efield('pathok', 'short_text'), 'OK'), 'ok',
  'control: a field is added with the version that belongs to the type [P2-S09-AC-057]');
select is(pg_temp.p_expect('pid:cross', 'a', pg_temp.p_efield('pathx', 'short_text'), 'NOT_FOUND',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('z:type'))), 'ok',
  'a versionId that does not belong to the contentTypeId is NOT_FOUND after structural validation and nothing changes [P2-S09-AC-057]');
select is(pg_temp.p_expect('pid:bad1', 'a', pg_temp.p_efield('pathy', 'short_text'), 'INVALID_REQUEST', '{"contentTypeId":"nope"}'), 'ok',
  'a malformed contentTypeId is 400 INVALID_REQUEST and nothing changes [P2-S09-AC-057]');
select is(pg_temp.p_expect('pid:bad2', 'a', pg_temp.p_efield('pathz', 'short_text'), 'INVALID_REQUEST', '{"versionId":"nope"}'), 'ok',
  'a malformed versionId is 400 INVALID_REQUEST and nothing changes [P2-S09-AC-057]');
select is(pg_temp.p_expect('pid:rand', 'a', pg_temp.p_efield('pathw', 'short_text'), 'NOT_FOUND', jsonb_build_object('versionId', extensions.gen_random_uuid())), 'ok',
  'a well-formed but unknown versionId is NOT_FOUND [P2-S09-AC-057]');
select is(pg_temp.p_expect('pid:other', 'a', pg_temp.p_efield('pathv', 'short_text'), 'NOT_FOUND', '{}', 'other'), 'ok',
  'the identifiers of another owner''s draft are concealed: NOT_FOUND and nothing changes [P2-S09-AC-057]');

-- ================================================ AC058 stableFieldId ====
select is(pg_temp.p_expect('sid:new', 'a', pg_temp.p_efield('freshone', 'short_text'), 'OK'), 'ok',
  'a new field omits stableFieldId and the server assigns it [P2-S09-AC-058]');
select is((select (stable_field_id = id)::text from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key = 'freshone'),
  'true', 'the assigned identity is stable: stable_field_id is the row identity [P2-S09-AC-058]');
select is(pg_temp.p_expect('sid:change', 'a', pg_temp.p_efield('title', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_title_id('a'),
    'editorConfig', jsonb_build_object('label', 'Headline', 'order', 0))), 'OK'), 'ok',
  'an existing field is changed by naming its stableFieldId [P2-S09-AC-058]');
select is((select (editor_config->>'label') || '/' || version::text from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key = 'title'),
  'Headline/2', 'the change updated the one existing field and advanced only its CAS version [P2-S09-AC-058]');
select pg_temp.p_a02('sid:unknown', 'a', pg_temp.p_efield('ghost', 'short_text', jsonb_build_object('stableFieldId', extensions.gen_random_uuid())));
select ok(pg_temp.s09d_outcome('sid:unknown') in ('VALIDATION_FAILED', 'CONFLICT'),
  'a stableFieldId that names no field of this version is refused with 422 or 409 and no field is created [P2-S09-AC-058]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_field_definition_versions where field_key = ''ghost'''), '0', 'no ghost field row exists [P2-S09-AC-058]');
select is(pg_temp.p_expect('sid:bad', 'a', pg_temp.p_efield('freshtwo', 'short_text', '{"stableFieldId":"nope"}'), 'INVALID_REQUEST'), 'ok',
  'a malformed stableFieldId is refused and nothing changes [P2-S09-AC-058]');
select is(pg_temp.p_expect('sid:other', 'a', pg_temp.p_efield('title', 'short_text', jsonb_build_object('stableFieldId',
    (select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('z:version') and field_key = 'title'))), 'CONFLICT'), 'ok',
  'the stableFieldId of a field in another version is not usable here: refused and nothing changes [P2-S09-AC-058]');

-- ===================================================== AC059 key identity ====
select is(pg_temp.p_expect('key:' || c.n, 'a', pg_temp.p_efield(c.v, 'short_text'), c.e), 'ok',
  'key ' || c.n || ' is refused with ' || c.e || ' and nothing changes [P2-S09-AC-059]')
from (values ('with an uppercase letter', 'Upper', 'INVALID_REQUEST'), ('with a leading digit', '1abc', 'INVALID_REQUEST'),
  ('of one character', 'a', 'INVALID_REQUEST'), ('of 65 characters', 'a' || repeat('b', 64), 'INVALID_REQUEST'),
  ('with a hyphen', 'a-b', 'INVALID_REQUEST'), ('that is a reserved concept', 'role', 'INVALID_REQUEST'),
  ('already used by the title field', 'title', 'CONFLICT')) c(n, v, e);
select is(pg_temp.p_expect('key:max', 'a', pg_temp.p_efield('a' || repeat('b', 63), 'short_text'), 'OK'), 'ok', 'a 64-character key is accepted [P2-S09-AC-059]');
select is(pg_temp.p_expect('key:rename', 'a', pg_temp.p_efield('retitled', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_title_id('a'))), 'CONFLICT'), 'ok',
  'the key of an existing field cannot be silently changed: refused and the title field keeps its key [P2-S09-AC-059]');
select is((select field_key from platform_private.cms_field_definition_versions where stable_field_id = pg_temp.p_title_id('a')), 'title', 'the stable identity still carries its original key [P2-S09-AC-059]');
select is(pg_temp.p_expect('key:reuse', 'a', pg_temp.p_efield('freshone', 'integer'), 'CONFLICT'), 'ok',
  'a key already carried by another field of the version cannot be reused for a new one [P2-S09-AC-059]');
select throws_ok(format('update platform_private.cms_field_definition_versions set field_key = %L where stable_field_id = %L', 'sneaky', pg_temp.p_title_id('a')),
  'P0001', null, 'a direct UPDATE of a field key is rejected by the identity guard [P2-S09-AC-059]');

-- ======================================================== AC060 kind ====
select is(pg_temp.p_expect('kind:' || k, 'a', pg_temp.p_efield('k_' || k, k), 'OK'), 'ok', 'kind ' || k || ' is accepted [P2-S09-AC-060]')
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media', 'object', 'list']) k;
select is((select count(distinct kind)::integer from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version')), 14,
  'the fourteen declared kinds were each stored on this draft [P2-S09-AC-060]');
select is(pg_temp.p_expect('kind:bad:' || c.k, 'a', pg_temp.p_efield('kb_' || md5(c.k), c.k), 'INVALID_REQUEST'), 'ok', 'kind ' || c.k || ' is refused and nothing changes [P2-S09-AC-060]')
from (values ('markdown'), ('SHORT_TEXT'), ('text'), ('image'), ('json'), (''), ('short_text '), ('relation|media')) c(k);
select is((select count(*)::integer from pg_constraint c where c.conrelid = 'platform_private.cms_field_definition_versions'::regclass and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%short_text%long_text%rich_text%boolean%integer%decimal%date%datetime%enum%taxonomy%relation%media%object%list%'), 1,
  'the storage CHECK pins the same closed fourteen-kind set [P2-S09-AC-060]');

-- ========================================================= AC061 constraints ====
select is(pg_temp.p_expect('con:ok', 'a', pg_temp.p_efield('c_ok', 'short_text', '{"constraints":{"minLength":1,"maxLength":10,"enumValues":["a","b"],"itemKind":"short_text","minimum":0,"maximum":5}}'), 'OK'), 'ok',
  'control: the six refinements minLength, maxLength, minimum, maximum, enumValues and itemKind are accepted with min at most max [P2-S09-AC-061]');
select is(pg_temp.p_expect('con:' || c.n, 'a', pg_temp.p_efield('cx_' || substr(md5(c.n), 1, 10), 'short_text', jsonb_build_object('constraints', c.v)), c.e), 'ok',
  'constraints ' || c.n || ' are refused with ' || c.e || ' and nothing changes [P2-S09-AC-061]')
from (values
  ('with a key outside the closed refinement set', '{"pattern":"^x$"}'::jsonb, 'INVALID_REQUEST'),
  ('with minLength above maxLength', '{"minLength":9,"maxLength":3}', 'INVALID_REQUEST'),
  ('with minimum above maximum', '{"minimum":9,"maximum":3}', 'INVALID_REQUEST'),
  ('with a non-numeric minLength', '{"minLength":"3"}', 'INVALID_REQUEST'),
  ('with a negative minLength', '{"minLength":-1}', 'INVALID_REQUEST'),
  ('with a fractional maxLength', '{"maxLength":2.5}', 'INVALID_REQUEST'),
  ('with enumValues that is not an array', '{"enumValues":"a"}', 'INVALID_REQUEST'),
  ('with a non-string enum member', '{"enumValues":[1]}', 'INVALID_REQUEST'),
  ('with a 161 character enum member', jsonb_build_object('enumValues', jsonb_build_array(repeat('x', 161))), 'INVALID_REQUEST'),
  ('with 257 enum members', jsonb_build_object('enumValues', (select jsonb_agg('v' || g) from generate_series(1, 257) g)), 'INVALID_REQUEST'),
  ('with an unknown itemKind', '{"itemKind":"blob"}', 'INVALID_REQUEST'),
  ('larger than 8 KiB', jsonb_build_object('enumValues', (select jsonb_agg(repeat('x', 100) || g) from generate_series(1, 90) g)), 'INVALID_REQUEST'),
  ('that are an array instead of an object', '[]', 'INVALID_REQUEST'),
  ('that are null', 'null', 'INVALID_REQUEST')) c(n, v, e);
select is(pg_temp.p_expect('con:keys', 'a', pg_temp.p_efield('c_keys', 'short_text', jsonb_build_object('constraints', jsonb_build_object('minLength', 1, 'maxLength', 2, 'minimum', 0, 'maximum', 1, 'enumValues', '[]'::jsonb,
    'itemKind', 'short_text', 'extra1', 1))), 'INVALID_REQUEST'), 'ok', 'a seventh constraint key is outside the closed set and refused [P2-S09-AC-061]');
select is((select (constraints = '{"minLength":1,"maxLength":10,"enumValues":["a","b"],"itemKind":"short_text","minimum":0,"maximum":5}'::jsonb)::text
    from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key = 'c_ok'), 'true',
  'the accepted constraints are stored exactly as sent [P2-S09-AC-061]');

-- ========================================================= AC062 validators ====
select is(pg_temp.p_expect('val:ok', 'a', pg_temp.p_efield('v_ok', 'short_text', '{"validatorKey":"cms.slug","validatorVersion":1}'), 'OK'), 'ok',
  'control: a registered validator key and version pair is accepted [P2-S09-AC-062]');
select is(pg_temp.p_expect('val:null', 'a', pg_temp.p_efield('v_null', 'short_text', '{"validatorKey":null,"validatorVersion":null}'), 'OK'), 'ok',
  'both null is accepted [P2-S09-AC-062]');
select is(pg_temp.p_expect('val:' || c.n, 'a', pg_temp.p_efield('vx_' || substr(md5(c.n), 1, 10), 'short_text', c.o), 'INVALID_REQUEST'), 'ok',
  'validator ' || c.n || ' is refused and nothing changes [P2-S09-AC-062]')
from (values ('key without version', '{"validatorKey":"cms.slug"}'::jsonb), ('version without key', '{"validatorVersion":1}'),
  ('pair outside the protected registry', '{"validatorKey":"caller.regex","validatorVersion":1}'),
  ('registered key at an unregistered version', '{"validatorKey":"cms.slug","validatorVersion":2}'),
  ('free-form regular expression in the key', '{"validatorKey":"^[a-z]+$","validatorVersion":1}'),
  ('executable expression in the key', '{"validatorKey":"return true","validatorVersion":1}'),
  ('pattern constraint instead of a registry reference', '{"constraints":{"pattern":"^[a-z]+$"}}'),
  ('expression constraint', '{"constraints":{"expression":"value.length > 3"}}'),
  ('code constraint', '{"constraints":{"code":"function(v){return v}"}}')) c(n, o);

-- ================================================= AC064 / AC065 / AC066 ====
select is(pg_temp.p_expect('def:' || c.n, 'a', pg_temp.p_efield('d_' || substr(md5(c.n), 1, 10), 'integer', c.o), 'OK'), 'ok', 'default ' || c.n || ' is accepted [P2-S09-AC-064]')
from (values ('none without a value', '{}'::jsonb), ('inherited without a value', '{"defaultMode":"inherited"}'), ('literal zero', '{"defaultMode":"literal","defaultValue":0}'),
  ('literal false', '{"defaultMode":"literal","defaultValue":false}'), ('literal empty string', '{"defaultMode":"literal","defaultValue":""}')) c(n, o);
select is((select count(*)::integer from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key like 'd\_%'
      and ((default_mode in ('none', 'inherited') and default_value is null) or (default_mode = 'literal' and default_value is not null))), 5,
  'none and inherited store SQL NULL while a literal stores the exact JSON value, falsy values included: missing and null stay distinct [P2-S09-AC-064]');
select is((select string_agg(default_value::text, ',' order by default_value::text) from platform_private.cms_field_definition_versions
    where content_type_version_id = pg_temp.s09d_id('a:version') and field_key like 'd\_%' and default_mode = 'literal'), '"",0,false', 'the literals 0, false and the empty string are stored exactly [P2-S09-AC-064]');
select is(pg_temp.p_expect('def:bad:' || c.n, 'a', pg_temp.p_efield('db_' || substr(md5(c.n), 1, 10), 'integer', c.o), 'INVALID_REQUEST'), 'ok',
  'default ' || c.n || ' is refused and nothing changes [P2-S09-AC-064]')
from (values ('literal without a value', '{"defaultMode":"literal"}'::jsonb), ('literal with a JSON null', '{"defaultMode":"literal","defaultValue":null}'),
  ('none with a value', '{"defaultMode":"none","defaultValue":1}'), ('inherited with a value', '{"defaultMode":"inherited","defaultValue":1}'),
  ('unknown mode', '{"defaultMode":"computed"}'), ('null mode', '{"defaultMode":null}')) c(n, o);
select is(pg_temp.p_expect('loc:' || m, 'a', pg_temp.p_efield('l_' || m, 'short_text', jsonb_build_object('localizationMode', m)), 'OK'), 'ok', 'localization mode ' || m || ' is accepted [P2-S09-AC-065]')
from unnest(array['none', 'localized', 'no_fallback']) m;
select is(pg_temp.p_expect('loc:bad:' || m, 'a', pg_temp.p_efield('lb_' || substr(md5(m), 1, 10), 'short_text', jsonb_build_object('localizationMode', m)), 'INVALID_REQUEST'), 'ok',
  'localization mode ' || m || ' is refused [P2-S09-AC-065]') from unnest(array['fallback', 'inherit', 'LOCALIZED', '', 'default_locale']) m;
select is(pg_temp.p_expect('loc:null', 'a', pg_temp.p_efield('l_nullmode', 'short_text', '{"localizationMode":null}'), 'INVALID_REQUEST'), 'ok',
  'a null localization mode is refused, not coerced to none [P2-S09-AC-065]');
select is((select string_agg(field_key || ':' || localization_mode, ',' order by field_key) from platform_private.cms_field_definition_versions
    where content_type_version_id = pg_temp.s09d_id('a:version') and field_key like 'l\_%'), 'l_localized:localized,l_no_fallback:no_fallback,l_none:none',
  'each declared mode is stored as declared [P2-S09-AC-065]');
select pg_temp.s09d_create_type('fr', 'p240_a02fr', 'editorial', 'owner', '["en-US","fr-FR"]'::jsonb, '{"en-US":["fr-FR"]}'::jsonb, 'fr-FR', 'fr-FR');
select is(pg_temp.p_expect('loc:infer', 'fr', pg_temp.p_efield('plain', 'short_text'), 'OK'), 'ok', 'a field is added to a type whose defaultLocale is fr-FR [P2-S09-AC-065]');
select is((select localization_mode from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('fr:version') and field_key = 'plain'), 'none',
  'localizationMode is exactly what was declared: it is not inferred from a non-default defaultLocale [P2-S09-AC-065]');
select is(pg_temp.p_expect('edit:ok', 'a', pg_temp.p_efield('e_max', 'short_text', jsonb_build_object('editorConfig', jsonb_build_object('label', repeat('x', 120), 'helpText', repeat('y', 500), 'order', 10000))), 'OK'), 'ok',
  'editorConfig at its maxima (label 120, helpText 500, order 10000) is accepted [P2-S09-AC-066]');
select is(pg_temp.p_expect('edit:min', 'a', pg_temp.p_efield('e_min', 'short_text', jsonb_build_object('editorConfig', jsonb_build_object('label', 'x', 'order', 0))), 'OK'), 'ok',
  'editorConfig at its minima (label 1, no helpText, order 0) is accepted [P2-S09-AC-066]');
select is(pg_temp.p_expect('edit:bad:' || c.n, 'a', pg_temp.p_efield('eb_' || substr(md5(c.n), 1, 10), 'short_text', jsonb_build_object('editorConfig', c.v)), 'INVALID_REQUEST'), 'ok',
  'editorConfig ' || c.n || ' is refused and nothing changes [P2-S09-AC-066]')
from (values ('with a 121 character label', jsonb_build_object('label', repeat('x', 121), 'order', 0)), ('with an empty label', '{"label":"","order":0}'::jsonb),
  ('with a 501 character helpText', jsonb_build_object('label', 'x', 'helpText', repeat('y', 501), 'order', 0)), ('with order 10001', '{"label":"x","order":10001}'),
  ('with a negative order', '{"label":"x","order":-1}'), ('with a fractional order', '{"label":"x","order":1.5}'), ('with a string order', '{"label":"x","order":"1"}'),
  ('without a label', '{"order":0}'), ('without an order', '{"label":"x"}'), ('with an unknown key', '{"label":"x","order":0,"html":"<b>"}'),
  ('as a string', '"x"'), ('as null', 'null')) c(n, v);

select * from finish();
rollback;
