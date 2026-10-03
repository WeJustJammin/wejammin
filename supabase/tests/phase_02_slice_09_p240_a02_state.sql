\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): CMS-03A-02
-- state rules (draft-only writes under CAS, identity, migration plan,
-- populated-data gate, lifecycle, no partial effect, failure mapping).  Every
-- candidate state is produced by the DEC-108 chain; no review, plan or approved
-- row is hand-built.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|',
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_type_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_reviews t),
    (select count(*) from platform_private.outbox_events), (select count(*) from audit_private.audit_events),
    (select count(*) from platform_private.idempotency_records)))
$body$;
create or replace function pg_temp.p_efield(p_key text, p_kind text, p_over jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select jsonb_build_object('key', p_key, 'kind', p_kind, 'constraints', '{}'::jsonb, 'required', false, 'validatorKey', null, 'validatorVersion', null,
    'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', initcap(p_key), 'order', 1), 'lifecycle', 'active') || p_over
$body$;
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
create or replace function pg_temp.p_expect(p_label text, p_tag text, p_field jsonb, p_expected text, p_over jsonb default '{}'::jsonb, p_actor text default 'owner')
returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  outcome := pg_temp.p_a02(p_label, p_tag, p_field, p_over, p_actor);
  return case when outcome = p_expected and (p_expected = 'OK' or before_fp = pg_temp.p_fp()) then 'ok'
    else 'bad:' || outcome || case when p_expected <> 'OK' and before_fp <> pg_temp.p_fp() then ' (state changed)' else '' end end;
end;
$body$;
create or replace function pg_temp.p_field_id(p_tag text, p_key text) returns uuid language sql stable as $body$
  select stable_field_id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = p_key
$body$;
create or replace function pg_temp.p_row(p_tag text, p_key text) returns text language sql stable as $body$
  select t::text from platform_private.cms_field_definition_versions t where content_type_version_id = pg_temp.s09d_id(p_tag || ':version') and field_key = p_key
$body$;

-- candidate states ----------------------------------------------------------
select pg_temp.s09d_create_type('a', 'p240_st_draft');
select pg_temp.s09d_create_type('rv', 'p240_st_review');
select pg_temp.s09d_to_review('rv');
select pg_temp.s09d_create_type('ap', 'p240_st_approved');
select pg_temp.s09d_to_approved('ap');
select pg_temp.s09d_create_type('ac', 'p240_st_active');
select pg_temp.s09d_to_active('ac');
select pg_temp.s09d_successor('sp', 'ac');
select pg_temp.s09d_to_active('sp');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('ac:version')), 'superseded', 'fixture: the first version is superseded by its activated successor');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('sp:version')), 'active', 'fixture: the successor is the active version');
select pg_temp.s09d_successor('b', 'sp');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09d_seal('b');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('b:plan')), 'ready', 'fixture: the successor candidate b has a sealed, ready additive plan');

-- ============================================ AC069 draft only, CAS, identity ====
select is(pg_temp.p_expect('st:draft', 'a', pg_temp.p_efield('ok1', 'short_text'), 'OK'), 'ok', 'control: a draft accepts a field change under its current CAS version [P2-S09-AC-069]');
select is((select version::text from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('a:version')), '2', 'the successful change advanced the draft CAS version exactly once [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:active', 'sp', pg_temp.p_efield('nope', 'short_text'), 'CONFLICT'), 'ok', 'an active version cannot be edited: CONFLICT and nothing changes [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:superseded', 'ac', pg_temp.p_efield('nope', 'short_text'), 'CONFLICT'), 'ok', 'a superseded version cannot be edited: CONFLICT and nothing changes [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:approved', 'ap', pg_temp.p_efield('nope', 'short_text'), 'CONFLICT'), 'ok', 'an approved (frozen) candidate cannot be edited: CONFLICT and nothing changes [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:stale', 'a', pg_temp.p_efield('stale1', 'short_text'), 'VERSION_MISMATCH', '{"expectedVersion":"1"}'), 'ok', 'a stale If-Match is VERSION_MISMATCH and the draft is unchanged [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:future', 'a', pg_temp.p_efield('stale2', 'short_text'), 'VERSION_MISMATCH', '{"expectedVersion":"99"}'), 'ok', 'a future version is refused the same way [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:badver', 'a', pg_temp.p_efield('stale3', 'short_text'), 'INVALID_REQUEST', '{"expectedVersion":"0"}'), 'ok', 'a non-positive expectedVersion is a malformed precondition [P2-S09-AC-069]');
select ok(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('rv:review')) = 'open', 'fixture: the review-state candidate has one open frozen review [P2-S09-AC-069]');
select is(pg_temp.p_a02('st:review', 'rv', pg_temp.p_efield('inreview', 'short_text')), 'OK', 'an unactivated candidate under review accepts an edit [P2-S09-AC-069]');
select ok(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('rv:version')) = 'draft'
    and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('rv:review')) = 'invalidated',
  'the edit returned the candidate to draft and invalidated its frozen review, so nothing approved survives an edit [P2-S09-AC-069]');
select is(pg_temp.p_expect('st:ident', 'a', pg_temp.p_efield('title', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('a', 'title'),
    'editorConfig', jsonb_build_object('label', 'Renamed label', 'order', 3))), 'OK'), 'ok', 'an existing field is changed through its stable identity [P2-S09-AC-069]');
select ok((select f.id = f.stable_field_id and f.version = 2 and f.field_key = 'title' and f.created_at <= f.updated_at and f.owner_id = pg_temp.s09d_id('ownerOrg')
      and f.created_by = pg_temp.s09d_actor_id('owner', 'auth')::uuid from platform_private.cms_field_definition_versions f where f.stable_field_id = pg_temp.p_field_id('a', 'title')),
  'identity (id, stable_field_id, key, owner, creator) is preserved and only the CAS version advanced [P2-S09-AC-069]');
select throws_ok(format('update platform_private.cms_field_definition_versions set stable_field_id = %L where stable_field_id = %L', extensions.gen_random_uuid(), pg_temp.p_field_id('a', 'title')),
  'P0001', null, 'a direct rewrite of a stable field identity is rejected by the identity guard [P2-S09-AC-069]');

-- ============================================ AC070 no partial effect ====
create function public.p240_fail_audit() returns trigger language plpgsql as $body$
begin
  if new.action = 'cms.schema.field.change' and current_setting('p240.fail', true) = 'on' then raise exception 'P240_FORCED_FAILURE'; end if;
  return new;
end;
$body$;
create trigger p240_fail_audit before insert on audit_private.audit_events for each row execute function public.p240_fail_audit();
create or replace function pg_temp.p_persist_failure() returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  perform set_config('p240.fail', 'on', true);
  outcome := pg_temp.p_a02('pf', 'a', pg_temp.p_efield('persist1', 'short_text'));
  perform set_config('p240.fail', 'off', true);
  return outcome || ' ' || (before_fp = pg_temp.p_fp())::text;
end;
$body$;
select is(pg_temp.p_persist_failure(), 'P240_FORCED_FAILURE true',
  'a persistence failure after the field insert and the aggregate version bump rolls both back: no partial field row, no aggregate mutation [P2-S09-AC-070]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_field_definition_versions where field_key = ''persist1'''), '0', 'the failed field does not exist [P2-S09-AC-070]');
drop trigger p240_fail_audit on audit_private.audit_events;
select is(pg_temp.p_expect('pf:val', 'a', pg_temp.p_efield('persist2', 'not_a_kind'), 'INVALID_REQUEST'), 'ok', 'a validation failure leaves no partial field row and no aggregate mutation [P2-S09-AC-070]');
select is(pg_temp.p_expect('pf:auth', 'a', pg_temp.p_efield('persist3', 'short_text'), 'FORBIDDEN', '{}', 'rev1'), 'ok', 'an authorization failure leaves no partial field row and no aggregate mutation [P2-S09-AC-070]');
select is(pg_temp.p_expect('pf:cas', 'a', pg_temp.p_efield('persist4', 'short_text'), 'VERSION_MISMATCH', '{"expectedVersion":"1"}'), 'ok', 'a stale-version refusal leaves no partial field row and no aggregate mutation [P2-S09-AC-070]');
select is(pg_temp.p_expect('pf:ok', 'a', pg_temp.p_efield('persist5', 'short_text'), 'OK'), 'ok', 'control: the same draft still accepts a valid change after the failures [P2-S09-AC-070]');

-- ================================== AC063 required over populated data, AC068 plan ====
select is(pg_temp.p_expect('pl:opt', 'a', pg_temp.p_efield('optfield', 'short_text'), 'OK'), 'ok', 'control: an optional field exists on the draft [P2-S09-AC-063]');
select is(pg_temp.p_expect('pl:req', 'a', pg_temp.p_efield('optfield', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('a', 'optfield'), 'required', true)), 'VALIDATION_FAILED'), 'ok',
  'making an optional field required without a proven migration plan is refused and the field stays optional [P2-S09-AC-063]');
select is((select required::text from platform_private.cms_field_definition_versions where stable_field_id = pg_temp.p_field_id('a', 'optfield')), 'false', 'the field is still optional [P2-S09-AC-063]');
select is(pg_temp.p_a02('pl:req:ok', 'b', pg_temp.p_efield('title', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('b', 'title'), 'required', true,
    'editorConfig', jsonb_build_object('label', 'Title', 'order', 0))), jsonb_build_object('migrationPlanId', pg_temp.s09d_id('b:plan'))), 'OK',
  'with the sealed ready plan of this candidate the same tightening is accepted [P2-S09-AC-063]');
select is(pg_temp.p_expect('pl:rand', 'a', pg_temp.p_efield('plan1', 'short_text'), 'VALIDATION_FAILED', jsonb_build_object('migrationPlanId', extensions.gen_random_uuid())), 'ok',
  'a migrationPlanId that names no ready plan of this version is refused [P2-S09-AC-068]');
select is(pg_temp.p_expect('pl:foreign', 'a', pg_temp.p_efield('plan2', 'short_text'), 'VALIDATION_FAILED', jsonb_build_object('migrationPlanId', pg_temp.s09d_id('b:plan'))), 'ok',
  'a ready plan that belongs to another candidate version is refused [P2-S09-AC-068]');
select is(pg_temp.p_expect('pl:malformed', 'a', pg_temp.p_efield('plan3', 'short_text'), 'INVALID_REQUEST', '{"migrationPlanId":"nope"}'), 'ok', 'a malformed migrationPlanId is refused [P2-S09-AC-068]');
select is(pg_temp.s09d_rpc('pl:missingkey', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'),
    'versionId', pg_temp.s09d_id('a:version'), 'field', pg_temp.p_efield('plan5', 'short_text'), 'expectedVersion', pg_temp.s09d_version('a'),
    'idempotencyKey', 'p240-planmissing-0001')) is null, true, 'a request without the migrationPlanId member fails [P2-S09-AC-068]');
select is(pg_temp.s09d_outcome('pl:missingkey'), 'INVALID_REQUEST', 'migrationPlanId is required-nullable: omitting the member is 400 INVALID_REQUEST, never read as null [P2-S09-AC-068]');
select is(pg_temp.p_expect('pl:additive', 'a', pg_temp.p_efield('plan6', 'short_text'), 'OK'), 'ok', 'null is permitted for an additive, no-data change [P2-S09-AC-068]');
select is(pg_temp.p_expect('pl:break', 'a', pg_temp.p_efield('optfield', 'integer', jsonb_build_object('stableFieldId', pg_temp.p_field_id('a', 'optfield'))), 'VALIDATION_FAILED'), 'ok',
  'a kind change of an existing field (breaking) with a null plan is refused and the kind is unchanged [P2-S09-AC-068]');
select is((select kind from platform_private.cms_field_definition_versions where stable_field_id = pg_temp.p_field_id('a', 'optfield')), 'short_text', 'the field kind is unchanged [P2-S09-AC-068]');
select is(pg_temp.p_a02('pl:break:ok', 'b', pg_temp.p_efield('title', 'long_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('b', 'title'),
    'editorConfig', jsonb_build_object('label', 'Title', 'order', 0))), jsonb_build_object('migrationPlanId', pg_temp.s09d_id('b:plan'))), 'OK',
  'the same kind change is accepted with the ready plan the candidate owns [P2-S09-AC-068]');

-- ============================================ AC067 lifecycle, no deletion shortcut ====
select is(pg_temp.p_expect('lc:' || l, 'a', pg_temp.p_efield('lc_' || l, 'short_text', jsonb_build_object('lifecycle', l)), 'OK'), 'ok', 'a new field may be declared ' || l || ' [P2-S09-AC-067]')
from unnest(array['active', 'deprecated', 'retired']) l;
select is((select string_agg(field_key || ':' || state, ',' order by field_key) from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('a:version') and field_key like 'lc\_%'),
  'lc_active:active,lc_deprecated:deprecated,lc_retired:retired', 'the physical lifecycle is the single state column of the field row [P2-S09-AC-067]');
select is(pg_temp.p_expect('lc:bad:' || l, 'a', pg_temp.p_efield('lcb_' || substr(md5(l), 1, 8), 'short_text', jsonb_build_object('lifecycle', l)), 'INVALID_REQUEST'), 'ok', 'lifecycle ' || l || ' is refused [P2-S09-AC-067]')
from unnest(array['draft', 'deleted', 'removed', 'ACTIVE', '']) l;
select is(pg_temp.p_expect('lc:dep', 'a', pg_temp.p_efield('lc_active', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('a', 'lc_active'), 'lifecycle', 'deprecated')), 'VALIDATION_FAILED'), 'ok',
  'deprecating an existing field is a lifecycle change that needs a migration plan: refused without one and the field stays active [P2-S09-AC-067]');
select is(pg_temp.p_a02('lc:dep:ok', 'b', pg_temp.p_efield('title', 'long_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('b', 'title'), 'lifecycle', 'deprecated',
    'editorConfig', jsonb_build_object('label', 'Title', 'order', 0))), jsonb_build_object('migrationPlanId', pg_temp.s09d_id('b:plan'))), 'OK', 'with the ready plan the field is deprecated, never deleted [P2-S09-AC-067]');
select is((select state from platform_private.cms_field_definition_versions where stable_field_id = pg_temp.p_field_id('b', 'title') and content_type_version_id = pg_temp.s09d_id('b:version')), 'deprecated', 'the deprecated field row still exists [P2-S09-AC-067] [P2-S09-AC-171]');
select set_config('app.cms_rpc', '', true);
select throws_ok(format('delete from platform_private.cms_field_definition_versions where stable_field_id = %L', pg_temp.p_field_id('a', 'lc_active')), 'P0001', 'IMMUTABLE_RECORD',
  'a direct DELETE of a field row outside a named RPC is rejected [P2-S09-AC-067] [P2-S09-AC-171]');
select set_config('app.cms_rpc', 'true', true);
select throws_ok(format('delete from platform_private.cms_field_definition_versions where stable_field_id = %L', pg_temp.p_field_id('sp', 'title')), 'P0001', 'IMMUTABLE_RECORD',
  'even inside an RPC context the field of an active version cannot be deleted [P2-S09-AC-067] [P2-S09-AC-171]');
select throws_ok(format('delete from platform_private.cms_field_definition_versions where stable_field_id = %L', pg_temp.p_field_id('a', 'lc_active')), 'P0001', 'IMMUTABLE_RECORD',
  'nor can the field of a draft: no definition is removed except by deprecation or retirement [P2-S09-AC-067]');
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09e_writers('cms_field_definition_versions', 'delete[[:space:]]+from'), '', 'no function deletes a field definition: there is no deletion shortcut [P2-S09-AC-067]');

-- ============================================ AC194 A02 failure mapping ====
select is(pg_temp.p_expect('f:val', 'a', pg_temp.p_efield('fx1', 'markdown'), 'INVALID_REQUEST'), 'ok', 'a validation failure maps to its declared token and leaves the prior draft unchanged [P2-S09-AC-194]');
select is(pg_temp.p_expect('f:forbid', 'a', pg_temp.p_efield('fx2', 'short_text'), 'FORBIDDEN', '{}', 'rev1'), 'ok', 'an authenticated human without cms.schema_designer is 403 FORBIDDEN and the draft is unchanged [P2-S09-AC-194]');
select is(pg_temp.p_expect('f:hidden', 'a', pg_temp.p_efield('fx3', 'short_text'), 'NOT_FOUND', '{}', 'other'), 'ok', 'a hidden parent is an indistinguishable 404 and the draft is unchanged [P2-S09-AC-194]');
select is(pg_temp.p_expect('f:immutable', 'a', pg_temp.p_efield('retitle', 'short_text', jsonb_build_object('stableFieldId', pg_temp.p_field_id('a', 'title'))), 'CONFLICT'), 'ok', 'an immutable-key change is 409 CONFLICT and the draft is unchanged [P2-S09-AC-194]');
select is(pg_temp.p_expect('f:stale', 'a', pg_temp.p_efield('fx4', 'short_text'), 'VERSION_MISMATCH', '{"expectedVersion":"1"}'), 'ok', 'a stale version is 409 VERSION_MISMATCH and the draft is unchanged [P2-S09-AC-194]');
select is(pg_temp.p_expect('f:migration', 'a', pg_temp.p_efield('fx5', 'short_text'), 'VALIDATION_FAILED', jsonb_build_object('migrationPlanId', extensions.gen_random_uuid())), 'ok', 'a migration-plan failure is refused and the draft is unchanged [P2-S09-AC-194]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), pg_temp.set_jwt_claim('sub', '', true);
select pg_temp.s09d_call('f:anon', 'platform_api.cms_add_field_definition', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'field', pg_temp.p_efield('fx6', 'short_text'), 'migrationPlanId', null, 'expectedVersion', '1', 'idempotencyKey', 'p240-anon-a02-0001'));
select is(pg_temp.s09d_outcome('f:anon'), 'UNAUTHENTICATED', 'a call with no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-194]');

select * from finish();
rollback;
