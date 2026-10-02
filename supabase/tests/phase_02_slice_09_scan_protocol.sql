commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a real scan, migration worker <-> DB protocol): the
-- source-row read RPC and the per-row evidence batch RPC.  A conditional plan
-- over three real entries (stricter title maxLength 12; one row violates it) is
-- driven through the named worker RPCs.  Every refusal is proven to leave the
-- plan, the evidence and the target rows byte for byte unchanged, and the
-- database must reproduce every pass the worker reports.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

create or replace function pg_temp.s09p_state(p_tag text) returns text language sql stable as $body$
  select (select concat_ws('|', version, cursor, source_count, target_count, row_error_count, migrated_count,
            failed_count, state) from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id(p_tag || ':plan'))
    || '|' || (select count(*) from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id(p_tag || ':plan'))
    || '|' || (select count(*) from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id(p_tag || ':plan'))
$body$;

-- Fixture: active version with three real entries, a conditional successor plan.
select pg_temp.s09d_create_type('a', 'protoscan');
select pg_temp.s09d_to_active('a');
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09w_entry('e1', 'a', 'Alpha title');
select pg_temp.s09w_entry('e2', 'a', 'Beta title with more characters');
select pg_temp.s09w_entry('e3', 'a', 'Gamma');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_dry_run('b');
select pg_temp.s09w_dry_run('b');
select pg_temp.s09w_tighten('b', 12);
select pg_temp.s09d_dry_run('b', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_claim('b');
select ok((select (c->>'acquired')::boolean and c->'plan'->>'state' = 'dry_running'
    from (select pg_temp.s09d_resp('b:w.claim') c) s),
  'fixture: the worker leases the conditional dry run over three real rows');
select pg_temp.s09d_session('owner', 'service_role');
create temp table s09p_before on commit drop as select pg_temp.s09p_state('b') as state;

-- ------------------------------------------------------------- read RPC ----
select ok(pg_temp.s09d_service_only('platform_api.cms_read_schema_migration_source_rows(jsonb)')
  and not has_function_privilege('authenticated', 'platform_private.cms_read_schema_migration_source_rows(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'platform_private.cms_read_schema_migration_source_rows(jsonb)', 'execute'),
  'the source-row read RPC is service-role only; its private implementation is not directly executable');
select pg_temp.s09w_read('b', 'b:read.p1', '2');
select ok((select r ?& array['rows','nextCursor','done','targetFields','retiredFields'] and (select count(*) = 5 from jsonb_object_keys(r))
    and jsonb_array_length(r->'rows') = 2 and r->>'nextCursor' = '2' and (r->>'done')::boolean = false
    from (select pg_temp.s09d_resp('b:read.p1') r) s),
  'a read page has exactly rows, nextCursor, done, targetFields, retiredFields; limit 2 returns two rows and done = false (rows.length = limit)');
select ok((select bool_and((row_json ?& array['sourceTable','sourceRowId','sourceHash','document'])
      and (select count(*) = 4 from jsonb_object_keys(row_json))
      and row_json->>'sourceHash' ~ '^[a-f0-9]{64}$' and row_json->>'sourceTable' = 'cms_entry_revisions')
    from jsonb_array_elements(pg_temp.s09d_resp('b:read.p1')->'rows') row_json),
  'each served row has exactly sourceTable, sourceRowId, sourceHash and document');
select ok((select bool_and(row_json->>'sourceHash' = platform_private.cms_jcs_sha256(row_json->'document')
      and row_json->'document' ? 'title')
    from jsonb_array_elements(pg_temp.s09d_resp('b:read.p1')->'rows') row_json),
  'the database-computed source hash is the JCS SHA-256 of the served document, keyed by the source field key');
select ok((select (select array_agg(row_json->>'sourceRowId' order by ord) = array_agg(row_json->>'sourceRowId' order by row_json->>'sourceRowId')
    from jsonb_array_elements(r->'rows') with ordinality as t(row_json, ord)) from (select pg_temp.s09d_resp('b:read.p1') r) s),
  'rows are served in the total (source_table, source_row_id) order');
select ok((select r->'targetFields' = jsonb_build_array(jsonb_build_object('fieldKey', 'title', 'kind', 'short_text', 'required', true,
        'defaultMode', 'none', 'defaultValue', null, 'constraints', jsonb_build_object('maxLength', 12)))
      and r->'retiredFields' = '[]'::jsonb
    from (select pg_temp.s09d_resp('b:read.p1') r) s),
  'targetFields lists the compiled changed field (key, kind, required, default, compiled constraints, no internal id); retiredFields is empty');
select is(pg_temp.s09p_state('b'), (select state from s09p_before), 'reading rows has no side effect on the plan, evidence or target rows');
select pg_temp.s09w_read('b', 'b:read.all');
select ok((select jsonb_array_length(r->'rows') = 3 and r->>'nextCursor' = '3' and (r->>'done')::boolean
    from (select pg_temp.s09d_resp('b:read.all') r) s), 'a full page of three rows reports done = true and nextCursor 3');

-- read refusals
select pg_temp.s09d_call('b:read.cursor', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', pg_temp.s09w_plan_version('b'), 'cursor', '1',
  'limit', '128', 'leaseToken', pg_temp.s09w_lease('b')));
select pg_temp.s09d_call('b:read.version', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', '1', 'cursor', '0',
  'limit', '128', 'leaseToken', pg_temp.s09w_lease('b')));
select pg_temp.s09d_call('b:read.lease', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', pg_temp.s09w_plan_version('b'), 'cursor', '0',
  'limit', '128', 'leaseToken', 'not-the-lease-token'));
select pg_temp.s09w_read('b', 'b:read.limit', '129');
select pg_temp.s09d_call('b:read.extra', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', pg_temp.s09w_plan_version('b'), 'cursor', '0',
  'limit', '128', 'leaseToken', pg_temp.s09w_lease('b'), 'targetField', 'x'));
select pg_temp.s09d_call('b:read.missing', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', pg_temp.s09w_plan_version('b'), 'cursor', '0',
  'limit', '128'));
select pg_temp.s09d_call('b:read.unknown', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', extensions.gen_random_uuid(), 'expectedVersion', '1', 'cursor', '0',
  'limit', '128', 'leaseToken', pg_temp.s09w_lease('b')));
select pg_temp.s09d_session('owner', 'authenticated');
select pg_temp.s09d_call('b:read.anon', 'platform_api.cms_read_schema_migration_source_rows', jsonb_build_object(
  'migrationPlanId', pg_temp.s09d_id('b:plan'), 'expectedVersion', pg_temp.s09w_plan_version('b'), 'cursor', '0',
  'limit', '128', 'leaseToken', pg_temp.s09w_lease('b')));
select pg_temp.s09d_session('owner', 'service_role');
select is(pg_temp.s09d_outcome('b:read.cursor') || '/' || pg_temp.s09d_outcome('b:read.version') || '/' || pg_temp.s09d_outcome('b:read.lease'),
  'CONFLICT/CONFLICT/LEASE_EXPIRED', 'a stale cursor or plan version conflicts and a wrong lease token is refused');
select is(pg_temp.s09d_outcome('b:read.limit') || '/' || pg_temp.s09d_outcome('b:read.extra') || '/' || pg_temp.s09d_outcome('b:read.missing'),
  'INVALID_REQUEST/INVALID_REQUEST/INVALID_REQUEST', 'a page larger than 128 rows, an extra key and a missing key are refused');
select is(pg_temp.s09d_outcome('b:read.unknown') || '/' || pg_temp.s09d_outcome('b:read.anon'), 'NOT_FOUND/UNAUTHENTICATED',
  'an unknown plan is NOT_FOUND and a non-service role is UNAUTHENTICATED');
select is(pg_temp.s09p_state('b'), (select state from s09p_before), 'every refused read left the plan, evidence and target rows unchanged');

-- ------------------------------------------------------------ batch RPC ----
create temp table s09p_page on commit drop as select pg_temp.s09w_read('b', 'b:read.honest') as page;
create temp table s09p_good on commit drop as
select pg_temp.s09w_evidence('identity.revalidate', page) as evidence from s09p_page;
select ok((select jsonb_array_length(evidence) = 3
    and (select count(*) = 1 from jsonb_array_elements(evidence) e where e->>'errorCode' = 'TRANSFORM_TARGET_VIOLATION')
    from s09p_good), 'fixture: the worker verdict is two passes and one TRANSFORM_TARGET_VIOLATION');
-- Rows are served in uuid order, so locate the refused and a passing row by verdict.
create temp table s09p_idx on commit drop as
select (select ord::int - 1 from s09p_good, jsonb_array_elements(evidence) with ordinality t(e, ord)
         where e->>'errorCode' is not null) as bad,
       (select min(ord)::int - 1 from s09p_good, jsonb_array_elements(evidence) with ordinality t(e, ord)
         where e->>'errorCode' is null) as good;

create or replace function pg_temp.s09p_try(p_label text, p_evidence jsonb, p_patch jsonb default '{}'::jsonb,
  p_limit text default '128') returns text language plpgsql as $body$
begin
  perform pg_temp.s09d_session('owner', 'service_role');
  perform pg_temp.s09d_call(p_label, 'platform_api.cms_process_schema_migration_dry_run_batch',
    pg_temp.s09w_batch_request('b', p_evidence, p_limit) || p_patch);
  return pg_temp.s09d_outcome(p_label);
end;
$body$;

select is(pg_temp.s09p_try('b:bad.short', (select evidence - 2 from s09p_good)), 'VALIDATION_FAILED',
  'evidence that omits a served row is refused');
select is(pg_temp.s09p_try('b:bad.many', (select jsonb_agg(evidence->0) from s09p_good, generate_series(1, 129))), 'INVALID_REQUEST',
  'more than 128 evidence entries are refused');
select is(pg_temp.s09p_try('b:bad.limit', (select evidence from s09p_good), '{}'::jsonb, '2'), 'INVALID_REQUEST',
  'more evidence entries than the declared page limit is refused');
select is(pg_temp.s09p_try('b:bad.order', (select jsonb_build_array(evidence->1, evidence->0, evidence->2) from s09p_good)),
  'VALIDATION_FAILED', 'evidence out of source order is refused');
select is(pg_temp.s09p_try('b:bad.hash', (select jsonb_set(evidence, '{0,sourceHash}', to_jsonb(repeat('0', 64))) from s09p_good)),
  'VALIDATION_FAILED', 'a source hash the database does not reproduce is refused');
select is(pg_temp.s09p_try('b:bad.falsepass', (select jsonb_set(jsonb_set(evidence, array[bad::text, 'errorCode'], 'null'::jsonb),
    array[bad::text, 'outputHash'], evidence->bad->'sourceHash') from s09p_good, s09p_idx)),
  'VALIDATION_FAILED', 'a pass the database can prove violates the target constraint is refused [P2-S09-AC-680]');
select is(pg_temp.s09p_try('b:bad.output', (select jsonb_set(evidence, array[good::text, 'outputHash'], to_jsonb(repeat('a', 64))) from s09p_good, s09p_idx)),
  'VALIDATION_FAILED', 'a pass with an output hash the registered executor does not produce is refused');
select is(pg_temp.s09p_try('b:bad.extra', (select jsonb_set(evidence, array[good::text, 'extra'], '1'::jsonb) from s09p_good, s09p_idx)),
  'INVALID_REQUEST', 'an evidence entry with an extra key is refused');
select is(pg_temp.s09p_try('b:bad.missing', (select evidence #- array[good::text, 'errorCode'] from s09p_good, s09p_idx)),
  'INVALID_REQUEST', 'an evidence entry with a missing key is refused');
select is(pg_temp.s09p_try('b:bad.both', (select jsonb_set(evidence, array[good::text, 'errorCode'], '"TRANSFORM_ROW_FAILED"'::jsonb) from s09p_good, s09p_idx)),
  'INVALID_REQUEST', 'an entry carrying both an output hash and an error code is refused');
select is(pg_temp.s09p_try('b:bad.neither', (select jsonb_set(evidence, array[good::text, 'outputHash'], 'null'::jsonb) #- array[good::text, 'errorCode']
    from s09p_good, s09p_idx)), 'INVALID_REQUEST', 'an entry with neither an output hash nor an error code is refused');
select is(pg_temp.s09p_try('b:bad.code', (select jsonb_set(evidence, array[bad::text, 'errorCode'], '"lowercase"'::jsonb) from s09p_good, s09p_idx)),
  'INVALID_REQUEST', 'an error code outside the grammar is refused');
select is(pg_temp.s09p_try('b:bad.counters', (select evidence from s09p_good), jsonb_build_object('sourceCount', '3', 'targetCount', '3')),
  'INVALID_REQUEST', 'caller-supplied counters are not part of the envelope and are refused');
select is(pg_temp.s09p_try('b:bad.transform', (select evidence from s09p_good), jsonb_build_object('transformKey', 'default.fill_literal')),
  'VALIDATION_FAILED', 'a transform pair that differs from the plan is refused by the fingerprint');
select is(pg_temp.s09p_try('b:bad.lease', (select evidence from s09p_good), jsonb_build_object('leaseToken', 'wrong-lease-token')),
  'LEASE_EXPIRED', 'a wrong lease token is refused');
select is(pg_temp.s09p_try('b:bad.cursor', (select evidence from s09p_good), jsonb_build_object('cursor', '1')),
  'CONFLICT', 'a stale cursor conflicts');
select is(pg_temp.s09p_state('b'), (select state from s09p_before), 'every refused batch left the plan, evidence and target rows unchanged');

-- The honest scan: the database derives the counters from the evidence.
select pg_temp.s09w_batch('b', 'b:honest', (select evidence from s09p_good), true);
select ok((select r->>'done' = 'true' and r->>'cursor' = '3' and r->>'sourceCount' = '3' and r->>'targetCount' = '2'
    and r->>'rowErrorCount' = '1' and r->>'migratedCount' = '0' and r->>'failedCount' = '0'
    from (select pg_temp.s09d_resp('b:honest') r) s),
  'the batch response derives 2 passing rows, 1 row error and 3 scanned rows from the posted evidence');
select is(pg_temp.s09p_state('b'), (select concat_ws('|', version, '3', '3', '2', '1', '0', '0', 'dry_running', '3', '0')
    from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan')),
  'the plan and 3 append-only evidence rows commit atomically; no target row exists in a dry run');
select is(pg_temp.s09w_plan_cursor('b'), '3', 'cursor is at the end');
-- replay of the same cursor is refused (CAS) and writes nothing more.
select is(pg_temp.s09p_try('b:replay', (select evidence from s09p_good), '{"cursor":"0"}'::jsonb), 'CONFLICT',
  'replaying the first page after the cursor advanced is refused and writes no second evidence row');
select is((select count(*)::integer from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id('b:plan')), 3,
  'the append-only evidence still holds exactly one row per source row');
select ok(not pg_temp.s09d_try(format($q$update platform_private.cms_schema_dry_run_row_evidence set error_code = null, output_hash = source_hash
  where plan_id = %L$q$, pg_temp.s09d_id('b:plan')))
  and not pg_temp.s09d_try(format($q$delete from platform_private.cms_schema_dry_run_row_evidence where plan_id = %L$q$, pg_temp.s09d_id('b:plan'))),
  'recorded evidence cannot be rewritten or deleted');

-- Finalize seals from the evidence; wrong claims are refused.
select pg_temp.s09d_call('b:seal.bad', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('b') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('b'),
    'cursor', pg_temp.s09w_plan_cursor('b'), 'sourceCount', '3', 'targetCount', '3', 'rowErrorCount', '0'));
select is(pg_temp.s09d_outcome('b:seal.bad'), 'CONFLICT', 'finalize refuses counters that differ from the derived evidence (a caller claiming zero errors)');
select pg_temp.s09d_call('b:seal.count', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('b') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('b'),
    'cursor', pg_temp.s09w_plan_cursor('b'), 'sourceCount', '2', 'targetCount', '2', 'rowErrorCount', '1'));
select is(pg_temp.s09d_outcome('b:seal.count'), 'CONFLICT', 'finalize refuses a caller source count that differs from the database-proven count');
select pg_temp.s09d_call('b:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('b') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('b'),
    'cursor', pg_temp.s09w_plan_cursor('b'), 'sourceCount', '3', 'targetCount', '2', 'rowErrorCount', '1'));
select ok((select r->>'state' = 'blocked' from (select pg_temp.s09d_resp('b:seal') r) s), 'finalize over a plan with a row error seals it blocked');
select ok((select report.state = 'completed' and report.result = 'fail' and report.source_count = 3 and report.target_count = 2
    and report.row_error_count = 1 and report.sealed_at is not null
    and report.row_error_count = (select count(*) from platform_private.cms_schema_dry_run_row_evidence ev
                                  where ev.plan_id = report.plan_id and ev.error_code is not null)
    from platform_private.cms_schema_dry_run_reports report where report.id = pg_temp.s09d_id('b:dryRun')),
  'the sealed failing report carries counts equal to the evidence rows and row_error_count equals the error evidence rows');

select * from finish();
rollback;
