\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db), persistence rows of BE03a "Canonical
-- records and fields", part 3 of 3: dry-run reports, row evidence, migration plans and the locale columns. Proven by
-- behaviour, not column presence:
--   * s09e_check isolates ONE real CHECK or NOT NULL (the table's own definition
--     copied into a temp table with every other constraint dropped): the unchanged
--     producer row is accepted and the offending override is rejected by exactly
--     that constraint.
--   * s09e_unique / s09e_unique_idx do the same for a unique constraint or a
--     partial/expression unique index; s09e_fk_probe for every foreign key.
--   * The writer sets are read from the function catalog, so a new writer fails
--     the file that pins the writer set.
-- Base rows come from the real producer chain; no review, decision, dry-run, plan
-- or evidence row is hand-built.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

\ir phase_02_slice_09_dec108/05-probes.sqlinc

-- ------------------------------------------------------------ fixtures ----
select pg_temp.s09d_create_type('a', 'evc_a');
select pg_temp.s09d_to_approved('a');
select pg_temp.s09d_create_type('o', 'evc_o');
select pg_temp.s09d_to_review('o');
select pg_temp.s09d_assign('o', 'rev1');
select pg_temp.s09d_create_type('k', 'evc_k');
select pg_temp.s09d_dry_run('k');
create temp table s09e_ids on commit drop as select
  pg_temp.s09d_id('a:review') as review_done, pg_temp.s09d_id('o:review') as review_open,
  pg_temp.s09d_id('a:decision:rev1') as decision, pg_temp.s09d_id('a:assignment:rev1') as assignment,
  pg_temp.s09d_id('a:dryRun') as report_done, pg_temp.s09d_id('k:dryRun') as report_queued,
  pg_temp.s09d_id('a:plan') as plan_done, pg_temp.s09d_id('k:plan') as plan_live;
select is((select count(*)::integer from s09e_ids where review_done is not null and review_open is not null and decision is not null
  and assignment is not null and report_done is not null and report_queued is not null and plan_done is not null and plan_live is not null), 1,
  'fixture: every base row comes from a real producer');

-- =========================================== cms_schema_dry_run_reports (671-673) ====
-- Fixture: a second attempt on candidate k supersedes the first, which fails as ATTEMPT_SUPERSEDED.
select pg_temp.s09d_add_relation('k');
select pg_temp.s09d_dry_run('k');
create temp table s09e_report_ids on commit drop as
select (select id from platform_private.cms_schema_dry_run_reports where target_version_id = pg_temp.s09d_id('k:version') and state = 'failed') as failed_id,
       (select id from platform_private.cms_schema_dry_run_reports where target_version_id = pg_temp.s09d_id('k:version') and state = 'queued') as queued_id;
select is((select count(*)::integer from s09e_report_ids where failed_id is not null and queued_id is not null), 1,
  'fixture: one failed and one queued attempt of the same target version');
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', c.name, c.base, c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_schema_dry_run_reports CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-671]')
from (values
  ('cms_schema_dry_run_reports_attempt_no_check', (select report_done from s09e_ids), '{"attempt_no":0}'::jsonb),
  ('cms_schema_dry_run_reports_state_check', (select report_done from s09e_ids), '{"state":"cancelled"}'::jsonb),
  ('cms_schema_dry_run_reports_sealed_check', (select report_done from s09e_ids), '{"sealed_at":null}'::jsonb),
  ('cms_schema_dry_run_reports_sealed_check', (select queued_id from s09e_report_ids), jsonb_build_object('sealed_at', now()::text)),
  ('cms_schema_dry_run_reports_failure_code_check', (select queued_id from s09e_report_ids), '{"failure_code":"not a code"}'::jsonb),
  ('cms_schema_dry_run_reports_failure_code_check', (select queued_id from s09e_report_ids), '{"state":"failed"}'::jsonb),
  ('cms_schema_dry_run_reports_failure_code_check', (select failed_id from s09e_report_ids), '{"failure_code":null}'::jsonb)
) as c(name, base, over);
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_sealed_check', (select report_done from s09e_ids),
    '{"state":"completed"}'), 'control:ACCEPTED|override:ACCEPTED', 'state completed with sealed_at present satisfies (state = completed) = (sealed_at IS NOT NULL) [P2-S09-AC-671]');
select ok(pg_temp.s09d_has_columns('cms_schema_dry_run_reports', array['attempt_no','state','job_id','plan_id','failure_code','sealed_at']),
  'cms_schema_dry_run_reports carries attempt_no, state, job_id, plan_id, failure_code and sealed_at [P2-S09-AC-671]');
select is(pg_temp.s09e_unique('cms_schema_dry_run_reports', (select queued_id from s09e_report_ids), array['target_version_id', 'attempt_no'],
    '{"attempt_no":99}'), 'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(target_version_id, attempt_no) [P2-S09-AC-671]');
select is(pg_temp.s09e_unique('cms_schema_dry_run_reports', (select queued_id from s09e_report_ids), array['plan_id'],
    jsonb_build_object('plan_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(plan_id): one plan per attempt [P2-S09-AC-671]');
select is(pg_temp.s09e_unique('cms_schema_dry_run_reports', (select queued_id from s09e_report_ids), array['job_id'],
    jsonb_build_object('job_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(job_id) [P2-S09-AC-671]');

select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_evidence_shape_check', (select queued_id from s09e_report_ids),
    '{"result":"pass"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_dry_run_reports_evidence_shape_check',
  'an unsealed (queued) row carrying a result is rejected [P2-S09-AC-672]');
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_evidence_shape_check', (select queued_id from s09e_report_ids),
    jsonb_build_object('source_count', 3)), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_dry_run_reports_evidence_shape_check',
  'an unsealed row carrying counts is rejected [P2-S09-AC-672]');
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_evidence_shape_check', (select queued_id from s09e_report_ids),
    jsonb_build_object('source_hash', repeat('a', 64))), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_dry_run_reports_evidence_shape_check',
  'an unsealed row carrying hashes is rejected [P2-S09-AC-672]');
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_evidence_shape_check', (select queued_id from s09e_report_ids),
    '{"report":{"result":"pass"}}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_dry_run_reports_evidence_shape_check',
  'an unsealed row carrying a report object is rejected [P2-S09-AC-672]');
select is(pg_temp.s09e_check('cms_schema_dry_run_reports', 'cms_schema_dry_run_reports_evidence_shape_check', (select report_done from s09e_ids),
    '{"result":null}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_dry_run_reports_evidence_shape_check',
  'a sealed row without its result is rejected: sealing writes result, counts, hashes and report together [P2-S09-AC-672]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_dry_run_reports set failure_code = ''LATE'' where id = %L', (select failed_id from s09e_report_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'a failed row rejects every UPDATE [P2-S09-AC-672]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_dry_run_reports set result = ''fail'' where id = %L', (select report_done from s09e_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'a completed row rejects every UPDATE [P2-S09-AC-672]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('delete from platform_private.cms_schema_dry_run_reports where id = %L', (select queued_id from s09e_report_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'DELETE is always rejected, even of an unsealed row [P2-S09-AC-672]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select ok(pg_temp.s09d_try(format('update platform_private.cms_schema_dry_run_reports set state = ''running'', version = version + 1 where id = %L', (select queued_id from s09e_report_ids))),
  'queued advances forward to running [P2-S09-AC-672]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select ok(not pg_temp.s09d_try(format('update platform_private.cms_schema_dry_run_reports set state = ''queued'', version = version + 1 where id = %L', (select queued_id from s09e_report_ids))),
  'running never returns to queued: states advance only forward [P2-S09-AC-672]');
select is(pg_temp.s09e_writers('cms_schema_dry_run_reports', 'insert[[:space:]]+into'), 'cms_start_schema_dry_run',
  'only CMS-03A-10 inserts an attempt [P2-S09-AC-672]');
select is(pg_temp.s09e_writers('cms_schema_dry_run_reports', 'update'), 'cms_claim_schema_migration_lease,cms_finalize_schema_migration_dry_run,cms_rollback_schema_migration,cms_start_schema_dry_run',
  'only the claim, the finalizer (seal), the worker failure call (a dry-running scan that cannot seal ends failed, AC641) and CMS-03A-10 (supersede) advance an attempt [P2-S09-AC-672]');

-- ======================================= cms_schema_dry_run_row_evidence (674-676) ====
select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09d_create_type('sc', 'evc_scan');
select pg_temp.s09d_to_active('sc');
select pg_temp.s09w_entry('e1', 'sc', 'Alpha title');
select pg_temp.s09w_entry('e2', 'sc', 'Beta title with more characters');
select pg_temp.s09w_entry('e3', 'sc', 'Gamma');
select pg_temp.s09d_successor('sd', 'sc');
select pg_temp.s09d_dry_run('sd');
select pg_temp.s09w_dry_run('sd');
select pg_temp.s09w_tighten('sd', 12);
select pg_temp.s09d_dry_run('sd', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('sd');
create temp table s09e_evidence on commit drop as
select (select id from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id('sd:plan') and error_code is null limit 1) as pass_id,
       (select id from platform_private.cms_schema_dry_run_row_evidence where plan_id = pg_temp.s09d_id('sd:plan') and error_code is not null limit 1) as error_id;
select is((select count(*)::integer from s09e_evidence where pass_id is not null and error_id is not null), 1,
  'fixture: the real worker scan recorded a passing and a failing evidence row');
select is(pg_temp.s09e_check('cms_schema_dry_run_row_evidence', c.name, (select pass_id from s09e_evidence), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_schema_dry_run_row_evidence CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-674]')
from (values
  ('cms_schema_dry_run_row_evidence_source_table_check', '{"source_table":"cms_entry_field_values"}'::jsonb),
  ('cms_schema_dry_run_row_evidence_source_hash_check', jsonb_build_object('source_hash', repeat('A', 64))),
  ('cms_schema_dry_run_row_evidence_output_hash_check', jsonb_build_object('output_hash', repeat('g', 64))),
  ('cms_schema_dry_run_row_evidence_error_code_check', '{"error_code":"lower case"}'::jsonb),
  ('cms_schema_dry_run_row_evidence_outcome_check', '{"error_code":"TRANSFORM_TARGET_VIOLATION"}'::jsonb),
  ('cms_schema_dry_run_row_evidence_outcome_check', '{"output_hash":null}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('cms_schema_dry_run_row_evidence', 'cms_schema_dry_run_row_evidence_source_table_check', (select pass_id from s09e_evidence),
    '{"source_table":"cms_publication_versions"}'), 'control:ACCEPTED|override:ACCEPTED', 'the allowlist admits cms_publication_versions [P2-S09-AC-674]');
select is(pg_temp.s09e_check('cms_schema_dry_run_row_evidence', 'cms_schema_dry_run_row_evidence_outcome_check', (select error_id from s09e_evidence),
    '{"output_hash":null}'), 'control:ACCEPTED|override:ACCEPTED', 'an error row has a NULL output_hash and an error_code [P2-S09-AC-674]');
select is(pg_temp.s09e_unique('cms_schema_dry_run_row_evidence', (select pass_id from s09e_evidence), array['report_id', 'source_table', 'source_row_id'],
    jsonb_build_object('source_row_id', extensions.gen_random_uuid())), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'UNIQUE(report_id, source_table, source_row_id): one evidence row per scanned source row [P2-S09-AC-674]');
select ok(pg_temp.s09d_has_columns('cms_schema_dry_run_row_evidence', array['source_table','source_row_id','source_hash','output_hash','error_code','recorded_at']),
  'cms_schema_dry_run_row_evidence records source table, row, source hash, output hash, error code and recorded_at [P2-S09-AC-674]');
select is(pg_temp.s09e_writers('cms_schema_dry_run_row_evidence', 'insert[[:space:]]+into'), 'cms_process_schema_migration_batch',
  'only the worker batch RPC inserts row evidence [P2-S09-AC-675]');
select is(pg_temp.s09e_writers('cms_schema_dry_run_row_evidence', 'update') || pg_temp.s09e_writers('cms_schema_dry_run_row_evidence', 'delete[[:space:]]+from'), '',
  'no function updates or deletes row evidence [P2-S09-AC-675]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_dry_run_row_evidence set error_code = ''LATE'' where id = %L', (select error_id from s09e_evidence)),
  'P0001', 'IMMUTABLE_RECORD', 'row evidence UPDATE is rejected [P2-S09-AC-675]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('delete from platform_private.cms_schema_dry_run_row_evidence where id = %L', (select error_id from s09e_evidence)),
  'P0001', 'IMMUTABLE_RECORD', 'row evidence DELETE is rejected [P2-S09-AC-675]');
select ok(pg_temp.s09d_rls('cms_schema_dry_run_row_evidence') and pg_temp.s09d_no_direct_grants('cms_schema_dry_run_row_evidence'),
  'row evidence has forced RLS and no browser or service-role table grant [P2-S09-AC-675]');
select ok((select r.row_error_count = (select count(*) from platform_private.cms_schema_dry_run_row_evidence e where e.report_id = r.id and e.error_code is not null)
      and r.row_error_count >= 1
    from platform_private.cms_schema_dry_run_reports r where r.id = pg_temp.s09d_id('sd:dryRun')),
  'row_error_count equals the number of evidence rows whose error_code is not NULL [P2-S09-AC-676]');
select ok(not exists (select 1 from platform_private.cms_schema_dry_run_row_evidence e
      join platform_private.outbox_events o on (o.event_type like 'cms.schema.%' or o.event_type like 'job.%' or o.aggregate_type in ('job', 'cms_schema_dry_run', 'cms_schema_migration_plan'))
        and (o.payload::text like '%' || e.source_row_id::text || '%' or o.payload::text like '%' || e.source_hash || '%'))
  and not exists (select 1 from platform_private.cms_schema_dry_run_row_evidence e
      join audit_private.audit_events a on row_to_json(a)::text like '%' || e.source_row_id::text || '%' or row_to_json(a)::text like '%' || e.source_hash || '%')
  and not exists (select 1 from platform_private.cms_schema_dry_run_row_evidence e
      join platform_private.jobs j on row_to_json(j)::text like '%' || e.source_row_id::text || '%' or row_to_json(j)::text like '%' || e.source_hash || '%')
  and position((select source_row_id::text from platform_private.cms_schema_dry_run_row_evidence where id = (select pass_id from s09e_evidence)) in pg_temp.s09d_resp('sd:dryRun')::text) = 0
  and position((select source_row_id::text from platform_private.cms_schema_dry_run_row_evidence where id = (select pass_id from s09e_evidence)) in pg_temp.s09d_get_pr('sd')::text) = 0,
  'no resource, response, event, audit row or job carries row evidence (source row ids or hashes) [P2-S09-AC-676]');

-- =================================== cms_schema_migration_plans (677) ====
select is(pg_temp.s09e_unique_idx('cms_schema_migration_plans', pg_temp.s09d_id('sd:plan'), 'cms_schema_migration_plans_one_live_per_pair_unique',
    jsonb_build_object('superseded_at', now()::text)), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'a second live plan of one (from, to) version pair collides on the partial unique index; a superseded earlier attempt''s plan does not [P2-S09-AC-677]');
select is(pg_temp.s09e_unique_idx('cms_schema_migration_plans', pg_temp.s09d_id('k:plan'), 'cms_schema_migration_plans_one_live_per_pair_unique',
    jsonb_build_object('superseded_at', now()::text)), 'dup:REJECTED:23505|ctl:ACCEPTED',
  'the same holds for a first version, whose NULL from_version_id is coalesced so it cannot escape the uniqueness [P2-S09-AC-677]');
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private' and tablename = 'cms_schema_migration_plans'
    and indexname = 'cms_schema_migration_plans_one_live_per_pair_unique' and indexdef ilike 'create unique index%'
    and indexdef ilike '%to_version_id%' and indexdef ilike '%where (superseded_at is null)%'),
  'the partial unique index covers the version pair and is live only while superseded_at IS NULL, so earlier attempts'' plans are retained [P2-S09-AC-677]');
select ok(not exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_schema_migration_plans'::regclass and contype = 'u'),
  'plan identity is the id alone: no unconditional UNIQUE over the version pair blocks retained attempts [P2-S09-AC-677]');

-- ============================ cms_content_type_versions locale columns (1199-1202) ====
select col_type_is('platform_private', 'cms_content_type_versions', 'source_locale', 'text', 'source_locale is a text column [P2-S09-AC-1199]');
select col_type_is('platform_private', 'cms_content_type_versions', 'default_locale', 'text', 'default_locale is a text column [P2-S09-AC-1199]');
select col_not_null('platform_private', 'cms_content_type_versions', 'source_locale', 'source_locale is declared NOT NULL in the catalog [P2-S09-AC-1199]');
select col_not_null('platform_private', 'cms_content_type_versions', 'default_locale', 'default_locale is declared NOT NULL in the catalog [P2-S09-AC-1199]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'source_locale', (select pg_temp.s09d_id('a:version')), '{"source_locale":null}'),
  'control:ACCEPTED|override:REJECTED:23502:source_locale', 'source_locale is NOT NULL [P2-S09-AC-1199]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'default_locale', (select pg_temp.s09d_id('a:version')), '{"default_locale":null}'),
  'control:ACCEPTED|override:REJECTED:23502:default_locale', 'default_locale is NOT NULL [P2-S09-AC-1199]');
select is(pg_temp.s09e_check('cms_content_type_versions', c.name, (select pg_temp.s09d_id('a:version')), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_content_type_versions CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-1199]')
from (values
  ('cms_content_type_versions_source_locale_check', '{"source_locale":"e"}'::jsonb),
  ('cms_content_type_versions_source_locale_check', '{"source_locale":"en_US"}'::jsonb),
  ('cms_content_type_versions_default_locale_check', '{"default_locale":"1en"}'::jsonb),
  ('cms_content_type_versions_default_locale_check', '{"default_locale":"en US"}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_source_locale_check', (select pg_temp.s09d_id('a:version')),
    '{"source_locale":"zh-Hans-CN"}'), 'control:ACCEPTED|override:ACCEPTED', 'a BCP 47 shaped source_locale is accepted [P2-S09-AC-1199]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'supported_locales', (select pg_temp.s09d_id('a:version')), '{"supported_locales":null}'),
  'control:ACCEPTED|override:REJECTED:23502:supported_locales', 'supported_locales is NOT NULL [P2-S09-AC-1200]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_supported_locales_check', (select pg_temp.s09d_id('a:version')), c.over),
  'control:ACCEPTED|override:REJECTED:23514:cms_content_type_versions_supported_locales_check',
  'supported_locales ' || c.over::text || ' is rejected [P2-S09-AC-1200]')
from (values ('{"supported_locales":[]}'::jsonb), ('{"supported_locales":"en-US"}'::jsonb), ('{"supported_locales":{"en-US":true}}'::jsonb),
  ('{"supported_locales":["fr-FR"]}'::jsonb),
  (jsonb_build_object('supported_locales', (select jsonb_agg('en-US'::text) || (select jsonb_agg('l' || lpad(g::text, 2, '0')) from generate_series(1, 32) g) from (select 1) t)))) as c(over);
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_supported_locales_check', (select pg_temp.s09d_id('a:version')),
    (select jsonb_build_object('supported_locales', jsonb_build_array('en-US') || (select jsonb_agg('l' || lpad(g::text, 2, '0')) from generate_series(1, 31) g)))),
  'control:ACCEPTED|override:ACCEPTED', 'supported_locales of exactly 32 entries containing the source and default locale is accepted [P2-S09-AC-1200]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'fallback_chains', (select pg_temp.s09d_id('a:version')), '{"fallback_chains":null}'),
  'control:ACCEPTED|override:REJECTED:23502:fallback_chains', 'fallback_chains is NOT NULL [P2-S09-AC-1201]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_fallback_chains_check', (select pg_temp.s09d_id('a:version')), c.over),
  'control:ACCEPTED|override:REJECTED:23514:cms_content_type_versions_fallback_chains_check',
  'fallback_chains ' || c.over::text || ' is rejected [P2-S09-AC-1201]')
from (values ('{"fallback_chains":[]}'::jsonb), ('{"fallback_chains":"x"}'::jsonb), ('{"fallback_chains":["en-US"]}'::jsonb)) as c(over);
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_fallback_chains_check', (select pg_temp.s09d_id('a:version')),
    '{"fallback_chains":{"fr-FR":["en-US"]}}'), 'control:ACCEPTED|override:ACCEPTED', 'a fallback_chains object is accepted at the column CHECK [P2-S09-AC-1201]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'locale_config_hash', (select pg_temp.s09d_id('a:version')), '{"locale_config_hash":null}'),
  'control:ACCEPTED|override:REJECTED:23502:locale_config_hash', 'locale_config_hash is NOT NULL [P2-S09-AC-1202]');
select is(pg_temp.s09e_check('cms_content_type_versions', 'cms_content_type_versions_locale_config_hash_check', (select pg_temp.s09d_id('a:version')), c.over),
  'control:ACCEPTED|override:REJECTED:23514:cms_content_type_versions_locale_config_hash_check',
  'locale_config_hash ' || c.over::text || ' is rejected [P2-S09-AC-1202]')
from (values (jsonb_build_object('locale_config_hash', repeat('A', 64))), (jsonb_build_object('locale_config_hash', repeat('g', 64))),
  (jsonb_build_object('locale_config_hash', repeat('a', 63)))) as c(over);
select is(pg_temp.s09d_scalar('select format_type(a.atttypid, a.atttypmod) from pg_attribute a where a.attrelid = ''platform_private.cms_content_type_versions''::regclass and a.attname = ''locale_config_hash'''),
  'character(64)', 'locale_config_hash is char(64) [P2-S09-AC-1202]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'locale_config_hash', (select review_done from s09e_ids), '{"locale_config_hash":null}'),
  'control:ACCEPTED|override:REJECTED:23502:locale_config_hash', 'cms_schema_reviews.locale_config_hash is NOT NULL [P2-S09-AC-1204]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_locale_config_hash_check', (select review_done from s09e_ids),
    jsonb_build_object('locale_config_hash', repeat('A', 64))), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_reviews_locale_config_hash_check',
  'cms_schema_reviews.locale_config_hash must be lowercase 64-hex [P2-S09-AC-1204]');
select ok((select review.locale_config_hash = version.locale_config_hash
    from platform_private.cms_schema_reviews review join platform_private.cms_content_type_versions version on version.id = review.content_type_version_id
    where review.id = (select review_done from s09e_ids)),
  'the review''s frozen locale_config_hash equals the candidate version''s value [P2-S09-AC-1204]');


-- ===================== foreign keys of this file's tables (AC215 part) ====
create temp table s09e_fk_results on commit drop as
select t as table_name,
       pg_temp.s09e_fk_probe('platform_private', t, null::jsonb) as outcome,
       (select count(*)::integer from pg_constraint con where con.conrelid = format('platform_private.%I', t)::regclass and con.contype = 'f') as fk_count
from unnest(array[
  'cms_field_definition_versions',
  'cms_relation_definitions',
  'cms_schema_migration_plans',
  'cms_schema_dry_run_reports',
  'cms_schema_dry_run_row_evidence']) t;
select diag(table_name || ' => ' || outcome) from s09e_fk_results where outcome not like 'probed=%;bad=' order by 1;
select ok(outcome = 'probed=' || fk_count || ';bad=',
  table_name || ': all ' || fk_count || ' foreign keys reject a dangling reference (' || outcome || ') [P2-S09-AC-215]')
from s09e_fk_results where outcome <> 'EMPTY' order by table_name;
select is((select count(*)::integer from s09e_fk_results where outcome = 'EMPTY'), 0,
  'every probed table held a real producer row, so no foreign key was skipped [P2-S09-AC-215]');

select * from finish();
rollback;
