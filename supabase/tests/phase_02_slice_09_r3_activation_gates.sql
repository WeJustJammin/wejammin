\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 audit remediation (R3): the activation gate assertions the audit
-- found missing.  Every candidate is produced through the named producers
-- (create, dry run, worker seal, submit, assign, decide).  A "tamper" probe is
-- an explicitly labelled negative-control forgery: it changes stored state
-- inside a sub-transaction that is rolled back, calls the real activation RPC
-- and records the exact refusal; the untampered control activation at the end
-- of each section proves the candidate was activatable all along.
--   AC087 sealed report members + immutability   AC678 provisional fingerprint
--   AC096 exact evidence verification            AC099 activation creates no plan
--   AC095 reference recheck wired into activation
--   AC102 compiler/dependency drift invalidates   AC366 submit refusals
--   AC641 dryRunRef failureCode projection

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- Runs a statement INSIDE the RPC context (the immutability guards are what is probed, so the
-- write gate itself must already be satisfied, as a hostile writer would satisfy it) and returns
-- its error message; the flag is released afterwards (a failed statement rolls it back).
create or replace function pg_temp.r3_err(p_sql text) returns text language plpgsql as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  execute p_sql;
  perform set_config('app.cms_rpc', '', true);
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
create or replace function pg_temp.r3_tables(p_tables text[], p_state text) returns void language plpgsql as $body$
declare t text;
begin
  set constraints all immediate;
  foreach t in array p_tables loop
    execute format('alter table platform_private.%I %s trigger user', t, p_state);
  end loop;
  set constraints all deferred;
end;
$body$;
-- Tamper stored state, call the real activation RPC, record the outcome, roll the tamper back.
create or replace function pg_temp.r3_tamper_activate(
  p_label text, p_tag text, p_tamper text, p_tables text[], p_enable_before_call boolean default true
) returns void language plpgsql as $body$
declare out_state text; out_msg text;
begin
  begin
    perform pg_temp.r3_tables(p_tables, 'disable');
    execute p_tamper;
    if p_enable_before_call then
      perform pg_temp.r3_tables(p_tables, 'enable');
    end if;
    perform pg_temp.s09d_activate(p_tag, 'owner', '{}'::jsonb, p_label);
    select state, message into out_state, out_msg from s09d_probe where label = p_label;
    raise exception 'R3_ROLLBACK';
  exception when others then
    if sqlerrm <> 'R3_ROLLBACK' then raise; end if;
  end;
  insert into s09d_probe values (p_label, out_state, out_msg, null, null)
  on conflict (label) do update set state = excluded.state, message = excluded.message;
end;
$body$;
create or replace function pg_temp.r3_plans() returns bigint language sql stable as $body$
  select count(*) from platform_private.cms_schema_migration_plans $body$;

-- ===================================================== AC678 + AC087 ===========
select pg_temp.s09d_create_type('a', 'r3gate_a');
select pg_temp.s09d_dry_run('a');
select is(pg_temp.s09d_outcome('a:dryRun'), 'OK', 'fixture: CMS-03A-10 accepted the dry run');
select ok((select p.dry_run_report is not null from platform_private.cms_schema_migration_plans p
            where p.id = pg_temp.s09d_id('a:plan')),
  'a plan created by CMS-03A-10 has a NOT NULL dry_run_report from creation [P2-S09-AC-678]');
select is((select array_agg(k order by k) from platform_private.cms_schema_migration_plans p,
            jsonb_object_keys(p.dry_run_report) k where p.id = pg_temp.s09d_id('a:plan')),
  array['compilerHash','compilerVersion','dryRunId','failedCount','migratedCount','result','rowErrorCount',
        'sourceCount','sourceHash','targetCount','targetHash','transformHash'],
  'the provisional fingerprint carries exactly the dry-run id, source/target/compiler/transform hashes, the compiler version and the counters (the lease is added at the first worker lease) [P2-S09-AC-678]');
select ok((select p.dry_run_report->>'dryRunId' = pg_temp.s09d_id('a:dryRun')::text
             and p.dry_run_report->>'sourceCount' = '0' and p.dry_run_report->>'targetCount' = '0'
             and p.dry_run_report->>'rowErrorCount' = '0' and p.dry_run_report->>'migratedCount' = '0'
             and p.dry_run_report->>'failedCount' = '0'
             and p.dry_run_report->>'sourceHash' ~ '^[a-f0-9]{64}$' and p.dry_run_report->>'targetHash' ~ '^[a-f0-9]{64}$'
             and p.dry_run_report->>'compilerHash' ~ '^[a-f0-9]{64}$' and p.dry_run_report->>'transformHash' ~ '^[a-f0-9]{64}$'
             from platform_private.cms_schema_migration_plans p where p.id = pg_temp.s09d_id('a:plan')),
  'the fingerprint names the attempt id, zero counters and four 64-hex hashes [P2-S09-AC-678]');
select ok((select p.dry_run_report->>'targetHash' = v.definition_hash and p.dry_run_report->>'sourceHash' = repeat('0', 64)
             from platform_private.cms_schema_migration_plans p
             join platform_private.cms_content_type_versions v on v.id = p.to_version_id
            where p.id = pg_temp.s09d_id('a:plan')),
  'the fingerprint hashes bind the candidate definition (target) and the empty source of a first version [P2-S09-AC-678]');
select ok((select r.state = 'queued' and r.result is null and r.report is null and r.source_hash is null and r.sealed_at is null
             from platform_private.cms_schema_dry_run_reports r where r.id = pg_temp.s09d_id('a:dryRun')),
  'the fingerprint is not a result: the sealed report row carries no result, report or hashes until sealing [P2-S09-AC-678]');
select pg_temp.s09d_seal('a');
select ok((select r.state = 'completed' and r.result = 'pass' and r.sealed_at is not null
             and r.compiler_version is not null and r.compiler_version = a.compiler_version
             and r.source_count = 0 and r.target_count = 0 and r.row_error_count = 0
             and r.source_hash ~ '^[a-f0-9]{64}$' and r.target_hash ~ '^[a-f0-9]{64}$' and r.compiler_hash ~ '^[a-f0-9]{64}$'
             from platform_private.cms_schema_dry_run_reports r
             join platform_private.cms_content_type_versions v on v.id = r.target_version_id
             join platform_private.cms_schema_artifacts a on a.id = v.schema_artifact_id
            where r.id = pg_temp.s09d_id('a:dryRun')),
  'the sealed report carries the compiler version equal to the candidate artifact compiler version, counts, three hashes and result [P2-S09-AC-087]');
select is((select compiler_hash from platform_private.cms_schema_dry_run_reports where id = pg_temp.s09d_id('a:dryRun')),
          (select a.artifact_hash from platform_private.cms_content_type_versions v
             join platform_private.cms_schema_artifacts a on a.id = v.schema_artifact_id where v.id = pg_temp.s09d_id('a:version')),
  'the sealed compiler hash is the immutable schema artifact hash [P2-S09-AC-087]');
select ok((select p.dry_run_report->>'result' = 'pass' and r.state = 'completed' and r.report->>'dryRunId' = r.id::text
             from platform_private.cms_schema_migration_plans p
             join platform_private.cms_schema_dry_run_reports r on r.plan_id = p.id
            where p.id = pg_temp.s09d_id('a:plan')),
  'after sealing, the sealed report row remains the result authority and the plan fingerprint is unchanged in shape [P2-S09-AC-678]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.r3_err(format($$update platform_private.cms_schema_dry_run_reports set compiler_version = '9', version = version + 1 where id = %L$$, pg_temp.s09d_id('a:dryRun'))),
  'IMMUTABLE_RECORD', 'an UPDATE of compiler_version on a sealed report raises IMMUTABLE_RECORD [P2-S09-AC-087]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.r3_err(format($$update platform_private.cms_schema_dry_run_reports set source_count = 5, version = version + 1 where id = %L$$, pg_temp.s09d_id('a:dryRun'))),
  'IMMUTABLE_RECORD', 'an UPDATE of the counts on a sealed report raises IMMUTABLE_RECORD [P2-S09-AC-087]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.r3_err(format($$update platform_private.cms_schema_dry_run_reports set target_hash = repeat('e', 64), version = version + 1 where id = %L$$, pg_temp.s09d_id('a:dryRun'))),
  'IMMUTABLE_RECORD', 'an UPDATE of the hashes on a sealed report raises IMMUTABLE_RECORD [P2-S09-AC-087]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.r3_err(format($$update platform_private.cms_schema_dry_run_reports set result = 'fail', version = version + 1 where id = %L$$, pg_temp.s09d_id('a:dryRun'))),
  'IMMUTABLE_RECORD', 'an UPDATE of the result on a sealed report raises IMMUTABLE_RECORD [P2-S09-AC-087]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select is(pg_temp.r3_err(format($$delete from platform_private.cms_schema_dry_run_reports where id = %L$$, pg_temp.s09d_id('a:dryRun'))),
  'IMMUTABLE_RECORD', 'a sealed report cannot be deleted [P2-S09-AC-087]');

-- ===================================================== AC096 + AC099 ===========
select pg_temp.s09d_create_type('b', 'r3gate_b');
select pg_temp.s09d_to_approved('b');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('b:review')), 'approved', 'fixture: candidate b is approved through the real chain');
select r3_plans_before from (select pg_temp.r3_plans() as r3_plans_before) s \gset
select pg_temp.r3_tamper_activate('b:counts', 'b', format($$update platform_private.cms_schema_migration_plans
   set dry_run_report = dry_run_report || '{"sourceCount":"7","targetCount":"7"}'::jsonb where id = %L$$, pg_temp.s09d_id('b:plan')),
  array['cms_schema_migration_plans']);
select is(pg_temp.s09d_outcome('b:counts'), 'VALIDATION_FAILED',
  'activation refuses a plan whose recorded counts differ from the sealed report with exactly VALIDATION_FAILED [P2-S09-AC-096]');
select pg_temp.r3_tamper_activate('b:hashes', 'b', format($$update platform_private.cms_schema_migration_plans
   set dry_run_report = dry_run_report || jsonb_build_object('sourceHash', repeat('1', 64), 'targetHash', repeat('2', 64)) where id = %L$$, pg_temp.s09d_id('b:plan')),
  array['cms_schema_migration_plans']);
select is(pg_temp.s09d_outcome('b:hashes'), 'VALIDATION_FAILED',
  'activation refuses a plan whose recorded source/target hashes differ from the candidates with exactly VALIDATION_FAILED [P2-S09-AC-096]');
select pg_temp.r3_tamper_activate('b:compiler', 'b', format($$update platform_private.cms_schema_migration_plans
   set dry_run_report = dry_run_report || '{"compilerVersion":"9"}'::jsonb where id = %L$$, pg_temp.s09d_id('b:plan')),
  array['cms_schema_migration_plans']);
select is(pg_temp.s09d_outcome('b:compiler'), 'VALIDATION_FAILED',
  'activation refuses a compiler version that is not the immutable artifact compiler version with exactly VALIDATION_FAILED [P2-S09-AC-096]');
select pg_temp.r3_tamper_activate('b:artifact', 'b', format($$update platform_private.cms_schema_artifacts
   set artifact_hash = repeat('f', 64) where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L)$$, pg_temp.s09d_id('b:version')),
  array['cms_schema_artifacts']);
select is(pg_temp.s09d_outcome('b:artifact'), 'VALIDATION_FAILED',
  'activation refuses a SchemaArtifact that is not the candidates immutable artifact with exactly VALIDATION_FAILED [P2-S09-AC-096]');
select pg_temp.r3_tamper_activate('b:rowerrors', 'b', format($$update platform_private.cms_schema_migration_plans
   set dry_run_report = dry_run_report || '{"result":"fail"}'::jsonb where id = %L$$, pg_temp.s09d_id('b:plan')),
  array['cms_schema_migration_plans']);
select is(pg_temp.s09d_outcome('b:rowerrors'), 'VALIDATION_FAILED',
  'activation refuses a plan whose recorded result is not the sealed pass with exactly VALIDATION_FAILED [P2-S09-AC-096]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('b:version')), 'approved',
  'every refused activation left the candidate approved and unswitched [P2-S09-AC-096]');
select is(pg_temp.r3_plans(), (:r3_plans_before)::bigint,
  'no refused activation created or removed a migration plan [P2-S09-AC-099]');
select pg_temp.s09d_activate('b');
select is(pg_temp.s09d_outcome('b:activate'), 'OK', 'control: the untampered candidate activates (every probe above fails only because of its tamper) [P2-S09-AC-096]');
select is(pg_temp.r3_plans(), (:r3_plans_before)::bigint,
  'a successful activation advances the plan CMS-03A-10 created and creates none: the plan count is unchanged [P2-S09-AC-099]');
select is((select count(*) from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('b:plan') and state = 'completed'),
  1::bigint, 'the CMS-03A-10 plan bound to the dry run is the one that advanced [P2-S09-AC-099]');
select pg_temp.s09d_create_type('b2', 'r3gate_b2');
select pg_temp.s09d_to_approved('b2');
select r3_plans_before2 from (select pg_temp.r3_plans() as r3_plans_before2) s \gset
select pg_temp.s09d_activate('b2', 'owner', '{}'::jsonb, 'b2:wrongplan', jsonb_build_object('migrationPlanId', extensions.gen_random_uuid()));
select is(pg_temp.s09d_outcome('b2:wrongplan'), 'VALIDATION_FAILED', 'a plan id that is not the one CMS-03A-10 bound to the dry run is refused with VALIDATION_FAILED [P2-S09-AC-099]');
select is(pg_temp.r3_plans(), (:r3_plans_before2)::bigint, 'the refused activation created no plan [P2-S09-AC-099]');

-- ============================================================== AC095 ==========
-- A successor with a relation field, approved while the previous version is
-- active.  Each probe drifts ONE kind of reference after approval and expects
-- the exact refusal, the previous version still active and the candidate unswitched.
select pg_temp.s09d_create_type('c', 'r3gate_c');
select pg_temp.s09d_add_relation('c');
select pg_temp.s09d_to_active('c');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('c:version')), 'active', 'fixture: the previous version is active');
select pg_temp.s09d_successor('c2', 'c');
select pg_temp.s09d_to_approved('c2');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('c2:review')), 'approved', 'fixture: the successor is approved through the real chain');
create temp table r3_probes(label text primary key, kind text, tamper text, tbls text[]) on commit drop;
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
insert into r3_probes values
 ('c2:field', 'a persisted field that no longer matches the artifact manifest',
  format($$update platform_private.cms_field_definition_versions
   set constraints = '{"maxLength": 99}'::jsonb where content_type_version_id = %L and field_key = 'title'$$, pg_temp.s09d_id('c2:version')),
  array['cms_field_definition_versions']),
 ('c2:relation', 'an unresolved relation projection (allowlist drift)',
  format($$update platform_private.cms_relation_definitions set projection_key = 'profile.unregistered'
 where field_definition_id in (select id from platform_private.cms_field_definition_versions where content_type_version_id = %L)$$, pg_temp.s09d_id('c2:version')),
  array['cms_relation_definitions']),
 ('c2:block', 'an unregistered block reference',
  format($$update platform_private.cms_schema_artifacts
   set renderer_manifest = renderer_manifest || '{"blocks":[{"blockKey":"r3.no_such_block","version":"1"}]}'::jsonb
 where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L)$$, pg_temp.s09d_id('c2:version')),
  array['cms_schema_artifacts']),
 ('c2:renderer', 'an unregistered renderer reference (allowlist)',
  format($$update platform_private.cms_schema_artifacts
   set renderer_manifest = renderer_manifest || '{"rendererRefs":["r3.no_such_renderer"]}'::jsonb
 where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L)$$, pg_temp.s09d_id('c2:version')),
  array['cms_schema_artifacts']),
 ('c2:extra', 'a template binding in the manifest that is not persisted',
  format($$update platform_private.cms_schema_artifacts
   set renderer_manifest = renderer_manifest || jsonb_build_object('templateBindings', jsonb_build_array(jsonb_build_object('templateVersionId', extensions.gen_random_uuid())))
 where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = %L)$$, pg_temp.s09d_id('c2:version')),
  array['cms_schema_artifacts']);
select pg_temp.r3_tamper_activate(label, 'c2', tamper, tbls) from r3_probes;
select is(pg_temp.s09d_outcome(label), 'VALIDATION_FAILED',
  kind || ' refuses activation with exactly VALIDATION_FAILED [P2-S09-AC-095]')
from r3_probes order by label;
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('c:version')), 'active',
  'the previously active version is still active after every refused activation [P2-S09-AC-095]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('c2:version')), 'approved',
  'the candidate is still approved and unswitched [P2-S09-AC-095]');
-- Wiring proof: the very same probes pass activation when the reference recheck
-- is removed from cms_activate_schema, so they can fail only because of that call.
create or replace function pg_temp.r3_mutated_activation(p_label text, p_tag text, p_tamper text, p_tables text[]) returns void
language plpgsql as $body$
declare
  def text := pg_get_functiondef('platform_private.cms_activate_schema(jsonb)'::regprocedure);
  mutated text;
  out_state text; out_msg text;
begin
  mutated := regexp_replace(def,
    'if not platform_private\.cms_activation_references_valid\(candidate\.id\) then\s+raise exception ''VALIDATION_FAILED'' using errcode = ''P0001'';\s+end if;',
    '', 'n');
  if mutated = def then
    raise exception 'R3_MUTATION_NOT_APPLIED';
  end if;
  begin
    execute mutated;
    perform pg_temp.r3_tables(p_tables, 'disable');
    execute p_tamper;
    perform pg_temp.r3_tables(p_tables, 'enable');
    perform pg_temp.s09d_activate(p_tag, 'owner', '{}'::jsonb, p_label);
    select state, message into out_state, out_msg from s09d_probe where label = p_label;
    raise exception 'R3_ROLLBACK';
  exception when others then
    if sqlerrm <> 'R3_ROLLBACK' then raise; end if;
  end;
  insert into s09d_probe values (p_label, out_state, out_msg, null, null)
  on conflict (label) do update set state = excluded.state, message = excluded.message;
end;
$body$;
select pg_temp.r3_mutated_activation(label || ':mutated', 'c2', tamper, tbls) from r3_probes;
select is(pg_temp.s09d_outcome(label || ':mutated'), 'OK',
  'mutation proof: with the cms_activation_references_valid call deleted from cms_activate_schema, ' || kind || ' activates, so only that call refuses it [P2-S09-AC-095]')
from r3_probes order by label;
select pg_temp.s09d_activate('c2');
select is(pg_temp.s09d_outcome('c2:activate'), 'OK', 'control: the untampered successor activates after the rolled-back probes [P2-S09-AC-095]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('c:version')), 'superseded',
  'and only then is the previous version superseded [P2-S09-AC-095]');

-- ============================================================== AC102 ==========
-- After approval, a change of the compiler version carried by the candidate's
-- artifact, or of a dependency (a relation binding), invalidates the review and
-- its evidence and returns the candidate to draft, so review is forced again.
select pg_temp.s09d_create_type('d', 'r3gate_d');
select pg_temp.s09d_to_approved('d');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('d:review')), 'approved', 'fixture: candidate d is approved');
set constraints all immediate;
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_schema_artifacts disable trigger cms_schema_artifacts_write_guard;
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_schema_artifacts disable trigger cms_schema_artifacts_z_compile_guard;
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
update platform_private.cms_schema_artifacts set compiler_version = '2'
 where id = (select schema_artifact_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('d:version'));
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_schema_artifacts enable trigger cms_schema_artifacts_write_guard;
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
alter table platform_private.cms_schema_artifacts enable trigger cms_schema_artifacts_z_compile_guard;
set constraints all deferred;
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('d:review')), 'invalidated',
  'a compiler version change of the candidate artifact invalidates the approved review [P2-S09-AC-102]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('d:version')), 'draft',
  'and returns the candidate to draft so review is forced again [P2-S09-AC-102]');
select pg_temp.s09d_activate('d');
select is(pg_temp.s09d_outcome('d:activate'), 'CONFLICT',
  'the invalidated candidate cannot activate: exactly 409 CONFLICT [P2-S09-AC-102]');
select is((select count(*)::integer from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('d:review')), 1,
  'the immutable decision history of the invalidated review is preserved [P2-S09-AC-102]');

select pg_temp.s09d_create_type('e', 'r3gate_e');
select pg_temp.s09d_add_relation('e');
select pg_temp.s09d_to_approved('e');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('e:review')), 'approved', 'fixture: candidate e (with a relation dependency) is approved');
-- negative-control drift (no command edits a bound relation's bounds): written under the RPC flag a hostile writer sets itself
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_relation_definitions set max_count = 4
 where field_definition_id in (select id from platform_private.cms_field_definition_versions
                                where content_type_version_id = pg_temp.s09d_id('e:version'));
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('e:review')), 'invalidated',
  'a relation dependency change invalidates the approved review [P2-S09-AC-102]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('e:version')), 'draft',
  'and returns the candidate to draft [P2-S09-AC-102]');
select pg_temp.s09d_activate('e');
select is(pg_temp.s09d_outcome('e:activate'), 'CONFLICT', 'the invalidated candidate cannot activate: exactly 409 CONFLICT [P2-S09-AC-102]');

-- ============================================================== AC366 ==========
-- CMS-03A-11 freezes only a persisted PASSED sealed dry run of the same
-- candidate; BE03a error matrix: CONFLICT for a non-passed dry run or stale
-- evidence, INVALID_REQUEST for a malformed reference.  No review is created.
select pg_temp.s09d_create_type('s', 'r3gate_s');
select pg_temp.s09d_to_active('s');
select pg_temp.s09g_grant('s:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09w_entry('s1', 's', 'Alpha title');
select pg_temp.s09w_entry('s2', 's', 'Beta title with more characters');
select pg_temp.s09d_successor('t', 's');
select pg_temp.s09d_dry_run('t');
select pg_temp.s09w_dry_run('t');
select pg_temp.s09w_tighten('t', 12);
select pg_temp.s09d_dry_run('t', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('t');
select ok((select r.state = 'completed' and r.result = 'fail' and r.row_error_count = 1 and r.id = v.dry_run_id
             from platform_private.cms_schema_dry_run_reports r
             join platform_private.cms_content_type_versions v on v.id = r.target_version_id
            where r.id = pg_temp.s09d_id('t:dryRun')),
  'fixture: the real worker scan sealed a completed dry run whose result is fail');
select pg_temp.s09d_submit('t');
select is(pg_temp.s09d_outcome('t:submit'), 'CONFLICT',
  'a sealed completed dry run whose result is failed is refused with exactly 409 CONFLICT [P2-S09-AC-366]');
select pg_temp.s09d_create_type('u', 'r3gate_u');
select pg_temp.s09d_dry_run('u');
select pg_temp.s09d_submit('u');
select is(pg_temp.s09d_outcome('u:submit'), 'CONFLICT',
  'a queued unsealed dry run is refused with exactly 409 CONFLICT [P2-S09-AC-366]');
select pg_temp.s09d_create_type('v', 'r3gate_v');
select pg_temp.s09d_dry_run('v');
select pg_temp.s09d_seal('v');
select pg_temp.s09d_rpc('v:foreign', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('v:type'), 'versionId', pg_temp.s09d_id('v:version'),
    'expectedVersion', pg_temp.s09d_version('v'), 'dryRunId', pg_temp.s09d_id('b:dryRun'),
    'idempotencyKey', 'r3gate-submit-foreign-0001'), true);
select is(pg_temp.s09d_outcome('v:foreign'), 'CONFLICT',
  'a passed sealed dry run of another candidate is refused with exactly 409 CONFLICT [P2-S09-AC-366]');
select pg_temp.s09d_rpc('v:unknown', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('v:type'), 'versionId', pg_temp.s09d_id('v:version'),
    'expectedVersion', pg_temp.s09d_version('v'), 'dryRunId', extensions.gen_random_uuid(),
    'idempotencyKey', 'r3gate-submit-unknown-0001'), true);
select is(pg_temp.s09d_outcome('v:unknown'), 'CONFLICT',
  'an unknown dry run uuid is refused with exactly 409 CONFLICT, never NOT_FOUND [P2-S09-AC-366]');
select pg_temp.s09d_rpc('v:badformat', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('v:type'), 'versionId', pg_temp.s09d_id('v:version'),
    'expectedVersion', pg_temp.s09d_version('v'), 'dryRunId', 'not-a-uuid',
    'idempotencyKey', 'r3gate-submit-badref-0001'), true);
select is(pg_temp.s09d_outcome('v:badformat'), 'INVALID_REQUEST', 'a dryRunId that is not a uuid is refused with exactly INVALID_REQUEST [P2-S09-AC-366]');
select is((select count(*) from platform_private.cms_schema_reviews
            where content_type_version_id in (pg_temp.s09d_id('t:version'), pg_temp.s09d_id('u:version'), pg_temp.s09d_id('v:version'))),
  0::bigint, 'no refused submission created a review [P2-S09-AC-366]');
select pg_temp.s09d_submit('v');
select is(pg_temp.s09d_outcome('v:submit'), 'OK', 'control: the same candidate with its own passed sealed dry run is frozen [P2-S09-AC-366]');

-- ============================================================== AC641 ==========
-- activationPreparation.dryRunRef.failureCode is the stored failure code of the
-- latest attempt (^[A-Z][A-Z0-9_]{0,63}$), null for every non-failed state.
select pg_temp.s09d_create_type('w', 'r3gate_w');
select pg_temp.s09d_dry_run('w');
select is(pg_temp.s09d_get_pr('w')->'failureCode', 'null'::jsonb, 'a queued attempt projects failureCode null [P2-S09-AC-641]');
select pg_temp.s09d_dry_run('w', 'owner', null, null, 'r3gate-dry-second-0001');
select is(pg_temp.s09d_outcome('w:dryRun'), 'OK', 'fixture: a second CMS-03A-10 attempt supersedes the first');
select is((select failure_code from platform_private.cms_schema_dry_run_reports where target_version_id = pg_temp.s09d_id('w:version') and attempt_no = 1),
  'ATTEMPT_SUPERSEDED', 'the producer writes failure code ATTEMPT_SUPERSEDED on the superseded attempt');
select is(pg_temp.s09d_get_pr('w')->'failureCode', 'null'::jsonb,
  'the latest attempt is queued, so the projection carries null, not the superseded attempt code [P2-S09-AC-641]');
set constraints all immediate;
alter table platform_private.cms_schema_dry_run_reports disable trigger user;
-- NEGATIVE CONTROL: a hand-written review/decision/dry-run/plan row or state change: never a producer path, only proof that the guard sees and refuses it.
update platform_private.cms_schema_dry_run_reports
   set state = 'failed', failure_code = 'WORKER_CRASH_AFTER_COMMIT', version = version + 1
 where id = pg_temp.s09d_id('w:dryRun');
alter table platform_private.cms_schema_dry_run_reports enable trigger user;
set constraints all deferred;
select is(pg_temp.s09d_get_pr('w')->>'failureCode', 'WORKER_CRASH_AFTER_COMMIT',
  'a latest attempt in the unsealed failed state projects its stored failure code exactly (negative-control state) [P2-S09-AC-641]');
select ok((pg_temp.s09d_get_pr('w')->>'failureCode') ~ '^[A-Z][A-Z0-9_]{0,63}$' and pg_temp.s09d_get_pr('w')->>'state' = 'failed'
          and not (pg_temp.s09d_get_pr('w') ? 'sourceCount'),
  'the projected code matches the BE03a pattern and a failed attempt carries none of the six sealed-only members [P2-S09-AC-641]');
select is(pg_temp.s09d_get_pr('v')->'failureCode', 'null'::jsonb, 'a completed passed attempt projects failureCode null [P2-S09-AC-641]');
select ok((pg_temp.s09d_get_pr('v')) ? 'failureCode' and pg_temp.s09d_get_pr('v')->>'state' = 'completed',
  'the member is present (nullable) for a completed sealed attempt [P2-S09-AC-641]');

-- ============================================================== AC359 ==========
-- The BE00 job (queue) enqueue happens inside cms_start_schema_dry_run.  When
-- the queue write fails the call raises and the report, plan, job, idempotency
-- reservation, audit and outbox rows all roll back (503 DEPENDENCY_UNAVAILABLE
-- at the edge: the Worker maps any non-contract database failure to it).
select pg_temp.s09d_create_type('q', 'r3gate_q');
create or replace function public.r3_fail_queue() returns trigger language plpgsql as $body$
begin
  raise exception 'R3_FORCED_QUEUE_FAILURE';
end;
$body$;
create trigger r3_fail_queue before insert on platform_private.jobs
for each row execute function public.r3_fail_queue();
select pg_temp.s09d_fingerprint() as q_before \gset
select count(*) as q_jobs from platform_private.jobs \gset
select pg_temp.s09d_dry_run('q', 'owner', null, null, 'r3gate-dry-queue-0001');
select is(pg_temp.s09d_outcome('q:dryRun'), 'R3_FORCED_QUEUE_FAILURE',
  'a failing queue insert inside cms_start_schema_dry_run raises (the Worker maps this to 503 DEPENDENCY_UNAVAILABLE) [P2-S09-AC-359]');
select is(pg_temp.s09d_fingerprint(), :'q_before',
  'the failed enqueue rolled back every table fingerprint: reports, plans, versions, reviews, idempotency, audit and outbox [P2-S09-AC-359]');
select is((select count(*) from platform_private.cms_schema_dry_run_reports where target_version_id = pg_temp.s09d_id('q:version')),
  0::bigint, 'no dry-run attempt exists for the candidate [P2-S09-AC-359]');
select is((select count(*) from platform_private.cms_schema_migration_plans where to_version_id = pg_temp.s09d_id('q:version')),
  0::bigint, 'no migration plan exists for the candidate [P2-S09-AC-359]');
select is((select count(*) from platform_private.jobs), :q_jobs::bigint, 'no job row survived [P2-S09-AC-359]');
select is((select dry_run_id from platform_private.cms_content_type_versions where id = pg_temp.s09d_id('q:version')), null::uuid,
  'the candidate is not bound to any dry run [P2-S09-AC-359]');
drop trigger r3_fail_queue on platform_private.jobs;
select pg_temp.s09d_dry_run('q', 'owner', null, null, 'r3gate-dry-queue-0001');
select is(pg_temp.s09d_outcome('q:dryRun'), 'OK', 'the same idempotency key succeeds once the queue works: no stuck reservation [P2-S09-AC-359]');

select * from finish();
rollback;
