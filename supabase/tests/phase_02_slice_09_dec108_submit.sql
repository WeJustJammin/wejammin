\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-11 submit schema review (BE03a route row,
-- field matrix, SchemaReview table, "State machine and concurrency", G13).
-- Only a persisted, sealed, passed attempt produced by CMS-03A-10 and sealed by
-- the worker can be frozen; every refusal is atomic.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('a', 'dec108sub');
select pg_temp.s09d_dry_run('a');
select pg_temp.s09d_seal('a');
select pg_temp.s09d_submit('a');
select is(pg_temp.s09d_outcome('a:submit'), 'OK', 'CMS-03A-11 freezes a sealed, passed dry-run into a review [P2-S09-AC-383]');
select ok((select r->>'resourceKind' = 'schema_review' and r->>'state' = 'open'
    and r->>'contentTypeVersionId' = pg_temp.s09d_id('a:version')::text
    and r->>'riskClass' = 'ordinary' and (r->>'requiredDecisionCount')::int = 1
    and (r->>'distinctApprovalCount')::int = 0 and (r->>'recordedDecisionCount')::int = 0
    and jsonb_array_length(r->'decisions') = 0 and r->'approvalEvidenceHash' = 'null'::jsonb
    and r->'decidedAt' = 'null'::jsonb and r->>'dryRunId' = pg_temp.s09d_id('a:dryRun')::text
    and (r->'permittedNextActions') ? 'assign_reviewer'
    from (select pg_temp.s09d_resp('a:submit') r) s),
  'the 201 SchemaReviewResource is open, ordinary (1 decision), undecided, and points the owner to assignment [P2-S09-AC-373]');
select ok((select r->'frozenEvidence' ?& array['contentTypeVersionId','contentTypeVersionNo','definitionHash',
      'schemaArtifact','dependencyManifestHash','dryRun']
    and r->'frozenEvidence'->>'definitionHash' ~ '^[a-f0-9]{64}$'
    and r->>'policyHash' ~ '^[a-f0-9]{64}$' and r->>'policyKey' is not null
    from (select pg_temp.s09d_resp('a:submit') r) s),
  'the frozen evidence summary and the code-owned policy snapshot are present [P2-S09-AC-372]');
select ok(coalesce((select bool_and(position(needle in pg_temp.s09d_resp('a:submit')::text) = 0)
    from (values (pg_temp.s09d_actor_id('owner', 'auth')), (pg_temp.s09d_actor_id('owner', 'person')),
      (pg_temp.s09d_actor_id('owner', 'binding')), (pg_temp.s09d_actor_id('owner', 'party'))) n(needle)
    where pg_temp.s09d_resp('a:submit') is not null), false),
  'the resource carries no actor, person, party or private acting-context binding identifier');
select is(pg_temp.s09d_read('cms_content_type_versions', 'state', pg_temp.s09d_id('a:version')), 'review',
  'draft -> review commits atomically with the review [P2-S09-AC-388]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    review.state = 'open' and review.definition_hash = version.definition_hash
    and review.schema_artifact_id = version.schema_artifact_id
    and review.content_type_version_id = version.id and review.dry_run_id = %2$L
    and review.dry_run_report_hash ~ '^[a-f0-9]{64}$' and review.context_hash ~ '^[a-f0-9]{64}$'
    and review.dependency_manifest_hash ~ '^[a-f0-9]{64}$' and review.compiler_version = '1'
    and review.candidate_version_no = version.version_no
    and review.required_decision_count between 1 and 8
    and review.submitter_person_ref = %3$L and review.owner_id = version.owner_id)::text
  from platform_private.cms_schema_reviews review
  join platform_private.cms_content_type_versions version on version.id = review.content_type_version_id
  where review.id = %1$L$q$, pg_temp.s09d_id('a:review'), pg_temp.s09d_id('a:dryRun'),
  pg_temp.s09d_actor_id('owner', 'person')))::boolean, false),
  'the persisted review freezes the candidate hash, artifact, dry-run, dependency, context and submitter [P2-S09-AC-372]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from audit_private.audit_events where target_id = %1$L) >= 1
    and (select count(*) from platform_private.outbox_events where aggregate_id = %1$L) >= 1)::text$q$,
  pg_temp.s09d_id('a:review')))::boolean, false),
  'the freeze writes its audit and outbox evidence in the same transaction');

-- Same-key replay on a fresh candidate.
select pg_temp.s09d_create_type('r', 'dec108subreplay');
select pg_temp.s09d_dry_run('r');
select pg_temp.s09d_seal('r');
select ok(pg_temp.s09d_replay_pair('r:submit', 'platform_api.cms_submit_schema_review', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('r:type'), 'versionId', pg_temp.s09d_id('r:version'),
      'expectedVersion', pg_temp.s09d_version('r'), 'dryRunId', pg_temp.s09d_id('r:dryRun'),
      'idempotencyKey', 's09d-submit-replay-0001'), true),
  'a same-key replay returns the exact original review and freezes nothing twice [P2-S09-AC-387]');
select is(pg_temp.s09d_replay_changed('r:submit:mismatch', 'platform_api.cms_submit_schema_review', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('r:type'), 'versionId', pg_temp.s09d_id('r:version'),
      'expectedVersion', pg_temp.s09d_version('r'), 'dryRunId', pg_temp.s09d_id('r:dryRun'),
      'idempotencyKey', 's09d-submit-replay-0001'), jsonb_build_object('expectedVersion', '999'), true),
  'IDEMPOTENCY_MISMATCH', 'the submission key reused with a changed body is refused IDEMPOTENCY_MISMATCH (wire 409 CONFLICT) [P2-S09-AC-396]');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_schema_reviews where content_type_version_id = %L',
    pg_temp.s09d_id('r:version'))), '1', 'exactly one review exists for the replayed submission');

-- Evidence a review must refuse.
select pg_temp.s09d_create_type('u', 'dec108subqueued');
select pg_temp.s09d_dry_run('u');
select pg_temp.s09d_rpc('u:submit', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('u:type'), 'versionId', pg_temp.s09d_id('u:version'),
    'expectedVersion', pg_temp.s09d_version('u'), 'dryRunId', pg_temp.s09d_id('u:dryRun'),
    'idempotencyKey', 's09d-submit-queued-0001'), true);
select is(pg_temp.s09d_outcome('u:submit'), 'CONFLICT',
  'a queued (unsealed) dry-run is not a passed dry-run: 409 CONFLICT [P2-S09-AC-366] [P2-S09-AC-384]');
select pg_temp.s09d_create_type('p', 'dec108subpseudo');
select pg_temp.s09d_rpc('p:submit', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('p:type'), 'versionId', pg_temp.s09d_id('p:version'),
    'expectedVersion', pg_temp.s09d_version('p'),
    'dryRunId', extensions.gen_random_uuid(), 'idempotencyKey', 's09d-submit-pseudo-0001'), true);
select ok(pg_temp.s09d_outcome('p:create') = 'OK'
  and pg_temp.s09d_outcome('p:submit') = 'CONFLICT',
  'a dryRunId that is no persisted CMS-03A-10 attempt (a candidate with no dry-run at all) cannot be frozen [P2-S09-AC-366]');
select pg_temp.s09d_rpc('p:foreign', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('p:type'), 'versionId', pg_temp.s09d_id('p:version'),
    'expectedVersion', pg_temp.s09d_version('p'), 'dryRunId', pg_temp.s09d_id('r:dryRun'),
    'idempotencyKey', 's09d-submit-foreign-0001'), true);
select ok(pg_temp.s09d_id('r:dryRun') is not null and pg_temp.s09d_outcome('p:foreign') = 'CONFLICT',
  'a sealed dry-run of a different candidate cannot be reused (same candidate/evidence only) [P2-S09-AC-366]');
select pg_temp.s09d_create_type('d', 'dec108subdrift');
select pg_temp.s09d_dry_run('d');
select pg_temp.s09d_seal('d');
select pg_temp.s09d_add_relation('d');
select pg_temp.s09d_rpc('d:submit', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('d:type'), 'versionId', pg_temp.s09d_id('d:version'),
    'expectedVersion', pg_temp.s09d_version('d'), 'dryRunId', pg_temp.s09d_id('d:dryRun'),
    'idempotencyKey', 's09d-submit-drift-0001'), true);
select ok(pg_temp.s09d_outcome('d:relation') <> 'MISSING' and pg_temp.s09d_outcome('d:submit') = 'VALIDATION_FAILED',
  'a candidate edited after its dry-run sealed no longer matches that evidence and cannot be frozen: exactly VALIDATION_FAILED (422) [P2-S09-AC-366] [P2-S09-AC-398]');

-- One live review, authority and request shape (all atomic).
create temp table s09d_refusal_baseline on commit drop as select pg_temp.s09d_fingerprint(false) as fingerprint;
select pg_temp.s09d_rpc('a:again', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'dryRunId', pg_temp.s09d_id('a:dryRun'),
    'idempotencyKey', 's09d-submit-second-0001'), true);
select is(pg_temp.s09d_outcome('a:again'), 'CONFLICT', 'a second live review for the exact frozen evidence is a 409 CONFLICT [P2-S09-AC-385]');
select pg_temp.s09d_rpc('a:stale', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', '999', 'dryRunId', pg_temp.s09d_id('a:dryRun'), 'idempotencyKey', 's09d-submit-stale-0001'), true);
select is(pg_temp.s09d_outcome('a:stale'), 'VERSION_MISMATCH', 'a stale draft CAS version is a 409 VERSION_MISMATCH');
select pg_temp.s09d_rpc('a:hidden', 'platform_api.cms_submit_schema_review', 'other',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'dryRunId', pg_temp.s09d_id('a:dryRun'),
    'idempotencyKey', 's09d-submit-hidden-0001'), true);
select is(pg_temp.s09d_outcome('a:hidden'), 'NOT_FOUND', 'another organization''s candidate is concealed as 404 [P2-S09-AC-384]');
select pg_temp.s09d_rpc('a:denied', 'platform_api.cms_submit_schema_review', 'rev1',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'dryRunId', pg_temp.s09d_id('a:dryRun'),
    'idempotencyKey', 's09d-submit-denied-0001'), true, jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')));
select is(pg_temp.s09d_outcome('a:denied'), 'FORBIDDEN', 'a human without cms.schema_designer is a 403 FORBIDDEN [P2-S09-AC-383]');
select pg_temp.s09d_rpc('a:extra', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'dryRunId', pg_temp.s09d_id('a:dryRun'),
    'idempotencyKey', 's09d-submit-extra-0001', 'requiredDecisionCount', 1), true);
select is(pg_temp.s09d_outcome('a:extra'), 'INVALID_REQUEST',
  'a caller-supplied policy field is an unknown key: the policy is never caller-authoritative [P2-S09-AC-373]');
select pg_temp.s09d_rpc('a:nokey', 'platform_api.cms_submit_schema_review', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'dryRunId', pg_temp.s09d_id('a:dryRun')), true);
select is(pg_temp.s09d_outcome('a:nokey'), 'INVALID_REQUEST', 'a missing Idempotency-Key is a 400 INVALID_REQUEST');
select ok(pg_temp.s09d_outcome('a:submit') = 'OK'
  and pg_temp.s09d_fingerprint(false) = (select fingerprint from s09d_refusal_baseline),
  'every refusal leaves versions, reviews, idempotency and outbox unchanged');
-- Downgrade guard (strictest-of): a successor whose own workflow key is ordinary is
-- still reviewed under the protected source policy it supersedes.
select pg_temp.s09d_create_type('sp', 'dec108subprotected', 'cms.disclosure.policy');
select pg_temp.s09d_grant_specialist('rev1', 'cms.reviewer.policy');
select pg_temp.s09d_to_active('sp', array['rev1', 'rev2']);
-- The ordinary key is requested through the CMS-03A-09 producer (workflowKey/workflowVersion), not written by hand.
select pg_temp.s09d_successor('sq', 'sp', 'owner', null, null, null, null, null, 'editorial', '1');
select ok(pg_temp.s09d_outcome('sq:successor') = 'OK'
  and pg_temp.s09d_resp('sq:successor')->>'workflowKey' = 'editorial' and pg_temp.s09d_resp('sq:successor')->>'workflowVersion' = '1'
  and pg_temp.s09d_read('cms_content_type_versions', 'workflow_key', pg_temp.s09d_id('sq:version')) = 'editorial'
  and pg_temp.s09d_read('cms_content_type_versions', 'workflow_key', pg_temp.s09d_id('sp:version')) = 'cms.disclosure.policy',
  'CMS-03A-09 produces a successor under the requested ordinary workflow key and leaves the protected source untouched [P2-S09-AC-390]');
select pg_temp.s09d_dry_run('sq');
select pg_temp.s09d_seal('sq');
select pg_temp.s09d_submit('sq');
select ok(pg_temp.s09d_outcome('sp:activate') = 'OK' and pg_temp.s09d_outcome('sq:submit') = 'OK'
  and (select r->>'riskClass' = 'protected' and (r->>'requiredDecisionCount')::int = 2
        and r->>'policyKey' = 'editorial'
        and r->'requiredCapabilities' = '["cms.reviewer", "cms.reviewer.policy"]'::jsonb
      from (select pg_temp.s09d_resp('sq:submit') r) s)
  and pg_temp.s09d_scalar(format($q$select (source_policy_key = 'cms.disclosure.policy' and source_policy_version = 1
      and source_policy_hash ~ '^[a-f0-9]{64}$')::text from platform_private.cms_schema_reviews where id = %L$q$,
      pg_temp.s09d_id('sq:review')))::boolean,
  'a successor under an ordinary key keeps the protected source requirement (count, specialist slot) and freezes the source policy [P2-S09-AC-390]');

select ok(pg_temp.s09d_service_only('platform_api.cms_submit_schema_review(jsonb)')
  and to_regprocedure('platform_private.cms_submit_schema_review(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_submit_schema_review(jsonb)'), 'execute'), true),
  'the submit RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
