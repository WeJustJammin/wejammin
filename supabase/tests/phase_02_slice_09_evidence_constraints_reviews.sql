\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 acceptance evidence (lane e1-db), persistence rows of BE03a "Canonical
-- records and fields", part 1 of 3: reviews, decisions and assignments. Proven by
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

-- ============================================ cms_schema_reviews (643-647) ====
select is(pg_temp.s09e_check('cms_schema_reviews', c.name, (select review_done from s09e_ids), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_schema_reviews CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-643]')
from (values
  ('cms_schema_reviews_state_check', '{"state":"bogus"}'::jsonb),
  ('cms_schema_reviews_definition_hash_check', '{"definition_hash":"zz"}'::jsonb),
  ('cms_schema_reviews_dependency_hash_check', jsonb_build_object('dependency_manifest_hash', repeat('A', 64))),
  ('cms_schema_reviews_report_hash_check', jsonb_build_object('dry_run_report_hash', repeat('a', 63))),
  ('cms_schema_reviews_policy_hash_check', jsonb_build_object('policy_hash', repeat('g', 64))),
  ('cms_schema_reviews_context_hash_check', jsonb_build_object('context_hash', repeat('A', 64))),
  ('cms_schema_reviews_candidate_version_no_check', '{"candidate_version_no":0}'::jsonb),
  ('cms_schema_reviews_policy_version_check', '{"policy_version":0}'::jsonb),
  ('cms_schema_reviews_risk_class_check', '{"risk_class":"critical"}'::jsonb),
  ('cms_schema_reviews_required_count_check', '{"required_decision_count":0}'::jsonb),
  ('cms_schema_reviews_required_count_check', '{"required_decision_count":9}'::jsonb),
  ('cms_schema_reviews_required_capabilities_check', '{"required_capabilities":{}}'::jsonb),
  ('cms_schema_reviews_required_capabilities_check', '{"required_capabilities":[]}'::jsonb),
  ('cms_schema_reviews_required_capabilities_check', jsonb_build_object('required_capabilities',
      (select jsonb_agg('cms.reviewer.c' || g) from generate_series(1, 17) g)))
) as c(name, over);
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_required_count_check', (select review_done from s09e_ids),
    '{"required_decision_count":8}'), 'control:ACCEPTED|override:ACCEPTED',
  'the 1..8 decision count accepts its upper bound 8 [P2-S09-AC-643]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_required_capabilities_check', (select review_done from s09e_ids),
    jsonb_build_object('required_capabilities', (select jsonb_agg('cms.reviewer.c' || g) from generate_series(1, 16) g))),
  'control:ACCEPTED|override:ACCEPTED', 'the required_capabilities array accepts its upper bound 16 [P2-S09-AC-643]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_state_check', (select review_done from s09e_ids),
    '{"state":"invalidated"}'), 'control:ACCEPTED|override:ACCEPTED',
  'the closed state vocabulary accepts invalidated [P2-S09-AC-643]');

select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_source_policy_complete_check', (select review_done from s09e_ids),
    '{"source_policy_key":"editorial"}'), 'control:ACCEPTED|override:REJECTED:23514:cms_schema_reviews_source_policy_complete_check',
  'a source policy key without its version and hash is rejected [P2-S09-AC-644]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_source_policy_complete_check', (select review_done from s09e_ids),
    jsonb_build_object('source_policy_key', 'editorial', 'source_policy_version', 1, 'source_policy_hash', repeat('a', 64))),
  'control:ACCEPTED|override:ACCEPTED', 'a source policy key, version and hash all present is accepted [P2-S09-AC-644]');
select is(pg_temp.s09e_check('cms_schema_reviews', 'cms_schema_reviews_source_policy_complete_check', (select review_done from s09e_ids),
    jsonb_build_object('source_policy_version', 1, 'source_policy_hash', repeat('a', 64))),
  'control:ACCEPTED|override:REJECTED:23514:cms_schema_reviews_source_policy_complete_check',
  'a source policy version and hash without the key is rejected [P2-S09-AC-644]');

select is(pg_temp.s09e_unique('cms_schema_reviews', (select review_open from s09e_ids),
    array['content_type_version_id', 'definition_hash', 'dry_run_id'], '{"state":"rejected"}'),
  'dup:REJECTED:23505|ctl:ACCEPTED',
  'two open reviews of one (version, definition hash, dry-run) collide on the partial unique index; a non-open copy does not [P2-S09-AC-645]');

select is(pg_temp.s09e_writers('cms_schema_reviews', 'insert[[:space:]]+into'), 'cms_submit_schema_review',
  'only CMS-03A-11 inserts a review [P2-S09-AC-646]');
select is(pg_temp.s09e_writers('cms_schema_reviews', 'update'), 'cms_decide_schema_review,cms_invalidate_activation_reviews',
  'only the decision RPC and the invalidation function change a review''s state [P2-S09-AC-646]');
select is(pg_temp.s09e_writers('cms_schema_reviews', 'delete[[:space:]]+from'), '', 'no function deletes a review [P2-S09-AC-646]');
select set_config('app.cms_rpc', '', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format($q$update platform_private.cms_schema_reviews set state = 'approved', decided_at = clock_timestamp(),
      approval_evidence_hash = repeat('a', 64) where id = %L$q$, (select review_open from s09e_ids)),
  'P0001', null, 'a direct state change outside the RPC context is refused [P2-S09-AC-646]');
select ok(pg_temp.s09d_rls('cms_schema_reviews') and pg_temp.s09d_no_direct_grants('cms_schema_reviews'),
  'cms_schema_reviews has RLS enabled and forced and every direct anon/authenticated/service_role privilege revoked [P2-S09-AC-647]');
select is((select count(*)::integer from pg_policies where schemaname = 'platform_private' and tablename = 'cms_schema_reviews'
    and qual = 'platform_private.cms_rpc_context_valid()' and with_check = 'platform_private.cms_rpc_context_valid()'), 1,
  'the only policy gates every read and write on the schema-qualified RPC context helper [P2-S09-AC-647]');
-- The scope function reads the review through the forced policies as its owner (a
-- non-bypass role), so, like the producers, the caller publishes the RPC context and
-- the verified session of the actor before calling it directly.
create or replace function pg_temp.s09e_review_scope(p_review uuid, p_actor text, p_party uuid) returns text
language plpgsql as $body$
declare scope text;
begin
  perform set_config('app.cms_rpc', 'true', true);
  perform platform_private.cms_publish_session(pg_temp.s09d_actor_id(p_actor, 'auth')::uuid, p_party);
  scope := platform_private.cms_review_scope(p_review, pg_temp.s09d_actor_id(p_actor, 'auth')::uuid, p_party);
  perform set_config('app.cms_rpc', '', true);
  perform platform_private.cms_publish_session(null, null);
  return scope;
end;
$body$;
select ok(pg_temp.s09e_review_scope((select review_open from s09e_ids), 'owner', pg_temp.s09d_id('ownerOrg')) = 'designer'
  and pg_temp.s09e_review_scope((select review_open from s09e_ids), 'rev1', pg_temp.s09d_actor_id('rev1', 'person')::uuid) = 'assigned'
  and pg_temp.s09e_review_scope((select review_open from s09e_ids), 'rev2', pg_temp.s09d_actor_id('rev2', 'person')::uuid) is null
  and pg_temp.s09e_review_scope((select review_open from s09e_ids), 'other', pg_temp.s09d_id('otherOrg')) is null,
  'the read predicate is the candidate designer scope or an assigned review-only scope and nothing else [P2-S09-AC-647]');

-- ================================== cms_schema_review_decisions (648-651) ====
select is(pg_temp.s09e_check('cms_schema_review_decisions', c.name, (select decision from s09e_ids), c.over),
  'control:ACCEPTED|override:REJECTED:' || c.expected || ':' || c.name,
  'cms_schema_review_decisions ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-648]')
from (values
  ('cms_schema_review_decisions_capability_check', '{"capability_key":"cms.schema_designer"}'::jsonb, '23514'),
  ('cms_schema_review_decisions_decision_check', '{"decision":"abstain"}'::jsonb, '23514'),
  ('cms_schema_review_decisions_reviewed_hash_check', jsonb_build_object('reviewed_hash', repeat('A', 64)), '23514'),
  ('cms_schema_review_decisions_binding_hash_check', jsonb_build_object('binding_context_hash', repeat('A', 64)), '23514'),
  ('cms_schema_review_decisions_assignment_version_check', '{"assignment_version":0}'::jsonb, '23514'),
  ('cms_schema_review_decisions_capability_version_check', '{"capability_version":0}'::jsonb, '23514')
) as c(name, over, expected);
select is(pg_temp.s09e_check('cms_schema_review_decisions', 'mfa_verified_at', (select decision from s09e_ids), '{"mfa_verified_at":null}'),
  'control:ACCEPTED|override:REJECTED:23502:mfa_verified_at', 'a decision without mfa_verified_at is rejected (NOT NULL) [P2-S09-AC-648]');
select is(pg_temp.s09e_check('cms_schema_review_decisions', 'binding_context_hash', (select decision from s09e_ids), '{"binding_context_hash":null}'),
  'control:ACCEPTED|override:REJECTED:23502:binding_context_hash', 'a decision without binding_context_hash is rejected (NOT NULL) [P2-S09-AC-648]');
select ok(pg_temp.s09d_has_columns('cms_schema_review_decisions', array['id','owner_id','version','created_at','updated_at',
    'review_id','assignment_id','assignment_version','reviewer_person_ref','binding_context_hash','capability_key',
    'capability_version','decision','decided_at','reviewed_hash','mfa_verified_at']),
  'cms_schema_review_decisions carries the IA envelope and every BE03a column [P2-S09-AC-648]');
select is(pg_temp.s09e_unique('cms_schema_review_decisions', (select decision from s09e_ids), array['review_id', 'reviewer_person_ref'],
    '{"reviewer_person_ref":"00000000-0000-4000-8000-0000000000ee"}'),
  'dup:REJECTED:23505|ctl:ACCEPTED', 'UNIQUE(review_id, reviewer_person_ref): the same human cannot decide twice on one review [P2-S09-AC-649]');
select ok(not exists (select 1 from pg_constraint where conrelid = 'platform_private.cms_schema_review_decisions'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%submitter%')
  and exists (select 1 from pg_trigger where tgrelid = 'platform_private.cms_schema_review_decisions'::regclass and not tgisinternal
      and (tgtype & 2) = 2 and (tgtype & 4) = 4 and pg_get_triggerdef(oid) ilike '%before insert%'),
  'the submitter rule is a BEFORE INSERT trigger and no CHECK mentions the submitter (a CHECK cannot read another row) [P2-S09-AC-650]');
select is(pg_temp.s09e_writers('cms_schema_review_decisions', 'insert[[:space:]]+into'), 'cms_decide_schema_review',
  'only the decision RPC inserts a decision, which is also where the submitter is refused [P2-S09-AC-650]');
select is(pg_temp.s09e_check('cms_schema_review_decisions', 'cms_schema_review_decisions_created_immutable_check', (select decision from s09e_ids),
    jsonb_build_object('updated_at', (now() + interval '1 hour')::text)),
  'control:ACCEPTED|override:REJECTED:23514:cms_schema_review_decisions_created_immutable_check',
  'a decision whose updated_at differs from created_at is rejected [P2-S09-AC-651]');
select is(pg_temp.s09e_writers('cms_schema_review_decisions', 'update'), '', 'no function updates a decision [P2-S09-AC-651]');
select is(pg_temp.s09e_writers('cms_schema_review_decisions', 'delete[[:space:]]+from'), '', 'no function deletes a decision [P2-S09-AC-651]');
select ok(pg_temp.s09d_rls('cms_schema_review_decisions') and pg_temp.s09d_no_direct_grants('cms_schema_review_decisions'),
  'cms_schema_review_decisions has forced RLS and every direct privilege revoked [P2-S09-AC-651]');
select set_config('app.cms_rpc', 'true', true);
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_review_decisions set decision = ''reject'' where id = %L', (select decision from s09e_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'a decision UPDATE is rejected even inside the RPC context [P2-S09-AC-651]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('delete from platform_private.cms_schema_review_decisions where id = %L', (select decision from s09e_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'a decision DELETE is rejected [P2-S09-AC-651]');

-- ================================ cms_schema_review_assignments (652-654) ====
select is(pg_temp.s09e_check('cms_schema_review_assignments', c.name, (select assignment from s09e_ids), c.over),
  'control:ACCEPTED|override:REJECTED:23514:' || c.name,
  'cms_schema_review_assignments CHECK ' || c.name || ' rejects ' || c.over::text || ' [P2-S09-AC-652]')
from (values
  ('cms_schema_review_assignments_capability_check', '{"capability_key":"cms.schema_designer"}'::jsonb),
  ('cms_schema_review_assignments_actions_check', '{"actions":["read"]}'::jsonb),
  ('cms_schema_review_assignments_actions_check', '{"actions":["read","decide","assign"]}'::jsonb),
  ('cms_schema_review_assignments_actions_check', '{"actions":["decide","read"]}'::jsonb),
  ('cms_schema_review_assignments_state_check', '{"state":"expired"}'::jsonb),
  ('cms_schema_review_assignments_window_check', (select jsonb_build_object('ends_at', starts_at::text) from platform_private.cms_schema_review_assignments where id = (select assignment from s09e_ids))),
  ('cms_schema_review_assignments_ceiling_check', (select jsonb_build_object('ends_at', (starts_at + interval '7 days 1 second')::text) from platform_private.cms_schema_review_assignments where id = (select assignment from s09e_ids))),
  ('cms_schema_review_assignments_reason_check', '{"reason":""}'::jsonb),
  ('cms_schema_review_assignments_reason_check', jsonb_build_object('reason', repeat('x', 257))),
  ('cms_schema_review_assignments_version_check', '{"version":0}'::jsonb)
) as c(name, over);
select is(pg_temp.s09e_check('cms_schema_review_assignments', 'cms_schema_review_assignments_ceiling_check', (select assignment from s09e_ids),
    (select jsonb_build_object('ends_at', (starts_at + interval '7 days')::text) from platform_private.cms_schema_review_assignments where id = (select assignment from s09e_ids))),
  'control:ACCEPTED|override:ACCEPTED', 'an assignment of exactly seven days is accepted [P2-S09-AC-652]');
select is(pg_temp.s09e_check('cms_schema_review_assignments', 'cms_schema_review_assignments_reason_check', (select assignment from s09e_ids),
    jsonb_build_object('reason', repeat('x', 256))), 'control:ACCEPTED|override:ACCEPTED', 'a 256-octet reason is accepted [P2-S09-AC-652]');
select is(pg_temp.s09e_check('cms_schema_review_assignments', 'cms_schema_review_assignments_reason_check', (select assignment from s09e_ids),
    '{"reason":null}'), 'control:ACCEPTED|override:ACCEPTED', 'the reason is optional (NULL accepted) [P2-S09-AC-652]');
select ok(pg_temp.s09d_has_columns('cms_schema_review_assignments', array['capability_key','actions','state','starts_at','ends_at','reason']),
  'cms_schema_review_assignments persists capability, actions, state, starts_at, ends_at and reason [P2-S09-AC-652]');
select ok(pg_temp.s09d_scalar('select (count(*) = 0)::text from information_schema.columns where table_schema = ''platform_private''
    and table_name = ''cms_schema_review_assignments'' and (column_name ilike ''%acting%'' or column_name ilike ''%context%'' or column_name ilike ''%binding%'')')::boolean,
  'cms_schema_review_assignments stores no owner acting context [P2-S09-AC-654]');
select is(pg_temp.s09e_writers('cms_schema_review_assignments', 'insert[[:space:]]+into'), 'cms_assign_schema_review',
  'only CMS-03A-14 creates an assignment [P2-S09-AC-654]');
select is(pg_temp.s09e_writers('cms_schema_review_assignments', 'update'), 'cms_assign_schema_review',
  'only CMS-03A-14 revokes (updates) an assignment [P2-S09-AC-654]');
select is(pg_temp.s09e_writers('cms_schema_review_assignments', 'delete[[:space:]]+from'), '', 'no function deletes an assignment [P2-S09-AC-654]');
select ok(pg_temp.s09d_rls('cms_schema_review_assignments') and pg_temp.s09d_no_direct_grants('cms_schema_review_assignments'),
  'cms_schema_review_assignments has forced RLS and every direct privilege revoked [P2-S09-AC-654]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('delete from platform_private.cms_schema_review_assignments where id = %L', (select assignment from s09e_ids)),
  'P0001', 'IMMUTABLE_RECORD', 'an assignment DELETE is rejected [P2-S09-AC-654]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_review_assignments set ends_at = ends_at + interval ''1 hour'' where id = %L', (select assignment from s09e_ids)),
  'P0001', null, 'an assignment cannot be broadened (its window cannot be extended in place) [P2-S09-AC-654]');
-- NEGATIVE CONTROL: a direct statement (or trigger-bypassing tamper) against a producer-made row, proving that a guard refuses it or that a gate notices it; never a producer path, no authority or evidence is claimed.
select throws_ok(format('update platform_private.cms_schema_review_assignments set actions = array[''read'',''decide'',''assign''] where id = %L', (select assignment from s09e_ids)),
  null, null, 'an assignment cannot be broadened to another action [P2-S09-AC-654]');


-- ===================== foreign keys of this file's tables (AC215 part) ====
create temp table s09e_fk_results on commit drop as
select t as table_name,
       pg_temp.s09e_fk_probe('platform_private', t, case when t = 'cms_schema_artifacts' then jsonb_build_object('artifact_hash', encode(extensions.digest(extensions.gen_random_uuid()::text, 'sha256'), 'hex')) when t = 'cms_schema_review_assignments' then '{}'::jsonb end) as outcome,
       (select count(*)::integer from pg_constraint con where con.conrelid = format('platform_private.%I', t)::regclass and con.contype = 'f') as fk_count
from unnest(array[
  'cms_content_types',
  'cms_content_type_versions',
  'cms_schema_artifacts',
  'cms_schema_reviews',
  'cms_schema_review_decisions',
  'cms_schema_review_assignments']) t;
select diag(table_name || ' => ' || outcome) from s09e_fk_results where outcome not like 'probed=%;bad=' order by 1;
select ok(outcome = 'probed=' || fk_count || ';bad=',
  table_name || ': all ' || fk_count || ' foreign keys reject a dangling reference (' || outcome || ') [P2-S09-AC-215]')
from s09e_fk_results where outcome <> 'EMPTY' order by table_name;
select is((select count(*)::integer from s09e_fk_results where outcome = 'EMPTY'), 0,
  'every probed table held a real producer row, so no foreign key was skipped [P2-S09-AC-215]');

select * from finish();
rollback;
