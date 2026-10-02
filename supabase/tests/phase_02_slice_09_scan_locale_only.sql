commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a real scan, DB stage 5 follow-up): a field-neutral
-- breaking change over a POPULATED type must complete.  Removing a supported
-- locale is classified breaking and needs a registered transform pair, but the
-- plan changes no field and retires none, so the registered executor has no
-- target to prove: both registered members carry every row unchanged (clean
-- evidence, outputHash == sourceHash) and the backfill and verify recomputation
-- reproduce exactly that.  Every producer row is written by a named RPC through
-- the real worker protocol.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

create or replace function pg_temp.s09o_state(p_tag text, p_column text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_migration_plans', p_column, pg_temp.s09d_id(p_tag || ':plan')) $body$;

-- ------------------------------------------------ pure executor contract ----
select is(platform_private.cms_migration_expected_output('identity.revalidate', null,
    '{"targetFields":[],"retiredFields":[]}'::jsonb, '{"title":"A","extra":1}'::jsonb),
  '{"title":"A","extra":1}'::jsonb, 'identity.revalidate carries a row over a field-neutral spec');
select is(platform_private.cms_migration_expected_output('default.fill_literal', null,
    '{"targetFields":[],"retiredFields":[]}'::jsonb, '{"title":"A"}'::jsonb),
  '{"title":"A"}'::jsonb, 'default.fill_literal carries a row over a field-neutral spec');
select is(platform_private.cms_migration_expected_output('identity.revalidate', null, null, '{"title":"A"}'::jsonb),
  null::jsonb, 'a registered pair with no spec at all still cannot prove a row');
select is(platform_private.cms_migration_expected_output('not.registered', null,
    '{"targetFields":[],"retiredFields":[]}'::jsonb, '{"title":"A"}'::jsonb),
  null::jsonb, 'an unregistered key still cannot prove a row');

-- ------------------------- locale-only breaking change over a populated type ----
select pg_temp.s09d_create_type('l', 'localeonly', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09d_to_active('l');
select pg_temp.s09w_entry('l1', 'l', 'Alpha');
select pg_temp.s09w_entry('l2', 'l', 'Beta');
select pg_temp.s09w_entry('l3', 'l', 'Gamma');
select is(pg_temp.s09d_outcome('l1') || pg_temp.s09d_outcome('l2') || pg_temp.s09d_outcome('l3'), 'OKOKOK',
  'fixture: three real entries on the activated three-locale type');
select pg_temp.s09d_successor('m', 'l', 'owner', null, '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select is(pg_temp.s09d_outcome('m:successor'), 'OK', 'fixture: the successor drops pt-BR and changes no field');
select pg_temp.s09d_dry_run('m', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('m:dryRun'), 'OK', 'CMS-03A-10 admits the locale-only breaking change with a registered pair');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('m:plan')), 'breaking',
  'removing a supported locale is classified breaking');
select pg_temp.s09w_claim('m');
select pg_temp.s09w_read('m', 'm:read');
select ok((select r->'targetFields' = '[]'::jsonb and r->'retiredFields' = '[]'::jsonb
    and jsonb_array_length(r->'rows') = 3 and (r->>'done')::boolean
    from (select pg_temp.s09d_resp('m:read') r) s),
  'the read page names no target and no retired field and serves all three populated rows');
create temp table s09o_carry on commit drop as
select pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('m:read')) as evidence;
select ok((select jsonb_array_length(evidence) = 3
    and not exists (select 1 from jsonb_array_elements(evidence) e where e->>'errorCode' is not null)
    and not exists (select 1 from jsonb_array_elements(evidence) e where e->>'outputHash' <> e->>'sourceHash')
    from s09o_carry), 'fixture: the worker carries every row unchanged (clean evidence, outputHash == sourceHash)');
select pg_temp.s09w_batch('m', 'm:scan', (select evidence from s09o_carry), true);
select ok((select r->>'targetCount' = '3' and r->>'rowErrorCount' = '0' and r->>'cursor' = '3'
    from (select pg_temp.s09d_resp('m:scan') r) s),
  'the database accepts and counts the carry evidence of a field-neutral plan');
select pg_temp.s09d_call('m:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('m') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('m'),
    'cursor', pg_temp.s09w_plan_cursor('m'), 'sourceCount', '3', 'targetCount', '3', 'rowErrorCount', '0'));
select is(pg_temp.s09o_state('m', 'state'), 'ready', 'a field-neutral breaking plan seals ready over three rows');
select pg_temp.s09d_submit('m');
select pg_temp.s09d_assign('m', 'rev1');
select pg_temp.s09d_decide('m', 'rev1');
select pg_temp.s09w_backfill('m');
select is(pg_temp.s09d_outcome('m:w.complete'), 'OK',
  'the worker backfills, verifies and completes the locale-only breaking plan over the populated type');
select is(pg_temp.s09o_state('m', 'state'), 'completed', 'the plan is completed');
select ok((select count(*) = 3 and bool_and(target.output_hash = target.source_hash)
      and bool_and(target.target_document = platform_private.cms_migration_revision_document(target.source_row_id))
    from platform_private.cms_schema_migration_target_rows target
    where target.plan_id = pg_temp.s09d_id('m:plan') and target.source_table = 'cms_entry_revisions'),
  'the database wrote three target rows equal to their source documents');
select pg_temp.s09d_activate('m');
select is(pg_temp.s09d_outcome('m:activate'), 'OK', 'CMS-03A-04 activates the locale-only breaking successor over the populated type');

-- ----------- a tampered carry is still refused: the DB proves, never trusts ----
select pg_temp.s09d_create_type('n', 'localeonlylie', 'editorial', 'owner',
  '["en-US","fr-FR","pt-BR"]', '{"fr-FR":["en-US"],"pt-BR":["fr-FR","en-US"]}');
select pg_temp.s09d_to_active('n');
select pg_temp.s09w_entry('n1', 'n', 'Alpha');
select pg_temp.s09d_successor('o', 'n', 'owner', null, '["en-US","fr-FR"]', '{"fr-FR":["en-US"]}');
select pg_temp.s09d_dry_run('o', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_claim('o');
select pg_temp.s09w_read('o', 'o:read');
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('o:lie', 'platform_api.cms_process_schema_migration_dry_run_batch',
  pg_temp.s09w_batch_request('o', jsonb_set(
    pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('o:read')),
    '{0,outputHash}', to_jsonb(repeat('a', 64)))));
select is(pg_temp.s09d_outcome('o:lie'), 'VALIDATION_FAILED',
  'evidence whose outputHash differs from the carried row is refused');

select ok(pg_temp.s09x_via_rpc('cms_schema_dry_run_row_evidence') > 0 and pg_temp.s09x_via_rpc('cms_schema_migration_target_rows') > 0,
  'precondition: evidence and target rows were written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

select * from finish();
rollback;
