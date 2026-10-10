import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 11 evidence ledger fragment P2-S11-AC-035..066. Rules: see
// tests/contracts/phase-02-slice-11-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-11-evidence-guard.test.ts.
export const S11_EVIDENCE_LEDGER_035_066: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S11-AC-035',
    text: 'CMS-08 Submit/review/approve: given Revision is in draft state on an entry the submitter may edit and its frozen hash and dependency manifest resolve; each decision requires a reviewer distinct from the author where the workflow says review, and a protected risk class additionally requires two distinct humans, the named specialist capability and recent MFA., implement locked behavior and completion exactly. Operations: CMS-03B-15 (workflow read), CMS-03B-16 (review detail), CMS-03B-17 (reviewer queue) and CMS-03B-18 (reviewer assignment), BE03b ledger 25.02.03.',
    clauses: [
      {
        text: 'CMS-08 Submit/review/approve: given Revision is in draft state on an entry the submitter may edit',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an entry assignee freezes the current draft revision for review [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'an editor assigned with cms.editor may submit; the submitter identity stays server-side [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a superseded revision and a revision under an open, approved or rejected review are 409 revision_not_submittable [P2-S11-AC-005]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-05] submit freezes the preparation into an open review (201, Location, strong ETag) exactly once',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-05] the author submits the current draft from the workflow page and the open review is canonical',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'its frozen hash and dependency manifest resolve',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the review is open at version 1 and freezes the revision hash, the dependency hash, the activation evidence and the strictest-of workflow policy evidence of the manifest [P2-S11-AC-005]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a frozen hash that is not the stored payload hash is VALIDATION_FAILED at /frozenHash [P2-S11-AC-005]',
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
        text: 'each decision requires a reviewer distinct from the author where the workflow says review',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'an absent, non-member, ungranted, publisher-only, submitter, revision-author, banned, shadow, lapsed, deactivated or ended-tenure reviewer is one byte-identical reviewer_not_eligible [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'control: the reviews are frozen from the real editorial policy (ordinary, two-decision override, protected with a specialist slot)',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] absent nonmember ungranted and submitter reviewers share one exact eligibility refusal without effects',
          },
        ],
      },
      {
        text: 'a protected risk class additionally requires two distinct humans',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'a protected policy freezes riskClass protected, two required decisions and the specialist slot from the manifest evidence [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the first of two approvals leaves the review open at version 2 with no decidedAt [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the second distinct approver reaches the required count: approved at version 3 with two distinct qualifying approvers [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'one human records at most one decision per review [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) requires a protected review to carry at least two decisions',
          },
        ],
      },
      {
        text: 'the named specialist capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a base-only reviewer approves first: the base slot, the review stays open (one approval still possible for the specialist slot) [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'a second base-only approve is refused specialist_slot_unsatisfiable (no approval left for the unfilled specialist slot) and changes nothing [P2-S11-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'the specialist approves: the first unfilled specialist slot they hold is satisfied and the review is approved [P2-S11-AC-109]',
          },
        ],
      },
      {
        text: 'and recent MFA',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title: 'control: a proof 590 s old is accepted [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-06] the assigned reviewer approves with a fresh step-up (200, review version + 1) and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-15] the workflow read of a draft serves its preparation and passes the strict resource schema',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-PROBE] the first-party chain submits, assigns and approves a review',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-06] a review decision interrupted by step-up returns to its draft, needs one confirmation and commits once',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Operations: CMS-03B-15 (workflow read)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry assignee reads the workflow of a draft entry [P2-S11-AC-049]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-15] the workflow read of a draft serves its preparation and passes the strict resource schema',
          },
        ],
      },
      {
        text: 'CMS-03B-16 (review detail)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title: 'the receipt-derived owner reads the review [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-16] the review detail read serves the approved review with its assignment',
          },
        ],
      },
      {
        text: 'CMS-03B-17 (reviewer queue)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the assigned scope lists exactly the reviews the caller holds an assignment on, newest update first (the tie pair ordered by review id) [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-17] the reviewer queue lists the review for its owner and passes the strict page schema',
          },
        ],
      },
      {
        text: 'and CMS-03B-18 (reviewer assignment)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign.sql',
            title:
              'the receipt-derived owner creates a reviewer assignment on an open review [P2-S11-AC-067]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-assignment-lifecycle.apispec.ts',
            title:
              'CMS-03B-18 assignment lifecycle [CMS-03B-18] create and ordinary revoke replay identical resources with exact audit event and unchanged review operand',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-18] the owner assigns the reviewer (201 + Location + ETag) and the answer passes the strict schema',
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
        text: 'BE03b ledger 25.02.03.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "BE03b ledger 25.02.03". It is a traceability reference to feature-ledger row 25.02.03, not a behavior; no test asserts the row assignment (grep finds the id only in specs and trackers). Either a repository traceability test that every Slice 11 operation is owned by its feature-ledger row, or an owner ruling that the pointer is not testable (DEC-155 already lists AC035 among the wording defects: the text also lags IA03 AC-CMS-08 on E6 and E11), settles it.',
  },
  {
    criterion: 'P2-S11-AC-036',
    text: 'CMS-08 Submit/review/approve: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-08 Submit/review/approve: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a visible entry with no assignment is 403 capability_missing [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a non-member, an absent entry, another acting party, a revision of another entry and an absent revision are one indistinguishable NOT_FOUND [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'the review submitter and the revision author are 403 separation_of_duties even with an effective assignment [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a submitter, a publisher and an assigned reviewer can read the review but are not the receipt-derived owner: 403 capability_missing for create and revoke [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-refusals.apispec.ts',
            title:
              'CMS-03B-05 refusals through the real stack [CMS-03B-05] a session without an author capability is 403 at the Worker; one claiming it without the database grant is capability_missing from the database',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a stale entry version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-008]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale review version is VERSION_MISMATCH with the expected and current versions [P2-S11-AC-014]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a second decision by the same human is 409 duplicate_decision [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              'a stale review version is VERSION_MISMATCH carrying the expected and current versions [P2-S11-AC-071]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B1: one decision row, the review open at version 2 with one recorded decision, one event',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/012-review-submit-race.mjs',
            title: 'C1: one open review, its dependency rows and one event',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B3: one decision row and one event (the duplicate replayed)',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a revoked assignment of a counted approver also leaves the review unable to be approved: reviewer_authority_changed [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'an approve on a review whose recorded approve lapsed commits reviewer_authority_changed (the review could never be approved) and answers the committed refusal review_not_open with empty details [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_authority.sql',
            title:
              'the open review is invalidated reviewer_authority_changed (version + 1, the recorded decision count kept) [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a lapsed or deactivated standing cms.reviewer grant is 403 capability_missing; an ended membership leaves no scope at all (404) [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              "a deactivated cms.author grant revokes the creator's assignments (DEC-143) and the submit is 403 capability_missing [P2-S11-AC-007]",
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B6: a revocation of the reviewer grant BLOCKS behind a decision parked after its authority locks (the decision holds the grant row FOR SHARE)',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_reviews_guard.sql',
            title:
              'review: a review is history and is never deleted [P2-S11-AC-120]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_decisions_schema.sql',
            title:
              'decision: decision evidence is never deleted [P2-S11-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_review_assignments_guard.sql',
            title:
              'assignment: an assignment is history and is never deleted [P2-S11-AC-119]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'an archived entry fails the revocation category (entry_unavailable) [P2-S11-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_preflight.sql',
            title:
              'a deletion_pending entry fails revocation entry_unavailable [P2-S11-AC-096]',
          },
        ],
      },
      {
        text: 'and cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'an open review is invalidated and the result names the review, the transition and the cascade counts [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'appending a newer revision of the same locale invalidates the older live review revision_superseded [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the entry leaving active invalidates its live review entry_unavailable [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'revoking the standing capability of the satisfied slot invalidates the approved review in the revoking transaction [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_invalidation.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} instead of raising (so the invalidation commits) [P2-S11-AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit.sql',
            title:
              'the same revision is resubmitted after an invalidation: a second review row, the first kept as history [P2-S11-AC-085]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-037',
    text: '`CMS-08` Submit/review/approve: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-08` Submit/review/approve: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) names the risk class and the decisions required on one confirm action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) offers a radio pair, a persistent reason label with a counter, and names the consequence',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'revoke an assignment lists each active assignment by its label and revokes the one named',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) lists each review as a native link with state, risk, counts and the caller decision as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
        ],
      },
      {
        text: 'focus stays until navigation',
        citations: [],
      },
      {
        text: 'named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) sends the served preparation unmodified at the entry version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) sends the strict body at the review version, then refetches the review and focuses the decisions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) sends the strict create body at the review version and refetches the review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland refetches the review after a decision and moves focus to the decisions heading',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) sends the strict body at the review version, then refetches the review and focuses the decisions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a caller capability or stepUpAt is an unknown key, and a missing reason or malformed review id is INVALID_REQUEST [P2-S11-AC-012]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_assign_refusals.sql',
            title:
              "an unknown key (a caller-supplied owner), a missing member, the other action's members, an unknown action, a malformed review id and a missing or short idempotency key are INVALID_REQUEST [P2-S11-AC-068]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a caller riskClass or owner, a missing member, a malformed id and an If-Match that disagrees with the entry version are INVALID_REQUEST [P2-S11-AC-006]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-session-rpc-context.test.ts',
            title:
              'cms editorial session resolution derives the RPC context from the server-side session cache',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) refuses a missing choice and an unsafe reason inline, sending nothing, with focus on the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) refuses a missing reviewer and an expiry outside the bounds before sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-reason.test.ts',
            title:
              'assignment reason is optional and bounded to 256 composed characters',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request sends nothing without a CSRF cookie, with a malformed body or with malformed headers',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-05 sends the strict JSON body with the CSRF token, key and strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-06 sends the strict JSON body with the CSRF token, key and strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-18 sends the strict JSON body with the CSRF token, key and strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) sends the served preparation unmodified at the entry version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) sends the strict body at the review version, then refetches the review and focuses the decisions',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) states the derived revision state in words through one polite line',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) names its regions with focusable headings and states the review in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) lists decisions as a semantic list and shows only the caller’s own reason',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland refetches the review after a decision and moves focus to the decisions heading',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) sends the served preparation unmodified at the entry version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) sends the strict body at the review version, then refetches the review and focuses the decisions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) announces the count politely',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '403 gates renders the capability gate and never a step-up route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '404 and 409 refetches on a stale version and rotates the key on an idempotency mismatch',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              'closed vocabulary has fixed copy for every token any operation can publish',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '422 refusals lists the failed and unavailable categories of a preflight refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes the 403 gate token and drops one it does not know',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes a 409 reason with its structured members or the version mismatch kind',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes the per-category preflight list and the field violations of a 422',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) refetches the review and states why for a closed or duplicate decision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) lists the failed categories of a preflight refusal',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) keeps the entered text and offers a reconciled retry after a lost answer',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) refetches and states why when the checks changed, keeping the form usable',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'definite refusals rotates the key, refetches the canonical state and keeps the input on a stale conflict',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) refuses a missing choice and an unsafe reason inline, sending nothing, with focus on the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame renders a refusal as an alert that takes focus, with a link to each named field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame puts field errors found before sending into one alert with a link to each control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes reconciles with a canonical read and then replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes does not accept a new submit or a retry before the reconciling read succeeded',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame gates the retry of an unknown outcome behind the reconciling read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) keeps the entered text and offers a reconciled retry after a lost answer',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) filters with a native GET form that carries the scope and the closed state options',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) continues with the signed cursor in the URL and nothing else protected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage returns the verified page with the URL-owned query for the view',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-workflow-page.test.ts',
            title:
              'loadWorkflowPage returns the verified workflow with the URL-owned revision for the island',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind stores only the editable text of a decision, never a hash, manifest or person',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
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
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewSubmitForm.test.tsx',
            title:
              'CmsEditorialReviewSubmitForm (CMS-03B-05) sends the served preparation unmodified at the entry version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) sends the strict body at the review version, then refetches the review and focuses the decisions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) sends the strict create body at the review version and refetches the review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/use-cms-workflow-hooks.test.tsx',
            title:
              'useCanonicalResource starts from the verified resource and replaces it only by a later verified read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-canonical-read.test.ts',
            title:
              'readCanonicalWorkflow reads the workflow no-store from the first-party path and returns the strict resource',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "focus stays until navigation". No Slice 11 test asserts the negative property that focus is left where it is until a navigation or a named result heading (only the positive moves are tested: the refusal alert and the named result heading take focus). Needs a jsdom test per form that records document.activeElement before and after a pending command and after a refetch and asserts it is unchanged, like the Slice 10 "never moves focus" editor tests.',
  },
  {
    criterion: 'P2-S11-AC-038',
    text: 'CMS-09 Schedule publish/expire: given Actor holds the CMS publisher capability with any required step-up, the target revision is approved with its frozen hash and dependency set intact, and the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version., implement locked behavior and completion exactly. Operations: CMS-03B-20 (internal schedule claim and execute RPC), BE03b ledger 25.02.04.',
    clauses: [
      {
        text: 'CMS-09 Schedule publish/expire: given Actor holds the CMS publisher capability with any required step-up',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the owner-party publisher schedules a publish of an approved revision [P2-S11-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-047]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
        ],
      },
      {
        text: 'the target revision is approved with its frozen hash and dependency set intact',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be scheduled: CONFLICT [P2-S11-AC-038]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} carrying only the CURRENT dependencyHash [P2-S11-AC-021]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a pending publish makes the revision scheduled (E2) while the review stays approved at its version (the schedule never advances it) [P2-S11-AC-038]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] stale approved-review CAS is exact VERSION_MISMATCH with no effects',
          },
        ],
      },
      {
        text: 'the request supplies a local datetime, IANA timezone, unambiguous resolved UTC instant and tzdb version',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every invalid field is VALIDATION_FAILED at its RFC 6901 pointer: action, a real local date and time without offset or leap second at most nine fraction digits, the zone grammar, an offset instant, the tzdb tag, disambiguation, the audience grammar, expectedVersion and If-Match [P2-S11-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a tzdbVersion other than the pinned one is 422 tzdb_version_mismatch carrying the pinned value [P2-S11-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a local time more than 14 h after or 12 h before the resolved UTC (no real zone offset) is 422 resolved_utc_mismatch [P2-S11-AC-105]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] a nonexistent local time is the Worker 422 with its two alternatives and reaches no RPC',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule-time.apispec.ts',
            title:
              'CMS-03B-07 pinned time authority through the real stack [CMS-03B-07] one nanosecond UTC mismatch is refused before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-schedule-time.test.ts',
            title:
              'E8 refusals, in order 6: a fall-back fold without a choice names earlier then later',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] accepts a future UTC schedule (202 scheduled, never published; Location; strong ETag) and a replay adds nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'unpublish, expire and archive are scheduled against an approved review too [P2-S11-AC-017]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'the schedule is completed at version 3 with actual_at_utc and deviation_seconds = round(actual - resolved), its lease released [P2-S11-AC-084]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-07] a schedule resolves the local time, blocks a nonexistent one, and commits as scheduled, not published',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Operations: CMS-03B-20 (internal schedule claim and execute RPC)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_claim.sql',
            title:
              'exactly the due pending schedule and the due failed_retryable schedule are claimed: not the future one, the waiting retry, the completed, blocked and leased ones, nor the schedules whose lease just expired [P2-S11-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title: 'a claimed, due publish schedule executes [P2-S11-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'a repeated execution of a completed schedule answers already_completed with the original lineage row, instant and deviation and adds no lineage row, event or audit record [P2-S11-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep.apispec.ts',
            title:
              'CMS-03B-20 sweep through the real RPCs [CMS-03B-20] the tick executes due schedules: real checker evidence completes one publication, a missing proof is failed_retryable (never a pass) and a lapsed publisher grant blocks',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries lets only the scheduled sweep import the claim/execute port',
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
        text: 'BE03b ledger 25.02.04.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "BE03b ledger 25.02.04". It is a traceability reference to feature-ledger row 25.02.04, not a behavior, and no test asserts the row assignment. Needs a repository traceability test that every Slice 11 operation is owned by its feature-ledger row, or an owner ruling that the pointer is not testable. DEC-155 also lists AC038 among the wording defects (the text ".," punctuation break and the step-up and author wording lag IA03 AC-CMS-09 on E6 and E11), still awaiting the owner wording batch.',
  },
  {
    criterion: 'P2-S11-AC-039',
    text: 'CMS-09 Schedule publish/expire: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-09 Schedule publish/expire: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a non-member, a member with no scope on the entry and an absent revision are the same byte-identical NOT_FOUND [P2-S11-AC-019]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'the human who authored the revision cannot schedule its publish (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-047]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] readable nonpublisher is exactly 403 and hidden and absent revisions are identical safe 404s',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'a second schedule of the same action, local time, timezone and audience under another key is a CONFLICT and changes nothing [P2-S11-AC-020]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-020]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] changed same-key schedule body is exact idempotency mismatch and preserves all effects',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S3: a revision append BLOCKS behind a schedule parked after taking the entry row FOR SHARE and its authority locks',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/015-schedule-accept-race.mjs',
            title:
              'S4: a schedule BLOCKS behind an append holding the entry row FOR UPDATE',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/013-schedule-claim-race.mjs',
            title:
              'C2: a claim does NOT wait on a schedule row locked by another session (SKIP LOCKED)',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a cms.publisher grant that ends before the resolved UTC day is 422 authority_ends_before_schedule [P2-S11-AC-107]',
          },
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
              'an executing schedule whose review was invalidated (a superseded revision, an unavailable entry) is blocked approval_invalidated, never cancelled by the executor (DEC-158(d)) [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "the review's pending and failed_retryable schedules are cancelled in the same transaction [P2-S11-AC-111]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a publisher whose grant ends before the schedule is 422 authority_ends_before_schedule',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: a schedule is history and is never deleted [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'entry_unavailable cancels the schedule as well [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_schedules_schema.sql',
            title:
              'schedule: an unavailable entry cancels and never blocks [P2-S11-AC-122]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute.sql',
            title:
              'an unpublish without an active head blocks the schedule with publication_not_active and appends nothing [P2-S11-AC-083]',
          },
        ],
      },
      {
        text: 'and cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a cancelled schedule records approval_invalidated and advances its version [P2-S11-AC-111]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a frozen manifest that is no longer current invalidates the review (dependency_changed) and blocks the schedule approval_invalidated [P2-S11-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_execute_refusals.sql',
            title:
              'a blocked outcome appends no lineage row and emits no publication event: the prior publication stays intact [P2-S11-AC-083]',
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
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-sweep-outcomes.apispec.ts',
            title:
              'CMS-03B-20 retryable and blocked outcomes [CMS-03B-20] unavailable load retries at 15 seconds while absent active head blocks with complete typed null fields',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-040',
    text: '`CMS-09` Schedule publish/expire: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-09` Schedule publish/expire: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowFields.test.tsx',
            title:
              'workflow form fields supports a datetime-local control and a datalist of suggestions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowFields.test.tsx',
            title:
              'workflow form fields renders a select and reports the chosen value',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowFields.test.tsx',
            title:
              'workflow form fields groups radios in a fieldset with a legend and reports the choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refuses incomplete input without sending and focuses the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
        ],
      },
      {
        text: 'focus stays until navigation',
        citations: [],
      },
      {
        text: 'named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'an unknown key (entryId, riskClass), a missing member, a malformed revision id, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-018]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-session-rpc-context.test.ts',
            title:
              'cms editorial session resolution derives the RPC context from the server-side session cache',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refuses incomplete input without sending and focuses the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refuses to send a nonexistent time or one outside the window',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs refuses an unknown zone and a time outside the window with the stated bounds',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-schedule-resolution.test.ts',
            title:
              'resolveScheduleInput refuses an unknown zone and a time outside the 60 second to 366 day window',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request sends nothing without a CSRF cookie, with a malformed body or with malformed headers',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-07 sends the strict JSON body with the CSRF token, key and strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) lists schedules as scheduled, not published, with a closed reason when blocked',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs shows the resolved instant and offset in a polite region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'resolution shown beside the inputs shows the resolved instant and offset in a polite region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) names the server time refusals at the field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refetches for a changed approved candidate and renders the separation gate for a second-person rule',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '422 refusals maps each time-authority token to its field and fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '422 refusals keeps the stated alternatives of a nonexistent or ambiguous local time',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '422 refusals states the accepted window of an out-of-horizon refusal from its members',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              'closed vocabulary has fixed copy for every token any operation can publish',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes the 403 gate token and drops one it does not know',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes a 409 reason with its structured members or the version mismatch kind',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes the per-category preflight list and the field violations of a 422',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'definite refusals rotates the key, refetches the canonical state and keeps the input on a stale conflict',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) refuses incomplete input without sending and focuses the summary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) names the server time refusals at the field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame renders a refusal as an alert that takes focus, with a link to each named field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame puts field errors found before sending into one alert with a link to each control',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes reconciles with a canonical read and then replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes does not accept a new submit or a retry before the reconciling read succeeded',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame gates the retry of an unknown outcome behind the reconciling read',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-workflow-page.test.ts',
            title:
              'loadWorkflowPage returns the verified workflow with the URL-owned revision for the island',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind stores no manifest or version set when a schedule and a publish are interrupted',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) sends the resolved request and states Scheduled, not published',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/use-cms-workflow-hooks.test.tsx',
            title:
              'useCanonicalResource starts from the verified resource and replaces it only by a later verified read',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "focus stays until navigation". No Slice 11 test asserts the negative property that focus is left where it is until a navigation or a named result heading (only the positive moves are tested: the refusal alert and the named result heading take focus). Needs a jsdom test per form that records document.activeElement before and after a pending command and after a refetch and asserts it is unchanged, like the Slice 10 "never moves focus" editor tests.',
  },
  {
    criterion: 'P2-S11-AC-041',
    text: 'CMS-13 Preview/diff/publish: given Preview requires a capability on the target entry and mints a token bound to user, acting context, revision, the full version set, audience/locale/route, expiry and nonce, rechecked on every open; publish additionally requires the CMS publisher capability, an approved revision whose frozen hash and dependency set still match, and a preflight rerun against current revocation sta, implement locked behavior and completion exactly. Operations: CMS-03B-19 (internal preview-token verifier RPC), BE03b ledger 25.03.04.',
    clauses: [
      {
        text: 'CMS-13 Preview/diff/publish: given Preview requires a capability on the target entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'an entry editor assignee, an active reviewer assignee of a review of the revision and an owner-party publisher each mint [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a member with no scope, an unassigned reviewer, a reviewer assigned to another revision, a revoked reviewer assignment, a revoked entry assignment and a lapsed standing grant are 403 capability_missing with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] an unscoped confirmed member is refused by the database, not by the Worker',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview-scopes.apispec.ts',
            title:
              'CMS-03B-08 scope and transport boundaries [CMS-03B-08] an unassigned reviewer sees a tenant-visible 403 and no token or reservation',
          },
        ],
      },
      {
        text: 'and mints a token bound to user, acting context, revision, the full version set, audience/locale/route, expiry and nonce',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the row holds the server-derived person, user and acting context, the capability snapshot (BE04c actingContextVersion), the exact binding, state active at version 1 and only the token SHA-256 [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token expires exactly 900 seconds after it was created and the resource reports that instant [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the token is the HMAC-SHA-256 of "cms.preview.token.v1" and the JCS { tokenId, nonce, entryId, revisionId } under the Vault key, recomputed by an independent oracle [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a version set that differs from the one recomputed from canonical state (schema hash, block ids, template, settings version) is 409 version_set_stale [P2-S11-AC-089]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
        ],
      },
      {
        text: 'rechecked on every open',
        citations: [
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
              'a token of an entry that left `active` is the canonical denial even before its row is revoked [P2-S11-AC-074]',
          },
        ],
      },
      {
        text: 'publish additionally requires the CMS publisher capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a session without cms.publisher is 403 at the Worker; a session claiming it without the database grant is capability_missing from the database',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the owner-party publisher publishes an approved revision [P2-S11-AC-029]',
          },
        ],
      },
      {
        text: 'an approved revision whose frozen hash and dependency set still match',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              "a frozenHash that is not the approved review's frozen hash is 422 at /frozenHash [P2-S11-AC-030]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an expectedVersionSet that is not exactly the version set frozen on the approved review (schema, settings or taxonomy member) is 409 version_set_stale [P2-S11-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a revision whose latest review is invalidated, rejected or open, or that was never reviewed, cannot be published: CONFLICT [P2-S11-AC-033]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale frozen manifest returns the committed-refusal envelope {kind, reasonCode, details} carrying only the CURRENT dependencyHash [P2-S11-AC-033]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a stale frozen manifest is the COMMITTED refusal: HTTP 200 on the wire, 409 dependency_changed with the current hash for the browser, the review stays invalidated and a replay answers the same 409',
          },
        ],
      },
      {
        text: 'and a preflight rerun against current revocation sta',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a failed category refuses 422 preflight_failed; the DETAIL lists all 17 {category, outcome, reasonCode} entries and nothing else [P2-S11-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a counted approver whose standing cms.reviewer grant lapsed fails the revocation category: 422 preflight_failed (reviewer_authority_changed) [P2-S11-AC-096]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] healthy Worker evidence is bound to the approved revision and real publish command',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish-preflight.apispec.ts',
            title:
              'CMS-03B-09 publication admission and preflight composition [CMS-03B-09] failed input load sends an own null proof and a strict preflight refusal without effects',
          },
        ],
      },
      {
        text: 'implement locked behavior and completion exactly',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-preview.apispec.ts',
            title:
              'CMS-03B-08 preview mint and the CMS-03B-19 verifier through the real stack [CMS-03B-08] mints a once-only token (201, no-store, no Location), replays it byte-identically and the verifier adapter accepts the bound binding',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'exactly one audit record commits with the lineage row [P2-S11-AC-034]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'exactly one identifier-only cms.publication.changed.v1 with the row id as publicationVersionId commits [P2-S11-AC-116]',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-09] publish now records a pending publication and never claims public visibility',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'Operations: CMS-03B-19 (internal preview-token verifier RPC)',
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
              'unknown, forwarded, other-actor-revoked and expired denials are the same bytes [P2-S11-AC-075]',
          },
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
            file: 'apps/worker/src/cms-editorial-production-preview-verifier.test.ts',
            title:
              'the request sends only the SHA-256 of the token and the exact binding to the service RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'principal boundaries lets no Worker module but the delivery adapter import the verifier',
          },
        ],
      },
      {
        text: 'BE03b ledger 25.03.04.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "BE03b ledger 25.03.04". It is a traceability reference to feature-ledger row 25.03.04, not a behavior, and no test asserts the row assignment. Needs a repository traceability test or an owner ruling. DEC-155 also lists AC041 among the wording defects: the text is truncated at "revocation sta" and lags IA03 AC-CMS-13 on E6 and E11, so the "preflight rerun against current revocation sta" clause is cited against the intended meaning (a publish-phase preflight rerun that fails on revoked authority or an unavailable entry), and the owner wording batch is still pending.',
  },
  {
    criterion: 'P2-S11-AC-042',
    text: 'CMS-13 Preview/diff/publish: preserve declared failure and recovery across invalid authority, concurrency, revocation, deletion, and cascade.',
    clauses: [
      {
        text: 'CMS-13 Preview/diff/publish: preserve declared failure and recovery across invalid authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a member with no scope, an unassigned reviewer, a reviewer assigned to another revision, a revoked reviewer assignment, a revoked entry assignment and a lapsed standing grant are 403 capability_missing with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, another acting party and an archived or held entry are the one concealed NOT_FOUND with no detail [P2-S11-AC-025]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a visible target without the owner-party cms.publisher grant is 403 capability_missing: the entry assignee, the assigned reviewer and the owner [P2-S11-AC-031]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'the human who authored the revision cannot publish it (E11) [P2-S11-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-048]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'a forwarded token presented by another person is the canonical denial, revoked false [P2-S11-AC-075]',
          },
        ],
      },
      {
        text: 'concurrency',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a stale entry If-Match is VERSION_MISMATCH carrying the expected and current versions only [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale approved-review version is 409 VERSION_MISMATCH carrying only the expected and current versions [P2-S11-AC-032]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint.sql',
            title:
              'the same key with a changed request is IDEMPOTENCY_MISMATCH [P2-S11-AC-026]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'the same key with a changed audience is IDEMPOTENCY_MISMATCH [P2-S11-AC-032]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title: 'M1: one token row and one audit record exist',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/014-publication-execute-race.mjs',
            title:
              'E6: a publish BLOCKS behind an append holding the entry row FOR UPDATE',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/016-lineage-append-race.mjs',
            title:
              'L2: versions 1..6 exactly (no duplicate, no gap), each answered once, one event per row',
          },
        ],
      },
      {
        text: 'revocation',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              "revoking the reviewer assignment ends that reviewer's preview scope [P2-S11-AC-074]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "ending the publisher's tenure revokes the publisher's token [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "revoking the creator's assignment revokes the creator's token on that entry [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_verify.sql',
            title:
              'the bound actor presenting a revoked token gets valid false and revoked true, every other member null [P2-S11-AC-075]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M3: the grant revocation waits on the share locks the parked mint holds',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M4: the mint waits on the authority rows the uncommitted revocation holds',
          },
        ],
      },
      {
        text: 'deletion',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_preview_tokens_schema.sql',
            title:
              'token: a token row is evidence and is never deleted [P2-S11-AC-117]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_publication_lineage_schema.sql',
            title: 'lineage: a prior row is never deleted [P2-S11-AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_lineage.sql',
            title:
              'an unpublish appends a revoked tombstone, lineage version 3 [P2-S11-AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "entry_unavailable revokes the entry's unexpired active tokens (all minters) [P2-S11-AC-118]",
          },
        ],
      },
      {
        text: 'and cascade',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'the entry leaving active invalidates its live review entry_unavailable [P2-S11-AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              "and revokes the entry's unexpired preview token [P2-S11-AC-118]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_invalidation.sql',
            title:
              'a dependency change revokes no preview token (a version-set movement does not revoke it) [P2-S11-AC-118]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'the invalidation committed (review invalidated at version 3, one review-changed event) and no publication row or event exists [P2-S11-AC-111]',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/020-preview-mint-race.mjs',
            title:
              'M5: the mint commits, then the archive revokes the token of the entry that left `active`',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-043',
    text: '`CMS-13` Preview/diff/publish: implement Native link/button/form; focus stays until navigation or named result heading; Server-derived actor/context/capability, valid Zod input, required ETag/idempotency; Render authoritative response/version/provenance/next action; announce status; Map exact `ApiError`; retain input; focus summary/field; reconcile unknown mutation before retry; URL for navigation/filter; scoped draft before commit; server after success.',
    clauses: [
      {
        text: '`CMS-13` Preview/diff/publish: implement Native link/button/form',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) states the locale it is bound to and asks only for an audience and a route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) opens an inline confirmation naming the replacement and the checks that will re-run',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) copies the token on request and says so, or says how to copy by hand',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
        ],
      },
      {
        text: 'focus stays until navigation',
        citations: [],
      },
      {
        text: 'named result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) discloses the token once with its binding and expiry as text and takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) echoes the approved candidate unmodified at the review version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
        ],
      },
      {
        text: 'Server-derived actor/context/capability',
        citations: [
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
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_preview_mint_refusals.sql',
            title:
              'a missing, unknown (evidence, owner, capability) or malformed member, a non-uuid id and a disagreeing If-Match/expectedVersion are INVALID_REQUEST [P2-S11-AC-024]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'an unknown key (action), a missing member, malformed ids, If-Match disagreeing with expectedVersion and a non-object proof are INVALID_REQUEST [P2-S11-AC-030]',
          },
        ],
      },
      {
        text: 'valid Zod input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) refuses an invalid audience or route inline, sending nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) refuses a missing or invalid audience inline, sending nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request sends nothing without a CSRF cookie, with a malformed body or with malformed headers',
          },
        ],
      },
      {
        text: 'required ETag/idempotency',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-08 sends the strict JSON body with the CSRF token, key and strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'workflow command request CMS-03B-09 sends the strict JSON body with the CSRF token, key and strong If-Match',
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
        text: 'Render authoritative response/version/provenance/next action',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) never presents a pending projection as public visibility',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) never claims public visibility for a pending projection',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) discloses the token once with its binding and expiry as text and takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
        ],
      },
      {
        text: 'announce status',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) discloses the token once with its binding and expiry as text and takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) never claims public visibility for a pending projection',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame names its form by a focusable heading and keeps one persistent polite status region',
          },
        ],
      },
      {
        text: 'Map exact `ApiError`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) refetches and states why for an expired replay or a changed candidate',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) refetches and names the changed candidate, a publication conflict or the second-person rule',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) lists the failed categories of a preflight refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '403 gates renders the capability gate and never a step-up route',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              'closed vocabulary has fixed copy for every token any operation can publish',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-refusal.test.ts',
            title:
              '422 refusals lists the failed and unavailable categories of a preflight refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes a 409 reason with its structured members or the version mismatch kind',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              'definite refusals exposes the per-category preflight list and the field violations of a 422',
          },
        ],
      },
      {
        text: 'retain input',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'definite refusals rotates the key, refetches the canonical state and keeps the input on a stale conflict',
          },
        ],
      },
      {
        text: 'focus summary/field',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) refuses an invalid audience or route inline, sending nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreviewForm.test.tsx',
            title:
              'CmsEditorialPreviewForm (CMS-03B-08) discloses the token once with its binding and expiry as text and takes focus',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame renders a refusal as an alert that takes focus, with a link to each named field',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame puts field errors found before sending into one alert with a link to each control',
          },
        ],
      },
      {
        text: 'reconcile unknown mutation before retry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes reconciles with a canonical read and then replays the identical request under the same key',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'unknown outcomes does not accept a new submit or a retry before the reconciling read succeeded',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame gates the retry of an unknown outcome behind the reconciling read',
          },
        ],
      },
      {
        text: 'URL for navigation/filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-workflow-page.test.ts',
            title:
              'loadWorkflowPage returns the verified workflow with the URL-owned revision for the island',
          },
        ],
      },
      {
        text: 'scoped draft before commit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind stores no manifest or version set when a schedule and a publish are interrupted',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what a step-up detour and a preview mint leave behind never lets a minted preview token reach a store, the URL, history, the title or a log',
          },
        ],
      },
      {
        text: 'server after success.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) echoes the approved candidate unmodified at the review version and then refetches',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland refetches the canonical workflow after a commit and moves focus to the new review region',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/use-cms-workflow-hooks.test.tsx',
            title:
              'useCanonicalResource starts from the verified resource and replaces it only by a later verified read',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "focus stays until navigation". No Slice 11 test asserts the negative property that focus is left where it is until a navigation or a named result heading (only the positive moves are tested: the refusal alert and the named result heading take focus). Needs a jsdom test per form that records document.activeElement before and after a pending command and after a refetch and asserts it is unchanged, like the Slice 10 "never moves focus" editor tests.',
  },
  {
    criterion: 'P2-S11-AC-044',
    text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor; retain failing-test evidence and run canonical validation.',
    clauses: [
      {
        text: 'Execute Contract → QA-RED → data, API, SSR and island implementation → QA-GREEN → refactor',
        citations: [],
      },
      {
        text: 'retain failing-test evidence',
        citations: [],
      },
      {
        text: 'run canonical validation.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'A process criterion that no test can attest before slice close: it is the order of work (contract, RED, implementation, GREEN, refactor), the retained RED evidence and a green canonical validation run (pnpm validate and the database, API and race gates). The Slice 11 tracker records full gates as pending and the Codex handoffs record RED and partial GREEN runs; the receipts the evidence guard needs for the whole-ledger run do not exist yet. Cite the canonical validation run and the retained RED receipts (docs/handoffs/2026-10-08-phase2-codex-handoff/s11/*.json) at slice close, or have the owner rule that the guard run itself is the proof.',
  },
  {
    criterion: 'P2-S11-AC-045',
    text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change; leave no unresolved implementation boundary or undocumented drift.',
    clauses: [
      {
        text: 'Update slice tracking, feature-ledger assignments, applicable runbooks, and architecture graph in the same change',
        citations: [],
      },
      {
        text: 'leave no unresolved implementation boundary or undocumented drift.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'A tracking criterion that can only be proven at slice close, in the same change as the final tracker update: slice tracking, the feature-ledger assignments of 25.02.03, 25.02.04 and 25.03.04, the cms-publication runbook and the architecture graph. Related checks exist but do not prove it: tests/contracts/phase-02-slice-11-runbook.test.ts asserts the runbook covers every operation, and scripts/check-progress-consistency.mjs checks tracker counts, not feature-ledger assignment or graph freshness. No test greps the tree for BOUNDARY stubs or for undocumented drift. Needs the slice-close change itself plus a traceability/boundary guard.',
  },
  {
    criterion: 'P2-S11-AC-046',
    text: 'CMS-03B-06 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a review decision refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods) reserves no idempotency record and changes no review state and is never rendered as a 403 gate or a sign-in redirect; the form navigates to `/step-up?returnTo=` with the current relative path and query, never replays the interrupted command automatically, restores its scoped draft on return and waits for explicit re-confirmation with the expected version refetched (a changed version opens SyncConflict), and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once; allowedMethods entries other than totp are ignored and an empty list renders `No verification method is available` as a degraded state with the request ID.',
    clauses: [
      {
        text: 'CMS-03B-06 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a review decision refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] future proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a stale, future, unverified or absent proof is STEP_UP_REQUIRED, ahead of concealment [P2-S11-AC-108]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-error-response.test.ts',
            title:
              'Slice 11 error response serializes the step-up recovery with the configured MFA methods',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '401 projection publishes STEP_UP_REQUIRED with the configured MFA methods when the row declares step-up',
          },
        ],
      },
      {
        text: 'reserves no idempotency record and changes no review state',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'every refusal above left no decision, review change, reservation, audit record or outbox event behind [P2-S11-AC-015]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] none proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] stale proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-decision-contracts.apispec.ts',
            title:
              'CMS-03B-06 exact decision contracts [CMS-03B-06] future proof returns exact STEP_UP_REQUIRED recovery before any RPC or reservation',
          },
        ],
      },
      {
        text: 'and is never rendered as a 403 gate or a sign-in redirect',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
        ],
      },
      {
        text: 'the form navigates to `/step-up?returnTo=` with the current relative path and query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
        ],
      },
      {
        text: 'never replays the interrupted command automatically',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
        ],
      },
      {
        text: 'restores its scoped draft on return',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) restores the draft after step-up, waits for confirmation and resubmits under the original key once',
          },
        ],
      },
      {
        text: 'and waits for explicit re-confirmation with the expected version refetched',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) restores the draft after step-up, waits for confirmation and resubmits under the original key once',
          },
        ],
      },
      {
        text: '(a changed version opens SyncConflict)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up opens a sync conflict when the expected version changed, and rotates the key on acknowledgement',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame opens the sync conflict after a step-up return with a changed version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) opens a sync conflict when the review version changed while verifying',
          },
        ],
      },
      {
        text: 'and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) restores the draft after step-up, waits for confirmation and resubmits under the original key once',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision.sql',
            title:
              'an exact replay returns the stored response and adds no decision, audit record, event or reservation [P2-S11-AC-014]',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-11-workflow-real-route.spec.ts',
            title:
              '[S11-RR-06] a review decision interrupted by step-up returns to its draft, needs one confirmation and commits once',
            project: 'real-route-chrome',
          },
          {
            tool: 'race',
            file: 'supabase/tests/phase_02_slice_11_races/011-review-decision-race.mjs',
            title:
              'B3: one decision row and one event (the duplicate replayed)',
          },
        ],
      },
      {
        text: 'allowedMethods entries other than totp are ignored',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) shows the degraded state when no verification method is available',
          },
        ],
      },
      {
        text: 'and an empty list renders `No verification method is available` as a degraded state with the request ID.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery shows a degraded state with the request id when no usable method exists or the details are malformed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame states the degraded step-up case with the request id and no way to continue',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialDecisionForm.test.tsx',
            title:
              'CmsEditorialDecisionForm (CMS-03B-06) shows the degraded state when no verification method is available',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-047',
    text: 'CMS-03B-07 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a publication schedule command refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods) reserves no idempotency record and changes no schedule state and is never rendered as a 403 gate or a sign-in redirect; the form navigates to `/step-up?returnTo=` with the current relative path and query, never replays the interrupted command automatically, restores its scoped draft on return and waits for explicit re-confirmation with the expected version refetched (a changed version opens SyncConflict), and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once; allowedMethods entries other than totp are ignored and an empty list renders `No verification method is available` as a degraded state with the request ID.',
    clauses: [
      {
        text: 'CMS-03B-07 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a publication schedule command refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-047]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-error-response.test.ts',
            title:
              'Slice 11 error response serializes the step-up recovery with the configured MFA methods',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '401 projection publishes STEP_UP_REQUIRED with the configured MFA methods when the row declares step-up',
          },
        ],
      },
      {
        text: 'reserves no idempotency record and changes no schedule state',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule_refusals.sql',
            title:
              'every raised refusal above left no schedule, review change, lineage row, reservation, event or audit record behind [P2-S11-AC-018]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'even a replay needs a fresh step-up proof (E6: evaluated before the reservation) [P2-S11-AC-047]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-schedule.apispec.ts',
            title:
              'CMS-03B-07 schedule through the real stack [CMS-03B-07] a missing, stale or future-dated step-up is 401 before any RPC and reserves nothing',
          },
        ],
      },
      {
        text: 'and is never rendered as a 403 gate or a sign-in redirect',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: 'the form navigates to `/step-up?returnTo=` with the current relative path and query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: 'never replays the interrupted command automatically',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: 'restores its scoped draft on return',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: 'and waits for explicit re-confirmation with the expected version refetched',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
        ],
      },
      {
        text: '(a changed version opens SyncConflict)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up opens a sync conflict when the expected version changed, and rotates the key on acknowledgement',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame opens the sync conflict after a step-up return with a changed version',
          },
        ],
      },
      {
        text: 'and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialScheduleForm.test.tsx',
            title:
              'schedule (CMS-03B-07) stores the scoped draft for step-up, restores it open and re-confirms under the original key',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_schedule.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no schedule, audit record, event or reservation [P2-S11-AC-020]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'commit commits exactly once even when the command is submitted twice at once',
          },
        ],
      },
      {
        text: 'allowedMethods entries other than totp are ignored',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
        ],
      },
      {
        text: 'and an empty list renders `No verification method is available` as a degraded state with the request ID.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery shows a degraded state with the request id when no usable method exists or the details are malformed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame states the degraded step-up case with the request id and no way to continue',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-048',
    text: 'CMS-03B-09 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a publication command where step-up is required refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods) reserves no idempotency record and changes no publication state and is never rendered as a 403 gate or a sign-in redirect; the form navigates to `/step-up?returnTo=` with the current relative path and query, never replays the interrupted command automatically, restores its scoped draft on return and waits for explicit re-confirmation with the expected version refetched (a changed version opens SyncConflict), and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once; allowedMethods entries other than totp are ignored and an empty list renders `No verification method is available` as a degraded state with the request ID.',
    clauses: [
      {
        text: 'CMS-03B-09 step-up recovery (DEC-111; received from Slice 09 AC1031 under DEC-122): a publication command where step-up is required refused 401 STEP_UP_REQUIRED (a valid session without a fresh aal2 proof, details recoveryAction step_up and allowedMethods)',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'a stale, future-dated (beyond the 30 s skew), unverified or absent proof is STEP_UP_REQUIRED, even for a caller who could not see the target [P2-S11-AC-048]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-error-response.test.ts',
            title:
              'Slice 11 error response serializes the step-up recovery with the configured MFA methods',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors.test.ts',
            title:
              '401 projection publishes STEP_UP_REQUIRED with the configured MFA methods when the row declares step-up',
          },
        ],
      },
      {
        text: 'reserves no idempotency record and changes no publication state',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish_refusals.sql',
            title:
              'every raised refusal above left no lineage row, review change, schedule, reservation, event or audit record behind [P2-S11-AC-030]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'even a replay needs a fresh step-up proof (E6: evaluated before the reservation) [P2-S11-AC-048]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] a missing, stale or future-dated step-up is 401 STEP_UP_REQUIRED before any RPC and any idempotency reservation',
          },
        ],
      },
      {
        text: 'and is never rendered as a 403 gate or a sign-in redirect',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
        ],
      },
      {
        text: 'the form navigates to `/step-up?returnTo=` with the current relative path and query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
        ],
      },
      {
        text: 'never replays the interrupted command automatically',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery stores the scoped draft with the key and the version, then navigates without replaying',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
        ],
      },
      {
        text: 'restores its scoped draft on return',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
        ],
      },
      {
        text: 'and waits for explicit re-confirmation with the expected version refetched',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
        ],
      },
      {
        text: '(a changed version opens SyncConflict)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up opens a sync conflict when the expected version changed, and rotates the key on acknowledgement',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame opens the sync conflict after a step-up return with a changed version',
          },
        ],
      },
      {
        text: 'and the re-confirmed resubmission carries the original Idempotency-Key and commits exactly once',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'restore after step-up restores the values, pins the original key and waits for explicit re-confirmation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPublishConfirmation.test.tsx',
            title:
              'CmsEditorialPublishConfirmation (CMS-03B-09) routes a step-up shortfall to verification and restores the audience open on return',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_publication_publish.sql',
            title:
              'an exact replay returns the stored resource, marks x-cms-idempotent-replay and adds no lineage row, audit record, event or reservation [P2-S11-AC-032]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'commit commits exactly once even when the command is submitted twice at once',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-publish.apispec.ts',
            title:
              'CMS-03B-09 publish through the real stack [CMS-03B-09] publishes an approved review (202, Location, strong ETag) exactly once and a replay adds nothing',
          },
        ],
      },
      {
        text: 'allowedMethods entries other than totp are ignored',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-transport.test.ts',
            title:
              '401 answers classifies a step-up shortfall and never as a gate or a sign-in',
          },
        ],
      },
      {
        text: 'and an empty list renders `No verification method is available` as a degraded state with the request ID.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-command-controller.test.ts',
            title:
              'step-up recovery shows a degraded state with the request id when no usable method exists or the details are malformed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame.test.tsx',
            title:
              'CmsWorkflowCommandFrame states the degraded step-up case with the request id and no way to continue',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-049',
    text: 'CMS-03B-15 registers the literal GET /api/v1/cms/entries/{entryId}/workflow with the strict `EntryWorkflowQuery` and returns the strict `EntryWorkflowResource`: entry `ResourceMeta`, the revision with its derived `state`, a nullable `preparation` (frozen hash, dependency manifest and hash, version set, risk class, workflow policy, preflight report), a nullable latest review with its `frozen` candidate, at most 16 schedules, at most 64 publications and at most 6 `permittedNextActions`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03B-15 registers the literal GET /api/v1/cms/entries/{entryId}/workflow',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-049] the 18-operation editorial route registry appends the nine Slice 11 browser operations after the nine Slice 10 operations',
          },
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
              '[P2-S11-AC-005][P2-S11-AC-049] Slice 11 platform registry rows mirror the editorial route policy registers the nine browser operations contiguously after CMS-03B-14',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/slice-11-workflow-routes.test.ts',
            title:
              'Slice 11 first-party endpoints match the generated registry CMS-03B-15 has one endpoint at its registry path exporting only its method',
          },
        ],
      },
      {
        text: 'with the strict `EntryWorkflowQuery`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-050] CMS-03B-15 request contracts takes a UUID entryId path and an optional UUID revisionId, with no other key',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row binds the workflow query, 200, a strong composite ETag and no event',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-15',
          },
        ],
      },
      {
        text: 'returns the strict `EntryWorkflowResource`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape rejects unknown keys and every missing member, including ownership identifiers',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the document is exactly EntryWorkflowResource (7 members) [P2-S11-AC-049]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-15',
          },
        ],
      },
      {
        text: 'entry `ResourceMeta`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the entry meta carries the aggregate version (the If-Match operand) and the revision its derived state, true content hash, locale, schema version and current-draft flag [P2-S11-AC-049]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape keeps entry.version as the If-Match operand of CMS-03B-05 and CMS-03B-08',
          },
        ],
      },
      {
        text: 'the revision with its derived `state`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the entry meta carries the aggregate version (the If-Match operand) and the revision its derived state, true content hash, locale, schema version and current-draft flag [P2-S11-AC-049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a pending publish schedule makes the revision `scheduled` (E2): the schedule is listed, schedule is no longer offered but publish still is [P2-S11-AC-054]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape derives the revision state from the closed EntryRevisionState vocabulary',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'a nullable `preparation` (frozen hash, dependency manifest and hash, version set, risk class, workflow policy, preflight report)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]',
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
              'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) binds the preparation to the served revision, manifest and policy',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
        ],
      },
      {
        text: 'a nullable latest review with its `frozen` candidate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a reviewer assignee reads the entry: the revision is derived `submitted`, the latest review is served with its frozen candidate, and they may record a decision and preview [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape accepts a revision under review with its frozen candidate and no preparation',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) applies the review invariants to the embedded latest review and binds it to the served revision',
          },
        ],
      },
      {
        text: 'at most 16 schedules',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) bounds schedules at 16, publications at 64 and next actions at 6 unique closed members',
          },
        ],
      },
      {
        text: 'at most 64 publications',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) bounds schedules at 16, publications at 64 and next actions at 6 unique closed members',
          },
        ],
      },
      {
        text: 'at most 6 `permittedNextActions`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) bounds schedules at 16, publications at 64 and next actions at 6 unique closed members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a draft with no review, schedule or publication offers the assignee submit_review and preview [P2-S11-AC-049]',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation publishes path, header and query parameters per route',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation answers each route with its success status, validators and error statuses',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-11-editorial-registry-openapi.test.ts',
            title:
              '[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation has a response definition for every registered operation (no drift)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-050',
    text: "CMS-03B-15 accepts only a UUID `entryId` path and an optional UUID `revisionId` query member (default: the entry's current draft revision), rejects any other query key as 400 and a body as 415, accepts neither `Idempotency-Key` nor `If-Match`, answers a `revisionId` of another entry with the same 404 as an absent one, and refuses a response as a 422 response-contract failure when `preparation` is non-null for a revision that is not a submittable `draft`, when it exceeds 17 preflight results, 16 schedules or 64 publications, or when the `dependencyManifest` or `versionSet` breaks the locked Slice 10 contracts.",
    clauses: [
      {
        text: "CMS-03B-15 accepts only a UUID `entryId` path and an optional UUID `revisionId` query member (default: the entry's current draft revision)",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-050] CMS-03B-15 request contracts takes a UUID entryId path and an optional UUID revisionId, with no other key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a path identifier that is not a UUID as 400 CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read refuses a revision query that is not a UUID',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'no revisionId serves the current draft; an older revision is served with isCurrentDraft false and no preparation [P2-S11-AC-050]',
          },
        ],
      },
      {
        text: 'rejects any other query key as 400',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title: 'BE00 order refuses a repeated query key as 400 CMS-03B-15',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an unknown member, a missing or malformed id and a non-object proof are INVALID_REQUEST [P2-S11-AC-050]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-15 workflow read treats an empty revisionId as absent and refuses duplicate or unknown keys',
          },
        ],
      },
      {
        text: 'and a body as 415',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses request media with an empty allowlist CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-15 read proxy refuses a mutation header, a media type or a body on a safe read',
          },
        ],
      },
      {
        text: 'accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an Idempotency-Key, an If-Match or a body CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row is a safe read: no key, no If-Match, no step-up, scope resolved by the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-15 read proxy refuses a mutation header, a media type or a body on a safe read',
          },
        ],
      },
      {
        text: 'answers a `revisionId` of another entry with the same 404 as an absent one',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] a foreign revision and absent revision are concealed equally with no effects',
          },
        ],
      },
      {
        text: 'and refuses a response as a 422 response-contract failure',
        citations: [],
      },
      {
        text: 'when `preparation` is non-null for a revision that is not a submittable `draft`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) serves a preparation only for a submittable current draft',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the owner of the entry (an assignee) sees assign_reviewer and preview, and no preparation for a revision under review [P2-S11-AC-054]',
          },
        ],
      },
      {
        text: 'when it exceeds 17 preflight results, 16 schedules or 64 publications',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) carries exactly seventeen preflight results and tolerates an unavailable provider inside the report',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) bounds schedules at 16, publications at 64 and next actions at 6 unique closed members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]',
          },
        ],
      },
      {
        text: 'or when the `dependencyManifest` or `versionSet` breaks the locked Slice 10 contracts.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) holds the locked Slice 10 manifest and version-set contracts',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "refuses a response as a 422 response-contract failure". The contracts refuse every listed breach (cited: a preparation on a non-draft, more than 17 results, 16 schedules or 64 publications, a manifest or version set that breaks the Slice 10 contracts), but no code or test produces a 422 for a response-contract breach: the Worker answers a resource that fails the strict schema as 502 BAD_GATEWAY (apps/worker/src/cms-editorial/workflow-read.ts maps a null parse to BAD_GATEWAY; workflow-read-routes.test.ts port boundary "is 502 when the success payload breaks the resource contract"), and the SQL read raises no 422. Needs a wording ruling (same class as Slice 10 AC-089): amend the criterion to 502 BAD_GATEWAY or map response-contract failures to 422 with a typed test.',
  },
  {
    criterion: 'P2-S11-AC-051',
    text: 'CMS-03B-15 derives session and acting context server-side and serves only an entry assignee (`cms.author` or `cms.editor`), an owner-party `cms.publisher` or an active reviewer assignee of a review of the revision, on a readable active-or-held entry: a hidden or absent entry or revision is 404, a visible entry without workflow read scope is 403, `preparation` is returned only to a caller who may submit a `draft` revision, the projection grants no authority, and no authority, ownership or person identifier is serialized.',
    clauses: [
      {
        text: 'CMS-03B-15 derives session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-session-rpc-context.test.ts',
            title:
              'cms editorial session resolution derives the RPC context from the server-side session cache',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an unauthenticated caller 401 CMS-03B-15',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'and serves only an entry assignee (`cms.author` or `cms.editor`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry assignee reads the workflow of a draft entry [P2-S11-AC-049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry editor assignee gets the preparation too [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'an owner-party `cms.publisher`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an approved revision offers its owner-party publisher schedule, preview and publish [P2-S11-AC-054]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'or an active reviewer assignee of a review of the revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a reviewer assignee reads the entry: the revision is derived `submitted`, the latest review is served with its frozen candidate, and they may record a decision and preview [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'on a readable active-or-held entry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a held entry is readable, offers no action and reports the revocation category as entry_unavailable [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
        ],
      },
      {
        text: 'a hidden or absent entry or revision is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] a foreign revision and absent revision are concealed equally with no effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-15',
          },
        ],
      },
      {
        text: 'a visible entry without workflow read scope is 403',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-15',
          },
        ],
      },
      {
        text: '`preparation` is returned only to a caller who may submit a `draft` revision',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry editor assignee gets the preparation too [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'the projection grants no authority',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_submit_refusals.sql',
            title:
              'a visible entry with no assignment is 403 capability_missing [P2-S11-AC-007]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_decision_refusals.sql',
            title:
              'a readable review without an EFFECTIVE assignment (window over, not started, submitter, publisher, owner) is 403 capability_missing [P2-S11-AC-013]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape rejects unknown keys and every missing member, including ownership identifiers',
          },
        ],
      },
      {
        text: 'and no authority, ownership or person identifier is serialized.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the document carries no author, assignee, owner, party or account identifier [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-049] EntryWorkflowResource shape rejects unknown keys and every missing member, including ownership identifiers',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what the server-rendered views print prints no person, party or ownership identifier in the queue, detail or workflow text',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-052',
    text: 'CMS-03B-15 is a no-store, mutation-free safe read with a strong composite ETag binding the entry, revision, latest review, schedule and publication versions, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 2 p95 < 1,200 ms target (which includes the 2,000 ms accessibility checker budget), and it recomputes the preparation on every read without storing it.',
    clauses: [
      {
        text: 'CMS-03B-15 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title: 'success envelope CMS-03B-15',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the read writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules, publications and entry versions are unchanged by every read above [P2-S11-AC-053]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-noeffects.apispec.ts',
            title:
              'CMS-03B-15 read writes nothing [CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
        ],
      },
      {
        text: 'with a strong composite ETag binding the entry, revision, latest review',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read binds the entry, revision, review and caller into a strong validator',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read names the latest review in the validator',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row binds the workflow query, 200, a strong composite ETag and no event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-15] the workflow read of a draft serves its preparation and passes the strict resource schema',
          },
        ],
      },
      {
        text: 'schedule and publication versions',
        citations: [],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order enforces the user and party read buckets CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row limits 300/600 per minute, 8 s and the Tier 2 p95 target',
          },
        ],
      },
      {
        text: 'an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row limits 300/600 per minute, 8 s and the Tier 2 p95 target',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'registry declares every Slice 11 read as a database-scoped safe read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-15',
          },
        ],
      },
      {
        text: 'and the Tier 2 p95 < 1,200 ms target',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row limits 300/600 per minute, 8 s and the Tier 2 p95 target',
          },
        ],
      },
      {
        text: '(which includes the 2,000 ms accessibility checker budget)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/a11y-structural/gate-timeout.test.ts',
            title:
              'timer deadline abandons a load that ignores its signal at 2,000 ms by default',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read answers a gate that outlives the route deadline as a gateway timeout',
          },
        ],
      },
      {
        text: 'and it recomputes the preparation on every read without storing it.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-noeffects.apispec.ts',
            title:
              'CMS-03B-15 read writes nothing [CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the read writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules, publications and entry versions are unchanged by every read above [P2-S11-AC-053]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'absent, stale, other-provider and mis-bound evidence degrade the accessibility result to unavailable / checker_failed inside the report and never fail the read [P2-S11-AC-053]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "schedule and publication versions" in the composite ETag. The Worker validator (workflow-read-routes.ts accept) is entry id and version, revision id, review id and version plus a SHA-256 of the caller-scoped serialized body, so a schedule or publication change moves it by construction, but no test changes a schedule or publication and observes the ETag move (workflow-read-operations.test.ts builds its resources with `schedules: []`). The p95 < 1,200 ms and 8,000 ms values are cited as declared registry targets and the injected-deadline mechanism; no performance run measures them.',
  },
  {
    criterion: 'P2-S11-AC-053',
    text: 'CMS-03B-15 maps malformed path or query (400), missing or expired session (401), workflow read scope (403), concealment (404), a body sent (415), a response-bound failure (422), the read limit (429), read dependency or deadline (502/503/504) and an internal failure (500, empty details) to typed ApiError; it reports an unavailable preflight provider inside `preparation.preflight` as an `unavailable` result and never as a failure of the read; and it writes no audit or outbox effect, so concealment stays 404 on refetch.',
    clauses: [
      {
        text: 'CMS-03B-15 maps malformed path or query (400)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a path identifier that is not a UUID as 400 CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read refuses a revision query that is not a UUID',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an unknown member, a missing or malformed id and a non-object proof are INVALID_REQUEST [P2-S11-AC-050]',
          },
        ],
      },
      {
        text: 'missing or expired session (401)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an unauthenticated caller 401 CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a malformed session result as 401 CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-workflow-page.test.ts',
            title:
              'loadWorkflowPage returns an expired session to this exact workflow position',
          },
        ],
      },
      {
        text: 'workflow read scope (403)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-15',
          },
        ],
      },
      {
        text: 'concealment (404)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-15',
          },
        ],
      },
      {
        text: 'a body sent (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses request media with an empty allowlist CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses allows request media only on a body-carrying command',
          },
        ],
      },
      {
        text: 'a response-bound failure (422)',
        citations: [],
      },
      {
        text: 'the read limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order passes a quota outage through without a numeric limit CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title: 'transport statuses keeps the bounded rate details of a 429',
          },
        ],
      },
      {
        text: 'read dependency or deadline (502/503/504)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-15',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
        ],
      },
      {
        text: 'and an internal failure (500, empty details)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'published envelope always validates as an ApiError and never carries dependency text',
          },
        ],
      },
      {
        text: 'to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'published envelope always validates as an ApiError and never carries dependency text',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-error-response.test.ts',
            title:
              'Slice 11 error response publishes and sanitizes through the Slice 11 boundary for a Slice 11 row only',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row is a safe read: no key, no If-Match, no step-up, scope resolved by the RPC',
          },
        ],
      },
      {
        text: 'it reports an unavailable preflight provider inside `preparation.preflight` as an `unavailable` result and never as a failure of the read',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'absent, stale, other-provider and mis-bound evidence degrade the accessibility result to unavailable / checker_failed inside the report and never fail the read [P2-S11-AC-053]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) carries exactly seventeen preflight results and tolerates an unavailable provider inside the report',
          },
        ],
      },
      {
        text: 'and it writes no audit or outbox effect, so concealment stays 404 on refetch.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the read writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules, publications and entry versions are unchanged by every read above [P2-S11-AC-053]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-noeffects.apispec.ts',
            title:
              'CMS-03B-15 read writes nothing [CMS-03B-15] a first eligible draft workflow read on a fresh isolated assignee org writes no effect',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] a foreign revision and absent revision are concealed equally with no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "a response-bound failure (422)". A resource that breaks the strict EntryWorkflowResource contract is answered 502 BAD_GATEWAY by the Worker (workflow-read.ts BAD_GATEWAY; workflow-read-routes.test.ts port boundary "is 502 when the success payload breaks the resource contract"); no code or test produces a 422 for it, although the registry row declares VALIDATION_FAILED 422 for the read envelope. Needs the same wording ruling as AC-050. Also note: the 500/502/504 envelope tests run through the publish row and every declared status of every Slice 11 row, not a dedicated CMS-03B-15 internal-failure case.',
  },
  {
    criterion: 'P2-S11-AC-054',
    text: 'CMS-03B-15 is consumed by the protected `CmsEditorialWorkflowPanel` and `CmsEditorialPreflightSummary`, which render the derived revision state, the schedules and publications with `projectionState`, and all 17 preflight results in registry order as semantic text (`passed`, `failed`, `unavailable`, fixed reason copy, no override for `provider_unbuilt_reference`), treat an `unavailable` result as a degraded check rather than an error, enable an action control only from `permittedNextActions`, keep focus on refetch, and give later forms the served frozen hash, manifest and version set unmodified; verification covers the three read scopes, the 404/403 split, preparation only for a submittable draft, served manifest and version set equal to the rebuilt values, the 17-entry report with an unavailable provider inside it, the 16-schedule and 64-publication bounds and the composite ETag.',
    clauses: [
      {
        text: 'CMS-03B-15 is consumed by the protected `CmsEditorialWorkflowPanel` and `CmsEditorialPreflightSummary`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/entries/[entryId]/workflow-route.test.tsx',
            title:
              'CMS-03B-15 protected workflow page, composed serves the panel and the submit and preview forms of a submittable draft',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland renders the panel and, for a submittable draft, the submit and preview forms only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) names one region per concern with a focusable heading each',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) lists all 17 categories in registry order as one semantic list',
          },
        ],
      },
      {
        text: 'which render the derived revision state',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) states the derived revision state in words through one polite line',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.test.ts',
            title:
              'closed vocabulary copy covers the revision, review, schedule, publication and projection states',
          },
        ],
      },
      {
        text: 'the schedules and publications with `projectionState`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) lists schedules as scheduled, not published, with a closed reason when blocked',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) never presents a pending projection as public visibility',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.test.ts',
            title:
              'closed vocabulary copy never presents a pending projection or a scheduled item as public visibility',
          },
        ],
      },
      {
        text: 'and all 17 preflight results in registry order as semantic text (`passed`, `failed`, `unavailable`, fixed reason copy, no override for `provider_unbuilt_reference`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) lists all 17 categories in registry order as one semantic list',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) says outcome and reason in words and announces the counts politely',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) names an unbuilt provider as a not-yet-available area and offers no override',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) never prints an unregistered token, a provider key or a count',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) renders all 17 checks for a submittable draft and none otherwise',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.test.ts',
            title:
              'closed vocabulary copy labels all seventeen preflight categories in registry order',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.test.ts',
            title:
              'closed vocabulary copy states the unbuilt-provider rule without an override',
          },
        ],
      },
      {
        text: 'treat an `unavailable` result as a degraded check rather than an error',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowPanel.test.tsx',
            title:
              'CmsEditorialWorkflowPanel (FE03 Slice 11) treats an unavailable check as a degraded check, not an error',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialPreflightSummary.test.tsx',
            title:
              'CmsEditorialPreflightSummary (FE03 Slice 11 checks) says outcome and reason in words and announces the counts politely',
          },
        ],
      },
      {
        text: 'enable an action control only from `permittedNextActions`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland withholds a form whose action is not permitted and says why',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland renders the panel and, for a submittable draft, the submit and preview forms only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland renders schedule, preview and publish for an approved revision from the frozen candidate',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-labels.test.ts',
            title:
              'closed vocabulary copy explains why a form is withheld when its action is not permitted',
          },
        ],
      },
      {
        text: 'keep focus on refetch',
        citations: [],
      },
      {
        text: 'and give later forms the served frozen hash, manifest and version set unmodified',
        citations: [
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
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialWorkflowIsland.test.tsx',
            title:
              'CmsEditorialWorkflowIsland uses the approved review frozen candidate for the schedule and publish forms',
          },
        ],
      },
      {
        text: 'verification covers the three read scopes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry assignee reads the workflow of a draft entry [P2-S11-AC-049]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a reviewer assignee reads the entry: the revision is derived `submitted`, the latest review is served with its frozen candidate, and they may record a decision and preview [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
        ],
      },
      {
        text: 'the 404/403 split',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a non-member, an absent entry, a revision of another entry, an absent revision, an archived entry and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'a confirmed member with no workflow read scope (an unassigned reviewer, a member with no capability) is 403 capability_missing [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
        ],
      },
      {
        text: 'preparation only for a submittable draft',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an owner-party publisher reads the draft but gets no preparation (only an assignee may submit) and may preview [P2-S11-AC-051]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'an entry editor assignee gets the preparation too [P2-S11-AC-051]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) serves a preparation only for a submittable current draft',
          },
        ],
      },
      {
        text: 'served manifest and version set equal to the rebuilt values',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'the preparation serves the manifest, its hash, the version set, the risk class and the workflow policy exactly as the server rebuilds them, so a form can echo them unmodified [P2-S11-AC-089]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
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
        text: 'the 17-entry report with an unavailable provider inside it',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'absent, stale, other-provider and mis-bound evidence degrade the accessibility result to unavailable / checker_failed inside the report and never fail the read [P2-S11-AC-053]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] eligible preparation has seventeen ordered checks and checker outage remains an unavailable result inside HTTP200',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) carries exactly seventeen preflight results and tolerates an unavailable provider inside the report',
          },
        ],
      },
      {
        text: 'the 16-schedule and 64-publication bounds',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_workflow.sql',
            title:
              'at most 16 schedules (newest first, a blocked one with its reason code) and 64 publications are served; a published revision is derived `published` [P2-S11-AC-050]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-read.test.ts',
            title:
              '[P2-S11-AC-050] EntryWorkflowResource response-contract bounds (422 on breach) bounds schedules at 16, publications at 64 and next actions at 6 unique closed members',
          },
        ],
      },
      {
        text: 'and the composite ETag.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-15 workflow read binds the entry, revision, review and caller into a strong validator',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] assignee publisher and reviewer scopes read the same frozen candidate and submission moves the composite ETag',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row binds the workflow query, 200, a strong composite ETag and no event',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-review-chain.apispec.ts',
            title:
              'CMS-03B-15 -> 05 -> 18 -> 06 -> 16 -> 17 through the real stack [CMS-03B-15] the workflow read of a draft serves its preparation and passes the strict resource schema',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "keep focus on refetch". The workflow island documents that focus lands on a result heading only after a command and never on a refetch (CmsEditorialWorkflowIsland.tsx focusHeading), and the post-command focus is tested (CmsEditorialWorkflowIsland.test.tsx "refetches the canonical workflow after a commit and moves focus to the new review region"), but no test records document.activeElement across a plain refetch (or a degraded refetch) and asserts it is unchanged. Needs a jsdom test on CmsEditorialWorkflowIsland: focus a control, resolve a refetch that returns a new verified resource, and assert document.activeElement is still that control.',
  },
  {
    criterion: 'P2-S11-AC-055',
    text: 'CMS-03B-16 registers GET /api/v1/cms/reviews/{reviewId} and returns the strict `EditorialReviewDetailResource`: the review base fields, `revisionNumber`, `locale`, `contentTypeLabel`, the `frozen` candidate, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment` and at most 5 `permittedNextActions`.',
    clauses: [
      {
        text: 'CMS-03B-16 registers GET /api/v1/cms/reviews/{reviewId}',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-049] the 18-operation editorial route registry appends the nine Slice 11 browser operations after the nine Slice 10 operations',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row binds the detail path, 200 and the review-version ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/slice-11-workflow-routes.test.ts',
            title:
              'Slice 11 first-party endpoints match the generated registry CMS-03B-16 has one endpoint at its registry path exporting only its method',
          },
        ],
      },
      {
        text: 'and returns the strict `EditorialReviewDetailResource`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource rejects unknown keys, ownership identifiers and every missing member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the document is exactly EditorialReviewDetailResource (the 17 base members plus the nine detail members) [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-16',
          },
        ],
      },
      {
        text: 'the review base fields',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the base members equal the EditorialReviewResource of the review; revision number, locale and the content type label come from canonical rows [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
        ],
      },
      {
        text: '`revisionNumber`, `locale`, `contentTypeLabel`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the base members equal the EditorialReviewResource of the review; revision number, locale and the content type label come from canonical rows [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource bounds the revision number, locale and content type label',
          },
        ],
      },
      {
        text: 'the `frozen` candidate',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the frozen candidate restates the review hashes and serves the version set projected from the FROZEN manifest [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
        ],
      },
      {
        text: '`distinctApprovalCount` 0-8',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource bounds distinctApprovalCount 0-8 and never lets it exceed the approve decisions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "distinctApprovalCount is the LIVE recount: after the approver's standing grant lapsed it is 0 while the recorded decision and the stored state are unchanged [P2-S11-AC-055]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
        ],
      },
      {
        text: 'at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource lists one decision row per recorded decision, at most eight, with unique ids',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource allows at most one decision of the caller and a reason only on that decision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a decision exposes id, decision, capability, decidedAt and mine, and its reason to its decider [P2-S11-AC-057]',
          },
        ],
      },
      {
        text: 'at most 32 `assignments`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource bounds owner-only assignments at 32 and exposes no person, actor or party identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'assignment summaries are capped at 32, every active one first then the newest revoked, with one display label per reviewer (16) and never an identifier [P2-S11-AC-056]',
          },
        ],
      },
      {
        text: 'a nullable `myAssignment`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource carries the caller assignment and at most five unique closed next actions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a reviewer assignee reads the review: no assignment summaries, only their own assignment id and end, and may record a decision [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
        ],
      },
      {
        text: 'and at most 5 `permittedNextActions`.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource carries the caller assignment and at most five unique closed next actions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the owner of an open review may assign and revoke and has no assignment of their own [P2-S11-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an approved review offers its owner-party publisher schedule and publish (the publisher is not the revision author) and the owner nothing [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-056',
    text: 'CMS-03B-16 accepts only a UUID `reviewId` path with no query key (400 otherwise) and refuses a response as a 422 response-contract failure when it breaks the review invariants (`invalidatedReason` exactly when `invalidated`, `decidedAt` exactly when `approved` or `rejected`, `recordedDecisionCount` at most `requiredDecisionCount`, a `protected` review requiring at least 2 decisions, count and risk class equal to the frozen workflow policy), carries more than 8 decisions or 32 assignments, or exposes a decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`.',
    clauses: [
      {
        text: 'CMS-03B-16 accepts only a UUID `reviewId` path',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-056] CMS-03B-16 request contracts addresses the review by a UUID path and accepts no query key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a path identifier that is not a UUID as 400 CMS-03B-16',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a query member, a missing or malformed review id is INVALID_REQUEST [P2-S11-AC-056]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-detail-page.test.ts',
            title:
              'loadReviewDetailPage refuses a malformed review id as 400 without an upstream call',
          },
        ],
      },
      {
        text: 'with no query key (400 otherwise)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title: 'CMS-03B-16 review detail accepts no query key at all',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-16',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a query member, a missing or malformed review id is INVALID_REQUEST [P2-S11-AC-056]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-16 review detail read accepts no query member and binds the answer to the review id',
          },
        ],
      },
      {
        text: 'and refuses a response as a 422 response-contract failure',
        citations: [],
      },
      {
        text: 'when it breaks the review invariants (`invalidatedReason` exactly when `invalidated`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) ties invalidatedReason to the invalidated state in both directions',
          },
        ],
      },
      {
        text: '`decidedAt` exactly when `approved` or `rejected`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) ties decidedAt to the approved and rejected states in both directions',
          },
        ],
      },
      {
        text: '`recordedDecisionCount` at most `requiredDecisionCount`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) bounds the required (1-8) and recorded (0-8) counts and keeps recorded within required',
          },
        ],
      },
      {
        text: 'a `protected` review requiring at least 2 decisions',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) requires a protected review to carry at least two decisions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
        ],
      },
      {
        text: 'count and risk class equal to the frozen workflow policy)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/workflow-resources.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-011] EditorialReviewResource (CMS-03B-05, CMS-03B-06) binds the review count and risk class to the frozen workflow policy',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource inherits the review invariants (invalidated reason, decidedAt, counts, policy binding)',
          },
        ],
      },
      {
        text: 'carries more than 8 decisions or 32 assignments',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource lists one decision row per recorded decision, at most eight, with unique ids',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource bounds owner-only assignments at 32 and exposes no person, actor or party identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'assignment summaries are capped at 32, every active one first then the newest revoked, with one display label per reviewer (16) and never an identifier [P2-S11-AC-056]',
          },
        ],
      },
      {
        text: 'or exposes a decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource allows at most one decision of the caller and a reason only on that decision',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a decision exposes id, decision, capability, decidedAt and mine, and its reason to its decider [P2-S11-AC-057]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "refuses a response as a 422 response-contract failure". The contracts refuse every listed breach (cited), but no code or test produces a 422 for a response-contract breach: the Worker answers a resource that fails the strict EditorialReviewDetailResource schema as 502 BAD_GATEWAY (workflow-read.ts BAD_GATEWAY; workflow-read-operations.test.ts "CMS-03B-16 review detail refuses a detail of another review" and workflow-read-routes.test.ts port boundary "is 502 when the success payload breaks the resource contract"), and the SQL read raises no 422. Same wording ruling as AC-050 (amend to 502 or map to 422 with a typed test).',
  },
  {
    criterion: 'P2-S11-AC-057',
    text: "CMS-03B-16 serves only the submitter, a non-revoked reviewer assignee, an entry assignee, an owner-party `cms.publisher` or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403), returns `reason` only on the caller's own decision, returns `assignments` only to the receipt-derived owner (every other reader receives `[]`), and serializes no person, actor or party identifier.",
    clauses: [
      {
        text: 'CMS-03B-16 serves only the submitter, a non-revoked reviewer assignee, an entry assignee, an owner-party `cms.publisher` or the receipt-derived owner',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title:
              'a reviewer with a non-revoked assignment (an expired window still reads) holds reviewer [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title: 'a revoked assignment grants no read scope [P2-S11-AC-069]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title: 'the receipt-derived owner reads the review [P2-S11-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the submitter reads the review with no assignments and no actions [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an entry assignee (cms.editor assignment) reads the review; holding cms.reviewer without an assignment grants no decision [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an owner-party publisher reads an open review and has no action on it [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a confirmed member with no read scope, and a reviewer whose assignment was revoked, are 403 capability_missing [P2-S11-AC-057]',
          },
        ],
      },
      {
        text: '(a hidden, absent or cross-owner review is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a non-member, an absent review and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_review_scopes.sql',
            title:
              'a caller acting in another party holds no scope (cross-owner concealment) [P2-S11-AC-069]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-detail-page.test.ts',
            title:
              'loadReviewDetailPage treats a concealed review exactly like an absent one',
          },
        ],
      },
      {
        text: 'a visible review without read scope is 403)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a confirmed member with no read scope, and a reviewer whose assignment was revoked, are 403 capability_missing [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-16',
          },
        ],
      },
      {
        text: "returns `reason` only on the caller's own decision",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a decision exposes id, decision, capability, decidedAt and mine, and its reason to its decider [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "another reviewer and the owner see the decision with mine false and reason null: a private comment and the decider's identity never leave [P2-S11-AC-057]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource allows at most one decision of the caller and a reason only on that decision',
          },
        ],
      },
      {
        text: 'returns `assignments` only to the receipt-derived owner (every other reader receives `[]`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the owner receives the assignment summaries (id, version, state, window, display label) including the revoked one [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a reviewer assignee reads the review: no assignment summaries, only their own assignment id and end, and may record a decision [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource defaults assignments to the empty list for every reader but the owner',
          },
        ],
      },
      {
        text: 'and serializes no person, actor or party identifier.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the document carries no reviewer, submitter, grantor, owner, party or account identifier [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-055] EditorialReviewDetailResource bounds owner-only assignments at 32 and exposes no person, actor or party identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/cms-workflow-privacy.test.tsx',
            title:
              'what the server-rendered views print prints no person, party or ownership identifier in the queue, detail or workflow text',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-058',
    text: 'CMS-03B-16 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{review.version}"`, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03B-16 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title: 'success envelope CMS-03B-16',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'reading twice answers the same document and writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules and publications are unchanged by every read above [P2-S11-AC-059]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
        ],
      },
      {
        text: 'that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an Idempotency-Key, an If-Match or a body CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row is a safe Tier 1 read resolved by the RPC scope',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-16 read proxy refuses a mutation header, a media type or a body on a safe read',
          },
        ],
      },
      {
        text: 'carries the strong ETag `"{review.version}"`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-16 review detail publishes the review version as the strong validator',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row binds the detail path, 200 and the review-version ETag',
          },
        ],
      },
      {
        text: 'and enforces read buckets of 300/min/user and 600/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order enforces the user and party read buckets CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row is a safe Tier 1 read resolved by the RPC scope',
          },
        ],
      },
      {
        text: 'an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row is a safe Tier 1 read resolved by the RPC scope',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'registry declares every Slice 11 read as a database-scoped safe read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-16',
          },
        ],
      },
      {
        text: 'and the Tier 1 p95 < 750 ms target.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row is a safe Tier 1 read resolved by the RPC scope',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-059',
    text: 'CMS-03B-16 maps a malformed path or query, a missing or expired session, a missing review read scope, concealment, an unsupported body, a response-bound failure, the read limit, a read dependency or deadline and an internal failure to typed ApiError, writes no audit or outbox effect, and keeps a concealed review a 404 on every refetch.',
    clauses: [
      {
        text: 'CMS-03B-16 maps a malformed path or query',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a path identifier that is not a UUID as 400 CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title: 'CMS-03B-16 review detail accepts no query key at all',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a query member, a missing or malformed review id is INVALID_REQUEST [P2-S11-AC-056]',
          },
        ],
      },
      {
        text: 'a missing or expired session',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an unauthenticated caller 401 CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a malformed session result as 401 CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-detail-page.test.ts',
            title:
              'loadReviewDetailPage returns an expired session to this review',
          },
        ],
      },
      {
        text: 'a missing review read scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a confirmed member with no read scope, and a reviewer whose assignment was revoked, are 403 capability_missing [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-16',
          },
        ],
      },
      {
        text: 'concealment',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a non-member, an absent review and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary conceals a hidden target as an empty 404 and keeps a visible 403 typed CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow.apispec.ts',
            title:
              'CMS-03B-15 workflow read through the real stack [CMS-03B-15] [CMS-03B-16] concealment: a stranger is 404 and an unscoped member claiming a capability is capability_missing; neither leaks an identifier',
          },
        ],
      },
      {
        text: 'an unsupported body',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses request media with an empty allowlist CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-16 read proxy refuses a mutation header, a media type or a body on a safe read',
          },
        ],
      },
      {
        text: 'a response-bound failure',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 502 when the success payload breaks the resource contract CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-16 review detail refuses a detail of another review',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-detail-page.test.ts',
            title:
              'loadReviewDetailPage refuses a 200 that is not the strict review or names another review',
          },
        ],
      },
      {
        text: 'the read limit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order passes a quota outage through without a numeric limit CMS-03B-16',
          },
        ],
      },
      {
        text: 'a read dependency or deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-16',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-16',
          },
        ],
      },
      {
        text: 'and an internal failure',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'transport statuses publishes the canonical 502, 504 and 500 envelopes',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'published envelope always validates as an ApiError and never carries dependency text',
          },
        ],
      },
      {
        text: 'to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'published envelope always validates as an ApiError and never carries dependency text',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-error-response.test.ts',
            title:
              'Slice 11 error response publishes and sanitizes through the Slice 11 boundary for a Slice 11 row only',
          },
        ],
      },
      {
        text: 'writes no audit or outbox effect',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'reading twice answers the same document and writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules and publications are unchanged by every read above [P2-S11-AC-059]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
        ],
      },
      {
        text: 'and keeps a concealed review a 404 on every refetch.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a non-member, an absent review and another acting party are one indistinguishable NOT_FOUND [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'reading twice answers the same document and writes nothing: reviews, assignments, decisions, reservations, audit, events, tokens, schedules and publications are unchanged by every read above [P2-S11-AC-059]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-workflow-scopes.apispec.ts',
            title:
              'CMS-03B-15 scoped preparation [CMS-03B-15] a foreign revision and absent revision are concealed equally with no effects',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-060',
    text: "CMS-03B-16 is consumed by `CmsEditorialReviewDetail`, which renders state, risk class, the frozen candidate summary, required, recorded and qualifying counts, decision rows as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`, takes actions only from `permittedNextActions`, and moves focus to the heading on navigation only; verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the live `distinctApprovalCount` recount and `permittedNextActions` per caller.",
    clauses: [
      {
        text: 'CMS-03B-16 is consumed by `CmsEditorialReviewDetail`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-detail-route.test.tsx',
            title:
              'CMS-03B-16 protected review page, composed serves the evidence and the decision form to an assignee',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland renders the review and the decision form only for an assignee who may decide',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) names its regions with focusable headings and states the review in words',
          },
        ],
      },
      {
        text: 'which renders state, risk class',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) names its regions with focusable headings and states the review in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) explains an invalidated or decided review in words',
          },
        ],
      },
      {
        text: 'the frozen candidate summary',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) shows the frozen candidate as hash text and version identities, not a manifest',
          },
        ],
      },
      {
        text: 'required, recorded and qualifying counts',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) names its regions with focusable headings and states the review in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) lists decisions as a semantic list and shows only the caller’s own reason',
          },
        ],
      },
      {
        text: "decision rows as a semantic list without the decider's label",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) lists decisions as a semantic list and shows only the caller’s own reason',
          },
        ],
      },
      {
        text: "the caller's own reason",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) lists decisions as a semantic list and shows only the caller’s own reason',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland refetches the review after a decision and moves focus to the decisions heading',
          },
        ],
      },
      {
        text: '`myAssignment`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) shows the caller’s own assignment end and nothing about other assignments for a non-owner',
          },
        ],
      },
      {
        text: 'and, for the owner only, assignment summaries by `reviewerLabel`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetail.test.tsx',
            title:
              'CmsEditorialReviewDetail (CMS-03B-16) lists the owner assignments by label only, under a focusable heading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-detail-route.test.tsx',
            title:
              'CMS-03B-16 protected review page, composed serves the assignment controls to the owner and no person identifier',
          },
        ],
      },
      {
        text: 'takes actions only from `permittedNextActions`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland renders the review and the decision form only for an assignee who may decide',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewDetailIsland.test.tsx',
            title:
              'CmsEditorialReviewDetailIsland renders the owner assignment controls only with the assign permission',
          },
        ],
      },
      {
        text: 'and moves focus to the heading on navigation only',
        citations: [],
      },
      {
        text: 'verification covers each reader scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title: 'the receipt-derived owner reads the review [P2-S11-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a reviewer assignee reads the review: no assignment summaries, only their own assignment id and end, and may record a decision [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the submitter reads the review with no assignments and no actions [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an owner-party publisher reads an open review and has no action on it [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an entry assignee (cms.editor assignment) reads the review; holding cms.reviewer without an assignment grants no decision [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
        ],
      },
      {
        text: 'reason visibility to its decider only',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "another reviewer and the owner see the decision with mine false and reason null: a private comment and the decider's identity never leave [P2-S11-AC-057]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
        ],
      },
      {
        text: 'owner-only assignments without an identifier',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the owner receives the assignment summaries (id, version, state, window, display label) including the revoked one [P2-S11-AC-057]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'the document carries no reviewer, submitter, grantor, owner, party or account identifier [P2-S11-AC-057]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
        ],
      },
      {
        text: 'the live `distinctApprovalCount` recount',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              "distinctApprovalCount is the LIVE recount: after the approver's standing grant lapsed it is 0 while the recorded decision and the stored state are unchanged [P2-S11-AC-055]",
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] the deciding reviewer sees its own reason and live recount while the owner sees assignments and a redacted reason, with no person identifiers',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_helpers_approvers.sql',
            title:
              'a lapsed standing grant (valid_through passed) unwinds the approve [P2-S11-AC-110]',
          },
        ],
      },
      {
        text: 'and `permittedNextActions` per caller.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'a protected review shows one of two decisions; the reviewer who decided has no further action, the other assigned reviewer may decide [P2-S11-AC-055]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_review.sql',
            title:
              'an approved review offers its owner-party publisher schedule and publish (the publisher is not the revision author) and the owner nothing [P2-S11-AC-055]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-detail.apispec.ts',
            title:
              'CMS-03B-16 review detail through the real stack [CMS-03B-16] publisher detail redacts another decision reason and assignments while binding request identity without effects',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "moves focus to the heading on navigation only". The detail island moves focus to the decisions heading only after a command (CmsEditorialReviewDetailIsland.test.tsx "refetches the review after a decision and moves focus to the decisions heading"; use-cms-workflow-canonical never focuses on a refetch), but the navigation half rests on the shared shell script lib/route-heading-focus.ts (included by CmsEditorialDocument.astro) whose installRouteHeadingFocus has no test in the repository (route-heading-focus.test.ts covers only the one-shot post-commit mark), and no test asserts that the review detail route focuses its heading on client navigation. Needs a jsdom test of installRouteHeadingFocus on astro:page-load plus a source assertion that the review route uses the shell.',
  },
  {
    criterion: 'P2-S11-AC-061',
    text: 'CMS-03B-17 registers GET /api/v1/cms/reviews with the strict `ReviewQueueQuery` and returns the strict `ReviewQueuePage` (at most 50 `ReviewQueueItem` rows, `nextCursor` of at most 512 characters or null, `pageVersion`) ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
    clauses: [
      {
        text: 'CMS-03B-17 registers GET /api/v1/cms/reviews',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-005][P2-S11-AC-049] the 18-operation editorial route registry appends the nine Slice 11 browser operations after the nine Slice 10 operations',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-principals.test.ts',
            title:
              'browser route inventory mounts exactly the registry operations and no internal route',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row binds the queue query and page, 200 and an authenticated page ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/api/v1/cms/slice-11-workflow-routes.test.ts',
            title:
              'Slice 11 first-party endpoints match the generated registry CMS-03B-17 has one endpoint at its registry path exporting only its method',
          },
        ],
      },
      {
        text: 'with the strict `ReviewQueueQuery`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-062] CMS-03B-17 request contracts defaults scope to assigned and limit to 25 and takes only the allowlisted keys',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-17',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'an unknown scope or state is VALIDATION_FAILED at its pointer and any other query member (also an ownership claim) is INVALID_REQUEST [P2-S11-AC-062]',
          },
        ],
      },
      {
        text: 'and returns the strict `ReviewQueuePage`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem rejects unknown keys, a missing cursor member and an oversized cursor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the page is exactly ReviewQueuePage: items, nextCursor, pageVersion [P2-S11-AC-061]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a page with too many rows',
          },
        ],
      },
      {
        text: '(at most 50 `ReviewQueueItem` rows',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem bounds the page at 50 items in strict (updatedAt DESC, reviewId DESC) order',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'an item is exactly ReviewQueueItem (14 members) [P2-S11-AC-061]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a page with too many rows',
          },
        ],
      },
      {
        text: '`nextCursor` of at most 512 characters or null',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem rejects unknown keys, a missing cursor member and an oversized cursor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the cursor is at most 512 characters and a signed six-member envelope (query binding, last position, expiry, key id, signature) [P2-S11-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'pageVersion is the page high-water mark in UTC microseconds and a page that fits has no cursor [P2-S11-AC-064]',
          },
        ],
      },
      {
        text: '`pageVersion`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'pageVersion is the page high-water mark in UTC microseconds and a page that fits has no cursor [P2-S11-AC-064]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem accepts a bounded page and a continuation cursor',
          },
        ],
      },
      {
        text: 'ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              "consecutive items strictly descend by (updatedAt at millisecond precision, reviewId): the contract's keyset check holds even for two rows of one millisecond [P2-S11-AC-061]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the tie pair (the larger id has the earlier microsecond) is ordered by id, not by microsecond [P2-S11-AC-061]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'three pages of two walk the whole scope exactly once and the last page has no cursor [P2-S11-AC-061]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061] ReviewQueuePage and ReviewQueueItem bounds the page at 50 items in strict (updatedAt DESC, reviewId DESC) order',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-062',
    text: 'CMS-03B-17 accepts only `scope` `assigned` (default) or `submitted`, an optional `state` from the closed `EditorialReviewState`, `limit` 1-50 (default 25) and an optional `cursor` of at most 512 characters, rejects every other query key, a body and any mutation header, and refuses an unknown scope or state, a limit outside 1-50 or a structurally malformed cursor with the 400 or 422 the validation matrix declares.',
    clauses: [
      {
        text: 'CMS-03B-17 accepts only `scope` `assigned` (default) or `submitted`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-062] CMS-03B-17 request contracts defaults scope to assigned and limit to 25 and takes only the allowlisted keys',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue applies the defaults: scope assigned and 25 rows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'explicit nulls for cursor, limit, scope and state are the defaults [P2-S11-AC-062]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'an optional `state` from the closed `EditorialReviewState`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue forwards the closed filters, the cursor and the numeric limit',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the state filter narrows the scope: open, approved and invalidated select the right rows and a state with none is the empty page [P2-S11-AC-062]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: '`limit` 1-50 (default 25)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue applies the defaults: scope assigned and 25 rows',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?limit=0 as 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?limit=51 as 400',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a limit outside 1..50, a string or a fraction is VALIDATION_FAILED at /limit [P2-S11-AC-062]',
          },
        ],
      },
      {
        text: 'and an optional `cursor` of at most 512 characters',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue forwards the closed filters, the cursor and the numeric limit',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?cursor= as 400',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a non-base64, non-string, empty or over-long cursor, an envelope with an unknown member and a correctly signed payload with a malformed position are INVALID_REQUEST (400) [P2-S11-AC-065]',
          },
        ],
      },
      {
        text: 'rejects every other query key',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an unknown query key as 400 with a stable pointer CMS-03B-17',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'an unknown scope or state is VALIDATION_FAILED at its pointer and any other query member (also an ownership claim) is INVALID_REQUEST [P2-S11-AC-062]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 reviewer queue read drops an empty state, and refuses duplicate, unknown or out-of-range members',
          },
        ],
      },
      {
        text: 'a body and any mutation header',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses request media with an empty allowlist CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses an Idempotency-Key, an If-Match or a body CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 read proxy refuses a mutation header, a media type or a body on a safe read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title: 'CMS-03B-17 reviewer queue is not a command route',
          },
        ],
      },
      {
        text: 'and refuses an unknown scope or state',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses an out-of-vocabulary filter ?scope=all as 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses an out-of-vocabulary filter ?state=pending as 400',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] malformed limit scope and state fail before RPC with exact pointer details and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'an unknown scope or state is VALIDATION_FAILED at its pointer and any other query member (also an ownership claim) is INVALID_REQUEST [P2-S11-AC-062]',
          },
        ],
      },
      {
        text: 'a limit outside 1-50',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?limit=0 as 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?limit=51 as 400',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] malformed limit scope and state fail before RPC with exact pointer details and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a limit outside 1..50, a string or a fraction is VALIDATION_FAILED at /limit [P2-S11-AC-062]',
          },
        ],
      },
      {
        text: 'or a structurally malformed cursor with the 400 or 422 the validation matrix declares.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?cursor= as 400',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a non-base64, non-string, empty or over-long cursor, an envelope with an unknown member and a correctly signed payload with a malformed position are INVALID_REQUEST (400) [P2-S11-AC-065]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-063',
    text: 'CMS-03B-17 requires a verified human and lists, for `scope=assigned`, only reviews on which the caller holds a non-revoked assignment and, for `scope=submitted`, only reviews the caller submitted, so a review outside those scopes is never listed.',
    clauses: [
      {
        text: 'CMS-03B-17 requires a verified human',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an unauthenticated caller 401 CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order refuses a malformed session result as 401 CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial-production-session-seams.test.ts',
            title:
              'cms editorial session resolution rejects an expired session with a 401 recovery action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage returns an expired session to this exact list position',
          },
        ],
      },
      {
        text: 'and lists, for `scope=assigned`, only reviews on which the caller holds a non-revoked assignment',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the assigned scope lists exactly the reviews the caller holds an assignment on, newest update first (the tie pair ordered by review id) [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'and, for `scope=submitted`, only reviews the caller submitted',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the submitted scope lists only reviews the caller submitted; the assigned scope of another reviewer lists only theirs: no review outside the scope is ever listed [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'so a review outside those scopes is never listed.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the submitted scope lists only reviews the caller submitted; the assigned scope of another reviewer lists only theirs: no review outside the scope is ever listed [P2-S11-AC-063]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'another acting party lists nothing of this organisation [P2-S11-AC-063]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a non-member, a member with no assignment and a member who submitted nothing get the empty page (pageVersion 1), never an error [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-064',
    text: 'CMS-03B-17 is a no-store, mutation-free safe read whose signed cursor is bound to the complete query and acting scope, with default limit 25 and maximum 50, an authenticated page ETag, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03B-17 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title: 'success envelope CMS-03B-17',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'listing never writes: reservations, audit records, events, tokens, schedules and publications are untouched [P2-S11-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the queue leaves no idempotency record and no audit record [P2-S11-AC-064]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'whose signed cursor is bound to the complete query and acting scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a cursor of another caller, scope, state or page size, a tampered signature or payload, a correctly signed forgery with a foreign binding, an expired and an over-lived cursor are all CONFLICT (restart from the first page) [P2-S11-AC-065]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] a signed cursor rejects changed scope state limit and caller with exact 409 details and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the cursor is at most 512 characters and a signed six-member envelope (query binding, last position, expiry, key id, signature) [P2-S11-AC-064]',
          },
        ],
      },
      {
        text: 'with default limit 25 and maximum 50',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue applies the defaults: scope assigned and 25 rows',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/review-read.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-062] CMS-03B-17 request contracts defaults scope to assigned and limit to 25 and takes only the allowlisted keys',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?limit=51 as 400',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a limit outside 1..50, a string or a fraction is VALIDATION_FAILED at /limit [P2-S11-AC-062]',
          },
        ],
      },
      {
        text: 'an authenticated page ETag',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue publishes the page version as the validator and counts the rows',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row binds the queue query and page, 200 and an authenticated page ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'pageVersion is the page high-water mark in UTC microseconds and a page that fits has no cursor [P2-S11-AC-064]',
          },
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order enforces the user and party read buckets CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row lists only the caller scopes: no 403 or 404, and a cursor 409',
          },
        ],
      },
      {
        text: 'an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row lists only the caller scopes: no 403 or 404, and a cursor 409',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'registry declares every Slice 11 read as a database-scoped safe read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-17',
          },
        ],
      },
      {
        text: 'and the Tier 1 p95 < 750 ms target.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-editorial/routes-slice11.test.ts',
            title:
              '[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row lists only the caller scopes: no 403 or 404, and a cursor 409',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-065',
    text: 'CMS-03B-17 answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 `CONFLICT`, after which the client restarts from the first page, and maps session, rate, read-dependency and internal failures to typed ApiError with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03B-17 answers a structurally malformed cursor with 400',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a non-base64, non-string, empty or over-long cursor, an envelope with an unknown member and a correctly signed payload with a malformed position are INVALID_REQUEST (400) [P2-S11-AC-065]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue refuses a structurally malformed pager ?cursor= as 400',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 reviewer queue read drops an empty state, and refuses duplicate, unknown or out-of-range members',
          },
        ],
      },
      {
        text: 'and an expired, tampered or foreign-bound cursor with 409 `CONFLICT`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] a signed cursor rejects changed scope state limit and caller with exact 409 details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] an authentically signed expired cursor refuses with exact 409 details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] an authentically signed foreign-domain cursor refuses with exact 409 details and no effects',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a cursor of another caller, scope, state or page size, a tampered signature or payload, a correctly signed forgery with a foreign binding, an expired and an over-lived cursor are all CONFLICT (restart from the first page) [P2-S11-AC-065]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue answers the dependency cursor conflict as a refreshable conflict',
          },
        ],
      },
      {
        text: 'after which the client restarts from the first page',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage answers a refused cursor by dropping only the cursor and marking the restart',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage announces the restart and never forwards the marker to the read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 reviewer queue read relays the cursor conflict so the page restarts from the first page',
          },
        ],
      },
      {
        text: 'and maps session, rate, read-dependency and internal failures to typed ApiError',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an unauthenticated caller 401 CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'BE00 order answers an exhausted bucket 429 with the headers CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 503 when the port is not composed CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-routes.test.ts',
            title:
              'port boundary is 504 when the port outlives the route deadline CMS-03B-17',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-read-operations.test.ts',
            title:
              'CMS-03B-17 reviewer queue declares no 403 or 404: a hidden-population probe is a scrubbed 500',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-editorial/workflow-errors-typed.test.ts',
            title:
              'published envelope always validates as an ApiError and never carries dependency text',
          },
        ],
      },
      {
        text: 'with no audit or outbox effect.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the queue leaves no idempotency record and no audit record [P2-S11-AC-064]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'listing never writes: reservations, audit records, events, tokens, schedules and publications are untouched [P2-S11-AC-064]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] a signed cursor rejects changed scope state limit and caller with exact 409 details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] malformed limit scope and state fail before RPC with exact pointer details and no effects',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S11-AC-066',
    text: "CMS-03B-17 is consumed by `CmsEditorialReviewQueue`, which renders the `assigned` and `submitted` scope tabs, the `state` filter and the signed `nextCursor` as URL state, distinguishes no-records from filter-miss, announces the result count politely, drops the cursor and loads the first page after a cursor 409, and caches no row offline; verification covers `assigned` and `submitted` scoping, the state filter, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller's scopes is never listed.",
    clauses: [
      {
        text: 'CMS-03B-17 is consumed by `CmsEditorialReviewQueue`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-queue-route.test.tsx',
            title:
              'CMS-03B-17 protected reviewer queue page, composed lists the scope as native links with a signed, URL-owned continuation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) names its heading as a focus target and offers the two scopes as native links',
          },
        ],
      },
      {
        text: 'which renders the `assigned` and `submitted` scope tabs',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) names its heading as a focus target and offers the two scopes as native links',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) marks the active scope and keeps the state filter when the scope changes',
          },
        ],
      },
      {
        text: 'the `state` filter',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) filters with a native GET form that carries the scope and the closed state options',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) marks the active scope and keeps the state filter when the scope changes',
          },
        ],
      },
      {
        text: 'and the signed `nextCursor` as URL state',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) continues with the signed cursor in the URL and nothing else protected',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-queue-route.test.tsx',
            title:
              'CMS-03B-17 protected reviewer queue page, composed lists the scope as native links with a signed, URL-owned continuation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage returns the verified page with the URL-owned query for the view',
          },
        ],
      },
      {
        text: 'distinguishes no-records from filter-miss',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) distinguishes no records from a filter that matches nothing, each with one action',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-queue-route.test.tsx',
            title:
              'CMS-03B-17 protected reviewer queue page, composed shows nothing-in-scope and filter-miss as different states with one action each',
          },
        ],
      },
      {
        text: 'announces the result count politely',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-workflow/CmsEditorialReviewQueue.test.tsx',
            title:
              'CmsEditorialReviewQueue (CMS-03B-17) announces the count politely',
          },
        ],
      },
      {
        text: 'drops the cursor and loads the first page after a cursor 409',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage answers a refused cursor by dropping only the cursor and marking the restart',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-pages/load-review-queue-page.test.ts',
            title:
              'loadReviewQueuePage announces the restart and never forwards the marker to the read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 reviewer queue read relays the cursor conflict so the page restarts from the first page',
          },
        ],
      },
      {
        text: 'and caches no row offline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/reviews/review-queue-route.test.tsx',
            title:
              'reviews/index.astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/server/cms-workflow-platform-reads.test.ts',
            title:
              'CMS-03B-17 read proxy relays a strict, bound, validator-carrying 200 as no-store',
          },
        ],
      },
      {
        text: 'verification covers `assigned` and `submitted` scoping',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the submitted scope lists only reviews the caller submitted; the assigned scope of another reviewer lists only theirs: no review outside the scope is ever listed [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'the state filter',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the state filter narrows the scope: open, approved and invalidated select the right rows and a state with none is the empty page [P2-S11-AC-062]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] exact submitted and assigned state filters traverse every page without writes',
          },
        ],
      },
      {
        text: 'signed-cursor binding',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a cursor of another caller, scope, state or page size, a tampered signature or payload, a correctly signed forgery with a foreign binding, an expired and an over-lived cursor are all CONFLICT (restart from the first page) [P2-S11-AC-065]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] a signed cursor rejects changed scope state limit and caller with exact 409 details and no effects',
          },
        ],
      },
      {
        text: 'the DEC-140 fault classes',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a cursor of another caller, scope, state or page size, a tampered signature or payload, a correctly signed forgery with a foreign binding, an expired and an over-lived cursor are all CONFLICT (restart from the first page) [P2-S11-AC-065]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'a non-base64, non-string, empty or over-long cursor, an envelope with an unknown member and a correctly signed payload with a malformed position are INVALID_REQUEST (400) [P2-S11-AC-065]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] an authentically signed expired cursor refuses with exact 409 details and no effects',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue-pages.apispec.ts',
            title:
              'CMS-03B-17 complete queue pages [CMS-03B-17] an authentically signed foreign-domain cursor refuses with exact 409 details and no effects',
          },
        ],
      },
      {
        text: "and that a review outside the caller's scopes is never listed.",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'the submitted scope lists only reviews the caller submitted; the assigned scope of another reviewer lists only theirs: no review outside the scope is ever listed [P2-S11-AC-063]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_11_rpc_reads_queue.sql',
            title:
              'another acting party lists nothing of this organisation [P2-S11-AC-063]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-11-read-queue.apispec.ts',
            title:
              'CMS-03B-17 reviewer queue through the real stack [CMS-03B-17] the queue pages with a signed cursor; a tampered cursor is 409 CONFLICT and an out-of-range limit never reaches the database',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
