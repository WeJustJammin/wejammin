-- Slice 11 shared helpers: the D19 preflight registry evaluation
-- (BE03b "Publication preflight registry (D19, DEC-134, D25)"; tracker
-- P2-S11-AC-093 .. AC-097, AC-101, AC-102):
-- platform_private.cms_preflight_registry_current, cms_accessibility_binding_hash and
-- cms_evaluate_preflight.  RED before 20261005017570, GREEN after.
--
-- cms_evaluate_preflight evaluates the seventeen categories in registry order with
-- no short circuit and returns the PreflightReport { evaluatedAt, passed, results }.
-- It never refuses a failed category itself (the command aggregates: failed => 422
-- preflight_failed, else unavailable => 503); it refuses only a malformed request,
-- an absent revision, an unresolvable manifest, and accessibility evidence that is
-- stale (60 s) or bound to other canonical rows.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(157);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_helpers/003-registry.sqlinc

-- The world type declares a no_fallback field, which makes EVERY h11doc revision a
-- `locale` reference (D19).  This suite needs an all-pass baseline, so the field
-- becomes a plain localized field here (the locale gate has its own cases below).
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'localized' where field_key = 'legal'$$);

create or replace function pg_temp.h11p_categories()
returns text[] language sql immutable as $body$
  select array['contract','schema','template','block','pattern','taxonomy','settings','relation','privacy',
               'security','accessibility','media','route','locale','migration','domain_binding','revocation']
$body$;

-- manifest + good evidence for a revision tag
create or replace function pg_temp.h11p_manifest(p_tag text)
returns jsonb
language sql
as $body$
  select pg_temp.h11_json(format('select platform_private.cms_build_dependency_manifest(%L::uuid)',
    pg_temp.h11w_uuid(p_tag || ':revision')))
$body$;

create or replace function pg_temp.h11p_binding(p_tag text, p_checker_version text default '1')
returns text
language sql
as $body$
  select pg_temp.h11_sha256(
    '{"checkerKey":"cms.a11y.structural","checkerVersion":"' || p_checker_version || '","dependencyHash":"'
    || platform_private.cms_jcs_sha256(pg_temp.h11p_manifest(p_tag))
    || '","revisionContentHash":"' || (select payload_hash from platform_private.cms_entry_revisions
         where id = pg_temp.h11w_uuid(p_tag || ':revision'))
    || '","revisionId":"' || pg_temp.h11w_uuid(p_tag || ':revision')::text || '"}')
$body$;

create or replace function pg_temp.h11p_evidence(
  p_tag text, p_outcome text default 'healthy', p_blocking integer default 0,
  p_age_seconds integer default 0, p_overrides jsonb default '{}'::jsonb
)
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'category', 'accessibility', 'providerKey', 'cms.a11y.structural', 'providerVersion', '1',
    'outcome', p_outcome, 'blockingCount', p_blocking, 'inputHash', repeat('a', 64),
    'bindingHash', pg_temp.h11p_binding(p_tag),
    'evaluatedAt', platform_private.auth_iso_time(clock_timestamp() - make_interval(secs => p_age_seconds))
  ) || p_overrides
$body$;

-- The evaluation request for a revision tag.  `actor` is a person key of s10_ids/s11_ids.
create or replace function pg_temp.h11p_request(
  p_phase text, p_tag text, p_actor text default 'creatorPerson',
  p_overrides jsonb default '{}'::jsonb, p_evidence jsonb default null, p_frozen jsonb default null,
  p_review text default null
)
returns jsonb
language sql
as $body$
  select jsonb_build_object(
    'phase', p_phase, 'revisionId', pg_temp.h11w_uuid(p_tag || ':revision'),
    'actingPartyId', pg_temp.h11w_org(),
    'actorPersonId', coalesce((select value::uuid from s10_ids where key = p_actor),
                              (select value::uuid from s11_ids where key = p_actor)),
    'effectiveAt', platform_private.auth_iso_time(clock_timestamp() + interval '1 hour'),
    'evidence', coalesce(p_evidence, pg_temp.h11p_evidence(p_tag)),
    'frozenManifest', coalesce(p_frozen, pg_temp.h11p_manifest(p_tag))
  ) || case when p_review is null then '{}'::jsonb
       else jsonb_build_object('reviewId', pg_temp.s11_id(p_review)) end
    || p_overrides
$body$;

create or replace function pg_temp.h11p_eval(p_request jsonb)
returns jsonb
language plpgsql
as $body$
begin
  return platform_private.cms_evaluate_preflight(p_request);
exception when others then
  return jsonb_build_object('error', sqlstate || ':' || sqlerrm);
end;
$body$;

create or replace function pg_temp.h11p_err(p_request jsonb)
returns text
language sql
as $body$
  select pg_temp.h11_outcome(format('select platform_private.cms_evaluate_preflight(%L::jsonb)', p_request::text))
$body$;

-- '<outcome>/<reasonCode or ->' of one category
create or replace function pg_temp.h11p_res(p_report jsonb, p_category text)
returns text
language sql
as $body$
  select coalesce(
    (select r->>'outcome' || '/' || coalesce(r->>'reasonCode', '-')
       from jsonb_array_elements(p_report->'results') r where r->>'category' = p_category),
    'ERR ' || coalesce(p_report->>'error', 'no report'))
$body$;

-- all non-passing categories as 'category:outcome/reason' sorted
create or replace function pg_temp.h11p_bad(p_report jsonb)
returns text
language sql
as $body$
  select case when p_report ? 'error' then 'ERR ' || (p_report->>'error')
    else coalesce((select string_agg(r->>'category' || ':' || (r->>'outcome') || '/' || coalesce(r->>'reasonCode', '-'),
                             ',' order by r->>'category')
    from jsonb_array_elements(p_report->'results') r where r->>'outcome' <> 'passed'), '') end
$body$;

-- ---------------------------------------------------------------------------
-- Shape and privileges.
-- ---------------------------------------------------------------------------
select ok(
  pg_temp.h11_private_definer('cms_evaluate_preflight(jsonb)')
    and pg_temp.h11_private_definer('cms_preflight_registry_current()')
    and pg_temp.h11_private_definer('cms_accessibility_binding_hash(uuid, text)'),
  'the preflight helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-093]'
);
select ok(
  pg_temp.h11_volatility('cms_evaluate_preflight(jsonb)') = 'v'
    and pg_temp.h11_volatility('cms_preflight_registry_current()') = 's'
    and pg_temp.h11_volatility('cms_accessibility_binding_hash(uuid, text)') = 's',
  'evaluate retains VOLATILE; the registry view and the binding hash are STABLE [P2-S11-AC-093]'
);
select is(pg_temp.h11_rettype('cms_evaluate_preflight(jsonb)'), 'jsonb', 'evaluate returns the report as jsonb [P2-S11-AC-097]');
select is(pg_temp.h11_rettype('cms_preflight_registry_current()'),
  'TABLE(category text, registry_version bigint, owner_slice text, provider_key text, provider_version bigint, provider_kind text, reference_kind text)',
  'the registry view has the frozen seven columns [P2-S11-AC-093]');

-- ---------------------------------------------------------------------------
-- The registry view: seventeen categories in registry order, current row each.
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(category) from platform_private.cms_preflight_registry_current()),
  pg_temp.h11p_categories(),
  'the registry view lists the seventeen categories in registry order [P2-S11-AC-093]');
select is(
  (select string_agg(category || '=' || provider_key || '@' || provider_version || '/' || provider_kind || '/' || coalesce(reference_kind, '-'), ',')
     from platform_private.cms_preflight_registry_current()),
  'contract=preflight.contract@1/database/-,schema=preflight.schema@1/database/-,template=preflight.template@1/database/-,block=preflight.block@1/database/-,pattern=preflight.reference_gate@1/reference_gate/pattern,taxonomy=preflight.reference_gate@1/reference_gate/taxonomy,settings=preflight.settings@1/database/-,relation=preflight.relation@1/database/-,privacy=preflight.reference_gate@1/reference_gate/privacy,security=preflight.security@1/database/-,accessibility=cms.a11y.structural@1/worker/-,media=preflight.reference_gate@1/reference_gate/media,route=preflight.reference_gate@1/reference_gate/route,locale=preflight.reference_gate@1/reference_gate/locale,migration=preflight.migration@1/database/-,domain_binding=preflight.domain_binding@1/database/-,revocation=preflight.revocation@1/database/-',
  'the registry rows equal the TypeScript CMS_PREFLIGHT_REGISTRY row for row (key, version, kind, reference kind) [P2-S11-AC-093]');

-- A newer row of a category replaces the older one in the view (a later slice registers its provider).
select pg_temp.h11_raw_insert('platform_private.cms_preflight_registry', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', '0d6a0d6a-0000-4000-8000-000000000134', 'state', 'seeded',
  'version', 2, 'category', 'media', 'owner_slice', 'slice-14', 'provider_key', 'cms.media.referenced',
  'provider_version', 3, 'provider_kind', 'database', 'reference_kind', null,
  'created_at', now(), 'updated_at', now()));
select is(
  (select provider_key || '@' || provider_version || '/' || registry_version from platform_private.cms_preflight_registry_current() where category = 'media'),
  'cms.media.referenced@3/2', 'the current row of a category is the one with the greatest registry version [P2-S11-AC-093]');
select is((select count(*)::integer from platform_private.cms_preflight_registry_current()), 17,
  'the view still lists exactly one row per category [P2-S11-AC-093]');
select pg_temp.h11_raw_exec('platform_private.cms_preflight_registry',
  $$delete from platform_private.cms_preflight_registry where category = 'media' and version = 2$$);

-- ---------------------------------------------------------------------------
-- The accessibility binding hash: SHA-256 of the literal JCS the Worker also computes.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('ok');
select pg_temp.h11w_value(pg_temp.h11w_uuid('ok:revision'), 'title', to_jsonb('A clean title'::text));
select is(
  pg_temp.h11_text(format('select platform_private.cms_accessibility_binding_hash(%L::uuid, %L)',
    pg_temp.h11w_uuid('ok:revision'), repeat('d', 64))),
  pg_temp.h11_sha256('{"checkerKey":"cms.a11y.structural","checkerVersion":"1","dependencyHash":"' || repeat('d', 64)
    || '","revisionContentHash":"' || (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('ok:revision'))
    || '","revisionId":"' || pg_temp.h11w_uuid('ok:revision')::text || '"}'),
  'the binding hash is the SHA-256 of the JCS { checkerKey, checkerVersion, dependencyHash, revisionContentHash, revisionId } [P2-S11-AC-102]');
select is(pg_temp.h11_text(format('select platform_private.cms_accessibility_binding_hash(%L::uuid, %L)',
    'a9200000-0000-4000-8000-0000000000ee', repeat('d', 64))), 'ERR:P0001:NOT_FOUND',
  'the binding hash of an absent revision is NOT_FOUND [P2-S11-AC-102]');
select is(pg_temp.h11_text(format('select platform_private.cms_accessibility_binding_hash(%L::uuid, %L)',
    pg_temp.h11w_uuid('ok:revision'), 'not-a-hash')), 'ERR:P0001:INVALID_REQUEST',
  'a malformed dependency hash is INVALID_REQUEST [P2-S11-AC-102]');

-- ---------------------------------------------------------------------------
-- Baseline: every category passes on a clean revision (submit phase).
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11p_assignment(p_tag text, p_person_key text, p_cap text default 'cms.author')
returns void
language sql
as $body$
  select pg_temp.h11_raw_insert('platform_private.cms_entry_assignments', jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.h11w_org(),
    'entry_id', pg_temp.h11w_uuid(p_tag || ':entry'),
    'assignee_person_id', coalesce((select value::uuid from s10_ids where key = p_person_key),
                                   (select value::uuid from s11_ids where key = p_person_key)),
    'capability_key', p_cap, 'state', 'active', 'version', 1,
    'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'))
$body$;

create or replace function pg_temp.h11p_rawvalue(p_revision uuid, p_field text, p_value jsonb)
returns void
language sql
as $body$
  select pg_temp.h11_raw_insert('platform_private.cms_entry_field_values', jsonb_build_object(
    'id', extensions.gen_random_uuid(), 'owner_id', pg_temp.h11w_org(), 'state', 'active', 'version', 1,
    'revision_id', p_revision, 'field_id', pg_temp.h11w_fid(p_field), 'field_definition_id', pg_temp.h11w_fdef(p_field),
    'locale', 'en-US', 'value', p_value, 'provenance', 'authored',
    'value_hash', platform_private.cms_jcs_sha256(p_value),
    'created_at', timestamptz '2026-10-08T12:00:00Z', 'updated_at', timestamptz '2026-10-08T12:00:00Z'))
$body$;

select pg_temp.h11p_assignment('ok', 'creatorPerson');
select pg_temp.h11r_member('reviewer04', array['cms.publisher']);

create temp table h11p_base on commit drop as
select pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')) as report;

select ok((select report ? 'results' from h11p_base), 'baseline: the submit evaluation of a clean revision answers a report [P2-S11-AC-097]');
select is((select array_agg(k order by k) from jsonb_object_keys((select report from h11p_base)) k),
  array['evaluatedAt', 'passed', 'results'], 'the report has exactly evaluatedAt, passed and results (the PreflightReport contract) [P2-S11-AC-097]');
select is((select jsonb_array_length(report->'results') from h11p_base), 17, 'the report lists all seventeen categories [P2-S11-AC-097]');
select is((select array_agg(r->>'category' order by ord) from h11p_base, jsonb_array_elements(report->'results') with ordinality t(r, ord)),
  pg_temp.h11p_categories(), 'in registry order [P2-S11-AC-097]');
select is((select (report->>'passed')::boolean from h11p_base), true, 'a clean revision with healthy evidence passes every category [P2-S11-AC-097]');
select is((select count(*)::integer from h11p_base, jsonb_array_elements(report->'results') r
            where r->>'outcome' = 'passed' and r->'reasonCode' = 'null'::jsonb and (r->>'blockingCount')::integer = 0), 17,
  'every result is passed with a null reason code and no blocking count [P2-S11-AC-097]');
select is((select string_agg(distinct (select array_agg(k order by k)::text from jsonb_object_keys(r) k), ',') from h11p_base, jsonb_array_elements(report->'results') r),
  '{blockingCount,category,outcome,providerKey,providerVersion,reasonCode}', 'each result carries exactly the six PreflightResult members [P2-S11-AC-097]');
select is((select string_agg(r->>'providerKey' || '@' || (r->>'providerVersion'), ',' order by ord)
             from h11p_base, jsonb_array_elements(report->'results') with ordinality t(r, ord)),
  (select string_agg(provider_key || '@' || provider_version, ',') from platform_private.cms_preflight_registry_current()),
  'each result names the current registry provider and version (version as a decimal string) [P2-S11-AC-093]');
select ok((select report->>'evaluatedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' from h11p_base),
  'evaluatedAt is a UTC instant string [P2-S11-AC-097]');

-- phases: publish/schedule/execute evaluate the same seventeen with a publisher actor.
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'ok', 'reviewer04'))), '',
  'schedule phase with a current publisher passes [P2-S11-AC-096]');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'ok', 'reviewer04'))), '',
  'publish phase with a current publisher passes [P2-S11-AC-096]');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('execute', 'ok', 'reviewer04'))), '',
  'execute phase with a current schedule creator passes [P2-S11-AC-096]');

-- ---------------------------------------------------------------------------
-- Request discipline.
-- ---------------------------------------------------------------------------
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok') - 'phase'), 'P0001:INVALID_REQUEST', 'a missing phase is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('workflow_read', 'ok')), 'P0001:INVALID_REQUEST', 'workflow_read is not a phase of this helper: CMS-03B-15 evaluates submit read-only [P2-S11-AC-096]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"phase":"preview"}')), 'P0001:INVALID_REQUEST', 'CMS-03B-08 runs no registry phase: preview is not a phase [P2-S11-AC-096]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok') - 'effectiveAt'), 'P0001:INVALID_REQUEST', 'a missing effectiveAt is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok') - 'actorPersonId'), 'P0001:INVALID_REQUEST', 'a missing actor is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"actorPersonId":"nope"}')), 'P0001:INVALID_REQUEST', 'a malformed actor id is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"effectiveAt":"not-an-instant"}')), 'P0001:INVALID_REQUEST', 'a malformed instant is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"surprise":true}')), 'P0001:INVALID_REQUEST', 'an unknown request member is INVALID_REQUEST (server-built request only) [P2-S11-AC-097]');
select is(pg_temp.h11p_err('[]'::jsonb), 'P0001:INVALID_REQUEST', 'a non-object request is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', jsonb_build_object('revisionId', 'a9200000-0000-4000-8000-0000000000ee'))),
  'P0001:NOT_FOUND', 'an absent revision is NOT_FOUND [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"frozenManifest":[]}')), 'P0001:INVALID_REQUEST', 'a malformed frozen manifest is INVALID_REQUEST [P2-S11-AC-097]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"evidence":{"category":"accessibility"}}')), 'P0001:INVALID_REQUEST', 'malformed evidence is INVALID_REQUEST [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 3))), 'P0001:INVALID_REQUEST', 'a healthy run with a blocking finding is INVALID_REQUEST (BE05c invariant) [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'blocked', 0))), 'P0001:INVALID_REQUEST', 'a blocked run without a blocking finding is INVALID_REQUEST (BE05c invariant) [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'stale'))), 'P0001:INVALID_REQUEST', 'stale is not an evidence outcome (a gate call always runs fresh) [P2-S11-AC-102]');

-- ---------------------------------------------------------------------------
-- 11 accessibility: the evidence mapping and its verification (DEC-150, DEC-158c).
-- ---------------------------------------------------------------------------
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'blocked', 4))), 'accessibility'),
  'failed/blocking_finding', 'a blocked run is a failed result with blocking_finding [P2-S11-AC-101]');
select is((select r->>'blockingCount' from jsonb_array_elements(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'blocked', 4)))->'results') r where r->>'category' = 'accessibility'),
  '4', 'the failed result carries the evidence blocking count [P2-S11-AC-101]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'failed', 0))), 'accessibility'),
  'unavailable/checker_failed', 'a failed run (timeout, dependency failure) is an unavailable result with checker_failed [P2-S11-AC-101]');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'failed', 0)))),
  'accessibility:unavailable/checker_failed', 'a checker failure does not mark any other category [P2-S11-AC-101]');
select is((pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'failed', 0)))->>'passed')::boolean, false,
  'passed is false while any category is unavailable [P2-S11-AC-097]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok') - 'evidence'), 'accessibility'),
  'unavailable/checker_failed', 'a request with no evidence cannot satisfy the Worker-resident provider: unavailable [P2-S11-AC-101]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{"evidence":null}')), 'accessibility'),
  'unavailable/checker_failed', 'null evidence is the same unavailable result [P2-S11-AC-101]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 61))),
  'P0001:preflight_evidence_stale', 'evidence evaluated 61 s ago is stale (409 preflight_evidence_stale) [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, -61))),
  'P0001:preflight_evidence_stale', 'evidence stamped 61 s in the future is stale as well (the window is symmetric) [P2-S11-AC-102]');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 55)))), '',
  'evidence 55 s old is accepted and passes [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, '{"providerVersion":"2"}'))),
  'P0001:preflight_evidence_stale', 'evidence of another provider version is stale: the Worker must run the current checker [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, '{"providerKey":"cms.a11y.other"}'))),
  'P0001:INVALID_REQUEST', 'evidence of another provider key is malformed (the contract fixes the key) [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:dependency_changed', 'evidence bound to other canonical rows is 409 dependency_changed (BE03b) in the submit phase [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('schedule', 'ok', 'reviewer04', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:dependency_changed', '... and in the schedule phase [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('publish', 'ok', 'reviewer04', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:dependency_changed', '... and in the publish phase [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('execute', 'ok', 'reviewer04', '{}', pg_temp.h11p_evidence('ok', 'healthy', 0, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:preflight_evidence_stale', 'at execution stale or mis-bound evidence is preflight_evidence_stale (DEC-158c) [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('execute', 'ok', 'reviewer04', '{}', pg_temp.h11p_evidence('ok', 'blocked', 2, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:preflight_evidence_stale', 'DEC-158c: the binding is verified for EVERY outcome, a blocked run included [P2-S11-AC-102]');
select is(pg_temp.h11p_err(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', pg_temp.h11p_evidence('ok', 'failed', 0, 0, jsonb_build_object('bindingHash', repeat('0', 64))))),
  'P0001:dependency_changed', 'a failed run is still verified: a mis-bound failed run is dependency_changed, not an unavailable result [P2-S11-AC-102]');

-- ---------------------------------------------------------------------------
-- 1 contract: stored values, the frozen validators and the relation write rules.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('cv');
select pg_temp.h11p_rawvalue(pg_temp.h11w_uuid('cv:revision'), 'title', to_jsonb(123));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'cv')), 'contract'), 'failed/value_invalid',
  'a stored value that violates its field kind (a number in a short_text field) fails contract value_invalid [P2-S11-AC-095]');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'cv'))), 'contract:failed/value_invalid,revocation:failed/entry_unavailable',
  'no short circuit: the contract failure is reported beside the other categories (the cv entry also has no author assignment) [P2-S11-AC-097]');

select pg_temp.h11w_revision('cr');
select pg_temp.h11p_assignment('cr', 'creatorPerson');
select pg_temp.h11_raw_exec('platform_private.cms_entry_relations', format(
  'insert into platform_private.cms_entry_relations(owner_id, state, version, revision_id, field_id, field_definition_id, target_kind, target_id, expected_target_version, position, on_unavailable, created_at, updated_at) select %L::uuid, ''active'', 1, %L::uuid, %L::uuid, %L::uuid, ''content'', (''a9250000-0000-4000-8000-'' || lpad(to_hex(n), 12, ''0''))::uuid, 1, n, ''omit'', timestamptz ''2026-10-08T12:00:00Z'', timestamptz ''2026-10-08T12:00:00Z'' from generate_series(1, 9) n',
  pg_temp.h11w_org(), pg_temp.h11w_uuid('cr:revision'), pg_temp.h11w_fid('rel_omit'), pg_temp.h11w_fdef('rel_omit')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'cr')), 'contract'), 'failed/value_invalid',
  'nine relation targets in a field whose RelationDefinition allows eight break the relation write rules [P2-S11-AC-095]');

select pg_temp.h11w_revision('cok');
select pg_temp.h11p_assignment('cok', 'creatorPerson');
select pg_temp.h11p_rawvalue(pg_temp.h11w_uuid('cok:revision'), 'body', pg_temp.h11w_rich('fine'));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'cok')), 'contract'), 'passed/-',
  'control: a valid rich_text.v1 value passes the contract check [P2-S11-AC-095]');

-- validators frozen into the artifact differ from the registry's current descriptors.
select pg_temp.h11_raw_exec('platform_private.cms_schema_artifacts',
  format($$update platform_private.cms_schema_artifacts set editor_manifest = editor_manifest - 'validators' where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L::uuid)$$, pg_temp.h11w_version()));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'contract'), 'failed/validators_changed',
  'an artifact whose frozen protected validators no longer equal the registry''s fails contract validators_changed [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_artifacts',
  format($$update platform_private.cms_schema_artifacts set editor_manifest = editor_manifest || jsonb_build_object('validators', jsonb_build_array(platform_private.cms_protected_validator_descriptor('rich_text.v1', 1))) where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L::uuid)$$, pg_temp.h11w_version()));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'contract'), 'passed/-',
  'control: with the descriptor frozen again the contract check passes [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 2 schema
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format($$update platform_private.cms_content_type_versions set state = 'superseded' where id = %L::uuid$$, pg_temp.h11w_version()));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'schema'), 'failed/schema_not_active',
  'a revision whose schema version is no longer the content type''s active version fails schema_not_active [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions',
  format($$update platform_private.cms_content_type_versions set state = 'active' where id = %L::uuid$$, pg_temp.h11w_version()));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'schema'), 'passed/-', 'control: reactivated, schema passes [P2-S11-AC-095]');

select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{schema,schemaArtifact,zodContractRef}', '"cms/zod/other"'))), 'schema'),
  'failed/schema_evidence_changed', 'a frozen artifact contract reference that differs from the rebuilt one fails schema_evidence_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{schema,workflowPolicy,policyHash}', to_jsonb(repeat('0', 64))))), 'schema'),
  'failed/schema_evidence_changed', 'a frozen workflow policy that differs fails schema_evidence_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{schema,activationEvidence,approvalEvidenceHash}', to_jsonb(repeat('0', 64))))), 'schema'),
  'failed/schema_evidence_changed', 'a frozen activation evidence that differs fails schema_evidence_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{schema,validatorRefs}', '[]'::jsonb))), 'schema'),
  'failed/schema_evidence_changed', 'frozen protected validator refs that differ fail schema_evidence_changed [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 3 template
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('tpl', 'creatorPerson', 'en-US', '[]'::jsonb, null, 1, 'a9200000-0000-4000-8000-0000000d0001'::uuid);
select pg_temp.h11p_assignment('tpl', 'creatorPerson');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'tpl')), 'template'), 'passed/-',
  'an active, compatible template whose digest equals the manifest passes [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'template'), 'passed/-',
  'a revision with no template is unaffected [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'tpl', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('tpl'), '{template,hash}', to_jsonb(repeat('0', 64))))), 'template'),
  'failed/template_changed', 'a frozen template digest that differs fails template_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'tpl', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('tpl'), '{template}', 'null'::jsonb))), 'template'),
  'failed/template_changed', 'a template that was not frozen is a changed template [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set compatible_type_ids = '["a9200000-0000-4000-8000-0000000fffff"]'::jsonb where id = 'a9200000-0000-4000-8000-0000000d0001'$$);
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'tpl')), 'template'), 'failed/template_incompatible',
  'a template no longer compatible with the content type fails template_incompatible [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  format($$update platform_private.cms_template_versions set compatible_type_ids = jsonb_build_array(%L) where id = 'a9200000-0000-4000-8000-0000000d0001'$$, (select value from h11w_ids where key = 'typeId')));
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set state = 'retired' where id = 'a9200000-0000-4000-8000-0000000d0001'$$);
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'tpl')), 'template'), 'failed/template_not_active',
  'a template that is no longer active fails template_not_active (before any compatibility or digest reason) [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_template_versions',
  $$update platform_private.cms_template_versions set state = 'active' where id = 'a9200000-0000-4000-8000-0000000d0001'$$);

-- ---------------------------------------------------------------------------
-- 4 block
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('blk');
select pg_temp.h11p_assignment('blk', 'creatorPerson');
select pg_temp.h11m_instance('blk:i1', pg_temp.h11w_uuid('blk:revision'), '/a', 'h11.second');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'blk')), 'block'), 'passed/-',
  'a supported block whose digest equals the frozen one passes [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'blk', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('blk'), '{blocks,0,hash}', to_jsonb(repeat('0', 64))))), 'block'),
  'failed/block_digest_changed', 'a frozen block digest that differs fails block_digest_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'blk', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('blk'), '{blocks}', '[]'::jsonb))), 'block'),
  'failed/block_digest_changed', 'a reachable block that was not frozen changes the reachable-set digest [P2-S11-AC-095]');
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0002', 'h11.second', 'deprecated');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'blk')), 'block'), 'passed/-',
  'a deprecated block still passes (supported or deprecated) [P2-S11-AC-095]');
select pg_temp.h11m_lifecycle('a9200000-0000-4000-8000-0000000b0002', 'h11.second', 'withdrawn');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'blk')), 'block'), 'failed/block_withdrawn',
  'a withdrawn block fails block_withdrawn [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 5, 6, 9, 12, 13, 14: the generic reference gate (D19)
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('gate-pattern');
select pg_temp.h11p_assignment('gate-pattern', 'creatorPerson');
select pg_temp.h11m_instance('gate-pattern:i1', pg_temp.h11w_uuid('gate-pattern:revision'), '/a', 'h11.first', 'a9200000-0000-4000-8000-0000000c0001');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-pattern'))), 'pattern:failed/provider_unbuilt_reference',
  'a composition instance naming a PatternVersion fails the pattern gate with provider_unbuilt_reference and nothing else [P2-S11-AC-094]');
select is((select r->>'blockingCount' from jsonb_array_elements(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-pattern'))->'results') r where r->>'category' = 'pattern'),
  '1', 'the gate result carries the reference count [P2-S11-AC-094]');

select pg_temp.h11w_revision('gate-tax', 'creatorPerson', 'en-US', jsonb_build_array(pg_temp.h11w_uuid('taxv')));
select pg_temp.h11p_assignment('gate-tax', 'creatorPerson');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-tax'))), 'taxonomy:failed/provider_unbuilt_reference',
  'a recorded taxonomy version fails the taxonomy gate [P2-S11-AC-094]');

select pg_temp.h11w_revision('gate-priv');
select pg_temp.h11p_assignment('gate-priv', 'creatorPerson');
update platform_private.cms_content_entries set lifecycle = 'held', version = version + 1 where id = pg_temp.h11w_uuid('gate-priv:entry');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-priv'))),
  'privacy:failed/provider_unbuilt_reference,revocation:failed/entry_unavailable',
  'a held entry fails the privacy gate and the revocation lifecycle check, each with its own registered reason [P2-S11-AC-094]');

select pg_temp.h11w_revision('gate-media');
select pg_temp.h11p_assignment('gate-media', 'creatorPerson');
select pg_temp.h11p_rawvalue(pg_temp.h11w_uuid('gate-media:revision'), 'hero',
  jsonb_build_object('assetId', pg_temp.h11w_uuid('asset'), 'assetVersion', '1'));
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-media'))), 'media:failed/provider_unbuilt_reference',
  'a non-empty media value fails the media gate [P2-S11-AC-094]');

select pg_temp.h11w_revision('gate-route');
select pg_temp.h11p_assignment('gate-route', 'creatorPerson');
select pg_temp.h11p_rawvalue(pg_temp.h11w_uuid('gate-route:revision'), 'body',
  pg_temp.h11w_rich('see', jsonb_build_object('kind', 'internal', 'route', '/news/a')));
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-route'))), 'route:failed/provider_unbuilt_reference',
  'a rich-text internal link fails the route gate [P2-S11-AC-094]');

select pg_temp.h11w_revision('gate-loc');
select pg_temp.h11p_assignment('gate-loc', 'creatorPerson');
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'no_fallback' where field_key = 'legal'$$);
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-loc'))), 'locale:failed/provider_unbuilt_reference',
  'a schema that declares a no_fallback field is a locale reference even for a source-locale revision [P2-S11-AC-094]');
select pg_temp.h11_raw_exec('platform_private.cms_field_definition_versions',
  $$update platform_private.cms_field_definition_versions set localization_mode = 'localized' where field_key = 'legal'$$);
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-loc'))), '',
  'control: without the no_fallback field the locale gate passes [P2-S11-AC-094]');

-- The registry row, not a constant, decides the provider: a newer media row is a database provider.
select pg_temp.h11_raw_insert('platform_private.cms_preflight_registry', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', '0d6a0d6a-0000-4000-8000-000000000134', 'state', 'seeded',
  'version', 2, 'category', 'media', 'owner_slice', 'slice-14', 'provider_key', 'cms.media.referenced',
  'provider_version', 1, 'provider_kind', 'database', 'reference_kind', null, 'created_at', now(), 'updated_at', now()));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'gate-media')), 'media'), 'unavailable/provider_unavailable',
  'a category whose current registry row is a provider this slice does not implement is unavailable (provider_unavailable), never silently passed [P2-S11-AC-093]');
select pg_temp.h11_raw_exec('platform_private.cms_preflight_registry',
  $$delete from platform_private.cms_preflight_registry where category = 'media' and version = 2$$);

-- Dispatch is on (provider_key, provider_version), not on the key alone (DEC-160): every provider this slice implements is
-- version 1, so a newer registry row naming the SAME key at another version is unavailable, never evaluated as version 1.
select pg_temp.h11_raw_insert('platform_private.cms_preflight_registry', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', '0d6a0d6a-0000-4000-8000-000000000134', 'state', 'seeded',
  'version', 2, 'category', 'contract', 'owner_slice', 'slice-10', 'provider_key', 'preflight.contract',
  'provider_version', 2, 'provider_kind', 'database', 'reference_kind', null, 'created_at', now(), 'updated_at', now()));
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok'))), 'contract:unavailable/provider_unavailable',
  'registry version 2 naming preflight.contract at provider version 2 is unavailable (provider_unavailable) although every v1 contract check passes, and marks no other category [P2-S11-AC-093]');
select pg_temp.h11_raw_exec('platform_private.cms_preflight_registry',
  $$delete from platform_private.cms_preflight_registry where category = 'contract' and version = 2$$);
select pg_temp.h11_raw_insert('platform_private.cms_preflight_registry', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', '0d6a0d6a-0000-4000-8000-000000000134', 'state', 'seeded',
  'version', 2, 'category', 'contract', 'owner_slice', 'slice-10', 'provider_key', 'preflight.contract',
  'provider_version', 1, 'provider_kind', 'database', 'reference_kind', null, 'created_at', now(), 'updated_at', now()));
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok'))), '',
  'control: registry version 2 that still names provider version 1 is the implemented provider and passes [P2-S11-AC-093]');
select pg_temp.h11_raw_exec('platform_private.cms_preflight_registry',
  $$delete from platform_private.cms_preflight_registry where category = 'contract' and version = 2$$);

-- Every kind and every category: a version-2 row of each of the seventeen current providers (database, reference_gate, worker).
select pg_temp.h11_raw_insert('platform_private.cms_preflight_registry', jsonb_build_object(
  'id', extensions.gen_random_uuid(), 'owner_id', '0d6a0d6a-0000-4000-8000-000000000134', 'state', 'seeded',
  'version', 2, 'category', current_row.category, 'owner_slice', current_row.owner_slice,
  'provider_key', current_row.provider_key, 'provider_version', 2, 'provider_kind', current_row.provider_kind,
  'reference_kind', current_row.reference_kind, 'created_at', now(), 'updated_at', now()))
  from platform_private.cms_preflight_registry_current() current_row;
create temp table h11p_v2_report on commit drop as
  select pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}',
    pg_temp.h11p_evidence('ok', 'healthy', 0, 0,
      jsonb_build_object('providerVersion', '2', 'bindingHash', pg_temp.h11p_binding('ok', '2'))))) as report;
select is((select report->>'error' from h11p_v2_report), null,
  'the version-2 evaluation is a report, not a raised error (the evidence is bound to the version-2 checker) [P2-S11-AC-093]');
select is((select count(*)::integer from h11p_v2_report, jsonb_array_elements(report->'results') result
            where result->>'outcome' = 'unavailable' and result->>'reasonCode' = 'provider_unavailable'
              and result->>'providerVersion' = '2'),
  17, 'a version-2 row of every database, reference_gate and worker provider is unavailable/provider_unavailable, none is evaluated as v1 [P2-S11-AC-093]');
select is((select (report->>'passed')::boolean from h11p_v2_report), false,
  'passed is false when any provider version is unimplemented [P2-S11-AC-097]');
select pg_temp.h11_raw_exec('platform_private.cms_preflight_registry',
  $$delete from platform_private.cms_preflight_registry where version = 2$$);

-- ---------------------------------------------------------------------------
-- 7 settings
-- ---------------------------------------------------------------------------
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{settings,version}', '"2"'))), 'settings'),
  'failed/settings_changed', 'a frozen settings ordinal that differs from the recomputed snapshot fails settings_changed [P2-S11-AC-095]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'creatorPerson', '{}', null,
    jsonb_set(pg_temp.h11p_manifest('ok'), '{settings,hash}', to_jsonb(repeat('0', 64))))), 'settings'),
  'failed/settings_changed', 'a frozen settings hash that differs fails settings_changed [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 8 relation
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('rt-active');
select pg_temp.h11w_revision('rt-arch');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('rt-arch:entry');

select pg_temp.h11w_revision('rel-block');
select pg_temp.h11p_assignment('rel-block', 'creatorPerson');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel-block:revision'), 'rel_block', pg_temp.h11w_uuid('rt-arch:entry'), 2, 0, 'block');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rel-block'))), 'relation:failed/relation_target_unavailable',
  'a block-policy relation to an unavailable target fails relation_target_unavailable [P2-S11-AC-095]');

select pg_temp.h11w_revision('rel-omit');
select pg_temp.h11p_assignment('rel-omit', 'creatorPerson');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel-omit:revision'), 'rel_omit', pg_temp.h11w_uuid('rt-active:entry'), 1, 0, 'omit');
create temp table h11p_rel_omit on commit drop as select pg_temp.h11p_manifest('rel-omit') as manifest;
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('rt-active:entry');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rel-omit', 'creatorPerson', '{}', null, (select manifest from h11p_rel_omit)))), '',
  'an omit-policy relation whose target became unavailable after freezing is honoured (omitted), not a failure [P2-S11-AC-095]');

select pg_temp.h11w_revision('rt-moves');
select pg_temp.h11w_revision('rel-ver');
select pg_temp.h11p_assignment('rel-ver', 'creatorPerson');
select pg_temp.h11w_relation(pg_temp.h11w_uuid('rel-ver:revision'), 'rel_omit', pg_temp.h11w_uuid('rt-moves:entry'), null, 0, 'omit');
create temp table h11p_rel_ver on commit drop as select pg_temp.h11p_manifest('rel-ver') as manifest;
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rel-ver', 'creatorPerson', '{}', null, (select manifest from h11p_rel_ver)))), '',
  'control: the frozen target version equals the current one, relation passes [P2-S11-AC-095]');
update platform_private.cms_content_entries set version = version + 1 where id = pg_temp.h11w_uuid('rt-moves:entry');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rel-ver', 'creatorPerson', '{}', null, (select manifest from h11p_rel_ver)))),
  'relation:failed/relation_version_changed', 'a target whose version moved past the frozen one fails relation_version_changed [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 10 security
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11p_secure(p_tag text, p_field text, p_value jsonb)
returns text
language plpgsql
as $body$
begin
  perform pg_temp.h11w_revision(p_tag);
  perform pg_temp.h11p_assignment(p_tag, 'creatorPerson');
  perform pg_temp.h11p_rawvalue(pg_temp.h11w_uuid(p_tag || ':revision'), p_field, p_value);
  return pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', p_tag)));
end;
$body$;

select is(pg_temp.h11p_secure('sec-script', 'title', to_jsonb('<script>alert(1)</script>'::text)), 'security:failed/unsafe_content',
  'a script element in a stored value fails security unsafe_content [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-js', 'title', to_jsonb('javascript:alert(1)'::text)), 'security:failed/unsafe_content',
  'a value that is a javascript: URL fails security [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-js2', 'title', to_jsonb(E' Ja\tVa\nScRiPt :alert(1)'::text)), 'security:failed/unsafe_content',
  'case, whitespace and control characters inside the scheme do not hide it [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-data', 'title', to_jsonb('data:text/html;base64,PHNjcmlwdD4='::text)), 'security:failed/unsafe_content',
  'a data:text/html URL fails security [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-handler', 'title', to_jsonb('<img src=x onerror=alert(1)>'::text)), 'security:failed/unsafe_content',
  'an HTML event-handler attribute fails security [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-css', 'title', to_jsonb('<style>body{background:url(javascript:x)}</style>'::text)), 'security:failed/unsafe_content',
  'a style element fails security (CSS) [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-tpl', 'title', to_jsonb('{{constructor.constructor("x")()}}'::text)), 'security:failed/unsafe_content',
  'a template expression fails security [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-ok', 'title', to_jsonb('Fish & chips <3 — a < b, 5 > 3, "javascript is fine", on Monday = open'::text)), '',
  'control: benign punctuation and the word javascript do not trip the rules [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-rt', 'body',
    jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object('text', 'x', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'https://ok.example/a'))))))), '',
  'control: a canonical rich_text.v1 value with an https link passes [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-rt2', 'body',
    jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object('text', 'x', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'javascript:alert(1)'))))))), 'contract:failed/value_invalid,security:failed/unsafe_content',
  'a stored rich-text link with an unsafe scheme breaks the grammar: contract value_invalid and security unsafe_content [P2-S11-AC-095]');
select is(pg_temp.h11p_secure('sec-obj', 'meta', jsonb_build_object('label', 'ok',
    'note', jsonb_build_object('format', 'rich_text.v1', 'blocks', jsonb_build_array(jsonb_build_object('type', 'paragraph',
      'spans', jsonb_build_array(jsonb_build_object('text', 'x', 'marks', '[]'::jsonb,
        'link', jsonb_build_object('kind', 'https', 'href', 'javascript:alert(1)'))))))))
    like '%security:failed/unsafe_content%', true,
  'an unsafe rich-text property inside an object value is found as well [P2-S11-AC-095]');

select pg_temp.h11w_revision('sec-props');
select pg_temp.h11p_assignment('sec-props', 'creatorPerson');
select pg_temp.h11m_instance('sec-props:i1', pg_temp.h11w_uuid('sec-props:revision'), '/a', 'h11.third');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set props = '{"cta":{"href":"javascript:alert(1)"}}'::jsonb where id = %L::uuid$$, pg_temp.h11w_uuid('sec-props:i1')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'sec-props')), 'security'), 'failed/unsafe_content',
  'an executable URL inside block props fails security [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set props = '{"cta":{"href":"https://ok.example/"}}'::jsonb, bindings = '{"title":"{{page.title}}"}'::jsonb where id = %L::uuid$$, pg_temp.h11w_uuid('sec-props:i1')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'sec-props')), 'security'), 'failed/unsafe_content',
  'a template expression in block bindings fails security [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_composition_instances',
  format($$update platform_private.cms_composition_instances set bindings = '{}'::jsonb where id = %L::uuid$$, pg_temp.h11w_uuid('sec-props:i1')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'sec-props')), 'security'), 'passed/-',
  'control: safe props and bindings pass security [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 15 migration, 16 domain_binding
-- ---------------------------------------------------------------------------
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans', format(
  $q$insert into platform_private.cms_schema_migration_plans(id, owner_id, state, content_type_id, from_version_id, to_version_id, classification)
     values (%L::uuid, %L::uuid, 'running', %L::uuid, %L::uuid, %L::uuid, 'additive')$q$,
  pg_temp.h11w_uuid('plan'), pg_temp.h11w_org(), (select value from h11w_ids where key = 'typeId'), pg_temp.h11w_version(),
  (select value from s10_ids where key = 'draftVersionId')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'migration'), 'failed/migration_in_progress',
  'a revision whose schema version is the source of a non-terminal migration plan fails migration_in_progress [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans',
  format($$update platform_private.cms_schema_migration_plans set state = 'completed' where id = %L::uuid$$, pg_temp.h11w_uuid('plan')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'migration'), 'passed/-',
  'a completed plan is terminal and does not hold the revision [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans',
  format($$update platform_private.cms_schema_migration_plans set state = 'failed_retryable' where id = %L::uuid$$, pg_temp.h11w_uuid('plan')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'migration'), 'failed/migration_in_progress',
  'failed_retryable is not terminal [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans',
  format($$update platform_private.cms_schema_migration_plans set state = 'failed_terminal' where id = %L::uuid$$, pg_temp.h11w_uuid('plan')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'migration'), 'passed/-',
  'failed_terminal is terminal [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans',
  format($$update platform_private.cms_schema_migration_plans set state = 'running', from_version_id = to_version_id, to_version_id = %L::uuid where id = %L::uuid$$,
    pg_temp.h11w_version(), pg_temp.h11w_uuid('plan')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'migration'), 'failed/migration_in_progress',
  'the target of a non-terminal plan is held as well [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_schema_migration_plans',
  format($$delete from platform_private.cms_schema_migration_plans where id = %L::uuid$$, pg_temp.h11w_uuid('plan')));

select pg_temp.h11_raw_exec('platform_private.cms_relation_definitions',
  format($$update platform_private.cms_relation_definitions set projection_key = 'cms.not.allowlisted' where field_definition_id = %L::uuid$$, pg_temp.h11w_fdef('rel_omit')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'domain_binding'), 'failed/binding_not_allowlisted',
  'a frozen RelationDefinition whose projection key left the code-owned allowlist fails binding_not_allowlisted [P2-S11-AC-095]');
select pg_temp.h11_raw_exec('platform_private.cms_relation_definitions',
  format($$update platform_private.cms_relation_definitions set projection_key = 'cms.article.card' where field_definition_id = %L::uuid$$, pg_temp.h11w_fdef('rel_omit')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'domain_binding'), 'passed/-',
  'control: restored, domain_binding passes [P2-S11-AC-095]');

-- ---------------------------------------------------------------------------
-- 17 revocation
-- ---------------------------------------------------------------------------
-- submit: the entry lifecycle and the submitter's authority.
select pg_temp.h11w_revision('rv-arch');
select pg_temp.h11p_assignment('rv-arch', 'creatorPerson');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('rv-arch:entry');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rv-arch'))), 'revocation:failed/entry_unavailable',
  'an archived entry fails revocation entry_unavailable [P2-S11-AC-096]');
update platform_private.cms_content_entries set lifecycle = 'deletion_pending', version = version + 1 where id = pg_temp.h11w_uuid('rv-arch:entry');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'rv-arch')), 'revocation'), 'failed/entry_unavailable',
  'a deletion_pending entry fails revocation entry_unavailable [P2-S11-AC-096]');

select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok', 'editorPerson')), 'revocation'), 'failed/entry_unavailable',
  'submit: a submitter with no active assignment on the entry is refused with the only reason the category registers for the entry [P2-S11-AC-096]');
select pg_temp.h11_raw_exec('platform_private.cms_entry_assignments',
  format($$update platform_private.cms_entry_assignments set state = 'revoked', version = 2 where entry_id = %L::uuid$$, pg_temp.h11w_uuid('ok:entry')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'revocation'), 'failed/entry_unavailable',
  'submit: a revoked assignment is no authority [P2-S11-AC-096]');
select pg_temp.h11_raw_exec('platform_private.cms_entry_assignments',
  format($$update platform_private.cms_entry_assignments set state = 'active', version = 3 where entry_id = %L::uuid$$, pg_temp.h11w_uuid('ok:entry')));
update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.h11w_person('creatorPerson') and capability_code = 'cms.author';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'revocation'), 'failed/entry_unavailable',
  'submit: an assignment without the standing organization grant is no authority [P2-S11-AC-096]');
update identity_private.organization_actor_grant set active = true
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.h11w_person('creatorPerson') and capability_code = 'cms.author';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'revocation'), 'failed/entry_unavailable',
  'DEC-143: losing the grant revoked the assignment, and re-granting the capability never restores it [P2-S11-AC-096]');
select pg_temp.h11_raw_exec('platform_private.cms_entry_assignments',
  format($$update platform_private.cms_entry_assignments set state = 'active', version = version + 1 where entry_id = %L::uuid$$, pg_temp.h11w_uuid('ok:entry')));
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok')), 'revocation'), 'passed/-',
  'control: with the grant and a fresh assignment the submit revocation check passes [P2-S11-AC-096]');

-- schedule / publish / execute: the publisher.
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'ok', 'creatorPerson')), 'revocation'), 'failed/publisher_authority_ended',
  'schedule: a caller with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'ok', 'creatorPerson')), 'revocation'), 'failed/publisher_authority_ended',
  'publish: a caller with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('execute', 'ok', 'creatorPerson')), 'revocation'), 'failed/publisher_authority_ended',
  'execute: a schedule creator with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]');

update identity_private.organization_actor_grant
   set valid_from = current_date - 3, valid_through = current_date
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'ok', 'reviewer04', jsonb_build_object('effectiveAt',
    platform_private.auth_iso_time(date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '23 hours 59 minutes 59 seconds')))),
  'revocation'), 'passed/-', 'a grant valid through today covers an action taking effect at 23:59:59 UTC today [P2-S11-AC-096]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'ok', 'reviewer04', jsonb_build_object('effectiveAt',
    platform_private.auth_iso_time(date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 day')))),
  'revocation'), 'failed/publisher_authority_ended', 'a grant that ends today does not cover an action taking effect at 00:00:00 UTC tomorrow [P2-S11-AC-096]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('execute', 'ok', 'reviewer04', jsonb_build_object('effectiveAt',
    platform_private.auth_iso_time(date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '3 days')))),
  'revocation'), 'failed/publisher_authority_ended', 'execute: a creator grant that ended before the fire instant fails (DEC-120) [P2-S11-AC-096]');
update identity_private.organization_actor_grant
   set valid_from = current_date, valid_through = null
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';

update identity_private.organization_actor_grant set active = false
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'ok', 'reviewer04')), 'revocation'), 'failed/publisher_authority_ended',
  'a revoked publisher grant fails publisher_authority_ended [P2-S11-AC-096]');
update identity_private.organization_actor_grant set active = true
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';
update identity_private.organization_actor_grant set valid_from = current_date + 1
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'ok', 'reviewer04')), 'revocation'), 'failed/publisher_authority_ended',
  'a grant that has not started is no current authority [P2-S11-AC-096]');
update identity_private.organization_actor_grant set valid_from = current_date
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04') and capability_code = 'cms.publisher';
update identity_private.membership_tenure set state = 'ended', revoked_at = clock_timestamp(), ends_on = current_date + 1
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'ok', 'reviewer04')), 'revocation'), 'failed/publisher_authority_ended',
  'an ended tenure ends the publisher authority even with the grant row intact [P2-S11-AC-096]');
update identity_private.membership_tenure set state = 'confirmed', revoked_at = null, ends_on = null
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer04');

select pg_temp.h11w_revision('rv-sched-arch');
update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1 where id = pg_temp.h11w_uuid('rv-sched-arch:entry');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('execute', 'rv-sched-arch', 'reviewer04')), 'revocation'), 'failed/entry_unavailable',
  'execute: an entry that left active fails entry_unavailable [P2-S11-AC-096]');

-- counted approvers (schedule and publish; execute is limited to the creator grant)
select pg_temp.h11r_member('reviewer01', array['cms.reviewer']);
select pg_temp.h11w_revision('rv-appr');
select pg_temp.h11p_assignment('rv-appr', 'creatorPerson');
select pg_temp.h11r_approved('rv-review', pg_temp.h11w_uuid('rv-appr:revision'), pg_temp.h11w_uuid('rv-appr:entry'), 'reviewer01');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review'))), '',
  'schedule with an approved review whose counted approver is still qualified passes [P2-S11-AC-096]');
update identity_private.organization_actor_grant set valid_from = current_date - 5, valid_through = current_date - 1
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer01') and capability_code = 'cms.reviewer';
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review')), 'revocation'),
  'failed/reviewer_authority_changed', 'schedule: a counted approver whose standing grant lapsed is found lazily: reviewer_authority_changed [P2-S11-AC-110]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('publish', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review')), 'revocation'),
  'failed/reviewer_authority_changed', 'publish: the same lapse fails the publish phase [P2-S11-AC-110]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('execute', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review')), 'revocation'),
  'passed/-', 'execute rechecks only the creator''s publisher grant and the entry (DEC-120): approvals are invalidated at the loss, not re-counted [P2-S11-AC-096]');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'rv-appr', 'reviewer04')), 'revocation'),
  'passed/-', 'without a review id the approvers are not part of the check [P2-S11-AC-096]');
update identity_private.organization_actor_grant set valid_from = current_date, valid_through = null
 where organization_id = pg_temp.h11w_org() and person_id = pg_temp.s11_id('reviewer01') and capability_code = 'cms.reviewer';
update platform_private.cms_editorial_review_assignments set state = 'revoked', version = version + 1, updated_at = clock_timestamp()
 where id = pg_temp.s11_id('rv-review-asg');
select is(pg_temp.h11p_res(pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review')), 'revocation'),
  'failed/reviewer_authority_changed', 'a counted approver''s assignment revoked after the decision is no longer counted: reviewer_authority_changed [P2-S11-AC-110]');

-- ---------------------------------------------------------------------------
-- Aggregation: every category is evaluated, none short-circuits.
-- ---------------------------------------------------------------------------
select pg_temp.h11w_revision('multi');
select pg_temp.h11p_assignment('multi', 'creatorPerson');
select pg_temp.h11p_rawvalue(pg_temp.h11w_uuid('multi:revision'), 'title', to_jsonb('<script>x</script>'::text));
select pg_temp.h11m_instance('multi:i1', pg_temp.h11w_uuid('multi:revision'), '/a', 'h11.first', 'a9200000-0000-4000-8000-0000000c0001');
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'multi', 'creatorPerson', '{}', pg_temp.h11p_evidence('multi', 'blocked', 2),
    jsonb_set(pg_temp.h11p_manifest('multi'), '{settings,version}', '"9"')))),
  'accessibility:failed/blocking_finding,pattern:failed/provider_unbuilt_reference,security:failed/unsafe_content,settings:failed/settings_changed',
  'four independent failures in one revision are all reported, in the same report [P2-S11-AC-097]');
select is((pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'multi', 'creatorPerson', '{}', pg_temp.h11p_evidence('multi', 'blocked', 2)))->>'passed')::boolean, false,
  'passed is false when any category failed [P2-S11-AC-097]');
select is(jsonb_array_length(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'multi'))->'results'), 17,
  'the report still lists all seventeen categories [P2-S11-AC-097]');

-- A failed category and an unavailable one together: both are present for the caller to aggregate.
select is(pg_temp.h11p_bad(pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'multi', 'creatorPerson', '{}', pg_temp.h11p_evidence('multi', 'failed', 0)))),
  'accessibility:unavailable/checker_failed,pattern:failed/provider_unbuilt_reference,security:failed/unsafe_content',
  'failed and unavailable results coexist; the caller applies failed => 422, else unavailable => 503 [P2-S11-AC-097]');

-- ---------------------------------------------------------------------------
-- Writes and posture.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.h11p_fingerprint()
returns text
language sql
as $body$
  select (select count(*) from platform_private.outbox_events)::text || '/'
      || (select count(*) from audit_private.audit_events)::text || '/'
      || (select count(*) from platform_private.cms_editorial_reviews)::text || '/'
      || (select count(*) from platform_private.cms_publication_schedules)::text || '/'
      || (select count(*) from platform_private.idempotency_records)::text
      || '/' || (select coalesce(jsonb_agg(to_jsonb(snapshot)
          order by snapshot.owner_id, snapshot.ordinal, snapshot.id), '[]'::jsonb)::text
        from platform_private.cms_publication_settings_snapshots snapshot)
$body$;
create temp table h11p_before on commit drop as select pg_temp.h11p_fingerprint() as fp;
select pg_temp.h11p_eval(pg_temp.h11p_request('submit', 'ok'));
select pg_temp.h11p_eval(pg_temp.h11p_request('schedule', 'rv-appr', 'reviewer04', '{}', null, null, 'rv-review'));
select is(pg_temp.h11p_fingerprint(), (select fp from h11p_before),
  'an evaluation writes no outbox, audit, review, schedule or idempotency row and preserves entire settings snapshot row images [P2-S11-AC-097]');
select is(
  (select count(*)::integer from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private'
      and p.proname in ('cms_evaluate_preflight', 'cms_preflight_registry_current', 'cms_accessibility_binding_hash')),
  3, 'exactly one overload of each preflight helper exists [P2-S11-AC-093]');

select * from finish();
rollback;
