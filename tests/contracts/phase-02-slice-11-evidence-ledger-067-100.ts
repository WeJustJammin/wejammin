import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 11 evidence ledger fragment P2-S11-AC-067..100. Rules: see
// tests/contracts/phase-02-slice-11-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-11-evidence-guard.test.ts.
export const S11_EVIDENCE_LEDGER_067_100: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S11-AC-067',
    text: 'CMS-03B-18 registers POST /api/v1/cms/reviews/{reviewId}/assignments with the strict discriminated `EditorialReviewAssignmentRequest` (`action` `create` or `revoke`) and returns the strict `EditorialReviewAssignmentResource` as 201 with `Location` and a strong ETag for create and 200 for revoke, carrying `capability` `cms.editorial_review` and `actions` exactly `read` and `decide`.',
    clauses: [
      {
        text: 'CMS-03B-18 registers POST /api/v1/cms/reviews/{reviewId}/assignments with the strict discriminated `EditorialReviewAssignmentRequest` (`action` `create` or `revoke`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-070] CMS-03B-18 reviewer assignment row answers 201 with Location for create and 200 for revoke on the same row',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest accepts the create and the revoke members of the discriminated union',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest requires a known action and refuses members of the other action',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067] CMS-03B-18 transport contracts declares the OpenAPI transport view with path, headers and the discriminated body',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-openapi-refinements.test.ts',
            title:
              '[P2-S11-AC-067] assignment reason publishes 256 code points and NFC on both branches is a discriminated oneOf of exactly the create and the revoke branch',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation publishes path, header and query parameters per route',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
        ],
      },
      {
        text: 'and returns the strict `EditorialReviewAssignmentResource` as 201 with `Location` and a strong ETag for create and 200 for revoke',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-operations.test.ts',
            title:
              'published validators CMS-03B-18 answers a revoke 200 with the ETag and no Location',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067] CMS-03B-18 transport contracts answers 201 for a created assignment and 200 for a revoke',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067] EditorialReviewAssignmentResource accepts an active and a revoked assignment',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the resource is exactly EditorialReviewAssignmentResource: meta, reviewId, state, capability, actions, window, reason [P2-S11-AC-067]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'revoking returns the same assignment, revoked, at version 2 [P2-S11-AC-067]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation does not give a revoke a Location and publishes the 401 step-up union on the four step-up routes only',
          },
        ],
      },
      {
        text: 'carrying `capability` `cms.editorial_review` and `actions` exactly `read` and `decide`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a created assignment is active at version 1, confers exactly read and decide on this review and carries a null reason when none was given [P2-S11-AC-067]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067] EditorialReviewAssignmentResource confers exactly read and decide under cms.editorial_review and no identity',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-068',
    text: "CMS-03B-18 validates `create` as the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than both the end of the reviewer's `cms.reviewer` grant day and the end of the owner's current `cms.editor` grant day (422 `expiry_out_of_bounds`), with an optional NFC `reason` of 1-256 characters, and `revoke` as `expectedVersion` plus an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked); the strong `If-Match` must equal `expectedVersion` exactly.",
    clauses: [
      {
        text: 'CMS-03B-18 validates `create` as the review `expectedVersion`, a UUID `reviewerPersonId`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'If-Match must equal expectedVersion (INVALID_REQUEST) and both must be positive decimals (VALIDATION_FAILED at the member) [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a non-UUID reviewer or assignment id and an expiry that is not an offset ISO instant are VALIDATION_FAILED at their member pointer [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              "an unknown key (a caller-supplied owner), a missing member, the other action's members, an unknown action, a malformed review id and a missing or short idempotency key are INVALID_REQUEST [P2-S11-AC-068]",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest validates the create members',
          },
        ],
      },
      {
        text: "an `expiresAt` that is after now, at most seven days away and no later than both the end of the reviewer's `cms.reviewer` grant day and the end of the owner's current `cms.editor` grant day (422 `expiry_out_of_bounds`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'the expiry must be after now, within seven days, and not after the reviewer grant day end or the owner cms.editor grant day end (the end itself is allowed) [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the window ends at the requested expiry, after it starts and within seven days [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-068][P2-S11-AC-070] assignment bounds shared by SQL, Worker and the form caps expiry at the earliest of seven days, the reviewer grant end and the grantor authority end',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
        ],
      },
      {
        text: 'with an optional NFC `reason` of 1-256 characters',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a reason of 257 code points, an empty reason, a non-NFC reason and a non-string reason are each VALIDATION_FAILED at /reason (refused, never normalized) [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a 256-code-point reason (512 octets) is accepted and stored verbatim [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the stored assignment reason is bounded in Unicode code points, not octets (DEC-158(b)) [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest bounds the optional reason at 1-256 Unicode characters, already NFC',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-openapi-refinements.test.ts',
            title:
              '[P2-S11-AC-067] assignment reason publishes 256 code points and NFC on both branches constrains the reason of each branch to 1-256 code points in NFC, and the runtime agrees',
          },
        ],
      },
      {
        text: '`revoke` as `expectedVersion` plus an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'revoking an already revoked assignment is a 409 conflict [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title: 'revoking a missing assignment is 404 [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'an assignment of another review is indistinguishable from a missing one [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-068] EditorialReviewAssignmentRequest validates the revoke members',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
        ],
      },
      {
        text: 'the strong `If-Match` must equal `expectedVersion` exactly.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'If-Match must equal expectedVersion (INVALID_REQUEST) and both must be positive decimals (VALIDATION_FAILED at the member) [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/if-match-binding.test.ts',
            title:
              '[P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-029][P2-S11-AC-067] a composite transport schema binds the strong If-Match to the body expectedVersion CMS-03B-18 EditorialReviewAssignmentApiRequest (create) refuses an If-Match that differs from expectedVersion, naming only the header',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/if-match-binding.test.ts',
            title:
              '[P2-S11-AC-011][P2-S11-AC-017][P2-S11-AC-029][P2-S11-AC-067] a composite transport schema binds the strong If-Match to the body expectedVersion CMS-03B-18 EditorialReviewAssignmentApiRequest (revoke) refuses an If-Match that differs from expectedVersion, naming only the header',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match refuses an If-Match that disagrees with the body expectedVersion as 400 CMS-03B-18',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-069',
    text: 'CMS-03B-18 requires the receipt-derived owner holding the non-grantable `cms.editorial_review.assign` and a valid `cms.editor` grant (else 403 `capability_missing`), unconditional recent binding-bound MFA, and a reviewer who is a current eligible human holding an active `cms.reviewer` grant and who is neither the review submitter nor the revision author, with every ineligibility collapsing into one 409 `reviewer_not_eligible` that is never an existence or role signal; a hidden, absent or cross-owner review is 404, and the assignment confers only `read` and `decide` on this one frozen review.',
    clauses: [
      {
        text: 'CMS-03B-18 requires the receipt-derived owner holding the non-grantable `cms.editorial_review.assign` and a valid `cms.editor` grant (else 403 `capability_missing`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a submitter, a publisher and an assigned reviewer can read the review but are not the receipt-derived owner: 403 capability_missing for create and revoke [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an owner without a valid cms.editor grant is refused a create (no grantor authority end) but may still revoke [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-070] CMS-03B-18 reviewer assignment row is owner-only by the non-grantable capability with unconditional step-up',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/content-schema-registry/grants.contract.test.ts',
            title:
              'grantable CMS capability registry is the closed DEC-119 set',
          },
        ],
      },
      {
        text: 'unconditional recent binding-bound MFA',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a stale (> 600 s), future (> 30 s), unverified, absent or malformed proof is STEP_UP_REQUIRED, and it is evaluated before concealment (a hidden review is not disclosed) [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a proof 590 s old and a proof 20 s in the future (within the 600 s window and the 30 s skew) are accepted [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC CMS-03B-18',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-18] a reviewer assignment needs a completed step-up, then answers 201; an ineligible person is refused',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'a reviewer who is a current eligible human holding an active `cms.reviewer` grant and who is neither the review submitter nor the revision author, with every ineligibility collapsing into one 409 `reviewer_not_eligible` that is never an existence or role signal',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'control: the same request for an eligible reviewer succeeds (so the eleven refusals are about the reviewer) [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] absent nonmember ungranted and submitter reviewers share one exact eligibility refusal without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
        ],
      },
      {
        text: 'a hidden, absent or cross-owner review is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a non-member, a member without any scope on the review, a caller acting in another party and an absent review are one indistinguishable NOT_FOUND [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title:
              'a caller acting in another party holds no scope (cross-owner concealment) [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] stale review closed review and concealed review refuse exactly without effects',
          },
        ],
      },
      {
        text: 'and the assignment confers only `read` and `decide` on this one frozen review.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a created assignment is active at version 1, confers exactly read and decide on this review and carries a null reason when none was given [P2-S11-AC-067]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the actions are exactly read and decide, never edit, publish, assign or admin [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: an assignment cannot be broadened with another action [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_schema.sql',
            title:
              'assignment: the assignment capability is fixed to cms.editorial_review [P2-S11-AC-119]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-070',
    text: 'CMS-03B-18 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the assignment change, its audit record and exactly one `cms.entry.review-changed.v1` atomically.',
    clauses: [
      {
        text: 'CMS-03B-18 requires an `Idempotency-Key` and the exact review-version `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires a printable Idempotency-Key CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 8: Idempotency-Key and strong If-Match requires an exact strong If-Match CMS-03B-18',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              "an unknown key (a caller-supplied owner), a missing member, the other action's members, an unknown action, a malformed review id and a missing or short idempotency key are INVALID_REQUEST [P2-S11-AC-068]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'If-Match must equal expectedVersion (INVALID_REQUEST) and both must be positive decimals (VALIDATION_FAILED at the member) [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-assignment.test.ts',
            title:
              '[P2-S11-AC-067] CMS-03B-18 transport contracts addresses the review by UUID and requires key plus a strong If-Match over JSON',
          },
        ],
      },
      {
        text: 'locks the review row',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs',
            title:
              'A4: a create BLOCKS behind a session holding the review row FOR UPDATE (the command takes the review lock)',
          },
        ],
      },
      {
        text: 'leaves the review `version` unchanged on create and revoke',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'creating an assignment leaves the review version, state and decision count unchanged [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the revoke moves only the assignment (active -> revoked, version + 1); the review is untouched [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql',
            title:
              'revoking an assignment on a review with no decision leaves the review at version 1 [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql',
            title:
              'creating an assignment never changes the review [P2-S11-AC-070]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs',
            title:
              'A1: one active row, one review-changed event and the review untouched at version 1',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs',
            title:
              'A3: the assignment is revoked at version 2, the review version never moved and one event was emitted',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 10/min/user and 20/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota enforces the user and party buckets from the registry row CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers an exhausted bucket 429 with the rate headers CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-070] CMS-03B-18 reviewer assignment row limits 10/20 per minute in the assignment class, 15 s, Tier 2',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline, no-store and Tier 2',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-067][P2-S11-AC-070] CMS-03B-18 reviewer assignment row limits 10/20 per minute in the assignment class, 15 s, Tier 2',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-18',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-admission.test.ts',
            title:
              'registers every browser command at its registry path success envelope CMS-03B-18',
          },
        ],
      },
      {
        text: 'commits the assignment change, its audit record and exactly one `cms.entry.review-changed.v1` atomically.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'exactly one audit record is committed for the creation [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'exactly one identifier-only cms.entry.review-changed.v1 is committed, aggregated on the review at its unchanged version [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the idempotency reservation is completed with the command [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'exactly one audit record is committed for the revoke [P2-S11-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the create and the revoke each emitted one review-changed event, both at the unchanged review version [P2-S11-AC-070]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-071',
    text: 'CMS-03B-18 refuses a stale review version (409 `VERSION_MISMATCH`), `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` (more than 16 active) and `review_not_open` (409) and `expiry_out_of_bounds` (422) with no row written; answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state; reconciles a lost response by the same `Idempotency-Key`; retries the review event idempotently; and treats an expired assignment as inert without a sweep.',
    clauses: [
      {
        text: 'CMS-03B-18 refuses a stale review version (409 `VERSION_MISMATCH`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a stale review version is VERSION_MISMATCH carrying the expected and current versions [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] stale review closed review and concealed review refuse exactly without effects',
          },
        ],
      },
      {
        text: '`reviewer_not_eligible`, `assignment_exists`, `assignment_limit` (more than 16 active) and `review_not_open` (409)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a second assignment of a reviewer who holds an active row is assignment_exists, even when that row is expired but not revoked [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'the seventeenth active assignment of a review is assignment_limit [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an approved, rejected or invalidated review accepts no assignment change: review_not_open [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] absent nonmember ungranted and submitter reviewers share one exact eligibility refusal without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] sixteen active assignments are accepted and the seventeenth refuses without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] stale review closed review and concealed review refuse exactly without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/010-review-assignment-race.mjs',
            title:
              'A2: sixteen active assignments (never seventeen) and one event',
          },
        ],
      },
      {
        text: '`expiry_out_of_bounds` (422) with no row written',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'the expiry must be after now, within seven days, and not after the reviewer grant day end or the owner cms.editor grant day end (the end itself is allowed) [P2-S11-AC-068]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'every refusal above left no assignment, review change, reservation, audit record or outbox event behind [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
        ],
      },
      {
        text: 'answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'a stale (> 600 s), future (> 30 s), unverified, absent or malformed proof is STEP_UP_REQUIRED, and it is evaluated before concealment (a hidden review is not disclosed) [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the step-up refusals reserved no idempotency record and changed no state [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-command-quota.test.ts',
            title:
              'BE00 step 7: capability, step-up and quota answers a stale MFA proof 401 STEP_UP_REQUIRED before quota and RPC CMS-03B-18',
          },
        ],
      },
      {
        text: 'reconciles a lost response by the same `Idempotency-Key`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'an exact replay returns the stored response unchanged [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the replay adds no assignment, audit record, outbox event or reservation [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-071]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
        ],
      },
      {
        text: 'retries the review event idempotently',
        citations: [],
      },
      {
        text: 'treats an expired assignment as inert without a sweep.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'expired assignments are inert: fifteen unexpired plus two expired rows leave room for a sixteenth [P2-S11-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "retries the review event idempotently". No test replays or redelivers the cms.entry.review-changed.v1 outbox event of an assignment change and shows an idempotent outcome (the pgTAP replay tests prove only that a replayed COMMAND adds no second event, not that event delivery retries are idempotent); contracts events.test.ts proves only the event payload shape.',
  },
  {
    criterion: 'P2-S11-AC-072',
    text: 'CMS-03B-18 is consumed by `CmsEditorialReviewAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer`, which offers reviewers from the owner-only grant list (CMS-03A-18, `cms.reviewer`, `active`), keeps the chosen person id island-local, bounds `expiresAt` client-side to seven days, renders the uniform refusal as one fixed message, sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay, never persists the person id, requires explicit re-confirmation with the review `version` refetched, and returns focus to the assignment list heading after commit; verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority and an unchanged review `version`.',
    clauses: [
      {
        text: 'CMS-03B-18 is consumed by `CmsEditorialReviewAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland renders the owner assignment controls only with the assign permission',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment shows no revoke section without an active assignment or the permission',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) sends the strict create body at the review version and refetches the review',
          },
        ],
      },
      {
        text: 'which offers reviewers from the owner-only grant list (CMS-03A-18, `cms.reviewer`, `active`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'reviewer options loads the owner-only reviewers after mount and offers each as an option',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-reviewer-options.test.ts',
            title:
              'loadReviewerOptions reads the owner-only active cms.reviewer grants no-store and offers each person once',
          },
        ],
      },
      {
        text: 'keeps the chosen person id island-local',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind keeps the chosen reviewer out of the draft and every store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) stores the scoped draft without the reviewer and restores it after step-up, asking to choose again',
          },
        ],
      },
      {
        text: 'bounds `expiresAt` client-side to seven days',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) refuses a missing reviewer and an expiry outside the bounds before sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-expiry.test.ts',
            title:
              'parseAssignmentExpiry accepts exactly the seven-day ceiling and refuses one minute beyond',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-expiry.test.ts',
            title:
              'parseAssignmentExpiry is bounded by the end of the chosen reviewer’s access',
          },
        ],
      },
      {
        text: 'renders the uniform refusal as one fixed message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '404 and 409 shows one uniform line for every ineligible reviewer without refetching',
          },
        ],
      },
      {
        text: 'sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) stores the scoped draft without the reviewer and restores it after step-up, asking to choose again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment routes a revoke through step-up and asks for an explicit confirmation on return',
          },
        ],
      },
      {
        text: 'never persists the person id',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind keeps the chosen reviewer out of the draft and every store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) stores the scoped draft without the reviewer and restores it after step-up, asking to choose again',
          },
        ],
      },
      {
        text: 'requires explicit re-confirmation with the review `version` refetched',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up opens a sync conflict when the expected version changed, and rotates the key on acknowledgement',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) stores the scoped draft without the reviewer and restores it after step-up, asking to choose again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment routes a revoke through step-up and asks for an explicit confirmation on return',
          },
        ],
      },
      {
        text: 'and returns focus to the assignment list heading after commit',
        citations: [],
      },
      {
        text: 'verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) sends the strict create body at the review version and refetches the review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment lists each active assignment by its label and revokes the one named',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) refuses a missing reviewer and an expiry outside the bounds before sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland renders the owner assignment controls only with the assign permission',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment shows no revoke section without an active assignment or the permission',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'the expiry must be after now, within seven days, and not after the reviewer grant day end or the owner cms.editor grant day end (the end itself is allowed) [P2-S11-AC-068]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-refusals.apispec.ts',
            title:
              'CMS-03B-18 refusals through the real stack [CMS-03B-18] step-up, eligibility, duplicates, expiry bounds, revoke and conflict',
          },
        ],
      },
      {
        text: 'an unchanged review `version`.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] sixteen active assignments are accepted and the seventeenth refuses without effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-18] a reviewer assignment needs a completed step-up, then answers 201; an ineligible person is refused',
            project: 'real-route-chrome',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "returns focus to the assignment list heading after commit". The form test asserts only that onDone is called with the heading id review-assignments-title and the detail test that the heading is focusable; no test drives an assignment commit through CmsEditorialReviewDetailIsland and asserts document.activeElement is that heading (the island focus test covers only the decisions heading).',
  },
  {
    criterion: 'P2-S11-AC-073',
    text: 'CMS-03B-19 is exactly one database RPC, `platform_api.cms_verify_preview_token`, taking the strict `PreviewVerificationRequest` (lowercase SHA-256 `tokenHash`, `actorPersonId`, 64-hex `actingContextVersion`, `route` of at most 4,096 characters, `locale`, `audience`) and returning the discriminated `PreviewVerificationResult` (`valid: true` with `userId`, `entryId`, `revisionId`, `exactVersionSet`, `expiresAt` and `revoked: false`, or `valid: false` with those five members null and a boolean `revoked`); it has no browser route, proxy or client type and is absent from the browser route inventory and generated OpenAPI, and its shape equals the BE04c `Shard 03 preview-token verifier` seam.',
    clauses: [
      {
        text: 'CMS-03B-19 is exactly one database RPC, `platform_api.cms_verify_preview_token`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073][P2-S11-AC-079] internal operations are never browser routes declares exactly the two internal operations with their RPCs and registered principals',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries names exactly the RPCs the contract registers for the two internal operations',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries keeps the RPC names inside their own modules and the sweep transport',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'cms_verify_preview_token is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-075]',
          },
        ],
      },
      {
        text: 'taking the strict `PreviewVerificationRequest` (lowercase SHA-256 `tokenHash`, `actorPersonId`, 64-hex `actingContextVersion`, `route` of at most 4,096 characters, `locale`, `audience`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult takes a lowercase SHA-256 token hash and never a plaintext token',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult binds the actor person, the 64-hex acting-context version, route, locale and audience',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'every malformed request (missing or extra member, upper-case or short hash, bad uuid, over-long or non-string route, bad locale or audience, null, array, string) is the canonical denial and never an error [P2-S11-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a 2,048-character route verifies when presented exactly [P2-S11-AC-074]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
        ],
      },
      {
        text: 'and returning the discriminated `PreviewVerificationResult` (`valid: true` with `userId`, `entryId`, `revisionId`, `exactVersionSet`, `expiresAt` and `revoked: false`, or `valid: false` with those five members null and a boolean `revoked`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult returns a discriminated result: valid carries the binding, denied carries only nulls',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult never marks a valid result revoked and refuses an unknown or missing discriminant',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result is exactly PreviewVerificationResult (7 members) [P2-S11-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result carries the canonical person as userId, the entry and revision ids, the STORED VersionSet and the exact expiry [P2-S11-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an unknown token hash is the canonical denial (valid false, five null members, revoked false) [P2-S11-AC-075]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
        ],
      },
      {
        text: 'it has no browser route, proxy or client type and is absent from the browser route inventory and generated OpenAPI',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073][P2-S11-AC-079] internal operations are never browser routes keeps both out of the browser operation ids and route registry',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries never exposes an internal RPC to the browser app',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-049] Slice 11 platform registry rows mirror the editorial route policy keeps the internal operations out of the browser route registry',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation publishes the resource components and never the internal RPC contracts',
          },
        ],
      },
      {
        text: 'and its shape equals the BE04c `Shard 03 preview-token verifier` seam.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "its shape equals the BE04c `Shard 03 preview-token verifier` seam". No test compares the declared request and result shape with the BE04c seam row (line 88 of .memory/wiki/specs/be/04c-public-delivery-cache.md); the tests prove the shape against the BE03b contract and the Worker adapter only. There is no Shard 04 consumer in the repository yet (the adapter has no importer until Slice 15).',
  },
  {
    criterion: 'P2-S11-AC-074',
    text: "CMS-03B-19 returns `valid: true` only when the presented hash resolves to a token row that is `active`, unrevoked and unexpired (`now() < expires_at`), whose `person_id` equals `actorPersonId` and whose `capability_snapshot_hash` equals `actingContextVersion`, whose `route`, `locale` and `audience` equal the request exactly, on an entry whose lifecycle is `active` with a readable revision and whose minting person's preview scope still holds; every other input is `valid: false`.",
    clauses: [
      {
        text: 'CMS-03B-19 returns `valid: true` only when the presented hash resolves to a token row that is `active`, unrevoked and unexpired (`now() < expires_at`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a live token presented by its bound actor verifies [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an expired token (15 minutes 10 seconds old) is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token with ten seconds of life left still verifies (the expiry is exact, not rounded) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the bound actor presenting a revoked token gets valid false and revoked true, every other member null [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an unknown token hash is the canonical denial (valid false, five null members, revoked false) [P2-S11-AC-075]',
          },
        ],
      },
      {
        text: 'whose `person_id` equals `actorPersonId` and whose `capability_snapshot_hash` equals `actingContextVersion`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a forwarded token presented by another person is the canonical denial, revoked false [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another acting-context version is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a granted capability changes the context version: the token verifies only against the version it was minted under (and scope now holds as a publisher) [P2-S11-AC-118]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] forwarded actor has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] acting context has the complete identical null-detail denial and zero writes',
          },
        ],
      },
      {
        text: 'whose `route`, `locale` and `audience` equal the request exactly',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another route (case, trailing slash, prefix) is the canonical denial: the route must equal the minted one exactly [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'route equality is on the exact code points: the NFC route verifies, its NFD spelling is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another locale (case variant or other language) is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title: 'another audience is the canonical denial [P2-S11-AC-074]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] route has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] locale has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] audience has the complete identical null-detail denial and zero writes',
          },
        ],
      },
      {
        text: "on an entry whose lifecycle is `active` with a readable revision and whose minting person's preview scope still holds",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token of an entry that left `active` is the canonical denial even before its row is revoked [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token whose minting person lost the entry assignment stops verifying although its row is still active: canonical denial, revoked false [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a lapsed standing cms.author grant ends the minting scope: canonical denial (the acting-context version moved as well) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an active reviewer assignee of a review of the revision and an owner-party publisher keep a valid preview [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a member with no preview scope on the entry cannot verify a row bound to them (scope is rechecked on every open) [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              "revoking the reviewer assignment ends that reviewer's preview scope [P2-S11-AC-074]",
          },
        ],
      },
      {
        text: 'every other input is `valid: false`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'every malformed request (missing or extra member, upper-case or short hash, bad uuid, over-long or non-string route, bad locale or audience, null, array, string) is the canonical denial and never an error [P2-S11-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] unknown hash has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] malformed bearer is denied locally without transport or durable effects',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-075',
    text: 'CMS-03B-19 grants EXECUTE only to the registered Shard 04 delivery principal (PUBLIC, anon, authenticated and every other role revoked), never receives or persists token plaintext, and makes every denial byte-identical (`valid: false`, all other members null, `revoked` false) except that `revoked` is true only when the row exists, is bound to the supplied `actorPersonId` and is revoked, so the verifier is not an existence oracle.',
    clauses: [
      {
        text: 'CMS-03B-19 grants EXECUTE only to the registered Shard 04 delivery principal (PUBLIC, anon, authenticated and every other role revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'cms_verify_preview_token is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the platform_api wrapper is a SECURITY DEFINER of the CMS definer, executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-075]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries lets no Worker module but the delivery adapter import the verifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries keeps the RPC names inside their own modules and the sweep transport',
          },
        ],
      },
      {
        text: 'never receives or persists token plaintext',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'the request sends only the SHA-256 of the token and the exact binding to the service RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result echoes no token hash, plaintext, account id, acting party, context version or route [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: only the lowercase SHA-256 of the token is stored, never the plaintext [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the plaintext token is persisted nowhere: not in the token table, the idempotency record, the audit trail or the outbox [P2-S11-AC-117]',
          },
        ],
      },
      {
        text: 'makes every denial byte-identical (`valid: false`, all other members null, `revoked` false) except that `revoked` is true only when the row exists, is bound to the supplied `actorPersonId` and is revoked, so the verifier is not an existence oracle.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'an unknown token hash is the canonical denial (valid false, five null members, revoked false) [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a forwarded token presented by another person is the canonical denial, revoked false [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the bound actor presenting a revoked token gets valid false and revoked true, every other member null [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another person presenting the same revoked token gets the unknown-token bytes (revoked false): no existence oracle [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'revoked is true whenever the row exists, is bound to the supplied person and is revoked, whatever else of the binding differs [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a revoked token that has also expired still reports revoked for its bound actor [P2-S11-AC-075]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult makes every denial byte-identical except the bound owner revoked flag',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-076',
    text: 'CMS-03B-19 is read-safe, performing no insert, update, delete, audit row or outbox row, so a retry is harmless, and its contract fixes the 500 ms RPC timeout, the two retries at 75 ms and 150 ms and the 30-second open circuit that the BE04c seam applies to the verifier.',
    clauses: [
      {
        text: 'CMS-03B-19 is read-safe, performing no insert, update, delete, audit row or outbox row, so a retry is harmless',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'both functions are STABLE, so the database itself refuses any insert, update, delete, audit or outbox write [P2-S11-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the verifier writes nothing: token rows (with their xmin), audit, outbox and idempotency are unchanged by valid and denied calls [P2-S11-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a repeated verification answers the same document (retry is harmless) [P2-S11-AC-076]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
        ],
      },
      {
        text: 'its contract fixes the 500 ms RPC timeout, the two retries at 75 ms and 150 ms and the 30-second open circuit that the BE04c seam applies to the verifier.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult fixes the verifier deadline, retries, circuit and the derived token lifetime',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title: 'failure handling bounds an attempt at 500 ms',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling retries a failed attempt after 75 then 150 ms and returns the first typed result',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling opens the circuit for 30 seconds after three failed attempts',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-077',
    text: 'CMS-03B-19 treats an unknown, ambiguous, expired, revoked or mismatched verification and a transport failure or timeout of the RPC as a preview denial that emits no draft detail (a transport failure is a denial in the caller, never an ApiError), so an unknown verifier result never opens a preview.',
    clauses: [
      {
        text: 'CMS-03B-19 treats an unknown, ambiguous, expired, revoked or mismatched verification',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'every malformed request (missing or extra member, upper-case or short hash, bad uuid, over-long or non-string route, bad locale or audience, null, array, string) is the canonical denial and never an error [P2-S11-AC-077]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling answers the byte-identical denial for every kind of failed attempt',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'results treats a malformed token or binding as the denial without a call',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] unknown hash has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] forwarded actor has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] acting context has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] route has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] locale has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] audience has the complete identical null-detail denial and zero writes',
          },
        ],
      },
      {
        text: 'and a transport failure or timeout of the RPC as a preview denial that emits no draft detail (a transport failure is a denial in the caller, never an ApiError)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling answers the byte-identical denial for every kind of failed attempt',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title: 'failure handling bounds an attempt at 500 ms',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling opens the circuit for 30 seconds after three failed attempts',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073] CMS-03B-19 PreviewVerificationRequest and PreviewVerificationResult returns a discriminated result: valid carries the binding, denied carries only nulls',
          },
        ],
      },
      {
        text: 'so an unknown verifier result never opens a preview.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling answers the byte-identical denial for every kind of failed attempt',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'failure handling gives up without opening the circuit when the caller aborts',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-078',
    text: 'CMS-03B-19 is consumable by the Shard 04 preview route (BE04c DLV-DEL-API-02) through exactly the declared request and result shape; verification covers every `valid: false` cause producing a byte-identical result (unknown hash, expired, forwarded actor, another acting-context version, route, locale or audience, lost minting scope) with `revoked` true only for the bound owner, the valid result shape including `entryId` and `revisionId`, zero writes, and the absence of the RPC from browser routes and OpenAPI.',
    clauses: [
      {
        text: 'CMS-03B-19 is consumable by the Shard 04 preview route (BE04c DLV-DEL-API-02) through exactly the declared request and result shape',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'the request sends only the SHA-256 of the token and the exact binding to the service RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'results passes a denial through, including the bound actor revoked flag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the verifier needs no session or acting context: it answers from the request alone [P2-S11-AC-073]',
          },
        ],
      },
      {
        text: 'verification covers every `valid: false` cause producing a byte-identical result (unknown hash, expired, forwarded actor, another acting-context version, route, locale or audience, lost minting scope)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a token whose minting person lost the entry assignment stops verifying although its row is still active: canonical denial, revoked false [P2-S11-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a lapsed standing cms.author grant ends the minting scope: canonical denial (the acting-context version moved as well) [P2-S11-AC-074]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] unknown hash has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] forwarded actor has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] acting context has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] route has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] locale has the complete identical null-detail denial and zero writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] audience has the complete identical null-detail denial and zero writes',
          },
        ],
      },
      {
        text: 'with `revoked` true only for the bound owner',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the bound actor presenting a revoked token gets valid false and revoked true, every other member null [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'another person presenting the same revoked token gets the unknown-token bytes (revoked false): no existence oracle [P2-S11-AC-075]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'revoked is true whenever the row exists, is bound to the supplied person and is revoked, whatever else of the binding differs [P2-S11-AC-075]',
          },
        ],
      },
      {
        text: 'the valid result shape including `entryId` and `revisionId`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result is exactly PreviewVerificationResult (7 members) [P2-S11-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the valid result carries the canonical person as userId, the entry and revision ids, the STORED VersionSet and the exact expiry [P2-S11-AC-073]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
        ],
      },
      {
        text: 'zero writes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the verifier writes nothing: token rows (with their xmin), audit, outbox and idempotency are unchanged by valid and denied calls [P2-S11-AC-076]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] sends only the token hash and returns the complete bound resource without any writes',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-verifier.apispec.ts',
            title:
              'CMS-03B-19 production adapter over actual PostgREST [CMS-03B-19] unknown hash has the complete identical null-detail denial and zero writes',
          },
        ],
      },
      {
        text: 'and the absence of the RPC from browser routes and OpenAPI.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation publishes the resource components and never the internal RPC contracts',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-049] Slice 11 platform registry rows mirror the editorial route policy keeps the internal operations out of the browser route registry',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-079',
    text: 'CMS-03B-20 is exactly two database RPCs: `platform_private.cms_claim_due_publication_schedules(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedSchedule` records, and `platform_private.cms_execute_publication_schedule(schedule_id, expected_version, lease_id, evidence)` returning the strict `ScheduleExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`); neither is a browser route, proxy or client type.',
    clauses: [
      {
        text: 'CMS-03B-20 is exactly two database RPCs: `platform_private.cms_claim_due_publication_schedules(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedSchedule` records',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073][P2-S11-AC-079] internal operations are never browser routes declares exactly the two internal operations with their RPCs and registered principals',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries names exactly the RPCs the contract registers for the two internal operations',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts claims a batch of 1-100 integers',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts returns identifiers, versions, hashes and correlation data only',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts bounds the claim result at 100 distinct schedules',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a batch outside 1..100, a non-integer, a missing batch, an extra key and a non-object are INVALID_REQUEST and change nothing [P2-S11-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'the claim answers a JSON array of ClaimedSchedule records [P2-S11-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              "a ClaimedSchedule is exactly the eight identifier / version / hash members: the claim's schedule version (the CAS operand), the approved review version, the lease and the derived correlation [P2-S11-AC-079]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a batch of 2 claims the two OLDEST due schedules in (resolved instant, id) order and leaves the third pending [P2-S11-AC-082]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-rpc.test.ts',
            title:
              'claimDueSchedules posts the bounded batch as one JSON request and returns the strict claims',
          },
        ],
      },
      {
        text: 'and `platform_private.cms_execute_publication_schedule(schedule_id, expected_version, lease_id, evidence)` returning the strict `ScheduleExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts executes a claimed schedule by its CAS version, lease and verified evidence',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts types the execution result with the closed outcome and reason coupling',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts completes only with a publication row, the actual instant and the deviation, and nothing else does',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'an unknown key, a missing member, a malformed id or version and a non-object proof are INVALID_REQUEST, an absent schedule is NOT_FOUND, and nothing changes [P2-S11-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the answer is exactly the six-member ScheduleExecutionResult [P2-S11-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'each retry is audited without an actor and appends nothing [P2-S11-AC-082]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-rpc.test.ts',
            title:
              'executeClaimedSchedule executes with the claimed schedule version, the lease and the proof',
          },
        ],
      },
      {
        text: 'neither is a browser route, proxy or client type.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-073][P2-S11-AC-079] internal operations are never browser routes keeps both out of the browser operation ids and route registry',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries never exposes an internal RPC to the browser app',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation publishes the resource components and never the internal RPC contracts',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-080',
    text: "CMS-03B-20 claims only `pending` or `failed_retryable` schedules that are due, and executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect), re-reading the approved review (`approved`, `version` equal to the schedule's `expected_version`, frozen hash and dependency hash equal to the schedule's), running all 17 preflight categories in the execute phase with the verified `PreflightEvidence` (current provider key and version, `evaluatedAt` within 60 seconds, recomputed `bindingHash`), and rechecking that the schedule creator's `cms.publisher` grant is unrevoked and has not ended before the fire instant.",
    clauses: [
      {
        text: 'CMS-03B-20 claims only `pending` or `failed_retryable` schedules that are due',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'exactly the due pending schedule and the due failed_retryable schedule are claimed: not the future one, the waiting retry, the completed, blocked and leased ones, nor the schedules whose lease just expired [P2-S11-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a future schedule, a waiting retry, a completed, a blocked and a live-leased schedule are untouched [P2-S11-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a recovered schedule is claimed again once its next attempt is due, keeping its attempt count [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] a second tick inside the 15 s retry delay claims nothing; after it the retried schedule completes with real evidence',
          },
        ],
      },
      {
        text: 'and executes only a claimed schedule whose `lease_id` still matches (a stale lease is refused with no effect)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a stale lease, a stale version and a schedule that was never claimed are refused (CONFLICT / VERSION_MISMATCH) with no effect [P2-S11-AC-080]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] an expired matching real lease refuses unchanged operands before stale-evidence handling',
          },
        ],
      },
      {
        text: 're-reading the approved review (`approved`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a frozen manifest that is no longer current invalidates the review (dependency_changed) and blocks the schedule approval_invalidated [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts',
            title:
              'CMS-03B-20 real lineage and replay [CMS-03B-20] public revision append after actual claim blocks changed approval with exact effects',
          },
        ],
      },
      {
        text: "`version` equal to the schedule's `expected_version`, frozen hash and dependency hash equal to the schedule's)",
        citations: [],
      },
      {
        text: ', running all 17 preflight categories in the execute phase with the verified `PreflightEvidence` (current provider key and version, `evaluatedAt` within 60 seconds, recomputed `bindingHash`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute phase with a current schedule creator passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'at execution stale or mis-bound evidence is preflight_evidence_stale (DEC-158c) [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'DEC-158c: the binding is verified for EVERY outcome, a blocked run included [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence evaluated 61 s ago is stale (409 preflight_evidence_stale) [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'evidence of another provider version is stale: the Worker must run the current checker [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the binding hash is the SHA-256 of the JCS { checkerKey, checkerVersion, dependencyHash, revisionContentHash, revisionId } [P2-S11-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'absent proof, a failed checker run, stale proof (over 60 s) and proof bound to other rows (DEC-158(c)) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
        ],
      },
      {
        text: ", and rechecking that the schedule creator's `cms.publisher` grant is unrevoked and has not ended before the fire instant.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: a creator grant that ended before the fire instant fails (DEC-120) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: a schedule creator with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "`version` equal to the schedule\'s `expected_version`, frozen hash and dependency hash equal to the schedule\'s". The executor compares the review version, dependency hash, activation-evidence hash and the revision payload hash with the schedule row, but no test builds an approved review whose version or dependency hash or frozen hash differs from its schedule and shows the schedule blocked approval_invalidated; the cited tests reach approval_invalidated only through an invalidated review state and a drifted frozen manifest.',
  },
  {
    criterion: 'P2-S11-AC-081',
    text: "CMS-03B-20 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked), re-derives the schedule creator's `cms.publisher` authority at the fire instant without rechecking MFA (DEC-120), and carries only identifiers, versions, hashes and correlation data in claims and queue messages, never content, comments, field values or tokens.",
    clauses: [
      {
        text: 'CMS-03B-20 grants EXECUTE only to the registered Worker `scheduled` sweep principal (PUBLIC, anon, authenticated and every other role revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'cms_claim_due_publication_schedules is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'the platform_api wrapper is executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'cms_execute_publication_schedule is a private SECURITY DEFINER of the CMS definer (empty search_path) that no API role, service_role included, can execute [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the platform_api wrapper is executable by service_role only, not by PUBLIC, anon or authenticated [P2-S11-AC-081]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries lets only the scheduled sweep import the claim/execute port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries keeps the RPC names inside their own modules and the sweep transport',
          },
        ],
      },
      {
        text: "re-derives the schedule creator's `cms.publisher` authority at the fire instant without rechecking MFA (DEC-120)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              "the execute-phase revocation rechecks only the creator's grant and the entry: a counted approver's lapsed grant does not stop a scheduled publication, and MFA is not rechecked (DEC-120) [P2-S11-AC-081]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: a creator grant that ended before the fire instant fails (DEC-120) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              "execute rechecks only the creator's publisher grant and the entry (DEC-120): approvals are invalidated at the loss, not re-counted [P2-S11-AC-096]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
        ],
      },
      {
        text: 'and carries only identifiers, versions, hashes and correlation data in claims and queue messages, never content, comments, field values or tokens.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a claim carries no publisher, author, party, account, title or content [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              "a ClaimedSchedule is exactly the eight identifier / version / hash members: the claim's schedule version (the CAS operand), the approved review version, the lease and the derived correlation [P2-S11-AC-079]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the result carries no publisher, author, party or review identifier [P2-S11-AC-081]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts returns identifiers, versions, hashes and correlation data only',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep.test.ts',
            title:
              'a quiet tick claims the bounded batch once and logs only the count',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep.test.ts',
            title:
              'executing claims keeps going after one execution fails and logs it without ids',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-082',
    text: 'CMS-03B-20 runs as a Worker `scheduled` sweep every minute with batch 25, claims under `FOR UPDATE SKIP LOCKED` with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id`/`lease_until`, runs claim and execute under the 15,000 ms job deadline, and applies the retry ladder of 15 s, 60 s and 300 s for the first, second and third failure, a fourth consecutive retryable failure blocking the schedule with `retries_exhausted`.',
    clauses: [
      {
        text: 'CMS-03B-20 runs as a Worker `scheduled` sweep every minute with batch 25',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/worker-wrangler-config.test.ts',
            title:
              'Worker Wrangler queue and schedule contract schedules the outbox sweep once per minute in every environment',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep-wiring.test.ts',
            title:
              'scheduled publication sweep wiring runs the publication schedule sweep with the platform bindings on every tick',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-publication-schedule-sweep.test.ts',
            title:
              'a quiet tick claims the bounded batch once and logs only the count',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/internal-rpc.test.ts',
            title:
              '[P2-S11-AC-079] CMS-03B-20 claim and execute contracts fixes the sweep cadence, lease, deadline and the 15/60/300 second retry ladder',
          },
        ],
      },
      {
        text: 'claims under `FOR UPDATE SKIP LOCKED`',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C2: a claim does NOT wait on a schedule row locked by another session (SKIP LOCKED)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C2: the unlocked schedules are claimed, the locked one is skipped and stays pending',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C2: once the lock is released the next claim takes the skipped schedule, and only it',
          },
        ],
      },
      {
        text: 'with a version CAS from `pending` or `failed_retryable` to `executing` and a five-minute `lease_id`/`lease_until`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a claimed schedule is executing at version + 1 with a fresh five-minute lease, a job id and its attempt count intact (a retry keeps its attempts) [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'a second claim finds nothing due (the claimed ones hold their leases, the recovered ones wait for their next attempt) and changes nothing [P2-S11-AC-082]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C1: no sweeper exceeded its batch of 5, each schedule holds its own lease and is executing at version 2',
          },
        ],
      },
      {
        text: 'runs claim and execute under the 15,000 ms job deadline',
        citations: [],
      },
      {
        text: 'and applies the retry ladder of 15 s, 60 s and 300 s for the first, second and third failure, a fourth consecutive retryable failure blocking the schedule with `retries_exhausted`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'the retry ladder sets next_attempt_at to now + 15 s, 60 s and 300 s after the first, second and third failure; a blocked schedule has none [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the first retry waits 15 s and the lease is released [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the second consecutive failure waits 60 s (attempt_count 2) [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the third consecutive failure waits 300 s (attempt_count 3) [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the fourth consecutive retryable failure blocks the schedule with retries_exhausted [P2-S11-AC-082]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] real 60-second and 300-second retries end at fourth failure with prior publication intact',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "runs claim and execute under the 15,000 ms job deadline". The 15,000 ms value is asserted only as the exported constant CMS_SCHEDULE_DEADLINE_MS (internal-rpc.test.ts); no test shows the sweep passing that deadline to its claim and execute RPC calls or aborting a hung claim/execute at 15,000 ms (async-runtime.test.ts proves abort only at an explicit 25 ms deadline).',
  },
  {
    criterion: 'P2-S11-AC-083',
    text: 'CMS-03B-20 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming, returns a repeated execution of a `completed` schedule as `already_completed` with no effect, blocks with the closed `reasonCode` (`approval_invalidated`, `preflight_failed`, `publisher_authority_ended`, `publication_not_active`, `retries_exhausted`) while the prior publication stays intact, cancels with `entry_unavailable`, retries an `unavailable` preflight as `failed_retryable`, runs a late schedule and records its `deviation_seconds`, and never creates a duplicate lineage row or event.',
    clauses: [
      {
        text: 'CMS-03B-20 returns an expired `executing` lease to `failed_retryable` with `attempt_count` + 1 before claiming',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'an expired lease returns the schedule to failed_retryable with attempt_count + 1 and releases the lease; the fourth consecutive failure blocks it with retries_exhausted [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'each lease recovery is audited without an actor: three retries and one retries_exhausted block [P2-S11-AC-083]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C3: each expired lease was returned to failed_retryable exactly once (attempt_count 1, version 3); the live lease is untouched',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts',
            title:
              'CMS-03B-20 real lineage and replay [CMS-03B-20] actual ordered claim load execute operands bind all actions and late canonical lineage effects plus independently proved global expired-lease recovery',
          },
        ],
      },
      {
        text: 'returns a repeated execution of a `completed` schedule as `already_completed` with no effect',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts',
            title:
              'CMS-03B-20 real lineage and replay [CMS-03B-20] every completed execution replays all typed fields and has zero full-row effects',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E1: one lineage row, one cms.publication.changed.v1, one audit record, the schedule completed once',
          },
        ],
      },
      {
        text: 'blocks with the closed `reasonCode` (`approval_invalidated`, `preflight_failed`, `publisher_authority_ended`, `publication_not_active`, `retries_exhausted`) while the prior publication stays intact',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a failed category (a media reference) blocks the schedule preflight_failed and appends nothing [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'an unpublish without an active head blocks the schedule with publication_not_active and appends nothing [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the fourth consecutive retryable failure blocks the schedule with retries_exhausted [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a blocked outcome appends no lineage row and emits no publication event: the prior publication stays intact [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] unavailable load retries at 15 seconds while absent active head blocks with complete typed null fields',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] real 60-second and 300-second retries end at fourth failure with prior publication intact',
          },
        ],
      },
      {
        text: 'cancels with `entry_unavailable`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'entry_unavailable cancels the schedule as well [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'with the schedule reason entry_unavailable, not approval_invalidated [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'and cancels its schedule with entry_unavailable [P2-S11-AC-112]',
          },
        ],
      },
      {
        text: 'retries an `unavailable` preflight as `failed_retryable`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'absent proof, a failed checker run, stale proof (over 60 s) and proof bound to other rows (DEC-158(c)) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] unavailable load retries at 15 seconds while absent active head blocks with complete typed null fields',
          },
        ],
      },
      {
        text: 'runs a late schedule and records its `deviation_seconds`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a schedule that fell due two hours ago still executes and records a deviation of about 7,200 seconds [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the result names the appended lineage row, the actual instant and the deviation from the resolved instant (about a minute late here) [P2-S11-AC-083]',
          },
        ],
      },
      {
        text: 'and never creates a duplicate lineage row or event.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E1: one lineage row, one cms.publication.changed.v1, one audit record, the schedule completed once',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C4: the new lease completes the schedule once: one lineage row, one cms.publication.changed.v1',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts',
            title:
              'CMS-03B-20 real lineage and replay [CMS-03B-20] every completed execution replays all typed fields and has zero full-row effects',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-084',
    text: "CMS-03B-20 appends the publication lineage row and emits exactly one identifier-only `cms.publication.changed.v1` (with that row's id as `publicationVersionId`), the audit record and the schedule CAS in one transaction, so the CMS-03B-15 workflow read reports the schedule's resulting `state`, `reasonCode` and the appended publication; verification covers two concurrent sweepers under `SKIP LOCKED`, lease-expiry recovery, duplicate and late runs, every `reasonCode`, the retry ladder to `retries_exhausted`, the DEC-120 revocation recheck without an MFA recheck, and tombstone append for unpublish, expire and archive.",
    clauses: [
      {
        text: "CMS-03B-20 appends the publication lineage row and emits exactly one identifier-only `cms.publication.changed.v1` (with that row's id as `publicationVersionId`), the audit record and the schedule CAS in one transaction",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the schedule is completed at version 3 with actual_at_utc and deviation_seconds = round(actual - resolved), its lease released [P2-S11-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the lineage head carries the schedule id, the schedule creator as publisher and the frozen evidence and version set [P2-S11-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              "exactly one identifier-only cms.publication.changed.v1 and one system audit record (the claim's correlation, no actor) commit with the schedule; the revision is published [P2-S11-AC-084]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the result names the appended lineage row, the actual instant and the deviation from the resolved instant (about a minute late here) [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-composition.apispec.ts',
            title:
              'CMS-03B-20 real lineage and replay [CMS-03B-20] actual ordered claim load execute operands bind all actions and late canonical lineage effects plus independently proved global expired-lease recovery',
          },
        ],
      },
      {
        text: "so the CMS-03B-15 workflow read reports the schedule's resulting `state`, `reasonCode` and the appended publication",
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-15] the workflow read of a swept entry lists the completed schedule and its publication',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a publication row carries its lineage id, own id, sequence, derived state (superseded / active / revoked), action, hash and projectionState pending (never converged) [P2-S11-AC-050]',
          },
        ],
      },
      {
        text: 'verification covers two concurrent sweepers under `SKIP LOCKED`',
        citations: [
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C2: a claim does NOT wait on a schedule row locked by another session (SKIP LOCKED)',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C3: two concurrent sweepers recovered each schedule once: exactly one audit record per recovery',
          },
        ],
      },
      {
        text: 'lease-expiry recovery',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'an expired lease returns the schedule to failed_retryable with attempt_count + 1 and releases the lease; the fourth consecutive failure blocks it with retries_exhausted [P2-S11-AC-083]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C3: each expired lease was returned to failed_retryable exactly once (attempt_count 1, version 3); the live lease is untouched',
          },
        ],
      },
      {
        text: 'duplicate and late runs',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a schedule that fell due two hours ago still executes and records a deviation of about 7,200 seconds [P2-S11-AC-083]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E1: one lineage row, one cms.publication.changed.v1, one audit record, the schedule completed once',
          },
        ],
      },
      {
        text: 'every `reasonCode`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a failed category (a media reference) blocks the schedule preflight_failed and appends nothing [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'an unpublish without an active head blocks the schedule with publication_not_active and appends nothing [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the fourth consecutive retryable failure blocks the schedule with retries_exhausted [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'with the schedule reason entry_unavailable, not approval_invalidated [P2-S11-AC-111]',
          },
        ],
      },
      {
        text: 'the retry ladder to `retries_exhausted`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the first retry waits 15 s and the lease is released [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the second consecutive failure waits 60 s (attempt_count 2) [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the third consecutive failure waits 300 s (attempt_count 3) [P2-S11-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'the fourth consecutive retryable failure blocks the schedule with retries_exhausted [P2-S11-AC-082]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] real 60-second and 300-second retries end at fourth failure with prior publication intact',
          },
        ],
      },
      {
        text: 'the DEC-120 revocation recheck without an MFA recheck',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              "the execute-phase revocation rechecks only the creator's grant and the entry: a counted approver's lapsed grant does not stop a scheduled publication, and MFA is not rechecked (DEC-120) [P2-S11-AC-081]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a schedule whose creator no longer holds an unrevoked cms.publisher grant is blocked publisher_authority_ended [P2-S11-AC-081]',
          },
        ],
      },
      {
        text: 'and tombstone append for unpublish, expire and archive.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'unpublish, expire and archive schedules complete [P2-S11-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'each tombstone is a revoked successor row at version 2 that names the ended head and the schedule and copies its revision and evidence, with revoked_at set and no activation [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'each tombstone emitted exactly one cms.publication.changed.v1 at lineage version 2 [P2-S11-AC-116]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-085',
    text: 'Derived revision state (E2): the physical `cms_entry_revisions.state` is the constant `draft`, and every browser-visible `EntryRevisionState` (`EntryRevisionResource`, `RevisionSummary`, `EntryListItem`, `EntryDraftDetailResource`, `EntryWorkflowRevision` and the CMS-03B-03 and CMS-03B-13 `state` filters) comes from the one helper `platform_private.cms_revision_effective_state` (set form `cms_revision_effective_states`), whose first match wins in the order `published`, `scheduled`, `approved`, `rejected`, `submitted`, `draft` (a revision with no review, or whose latest review is `invalidated`, is `draft`), so only an effective `draft` revision can be submitted and a `rejected` one is terminal.',
    clauses: [
      {
        text: 'Derived revision state (E2): the physical `cms_entry_revisions.state` is the constant `draft`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_state_check.sql',
            title:
              'the stored revision state is closed to the constant draft [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_state_check.sql',
            title:
              'a revision cannot be stored as submitted: that state is derived from review evidence [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_state_check.sql',
            title:
              'a revision cannot be stored as published: that state is derived from the publication lineage [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_state_check.sql',
            title:
              'no stored revision carries a state other than draft [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title:
              'the seeded revisions are all stored as the constant draft; the other states are evidence [P2-S11-AC-085]',
          },
        ],
      },
      {
        text: 'and every browser-visible `EntryRevisionState` (`EntryRevisionResource`, `RevisionSummary`, `EntryListItem`, `EntryDraftDetailResource`, `EntryWorkflowRevision` and the CMS-03B-03 and CMS-03B-13 `state` filters) comes from the one helper `platform_private.cms_revision_effective_state` (set form `cms_revision_effective_states`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_list_entries derives the state in batches and never reads the physical column [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_list_revisions derives the state in batches and never reads the physical column [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_get_entry_draft projects the derived state of the current draft revision [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_create_entry answers the derived state of the revision it created [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_create_revision answers the derived state of the revision it appended [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_resolve_conflict answers the derived state of the revision it appended [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_restore_revision answers the derived state of the revision it appended [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'none of the three Slice 10 readers reads cms_entry_revisions.state [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title:
              'every listed item carries the DERIVED state of its current draft revision [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title:
              'the CMS-03B-11 draft detail answers the derived state of the current draft revision [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_history.sql',
            title:
              'every visible revision carries its DERIVED state; the scheduled and published foreign revisions are concealed [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the entry meta carries the aggregate version (the If-Match operand) and the revision its derived state, true content hash, locale, schema version and current-draft flag [P2-S11-AC-049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'both effective-state helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'the set form returns the same derived state per revision as the single form [P2-S11-AC-085]',
          },
        ],
      },
      {
        text: 'whose first match wins in the order `published`, `scheduled`, `approved`, `rejected`, `submitted`, `draft` (a revision with no review, or whose latest review is `invalidated`, is `draft`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title: 'a revision with no review is draft [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'a revision whose latest review is open is submitted [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'a revision whose latest review is approved is approved [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'a revision whose latest review is rejected is rejected [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'an invalidated review returns its revision to draft (resubmittable) [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'an approved revision with a pending publish schedule is scheduled (second rule beats the third) [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'a revision referenced by a publish lineage row is published (no review needed) [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'published wins over a live schedule and an approved review (first match) [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_effective_state.sql',
            title:
              'an invalidated older review does not mask the newer open review [P2-S11-AC-085]',
          },
        ],
      },
      {
        text: ', so only an effective `draft` revision can be submitted and a `rejected` one is terminal.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a superseded revision and a revision under an open, approved or rejected review are 409 revision_not_submittable [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the same revision is resubmitted after an invalidation: a second review row, the first kept as history [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_composition_guard.sql',
            title:
              'a composition instance is admitted only on a revision whose DERIVED state is draft (an invalidated review returns the revision to draft) [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a rejected review accepts no further decision [P2-S11-AC-108]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-086',
    text: 'Derived revision state (E2): a `state` filter on CMS-03B-03 and CMS-03B-13 is evaluated over keyset candidates read in batches of 200 and returns up to `limit` matching rows; the RPC scans at most 1,000 candidates per request and, on reaching that bound, returns the rows found with a cursor positioned after the last scanned candidate (a filtered page may be shorter than `limit` while `nextCursor` is non-null); the cursor and sort never depend on the derived state; and the Slice 10 reads and the revision write responses adopt the helper in the Slice 11 forward migration.',
    clauses: [
      {
        text: 'Derived revision state (E2): a `state` filter on CMS-03B-03 and CMS-03B-13 is evaluated over keyset candidates read in batches of 200 and returns up to `limit` matching rows',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'a 1,000-candidate scan evaluates the derived state in five batches of 200 [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title: 'limit 1 returns the first match [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'the dense filtered page lists the first 25 draft entries in keyset order [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_history.sql',
            title:
              'a 1,000-candidate scan evaluates the derived state in five batches of 200 [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_history.sql',
            title: 'limit 1 returns the first match [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title: 'state=submitted selects the open review [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_history.sql',
            title:
              'state=submitted selects every open-review revision, the foreign one included (visible) [P2-S11-AC-086]',
          },
        ],
      },
      {
        text: 'the RPC scans at most 1,000 candidates per request and, on reaching that bound, returns the rows found with a cursor positioned after the last scanned candidate (a filtered page may be shorter than `limit` while `nextCursor` is non-null)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'the first filtered page lists the matches among the first 1,000 candidates and not the one at rank 1001 [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'the page is shorter than the limit while nextCursor is non-null: the scan bound was reached [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'the cursor is positioned after the last scanned candidate (rank 1000), not after the last match [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'a filtered page may be empty while nextCursor is non-null (no match in the first 1,000 candidates) [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_history.sql',
            title:
              'the first filtered page lists the matches among the first 1,000 candidates and not rank 1001 [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_history.sql',
            title:
              'the cursor is positioned after the last scanned candidate (rank 1000 = revision 232) [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_history.sql',
            title:
              'the resumed page lists the remaining matches and ends the walk with no cursor [P2-S11-AC-086]',
          },
        ],
      },
      {
        text: 'the cursor and sort never depend on the derived state',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title:
              'a derived-state change on entries ahead of and behind the cursor is not a collection change: no CONFLICT [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_reads_entries.sql',
            title:
              'the sort is the same keyset order after the state changes [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_scan_entries.sql',
            title:
              'derived-state changes on scanned and unscanned entries are not a collection change [P2-S11-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'the signed list wrapper still exists unchanged (the cursor seal is not touched) [P2-S11-AC-086]',
          },
        ],
      },
      {
        text: 'and the Slice 10 reads and the revision write responses adopt the helper in the Slice 11 forward migration.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_list_entries derives the state in batches and never reads the physical column [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_list_revisions derives the state in batches and never reads the physical column [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'cms_create_revision answers the derived state of the revision it appended [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'none of the three Slice 10 readers reads cms_entry_revisions.state [P2-S11-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e2_adoption.sql',
            title:
              'the bounds are named constants (scan_bound, batch_size), not magic numbers [P2-S11-AC-086]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-087',
    text: 'Frozen dependency manifest (E1): `platform_private.cms_build_dependency_manifest(p_revision_id)` is the only builder of a `DependencyManifest`, reads canonical state under RLS, accepts no caller value, canonicalizes with RFC 8785/JCS, sorts every list ascending by the lowercase UUID string (bytewise) with each identity once, and refuses more than 256 entries in total or 32 KiB serialized as 422 `VALIDATION_FAILED` `dependency_manifest_too_large`.',
    clauses: [
      {
        text: 'Frozen dependency manifest (E1): `platform_private.cms_build_dependency_manifest(p_revision_id)` is the only builder of a `DependencyManifest`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'exactly one overload of each manifest helper exists [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the manifest helpers are private SECURITY DEFINER functions of the CMS definer with an empty search_path and no API-role execute [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the manifest has exactly the nine contract groups [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a submitted manifest that differs from the rebuilt one in any member is 409 dependency_changed carrying only the CURRENT dependencyHash [P2-S11-AC-005]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] freezes exact hashes, manifest, version set, policy and dependency rows with six atomic effect groups; fresh-evidence replay changes none',
          },
        ],
      },
      {
        text: 'reads canonical state under RLS',
        citations: [],
      },
      {
        text: 'accepts no caller value',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a null revision id is a malformed helper call [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title: 'an absent revision is NOT_FOUND [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the builder is deterministic: two builds of one revision are identical [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a submitted manifest that differs from the rebuilt one in any member is 409 dependency_changed carrying only the CURRENT dependencyHash [P2-S11-AC-005]',
          },
        ],
      },
      {
        text: 'canonicalizes with RFC 8785/JCS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a manifest of exactly 32768 UTF-8 bytes is within bounds [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
            title:
              'known answer 1: a scrambled-order policy member hashes to the independently computed canonical digest [P2-S09-AC-665]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
            title:
              'known answer 3: RFC 8785 string escaping (\\u000f, \\n, quote, backslash, unescaped solidus) [P2-S09-AC-665]',
          },
        ],
      },
      {
        text: 'sorts every list ascending by the lowercase UUID string (bytewise) with each identity once',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'blocks: each identity once, ascending by id, hash = the registry release_digest, a retired instance contributes nothing [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'patterns: each PatternVersion once, ascending by id, hash = content_hash [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'terms: distinct terms of the active assignments, ascending by id, hash = SHA-256 of the JCS { id, termKey, lifecycle, version, successorId } of the term row [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'blocks reachable from the template slots are listed even with no composition instance (sorted by id) [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a structurally invalid manifest is never current: one case per missing group and per violated rule [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'control: a well-formed manifest (sorted, unique, populated optional groups) is still current [P2-S11-AC-090]',
          },
        ],
      },
      {
        text: 'and refuses more than 256 entries in total or 32 KiB serialized as 422 `VALIDATION_FAILED` `dependency_manifest_too_large`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              '128 blocks + 124 relations + 4 = exactly 256 entries is within bounds [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title: '257 entries is over the bound [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a manifest of 32769 bytes is over the bound [P2-S11-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              '128 blocks + 128 relations + the singletons exceed 256 entries: dependency_manifest_too_large, no manifest [P2-S11-AC-087]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog pins the three status groups to the exact BE03b tokens',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-009][P2-S11-AC-021][P2-S11-AC-027][P2-S11-AC-033] closed Slice 11 reason catalog maps each token to its single HTTP status',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "reads canonical state under RLS". The builder is a private SECURITY DEFINER that runs inside the CMS RPC context, but no test shows that it reads through row-level security (for example that the same call outside the CMS RPC context, or for a caller whose RLS context excludes the revision, returns nothing or refuses); the pgTAP suite always sets app.cms_rpc first.',
  },
  {
    criterion: 'P2-S11-AC-088',
    text: 'Frozen dependency manifest (E1): the manifest groups `schema`, `template`, `blocks`, `patterns`, `terms`, `localeSources`, `settings`, `relations` and `checker` each carry exactly the identities and hash sources the group table declares (for example `blocks` hash with the registry `releaseDigest`, `terms` with the SHA-256 of the JCS `{ id, termKey, lifecycle, version, successorId }`, `settings` with the E7 snapshot, and `relations` omit an unavailable target whose registry `onUnavailable` is `omit` or `placeholder`).',
    clauses: [
      {
        text: 'Frozen dependency manifest (E1): the manifest groups `schema`, `template`, `blocks`, `patterns`, `terms`, `localeSources`, `settings`, `relations` and `checker` each carry exactly the identities and hash sources the group table declares (for example `blocks` hash with the registry `releaseDigest`, `terms` with the SHA-256 of the JCS `{ id, termKey, lifecycle, version, successorId }`, `settings` with the E7 snapshot, and `relations` omit an unavailable target whose registry `onUnavailable` is `omit` or `placeholder`).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'schema group: version id/definition hash, the compiled artifact, the frozen rich_text.v1 validator, the real workflow policy and the activation evidence [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the other eight groups of a clean revision: null template, empty lists, the empty-snapshot settings and the registry checker [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'template group: { id, hash } with the TemplateVersion content_hash [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a revision without a template has a JSON null template [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'blocks: each identity once, ascending by id, hash = the registry release_digest, a retired instance contributes nothing [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'patterns: each PatternVersion once, ascending by id, hash = content_hash [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'terms: distinct terms of the active assignments, ascending by id, hash = SHA-256 of the JCS { id, termKey, lifecycle, version, successorId } of the term row [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              "localeSources: the recorded source locale, source revision and sourceHash of the revision's LocaleVariant [P2-S11-AC-088]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a source-locale revision has no localeSources entry [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'relations: a pinned version wins over the current one, an unpinned target shows its current version, an unavailable omit/placeholder target is not listed while an unavailable block target is [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'an instance of a block with no registry record cannot be frozen (DEPENDENCY_UNAVAILABLE) [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'building reuses the save-initialized owner snapshot (ordinal 1), preserving the single-row count [P2-S11-AC-092]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-089',
    text: 'Frozen dependency manifest (E1): `dependencyHash` is the lowercase SHA-256 of the JCS manifest, the `VersionSet` is the pure projection `versionSetOf(manifest, revision)` with the declared copy rules (`taxonomyVersionIds` sorted bytewise, `settingsVersion` from `manifest.settings.version`, `compilerVersion` from the schema artifact), CMS-03B-15 serves both so the forms echo them unmodified into CMS-03B-05, CMS-03B-08 and CMS-03B-09, and the server never accepts a manifest or version set it cannot rebuild bit-for-bit.',
    clauses: [
      {
        text: 'Frozen dependency manifest (E1): `dependencyHash` is the lowercase SHA-256 of the JCS manifest',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'dependencyHash (the JCS SHA-256 of the manifest) is stable [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
            title:
              'known answer 1: a scrambled-order policy member hashes to the independently computed canonical digest [P2-S09-AC-665]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_09_r3_grants_misc.sql',
            title:
              'known answer 3: RFC 8785 string escaping (\\u000f, \\n, quote, backslash, unescaped solidus) [P2-S09-AC-665]',
          },
        ],
      },
      {
        text: 'the `VersionSet` is the pure projection `versionSetOf(manifest, revision)` with the declared copy rules (`taxonomyVersionIds` sorted bytewise, `settingsVersion` from `manifest.settings.version`, `compilerVersion` from the schema artifact)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/version-set.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf(manifest, revision): the pure projection copies the schema, template, settings and compiler members from the manifest',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/version-set.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf(manifest, revision): the pure projection takes block and pattern ids from the manifest and the revision taxonomy ids sorted bytewise',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/version-set.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf(manifest, revision): the pure projection recognizes a version set that projects its manifest (taxonomy aside) and refuses any drift',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'parity fixture 2: unsorted taxonomy ids are sorted bytewise ascending [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'settingsVersion is the manifest settings ordinal as a decimal string [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'compilerVersion is the schema artifact compiler version [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'a version set has exactly the thirteen members of the VersionSet contract [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              "the revision version set carries the revision's taxonomy ids sorted bytewise [P2-S11-AC-089]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              "cms_revision_version_set is cms_version_set_of(manifest, the revision's taxonomy ids) [P2-S11-AC-089]",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf equals the SQL cms_version_set_of over the shared parity fixture minimal manifest: no template, no groups projects the manifest to exactly the version set the SQL expects',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf equals the SQL cms_version_set_of over the shared parity fixture full manifest: template, blocks, patterns, terms, locale source, relations, protected policy projects the manifest to exactly the version set the SQL expects',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-089] versionSetOf equals the SQL cms_version_set_of over the shared parity fixture taxonomy ids are sorted bytewise and are the only member not read from the manifest projects the manifest to exactly the version set the SQL expects',
          },
        ],
      },
      {
        text: 'CMS-03B-15 serves both so the forms echo them unmodified into CMS-03B-05, CMS-03B-08 and CMS-03B-09',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) sends the served preparation unmodified at the entry version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) echoes the served version set unmodified at the entry version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) echoes the approved candidate unmodified at the review version and then refetches',
          },
        ],
      },
      {
        text: 'and the server never accepts a manifest or version set it cannot rebuild bit-for-bit.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a submitted manifest that differs from the rebuilt one in any member is 409 dependency_changed carrying only the CURRENT dependencyHash [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an expectedVersionSet that is not exactly the version set frozen on the approved review (schema, settings or taxonomy member) is 409 version_set_stale [P2-S11-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'a version set with an unknown extra member is not a match (strict, like the contract) [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'a version set missing a member is not a match [P2-S11-AC-089]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_version_set.sql',
            title:
              'a version set that repeats a taxonomy id is not a match: the taxonomy list cannot self-seed a duplicate [P2-S11-AC-089]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-090',
    text: 'Frozen dependency manifest (E1): a frozen identity is current only when its source still serves it (schema version `active` with an equal artifact hash; template and pattern versions `active` with equal hashes; taxonomy versions `active`; blocks `supported` or `deprecated`, never `withdrawn`; settings snapshot equal), and a command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale` and invalidates the review `dependency_changed`.',
    clauses: [
      {
        text: 'Frozen dependency manifest (E1): a frozen identity is current only when its source still serves it (schema version `active` with an equal artifact hash; template and pattern versions `active` with equal hashes; taxonomy versions `active`; blocks `supported` or `deprecated`, never `withdrawn`; settings snapshot equal)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a freshly built manifest of a revision with template, blocks and patterns is current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a schema version that is no longer active is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a schema artifact whose hash differs is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a template version that is no longer active is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a template whose digest differs is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a pattern version that is no longer active is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a pattern whose content hash differs is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'status: a revision recording a taxonomy version that is not active is stale [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'a deprecated block is still current (supported or deprecated) [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title: 'a withdrawn block is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title: 'a moved settings ordinal is not current [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title: 'a different settings hash is not current [P2-S11-AC-090]',
          },
        ],
      },
      {
        text: 'and a command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) and finds a non-current identity or a differing recomputed manifest returns 409 `CONFLICT` `version_set_stale`',
        citations: [],
      },
      {
        text: 'and invalidates the review `dependency_changed`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'the invalidation committed (review invalidated at version 3, one review-changed event) and no publication row or event exists [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the invalidation committed (review invalidated at version 3, one review-changed event) and no schedule exists [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a frozen manifest that is no longer current invalidates the review (dependency_changed) and blocks the schedule approval_invalidated [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'status: an unchanged manifest with a withdrawn block is stale (non-current identity) [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'status: a rebuilt manifest that differs from the frozen one is stale even though every frozen identity is current [P2-S11-AC-090]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "returns 409 `CONFLICT` `version_set_stale`" for a command (CMS-03B-07, CMS-03B-09, the executor) that finds a non-current frozen identity or a differing recomputed manifest. The implemented and tested outcome is different: a stale frozen manifest is the COMMITTED refusal 409 `CONFLICT` `dependency_changed` carrying the current dependencyHash (and the executor blocks the schedule approval_invalidated), while `version_set_stale` is raised only when the caller\'s expectedVersionSet differs from the frozen or recomputed set. The tracker/BE03b wording (BE03b line 1773) and the code disagree: either the criterion text or the refusal token needs an orchestrator decision.',
  },
  {
    criterion: 'P2-S11-AC-091',
    text: "Settings snapshot authority (E7): `CMS_PUBLICATION_SETTINGS_KEYS` is one code-owned registry (version 1, empty, exported by the contracts package and mirrored by `platform_private.cms_publication_settings_keys()`), the snapshot is evaluated at the command's server instant through `cfg_resolve_effective_value` with consumer key `cms.publication` for each registered key in ascending order, and `settings.hash` is the lowercase SHA-256 of the JCS snapshot (the empty array hashes to `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`).",
    clauses: [
      {
        text: 'Settings snapshot authority (E7): `CMS_PUBLICATION_SETTINGS_KEYS` is one code-owned registry (version 1, empty, exported by the contracts package and mirrored by `platform_private.cms_publication_settings_keys()`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/settings-registry.test.ts',
            title:
              '[P2-S11-AC-091][P2-S11-AC-092] settings snapshot authority (E7) is registry version 1 with no members and the cms.publication consumer key',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-091][P2-S11-AC-092] the SQL settings registry equals CMS_PUBLICATION_SETTINGS_KEYS returns an empty key array at registry version 1, as the contracts constant does',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'CMS_PUBLICATION_SETTINGS_KEYS registry version 1 has no members [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title: 'the registry version is 1 [P2-S11-AC-091]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/settings-registry.test.ts',
            title:
              '[P2-S11-AC-091][P2-S11-AC-092] settings snapshot authority (E7) keeps the registry a unique, ascending key list',
          },
        ],
      },
      {
        text: "the snapshot is evaluated at the command's server instant through `cfg_resolve_effective_value` with consumer key `cms.publication` for each registered key in ascending order",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the evaluation goes through cfg_resolve_effective_value with consumer key cms.publication [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'registered keys are evaluated in ascending bytewise order [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'a registered key the resolver cannot serve makes the snapshot unavailable (never a partial snapshot) [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'with no registered key the effective values are the empty array [P2-S11-AC-091]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/settings-registry.test.ts',
            title:
              '[P2-S11-AC-091][P2-S11-AC-092] settings snapshot authority (E7) requires a snapshot to carry exactly the registered keys, in registry order, for any registry',
          },
        ],
      },
      {
        text: 'and `settings.hash` is the lowercase SHA-256 of the JCS snapshot (the empty array hashes to `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'oracle: the empty array hashes to the spec constant [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: the empty snapshot hashes to 4f53cda1...2b945 and takes ordinal 1 [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: a hash that is not the JCS SHA-256 of the stored values is refused [P2-S11-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: the snapshot hash is 64 lowercase hex characters [P2-S11-AC-091]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/settings-registry.test.ts',
            title:
              '[P2-S11-AC-091][P2-S11-AC-092] settings snapshot authority (E7) hashes the empty snapshot to the SHA-256 of its JCS form `[]`',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-092',
    text: "Settings snapshot authority (E7): `settings.version` is the ordinal of the snapshot in `platform_private.cms_publication_settings_snapshots`, inserted under `INSERT ... ON CONFLICT (owner_id, snapshot_hash) DO NOTHING` and read back, a new snapshot taking the owner's previous maximum ordinal plus one under the owner's advisory lock (the first is ordinal 1), ordinals compared for equality only (restoring earlier values reuses the earlier snapshot and ordinal), no forward migration seeding a row, and the table private with forced RLS, immutable, `UNIQUE(owner_id, snapshot_hash)` and `UNIQUE(owner_id, ordinal)`.",
    clauses: [
      {
        text: 'Settings snapshot authority (E7): `settings.version` is the ordinal of the snapshot in `platform_private.cms_publication_settings_snapshots`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title: 'the version member is the ordinal as text [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the version member is a JSON string (a lossless decimal) [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the answer carries exactly version and hash (no owner or snapshot identifier) [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the current empty hash reuses stored ordinal 1 despite later noncurrent ordinal 2 [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the other eight groups of a clean revision: null template, empty lists, the empty-snapshot settings and the registry checker [P2-S11-AC-088]',
          },
        ],
      },
      {
        text: ', inserted under `INSERT ... ON CONFLICT (owner_id, snapshot_hash) DO NOTHING` and read back',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: insert-if-absent (ON CONFLICT DO NOTHING) reuses the earlier snapshot without error [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc',
            title:
              'causal fixture: healthy B01 alone initializes canonical-owner registry1 ordinal1 [] snapshot with independent JCS hash before any manifest read',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc',
            title:
              'healthy existing-hash B01 preserves all owner and other-owner snapshot row images including IDs/timestamps/versions/ordinals/values/hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the settings lookup contains no INSERT INTO statement [P2-S11-AC-092]',
          },
        ],
      },
      {
        text: "a new snapshot taking the owner's previous maximum ordinal plus one",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              "snapshot: a new snapshot takes the owner's previous maximum ordinal plus one [P2-S11-AC-092]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: an ordinal that is not the previous maximum plus one is refused [P2-S11-AC-092]',
          },
        ],
      },
      {
        text: "under the owner's advisory lock",
        citations: [],
      },
      {
        text: '(the first is ordinal 1)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: the first ordinal is 1 and ordinals are positive [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              "snapshot: another owner's first snapshot is also ordinal 1 [P2-S11-AC-092]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_e7_settings/002-review-atomicity.sqlinc',
            title:
              'causal fixture: healthy B01 alone initializes canonical-owner registry1 ordinal1 [] snapshot with independent JCS hash before any manifest read',
          },
        ],
      },
      {
        text: ', ordinals compared for equality only (restoring earlier values reuses the earlier snapshot and ordinal)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: restoring earlier values reuses the earlier ordinal and creates no third row [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the current empty hash reuses stored ordinal 1 despite later noncurrent ordinal 2 [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title: 'the reuse inserts no row [P2-S11-AC-092]',
          },
        ],
      },
      {
        text: ', no forward migration seeding a row',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'no snapshot exists before the first evaluation (no migration seeds a row) [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_settings.sql',
            title:
              'the first missing lookup leaves no owner snapshot row [P2-S11-AC-092]',
          },
        ],
      },
      {
        text: ', and the table private with forced RLS, immutable, `UNIQUE(owner_id, snapshot_hash)` and `UNIQUE(owner_id, ordinal)`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: row-level security is enabled and forced on every Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: active-only immutable rows, one row per (owner, snapshot hash) and one ordinal per (owner, ordinal) [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: a repeated snapshot hash is a unique violation for the owner [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: a stored snapshot is never edited [P2-S11-AC-092]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_settings_snapshots_schema.sql',
            title:
              'snapshot: a stored snapshot is never deleted [P2-S11-AC-092]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "under the owner\'s advisory lock". The ordinal-allocation path that inserts a new snapshot (the authorized save seam after DEC-163) is covered for its result (previous maximum plus one, first is ordinal 1, restoring earlier values reuses the earlier ordinal, rollback of the whole save) but no test shows the owner advisory lock being taken or two concurrent first saves serializing; the lookup tests only prove the read-only lookup retains no advisory lock. A race runner or a lock-observation pgTAP is missing.',
  },
  {
    criterion: 'P2-S11-AC-093',
    text: 'Publication preflight registry (D19): `platform_private.cms_preflight_registry` is seeded by forward migration only, immutable and never writable by a caller, the current row of a category is the one with the greatest `registry_version`, the 17 categories equal `PreflightCategory` in registry order (a CI test asserts the equality), and a later slice registers its provider by inserting a newer row for its category.',
    clauses: [
      {
        text: 'Publication preflight registry (D19): `platform_private.cms_preflight_registry` is seeded by forward migration only, immutable and never writable by a caller',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the migration seeds exactly one row per category [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: rows are seeded, never active or edited [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title: 'registry: seeded rows are immutable [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title: 'registry: seeded rows are never deleted [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: a caller outside the CMS RPC context can never write the registry [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schema_posture.sql',
            title:
              'posture: anon, authenticated and service_role hold no privilege on any Slice 11 table [P2-S11-AC-119]',
          },
        ],
      },
      {
        text: 'the current row of a category is the one with the greatest `registry_version`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the current row of a category is the one with the greatest registry version [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the current row of a category is the one with the greatest registry version [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the view still lists exactly one row per category [P2-S11-AC-093]',
          },
        ],
      },
      {
        text: 'the 17 categories equal `PreflightCategory` in registry order (a CI test asserts the equality)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) lists the seventeen categories in registry order and types the enum from them',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) mirrors the code-owned registry rows: one row per category in order (CI parity with the enum)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY seeds the seventeen categories in registry order',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-sql-parity.test.ts',
            title:
              '[P2-S11-AC-093] the SQL preflight registry seed equals CMS_PREFLIGHT_REGISTRY seeds each category with the provider key, kind and reference kind the contracts declare',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the seeded categories are the seventeen categories, each once [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the registry view lists the seventeen categories in registry order [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the registry rows equal the TypeScript CMS_PREFLIGHT_REGISTRY row for row (key, version, kind, reference kind) [P2-S11-AC-093]',
          },
        ],
      },
      {
        text: 'and a later slice registers its provider by inserting a newer row for its category.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: a later slice registers its provider by inserting a newer row for its category [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              "registry: a new row is strictly newer than the category's current row [P2-S11-AC-093]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'registry version 2 naming preflight.contract at provider version 2 is unavailable (provider_unavailable) although every v1 contract check passes, and marks no other category [P2-S11-AC-093]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'control: registry version 2 that still names provider version 1 is the implemented provider and passes [P2-S11-AC-093]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-094',
    text: "Publication preflight registry (D19): the generic `preflight.reference_gate` serves the categories `pattern`, `taxonomy`, `privacy`, `media`, `route` and `locale`, passes only when `platform_private.cms_revision_references(revision, kind)` counts no reference of the category's kind and otherwise fails closed with reason `provider_unbuilt_reference` (a schema that declares a `no_fallback` field is a `locale` reference and a rich-text `internal` link is a `route` reference).",
    clauses: [
      {
        text: 'Publication preflight registry (D19): the generic `preflight.reference_gate` serves the categories `pattern`, `taxonomy`, `privacy`, `media`, `route` and `locale`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) serves the six unbuilt domains with the generic reference gate and its reference kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the six categories without a domain provider are served by the generic reference gate (D19) [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: a reference gate checks the references of its own category [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the reference-gate kind is served only by the generic preflight.reference_gate provider [P2-S11-AC-094]',
          },
        ],
      },
      {
        text: "passes only when `platform_private.cms_revision_references(revision, kind)` counts no reference of the category's kind and otherwise fails closed with reason `provider_unbuilt_reference`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a composition instance naming a PatternVersion fails the pattern gate with provider_unbuilt_reference and nothing else [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a recorded taxonomy version fails the taxonomy gate [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a held entry fails the privacy gate and the revocation lifecycle check, each with its own registered reason [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a non-empty media value fails the media gate [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a rich-text internal link fails the route gate [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the gate result carries the reference count [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a clean revision with healthy evidence passes every category [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'the seeded article revision (title + a self relation, no refs) holds no reference of any kind [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'one composition instance naming a PatternVersion is one pattern reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'one active term assignment is one taxonomy reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title: 'a held entry is a privacy reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'a non-empty media field value is one media reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'an internal rich-text link is one route reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title: 'cms_revision_references is STABLE [P2-S11-AC-094]',
          },
        ],
      },
      {
        text: '(a schema that declares a `no_fallback` field is a `locale` reference and a rich-text `internal` link is a `route` reference).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a schema that declares a no_fallback field is a locale reference even for a source-locale revision [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'control: without the no_fallback field the locale gate passes [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'before a variant row exists only the schema no_fallback field is a locale reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title:
              'an internal rich-text link is one route reference [P2-S11-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_references.sql',
            title: 'an https link is not a route reference [P2-S11-AC-094]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-095',
    text: 'Publication preflight registry (D19): each database-kind provider (`contract`, `schema`, `template`, `block`, `settings`, `relation`, `security`, `migration`, `domain_binding`, `revocation`) evaluates exactly the condition its registry row declares and emits only its declared reason codes.',
    clauses: [
      {
        text: 'Publication preflight registry (D19): each database-kind provider (`contract`, `schema`, `template`, `block`, `settings`, `relation`, `security`, `migration`, `domain_binding`, `revocation`) evaluates exactly the condition its registry row declares and emits only its declared reason codes.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) gives each database provider exactly its declared reason codes',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: the ten database-kind providers are keyed preflight.<category> at version 1 [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a stored value that violates its field kind (a number in a short_text field) fails contract value_invalid [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              "a revision whose schema version is no longer the content type's active version fails schema_not_active [P2-S11-AC-095]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a frozen template digest that differs fails template_changed [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title: 'a withdrawn block fails block_withdrawn [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a frozen settings ordinal that differs from the recomputed snapshot fails settings_changed [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a block-policy relation to an unavailable target fails relation_target_unavailable [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a script element in a stored value fails security unsafe_content [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a revision whose schema version is the source of a non-terminal migration plan fails migration_in_progress [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a frozen RelationDefinition whose projection key left the code-owned allowlist fails binding_not_allowlisted [P2-S11-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'an archived entry fails revocation entry_unavailable [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight-reasons.test.ts',
            title:
              '[P2-S11-AC-093] the closed failed and unavailable reason sets (DEC-160) derives each failed set from the registry column, without the unavailable reason',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-096',
    text: "Publication preflight registry (D19): the submit phase (CMS-03B-05) evaluates categories 1-16 and, for `revocation`, the entry lifecycle and the submitter's authority; the schedule (CMS-03B-07) and publish (CMS-03B-09) phases evaluate all 17 and recheck that the caller's `cms.publisher` grant is unrevoked and ends no earlier than the instant the action takes effect; the execute phase (CMS-03B-20) evaluates all 17 with `revocation` limited to revocation of the schedule creator's grant and the grant end before the fire instant; CMS-03B-08 runs no registry phase; and CMS-03B-15 evaluates the submit phase read-only.",
    clauses: [
      {
        text: "Publication preflight registry (D19): the submit phase (CMS-03B-05) evaluates categories 1-16 and, for `revocation`, the entry lifecycle and the submitter's authority",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'baseline: the submit evaluation of a clean revision answers a report [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'submit: a submitter with no active assignment on the entry is refused with the only reason the category registers for the entry [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'submit: a revoked assignment is no authority [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'submit: an assignment without the standing organization grant is no authority [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'control: with the grant and a fresh assignment the submit revocation check passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'an archived entry fails revocation entry_unavailable [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a deletion_pending entry fails revocation entry_unavailable [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'an archived entry fails the revocation category (entry_unavailable) [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-submit-contracts.apispec.ts',
            title:
              'CMS-03B-05 frozen submission and admission contracts [CMS-03B-05] reference-free preparation passes every submit category in exact registry order and commits through the real command',
          },
        ],
      },
      {
        text: "the schedule (CMS-03B-07) and publish (CMS-03B-09) phases evaluate all 17 and recheck that the caller's `cms.publisher` grant is unrevoked and ends no earlier than the instant the action takes effect",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'schedule phase with a current publisher passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish phase with a current publisher passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'schedule: a caller with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'publish: a caller with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a grant valid through today covers an action taking effect at 23:59:59 UTC today [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a grant that ends today does not cover an action taking effect at 00:00:00 UTC tomorrow [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a revoked publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a grant that has not started is no current authority [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'an ended tenure ends the publisher authority even with the grant row intact [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a cms.publisher grant that ends before the resolved UTC day is 422 authority_ends_before_schedule [P2-S11-AC-107]',
          },
        ],
      },
      {
        text: "the execute phase (CMS-03B-20) evaluates all 17 with `revocation` limited to revocation of the schedule creator's grant and the grant end before the fire instant",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute phase with a current schedule creator passes [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: a schedule creator with no cms.publisher grant fails publisher_authority_ended [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: a creator grant that ended before the fire instant fails (DEC-120) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'execute: an entry that left active fails entry_unavailable [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              "execute rechecks only the creator's publisher grant and the entry (DEC-120): approvals are invalidated at the loss, not re-counted [P2-S11-AC-096]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              "the execute-phase revocation rechecks only the creator's grant and the entry: a counted approver's lapsed grant does not stop a scheduled publication, and MFA is not rechecked (DEC-120) [P2-S11-AC-081]",
          },
        ],
      },
      {
        text: 'CMS-03B-08 runs no registry phase',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'CMS-03B-08 runs no registry phase: preview is not a phase [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) evaluates every category in every registry phase and CMS-03B-08 has no phase',
          },
        ],
      },
      {
        text: 'and CMS-03B-15 evaluates the submit phase read-only.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'workflow_read is not a phase of this helper: CMS-03B-15 evaluates submit read-only [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the submit-phase preflight lists all seventeen categories in registry order and passes with healthy evidence [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the read writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules, publications and entry versions are unchanged by every read above [P2-S11-AC-053]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'an evaluation writes no outbox, audit, review, schedule or idempotency row and preserves entire settings snapshot row images [P2-S11-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-noeffects.apispec.ts',
            title:
              'CMS-03B-15 read writes nothing [CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-097',
    text: 'Publication preflight registry (D19): every category is evaluated with no short circuit and the report lists all 17; any `failed` category refuses the command 422 `VALIDATION_FAILED` `preflight_failed` with `details.preflight` of at most 17 `{ category, outcome, reasonCode }` entries and no counts or finding text; otherwise any `unavailable` category refuses it 503 `DEPENDENCY_UNAVAILABLE` with `dependencyClass` `preflight` and `retryable` true; in both cases nothing commits and no success idempotency record is retained, while at execution `failed` blocks the schedule and `unavailable` retries it.',
    clauses: [
      {
        text: 'Publication preflight registry (D19): every category is evaluated with no short circuit and the report lists all 17',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'four independent failures in one revision are all reported, in the same report [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'the report still lists all seventeen categories [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title: 'the report lists all seventeen categories [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'no short circuit: the contract failure is reported beside the other categories (the cv entry also has no author assignment) [P2-S11-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-097] PreflightResult and PreflightReport aggregates without short-circuit: failed beats unavailable beats passed',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-097] PreflightResult and PreflightReport accepts a report of exactly seventeen results in registry order whose passed flag is true only when all pass',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-097] PreflightResult and PreflightReport refuses a short, long, duplicated or reordered result list',
          },
        ],
      },
      {
        text: 'any `failed` category refuses the command 422 `VALIDATION_FAILED` `preflight_failed` with `details.preflight` of at most 17 `{ category, outcome, reasonCode }` entries and no counts or finding text',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              '422 projection publishes preflight_failed with at most seventeen bare entries',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-097] PreflightResult and PreflightReport projects refusal details with category, outcome and reason only (no counts or finding text)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/refusals.test.ts',
            title:
              '[P2-S11-AC-021] refusal details per reason token carries preflight_failed with at most seventeen category/outcome/reason entries and no counts',
          },
        ],
      },
      {
        text: 'otherwise any `unavailable` category refuses it 503 `DEPENDENCY_UNAVAILABLE` with `dependencyClass` `preflight` and `retryable` true',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight (DEC-159: the Worker adds retryable) [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'absent evidence and a failed checker run make accessibility unavailable: 503 DEPENDENCY_UNAVAILABLE with dependencyClass preflight [P2-S11-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the registered preflight unavailability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses retries a preflight outage after the default delay when no hint is given',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'failed and unavailable results coexist; the caller applies failed => 422, else unavailable => 503 [P2-S11-AC-097]',
          },
        ],
      },
      {
        text: 'in both cases nothing commits and no success idempotency record is retained',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'every refusal above left no review, dependency row, reservation, audit record or outbox event behind [P2-S11-AC-009]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]',
          },
        ],
      },
      {
        text: ', while at execution `failed` blocks the schedule and `unavailable` retries it.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a failed category (a media reference) blocks the schedule preflight_failed and appends nothing [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'absent proof, a failed checker run, stale proof (over 60 s) and proof bound to other rows (DEC-158(c)) each make the schedule failed_retryable with attempt_count 1 and no reason, never a pass [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-097] PreflightResult and PreflightReport maps execution outcomes: failed blocks the schedule and unavailable retries it',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-098',
    text: 'Accessibility checker (D25): `cms.a11y.structural` version 1 is an in-process pure TypeScript Worker module with no network provider, DOM or Browser Rendering provider, registered as the `worker` provider of the `accessibility` preflight category and as the manifest `checker`, targeting `cms.entry_revision` by revision id and `revision_number`, with exactly one current version per target type, older versions readable and a `timeoutMs` of 2,000 wall-clock milliseconds covering input load and evaluation.',
    clauses: [
      {
        text: 'Accessibility checker (D25): `cms.a11y.structural` version 1 is an in-process pure TypeScript Worker module',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: determinism yields byte-identical output for identical input',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: determinism does not mutate its input',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate.test.ts',
            title:
              'evaluateAccessibilityGate: outcomes runs fresh on every call and keeps no state between calls',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/index.test.ts',
            title:
              'cms.a11y.structural public surface exports exactly the documented values',
          },
        ],
      },
      {
        text: 'with no network provider, DOM or Browser Rendering provider',
        citations: [],
      },
      {
        text: ', registered as the `worker` provider of the `accessibility` preflight category and as the manifest `checker`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) registers the structural accessibility checker as the only worker provider',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preflight_registry_schema.sql',
            title:
              'registry: accessibility is served by the Worker provider cms.a11y.structural version 1 (D25, DEC-134) [P2-S11-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'the other eight groups of a clean revision: null template, empty lists, the empty-snapshot settings and the registry checker [P2-S11-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_manifest.sql',
            title:
              'status: a one-member drift (checker version) makes the frozen manifest stale [P2-S11-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a request with no evidence cannot satisfy the Worker-resident provider: unavailable [P2-S11-AC-101]',
          },
        ],
      },
      {
        text: ', targeting `cms.entry_revision` by revision id and `revision_number`, with exactly one current version per target type, older versions readable',
        citations: [],
      },
      {
        text: 'and a `timeoutMs` of 2,000 wall-clock milliseconds covering input load and evaluation.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title:
              'timer deadline abandons a load that ignores its signal at 2,000 ms by default',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title:
              'cooperative deadline stops evaluation between nodes once the budget is spent',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title:
              'cooperative deadline stops when the load itself consumed the budget',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title: 'timer deadline honours a shorter timeoutMs',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/preflight.test.ts',
            title:
              '[P2-S11-AC-093] publication preflight registry (D19) registers the structural accessibility checker as the only worker provider',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: (1) "with no network provider, DOM or Browser Rendering provider": no test scans the module imports or runs the checker with fetch, DOM and Browser Rendering bindings forbidden; purity is shown only through determinism, no input mutation and no state between calls. (2) "targeting `cms.entry_revision` by revision id and `revision_number`, with exactly one current version per target type, older versions readable": these are the BE05c quality-checker request and registry rules (BE05c lines 1000-1001, owned by Slice 16); the Slice 11 module has no `cms.entry_revision` target type, no checker-version registry and no test of one current version per target type or of older versions staying readable. Proven only: the checker input is keyed by revisionId and revisionNumber (input-schema tests) and the binding hash covers the revision id, and the preflight registry keeps one current row per category (AC-093).',
  },
  {
    criterion: 'P2-S11-AC-099',
    text: 'Accessibility checker (D25): version 1 evaluates in the order structure, heading, link, media, landmark and applies its rule table to the Phase 2 surface (`structure.rich_text_invalid`, `structure.block_unregistered`, `heading.empty`, `heading.first_level`, `heading.level_skipped`, `link.text_empty`, `link.text_generic`, `link.text_is_url`, `link.text_unchecked_language`, `landmark.name_missing`, `landmark.name_duplicate`) with the declared blocking or warning severity, normalizes link text by NFKC, lowercase, trim, whitespace collapse and trailing-punctuation removal against the `en` generic-phrase list, produces the `link.text_unchecked_language` warning rather than silence when a language has no list, and leaves the media rules inert because no media reference can exist before Slice 14.',
    clauses: [
      {
        text: 'Accessibility checker (D25): version 1 evaluates in the order structure, heading, link, media, landmark',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'cooperative stop between nodes returns an explicit stopped result in the structure group',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'cooperative stop between nodes returns an explicit stopped result in the heading group',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'cooperative stop between nodes returns an explicit stopped result in the link group',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'cooperative stop between nodes returns an explicit stopped result in the landmark group',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'cooperative stop between nodes completes when the stop is never requested',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: rule groups and ordering reports every group, blocking first, then render order, ruleId and pointer',
          },
        ],
      },
      {
        text: 'and applies its rule table to the Phase 2 surface (`structure.rich_text_invalid`, `structure.block_unregistered`, `heading.empty`, `heading.first_level`, `heading.level_skipped`, `link.text_empty`, `link.text_generic`, `link.text_is_url`, `link.text_unchecked_language`, `landmark.name_missing`, `landmark.name_duplicate`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog holds exactly the eleven Phase 2 rules',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-structure.test.ts',
            title:
              'structure.rich_text_invalid reports an unknown format once, at the field, and skips the field',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-structure.test.ts',
            title:
              'structure.block_unregistered reports a withdrawn block at its composition pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-heading.test.ts',
            title: 'heading.empty flags a heading made of a space',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-heading.test.ts',
            title: 'heading.first_level flags a first heading at level 3',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-heading.test.ts',
            title:
              'heading.level_skipped flags a heading more than one level deeper than the previous one',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_empty flags a link only when all of its spans are whitespace, once, at its first span',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_generic (en list, normalized) flags the listed phrase "click here"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_is_url (warning) flags https text equal to its href',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_unchecked_language (warning) warns once for de with a link',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-landmark.test.ts',
            title: 'landmark.name_missing flags a required name that is null',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-landmark.test.ts',
            title:
              'landmark.name_duplicate (warning) flags every instance of one block that shares a normalized name',
          },
        ],
      },
      {
        text: 'with the declared blocking or warning severity',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog structure.rich_text_invalid has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog structure.block_unregistered has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog heading.empty has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog heading.first_level has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog heading.level_skipped has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog link.text_empty has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog link.text_generic has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog link.text_is_url has the BE05c severity warning',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog link.text_unchecked_language has the BE05c severity warning',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog landmark.name_missing has the BE05c severity blocking',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog landmark.name_duplicate has the BE05c severity warning',
          },
        ],
      },
      {
        text: 'normalizes link text by NFKC, lowercase, trim, whitespace collapse and trailing-punctuation removal against the `en` generic-phrase list',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/text.test.ts',
            title:
              'normalizeLinkText (BE05c: NFKC, lowercase, trim, whitespace collapse, trailing punctuation) normalizes "ＣＬＩＣＫ ｈｅｒｅ" to "click here"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/text.test.ts',
            title:
              'normalizeLinkText (BE05c: NFKC, lowercase, trim, whitespace collapse, trailing punctuation) normalizes "  Click   HERE!! " to "click here"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/text.test.ts',
            title:
              'normalizeLinkText (BE05c: NFKC, lowercase, trim, whitespace collapse, trailing punctuation) normalizes "Read more…" to "read more"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/text.test.ts',
            title:
              'genericLinkPhrases (version 1) lists exactly the ten English phrases',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_generic (en list, normalized) flags the variant "ＣＬＩＣＫ" after normalization',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_generic (en list, normalized) flags the variant "Learn more »" after normalization',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_generic (en list, normalized) does not flag the descriptive text "Click here for the guide"',
          },
        ],
      },
      {
        text: 'produces the `link.text_unchecked_language` warning rather than silence when a language has no list',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_unchecked_language (warning) warns once for de with a link',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_unchecked_language (warning) warns once for ja with a link',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_unchecked_language (warning) does not evaluate the generic list for such a language',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/rules-link.test.ts',
            title:
              'link.text_unchecked_language (warning) is silent without any link',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: state across fields raises the language warning once across fields',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/text.test.ts',
            title: 'genericLinkPhrases (version 1) has no list for de',
          },
        ],
      },
      {
        text: 'and leaves the media rules inert because no media reference can exist before Slice 14.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog does not define the inert media rules',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: rule groups and ordering never produces a media rule',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/input-schema.test.ts',
            title:
              'AccessibilityCheckerInputSchema: media fails closed refuses a media node of any shape',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/input-schema.test.ts',
            title:
              'AccessibilityCheckerInputSchema: media fails closed refuses a field node that declares a media field kind',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-100',
    text: 'Accessibility checker (D25): findings are deterministic and privacy-safe: sorted blocking first, then render order, ruleId and pointer; at most `FINDINGS_STORED_MAX` (500) stored with true `blocking_count` and `warning_count` and `truncated` set; `inputHash` is the SHA-256 of the canonical JSON of the checker key and version, the revision content hash, the block record hashes, the accessibility row identifiers, versions and states and the render-plan hash, identical for identical inputs; and a finding carries only a catalog message, a JSON Pointer location and the constant `humanReview` `required`, never author text, link text, URLs or asset names.',
    clauses: [
      {
        text: 'Accessibility checker (D25): findings are deterministic and privacy-safe: sorted blocking first, then render order, ruleId and pointer',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: deterministic order sorts blocking first, then render order, then ruleId, then pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: deterministic order breaks an equal position and rule by pointer',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: deterministic order orders by span inside one block',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: deterministic order is independent of the insertion order',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: determinism yields byte-identical output for identical input',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: rule groups and ordering reports every group, blocking first, then render order, ruleId and pointer',
          },
        ],
      },
      {
        text: 'at most `FINDINGS_STORED_MAX` (500) stored with true `blocking_count` and `warning_count` and `truncated` set',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: FINDINGS_STORED_MAX stores exactly the maximum without truncating',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: FINDINGS_STORED_MAX stores the first 500 in sorted order and keeps true totals past compaction',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: FINDINGS_STORED_MAX keeps a blocking finding ahead of warnings when truncating',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'truncation at FINDINGS_STORED_MAX with true counts stores exactly 500 findings without truncating',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'truncation at FINDINGS_STORED_MAX with true counts keeps the first 500 in render order and the true blocking total',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'truncation at FINDINGS_STORED_MAX with true counts truncates warnings while the run stays healthy, with the true warning total',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog stores at most the BE05c FINDINGS_STORED_MAX findings',
          },
        ],
      },
      {
        text: '`inputHash` is the SHA-256 of the canonical JSON of the checker key and version, the revision content hash, the block record hashes, the accessibility row identifiers, versions and states and the render-plan hash, identical for identical inputs',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title:
              'accessibilityInputHash matches the pinned vector for two blocks, ignoring field nodes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title:
              'accessibilityInputHash matches the pinned vector for a revision without blocks',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title:
              'accessibilityInputHash is a lowercase SHA-256 hex digest and identical for identical inputs',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title:
              'accessibilityInputHash changes with the revision content hash',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title: 'accessibilityInputHash changes with the render plan hash',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title: 'accessibilityInputHash changes with a block record hash',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/hashes.test.ts',
            title:
              'accessibilityInputHash does not depend on members outside the BE05c definition',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker.test.ts',
            title:
              'runAccessibilityChecker: determinism yields byte-identical output for identical input',
          },
        ],
      },
      {
        text: 'and a finding carries only a catalog message, a JSON Pointer location and the constant `humanReview` `required`, never author text, link text, URLs or asset names.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/findings.test.ts',
            title:
              'finding collector: shape builds a finding from the catalog and the constant human review',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'privacy: a finding never carries author content keeps text, URLs, link text and names out of the serialized run',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/checker-limits.test.ts',
            title:
              'privacy: a finding never carries author content exposes only the contract members on a finding',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/catalog.test.ts',
            title:
              'accessibility rule catalog link.text_generic has a bounded static message and a valid ruleId',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
