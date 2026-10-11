\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 (AC217; P2-S09-AC-217): the field-definition validator accepts the common field shape without the
-- full rule walk (supabase/migrations/20261010167000_cms_valid_field_input_fast_accept.sql).  Create validates
-- every field of a 128-field definition once and activation twice, so the validator decides the 300 ms RPC
-- budget of the 128-field benchmark.  The replacement is performance-only: it may only
-- ANSWER TRUE EARLIER, for an input it can fully verify; every other input, and every refusal, still goes through
-- the previous rules unchanged.  This suite proves it by running the VERBATIM previous body (installed as
-- platform_private.cms_valid_field_input_legacy for the length of this transaction) and the installed function on a
-- corpus of field inputs (the base, every variant of every member alone, 3,000 deterministic mixtures, inputs that
-- are not objects, every word cms_reserved_key refuses) with p_require_stable_id true, false and NULL, and
-- requiring the same answer (or the same SQLSTATE).  It then shows, by counting the calls the previous rules make to
-- cms_exact_keys, WHICH inputs took the early accept: the 128-field benchmark shape and the shapes the Studio
-- authors do, and none that the previous body refuses.

\ir phase_02_slice_09_valid_field_input_fast_accept/00-legacy-body.sqlinc
\ir phase_02_slice_09_valid_field_input_fast_accept/01-corpus.sqlinc

-- ---- the replacement kept the identity of the function ----------------------------------------------------
select is((select md5(p.prosrc) from pg_proc p where p.oid = 'platform_private.cms_valid_field_input_legacy(jsonb,boolean)'::regprocedure),
  'f3fbc53fdde3f16a338c3edadc94a02b',
  'fixture: the legacy copy is the body that 20261010167000 pins by md5 before replacing it [P2-S09-AC-217]');
select isnt((select md5(p.prosrc) from pg_proc p where p.oid = 'platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure),
  'f3fbc53fdde3f16a338c3edadc94a02b',
  'the installed cms_valid_field_input carries the early accept, not the previous body [P2-S09-AC-217]');
select is((select pg_get_userbyid(p.proowner) from pg_proc p where p.oid = 'platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure),
  'postgres', 'the replacement keeps its owner [P2-S09-AC-217]');
select is((select p.provolatile = 'i' and not p.prosecdef and not p.proisstrict and p.proconfig = array['search_path=""']
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql') and p.prorettype = 'boolean'::regtype
      and pg_get_function_arguments(p.oid) = 'p_value jsonb, p_require_stable_id boolean DEFAULT true'
    from pg_proc p where p.oid = 'platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure),
  true, 'the replacement is IMMUTABLE, not SECURITY DEFINER, not strict, plpgsql, pins an empty search_path and keeps the signature and the default [P2-S09-AC-217]');
select is((select p.proacl::text from pg_proc p where p.oid = 'platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure),
  '{postgres=X/postgres,wejammin_cms_definer=X/postgres}',
  'the replacement keeps the ACL of the function it replaces (the CMS definer role and the owner only) [P2-S09-AC-217]');
select is((select string_agg(r.rolname, ',' order by r.rolname) from (values ('anon'), ('authenticated'), ('service_role'), ('wejammin_cms_authority_reader'), ('wejammin_platform_definer')) r(rolname)
    where has_function_privilege(r.rolname, 'platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure, 'EXECUTE')),
  null, 'no API role and no other dedicated role can execute the validator, as before [P2-S09-AC-217]');
select ok(obj_description('platform_private.cms_valid_field_input(jsonb,boolean)'::regprocedure, 'pg_proc') like 'BE03a field definition input.%',
  'the function comment survived the replacement [P2-S09-AC-217]');
select ok((select count(*) from fi_cases) >= 3000 and (select count(*) from fi_dim where dim = 'key') > 150,
  'fixture: the corpus holds the base, every variant alone, 3,000 mixtures and every reserved word in three spellings [P2-S09-AC-217]');

-- ---- previous body and current body on the same inputs ------------------------------------------------------
-- A call that raises is compared by its SQLSTATE (the previous body returns false for the casts it can hit, and
-- raises for nothing else on this corpus; both must still do the same).
create or replace function pg_temp.fi_new(p_value jsonb, p_flag boolean) returns text language plpgsql as $body$
begin return platform_private.cms_valid_field_input(p_value, p_flag)::text;
exception when others then return 'ERR:' || sqlstate; end $body$;
create or replace function pg_temp.fi_old(p_value jsonb, p_flag boolean) returns text language plpgsql as $body$
begin return platform_private.cms_valid_field_input_legacy(p_value, p_flag)::text;
exception when others then return 'ERR:' || sqlstate; end $body$;
create temp table fi_results on commit drop as
select c.n, c.label, c.value,
  pg_temp.fi_new(c.value, true) as new_true, pg_temp.fi_old(c.value, true) as old_true,
  pg_temp.fi_new(c.value, false) as new_false, pg_temp.fi_old(c.value, false) as old_false,
  pg_temp.fi_new(c.value, null) as new_null, pg_temp.fi_old(c.value, null) as old_null
from fi_cases c order by c.n;

select is((select string_agg(label || ' new=' || new_true || ' old=' || old_true, ' | ' order by n) from (select * from fi_results where new_true is distinct from old_true limit 5) m),
  null, 'p_require_stable_id = true: the current function answers exactly what the previous body answers on every corpus input [P2-S09-AC-217]');
select is((select string_agg(label || ' new=' || new_false || ' old=' || old_false, ' | ' order by n) from (select * from fi_results where new_false is distinct from old_false limit 5) m),
  null, 'p_require_stable_id = false (the incremental edit path): the answers are identical on every corpus input [P2-S09-AC-217]');
select is((select string_agg(label || ' new=' || new_null || ' old=' || old_null, ' | ' order by n) from (select * from fi_results where new_null is distinct from old_null limit 5) m),
  null, 'p_require_stable_id = NULL: the answers are identical on every corpus input [P2-S09-AC-217]');
select ok((select count(*) filter (where old_true = 'true') from fi_results) >= 400 and (select count(*) filter (where old_true = 'false') from fi_results) >= 1500,
  'the comparison is not vacuous: the previous body accepts at least 400 and refuses at least 1,500 corpus inputs [P2-S09-AC-217]');
select ok((select count(*) filter (where old_true like 'ERR:%') from fi_results) = 0,
  'the previous body raises on no corpus input (every malformed value is answered false) [P2-S09-AC-217]');

-- ---- which inputs take the early accept -----------------------------------------------------------------------
-- The previous rules open with cms_exact_keys, so an input that never reaches it was accepted early.  A counting copy
-- of cms_exact_keys (the same body, in this transaction only) tells them apart.
create or replace function platform_private.cms_exact_keys(
  p_value jsonb,
  p_required text[],
  p_allowed text[]
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $body$
declare
  key_name text;
begin
  perform pg_catalog.set_config('fi.exact_keys_calls',
    (coalesce(nullif(pg_catalog.current_setting('fi.exact_keys_calls', true), ''), '0')::integer + 1)::text, true);
  if p_value is null or pg_catalog.jsonb_typeof(p_value) <> 'object' then return false; end if;
  if p_required is not null and cardinality(p_required) > 0 and not p_value ?& p_required then return false; end if;
  for key_name in select value from pg_catalog.jsonb_object_keys(p_value) as value loop
    if p_allowed is null or not key_name = any(p_allowed) then return false; end if;
  end loop;
  return true;
end;
$body$;
create or replace function pg_temp.fi_calls(p_value jsonb) returns integer language plpgsql as $body$
begin
  perform set_config('fi.exact_keys_calls', '0', true);
  perform platform_private.cms_valid_field_input(p_value, true);
  return current_setting('fi.exact_keys_calls')::integer;
exception when others then return -1;
end $body$;
create temp table fi_paths on commit drop as select r.n, r.label, r.old_true, pg_temp.fi_calls(r.value) as calls from fi_results r order by r.n;

select diag(format('corpus: %s inputs, previous body accepts %s and refuses %s; early accept on %s, full rules on %s', (select count(*) from fi_paths), (select count(*) from fi_paths where old_true = 'true'),
    (select count(*) from fi_paths where old_true = 'false'), (select count(*) from fi_paths where calls = 0), (select count(*) from fi_paths where calls > 0)));
select is((select string_agg(label, ' | ' order by n) from (select * from fi_paths where calls = 0 and old_true is distinct from 'true' limit 5) m),
  null, 'soundness: no input the previous body refuses is accepted early [P2-S09-AC-217]');
select ok((select count(*) from fi_paths where calls = 0) >= 400,
  'the early accept is taken on at least 400 corpus inputs [P2-S09-AC-217]');
select ok((select count(*) from fi_paths where calls > 0) >= 1500,
  'the full rules still decide at least 1,500 corpus inputs [P2-S09-AC-217]');
select is((select count(*)::integer from fi_paths where label = 'base' and calls = 0), 1, 'the base field is accepted early [P2-S09-AC-217]');

-- The 128-field benchmark shape (phase_02_slice_09_evidence_bench128.sql) and the shapes a Studio author writes.
create temp table fi_shapes(label text, value jsonb) on commit drop;
insert into fi_shapes
select 'bench128 f' || lpad(g::text, 3, '0'), jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'f' || lpad(g::text, 3, '0'),
  'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', g = 1, 'validatorKey', null, 'validatorVersion', null,
  'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', 'Field ' || g, 'order', g), 'lifecycle', 'active')
from generate_series(1, 128) g;
insert into fi_shapes
select 'authored ' || k || ' ' || c.name, jsonb_build_object('stableFieldId', extensions.gen_random_uuid(), 'key', 'field_' || k, 'kind', k,
  'constraints', c.constraints, 'required', c.required, 'validatorKey', null, 'validatorVersion', null,
  'defaultMode', c.mode, 'localizationMode', c.localization, 'editorConfig', c.editor, 'lifecycle', c.lifecycle)
from unnest(array['short_text', 'long_text', 'rich_text', 'boolean', 'integer', 'decimal', 'date', 'datetime', 'enum', 'taxonomy', 'relation', 'media']) k
cross join (values
  ('bounds', '{"minLength":1,"maxLength":120}'::jsonb, true, 'inherited', 'localized', '{"label":"Title","order":2,"helpText":"Shown above the input"}'::jsonb, 'active'),
  ('range', '{"minimum":-5.5,"maximum":1000}'::jsonb, false, 'none', 'no_fallback', '{"label":"Quantité","order":10000}'::jsonb, 'deprecated'),
  ('empty', '{}'::jsonb, false, 'none', 'none', '{"label":"Zeichen 日本語","order":0}'::jsonb, 'retired'),
  ('decomposed', '{"maxLength":500}'::jsonb, false, 'none', 'none',
    jsonb_build_object('label', repeat(E'e\u0301', 61), 'order', 3, 'helpText', repeat(E'e\u0301', 300)), 'active'),
  ('largest', '{"minLength":100000,"maxLength":100000,"minimum":1,"maximum":1}'::jsonb, true, 'none', 'none',
    jsonb_build_object('label', rpad('x', 120, 'x'), 'order', 10000, 'helpText', rpad('h', 500, 'h')), 'active')
) c(name, constraints, required, mode, localization, editor, lifecycle);
select diag(format('shapes: %s benchmark and authored field definitions', (select count(*) from fi_shapes)));
select is((select count(*)::integer from fi_shapes s where pg_temp.fi_calls(s.value) = 0 and platform_private.cms_valid_field_input_legacy(s.value, true)), (select count(*)::integer from fi_shapes),
  'every benchmark and authored field shape is valid and takes the early accept (no call reaches the full rules) [P2-S09-AC-217]');
select is((select count(*)::integer from fi_shapes s where pg_temp.fi_calls(s.value || '{"defaultMode":"literal","defaultValue":"x"}'::jsonb) > 0), (select count(*)::integer from fi_shapes),
  'a field that carries a literal default is decided by the full rules (the early accept does not read defaults) [P2-S09-AC-217]');
select is(pg_temp.fi_calls('{"stableFieldId":"a9f10000-0000-4000-8000-0000000000a1","key":"items","kind":"list","constraints":{"itemKind":"short_text"},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"none","localizationMode":"none","editorConfig":{"label":"Items","order":1},"lifecycle":"active"}'::jsonb) > 0,
  true, 'a list field (itemKind) is decided by the full rules [P2-S09-AC-217]');
select is(pg_temp.fi_calls('{"stableFieldId":"a9f10000-0000-4000-8000-0000000000a2","key":"body","kind":"rich_text","constraints":{},"required":false,"validatorKey":"rich_text.v1","validatorVersion":1,"defaultMode":"none","localizationMode":"none","editorConfig":{"label":"Body","order":1},"lifecycle":"active"}'::jsonb) > 0,
  true, 'a field bound to a protected validator is decided by the full rules [P2-S09-AC-217]');
select is(pg_temp.fi_calls('{"stableFieldId":"a9f10000-0000-4000-8000-0000000000a3","key":"user_name","kind":"short_text","constraints":{},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"none","localizationMode":"none","editorConfig":{"label":"User name","order":1},"lifecycle":"active"}'::jsonb) = 0,
  true, 'a key that merely resembles a reserved word is not reserved and is accepted early [P2-S09-AC-217]');
select is(pg_temp.fi_calls('{"stableFieldId":"a9f10000-0000-4000-8000-0000000000a4","key":"user","kind":"short_text","constraints":{},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"none","localizationMode":"none","editorConfig":{"label":"User","order":1},"lifecycle":"active"}'::jsonb) > 0,
  true, 'a reserved key is never accepted early [P2-S09-AC-217]');
select is(platform_private.cms_valid_field_input('{"stableFieldId":"a9f10000-0000-4000-8000-0000000000a4","key":"user","kind":"short_text","constraints":{},"required":false,"validatorKey":null,"validatorVersion":null,"defaultMode":"none","localizationMode":"none","editorConfig":{"label":"User","order":1},"lifecycle":"active"}'::jsonb, true),
  false, 'and is refused, as before [P2-S09-AC-217]');

select * from finish();
rollback;
