commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 P241 (AC004, database half): CMS-03A-02 (add or change a field) and
-- CMS-03A-03 (bind a relation) edit only an existing unactivated draft version,
-- and no child definition is committed or exposed on its own.  A draft accepts
-- both commands; an approved, an active and a superseded version answer
-- CONFLICT and every refusal leaves definitions, versions, artifacts, audit,
-- outbox and idempotency state byte-identical.  There is no standalone child
-- command: a request that omits the owning version, names a version of another
-- type, or carries a body-supplied version is refused, and a direct write to the
-- child tables is refused.  Every candidate is produced through named commands.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

create or replace function pg_temp.s09f_fp() returns text language sql as $body$
  select md5(concat_ws('|',
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_relation_definitions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_type_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select count(*) from platform_private.outbox_events), (select count(*) from audit_private.audit_events),
    (select count(*) from platform_private.idempotency_records)))
$body$;
create or replace function pg_temp.s09f_a02(p_label text, p_tag text, p_key text, p_over jsonb default '{}'::jsonb, p_drop text default null, p_kind text default 'relation')
returns jsonb language plpgsql as $body$
declare req jsonb; resource jsonb;
begin
  req := jsonb_build_object(
    'contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'),
    'field', jsonb_build_object('key', p_key, 'kind', p_kind, 'constraints', '{}'::jsonb, 'required', false,
      'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', p_key, 'order', 1), 'lifecycle', 'active'),
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag),
    'idempotencyKey', 'p241-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over;
  if p_drop is not null then req := req - p_drop; end if;
  resource := pg_temp.s09d_rpc(p_label, 'platform_api.cms_add_field_definition', 'owner', req);
  return resource;
end;
$body$;
create or replace function pg_temp.s09f_a03(p_label text, p_tag text, p_field uuid, p_over jsonb default '{}'::jsonb, p_drop text default null)
returns jsonb language plpgsql as $body$
declare req jsonb;
begin
  req := jsonb_build_object(
    'contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'), 'fieldId', p_field,
    'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3,
    'ordered', false, 'onUnavailable', 'placeholder', 'expectedVersion', pg_temp.s09d_version(p_tag),
    'idempotencyKey', 'p241-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over;
  if p_drop is not null then req := req - p_drop; end if;
  return pg_temp.s09d_rpc(p_label, 'platform_api.cms_bind_relation', 'owner', req);
end;
$body$;
-- 'ok' only when the outcome is the expected token (or one of the '|'-separated
-- tokens) and nothing changed.
create or replace function pg_temp.s09f_refused(p_label text, p_expected text, p_before text) returns text
language sql as $body$
  select case when pg_temp.s09d_outcome(p_label) = any(string_to_array(p_expected, '|')) and p_before = pg_temp.s09f_fp() then 'ok'
    else 'bad:' || pg_temp.s09d_outcome(p_label) || case when p_before <> pg_temp.s09f_fp() then ' (state changed)' else '' end end
$body$;

-- ------------------------------------------------------------ the draft ----
select pg_temp.s09d_create_type('a', 'p241_ac004');
select pg_temp.s09d_create_type('f', 'p241_ac004_foreign');
select pg_temp.s09f_a02('a:f1', 'a', 'rel_one');
select is(pg_temp.s09d_outcome('a:f1'), 'OK', 'CMS-03A-02 adds a field to an existing unactivated draft [P2-S09-AC-004]');
select pg_temp.s09d_remember('a:field1', (pg_temp.s09d_resp('a:f1')->>'id')::uuid);
select pg_temp.s09f_a03('a:r1', 'a', pg_temp.s09d_id('a:field1'));
select is(pg_temp.s09d_outcome('a:r1'), 'OK', 'CMS-03A-03 binds a relation on a field of an existing unactivated draft [P2-S09-AC-004]');
select pg_temp.s09f_a02('a:f2', 'a', 'plain_two', '{}'::jsonb, null, 'short_text');
select pg_temp.s09d_remember('a:field2', (pg_temp.s09d_resp('a:f2')->>'id')::uuid);
select is((select count(*)::integer from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version')), 3,
  'every committed child is owned by the draft version: title, rel_one and plain_two [P2-S09-AC-004]');

-- ------------------------------------- approved, active, superseded refuse ----
select pg_temp.s09d_to_approved('a');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'approved', 'fixture: the candidate is approved through the real review chain');
create temp table s09f_before_approved on commit drop as select pg_temp.s09f_fp() as fp;
select pg_temp.s09f_a02('x:approved-field', 'a', 'late_field');
select is(pg_temp.s09f_refused('x:approved-field', 'CONFLICT', (select fp from s09f_before_approved)), 'ok',
  'an approved version refuses CMS-03A-02 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');
select pg_temp.s09f_a03('x:approved-rel', 'a', pg_temp.s09d_id('a:field1'));
select is(pg_temp.s09f_refused('x:approved-rel', 'CONFLICT', (select fp from s09f_before_approved)), 'ok',
  'an approved version refuses CMS-03A-03 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');

select pg_temp.s09d_activate('a');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'active', 'fixture: the candidate is active');
create temp table s09f_before_active on commit drop as select pg_temp.s09f_fp() as fp;
select pg_temp.s09f_a02('x:active-field', 'a', 'late_field');
select is(pg_temp.s09f_refused('x:active-field', 'CONFLICT', (select fp from s09f_before_active)), 'ok',
  'an active version refuses CMS-03A-02 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');
select pg_temp.s09f_a03('x:active-rel', 'a', pg_temp.s09d_id('a:field1'));
select is(pg_temp.s09f_refused('x:active-rel', 'CONFLICT', (select fp from s09f_before_active)), 'ok',
  'an active version refuses CMS-03A-03 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');

select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_to_active('b');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'superseded', 'fixture: the first version is superseded by the second activation');
create temp table s09f_before_superseded on commit drop as select pg_temp.s09f_fp() as fp;
select pg_temp.s09f_a02('x:superseded-field', 'a', 'late_field');
select is(pg_temp.s09f_refused('x:superseded-field', 'CONFLICT', (select fp from s09f_before_superseded)), 'ok',
  'a superseded version refuses CMS-03A-02 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');
select pg_temp.s09f_a03('x:superseded-rel', 'a', pg_temp.s09d_id('a:field1'));
select is(pg_temp.s09f_refused('x:superseded-rel', 'CONFLICT', (select fp from s09f_before_superseded)), 'ok',
  'a superseded version refuses CMS-03A-03 with 409 CONFLICT and changes nothing [P2-S09-AC-004]');

-- ------------------------------ a draft successor is the only edit target ----
select pg_temp.s09d_successor('c', 'b');
select pg_temp.s09f_a02('c:field', 'c', 'successor_field');
select is(pg_temp.s09d_outcome('c:field'), 'OK', 'the next unactivated draft (a successor) accepts CMS-03A-02 [P2-S09-AC-004]');

-- ----------------------------------------------- no standalone child write ----
create temp table s09f_before_standalone on commit drop as select pg_temp.s09f_fp() as fp;
select pg_temp.s09f_a02('s:no-version', 'c', 'orphan', '{}'::jsonb, 'versionId');
select is(pg_temp.s09f_refused('s:no-version', 'INVALID_REQUEST', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-02 without the owning version is refused (400) and no child is committed [P2-S09-AC-004]');
select pg_temp.s09f_a02('s:no-type', 'c', 'orphan', '{}'::jsonb, 'contentTypeId');
select is(pg_temp.s09f_refused('s:no-type', 'INVALID_REQUEST', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-02 without the owning content type is refused (400) [P2-S09-AC-004]');
select pg_temp.s09f_a02('s:body-version', 'c', 'orphan', jsonb_build_object('contentTypeVersionId', pg_temp.s09d_id('c:version')));
select is(pg_temp.s09f_refused('s:body-version', 'INVALID_REQUEST', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-02 refuses a body-supplied version member (400) [P2-S09-AC-004]');
select pg_temp.s09f_a02('s:other-type', 'c', 'orphan', jsonb_build_object('contentTypeId', pg_temp.s09d_id('f:type')));
select is(pg_temp.s09f_refused('s:other-type', 'NOT_FOUND', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-02 addressed to a version that is not in the named content type is a 404 and no child is committed [P2-S09-AC-004]');
select pg_temp.s09f_a03('s:rel-no-version', 'c', pg_temp.s09d_id('a:field1'), '{}'::jsonb, 'versionId');
select is(pg_temp.s09f_refused('s:rel-no-version', 'INVALID_REQUEST|VALIDATION_FAILED', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-03 without the owning version is refused and no relation is committed [P2-S09-AC-004]');
select pg_temp.s09f_a03('s:rel-foreign-field', 'c', pg_temp.s09d_id('a:field1'));
select is(pg_temp.s09f_refused('s:rel-foreign-field', 'VALIDATION_FAILED', (select fp from s09f_before_standalone)), 'ok',
  'CMS-03A-03 on a field that belongs to another version is refused (422, AC073) and no relation is committed [P2-S09-AC-004]');

select ok(pg_temp.s09d_has_columns('cms_field_definition_versions', array['content_type_version_id'])
    and (select is_nullable = 'NO' from information_schema.columns
          where table_schema = 'platform_private' and table_name = 'cms_field_definition_versions' and column_name = 'content_type_version_id')
    and exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_field_definition_versions'::regclass and contype = 'f'
          and confrelid = 'platform_private.cms_content_type_versions'::regclass),
  'a field definition row cannot exist without an owning version: NOT NULL plus a foreign key to the version [P2-S09-AC-004]');
select ok(pg_temp.s09d_no_direct_grants('cms_field_definition_versions') and pg_temp.s09d_no_direct_grants('cms_relation_definitions'),
  'no API role holds a direct table grant on the field or relation definitions [P2-S09-AC-004]');
select set_config('app.cms_rpc', 'false', true);
select ok(not pg_temp.s09d_try(format($q$insert into platform_private.cms_field_definition_versions(
    owner_id, state, version, content_type_version_id, stable_field_id, field_key, kind, constraints, required,
    default_mode, localization_mode, editor_config, created_by)
  select owner_id, 'active', 1, id, extensions.gen_random_uuid(), 'forged_child', 'short_text', '{}'::jsonb, false,
    'none', 'none', '{"label":"Forged","order":9}'::jsonb, created_by
  from platform_private.cms_content_type_versions where id = %L$q$, pg_temp.s09d_id('c:version'))),
  'negative control: a child definition written outside the named command is refused by the guard [P2-S09-AC-004]');
select * from finish();
rollback;
