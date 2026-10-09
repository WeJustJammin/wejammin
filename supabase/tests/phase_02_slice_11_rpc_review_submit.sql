-- Slice 11 lane S11-3a: platform_api.cms_submit_review / platform_private (CMS-03B-05, E1, E2, D19;
-- tracker P2-S11-AC-005 .. AC-010, AC-035, AC-085, AC-113, AC-120).  An entry assignee freezes one
-- draft revision for review: the stored payload hash is recomputed, the dependency manifest is
-- rebuilt and must equal the submitted one bit for bit, the submit-phase preflight (17 categories)
-- passes with the Worker's accessibility evidence, then the open review, its ReviewDependency rows,
-- one audit record, one cms.entry.review-changed.v1 and the completed idempotency record commit
-- together.  This file covers the contract and the committed effects; the refusals are in
-- phase_02_slice_11_rpc_review_submit_refusals.sql.  RED before 20261005017640.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(30);

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_schema/000-helpers.sqlinc
\ir phase_02_slice_11_schema/001-fixture.sqlinc
\ir phase_02_slice_11_schema/002-row-builders.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_11_helpers/002-reviews.sqlinc
\ir phase_02_slice_11_rpc_review/000-world.sqlinc
\ir phase_02_slice_11_rpc_review/030-submit.sqlinc

create temp table r11_req(label text primary key, request jsonb not null) on commit drop;
create temp table r11_snap(label text primary key, effects text not null) on commit drop;

select pg_temp.r11_entry('sub-1');
select pg_temp.r11_entry('sub-editor', 'creator');
select pg_temp.r11_entry('sub-again');

select ok(pg_temp.r11_posture('platform_private', 'cms_submit_review(jsonb)'),
  'cms_submit_review is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-010]');
select ok(pg_temp.r11_posture('platform_api', 'cms_submit_review(jsonb)'),
  'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-010]');
select ok(
  (select report->>'passed' = 'true' from (select platform_private.cms_evaluate_preflight(jsonb_build_object(
      'phase', 'submit', 'revisionId', pg_temp.h11w_uuid('sub-1:revision'), 'actingPartyId', pg_temp.s11_id('org'),
      'actorPersonId', pg_temp.s11_id('creator'), 'effectiveAt', platform_private.auth_iso_time(clock_timestamp()),
      'evidence', pg_temp.r11_evidence(pg_temp.h11w_uuid('sub-1:revision')),
      'frozenManifest', pg_temp.r11_manifest(pg_temp.h11w_uuid('sub-1:revision')))) as report) as evaluated),
  'control: the baseline revision passes all seventeen preflight categories (so a refusal below is about the case under test)');

-- ---------------------------------------------------------------------------
-- The committed result.
-- ---------------------------------------------------------------------------
insert into r11_req(label, request) values ('s1', pg_temp.r11_sreq('sub-1'));
insert into r11_snap(label, effects) values ('before-s1', pg_temp.r11_effects());
select pg_temp.r11_scall('s1', 'owner', (select request from r11_req where label = 's1'));
select is(pg_temp.r11_out('s1'), '00000:', 'an entry assignee freezes the current draft revision for review [P2-S11-AC-005]');
select is(pg_temp.r11_keys(pg_temp.r11_resp('s1')),
  'activationEvidence,createdAt,decidedAt,dependencyHash,entryId,frozenHash,id,invalidatedReason,recordedDecisionCount,requiredDecisionCount,revisionId,riskClass,state,submittedAt,updatedAt,version,workflowPolicy',
  'the response is exactly EditorialReviewResource (17 members) [P2-S11-AC-005]');
select ok(
  pg_temp.r11_resp('s1')->>'state' = 'open' and pg_temp.r11_resp('s1')->>'version' = '1'
    and pg_temp.r11_resp('s1')->>'entryId' = pg_temp.h11w_uuid('sub-1:entry')::text
    and pg_temp.r11_resp('s1')->>'revisionId' = pg_temp.h11w_uuid('sub-1:revision')::text
    and pg_temp.r11_resp('s1')->>'riskClass' = 'ordinary'
    and pg_temp.r11_resp('s1')#>>'{workflowPolicy,key}' = 'editorial'
    and (pg_temp.r11_resp('s1')->>'requiredDecisionCount')::integer = 1
    and (pg_temp.r11_resp('s1')->>'recordedDecisionCount')::integer = 0
    and pg_temp.r11_resp('s1')->'invalidatedReason' = 'null'::jsonb and pg_temp.r11_resp('s1')->'decidedAt' = 'null'::jsonb
    and pg_temp.r11_resp('s1')->>'frozenHash' = (select payload_hash from platform_private.cms_entry_revisions where id = pg_temp.h11w_uuid('sub-1:revision'))
    and pg_temp.r11_resp('s1')->>'dependencyHash' = platform_private.cms_jcs_sha256((select request->'dependencyManifest' from r11_req where label = 's1'))
    and pg_temp.r11_resp('s1')->'activationEvidence' = (select request->'dependencyManifest'->'schema'->'activationEvidence' from r11_req where label = 's1')
    and pg_temp.r11_resp('s1')#>'{workflowPolicy}' = (select request->'dependencyManifest'->'schema'->'workflowPolicy' from r11_req where label = 's1'),
  'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]');
select ok(
  not pg_temp.r11_leaks(pg_temp.r11_resp('s1'), array[
    pg_temp.s11_id('creator')::text, pg_temp.s11_id('org')::text, (select auth_user_id::text from r11_actor where key = 'owner')]),
  'the response carries no submitter, author, owner, party or account identifier [P2-S11-AC-007]');
select ok(
  exists (
    select 1 from platform_private.cms_editorial_reviews review
     where review.id = (pg_temp.r11_resp('s1')->>'id')::uuid
       and review.owner_id = pg_temp.s11_id('org') and review.submitted_by = pg_temp.s11_id('creator')
       and review.entry_id = pg_temp.h11w_uuid('sub-1:entry') and review.revision_id = pg_temp.h11w_uuid('sub-1:revision')
       and review.state = 'open' and review.version = 1 and review.recorded_decision_count = 0
       and review.dependency_manifest = (select request->'dependencyManifest' from r11_req where label = 's1')
       and review.workflow_policy_key = 'editorial' and review.workflow_policy_version = 1
       and review.workflow_policy_hash = (select request->'dependencyManifest'#>>'{schema,workflowPolicy,policyHash}' from r11_req where label = 's1')
       and review.approval_evidence_hash = (select request->'dependencyManifest'#>>'{schema,workflowPolicy,approvalEvidenceHash}' from r11_req where label = 's1')
       and review.required_capabilities = '["cms.reviewer"]'::jsonb and review.required_decision_count = 1
       and review.risk_class = 'ordinary' and review.invalidated_reason is null and review.decided_at is null
       and review.created_at = review.updated_at and review.submitted_at = review.created_at),
  'the row stores the server-derived submitter, owner, frozen hash, manifest, policy evidence and capability slots [P2-S11-AC-120]');
select ok(
  (select count(*) from platform_private.cms_editorial_review_dependencies dependency
    where dependency.review_id = (pg_temp.r11_resp('s1')->>'id')::uuid) > 0
    and not exists (
      (select kind, ref_id from platform_private.cms_review_dependency_refs(
         pg_temp.h11w_uuid('sub-1:revision'), (select request->'dependencyManifest' from r11_req where label = 's1')))
      except
      (select dependency.kind, dependency.ref_id from platform_private.cms_editorial_review_dependencies dependency
        where dependency.review_id = (pg_temp.r11_resp('s1')->>'id')::uuid))
    and not exists (
      (select dependency.kind, dependency.ref_id from platform_private.cms_editorial_review_dependencies dependency
        where dependency.review_id = (pg_temp.r11_resp('s1')->>'id')::uuid)
      except
      (select kind, ref_id from platform_private.cms_review_dependency_refs(
         pg_temp.h11w_uuid('sub-1:revision'), (select request->'dependencyManifest' from r11_req where label = 's1')))),
  'the ReviewDependency rows are exactly the (kind, ref_id) identities of the frozen manifest, written with the review [P2-S11-AC-113]');
select ok(
  exists (select 1 from platform_private.cms_editorial_review_dependencies dependency
           where dependency.review_id = (pg_temp.r11_resp('s1')->>'id')::uuid and dependency.kind = 'schema'
             and dependency.ref_id = (select request->'dependencyManifest'#>>'{schema,id}' from r11_req where label = 's1')::uuid)
    and exists (select 1 from platform_private.cms_editorial_review_dependencies dependency
                 join platform_private.cms_publication_settings_snapshots snapshot on snapshot.id = dependency.ref_id
                 where dependency.review_id = (pg_temp.r11_resp('s1')->>'id')::uuid and dependency.kind = 'settings'
                   and snapshot.ordinal::text = (select request->'dependencyManifest'#>>'{settings,version}' from r11_req where label = 's1')),
  'a schema row names the schema version id and a settings row names the settings snapshot row [P2-S11-AC-113]');
select ok(
  exists (select 1 from platform_private.cms_content_entries entry
           where entry.id = pg_temp.h11w_uuid('sub-1:entry') and entry.version = 1
             and entry.current_draft_revision_id = pg_temp.h11w_uuid('sub-1:revision') and entry.updated_at = entry.created_at),
  'submitting leaves the entry aggregate (version, draft pointer, updated_at) untouched [P2-S11-AC-005]');
select is(platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('sub-1:revision')), 'submitted',
  'the revision''s derived state becomes submitted (E2) [P2-S11-AC-085]');
select ok(
  (select count(*) = 1 from audit_private.audit_events audit
    where audit.action = 'cms.editorial.review.submit' and audit.target_type = 'cms_editorial_review'
      and audit.target_id = (pg_temp.r11_resp('s1')->>'id')::uuid
      and audit.actor_id = (select auth_user_id from r11_actor where key = 'owner')
      and audit.acting_party_id = pg_temp.s11_id('org') and audit.reason_code = 'CMS_EDITORIAL_REVIEW_SUBMITTED')
    and (select count(*) = 1 from platform_private.outbox_events event
          where event.event_type = 'cms.entry.review-changed.v1' and event.aggregate_type = 'cms_editorial_review'
            and event.aggregate_id = (pg_temp.r11_resp('s1')->>'id')::uuid and event.aggregate_version = 1
            and event.payload = jsonb_build_object('reviewId', (pg_temp.r11_resp('s1')->>'id')::uuid,
                  'revisionId', pg_temp.h11w_uuid('sub-1:revision'))),
  'exactly one audit record and one identifier-only cms.entry.review-changed.v1 commit with the review [P2-S11-AC-010]');
select is(pg_temp.s10_reservation_status((select request->>'idempotencyKey' from r11_req where label = 's1')), 'completed',
  'the idempotency reservation is completed with the command [P2-S11-AC-008]');

-- Replay and mismatch.
insert into r11_snap(label, effects) values ('after-s1', pg_temp.r11_effects());
select pg_temp.r11_scall('s1-replay', 'owner', (select request from r11_req where label = 's1'));
select ok(pg_temp.r11_out('s1-replay') = '00000:' and pg_temp.r11_resp('s1-replay') = pg_temp.r11_resp('s1')
    and pg_temp.r11_effects() = (select effects from r11_snap where label = 'after-s1'),
  'an exact replay returns the stored response although the revision is now under review, and adds no second review, dependency, audit record or event [P2-S11-AC-008]');
select pg_temp.r11_scall('s1-mismatch', 'owner', jsonb_set((select request from r11_req where label = 's1'), '{frozenHash}', to_jsonb(repeat('1', 64))));
select is(pg_temp.r11_out('s1-mismatch'), 'P0001:IDEMPOTENCY_MISMATCH', 'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-008]');

-- A second assignee (the editor, via a cms.editor assignment) submits another revision.
select pg_temp.r11_scall('s2', 'editor', pg_temp.r11_sreq('sub-editor'), false);
select ok(pg_temp.r11_out('s2') = '00000:' and pg_temp.r11_resp('s2')->>'state' = 'open'
    and not pg_temp.r11_leaks(pg_temp.r11_resp('s2'), array[pg_temp.s11_id('editor')::text]),
  'an editor assigned with cms.editor may submit; the submitter identity stays server-side [P2-S11-AC-007]');

-- Resubmission: an invalidated review returns its revision to draft and it may be submitted again.
select pg_temp.r11_scall('r-first', 'owner', pg_temp.r11_sreq('sub-again'));
select set_config('app.cms_rpc', 'true', true);
update platform_private.cms_editorial_reviews
   set state = 'invalidated', invalidated_reason = 'dependency_changed', version = version + 1, updated_at = clock_timestamp()
 where id = (pg_temp.r11_resp('r-first')->>'id')::uuid;
select is(platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('sub-again:revision')), 'draft',
  'control: an invalidated review returns the revision to draft (E2)');
select pg_temp.r11_scall('r-second', 'owner', pg_temp.r11_sreq('sub-again'));
select ok(pg_temp.r11_out('r-second') = '00000:' and pg_temp.r11_resp('r-second')->>'id' <> pg_temp.r11_resp('r-first')->>'id'
    and (select count(*) from platform_private.cms_editorial_reviews where revision_id = pg_temp.h11w_uuid('sub-again:revision')) = 2
    and platform_private.cms_revision_effective_state(pg_temp.h11w_uuid('sub-again:revision')) = 'submitted',
  'the same revision is resubmitted after an invalidation: a second review row, the first kept as history [P2-S11-AC-085]');

-- Protected policy: the world version is re-bound to cms.disclosure.policy (two humans, one holding the
-- specialist capability cms.reviewer.policy); the review freezes the strictest-of evidence of the manifest.
select pg_temp.h11_raw_exec('platform_private.cms_content_type_versions', format(
  $q$update platform_private.cms_content_type_versions
        set workflow_key = %L, workflow_version = 1, activation_workflow_policy_key = %L,
            activation_workflow_policy_version = 1, activation_workflow_policy_hash = %L,
            activation_required_decision_count = %s, activation_required_capabilities = %L::jsonb
      where id = %L$q$,
  'cms.disclosure.policy', 'cms.disclosure.policy',
  platform_private.cms_workflow_policy_member('cms.disclosure.policy', 1)->>'policyHash',
  platform_private.cms_workflow_policy_member('cms.disclosure.policy', 1)->>'requiredDecisionCount',
  (platform_private.cms_workflow_policy_member('cms.disclosure.policy', 1)->'requiredCapabilities')::text,
  pg_temp.h11w_version()));
select pg_temp.r11_entry('sub-protected');
select pg_temp.r11_scall('prot', 'owner', pg_temp.r11_sreq('sub-protected'), false);
select ok(
  pg_temp.r11_out('prot') = '00000:' and pg_temp.r11_resp('prot')->>'riskClass' = 'protected'
    and (pg_temp.r11_resp('prot')->>'requiredDecisionCount')::integer = 2
    and pg_temp.r11_resp('prot')#>>'{workflowPolicy,key}' = 'cms.disclosure.policy'
    and pg_temp.r11_resp('prot')#>'{workflowPolicy,requiredCapabilities}' = '["cms.reviewer", "cms.reviewer.policy"]'::jsonb
    and pg_temp.r11_resp('prot')#>'{workflowPolicy}' = (select request->'dependencyManifest'#>'{schema,workflowPolicy}'
                                                          from (select pg_temp.r11_sreq('sub-protected') as request) built),
  'a protected policy freezes riskClass protected, two required decisions and the specialist slot from the manifest evidence [P2-S11-AC-120]');
select ok(
  pg_temp.r11_out('prot') = '00000:' and pg_temp.r11_resp('prot')->>'state' = 'open',
  'the protected review opens like any other: open at version 1 [P2-S11-AC-005]');

select * from finish();
rollback;
