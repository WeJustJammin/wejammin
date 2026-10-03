commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): CMS-03A-03
-- (relation binding) and the relation storage rules.  Each field below is a
-- relation-kind field created through CMS-03A-02; every binding goes through the
-- named RPC, every refusal is compared with a fingerprint of the relation,
-- field, version, audit and outbox state, and every refusal has an accepted
-- control on the same draft.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|',
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_relation_definitions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_type_versions t),
    (select count(*) from platform_private.outbox_events), (select count(*) from audit_private.audit_events),
    (select count(*) from platform_private.idempotency_records)))
$body$;
create or replace function pg_temp.p_relfield(p_tag text, p_key text, p_kind text default 'relation') returns uuid language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':f:' || p_key, 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object(
    'contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'),
    'field', jsonb_build_object('key', p_key, 'kind', p_kind, 'constraints', '{}'::jsonb, 'required', false, 'validatorKey', null, 'validatorVersion', null,
      'defaultMode', 'none', 'localizationMode', 'none', 'editorConfig', jsonb_build_object('label', p_key, 'order', 1), 'lifecycle', 'active'),
    'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version(p_tag), 'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)));
  return (resource->>'id')::uuid;
end;
$body$;
create or replace function pg_temp.p_a03(p_label text, p_tag text, p_field uuid, p_over jsonb default '{}'::jsonb, p_actor text default 'owner', p_drop text default null)
returns text language plpgsql as $body$
declare req jsonb;
begin
  req := jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_tag || ':type'), 'versionId', pg_temp.s09d_id(p_tag || ':version'), 'fieldId', p_field,
    'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3,
    'ordered', false, 'onUnavailable', 'placeholder', 'expectedVersion', pg_temp.s09d_version(p_tag),
    'idempotencyKey', 'p240-' || substr(extensions.gen_random_uuid()::text, 1, 24)) || p_over;
  if p_drop is not null then req := req - p_drop; end if;
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_bind_relation', p_actor, req);
  return pg_temp.s09d_outcome(p_label);
end;
$body$;
create or replace function pg_temp.p_expect(p_label text, p_tag text, p_field uuid, p_expected text, p_over jsonb default '{}'::jsonb, p_actor text default 'owner', p_drop text default null)
returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  outcome := pg_temp.p_a03(p_label, p_tag, p_field, p_over, p_actor, p_drop);
  return case when outcome = p_expected and (p_expected = 'OK' or before_fp = pg_temp.p_fp()) then 'ok'
    else 'bad:' || outcome || case when p_expected <> 'OK' and before_fp <> pg_temp.p_fp() then ' (state changed)' else '' end end;
end;
$body$;
create or replace function pg_temp.p_rel(p_field uuid) returns text language sql stable as $body$
  select r.target_kind || '/' || r.target_type || '/' || r.projection_key || '/' || r.cardinality || '/' || r.min_count || '/' || r.max_count || '/' || r.ordered || '/' || r.on_unavailable
  from platform_private.cms_relation_definitions r where r.field_definition_id = p_field
$body$;

select pg_temp.s09d_create_type('a', 'p240_a03a');
select pg_temp.s09d_create_type('z', 'p240_a03z');
select pg_temp.s09d_create_type('ac', 'p240_a03act');
select pg_temp.s09d_to_active('ac');
create temp table p_f on commit drop as select
  pg_temp.p_relfield('a', 'rel_ok') as ok, pg_temp.p_relfield('a', 'rel_text', 'short_text') as text_field,
  pg_temp.p_relfield('z', 'rel_other') as other_field;
select is((select count(*)::integer from p_f where ok is not null and text_field is not null and other_field is not null), 1, 'fixture: relation and non-relation fields exist on two drafts');

-- ============================================================ AC073 fieldId ====
select is(pg_temp.p_expect('fid:ok', 'a', (select ok from p_f), 'OK'), 'ok', 'control: a relation-kind field of this version is bound [P2-S09-AC-073]');
select is(pg_temp.p_rel((select ok from p_f)), 'domain/profile/profile.summary/many/0/3/false/placeholder', 'the relation row is attached to exactly that field [P2-S09-AC-073]');
select is(pg_temp.p_expect('fid:text', 'a', (select text_field from p_f), 'VALIDATION_FAILED'), 'ok', 'a field that is not relation-kind is refused and nothing changes [P2-S09-AC-073]');
select is(pg_temp.p_expect('fid:other', 'a', (select other_field from p_f), 'VALIDATION_FAILED'), 'ok', 'a relation-kind field of another type version is refused and nothing changes [P2-S09-AC-073]');
select is(pg_temp.p_expect('fid:rand', 'a', extensions.gen_random_uuid(), 'VALIDATION_FAILED'), 'ok', 'an unknown field id is refused and nothing changes [P2-S09-AC-073]');
select is(pg_temp.p_expect('fid:bad', 'a', null, 'VALIDATION_FAILED', '{"fieldId":"nope"}'), 'ok', 'a malformed field id is refused and nothing changes [P2-S09-AC-073]');

-- ===================================== AC074 / AC075 target kind, type, projection ====
create or replace function pg_temp.p_fresh(p_tag text, p_key text) returns uuid language sql as $body$ select pg_temp.p_relfield(p_tag, p_key) $body$;
select is(pg_temp.p_expect('tgt:' || c.k || ':' || c.t || ':' || c.p, 'a', pg_temp.p_fresh('a', 'tg_' || substr(md5(c.k || c.t || c.p), 1, 12)), 'OK',
    jsonb_build_object('targetKind', c.k, 'targetType', c.t, 'projectionKey', c.p)), 'ok', 'the allowlisted target ' || c.k || '/' || c.t || ' with projection ' || c.p || ' is accepted [P2-S09-AC-074]')
from (values ('content', 'article', 'cms.article.card'), ('content', 'article', 'public.summary'), ('content', 'artist', 'public.summary'), ('domain', 'profile', 'profile.summary'),
  ('domain', 'profile', 'public.summary'), ('domain', 'person', 'public.summary'), ('domain', 'organization', 'public.summary')) c(k, t, p);
select is(pg_temp.p_expect('tgt:bad:' || c.n, 'a', pg_temp.p_fresh('a', 'tb_' || substr(md5(c.n), 1, 12)), 'VALIDATION_FAILED', c.o), 'ok', 'target ' || c.n || ' is refused and nothing changes [P2-S09-AC-074]')
from (values ('kind outside content and domain', '{"targetKind":"table"}'::jsonb), ('uppercase kind', '{"targetKind":"Domain"}'), ('a type outside the allowlist', '{"targetType":"payments"}'),
  ('a registered type under the wrong kind', '{"targetKind":"content","targetType":"profile"}'), ('an empty type', '{"targetType":""}'), ('an uppercase type', '{"targetType":"Profile"}'),
  ('a type that is a SQL fragment', '{"targetType":"profile; drop table x"}'), ('a 97 character type', jsonb_build_object('targetType', 'p' || repeat('a', 96)))) c(n, o);
select is(pg_temp.p_expect('prj:bad:' || c.n, 'a', pg_temp.p_fresh('a', 'pb_' || substr(md5(c.n), 1, 12)), 'VALIDATION_FAILED', c.o), 'ok', 'projection ' || c.n || ' is refused and nothing changes [P2-S09-AC-075]')
from (values ('outside the named allowlist', '{"projectionKey":"profile.secret"}'::jsonb), ('that is arbitrary SQL', '{"projectionKey":"select 1"}'),
  ('that is a table name', '{"projectionKey":"platform_private.cms_content_entries"}'), ('with a semicolon', '{"projectionKey":"profile.summary;"}'), ('with an uppercase letter', '{"projectionKey":"Profile.summary"}'),
  ('of 129 characters', jsonb_build_object('projectionKey', 'p' || repeat('a', 128))), ('that is empty', '{"projectionKey":""}'),
  ('that is a dynamic projection expression', '{"projectionKey":"profile.summary || x"}'), ('that is a valid key for a different target', '{"projectionKey":"cms.article.card"}')) c(n, o);
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_relation_definitions where projection_key not in (select p from (values (''cms.article.card''), (''public.summary''), (''profile.summary'')) v(p))'), '0',
  'every stored projection key is one of the named allowlisted projections [P2-S09-AC-075]');

-- =========================== AC076 / AC077 / AC078 / AC079 / AC080 cardinality, bounds, flags ====
select is(pg_temp.p_expect('crd:' || c.n, 'a', pg_temp.p_fresh('a', 'cd_' || substr(md5(c.n), 1, 12)), 'OK', c.o), 'ok', c.n || ' is accepted [P2-S09-AC-078]')
from (values ('one with min 0 and max 1', '{"cardinality":"one","min":0,"max":1}'::jsonb), ('one with min 1 and max 1', '{"cardinality":"one","min":1,"max":1}'),
  ('many with min 0 and max 128', '{"cardinality":"many","min":0,"max":128}'), ('many with min 128 and max 128', '{"cardinality":"many","min":128,"max":128}'),
  ('many with min 2 and max 5', '{"cardinality":"many","min":2,"max":5}'), ('many with equal bounds 1', '{"cardinality":"many","min":1,"max":1}')) c(n, o);
select is(pg_temp.p_expect('crd:bad:' || c.n, 'a', pg_temp.p_fresh('a', 'cb_' || substr(md5(c.n), 1, 12)), 'VALIDATION_FAILED', c.o), 'ok', c.n || ' is refused and nothing changes [P2-S09-AC-077]')
from (values ('min above max', '{"min":4,"max":3}'::jsonb), ('max zero', '{"min":0,"max":0}'), ('max 129', '{"min":0,"max":129}'), ('min 129', '{"min":129,"max":129}'),
  ('a negative min', '{"min":-1,"max":3}'), ('a fractional max', '{"min":0,"max":2.5}'), ('a textual max', '{"min":0,"max":"many"}'), ('a null max (unbounded)', '{"min":0,"max":null}'),
  ('a null min', '{"min":null,"max":3}'), ('an infinite max', '{"min":0,"max":"Infinity"}')) c(n, o);
select is(pg_temp.p_expect('crd:one:' || c.n, 'a', pg_temp.p_fresh('a', 'co_' || substr(md5(c.n), 1, 12)), 'VALIDATION_FAILED', c.o), 'ok', 'cardinality one ' || c.n || ' is refused and nothing changes [P2-S09-AC-078]')
from (values ('with max 2', '{"cardinality":"one","min":0,"max":2}'::jsonb), ('with min 2', '{"cardinality":"one","min":2,"max":2}'), ('with max 0', '{"cardinality":"one","min":0,"max":0}')) c(n, o);
select is(pg_temp.p_expect('crd:bad', 'a', pg_temp.p_fresh('a', 'cu_x'), 'VALIDATION_FAILED', '{"cardinality":"several"}'), 'ok', 'a cardinality outside one and many is refused and nothing changes [P2-S09-AC-076]');
select is((select string_agg(distinct cardinality, ',') from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    where f.content_type_version_id = pg_temp.s09d_id('a:version')), 'many,one', 'cardinality is stored as declared relation metadata, one and many [P2-S09-AC-076]');
select is((select count(*)::integer from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    where f.content_type_version_id = pg_temp.s09d_id('a:version') and ((r.cardinality = 'one' and r.max_count = 1 and r.min_count in (0, 1)) or (r.cardinality = 'many' and r.max_count between 1 and 128))),
  (select count(*)::integer from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    where f.content_type_version_id = pg_temp.s09d_id('a:version')), 'every stored relation has finite bounds consistent with its cardinality [P2-S09-AC-078]');
select is(pg_temp.p_expect('ord:true', 'a', pg_temp.p_fresh('a', 'od_true'), 'OK', '{"ordered":true}'), 'ok', 'ordered true is accepted [P2-S09-AC-079]');
select is((select ordered::text from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    where f.content_type_version_id = pg_temp.s09d_id('a:version') and f.field_key = 'od_true'), 'true', 'the ordering semantics are stored in the relation definition [P2-S09-AC-079]');
select is(pg_temp.p_expect('ord:bad:' || c.n, 'a', pg_temp.p_fresh('a', 'ob_' || substr(md5(c.n), 1, 12)), c.e, c.o, 'owner', c.d), 'ok', 'ordered ' || c.n || ' is refused and nothing changes [P2-S09-AC-079]')
from (values ('as a string', '{"ordered":"true"}'::jsonb, 'VALIDATION_FAILED', null), ('as a number', '{"ordered":1}', 'VALIDATION_FAILED', null), ('as null', '{"ordered":null}', 'VALIDATION_FAILED', null),
  ('omitted', '{}', 'VALIDATION_FAILED', 'ordered')) c(n, o, e, d);
select is(pg_temp.p_expect('un:' || u, 'a', pg_temp.p_fresh('a', 'un_' || u), 'OK', jsonb_build_object('onUnavailable', u)), 'ok', 'onUnavailable ' || u || ' is accepted [P2-S09-AC-080]') from unnest(array['omit', 'block', 'placeholder']) u;
select is(pg_temp.p_expect('un:bad:' || c.n, 'a', pg_temp.p_fresh('a', 'ub_' || substr(md5(c.n), 1, 12)), 'VALIDATION_FAILED', c.o, 'owner', c.d), 'ok', 'onUnavailable ' || c.n || ' is refused and nothing changes [P2-S09-AC-080]')
from (values ('outside omit, block and placeholder', '{"onUnavailable":"hide"}'::jsonb, null), ('null', '{"onUnavailable":null}', null), ('empty', '{"onUnavailable":""}', null),
  ('uppercase', '{"onUnavailable":"OMIT"}', null), ('omitted entirely (never silently treated as omit)', '{}', 'onUnavailable')) c(n, o, d);
select is((select string_agg(f.field_key || ':' || r.on_unavailable, ',' order by f.field_key) from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
    where f.content_type_version_id = pg_temp.s09d_id('a:version') and f.field_key like 'un\_%'), 'un_block:block,un_omit:omit,un_placeholder:placeholder', 'each declared unavailable behavior is stored as declared, none defaulted [P2-S09-AC-080]');

-- ======================================== AC011 table-level optionality bounds ====
create temp table p_rel_base on commit drop as select r.id from platform_private.cms_relation_definitions r join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
  where f.content_type_version_id = pg_temp.s09d_id('a:version') and f.field_key = 'rel_ok';
select is(pg_temp.s09e_check('cms_relation_definitions', 'cms_relation_definitions_cardinality_bounds_check', (select id from p_rel_base), '{"cardinality":"one","min_count":0,"max_count":3}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_relation_definitions_cardinality_bounds_check', 'storage rejects cardinality one with max above 1 [P2-S09-AC-011]');
select is(pg_temp.s09e_check('cms_relation_definitions', 'cms_relation_definitions_cardinality_bounds_check', (select id from p_rel_base), '{"cardinality":"one","min_count":2,"max_count":1}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_relation_definitions_cardinality_bounds_check', 'storage rejects cardinality one with min above 1 [P2-S09-AC-011]');
select is(pg_temp.s09e_check('cms_relation_definitions', 'cms_relation_definitions_bounds_check', (select id from p_rel_base), '{"max_count":129}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_relation_definitions_bounds_check', 'storage rejects an unbounded or above-128 max [P2-S09-AC-011]');
select is(pg_temp.s09e_check('cms_relation_definitions', 'cms_relation_definitions_bounds_check', (select id from p_rel_base), '{"min_count":4}'),
  'control:ACCEPTED|override:REJECTED:23514:cms_relation_definitions_bounds_check', 'storage rejects min above max [P2-S09-AC-011]');
select is(pg_temp.s09e_check('cms_relation_definitions', 'max_count', (select id from p_rel_base), '{"max_count":null}'),
  'control:ACCEPTED|override:REJECTED:23502:max_count', 'storage rejects a null (unbounded) max: every relation carries explicit finite bounds [P2-S09-AC-011]');
select is(pg_temp.s09e_check('cms_relation_definitions', 'min_count', (select id from p_rel_base), '{"min_count":null}'),
  'control:ACCEPTED|override:REJECTED:23502:min_count', 'storage rejects a null min [P2-S09-AC-011]');

-- ================================================ AC083 / AC195 draft-only, CAS, unique ====
select is(pg_temp.p_expect('cas:ok', 'a', pg_temp.p_fresh('a', 'cas_ok'), 'OK'), 'ok', 'control: a relation binds to a draft under the current version [P2-S09-AC-083]');
select is(pg_temp.p_expect('cas:stale', 'a', pg_temp.p_fresh('a', 'cas_st'), 'VERSION_MISMATCH', '{"expectedVersion":"1"}'), 'ok', 'a stale If-Match is VERSION_MISMATCH and nothing changes [P2-S09-AC-083]');
select is(pg_temp.p_expect('cas:dup', 'a', (select ok from p_f), 'CONFLICT'), 'ok', 'a second relation for a field that already has one is a typed 409 CONFLICT and nothing changes [P2-S09-AC-083]');
select is((select count(*)::integer from platform_private.cms_relation_definitions where field_definition_id = (select ok from p_f)), 1, 'one relation per field: the unique field binding holds [P2-S09-AC-083]');
select pg_temp.s09d_successor('b', 'ac');
create temp table p_bf on commit drop as select pg_temp.p_relfield('b', 'rel_b') as f;
select is(pg_temp.p_expect('cas:bok', 'b', (select f from p_bf), 'OK'), 'ok', 'control: the successor draft accepts a relation [P2-S09-AC-083]');
select pg_temp.s09d_to_approved('b');
create temp table p_bapproved on commit drop as select id from platform_private.cms_field_definition_versions where content_type_version_id = pg_temp.s09d_id('b:version') and field_key = 'rel_b';
select is(pg_temp.p_expect('cas:approved', 'b', (select id from p_bapproved), 'CONFLICT'), 'ok', 'an approved (frozen) candidate refuses a relation write: CONFLICT and nothing changes [P2-S09-AC-083]');
select is(pg_temp.p_expect('cas:bounds', 'a', pg_temp.p_fresh('a', 'cas_bn'), 'VALIDATION_FAILED', '{"min":5,"max":2}'), 'ok', 'invalid bounds leave no relation, field or version mutation [P2-S09-AC-083]');
select is(pg_temp.p_expect('f:forbid', 'a', pg_temp.p_fresh('a', 'f_forbid'), 'FORBIDDEN', '{}', 'rev1'), 'ok', 'an authenticated human without cms.schema_designer is 403 FORBIDDEN [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:hidden', 'a', pg_temp.p_fresh('a', 'f_hidden'), 'NOT_FOUND', '{}', 'other'), 'ok', 'a hidden parent is an indistinguishable 404 [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:key', 'a', pg_temp.p_fresh('a', 'f_key'), 'VALIDATION_FAILED', '{"extra":true}'), 'ok', 'an unknown request key is a strict-object failure, 422 VALIDATION_FAILED [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:allow', 'a', pg_temp.p_fresh('a', 'f_allow'), 'VALIDATION_FAILED', '{"projectionKey":"profile.secret"}'), 'ok', 'an allowlist failure is 422 VALIDATION_FAILED [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:bounds', 'a', pg_temp.p_fresh('a', 'f_bounds'), 'VALIDATION_FAILED', '{"min":3,"max":1}'), 'ok', 'a bounds failure is 422 VALIDATION_FAILED [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:dup', 'a', (select ok from p_f), 'CONFLICT'), 'ok', 'a duplicate relation is 409 CONFLICT [P2-S09-AC-195]');
select is(pg_temp.p_expect('f:stale', 'a', pg_temp.p_fresh('a', 'f_stale'), 'VERSION_MISMATCH', '{"expectedVersion":"1"}'), 'ok', 'a stale version is 409 VERSION_MISMATCH [P2-S09-AC-195]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), set_config('request.jwt.claim.sub', '', true);
select pg_temp.s09d_call('f:anon', 'platform_api.cms_bind_relation', jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'fieldId', (select ok from p_f),
  'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary', 'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit', 'expectedVersion', '1', 'idempotencyKey', 'p240-anon-a03-0001'));
select is(pg_temp.s09d_outcome('f:anon'), 'UNAUTHENTICATED', 'a call with no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-195]');

-- ================================================ AC082 a binding never grants authority ====
create temp table p_auth_before on commit drop as select
  (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from identity_private.organization_actor_grant g) as actor_grants,
  (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from platform_private.cms_capability_grants g) as cms_grants;
select pg_temp.s09d_session('owner');
select is(pg_temp.p_expect('auth:bind', 'a', pg_temp.p_fresh('a', 'auth_rel'), 'OK', '{"targetKind":"domain","targetType":"organization","projectionKey":"public.summary"}'), 'ok', 'fixture: a relation to the organization projection is bound [P2-S09-AC-082]');
select ok((select actor_grants = (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from identity_private.organization_actor_grant g)
      and cms_grants = (select md5(coalesce(string_agg(g::text, ',' order by g::text), '')) from platform_private.cms_capability_grants g) from p_auth_before),
  'binding a relation changed no actor grant and no CMS capability grant [P2-S09-AC-082]');
select is((select string_agg(n.nspname || '.' || p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prokind = 'f' and n.nspname in ('platform_private', 'platform_api', 'identity_private', 'identity', 'public_api')
        and pg_get_functiondef(p.oid) ~ 'cms_relation_definitions'),
  'platform_private.cms_activation_references_valid,platform_private.cms_activation_review_invalidation_trigger,platform_private.cms_active_parent_guard,platform_private.cms_bind_relation,platform_private.cms_candidate_definition_request,platform_private.cms_create_revision,platform_private.cms_create_schema_successor,platform_private.cms_create_type_draft,platform_private.cms_derive_schema_field_classification,platform_private.cms_get_content_type_version,platform_private.cms_get_entry_draft,platform_private.cms_list_content_types,platform_private.cms_lock_activation_graph,platform_private.cms_migration_changed_fields,platform_private.cms_migration_target_fields_spec,platform_private.cms_resolve_conflict,platform_private.cms_type_version_resource',
  'exactly seventeen schema, migration, projection and entry functions touch the relation table and none of them resolves a capability from it [P2-S09-AC-082]');

select * from finish();
rollback;
