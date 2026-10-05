\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a real scan): the second registered transform
-- (default.fill_literal), source drift fencing, supersession of a drifted
-- completed plan, and one-shot / idempotent activation over a completed plan.
-- Every producer row is written by a named RPC; the worker verdicts are computed
-- here and the database must reproduce them.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

-- ------------------------------------------------ default.fill_literal ----
-- Version 1 has an OPTIONAL summary; the successor makes it required with the
-- literal default 'n/a'.  Rows without a summary are filled, a row that has one
-- passes unchanged.
select pg_temp.s09d_create_type('f', 'fillscan');
select pg_temp.s09w_add_summary('f');
select is(pg_temp.s09d_outcome('f:summary'), 'OK', 'fixture: CMS-03A-02 adds an optional summary field to the draft');
select pg_temp.s09d_to_active('f');
select pg_temp.s09w_entry('f1', 'f', 'Alpha');
select pg_temp.s09w_entry('f2', 'f', 'Beta', 'Has summary');
select pg_temp.s09w_entry('f3', 'f', 'Gamma');
select is(pg_temp.s09d_outcome('f1') || pg_temp.s09d_outcome('f2') || pg_temp.s09d_outcome('f3'), 'OKOKOK',
  'fixture: three real entries, one of them with a summary value');
select pg_temp.s09d_successor('g', 'f');
select pg_temp.s09d_dry_run('g');
select pg_temp.s09w_dry_run('g');
select pg_temp.s09w_redefine('g', 'short_text', '{}'::jsonb, null, 'g:summary', 'summary', true, 'literal', '"n/a"'::jsonb);
select is(pg_temp.s09d_outcome('g:summary'), 'OK', 'CMS-03A-02 makes the summary required with a literal default under the ready clone plan');
select pg_temp.s09d_dry_run('g', 'owner', 'default.fill_literal', '1');
select is(pg_temp.s09d_outcome('g:dryRun'), 'OK', 'CMS-03A-10 accepts the registered default.fill_literal pair');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('g:plan')), 'conditional',
  'tightening the summary to required derives a conditional classification');
select pg_temp.s09w_claim('g');
select pg_temp.s09w_read('g', 'g:read');
select ok((select r->'targetFields' = jsonb_build_array(jsonb_build_object('fieldKey', 'summary', 'kind', 'short_text', 'required', true,
        'defaultMode', 'literal', 'defaultValue', 'n/a', 'constraints', '{}'::jsonb))
      and r->'retiredFields' = '[]'::jsonb
    from (select pg_temp.s09d_resp('g:read') r) s),
  'the read page names the changed summary field with its literal default as the only target field');
create temp table s09l_good on commit drop as
select pg_temp.s09w_evidence('default.fill_literal', pg_temp.s09d_resp('g:read')) as evidence;
select ok((select jsonb_array_length(evidence) = 3 and (select count(*) = 3 from jsonb_array_elements(evidence) e where e->>'errorCode' is null)
    and (select count(*) = 2 from jsonb_array_elements(evidence) e where e->>'outputHash' <> e->>'sourceHash')
    from s09l_good), 'fixture: the worker fills the two rows without a summary and passes the third unchanged');
-- A worker that claims an identity pass for a row that needs filling is refused.
create temp table s09l_idx on commit drop as
select (select ord::int - 1 from s09l_good, jsonb_array_elements(evidence) with ordinality t(e, ord) where e->>'outputHash' <> e->>'sourceHash' limit 1) as filled;
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('g:lie', 'platform_api.cms_process_schema_migration_dry_run_batch',
  pg_temp.s09w_batch_request('g', (select jsonb_set(evidence, array[filled::text, 'outputHash'], evidence->filled->'sourceHash')
    from s09l_good, s09l_idx)));
select is(pg_temp.s09d_outcome('g:lie'), 'VALIDATION_FAILED',
  'the database refuses an identity pass for a row the registered executor must fill');
select pg_temp.s09w_batch('g', 'g:scan', (select evidence from s09l_good), true);
select ok((select r->>'targetCount' = '3' and r->>'rowErrorCount' = '0' and r->>'cursor' = '3' from (select pg_temp.s09d_resp('g:scan') r) s),
  'the honest fill evidence is accepted and counted');
select pg_temp.s09d_call('g:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('g') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('g'),
    'cursor', pg_temp.s09w_plan_cursor('g'), 'sourceCount', '3', 'targetCount', '3', 'rowErrorCount', '0'));
select ok((select r->>'state' = 'ready' from (select pg_temp.s09d_resp('g:seal') r) s), 'the fill plan seals ready');
select pg_temp.s09w_backfill('g');
select is(pg_temp.s09d_outcome('g:w.complete'), 'OK', 'the worker backfills, verifies and completes the fill plan');
select ok((select count(*) = 3 from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('g:plan'))
  and (select bool_and(target_document->>'summary' is not null and output_hash::text = platform_private.cms_jcs_sha256(target_document))
       from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('g:plan'))
  and (select count(*) = 2 from platform_private.cms_schema_migration_target_rows
       where plan_id = pg_temp.s09d_id('g:plan') and target_document->>'summary' = 'n/a' and output_hash <> source_hash)
  and (select count(*) = 1 from platform_private.cms_schema_migration_target_rows
       where plan_id = pg_temp.s09d_id('g:plan') and target_document->>'summary' = 'Has summary' and output_hash = source_hash),
  'the database wrote the registered fill: two rows carry the literal default, the populated row is unchanged');

-- ----------------------------------------------------- source drift fence ----
select pg_temp.s09d_create_type('d', 'driftscan');
select pg_temp.s09d_to_active('d');
select pg_temp.s09w_entry('d1', 'd', 'Alpha');
select pg_temp.s09w_entry('d2', 'd', 'Beta');
select pg_temp.s09d_successor('e', 'd');
select pg_temp.s09d_dry_run('e');
select pg_temp.s09w_dry_run('e');
select pg_temp.s09w_tighten('e', 40);
select pg_temp.s09d_dry_run('e', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_claim('e');
select pg_temp.s09w_pass('e', true);
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'cursor', pg_temp.s09d_id('e:plan')), '2', 'drift fixture: the scan consumed both rows');
-- A row appears on the still-active source after the scan.
select pg_temp.s09w_entry('d3', 'd', 'Gamma');
select is(pg_temp.s09d_outcome('d3'), 'OK', 'the active source keeps accepting entries while its successor is scanned');
select pg_temp.s09d_call('e:seal.drift', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('e') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('e'),
    'cursor', pg_temp.s09w_plan_cursor('e'), 'sourceCount', '2', 'targetCount', '2', 'rowErrorCount', '0'));
select is(pg_temp.s09d_outcome('e:seal.drift'), 'CONFLICT', 'finalize refuses to seal evidence of a source that has since changed');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('e:plan')), 'dry_running',
  'the refused seal left the plan unsealed');
select pg_temp.s09d_dry_run('e', 'owner', 'identity.revalidate', '1', 's09l-redry-0001');
select is(pg_temp.s09d_outcome('e:dryRun'), 'OK', 'a fresh attempt supersedes the stale live plan');
select is((select source_count from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('e:plan')), 3::bigint,
  'the new attempt records the new database-proven row count');
select pg_temp.s09w_dry_run('e');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('e:plan')), 'ready', 'the fresh attempt seals three rows');
select pg_temp.s09w_backfill('e');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('e:plan')), 'completed',
  'the worker completes the backfill over three rows');
-- Drift after completion: a completed plan over a changed source is superseded by a fresh attempt.
select pg_temp.s09w_entry('d4', 'd', 'Delta');
select pg_temp.s09d_dry_run('e', 'owner', 'identity.revalidate', '1', 's09l-redry-0002');
select is(pg_temp.s09d_outcome('e:dryRun'), 'OK',
  'a completed plan whose scanned source drifted is superseded by a fresh dry-run attempt');
select is((select count(*)::integer from platform_private.cms_schema_migration_plans
  where to_version_id = pg_temp.s09d_id('e:version') and superseded_at is not null and state = 'completed'), 1,
  'the superseded completed plan stays immutable history (only superseded_at changed)');
select is((select source_count from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('e:plan')), 4::bigint,
  'the latest attempt scans all four rows');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_schema_migration_plans set cursor = 0 where to_version_id = %L and state = 'completed'$q$,
  pg_temp.s09d_id('e:version'))), 'a completed plan still rejects any other update');

-- ----------------------------------------- one-shot, idempotent switch ----
select pg_temp.s09d_create_type('s', 'switchscan');
select pg_temp.s09d_to_active('s');
select pg_temp.s09w_entry('s1', 's', 'Alpha');
select pg_temp.s09d_successor('t', 's');
select pg_temp.s09d_dry_run('t');
select pg_temp.s09w_dry_run('t');
select pg_temp.s09w_tighten('t', 40);
select pg_temp.s09d_dry_run('t', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('t');
select pg_temp.s09d_submit('t');
select pg_temp.s09d_assign('t', 'rev1');
select pg_temp.s09d_decide('t', 'rev1');
select pg_temp.s09w_backfill('t');
-- A row created after the backfill makes the verified plan stale: the switch refuses.
select pg_temp.s09w_entry('s2', 's', 'Beta');
select pg_temp.s09d_activate('t', 'owner', '{}'::jsonb, 't:activate-drift');
select is(pg_temp.s09d_outcome('t:activate-drift'), 'CONFLICT',
  'CMS-03A-04 refuses to switch a completed plan whose scanned source has since changed');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('s:version')), 'active',
  'the old active version stays active and readable after the refused switch [P2-S09-AC-098]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('t:version')), 'approved',
  'the approved candidate is unchanged by the refused switch');
select pg_temp.s09w_entry('s3', 's', 'Gamma');
select is(pg_temp.s09d_outcome('s3'), 'OK', 'the old active version still accepts entries (old-active fallback) [P2-S09-AC-098]');

select is(pg_temp.s09x_direct(), 0::bigint,
  'no producer row of any scenario was written by a direct statement of this script');

select * from finish();
rollback;
