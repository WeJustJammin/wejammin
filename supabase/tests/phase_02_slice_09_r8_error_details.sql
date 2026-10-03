commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 R8 (r8-worker-cms NEEDS-DB ND-1, ND-2, ND-3), BE00 error details.
--   ND-1  A well-formed stale If-Match is 409 VERSION_MISMATCH, with the
--         expectedVersion and currentVersion decimal strings in DETAIL, once the
--         authorized resource has been resolved (BE00 "A well-formed stale tag
--         returns 409 VERSION_MISMATCH").  A state conflict stays a bare
--         CONFLICT with no version detail.
--   ND-2  Every 403 FORBIDDEN names a registered reasonCode in DETAIL:
--         OWNER_REQUIRED for the owner-only operations and CAPABILITY_REQUIRED
--         for a missing capability or assignment; never a policy predicate.
--   ND-3  OD-4 locale violations carry { path, message } (BE03a OD-4), the BE00
--         member name, not the earlier `pointer`.
-- The caller's authority is established first in every case, so the detail is
-- disclosed only to a caller who may read the resource.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.r8d_detail(p_label text) returns jsonb language sql stable as $body$
  select case when pg_temp.s09d_detail(p_label) ~ '^\{' then pg_temp.s09d_detail(p_label)::jsonb end $body$;
create or replace function pg_temp.r8d_iso(p_offset interval) returns text language sql as $body$
  select to_char((clock_timestamp() + p_offset) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $body$;
-- A stale call: the outcome and DETAIL (or no-detail) in one comparable string.
create or replace function pg_temp.r8d_stale(p_label text) returns text language sql stable as $body$
  select pg_temp.s09d_outcome(p_label) || '|' || coalesce(pg_temp.r8d_detail(p_label)::text, 'no-detail') $body$;
create or replace function pg_temp.r8d_expected(p_current text) returns text language sql immutable as $body$
  select 'VERSION_MISMATCH|' || jsonb_build_object('expectedVersion', '999', 'currentVersion', p_current)::text $body$;

-- ------------------------------------------------------------------ ND-1 ----
select pg_temp.s09d_create_type('a', 'r8dstale');
-- CMS-03A-02
select pg_temp.s09d_rpc('a:stale:field', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'field', jsonb_build_object('key', 'related', 'kind', 'relation', 'constraints', '{}'::jsonb, 'required', false,
    'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Related', 'order', 1), 'lifecycle', 'active'),
  'migrationPlanId', null, 'expectedVersion', '999', 'idempotencyKey', 'r8d-stale-field-0001'));
select is(pg_temp.r8d_stale('a:stale:field'), pg_temp.r8d_expected(pg_temp.s09d_version('a')),
  'CMS-03A-02: a stale If-Match is 409 VERSION_MISMATCH carrying expectedVersion and currentVersion [P2-S09-AC-315]');
-- CMS-03A-03
select pg_temp.s09d_add_field_only('a');
select pg_temp.s09d_rpc('a:stale:relation', 'platform_api.cms_bind_relation', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'fieldId', pg_temp.s09d_id('a:fieldId'), 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
  'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'placeholder',
  'expectedVersion', '999', 'idempotencyKey', 'r8d-stale-relation-0001'));
select is(pg_temp.r8d_stale('a:stale:relation'), pg_temp.r8d_expected(pg_temp.s09d_version('a')),
  'CMS-03A-03: a stale If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
-- CMS-03A-10
select pg_temp.s09d_rpc('a:stale:dry', 'platform_api.cms_start_schema_dry_run', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'expectedVersion', '999',
  'transformKey', null, 'transformVersion', null, 'idempotencyKey', 'r8d-stale-dry-0001'));
select is(pg_temp.r8d_stale('a:stale:dry'), pg_temp.r8d_expected(pg_temp.s09d_version('a')),
  'CMS-03A-10: a stale If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
-- CMS-03A-11, and the control: a state conflict is a bare CONFLICT
select pg_temp.s09d_dry_run('a');
select pg_temp.s09d_seal('a');
select pg_temp.s09d_rpc('a:stale:submit', 'platform_api.cms_submit_schema_review', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'), 'expectedVersion', '999',
  'dryRunId', pg_temp.s09d_id('a:dryRun'), 'idempotencyKey', 'r8d-stale-submit-0001'), true);
select is(pg_temp.r8d_stale('a:stale:submit'), pg_temp.r8d_expected(pg_temp.s09d_version('a')),
  'CMS-03A-11: a stale If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
select pg_temp.s09d_submit('a');
select pg_temp.s09d_rpc('a:state:submit', 'platform_api.cms_submit_schema_review', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
  'expectedVersion', pg_temp.s09d_version('a'),
  'dryRunId', pg_temp.s09d_id('a:dryRun'), 'idempotencyKey', 'r8d-state-submit-0001'), true);
select is(pg_temp.r8d_stale('a:state:submit'), 'CONFLICT|no-detail',
  'control: a current version against a state that forbids the operation stays a bare CONFLICT with no version detail [P2-S09-AC-315]');
-- CMS-03A-14
select pg_temp.s09d_rpc('a:stale:assign', 'platform_api.cms_assign_schema_review', 'owner', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'action', 'create', 'expectedVersion', '999',
  'reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'expiresAt', pg_temp.r8d_iso(interval '1 day'),
  'reason', 'r8d stale', 'idempotencyKey', 'r8d-stale-assign-0001'), true);
select is(pg_temp.r8d_stale('a:stale:assign'), pg_temp.r8d_expected(pg_temp.s09d_review_version('a')),
  'CMS-03A-14: a stale review If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
select pg_temp.s09d_assign('a', 'rev1');
-- CMS-03A-12
select pg_temp.s09d_rpc('a:stale:decide', 'platform_api.cms_decide_schema_review', 'rev1', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'expectedVersion', '999', 'decision', 'approve',
  'idempotencyKey', 'r8d-stale-decide-0001'), true);
select is(pg_temp.r8d_stale('a:stale:decide'), pg_temp.r8d_expected(pg_temp.s09d_review_version('a')),
  'CMS-03A-12: a stale review If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
-- CMS-03A-04
select pg_temp.s09d_decide('a', 'rev1');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:stale:activate', jsonb_build_object('expectedVersion', '999'));
select is(pg_temp.r8d_stale('a:stale:activate'), pg_temp.r8d_expected(pg_temp.s09d_version('a')),
  'CMS-03A-04: a stale candidate If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
-- CMS-03A-09
select pg_temp.s09d_create_type('src', 'r8dsource');
select pg_temp.s09d_to_active('src');
select pg_temp.s09d_rpc('src:stale:successor', 'platform_api.cms_create_schema_successor', 'owner', jsonb_build_object(
  'contentTypeId', pg_temp.s09d_id('src:type'), 'versionId', pg_temp.s09d_id('src:version'), 'expectedVersion', '999',
  'supportedLocales', null, 'fallbackChains', null, 'idempotencyKey', 'r8d-stale-successor-0001'));
select is(pg_temp.r8d_stale('src:stale:successor'), pg_temp.r8d_expected(pg_temp.s09d_version('src')),
  'CMS-03A-09: a stale source If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
-- CMS-03A-16 and CMS-03A-17
select pg_temp.s09g_member('rev1');
select pg_temp.s09g_grant('r8d:grant', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3));
create temp table r8d_grant on commit drop as select pg_temp.s09g_grant_id(pg_temp.s09d_resp('r8d:grant')) as id,
  pg_temp.s09d_resp('r8d:grant')->>'version' as version;
select pg_temp.s09g_renew('r8d:stale:renew', 'owner', (select id from r8d_grant), '999', pg_temp.s09g_day(5));
select is(pg_temp.r8d_stale('r8d:stale:renew'), pg_temp.r8d_expected((select version from r8d_grant)),
  'CMS-03A-16: a stale grant If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');
select pg_temp.s09g_revoke('r8d:stale:revoke', 'owner', (select id from r8d_grant), '999');
select is(pg_temp.r8d_stale('r8d:stale:revoke'), pg_temp.r8d_expected((select version from r8d_grant)),
  'CMS-03A-17: a stale grant If-Match is 409 VERSION_MISMATCH carrying both versions [P2-S09-AC-315]');

-- ------------------------------------------------------------------ ND-2 ----
create or replace function pg_temp.r8d_reason(p_label text) returns text language sql stable as $body$
  select pg_temp.s09d_outcome(p_label) || '|' || coalesce(pg_temp.r8d_detail(p_label)::text, 'no-detail') $body$;
select pg_temp.s09d_create_type('f1', 'r8dforbidden', 'editorial', 'rev1');
select is(pg_temp.r8d_reason('f1:create'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'CAPABILITY_REQUIRED')::text,
  'CMS-03A-01: a caller without the designer capability is 403 FORBIDDEN with reasonCode CAPABILITY_REQUIRED [P2-S09-AC-306]');
select pg_temp.s09d_rpc('a:forbidden:assign', 'platform_api.cms_assign_schema_review', 'designer2', jsonb_build_object(
  'reviewId', pg_temp.s09d_id('a:review'), 'action', 'create', 'expectedVersion', pg_temp.s09d_review_version('a'),
  'reviewerPersonId', pg_temp.s09d_actor_id('rev2', 'person'), 'expiresAt', pg_temp.r8d_iso(interval '1 day'),
  'reason', 'r8d forbidden', 'idempotencyKey', 'r8d-forbidden-assign-0001'), true);
select is(pg_temp.r8d_reason('a:forbidden:assign'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'OWNER_REQUIRED')::text,
  'CMS-03A-14: a non-owner designer is 403 FORBIDDEN with reasonCode OWNER_REQUIRED [P2-S09-AC-493]');
select pg_temp.s09g_grant('r8d:forbidden:grant', 'designer2', 'rev1', 'cms.editor', pg_temp.s09g_day(3));
select is(pg_temp.r8d_reason('r8d:forbidden:grant'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'OWNER_REQUIRED')::text,
  'CMS-03A-15: a non-owner is 403 FORBIDDEN with reasonCode OWNER_REQUIRED [P2-S09-AC-306]');
select pg_temp.s09g_renew('r8d:forbidden:renew', 'designer2', (select id from r8d_grant), (select version from r8d_grant), pg_temp.s09g_day(5));
select is(pg_temp.r8d_reason('r8d:forbidden:renew'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'OWNER_REQUIRED')::text,
  'CMS-03A-16: a non-owner is 403 FORBIDDEN with reasonCode OWNER_REQUIRED [P2-S09-AC-306]');
select pg_temp.s09g_revoke('r8d:forbidden:revoke', 'designer2', (select id from r8d_grant), (select version from r8d_grant));
select is(pg_temp.r8d_reason('r8d:forbidden:revoke'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'OWNER_REQUIRED')::text,
  'CMS-03A-17: a non-owner is 403 FORBIDDEN with reasonCode OWNER_REQUIRED [P2-S09-AC-306]');
select pg_temp.s09g_list('r8d:forbidden:list', 'designer2');
select is(pg_temp.r8d_reason('r8d:forbidden:list'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'OWNER_REQUIRED')::text,
  'CMS-03A-18: a non-owner is 403 FORBIDDEN with reasonCode OWNER_REQUIRED [P2-S09-AC-306]');
select pg_temp.s09d_create_type('r', 'r8dreview');
select pg_temp.s09d_to_review('r');
select pg_temp.s09d_assign('r', 'rev1');
select pg_temp.s09d_decide('r', 'designer2', 'approve', '{}'::jsonb, 'r:forbidden:decide');
select is(pg_temp.r8d_reason('r:forbidden:decide'), 'FORBIDDEN|' || jsonb_build_object('reasonCode', 'CAPABILITY_REQUIRED')::text,
  'CMS-03A-12: a designer who can read the review but holds no assignment is 403 FORBIDDEN with reasonCode CAPABILITY_REQUIRED [P2-S09-AC-431]');

-- ------------------------------------------------------------------ ND-3 ----
select pg_temp.s09d_create_type('bad', 'r8dlocale', 'editorial', 'owner', '["fr-FR"]', '{}');
select is(pg_temp.s09d_outcome('bad:create'), 'VALIDATION_FAILED', 'fixture: a locale configuration missing the source and default locale is 422 VALIDATION_FAILED [P2-S09-AC-1182]');
select ok(jsonb_array_length(coalesce(pg_temp.r8d_detail('bad:create')->'violations', '[]'::jsonb)) >= 2
    and not exists (select 1 from jsonb_array_elements(pg_temp.r8d_detail('bad:create')->'violations') v
                     where (select array_agg(k order by k) from jsonb_object_keys(v) k) is distinct from array['message', 'path']::text[]
                        or v->>'path' !~ '^/'),
  'every locale violation is exactly { path, message } with a JSON-pointer path, never { pointer, message } [P2-S09-AC-1182]');

select * from finish();
rollback;
