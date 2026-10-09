/**
 * Valid requests for the Slice 11 editorial commands whose caller is resolved by
 * `cms_actor` -> `cfg_actor` (family `cfg-actor`), plus the actorless internal
 * operation `cms_execute_publication_schedule` (family `service-principal`).
 *
 * Every member the function checks before it resolves the caller is present and well
 * formed, so the identity gate is the first thing that can refuse the request. The
 * post-gate outcome for a real caller is the function's own next domain step:
 *   - `cms_submit_review` resolves the submitter person before it reads the target,
 *     so a real caller with no person reaches PERSON_NOT_FOUND;
 *   - `cms_get_editorial_review` /`cms_get_entry_workflow` /
 *     `cms_load_quality_gate_input` /`cms_mint_preview` conceal an unknown target as
 *     NOT_FOUND (the caller holds no person);
 *   - `cms_record_review_decision` /`cms_assign_editorial_reviewer` /
 *     `cms_schedule_publication` /`cms_publish_revision` require the E6 step-up proof
 *     BEFORE they read the target, so their next outcome is STEP_UP_REQUIRED (the
 *     harness supplies a valid `context`, never a step-up proof);
 *   - `cms_list_editorial_reviews` conceals every row and answers an empty page (200).
 * None of these is a request-validation refusal.
 */
import {
  FUTURE,
  HEX64,
  IDEMPOTENCY_KEY,
  id,
  type FixtureTable,
} from './claim-gate-fixtures-types';

const NOT_FOUND = '400:NOT_FOUND';
const STEP_UP = '400:STEP_UP_REQUIRED';

/** A complete CMS-03B frozen version set; every member is well formed (the values are never read). */
const VERSION_SET = {
  schemaVersionId: id(2),
  schemaHash: HEX64,
  schemaArtifact: {},
  validatorRefs: [],
  workflowPolicy: {},
  activationEvidence: {},
  templateVersionId: null,
  templateHash: null,
  taxonomyVersionIds: [],
  blockVersionIds: [],
  patternVersionIds: [],
  settingsVersion: '1',
  compilerVersion: '1',
};

export const CMS_EDITORIAL_FIXTURES: FixtureTable = {
  cms_submit_review: {
    request: {
      entryId: id(7),
      revisionId: id(8),
      frozenHash: HEX64,
      dependencyManifest: {},
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    // cms_submit_review resolves the submitter person BEFORE it reads the target,
    // so a real caller with no person reaches PERSON_NOT_FOUND first.
    real: '400:PERSON_NOT_FOUND',
  },
  cms_record_review_decision: {
    request: {
      reviewId: id(5),
      decision: 'approve',
      reason: 'api gate probe',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: STEP_UP,
  },
  cms_assign_editorial_reviewer: {
    request: {
      reviewId: id(5),
      action: 'create',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
      reviewerPersonId: id(6),
      expiresAt: FUTURE,
    },
    real: STEP_UP,
  },
  cms_schedule_publication: {
    request: {
      revisionId: id(8),
      action: 'publish',
      localDateTime: '2026-10-05T12:00:00',
      timezone: 'UTC',
      resolvedUtc: '2026-10-05T12:00:00Z',
      tzdbVersion: '2026a',
      disambiguation: 'none',
      audience: 'public',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: STEP_UP,
  },
  cms_publish_revision: {
    request: {
      entryId: id(7),
      revisionId: id(8),
      frozenHash: HEX64,
      expectedVersionSet: VERSION_SET,
      audience: 'public',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: STEP_UP,
  },
  cms_get_editorial_review: { request: { reviewId: id(5) }, real: NOT_FOUND },
  cms_get_entry_workflow: { request: { entryId: id(7) }, real: NOT_FOUND },
  cms_load_quality_gate_input: {
    request: { phase: 'submit', entryId: id(7) },
    real: NOT_FOUND,
  },
  cms_list_editorial_reviews: { request: {}, real: '200:' },
  cms_mint_preview: {
    request: {
      entryId: id(7),
      revisionId: id(8),
      locale: 'en-US',
      audience: 'public',
      route: '/preview/api-gate',
      versionSet: VERSION_SET,
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
};

/**
 * The actorless internal operation CMS-03B-20 execute: it resolves no caller, so a
 * valid actorless request reaches the schedule lookup and answers NOT_FOUND. Its
 * boundary is the service_role EXECUTE grant (ACL) plus the Worker module boundary
 * (DEC-156), never a body-level human gate (see claim-gate-manifest.ts).
 */
export const SERVICE_PRINCIPAL_FIXTURES: FixtureTable = {
  cms_execute_publication_schedule: {
    request: { scheduleId: id(30), expectedVersion: '1', leaseId: id(31) },
    real: NOT_FOUND,
  },
};
