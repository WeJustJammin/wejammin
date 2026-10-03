\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 (BE03a real scan, multi-field protocol): a plan with several
-- changed fields is admitted (the single-target-field ambiguity refusal is
-- gone), the read page lists every changed field in targetFields and every
-- removed or deprecated field in retiredFields, both registered transforms apply
-- per field, retired values are carried unvalidated, and a retire-only plan on a
-- populated type scans, backfills and activates clean.  The database reproduces
-- every verdict the (independent) worker simulation computes and refuses a pass
-- it can disprove on ANY field.  Every producer row is written by a named RPC.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));

create or replace function pg_temp.s09m_state(p_tag text, p_column text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_migration_plans', p_column, pg_temp.s09d_id(p_tag || ':plan')) $body$;

-- ------------------------------------------------ pure executor contract ----
select is(platform_private.cms_migration_expected_output('identity.revalidate', null,
    '{"targetFields":[],"retiredFields":["summary"]}'::jsonb, '{"title":"A","summary":"x"}'::jsonb),
  '{"title":"A","summary":"x"}'::jsonb,
  'identity.revalidate over a retire-only spec carries the row, retired value included');
select is(platform_private.cms_migration_expected_output('identity.revalidate', null,
    '{"targetFields":[],"retiredFields":[]}'::jsonb, '{"title":"A"}'::jsonb),
  '{"title":"A"}'::jsonb,
  'identity.revalidate over a field-neutral spec (no target, no retired field) carries the row unchanged');
select is(platform_private.cms_migration_expected_output('default.fill_literal', null,
    '{"targetFields":[],"retiredFields":[]}'::jsonb, '{"title":"A"}'::jsonb),
  '{"title":"A"}'::jsonb,
  'default.fill_literal over a field-neutral spec carries the row unchanged');
select is(platform_private.cms_migration_expected_output(null, null, null, '{"title":"A"}'::jsonb),
  '{"title":"A"}'::jsonb, 'a plan with no transform carries the document unchanged');
select is(platform_private.cms_migration_expected_output('default.fill_literal', null,
    '{"targetFields":[{"fieldKey":"summary","kind":"short_text","required":true,"defaultMode":"literal","defaultValue":"n/a","constraints":{}},
      {"fieldKey":"note","kind":"short_text","required":true,"defaultMode":"literal","defaultValue":"none","constraints":{}}],
      "retiredFields":[]}'::jsonb, '{"title":"A","summary":"S"}'::jsonb),
  '{"title":"A","summary":"S","note":"none"}'::jsonb,
  'default.fill_literal fills each absent field with its own literal and keeps a present value');
select is(platform_private.cms_migration_expected_output('default.fill_literal', null,
    '{"targetFields":[{"fieldKey":"summary","kind":"short_text","required":true,"defaultMode":"literal","defaultValue":"n/a","constraints":{}},
      {"fieldKey":"note","kind":"short_text","required":true,"defaultMode":"none","defaultValue":null,"constraints":{}}],
      "retiredFields":[]}'::jsonb, '{"title":"A"}'::jsonb), null::jsonb,
  'default.fill_literal is unprovable when ANY target field has no literal default');
select is(platform_private.cms_migration_expected_output('default.fill_literal', null,
    '{"targetFields":[],"retiredFields":["summary"]}'::jsonb, '{"title":"A","summary":"x"}'::jsonb),
  '{"title":"A","summary":"x"}'::jsonb, 'default.fill_literal over a retire-only spec carries the row');

-- ----------------------------- multi-field identity.revalidate, blocked scan ----
select pg_temp.s09d_create_type('m', 'multiblock');
select pg_temp.s09w_add_summary('m');
select pg_temp.s09d_to_active('m');
select pg_temp.s09w_entry('m1', 'm', 'Alpha', 'Has summary');
select pg_temp.s09w_entry('m2', 'm', 'Beta title longer');
select pg_temp.s09w_entry('m3', 'm', 'Gamma', 'S');
select pg_temp.s09w_entry('m4', 'm', 'A title that is far too long for twenty');
select is(pg_temp.s09d_outcome('m1') || pg_temp.s09d_outcome('m2') || pg_temp.s09d_outcome('m3') || pg_temp.s09d_outcome('m4'), 'OKOKOKOK',
  'fixture: four real entries, two of them with a summary');
select pg_temp.s09d_successor('n', 'm');
select pg_temp.s09d_dry_run('n');
select pg_temp.s09w_dry_run('n');
select pg_temp.s09w_tighten('n', 20);
select is(pg_temp.s09d_outcome('n:tighten'), 'OK', 'CMS-03A-02 tightens the title under the clone''s ready plan');
select pg_temp.s09w_redefine('n', 'short_text', jsonb_build_object('maxLength', 5), null, 'n:summary', 'summary', false);
select is(pg_temp.s09d_outcome('n:summary'), 'OK', 'CMS-03A-02 also tightens the summary of the same candidate');
select pg_temp.s09d_dry_run('n', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('n:dryRun'), 'OK',
  'CMS-03A-10 admits a plan with two changed fields (no MIGRATION_TARGET_FIELD_AMBIGUOUS)');
select is(pg_temp.s09d_detail('n:dryRun'), null, 'the admission carries no ambiguity detail');
select pg_temp.s09w_claim('n');
select pg_temp.s09w_read('n', 'n:read', '2');
select ok((select r->'targetFields' = jsonb_build_array(
        jsonb_build_object('fieldKey', 'summary', 'kind', 'short_text', 'required', false, 'defaultMode', 'none',
          'defaultValue', null, 'constraints', jsonb_build_object('maxLength', 5)),
        jsonb_build_object('fieldKey', 'title', 'kind', 'short_text', 'required', true, 'defaultMode', 'none',
          'defaultValue', null, 'constraints', jsonb_build_object('maxLength', 20)))
      and r->'retiredFields' = '[]'::jsonb and (r->>'done')::boolean = false and jsonb_array_length(r->'rows') = 2
    from (select pg_temp.s09d_resp('n:read') r) s),
  'the page lists both changed fields ordered by field key; done = false carries exactly limit rows');
select pg_temp.s09w_read('n', 'n:read.all');
create temp table s09m_good on commit drop as
select pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('n:read.all')) as evidence;
select ok((select jsonb_array_length(evidence) = 4
    and (select count(*) = 2 from jsonb_array_elements(evidence) e where e->>'errorCode' = 'TRANSFORM_TARGET_VIOLATION')
    from s09m_good), 'fixture: the independent worker verdict is two passes and two violations (one per field)');
-- A pass for a row that violates the FIRST field and one that violates the SECOND field are both refused.
create temp table s09m_idx on commit drop as
select (select array_agg((ord::int - 1) order by ord) from s09m_good, jsonb_array_elements(evidence) with ordinality t(e, ord)
         where e->>'errorCode' is not null) as bad;
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('n:falsepass.1', 'platform_api.cms_process_schema_migration_dry_run_batch',
  pg_temp.s09w_batch_request('n', (select jsonb_set(jsonb_set(evidence, array[(bad[1])::text, 'errorCode'], 'null'::jsonb),
    array[(bad[1])::text, 'outputHash'], evidence->(bad[1])->'sourceHash') from s09m_good, s09m_idx)));
select pg_temp.s09d_call('n:falsepass.2', 'platform_api.cms_process_schema_migration_dry_run_batch',
  pg_temp.s09w_batch_request('n', (select jsonb_set(jsonb_set(evidence, array[(bad[2])::text, 'errorCode'], 'null'::jsonb),
    array[(bad[2])::text, 'outputHash'], evidence->(bad[2])->'sourceHash') from s09m_good, s09m_idx)));
select is(pg_temp.s09d_outcome('n:falsepass.1') || '/' || pg_temp.s09d_outcome('n:falsepass.2'), 'VALIDATION_FAILED/VALIDATION_FAILED',
  'the database refuses a pass that violates either changed field');
select is(pg_temp.s09d_detail('n:falsepass.1') || '/' || pg_temp.s09d_detail('n:falsepass.2'),
  'MIGRATION_EVIDENCE_UNPROVEN/MIGRATION_EVIDENCE_UNPROVEN', 'the refusal names MIGRATION_EVIDENCE_UNPROVEN');
select pg_temp.s09w_batch('n', 'n:honest', (select evidence from s09m_good), true);
select ok((select r->>'targetCount' = '2' and r->>'rowErrorCount' = '2' and r->>'cursor' = '4'
    from (select pg_temp.s09d_resp('n:honest') r) s), 'the honest multi-field evidence is accepted and counted (2 passes, 2 errors)');
select pg_temp.s09d_call('n:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('n') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('n'),
    'cursor', pg_temp.s09w_plan_cursor('n'), 'sourceCount', '4', 'targetCount', '2', 'rowErrorCount', '2'));
select is(pg_temp.s09m_state('n', 'state'), 'blocked', 'a multi-field scan with row errors seals blocked');

-- --------------------------------- multi-field identity.revalidate, clean ----
select pg_temp.s09d_create_type('q', 'multiclean');
select pg_temp.s09w_add_summary('q');
select pg_temp.s09d_to_active('q');
select pg_temp.s09w_entry('q1', 'q', 'Alpha', 'Has summary');
select pg_temp.s09w_entry('q2', 'q', 'Beta title longer');
select pg_temp.s09w_entry('q3', 'q', 'Gamma', 'S');
select pg_temp.s09d_successor('u', 'q');
select pg_temp.s09d_dry_run('u');
select pg_temp.s09w_dry_run('u');
select pg_temp.s09w_tighten('u', 20);
select pg_temp.s09w_redefine('u', 'short_text', jsonb_build_object('maxLength', 12), null, 'u:summary', 'summary', false);
select pg_temp.s09d_dry_run('u', 'owner', 'identity.revalidate', '1');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('u:plan')), 'conditional',
  'two tightened fields derive a conditional classification');
select pg_temp.s09w_dry_run('u');
select is(pg_temp.s09m_state('u', 'state'), 'ready', 'every row satisfies both fields: the multi-field plan seals ready');
select pg_temp.s09d_submit('u');
select pg_temp.s09d_assign('u', 'rev1');
select pg_temp.s09d_decide('u', 'rev1');
select pg_temp.s09w_backfill('u');
select is(pg_temp.s09d_outcome('u:w.complete'), 'OK', 'the worker backfills, verifies and completes the multi-field plan');
-- definer helper called outside a command: it reads the forced tables under the RPC context, as a command does
select set_config('app.cms_rpc', 'true', true);
select ok((select count(*) = 3 and bool_and(target_document = (
      select platform_private.cms_migration_revision_document(revision.id)
        from platform_private.cms_entry_revisions revision where revision.id = target.source_row_id))
    from platform_private.cms_schema_migration_target_rows target where target.plan_id = pg_temp.s09d_id('u:plan')
      and target.source_table = 'cms_entry_revisions'),
  'the database wrote three target rows equal to the validated source documents');
select set_config('app.cms_rpc', '', true);
select pg_temp.s09d_activate('u');
select is(pg_temp.s09d_outcome('u:activate'), 'OK', 'CMS-03A-04 switches the multi-field plan');

-- ------------------------------- multi-field default.fill_literal ----
select pg_temp.s09d_create_type('p', 'multifill');
select pg_temp.s09w_add_summary('p');
select pg_temp.s09w_add_field('p', 'note', 2);
select pg_temp.s09d_to_active('p');
select pg_temp.s09w_entry('p1', 'p', 'Alpha');
select pg_temp.s09w_entry('p2', 'p', 'Beta', 'Has summary');
select pg_temp.s09d_successor('w', 'p');
select pg_temp.s09d_dry_run('w');
select pg_temp.s09w_dry_run('w');
select pg_temp.s09w_redefine('w', 'short_text', '{}'::jsonb, null, 'w:summary', 'summary', true, 'literal', '"n/a"'::jsonb);
select pg_temp.s09w_redefine('w', 'short_text', '{}'::jsonb, null, 'w:note', 'note', true, 'literal', '"none"'::jsonb);
select is(pg_temp.s09d_outcome('w:summary') || pg_temp.s09d_outcome('w:note'), 'OKOK', 'CMS-03A-02 makes both optional fields required with literal defaults');
select pg_temp.s09d_dry_run('w', 'owner', 'default.fill_literal', '1');
select is(pg_temp.s09d_outcome('w:dryRun'), 'OK', 'CMS-03A-10 admits the two-field fill plan');
select pg_temp.s09w_claim('w');
select pg_temp.s09w_read('w', 'w:read');
select ok((select jsonb_array_length(r->'targetFields') = 2
    and (select array_agg(f->>'fieldKey' order by ord) = array['note', 'summary']
         from jsonb_array_elements(r->'targetFields') with ordinality t(f, ord))
    from (select pg_temp.s09d_resp('w:read') r) s), 'the read page lists both fill fields with their literal defaults');
create temp table s09m_fill on commit drop as
select pg_temp.s09w_evidence('default.fill_literal', pg_temp.s09d_resp('w:read')) as evidence;
select ok((select jsonb_array_length(evidence) = 2 and not exists (select 1 from jsonb_array_elements(evidence) e where e->>'errorCode' is not null)
    from s09m_fill), 'fixture: the worker fills every row');
select pg_temp.s09d_session('owner', 'service_role');
select pg_temp.s09d_call('w:lie', 'platform_api.cms_process_schema_migration_dry_run_batch',
  pg_temp.s09w_batch_request('w', (select jsonb_agg(jsonb_set(e, '{outputHash}', e->'sourceHash')) from s09m_fill, jsonb_array_elements(evidence) e)));
select is(pg_temp.s09d_outcome('w:lie'), 'VALIDATION_FAILED', 'an identity pass over rows that need two fills is refused');
select pg_temp.s09w_batch('w', 'w:scan', (select evidence from s09m_fill), true);
select ok((select r->>'targetCount' = '2' and r->>'rowErrorCount' = '0' from (select pg_temp.s09d_resp('w:scan') r) s),
  'the honest two-field fill evidence is accepted');
select pg_temp.s09d_call('w:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('w') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('w'),
    'cursor', pg_temp.s09w_plan_cursor('w'), 'sourceCount', '2', 'targetCount', '2', 'rowErrorCount', '0'));
select pg_temp.s09w_backfill('w');
select is(pg_temp.s09d_outcome('w:w.complete'), 'OK', 'the worker backfills and completes the two-field fill plan');
select ok((select count(*) = 2 and bool_and(target_document ? 'summary' and target_document ? 'note')
    and count(*) filter (where target_document->>'summary' = 'n/a' and target_document->>'note' = 'none') = 1
    and count(*) filter (where target_document->>'summary' = 'Has summary' and target_document->>'note' = 'none') = 1
    from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('w:plan')),
  'the database wrote each filled literal: the bare row gets both, the populated row only the missing field');

-- --------------------------------- retire a field on a populated type ----
select pg_temp.s09d_create_type('r', 'retirefield');
select pg_temp.s09w_add_summary('r');
select pg_temp.s09d_to_active('r');
select pg_temp.s09w_entry('r1', 'r', 'Alpha', 'Has summary');
select pg_temp.s09w_entry('r2', 'r', 'Beta');
select is(pg_temp.s09d_outcome('r1') || pg_temp.s09d_outcome('r2'), 'OKOK', 'fixture: a populated type with a populated summary field');
select pg_temp.s09d_successor('s', 'r');
select pg_temp.s09d_dry_run('s');
select pg_temp.s09w_dry_run('s');
select pg_temp.s09w_redefine('s', 'short_text', '{}'::jsonb, null, 's:retire', 'summary', false, 'none', null, 'deprecated');
select is(pg_temp.s09d_outcome('s:retire'), 'OK', 'CMS-03A-02 deprecates the summary field on the successor draft');
select pg_temp.s09d_dry_run('s', 'owner', 'identity.revalidate', '1');
select is(pg_temp.s09d_outcome('s:dryRun'), 'OK', 'CMS-03A-10 admits a retire-only plan over a populated type');
select is((select classification from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('s:plan')), 'conditional',
  'a lifecycle change derives a conditional classification');
select pg_temp.s09w_claim('s');
select pg_temp.s09w_read('s', 's:read');
select ok((select r->'targetFields' = '[]'::jsonb and r->'retiredFields' = '["summary"]'::jsonb
    and jsonb_array_length(r->'rows') = 2 and (r->>'done')::boolean
    from (select pg_temp.s09d_resp('s:read') r) s),
  'the page has no target field and names summary as the retired field; both populated rows are served');
create temp table s09m_retire on commit drop as
select pg_temp.s09w_evidence('identity.revalidate', pg_temp.s09d_resp('s:read')) as evidence;
select ok((select jsonb_array_length(evidence) = 2 and not exists (select 1 from jsonb_array_elements(evidence) e where e->>'errorCode' is not null)
    and not exists (select 1 from jsonb_array_elements(evidence) e where e->>'outputHash' <> e->>'sourceHash')
    from s09m_retire), 'fixture: the worker carries every row unchanged (retired value kept, nothing validated)');
select pg_temp.s09w_batch('s', 's:scan', (select evidence from s09m_retire), true);
select ok((select r->>'targetCount' = '2' and r->>'rowErrorCount' = '0' from (select pg_temp.s09d_resp('s:scan') r) s),
  'the database accepts the retire-only carry evidence');
select pg_temp.s09d_call('s:seal', 'platform_api.cms_finalize_schema_migration_dry_run',
  (pg_temp.s09w_base('s') - 'schemaVersionId') || jsonb_build_object('expectedVersion', pg_temp.s09w_plan_version('s'),
    'cursor', pg_temp.s09w_plan_cursor('s'), 'sourceCount', '2', 'targetCount', '2', 'rowErrorCount', '0'));
select is(pg_temp.s09m_state('s', 'state'), 'ready', 'a retire-only plan seals clean');
select pg_temp.s09d_submit('s');
select pg_temp.s09d_assign('s', 'rev1');
select pg_temp.s09d_decide('s', 'rev1');
select pg_temp.s09w_backfill('s');
select is(pg_temp.s09d_outcome('s:w.complete'), 'OK', 'the worker backfills, verifies and completes the retire-only plan');
select ok((select count(*) = 2 and count(*) filter (where target_document ? 'summary') = 1
    from platform_private.cms_schema_migration_target_rows where plan_id = pg_temp.s09d_id('s:plan')),
  'the retired value of the populated row is carried in its target document');
select pg_temp.s09d_activate('s');
select is(pg_temp.s09d_outcome('s:activate'), 'OK', 'CMS-03A-04 activates the retire-only successor over the populated type');
select ok((select field.state = 'deprecated' from platform_private.cms_field_definition_versions field
    where field.content_type_version_id = pg_temp.s09d_id('s:version') and field.field_key = 'summary'),
  'the activated successor carries the deprecated summary field');

select ok(pg_temp.s09x_via_rpc('cms_schema_dry_run_row_evidence') > 0 and pg_temp.s09x_via_rpc('cms_schema_migration_target_rows') > 0,
  'precondition: evidence and target rows were written through named RPCs');
select is(pg_temp.s09x_direct(), 0::bigint,
  'no review, decision, assignment, dry-run, evidence, target-row or plan row was written by a direct statement');

select * from finish();
rollback;
