\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the CMS-03A-04
-- preconditions (zero unresolved references, exact dry-run evidence, valid plan,
-- optional evidence-hash equality), compare-and-swap with invalidation of an
-- approved candidate when its inputs drift, the definition-state machine and the
-- monotonic version fence.  Approved candidates come from the DEC-108 chain; a
-- tamper is run in a sub-transaction that is always rolled back, with the
-- user triggers of the one table it touches disabled, and only to prove that the
-- activation command or the invalidation trigger refuses the drifted state.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/05-probes.sqlinc

create or replace function pg_temp.p_state(p_tag text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id(p_tag || ':version')) $body$;
create or replace function pg_temp.p_review_state(p_tag text) returns text language sql stable as $body$
  select pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id(p_tag || ':review')) $body$;
create or replace function pg_temp.p_active(p_type_tag text) returns bigint language sql stable as $body$
  select count(*) from platform_private.cms_content_type_versions where content_type_id = pg_temp.s09d_id(p_type_tag || ':type') and state = 'active' $body$;
-- One refused activation: the expected token, the candidate still approved and no active version appeared.
create or replace function pg_temp.p_refuse(p_label text, p_tag text, p_override jsonb, p_expected text[], p_actor text default 'owner') returns text language plpgsql as $body$
declare before_active bigint := pg_temp.p_active(p_tag); outcome text;
begin
  perform pg_temp.s09d_activate(p_tag, p_actor, '{}'::jsonb, p_label, p_override);
  outcome := pg_temp.s09d_outcome(p_label);
  return case when outcome = any(p_expected) and pg_temp.p_state(p_tag) = 'approved' and pg_temp.p_active(p_tag) = before_active then 'ok'
    else 'bad:' || outcome || ' state=' || coalesce(pg_temp.p_state(p_tag), '?') end;
end;
$body$;
-- Tamper, activate and report: the whole sub-transaction is rolled back.
create or replace function pg_temp.p_tampered(p_tag text, p_table text, p_tamper text) returns text language plpgsql as $body$
declare result text; request jsonb;
begin
  request := pg_temp.s09d_activation_request(p_tag);
  begin
    set constraints all immediate;
    execute format('alter table platform_private.%I disable trigger user', p_table);
    execute p_tamper;
    perform set_config('app.cms_rpc', 'true', true);
    perform pg_temp.s09d_call('p240:tampered', 'platform_api.cms_activate_schema', request);
    result := pg_temp.s09d_outcome('p240:tampered') || ' ' || pg_temp.p_state(p_tag);
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return 'ERROR:' || sqlerrm;
  end;
end;
$body$;

-- ============================================ AC010 / AC094 preconditions on one approved candidate ====
select pg_temp.s09d_create_type('g', 'p240_gate');
select pg_temp.s09d_to_approved('g');
select is(pg_temp.p_state('g') || '/' || pg_temp.p_review_state('g'), 'approved/approved', 'fixture: the candidate holds a real approved review [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:dry:rand', 'g', jsonb_build_object('dryRunId', extensions.gen_random_uuid()), array['VALIDATION_FAILED', 'CONFLICT', 'NOT_FOUND']), 'ok',
  'a dryRunId that names no persisted report is refused and the candidate stays approved [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:dry:self', 'g', jsonb_build_object('dryRunId', pg_temp.s09d_id('g:version')), array['VALIDATION_FAILED', 'CONFLICT', 'NOT_FOUND']), 'ok',
  'the candidate''s own id cannot stand in for its dry-run evidence [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:plan:rand', 'g', jsonb_build_object('migrationPlanId', extensions.gen_random_uuid()), array['VALIDATION_FAILED', 'CONFLICT', 'NOT_FOUND']), 'ok',
  'a migration plan that is not the dry run''s own plan is refused [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:appr:none', 'g', '{"approvalIds":[]}', array['INVALID_REQUEST', 'VALIDATION_FAILED', 'APPROVAL_INVALID']), 'ok', 'an empty approval set is refused [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:appr:rand', 'g', jsonb_build_object('approvalIds', jsonb_build_array(extensions.gen_random_uuid())), array['APPROVAL_INVALID', 'VALIDATION_FAILED', 'INVALID_REQUEST']), 'ok', 'an approval id that is no recorded approve decision is refused [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:appr:dup', 'g', jsonb_build_object('approvalIds', (select jsonb_agg(x) from (select jsonb_array_elements(pg_temp.s09d_approval_ids('g')) x union all select jsonb_array_elements(pg_temp.s09d_approval_ids('g'))) d)), array['APPROVAL_INVALID', 'INVALID_REQUEST', 'VALIDATION_FAILED', 'CONFLICT']), 'ok',
  'duplicate approval ids are refused [P2-S09-AC-010]');
select is(pg_temp.p_refuse('gate:cas', 'g', '{"expectedVersion":"999"}', array['VERSION_MISMATCH']), 'ok', 'a stale candidate version is VERSION_MISMATCH [P2-S09-AC-189]');
select is(pg_temp.p_refuse('gate:hash:wrong', 'g', jsonb_build_object('expectedActivationEvidenceHash', repeat('a', 64)), array['CONFLICT']), 'ok',
  'a lowercase 64-hex evidence hash that is not the frozen evidence is a typed CONFLICT and nothing changes [P2-S09-AC-094]');
select is(pg_temp.p_refuse('gate:hash:upper', 'g', jsonb_build_object('expectedActivationEvidenceHash', upper(repeat('a', 64))), array['CONFLICT', 'VALIDATION_FAILED']), 'ok', 'an uppercase hash is refused [P2-S09-AC-094]');
select is(pg_temp.p_refuse('gate:hash:short', 'g', '{"expectedActivationEvidenceHash":"abc"}', array['CONFLICT', 'VALIDATION_FAILED']), 'ok', 'a malformed hash is refused [P2-S09-AC-094]');
select is(pg_temp.p_refuse('gate:forbid', 'g', '{}', array['FORBIDDEN'], 'rev1'), 'ok', 'a human without cms.schema_designer cannot activate [P2-S09-AC-010]');
select is(pg_temp.p_tampered('g', 'cms_content_type_capability_bindings',
    format('insert into platform_private.cms_content_type_capability_bindings(owner_id, state, version, content_type_version_id, capability_key, capability_version) values (%L, ''draft'', 1, %L, ''cms.unregistered'', 1)',
      pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('g:version'))), 'VALIDATION_FAILED approved',
  'an unresolved capability reference that appears after approval makes activation refuse (the persisted graph no longer matches the artifact) [P2-S09-AC-010]');
select is(pg_temp.p_tampered('g', 'cms_content_type_template_bindings',
    format('insert into platform_private.cms_content_type_template_bindings(owner_id, state, version, content_type_version_id, template_version_id, position) values (%L, ''draft'', 1, %L, %L, 0)',
      pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_id('g:version'), extensions.gen_random_uuid())), 'VALIDATION_FAILED approved',
  'a dangling template reference that appears after approval makes activation refuse: template compatibility is rechecked at the switch [P2-S09-AC-010]');
select is(pg_temp.p_tampered('g', 'cms_schema_artifacts', format('update platform_private.cms_schema_artifacts set compiler_version = ''9'' where content_type_version_id = %L', pg_temp.s09d_id('g:version'))), 'VALIDATION_FAILED approved',
  'a compiler version that is no longer registered makes activation refuse [P2-S09-AC-010]');
select is(pg_temp.p_tampered('g', 'cms_schema_artifacts', format('update platform_private.cms_schema_artifacts set artifact_hash = %L where content_type_version_id = %L', repeat('c', 64), pg_temp.s09d_id('g:version'))), 'VALIDATION_FAILED approved',
  'an artifact whose hash is not the definition hash makes activation refuse [P2-S09-AC-189]');
select is(pg_temp.p_state('g') || '/' || pg_temp.p_review_state('g'), 'approved/approved', 'every tamper was rolled back: the candidate still holds its approval [P2-S09-AC-189]');
select pg_temp.s09d_get_pr('g');
select pg_temp.s09d_activate('g', 'owner', '{}'::jsonb, 'gate:hash:right', jsonb_build_object('expectedActivationEvidenceHash',
  pg_temp.s09d_resp('g:detail')->'resource'->'activationEvidence'->>'approvalEvidenceHash'));
select is(pg_temp.s09d_outcome('gate:hash:right'), 'OK', 'the frozen evidence hash the detail projection exposes is accepted and the candidate activates [P2-S09-AC-094]');
select is(pg_temp.s09d_resp('gate:hash:right')->'activationEvidence'->>'approvalEvidenceHash', pg_temp.s09d_resp('g:detail')->'resource'->'activationEvidence'->>'approvalEvidenceHash',
  'the expectation never changed the server evidence: the resource carries the hash that was frozen [P2-S09-AC-094]');
select pg_temp.s09d_activate('g', 'owner', '{}'::jsonb, 'gate:again');
select is(pg_temp.s09d_outcome('gate:again'), 'CONFLICT', 'a second activation of the already active candidate is refused: activation is a compare-and-swap [P2-S09-AC-189]');
select is(pg_temp.p_active('g'), 1::bigint, 'exactly one active version remains [P2-S09-AC-189]');

-- ===================================== AC189 drift invalidates an approved review; review again ====
select pg_temp.s09d_create_type('h', 'p240_drift');
select pg_temp.s09d_to_approved('h');
select is(pg_temp.p_review_state('h'), 'approved', 'fixture: the second candidate is approved [P2-S09-AC-189]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
update platform_private.cms_content_types set owner_capability = 'cms.schema_registry.read' where id = pg_temp.s09d_id('h:type');
select is(pg_temp.p_review_state('h'), 'invalidated', 'a change of the owning type''s authority invalidates the approved review [P2-S09-AC-189]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
update platform_private.cms_content_types set owner_capability = 'cms.schema_designer' where id = pg_temp.s09d_id('h:type');
select set_config('app.cms_rpc', '', true);
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'drift:act');
select ok(pg_temp.s09d_outcome('drift:act') = 'CONFLICT' and pg_temp.p_state('h') <> 'active', 'the invalidated approval can no longer activate the candidate [P2-S09-AC-189]');
select is(pg_temp.p_state('h'), 'draft', 'the drifted candidate was returned to draft [P2-S09-AC-189]');
create temp table p_old_review on commit drop as select pg_temp.s09d_id('h:review') as id;
select pg_temp.s09d_submit('h');
select is(pg_temp.s09d_outcome('h:submit'), 'OK', 'resubmission is allowed and freezes a new review [P2-S09-AC-189]');
select ok(pg_temp.s09d_id('h:review') <> (select id from p_old_review) and pg_temp.p_review_state('h') = 'open'
    and (select count(*) = 0 from platform_private.cms_schema_review_decisions where review_id = pg_temp.s09d_id('h:review')),
  'the new review is a different record with no decisions: the invalidated approval is never reused [P2-S09-AC-189]');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', (select id from p_old_review)), 'invalidated', 'the old review stays invalidated [P2-S09-AC-189]');
select pg_temp.s09d_activate('h', 'owner', '{}'::jsonb, 'drift:act2', jsonb_build_object('dryRunId', extensions.gen_random_uuid(), 'approvalIds', jsonb_build_array(extensions.gen_random_uuid()), 'migrationPlanId', null));
select ok(pg_temp.s09d_outcome('drift:act2') = 'CONFLICT', 'the open review cannot activate: review again means new independent decisions [P2-S09-AC-189]');
select pg_temp.s09d_assign('h', 'rev1'); select pg_temp.s09d_decide('h', 'rev1');
select ok(pg_temp.p_review_state('h') = 'approved' and pg_temp.p_state('h') = 'approved', 'a fresh independent decision approves the new review [P2-S09-AC-189]');
select pg_temp.s09d_activate('h');
select is(pg_temp.s09d_outcome('h:activate'), 'OK', 'and the re-reviewed candidate activates [P2-S09-AC-189]');

-- ===================================== AC186 the definition state machine ====
select pg_temp.s09d_create_type('s', 'p240_states');
create temp table p_trail on commit drop as select 1 as step, pg_temp.p_state('s') as state;
select pg_temp.s09d_activate('s', 'owner', '{}'::jsonb, 's:early', jsonb_build_object('dryRunId', extensions.gen_random_uuid(), 'approvalIds', jsonb_build_array(extensions.gen_random_uuid()), 'migrationPlanId', null));
select ok(pg_temp.s09d_outcome('s:early') = 'CONFLICT' and pg_temp.p_state('s') = 'draft', 'a draft cannot be activated: it has no approved review, sealed dry run or plan [P2-S09-AC-186]');
select pg_temp.s09d_dry_run('s'); select pg_temp.s09d_seal('s'); select pg_temp.s09d_submit('s');
insert into p_trail select 2, pg_temp.p_state('s');
select pg_temp.s09d_assign('s', 'rev1'); select pg_temp.s09d_decide('s', 'rev1');
insert into p_trail select 3, pg_temp.p_state('s');
select pg_temp.s09d_activate('s');
insert into p_trail select 4, pg_temp.p_state('s');
select pg_temp.s09d_successor('s2', 's');
select pg_temp.s09d_to_active('s2');
insert into p_trail select 5, pg_temp.p_state('s');
select is((select string_agg(state, '>' order by step) from p_trail), 'draft>review>approved>active>superseded',
  'the observed states of one version are draft, review, approved, active, superseded in that order [P2-S09-AC-186]');
select pg_temp.s09d_submit('s');
select is(pg_temp.s09d_outcome('s:submit'), 'CONFLICT', 'a superseded version cannot be submitted again [P2-S09-AC-186]');
select pg_temp.s09d_submit('s2');
select is(pg_temp.s09d_outcome('s2:submit'), 'CONFLICT', 'an active version cannot be submitted [P2-S09-AC-186]');
select pg_temp.s09d_create_type('s3', 'p240_states3');
select pg_temp.s09d_to_review('s3');
select pg_temp.s09d_activate('s3', 'owner', '{}'::jsonb, 's3:activate', jsonb_build_object('dryRunId', extensions.gen_random_uuid(), 'approvalIds', jsonb_build_array(extensions.gen_random_uuid()), 'migrationPlanId', null));
select ok(pg_temp.s09d_outcome('s3:activate') = 'CONFLICT' and pg_temp.p_state('s3') = 'review', 'a candidate in review cannot be activated [P2-S09-AC-186]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_content_type_versions set labels = %L where id = %L', '{"label":"Changed"}', pg_temp.s09d_id('s2:version')), 'P0001', 'IMMUTABLE_RECORD', 'an active version is immutable: a content update is rejected [P2-S09-AC-186]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_content_type_versions set state = ''draft'' where id = %L', pg_temp.s09d_id('s2:version')), 'P0001', 'IMMUTABLE_RECORD', 'an active version cannot return to draft [P2-S09-AC-186]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_content_type_versions set state = ''active'' where id = %L', pg_temp.s09d_id('s:version')), 'P0001', 'IMMUTABLE_RECORD', 'a superseded version cannot be reactivated [P2-S09-AC-186]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('delete from platform_private.cms_content_type_versions where id = %L', pg_temp.s09d_id('s2:version')), 'P0001', 'IMMUTABLE_RECORD', 'an active version cannot be deleted [P2-S09-AC-186]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_content_type_versions where state = ''scheduled'''), '0', 'no schema version is ever scheduled: the value exists only in the shared vocabulary (OD-6) [P2-S09-AC-186]');
select set_config('app.cms_rpc', '', true);

-- ============================================ AC016 closed states, monotonic versions ====
select is((select array_agg(e.enumlabel order by e.enumsortorder)::text from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'platform_private' and t.typname = 'cms_definition_state'), '{draft,review,approved,scheduled,active,superseded,retired,blocked}', 'the definition states are the closed eight-member vocabulary [P2-S09-AC-016]');
select is((select string_agg(version_no::text || ':' || state, ',' order by version_no) from platform_private.cms_content_type_versions where content_type_id = pg_temp.s09d_id('s:type')), '1:superseded,2:active',
  'version numbers of one type count 1, 2 in order of creation [P2-S09-AC-016]');
select ok(exists (select 1 from pg_constraint c where c.conrelid = 'platform_private.cms_content_type_versions'::regclass and c.contype = 'u' and pg_get_constraintdef(c.oid) = 'UNIQUE (content_type_id, version_no)'),
  'a version number can never be reused within a type [P2-S09-AC-016]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
create or replace function pg_temp.p_decrease() returns text language plpgsql as $body$
declare result text;
begin
  begin
    perform set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions set version = version - 1 where id = pg_temp.s09d_id('s3:version') and version > 1;
    result := 'ACCEPTED';
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return sqlerrm;
  end;
end;
$body$;
select is(pg_temp.p_decrease(), 'IMMUTABLE_RECORD', 'the CAS version of a definition can never decrease: versioning is monotonic [P2-S09-AC-016]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
create or replace function pg_temp.p_blocked_return() returns text language plpgsql as $body$
declare result text;
begin
  begin
    set constraints all immediate;
    perform set_config('app.cms_rpc', 'true', true);
    alter table platform_private.cms_content_type_versions disable trigger cms_content_type_versions_activation_review_invalidation;
    update platform_private.cms_content_type_versions set state = 'blocked' where id = pg_temp.s09d_id('s3:version');
    update platform_private.cms_content_type_versions set state = 'draft' where id = pg_temp.s09d_id('s3:version');
    result := 'ACCEPTED';
    raise exception 'P240_ROLLBACK';
  exception when others then
    if sqlerrm = 'P240_ROLLBACK' then return result; end if;
    return sqlerrm;
  end;
end;
$body$;
select is(pg_temp.p_blocked_return(), 'IMMUTABLE_RECORD', 'a blocked version cannot return to draft except through an audited transition (none is open to a caller) [P2-S09-AC-016]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_content_type_versions where state = ''blocked'''), '0', 'no producer creates a blocked version [P2-S09-AC-016]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cms_schema_migration_plans where state = ''blocked'''), '0', 'migration state is a separate column on the plan: a blocked plan is not a blocked definition [P2-S09-AC-016]');

select * from finish();
rollback;
