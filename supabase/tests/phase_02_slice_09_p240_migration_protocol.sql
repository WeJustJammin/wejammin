\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the migration plan state
-- machine (AC187) and failure semantics (AC188).  Every plan is produced by CMS-03A-10 and
-- driven through the named worker RPCs only; the plan rows are read back after each step.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

create or replace function pg_temp.p_state(p_tag text) returns text language sql stable as $body$
  select state from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id(p_tag || ':plan') $body$;
create or replace function pg_temp.p_col(p_tag text, p_col text) returns text language plpgsql stable as $body$
declare result text;
begin execute format('select %I::text from platform_private.cms_schema_migration_plans where id = $1', p_col) into result using pg_temp.s09d_id(p_tag || ':plan'); return result; end;
$body$;
create or replace function pg_temp.p_scan_seal(p_tag text) returns void language plpgsql as $body$
begin
  perform pg_temp.s09w_dry_run(p_tag);
end;
$body$;
-- A conditional candidate with two real source rows, sealed ready, approved by an independent reviewer.
create or replace function pg_temp.p_ready(p_tag text, p_type_tag text, p_key text, p_rows integer default 2) returns void language plpgsql as $body$
declare n integer;
begin
  perform pg_temp.s09d_create_type(p_type_tag, p_key);
  perform pg_temp.s09d_to_active(p_type_tag);
  for n in 1..p_rows loop perform pg_temp.s09w_entry(p_tag || 'e' || n, p_type_tag, 'Row ' || n); end loop;
  perform pg_temp.s09d_successor(p_tag, p_type_tag);
  perform pg_temp.s09d_dry_run(p_tag); perform pg_temp.s09w_dry_run(p_tag);
  perform pg_temp.s09w_tighten(p_tag, 40);
  perform pg_temp.s09d_dry_run(p_tag, 'owner', 'identity.revalidate', '1');
  perform pg_temp.s09w_dry_run(p_tag);
  perform pg_temp.s09d_submit(p_tag); perform pg_temp.s09d_assign(p_tag, 'rev1'); perform pg_temp.s09d_decide(p_tag, 'rev1');
end;
$body$;

select pg_temp.s09d_grant_specialist('owner', 'cms.author');
select pg_temp.s09d_grant_specialist('owner', 'cms.editor');

-- ===================================================== AC187 the plan state machine ====
select pg_temp.s09d_create_type('m', 'p240_mig');
select pg_temp.s09d_to_active('m');
select pg_temp.s09w_entry('e1', 'm', 'Alpha');
select pg_temp.s09w_entry('e2', 'm', 'Beta');
select pg_temp.s09d_successor('n', 'm');
select pg_temp.s09d_dry_run('n'); select pg_temp.s09w_dry_run('n');
select pg_temp.s09w_tighten('n', 40);
select pg_temp.s09d_dry_run('n', 'owner', 'identity.revalidate', '1');
create temp table p_trail(step integer primary key, label text, state text) on commit drop;
insert into p_trail select 1, 'created', pg_temp.p_state('n');
select pg_temp.s09w_claim('n');
insert into p_trail select 2, 'claimed', pg_temp.p_state('n');
select pg_temp.s09w_pass('n', true);
select is(pg_temp.p_col('n', 'cursor') || '/' || pg_temp.p_col('n', 'target_count'), '2/2', 'the scan advanced the durable cursor and target count to the two rows read [P2-S09-AC-187]');
select pg_temp.s09d_call('n:seal', 'platform_api.cms_finalize_schema_migration_dry_run', (pg_temp.s09w_base('n') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('n'), 'cursor', pg_temp.s09w_plan_cursor('n'),
  'sourceCount', '2', 'targetCount', '2', 'rowErrorCount', '0'));
insert into p_trail select 3, 'sealed', pg_temp.p_state('n');
select pg_temp.s09d_submit('n'); select pg_temp.s09d_assign('n', 'rev1'); select pg_temp.s09d_decide('n', 'rev1');
select pg_temp.s09d_activate('n');
select is(pg_temp.s09d_outcome('n:activate'), 'VALIDATION_FAILED', 'a candidate whose plan has affected rows cannot switch before the worker completed the backfill (the plan is not completed) [P2-S09-AC-187]');
select pg_temp.s09w_claim('n');
insert into p_trail select 4, 'running', pg_temp.p_state('n');
select pg_temp.s09w_pass('n', false);
select pg_temp.s09w_begin('n');
insert into p_trail select 5, 'verifying', pg_temp.p_state('n');
select pg_temp.s09w_verify('n');
select pg_temp.s09w_complete('n');
insert into p_trail select 6, 'completed', pg_temp.p_state('n');
select is((select string_agg(state, '>' order by step) from p_trail), 'draft>dry_running>ready>running>verifying>completed', 'the observed plan states are draft, dry_running, ready, running, verifying, completed in that order [P2-S09-AC-187]');
select ok(pg_temp.p_col('n', 'cursor') = '2' and pg_temp.p_col('n', 'source_count') = '2' and pg_temp.p_col('n', 'target_count') = '2' and pg_temp.p_col('n', 'migrated_count') = '2' and pg_temp.p_col('n', 'row_error_count') = '0'
    and pg_temp.p_col('n', 'failed_count') = '0' and pg_temp.p_col('n', 'progress') = '1.000000', 'cursor, progress and every counter are durable on the completed plan [P2-S09-AC-187]');
select ok((select p.dry_run_report->>'sourceHash' ~ '^[a-f0-9]{64}$' and p.dry_run_report->>'targetHash' ~ '^[a-f0-9]{64}$' and p.dry_run_report->>'compilerHash' ~ '^[a-f0-9]{64}$' and p.dry_run_report->>'transformHash' ~ '^[a-f0-9]{64}$'
      and p.dry_run_report->>'transformKey' = 'identity.revalidate' and p.transform_version = 1
      and p.dry_run_report->>'sourceHash' = (select definition_hash from platform_private.cms_content_type_versions where id = p.from_version_id)
      and p.dry_run_report->>'targetHash' = (select definition_hash from platform_private.cms_content_type_versions where id = p.to_version_id)
    from platform_private.cms_schema_migration_plans p where p.id = pg_temp.s09d_id('n:plan')),
  'the source, target, compiler and transform hashes and the transform pair are durable and bind the exact source and target definitions [P2-S09-AC-187]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('n:version')), 'approved', 'completion alone does not switch the version: activation does [P2-S09-AC-187]');
-- invalid order is refused and changes nothing
select pg_temp.p_ready('o', 'oo', 'p240_order');
select is(pg_temp.p_state('o'), 'ready', 'fixture: a second plan is sealed ready [P2-S09-AC-187]');
create or replace function pg_temp.p_out_of_order(p_tag text, p_rpc text, p_extra jsonb) returns text language plpgsql as $body$
declare before_state text := pg_temp.p_state(p_tag) || pg_temp.p_col(p_tag, 'version');
begin
  perform pg_temp.s09d_call(p_tag || ':ooo:' || p_rpc, 'platform_api.' || p_rpc, (pg_temp.s09w_base(p_tag) - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version(p_tag), 'cursor', pg_temp.s09w_plan_cursor(p_tag)) || p_extra);
  return pg_temp.s09d_outcome(p_tag || ':ooo:' || p_rpc) || ' ' || (before_state = pg_temp.p_state(p_tag) || pg_temp.p_col(p_tag, 'version'))::text;
end;
$body$;
select is(pg_temp.p_out_of_order('o', 'cms_begin_schema_migration_verification', pg_temp.s09w_counts('o')), 'CONFLICT true', 'verification cannot begin from ready (no running pass happened) and the plan is unchanged [P2-S09-AC-187]');
select pg_temp.s09d_call('o:ooo:complete', 'platform_api.cms_complete_schema_migration', jsonb_build_object('migrationPlanId', pg_temp.s09d_id('o:plan'), 'expectedVersion', pg_temp.s09w_plan_version('o'), 'leaseToken', extensions.gen_random_uuid()));
select ok(pg_temp.s09d_outcome('o:ooo:complete') in ('CONFLICT', 'VALIDATION_FAILED', 'UNAUTHENTICATED', 'NOT_FOUND') and pg_temp.p_state('o') = 'ready', 'completion cannot skip the run and verification: the plan stays ready [P2-S09-AC-187]');
select pg_temp.s09w_claim('o');
select is(pg_temp.p_state('o'), 'running', 'the worker claim moves ready to running [P2-S09-AC-187]');
select pg_temp.s09w_pass('o', false);
select pg_temp.s09w_verify('o');
select ok(pg_temp.p_state('o') = 'running', 'verification does not start the verifying state by itself: begin verification does [P2-S09-AC-187]');
-- blocked: a plan whose scan finds row errors
select pg_temp.s09d_create_type('p', 'p240_blocked');
select pg_temp.s09d_to_active('p');
select pg_temp.s09w_entry('b1', 'p', 'Alpha');
select pg_temp.s09d_successor('q', 'p');
select pg_temp.s09d_rpc('q:extra', 'platform_api.cms_add_field_definition', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('q:type'), 'versionId', pg_temp.s09d_id('q:version'),
  'field', jsonb_build_object('key', 'extra', 'kind', 'short_text', 'constraints', '{}'::jsonb, 'required', true, 'validatorKey', null, 'validatorVersion', null, 'defaultMode', 'none', 'localizationMode', 'none',
    'editorConfig', jsonb_build_object('label', 'Extra', 'order', 1), 'lifecycle', 'active'), 'migrationPlanId', null, 'expectedVersion', pg_temp.s09d_version('q'), 'idempotencyKey', 'p240-mig-extra-0001'));
select pg_temp.s09d_dry_run('q', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('q');
select is(pg_temp.p_state('q') || '/' || pg_temp.p_col('q', 'row_error_count'), 'blocked/1', 'a scan that finds a row it cannot migrate seals the plan blocked, never ready [P2-S09-AC-187]');
-- failures
select pg_temp.p_ready('r', 'rr', 'p240_retry');
select pg_temp.s09w_claim('r');
select pg_temp.s09w_pass('r', false);
select pg_temp.s09w_rollback('r', 'rr', true);
select is(pg_temp.p_state('r'), 'failed_retryable', 'a rollback marked retryable ends the plan in failed_retryable [P2-S09-AC-187]');
select pg_temp.p_ready('t', 'tt', 'p240_terminal');
select pg_temp.s09w_claim('t');
select pg_temp.s09w_pass('t', false);
select pg_temp.s09w_rollback('t', 'tt', false);
select is(pg_temp.p_state('t'), 'failed_terminal', 'a rollback that is not retryable ends it in failed_terminal [P2-S09-AC-187]');
select ok(pg_temp.p_col('r', 'cursor') = '2' and pg_temp.p_col('r', 'migrated_count') = '2' and pg_temp.p_col('r', 'source_count') = '2' and pg_temp.p_col('t', 'cursor') = '2', 'the cursor and counters survive a failure for diagnosis and resume [P2-S09-AC-187]');

-- ===================================================== AC188 failure semantics ====
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('rr:version')), 'active', 'a failed migration leaves the old active version active [P2-S09-AC-188]');
select pg_temp.s09d_rpc('r:read', 'platform_api.cms_get_content_type_version', 'owner', jsonb_build_object('contentTypeId', pg_temp.s09d_id('rr:type'), 'versionId', pg_temp.s09d_id('rr:version')));
select ok(pg_temp.s09d_outcome('r:read') = 'OK' and pg_temp.s09d_resp('r:read')->'resource'->>'state' = 'active', 'and it remains readable through CMS-03A-07 as the active version [P2-S09-AC-188]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('r:version')), 'approved', 'the target version is not switched in: it stays approved [P2-S09-AC-188]');
select is((select count(*)::integer from platform_private.cms_entry_revisions where schema_version_id = pg_temp.s09d_id('rr:version')), 2, 'no source row was deleted by the failed migration [P2-S09-AC-188]');
select ok((select count(*) = 2 from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('r:plan')), 'the append-only target rows written before the failure are retained as evidence [P2-S09-AC-188]');
select is(pg_temp.s09e_writers('cms_schema_migration_target_rows', 'delete[[:space:]]+from') || pg_temp.s09e_writers('cms_entry_revisions', 'delete[[:space:]]+from'), '', 'no function deletes a target row or an entry revision: a migration never removes rows [P2-S09-AC-188]');
select pg_temp.s09d_call('r:changed', 'platform_api.cms_claim_schema_migration_lease', (pg_temp.s09w_base('r') - 'schemaVersionId' - 'transformKey') || jsonb_build_object('schemaVersionId', pg_temp.s09d_id('r:version'),
  'transformKey', 'default.fill_literal', 'expectedVersion', pg_temp.s09w_plan_version('r'), 'cursor', pg_temp.s09w_plan_cursor('r'), 'leaseOwner', 'w', 'workerId', 'w', 'leaseDurationMs', '600000', 'now', clock_timestamp()::text));
select is(pg_temp.s09d_outcome('r:changed'), 'VALIDATION_FAILED', 'a worker cannot retry a failed plan with a different transform: refused and the plan is unchanged [P2-S09-AC-188]');
select is(pg_temp.p_state('r') || '/' || coalesce(pg_temp.p_col('r', 'transform_key'), '-'), 'failed_retryable/identity.revalidate', 'the plan still carries its original transform [P2-S09-AC-188]');
select pg_temp.s09d_dry_run('r', 'owner', 'default.fill_literal', '1', 'p240-changed-xf-0001');
select is(pg_temp.s09d_outcome('r:dryRun'), 'CONFLICT', 'a fresh dry run of the failed candidate with a changed transform is also refused [P2-S09-AC-188]');
-- lease expiry resumes through CAS
select pg_temp.p_ready('l', 'll', 'p240_lease');
select pg_temp.s09w_claim('l', 'worker-a');
create temp table p_lease on commit drop as select pg_temp.s09w_lease('l') as token_a, pg_temp.p_col('l', 'version') as version_a;
select is(pg_temp.s09d_resp('l:w.claim')->>'leaseOwner' is null and pg_temp.s09d_resp('l:w.claim')->'plan'->>'leaseOwner' = 'worker-a', true, 'worker A holds the lease [P2-S09-AC-188]');
select pg_temp.s09w_claim('l', 'worker-b');
select ok(pg_temp.s09d_resp('l:w.claim')->>'acquired' = 'false' and pg_temp.s09d_resp('l:w.claim')->>'reasonCode' = 'LEASE_UNAVAILABLE' and pg_temp.p_col('l', 'version') = (select version_a from p_lease),
  'a second worker cannot take a live lease and changes nothing [P2-S09-AC-188]');
select pg_temp.s09d_call('l:stale', 'platform_api.cms_claim_schema_migration_lease', (pg_temp.s09w_base('l') - 'schemaVersionId') || jsonb_build_object('schemaVersionId', pg_temp.s09d_id('l:version'), 'expectedVersion', '1', 'cursor', pg_temp.s09w_plan_cursor('l'),
  'leaseOwner', 'worker-b', 'workerId', 'worker-b', 'leaseDurationMs', '600000', 'now', (clock_timestamp() + interval '11 minutes')::text));
select is(pg_temp.s09d_outcome('l:stale'), 'CONFLICT', 'a resume that carries a stale plan version is refused by the compare-and-swap even after expiry [P2-S09-AC-188]');
select pg_temp.s09w_claim('l', 'worker-b', clock_timestamp() + interval '11 minutes');
select ok(pg_temp.s09d_resp('l:w.claim')->'plan'->>'leaseOwner' = 'worker-b' and pg_temp.s09d_resp('l:w.claim')->'plan'->>'leaseToken' is distinct from (select token_a::text from p_lease)
    and pg_temp.p_col('l', 'version')::bigint = (select version_a::bigint + 1 from p_lease), 'after the lease expires a replacement worker takes it through the compare-and-swap: a new token and the version advanced exactly once [P2-S09-AC-188]');
select is(pg_temp.p_col('l', 'cursor'), '0', 'the replacement resumes from the durable cursor [P2-S09-AC-188]');
select pg_temp.s09w_pass('l', false);
select pg_temp.s09w_read('l', 'l:oldtoken');
create or replace function pg_temp.p_old_token_batch() returns text language plpgsql as $body$
declare base jsonb := pg_temp.s09w_base('l'); before_cursor text := pg_temp.p_col('l', 'cursor');
begin
  perform pg_temp.s09d_call('l:oldtoken:batch', 'platform_api.cms_process_schema_migration_batch', base || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('l'), 'cursor', pg_temp.s09w_plan_cursor('l'),
    'limit', '128', 'leaseToken', (select token_a from p_lease), 'rowEvidence', '[]'::jsonb, 'correlationId', extensions.gen_random_uuid(), 'causationId', null));
  return pg_temp.s09d_outcome('l:oldtoken:batch') || ' ' || (before_cursor = pg_temp.p_col('l', 'cursor'))::text;
end;
$body$;
select ok(pg_temp.p_old_token_batch() like '%true' and pg_temp.s09d_outcome('l:oldtoken:batch') <> 'OK', 'the displaced worker''s old token can no longer advance the plan [P2-S09-AC-188]');
select pg_temp.s09w_finish('l');
select is(pg_temp.p_state('l'), 'completed', 'the replacement worker completes the migration it resumed [P2-S09-AC-188]');

select * from finish();
rollback;
