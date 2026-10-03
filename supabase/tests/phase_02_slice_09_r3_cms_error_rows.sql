commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): database halves of the CMS-03A-09..18 error
-- rows the Worker lane proves only by mapping a stubbed port.  Every assertion
-- PRODUCES the condition through the real RPC (an unknown key, a missing actor,
-- a human without the capability, another organization, a stale version, an
-- invalid value) and expects the exact token the Worker maps to the status
-- (INVALID_REQUEST 400, UNAUTHENTICATED/STEP_UP_REQUIRED 401, FORBIDDEN 403,
-- NOT_FOUND 404, CONFLICT 409, VALIDATION_FAILED 422).  429/502/503/504 are
-- transport and limiter conditions proven by the Worker and rate suites.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- A call with no verified actor session and an empty envelope.
create or replace function pg_temp.r3_anon(p_label text, p_function text, p_request jsonb) returns jsonb language plpgsql as $body$
declare k text;
begin
  foreach k in array array['app.auth_user_id', 'app.actor_auth_user_id', 'app.actor_person_id', 'app.acting_party_id', 'app.acting_context_id', 'request.jwt.claim.sub'] loop
    perform set_config(k, '', true);
  end loop;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  return pg_temp.s09d_call(p_label, p_function, p_request || jsonb_build_object('context', '{}'::jsonb));
end;
$body$;
create or replace function pg_temp.r3_expect(p_label text, p_expected text, p_title text, p_marks text) returns text language sql as $body$
  select is_result from (select pg_temp.s09d_outcome(p_label) = p_expected as ok_, p_label as l) s, lateral (select 'x'::text as is_result) t $body$;

select pg_temp.s09g_member('rev1');
select pg_temp.s09g_member('rev2');

-- ----------------------------------------------------------- fixtures --------
-- x: a draft with a sealed passed dry run (submit/dry-run/successor targets);
-- m: an active type that is the successor source; y: an open review assigned to rev1.
select pg_temp.s09d_create_type('x', 'r3err_x');
select pg_temp.s09d_dry_run('x');
select pg_temp.s09d_seal('x');
select pg_temp.s09d_create_type('m', 'r3err_m');
select pg_temp.s09d_to_active('m');
select pg_temp.s09d_create_type('y', 'r3err_y');
select pg_temp.s09d_to_review('y');
select pg_temp.s09d_assign('y', 'rev1');
select pg_temp.s09g_grant('gfix', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('x:create') || pg_temp.s09d_outcome('m:create') || pg_temp.s09d_outcome('y:assign:rev1') || pg_temp.s09d_outcome('gfix'), 'OKOKOKOK', 'fixtures: draft x, active m, assigned open review y and a grant exist through the real producers');

-- request builders ------------------------------------------------------------
create or replace function pg_temp.r3_succ(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb, p_src text default 'm') returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_create_schema_successor', p_actor,
    jsonb_build_object('contentTypeId', pg_temp.s09d_id(p_src || ':type'), 'versionId', pg_temp.s09d_id(p_src || ':version'),
      'expectedVersion', pg_temp.s09d_version(p_src), 'supportedLocales', null, 'fallbackChains', null,
      'idempotencyKey', 'r3err-succ-' || substr(md5(p_label), 1, 12)) || p_patch, true) $body$;
create or replace function pg_temp.r3_dry(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_start_schema_dry_run', p_actor,
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('x:type'), 'versionId', pg_temp.s09d_id('x:version'),
      'expectedVersion', pg_temp.s09d_version('x'), 'transformKey', null, 'transformVersion', null,
      'idempotencyKey', 'r3err-dry-' || substr(md5(p_label), 1, 12)) || p_patch, true) $body$;
create or replace function pg_temp.r3_sub(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_submit_schema_review', p_actor,
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('x:type'), 'versionId', pg_temp.s09d_id('x:version'),
      'expectedVersion', pg_temp.s09d_version('x'), 'dryRunId', pg_temp.s09d_id('x:dryRun'),
      'idempotencyKey', 'r3err-sub-' || substr(md5(p_label), 1, 12)) || p_patch, true) $body$;
create or replace function pg_temp.r3_dec(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb, p_override jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_decide_schema_review', p_actor,
    jsonb_build_object('reviewId', pg_temp.s09d_id('y:review'), 'expectedVersion', pg_temp.s09d_review_version('y'), 'decision', 'approve',
      'idempotencyKey', 'r3err-dec-' || substr(md5(p_label), 1, 12)) || p_patch, true, p_override) $body$;
create or replace function pg_temp.r3_get(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb) returns jsonb language plpgsql as $body$
begin
  perform pg_temp.s09d_session(p_actor);
  return pg_temp.s09d_call(p_label, 'platform_api.cms_get_schema_review',
    jsonb_build_object('reviewId', pg_temp.s09d_id('y:review'), 'context', pg_temp.s09d_context(p_actor)) || p_patch);
end;
$body$;
create or replace function pg_temp.r3_asg(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb, p_override jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_assign_schema_review', p_actor,
    jsonb_build_object('reviewId', pg_temp.s09d_id('y:review'), 'action', 'create', 'expectedVersion', pg_temp.s09d_review_version('y'),
      'reviewerPersonId', pg_temp.s09d_actor_id('rev2', 'person'),
      'expiresAt', to_char((clock_timestamp() + interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'idempotencyKey', 'r3err-asg-' || substr(md5(p_label), 1, 12)) || p_patch, true, p_override) $body$;
create or replace function pg_temp.r3_ren(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb, p_override jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_renew_capability_grant', p_actor,
    jsonb_build_object('grantId', pg_temp.s09d_resp('gfix')->>'id', 'expectedVersion', pg_temp.s09d_resp('gfix')->>'version',
      'validThrough', pg_temp.s09g_day(9), 'idempotencyKey', 'r3err-ren-' || substr(md5(p_label), 1, 12)) || p_patch, true, p_override) $body$;
create or replace function pg_temp.r3_rev(p_label text, p_actor text, p_patch jsonb default '{}'::jsonb, p_override jsonb default '{}'::jsonb) returns jsonb language sql as $body$
  select pg_temp.s09d_rpc(p_label, 'platform_api.cms_revoke_capability_grant', p_actor,
    jsonb_build_object('grantId', pg_temp.s09d_resp('gfix')->>'id', 'expectedVersion', pg_temp.s09d_resp('gfix')->>'version',
      'idempotencyKey', 'r3err-rev-' || substr(md5(p_label), 1, 12)) || p_patch, true, p_override) $body$;

-- ================================================ CMS-03A-09 successor ========
select pg_temp.r3_succ('s09:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s09:401', 'platform_api.cms_create_schema_successor', jsonb_build_object('contentTypeId', pg_temp.s09d_id('m:type'), 'versionId', pg_temp.s09d_id('m:version'),
  'expectedVersion', pg_temp.s09d_version('m'), 'supportedLocales', null, 'fallbackChains', null, 'idempotencyKey', 'r3err-succ-anon-1'));
select pg_temp.r3_succ('s09:403', 'rev1');
select pg_temp.r3_succ('s09:404', 'other');
select pg_temp.r3_succ('s09:409', 'owner', '{"expectedVersion": "99"}');
select pg_temp.r3_succ('s09:422', 'owner', jsonb_build_object('supportedLocales', '["en-US"]', 'fallbackChains', null));
select is(pg_temp.s09d_outcome('s09:400'), 'INVALID_REQUEST', 'CMS-03A-09: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-304]');
select is(pg_temp.s09d_outcome('s09:401'), 'UNAUTHENTICATED', 'CMS-03A-09: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-305]');
select is(pg_temp.s09d_outcome('s09:403'), 'FORBIDDEN', 'CMS-03A-09: a human without cms.schema_designer on a readable source raises FORBIDDEN (403) [P2-S09-AC-306]');
select is(pg_temp.s09d_outcome('s09:404'), 'NOT_FOUND', 'CMS-03A-09: another organization sees the source as absent: NOT_FOUND (404) [P2-S09-AC-307]');
select is(pg_temp.s09d_outcome('s09:409'), 'VERSION_MISMATCH', 'CMS-03A-09: a stale source If-Match raises VERSION_MISMATCH (409) [P2-S09-AC-308] [P2-S09-AC-301]');
select is(pg_temp.s09d_outcome('s09:422'), 'VALIDATION_FAILED', 'CMS-03A-09: a locale pair with only supportedLocales raises VALIDATION_FAILED (422) [P2-S09-AC-310]');

-- ================================================ CMS-03A-10 dry run ==========
select pg_temp.r3_dry('s10:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s10:401', 'platform_api.cms_start_schema_dry_run', jsonb_build_object('contentTypeId', pg_temp.s09d_id('x:type'), 'versionId', pg_temp.s09d_id('x:version'),
  'expectedVersion', pg_temp.s09d_version('x'), 'transformKey', null, 'transformVersion', null, 'idempotencyKey', 'r3err-dry-anon-1'));
select pg_temp.r3_dry('s10:403', 'rev1');
select pg_temp.r3_dry('s10:404', 'other');
select pg_temp.r3_dry('s10:409', 'owner', '{"expectedVersion": "99"}');
select pg_temp.r3_dry('s10:422', 'owner', '{"transformKey": "identity.revalidate", "transformVersion": "1"}');
select is(pg_temp.s09d_outcome('s10:400'), 'INVALID_REQUEST', 'CMS-03A-10: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-350]');
select is(pg_temp.s09d_outcome('s10:401'), 'UNAUTHENTICATED', 'CMS-03A-10: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-351]');
select is(pg_temp.s09d_outcome('s10:403'), 'FORBIDDEN', 'CMS-03A-10: a human without cms.schema_designer raises FORBIDDEN (403) [P2-S09-AC-352]');
select is(pg_temp.s09d_outcome('s10:404'), 'NOT_FOUND', 'CMS-03A-10: another organization sees the candidate as absent: NOT_FOUND (404) [P2-S09-AC-353]');
select is(pg_temp.s09d_outcome('s10:409'), 'VERSION_MISMATCH', 'CMS-03A-10: a stale draft CAS version raises VERSION_MISMATCH (409) [P2-S09-AC-354]');
select is(pg_temp.s09d_outcome('s10:422'), 'VALIDATION_FAILED', 'CMS-03A-10: a transform pair on an additive candidate raises VALIDATION_FAILED (422) [P2-S09-AC-356]');

-- ================================================ CMS-03A-11 submit ===========
select pg_temp.r3_sub('s11:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s11:401', 'platform_api.cms_submit_schema_review', jsonb_build_object('contentTypeId', pg_temp.s09d_id('x:type'), 'versionId', pg_temp.s09d_id('x:version'),
  'expectedVersion', pg_temp.s09d_version('x'), 'dryRunId', pg_temp.s09d_id('x:dryRun'), 'idempotencyKey', 'r3err-sub-anon-1'));
select pg_temp.r3_sub('s11:403', 'rev1');
select pg_temp.r3_sub('s11:404', 'other');
select pg_temp.r3_sub('s11:409', 'owner', '{"expectedVersion": "99"}');
select is(pg_temp.s09d_outcome('s11:400'), 'INVALID_REQUEST', 'CMS-03A-11: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-392]');
select is(pg_temp.s09d_outcome('s11:401'), 'UNAUTHENTICATED', 'CMS-03A-11: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-393]');
select is(pg_temp.s09d_outcome('s11:403'), 'FORBIDDEN', 'CMS-03A-11: a human without cms.schema_designer raises FORBIDDEN (403) [P2-S09-AC-394]');
select is(pg_temp.s09d_outcome('s11:404'), 'NOT_FOUND', 'CMS-03A-11: another organization sees the candidate as absent: NOT_FOUND (404) [P2-S09-AC-395]');
select is(pg_temp.s09d_outcome('s11:409'), 'VERSION_MISMATCH', 'CMS-03A-11: a stale draft CAS version raises VERSION_MISMATCH (409) [P2-S09-AC-396]');

-- ================================================ CMS-03A-12 decision =========
select pg_temp.r3_dec('s12:400', 'rev1', jsonb_build_object('reviewerPersonId', pg_temp.s09d_actor_id('rev1', 'person')));
select pg_temp.r3_anon('s12:401', 'platform_api.cms_decide_schema_review', jsonb_build_object('reviewId', pg_temp.s09d_id('y:review'), 'expectedVersion', pg_temp.s09d_review_version('y'),
  'decision', 'approve', 'idempotencyKey', 'r3err-dec-anon-1'));
select pg_temp.r3_dec('s12:stepup', 'rev1', '{}', jsonb_build_object('stepUpAt', (clock_timestamp() - interval '11 minutes')));
select pg_temp.s09d_create_type('y3', 'r3err_y3');
select pg_temp.s09d_to_review('y3');
select pg_temp.s09d_assign('y3', 'rev2');
select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
   set starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 second'
 where id = %L$q$, pg_temp.s09d_id('y3:assignment:rev2')));
select pg_temp.s09d_rpc('s12:403', 'platform_api.cms_decide_schema_review', 'rev2',
  jsonb_build_object('reviewId', pg_temp.s09d_id('y3:review'), 'expectedVersion', pg_temp.s09d_review_version('y3'), 'decision', 'approve',
    'idempotencyKey', 'r3err-dec-ended-1'), true);
select pg_temp.r3_dec('s12:404', 'other');
select pg_temp.s09d_rpc('s12:403b', 'platform_api.cms_decide_schema_review', 'designer2',
  jsonb_build_object('reviewId', pg_temp.s09d_id('y3:review'), 'expectedVersion', pg_temp.s09d_review_version('y3'), 'decision', 'approve',
    'idempotencyKey', 'r3err-dec-designer-1'), true);
select pg_temp.s09d_rpc('s12:403c', 'platform_api.cms_decide_schema_review', 'owner',
  jsonb_build_object('reviewId', pg_temp.s09d_id('y3:review'), 'expectedVersion', pg_temp.s09d_review_version('y3'), 'decision', 'reject',
    'idempotencyKey', 'r3err-dec-owner-1'), true);
select pg_temp.r3_dec('s12:409', 'rev1', '{"expectedVersion": "999"}');
select pg_temp.r3_dec('s12:422', 'rev1', '{"decision": "maybe"}');
select is(pg_temp.s09d_outcome('s12:400'), 'INVALID_REQUEST', 'CMS-03A-12: a caller-supplied reviewer is an unknown key: INVALID_REQUEST (400) [P2-S09-AC-429]');
select is(pg_temp.s09d_outcome('s12:401'), 'UNAUTHENTICATED', 'CMS-03A-12: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-430]');
select is(pg_temp.s09d_outcome('s12:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-12: a step-up proof 11 minutes old raises STEP_UP_REQUIRED (401) [P2-S09-AC-441]');
select is(pg_temp.s09d_outcome('s12:403'), 'NOT_FOUND', 'CMS-03A-12: a reviewer whose assignment window ended is indistinguishable from an unassigned human: NOT_FOUND (404), never FORBIDDEN [P2-S09-AC-432]');
select is(pg_temp.s09d_outcome('s12:404'), 'NOT_FOUND', 'CMS-03A-12: another organization sees the review as absent: NOT_FOUND (404) [P2-S09-AC-432]');
select is(pg_temp.s09d_outcome('s12:403b'), 'FORBIDDEN', 'CMS-03A-12: a schema designer of the owning party who can read the review but holds no effective assignment raises FORBIDDEN (403) [P2-S09-AC-431]');
select is(pg_temp.s09d_outcome('s12:403c'), 'FORBIDDEN', 'CMS-03A-12: the owner, who can read the review but holds no effective assignment, raises FORBIDDEN (403) [P2-S09-AC-431]');
select is((select count(*)::integer from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('y3:review')), 0,
  'CMS-03A-12: the forbidden callers recorded no decision [P2-S09-AC-431]');
select is(pg_temp.s09d_outcome('s12:409'), 'VERSION_MISMATCH', 'CMS-03A-12: a stale review CAS version raises VERSION_MISMATCH (409) [P2-S09-AC-433]');
select is(pg_temp.s09d_outcome('s12:422'), 'VALIDATION_FAILED', 'CMS-03A-12: a decision other than approve or reject raises VALIDATION_FAILED (422) [P2-S09-AC-435]');

-- ================================================ CMS-03A-13 read =============
select pg_temp.r3_get('s13:400', 'owner', '{"reviewId": "not-a-uuid"}');
select pg_temp.r3_anon('s13:401', 'platform_api.cms_get_schema_review', jsonb_build_object('reviewId', pg_temp.s09d_id('y:review')));
select pg_temp.r3_get('s13:404', 'rev2');
select pg_temp.r3_get('s13:404b', 'other');
select is(pg_temp.s09d_outcome('s13:400'), 'INVALID_REQUEST', 'CMS-03A-13: a malformed review UUID raises INVALID_REQUEST (400) [P2-S09-AC-455]');
select is(pg_temp.s09d_outcome('s13:401'), 'UNAUTHENTICATED', 'CMS-03A-13: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-456]');
select is(pg_temp.s09d_outcome('s13:404'), 'NOT_FOUND', 'CMS-03A-13: an unassigned human sees the review as absent: NOT_FOUND (404) [P2-S09-AC-458]');
select is(pg_temp.s09d_outcome('s13:404b'), 'NOT_FOUND', 'CMS-03A-13: another organization sees the review as absent: NOT_FOUND (404) [P2-S09-AC-458]');

-- ================================================ CMS-03A-14 assign ===========
select pg_temp.r3_asg('s14:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s14:401', 'platform_api.cms_assign_schema_review', jsonb_build_object('reviewId', pg_temp.s09d_id('y:review'), 'action', 'create',
  'expectedVersion', pg_temp.s09d_review_version('y'), 'idempotencyKey', 'r3err-asg-anon-1'));
select pg_temp.r3_asg('s14:stepup', 'owner', '{}', jsonb_build_object('stepUpVerified', false));
select pg_temp.r3_asg('s14:403', 'designer2');
select pg_temp.r3_asg('s14:404', 'other');
select pg_temp.r3_asg('s14:409', 'owner', '{"expectedVersion": "999"}');
select pg_temp.r3_asg('s14:422', 'owner', '{"expiresAt": "tomorrow"}');
select is(pg_temp.s09d_outcome('s14:400'), 'INVALID_REQUEST', 'CMS-03A-14: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-491]');
select is(pg_temp.s09d_outcome('s14:401'), 'UNAUTHENTICATED', 'CMS-03A-14: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-492]');
select is(pg_temp.s09d_outcome('s14:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-14: stepUpVerified=false raises STEP_UP_REQUIRED (401) [P2-S09-AC-503]');
select is(pg_temp.s09d_outcome('s14:403'), 'FORBIDDEN', 'CMS-03A-14: a schema designer who is not the receipt-derived owner raises FORBIDDEN (403) [P2-S09-AC-493]');
select is(pg_temp.s09d_outcome('s14:404'), 'NOT_FOUND', 'CMS-03A-14: another organization sees the review as absent: NOT_FOUND (404) [P2-S09-AC-494]');
select is(pg_temp.s09d_outcome('s14:409'), 'VERSION_MISMATCH', 'CMS-03A-14: a stale review CAS version raises VERSION_MISMATCH (409) [P2-S09-AC-495]');
select is(pg_temp.s09d_outcome('s14:422'), 'VALIDATION_FAILED', 'CMS-03A-14: an expiry that is not an RFC 3339 instant raises VALIDATION_FAILED (422) [P2-S09-AC-497]');

-- ================================================ CMS-03A-15 grant ============
select pg_temp.s09g_grant('s15:400', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3), '{"unknownKey": 1}');
select pg_temp.r3_anon('s15:401', 'platform_api.cms_grant_capability', jsonb_build_object('subjectPersonId', pg_temp.s09d_actor_id('rev2', 'person'),
  'capability', 'cms.author', 'validThrough', pg_temp.s09g_day(3), 'idempotencyKey', 'r3err-grant-anon-1'));
select pg_temp.s09g_grant('s15:stepup', 'owner', 'rev2', 'cms.author', pg_temp.s09g_day(3), '{}', null, true, jsonb_build_object('stepUpAt', (clock_timestamp() - interval '11 minutes')));
select pg_temp.s09g_grant('s15:403', 'designer2', 'rev2', 'cms.author', pg_temp.s09g_day(3));
select pg_temp.s09g_grant('s15:404', 'owner', 'rev3', 'cms.author', pg_temp.s09g_day(3));
select pg_temp.s09g_grant('s15:409', 'owner', 'rev1', 'cms.author', pg_temp.s09g_day(3));
select pg_temp.s09g_grant('s15:422', 'owner', 'rev2', 'cms.not_registered', pg_temp.s09g_day(3));
select is(pg_temp.s09d_outcome('s15:400'), 'INVALID_REQUEST', 'CMS-03A-15: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-533]');
select is(pg_temp.s09d_outcome('s15:401'), 'UNAUTHENTICATED', 'CMS-03A-15: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-534]');
select is(pg_temp.s09d_outcome('s15:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-15: a step-up proof 11 minutes old raises STEP_UP_REQUIRED (401) [P2-S09-AC-545]');
select is(pg_temp.s09d_outcome('s15:403'), 'FORBIDDEN', 'CMS-03A-15: a schema designer who is not the receipt-derived owner raises FORBIDDEN (403) [P2-S09-AC-535]');
select is(pg_temp.s09d_outcome('s15:404'), 'NOT_FOUND', 'CMS-03A-15: a subject outside the owner organization raises NOT_FOUND (404) [P2-S09-AC-536]');
select is(pg_temp.s09d_outcome('s15:409'), 'CONFLICT', 'CMS-03A-15: a grant over an already active aggregate raises CONFLICT (409) [P2-S09-AC-537]');
select is(pg_temp.s09d_outcome('s15:422'), 'VALIDATION_FAILED', 'CMS-03A-15: a capability outside the grantable registry raises VALIDATION_FAILED (422) [P2-S09-AC-539]');

-- ================================================ CMS-03A-16 renew ============
select pg_temp.r3_ren('s16:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s16:401', 'platform_api.cms_renew_capability_grant', jsonb_build_object('grantId', pg_temp.s09d_resp('gfix')->>'id',
  'expectedVersion', pg_temp.s09d_resp('gfix')->>'version', 'validThrough', pg_temp.s09g_day(9), 'idempotencyKey', 'r3err-renew-anon-1'));
select pg_temp.r3_ren('s16:stepup', 'owner', '{}', jsonb_build_object('stepUpAt', (clock_timestamp() - interval '11 minutes')));
select pg_temp.r3_ren('s16:403', 'designer2');
select pg_temp.r3_ren('s16:404', 'owner', jsonb_build_object('grantId', extensions.gen_random_uuid()));
select pg_temp.r3_ren('s16:409', 'owner', '{"expectedVersion": "99"}');
select pg_temp.r3_ren('s16:422', 'owner', '{"validThrough": "2000-01-01"}');
select is(pg_temp.s09d_outcome('s16:400'), 'INVALID_REQUEST', 'CMS-03A-16: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-562]');
select is(pg_temp.s09d_outcome('s16:401'), 'UNAUTHENTICATED', 'CMS-03A-16: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-563]');
select is(pg_temp.s09d_outcome('s16:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-16: a step-up proof 11 minutes old raises STEP_UP_REQUIRED (401) [P2-S09-AC-574]');
select is(pg_temp.s09d_outcome('s16:403'), 'FORBIDDEN', 'CMS-03A-16: a schema designer who is not the receipt-derived owner raises FORBIDDEN (403) [P2-S09-AC-564]');
select is(pg_temp.s09d_outcome('s16:404'), 'NOT_FOUND', 'CMS-03A-16: an absent grant raises NOT_FOUND (404) [P2-S09-AC-565]');
select is(pg_temp.s09d_outcome('s16:409'), 'VERSION_MISMATCH', 'CMS-03A-16: a stale expected version raises VERSION_MISMATCH (409) [P2-S09-AC-566]');
select is(pg_temp.s09d_outcome('s16:422'), 'VALIDATION_FAILED', 'CMS-03A-16: a validThrough in the past raises VALIDATION_FAILED (422) [P2-S09-AC-568]');

-- ================================================ CMS-03A-17 revoke ===========
select pg_temp.r3_rev('s17:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s17:401', 'platform_api.cms_revoke_capability_grant', jsonb_build_object('grantId', pg_temp.s09d_resp('gfix')->>'id',
  'expectedVersion', pg_temp.s09d_resp('gfix')->>'version', 'idempotencyKey', 'r3err-revoke-anon-1'));
select pg_temp.r3_rev('s17:stepup', 'owner', '{}', jsonb_build_object('stepUpAt', (clock_timestamp() - interval '11 minutes')));
select pg_temp.r3_rev('s17:403', 'designer2');
select pg_temp.r3_rev('s17:404', 'owner', jsonb_build_object('grantId', extensions.gen_random_uuid()));
select pg_temp.r3_rev('s17:409', 'owner', '{"expectedVersion": "99"}');
select pg_temp.r3_rev('s17:422', 'owner', jsonb_build_object('reason', ''));
select is(pg_temp.s09d_outcome('s17:400'), 'INVALID_REQUEST', 'CMS-03A-17: an unknown request key raises INVALID_REQUEST (400) [P2-S09-AC-590]');
select is(pg_temp.s09d_outcome('s17:401'), 'UNAUTHENTICATED', 'CMS-03A-17: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-591]');
select is(pg_temp.s09d_outcome('s17:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-17: a step-up proof 11 minutes old raises STEP_UP_REQUIRED (401) [P2-S09-AC-602]');
select is(pg_temp.s09d_outcome('s17:403'), 'FORBIDDEN', 'CMS-03A-17: a schema designer who is not the receipt-derived owner raises FORBIDDEN (403) [P2-S09-AC-592]');
select is(pg_temp.s09d_outcome('s17:404'), 'NOT_FOUND', 'CMS-03A-17: an absent grant raises NOT_FOUND (404) [P2-S09-AC-593]');
select is(pg_temp.s09d_outcome('s17:409'), 'VERSION_MISMATCH', 'CMS-03A-17: a stale expected version raises VERSION_MISMATCH (409) [P2-S09-AC-594]');
select is(pg_temp.s09d_outcome('s17:422'), 'VALIDATION_FAILED', 'CMS-03A-17: an empty reason raises VALIDATION_FAILED (422) [P2-S09-AC-596]');

-- ================================================ CMS-03A-18 list =============
select pg_temp.s09g_list('s18:400', 'owner', '{"unknownKey": 1}');
select pg_temp.r3_anon('s18:401', 'platform_api.cms_list_capability_grants', '{}'::jsonb);
select pg_temp.s09g_list('s18:403', 'designer2');
select pg_temp.s09g_list('s18:422', 'owner', '{"limit": 0}');
select is(pg_temp.s09d_outcome('s18:400'), 'INVALID_REQUEST', 'CMS-03A-18: an unknown query key raises INVALID_REQUEST (400) [P2-S09-AC-619]');
select is(pg_temp.s09d_outcome('s18:401'), 'UNAUTHENTICATED', 'CMS-03A-18: a request without a verified actor raises UNAUTHENTICATED (401) [P2-S09-AC-620]');
select is(pg_temp.s09d_outcome('s18:403'), 'FORBIDDEN', 'CMS-03A-18: a schema designer who is not the receipt-derived owner raises FORBIDDEN (403) [P2-S09-AC-621]');
select is(pg_temp.s09d_outcome('s18:422'), 'VALIDATION_FAILED', 'CMS-03A-18: a limit of zero raises VALIDATION_FAILED (422) [P2-S09-AC-622]');

-- ================================================ CMS-03A-04 step-up ==========
select pg_temp.s09d_to_approved('y2' , array['rev1']) where false;
select pg_temp.s09d_create_type('z', 'r3err_z');
select pg_temp.s09d_to_approved('z');
select pg_temp.s09d_activate('z', 'owner', jsonb_build_object('stepUpAt', (clock_timestamp() - interval '11 minutes')), 'z:stepup');
select is(pg_temp.s09d_outcome('z:stepup'), 'STEP_UP_REQUIRED', 'CMS-03A-04: an activation with a step-up proof 11 minutes old raises STEP_UP_REQUIRED (401) [P2-S09-AC-628]');
select pg_temp.s09d_activate('z');
select is(pg_temp.s09d_outcome('z:activate'), 'OK', 'control: the same activation succeeds with a fresh proof [P2-S09-AC-628]');

select * from finish();
rollback;
