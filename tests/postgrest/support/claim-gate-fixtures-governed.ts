/**
 * Valid requests for the Slice 12 governed-review commands and reads (BE03c CMS-03C-06 ..
 * CMS-03C-11) whose caller is resolved by `cms_actor` -> `cfg_actor` (family `cfg-actor`).
 * Every one is executable by service_role only (the Worker), so the gate class is `service-role`.
 *
 * Every member the function checks before it resolves the caller is present and well formed,
 * so the identity gate is the first thing that can refuse the request. The post-gate outcome
 * for a real caller (a real auth user with no person, named by service_role or not) is the
 * function's own next domain step, read from the live private body:
 *   - `cms_submit_governed_review` validates the structure, then resolves the subject BEFORE it
 *     resolves the submitter person, so an unknown subject is NOT_FOUND (concealment);
 *   - `cms_record_governed_decision` /`cms_assign_governed_reviewer` /
 *     `cms_activate_governed_subject` require the E6 step-up proof BEFORE they read the review,
 *     so their next outcome is STEP_UP_REQUIRED (the harness supplies a valid `context`, never a
 *     step-up proof);
 *   - `cms_get_governed_review` conceals an unknown review (and a caller with no person) as
 *     NOT_FOUND;
 *   - `cms_list_governed_reviews` gives a caller who is not a confirmed member of the acting
 *     party the EMPTY page (200).
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

export const CMS_GOVERNED_FIXTURES: FixtureTable = {
  // CMS-03C-06: exact keys, closed kind, UUID, 64-hex hash all pass; the subject id names no row.
  cms_submit_governed_review: {
    request: {
      subjectKind: 'pattern_version',
      subjectId: id(40),
      subjectHash: HEX64,
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: NOT_FOUND,
  },
  // CMS-03C-07: structure (CAS operand pair, decision, SafeText reason), then the step-up proof.
  cms_record_governed_decision: {
    request: {
      reviewId: id(41),
      decision: 'approve',
      reason: 'api gate probe',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: STEP_UP,
  },
  // CMS-03C-08 (create): structure (exact create keys, UUIDs, offset-ISO expiry), then step-up.
  cms_assign_governed_reviewer: {
    request: {
      reviewId: id(41),
      action: 'create',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
      reviewerPersonId: id(6),
      expiresAt: FUTURE,
    },
    real: STEP_UP,
  },
  // CMS-03C-09 (activate): cms_governed_activation_request structure, then step-up.
  cms_activate_governed_subject: {
    request: {
      reviewId: id(41),
      action: 'activate',
      expectedVersion: '1',
      ifMatch: '1',
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    real: STEP_UP,
  },
  // CMS-03C-10: the review id names no row, and the caller has no person: one concealed NOT_FOUND.
  cms_get_governed_review: { request: { reviewId: id(41) }, real: NOT_FOUND },
  // CMS-03C-11: a caller with no person is not a confirmed member of the acting party: empty page.
  cms_list_governed_reviews: { request: {}, real: '200:' },
};
