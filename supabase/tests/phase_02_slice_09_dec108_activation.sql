\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-04 activation consumes the CMS review chain
-- (BE03a request matrix, "Security and abuse controls", "DEC-108 activation
-- producer flow", G8-G10).  Defect A: no CFG setting_value review authority.
-- Defect B: the review context hash is a stable actor/person/party/binding
-- projection.  Defect D: no ten-minute decision-age check.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

-- Defect A (structural): none of the activation authority reads CFG reviews.
select ok(position(token in pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)')) = 0
  and pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)') <> '',
  'DEFECT A: cms_activate_schema never references ' || token)
from unnest(array['cfg_config_change_reviews', 'cfg_config_approvals', 'setting_value']) token;
select ok(position(token in pg_temp.s09d_def(fn)) = 0 and pg_temp.s09d_def(fn) <> '',
  'DEFECT A: ' || fn || ' never references ' || token)
from unnest(array['cfg_config_change_reviews', 'cfg_config_approvals']) token
cross join unnest(array['platform_private.cms_worker_human_approval_valid(uuid)']) fn;
-- Defect B (structural): the whole transport context is never the review identity.
select ok(position('cfg_hash_json(p_request->''context'')' in pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)')) = 0
  and pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)') <> '',
  'DEFECT B: activation does not hash the whole transport context (requestId/correlationId/stepUpAt)');
-- Defect D (structural): no decision/review age window.
select ok(pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)') <> ''
  and pg_temp.s09d_def('platform_private.cms_activate_schema(jsonb)')
    !~* '(decided_at|submitted_at)[^;]{0,120}interval ''10 minutes''',
  'DEFECT D: no ten-minute window is applied to decided_at or submitted_at');

select pg_temp.s09d_create_type('a', 'dec108act');
select pg_temp.s09d_to_approved('a');
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('a:review')), 'approved',
  'fixture: the review was approved by an assigned independent reviewer through the producers [P2-S09-AC-629]');
select is(pg_temp.s09d_scalar('select count(*)::text from platform_private.cfg_config_change_reviews'), '0',
  'fixture: no CFG review exists, so the evidence can only be the CMS review chain [P2-S09-AC-634]');

-- Defect A (behavior): forged CFG evidence is never accepted.
create temp table s09d_forged on commit drop as select extensions.gen_random_uuid() as review_id;
create temp table s09d_cfg_before on commit drop as
select pg_temp.s09d_scalar('select count(*)::text from platform_private.cfg_config_change_reviews') as total;
select pg_temp.s09d_try(format($q$
  insert into platform_private.cfg_config_change_reviews(
    id, candidate_type, candidate_id, candidate_version, frozen_hash, impact_manifest, impact_manifest_hash,
    risk_class, required_approvals, state, submitted_by, submitted_at, version_no)
  select %1$L, 'setting_value', version.id, version.version, version.definition_hash, '{}'::jsonb,
         platform_private.cfg_hash_json('{}'::jsonb), 'high', 1, 'approved', %2$L, clock_timestamp(), 1
  from platform_private.cms_content_type_versions version where version.id = %3$L$q$,
  (select review_id from s09d_forged), pg_temp.s09d_actor_id('owner', 'auth'), pg_temp.s09d_id('a:version')));
update s09d_cfg_before set total = pg_temp.s09d_scalar('select count(*)::text from platform_private.cfg_config_change_reviews');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:forged',
  jsonb_build_object('approvalIds', jsonb_build_array((select review_id from s09d_forged))));
select is(pg_temp.s09d_outcome('a:forged'), 'APPROVAL_INVALID',
  'DEFECT A: an approved CFG setting_value review id is not approval evidence for a schema [P2-S09-AC-634]');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:reviewid',
  jsonb_build_object('approvalIds', jsonb_build_array(pg_temp.s09d_id('a:review'))));
select is(pg_temp.s09d_outcome('a:reviewid'), 'APPROVAL_INVALID',
  'approvalIds are approve-DECISION ids: the review id itself is refused [P2-S09-AC-630] [P2-S09-AC-089]');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:unknownid',
  jsonb_build_object('approvalIds', pg_temp.s09d_approval_ids('a') || jsonb_build_array(extensions.gen_random_uuid())));
select is(pg_temp.s09d_outcome('a:unknownid'), 'APPROVAL_INVALID', 'an unknown extra decision id is refused rather than ignored [P2-S09-AC-630]');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:dup',
  jsonb_build_object('approvalIds', pg_temp.s09d_approval_ids('a') || pg_temp.s09d_approval_ids('a')));
select is(pg_temp.s09d_outcome('a:dup'), 'VALIDATION_FAILED', 'duplicate decision ids are 422 VALIDATION_FAILED [P2-S09-AC-630]');

-- Activator authority (the activator's own binding/MFA is the only MFA rechecked).
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp() - interval '11 minutes'
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:stale');
select is(pg_temp.s09d_outcome('a:stale'), 'STEP_UP_REQUIRED',
  'a stale activator binding is 401 STEP_UP_REQUIRED even when the envelope claims fresh step-up [P2-S09-AC-631] [P2-S09-AC-089]');
-- TIME-WARP: a stale or recent acting-context binding (heartbeat, MFA recency, expiry) cannot be produced without waiting; the binding itself was selected through identity_context_bind.
update platform_private.acting_context_binding set last_seen_at = clock_timestamp()
 where id = pg_temp.s09d_actor_id('owner', 'binding')::uuid;
select pg_temp.s09d_activate('a', 'owner', jsonb_build_object('actingContextId', null), 'a:nobinding');
select is(pg_temp.s09d_outcome('a:nobinding'), 'STEP_UP_REQUIRED', 'an activation without the private binding id is 401 STEP_UP_REQUIRED [P2-S09-AC-631]');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:wrongplan',
  jsonb_build_object('migrationPlanId', extensions.gen_random_uuid()));
select ok(pg_temp.s09d_outcome('a:wrongplan') = 'VALIDATION_FAILED' and pg_temp.s09d_id('a:plan') is not null,
  'a plan that is not the one bound to the dry run is refused');
select pg_temp.s09d_activate('a', 'owner', '{}'::jsonb, 'a:wrongdry',
  jsonb_build_object('dryRunId', extensions.gen_random_uuid()));
select ok(pg_temp.s09d_outcome('a:wrongdry') = 'VALIDATION_FAILED' and pg_temp.s09d_id('a:dryRun') is not null,
  'a dry-run id that is not the candidate''s bound sealed attempt is refused [P2-S09-AC-087]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'approved',
  'every refused activation left the candidate approved and unswitched');

-- Defect D (behavior): an old decision still counts; Defect B: transport context may differ.
select pg_temp.s09d_timewarp('cms_schema_review_decisions', format($q$update platform_private.cms_schema_review_decisions
   set decided_at = decided_at - interval '30 minutes', created_at = created_at - interval '30 minutes',
       updated_at = updated_at - interval '30 minutes', mfa_verified_at = mfa_verified_at - interval '30 minutes'
 where review_id = %L$q$, pg_temp.s09d_id('a:review')));
select pg_temp.s09d_timewarp('cms_schema_reviews', format($q$update platform_private.cms_schema_reviews
   set submitted_at = submitted_at - interval '45 minutes', decided_at = decided_at - interval '30 minutes'
 where id = %L$q$, pg_temp.s09d_id('a:review')));
create temp table s09d_activated on commit drop as
select pg_temp.s09d_activate('a', 'owner', jsonb_build_object('requestId', extensions.gen_random_uuid(),
  'correlationId', extensions.gen_random_uuid(), 'stepUpAt', clock_timestamp() - interval '90 seconds'), 'a:activate') as response;
select is(pg_temp.s09d_outcome('a:activate'), 'OK',
  'DEFECT D/B: a 30-minute-old decision under a different requestId/correlationId/stepUpAt still activates [P2-S09-AC-631] [P2-S09-AC-089]');
select ok((select response ?& array['id','version','contentHash','createdAt','updatedAt','contentTypeVersionId','state','activationEvidence','eventType']
    and not (response ? 'eventId')
    and response->>'state' = 'active' and response->>'eventType' = 'cms.schema.activated.v1'
    and (response->'activationEvidence'->>'requiredDecisionCount')::int = 1
    and response->'activationEvidence'->>'riskClass' = 'ordinary'
    and response->'activationEvidence'->>'approvalEvidenceHash' ~ '^[a-f0-9]{64}$'
    and response->'activationEvidence'->>'approvalEvidenceHash'
        = pg_temp.s09d_read('cms_content_type_versions', 'activation_approval_evidence_hash', pg_temp.s09d_id('a:version'))
    from s09d_activated),
  'activation returns the active resource whose evidence digest is the persisted immutable activation evidence [P2-S09-AC-629] [P2-S09-AC-092]');
select ok((select array(select k from jsonb_object_keys(response->'activationEvidence') k order by k)
              = array['approvalEvidenceHash', 'key', 'policyHash', 'requiredCapabilities', 'requiredDecisionCount', 'riskClass', 'version']
    and jsonb_typeof(response->'activationEvidence'->'requiredCapabilities') = 'array'
    and (response->'activationEvidence'->>'requiredDecisionCount')::int between 1 and 8
    from s09d_activated),
  'the CMS-03A-04 frozen WorkflowPolicyEvidence is exactly key, version, policyHash, riskClass, requiredDecisionCount (1 to 8), requiredCapabilities and approvalEvidenceHash [P2-S09-AC-090]');
select ok(exists (select 1 from s09d_activated a, platform_private.cms_workflow_policies policy
    where policy.policy_key = a.response->'activationEvidence'->>'key'
      and policy.policy_version = (a.response->'activationEvidence'->>'version')::int
      and policy.policy_hash::text = a.response->'activationEvidence'->>'policyHash'
      and policy.risk_class::text = a.response->'activationEvidence'->>'riskClass'
      and policy.required_decision_count = (a.response->'activationEvidence'->>'requiredDecisionCount')::int
      and to_jsonb(policy.required_capabilities) = a.response->'activationEvidence'->'requiredCapabilities'),
  'every member of the frozen evidence equals the bound registry row (key, version, policyHash, riskClass, count, capabilities), not a value the caller supplied [P2-S09-AC-090]');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'active',
  'the candidate switched to active');
select ok(pg_temp.s09d_outcome('a:activate') = 'OK'
  and pg_temp.s09d_scalar('select count(*)::text from platform_private.cfg_config_change_reviews') = (select total from s09d_cfg_before),
  'DEFECT A: activation succeeded and neither read nor wrote any CFG review row [P2-S09-AC-634]');
select ok(pg_temp.s09d_outcome('a:activate') = 'OK'
  and (select count(*) = 1 from platform_private.outbox_events where event_type = 'cms.schema.activated.v1'
        and aggregate_id = pg_temp.s09d_id('a:version')),
  'one activation event is committed for the version [P2-S09-AC-101]');

-- Same-key replay on a fresh candidate returns the exact original resource.
select pg_temp.s09d_create_type('r', 'dec108actreplay');
select pg_temp.s09d_to_approved('r');
select ok(pg_temp.s09d_replay_pair('r:activate', 'platform_api.cms_activate_schema', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('r:type'), 'versionId', pg_temp.s09d_id('r:version'),
      'expectedVersion', pg_temp.s09d_version('r'), 'dryRunId', pg_temp.s09d_id('r:dryRun'),
      'approvalIds', pg_temp.s09d_approval_ids('r'), 'migrationPlanId', pg_temp.s09d_id('r:plan'),
      'idempotencyKey', 's09d-activate-replay-0001'), true),
  'an activation replay returns the exact original resource without a second switch');
select is(pg_temp.s09d_replay_changed('r:activate:mismatch', 'platform_api.cms_activate_schema', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('r:type'), 'versionId', pg_temp.s09d_id('r:version'),
      'expectedVersion', pg_temp.s09d_version('r'), 'dryRunId', pg_temp.s09d_id('r:dryRun'),
      'approvalIds', pg_temp.s09d_approval_ids('r'), 'migrationPlanId', pg_temp.s09d_id('r:plan'),
      'idempotencyKey', 's09d-activate-replay-0001'), jsonb_build_object('expectedVersion', '999'), true),
  'IDEMPOTENCY_MISMATCH', 'the activation key reused with a changed body is refused IDEMPOTENCY_MISMATCH (wire 409 CONFLICT)');

-- Authority drift after approval refuses activation (AC189 successor).
select pg_temp.s09d_create_type('d', 'dec108actdrift');
select pg_temp.s09d_to_approved('d');
-- Negative control: no command changes a type's owner capability, so the drift is
-- written by hand, under the RPC flag a hostile writer would set itself (a producer
-- no longer leaves it behind).
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_content_types set owner_capability = 'cms.schema_registry.read'
 where id = pg_temp.s09d_id('d:type');
update platform_private.cms_content_types set owner_capability = 'cms.schema_designer'
 where id = pg_temp.s09d_id('d:type');
select set_config('app.cms_rpc', '', true);
select is(pg_temp.s09d_read('cms_schema_reviews', 'state', pg_temp.s09d_id('d:review')), 'invalidated',
  'an owner-capability authority change invalidates the approved review [P2-S09-AC-632] [P2-S09-AC-102]');
select pg_temp.s09d_activate('d', 'owner');
select ok(pg_temp.s09d_outcome('d:activate') = 'CONFLICT'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('d:version')) <> 'active',
  'an invalidated review cannot activate the candidate');

-- Reviewer authority is rechecked at activation, not their old MFA (G10): an
-- assignment window that has ended no longer qualifies the recorded approval.
select pg_temp.s09d_create_type('v', 'dec108actexpiry');
select pg_temp.s09d_to_approved('v');
select pg_temp.s09d_timewarp('cms_schema_review_assignments', format($q$update platform_private.cms_schema_review_assignments
   set starts_at = clock_timestamp() - interval '2 hours', ends_at = clock_timestamp() - interval '1 second'
 where id = %L$q$, pg_temp.s09d_id('v:assignment:rev1')));
select pg_temp.s09d_activate('v', 'owner');
select ok(pg_temp.s09d_outcome('v:decide:rev1') = 'OK' and pg_temp.s09d_outcome('v:activate') = 'APPROVAL_INVALID'
  and pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('v:version')) <> 'active',
  'a reviewer whose assignment window ended no longer qualifies the approval at activation [P2-S09-AC-632] [P2-S09-AC-089] [P2-S09-AC-653]');

select ok(pg_temp.s09d_service_only('platform_api.cms_activate_schema(jsonb)')
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_activate_schema(jsonb)'), 'execute'), true),
  'activation stays service-role-only through the public wrapper');

select * from finish();
rollback;
