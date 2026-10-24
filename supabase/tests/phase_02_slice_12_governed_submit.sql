-- Slice 12 lane s12_governed_red, CMS-03C-06 (BE03c "Governed review machinery", "Governed policy
-- basis", "Subject state machine", "Authorization", "Database Schema" GovernedReview*; tracker
-- P2-S12-AC-064, AC-197, AC-205, AC-249, AC-251, AC-262).  A subject owner-capability holder
-- submits an existing draft template_version through the real governed command.  Two subjects are
-- prepared for the policy basis: a single-member ordinary basis (one bound type, seeded editorial v1)
-- and a two-member protected basis (the ordinary type plus a protected type bound to the seeded
-- cms.disclosure.policy member).  Then exact refusals cover capability 403 (capability_missing),
-- duplicate live 409 (subject_not_submittable), and an unresolvable bound policy 503
-- (DEPENDENCY_UNAVAILABLE).
--
-- AUTHORING ONLY / UNRUN: 60-assertion real-source continuation. The prior 48/48 diagnostic
-- used synthetic prerequisites; all historical receipts remain in the owned lane report.
--
-- The refusals are asserted to leave the COVERED stores identical (a scoped no-effect check, not a
-- full-store atomicity proof; see the snapshot helper comment in 000-fixtures.sqlinc).
--
-- Frozen-semantics note (DEC-188, owner-approved 2026-10-13): the governed definition version is
-- immutable and historical pins and the frozen review subjectVersion are unchanged; a separate
-- lifecycle_version advances exactly once per governed state transition (submit: draft -> review, +1).
-- This file asserts the frozen definition version (row.version / subjectVersion) and a +1 lifecycle_version
-- transition. QA020 adds completed-key replay, revoked-capability no-effects and exact grant restoration.

\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select plan(74);

-- Real initialization precedes legacy grants. Legacy seven controls are neighbor checks only.
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc
select pg_temp.s09d_session('owner', 'authenticated');
\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_11_helpers/001-world.sqlinc
\ir phase_02_slice_12_governed_submit/000-fixtures.sqlinc
\ir phase_02_slice_12_governed_submit/005-real-type-chains.sqlinc
\ir phase_02_slice_12_governed_submit/010-projection.sqlinc
\ir phase_02_slice_12_governed_submit/015-dependency-fault.sqlinc

create temp table s12gov_snap(label text primary key, snapshot text not null) on commit drop;

-- --------------------------------------------------------------------------- fixture integrity --
select is((select value from s12gov_ids where key = 'protectedCreateState'), '00000',
  'control: the protected content type is created through the production CMS-03A-01 command [P2-S12-AC-064]');
select ok(
  (select pg_temp.s12gov_evidence(
     (select value::uuid from s12gov_ids where key = 'protectedVersion')))->>'riskClass' = 'protected',
  'control: the production policy-evidence seam resolves the protected member for the protected version (else the basis fixture is broken) [P2-S12-AC-064]');
select ok(
  (select pg_temp.s12gov_resolve(
     'template_version', (select value::uuid from s12gov_ids where key = 'subject'))->>'state') = 'draft'
    and (select pg_temp.s12gov_resolve(
     'template_version', (select value::uuid from s12gov_ids where key = 'protected'))->>'state') = 'draft',
  'control: both submit subjects resolve to draft template_versions in the caller owner scope [P2-S12-AC-205]');
select matches(
  (select pg_temp.s12gov_resolve(
     'template_version', (select value::uuid from s12gov_ids where key = 'subject'))->>'contentHash'),
  '^[a-f0-9]{64}$',
  'control: the subject content hash is 64 lowercase hex, the frozen subject hash shape [P2-S12-AC-249]');
select is(
  coalesce(pg_catalog.current_setting('app.cms_rpc', true), ''),
  '',
  'control: the internal projection wrappers restored app.cms_rpc to its prior empty value before the public commands [P2-S12-AC-064]');
select is(
  (select pg_catalog.string_agg(bound.id::text, ',' order by bound.id)
     from pg_catalog.jsonb_array_elements_text(
       (select compatible_type_ids from platform_private.cms_template_versions
         where id = (select value::uuid from s12gov_ids where key = 'protected'))) element(value)
     join lateral (select element.value::uuid as id) bound on true),
  (select pg_catalog.string_agg(bound.id::text, ',' order by bound.id) from (
     select (select value::uuid from s12gov_ids where key = k) as id
       from pg_catalog.unnest(ARRAY['typeA', 'protectedType']) k) bound),
  'control: the protected template binds exactly the two expected content type ids [P2-S12-AC-064]');

-- -------------------------------------------------------------- the command is a real named RPC --
select has_function('platform_api', 'cms_submit_governed_review', array['jsonb'],
  'CMS-03C-06 has a named platform API RPC [P2-S12-AC-064]');
select has_function('platform_private', 'cms_submit_governed_review', array['jsonb'],
  'CMS-03C-06 has an atomic private implementation [P2-S12-AC-064]');

-- ----------------------------------------------------- subject A: single-member ordinary basis --
select pg_temp.s12gov_as('Creator');
select pg_temp.s12gov_submit(pg_temp.s12gov_request(
  (select value::uuid from s12gov_ids where key = 'subject'),
  pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject')),
  's12gov-submit-0001'));
select pg_temp.s12gov_capture('subject');
select is(pg_temp.s12gov_state('subject'), '00000',
  'an owner-capability holder submits an existing draft template_version [P2-S12-AC-064]');
select is(
  pg_catalog.array_to_string(
    (select array_agg(key order by key) from pg_catalog.jsonb_object_keys(pg_temp.s12gov_body('subject')) key), ','),
  'activatedAt,contentHash,createdAt,decidedAt,id,invalidatedReason,lineageId,policyBasisHash,'
    || 'recordedDecisionCount,requiredCapabilities,requiredDecisionCount,riskClass,state,subjectHash,'
    || 'subjectId,subjectKey,subjectKind,subjectVersion,submittedAt,updatedAt,version',
  'the 201 body is exactly GovernedReviewResource (21 members) [P2-S12-AC-064]');
select ok(
  pg_temp.s12gov_body('subject')->>'state' = 'open'
    and pg_temp.s12gov_body('subject')->>'version' = '1'
    and pg_temp.s12gov_body('subject')->>'subjectKind' = 'template_version'
    and pg_temp.s12gov_body('subject')->>'subjectId' = (select value from s12gov_ids where key = 'subject')
    and pg_temp.s12gov_body('subject')->>'lineageId' = (select value from s12gov_ids where key = 'subject:lineage')
    and pg_temp.s12gov_body('subject')->>'subjectKey' = 's12gov-subject'
    and (pg_temp.s12gov_body('subject')->>'subjectVersion')::bigint = 1
    and pg_temp.s12gov_body('subject')->>'subjectHash' = pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject'))
    and pg_temp.s12gov_body('subject')->>'riskClass' = 'ordinary'
    and (pg_temp.s12gov_body('subject')->>'requiredDecisionCount')::integer = 1
    and (pg_temp.s12gov_body('subject')->>'recordedDecisionCount')::integer = 0
    and pg_temp.s12gov_body('subject')->'requiredCapabilities' = '["cms.reviewer"]'::jsonb
    and pg_temp.s12gov_body('subject')->'decidedAt' = 'null'::jsonb
    and pg_temp.s12gov_body('subject')->'activatedAt' = 'null'::jsonb
    and pg_temp.s12gov_body('subject')->'invalidatedReason' = 'null'::jsonb,
  'the review is open at version 1 and freezes the subject definition hash, the single-member policy basis and the block digest [P2-S12-AC-064]');
-- The exact server-derived freeze, recomputed independently from the fixture.  The one bound content
-- type resolves the seeded editorial member; the basis is its { contentTypeId, policyKey,
-- policyVersion, policyHash } (BE03c:1317) and policyBasisHash is its JCS SHA-256.
select ok(
  pg_temp.s12gov_body('subject')->>'policyBasisHash' = platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'contentTypeId', (select value from s12gov_ids where key = 'typeA')::uuid,
      'policyKey', 'editorial', 'policyVersion', 1::bigint,
      'policyHash', platform_private.cms_workflow_policy_hash('editorial', 1, 'ordinary', 1, '["cms.reviewer"]'::jsonb))))
  and pg_temp.s12gov_body('subject')->>'contentHash' = platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
    'subjectKind', 'template_version',
    'subjectId', (select value from s12gov_ids where key = 'subject')::uuid,
    'subjectHash', pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject')),
    'policyBasisHash', platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'contentTypeId', (select value from s12gov_ids where key = 'typeA')::uuid,
        'policyKey', 'editorial', 'policyVersion', 1::bigint,
        'policyHash', platform_private.cms_workflow_policy_hash('editorial', 1, 'ordinary', 1, '["cms.reviewer"]'::jsonb)))),
    'requiredDecisionCount', 1,
    'requiredCapabilities', '["cms.reviewer"]'::jsonb)),
  'the frozen policy-basis hash and review content hash equal the server recomputation from the fixture [P2-S12-AC-064]');
select ok(
  exists (
    select 1 from platform_private.cms_governed_reviews review
     where review.id = (pg_temp.s12gov_body('subject')->>'id')::uuid
       and review.state = 'open' and review.version = 1
       and review.subject_kind = 'template_version'
       and review.subject_id = (select value::uuid from s12gov_ids where key = 'subject')
       and review.lineage_id = (select value::uuid from s12gov_ids where key = 'subject:lineage')
       and review.subject_key = 's12gov-subject'
       and review.subject_version = 1
       and review.subject_hash = pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject'))
       and review.submitted_by = (select value::uuid from s12gov_ids where key = 'personCreator')
       and review.recorded_decision_count = 0
       and review.block_registry_digest = pg_catalog.encode(extensions.digest('[]'::bytea, 'sha256'), 'hex')
       and review.policy_basis_hash = platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_array(
             pg_catalog.jsonb_build_object(
               'contentTypeId', (select value from s12gov_ids where key = 'typeA')::uuid,
               'policyKey', 'editorial', 'policyVersion', 1::bigint,
               'policyHash', platform_private.cms_workflow_policy_hash('editorial', 1, 'ordinary', 1, '["cms.reviewer"]'::jsonb))))
       and review.required_capabilities = '["cms.reviewer"]'::jsonb
       and review.risk_class = 'ordinary' and review.required_decision_count = 1
       and review.decided_at is null and review.activated_at is null and review.invalidated_reason is null),
  'the GovernedReview row stores the server-derived submitter, the frozen basis, the recomputed digest and the content hash [P2-S12-AC-197]');
select ok(
  (select count(*) from platform_private.cms_governed_review_dependencies dependency
    where dependency.review_id = (pg_temp.s12gov_body('subject')->>'id')::uuid
      and dependency.kind = 'content_type'
      and dependency.ref_id = (select value::uuid from s12gov_ids where key = 'typeVersionA')) = 1,
  'the review freezes its dependency identity, the bound content-type version [P2-S12-AC-249]');
select is(
  (select state from platform_private.cms_template_versions
    where id = (select value::uuid from s12gov_ids where key = 'subject')),
  'review',
  'submit moves the draft subject to review [P2-S12-AC-205]');
-- DEC-188: the definition version is immutable and the separate lifecycle counter advances by one on the
-- draft -> review transition.
select ok(
  (select version = 1 and lifecycle_version = 2
     from platform_private.cms_template_versions
    where id = (select value::uuid from s12gov_ids where key = 'subject')),
  'submit advances the separate lifecycle_version by one while the definition version stays 1 (DEC-188) [P2-S12-AC-205]');
select is(
  (select count(*)::integer from audit_private.audit_events
    where target_id = (pg_temp.s12gov_body('subject')->>'id')::uuid
      and actor_id = (select value::uuid from s12gov_ids where key = 'authCreator')),
  1,
  'submit writes exactly one audit record for the review [P2-S12-AC-251]');
select is(
  (select count(*)::integer from platform_private.outbox_events
    where aggregate_id = (pg_temp.s12gov_body('subject')->>'id')::uuid),
  0,
  'submit emits no outbox event (submission emits no event; activation and retirement are the emitting governed commands) [P2-S12-AC-251]');

-- ------------------------------------ subject B: two-member protected basis (strictest-of) --
-- The protected subject binds the ordinary type AND a protected type, so the basis has two members
-- and the strictest-of resolution must yield protected / 2 decisions / [cms.reviewer, cms.reviewer.policy].
select pg_temp.s12gov_as('Creator');
select pg_temp.s12gov_submit(pg_temp.s12gov_request(
  (select value::uuid from s12gov_ids where key = 'protected'),
  pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'protected')),
  's12gov-submit-0002'));
select pg_temp.s12gov_capture('protected');
select is(pg_temp.s12gov_state('protected'), '00000',
  'an owner-capability holder submits a subject whose basis has a protected member [P2-S12-AC-064]');
select ok(
  pg_temp.s12gov_body('protected')->>'riskClass' = 'protected'
    and (pg_temp.s12gov_body('protected')->>'requiredDecisionCount')::integer = 2
    and pg_temp.s12gov_body('protected')->'requiredCapabilities' = '["cms.reviewer","cms.reviewer.policy"]'::jsonb
    and pg_temp.s12gov_body('protected')->>'policyBasisHash' = platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'contentTypeId', (select value::uuid from s12gov_ids where key = 'protectedType'),
        'policyKey', 'cms.disclosure.policy', 'policyVersion', 1::bigint,
        'policyHash', platform_private.cms_workflow_policy_hash('cms.disclosure.policy', 1, 'protected', 2, '["cms.reviewer","cms.reviewer.policy"]'::jsonb)),
      pg_catalog.jsonb_build_object(
        'contentTypeId', (select value::uuid from s12gov_ids where key = 'typeA'),
        'policyKey', 'editorial', 'policyVersion', 1::bigint,
        'policyHash', platform_private.cms_workflow_policy_hash('editorial', 1, 'ordinary', 1, '["cms.reviewer"]'::jsonb)))),
  'the strictest-of basis over an ordinary and a protected member yields protected, two decisions, the union of slots and the sorted two-member basis hash [P2-S12-AC-064]');

-- ------------------------------------------------------------------------- refusals change nothing --
insert into s12gov_snap(label, snapshot)
values ('before', pg_temp.s12gov_snapshot((select value::uuid from s12gov_ids where key = 'subject')));

select pg_temp.s12gov_as('Editor');
select pg_temp.s12gov_submit(pg_temp.s12gov_request(
  (select value::uuid from s12gov_ids where key = 'subject'),
  pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject')),
  's12gov-submit-0003'));
select pg_temp.s12gov_capture('capability');
select is(pg_temp.s12gov_message('capability'), 'capability_missing',
  'a visible subject without the owner capability is refused 403 capability_missing [P2-S12-AC-262]');
select is(
  pg_temp.s12gov_snapshot((select value::uuid from s12gov_ids where key = 'subject')),
  (select snapshot from s12gov_snap where label = 'before'),
  'the capability refusal leaves the review, dependency, subject, audit and outbox stores identical [P2-S12-AC-262]');

select pg_temp.s12gov_as('Creator');
select pg_temp.s12gov_submit(pg_temp.s12gov_request(
  (select value::uuid from s12gov_ids where key = 'subject'),
  pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'subject')),
  's12gov-submit-0004'));
select pg_temp.s12gov_capture('duplicate');
select is(pg_temp.s12gov_message('duplicate'), 'subject_not_submittable',
  'a second live review for the same subject version is refused 409 subject_not_submittable [P2-S12-AC-251]');
select is(pg_temp.s12gov_live_reviews((select value::uuid from s12gov_ids where key = 'subject')), 1,
  'the duplicate refusal leaves exactly one live (open or approved) review [P2-S12-AC-251]');
select is(
  pg_temp.s12gov_snapshot((select value::uuid from s12gov_ids where key = 'subject')),
  (select snapshot from s12gov_snap where label = 'before'),
  'the duplicate refusal leaves the review, dependency, subject, audit and outbox stores identical [P2-S12-AC-251]');

-- A real template/type gets an isolated negative NULL-policy fault; no fake positive activation.
select pg_temp.s12gov_as('Creator');
select pg_temp.s12gov_mint('dependsubject', ARRAY['dependencyType'], 's12gov-template-create-0003');
select ok(
  exists (
    select 1 from platform_private.cms_template_versions subject
     where subject.id = (select value::uuid from s12gov_ids where key = 'dependsubject')
       and subject.owner_id = (select value::uuid from s12gov_ids where key = 'orgA')
       and subject.template_key = 's12gov-dependsubject'
       and subject.state = 'draft'
       and subject.content_hash is not null
       and subject.content_hash::text ~ '^[a-f0-9]{64}$'
       and pg_temp.s12gov_subject_hash(subject.id) is not null
       and pg_temp.s12gov_subject_hash(subject.id) ~ '^[a-f0-9]{64}$'
       and pg_temp.s12gov_subject_hash(subject.id) = subject.content_hash::text
  ),
  'control: dependency submission uses a real owner-scoped draft template and valid stored hash [P2-S12-AC-064]');
select pg_temp.s12gov_dependency_fault(pg_temp.s12gov_request(
  (select value::uuid from s12gov_ids where key = 'dependsubject'),
  pg_temp.s12gov_subject_hash((select value::uuid from s12gov_ids where key = 'dependsubject')),
  's12gov-submit-0005'), (select value::uuid from s12gov_ids where key = 'typeVersionA'));
select pg_temp.s12gov_capture('dependency');
select is(pg_temp.s12gov_message('dependency'), 'DEPENDENCY_UNAVAILABLE',
  'a bound content type whose workflow policy does not resolve is refused 503 DEPENDENCY_UNAVAILABLE [P2-S12-AC-064]');
select is(
  (select count(*)::integer from platform_private.cms_governed_reviews
    where subject_id = (select value::uuid from s12gov_ids where key = 'dependsubject')),
  0,
  'the dependency refusal commits no review for the unresolvable subject [P2-S12-AC-064]');

select ok((select count(*) = 1 and bool_and(selected_null and scope_refused and metadata_only and exact_refusal)
  from s12gov_fault_receipt),
  'fault control: only resolver source changed; selected policy absence yields exact P0001/detail and no body');
select ok((select count(*) = 1 and bool_and(data_unchanged and restored) from s12gov_fault_receipt),
  'fault control: full relevant rows, catalog definition/owner/ACL/comment, positive evidence and settings restored');
\ir phase_02_slice_12_governed_submit/020-idempotency.sqlinc
select ok((select count(*) = 9 and count(*) filter (where state = '00000') = 3
  and bool_and(rpc_user = 'service_role' and before_user = after_user and before_role = after_role)
  from s12gov_rpc_receipts),
  'role control: all nine governed calls really execute as service_role and restore role on success/refusal');
\ir phase_02_slice_12_governed_submit/030-hash-refusal.sqlinc

select finish();
rollback;
