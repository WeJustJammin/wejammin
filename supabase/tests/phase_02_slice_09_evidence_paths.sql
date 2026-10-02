commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db): activation gates and the DEC-108
-- integrated producer paths that the producer suites leave open.
--   * null migrationPlanId is valid only for an additive candidate
--   * a counted approver losing the specialist capability before activation
--   * direct-insert substitutes are recorded by the guard and cannot activate
--   * test humans are provisioned only through CMS-03A-15 (guard + negative control)
--   * the second path consumes real entries (CMS-03B-10, CMS-03B-01) and a real
--     template (CMS-03C-01) accepted by the service-only resolver
-- Every candidate is produced through the named commands.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
\ir phase_02_slice_09_scan/00-guard.sqlinc

select pg_temp.s09x_arm();

-- ---------------------------------------------- AC093: null migrationPlanId ----
select pg_temp.s09d_create_type('n', 'evp_nullplan');
select pg_temp.s09d_to_approved('n');
select pg_temp.s09d_activate('n', 'owner', '{}'::jsonb, 'n:activate', jsonb_build_object('migrationPlanId', null));
select ok(pg_temp.s09d_outcome('n:activate') = 'OK'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('n:version')) = 'active',
  'migrationPlanId null is valid for an additive candidate and the candidate activates [P2-S09-AC-093]');

select pg_temp.s09g_grant('e:author', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select pg_temp.s09d_create_type('c', 'evp_condplan');
select pg_temp.s09d_to_active('c');
select pg_temp.s09w_entry('c1', 'c', 'Alpha title');
select pg_temp.s09d_successor('d', 'c');
select pg_temp.s09d_dry_run('d');
select pg_temp.s09w_dry_run('d');
select pg_temp.s09w_tighten('d', 40);
select pg_temp.s09d_dry_run('d', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('d');
select pg_temp.s09d_submit('d');
select pg_temp.s09d_assign('d', 'rev1');
select pg_temp.s09d_decide('d', 'rev1');
select pg_temp.s09w_backfill('d');
select pg_temp.s09d_activate('d', 'owner', '{}'::jsonb, 'd:nullplan', jsonb_build_object('migrationPlanId', null));
select ok(pg_temp.s09d_outcome('d:nullplan') = 'VALIDATION_FAILED'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('d:version')) = 'approved',
  'migrationPlanId null for a conditional (data-bearing) candidate is a 422 and the candidate stays approved [P2-S09-AC-093]');
select pg_temp.s09d_activate('d', 'owner', '{}'::jsonb, 'd:badplan', jsonb_build_object('migrationPlanId', 'not-a-uuid'));
select ok(pg_temp.s09d_outcome('d:badplan') in ('VALIDATION_FAILED', 'INVALID_REQUEST'),
  'a migrationPlanId that is neither a UUID nor null is refused [P2-S09-AC-093]');

-- ------------------------------------------ AC633: specialist capability lost ----
select pg_temp.s09d_create_type('p', 'evp_specialist', 'cms.disclosure.policy');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_to_approved('p', array['rev1', 'rev2']);
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')), 'approved', 'fixture: the protected review is approved with a specialist holder');
select is(pg_temp.s09d_revoke_via_rpc('rev1', 'cms.reviewer.policy'), 'OK', 'the owner revokes the counted approver''s specialist capability through CMS-03A-17');
select pg_temp.s09d_activate('p', 'owner', '{}'::jsonb, 'p:late');
select ok(pg_temp.s09d_outcome('p:late') in ('APPROVAL_INVALID', 'CONFLICT')
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('p:version')) <> 'active'
  and pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('p:review')) = 'invalidated',
  'CMS-03A-04 refuses activation and the review stays invalidated when a counted approver stops holding the specialist capability [P2-S09-AC-633]');

-- --------------------------------------------- AC713: substitutes are caught ----
select pg_temp.s09d_create_type('f', 'evp_forge');
select pg_temp.s09d_to_review('f');
select pg_temp.s09d_assign('f', 'rev1');
select is(pg_temp.s09x_direct(), 0::bigint,
  'positive: every producer row of this file so far was written by a named RPC, so the guard counts no direct statement');
select set_config('app.cms_rpc', 'true', true);
insert into platform_private.cms_schema_reviews
select * from jsonb_populate_record(null::platform_private.cms_schema_reviews,
  (select to_jsonb(r) || jsonb_build_object('id', extensions.gen_random_uuid(), 'state', 'rejected')
     from platform_private.cms_schema_reviews r where r.id = pg_temp.s09d_id('f:review')));
select is(pg_temp.s09x_direct('cms_schema_reviews'), 1::bigint, 'negative control: a hand-written review insert is recorded as a direct write [P2-S09-AC-713]');
insert into platform_private.cms_schema_review_decisions(
    owner_id, review_id, assignment_id, assignment_version, reviewer_person_ref, binding_context_hash,
    capability_key, capability_version, decision, reviewed_hash, mfa_verified_at)
  select review.owner_id, review.id, assignment.id, assignment.version, assignment.reviewer_person_ref, repeat('a', 64),
    'cms.schema_review', 1, 'approve', review.definition_hash, clock_timestamp()
  from platform_private.cms_schema_reviews review
  join platform_private.cms_schema_review_assignments assignment on assignment.review_id = review.id
  where review.id = pg_temp.s09d_id('f:review');
select is(pg_temp.s09x_direct('cms_schema_review_decisions'), 1::bigint, 'negative control: a hand-written decision insert is recorded as a direct write [P2-S09-AC-713]');
select pg_temp.s09d_create_type('q', 'evp_forge_report');
select pg_temp.s09d_dry_run('q');
select set_config('app.cms_rpc', 'true', true);
create temp table s09e_forged_plan on commit drop as select extensions.gen_random_uuid() as id;
insert into platform_private.cms_schema_migration_plans
select * from jsonb_populate_record(null::platform_private.cms_schema_migration_plans,
  (select to_jsonb(p) || jsonb_build_object('id', (select id from s09e_forged_plan), 'superseded_at', now()::text)
     from platform_private.cms_schema_migration_plans p where p.id = pg_temp.s09d_id('q:plan')));
insert into platform_private.cms_schema_dry_run_reports
select * from jsonb_populate_record(null::platform_private.cms_schema_dry_run_reports,
  (select to_jsonb(r) || jsonb_build_object('id', extensions.gen_random_uuid(), 'attempt_no', 99, 'job_id', extensions.gen_random_uuid(),
        'plan_id', (select id from s09e_forged_plan))
     from platform_private.cms_schema_dry_run_reports r where r.id = pg_temp.s09d_id('q:dryRun')));
select is(pg_temp.s09x_direct('cms_schema_dry_run_reports'), 1::bigint, 'negative control: a hand-written dry-run report insert is recorded as a direct write [P2-S09-AC-713]');
update platform_private.cms_schema_reviews set state = 'invalidated' where id = pg_temp.s09d_id('f:review');
select is(pg_temp.s09x_direct('cms_schema_reviews'), 2::bigint, 'negative control: a hand-written state change of a review is recorded as a direct write [P2-S09-AC-713]');
select is(pg_temp.s09d_read('cms_schema_migration_plans', 'state', pg_temp.s09d_id('d:plan')), 'completed', 'fixture: the worker-completed plan');
select throws_ok(format('update platform_private.cms_schema_migration_plans set state = ''completed'', migrated_count = migrated_count + 1 where id = %L', pg_temp.s09d_id('d:plan')),
  'P0001', 'IMMUTABLE_RECORD', 'a completed plan cannot be hand-written: completed-plan rows cannot be substituted [P2-S09-AC-713]');
update platform_private.cms_schema_migration_plans set updated_at = updated_at where id = pg_temp.s09d_id('q:plan');
select is(pg_temp.s09x_direct('cms_schema_migration_plans'), 2::bigint, 'negative control: a hand-written plan update is recorded as a direct write [P2-S09-AC-713]');
select cmp_ok(pg_temp.s09x_direct(), '>=', 5::bigint, 'the integrated-path guard assertion s09x_direct() = 0 fails on any of these substitutes [P2-S09-AC-713]');
-- A forged approved review and decision cannot activate a candidate.
select pg_temp.s09d_create_type('g', 'evp_forge2');
select pg_temp.s09d_to_review('g');
select pg_temp.s09d_assign('g', 'rev1');
select set_config('app.cms_rpc', 'true', true);
select pg_temp.s09d_try(format($q$update platform_private.cms_schema_reviews set state = 'approved', decided_at = clock_timestamp(),
      approval_evidence_hash = repeat('a', 64) where id = %L$q$, pg_temp.s09d_id('g:review'))) as forged_approved \gset
select pg_temp.s09d_activate('g', 'owner', '{}'::jsonb, 'g:forged', jsonb_build_object('approvalIds', jsonb_build_array(extensions.gen_random_uuid())));
select ok(pg_temp.s09d_outcome('g:forged') <> 'OK' and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('g:version')) <> 'active',
  'a forged approved review with a forged decision id cannot satisfy activation [P2-S09-AC-713]');

-- ---------------------------------------- AC714: test humans via CMS-03A-15 ----
create or replace function pg_temp.s09e_unprovisioned() returns bigint language sql stable as $body$
  select count(*) from identity_private.organization_actor_grant ag
   where ag.organization_id = pg_temp.s09d_id('ownerOrg') and ag.capability_code like 'cms.%'
     and ag.person_id <> pg_temp.s09d_actor_id('owner', 'person')::uuid
     and not exists (select 1 from platform_private.cms_capability_grants g
                       join platform_private.cms_capability_grant_events e on e.grant_id = g.id and e.aggregate_version = 1
                      where g.owner_id = ag.organization_id and g.subject_person_ref = ag.person_id
                        and g.capability_code = ag.capability_code)
$body$;
select is(pg_temp.s09e_unprovisioned(), 0::bigint,
  'every CMS capability of every non-owner test human (designer, specialist reviewer, template designer, author) has an aggregate and a granted event: it was provisioned through CMS-03A-15 [P2-S09-AC-714]');
select ok(pg_temp.s09x_via_rpc('cms_schema_review_assignments') > 0 and pg_temp.s09x_direct('cms_schema_review_assignments') = 0,
  'every reviewer assignment of the paths was created through CMS-03A-14 [P2-S09-AC-714]');
select set_config('app.cms_rpc', '', true);
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
select pg_temp.s09d_id('ownerOrg'), person_id, 'cms.editor', current_date, current_date + 5, true from s09d_actor where key = 'rev3';
select is(pg_temp.s09e_unprovisioned(), 1::bigint,
  'negative control: a hand-inserted organization_actor_grant row is detected as unprovisioned and fails the path guard [P2-S09-AC-714]');
delete from identity_private.organization_actor_grant where person_id = pg_temp.s09d_actor_id('rev3', 'person')::uuid and capability_code = 'cms.editor';
select is(pg_temp.s09e_unprovisioned(), 0::bigint, 'the forged row is gone and the guard is clean again');

-- ------------------------------ AC715: the second path consumes real producers ----
select pg_temp.s09d_grant_specialist('owner', 'cms.template_designer');
select pg_temp.s09d_create_type('tp', 'evp_path2');
select pg_temp.s09d_to_active('tp');
select pg_temp.s09w_entry('t1', 'tp', 'Alpha title');
select pg_temp.s09w_entry('t2', 'tp', 'Beta title');
create or replace function pg_temp.s09e_template(p_tag text, p_key text, p_type_tag text) returns jsonb
language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':template', 'platform_api.cms_define_template', 'owner',
    jsonb_build_object('templateKey', p_key, 'compatibleTypeIds', jsonb_build_array(pg_temp.s09d_id(p_type_tag || ':type')),
      'slots', '[]'::jsonb, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
      'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
      'idempotencyKey', pg_temp.s09d_idem(p_tag, 'template')));
  if resource is not null then perform pg_temp.s09d_remember(p_tag || ':templateVersion', (resource->>'id')::uuid); end if;
  return resource;
end;
$body$;
select pg_temp.s09e_template('tt', 'evp-path2-template', 'tp');
select is(pg_temp.s09d_outcome('tt:template'), 'OK', 'a compatible template is created through CMS-03C-01 [P2-S09-AC-715]');
select is((select count(*)::integer from platform_private.cms_entry_revisions where schema_version_id = pg_temp.s09d_id('tp:version') and revision_number = 1), 2,
  'two real entries exist, created through CMS-03B-10 by the owner-provisioned author [P2-S09-AC-715]');
select pg_temp.s09d_rpc('t1:revision', 'platform_api.cms_create_revision', 'owner',
  jsonb_build_object('entryId', pg_temp.s09d_resp('t1')->'entry'->>'id', 'baseRevision', '1',
    'changedPaths', jsonb_build_array('/fields/' || (select stable_field_id from platform_private.cms_field_definition_versions
        where content_type_version_id = pg_temp.s09d_id('tp:version') and field_key = 'title')),
    'values', jsonb_build_object((select stable_field_id::text from platform_private.cms_field_definition_versions
        where content_type_version_id = pg_temp.s09d_id('tp:version') and field_key = 'title'), 'Alpha title, revised'),
    'locale', 'en-US', 'expectedVersion', '1', 'ifMatch', '1', 'idempotencyKey', 's09e-path2-revision-0001'));
select is(pg_temp.s09d_outcome('t1:revision'), 'OK', 'CMS-03B-01 appends a real revision to an existing entry of the active source version [P2-S09-AC-715]');
select is((select count(*)::integer from platform_private.cms_entry_revisions where schema_version_id = pg_temp.s09d_id('tp:version')), 3,
  'the scanned source set is two entries and a second revision: three real revision rows [P2-S09-AC-715]');
select pg_temp.s09d_successor('tq', 'tp');
select pg_temp.s09d_dry_run('tq');
select pg_temp.s09w_dry_run('tq');
select pg_temp.s09w_tighten('tq', 40);
select pg_temp.s09d_dry_run('tq', 'owner', 'identity.revalidate', '1');
select pg_temp.s09w_dry_run('tq');
select is((select source_count from platform_private.cms_schema_migration_plans where id = pg_temp.s09d_id('tq:plan')), 3::bigint,
  'the nonzero dry run scans the entries created through CMS-03B-10 and CMS-03B-01 [P2-S09-AC-715]');
create or replace function pg_temp.s09e_resolve(p_label text, p_template uuid, p_type uuid, p_version uuid) returns jsonb
language plpgsql as $body$
begin
  perform pg_temp.s09d_session('owner');
  return pg_temp.s09d_call(p_label, 'platform_api.cms_resolve_template_compatibility', jsonb_build_object(
    'templateVersionId', p_template, 'contentTypeId', p_type, 'contentTypeVersionId', p_version,
    'context', pg_temp.s09d_context('owner')));
end;
$body$;
select pg_temp.s09e_resolve('tq:resolve', pg_temp.s09d_id('tt:templateVersion'), pg_temp.s09d_id('tq:type'), pg_temp.s09d_id('tq:version'));
select ok(pg_temp.s09d_outcome('tq:resolve') = 'OK' and pg_temp.s09d_resp('tq:resolve')->>'compatible' = 'true'
  and pg_temp.s09d_resp('tq:resolve')->>'contentTypeVersionId' = pg_temp.s09d_id('tq:version')::text,
  'the service-only resolver accepts the CMS-03C-01 template for the exact successor candidate [P2-S09-AC-715]');
select pg_temp.s09d_submit('tq');
select pg_temp.s09d_assign('tq', 'rev1');
select pg_temp.s09d_decide('tq', 'rev1');
select pg_temp.s09w_backfill('tq');
select pg_temp.s09d_activate('tq');
select ok(pg_temp.s09d_outcome('tq:activate') = 'OK'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('tq:version')) = 'active'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('tp:version')) = 'superseded',
  'the second atomic switch completes over the real entries, the real template and the real review [P2-S09-AC-715]');

select * from finish();
rollback;
