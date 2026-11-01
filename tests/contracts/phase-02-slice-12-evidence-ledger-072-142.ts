import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC072-AC142. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
// Re-cited 2026-10-24 from the refuted proposals by docs/handoffs/2026-10-22-claude-s12/recite/apply.mjs (a rerun reproduces it).
export const S12_EVIDENCE_LEDGER_072_142: readonly EvidenceLedgerEntry[] = [
  {
    criterion: 'P2-S12-AC-072',
    text: 'CMS-03C-07 verifies recent binding-bound MFA first (401 `STEP_UP_REQUIRED` before any idempotency reservation) and then serves only an assigned reviewer holding an active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot): a hidden or absent review is 404, a readable review without an effective assignment or capability or a separation-of-duties violation (the submitter or the subject creator) is 403, the reviewer, slot capability and MFA instant are server-derived, and `reason` is readable only by its decider.',
    clauses: [
      {
        text: 'CMS-03C-07 verifies recent binding-bound MFA first (401 `STEP_UP_REQUIRED` before any idempotency reservation)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) re-proves recent MFA on the refreshed session before the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers no proof with 401 STEP_UP_REQUIRED before quota, reservation and RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers a stale proof (701 s) with 401 STEP_UP_REQUIRED before quota, reservation and RPC',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED before concealment, assignment or capability [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-074]',
          },
        ],
      },
      {
        text: 'and then serves only an assigned reviewer holding an active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'an assignee without the standing cms.reviewer grant is refused capability_missing and nothing changes [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'an assigned reviewer holding the standing cms.reviewer grant records an approval with recent MFA [P2-S12-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'the first protected approval stays open: a specialist holder satisfies the policy slot [P2-S12-AC-073]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers a caller without cms.reviewer with 403 before step-up and quota',
          },
        ],
      },
      {
        text: 'a hidden or absent review is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; the readable submitter without an assignment is 403 capability_missing [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'a revoked assignee has lost the read scope with the decide authority: the review is concealed, 404 [P2-S12-AC-072]',
          },
        ],
      },
      {
        text: 'a readable review without an effective assignment or capability',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'an assignment whose window has ended still reads the review but cannot decide: 403 capability_missing [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; the readable submitter without an assignment is 403 capability_missing [P2-S12-AC-072]',
          },
        ],
      },
      {
        text: 'a separation-of-duties violation (the submitter',
        citations: [],
      },
      {
        text: 'the subject creator) is 403',
        citations: [],
      },
      {
        text: 'the reviewer, slot capability and MFA instant are server-derived',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-070] refuses capability and stepUpAt as unknown keys because both are server-derived',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 decision contract (BE03c row 169, field matrix 390) calls cms_record_governed_decision with the CAS operand, key and server context only',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the decision row stores the server-derived reviewer, satisfied slot, frozen hash, reason hash, assignment and MFA instant [P2-S12-AC-072]',
          },
        ],
      },
      {
        text: 'and `reason` is readable only by its decider.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] shows a decision reason only to its decider and exposes no decision member beyond the six',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the deciding reviewer sees his own reason and the mine flag [P2-S12-AC-090]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "a separation-of-duties violation (the submitter": BOUNDARY: the decision RPC\'s separation_of_duties branch cannot be reached by a submitter: the assignment guard and cms_assign_governed_reviewer refuse the submitter (20261013300600:166-168, 20261014010100:188-192) and the decision RPC answers capability_missing to anyone without an assignment (20261014010200:97-107) before its separation_of_duties check (:165); the reachable refusals are covered by governed_assignment/030-refusals.sqlinc (el-submitter). "the subject creator) is 403": missing test: pgTAP in supabase/tests/phase_02_slice_12_governed_decision/ where the subject creator is a DIFFERENT person from the submitter, holds an effective assignment and the standing cms.reviewer grant, and is refused the decision (separation of duties, BE03c CMS-03C-07). In the decision suite the owner is creator AND submitter of every review (010-setup.sqlinc:3), so the creator case is not separable from the submitter case; the creator case is only asserted for assignment eligibility (governed_assignment/030-refusals.sqlinc el-creator). Further limits of cited clauses: The separation_of_duties branch of the decision RPC is raised by no pgTAP (defense in depth with no public path); the submitter case is asserted by outcome only (the assignment gate refuses with capability_missing).',
  },
  {
    criterion: 'P2-S12-AC-073',
    text: 'CMS-03C-07 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order (the subject, dependency and content-type positions before the review row, DEC-157) and evaluates the ten ordered CMS-03B-06 checks (step-up proof, concealment, `open` state and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit), enforces a unique reviewer per review and review CAS (`version` + 1), ends the review at the first rejection, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event.',
    clauses: [
      {
        text: 'CMS-03C-07 requires an `Idempotency-Key` and the review-version `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-decision.test.ts',
            title:
              'CMS-03C-07 governed decision contract [P2-S12-AC-073] requires JSON, a bounded idempotency key and a strong quoted If-Match',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses missing If-Match with 400 before capability and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses Idempotency-Key null with 400 before capability and quota',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'runs in one transaction that takes its locks in the Slice 12 lock order (the subject, dependency and content-type positions before the review row, DEC-157)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_lock_order.sql',
            title:
              'CMS-03C-07 takes position 1 (reviewer authority rows), then the subject row (position 3), then its dependency graph and bound content-type versions (positions 3 and 4), then the review row (position 5) [BE03c lock order, DEC-157] [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_lock_order.sql',
            title:
              'the first FOR UPDATE in the CMS-03C-07 source is the review-row lock itself [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'and evaluates the ten ordered CMS-03B-06 checks (step-up proof, concealment, `open` state and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED before concealment, assignment or capability [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'a body capability or stepUpAt is an unknown key; a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad decision, version or an empty, over-long, non-NFC, control, markup or brace reason is VALIDATION_FAILED at its pointer [P2-S12-AC-071]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; the readable submitter without an assignment is 403 capability_missing [P2-S12-AC-072]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and returns the dependency_changed refusal envelope [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'when the approvals still possible can no longer reach the required count, the committed refusal review_not_open is returned [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'one human records at most one decision per review: the second is duplicate_decision and writes nothing [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'with the base slot filled, an approval by a human holding no specialist capability is specialist_slot_unsatisfiable and changes nothing [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a decision on a rejected review is refused review_not_open [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'the approval moves the subject review -> approved (lifecycle 3, definition version 1), writes one audit record, emits no event and stores status 200 [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'enforces a unique reviewer per review and review CAS (`version` + 1)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'one human records at most one decision per review: the second is duplicate_decision and writes nothing [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'the last required approval moves the review to approved at version 2 with the decision counted and decidedAt set [P2-S12-AC-070]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'the second distinct approval fills the base slot, approves the review at version 3 and moves the subject to approved [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'ends the review at the first rejection',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a rejection sets the review rejected at version 2 with decidedAt, terminally [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'a decision on a rejected review is refused review_not_open [P2-S12-AC-074]',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) consumes the user quota (30/min) then the party quota (60/min) of cms-governed-decision',
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 decision contract (BE03c row 169, field matrix 390) answers 200 with a strict review for approve leaving it approved',
          },
        ],
      },
      {
        text: 'and Tier 2',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-07 decision over 50 real approvals including the protected two-slot review: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-073]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-07] approval by the assigned reviewer: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-073]',
          },
        ],
      },
      {
        text: 'and emits no event.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'the approval moves the subject review -> approved (lifecycle 3, definition version 1), writes one audit record, emits no event and stores status 200 [P2-S12-AC-073]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-074',
    text: "CMS-03C-07 maps malformed ID, header or body (400), a missing session or step-up MFA (401 `UNAUTHENTICATED` or `STEP_UP_REQUIRED`, which carries `{ recoveryAction: 'step_up', allowedMethods }`, reserves no idempotency record and changes no state), a missing assignment or capability or `separation_of_duties` (403), a hidden or absent review (404), a stale review version, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable` or a committed `dependency_changed` invalidation (409 `GOVERNED_REVIEW_VERSION_CONFLICT`, the invalidation also returning the subject to `draft`), a non-JSON body (415), a decision or reason failure (422), the decision limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`.",
    clauses: [
      {
        text: 'CMS-03C-07 maps malformed ID, header or body (400)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses a non-UUID path with 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-07' command transport admission refuses malformed JSON with 400",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-07' SQL refusal transport maps INVALID_REQUEST",
          },
        ],
      },
      {
        text: "a missing session or step-up MFA (401 `UNAUTHENTICATED` or `STEP_UP_REQUIRED`, which carries `{ recoveryAction: 'step_up', allowedMethods }`, reserves no idempotency record and changes no state)",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/error-catalog.test.ts',
            title:
              'BE03c normative application error catalog [P2-S12-AC-074] gives the governed-review catalog a distinct STEP_UP_REQUIRED 401 and every other catalog UNAUTHENTICATED',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers an anonymous caller with UNAUTHENTICATED, never step-up',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers no proof with 401 STEP_UP_REQUIRED before quota, reservation and RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers a stale proof (701 s) with 401 STEP_UP_REQUIRED before quota, reservation and RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "STEP_UP_REQUIRED raised by SQL (CMS-03C-07, -08 and -09) 'CMS-03C-07' answers 401 with the step-up members, reserving nothing",
          },
        ],
      },
      {
        text: 'a missing assignment or capability or `separation_of_duties` (403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-admission.test.ts',
            title:
              'CMS-03C-07 capability, recent MFA and quota order (BE03c 216) answers a caller without cms.reviewer with 403 before step-up and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-07' SQL refusal transport maps capability_missing",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps separation_of_duties",
          },
        ],
      },
      {
        text: 'a hidden or absent review (404)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-07' SQL refusal transport maps NOT_FOUND",
          },
        ],
      },
      {
        text: 'a stale review version, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable` or a committed `dependency_changed` invalidation (409 `GOVERNED_REVIEW_VERSION_CONFLICT`, the invalidation also returning the subject to `draft`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/020-gates.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/030-happy.sqlinc',
            title:
              'a further decision on an approved review is refused review_not_open [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc',
            title:
              'one human records at most one decision per review: the second is duplicate_decision and writes nothing [P2-S12-AC-073]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'with the base slot filled, an approval by a human holding no specialist capability is specialist_slot_unsatisfiable and changes nothing [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and returns the dependency_changed refusal envelope [P2-S12-AC-074]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision.sql',
            title:
              'the invalidation is committed: review invalidated dependency_changed at version 2, no decision, the subject back to draft, one audit record and status 409 [P2-S12-AC-074]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps specialist_slot_unsatisfiable",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-07' SQL refusal transport maps review_not_open",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-07' SQL refusal transport maps duplicate_decision",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision.test.ts',
            title:
              'CMS-03C-07 committed refusal envelope (replayable 409) maps the committed dependency_changed envelope to 409 with its reasonCode',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-07' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
        ],
      },
      {
        text: 'a decision or reason failure (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-decision-input.test.ts',
            title:
              'CMS-03C-07 strict input (422 body, 400 transport) before any quota refuses a path and body reviewId that disagree with 422 at /reviewId',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps VALIDATION_FAILED /decision",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps VALIDATION_FAILED /reason",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-07' SQL refusal transport maps VALIDATION_FAILED /expectedVersion",
          },
        ],
      },
      {
        text: 'the decision limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary answers a denied user quota with 429 and the quota members",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary answers a denied party quota with 429 and the quota members",
          },
        ],
      },
      {
        text: 'an RPC deadline (502/503/504)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary answers a non-JSON media type as a local 502",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary maps provider HTTP 502 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary maps provider HTTP 503 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary maps provider HTTP 504 to 503 with retry-after 15",
          },
        ],
      },
      {
        text: 'an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-07' provider boundary scrubs an explicit INTERNAL_ERROR token",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title: "'CMS-03C-07' provider boundary scrubs no code to 500",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-075',
    text: 'CMS-03C-07 is consumed by the protected `CmsGovernedDecisionForm`, which builds `GovernedDecisionRequest` with the review `version` as `expectedVersion` and no `capability` or `stepUpAt`, shows a radio pair with a persistent reason label and counter and a confirm control that names the consequence, routes a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` with the draft restored and the same `Idempotency-Key` reused, renders `separation_of_duties` as the `CapabilityGate` copy and never a step-up route, and shows fixed copy for `specialist_slot_unsatisfiable`, `duplicate_decision`, `review_not_open` and a committed `dependency_changed`; verification covers the step-up round trip, each fixed message, the ordinary and protected decision paths and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-07 is consumed by the protected `CmsGovernedDecisionForm`, which builds `GovernedDecisionRequest` with the review `version` as `expectedVersion` and no `capability` or `stepUpAt`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) sends the strict body at the review version, then refetches and focuses the decisions',
          },
        ],
      },
      {
        text: 'shows a radio pair with a persistent reason label and counter and a confirm control that names the consequence',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) offers a radio pair, a persistent reason label with a counter and names the consequence',
          },
        ],
      },
      {
        text: 'routes a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` with the draft restored and the same `Idempotency-Key` reused',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) restores the draft after step-up, waits for confirmation and resubmits under the original key once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/governed-review-command-failures.test.ts',
            title:
              'sendGovernedCommand failures reads STEP_UP_REQUIRED as step-up navigation, and without a usable method as degraded',
          },
        ],
      },
      {
        text: 'renders `separation_of_duties` as the `CapabilityGate` copy and never a step-up route',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) renders the separation-of-duties gate, never a step-up route',
          },
        ],
      },
      {
        text: 'shows fixed copy for `specialist_slot_unsatisfiable`, `duplicate_decision`, `review_not_open` and a committed `dependency_changed`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for review_not_open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for dependency_changed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for duplicate_decision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for specialist_slot_unsatisfiable',
          },
        ],
      },
      {
        text: 'verification covers the step-up round trip',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) routes a step-up shortfall to the verification page with the draft stored and nothing replayed',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) restores the draft after step-up, waits for confirmation and resubmits under the original key once',
          },
        ],
      },
      {
        text: 'each fixed message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for specialist_slot_unsatisfiable',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for duplicate_decision',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for review_not_open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) refetches the review and states why for dependency_changed',
          },
        ],
      },
      {
        text: 'the ordinary',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) sends the strict body at the review version, then refetches and focuses the decisions',
          },
        ],
      },
      {
        text: 'protected decision paths',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-protected-decision-real-route.spec.ts',
            title:
              '[P2-S12-AC-075] a protected review stays open after the base-slot approval, names the next required slot, and completes with the specialist approval',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'and the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedDecisionForm.test.tsx',
            title:
              'CmsGovernedDecisionForm (CMS-03C-07) sends the strict body at the review version, then refetches and focuses the decisions',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) refetches the review after a decision and focuses the decisions heading',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-076',
    text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`) and returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-076] accepts a create with a reviewer and expiry and a revoke with an assignment id',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] refuses an action outside create and revoke and a member the action does not name',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment-input.test.ts',
            title:
              'CMS-03C-08 strict input and order before any quota refuses an unknown member with 422 naming no attacker member',
          },
        ],
      },
      {
        text: 'returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-076] answers 201 for a create and 200 for a revoke',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'GovernedReviewAssignmentResource (CMS-03C-08 201/200) [P2-S12-AC-076] carries the review, state, definition-review capability, read+decide actions and a window of at most seven days',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the 201 body is exactly GovernedReviewAssignmentResource (12 members, no person, grantor or party identifier) [P2-S12-AC-076]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'the owner revokes an assignment: 200 with the same resource at state revoked and version 2 [P2-S12-AC-076]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment.test.ts',
            title:
              'CMS-03C-08 contract (BE03c row 170, field matrix 391) answers 201 with the assignment version ETag and no Location for a create',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment.test.ts',
            title:
              'CMS-03C-08 contract (BE03c row 170, field matrix 391) answers 200 with no Location for a revoke',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-076] CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-076] CMS-03C-08 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-076] answers 201 with an ETag and no Location for a created assignment and 200 for a revoked one (DEC-239)',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-08 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-08 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-077',
    text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`), with an optional `reason` of 1-256 code points that is already NFC (refused, never normalized); `revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked); the strong `If-Match` equals `expectedVersion` exactly.",
    clauses: [
      {
        text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`)",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] requires an offset-bearing ISO instant for expiresAt and a UUID reviewer',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'GovernedReviewAssignmentResource (CMS-03C-08 201/200) [P2-S12-AC-077] keeps the window positive and no longer than exactly seven days',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an expiry beyond seven days, in the past, not after now, or beyond the grantor designer grant end (the reviewer grant is 30 days) is expiry_out_of_bounds at /expiresAt [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'with a 30-day grantor grant: five days past the reviewer one-day grant and seven days one minute are refused, six days twenty-three hours inside both grants is accepted [P2-S12-AC-077]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment-input.test.ts',
            title:
              'CMS-03C-08 strict input and order before any quota names /expiresAt for an invalid member',
          },
        ],
      },
      {
        text: 'with an optional `reason` of 1-256 code points that is already NFC (refused, never normalized)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] bounds the optional reason at 1 to 256 NFC code points and refuses a non-NFC reason without normalizing it',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'a reason of exactly 256 code points (512 octets) is accepted and stored whole: the bound counts code points, not octets [P2-S12-AC-077]',
          },
        ],
      },
      {
        text: '`revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'revoking an already revoked assignment is CONFLICT; an assignment of another review or an unknown one is NOT_FOUND [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'the owner revokes an assignment: 200 with the same resource at state revoked and version 2 [P2-S12-AC-076]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps NOT_FOUND",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps re-revoke: bare CONFLICT has no closed reason (F-3 gap)",
          },
        ],
      },
      {
        text: 'the strong `If-Match` equals `expectedVersion` exactly.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] requires the strong If-Match to equal the body expectedVersion, reported at headers.ifMatch',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-078',
    text: 'CMS-03C-08 requires unconditional recent binding-bound MFA and then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`), accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator, collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal, answers a hidden, absent or cross-owner review as 404, and confers on the assignee only `read` and `decide` on this one frozen review.',
    clauses: [
      {
        text: 'CMS-03C-08 requires unconditional recent binding-bound MFA',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED, even before a hidden review is concealed [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: 'and then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the receipt-derived owner without a valid designer grant is refused capability_missing for create and for revoke [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'cms.definition_review.assign can never be granted: the real grant command refuses it and no grant exists [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'after the designer grant is re-established the same owner assigns again [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: 'accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-organization, non-member, ungranted, submitter or subject-creator reviewer is one uniform reviewer_not_eligible with no existence or role signal [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'the review submitter is refused reviewer_not_eligible although eligible in every other way; the same human is assignable on a review he did not submit [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: 'collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-organization, non-member, ungranted, submitter or subject-creator reviewer is one uniform reviewer_not_eligible with no existence or role signal [P2-S12-AC-078]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps reviewer_not_eligible",
          },
        ],
      },
      {
        text: 'answers a hidden, absent or cross-owner review as 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; a designer, an assignee or a non-owner submitter who can read the review is refused 403 capability_missing (owner-only, receipt-derived) [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: 'and confers on the assignee only `read` and `decide` on this one frozen review.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the assignment confers exactly read and decide on this review for the requested window inside the seven-day ceiling [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the stored assignment names the server-derived grantor and the requested reviewer and nothing else [P2-S12-AC-078]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'GovernedReviewAssignmentResource (CMS-03C-08 201/200) [P2-S12-AC-076] refuses another capability, a different action set or order, an unknown state and any identity of the reviewer or grantor',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-079',
    text: 'CMS-03C-08 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, except that revoking an assignment that authorized a counted approval invalidates the review (`reviewer_authority_changed`, 03b DEC-161), admits a new assignment only while fewer than 16 are active (409 `assignment_limit`), enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, commits the assignment change and its audit record atomically, emits no event, and treats an expired assignment as inert.',
    clauses: [
      {
        text: 'CMS-03C-08 requires an `Idempotency-Key` and the exact review-version `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-079] requires a bounded idempotency key and a strong If-Match',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-assignment.test.ts',
            title:
              'CMS-03C-08 governed reviewer assignment contract [P2-S12-AC-077] requires the strong If-Match to equal the body expectedVersion, reported at headers.ifMatch',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-080]',
          },
        ],
      },
      {
        text: 'locks the review row',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_lock_order.sql',
            title:
              'CMS-03C-08 locks the review row FOR UPDATE (position 5) after the authority rows (position 1) and the revoke-path subject row (position 3) and before it inserts an assignment or locks the assignment row that carries the 16-active limit check [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_lock_order.sql',
            title:
              'the limit of 16 active assignments is checked under the review-row lock, never before it [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'leaves the review `version` unchanged on create',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'creating an assignment leaves the review version, state and the subject untouched [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'revoke',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'revoking an assignment that authorized no counted approval leaves the review open at version 1, writes one audit record and stores status 200 [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'except that revoking an assignment that authorized a counted approval invalidates the review (`reviewer_authority_changed`, 03b DEC-161)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'revoking the assignment of a counted approval still answers 200 with the revoked assignment resource [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'the same transaction invalidates the review reviewer_authority_changed at version 3, returns the subject to draft (lifecycle 3, definition version 1) and writes its own audit record [P2-S12-AC-078]',
          },
        ],
      },
      {
        text: 'admits a new assignment only while fewer than 16 are active (409 `assignment_limit`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'sixteen distinct reviewers are assigned to one review [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the seventeenth active assignment is refused assignment_limit [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'a revoke frees a slot: the next human is assignable and the active count is sixteen again [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 10/min/user and 20/min/party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-08' provider boundary charges 10/min/user then 20/min/party of cms-governed-assignment",
          },
        ],
      },
      {
        text: 'a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-08' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment.test.ts',
            title:
              'CMS-03C-08 contract (BE03c row 170, field matrix 391) answers 201 with the assignment version ETag and no Location for a create',
          },
        ],
      },
      {
        text: 'and Tier 2',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-08 assignment create over 146 real creations (up to the limit of 16 active): every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-08 assignment revoke over 20 real revocations on a 16-active review: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-079]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-08] assignment of the reviewer: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-079]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed-revoke.apispec.ts',
            title:
              'Slice 12 governed-review revoke latency through the real stack [CMS-03C-08] revocation of an assignment on a review carrying up to the limit of 16 active assignments: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'commits the assignment change and its audit record atomically',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'creating an assignment commits exactly one audit record and emits no event [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'revoking an assignment that authorized no counted approval leaves the review open at version 1, writes one audit record and stores status 200 [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'emits no event',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'creating an assignment commits exactly one audit record and emits no event [P2-S12-AC-079]',
          },
        ],
      },
      {
        text: 'and treats an expired assignment as inert.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_decision/050-invalidation-gates.sqlinc',
            title:
              'an assignment whose window has ended still reads the review but cannot decide: 403 capability_missing [P2-S12-AC-072]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-080',
    text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written, answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state, maps malformed IDs, header or body (400), a denied owner capability (403), a hidden, absent or cross-owner review (404), a non-JSON body (415), the assignment limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and reconciles a lost response by the same `Idempotency-Key`.',
    clauses: [
      {
        text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-organization, non-member, ungranted, submitter or subject-creator reviewer is one uniform reviewer_not_eligible with no existence or role signal [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'a second active assignment of the same reviewer on the review is refused assignment_exists [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'every structure, concealment, 403, CAS, eligibility and duplicate refusal leaves the covered stores identical and reserves nothing [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the seventeenth active assignment is refused assignment_limit [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the limit refusal leaves the covered stores identical [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'create and revoke on a rejected review are refused review_not_open [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the closed-review refusals leave the covered stores identical [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an expiry beyond seven days, in the past, not after now, or beyond the grantor designer grant end (the reviewer grant is 30 days) is expiry_out_of_bounds at /expiresAt [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/040-bounds-revoke.sqlinc',
            title:
              'the expiry refusals write no assignment and leave the covered stores identical [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'unknown keys, an unknown action, a malformed review id, If-Match disagreeing with expectedVersion, a missing key and a create carrying assignmentId are INVALID_REQUEST; a malformed version, expiry, person or an over-long or non-NFC reason is VALIDATION_FAILED at its pointer [P2-S12-AC-077]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps reviewer_not_eligible",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps assignment_exists",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps assignment_limit",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps review_not_open",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps expiry_out_of_bounds at /expiresAt",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-08' SQL refusal transport maps VALIDATION_FAILED /expiresAt",
          },
        ],
      },
      {
        text: 'answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "STEP_UP_REQUIRED raised by SQL (CMS-03C-07, -08 and -09) 'CMS-03C-08' answers 401 with the step-up members, reserving nothing",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED, even before a hidden review is concealed [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-080]',
          },
        ],
      },
      {
        text: 'maps malformed IDs, header or body (400), a denied owner capability (403), a hidden, absent or cross-owner review (404), a non-JSON body (415), the assignment limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment-input.test.ts',
            title:
              'CMS-03C-08 strict input and order before any quota refuses a non-UUID path with 400 and a query string with 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-08' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-08' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-08' provider boundary scrubs an explicit INTERNAL_ERROR token",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps capability_missing",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-08' SQL refusal transport maps NOT_FOUND",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-08' provider boundary answers a denied user quota with 429 and the quota members",
          },
        ],
      },
      {
        text: 'reconciles a lost response by the same `Idempotency-Key`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-assignment.test.ts',
            title:
              'CMS-03C-08 contract (BE03c row 170, field matrix 391) replays under the same key with byte-identical RPC input, so the database can return the committed outcome',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'an exact same-key replay returns the original response and writes no second assignment or audit record [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'a same-key request with a different expiry is refused IDEMPOTENCY_MISMATCH [P2-S12-AC-080]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-081',
    text: 'CMS-03C-08 is consumed by the protected `CmsGovernedAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer` (owner only), which offers reviewers from the owner-only grant list (CMS-03A-18, `capability=cms.reviewer`, `state=active`), keeps the chosen person id island-local and discards it on a step-up navigation, bounds `expiresAt` client-side to seven days, renders the uniform refusal as one fixed message, sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay and requires explicit re-confirmation with the review `version` refetched; verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority and an unchanged review `version`.',
    clauses: [
      {
        text: 'CMS-03C-08 is consumed by the protected `CmsGovernedAssignmentForm`, rendered only when `permittedNextActions` contains `assign_reviewer` (owner only)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'CmsGovernedAssignmentForm visibility (CMS-03C-08) renders only the controls the server permits',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) serves the evidence and exactly the forms permittedNextActions allows',
          },
        ],
      },
      {
        text: 'which offers reviewers from the owner-only grant list (CMS-03A-18, `capability=cms.reviewer`, `state=active`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'reviewer options loads the owner-only reviewers after mount and says so when none or unavailable',
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
        text: 'keeps the chosen person id island-local and discards it on a step-up navigation',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
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
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) refuses a missing reviewer and an expiry outside the bounds before sending',
          },
        ],
      },
      {
        text: 'renders the uniform refusal as one fixed message',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
        ],
      },
      {
        text: 'sends a 401 `STEP_UP_REQUIRED` to `/step-up?returnTo=` without automatic replay and requires explicit re-confirmation with the review `version` refetched',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) stores the scoped draft without the reviewer and restores it after step-up, asking to choose again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'revoke an assignment stores only the assignment record id on a step-up shortfall and confirms explicitly on return',
          },
        ],
      },
      {
        text: 'verification covers create and revoke, every eligibility refusal collapsing to `reviewer_not_eligible`, the seven-day, reviewer-grant-end and grantor-authority bounds, `assignment_exists`, `assignment_limit`, `review_not_open`, owner-only authority and an unchanged review `version`.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) sends the strict create body at the review version, then refetches and focuses the assignments',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'revoke an assignment lists each active assignment by its label and revokes the one named',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedAssignmentForm.test.tsx',
            title:
              'assign a reviewer (create) shows one fixed message for an ineligible reviewer and names the other refusals',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-organization, non-member, ungranted, submitter or subject-creator reviewer is one uniform reviewer_not_eligible with no existence or role signal [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an expiry beyond seven days, in the past, not after now, or beyond the grantor designer grant end (the reviewer grant is 30 days) is expiry_out_of_bounds at /expiresAt [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'with a 30-day grantor grant: five days past the reviewer one-day grant and seven days one minute are refused, six days twenty-three hours inside both grants is accepted [P2-S12-AC-077]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/030-refusals.sqlinc',
            title:
              'a second active assignment of the same reviewer on the review is refused assignment_exists [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the seventeenth active assignment is refused assignment_limit [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'create and revoke on a rejected review are refused review_not_open [P2-S12-AC-080]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; a designer, an assignee or a non-owner submitter who can read the review is refused 403 capability_missing (owner-only, receipt-derived) [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/050-limit-closed-authority.sqlinc',
            title:
              'the receipt-derived owner without a valid designer grant is refused capability_missing for create and for revoke [P2-S12-AC-078]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment/020-create.sqlinc',
            title:
              'creating an assignment leaves the review version, state and the subject untouched [P2-S12-AC-079]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_assignment.sql',
            title:
              'revoking an assignment that authorized no counted approval leaves the review open at version 1, writes one audit record and stores status 200 [P2-S12-AC-079]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-082',
    text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`) and returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`, carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-082] discriminates activate, schedule (with activateAt) and retire (with an optional reason)',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-082] refuses an unknown action and a member the action does not name',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'ScheduledInstant (03b Time authority, OD-6) [P2-S12-AC-082] accepts the five members of the shared scheduled instant',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'ScheduledInstant (03b Time authority, OD-6) [P2-S12-AC-083] refuses an offset-bearing local time, an off-grammar zone or tzdb version and a missing or extra member',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] documents the activation body as a closed three-way choice of activate, schedule and retire',
          },
        ],
      },
      {
        text: 'returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-082] answers 200 for activate and retire and 202 for schedule',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] answers 202 with a Location for a scheduled activation and 200 for an activation or retirement',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 activate (BE03c row 171, steps 1-6) answers 200 with the strict resource, the review ETag and the review Location',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 schedule (202, no event) answers 202 with the unchanged review version as ETag and the review Location',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 retire (DEC-190: active subject only, review version advances by one) forwards action retire and an optional reason, with no activateAt, and answers the 200 resource with the review ETag',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 activate (BE03c row 171, steps 1-6) refuses a body that fails the strict resource schema',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'the 200 body is exactly GovernedActivationResource (12 members, DEC-191 supersededVersion) [P2-S12-AC-082]',
          },
        ],
      },
      {
        text: 'carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'GovernedActivationResource [P2-S12-AC-082] accepts an immediate activation, a scheduled acceptance and a retirement',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'GovernedActivationResource [P2-S12-AC-082] sets eventType only on a committed immediate activation or retirement, matching the subject kind',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'GovernedActivationResource [P2-S12-AC-082] ties the action to the resulting subject state and the activation and schedule instants',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'GovernedActivationResource [P2-S12-AC-082] refuses an unknown action or state, a malformed version or instant and any ownership member',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'GovernedActivationResource [P2-S12-AC-082] closes the activation event types to the three subject kinds',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-09 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-09 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-09 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] CMS-03C-09 generates the documented parameters, request body, success statuses and error matrix',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-083',
    text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope and the review `version` equal to `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) for every action; `activate` and `schedule` further require an `approved` review and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; `retire` requires only an `active` subject (else 409 `subject_not_retirable`), needs no fresh approval and no hash, policy, dependency, provider or preflight validity (DEC-190), and accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized); the strong `If-Match` equals `expectedVersion` exactly.',
    clauses: [
      {
        text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope and the review `version` equal to `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) for every action;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED before concealment, capability or any read, for activate and schedule [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; an assigned reviewer who can read the review but lacks the owner capability is 403 capability_missing [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'retire of the active subject with the pre-activation review version is VERSION_MISMATCH: the review CAS runs first, nothing changes and nothing is reserved (the retirement itself is 095) [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'every structure, retire, shape, concealment, 403, CAS and state refusal leaves the covered stores identical and reserves nothing [P2-S12-AC-086]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 SQL refusals are mapped by token, whatever the action schedule maps VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 SQL refusals are mapped by token, whatever the action retire maps VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version',
          },
        ],
      },
      {
        text: '`activate` and `schedule` further require an `approved` review and',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a review that is still open (the subject in review) cannot be activated or scheduled: 409 subject_not_activatable [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the committed dependency_changed refusal replays identically and a later activation of the invalidated review is subject_not_activatable [P2-S12-AC-086]',
          },
        ],
      },
      {
        text: 'a recheck of the subject hash, the policy basis',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql',
            title:
              'activate with a subject hash that differs from the frozen one commits the invalidation: dependency_changed, review version 3, subject back to draft, no event, stored 409 [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql',
            title:
              'schedule with a subject hash that differs from the frozen one commits the same invalidation and creates no schedule [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql',
            title:
              'activate with a workflow-policy basis that differs from the frozen one commits the same invalidation [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_recheck.sql',
            title:
              'schedule with a workflow-policy basis that differs from the frozen one commits the same invalidation and creates no schedule [P2-S12-AC-083]',
          },
        ],
      },
      {
        text: 'and every dependency in which a difference commits the invalidation (subject back to `draft`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and answers the dependency_changed refusal envelope for activate and for schedule [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'both invalidations are committed: reviews invalidated dependency_changed at version 3, subjects back to draft, no schedule, no event, one audit record each, status 409 stored [P2-S12-AC-084]',
          },
        ],
      },
      {
        text: 'and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 committed refusal envelope (replayable 409, BE03c 1326 step 4) maps a committed dependency_changed envelope of activate to 409 with its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 committed refusal envelope (replayable 409, BE03c 1326 step 4) maps a committed dependency_changed envelope of schedule to 409 with its reasonCode',
          },
        ],
      },
      {
        text: '`retire` requires only an `active` subject (else 409 `subject_not_retirable`), needs no fresh approval and no hash, policy, dependency, provider or preflight validity (DEC-190), and accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized);',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'retire of an approved or in-review subject is 409 subject_not_retirable, with or without a reason [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a scheduled, draft (invalidated review), superseded or approved subject is 409 subject_not_retirable: retirement is for an active version only [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the owner retires an active version whose frozen dependency evidence is stale: no fresh approval, dependency, policy, provider or preflight validity is required [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the same loss of authority does not stop RETIRING the active gq1: retirement needs no live approval and no fresh decision [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the same unavailable policy evidence does not stop a retirement: retire consults no workflow policy [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'a retire reason of 1 and of 256 code points (256 two-byte characters included) passes the structure step, 257 code points is VALIDATION_FAILED at /reason, an activateAt is INVALID_REQUEST and the step-up comes first [P2-S12-AC-083]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'retire keeps every control: a missing, stale or future step-up is STEP_UP_REQUIRED, a cross-owner caller meets the concealed NOT_FOUND, an assigned reviewer without the owner capability is 403 capability_missing, a stale or future review version is VERSION_MISMATCH, an empty, 257-character, non-string or non-NFC reason is VALIDATION_FAILED at /reason and an activateAt is INVALID_REQUEST [P2-S12-AC-083]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-083] bounds the retire reason at 1 to 256 NFC code points',
          },
        ],
      },
      {
        text: 'the strong `If-Match` equals `expectedVersion` exactly.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-085] requires key + strong If-Match and ties the If-Match operand to expectedVersion for every action',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'a body capability or stepUpAt, a mismatched action member (activateAt on activate, reason, a missing activateAt), a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad action or version is VALIDATION_FAILED at its pointer [P2-S12-AC-083]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-084',
    text: "CMS-03C-09 verifies the unconditional recent binding-bound MFA before anything else (401 `STEP_UP_REQUIRED`, no idempotency record reserved) and then serves only the holder of the subject kind's owner capability as for CMS-03C-06: a hidden or absent review is 404 and a visible review without the capability is 403.",
    clauses: [
      {
        text: 'CMS-03C-09 verifies the unconditional recent binding-bound MFA before anything else (401 `STEP_UP_REQUIRED`, no idempotency record reserved)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) re-proves recent MFA on the refreshed session before the RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 retire (DEC-190: active subject only, review version advances by one) still demands recent MFA for retire before any RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers no proof with 401 STEP_UP_REQUIRED before quota, reservation and RPC, for every action',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers a stale proof (701 s) with 401 STEP_UP_REQUIRED before quota, reservation and RPC, for every action',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-086]',
          },
        ],
      },
      {
        text: 'then serves only the holder of',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'a designer who is not the receipt owner, creator or submitter activates through the capability scope; the audit record names that actor [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; an assigned reviewer who can read the review but lacks the owner capability is 403 capability_missing [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'after the revocation the assigned reviewer still reads gc8 (403 capability_missing) while a review without any remaining scope is concealed (404) [P2-S12-AC-084]',
          },
        ],
      },
      {
        text: "the subject kind's owner capability as for CMS-03C-06",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              "a curator is refused on a template review (hidden 404 when unassigned, 403 when assigned) and a designer is refused on a taxonomy review the same way: the capability is the subject kind's own [P2-S12-AC-084]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'controls: the designer activates the template review and the curator activates the taxonomy review [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'the owner capability of a subject kind is cms.template_designer for a template or pattern version and cms.taxonomy_curator for a taxonomy version [P2-S12-AC-066]',
          },
        ],
      },
      {
        text: 'a hidden or absent review is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; an assigned reviewer who can read the review but lacks the owner capability is 403 capability_missing [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'after the revocation the assigned reviewer still reads gc8 (403 capability_missing) while a review without any remaining scope is concealed (404) [P2-S12-AC-084]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-09' SQL refusal transport maps NOT_FOUND",
          },
        ],
      },
      {
        text: 'a visible review without the capability is 403.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers a caller with neither owner capability with 403 before step-up and quota',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'an absent, cross-owner, non-member or scope-less caller meets one concealed NOT_FOUND; an assigned reviewer who can read the review but lacks the owner capability is 403 capability_missing [P2-S12-AC-084]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-09' SQL refusal transport maps capability_missing",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-085',
    text: 'CMS-03C-09 requires an `Idempotency-Key` and the review-version `If-Match`, runs in one transaction that takes its locks in the Slice 12 lock order and holds the review row and the lineage advisory lock as an atomic CAS switch, enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store and Tier 2, and commits the switch and the audit record atomically.',
    clauses: [
      {
        text: 'CMS-03C-09 requires an `Idempotency-Key` and the review-version `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 governed activation request [P2-S12-AC-085] requires key + strong If-Match and ties the If-Match operand to expectedVersion for every action',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers no Idempotency-Key with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers no If-Match with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers an If-Match other than expectedVersion with 400 before capability, MFA and quota',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'a body capability or stepUpAt, a mismatched action member (activateAt on activate, reason, a missing activateAt), a malformed review id, a missing key or If-Match disagreeing with expectedVersion is INVALID_REQUEST; a bad action or version is VALIDATION_FAILED at its pointer [P2-S12-AC-083]',
          },
        ],
      },
      {
        text: 'runs in one transaction that takes its locks in the Slice 12 lock order',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'CMS-03C-09 activate is observed blocked BY the review row holder, the position 5 lock [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'while blocked at the review row the activation already holds the owner-capability grant rows (position 1) [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'while blocked at the review row the activation already holds the subject version row (position 3) [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'while blocked at the review row the activation already holds the bound content type version row (position 4) [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'while blocked at the review row the activation does not yet hold the lineage advisory lock, which is taken last [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'CMS-03C-09 activate is observed blocked BY the advisory lock holder [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'the activation waits for the lineage advisory lock, the last position [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'blocked at the advisory lock the activation already holds the review row (position 5) [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'blocked at the advisory lock the activation also holds positions 1, 3 and 4: the advisory lock is acquired after every row lock [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_lock_sources.sql',
            title:
              'CMS-03C-09 locks authority (1), the subject row (3), the graph and bound versions, then the lineage advisory lock last [P2-S12-AC-276]',
          },
        ],
      },
      {
        text: 'holds the review row and the lineage advisory lock as an atomic CAS switch',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/090-lineage-lock.sqlinc',
            title:
              'a committed immediate activation holds the lineage advisory lock (the CMS-03C-19 key), so concurrent activators of one lineage serialize and the loser is activation_conflict [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'a second activation with the pre-activation version is VERSION_MISMATCH: the activation advanced the review version [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'the previous active version becomes superseded (lifecycle +1, activated_at kept, never retired) in the same transaction and exactly one version of the lineage is active [P2-S12-AC-083]',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) consumes the user quota (20/min) then the party quota (40/min) of cms-governed-activation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-09' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation.test.ts',
            title:
              'CMS-03C-09 activate (BE03c row 171, steps 1-6) answers 200 with the strict resource, the review ETag and the review Location',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-082] CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with its auth, step-up, concurrency, rate and SLO policy',
          },
        ],
      },
      {
        text: 'Tier 2',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-09 activate over 24 real activations: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-09 schedule over 24 real scheduled acceptances: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-09 retire over 24 real retirements: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-09] activation of an approved review: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-09] scheduling of an approved review: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review latency through the real stack [CMS-03C-09] retirement of an active version: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-085]',
          },
        ],
      },
      {
        text: 'commits the switch and the audit record atomically.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation.sql',
            title:
              'exactly one cms.template.activated.v1 commits with one audit record: aggregate = the switched subject row at its lifecycle counter 4, payload = { templateId, templateVersionId } (DEC-180 G3, DEC-188) [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/040-supersession.sqlinc',
            title:
              'the supersession emits nothing: the whole command added exactly one event (the new version at its lifecycle counter) and one audit record [P2-S12-AC-083]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-086',
    text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict` and `schedule_exists` (409), a time, tzdb or horizon failure or `canonical_source_unavailable` with `details.domain` (422; a template or pattern preflight difference is the `dependency_changed` invalidation), and a missing or stale MFA (401 `STEP_UP_REQUIRED`, no state change), maps malformed IDs, header or body (400), a missing capability (403), a hidden or absent review (404), a non-JSON body (415), the activation limit (429), a preflight or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and commits no partial switch.',
    clauses: [
      {
        text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a stale review version is VERSION_MISMATCH naming the expected and the current version [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'retire of the active subject with the pre-activation review version is VERSION_MISMATCH: the review CAS runs first, nothing changes and nothing is reserved (the retirement itself is 095) [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a review that is still open (the subject in review) cannot be activated or scheduled: 409 subject_not_activatable [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'a second activation or schedule of an already active subject, with the current review version, is 409 subject_not_activatable [P2-S12-AC-085]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'retire of an approved or in-review subject is 409 subject_not_retirable, with or without a reason [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'a scheduled, draft (invalidated review), superseded or approved subject is 409 subject_not_retirable: retirement is for an active version only [P2-S12-AC-087]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and answers the dependency_changed refusal envelope for activate and for schedule [P2-S12-AC-084]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'every structure, retire, shape, concealment, 403, CAS and state refusal leaves the covered stores identical and reserves nothing [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'the mismatch, second activation and stale-version retire left the subject, review, event and audit counts exactly as the one activation made them [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'the subject_not_retirable refusals change nothing and reserve no idempotency record [P2-S12-AC-086]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps subject_not_activatable",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps subject_not_retirable (contract token)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps dependency_changed (raised)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps VERSION_MISMATCH (P0001 + JSON DETAIL) keeps no version",
          },
        ],
      },
      {
        text: '`activation_conflict`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'the second activator of the lineage is observed blocked BY the first in the live lock manager [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'the second activator waits for the lineage ADVISORY lock, the last position, and not for a row [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'the lineage advisory lock (the CMS-03C-19 key) is held by the first activator while the second waits [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'the activation that loses a race on the lineage answers P0001 activation_conflict (409 at the Worker) [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_race7_activation.sql',
            title:
              'after the lost race the lineage keeps exactly one active version, the winner, and no partial switch [P2-S12-AC-086]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps activation_conflict (a lost race on the lineage)",
          },
        ],
      },
      {
        text: 'and `schedule_exists` (409)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'a second live schedule of the subject is 409 schedule_exists; an immediate activation of a scheduled subject is 409 subject_not_activatable [P2-S12-AC-143]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'both refusals leave the schedule, subject, review and append-only stores identical and emit no event [P2-S12-AC-143]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-09' SQL refusal transport maps schedule_exists",
          },
        ],
      },
      {
        text: 'a time, tzdb or horizon failure',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'the pinned tzdb, the local/UTC offset window (-12 h .. +14 h), the 60 s .. 366 d horizon and the activator grant day are enforced with the 03b time tokens [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'tzdb_version_mismatch names the pinned version; schedule_out_of_horizon names the minUtc and maxUtc of the horizon [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'every time-rule and authority refusal commits nothing: no schedule, no state change, no event, no reservation [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a scheduled activation names an exact five-member activateAt; every malformed member is VALIDATION_FAILED at its own pointer, all reported together [P2-S12-AC-142]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps tzdb_version_mismatch {pinnedVersion}",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps resolved_utc_mismatch {expectedUtc}",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps schedule_out_of_horizon {minUtc, maxUtc}",
          },
        ],
      },
      {
        text: 'or `canonical_source_unavailable` with `details.domain` (422; a template or pattern preflight difference is the `dependency_changed` invalidation)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'scheduling an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'activating a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'scheduling a vocabulary that declares role and instrument is refused canonical_source_unavailable naming instrument, the unbuilt one, although role is built [P2-S12-AC-210]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db4_taxonomy_activation.sql',
            title:
              'activating an approved taxonomy version whose declared role domain has lost its provider is refused canonical_source_unavailable with details.domain = role [P2-S12-AC-223]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-09' SQL refusal transport maps canonical_source_unavailable {domain}",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-refusals.test.ts',
            title:
              'CMS-03C-09 SQL refusals are mapped by token, whatever the action schedule maps canonical_source_unavailable {domain}',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'a changed frozen dependency commits the invalidation and answers the dependency_changed refusal envelope for activate and for schedule [P2-S12-AC-084]',
          },
        ],
      },
      {
        text: 'a missing or stale MFA (401 `STEP_UP_REQUIRED`, no state change)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers no proof with 401 STEP_UP_REQUIRED before quota, reservation and RPC, for every action',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers a stale proof (701 s) with 401 STEP_UP_REQUIRED before quota, reservation and RPC, for every action',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'a missing, stale (11 min) or future (+2 min) step-up is STEP_UP_REQUIRED before concealment, capability or any read, for activate and schedule [P2-S12-AC-082]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'the step-up refusal reserves no idempotency record and changes no state [P2-S12-AC-086]',
          },
        ],
      },
      {
        text: 'maps malformed IDs, header or body (400), a missing capability (403), a hidden or absent review (404), a non-JSON body (415), the activation limit (429), a preflight or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) answers a caller with neither owner capability with 403 before step-up and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-09' command transport admission refuses non-JSON request media with 415 and the JSON allowlist",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-09' provider boundary ends a stalled RPC at the 15000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-09' SQL refusal transport maps NOT_FOUND",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-admission.test.ts',
            title:
              "'CMS-03C-09' command transport admission refuses malformed JSON with 400",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) stops a denied user quota before the RPC with 429',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-09' provider boundary scrubs an explicit INTERNAL_ERROR token",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) refuses a non-UUID review id with 400 before the body, quota or RPC',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers no Idempotency-Key with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-admission.test.ts',
            title:
              'CMS-03C-09 transport admission (BE00 order: parse before authority) answers an unquoted If-Match with 400 before capability, MFA and quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-09' SQL refusal transport maps capability_missing",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-activation-gate.test.ts',
            title:
              'CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1) stops a denied party quota before the RPC with 429',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-09' provider boundary maps provider HTTP 503 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-09' provider boundary answers a success that fails the strict resource schema as a local 502",
          },
        ],
      },
      {
        text: 'commits no partial switch.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/020-gates.sqlinc',
            title:
              'every structure, retire, shape, concealment, 403, CAS and state refusal leaves the covered stores identical and reserves nothing [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/030-activate.sqlinc',
            title:
              'the mismatch, second activation and stale-version retire left the subject, review, event and audit counts exactly as the one activation made them [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/050-schedule-accept.sqlinc',
            title:
              'every time-rule and authority refusal commits nothing: no schedule, no state change, no event, no reservation [P2-S12-AC-144]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/095-retire.sqlinc',
            title:
              'every retire refusal on the active ga1 leaves the subject, review, idempotency, audit and outbox stores identical [P2-S12-AC-086]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_activation/060-invalidation.sqlinc',
            title:
              'the revoked-capability refusals leave the covered stores identical and emit nothing [P2-S12-AC-086]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-087',
    text: 'CMS-03C-09 is consumed by the protected `CmsGovernedActivationForm`, which offers `activate`, `schedule` (with the shared Time authority module computing the `ScheduledInstant`, as `CmsEditorialScheduleForm`) or `retire` (with an optional reason and the named consequence "Entries bound to this version can no longer publish") behind an inline `ConfirmationStep`, sends the review `version` as `expectedVersion` with unconditional step-up, shows the typed `canonical_source_unavailable` message naming the domain, renders a 200 as the activated and superseded versions and a 202 as "Scheduled, not active", shows blocked and cancelled schedules with their closed reason, never reads an immediate activation as "published", and focuses the result heading; verification covers all three actions, the confirmation step, the step-up round trip and the closed schedule reasons.',
    clauses: [
      {
        text: 'CMS-03C-09 is consumed by the protected `CmsGovernedActivationForm`, which offers `activate`, `schedule` (with the shared Time authority module computing the `ScheduledInstant`, as `CmsEditorialScheduleForm`) or `retire` (with an optional reason and the named consequence "Entries bound to this version can no longer publish") behind an inline `ConfirmationStep`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'CmsGovernedActivationForm (CMS-03C-09) controls offers exactly the permitted actions as unselected radios under a named heading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'CmsGovernedActivationForm (CMS-03C-09) controls names the consequence of the chosen action beside the choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx',
            title:
              'schedule fields and the shared Time authority loads the tz snapshot only when scheduling is chosen, then once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'retirement names the consequence and offers an optional reason with a counter of 256',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation confirmation step asks for a second explicit click that names the consequence and sends nothing before it',
          },
        ],
      },
      {
        text: 'sends the review `version` as `expectedVersion` with unconditional step-up',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation commit sends the strict body at the review version, refetches, focuses the summary and announces "not published"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'unconditional step-up (DEC-111) routes a shortfall to verification with the choice stored, replaying nothing',
          },
        ],
      },
      {
        text: 'shows the typed `canonical_source_unavailable` message naming the domain',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'refusals and unknown outcomes names the domain whose provider is not available for a vocabulary',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/governed-activation-refusal.test.ts',
            title:
              'CMS-03C-09 refusal copy names the unbuilt canonical domain of a vocabulary',
          },
        ],
      },
      {
        text: 'renders a 200 as the activated and superseded versions and a 202 as "Scheduled, not active"',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation commit names the version the answer says was superseded, not a guess (DEC-191)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx',
            title:
              'schedule commit confirms the instant, sends activateAt at the review version and reads "Scheduled, not active"',
          },
        ],
      },
      {
        text: 'shows blocked and cancelled schedules with their closed reason',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) shows a blocked and a cancelled schedule with their closed reason on the review (FE03 :1118)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a cancelled schedule with its closed reason as fixed copy',
          },
        ],
      },
      {
        text: 'never reads an immediate activation as "published"',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation commit sends the strict body at the review version, refetches, focuses the summary and announces "not published"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/governed-review-labels.test.ts',
            title:
              'governed review labels never presents a scheduled version as active',
          },
        ],
      },
      {
        text: 'focuses the result heading',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.pending.test.tsx',
            title:
              'focus until the result is named (FE03 :1118, :1223) keeps focus on the commit control through the re-read after a commit, then moves it to the summary heading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) keeps focus on the commit control while the review is re-read, then moves it to the summary heading (FE03 :1118)',
          },
        ],
      },
      {
        text: 'verification covers all three actions, the confirmation step, the step-up round trip and the closed schedule reasons.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation commit sends the strict body at the review version, refetches, focuses the summary and announces "not published"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.schedule.test.tsx',
            title:
              'schedule commit confirms the instant, sends activateAt at the review version and reads "Scheduled, not active"',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title: 'retirement retires without a reason and omits the member',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title: 'retirement sends the reason when given',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation confirmation step asks for a second explicit click that names the consequence and sends nothing before it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.test.tsx',
            title:
              'activation confirmation step cancels with the Cancel button, with Escape and by changing the choice, never sending',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'unconditional step-up (DEC-111) routes a shortfall to verification with the choice stored, replaying nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedActivationForm.recovery.test.tsx',
            title:
              'unconditional step-up (DEC-111) restores the entries, waits for a new confirmation and resubmits under the original key once',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) shows a blocked and a cancelled schedule with their closed reason on the review (FE03 :1118)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a blocked schedule with its closed reason activation_authority_ended as fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a blocked schedule with its closed reason approval_invalidated as fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a blocked schedule with its closed reason canonical_source_unavailable as fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a blocked schedule with its closed reason dependency_changed as fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a blocked schedule with its closed reason retries_exhausted as fixed copy',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows a cancelled schedule with its closed reason as fixed copy',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-088',
    text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId} and returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`) sorted by label then policy key, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId}',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-088] CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId} with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) answers 200 with the strict detail, a strong review-version ETag and no-store',
          },
        ],
      },
      {
        text: 'returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] accepts the review base fields, nullable digest, policy basis, decisions, assignments and next actions',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] bounds the policy basis at 64 entries of label, policy key and policy version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] limits subjectState to the eight definition states and an optional-nullable digest to a lowercase hash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] keeps the review-base invariants on the detail',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the detail body is exactly GovernedReviewDetailResource (30 members, DEC-191 activationSchedule) [P2-S12-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the detail carries the review base, the recomputed block digest, the subject state and the live distinct approval count [P2-S12-AC-088]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the policy basis lists one summary per bound content type: label, policy key and version, never an identifier [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: 'sorted by label then policy key',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_governed.sql',
            title:
              'the served policyBasis is ordered by contentTypeLabel then policyKey (C collation), not by creation order or policy key alone [P2-S12-AC-088]',
          },
        ],
      },
      {
        text: '`distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] bounds decisions at 8 and assignments at 32 and keeps both internally consistent',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] closes the next actions to the six the review may offer',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] shows a decision reason only to its decider and exposes no decision member beyond the six',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-088] limits subjectState to the eight definition states and an optional-nullable digest to a lowercase hash',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the next actions follow the role: owner assign/revoke, an undecided assignee record_decision, the decided reviewer none [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'an assignee receives only the id and end of the own assignment [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-10 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-10 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-10 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-089',
    text: "CMS-03C-10 accepts only a UUID `reviewId` path with no query key (400 otherwise), exposes a decision's `reason` only to its decider and `assignments` only to the receipt-derived owner (every other reader receives `[]`), exposes no decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`, and refuses a response that carries more than 8 decisions or 32 assignments as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.",
    clauses: [
      {
        text: 'CMS-03C-10 accepts only a UUID `reviewId` path with no query key (400 otherwise)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] accepts only a UUID reviewId path and an empty strict query',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses a non-UUID path with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses any query key with 400 before any quota',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an absent, cross-owner or non-member read is one concealed NOT_FOUND; a confirmed member with no read scope, or whose assignment was revoked, is 403 capability_missing; extra or malformed input is INVALID_REQUEST [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: "exposes a decision's `reason` only to its decider and `assignments` only to the receipt-derived owner (every other reader receives `[]`)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the deciding reviewer sees his own reason and the mine flag [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'only the receipt owner receives the assignment summaries, by distinct display label; every other reader receives [] [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: 'exposes no decision member beyond `id`, `decision`, `capability`, `decidedAt`, `mine` and `reason`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] shows a decision reason only to its decider and exposes no decision member beyond the six',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: 'refuses a response that carries more than 8 decisions or 32 assignments as a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] bounds decisions at 8 and assignments at 32 and keeps both internally consistent',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary answers a success that fails the strict resource schema as a local 502",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-090',
    text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403), returns `reason` only on the caller's own decision, serializes `assignments` only to the owner and the caller's own assignment to its reviewer, and serializes no person, actor or party identifier.",
    clauses: [
      {
        text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the receipt owner/submitter/capability holder, an assignee, the deciding reviewer and a second assignee can all read R3 [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              "a holder of the subject kind's owner capability who is neither submitter, assignee nor owner reads the review and is offered activate and schedule, without the owner assignments [P2-S12-AC-090]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the submitter who is not the receipt owner reads the review without owner actions or assignments [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an absent, cross-owner or non-member read is one concealed NOT_FOUND; a confirmed member with no read scope, or whose assignment was revoked, is 403 capability_missing; extra or malformed input is INVALID_REQUEST [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: "returns `reason` only on the caller's own decision",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the deciding reviewer sees his own reason and the mine flag [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: "serializes `assignments` only to the owner and the caller's own assignment to its reviewer",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'only the receipt owner receives the assignment summaries, by distinct display label; every other reader receives [] [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'an assignee receives only the id and end of the own assignment [P2-S12-AC-090]',
          },
        ],
      },
      {
        text: 'serializes no person, actor or party identifier.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] gives every assignment a server-built label, never a person or party identifier',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'no person, auth user or party identifier appears anywhere in any reader document [P2-S12-AC-090]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-091',
    text: 'CMS-03C-10 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{review.version}"`, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target, writing no audit or outbox row and emitting no event.',
    clauses: [
      {
        text: 'CMS-03C-10 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) sends no mutation member and charges no write quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses request media on a read with 415 and the empty allowlist',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) keeps a read free of CSRF and answers a GET preflight',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses an Idempotency-Key with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses an If-Match with 400 before any quota',
          },
        ],
      },
      {
        text: 'carries the strong ETag `"{review.version}"`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) answers 200 with the strict detail, a strong review-version ETag and no-store',
          },
        ],
      },
      {
        text: 'enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary ends a stalled RPC at the 8000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary does not end a stalled RPC before its deadline",
          },
        ],
      },
      {
        text: 'and the Tier 1 p95 < 750 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-10 detail of the owner at 36 assignment rows (32 summarized), 2 decisions and a 2-type policy basis: p95 under the Tier 1 target of 750 ms [P2-S12-AC-091]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-10 detail of an assigned reviewer (no assignment summaries): p95 under the Tier 1 target of 750 ms [P2-S12-AC-091]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review read latency through the real stack [CMS-03C-10] the detail of a review with 16 active and 20 revoked assignments: p95 under the Tier 1 target of 750 ms [P2-S12-AC-091]',
          },
        ],
      },
      {
        text: 'writing no audit or outbox row and emitting no event.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the detail reads write no audit, outbox, idempotency or review row [P2-S12-AC-091]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-092',
    text: 'CMS-03C-10 maps a malformed path or query (400), a missing session (401), a missing review read scope (403), concealment (404), an unsupported body if sent (415), a response-bound failure (a response-contract failure, 502 `DEPENDENCY_UNAVAILABLE`), the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and answers a concealed review with the same 404.',
    clauses: [
      {
        text: 'CMS-03C-10 maps a malformed path or query (400), a missing session (401), a missing review read scope (403), concealment (404), an unsupported body if sent (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses request media on a read with 415 and the empty allowlist',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary answers an anonymous caller with 401 UNAUTHENTICATED before any dependency",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses a non-UUID path with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses any query key with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-10' SQL refusal transport maps NOT_FOUND",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-10' SQL refusal transport maps capability_missing (no read scope)",
          },
        ],
      },
      {
        text: 'a response-bound failure (a response-contract failure, 502 `DEPENDENCY_UNAVAILABLE`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-10 review detail (BE03c row 172) refuses a detail for another review as a local 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary answers a success that fails the strict resource schema as a local 502",
          },
        ],
      },
      {
        text: 'the read limit (429), a read dependency or deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary ends a stalled RPC at the 8000 ms route deadline and never retries",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary scrubs an explicit INTERNAL_ERROR token",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary answers a denied user quota with 429 and the quota members",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary maps provider HTTP 502 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary maps provider HTTP 503 to 503 with retry-after 15",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-10' provider boundary maps provider HTTP 504 to 503 with retry-after 15",
          },
        ],
      },
      {
        text: 'answers a concealed review with the same 404.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an absent, cross-owner or non-member read is one concealed NOT_FOUND; a confirmed member with no read scope, or whose assignment was revoked, is 403 capability_missing; extra or malformed input is INVALID_REQUEST [P2-S12-AC-090]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title: "'CMS-03C-10' SQL refusal transport maps NOT_FOUND",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-093',
    text: "CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`, which renders the subject identity and hash, the policy basis by content type label and policy key, the required, recorded and qualifying counts, the decisions as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`, takes actions only from `permittedNextActions`, moves focus to the heading on navigation only and puts no person, actor or party identifier in text, URL or telemetry; verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and `permittedNextActions` per caller.",
    clauses: [
      {
        text: 'CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-definition-pages-real-route.spec.ts',
            title:
              '[P2-S12-AC-093] opens /definition-reviews/:reviewId and mounts the CmsGovernedReviewDetail evidence for the owner',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which renders the subject identity and hash, the policy basis by content type label and policy key, the required, recorded and qualifying counts, the decisions as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the subject identity, review state, subject lifecycle and risk class as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the frozen subject and policy as hashes and labels, never ids',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) lists decisions as a semantic list without the decider and with only the own reason',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the own assignment end and, for the owner only, the assignments by server label',
          },
        ],
      },
      {
        text: 'takes actions only from `permittedNextActions`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) serves the evidence and exactly the forms permittedNextActions allows',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.activation.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190) offers Activate and Schedule for an approved version and Retire for an active one, from permittedNextActions only',
          },
        ],
      },
      {
        text: 'moves focus to the heading on navigation only',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) names each section as a focus target and links back to the queue',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/[reviewId].astro response invariants hands its heading to the shell that loads the heading-focus script',
          },
        ],
      },
      {
        text: 'puts no person, actor or party identifier in text, URL or telemetry',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed refuses, and never renders, a detail body that names a reviewer person',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the assignment controls to the owner and no person identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the frozen subject and policy as hashes and labels, never ids',
          },
        ],
      },
      {
        text: 'verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and `permittedNextActions` per caller.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the evidence and the decision form to an assignee',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the assignment controls to the owner and no person identifier',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed answers a hidden, absent or cross-owner review with one closed 404 state',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) lists decisions as a semantic list without the decider and with only the own reason',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the own assignment end and, for the owner only, the assignments by server label',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetail.test.tsx',
            title:
              'CmsGovernedReviewDetail (CMS-03C-10) shows the subject identity, review state, subject lifecycle and risk class as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewDetailIsland.test.tsx',
            title:
              'CmsGovernedReviewDetailIsland (CMS-03C-10) serves the evidence and exactly the forms permittedNextActions allows',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'a decision shows its slot capability and instant to every reader but its reason to no one but its decider [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'only the receipt owner receives the assignment summaries, by distinct display label; every other reader receives [] [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'no person, auth user or party identifier appears anywhere in any reader document [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the next actions follow the role: owner assign/revoke, an undecided assignee record_decision, the decided reviewer none [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the deciding reviewer sees his own reason and the mine flag [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              "a holder of the subject kind's owner capability who is neither submitter, assignee nor owner reads the review and is offered activate and schedule, without the owner assignments [P2-S12-AC-090]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the submitter who is not the receipt owner reads the review without owner actions or assignments [P2-S12-AC-090]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/020-detail.sqlinc',
            title:
              'the detail carries the review base, the recomputed block digest, the subject state and the live distinct approval count [P2-S12-AC-088]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-094',
    text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery` and returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
    clauses: [
      {
        text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-094] CMS-03C-11 registers GET /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-094] CMS-03C-11 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-094] exposes the query as the sole member of the OpenAPI transport view',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-11 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
      {
        text: 'returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-094] accepts the identifier-free queue item and refuses an inconsistent or extended one',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-094] bounds a page at 50 rows in (updatedAt DESC, reviewId DESC) keyset order with one opaque cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) answers 200 with the strict page, the page-version ETag and the contract defaults applied',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'the page is exactly GovernedReviewQueuePage [P2-S12-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'each item is exactly GovernedReviewQueueItem (12 members, no identifier) [P2-S12-AC-094]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              "every item equals the independently computed row: key, version, state, risk, decision counts, the caller's own decision, assignment end and instants [P2-S12-AC-094]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'a final page has no cursor and a decimal-string pageVersion [P2-S12-AC-094]',
          },
        ],
      },
      {
        text: 'ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-094] bounds a page at 50 rows in (updatedAt DESC, reviewId DESC) keyset order with one opaque cursor',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope assigned (the default) lists exactly the reviews the caller holds an active assignment on, in (updatedAt DESC, reviewId DESC) order [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'a keyset walk with limit 2 returns the seven reviews exactly once each, in order, over four pages (2, 2, 2, 1) [P2-S12-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'every non-final page carries a signed cursor of at most 512 characters and the last page none [P2-S12-AC-097]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-095',
    text: 'CMS-03C-11 accepts only `scope` `assigned` (default), `submitted` or `owned`, an optional `state` from the closed `GovernedReviewState`, an optional closed `subjectKind`, `limit` 1-50 (default 25) and an optional `cursor` of at most 512 characters, rejects every other query key, a body and any mutation header, and refuses an unknown scope, state or kind, a limit outside 1-50 or a structurally malformed cursor with the 400, 409 or 422 the validation matrix declares (DEC-140 cursor fault classes).',
    clauses: [
      {
        text: 'CMS-03C-11 accepts only `scope` `assigned` (default), `submitted` or `owned`, an optional `state` from the closed `GovernedReviewState`, an optional closed `subjectKind`, `limit` 1-50 (default 25) and an optional `cursor` of at most 512 characters',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-095] defaults scope to assigned and limit to 25 and accepts only the allowlisted query keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-095] bounds limit 1 to 50 and the cursor at 512 and closes scope, state and subject kind',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-095] documents the queue query keys with the default scope and limit and no body or path',
          },
        ],
      },
      {
        text: 'rejects every other query key',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses an unknown key with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses a duplicated key with 400 before any quota',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an unknown query key is INVALID_REQUEST; an unknown scope, state or subject kind and a limit outside 1-50 are VALIDATION_FAILED at their pointer [P2-S12-AC-095]',
          },
        ],
      },
      {
        text: 'a body and any mutation header',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts',
            title:
              'CMS-03C-11 review queue rejects a body and any mutation header [P2-S12-AC-095] CMS-03C-11 a request carrying a media type is 415 with the empty allowlist before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts',
            title:
              'CMS-03C-11 review queue rejects a body and any mutation header [P2-S12-AC-095] CMS-03C-11 a non-zero content-length is 400 INVALID_REQUEST before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts',
            title:
              'CMS-03C-11 review queue rejects a body and any mutation header [P2-S12-AC-095] CMS-03C-11 a transfer-encoding is 400 INVALID_REQUEST before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts',
            title:
              'CMS-03C-11 review queue rejects a body and any mutation header [P2-S12-AC-095] CMS-03C-11 an Idempotency-Key is 400 INVALID_REQUEST before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-queue-no-body.test.ts',
            title:
              'CMS-03C-11 review queue rejects a body and any mutation header [P2-S12-AC-095] CMS-03C-11 an If-Match is 400 INVALID_REQUEST before any quota',
          },
        ],
      },
      {
        text: 'refuses an unknown scope, state or kind, a limit outside 1-50 or a structurally malformed cursor with the 400, 409 or 422 the validation matrix declares (DEC-140 cursor fault classes).',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) names /scope for an out-of-bounds value with 422 (scope=everyone)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) names /state for an out-of-bounds value with 422 (state=pending)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) names /subjectKind for an out-of-bounds value with 422 (subjectKind=route_version)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422 (limit=51)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) names /limit for an out-of-bounds value with 422 (limit=0)',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses an over-long cursor with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses an empty cursor with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-11' SQL refusal transport maps CONFLICT (expired, tampered or foreign cursor)",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-11' SQL refusal transport maps INVALID_REQUEST (malformed cursor)",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'an unknown query key is INVALID_REQUEST; an unknown scope, state or subject kind and a limit outside 1-50 are VALIDATION_FAILED at their pointer [P2-S12-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a cursor replayed under another scope, state, subject kind, limit or actor, a tampered signature and an expired cursor are CONFLICT (the client restarts from the first page) [P2-S12-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong keys, over 512 characters, not a string) is INVALID_REQUEST [P2-S12-AC-098]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-096',
    text: "CMS-03C-11 requires a verified human and lists, for `scope=assigned`, only reviews on which the caller holds an assignment, for `scope=submitted`, only reviews the caller submitted and, for `scope=owned`, only reviews of subjects that the caller's designer or curator capability covers, so a review outside those scopes is never listed.",
    clauses: [
      {
        text: 'CMS-03C-11 requires a verified human',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary answers an anonymous caller with 401 UNAUTHENTICATED before any dependency",
          },
        ],
      },
      {
        text: 'lists, for `scope=assigned`, only reviews on which the caller holds an assignment',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope assigned (the default) lists exactly the reviews the caller holds an active assignment on, in (updatedAt DESC, reviewId DESC) order [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a revoked assignment (R4) is not listed; a caller with no designer capability has an empty owned scope and a non-submitter an empty submitted scope [P2-S12-AC-096]',
          },
        ],
      },
      {
        text: 'for `scope=submitted`, only reviews the caller submitted',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope submitted lists only the reviews the caller submitted: owner six, designer2 only R6, with no assignment end [P2-S12-AC-096]',
          },
        ],
      },
      {
        text: "for `scope=owned`, only reviews of subjects that the caller's designer or curator capability covers",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              "scope owned lists the seven reviews of subjects the caller's designer capability covers [P2-S12-AC-096]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a revoked assignment (R4) is not listed; a caller with no designer capability has an empty owned scope and a non-submitter an empty submitted scope [P2-S12-AC-096]',
          },
        ],
      },
      {
        text: 'so a review outside those scopes is never listed.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a revoked assignment (R4) is not listed; a caller with no designer capability has an empty owned scope and a non-submitter an empty submitted scope [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'a caller outside the acting party, or claiming a party he is not a member of, reads the empty page and no error [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope submitted lists only the reviews the caller submitted: owner six, designer2 only R6, with no assignment end [P2-S12-AC-096]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-097',
    text: 'CMS-03C-11 is a no-store, mutation-free safe read with a signed keyset cursor bound to the complete query and acting scope, default limit 25 and maximum 50, a filter allowlist of `scope`, `state` and `subjectKind`, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-11 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-094] CMS-03C-11 registers GET /api/v1/cms/governed-reviews with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary sends an idempotency key exactly on the commands",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'the queue reads write no audit, outbox, idempotency or review row [P2-S12-AC-097]',
          },
        ],
      },
      {
        text: 'with a signed keyset cursor bound to the complete query and acting scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'every non-final page carries a signed cursor of at most 512 characters and the last page none [P2-S12-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'without a valid Vault signing key the queue fails closed: DEPENDENCY_UNAVAILABLE, never an unsigned page [P2-S12-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a cursor replayed under another scope, state, subject kind, limit or actor, a tampered signature and an expired cursor are CONFLICT (the client restarts from the first page) [P2-S12-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'a keyset walk with limit 2 returns the seven reviews exactly once each, in order, over four pages (2, 2, 2, 1) [P2-S12-AC-097]',
          },
        ],
      },
      {
        text: 'default limit 25 and maximum 50',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-095] defaults scope to assigned and limit to 25 and accepts only the allowlisted query keys',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-095] bounds limit 1 to 50 and the cursor at 512 and closes scope, state and subject kind',
          },
        ],
      },
      {
        text: 'a filter allowlist of `scope`, `state` and `subjectKind`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-095] documents the queue query keys with the default scope and limit and no body or path',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-queue.test.ts',
            title:
              'CMS-03C-11 governed review queue contract [P2-S12-AC-095] defaults scope to assigned and limit to 25 and accepts only the allowlisted query keys',
          },
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary ends a stalled RPC at the 8000 ms route deadline and never retries",
          },
        ],
      },
      {
        text: 'the Tier 1 p95 < 750 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-11 first page at the maximum limit of 50 from 111 assigned reviews: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_governed/050-assert.sqlinc',
            title:
              'CMS-03C-11 cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review read latency through the real stack [CMS-03C-11] first page at the maximum limit of 50 from the reviewer queue: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-governed.apispec.ts',
            title:
              'Slice 12 governed-review read latency through the real stack [CMS-03C-11] cursor page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S12-AC-097]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-098',
    text: 'CMS-03C-11 answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page, and maps session, rate, read-dependency and internal failures to typed ApiError of catalog `cms.03c.governed-review.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-11 answers a structurally malformed cursor with 400',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses an empty cursor with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-reads.test.ts',
            title:
              'CMS-03C-11 review queue (BE03c row 173) refuses an over-long cursor with 400 before any quota',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-11' SQL refusal transport maps INVALID_REQUEST (malformed cursor)",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong keys, over 512 characters, not a string) is INVALID_REQUEST [P2-S12-AC-098]',
          },
        ],
      },
      {
        text: 'an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-11' SQL refusal transport maps CONFLICT (expired, tampered or foreign cursor)",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a cursor replayed under another scope, state, subject kind, limit or actor, a tampered signature and an expired cursor are CONFLICT (the client restarts from the first page) [P2-S12-AC-098]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts',
            title:
              'loadGovernedQueuePage answers a refused cursor by dropping only the cursor and marking the restart',
          },
        ],
      },
      {
        text: 'maps session, rate, read-dependency and internal failures to typed ApiError of catalog `cms.03c.governed-review.v1` with no audit or outbox effect.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary answers an anonymous caller with 401 UNAUTHENTICATED before any dependency",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary charges 300/min/user then 600/min/party of cms-governed-review-read",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary scrubs an explicit INTERNAL_ERROR token",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary answers a denied user quota with 429 and the quota members",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-provider.test.ts',
            title:
              "'CMS-03C-11' provider boundary maps provider HTTP 503 to 503 with retry-after 15",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc',
            title:
              'every cursor refusal leaves the covered stores identical [P2-S12-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'the queue reads write no audit, outbox, idempotency or review row [P2-S12-AC-097]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/governed-review-ops-refusals.test.ts',
            title:
              "'CMS-03C-11' SQL refusal transport maps DEPENDENCY_UNAVAILABLE (cursor key missing)",
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-099',
    text: "CMS-03C-11 is consumed by the protected `CmsGovernedReviewQueue`, which renders the `assigned`, `submitted` and `owned` scope tabs, the `state` and `subjectKind` filters and the signed `nextCursor` as URL state (never serializing a protected value), shows each row's subject key and version, risk class, recorded of required decisions, `myDecision` and the caller's `assignmentEndsAt`, links rows natively to the review detail, announces counts politely, distinguishes no-records from filter-miss and drops the cursor to load the first page after a cursor 409; verification covers each scope, the filters, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller's scopes is never listed.",
    clauses: [
      {
        text: 'CMS-03C-11 is consumed by the protected `CmsGovernedReviewQueue`, which renders the `assigned`, `submitted` and `owned` scope tabs, the `state` and `subjectKind` filters and the signed `nextCursor` as URL state (never serializing a protected value)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) names its heading as a focus target and offers the three scopes as native links',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) filters with a native GET form carrying the scope and the closed state and kind options',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) continues with the signed cursor in the URL and keeps the filters',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-11 protected definition-review queue page, composed lists the scope as native links with a signed, URL-owned continuation',
          },
        ],
      },
      {
        text: "shows each row's subject key and version, risk class, recorded of required decisions, `myDecision` and the caller's `assignmentEndsAt`",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) shows one native link per review with its facts as text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              "CmsGovernedReviewQueue (CMS-03C-11) words the risk class and the viewer's own decision instead of printing contract tokens",
          },
        ],
      },
      {
        text: 'links rows natively to the review detail',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) shows one native link per review with its facts as text',
          },
        ],
      },
      {
        text: 'announces counts politely',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) announces the count politely and singularly',
          },
        ],
      },
      {
        text: 'distinguishes no-records from filter-miss',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) distinguishes a filter that excludes every row from an empty scope',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-11 protected definition-review queue page, composed shows nothing-in-scope and filter-miss as different states with one action each',
          },
        ],
      },
      {
        text: 'drops the cursor to load the first page after a cursor 409',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts',
            title:
              'loadGovernedQueuePage answers a refused cursor by dropping only the cursor and marking the restart',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts',
            title:
              'loadGovernedQueuePage announces the restart and never forwards the marker to the read',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) prefixes the restart announcement',
          },
        ],
      },
      {
        text: "verification covers each scope, the filters, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller's scopes is never listed.",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) names its heading as a focus target and offers the three scopes as native links',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/CmsGovernedReviewQueue.test.tsx',
            title:
              'CmsGovernedReviewQueue (CMS-03C-11) filters with a native GET form carrying the scope and the closed state and kind options',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-11 protected definition-review queue page, composed lets no concealed row, count or identifier through a queue the API answered 403',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-queue-page.test.ts',
            title:
              'loadGovernedQueuePage answers a refused cursor by dropping only the cursor and marking the restart',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope submitted lists only the reviews the caller submitted: owner six, designer2 only R6, with no assignment end [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              "scope owned lists the seven reviews of subjects the caller's designer capability covers [P2-S12-AC-096]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'scope assigned (the default) lists exactly the reviews the caller holds an active assignment on, in (updatedAt DESC, reviewId DESC) order [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'the state and subjectKind filters narrow the scope: four open reviews, one invalidated, seven template versions, no pattern version [P2-S12-AC-095]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a cursor replayed under another scope, state, subject kind, limit or actor, a tampered signature and an expired cursor are CONFLICT (the client restarts from the first page) [P2-S12-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/040-cursor-privileges.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong keys, over 512 characters, not a string) is INVALID_REQUEST [P2-S12-AC-098]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads.sql',
            title:
              'a revoked assignment (R4) is not listed; a caller with no designer capability has an empty owned scope and a non-submitter an empty submitted scope [P2-S12-AC-096]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_reads/030-queue.sqlinc',
            title:
              'a caller outside the acting party, or claiming a party he is not a member of, reads the empty page and no error [P2-S12-AC-096]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-100',
    text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null) and returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-100] accepts the exact draft request for a first version and for a successor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-100] refuses any member that carries owner, authority or a server-computed value',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-101] bounds compatibleTypeIds at 1 to 64 unique UUIDs',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-101] requires a non-empty blockTree and reports a tree fault at its node',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-103] takes expectedVersion as null or a positive decimal and the digest as an optional lowercase hash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern block tree (CMS-03C-12 blockTree) [P2-S12-AC-101] requires 1 to 32 root nodes',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern node schema (D9, OD-2, DEC-175) [P2-S12-AC-100] accepts a block node with props and children and a nested pattern reference',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-100] CMS-03C-12 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-100] CMS-03C-12 registers POST /api/v1/cms/patterns/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'first definition succeeds [P2-S12-AC-100]',
          },
        ],
      },
      {
        text: 'returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'PatternVersionResource and detail [P2-S12-AC-100] accepts the closed draft resource without any owner or release evidence',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'PatternVersionResource and detail [P2-S12-AC-100] bounds nodeCount 1 to 512, compatibleTypeIds 1 to 64 and the patternVersion',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract creates the next draft from parent null without requiring step-up',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract creates the next draft from parent 7 without requiring step-up',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'first definition is draft [P2-S12-AC-100]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title:
              'resource is the exact safe projection; lifecycle and authority stay private [P2-S12-AC-100]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'stored count includes the one block [P2-S12-AC-211]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title:
              'digest is recomputed from the signed registry tuple [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'a forest row must store 1..512 nodes [P2-S12-AC-211]',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-12 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-12 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-12 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-101',
    text: "CMS-03C-12 accepts a `patternKey` of `^[a-z][a-z0-9-]{1,63}$` that is not a reserved key, 1-64 unique `compatibleTypeIds` that are each the id of an active content type of the caller's owner scope, 1-32 root nodes whose node `key`s match `^[a-z][a-z0-9_-]{0,63}$`, `block` nodes that use the canonical BlockKey and a registered, non-withdrawn version, node props of at most 64 keys and depth 8, and `expectedVersion` null for a first version or the parent's `version` for a successor.",
    clauses: [
      {
        text: 'CMS-03C-12 accepts a `patternKey` of `^[a-z][a-z0-9-]{1,63}$` that is not a reserved key',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-101] bounds the template and pattern key grammar at 2 to 64 characters',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-189] refuses a reserved pattern key with the key_reserved reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-189] refuses a reserved patternKey at /patternKey with key_reserved',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract gives reserved key context its typed request pointer',
          },
        ],
      },
      {
        text: '1-64 unique `compatibleTypeIds`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-101] bounds compatibleTypeIds at 1 to 64 unique UUIDs',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: '64 distinct active types accepted [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title:
              'all 64 compatible type ids survive persistence [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'types-empty: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'types-empty: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'types-duplicate: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'types-duplicate: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'types-65: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'types-65: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a forest row must list 1..64 compatible types [P2-S12-AC-101]',
          },
        ],
      },
      {
        text: 'that are each the id of an active content type',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'type-inactive: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'type-inactive: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: '64 distinct active types accepted [P2-S12-AC-101]',
          },
        ],
      },
      {
        text: "of the caller's owner scope",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              "another owner's ACTIVE content type is refused at the /compatibleTypeIds pointer [P2-S12-AC-101]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'one foreign member among owned active types refuses the whole list at /compatibleTypeIds [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              "control: the same definition over the caller's own active types is accepted [P2-S12-AC-101]",
          },
        ],
      },
      {
        text: '1-32 root nodes whose node `key`s match `^[a-z][a-z0-9_-]{0,63}$`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern block tree (CMS-03C-12 blockTree) [P2-S12-AC-101] requires 1 to 32 root nodes',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern node schema (D9, OD-2, DEC-175) [P2-S12-AC-101] bounds the node key to ^[a-z][a-z0-9_-]{0,63}$ on both node kinds',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-101] accepts a node key of 1 to 64 characters and refuses off-grammar keys',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/040-graph.sqlinc',
            title: '32 roots accepted [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'roots-0: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'roots-0: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'roots-33: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'roots-33: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'bad-node-key: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'bad-node-key: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: '`block` nodes that use the canonical BlockKey and a registered, non-withdrawn version',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern node schema (D9, OD-2, DEC-175) [P2-S12-AC-101] requires a canonical BlockKey and a positive int32 block version on a block node',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'bad-block-key: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'bad-block-key: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'unknown-block: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'unknown-block: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'unregistered-version: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'unregistered-version: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'withdrawn-block: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'withdrawn-block: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/060-block-lifecycle.sqlinc',
            title:
              'a deprecated (not withdrawn) block is admitted to a new draft [P2-S12-AC-101]',
          },
        ],
      },
      {
        text: 'node props of at most 64 keys and depth 8',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-node.test.ts',
            title:
              'pattern node schema (D9, OD-2, DEC-175) [P2-S12-AC-101] bounds node props at 64 keys of at most 128 characters and JSON depth 8',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/045-props-digest.sqlinc',
            title: '64 schema-valid props accepted [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/045-props-digest.sqlinc',
            title: 'all 64 props persist without truncation [P2-S12-AC-101]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'props-65: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'props-65: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: "`expectedVersion` null for a first version or the parent's `version` for a successor.",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 pattern version request [P2-S12-AC-103] takes expectedVersion as null or a positive decimal and the digest as an optional lowercase hash',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/conditional-if-match.test.ts',
            title:
              'conditional If-Match (CMS-03C-12 and CMS-03C-16 lineage create) [P2-S12-AC-103] accepts no If-Match on a first version and an equal one on a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects parent null and If-Match "1" before RPC',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-102',
    text: "CMS-03C-12 derives session and acting context server-side and serves only a verified human holding `cms.template_designer` in the caller's owner scope: a hidden owner or pattern is 404, a readable pattern without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
    clauses: [
      {
        text: 'CMS-03C-12 derives session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary uses the named RPC and server-bound context, not caller authority headers",
          },
        ],
      },
      {
        text: "serves only a verified human holding `cms.template_designer` in the caller's owner scope",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission mounts CMS-03C-12 and rejects a valid anonymous first-version request with 401',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the CMS-03C-12 write')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires an acting party even for a designer ('the CMS-03C-12 write')",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/030-refusals.sqlinc',
            title:
              'authority control: the granted designer can create [P2-S12-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title:
              'owner is derived from the verified acting context [P2-S12-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'creator is the verified human [P2-S12-AC-102]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'capability-missing: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'capability-missing: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'anonymous: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'anonymous: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'a hidden owner or pattern is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'hidden-owner: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'hidden-owner: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'absent-parent: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'absent-parent: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts',
            title:
              "pattern definition 'create': provider 4xx without a product token keeps the product answer for structured NOT_FOUND",
          },
        ],
      },
      {
        text: 'a readable pattern without the capability is 403',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known capability_missing reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission requires a designer capability before rate admission ('the CMS-03C-12 write')",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'capability-missing: exact SQL message token [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'no step-up is required',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract creates the next draft from parent 7 without requiring step-up',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-boundary.test.ts',
            title:
              "'create' provider boundary regressions uses refreshed stale proof without adding step-up to NONE",
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-100] CMS-03C-12 registers POST /api/v1/cms/patterns/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
        ],
      },
      {
        text: 'the response carries no owner, capability or authority identifier.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'PatternVersionResource and detail [P2-S12-AC-100] accepts the closed draft resource without any owner or release evidence',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-103',
    text: "CMS-03C-12 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique `(key, version)` and CAS, computes `blockRegistryDigest` on the server, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline (target < 2 s), no-store and the Tier 2 p95 < 1,200 ms target, and emits no event (activation is CMS-03C-09).",
    clauses: [
      {
        text: 'CMS-03C-12 requires an `Idempotency-Key`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects a missing or invalid idempotency key: undefined',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 headers and transport [P2-S12-AC-103] requires JSON and a bounded key, with an exact strong If-Match only when editing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects a missing or invalid idempotency key: bad key',
          },
        ],
      },
      {
        text: "takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/conditional-if-match.test.ts',
            title:
              'conditional If-Match (CMS-03C-12 and CMS-03C-16 lineage create) [P2-S12-AC-103] reports a missing, forbidden or different If-Match once at headers.ifMatch with its own reason',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-version.test.ts',
            title:
              'CMS-03C-12 headers and transport [P2-S12-AC-103] ties If-Match to expectedVersion: absent on a first version, equal on a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract quotes the successor only in the RPC header and binds idempotency',
          },
        ],
      },
      {
        text: 'enforces the per-owner unique `(key, version)` and CAS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title: 'one owner cannot hold a key version twice [P2-S12-AC-100]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'another owner may hold the same key and version: uniqueness is per owner, never disclosed as a conflict (E14)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/070-storage.sqlinc',
            title:
              'a successor must directly follow its parent version [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'stale-parent: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'stale-parent: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'duplicate-first: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'duplicate-first: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'computes `blockRegistryDigest` on the server',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title:
              'digest is recomputed from the signed registry tuple [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/025-agreement.sqlinc',
            title:
              'first definition digest equals the governed recompute [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/030-refusals.sqlinc',
            title:
              'matching digest is an expectation; persisted value is the server result [P2-S12-AC-193]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'digest-mismatch: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'digest-mismatch: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary uses the named RPC and server-bound context, not caller authority headers",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary ends a stalled session at the 15 second route deadline",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary stops denied user quota before RPC",
          },
        ],
      },
      {
        text: '(target < 2 s)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-12 save of a new lineage with a 512-node forest over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-12 save of 32 references expanding to 512 nodes over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-103]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern definition latency through the real stack [CMS-03C-12] saving a new lineage with a 512-node forest: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103] [P2-S12-AC-279]',
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract creates the next draft from parent null without requiring step-up',
          },
        ],
      },
      {
        text: 'and the Tier 2 p95 < 1,200 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-12 save of a new lineage with a 512-node forest over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-12 successor save (expectedVersion = the parent) of a 512-node forest over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-103]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern definition latency through the real stack [CMS-03C-12] saving 32 references that expand to 512 nodes: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103] [P2-S12-AC-279]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern definition latency through the real stack [CMS-03C-12] saving a successor of a 512-node lineage (expectedVersion = the parent): p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-103]',
          },
        ],
      },
      {
        text: 'emits no event (activation is CMS-03C-09).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title: 'draft creation emits no activation event [P2-S12-AC-103]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/020-create-successor.sqlinc',
            title:
              'successor draft also emits no activation event [P2-S12-AC-103]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-104',
    text: 'CMS-03C-12 maps malformed IDs, header or body (400), a missing session (401), a missing designer capability (403), a hidden or absent pattern scope (404 `COMPOSITION_NOT_FOUND`), a stale parent, key or version, a cycle or an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), a non-JSON body (415), a tree, props or graph bound failure or a nested pattern that is not `active` or not compatible (422 `COMPOSITION_VALIDATION_FAILED`, the latter with `details.reasonCode` `nested_pattern_not_active`), the pattern-write limit (429), a registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and rolls back so that no pattern row exists after a refusal.',
    clauses: [
      {
        text: 'CMS-03C-12 maps malformed IDs, header or body (400), a missing session (401), a missing designer capability (403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-write.test.ts',
            title:
              'CMS-03C-12 pattern definition write contract rejects malformed JSON before rate admission',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission mounts CMS-03C-12 and rejects a valid anonymous first-version request with 401',
          },
        ],
      },
      {
        text: 'a hidden or absent pattern scope (404 `COMPOSITION_NOT_FOUND`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts',
            title:
              "pattern definition 'create': provider 4xx without a product token keeps the product answer for structured NOT_FOUND",
          },
        ],
      },
      {
        text: 'a stale parent, key or version, a cycle or an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'stale-parent: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'stale-parent: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'duplicate-first: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'duplicate-first: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'self-lineage-cycle: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'indirect-lineage-cycle: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'indirect-lineage-cycle: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'idem-body-conflict: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'idem-body-conflict: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_cycle reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary bounds an RPC error payload at 262144 bytes",
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              "CMS-03C-12 and cmsPatternLatestRead Worker admission rejects unsupported request media before the session ('the CMS-03C-12 write')",
          },
        ],
      },
      {
        text: 'a tree, props or graph bound failure or a nested pattern that is not `active` or not compatible (422 `COMPOSITION_VALIDATION_FAILED`, the latter with `details.reasonCode` `nested_pattern_not_active`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known nested_pattern_not_active reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_incompatible reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_depth_exceeded reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_nodes_exceeded reason',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              'CMS-03C-12 typed SQL refusal transport (synthetic replies) projects only the known pattern_version_not_active reason',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'depth-nine: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'depth-nine: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'expanded-513: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'expanded-513: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'nested-draft: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'nested-draft: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'nested-incompatible: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'nested-incompatible: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'props-65: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'props-65: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'roots-33: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'roots-33: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
      {
        text: 'the pattern-write limit (429), a registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary stops denied user quota before RPC",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission never promotes a provider HTTP 502 fault into a caller refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-production.test.ts',
            title:
              "'CMS-03C-12' existing-runtime transport boundary ends a stalled session at the 15 second route deadline",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-provider-fault.test.ts',
            title:
              "pattern definition 'create': provider 4xx without a product token scrubs PGRST202 function not found to 500 INTERNAL_ERROR",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission never promotes a provider HTTP 503 fault into a caller refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-definition-admission.test.ts',
            title:
              'CMS-03C-12 and cmsPatternLatestRead Worker admission never promotes a provider HTTP 504 fault into a caller refusal',
          },
        ],
      },
      {
        text: 'rolls back so that no pattern row exists after a refusal.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/090-atomicity.sqlinc',
            title: 'no pattern row survives the fault [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/090-atomicity.sqlinc',
            title:
              'a fault after the row, the reservation and the audit statement leaves every captured full row unchanged [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition/090-atomicity.sqlinc',
            title:
              'the same key and the identical request succeed once the fault is gone: nothing was reserved [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'stale-parent: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'stale-parent: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title: 'types-65: exact SQL message token [P2-S12-AC-104]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_definition.sql',
            title:
              'types-65: expected refusal preserves every captured full row [P2-S12-AC-104]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-105',
    text: "CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`, which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors, nested pattern nodes from `CmsPatternNestedPicker` over the designer-only `cmsPatternNestableRead` (DEC-196), `compatibleTypeIds` from the context's content type selectors), edits node keys, props and children with explicit add, remove and move-up/move-down controls (no drag-only path), renders the server digest, `nodeCount` and a cycle, depth or node-count refusal inline with the node path, and sends the read version as `expectedVersion` for a successor; verification covers keyboard operation, the inline refusals, the error summary linking to the node and the focused result heading.",
    clauses: [
      {
        text: 'CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts',
            title:
              '[P2-S12-AC-105] saves a first pattern version from /patterns/new: the form sends CMS-03C-12, a draft is committed, and the page links the saved pattern',
            project: 'real-route-chrome',
          },
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts',
            title:
              '[P2-S12-AC-105] saves a successor version from /patterns/:patternKey: the form sends version 1 as If-Match, version 2 is committed beside it',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors,",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: a new pattern renders the tree as an ordered list with level text',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest builds a request the contract accepts and sends no digest',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest names the node whose block is not registered or not chosen',
          },
        ],
      },
      {
        text: 'nested pattern nodes from `CmsPatternNestedPicker` over the designer-only `cmsPatternNestableRead` (DEC-196),',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.nested-picker.test.tsx',
            title:
              'CmsPatternVersionDesigner: the nested-pattern picker reads with the version content types, in step with the checkboxes, and adds a nested node that saves as a lineage reference',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.test.tsx',
            title:
              'CmsPatternNestedPicker: choosing adds the chosen version through onAdd and resets the choice',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternNestedPicker.test.tsx',
            title:
              'CmsPatternNestedPicker: before and while loading reads the first page of the pattern types and lists each pattern version, never preselected',
          },
        ],
      },
      {
        text: "`compatibleTypeIds` from the context's content type selectors)",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: prerequisites offers every content type as a checkbox',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest refuses no content type, an unavailable one and over-long lists',
          },
        ],
      },
      {
        text: 'edits node keys, props and children with explicit add, remove and move-up/move-down controls (no drag-only path)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls moves a node earlier or later, announces it and keeps the keyboard on a usable control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls removes a node with its children, announces it and focuses the tree',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls focuses the key of a new node',
          },
        ],
      },
      {
        text: 'renders the server digest, `nodeCount`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: a new pattern renders the tree as an ordered list with level text',
          },
        ],
      },
      {
        text: 'and a cycle, depth or node-count refusal inline with the node path',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.node-pointer.test.tsx',
            title:
              'CmsPatternVersionDesigner: a refusal that names its node (DEC-228) links pattern_depth_exceeded to Node 1.1 and renders it inline at that node',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.node-pointer.test.tsx',
            title:
              'CmsPatternVersionDesigner: a refusal that names its node (DEC-228) links pattern_nodes_exceeded to Node 1.1 and renders it inline at that node',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.node-pointer.test.tsx',
            title:
              'CmsPatternVersionDesigner: a refusal that names its node (DEC-228) links pattern_cycle to Node 1.1 and renders it inline at that node',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_node_pointers.sql',
            title:
              'a depth-10 chain is refused at its level 9 node, not at the root [P2-S12-AC-105, DEC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_node_pointers.sql',
            title:
              'the 513th literal node in preorder is the offending node [P2-S12-AC-105, DEC-228]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_node_pointers.sql',
            title:
              'a successor of child that nests child is refused at the nested reference [P2-S12-AC-105, DEC-228]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/node-pointer-refusal.test.ts',
            title:
              'nodePointerWireDetails (DEC-228) [P2-S12-AC-105] relays the first held pointer of the request blockTree grammar with the fixed code and message',
          },
        ],
      },
      {
        text: 'sends the read version as `expectedVersion` for a successor',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx',
            title:
              'CmsPatternVersionDesigner: editing a saved pattern prefills from the latest version, keeps the key read-only and sends the read version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/pattern-designer-request.test.ts',
            title:
              'buildPatternVersionRequest sends the read version as expectedVersion for a successor',
          },
        ],
      },
      {
        text: 'verification covers keyboard operation, the inline refusals, the error summary linking to the node and the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls moves a node earlier or later, announces it and keeps the keyboard on a usable control',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls focuses the key of a new node',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: explicit tree controls removes a node with its children, announces it and focuses the tree',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: the error summary names the node sends nothing, links each problem to its control and marks it invalid',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.results.test.tsx',
            title:
              'CmsPatternVersionDesigner: what the server answered says a typed refusal in fixed words and keeps the tree',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-pattern-designer/CmsPatternVersionDesigner.test.tsx',
            title:
              'CmsPatternVersionDesigner: a new pattern builds a tree from the registered blocks and submits the exact request',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-106',
    text: 'CMS-03C-13 registers GET /api/v1/cms/patterns/selector with the strict `PatternSelectorQuery` (`contentTypeId`, `cursor`, `limit`) and returns the strict `PatternSelectorPage` (at most 50 `PatternSelectorItem` rows of `patternId`, `patternVersionId`, `patternKey`, `patternVersion`, `nodeCount` and `blockRegistryDigest`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(patternKey ASC, patternVersion DESC)`.',
    clauses: [
      {
        text: 'CMS-03C-13 registers GET /api/v1/cms/patterns/selector with the strict `PatternSelectorQuery` (`contentTypeId`, `cursor`, `limit`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-106] takes a content type id, an optional cursor and a limit defaulting to 25',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-106] CMS-03C-13 registers GET /api/v1/cms/patterns/selector with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery applies the default limit of 25 and sends no cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'the three registry rows CMS-03C-13: GET selector, 300/600 per minute, 8,000 ms',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-13 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-13 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-13 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
      {
        text: 'returns the strict `PatternSelectorPage` (at most 50 `PatternSelectorItem` rows of `patternId`, `patternVersionId`, `patternKey`, `patternVersion`, `nodeCount` and `blockRegistryDigest`, a `nextCursor` of at most 512 characters or null, and `pageVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-106] accepts the six-member selector item and refuses a hidden or malformed member',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-106] bounds a page at 50 items with an opaque cursor of at most 512 and a page version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-answers.test.ts',
            title:
              'validSelectorPage (CMS-03C-13) refuses a body outside the strict contract',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title: 'the page is exactly PatternSelectorPage [AC-106]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'each item is exactly PatternSelectorItem: no owner, capability, authority or state member [AC-106, AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'every item equals the independently built row: lineage id, the version ROW id, key, version, nodeCount and digest of the CMS-03C-12 response [AC-106]',
          },
        ],
      },
      {
        text: 'ordered by the signed keyset `(patternKey ASC, patternVersion DESC)`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'three pages (4, 4, 2) are exactly the unpaged list in (patternKey, patternVersion) order [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'limit 4 returns four items and a signed cursor of at most 512 characters [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title:
              'the list is the newest ACTIVE version of every lineage compatible with type 1, ordered by patternKey: no superseded pu-a@1, no draft pu-f@2, no pu-e (its newest version is compatible with type 2 only), no other owner [AC-108]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route an answer with rows out of keyset order is a local 502, never a page',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-107',
    text: "CMS-03C-13 accepts only a UUID `contentTypeId` of a content type in the caller's owner scope, a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other query key, a body and any mutation header, and answers a hidden or absent content type with the same 404.",
    clauses: [
      {
        text: 'CMS-03C-13 accepts only a UUID `contentTypeId`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-106] takes a content type id, an optional cursor and a limit defaulting to 25',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title: 'selector query case type-word [AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title: 'selector query case missing-contentTypeId [AC-107]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery a malformed contentTypeId is a bare 400',
          },
        ],
      },
      {
        text: "of a content type in the caller's owner scope",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              "another owner's ACTIVE content type answers the concealed NOT_FOUND [P2-S12-AC-107]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'it is exactly the outcome of an absent content type: message, DETAIL and all [P2-S12-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'control: an author lists the selector for its own content type [P2-S12-AC-107]',
          },
        ],
      },
      {
        text: ', a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery accepts a cursor of exactly 512 characters and refuses 513',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery applies the default limit of 25 and sends no cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a limit above the maximum is 422 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a limit of zero is 422 before any quota or port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title: 'limit 50, the maximum, is accepted [AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title: 'selector query case limit-over [AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title: 'selector query case limit-zero [AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a cursor replayed against another limit, content type or actor, a tampered signature and an expired cursor are 409 CONFLICT: the client restarts [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong keys, over 512 characters, not a string) is 400 INVALID_REQUEST [AC-110]',
          },
        ],
      },
      {
        text: 'rejects every other query key, a body and any mutation header',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-107] refuses a missing or malformed content type, limit outside 1 to 50, an oversize cursor and any other key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route an unknown key is 400 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying an Idempotency-Key is 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying an If-Match is 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying a request media type is 415',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying a declared body is 400',
          },
        ],
      },
      {
        text: 'answers a hidden',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              'it is exactly the outcome of an absent content type: message, DETAIL and all [P2-S12-AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_pattern_types.sql',
            title:
              "another owner's ACTIVE content type answers the concealed NOT_FOUND [P2-S12-AC-107]",
          },
        ],
      },
      {
        text: 'or absent content type with the same 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title: 'an absent content type is 404 [AC-107]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title: 'selector query case unknown-type [AC-107]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route publishes the cursor conflict (409) with no member and the hidden content type as 404',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-108',
    text: 'CMS-03C-13 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested content type, so a draft, non-compatible or other-owner version is never listed and no owner or authority field is serialized.',
    clauses: [
      {
        text: 'CMS-03C-13 requires a verified human holding `cms.author` or `cms.editor` in the owner party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission a caller holding cms.editor may use it",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission the designer capability alone is 403 capability_missing with no quota and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission no capability is 403 capability_missing with no quota and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission an unauthenticated session is the typed 401 and nothing else runs",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title: 'an assigned-capability author reads the selector [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              'any holder of cms.author reads the selector: the capability in the owner party is the authority, no entry assignment is needed [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title: 'cms.editor suffices and sees the same list [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              'a human with cms.reviewer only is 403 capability_missing [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              'the designer capability that DEFINES patterns does not let a human select them: only author or editor does [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              "a human of ANOTHER organization holds no capability in its own party: the owner's list is never reachable [AC-108]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title: 'a revoked author is refused on the next call [AC-108]',
          },
        ],
      },
      {
        text: 'lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested content type',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title:
              'the list is the newest ACTIVE version of every lineage compatible with type 1, ordered by patternKey: no superseded pu-a@1, no draft pu-f@2, no pu-e (its newest version is compatible with type 2 only), no other owner [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'type 2 lists exactly the version that names it: pu-e@2 (pu-e@1, compatible with type 1 only, is superseded) [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'a newly activated version replaces its superseded predecessor in the list [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/030-retirement.sqlinc',
            title:
              'the retired version leaves the list: exactly the previous items without pu-h@4 [AC-108]',
          },
        ],
      },
      {
        text: 'so a draft, non-compatible',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title:
              'the list is the newest ACTIVE version of every lineage compatible with type 1, ordered by patternKey: no superseded pu-a@1, no draft pu-f@2, no pu-e (its newest version is compatible with type 2 only), no other owner [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              "every listed row is an active version of the caller's owner party [AC-108]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'type 2 lists exactly the version that names it: pu-e@2 (pu-e@1, compatible with type 1 only, is superseded) [AC-108]',
          },
        ],
      },
      {
        text: 'or other-owner version is never listed',
        citations: [],
      },
      {
        text: 'no owner or authority field is serialized.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-selector.test.ts',
            title:
              'CMS-03C-13 pattern selector contract [P2-S12-AC-106] accepts the six-member selector item and refuses a hidden or malformed member',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "or other-owner version is never listed": that an OTHER owner\'s pattern version is never listed: every pattern in the pattern_selector fixtures belongs to the caller\'s owner party, so the owner filter has no data-backed assertion',
  },
  {
    criterion: 'P2-S12-AC-109',
    text: 'CMS-03C-13 is a no-store, mutation-free safe read with a signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the query and acting scope, default limit 25 and maximum 50, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-13 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission a request with no defect is accepted, cached nowhere, with the strong ETag",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying an Idempotency-Key is 400',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'the selector read changed no store: no audit, no outbox, no idempotency record [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title: 'paging changed no store [AC-110]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-106] CMS-03C-13 registers GET /api/v1/cms/patterns/selector with its auth, step-up, concurrency, rate and SLO policy',
          },
        ],
      },
      {
        text: 'with a signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the query and acting scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'limit 4 returns four items and a signed cursor of at most 512 characters [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'three pages (4, 4, 2) are exactly the unpaged list in (patternKey, patternVersion) order [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a cursor replayed against another limit, content type or actor, a tampered signature and an expired cursor are 409 CONFLICT: the client restarts [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'without a valid Vault signing key the read fails closed: DEPENDENCY_UNAVAILABLE, never an unsigned page [AC-109]',
          },
        ],
      },
      {
        text: 'default limit 25 and maximum 50',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery applies the default limit of 25 and sends no cursor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a limit above the maximum is 422 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a limit of zero is 422 before any quota or port',
          },
        ],
      },
      {
        text: 'an ETag on the page version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route serves the strict page with the quoted page-version ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'a final page has no cursor and a decimal-string pageVersion equal to the high-water update instant of the compatible versions [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'the pageVersion moved with the activation: it is the strong validator of the list [AC-109]',
          },
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'the three registry rows CMS-03C-13: GET selector, 300/600 per minute, 8,000 ms',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission charges the user bucket then the party bucket of the registry row",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-13' faults a port that never answers is 504 at the 8000 ms registry deadline",
          },
        ],
      },
      {
        text: 'and the Tier 1 p95 < 750 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-13 first selector page at the maximum limit of 50 from 65 active versions: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-13 cursor page of the selector: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern read latency through the real stack [CMS-03C-13] the selector first page at the maximum limit of 50: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-patterns.apispec.ts',
            title:
              'Slice 12 pattern read latency through the real stack [CMS-03C-13] the selector cursor page: p95 under the Tier 1 target of 750 ms [P2-S12-AC-109]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-110',
    text: 'CMS-03C-13 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent content type (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1` with no audit or outbox effect, and a client restarts from the first page after a cursor conflict.',
    clauses: [
      {
        text: 'CMS-03C-13 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent content type (404), an unsupported body if sent (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a malformed query is answered after authentication, never before',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission an unauthenticated session is the typed 401 and nothing else runs",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route publishes the cursor conflict (409) with no member and the hidden content type as 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission no capability is 403 capability_missing with no quota and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route a read carrying a request media type is 415',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a structurally malformed cursor (not base64, not JSON, wrong keys, over 512 characters, not a string) is 400 INVALID_REQUEST [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              'a request without a verified human context is 401 UNAUTHENTICATED [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title:
              'a human with cms.reviewer only is 403 capability_missing [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title: 'an absent content type is 404 [AC-107]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title: 'parsePatternSelectorQuery an unknown key is a bare 400',
          },
        ],
      },
      {
        text: 'a cursor/context mismatch (409), a query-bound failure (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-routes.test.ts',
            title:
              'CMS-03C-13 selector route publishes the cursor conflict (409) with no member and the hidden content type as 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery a canonical limit outside 1-50 (zero) is a 422 naming /limit',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a cursor replayed against another limit, content type or actor, a tampered signature and an expired cursor are 409 CONFLICT: the client restarts [AC-110]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-selector-query.test.ts',
            title:
              'parsePatternSelectorQuery a canonical limit outside 1-50 (51) is a 422 naming /limit',
          },
        ],
      },
      {
        text: 'the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1` with no audit or outbox effect',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-13' admission a denied quota is 429 with the BE00 headers and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-13' faults a port dependency fault of 502 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-13' faults a status outside the catalog is the scrubbed 500",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-13' faults a port dependency fault of 503 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-13' faults a port dependency fault of 504 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'every cursor refusal leaves every captured store identical [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'the selector read changed no store: no audit, no outbox, no idempotency record [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/020-authority.sqlinc',
            title: 'a capability refusal changed no store [AC-110]',
          },
        ],
      },
      {
        text: 'a client restarts from the first page after a cursor conflict.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.selector-restart.test.tsx',
            title:
              'the pattern selector after a cursor conflict drops the cursor, reads the first page again, replaces the list and says so',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-111',
    text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`, which renders `PatternSelectorPage` items for the entry\'s content type (`patternKey`, `patternVersion`, `nodeCount`) as a native list or select with the result count announced politely, shows the empty state "No compatible pattern is active", and keeps the cursor in component state only; verification covers only active compatible versions, keyset order, cursor binding and the empty state.',
    clauses: [
      {
        text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-page-operations-real-route.spec.ts',
            title:
              '[P2-S12-AC-111] lists an active compatible pattern in the instance-insert form of /entries/:entryId/composition and places the pattern chosen there',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: "which renders `PatternSelectorPage` items for the entry's content type (`patternKey`, `patternVersion`, `nodeCount`) as a native list or select with the result count announced politely",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx',
            title:
              'CmsPatternSelector is a native select with a placeholder, nothing preselected, one option per pattern version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx',
            title: 'CmsPatternSelector announces the result count politely',
          },
        ],
      },
      {
        text: 'shows the empty state "No compatible pattern is active"',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx',
            title:
              'CmsPatternSelector states the empty state and disables the control',
          },
        ],
      },
      {
        text: 'keeps the cursor in component state only',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx',
            title:
              'CmsPatternSelector offers Load more only while a cursor remains, and disables it while loading',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the pattern selector loads the next page with the cursor, keeps the listed patterns and adds the new ones once',
          },
        ],
      },
      {
        text: 'verification covers only active compatible versions, keyset order, cursor binding and the empty state.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector.sql',
            title:
              'the list is the newest ACTIVE version of every lineage compatible with type 1, ordered by patternKey: no superseded pu-a@1, no draft pu-f@2, no pu-e (its newest version is compatible with type 2 only), no other owner [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'type 2 lists exactly the version that names it: pu-e@2 (pu-e@1, compatible with type 1 only, is superseded) [AC-108]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'three pages (4, 4, 2) are exactly the unpaged list in (patternKey, patternVersion) order [AC-109]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/010-paging.sqlinc',
            title:
              'a cursor replayed against another limit, content type or actor, a tampered signature and an expired cursor are 409 CONFLICT: the client restarts [AC-110]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_selector/000-selector.sqlinc',
            title:
              'a real content type no pattern is compatible with is an empty page with pageVersion "1", not an error [AC-111]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternSelector.test.tsx',
            title:
              'CmsPatternSelector states the empty state and disables the control',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-112',
    text: "CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` in the `ExpandedPatternNodePath` grammar (the row-path key grammar, 1–72 segments, at most 4680 ASCII characters, DEC-193), `base` (the pinned node value) and `theirs` (the target node value), each the node's `props`, block identity (`blockKey`, `blockVersion`) and `children`, or null for a node absent from that version (DEC-193), `yours` (the local override), a `collision` flag and a `collisionKind` (`removed_root`, `structure`, `props` or null), the instance's `slotPath`, at most 512 `newRoots` (`rootPath`, `blockKey`, `blockVersion`, the `rootPath` an `ExpandedPatternNodePath`), a `collisionCount` 0-128 and `bulkEligible`; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: 'CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-112] CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-112] CMS-03C-14 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-14 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
        ],
      },
      {
        text: "and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` in the `ExpandedPatternNodePath` grammar (the row-path key grammar, 1–72 segments, at most 4680 ASCII characters, DEC-193), `base` (the pinned node value) and `theirs` (the target node value), each the node's `props`, block identity (`blockKey`, `blockVersion`) and `children`, or null for a node absent from that version (DEC-193), `yours` (the local override), a `collision` flag and a `collisionKind` (`removed_root`, `structure`, `props` or null), the instance's `slotPath`, at most 512 `newRoots` (`rootPath`, `blockKey`, `blockVersion`, the `rootPath` an `ExpandedPatternNodePath`), a `collisionCount` 0-128 and `bulkEligible`;",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-112] accepts the instance, the target version, the three-way paths, the collision count and bulk eligibility',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-112] refuses a malformed instance summary and any member beyond the closed set',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] bounds the diff at 128 unique node paths, 256 KiB, and bounded JSON values that are null when absent',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] keeps collisionCount equal to the collision flags and bulkEligible only when nothing collides',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-1] roundtrips the typed node values, slotPath, newRoots and collisionKind',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-2] requires exactly one collisionKind on a collision and null otherwise',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-5] bounds child addresses at 512 within the node cap',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-6] requires slotPath and newRoots and bounds the new-root addresses',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 public address, stored caps and pattern roots [DEC-193][choice-1] accepts a 72-segment 4680-character address and refuses a 73-segment or malformed one',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route serves the strict diff with the quoted instance-version ETag',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'd-hero1: exactly CompositionUpdateDiffResource',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the instance carries exactly id, version, revisionId, path, state, linkMode, pinnedPatternVersion (no owner or authority member)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the new roots are the target block roots the pinned forest lacks',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'd-hero4: collisionCount counts the flagged paths',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the slotPath is the placement slot of the instance (its path less its root key chain)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'd-hero1: bulkEligible is true',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title: 'exactly 128 changed paths are answered in full [AC-113]',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-14 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-14 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-113',
    text: "CMS-03C-14 accepts only a UUID `instanceId` path with no query key (400 otherwise), defines the value of a node path as its `props` plus its block identity and `children` and lists each path the target changed (an added or removed node once, at its own path), defines a listed path as a collision of exactly one kind, the first that applies: `removed_root` when the target removed the instance's own block root, `structure` when the target changed the node's block identity or `children` (with or without an override) and `props` when the local override differs from the base `props` and the target also changed them (DEC-193), lists as `newRoots` the target's block roots whose key chain the pinned forest lacks, bounds each `base`, `theirs` and `yours` value to a schema-typed value that is null when absent, and refuses an instance with more than 128 changed paths or more than 256 KiB as 422 `COMPOSITION_VALIDATION_FAILED` `diff_too_large`.",
    clauses: [
      {
        text: 'CMS-03C-14 accepts only a UUID `instanceId` path with no query key (400 otherwise)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] accepts only a UUID instanceId path and an empty strict query',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a malformed path is answered after authentication, never before',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a malformed instance id is 400 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route any query key is 400 before any quota or port',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'g-bad-id: exact SQL message token INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'g-null-id: exact SQL message token INVALID_REQUEST',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'g-number-id: exact SQL message token INVALID_REQUEST',
          },
        ],
      },
      {
        text: ", defines the value of a node path as its `props` plus its block identity and `children` and lists each path the target changed (an added or removed node once, at its own path), defines a listed path as a collision of exactly one kind, the first that applies: `removed_root` when the target removed the instance's own block root, `structure` when the target changed the node's block identity or `children` (with or without an override) and `props` when the local override differs from the base `props` and the target also changed them (DEC-193), lists as `newRoots` the target's block roots whose key chain the pinned forest lacks,",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-1] roundtrips the typed node values, slotPath, newRoots and collisionKind',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-2] requires exactly one collisionKind on a collision and null otherwise',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-3] refuses a legacy scalar or props-only base/theirs at its member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'highest added/removed subtree is listed once; its descendants are suppressed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'children and props both change with a local override: structure precedes props',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'block-version and props both change with an override: identity is structural',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'removed instance root suppresses its entire descendant subtree; removed_root wins',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'a stored JSON-null override is present, not silently confused with no override',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'newer target with no changed instance paths still offers bulk acceptance and new roots',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero2: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero3: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero4: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-gone: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the new roots are the target block roots the pinned forest lacks',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/010-diff.sqlinc',
            title:
              'the override on /hero/note, which the new version did not change, is retained and not part of the diff [BE03c Linked update]',
          },
        ],
      },
      {
        text: 'bounds each `base`, `theirs` and `yours` value to a schema-typed value that is null when absent',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] bounds the diff at 128 unique node paths, 256 KiB, and bounded JSON values that are null when absent',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-3] refuses a legacy scalar or props-only base/theirs at its member',
          },
        ],
      },
      {
        text: 'refuses an instance with more than 128 changed paths or more than 256 KiB as 422 `COMPOSITION_VALIDATION_FAILED` `diff_too_large`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              '156 changed paths (the root, 5 children and 150 grandchildren) are 422 diff_too_large with the instance pointer, writing nothing [AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              '129 changed paths (v1 against v3: the root joins the 128) are 422 diff_too_large [AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              '120 changed paths whose base and theirs values total more than 256 KiB are 422 diff_too_large [AC-113, AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              'a resource one octet over (262145) is 422 diff_too_large with the instance pointer and writes nothing [AC-115]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route publishes 422 COMPOSITION_VALIDATION_FAILED',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/dec193-contract-migration.test.ts',
            title:
              'DEC-193 typed diff node values and collision kinds [DEC-193][diff-8] preserves the 128-path and 262144-byte diff bounds',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-114',
    text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable (the diff answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` when the instance has no newer `active` compatible pattern version, or when the named row carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path, such as a detached row, a detached copy, a `retired` row, an older version or a historical linked `active`/`pending_diff` row that is no longer newest, and answers `paths: []` with `bulkEligible` true when a newer version changes none of the instance's paths; a row with no pattern pin, a standalone block row, is refused and never answered with a fabricated pin, DEC-193)",
    clauses: [
      {
        text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission a caller holding cms.author may use it",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission a caller holding cms.editor may use it",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission the designer capability alone is 403 capability_missing with no quota and no port call",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/040-authority.sqlinc',
            title:
              'once assigned on the entry, a second author reads the same diff [AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'a-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'a-revoked: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/040-authority.sqlinc',
            title:
              'hidden and absent instances are the same uniform 404 [AC-114]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'a-hidden: exact SQL message token NOT_FOUND',
          },
        ],
      },
      {
        text: '(the diff answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` when the instance has no newer `active` compatible pattern version,',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-114] answers an instance with no newer compatible version as an empty diff at its pinned version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route an instance with no newer version is a 200 with an empty diff, not an error',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-inc: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'd-inc: bulkEligible is false',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-inc: the new roots are the target block roots the pinned forest lacks',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-draft: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-newest: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-incompatible: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-draft-version: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
        ],
      },
      {
        text: 'or when the named row carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path, such as a detached row, a detached copy, a `retired` row, an older version or a historical linked `active`/`pending_diff` row that is no longer newest,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-detached: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-no-df-detached: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-no-df-copy: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-no-df-retired: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-no-df-super: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-no-df-draft: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-old-active: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title:
              'df-old-pending: exact typed values, collision kinds, pin, slot and new-root envelope',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/020-states.sqlinc',
            title:
              'the older (non-head) version row is answered as itself with the empty no-update diff: no live update is offered on history [AC-112]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'positive provenance controls distinguish materialized detached copy from legacy NULL-tree placement',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'both noncurrent active and noncurrent pending rows retain real positive provenance pins',
          },
        ],
      },
      {
        text: "and answers `paths: []` with `bulkEligible` true when a newer version changes none of the instance's paths;",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-cta1: the changed paths, bytewise ordered, with base, theirs, yours, the collision flag and its kind',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title: 'd-cta1: bulkEligible is true',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/010-node-values.sqlinc',
            title:
              'newer target with no changed instance paths still offers bulk acceptance and new roots',
          },
        ],
      },
      {
        text: 'a row with no pattern pin, a standalone block row, is refused and never answered with a fabricated pin, DEC-193)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff.sql',
            title: 'df-no-pin: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'standalone source has no provenance and the refused response invents no positive pin',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-115',
    text: 'CMS-03C-14 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`, carries the strong ETag `"{instance.version}"`, bounds `base`, `theirs` and `yours` to 128 paths and 256 KiB, and enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-14 is a no-store, mutation-free safe read that accepts neither `Idempotency-Key` nor `If-Match`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission a request with no defect is accepted, cached nowhere, with the strong ETag",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a read carrying an Idempotency-Key is 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a read carrying an If-Match is 400',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the read changed no store (no audit, no outbox, no idempotency record, no row)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/020-states.sqlinc',
            title: 'the history read changed no store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'every success/refusal preserves full stores and executes/restores the actual requested SQL role',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-112] CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff with its auth, step-up, concurrency, rate and SLO policy',
          },
        ],
      },
      {
        text: 'carries the strong ETag `"{instance.version}"`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route serves the strict diff with the quoted instance-version ETag',
          },
        ],
      },
      {
        text: 'bounds `base`, `theirs` and `yours` to 128 paths and 256 KiB',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] bounds the diff at 128 unique node paths, 256 KiB, and bounded JSON values that are null when absent',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title: 'exactly 128 changed paths are answered in full [AC-113]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              'a resource of exactly 262144 octets is answered (the bound is "over 256 KiB") [AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title:
              'a resource one octet over (262145) is 422 diff_too_large with the instance pointer and writes nothing [AC-115]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc',
            title: 'an answered diff never exceeds 256 KiB [AC-115]',
          },
        ],
      },
      {
        text: 'enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'operation table of CMS-03C-14 matches its registry row rate class, user and party ceilings and a 60-second window',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'operation table of CMS-03C-14 matches its registry row deadline, method and the write/read class',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission charges the user bucket then the party bucket of the registry row",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-14' faults a port that never answers is 504 at the 8000 ms registry deadline",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'the three registry rows CMS-03C-14: GET update-diff, 300/600 per minute, 8,000 ms',
          },
        ],
      },
      {
        text: 'and the Tier 1 p95 < 750 ms target',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-14 update diff at the bound of 128 changed paths: p95 under the Tier 1 target of 750 ms [P2-S12-AC-115]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-compose.apispec.ts',
            title:
              'Slice 12 linked-update latency through the real stack [CMS-03C-14] the update diff at the bound of 128 changed paths: p95 under the Tier 1 target of 750 ms [P2-S12-AC-115]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-116',
    text: 'CMS-03C-14 maps a malformed path or query (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), an unsupported body if sent (415), `diff_too_large` (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, never overwrites an instance, and leaves an unanswered update on its pinned version.',
    clauses: [
      {
        text: 'CMS-03C-14 maps a malformed path or query (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), an unsupported body if sent (415), `diff_too_large` (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a malformed path is answered after authentication, never before',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission an unauthenticated session is the typed 401 and nothing else runs",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a malformed instance id is 400 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route any query key is 400 before any quota or port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route publishes 404 COMPOSITION_NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route publishes 403 COMPOSITION_FORBIDDEN',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route publishes 422 COMPOSITION_VALIDATION_FAILED',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-diff-routes.test.ts',
            title:
              'CMS-03C-14 update-diff route a read carrying a request media type is 415',
          },
        ],
      },
      {
        text: 'the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-14' admission a denied quota is 429 with the BE00 headers and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-14' faults a port dependency fault of 503 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-14' faults a status outside the catalog is the scrubbed 500",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-14' faults a port dependency fault of 502 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-14' faults a port dependency fault of 504 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
        ],
      },
      {
        text: 'never overwrites an instance',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'd-hero1: the read changed no store (no audit, no outbox, no idempotency record, no row)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff/020-states.sqlinc',
            title: 'the history read changed no store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'every success/refusal preserves full stores and executes/restores the actual requested SQL role',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_update_diff.sql',
            title:
              'a-no-edit: the refusal preserves every captured full row of every store',
          },
        ],
      },
      {
        text: 'leaves an unanswered update on its pinned version.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'latest read uses active v3 while the unanswered instance remains pinned to v1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_diff/020-diff.sqlinc',
            title:
              'both noncurrent active and noncurrent pending rows retain real positive provenance pins',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-117',
    text: 'CMS-03C-14 is consumed by the protected `CmsPatternUpdateDiff` on the composition page, which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked by kind and a radio pair per collision that is never preselected (`props`: keep my override or take the new value; `structure` and `removed_root`: keep mine, named as making the block a local copy that stops receiving updates, or take the new structure or remove the block, DEC-193), lists the `newRoots` as new in this version with a _Place_ command through CMS-03C-02 `roots` and states that accepting never adds them, shows the `no-update` state when the instance has no newer compatible version, shows the typed `diff_too_large` refusal, never keeps a diff when degraded but requires it again, and states that an unanswered update leaves the instance on its pinned version; every explicit choice of one instance applies at once, so one block may resolve to a mix of taken and kept paths, keeping mine on a `structure` or `removed_root` collision materializes the resolved tree rather than an unchanged copy, and an inconsistent complete answer set is refused atomically 422 `COMPOSITION_VALIDATION_FAILED` with nothing applied and the choices kept; verification covers the collision marking and kinds, the new-root list and its placement request, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.',
    clauses: [
      {
        text: 'CMS-03C-14 is consumed by the protected `CmsPatternUpdateDiff` on the composition page',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected shows pending_diff as Update available and reads the diff of exactly that instance',
          },
        ],
      },
      {
        text: ', which renders `base`, `theirs` and `yours` per path as a three-way list with colliding paths marked by kind and a radio pair per collision that is never preselected (`props`: keep my override or take the new value; `structure` and `removed_root`: keep mine, named as making the block a local copy that stops receiving updates, or take the new structure or remove the block, DEC-193), lists the `newRoots` as new in this version with a _Place_ command through CMS-03C-02 `roots` and states that accepting never adds them,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: the three-way list lists base, theirs and yours per path, each node value as its block, props and sub-blocks',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: collisions and choices marks each collision by kind with its fixed legend and shows a plain change without choices',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: collisions and choices never preselects: two radios per collision, none checked',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: collisions and choices names the consequence of keeping mine before the command',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: new in this version lists the new roots with a polite count and says accepting never adds them',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: new in this version places only the chosen roots through the Place command',
          },
        ],
      },
      {
        text: 'shows the `no-update` state when the instance has no newer compatible version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: other diff states shows the no-update state when the instance has no newer compatible version',
          },
        ],
      },
      {
        text: 'shows the typed `diff_too_large` refusal',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected names the typed diff_too_large refusal and offers no accept',
          },
        ],
      },
      {
        text: 'never keeps a diff when degraded',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.degraded-diff.test.tsx',
            title:
              'a diff whose later read is degraded drops the held diff when the re-read after a conflict is unavailable, and reads it again on the next open',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.degraded-diff.test.tsx',
            title:
              'a diff whose later read is degraded drops the held diff when the re-read after a conflict is unverifiable, and reads it again on the next open',
          },
        ],
      },
      {
        text: 'but requires it again',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected reads the diff again on every open: it is never cached',
          },
        ],
      },
      {
        text: 'states that an unanswered update leaves the instance on its pinned version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: Accept and the first unanswered collision states that an unanswered update leaves the instance on its pinned version and accepts nothing automatically',
          },
        ],
      },
      {
        text: 'every explicit choice of one instance applies at once, so one block may resolve to a mix of taken and kept paths,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: the exact request and the named outcome sends the target version, the instance version, one choice per collision and the entry version, then names the new pin',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-01 ancestor structure yours / descendant props theirs: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-03 ancestor theirs / descendant yours: exact independent disposition/tree/overrides',
          },
        ],
      },
      {
        text: 'keeping mine on a `structure` or `removed_root` collision materializes the resolved tree rather than an unchanged copy,',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-05 highest removed-root yours carries every suppressed L descendant: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-01 ancestor structure yours / descendant props theirs: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution/020-accept-results.sqlinc',
            title:
              'RESOLVE-API-01: ancestor yours is not permission to copy the unchanged L tree',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution/020-accept-results.sqlinc',
            title:
              'RESOLVE-API-02: actual persisted topology and effective props are order-independent',
          },
        ],
      },
      {
        text: 'and an inconsistent complete answer set is refused atomically 422 `COMPOSITION_VALIDATION_FAILED` with nothing applied and the choices kept;',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-25 parent excludes explicit present child: exact refusal, not incidental SQL failure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-26 parent requires explicit absent child: exact refusal, not incidental SQL failure',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-one: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title: 'rs-api-inconsistent-one: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-one: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'rs-api-inconsistent-two: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: refusals keep the author choices on a 422 keeps the choices, says nothing was applied and does not refetch',
          },
        ],
      },
      {
        text: 'verification covers the collision marking and kinds, the new-root list and its placement request, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: collisions and choices marks each collision by kind with its fixed legend and shows a plain change without choices',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: new in this version places only the chosen roots through the Place command',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'detach and Place places a chosen new root through CMS-03C-02 with the instance revision, pattern and link mode',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected names the typed diff_too_large refusal and offers no accept',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update-diff.test.ts',
            title:
              'CMS-03C-14 update diff contract [P2-S12-AC-113] bounds the diff at 128 unique node paths, 256 KiB, and bounded JSON values that are null when absent',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: other diff states shows "No changes to this block" with a plain accept when a newer version changes none of the paths',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk.test.tsx',
            title:
              'bulk accept refuses bulk acceptance when any selected instance collides and names it',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: Accept and the first unanswered collision does not send while a collision is unanswered: it names the count and focuses the first one',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-118',
    text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`) and returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-118] discriminates accept (with a target version) and detach, each with 1 to 32 instances',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] bounds choices at 128 and each choice to a node path and yours or theirs',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] bounds the instances at 1 to 32 with a bulk request carrying no choices',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] refuses an unknown action, a target version outside int32 and a member the action does not name',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-118] documents the update body as a closed accept or detach choice of 1 to 32 instances',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-118] CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with its auth, step-up, concurrency, rate and SLO policy',
          },
        ],
      },
      {
        text: 'returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CompositionUpdateResource (CMS-03C-15 200) [P2-S12-AC-118] answers 1 to 32 closed composition instance items',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route accepts: 200 { items } with the committed entry ETag and the exact precondition at the port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-answers.test.ts',
            title:
              'validUpdateResource (CMS-03C-15) refuses a list that is not one row per requested instance',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-ap1: the 200 body is exactly { items } (the entry version travels in the ETag)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1: one appended row per listed instance',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-15 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-15 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-15 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-pattern-openapi.test.ts',
            title:
              'Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15) [P2-S12-AC-118] CMS-03C-15 generates the documented parameters, request body, success statuses and error matrix',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-119',
    text: 'CMS-03C-15 accepts only `accept` or `detach`, 1-32 unique instances each with its own `expectedVersion`, a `targetPatternVersion` that is the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`), `choices` only for a single-instance request and covering every colliding path (`props`, `structure` and `removed_root`, DEC-193) with `yours` or `theirs` (a missing choice is 422), and refuses a bulk request containing a colliding instance as 409 `diff_has_collisions`; the strong `If-Match` equals the entry `expectedVersion` exactly.',
    clauses: [
      {
        text: 'CMS-03C-15 accepts only `accept` or `detach`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] refuses an unknown action, a target version outside int32 and a member the action does not name',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route an action outside the enum is 422 naming { action: 'merge', targetPatternVersion: 2, instances: [ { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: '3', choices: [] } ], expectedVersion: '7' }, before any quota or port",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route a missing action is 422 naming { instances: [ { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: '3', choices: [] } ], expectedVersion: '7' }, before any quota or port",
          },
        ],
      },
      {
        text: '1-32 unique instances each with its own `expectedVersion`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] bounds the instances at 1 to 32 with a bulk request carrying no choices',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] refuses a repeated instance and a repeated choice path',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route no instances is 422 naming { action: 'accept', targetPatternVersion: 2, instances: [], expectedVersion: '7' }, before any quota or port",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route a repeated instance is 422 naming { action: 'accept', targetPatternVersion: 2, instances: [ { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: '3', choices: [] }, { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: '3', choices: [] } ], expectedVersion: '7' }, before any quota or port",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route a non-numeric instance version is 422 naming { action: 'accept', targetPatternVersion: 2, instances: [ { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: 'x' } ], expectedVersion: '7' }, before any quota or port",
          },
        ],
      },
      {
        text: 'a `targetPatternVersion` that is the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-not-latest: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-not-above: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-superseded: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-incompatible: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-draft: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-newest-equal: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-unknown-version: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 't-not-latest: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 422 pattern_version_not_active with exactly its reasonCode',
          },
        ],
      },
      {
        text: ', `choices` only for a single-instance request and covering every colliding path (`props`, `structure` and `removed_root`, DEC-193) with `yours` or `theirs` (a missing choice is 422), and',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              "CMS-03C-15 pattern-update route choices on a bulk request is 422 naming { action: 'accept', targetPatternVersion: 2, instances: [ { instanceId: 'c0000000-0000-4000-8000-000000000100', expectedVersion: '3', choices: [ { path: '/a', choice: 'yours' } ] }, { instanceId: 'c0000000-0000-4000-8000-000000000101', expectedVersion: '3', choices: [] } ], expectedVersion: '7' }, before any quota or port",
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-119] bounds the instances at 1 to 32 with a bulk request carrying no choices',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-missing: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-missing: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-partial: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-not-colliding: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-not-in-diff: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-rm1-gone-nochoice: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title: 'rs-api-missing: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap3 [/hero]: the stored props',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap5 [/hero]: the stored props',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-05 highest removed-root yours carries every suppressed L descendant: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-06 removed-root theirs is explicit retirement: exact independent disposition/tree/overrides',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title:
              'RESOLVE-01 ancestor structure yours / descendant props theirs: exact independent disposition/tree/overrides',
          },
        ],
      },
      {
        text: 'refuses a bulk request containing a colliding instance as 409 `diff_has_collisions`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-bulk-1: exact SQL message token diff_has_collisions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-bulk-2: exact SQL message token diff_has_collisions',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'c-bulk-1: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 409 diff_has_collisions with exactly its reasonCode',
          },
        ],
      },
      {
        text: 'the strong `If-Match` equals the entry `expectedVersion` exactly.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-121] requires a key and the strong If-Match equal to the entry expectedVersion',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a missing If-Match header is 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a weak If-Match is 400 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route an If-Match for another entry version is 400 and starts nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-120',
    text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision: a hidden or absent instance is 404, a visible instance without edit is 403, an instance must be the newest version of its path and `pending_diff` or an `active` linked instance for `accept` and any linked pattern-origin row, including a `retired` one, for `detach` (any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`, DEC-193), and the entry and instance versions must be current.",
    clauses: [
      {
        text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission a caller holding cms.author may use it",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission a caller holding cms.editor may use it",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission the designer capability alone is 403 capability_missing with no quota and no port call",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/060-effects.sqlinc',
            title:
              'an author assigned on the entry answers the update and is recorded as the creator of the appended row',
          },
        ],
      },
      {
        text: 'a hidden or absent instance is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-hidden-owner: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-absent: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-one-absent: exact SQL message token NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/040-refusals.sqlinc',
            title:
              'a hidden instance, an absent one and one absent among visible ones are the same uniform 404: nothing says which instance was concealed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title: 'CMS-03C-15 refusal mapping NOT_FOUND is 404',
          },
        ],
      },
      {
        text: 'a visible instance without edit is 403',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-no-edit: exact SQL message token capability_missing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 403 capability_missing with exactly its reasonCode',
          },
        ],
      },
      {
        text: ', an instance must be the newest version of its path and `pending_diff` or an `active` linked instance for `accept` and any linked pattern-origin row, including a `retired` one, for `detach` (any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`, DEC-193), and',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-instance-old-row: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-old-row: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-instance-old-row-detach: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'e-dr2-accept: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'e-detached-again: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'e-sp1-accept: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'e-dr1-detach [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'e-sp1-detach [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-retired [/gone]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-ap17 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a refusal the producer pointed at the request is relayed as pointer-shaped violations',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-15 specifics a malformed envelope, action or id is a 422 at the producer pointer',
          },
        ],
      },
      {
        text: 'the entry and instance versions must be current.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-entry-stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-entry-stale: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-stale: exact DETAIL pointer or members',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a stale entry or instance version is the plain conflict with the version pair only',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-121',
    text: "CMS-03C-15 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version`, applies CAS on each instance's own `version`, is all-or-nothing for 1-32 instances, enforces rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2, and appends a row for every adopted or detached instance.",
    clauses: [
      {
        text: 'CMS-03C-15 requires an `Idempotency-Key` and the strong `If-Match` equal to the entry aggregate `version`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/pattern-update.test.ts',
            title:
              'CMS-03C-15 pattern update request [P2-S12-AC-121] requires a key and the strong If-Match equal to the entry expectedVersion',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a missing Idempotency-Key is 400 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a short Idempotency-Key is 400 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a missing If-Match header is 400',
          },
        ],
      },
      {
        text: "applies CAS on each instance's own `version`",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-stale: exact DETAIL pointer or members',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the same 32 instances with current operands are accepted together: 32 rows appended in one request',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a stale entry or instance version is the plain conflict with the version pair only',
          },
        ],
      },
      {
        text: 'is all-or-nothing for 1-32 instances',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the refused bulk request wrote neither row: /hero is still unanswered on its pinned version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the refused 32-instance request appended nothing: all 39 rows of the second placement are still version 1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the same 32 instances with current operands are accepted together: 32 rows appended in one request',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              '33 instances are refused: the bound is per request, not per placement',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'c-bulk-1: the refusal preserves every captured full row of every store',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline,',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-registry.test.ts',
            title:
              'the three registry rows CMS-03C-15: POST pattern-updates, CSRF, key and If-Match, 60/120 per minute, 15,000 ms',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission charges the user bucket then the party bucket of the registry row",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a port that never answers is 504 at the 15000 ms registry deadline",
          },
        ],
      },
      {
        text: 'no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route accepts: 200 { items } with the committed entry ETag and the exact precondition at the port',
          },
        ],
      },
      {
        text: 'and Tier 2',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-15 accept of 32 instances in one request over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-121]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_patterns/050-assert.sqlinc',
            title:
              'CMS-03C-15 detach of 32 instances in one request over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-121]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-compose.apispec.ts',
            title:
              'Slice 12 linked-update latency through the real stack [CMS-03C-15] accepting 32 instances in one request: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-121]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-compose.apispec.ts',
            title:
              'Slice 12 linked-update latency through the real stack [CMS-03C-15] detaching 32 instances in one request: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-121]',
          },
        ],
      },
      {
        text: 'appends a row for every adopted or detached instance.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1: one appended row per listed instance',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1 [/hero]: the next version of the path is appended',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1: exactly 1 composition rows were appended',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'd-ap7: one appended row per listed instance',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'd-ap7 [/hero]: the next version of the path is appended',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'd-ap7: every pre-existing composition row is byte-identical afterwards (append-only, nothing renumbered)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'after the second request all 39 paths have a head pinned to version 2',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-122',
    text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions` and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure or an instance in no admitted state (422 `COMPOSITION_VALIDATION_FAILED`, DEC-193), maps malformed IDs, header or body (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), a non-JSON body (415), the composition limit (429), a registry or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and overwrites nothing on any refusal.',
    clauses: [
      {
        text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-entry-stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-instance-stale: exact SQL message token VERSION_MISMATCH',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-bulk-1: exact SQL message token diff_has_collisions',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a stale entry or instance version is the plain conflict with the version pair only',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 409 diff_has_collisions with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-15 specifics a stale entry or instance version is a 409 with the version pair only',
          },
        ],
      },
      {
        text: 'and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'i-mismatch: exact SQL message token IDEMPOTENCY_MISMATCH',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-pattern-update-failure.test.ts',
            title:
              'CMS-03C-15 specifics IDEMPOTENCY_MISMATCH (a lock timeout or deadlock, a reused key) is a 409 with no member',
          },
        ],
      },
      {
        text: ', and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure or an instance in no admitted state (422 `COMPOSITION_VALIDATION_FAILED`, DEC-193),',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-not-latest: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-not-above: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-superseded: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-incompatible: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-draft: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-unknown-version: exact SQL message token pattern_version_not_active',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 422 pattern_version_not_active with exactly its reasonCode',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-missing: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-not-colliding: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'r-two-entries: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'request case choice-bad-value',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'request case instance-bad-id',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'request case instances-33',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'e-dr2-accept: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-instance-old-row: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals a refusal the producer pointed at the request is relayed as pointer-shaped violations',
          },
        ],
      },
      {
        text: 'maps malformed IDs, header or body (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), a non-JSON body (415), the composition limit (429), a registry or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission an unauthenticated session is the typed 401 and nothing else runs",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-admission.test.ts',
            title:
              "'CMS-03C-15' admission a denied quota is 429 with the BE00 headers and no port call",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a status outside the catalog is the scrubbed 500",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route a media type other than JSON is 415 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route text that is not JSON is 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-routes.test.ts',
            title:
              'CMS-03C-15 pattern-update route any query key is 400 and starts nothing',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-refusals.test.ts',
            title:
              'CMS-03C-15 pattern-update refusals publishes 403 capability_missing with exactly its reasonCode',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a port refusal is mapped to the composition catalog with no private member",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a port dependency fault of 502 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a port dependency fault of 503 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/pattern-update-faults.test.ts',
            title:
              "'CMS-03C-15' faults a port dependency fault of 504 is DEPENDENCY_UNAVAILABLE, retryable, with Retry-After",
          },
        ],
      },
      {
        text: 'overwrites nothing on any refusal.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-entry-stale: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-hidden-owner: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              't-not-latest: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'c-bulk-1: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'c-missing: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'r-submitted: the refusal preserves every captured full row of every store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/030-envelope.sqlinc',
            title:
              'every malformed request left every captured store identical: no idempotency record, no row, no audit',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the refused bulk request wrote neither row: /hero is still unanswered on its pinned version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the refused 32-instance request appended nothing: all 39 rows of the second placement are still version 1',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-123',
    text: "CMS-03C-15 is consumed by the protected `CmsCompositionInstanceList` and `CmsPatternUpdateDiff`, whose _Accept_ (single, or bulk of up to 32 when no instance collides) and _Detach_ commands carry the entry `version` and each instance's `version`, show an instance in state `pending_diff` as \"Update available\" beside its pinned version, refetch and keep the author's choices on `diff_has_collisions` and `revision_not_editable`, never accept an update automatically, and name each accepted instance's outcome (the new pin, a removal or a local copy, DEC-193); verification covers theirs-only adoption, retained overrides, mandatory choices for collisions of each kind, a removed block kept as a local copy or removed, bulk all-or-nothing, detach and the focus on the first unanswered collision.",
    clauses: [
      {
        text: 'CMS-03C-15 is consumed by the protected `CmsCompositionInstanceList` and `CmsPatternUpdateDiff`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx',
            title:
              'CmsCompositionInstanceList: rows offers Review update only on a linked pending_diff row, and Detach on linked rows only',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: Accept and the first unanswered collision sends once every collision has an answer',
          },
        ],
      },
      {
        text: "whose _Accept_ (single, or bulk of up to 32 when no instance collides) and _Detach_ commands carry the entry `version` and each instance's `version`",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-update-request.test.ts',
            title:
              'acceptRequest: one instance with its choices carries the target version, the instance version, one choice per collision and the entry version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-update-request.test.ts',
            title:
              'planBulkAccept: only when no instance collides splits a selection above 32 into successive requests of at most 32 (DEC-181)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-update-request.test.ts',
            title:
              'detachRequests: successive requests of at most 32, no choices detaches one instance with the entry version and its own version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: the exact request and the named outcome sends the target version, the instance version, one choice per collision and the entry version, then names the new pin',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.bulk.test.tsx',
            title:
              'bulk accept sends 70 clean instances as successive requests of 32, 32 and 6, reading the entry version between them',
          },
        ],
      },
      {
        text: 'show an instance in state `pending_diff` as "Update available" beside its pinned version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionInstanceList.test.tsx',
            title:
              'CmsCompositionInstanceList: rows lists the rows with state and pinned version in words',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'review: the diff is read fresh and nothing is preselected shows pending_diff as Update available and reads the diff of exactly that instance',
          },
        ],
      },
      {
        text: "refetch and keep the author's choices on `diff_has_collisions` and `revision_not_editable`",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: refusals keep the author choices on diff_has_collisions refetches the entry version and the diff and keeps choices for unchanged paths',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: refusals keep the author choices on revision_not_editable keeps every choice and the refreshed facts',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-commands.update.test.ts',
            title:
              'submitUpdate: an accept or detach answered by this request keeps the typed 409 reasons that preserve the author choices',
          },
        ],
      },
      {
        text: 'never accept an update automatically',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-update-request.test.ts',
            title:
              'acceptRequest: one instance with its choices refuses to build while a collision is unanswered (no automatic acceptance)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: the exact request and the named outcome does not send while a collision is unanswered and focuses the first one',
          },
        ],
      },
      {
        text: ", and name each accepted instance's outcome (the new pin, a removal or a local copy, DEC-193);",
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/composition-commands.update.test.ts',
            title:
              'submitUpdate: an accept or detach answered by this request names each outcome: the new pin, a removal, or a local copy (DEC-193)',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'detach and Place detaches a row from the list with its own version and names the local copy',
          },
        ],
      },
      {
        text: 'verification covers theirs-only adoption, retained overrides, mandatory choices for collisions of each kind, a removed block kept as a local copy or removed, bulk all-or-nothing, detach and the focus on the first unanswered collision.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap1 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap3 [/hero]: the stored props',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-ap15 [/cta]: the stored props',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-rm1-gone-nochoice: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'c-missing: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_dec193_resolution.sql',
            title: 'rs-api-missing: exact SQL message token VALIDATION_FAILED',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title:
              'u-rm1-gone [/gone]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'u-rm4 [/gone]: state, link mode and pinned pattern version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the refused 32-instance request appended nothing: all 39 rows of the second placement are still version 1',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates/050-bulk.sqlinc',
            title:
              'the same 32 instances with current operands are accepted together: 32 rows appended in one request',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_pattern_updates.sql',
            title: 'd-ap7 [/hero]: state, link mode and pinned pattern version',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsPatternUpdateDiff.test.tsx',
            title:
              'CmsPatternUpdateDiff: Accept and the first unanswered collision does not send while a collision is unanswered: it names the count and focuses the first one',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.update.test.tsx',
            title:
              'accept: the exact request and the named outcome does not send while a collision is unanswered and focuses the first one',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-124',
    text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null) and returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-124] accepts the exact draft request for a first version and for a successor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] bounds the vocabulary key to ^[a-z][a-z0-9-]{1,63}$ and reserves none',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] closes the shape to flat or hierarchical',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] bounds the allowlists at 1 to 64 unique keys of the type and field key grammar',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] accepts 0 to 6 unique members of the six canonical domains',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-127] takes expectedVersion as null or a positive decimal and refuses any ownership or computed member',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] documents the taxonomy version body with bounded allowlists and the six canonical domains',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'maximum: ordinary authorized create succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'minimum: ordinary authorized create succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'domain-role: ordinary authorized create succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'allowedTypeKeys-duplicate: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'allowedTypeKeys-duplicate: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'allowedFieldKeys-65: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'allowedFieldKeys-65: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'allowedTypeKeys-empty: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'allowedTypeKeys-empty: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'domains-seventh: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'domains-seventh: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'domains-unknown: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'domains-unknown: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'shape-unknown: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'shape-unknown: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'key-upper: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'key-upper: correctly refused call preserves every full snapshot row',
          },
        ],
      },
      {
        text: 'returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-124] accepts the closed draft resource with its allowlists and declared domains',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-124] shows exactly the eight definition states and a positive taxonomy version',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary creates a first draft with unbuilt declared domain and stale MFA allowed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'flat-first: creation cannot activate',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'flat-first: exact public resource; no owner, authority or lifecycle counter',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'flat-first: decimal-string definition version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'flat-first: numeric vocabulary version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'flat-first: first row owns stable lineage',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'flat-first: shape, key and all declared allowlists round trip',
          },
        ],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the platform registry row equals the fixture on auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity.test.ts',
            title:
              '[P2-S12-AC-275] CMS-03C-16 [P2-S12-AC-275] the fixture matches the BE03c Route Registry row on method, path, request, success, rate, timeout, tier, CSRF, CORS, step-up, idempotency, If-Match and ETag',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] is generated at its BE03c method and path with its operation id',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI CMS-03C-16 [P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-hono.test.ts',
            title:
              '[P2-S12-AC-275] Hono CMS-03C-16 [P2-S12-AC-275] mounts its method and path, and a CORS preflight route at the same path',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 generates the documented parameters, request body, success statuses and error matrix',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-125',
    text: "CMS-03C-16 accepts a `taxonomyKey` of `^[a-z][a-z0-9-]{1,63}$`, a `shape` of `flat` or `hierarchical`, 1-64 unique type keys and 1-64 unique field keys that each match `^[a-z][a-z0-9_]{1,63}$`, 0-6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` as `canonicalOverlapDomains`, a never-reused (owner, key, version) triple, and `expectedVersion` null for a first version or the parent's `version` for a successor; a declared domain with no registered provider is accepted at create.",
    clauses: [
      {
        text: 'CMS-03C-16 accepts a `taxonomyKey` of `^[a-z][a-z0-9-]{1,63}$`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] bounds the vocabulary key to ^[a-z][a-z0-9-]{1,63}$ and reserves none',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/key-grammar.test.ts',
            title:
              'BE03c key grammar (E13, E14, lineage ids) [P2-S12-AC-125] bounds the taxonomy key grammar and reserves nothing',
          },
        ],
      },
      {
        text: 'a `shape` of `flat` or `hierarchical`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] closes the shape to flat or hierarchical',
          },
        ],
      },
      {
        text: '1-64 unique type keys and 1-64 unique field keys that each match `^[a-z][a-z0-9_]{1,63}$`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] bounds the allowlists at 1 to 64 unique keys of the type and field key grammar',
          },
        ],
      },
      {
        text: '0-6 unique members of `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` as `canonicalOverlapDomains`',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-125] accepts 0 to 6 unique members of the six canonical domains',
          },
        ],
      },
      {
        text: 'a never-reused (owner, key, version) triple',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'E14: (owner_id, taxonomy_key, version) is unique',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'a version row is never deleted',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'owner/key lineage has exactly one immutable row for each allocated version',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'same-owner-duplicate: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/030-create.sqlinc',
            title: 'per-owner key yields distinct lineages',
          },
        ],
      },
      {
        text: "`expectedVersion` null for a first version or the parent's `version` for a successor",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-127] takes expectedVersion as null or a positive decimal and refuses any ownership or computed member',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary passes an unquoted exact successor operand and accepts definition version 8',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'matching immutable parent operand creates successor after review transition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title: 'successor records exact parent provenance',
          },
        ],
      },
      {
        text: 'a declared domain with no registered provider is accepted at create.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary creates a first draft with unbuilt declared domain and stale MFA allowed',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/090-registry-read.sqlinc',
            title:
              'registry read: a registered but unbuilt domain is accepted at creation (DEC-135, control)',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-126',
    text: "CMS-03C-16 derives session and acting context server-side and serves only a verified human holding `cms.taxonomy_curator` in the caller's owner scope: a hidden owner or taxonomy is 404, a readable taxonomy without the capability is 403, no step-up is required, and the response carries no owner, capability or authority identifier.",
    clauses: [
      {
        text: 'CMS-03C-16 derives session and acting context server-side',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary uses named create RPC, server context and unbuilt declaration with no MFA',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary strictly rejects caller authority and query keys',
          },
        ],
      },
      {
        text: "serves only a verified human holding `cms.taxonomy_curator` in the caller's owner scope",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'flat-first: ordinary authorized create succeeds',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'readable-not-curator: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'revoked-fresh: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'expired-fresh: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'anonymous: exact refusal message',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects malformed identity before parsing malformed JSON',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              'taxonomy definition production-composed Worker admission CMS-03C-16: first version, JSON null and no If-Match reaches typed 401, not generic 404',
          },
        ],
      },
      {
        text: 'a hidden owner or taxonomy',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'hidden-existing: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'other-owner-parent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/050-authority.sqlinc',
            title:
              'hidden existing and unused taxonomy expose the same complete refusal',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts',
            title:
              "taxonomy 'definition write': provider 4xx without a product token keeps a structured product token answer",
          },
        ],
      },
      {
        text: 'is 404',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a hidden or absent taxonomy scope (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a successor over an absent lineage (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND',
          },
        ],
      },
      {
        text: 'a readable taxonomy without the capability is 403',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'readable-not-curator: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'member-fresh-create: exact refusal message',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              "taxonomy definition write isolated boundary denies absent curator before quotas and mutation (caller holds 'no capability')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              "taxonomy definition write isolated boundary denies absent curator before quotas and mutation (caller holds 'only cms.author')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary scrubs a valid capability token and answers a create canonical-source refusal as a foreign reason (500)',
          },
        ],
      },
      {
        text: 'no step-up is required',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary creates a first draft with unbuilt declared domain and stale MFA allowed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              'taxonomy provider status and refreshed authority create uses actual provider stale proof with step-up NONE',
          },
        ],
      },
      {
        text: 'the response carries no owner, capability or authority identifier.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'TaxonomyVersionResource and cmsTaxonomyVersionsRead [P2-S12-AC-124] accepts the closed draft resource with its allowlists and declared domains',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'flat-first: exact public resource; no owner, authority or lifecycle counter',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary refuses malformed or request-unbound draft {"ownerId":"private"}',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-127',
    text: "CMS-03C-16 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique (key, version) and CAS, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event (activation is CMS-03C-09).",
    clauses: [
      {
        text: 'CMS-03C-16 requires an `Idempotency-Key`',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'missing-idempotencyKey: exact refusal message',
          },
        ],
      },
      {
        text: "takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage",
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-version.test.ts',
            title:
              'CMS-03C-16 taxonomy version request (D10, OD-1, DEC-135) [P2-S12-AC-127] ties If-Match to expectedVersion: absent on a first version, equal on a successor',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/conditional-if-match.test.ts',
            title:
              'conditional If-Match (CMS-03C-12 and CMS-03C-16 lineage create) [P2-S12-AC-103] accepts no If-Match on a first version and an equal one on a successor',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary quotes the successor HTTP header but sends a decoded RPC operand',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects successor If-Match W/"7"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects successor If-Match *',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects successor If-Match "6"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects successor If-Match null',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/060-review-successor.sqlinc',
            title:
              'matching immutable parent operand creates successor after review transition',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'edit-mismatch: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'create-if-match: exact refusal message',
          },
        ],
      },
      {
        text: 'enforces the per-owner unique (key, version) and CAS',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/080-schema-guards.sqlinc',
            title: 'E14: (owner_id, taxonomy_key, version) is unique',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'same-owner-duplicate: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition/030-create.sqlinc',
            title: 'per-owner key yields distinct lineages',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'lifecycle-not-parent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'stale-parent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'absent-parent: exact refusal message',
          },
        ],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-124] CMS-03C-16 generates the documented parameters, request body, success statuses and error matrix',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary creates a first draft with unbuilt declared domain and stale MFA allowed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'transport table of CMS-03C-16 matches its registry row deadline, method and the write/read class',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary aborts a nonsettling transport without retrying the mutation',
          },
        ],
      },
      {
        text: 'Tier 2',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/040-assert.sqlinc',
            title:
              'CMS-03C-16 save with 64 type keys, 64 field keys and 6 domains over 24 real calls: every call succeeded and the RPC p95 is under the Tier 2 target of 1,200 ms [P2-S12-AC-127]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [CMS-03C-16] saving a version with 64 type keys, 64 field keys and 6 domains: p95 under the Tier 2 target of 1,200 ms [P2-S12-AC-127]',
          },
        ],
      },
      {
        text: 'emits no event (activation is CMS-03C-09).',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'flat-first: terms, reviews, dependencies, registry and outbox wholly untouched',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-128',
    text: 'CMS-03C-16 maps malformed IDs, header or body (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`), a hidden or absent taxonomy scope (404), a stale parent, key or version or an idempotency conflict (409 `TAXONOMY_VERSION_CONFLICT`), a non-JSON body (415), a key, allowlist or domain schema failure (422 `TAXONOMY_VALIDATION_FAILED`), the taxonomy-write limit (429), a canonical registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`, with no vocabulary row after a refusal.',
    clauses: [
      {
        text: 'CMS-03C-16 maps malformed IDs, header or body (400), a missing session (401), a missing curator capability (403 `TAXONOMY_FORBIDDEN`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              'taxonomy definition production-composed Worker admission CMS-03C-16: first version, JSON null and no If-Match reaches typed 401, not generic 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves exact taxonomy catalog RPC code TAXONOMY_FORBIDDEN without prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects malformed identity before parsing malformed JSON',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary rejects successor If-Match W/"7"',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary refuses preflight content-length before auth',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              "taxonomy definition write isolated boundary denies absent curator before quotas and mutation (caller holds 'no capability')",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary bounds valid JSON request bytes at 262145',
          },
        ],
      },
      {
        text: 'a hidden or absent taxonomy scope (404)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a hidden or absent taxonomy scope (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-126] [P2-S12-AC-128] CMS-03C-16 a successor over an absent lineage (P0001 NOT_FOUND) is 404 TAXONOMY_NOT_FOUND',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'hidden-unused: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'absent-parent: exact refusal message',
          },
        ],
      },
      {
        text: 'a stale parent, key or version or an idempotency conflict (409 `TAXONOMY_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-128] CMS-03C-16 a stale parent version or key (P0001 CONFLICT) is 409 TAXONOMY_VERSION_CONFLICT',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-128] CMS-03C-16 an idempotency conflict (P0001 IDEMPOTENCY_MISMATCH) is 409 TAXONOMY_VERSION_CONFLICT',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-real-tokens.test.ts',
            title:
              'CMS-03C-16 database refusals as PostgREST relays them [P2-S12-AC-128] CMS-03C-16 a create over an existing lineage (P0001 CONFLICT) is 409 TAXONOMY_VERSION_CONFLICT',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'stale-parent: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'same-owner-duplicate: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'changed-body: exact refusal message',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary refuses preflight content-type before auth',
          },
        ],
      },
      {
        text: 'a key, allowlist or domain schema failure (422 `TAXONOMY_VALIDATION_FAILED`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves exact taxonomy catalog RPC code TAXONOMY_VALIDATION_FAILED without prose',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary strictly rejects caller authority and query keys',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'key-upper: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'domains-unknown: exact refusal message',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title: 'allowedTypeKeys-duplicate: exact refusal message',
          },
        ],
      },
      {
        text: 'the taxonomy-write limit (429), a canonical registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary enforces each quota before mutation: denied scope index 0',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-write.test.ts',
            title:
              'taxonomy definition write isolated boundary enforces each quota before mutation: denied scope index 1',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              "taxonomy provider status and refreshed authority 'create' provider502 cannot become a caller refusal through 'capability_missing'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              "taxonomy provider status and refreshed authority 'create' provider503 cannot become a caller refusal through 'capability_missing'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              "taxonomy provider status and refreshed authority 'create' provider504 cannot become a caller refusal through 'capability_missing'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary aborts a nonsettling transport without retrying the mutation',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-admission.test.ts',
            title:
              "taxonomy provider status and refreshed authority 'create' preserves explicit 'P0001'/'INTERNAL_ERROR'",
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-provider-fault.test.ts',
            title:
              "taxonomy 'definition write': provider 4xx without a product token scrubs PGRST202 function not found to 500 INTERNAL_ERROR",
          },
        ],
      },
      {
        text: 'with no vocabulary row after a refusal.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'same-owner-duplicate: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'stale-parent: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'hidden-existing: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'readable-not-curator: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'key-upper: correctly refused call preserves every full snapshot row',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_definition.sql',
            title:
              'changed-body: correctly refused call preserves every full snapshot row',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-129',
    text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`, which builds `TaxonomyVersionRequest` from the key, the shape, type-key and field-key allowlists as validated tag lists (grammar `^[a-z][a-z0-9_]{1,63}$`, 1-64 unique) and a checkbox group of the six canonical domains that shows which have a provider ("Checks available" or "Not available yet; this vocabulary cannot activate while declared"), summarizes the reviewer-visible declaration before submit and exposes group labels and descriptions programmatically; verification covers allowlist bounds, the domain declaration, the provider-availability text per domain and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`',
        citations: [
          {
            tool: 'playwright',
            file: 'tests/e2e/phase-02-slice-12-definition-journeys-real-route.spec.ts',
            title:
              '[P2-S12-AC-273] J1 a vocabulary is defined, submitted, assigned, decided and scheduled in the browser by three people, and a second one is activated and retired',
            project: 'real-route-chrome',
          },
        ],
      },
      {
        text: 'which builds `TaxonomyVersionRequest` from the key, the shape, type-key and field-key allowlists as validated tag lists (grammar `^[a-z][a-z0-9_]{1,63}$`, 1-64 unique) and a checkbox group of the six canonical domains that shows which have a provider ("Checks available" or "Not available yet; this vocabulary cannot activate while declared")',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary starts with labelled controls and states which domains can be checked',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest builds exactly the contract request, with domains in canonical order',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: the key lists adds on Enter without submitting, splits pasted lists and keeps entry order',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-vocabulary.test.ts',
            title:
              'canonical domain provider availability (FE03 :886) mirrors the release seed of the provider registry: only role is built',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest refuses allowlists past 64 keys and duplicates the contract would refuse',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest refuses a key or field key outside the contract grammar',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-tags.test.ts',
            title: 'addTags stops at 64 keys and says which keys did not fit',
          },
        ],
      },
      {
        text: 'summarizes the reviewer-visible declaration before submit',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary explains before submit that a declared unavailable domain blocks review and activation',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-review-outline.test.ts',
            title:
              'reviewRows describes the declared domains by name and an empty declaration in words',
          },
        ],
      },
      {
        text: 'exposes group labels and descriptions programmatically',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary starts with labelled controls and states which domains can be checked',
          },
        ],
      },
      {
        text: 'verification covers allowlist bounds, the domain declaration, the provider-availability text per domain and the focused result heading.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest refuses allowlists past 64 keys and duplicates the contract would refuse',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest builds exactly the contract request, with domains in canonical order',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-designer-request.test.ts',
            title:
              'buildTaxonomyVersionRequest refuses a parent version that is not a version, and a duplicate or unknown domain',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary starts with labelled controls and states which domains can be checked',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/taxonomy-vocabulary.test.ts',
            title:
              'canonical domain provider availability (FE03 :886) mirrors the release seed of the provider registry: only role is built',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary builds the exact request and shows the saved draft with a link to its page',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-taxonomy-designer/CmsTaxonomyVersionDesigner.test.tsx',
            title:
              'CmsTaxonomyVersionDesigner: a new vocabulary names every problem, links each to its control and sends nothing',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-130',
    text: 'CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with the strict `TaxonomySelectorQuery` (`typeKey`, `fieldKey`, `locale`, `cursor`, `limit`) and returns the strict `TaxonomySelectorPage` (at most 100 `TaxonomySelectorTerm` rows of `taxonomyId`, `taxonomyVersionId`, `taxonomyKey`, `shape`, `termId`, `termKey`, a nullable `parentId` and a nullable `label` for the requested locale, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(taxonomyKey ASC, termKey ASC)`.',
    clauses: [
      {
        text: 'CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with the strict `TaxonomySelectorQuery` (`typeKey`, `fieldKey`, `locale`, `cursor`, `limit`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] takes a type key, a field key and a locale with an optional cursor and a limit defaulting to 50',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-130] CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-registry.test.ts',
            title:
              'registry rows of the Worker-served taxonomy reads CMS-03C-17: author or editor (any of), GET, no CSRF, no preconditions, 8,000 ms',
          },
        ],
      },
      {
        text: 'returns the strict `TaxonomySelectorPage` (at most 100 `TaxonomySelectorTerm` rows of `taxonomyId`, `taxonomyVersionId`, `taxonomyKey`, `shape`, `termId`, `termKey`, a nullable `parentId` and a nullable `label` for the requested locale, a `nextCursor` of at most 512 characters or null, and `pageVersion`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] returns the eight-member term with a nullable label and no fallback label',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] bounds a page at 100 terms with an opaque cursor of at most 512 and a page version',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] gives a flat vocabulary no parent, since a parent needs the hierarchical shape',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title: 'the page is exactly TaxonomySelectorPage [P2-S12-AC-130]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'each item is exactly TaxonomySelectorTerm (8 members, no owner or authority member) [P2-S12-AC-130]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'every item equals the independently built row: lineage id, ACTIVE version row id, key, shape, term id and key, parent and the en-US label [P2-S12-AC-130]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'limit 4 returns four items and a signed cursor of at most 512 characters [P2-S12-AC-133]',
          },
        ],
      },
      {
        text: 'ordered by the signed keyset `(taxonomyKey ASC, termKey ASC)`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title:
              'the list is the active terms of the active vocabularies that allow type s12govordinary and field title, ordered (taxonomyKey, termKey): no deprecated tr-b, no merged tr-c, no draft vd or vo, no vq (field subtitle) [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'three pages are exactly the unpaged list in (taxonomyKey, termKey) order [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a cursor ending exactly at the last term of one vocabulary continues with the first term of the next vocabulary (taxonomyKey, then termKey) [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a cursor replayed against another limit, locale, field, type or actor, or forged, is 409 [P2-S12-AC-134]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-131',
    text: 'CMS-03C-17 accepts only a `typeKey` and a `fieldKey` that each match `^[a-z][a-z0-9_]{1,63}$`, a BCP 47 `locale`, a signed `cursor` of at most 512 characters and a `limit` of 1-100 (default 50), rejects every other query key, a body and any mutation header, and returns `label` null, with no fallback to another locale, when a term has no label for the requested locale.',
    clauses: [
      {
        text: 'CMS-03C-17 accepts only a `typeKey` and a `fieldKey` that each match `^[a-z][a-z0-9_]{1,63}$`, a BCP 47 `locale`, a signed `cursor` of at most 512 characters and a `limit` of 1-100 (default 50)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-131] bounds the keys to ^[a-z][a-z0-9_]{1,63}$, the locale to BCP 47, the cursor at 512 and the limit 1 to 100',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route refuses a cursor over 512 characters with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route a malformed query outranks a missing capability',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case type-64-chars [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case type-upper [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case field-long [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case locale-underscore [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case limit-100 [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case limit-over [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'limit 4 returns four items and a signed cursor of at most 512 characters [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title: 'a structurally malformed cursor is 400 [P2-S12-AC-134]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) applies the 50-row default and omits the cursor when none was asked',
          },
        ],
      },
      {
        text: 'rejects every other query key, a body and any mutation header',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-131] requires all three of typeKey, fieldKey and locale and rejects every other query key',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route refuses a foreign origin, a content-type, a write header and a body',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case extra-ownerId [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case extra-offset [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title: 'a non-object request is 400 [P2-S12-AC-131]',
          },
        ],
      },
      {
        text: 'returns `label` null, with no fallback to another locale, when a term has no label for the requested locale.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'fr-FR lists the French labels and null for every term without one: no fallback to en-US [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'the fr-FR page still lists all eleven terms, each with its fr-FR label or null [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'the bare language "en" matches no label: only the exact requested locale is used, never en-US [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title: 'de-DE lists the one German label [P2-S12-AC-131]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-132',
    text: 'CMS-03C-17 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term; a hidden owner scope is 404 and no matching vocabulary is an empty page and no owner or authority field is serialized.',
    clauses: [
      {
        text: 'CMS-03C-17 requires a verified human holding `cms.author` or `cms.editor` in the owner party',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route a caller holding only cms.author may read',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route the curator capability alone is 403 capability_missing with no quota and no port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route a caller holding only cms.editor may read',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'a verified human holding cms.author reads the selector [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'cms.author and cms.editor read the same page [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'the taxonomy curator, a plain reviewer and a curator of another organization hold neither cms.author nor cms.editor: 403 capability_missing [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a request without a verified human is 401 UNAUTHENTICATED [P2-S12-AC-134]',
          },
        ],
      },
      {
        text: 'lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title:
              'the list is the active terms of the active vocabularies that allow type s12govordinary and field title, ordered (taxonomyKey, termKey): no deprecated tr-b, no merged tr-c, no draft vd or vo, no vq (field subtitle) [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'the field key selects the vocabularies that allow it: subtitle lists only vq [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'a type or field no vocabulary allows is an empty page with pageVersion "1", not an error [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'after a merge and a deprecate the retired terms are gone from the selector and the oracle agrees; a vocabulary with no active term is just absent [P2-S12-AC-132]',
          },
        ],
      },
      {
        text: 'a hidden owner scope is 404',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a caller outside the owner organization gets the concealing 404 [P2-S12-AC-132]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised NOT_FOUND undefined to 404',
          },
        ],
      },
      {
        text: 'no matching vocabulary is an empty page',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'a type or field no vocabulary allows is an empty page with pageVersion "1", not an error [P2-S12-AC-132]',
          },
        ],
      },
      {
        text: 'no owner or authority field is serialized.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] returns the eight-member term with a nullable label and no fallback label',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'each item is exactly TaxonomySelectorTerm (8 members, no owner or authority member) [P2-S12-AC-130]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title: 'the page is exactly TaxonomySelectorPage [P2-S12-AC-130]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-133',
    text: 'CMS-03C-17 is a no-store, mutation-free safe read with a signed keyset cursor over `(taxonomyKey ASC, termKey ASC)` bound to the query and acting scope, default limit 50 and maximum 100, an ETag on the page version, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-17 is a no-store, mutation-free safe read',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route serves the strict page with a quoted page-version ETag and no-store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title: 'the selector reads changed no store [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'paging, cursor faults, query refusals and authority refusals changed no store [P2-S12-AC-133]',
          },
        ],
      },
      {
        text: 'with a signed keyset cursor over `(taxonomyKey ASC, termKey ASC)` bound to the query and acting scope',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'three pages are exactly the unpaged list in (taxonomyKey, termKey) order [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a cursor ending exactly at the last term of one vocabulary continues with the first term of the next vocabulary (taxonomyKey, then termKey) [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a cursor replayed against another limit, locale, field, type or actor, or forged, is 409 [P2-S12-AC-134]',
          },
        ],
      },
      {
        text: 'default limit 50 and maximum 100',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-130] takes a type key, a field key and a locale with an optional cursor and a limit defaulting to 50',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/taxonomy-selector.test.ts',
            title:
              'CMS-03C-17 taxonomy selector contract [P2-S12-AC-131] bounds the keys to ^[a-z][a-z0-9_]{1,63}$, the locale to BCP 47, the cursor at 512 and the limit 1 to 100',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case limit-100 [P2-S12-AC-131]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case limit-over [P2-S12-AC-131]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) applies the 50-row default and omits the cursor when none was asked',
          },
        ],
      },
      {
        text: 'an ETag on the page version',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route serves the strict page with a quoted page-version ETag and no-store',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'a final page has no cursor and a decimal pageVersion equal to the high-water update instant of the listed terms [P2-S12-AC-133]',
          },
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-taxonomy-version-openapi.test.ts',
            title:
              'Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads) [P2-S12-AC-130] CMS-03C-17 registers GET /api/v1/cms/taxonomies/selector with its auth, step-up, concurrency, rate and SLO policy',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route passes the cursor and the limit through and charges the selector buckets',
          },
        ],
      },
      {
        text: 'the Tier 1 p95 < 750 ms target.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/040-assert.sqlinc',
            title:
              'CMS-03C-17 first selector page at the maximum limit of 100: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_perf_taxonomy/040-assert.sqlinc',
            title:
              'CMS-03C-17 selector cursor page: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [CMS-03C-17] the selector at the maximum limit of 100: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]',
          },
          {
            tool: 'vitest',
            file: 'tests/postgrest/phase-02-slice-12-latency-taxonomy.apispec.ts',
            title:
              'Slice 12 taxonomy latency through the real stack [CMS-03C-17] the selector cursor page: p95 under the Tier 1 target of 750 ms [P2-S12-AC-133]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-134',
    text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden owner scope (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised INVALID_REQUEST undefined to 400',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised capability_missing undefined to 403',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a request without a verified human is 401 UNAUTHENTICATED [P2-S12-AC-134]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title: 'a structurally malformed cursor is 400 [P2-S12-AC-134]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route a malformed query outranks a missing capability',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route the curator capability alone is 403 capability_missing with no quota and no port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-reads-admission.test.ts',
            title:
              'production-composed Worker admission of the taxonomy term-store routes CMS-03C-17 reaches the typed 401, not a 404',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route refuses no query at all with a bare 400 before capability, quota and port',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route refuses an unknown key with a bare 400 before capability, quota and port',
          },
        ],
      },
      {
        text: 'a hidden owner scope (404)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised NOT_FOUND undefined to 404',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a caller outside the owner organization gets the concealing 404 [P2-S12-AC-132]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title: 'CMS-03C-17 selector route relays the port refusal 404',
          },
        ],
      },
      {
        text: 'an unsupported body if sent (415)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title:
              'CMS-03C-17 selector route refuses a foreign origin, a content-type, a write header and a body',
          },
        ],
      },
      {
        text: 'a cursor/context mismatch (409), a query-bound failure (422)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title: 'CMS-03C-17 selector route relays the port refusal 409',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised CONFLICT undefined to 409',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) maps the raised VALIDATION_FAILED ["/limit"] to 422',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'a cursor replayed against another limit, locale, field, type or actor, or forged, is 409 [P2-S12-AC-134]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title: 'selector query case limit-over [P2-S12-AC-131]',
          },
        ],
      },
      {
        text: 'the read limit (429)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-faults.test.ts',
            title:
              'CMS-03C-17 selector read limit (429) [P2-S12-AC-134] CMS-03C-17 a denied user bucket is 429 RATE_LIMITED with Retry-After and the bucket ceiling, and the port is never called',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-faults.test.ts',
            title:
              'CMS-03C-17 selector read limit (429) [P2-S12-AC-134] CMS-03C-17 a denied party bucket is 429 RATE_LIMITED with Retry-After and the bucket ceiling, and the port is never called',
          },
        ],
      },
      {
        text: 'a read dependency or deadline (502/503/504)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-faults.test.ts',
            title:
              'CMS-03C-17 selector production port: read dependency and deadline [P2-S12-AC-134] CMS-03C-17 a provider 5xx is a retryable 503 DEPENDENCY_UNAVAILABLE',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-faults.test.ts',
            title:
              'CMS-03C-17 selector production port: read dependency and deadline [P2-S12-AC-134] CMS-03C-17 a nonsettling transport is a 504 DEPENDENCY_UNAVAILABLE at the 8,000 ms read ceiling and not before',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) answers a witness-wrapped page as a retryable 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) answers more items than the limit as a retryable 502',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) answers an unknown member as a retryable 502',
          },
        ],
      },
      {
        text: 'an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-reads.test.ts',
            title:
              'CMS-03C-17 production port: platform_api.cms_list_taxonomy_selector (BE03c 179, 1478) scrubs the provider fault PGRST202 function not found (RPC missing or unexposed) to 500',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/060-selector-pages-authority.sqlinc',
            title:
              'paging, cursor faults, query refusals and authority refusals changed no store [P2-S12-AC-133]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-135',
    text: 'CMS-03C-17 is consumed by the protected `CmsTaxonomyFieldEditor` inside CMS-03B-01, CMS-03B-10 and CMS-03B-11 value authoring, which lists the active terms for the entry type and field key (the label for the entry locale, or the term key when no label exists), writes `{ termIds }`, shows level text for hierarchical vocabularies, announces the selection count politely, and on a `term_unavailable` refusal refetches the selector and keeps the other values; verification covers merged and deprecated terms never being listed and the `term_unavailable` recovery.',
    clauses: [
      {
        text: 'CMS-03C-17 is consumed by the protected `CmsTaxonomyFieldEditor` inside CMS-03B-01, CMS-03B-10 and CMS-03B-11 value authoring',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.connected.test.tsx',
            title:
              'the connected taxonomy selector: the protected read [P2-S12-AC-135] reads the allowlisted selector with the decoded field key, the entry type key, the locale and the default page size, and offers one checkbox per term',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-taxonomy.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: the taxonomy selector read [P2-S12-AC-135] reads the first page with the type key, the field key and the form locale, and offers one checkbox per term',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-taxonomy.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: the taxonomy selector read [P2-S12-AC-135] reads the first page with the server-derived type key and the draft locale',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-taxonomy.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: a taxonomy explicit choice reads the selector with the server-derived type key, the stable field key and the exact locale, and submits only { termIds }',
          },
        ],
      },
      {
        text: 'which lists the active terms for the entry type and field key (the label for the entry locale, or the term key when no label exists)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.test.tsx',
            title:
              'CmsTaxonomyFieldEditor: the labelled checkbox group [P2-S12-AC-135] offers one native checkbox per page term, named by its label or by its term key when the label is null',
          },
        ],
      },
      {
        text: 'writes `{ termIds }`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.test.tsx',
            title:
              'CmsTaxonomyFieldEditor: writing the value [P2-S12-AC-135] writes exactly { termIds } and keeps the order the value already has',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.connected.test.tsx',
            title:
              'the connected taxonomy selector: the host value [P2-S12-AC-135] writes exactly { termIds } when a term is toggled and claims no persisted state',
          },
        ],
      },
      {
        text: 'shows level text for hierarchical vocabularies',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.selection.test.tsx',
            title:
              'CmsTaxonomyFieldEditor: hierarchical level text [P2-S12-AC-135] derives the level of every term whose ancestry is on the page, the root at level 1',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.selection.test.tsx',
            title:
              'CmsTaxonomyFieldEditor: hierarchical level text [P2-S12-AC-135] shows no level text at all for a flat vocabulary',
          },
        ],
      },
      {
        text: 'announces the selection count politely',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial-fields/CmsTaxonomyFieldEditor.selection.test.tsx',
            title:
              'CmsTaxonomyFieldEditor: the polite selection count [P2-S12-AC-135] announces the count in one polite atomic status region',
          },
        ],
      },
      {
        text: 'on a `term_unavailable` refusal refetches the selector and keeps the other values',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-taxonomy.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: a taxonomy refusal [P2-S12-AC-135] refreshes the selector once on a verified term_unavailable, keeps the values and the stale selection, and sends nothing again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-create-taxonomy.test.tsx',
            title:
              'CmsEditorialEntryCreateIsland: a taxonomy refusal [P2-S12-AC-135] refreshes the selector once on a verified term_unavailable, keeps the text and the stale selection, and sends nothing again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-taxonomy.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: a taxonomy explicit choice refreshes the selector once on a verified 422 term_unavailable and keeps every choice and the stale selection',
          },
        ],
      },
      {
        text: 'verification covers merged and deprecated terms never being listed and the `term_unavailable` recovery.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads.sql',
            title:
              'the list is the active terms of the active vocabularies that allow type s12govordinary and field title, ordered (taxonomyKey, termKey): no deprecated tr-b, no merged tr-c, no draft vd or vo, no vq (field subtitle) [P2-S12-AC-132]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_reads/050-selector.sqlinc',
            title:
              'after a merge and a deprecate the retired terms are gone from the selector and the oracle agrees; a vocabulary with no active term is just absent [P2-S12-AC-132]',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-entry-editor-taxonomy.test.tsx',
            title:
              'CmsEditorialEntryEditorIsland: a taxonomy refusal [P2-S12-AC-135] refreshes the selector once on a verified term_unavailable, keeps the values and the stale selection, and sends nothing again',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-editorial/cms-editorial-conflict-taxonomy.test.tsx',
            title:
              'CmsEditorialConflictResolveIsland: a taxonomy explicit choice refreshes the selector once on a verified 422 term_unavailable and keeps every choice and the stale selection',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-136',
    text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`, taking the strict `CanonicalTaxonomyMatchRequest` (`domain` one of the six canonical domains, 1-64 `candidates` of 1-160 characters) and returning the discriminated `CanonicalTaxonomyMatchResult` (`no_match`; `match` with `domain`, `canonicalId` and `canonicalKind`; or `source_unavailable` with `domain`); it has no browser route, proxy or client type and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'CMS-03C-18 is the private RPC cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb) [P2-S12-AC-136]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'CMS-03C-18 has no platform_api wrapper: it is not a browser or Worker route [P2-S12-AC-136]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'no other schema carries a function of this name (no proxy) [P2-S12-AC-136]',
          },
        ],
      },
      {
        text: 'taking the strict `CanonicalTaxonomyMatchRequest` (`domain` one of the six canonical domains, 1-64 `candidates` of 1-160 characters)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-136] closes the canonical domains to exactly role, instrument, gear, place, rights and jurisdiction',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-136] accepts one domain with 1 to 64 candidates of 1 to 160 characters',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: '64 candidates are accepted [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              '65 candidates are refused: the bound is 64 per call [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'a 161-character candidate is refused [P2-S12-AC-136]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'a domain outside the closed set is refused [P2-S12-AC-136]',
          },
        ],
      },
      {
        text: 'returning the discriminated `CanonicalTaxonomyMatchResult` (`no_match`; `match` with `domain`, `canonicalId` and `canonicalKind`; or `source_unavailable` with `domain`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-136] returns the discriminated no_match, match or source_unavailable result',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a match carries exactly outcome, domain, canonicalId and canonicalKind [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'every unbuilt domain returns exactly { outcome: source_unavailable, domain }, never no_match [P2-S12-AC-140, AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'an unasserted role facet is no_match, never source_unavailable [P2-S12-AC-141]',
          },
        ],
      },
      {
        text: 'it has no browser route, proxy or client type and is absent from the browser route inventory.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'CMS-03C-18 has no platform_api wrapper: it is not a browser or Worker route [P2-S12-AC-136]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'no other schema carries a function of this name (no proxy) [P2-S12-AC-136]',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-137',
    text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality only, never fuzzy-matches, accepts one domain and at most 64 candidates per call, and returns `source_unavailable` for a domain whose provider is `unbuilt`.",
    clauses: [
      {
        text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'NFKC folds full-width letters before comparing [P2-S12-AC-137]',
          },
        ],
      },
      {
        text: 'lowercase',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'normalization lowercases the candidate [P2-S12-AC-137]',
          },
        ],
      },
      {
        text: 'trim',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'normalization trims surrounding whitespace [P2-S12-AC-137]',
          },
        ],
      },
      {
        text: 'whitespace collapse',
        citations: [],
      },
      {
        text: ') by exact equality only',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a key, a label, a normalized alias, a later-locale label, a rename label and an alias that equal a role facet are all 422 canonical_overlap [P2-S12-AC-141]',
          },
        ],
      },
      {
        text: 'never fuzzy-matches',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'no fuzzy match: a plural is not the facet [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'no fuzzy match: a prefix is not the facet [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'no fuzzy match: a compound is not the facet [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'no fuzzy match: a one-character difference is not the facet [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a plural key, a participle label and prefix aliases are not overlaps: no fuzzy matching [P2-S12-AC-137]',
          },
        ],
      },
      {
        text: 'accepts one domain and at most 64 candidates per call',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-137] refuses zero or 65 candidates, an empty or 161-character candidate and a non-string candidate',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-137] refuses a second domain, an unknown domain and any unknown member',
          },
        ],
      },
      {
        text: 'returns `source_unavailable` for a domain whose provider is `unbuilt`.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'every unbuilt domain returns exactly { outcome: source_unavailable, domain }, never no_match [P2-S12-AC-140, AC-141]',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven (uncited clauses): "whitespace collapse": the normalization step is unobservable in Phase 2 (facet codes contain no space), so no test can prove it; the only candidate, the "per former" case, passes without any collapse and was refuted',
  },
  {
    criterion: 'P2-S12-AC-138',
    text: "CMS-03C-18 is executable only by its database-internal caller `cms_act_taxonomy_term` through `cms_term_overlap_check` (PUBLIC, anon, authenticated and every other role have EXECUTE revoked), reads only the domain's named read-only projection and never another shard's store directly (DEC-100), and returns only a canonical id and kind, never canonical content.",
    clauses: [
      {
        text: 'CMS-03C-18 is executable only by its database-internal caller `cms_act_taxonomy_term` through `cms_term_overlap_check` (',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'cms_canonical_taxonomy_match is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the only function that references cms_canonical_taxonomy_match is cms_term_overlap_check [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the only caller of cms_term_overlap_check is the term write step cms_term_apply_write [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the only caller of the term write step is cms_act_taxonomy_term, so the match function is reached only through the CMS-03C-03 command [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the overlap check itself is owner-only, so the match function is reachable only inside the term action [P2-S12-AC-138]',
          },
        ],
      },
      {
        text: 'PUBLIC, anon, authenticated',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'PUBLIC, anon, authenticated and service_role cannot execute the RPC [P2-S12-AC-138]',
          },
        ],
      },
      {
        text: 'and every other role have EXECUTE revoked)',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'cms_canonical_taxonomy_match is executable by its owner wejammin_cms_definer and by no other role, PUBLIC included [P2-S12-AC-138]',
          },
        ],
      },
      {
        text: "reads only the domain's named read-only projection and never another shard's store directly (DEC-100)",
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the matcher names exactly three platform_private objects, the registry reader, the named provider projection and the id function, and no other shard\'s store (BE03c 1373, which cites DEC-100 only for "never reads another shard\'s store directly") [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              "among the CMS definer's functions exactly ONE reads the Shard 01 role facet store: the named projection (BE03c 1373) [P2-S12-AC-138]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the CMS definer may read exactly the columns facet_code and state of the Shard 01 facet store: no person, source or time [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'exactly one RLS policy admits the CMS definer to the facet store: SELECT of active assertions only (the policy that makes the named projection possible) [P2-S12-AC-138]',
          },
        ],
      },
      {
        text: 'returns only a canonical id and kind, never canonical content.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a match carries exactly outcome, domain, canonicalId and canonicalKind [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the canonical kind of a role facet is role_facet [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the canonical id is an RFC 4122 version-5 UUID (variant 8, 9, a or b) the strict contract accepts [P2-S12-AC-136]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-139',
    text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call, and applies the 2,000 ms provider timeout, so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
    clauses: [
      {
        text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the RPC is SECURITY DEFINER, STABLE (read-only), owned by the CMS definer with an empty search_path [P2-S12-AC-138, AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the CMS definer has no write verb on the Shard 01 facet store: the provider is read-only (BE03c 1373) [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: '64 candidates are accepted [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              '65 candidates are refused: the bound is 64 per call [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'a domain outside the closed set is refused [P2-S12-AC-136]',
          },
        ],
      },
      {
        text: 'applies the 2,000 ms provider timeout',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a provider read slower than the 2,000 ms deadline is DEPENDENCY_UNAVAILABLE even though it eventually answered [P2-S12-AC-139, AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a provider that answers inside the deadline (300 ms) still matches: the deadline is not a blanket slowdown [P2-S12-AC-139]',
          },
        ],
      },
      {
        text: 'so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'every call above left audit, outbox, jobs, idempotency, term, registry and facet stores byte-identical: the RPC is read-only [P2-S12-AC-139]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'the canonical id of a facet is deterministic across calls (two persons assert performer, one canonical record) [P2-S12-AC-137]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-140',
    text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write, returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`, and never returns a success-shaped body on a fault.',
    clauses: [
      {
        text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a provider that raises any error is DEPENDENCY_UNAVAILABLE and the message is not leaked [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a failing provider read (the projection source is gone) is DEPENDENCY_UNAVAILABLE, not a raw database error and not no_match [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a provider read slower than the 2,000 ms deadline is DEPENDENCY_UNAVAILABLE even though it eventually answered [P2-S12-AC-139, AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'the provider fault left every store identical: no editorial write [P2-S12-AC-140]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) DEPENDENCY_UNAVAILABLE raised by the canonical provider',
          },
        ],
      },
      {
        text: 'returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'every unbuilt domain returns exactly { outcome: source_unavailable, domain }, never no_match [P2-S12-AC-140, AC-141]',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition-production-taxonomy-act-tokens.test.ts',
            title:
              'CMS-03C-03 production port: token mapping (BE03c 1290, 1298-1306, 1375) canonical_source_unavailable',
          },
        ],
      },
      {
        text: 'never returns a success-shaped body on a fault.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/canonical-taxonomy-match.test.ts',
            title:
              'CMS-03C-18 canonical taxonomy match contract (D10, DEC-135) [P2-S12-AC-140] refuses a result that mixes outcomes, omits its members or carries an extra one',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a failing provider read (the projection source is gone) is DEPENDENCY_UNAVAILABLE, not a raw database error and not no_match [P2-S12-AC-140]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-141',
    text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) through `cms_term_overlap_check`, never by the taxonomy-version activation preflight, which reads the domain registry; verification covers `match`, `no_match` and `source_unavailable` per domain, exact equality after normalization with no fuzzy match, the `role` provider reading the Shard 02 role facet assertion projection, the provider-fault 503 with no editorial write, and the absence of the RPC from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) through `cms_term_overlap_check`, never by the taxonomy-version activation preflight, which reads the domain registry',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the only function that references cms_canonical_taxonomy_match is cms_term_overlap_check [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the only caller of the term write step is cms_act_taxonomy_term, so the match function is reached only through the CMS-03C-03 command [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_gaps_db1_acl.sql',
            title:
              'the activation preflight reads the registry provider_state through the domain registry and never the match function [P2-S12-AC-138]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a failing provider does not touch an undeclared vocabulary, a deprecate or a merge: they introduce no new string and run no overlap check [P2-S12-AC-141]',
          },
        ],
      },
      {
        text: 'verification covers `match`, `no_match` and `source_unavailable` per domain',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'role provider: a candidate equal to an asserted role facet is a match [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'an unasserted role facet is no_match, never source_unavailable [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'every unbuilt domain returns exactly { outcome: source_unavailable, domain }, never no_match [P2-S12-AC-140, AC-141]',
          },
        ],
      },
      {
        text: 'exact equality after normalization with no fuzzy match',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'no fuzzy match: a plural is not the facet [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'NFKC folds full-width letters before comparing [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title: 'normalization lowercases the candidate [P2-S12-AC-137]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'a plural key, a participle label and prefix aliases are not overlaps: no fuzzy matching [P2-S12-AC-137]',
          },
        ],
      },
      {
        text: 'the `role` provider reading the Shard 02 role facet assertion projection',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'a role facet whose only assertion was removed is no_match: only asserted facets match [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'as the CMS definer the facet store shows the three active assertions and not the removed one: the policy, not the function, bounds the read [P2-S12-AC-141]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              "among the CMS definer's functions exactly ONE reads the Shard 01 role facet store: the named projection (BE03c 1373) [P2-S12-AC-138]",
          },
        ],
      },
      {
        text: 'the provider-fault 503 with no editorial write',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'with the role provider failing, create, rename and alias are 503 DEPENDENCY_UNAVAILABLE: never a success-shaped body [P2-S12-AC-140]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms/090-overlap.sqlinc',
            title:
              'the provider fault left every store identical: no editorial write [P2-S12-AC-140]',
          },
        ],
      },
      {
        text: 'the absence of the RPC from browser routes and generated OpenAPI.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-registry-parity-openapi.test.ts',
            title:
              '[P2-S12-AC-275] OpenAPI inventory [P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_taxonomy_terms_canonical.sql',
            title:
              'CMS-03C-18 has no platform_api wrapper: it is not a browser or Worker route [P2-S12-AC-136]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
  {
    criterion: 'P2-S12-AC-142',
    text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`: `platform_private.cms_claim_due_governed_activations(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedGovernedActivation` records (`scheduleId`, `reviewId`, `subjectKind`, `subjectId`, `scheduleVersion`, `expectedVersion`, `leaseId`, `correlationId`), and `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning the strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`, with `reasonCode`, `actualUtc` and `deviationSeconds`); neither is a browser route, proxy or client type.',
    clauses: [
      {
        text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`',
        citations: [
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc',
            title: 'CMS-03C-19 has a private claim function [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc',
            title: 'CMS-03C-19 has a private execute function [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc',
            title:
              'CMS-03C-19 has a platform API claim wrapper for the Worker scheduled sweep [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/010-setup.sqlinc',
            title:
              'CMS-03C-19 has a platform API execute wrapper for the Worker scheduled sweep [P2-S12-AC-148]',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation-job.test.ts',
            title:
              'CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-142] names the BE00 job type the Worker scheduled sweep runs',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-sweep-wiring.test.ts',
            title:
              'scheduled governed activation sweep wiring runs the governed activation sweep with the platform bindings on every tick',
          },
        ],
      },
      {
        text: '`platform_private.cms_claim_due_governed_activations(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedGovernedActivation` records (`scheduleId`, `reviewId`, `subjectKind`, `subjectId`, `scheduleVersion`, `expectedVersion`, `leaseId`, `correlationId`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation-job.test.ts',
            title:
              'CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-142] takes a claim batch of 1 to 100',
          },
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation-job.test.ts',
            title:
              'CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-142] accepts a claimed record with the schedule, review, subject, versions, lease and correlation ids',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-rpc.test.ts',
            title:
              'claimDueGovernedActivations posts the bounded batch as one JSON request and returns the strict claims',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'the claim takes exactly { batch } as an integer 1..100: zero, 101, a string, a fraction, null, a boolean, a missing member, an extra member and a non-object are INVALID_REQUEST [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'a claimed record is exactly ClaimedGovernedActivation: identifiers and versions only, never content (8 members) [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'a batch of 2 claims the two oldest due schedules ordered by resolved instant; the cancelled earlier schedule is never claimed [P2-S12-AC-149]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/020-claim.sqlinc',
            title:
              'a claim moves the two schedules to executing (version 2) with a five-minute lease and emits no event; the other schedules stay pending or cancelled [P2-S12-AC-149]',
          },
        ],
      },
      {
        text: '`platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning the strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`, with `reasonCode`, `actualUtc` and `deviationSeconds`)',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-activation-job.test.ts',
            title:
              'CMS-03C-19 scheduled governed activation (OD-6) [P2-S12-AC-142] closes the execution outcome to completed, blocked, failed_retryable and already_completed',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-rpc.test.ts',
            title:
              'executeClaimedGovernedActivation executes with the claimed REVIEW version and the lease, and no other member',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'the result is exactly GovernedActivationExecutionResult (5 members) [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              "execute takes exactly { scheduleId, expectedVersion, leaseId }; an absent schedule is NOT_FOUND, a lease that is not the claim's or a schedule that is not executing is CONFLICT, a version that is not the one relied on is VERSION_MISMATCH [P2-S12-AC-150]",
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a repeated run on a completed schedule answers already_completed with the recorded instant and deviation, whatever lease it presents, and has no effect [P2-S12-AC-151]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a completed execution records the actual instant and the signed deviation from the scheduled instant (a late run still activates) [P2-S12-AC-150]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/030-execute.sqlinc',
            title:
              'a creator whose designer grant was revoked blocks the schedule activation_authority_ended: schedule blocked, subject blocked (lifecycle 5), review still approved, no event, one audit record [P2-S12-AC-146]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/040-retry.sqlinc',
            title:
              'a dependency that is unavailable (NULL policy evidence) is the retryable class: the run answers failed_retryable [P2-S12-AC-152]',
          },
        ],
      },
      {
        text: 'neither is a browser route, proxy or client type.',
        citations: [
          {
            tool: 'vitest',
            file: 'tests/contracts/phase-02-slice-12-governed-review-openapi.test.ts',
            title:
              'Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11) [P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-governed-activation-import-graph.test.ts',
            title:
              'CMS-03C-19 module boundary (import graph) never reaches the RPCs from the HTTP route layer (the governed routes import no sweep, port or name module)',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc',
            title:
              'anon and authenticated may execute neither platform API function of the scheduled sweep [P2-S12-AC-148]',
          },
          {
            tool: 'pgtap',
            file: 'supabase/tests/phase_02_slice_12_governed_schedule/060-privileges.sqlinc',
            title:
              'the wrappers are service_role only; every function is SECURITY DEFINER with an empty search_path owned by the CMS definer; the private functions and helpers are executable by no API role [P2-S12-AC-148]',
          },
        ],
      },
    ],
    status: 'verified',
    limitation: '',
  },
];
