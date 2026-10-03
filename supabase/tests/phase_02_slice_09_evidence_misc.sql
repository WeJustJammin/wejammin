commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): OD-4 draft-command isolation, the
-- shared locale rule function behind CMS-03A-01/-09 and the validator, the
-- unreachable scheduled state, and the template-binding persistence rows.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- ------------------------------------------------ AC1186: only CMS-03A-01 (and -09) carry locale configuration ----
select pg_temp.s09d_create_type('l', 'evm_locale', 'editorial', 'owner',
  '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_scalar(format('select locale_config_hash from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('l:version'))) as locale_hash \gset
select pg_temp.s09d_rpc('l:field:locale:' || k, 'platform_api.cms_add_field_definition', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('l:type'), 'versionId', pg_temp.s09d_id('l:version'),
    'field', jsonb_build_object('key', 'summary', 'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', false,
      'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
      'editorConfig', jsonb_build_object('label', 'Summary', 'order', 1), 'lifecycle', 'active'),
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('l'),
    'idempotencyKey', 's09e-locale-field-' || k) || jsonb_build_object(k, v))
from (values ('supportedLocales', '["en-US"]'::jsonb), ('fallbackChains', '{}'::jsonb), ('sourceLocale', '"fr-FR"'::jsonb),
  ('defaultLocale', '"fr-FR"'::jsonb), ('localeConfigHash', to_jsonb(repeat('a', 64)))) as t(k, v);
select is(pg_temp.s09d_outcome('l:field:locale:' || k), 'INVALID_REQUEST',
  'CMS-03A-02 refuses ' || k || ': it cannot write the locale configuration [P2-S09-AC-1186]')
from unnest(array['supportedLocales', 'fallbackChains', 'sourceLocale', 'defaultLocale', 'localeConfigHash']) k;
select pg_temp.s09d_add_field_only('l');
select ok(pg_temp.s09d_outcome('l:field') = 'OK'
  and not (pg_temp.s09d_resp('l:field') ?| array['supportedLocales', 'fallbackChains', 'sourceLocale', 'defaultLocale', 'localeConfigHash']),
  'the CMS-03A-02 resource carries no locale configuration: it cannot read it [P2-S09-AC-1186]');
select pg_temp.s09d_rpc('l:relation:locale', 'platform_api.cms_bind_relation', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('l:type'), 'versionId', pg_temp.s09d_id('l:version'),
    'fieldId', pg_temp.s09d_id('l:fieldId'), 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder',
    'expectedVersion', pg_temp.s09d_version('l'), 'idempotencyKey', 's09e-locale-relation-0001', 'supportedLocales', '["en-US"]'::jsonb));
select ok(pg_temp.s09d_outcome('l:relation:locale') = 'VALIDATION_FAILED', 'CMS-03A-03 refuses a locale configuration key [P2-S09-AC-1186]');
select pg_temp.s09d_rpc('l:relation:control', 'platform_api.cms_bind_relation', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('l:type'), 'versionId', pg_temp.s09d_id('l:version'),
    'fieldId', pg_temp.s09d_id('l:fieldId'), 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder',
    'expectedVersion', pg_temp.s09d_version('l'), 'idempotencyKey', 's09e-locale-relation-0002'));
select is(pg_temp.s09d_outcome('l:relation:control'), 'OK', 'control: the same relation command without the extra key succeeds, so the key alone was the refusal [P2-S09-AC-1186]');
select is(pg_temp.s09d_scalar(format('select locale_config_hash from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('l:version'))),
  :'locale_hash', 'the draft''s locale configuration is fixed at insert: the draft commands left it unchanged [P2-S09-AC-1186]');

-- ------------------------------------------------ AC1203: one rule function behind the RPCs and the validator ----
select pg_temp.s09d_create_type('bad', 'evm_badlocale', 'editorial', 'owner', '[]', '{}');
select is((select jsonb_agg(v->>'message') from jsonb_array_elements(pg_temp.s09d_detail('bad:create')::jsonb->'violations') v),
  (select jsonb_agg(i->>'message') from jsonb_array_elements(platform_api.cms_validate_locale_config('en-US', 'en-US', '[]'::jsonb, '{}'::jsonb)) i),
  'the draft RPC refusal and the pure validator return the same messages in the same order [P2-S09-AC-1203]');
select ok(position('cms_locale_config_violations' in pg_temp.s09d_def('platform_api.cms_validate_locale_config(text,text,jsonb,jsonb)')) > 0
  and position('cms_locale_config_hash' in pg_temp.s09d_def('platform_private.cms_create_type_draft(jsonb)')) > 0
  and position('cms_locale_config_hash' in pg_temp.s09d_def('platform_private.cms_create_schema_successor(jsonb)')) > 0,
  'the pure validator wraps the single platform_private.cms_locale_config_violations rule function and the draft and successor RPCs compute localeConfigHash; that both RPCs actually run the validator is proved behaviourally in phase_02_slice_09_r8_locale_validator_path.sql [P2-S09-AC-1203]');

-- ------------------------------------------------ AC1206: scheduled is unreachable for schema versions ----
select pg_temp.s09d_create_type('s', 'evm_sched');
select pg_temp.s09d_to_approved('s');
select pg_temp.s09d_activate('s', 'owner', '{}'::jsonb, 's:sched', jsonb_build_object('scheduledAt', (now() + interval '1 day')::text));
select is(pg_temp.s09d_outcome('s:sched'), 'INVALID_REQUEST', 'CMS-03A-04 has no schedule field: a scheduledAt key is refused [P2-S09-AC-1206]');
select pg_temp.s09d_activate('s');
select ok(pg_temp.s09d_outcome('s:activate') = 'OK' and pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_content_type_versions where state = ''scheduled''') = '0',
  'activation is synchronous: no schema version row is ever in the scheduled state [P2-S09-AC-1206]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('platform_private', 'platform_api') and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~* 'update[[:space:]]+platform_private\.cms_content_type_versions'
     and pg_get_functiondef(p.oid) ~* '(set[^;]*state[[:space:]]*=[[:space:]]*''scheduled''|''scheduled''::platform_private\.cms_definition_state[[:space:]]*,?[[:space:]]*(version|updated_at)?)'), 0,
  'no function that updates cms_content_type_versions assigns the scheduled state [P2-S09-AC-1206]');
select ok(not exists (select 1 from platform_private.cms_content_type_versions where state = 'scheduled')
  and not exists (select 1 from platform_private.outbox_events where payload::text like '%"scheduled"%' and event_type like 'cms.schema.%'),
  'no schema-version resource, evidence record or event carries the scheduled state [P2-S09-AC-1206]');

-- ------------------------------------------------ AC169: template binding persistence ----
select pg_temp.s09d_create_type('tb', 'evm_tmplbind');
alter table platform_private.cms_content_type_template_bindings disable trigger user;
insert into platform_private.cms_content_type_template_bindings(owner_id, state, version, content_type_version_id, template_version_id, position)
select owner_id, 'draft', 1, id, extensions.gen_random_uuid(), 0 from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('tb:version');
alter table platform_private.cms_content_type_template_bindings enable trigger user;
create temp table s09e_binding on commit drop as select id from platform_private.cms_content_type_template_bindings limit 1;
select is(pg_temp.s09e_unique('cms_content_type_template_bindings', (select id from s09e_binding), array['content_type_version_id', 'template_version_id'],
    jsonb_build_object('template_version_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'UNIQUE(parent version, template version): one binding per parent/template pair (probe base row is a fixture row, not a producer path) [P2-S09-AC-169]');
select is(pg_temp.s09e_check('cms_content_type_template_bindings', 'cms_content_type_template_bindings_position_check', (select id from s09e_binding), '{"position":-1}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_content_type_template_bindings_position_check', 'position is non-negative [P2-S09-AC-169]');
select ok(pg_temp.s09d_has_columns('cms_content_type_template_bindings', array['id','owner_id','state','version','created_at','updated_at',
    'content_type_version_id','template_version_id','position']), 'the binding persists the IA envelope, parent version, template version UUID and position [P2-S09-AC-169]');
select ok(pg_temp.s09d_rls('cms_content_type_template_bindings') and pg_temp.s09d_no_direct_grants('cms_content_type_template_bindings'),
  'template bindings have forced RLS and no direct grants [P2-S09-AC-169]');
select ok(exists (select 1 from pg_trigger where tgrelid = 'platform_private.cms_content_type_template_bindings'::regclass and not tgisinternal and tgname = 'cms_content_type_template_bindings_parent_state_guard')
  and exists (select 1 from pg_trigger where tgrelid = 'platform_private.cms_content_type_template_bindings'::regclass and not tgisinternal and tgname = 'cms_draft_template_binding_compat_guard'),
  'a parent-state guard (immutable after activation) and a draft compatibility guard (the named compatibility check) are installed [P2-S09-AC-169]');

-- ------------------------------------------------ AC680: the scan refuses a registry entry that does not fit ----
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09d_create_type('rk', 'evm_registry');
select pg_temp.s09d_to_active('rk');
select pg_temp.s09w_entry('r1', 'rk', 'Alpha title');
select pg_temp.s09d_successor('rj', 'rk');
select pg_temp.s09d_dry_run('rj');
select pg_temp.s09w_dry_run('rj');
select pg_temp.s09w_redefine('rj', 'rich_text', '{}'::jsonb);
select is(pg_temp.s09d_outcome('rj:redefine'), 'OK', 'fixture: the candidate''s title changes kind (a breaking change) under its ready plan');
select pg_temp.s09d_dry_run('rj', 'owner', 'default.fill_literal', '1', 's09e-registry-fill-0001');
select is(pg_temp.s09d_outcome('rj:dryRun'), 'VALIDATION_FAILED',
  'default.fill_literal does not accept the rich_text target kind: CMS-03A-10 refuses the pair before any attempt exists [P2-S09-AC-680] [P2-S09-AC-356]');
select is(pg_temp.s09d_detail('rj:dryRun'), 'TRANSFORM_FIELD_KIND_MISMATCH',
  'the machine detail is TRANSFORM_FIELD_KIND_MISMATCH [P2-S09-AC-680] [P2-S09-AC-356]');
-- AC356: every 422 VALIDATION_FAILED row of CMS-03A-10 is produced by the real command against the candidate
-- 'rj', which the title kind change made breaking.  Each refusal commits nothing (fingerprint unchanged).
create or replace function pg_temp.s09e_pair(p_label text, p_key jsonb, p_version jsonb, p_extra jsonb default '{}'::jsonb) returns text
language plpgsql as $body$
declare before_fp text := pg_temp.s09d_fingerprint(false);
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_start_schema_dry_run', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('rj:type'), 'versionId', pg_temp.s09d_id('rj:version'),
      'expectedVersion', pg_temp.s09d_version('rj'), 'transformKey', p_key, 'transformVersion', p_version,
      'idempotencyKey', 's09e-356-' || p_label) || p_extra);
  return pg_temp.s09d_outcome(p_label) || '|' || (before_fp = pg_temp.s09d_fingerprint(false))::text;
end;
$body$;
select is(pg_temp.s09e_pair('p:' || c.n, c.k, c.v), 'VALIDATION_FAILED|true',
  'CMS-03A-10 refuses a transform pair ' || c.n || ' with 422 and commits nothing [P2-S09-AC-356]')
from (values
  ('with a key and no version', '"identity.revalidate"'::jsonb, 'null'::jsonb),
  ('with a version and no key', 'null'::jsonb, '"1"'::jsonb),
  ('whose key is not a string', '7'::jsonb, '"1"'::jsonb),
  ('whose version is not a string', '"identity.revalidate"'::jsonb, '1'::jsonb),
  ('whose key breaks the ValidatorKey grammar', '"Identity.Revalidate"'::jsonb, '"1"'::jsonb),
  ('whose version is not a canonical positive decimal', '"identity.revalidate"'::jsonb, '"01"'::jsonb),
  ('whose version is zero', '"identity.revalidate"'::jsonb, '"0"'::jsonb),
  ('absent although the derived classification is breaking', 'null'::jsonb, 'null'::jsonb),
  ('naming a key outside the code-owned registry', '"cms.unregistered"'::jsonb, '"1"'::jsonb),
  ('naming a registered key at an unregistered version', '"identity.revalidate"'::jsonb, '"2"'::jsonb)
) c(n, k, v);
select is(pg_temp.s09e_pair('p:count', '"identity.revalidate"'::jsonb, '"1"'::jsonb, '{"sourceCount":"3"}'::jsonb), 'INVALID_REQUEST|true',
  'a caller-supplied count is refused and commits nothing: the counts are database-derived, never an input (400 at the database; BE03a row 234 text says 422) [P2-S09-AC-356]');
-- A classification that cannot be derived: the candidate''s source version must belong to the same type and
-- owner.  No producer can create such a candidate (CMS-03A-09 only clones a readable source of its own type),
-- so the state below is a negative-control forgery under disabled guards, rolled back inside the function.
select pg_temp.s09d_create_type('ro', 'evm_undrv');
select pg_temp.s09d_to_active('ro');
select pg_temp.s09d_successor('rp', 'ro');
create or replace function pg_temp.s09e_underivable() returns text language plpgsql as $body$
declare observed text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_content_type_versions disable trigger user;
    perform set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions set supersedes_id = pg_temp.s09d_id('rk:version') where id = pg_temp.s09d_id('rp:version');
    alter table platform_private.cms_content_type_versions enable trigger user;
    perform pg_temp.s09d_rpc('p:underivable', 'platform_api.cms_start_schema_dry_run', 'owner',
      jsonb_build_object('contentTypeId', pg_temp.s09d_id('rp:type'), 'versionId', pg_temp.s09d_id('rp:version'),
        'expectedVersion', pg_temp.s09d_version('rp'), 'transformKey', null, 'transformVersion', null,
        'idempotencyKey', 's09e-356-underivable'));
    observed := pg_temp.s09d_outcome('p:underivable') || '|' || (select count(*) from platform_private.cms_schema_dry_run_reports where target_version_id = pg_temp.s09d_id('rp:version'));
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then return 'ERROR:' || sqlerrm; end if;
  end;
  return observed;
end;
$body$;
select is(pg_temp.s09e_underivable(), 'VALIDATION_FAILED|0',
  'a candidate whose source cannot be read from its own type and owner has no derivable classification: 422 before any attempt, plan or job exists [P2-S09-AC-356]');
select pg_temp.s09d_dry_run('rj', 'owner', 'identity.revalidate', '1', 's09e-registry-identity-0001');
select ok(pg_temp.s09d_outcome('rj:dryRun') = 'OK'
  and (select transform_key = 'identity.revalidate' and transform_version = 1 from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('rj:plan')),
  'identity.revalidate accepts every IA field kind, is admitted, and the plan stores the resolved key and version [P2-S09-AC-680]');
create or replace function pg_temp.s09e_registry_tamper(p_set text) returns text language plpgsql as $body$
declare observed text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_schema_transform_registry disable trigger user;
    execute format('update platform_private.cms_schema_transform_registry set %s where transform_key = ''identity.revalidate''', p_set);
    perform pg_temp.s09d_dry_run('rj', 'owner', 'identity.revalidate', '1', 's09e-registry-tamper-' || md5(p_set));
    observed := coalesce(platform_private.cms_transform_registry_member('identity.revalidate', 1)::text, 'NULL') || '|' || pg_temp.s09d_outcome('rj:dryRun')
      || '|' || coalesce(pg_temp.s09d_detail('rj:dryRun'), '');
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then return 'ERROR:' || sqlerrm; end if;
  end;
  return observed;
end;
$body$;
select is(pg_temp.s09e_registry_tamper($q$target_constraints = '{"maxLength": 1}'::jsonb$q$), 'NULL|VALIDATION_FAILED|',
  'a registry entry whose target constraints no longer match its digest never resolves and the scan is refused [P2-S09-AC-680]');
select is(pg_temp.s09e_registry_tamper($q$source_constraints = '{"maxLength": 1}'::jsonb$q$), 'NULL|VALIDATION_FAILED|',
  'a registry entry whose source constraints no longer match its digest never resolves [P2-S09-AC-680]');
select is(pg_temp.s09e_registry_tamper($q$accepted_field_kinds = '["short_text"]'::jsonb$q$), 'NULL|VALIDATION_FAILED|',
  'a registry entry whose accepted field kinds no longer match its digest never resolves [P2-S09-AC-680]');
select is(pg_temp.s09e_registry_tamper($q$digest = repeat('0', 64)$q$), 'NULL|VALIDATION_FAILED|',
  'a registry entry whose digest no longer matches its columns never resolves [P2-S09-AC-680]');

-- ------------------------------------------------ AC181: RLS on every BE03a table ----
select is((select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%'
      and c.relname <> 'cms_operational_alert_deliveries'
      and not (c.relrowsecurity and c.relforcerowsecurity)), null,
  'RLS is enabled and forced on every cms_ table (the alert delivery receipt table belongs to AC209, not BE03a) [P2-S09-AC-181]');
select is((select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'platform_private' and c.relkind = 'r' and c.relname like 'cms\_%'
      and exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r(role_name)
                  cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p(privilege)
                  where has_table_privilege(r.role_name, c.oid, p.privilege))), null,
  'no cms_ table grants any direct privilege to anon, authenticated or service_role [P2-S09-AC-181]');
select is((select count(*)::integer from pg_policies p
    where p.schemaname = 'platform_private' and p.tablename like 'cms\_%' and p.tablename <> 'cms_operational_alert_deliveries'
      and p.permissive = 'PERMISSIVE'
      and (p.qual is distinct from 'platform_private.cms_rpc_context_valid()' or p.with_check is distinct from 'platform_private.cms_rpc_context_valid()')
      and p.tablename not in ('cms_schema_transform_registry', 'cms_workflow_policies')), 0,
  'every permissive read predicate and WITH CHECK is the schema-qualified platform_private.cms_rpc_context_valid() gate [P2-S09-AC-181]');
select is((select count(*)::integer from pg_policies p
    where p.schemaname = 'platform_private' and p.tablename like 'cms\_%' and p.tablename <> 'cms_operational_alert_deliveries'
      and p.permissive = 'RESTRICTIVE'
      and (p.policyname !~ '_session_scope(_insert|_update|_delete)?$'
           or coalesce(p.qual, '') || coalesce(p.with_check, '') !~ 'platform_private\.cms_session_scope_ok')), 0,
  'every other cms_ policy is a RESTRICTIVE session-scope policy (AND-ed with the RPC gate) that calls the session-resolving helper [P2-S09-AC-181]');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = 'platform_private.cms_rpc_context_valid()'::regprocedure),
  'the gate is SECURITY DEFINER with a pinned empty search_path [P2-S09-AC-181]');
select set_config('app.cms_rpc', '', true);
select throws_ok($q$set local role authenticated; select count(*) from platform_private.cms_schema_reviews$q$, '42501', null,
  'an authenticated session cannot read a CMS table even when it sets the RPC context flag itself: the table grants are revoked [P2-S09-AC-181]');
reset role;
select throws_ok($q$set local role service_role; select count(*) from platform_private.cms_content_type_versions$q$, '42501', null,
  'the service role has no table grant either: reads go only through the scope-filtered RPCs [P2-S09-AC-181]');
reset role;

-- ------------------------------------------------ AC716: ambiguity also fails closed ----
select ok(platform_private.cms_editorial_workflow_policy_evidence(pg_temp.s09d_id('rk:version')) is not null,
  'control: an activated type resolves its bound policy evidence');
create or replace function pg_temp.s09e_evidence_after_ambiguity() returns text language plpgsql as $body$
declare observed text;
begin
  begin
    set constraints all immediate;
    alter table platform_private.cms_workflow_policies disable trigger user;
    alter table platform_private.cms_workflow_policies drop constraint cms_workflow_policies_member_unique;
    insert into platform_private.cms_workflow_policies(owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities)
      select owner_id, state, version, policy_key, policy_version, policy_hash, risk_class, required_decision_count, required_capabilities
        from platform_private.cms_workflow_policies where policy_key = 'editorial' and policy_version = 1;
    observed := coalesce(platform_private.cms_editorial_workflow_policy_evidence(pg_temp.s09d_id('rk:version'))::text, 'NULL');
    raise exception 'S09E_ROLLBACK';
  exception when others then
    if sqlerrm <> 'S09E_ROLLBACK' then return 'ERROR:' || sqlerrm; end if;
  end;
  return observed;
end;
$body$;
select is(pg_temp.s09e_evidence_after_ambiguity(), 'NULL',
  'the editorial policy evidence function returns NULL when the bound member is ambiguous (two rows) [P2-S09-AC-716]');

select * from finish();
rollback;
