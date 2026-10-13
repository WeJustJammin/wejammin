import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC072-AC142. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
export const S12_EVIDENCE_LEDGER_072_142: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-072',
    text: 'CMS-03C-07 verifies recent binding-bound MFA first (401 `STEP_UP_REQUIRED` before any idempotency reservation) and then serves only an assigned reviewer holding an active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot): a hidden or absent review is 404, a readable review without an effective assignment or capability or a separation-of-duties violation (the submitter or the subject creator) is 403, the reviewer, slot capability and MFA instant are server-derived, and `reason` is readable only by its decider.',
    clauses: [
      {
        text: 'CMS-03C-07 verifies recent binding-bound MFA first (401 `STEP_UP_REQUIRED` before any idempotency reservation) and then serves only an assigned reviewer holding an active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot): a hidden or absent review is 404, a readable review without an effective assignment or capability or a separation-of-duties violation (the submitter or the subject creator) is 403, the reviewer, slot capability and MFA instant are server-derived, and `reason` is readable only by its decider.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-073',
    text: 'CMS-03C-07 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order (the subject, dependency and content-type positions before the review row, DEC-157) and evaluates the ten ordered CMS-03B-06 checks (step-up proof, concealment, `open` state and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit), enforces a unique reviewer per review and review CAS (`version` + 1), ends the review at the first rejection, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event.',
    clauses: [
      {
        text: 'CMS-03C-07 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order (the subject, dependency and content-type positions before the review row, DEC-157) and evaluates the ten ordered CMS-03B-06 checks (step-up proof, concealment, `open` state and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit), enforces a unique reviewer per review and review CAS (`version` + 1), ends the review at the first rejection, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-074',
    text: "CMS-03C-07 maps malformed ID, header or body (400), a missing session or step-up MFA (401 `UNAUTHENTICATED` or `STEP_UP_REQUIRED`, which carries `{ recoveryAction: 'step_up', allowedMethods }`, reserves no idempotency record and changes no state), a missing assignment or capability or `separation_of_duties` (403), a hidden or absent review (404), a stale review version, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable` or a committed `dependency_changed` invalidation (409 `GOVERNED_REVIEW_VERSION_CONFLICT`, the invalidation also returning the subject to `draft`), a non-JSON body (415), a decision or reason failure (422), the decision limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`.",
    clauses: [
      {
        text: "CMS-03C-07 maps malformed ID, header or body (400), a missing session or step-up MFA (401 `UNAUTHENTICATED` or `STEP_UP_REQUIRED`, which carries `{ recoveryAction: 'step_up', allowedMethods }`, reserves no idempotency record and changes no state), a missing assignment or capability or `separation_of_duties` (403), a hidden or absent review (404), a stale review version, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable` or a committed `dependency_changed` invalidation (409 `GOVERNED_REVIEW_VERSION_CONFLICT`, the invalidation also returning the subject to `draft`), a non-JSON body (415), a decision or reason failure (422), the decision limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-075',
    text: 'CMS-03C-07 is consumed by the protected `CmsGovernedDecisionForm`, which builds `GovernedDecisionRequest` with the review `version` as `expectedVersion` and no `capability` or `stepUpAt`, shows a radio pair with a persistent reason label and counter and a confirm control that names the consequence, routes a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` with the draft restored and the same `Idempotency-Key` reused, renders `separation_of_duties` as the `CapabilityGate` copy and never a step-up route, and shows fixed copy for `specialist_slot_unsatisfiable`, `duplicate_decision`, `review_not_open` and a committed `dependency_changed`; verification covers the step-up round trip, each fixed message, the ordinary and protected decision paths and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-07 is consumed by the protected `CmsGovernedDecisionForm`, which builds `GovernedDecisionRequest` with the review `version` as `expectedVersion` and no `capability` or `stepUpAt`, shows a radio pair with a persistent reason label and counter and a confirm control that names the consequence, routes a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` with the draft restored and the same `Idempotency-Key` reused, renders `separation_of_duties` as the `CapabilityGate` copy and never a step-up route, and shows fixed copy for `specialist_slot_unsatisfiable`, `duplicate_decision`, `review_not_open` and a committed `dependency_changed`;',
        citations: [],
      },
      {
        text: 'verification covers the step-up round trip, each fixed message, the ordinary and protected decision paths and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-076',
    text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`) and returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`) and returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-077',
    text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`), with an optional `reason` of 1-256 code points that is already NFC (refused, never normalized); `revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked); the strong `If-Match` equals `expectedVersion` exactly.",
    clauses: [
      {
        text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`), with an optional `reason` of 1-256 code points that is already NFC (refused, never normalized);",
        citations: [],
      },
      {
        text: '`revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked);',
        citations: [],
      },
      {
        text: 'the strong `If-Match` equals `expectedVersion` exactly.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-078',
    text: 'CMS-03C-08 requires unconditional recent binding-bound MFA and then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`), accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator, collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal, answers a hidden, absent or cross-owner review as 404, and confers on the assignee only `read` and `decide` on this one frozen review.',
    clauses: [
      {
        text: 'CMS-03C-08 requires unconditional recent binding-bound MFA and then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`), accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator, collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal, answers a hidden, absent or cross-owner review as 404, and confers on the assignee only `read` and `decide` on this one frozen review.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-079',
    text: 'CMS-03C-08 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, admits a new assignment only while fewer than 16 are active (409 `assignment_limit`), enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, commits the assignment change and its audit record atomically, emits no event, and treats an expired assignment as inert.',
    clauses: [
      {
        text: 'CMS-03C-08 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, admits a new assignment only while fewer than 16 are active (409 `assignment_limit`), enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, commits the assignment change and its audit record atomically, emits no event, and treats an expired assignment as inert.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-080',
    text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written, answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state, maps malformed IDs, header or body (400), a denied owner capability (403), a hidden, absent or cross-owner review (404), a non-JSON body (415), the assignment limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and reconciles a lost response by the same `Idempotency-Key`.',
    clauses: [
      {
        text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written, answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state, maps malformed IDs, header or body (400), a denied owner capability (403), a hidden, absent or cross-owner review (404), a non-JSON body (415), the assignment limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and reconciles a lost response by the same `Idempotency-Key`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-081',
    text: 'CMS-03C-08 is consumed by the protected `CmsGovernedAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer` (owner only), which offers reviewers from the owner-only grant list (CMS-03A-18, `capability=cms.reviewer`, `state=active`), keeps the chosen person id island-local and discards it on a step-up navigation, bounds `expiresAt` client-side to seven days, renders the uniform refusal as one fixed message, sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay and requires explicit re-confirmation with the review `version` refetched; verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority and an unchanged review `version`.',
    clauses: [
      {
        text: 'CMS-03C-08 is consumed by the protected `CmsGovernedAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer` (owner only), which offers reviewers from the owner-only grant list (CMS-03A-18, `capability=cms.reviewer`, `state=active`), keeps the chosen person id island-local and discards it on a step-up navigation, bounds `expiresAt` client-side to seven days, renders the uniform refusal as one fixed message, sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay and requires explicit re-confirmation with the review `version` refetched;',
        citations: [],
      },
      {
        text: 'verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority and an unchanged review `version`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-082',
    text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`) and returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`, carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`) and returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`, carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-083',
    text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope, an `approved` review whose `version` equals `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`), and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; `retire` accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized); the strong `If-Match` equals `expectedVersion` exactly.',
    clauses: [
      {
        text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope, an `approved` review whose `version` equals `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`), and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`;',
        citations: [],
      },
      {
        text: '`retire` accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized);',
        citations: [],
      },
      {
        text: 'the strong `If-Match` equals `expectedVersion` exactly.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-084',
    text: "CMS-03C-09 verifies the unconditional recent binding-bound MFA before anything else (401 `STEP_UP_REQUIRED`, no idempotency record reserved) and then serves only the holder of the subject kind's owner capability as for CMS-03C-06: a hidden or absent review is 404 and a visible review without the capability is 403.",
    clauses: [
      {
        text: "CMS-03C-09 verifies the unconditional recent binding-bound MFA before anything else (401 `STEP_UP_REQUIRED`, no idempotency record reserved) and then serves only the holder of the subject kind's owner capability as for CMS-03C-06: a hidden or absent review is 404 and a visible review without the capability is 403.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-085',
    text: 'CMS-03C-09 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order and holds the review row and the lineage advisory lock as an atomic CAS switch, enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the switch and the audit record atomically.',
    clauses: [
      {
        text: 'CMS-03C-09 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order and holds the review row and the lineage advisory lock as an atomic CAS switch, enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the switch and the audit record atomically.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-086',
    text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict` and `schedule_exists` (409), a time, tzdb or horizon failure, a preflight failure or `canonical_source_unavailable` with `details.domain` (422), and a missing or stale MFA (401 `STEP_UP_REQUIRED`, no state change), maps malformed IDs, header or body (400), a missing capability (403), a hidden or absent review (404), a non-JSON body (415), the activation limit (429), a preflight or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and commits no partial switch.',
    clauses: [
      {
        text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict` and `schedule_exists` (409), a time, tzdb or horizon failure, a preflight failure or `canonical_source_unavailable` with `details.domain` (422), and a missing or stale MFA (401 `STEP_UP_REQUIRED`, no state change), maps malformed IDs, header or body (400), a missing capability (403), a hidden or absent review (404), a non-JSON body (415), the activation limit (429), a preflight or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and commits no partial switch.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-087',
    text: 'CMS-03C-09 is consumed by the protected `CmsGovernedActivationForm`, which offers `activate`, `schedule` (with the shared Time authority module computing the `ScheduledInstant`, as `CmsEditorialScheduleForm`) or `retire` (with an optional reason and the named consequence "Entries bound to this version can no longer publish") behind an inline `ConfirmationStep`, sends the review `version` as `expectedVersion` with unconditional step-up, shows the typed `canonical_source_unavailable` message naming the domain, renders a 200 as the activated and superseded versions and a 202 as "Scheduled, not active", shows blocked and cancelled schedules with their closed reason, never reads an immediate activation as "published", and focuses the result heading; verification covers all three actions, the confirmation step, the step-up round trip and the closed schedule reasons.',
    clauses: [
      {
        text: 'CMS-03C-09 is consumed by the protected `CmsGovernedActivationForm`, which offers `activate`, `schedule` (with the shared Time authority module computing the `ScheduledInstant`, as `CmsEditorialScheduleForm`) or `retire` (with an optional reason and the named consequence "Entries bound to this version can no longer publish") behind an inline `ConfirmationStep`, sends the review `version` as `expectedVersion` with unconditional step-up, shows the typed `canonical_source_unavailable` message naming the domain, renders a 200 as the activated and superseded versions and a 202 as "Scheduled, not active", shows blocked and cancelled schedules with their closed reason, never reads an immediate activation as "published", and focuses the result heading;',
        citations: [],
      },
      {
        text: 'verification covers all three actions, the confirmation step, the step-up round trip and the closed schedule reasons.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-088',
    text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId} and returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`) sorted by label then policy key, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId} and returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`) sorted by label then policy key, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-089',
    text: "CMS-03C-10 accepts only a UUID `reviewId` path with no query key (400 otherwise), exposes a decision's `reason` only to its decider and `assignments` only to the receipt-derived owner (every other reader receives `[]`), exposes no decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`, and refuses a response that carries more than 8 decisions or 32 assignments as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.",
    clauses: [
      {
        text: "CMS-03C-10 accepts only a UUID `reviewId` path with no query key (400 otherwise), exposes a decision's `reason` only to its decider and `assignments` only to the receipt-derived owner (every other reader receives `[]`), exposes no decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`, and refuses a response that carries more than 8 decisions or 32 assignments as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-090',
    text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403), returns `reason` only on the caller's own decision, serializes `assignments` only to the owner and the caller's own assignment to its reviewer, and serializes no person, actor or party identifier.",
    clauses: [
      {
        text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403), returns `reason` only on the caller's own decision, serializes `assignments` only to the owner and the caller's own assignment to its reviewer, and serializes no person, actor or party identifier.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-091',
    text: 'CMS-03C-10 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{review.version}"`, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target, writing no audit or outbox row and emitting no event.',
    clauses: [
      {
        text: 'CMS-03C-10 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{review.version}"`, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target, writing no audit or outbox row and emitting no event.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-092',
    text: 'CMS-03C-10 maps a malformed path or query (400), a missing session (401), a missing review read scope (403), concealment (404), an unsupported body if sent (415), a response-bound failure (a response-contract failure, 502 `DEPENDENCY_UNAVAILABLE`), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and answers a concealed review with the same 404.',
    clauses: [
      {
        text: 'CMS-03C-10 maps a malformed path or query (400), a missing session (401), a missing review read scope (403), concealment (404), an unsupported body if sent (415), a response-bound failure (a response-contract failure, 502 `DEPENDENCY_UNAVAILABLE`), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and answers a concealed review with the same 404.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-093',
    text: "CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`, which renders the subject identity and hash, the policy basis by content type label and policy key, the required, recorded and qualifying counts, the decisions as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`, takes actions only from `permittedNextActions`, moves focus to the heading on navigation only and puts no person, actor or party identifier in text, URL or telemetry; verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and `permittedNextActions` per caller.",
    clauses: [
      {
        text: "CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`, which renders the subject identity and hash, the policy basis by content type label and policy key, the required, recorded and qualifying counts, the decisions as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`, takes actions only from `permittedNextActions`, moves focus to the heading on navigation only and puts no person, actor or party identifier in text, URL or telemetry;",
        citations: [],
      },
      {
        text: 'verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and `permittedNextActions` per caller.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-094',
    text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery` and returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
    clauses: [
      {
        text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery` and returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-095',
    text: 'CMS-03C-11 accepts only `scope` `assigned` (default), `submitted` or `owned`, an optional `state` from the closed `GovernedReviewState`, an optional closed `subjectKind`, `limit` 1-50 (default 25) and an optional `cursor` of at most 512 characters, rejects every other query key, a body and any mutation header, and refuses an unknown scope, state or kind, a limit outside 1-50 or a structurally malformed cursor with the 400, 409 or 422 the validation matrix declares (DEC-140 cursor fault classes).',
    clauses: [
      {
        text: 'CMS-03C-11 accepts only `scope` `assigned` (default), `submitted` or `owned`, an optional `state` from the closed `GovernedReviewState`, an optional closed `subjectKind`, `limit` 1-50 (default 25) and an optional `cursor` of at most 512 characters, rejects every other query key, a body and any mutation header, and refuses an unknown scope, state or kind, a limit outside 1-50 or a structurally malformed cursor with the 400, 409 or 422 the validation matrix declares (DEC-140 cursor fault classes).',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-096',
    text: "CMS-03C-11 requires a verified human and lists, for `scope=assigned`, only reviews on which the caller holds an assignment, for `scope=submitted`, only reviews the caller submitted and, for `scope=owned`, only reviews of subjects that the caller's designer or curator capability covers, so a review outside those scopes is never listed.",
    clauses: [
      {
        text: "CMS-03C-11 requires a verified human and lists, for `scope=assigned`, only reviews on which the caller holds an assignment, for `scope=submitted`, only reviews the caller submitted and, for `scope=owned`, only reviews of subjects that the caller's designer or curator capability covers, so a review outside those scopes is never listed.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-097',
    text: 'CMS-03C-11 is a no-store, mutation-free safe read with a signed keyset cursor bound to the complete query and acting scope, default limit 25 and maximum 50, a filter allowlist of `scope`, `state` and `subjectKind`, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-11 is a no-store, mutation-free safe read with a signed keyset cursor bound to the complete query and acting scope, default limit 25 and maximum 50, a filter allowlist of `scope`, `state` and `subjectKind`, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-098',
    text: 'CMS-03C-11 answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page, and maps session, rate, read-dependency and internal failures to typed ApiError of catalog `cms.03c.governed-review.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-11 answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page, and maps session, rate, read-dependency and internal failures to typed ApiError of catalog `cms.03c.governed-review.v1` with no audit or outbox effect.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-099',
    text: "CMS-03C-11 is consumed by the protected `CmsGovernedReviewQueue`, which renders the `assigned`, `submitted` and `owned` scope tabs, the `state` and `subjectKind` filters and the signed `nextCursor` as URL state (never serializing a protected value), shows each row's subject key and version, risk class, recorded of required decisions, `myDecision` and the caller's `assignmentEndsAt`, links rows natively to the review detail, announces counts politely, distinguishes no-records from filter-miss and drops the cursor to load the first page after a cursor 409; verification covers each scope, the filters, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller's scopes is never listed.",
    clauses: [
      {
        text: "CMS-03C-11 is consumed by the protected `CmsGovernedReviewQueue`, which renders the `assigned`, `submitted` and `owned` scope tabs, the `state` and `subjectKind` filters and the signed `nextCursor` as URL state (never serializing a protected value), shows each row's subject key and version, risk class, recorded of required decisions, `myDecision` and the caller's `assignmentEndsAt`, links rows natively to the review detail, announces counts politely, distinguishes no-records from filter-miss and drops the cursor to load the first page after a cursor 409;",
        citations: [],
      },
      {
        text: "verification covers each scope, the filters, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller's scopes is never listed.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-100',
    text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null) and returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null) and returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`);',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-101',
    text: "CMS-03C-12 accepts a `patternKey` of `^[a-z][a-z0-9-]{1,63}$` that is not a reserved key, 1-64 unique `compatibleTypeIds` that are each the id of an active content type of the caller's owner scope, 1-32 root nodes whose node `key`s match `^[a-z][a-z0-9_-]{0,63}$`, `block` nodes that use the canonical BlockKey and a registered, non-withdrawn version, node props of at most 64 keys and depth 8, and `expectedVersion` null for a first version or the parent's `version` for a successor.",
    clauses: [
      {
        text: "CMS-03C-12 accepts a `patternKey` of `^[a-z][a-z0-9-]{1,63}$` that is not a reserved key, 1-64 unique `compatibleTypeIds` that are each the id of an active content type of the caller's owner scope, 1-32 root nodes whose node `key`s match `^[a-z][a-z0-9_-]{0,63}$`, `block` nodes that use the canonical BlockKey and a registered, non-withdrawn version, node props of at most 64 keys and depth 8, and `expectedVersion` null for a first version or the parent's `version` for a successor.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-102',
    text: "CMS-03C-12 derives session and acting context server-side and serves only a verified human holding `cms.template_designer` in the caller's owner scope: a hidden owner or pattern is 404, a readable pattern without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
    clauses: [
      {
        text: "CMS-03C-12 derives session and acting context server-side and serves only a verified human holding `cms.template_designer` in the caller's owner scope: a hidden owner or pattern is 404, a readable pattern without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-103',
    text: "CMS-03C-12 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique `(key, version)` and CAS, computes `blockRegistryDigest` on the server, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline (target < 2 s), no-store and the Tier 2 p95 < 1,200 ms target, and emits no event (activation is CMS-03C-09).",
    clauses: [
      {
        text: "CMS-03C-12 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique `(key, version)` and CAS, computes `blockRegistryDigest` on the server, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline (target < 2 s), no-store and the Tier 2 p95 < 1,200 ms target, and emits no event (activation is CMS-03C-09).",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-104',
    text: 'CMS-03C-12 maps malformed IDs, header or body (400), a missing session (401), a missing designer capability (403), a hidden or absent pattern scope (404 `COMPOSITION_NOT_FOUND`), a stale parent, key or version, a cycle or an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), a non-JSON body (415), a tree, props or graph bound failure or a nested pattern that is not `active` or not compatible (422 `COMPOSITION_VALIDATION_FAILED`, the latter with `details.reasonCode` `nested_pattern_not_active`), the pattern-write limit (429), a registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and rolls back so that no pattern row exists after a refusal.',
    clauses: [
      {
        text: 'CMS-03C-12 maps malformed IDs, header or body (400), a missing session (401), a missing designer capability (403), a hidden or absent pattern scope (404 `COMPOSITION_NOT_FOUND`), a stale parent, key or version, a cycle or an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), a non-JSON body (415), a tree, props or graph bound failure or a nested pattern that is not `active` or not compatible (422 `COMPOSITION_VALIDATION_FAILED`, the latter with `details.reasonCode` `nested_pattern_not_active`), the pattern-write limit (429), a registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and rolls back so that no pattern row exists after a refusal.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-105',
    text: "CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`, which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors, nested pattern nodes from `CmsPatternSelector`, `compatibleTypeIds` from the context's content type selectors), edits node keys, props and children with explicit add, remove and move-up/move-down controls (no drag-only path), renders the server digest, `nodeCount` and a cycle, depth or node-count refusal inline with the node path, and sends the read version as `expectedVersion` for a successor; verification covers keyboard operation, the inline refusals, the error summary linking to the node and the focused result heading.",
    clauses: [
      {
        text: "CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`, which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors, nested pattern nodes from `CmsPatternSelector`, `compatibleTypeIds` from the context's content type selectors), edits node keys, props and children with explicit add, remove and move-up/move-down controls (no drag-only path), renders the server digest, `nodeCount` and a cycle, depth or node-count refusal inline with the node path, and sends the read version as `expectedVersion` for a successor;",
        citations: [],
      },
      {
        text: 'verification covers keyboard operation, the inline refusals, the error summary linking to the node and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-106',
    text: 'CMS-03C-13 registers GET /api/v1/cms/patterns/selector with the strict `PatternSelectorQuery` (`contentTypeId`, `cursor`, `limit`) and returns the strict `PatternSelectorPage` (at most 50 `PatternSelectorItem` rows of `patternId`, `patternVersionId`, `patternKey`, `patternVersion`, `nodeCount` and `blockRegistryDigest`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(patternKey ASC, patternVersion DESC)`.',
    clauses: [
      {
        text: 'CMS-03C-13 registers GET /api/v1/cms/patterns/selector with the strict `PatternSelectorQuery` (`contentTypeId`, `cursor`, `limit`) and returns the strict `PatternSelectorPage` (at most 50 `PatternSelectorItem` rows of `patternId`, `patternVersionId`, `patternKey`, `patternVersion`, `nodeCount` and `blockRegistryDigest`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(patternKey ASC, patternVersion DESC)`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-107',
    text: "CMS-03C-13 accepts only a UUID `contentTypeId` of a content type in the caller's owner scope, a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other query key, a body and any mutation header, and answers a hidden or absent content type with the same 404.",
    clauses: [
      {
        text: "CMS-03C-13 accepts only a UUID `contentTypeId` of a content type in the caller's owner scope, a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other query key, a body and any mutation header, and answers a hidden or absent content type with the same 404.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-108',
    text: 'CMS-03C-13 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested content type, so a draft, non-compatible or other-owner version is never listed and no owner or authority field is serialized.',
    clauses: [
      {
        text: 'CMS-03C-13 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested content type, so a draft, non-compatible or other-owner version is never listed and no owner or authority field is serialized.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-109',
    text: 'CMS-03C-13 is a no-store, mutation-free safe read with a signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the query and acting scope, default limit 25 and maximum 50, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-13 is a no-store, mutation-free safe read with a signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the query and acting scope, default limit 25 and maximum 50, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-110',
    text: 'CMS-03C-13 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent content type (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1` with no audit or outbox effect, and a client restarts from the first page after a cursor conflict.',
    clauses: [
      {
        text: 'CMS-03C-13 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent content type (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1` with no audit or outbox effect, and a client restarts from the first page after a cursor conflict.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-111',
    text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`, which renders `PatternSelectorPage` items for the entry\'s content type (`patternKey`, `patternVersion`, `nodeCount`) as a native list or select with the result count announced politely, shows the empty state "No compatible pattern is active", and keeps the cursor in component state only; verification covers only active compatible versions, keyset order, cursor binding and the empty state.',
    clauses: [
      {
        text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`, which renders `PatternSelectorPage` items for the entry\'s content type (`patternKey`, `patternVersion`, `nodeCount`) as a native list or select with the result count announced politely, shows the empty state "No compatible pattern is active", and keeps the cursor in component state only;',
        citations: [],
      },
      {
        text: 'verification covers only active compatible versions, keyset order, cursor binding and the empty state.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-112',
    text: 'CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` of at most 512 characters, `base` (the pinned pattern value), `theirs` (the new active value), `yours` (the local override) and a `collision` flag, a `collisionCount` 0-128 and `bulkEligible`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` of at most 512 characters, `base` (the pinned pattern value), `theirs` (the new active value), `yours` (the local override) and a `collision` flag, a `collisionCount` 0-128 and `bulkEligible`;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-113',
    text: 'CMS-03C-14 accepts only a UUID `instanceId` path with no query key (400 otherwise), defines a path as a collision when the local override differs from the base and the new version also changed the path, bounds each `base`, `theirs` and `yours` value to a schema-typed value that is null when absent, and refuses an instance with more than 128 changed paths or more than 256 KiB as 422 `COMPOSITION_VALIDATION_FAILED` `diff_too_large`.',
    clauses: [
      {
        text: 'CMS-03C-14 accepts only a UUID `instanceId` path with no query key (400 otherwise), defines a path as a collision when the local override differs from the base and the new version also changed the path, bounds each `base`, `theirs` and `yours` value to a schema-typed value that is null when absent, and refuses an instance with more than 128 changed paths or more than 256 KiB as 422 `COMPOSITION_VALIDATION_FAILED` `diff_too_large`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-114',
    text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable (an instance with no newer `active` compatible pattern version answers 200 with `paths: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion`): a hidden or absent instance is 404, a visible instance without edit is 403, and the read exposes only bounded schema-typed values with no owner or authority field.",
    clauses: [
      {
        text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable (an instance with no newer `active` compatible pattern version answers 200 with `paths: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion`): a hidden or absent instance is 404, a visible instance without edit is 403, and the read exposes only bounded schema-typed values with no owner or authority field.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-115',
    text: 'CMS-03C-14 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{instance.version}"`, bounds `base`, `theirs` and `yours` to 128 paths and 256 KiB, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-14 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{instance.version}"`, bounds `base`, `theirs` and `yours` to 128 paths and 256 KiB, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-116',
    text: 'CMS-03C-14 maps a malformed path or query (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), an unsupported body if sent (415), `diff_too_large` (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, never overwrites an instance, and leaves an unanswered update on its pinned version.',
    clauses: [
      {
        text: 'CMS-03C-14 maps a malformed path or query (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), an unsupported body if sent (415), `diff_too_large` (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, never overwrites an instance, and leaves an unanswered update on its pinned version.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-117',
    text: 'CMS-03C-14 is consumed by the protected `CmsPatternUpdateDiff` on the composition page, which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked and a radio pair (keep my override, take the new value) per collision, shows the `no-update` state when the instance has no newer compatible version, shows the typed `diff_too_large` refusal, never keeps a diff when degraded but requires it again, and states that an unanswered update leaves the instance on its pinned version; verification covers the collision marking, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.',
    clauses: [
      {
        text: 'CMS-03C-14 is consumed by the protected `CmsPatternUpdateDiff` on the composition page, which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked and a radio pair (keep my override, take the new value) per collision, shows the `no-update` state when the instance has no newer compatible version, shows the typed `diff_too_large` refusal, never keeps a diff when degraded but requires it again, and states that an unanswered update leaves the instance on its pinned version;',
        citations: [],
      },
      {
        text: 'verification covers the collision marking, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-118',
    text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`) and returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`) and returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items;',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-119',
    text: 'CMS-03C-15 accepts only `accept` or `detach`, 1-32 unique instances each with its own `expectedVersion`, a `targetPatternVersion` that is the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`), `choices` only for a single-instance request and covering every colliding path with `yours` or `theirs` (a missing choice is 422), and refuses a bulk request containing a colliding instance as 409 `diff_has_collisions`; the strong `If-Match` equals the entry `expectedVersion` exactly.',
    clauses: [
      {
        text: 'CMS-03C-15 accepts only `accept` or `detach`, 1-32 unique instances each with its own `expectedVersion`, a `targetPatternVersion` that is the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`), `choices` only for a single-instance request and covering every colliding path with `yours` or `theirs` (a missing choice is 422), and refuses a bulk request containing a colliding instance as 409 `diff_has_collisions`;',
        citations: [],
      },
      {
        text: 'the strong `If-Match` equals the entry `expectedVersion` exactly.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-120',
    text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision: a hidden or absent instance is 404, a visible instance without edit is 403, an instance must be `pending_diff` or an `active` linked instance for `accept` and any linked instance for `detach`, and the entry and instance versions must be current.",
    clauses: [
      {
        text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision: a hidden or absent instance is 404, a visible instance without edit is 403, an instance must be `pending_diff` or an `active` linked instance for `accept` and any linked instance for `detach`, and the entry and instance versions must be current.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-121',
    text: "CMS-03C-15 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version`, applies CAS on each instance's own `version`, is all-or-nothing for 1-32 instances, enforces rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, and appends a row for every adopted or detached instance.",
    clauses: [
      {
        text: "CMS-03C-15 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version`, applies CAS on each instance's own `version`, is all-or-nothing for 1-32 instances, enforces rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, and appends a row for every adopted or detached instance.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-122',
    text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions` and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure (422 `COMPOSITION_VALIDATION_FAILED`), maps malformed IDs, header or body (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), a non-JSON body (415), the composition limit (429), a registry or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and overwrites nothing on any refusal.',
    clauses: [
      {
        text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions` and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure (422 `COMPOSITION_VALIDATION_FAILED`), maps malformed IDs, header or body (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), a non-JSON body (415), the composition limit (429), a registry or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and overwrites nothing on any refusal.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-123',
    text: 'CMS-03C-15 is consumed by the protected `CmsCompositionInstanceList` and `CmsPatternUpdateDiff`, whose _Accept_ (single, or bulk of up to 32 when no instance collides) and _Detach_ commands carry the entry `version` and each instance\'s `version`, show an instance in state `pending_diff` as "Update available" beside its pinned version, refetch and keep the author\'s choices on `diff_has_collisions` and `revision_not_editable`, and never accept an update automatically; verification covers theirs-only adoption, retained overrides, mandatory choices for collisions, bulk all-or-nothing, detach and the focus on the first unanswered collision.',
    clauses: [
      {
        text: 'CMS-03C-15 is consumed by the protected `CmsCompositionInstanceList` and `CmsPatternUpdateDiff`, whose _Accept_ (single, or bulk of up to 32 when no instance collides) and _Detach_ commands carry the entry `version` and each instance\'s `version`, show an instance in state `pending_diff` as "Update available" beside its pinned version, refetch and keep the author\'s choices on `diff_has_collisions` and `revision_not_editable`, and never accept an update automatically;',
        citations: [],
      },
      {
        text: 'verification covers theirs-only adoption, retained overrides, mandatory choices for collisions, bulk all-or-nothing, detach and the focus on the first unanswered collision.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-124',
    text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null) and returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null) and returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`);',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-125',
    text: "CMS-03C-16 accepts a `taxonomyKey` of `^[a-z][a-z0-9-]{1,63}$`, a `shape` of `flat` or `hierarchical`, 1-64 unique type keys and 1-64 unique field keys that each match `^[a-z][a-z0-9_]{1,63}$`, 0-6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` as `canonicalOverlapDomains`, a never-reused (owner, key, version) triple, and `expectedVersion` null for a first version or the parent's `version` for a successor; a declared domain with no registered provider is accepted at create.",
    clauses: [
      {
        text: "CMS-03C-16 accepts a `taxonomyKey` of `^[a-z][a-z0-9-]{1,63}$`, a `shape` of `flat` or `hierarchical`, 1-64 unique type keys and 1-64 unique field keys that each match `^[a-z][a-z0-9_]{1,63}$`, 0-6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` as `canonicalOverlapDomains`, a never-reused (owner, key, version) triple, and `expectedVersion` null for a first version or the parent's `version` for a successor;",
        citations: [],
      },
      {
        text: 'a declared domain with no registered provider is accepted at create.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-126',
    text: "CMS-03C-16 derives session and acting context server-side and serves only a verified human holding `cms.taxonomy_curator` in the caller's owner scope: a hidden owner or taxonomy is 404, a readable taxonomy without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
    clauses: [
      {
        text: "CMS-03C-16 derives session and acting context server-side and serves only a verified human holding `cms.taxonomy_curator` in the caller's owner scope: a hidden owner or taxonomy is 404, a readable taxonomy without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-127',
    text: "CMS-03C-16 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique (key, version) and CAS, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event (activation is CMS-03C-09).",
    clauses: [
      {
        text: "CMS-03C-16 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique (key, version) and CAS, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event (activation is CMS-03C-09).",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-128',
    text: 'CMS-03C-16 maps malformed IDs, header or body (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent taxonomy scope (404), a stale parent, key or version or an idempotency conflict (409 `TAXONOMY_VERSION_CONFLICT`), a non-JSON body (415), a key, allowlist or domain schema failure (422 `TAXONOMY_VALIDATION_FAILED`), the taxonomy-write limit (429), a canonical registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`, with no vocabulary row after a refusal.',
    clauses: [
      {
        text: 'CMS-03C-16 maps malformed IDs, header or body (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent taxonomy scope (404), a stale parent, key or version or an idempotency conflict (409 `TAXONOMY_VERSION_CONFLICT`), a non-JSON body (415), a key, allowlist or domain schema failure (422 `TAXONOMY_VALIDATION_FAILED`), the taxonomy-write limit (429), a canonical registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`, with no vocabulary row after a refusal.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-129',
    text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`, which builds `TaxonomyVersionRequest` from the key, the shape, type-key and field-key allowlists as validated tag lists (grammar `^[a-z][a-z0-9_]{1,63}$`, 1-64 unique) and a checkbox group of the six canonical domains that shows which have a provider ("Checks available" or "Not available yet; this vocabulary cannot activate while declared"), summarizes the reviewer-visible declaration before submit and exposes group labels and descriptions programmatically; verification covers allowlist bounds, the domain declaration, the provider-availability text per domain and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`, which builds `TaxonomyVersionRequest` from the key, the shape, type-key and field-key allowlists as validated tag lists (grammar `^[a-z][a-z0-9_]{1,63}$`, 1-64 unique) and a checkbox group of the six canonical domains that shows which have a provider ("Checks available" or "Not available yet; this vocabulary cannot activate while declared"), summarizes the reviewer-visible declaration before submit and exposes group labels and descriptions programmatically;',
        citations: [],
      },
      {
        text: 'verification covers allowlist bounds, the domain declaration, the provider-availability text per domain and the focused result heading.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-130',
    text: 'CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with the strict `TaxonomySelectorQuery` (`typeKey`, `fieldKey`, `locale`, `cursor`, `limit`) and returns the strict `TaxonomySelectorPage` (at most 100 `TaxonomySelectorTerm` rows of `taxonomyId`, `taxonomyVersionId`, `taxonomyKey`, `shape`, `termId`, `termKey`, a nullable `parentId` and a nullable `label` for the requested locale, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(taxonomyKey ASC, termKey ASC)`.',
    clauses: [
      {
        text: 'CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with the strict `TaxonomySelectorQuery` (`typeKey`, `fieldKey`, `locale`, `cursor`, `limit`) and returns the strict `TaxonomySelectorPage` (at most 100 `TaxonomySelectorTerm` rows of `taxonomyId`, `taxonomyVersionId`, `taxonomyKey`, `shape`, `termId`, `termKey`, a nullable `parentId` and a nullable `label` for the requested locale, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(taxonomyKey ASC, termKey ASC)`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-131',
    text: 'CMS-03C-17 accepts only a `typeKey` and a `fieldKey` that each match `^[a-z][a-z0-9_]{1,63}$`, a BCP 47 `locale`, a signed `cursor` of at most 512 characters and a `limit` of 1-100 (default 50), rejects every other query key, a body and any mutation header, and returns `label` null, with no fallback to another locale, when a term has no label for the requested locale.',
    clauses: [
      {
        text: 'CMS-03C-17 accepts only a `typeKey` and a `fieldKey` that each match `^[a-z][a-z0-9_]{1,63}$`, a BCP 47 `locale`, a signed `cursor` of at most 512 characters and a `limit` of 1-100 (default 50), rejects every other query key, a body and any mutation header, and returns `label` null, with no fallback to another locale, when a term has no label for the requested locale.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-132',
    text: 'CMS-03C-17 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term; a hidden or absent vocabulary is 404 and no owner or authority field is serialized.',
    clauses: [
      {
        text: 'CMS-03C-17 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term;',
        citations: [],
      },
      {
        text: 'a hidden or absent vocabulary is 404 and no owner or authority field is serialized.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-133',
    text: 'CMS-03C-17 is a no-store, mutation-free safe read with a signed keyset cursor over `(taxonomyKey ASC, termKey ASC)` bound to the query and acting scope, default limit 50 and maximum 100, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-17 is a no-store, mutation-free safe read with a signed keyset cursor over `(taxonomyKey ASC, termKey ASC)` bound to the query and acting scope, default limit 50 and maximum 100, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-134',
    text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent vocabulary (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent vocabulary (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-135',
    text: 'CMS-03C-17 is consumed by the protected `CmsTaxonomyFieldEditor` inside CMS-03B-01, CMS-03B-10 and CMS-03B-11 value authoring, which lists the active terms for the entry type and field key (the label for the entry locale, or the term key when no label exists), writes `{ termIds }`, shows level text for hierarchical vocabularies, announces the selection count politely, and on a `term_unavailable` refusal refetches the selector and keeps the other values; verification covers merged and deprecated terms never being listed and the `term_unavailable` recovery.',
    clauses: [
      {
        text: 'CMS-03C-17 is consumed by the protected `CmsTaxonomyFieldEditor` inside CMS-03B-01, CMS-03B-10 and CMS-03B-11 value authoring, which lists the active terms for the entry type and field key (the label for the entry locale, or the term key when no label exists), writes `{ termIds }`, shows level text for hierarchical vocabularies, announces the selection count politely, and on a `term_unavailable` refusal refetches the selector and keeps the other values;',
        citations: [],
      },
      {
        text: 'verification covers merged and deprecated terms never being listed and the `term_unavailable` recovery.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-136',
    text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`, taking the strict `CanonicalTaxonomyMatchRequest` (`domain` one of the six canonical domains, 1-64 `candidates` of 1-160 characters) and returning the discriminated `CanonicalTaxonomyMatchResult` (`no_match`; `match` with `domain`, `canonicalId` and `canonicalKind`; or `source_unavailable` with `domain`); it has no browser route, proxy or client type and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`, taking the strict `CanonicalTaxonomyMatchRequest` (`domain` one of the six canonical domains, 1-64 `candidates` of 1-160 characters) and returning the discriminated `CanonicalTaxonomyMatchResult` (`no_match`; `match` with `domain`, `canonicalId` and `canonicalKind`; or `source_unavailable` with `domain`);',
        citations: [],
      },
      {
        text: 'it has no browser route, proxy or client type and is absent from the browser route inventory.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-137',
    text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality only, never fuzzy-matches, accepts one domain and at most 64 candidates per call, and returns `source_unavailable` for a domain whose provider is `unbuilt`.",
    clauses: [
      {
        text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality only, never fuzzy-matches, accepts one domain and at most 64 candidates per call, and returns `source_unavailable` for a domain whose provider is `unbuilt`.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-138',
    text: "CMS-03C-18 is executable only by its database-internal callers, `cms_act_taxonomy_term` and the taxonomy-version activation preflight (PUBLIC, anon, authenticated and every other role have EXECUTE revoked), reads only the domain's named read-only projection and never another shard's store directly (DEC-100), and returns only a canonical id and kind, never canonical content.",
    clauses: [
      {
        text: "CMS-03C-18 is executable only by its database-internal callers, `cms_act_taxonomy_term` and the taxonomy-version activation preflight (PUBLIC, anon, authenticated and every other role have EXECUTE revoked), reads only the domain's named read-only projection and never another shard's store directly (DEC-100), and returns only a canonical id and kind, never canonical content.",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-139',
    text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call, and applies the 2,000 ms provider timeout, so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
    clauses: [
      {
        text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call, and applies the 2,000 ms provider timeout, so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-140',
    text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write, returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`, and never returns a success-shaped body on a fault.',
    clauses: [
      {
        text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write, returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`, and never returns a success-shaped body on a fault.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-141',
    text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) and the taxonomy-version activation preflight; verification covers `match`, `no_match` and `source_unavailable` per domain, exact equality after normalization with no fuzzy match, the `role` provider reading the Shard 02 role facet assertion projection, the provider-fault 503 with no editorial write, and the absence of the RPC from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) and the taxonomy-version activation preflight;',
        citations: [],
      },
      {
        text: 'verification covers `match`, `no_match` and `source_unavailable` per domain, exact equality after normalization with no fuzzy match, the `role` provider reading the Shard 02 role facet assertion projection, the provider-fault 503 with no editorial write, and the absence of the RPC from browser routes and generated OpenAPI.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
  {
    criterion: 'P2-S12-AC-142',
    text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`: `platform_private.cms_claim_due_governed_activations(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedGovernedActivation` records (`scheduleId`, `reviewId`, `subjectKind`, `subjectId`, `scheduleVersion`, `expectedVersion`, `leaseId`, `correlationId`), and `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning the strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`, with `reasonCode`, `actualUtc` and `deviationSeconds`); neither is a browser route, proxy or client type.',
    clauses: [
      {
        text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`: `platform_private.cms_claim_due_governed_activations(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedGovernedActivation` records (`scheduleId`, `reviewId`, `subjectKind`, `subjectId`, `scheduleVersion`, `expectedVersion`, `leaseId`, `correlationId`), and `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning the strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`, with `reasonCode`, `actualUtc` and `deviationSeconds`);',
        citations: [],
      },
      {
        text: 'neither is a browser route, proxy or client type.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation: 'No test is cited for this criterion yet.',
  },
];
