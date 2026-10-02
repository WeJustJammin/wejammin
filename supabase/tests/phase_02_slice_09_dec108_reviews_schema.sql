commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED (BE03a "Persistence", "Database invariants and
-- grants", "State machine and concurrency"): the three private CMS-owned review
-- records, the dry-run attempt/plan reshaping and the per-row evidence table.
-- The catalog assertions run before the migration and never assume a relation
-- exists, so an absent migration is an evidence-backed RED.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select has_table('platform_private', t, 'DEC-108 private table ' || t || ' exists')
from unnest(array['cms_schema_reviews', 'cms_schema_review_decisions',
  'cms_schema_review_assignments', 'cms_schema_dry_run_row_evidence']) t;
select ok(pg_temp.s09d_rls(t), t || ' has ENABLE and FORCE row level security')
from unnest(array['cms_schema_reviews', 'cms_schema_review_decisions',
  'cms_schema_review_assignments', 'cms_schema_dry_run_row_evidence']) t;
select ok(pg_temp.s09d_no_direct_grants(t),
  t || ' revokes every direct anon/authenticated/service_role table privilege')
from unnest(array['cms_schema_reviews', 'cms_schema_review_decisions',
  'cms_schema_review_assignments', 'cms_schema_dry_run_row_evidence']) t;
select ok(pg_temp.s09d_trigger_count(t) > 0, t || ' carries write-guard triggers')
from unnest(array['cms_schema_reviews', 'cms_schema_review_decisions',
  'cms_schema_review_assignments', 'cms_schema_dry_run_row_evidence']) t;

-- Typed columns (the IA envelope plus the BE03a field tables).
select ok(pg_temp.s09d_has_columns('cms_schema_reviews', array[
  'id','owner_id','state','version','created_at','updated_at','content_type_id',
  'content_type_version_id','candidate_version_no','definition_hash','schema_artifact_id',
  'compiler_version','dependency_manifest_hash','dry_run_id','dry_run_report_hash',
  'policy_key','policy_version','policy_hash','risk_class','required_decision_count',
  'required_capabilities','context_hash','submitter_person_ref','submitted_at',
  'decided_at','approval_evidence_hash']), 'cms_schema_reviews carries every BE03a column');
select ok(pg_temp.s09d_has_columns('cms_schema_review_decisions', array[
  'id','owner_id','version','created_at','updated_at','review_id','assignment_id',
  'assignment_version','reviewer_person_ref','binding_context_hash','capability_key',
  'capability_version','decision','decided_at','reviewed_hash','mfa_verified_at']),
  'cms_schema_review_decisions carries the full IA envelope, assignment and MFA evidence');
select ok(pg_temp.s09d_has_columns('cms_schema_review_assignments', array[
  'id','owner_id','review_id','reviewer_person_ref','grantor_person_ref','capability_key',
  'actions','state','starts_at','ends_at','reason','created_at','updated_at','version']),
  'cms_schema_review_assignments carries every BE03a column');
select ok(pg_temp.s09d_has_columns('cms_schema_dry_run_reports', array[
  'attempt_no','state','job_id','plan_id','failure_code','sealed_at']),
  'dry-run reports carry typed attempt, state, job, plan, failure and seal columns (G3)');
select ok(pg_temp.s09d_has_columns('cms_schema_dry_run_row_evidence', array[
  'id','report_id','plan_id','source_table','source_row_id','source_hash','output_hash',
  'error_code','recorded_at']), 'per-row scan evidence is typed (G4)');
select ok(pg_temp.s09d_has_columns('cms_schema_migration_plans', array['superseded_at']),
  'migration plans can retain a superseded earlier attempt (G2)');

-- Constraints and indexes.
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private'
    and tablename = 'cms_schema_reviews' and indexdef ilike '%unique%'
    and indexdef ilike '%content_type_version_id%definition_hash%dry_run_id%'
    and indexdef ilike '%where%open%'),
  'one live review per exact frozen candidate/evidence is a partial unique index');
select ok(pg_temp.s09d_constraint_has('cms_schema_review_decisions', 'UNIQUE (review_id, reviewer_person_ref)'),
  'a human records at most one decision per review');
select ok(pg_temp.s09d_constraint_has('cms_schema_review_assignments', '7 days')
  and pg_temp.s09d_constraint_has('cms_schema_review_assignments', 'ends_at > starts_at'),
  'assignment authority is finite and at most seven days');
select ok(pg_temp.s09d_constraint_has('cms_schema_review_assignments', 'read')
  and pg_temp.s09d_constraint_has('cms_schema_review_assignments', 'decide')
  and pg_temp.s09d_constraint_has('cms_schema_review_assignments', 'cms.schema_review'),
  'assignments carry only the fixed cms.schema_review capability and read+decide actions');
select ok(pg_temp.s09d_constraint_has('cms_schema_reviews', 'invalidated')
  and pg_temp.s09d_constraint_has('cms_schema_reviews', 'protected')
  and pg_temp.s09d_constraint_has('cms_schema_reviews', 'required_decision_count'),
  'reviews close state, risk class and the 1..8 decision count');
select ok(pg_temp.s09d_constraint_has('cms_schema_review_decisions', 'cms.schema_review')
  and pg_temp.s09d_constraint_has('cms_schema_review_decisions', 'approve'),
  'decisions close the capability key and the approve/reject vocabulary');
select ok(pg_temp.s09d_constraint_has('cms_schema_dry_run_reports', 'queued'),
  'dry-run attempts admit the unsealed queued state (not only a passed report)');
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private'
    and tablename = 'cms_schema_migration_plans' and indexdef ilike '%unique%'
    and indexdef ilike '%from_version_id%to_version_id%' and indexdef ilike '%superseded_at is null%'),
  'at most one live plan per version pair, enforced by a partial unique index (G2)');
select ok(not exists (select 1 from pg_index i
    where i.indrelid = to_regclass('platform_private.cms_schema_migration_plans')
      and i.indisunique and i.indpred is null
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
           where a.attrelid = i.indrelid and a.attnum = any(i.indkey))
          = array['from_version_id','to_version_id']),
  'the unconditional UNIQUE(from_version_id,to_version_id) that blocks retained attempts is gone');

-- Immutability over rows produced by the real producer chain only.
select pg_temp.s09d_create_type('a', 'dec108schema');
select pg_temp.s09d_to_approved('a');
select set_config('app.cms_rpc', 'true', true);
select is(pg_temp.s09d_outcome('a:decide:rev1'), 'OK',
  'schema fixture: the review was approved through the real producers');

select throws_ok(format('update platform_private.cms_schema_reviews set %s where id = %L',
    c, pg_temp.s09d_id('a:review')), 'P0001', 'IMMUTABLE_RECORD',
  'review frozen field is immutable: ' || c)
from unnest(array['definition_hash = repeat(''0'', 64)', 'context_hash = repeat(''0'', 64)',
  'submitter_person_ref = extensions.gen_random_uuid()',
  'submitted_at = submitted_at - interval ''1 hour''',
  'dry_run_report_hash = repeat(''0'', 64)', 'policy_hash = repeat(''0'', 64)']) c;
select throws_ok(format('update platform_private.cms_schema_reviews set state = ''open'' where id = %L',
    pg_temp.s09d_id('a:review')), 'P0001', null,
  'a decided review never reopens (open -> approved|rejected|invalidated only)');
select throws_ok(format('delete from platform_private.cms_schema_reviews where id = %L',
    pg_temp.s09d_id('a:review')), 'P0001', 'IMMUTABLE_RECORD', 'a review cannot be deleted');
select throws_ok(format('update platform_private.cms_schema_review_decisions set decision = ''reject'' where id = %L',
    pg_temp.s09d_id('a:decision:rev1')), 'P0001', 'IMMUTABLE_RECORD',
  'decisions are append-only: UPDATE is rejected');
select throws_ok(format('delete from platform_private.cms_schema_review_decisions where id = %L',
    pg_temp.s09d_id('a:decision:rev1')), 'P0001', 'IMMUTABLE_RECORD',
  'decisions are append-only: DELETE is rejected');
select throws_ok(format('update platform_private.cms_schema_review_assignments set reviewer_person_ref = extensions.gen_random_uuid() where id = %L',
    pg_temp.s09d_id('a:assignment:rev1')), 'P0001', 'IMMUTABLE_RECORD',
  'an assignment can never be repointed at another human');
select throws_ok(format('delete from platform_private.cms_schema_review_assignments where id = %L',
    pg_temp.s09d_id('a:assignment:rev1')), 'P0001', 'IMMUTABLE_RECORD',
  'assignments are revoked by state, never deleted');
select throws_ok(format('update platform_private.cms_schema_dry_run_reports set result = ''failed'' where id = %L',
    pg_temp.s09d_id('a:dryRun')), 'P0001', 'IMMUTABLE_RECORD',
  'a sealed (completed) dry-run report rejects every UPDATE');
select throws_ok(format('delete from platform_private.cms_schema_dry_run_reports where id = %L',
    pg_temp.s09d_id('a:dryRun')), 'P0001', 'IMMUTABLE_RECORD',
  'a dry-run report is never deleted');

select * from finish();
rollback;
