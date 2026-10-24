import type { EvidenceLedgerEntry } from './phase-02-evidence-ledger';

// Slice 12 evidence ledger, criteria AC072-AC142. Aggregated by
// tests/contracts/phase-02-slice-12-evidence-ledger.ts and the guard tests/contracts/phase-02-slice-12-evidence-guard.test.ts.
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
        ],
      },
      {
        text: 'and then serves only an assigned reviewer holding an active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot)',
        citations: [],
      },
      {
        text: 'a hidden or absent review is 404',
        citations: [],
      },
      {
        text: 'a readable review without an effective assignment or capability or a separation-of-duties violation (the submitter or the subject creator) is 403',
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
        ],
      },
      {
        text: '`reason` is readable only by its decider.',
        citations: [
          {
            tool: 'vitest',
            file: 'packages/contracts/src/cms-composition/governed-review-read.test.ts',
            title:
              'CMS-03C-10 governed review detail contract [P2-S12-AC-089] shows a decision reason only to its decider and exposes no decision member beyond the six',
          },
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: "serves only an assigned reviewer holding an active cms.definition_review assignment plus a standing cms.reviewer grant", the 404 concealment and the 403 for a readable review without an effective assignment or a separation-of-duties violation (submitter or subject creator) are decided by the RPC (pgTAP, not cited this pass); the Worker only checks the cms.reviewer capability. Cited: the MFA-first 401 STEP_UP_REQUIRED before quota, reservation and RPC (no proof, stale proof, refreshed-session re-proof), the contract refusal of capability and stepUpAt plus the Worker passing server context only, and the contract rule that a decision reason is shown only to its decider (the server read of it is pgTAP).',
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
        ],
      },
      {
        text: 'runs in one transaction that takes its locks in the Slice 12 lock order (the subject, dependency and content-type positions before the review row, DEC-157)',
        citations: [],
      },
      {
        text: 'evaluates the ten ordered CMS-03B-06 checks (step-up proof, concealment, `open` state and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit)',
        citations: [],
      },
      {
        text: 'enforces a unique reviewer per review and review CAS (`version` + 1)',
        citations: [],
      },
      {
        text: 'ends the review at the first rejection',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2',
        citations: [],
      },
      {
        text: 'emits no event.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the Slice 12 lock order (DEC-157), the ten ordered checks, unique reviewer and review CAS (version + 1), first-rejection termination and the no-event rule are RPC/pgTAP (not cited this pass; no race module covers CMS-03C-07), and the rate/deadline/no-store/Tier 2 clause has no Tier 2 p95 test (hosted evidence). Cited: the required Idempotency-Key and strong If-Match at the contract and the Worker input stage.',
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
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause "a stale review version, review_not_open, duplicate_decision, specialist_slot_unsatisfiable or a committed dependency_changed invalidation (409 GOVERNED_REVIEW_VERSION_CONFLICT, the invalidation also returning the subject to draft)": the token-to-409 mapping is asserted in the Worker SQL-refusal transport, but the subject returning to draft and the invalidation commit are RPC/pgTAP behaviour (not cited this pass), so the clause is left uncited. Every other clause is cited from the Worker admission, input, provider-boundary and SQL-refusal-transport suites, which run against stubbed RPC replies.',
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
        text: 'verification covers the step-up round trip, each fixed message, the ordinary and protected decision paths and the focused result heading.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: "verification covers the step-up round trip, each fixed message, the ordinary and protected decision paths and the focused result heading". The form is covered by jsdom component tests (request body at the review version without capability or stepUpAt, radio pair with persistent reason label and counter, step-up routing with the draft stored and restored under the original Idempotency-Key, the separation_of_duties gate, fixed copy for the four 409 reasons), but the protected policy-slot decision path is database-only and no Playwright spec drives the form in a real browser.',
  },
  {
    criterion: 'P2-S12-AC-076',
    text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`) and returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-08 registers POST /api/v1/cms/governed-reviews/{reviewId}/assignments with the strict discriminated `GovernedReviewAssignmentRequest` (`create` with `expectedVersion`, `reviewerPersonId`, `expiresAt` and an optional `reason`; `revoke` with `expectedVersion`, `assignmentId` and an optional `reason`)',
        citations: [],
      },
      {
        text: 'returns the strict `GovernedReviewAssignmentResource` as 201 for create and 200 for revoke, carrying `reviewId`, `state` `active` or `revoked`, `capability` `cms.definition_review`, `actions` exactly `read` and `decide`, `startsAt`, `expiresAt` and `reason`',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The strict discriminated request, the strict resource with 201 for create and 200 for revoke (capability cms.definition_review, read+decide, window of at most seven days), the Worker 201 with Location and assignment ETag, the generated OpenAPI parameters, request body, statuses and registry row are asserted by the contract, Worker and OpenAPI tests listed. The whole entry is held (every clause would be cited) until root regenerates receipts and decides promotion; the RPC half (named platform_api wrapper, private implementation) is pgTAP, not cited this pass.',
  },
  {
    criterion: 'P2-S12-AC-077',
    text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`), with an optional `reason` of 1-256 code points that is already NFC (refused, never normalized); `revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked); the strong `If-Match` equals `expectedVersion` exactly.",
    clauses: [
      {
        text: "CMS-03C-08 applies the CMS-03B-18 grammar and bounds with `cms.definition_review.assign`: `create` takes the review `expectedVersion`, a UUID `reviewerPersonId` and an `expiresAt` that is after now, at most seven days away and no later than the reviewer's `cms.reviewer` grant day and the end of the owner's current designer or curator grant day (422 `expiry_out_of_bounds`)",
        citations: [],
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
        ],
      },
      {
        text: '`revoke` takes an `expectedVersion` and an `assignmentId` of an assignment on this review (404 when missing, 409 when already revoked)',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (the expiresAt bounds after now, within seven days, no later than the reviewer cms.reviewer grant day and the owner designer or curator grant day, 422 expiry_out_of_bounds) and clause 2 (revoke of a missing assignment 404 and an already revoked one 409) are RPC/pgTAP behaviour (not cited this pass); the contract only proves the offset-bearing ISO instant, UUID reviewer and seven-day window grammar. Cited: the optional reason of 1-256 NFC code points refused and never normalized, and the strong If-Match equal to expectedVersion exactly (reported at headers.ifMatch).',
  },
  {
    criterion: 'P2-S12-AC-078',
    text: 'CMS-03C-08 requires unconditional recent binding-bound MFA and then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`), accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator, collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal, answers a hidden, absent or cross-owner review as 404, and confers on the assignee only `read` and `decide` on this one frozen review.',
    clauses: [
      {
        text: 'CMS-03C-08 requires unconditional recent binding-bound MFA',
        citations: [],
      },
      {
        text: 'then the receipt-derived owner holding the non-grantable `cms.definition_review.assign` and a valid designer or curator grant (else 403 `capability_missing`)',
        citations: [],
      },
      {
        text: 'accepts a reviewer who is a current eligible human holding an active `cms.reviewer` grant and neither the review submitter nor the subject creator',
        citations: [],
      },
      {
        text: 'collapses every ineligibility into one uniform 409 `reviewer_not_eligible` that is never an existence or role signal',
        citations: [],
      },
      {
        text: 'answers a hidden, absent or cross-owner review as 404',
        citations: [],
      },
      {
        text: 'confers on the assignee only `read` and `decide` on this one frozen review.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'CMS-03C-08 is not built (no RPC, route or cms.definition_review.assign owner capability), so receipt-derived owner authority, reviewer eligibility, the uniform 409 reviewer_not_eligible, the concealment 404 and the read/decide-only grant are unproven.',
  },
  {
    criterion: 'P2-S12-AC-079',
    text: 'CMS-03C-08 requires an `Idempotency-Key` and the exact review-version `If-Match`, locks the review row, leaves the review `version` unchanged on create and revoke, admits a new assignment only while fewer than 16 are active (409 `assignment_limit`), enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2, commits the assignment change and its audit record atomically, emits no event, and treats an expired assignment as inert.',
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
        ],
      },
      {
        text: 'locks the review row',
        citations: [],
      },
      {
        text: 'leaves the review `version` unchanged on create and revoke',
        citations: [],
      },
      {
        text: 'admits a new assignment only while fewer than 16 are active (409 `assignment_limit`)',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 10/min/user and 20/min/party, a 15,000 ms deadline, no-store and Tier 2',
        citations: [],
      },
      {
        text: 'commits the assignment change and its audit record atomically',
        citations: [],
      },
      {
        text: 'emits no event',
        citations: [],
      },
      {
        text: 'treats an expired assignment as inert.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the review row lock (no source oracle or race module for CMS-03C-08), the unchanged review version, the 16-assignment limit (409 assignment_limit), atomic audit, the no-event rule and the inertness of an expired assignment are RPC/pgTAP (not cited this pass); the rate buckets 10/20 and the 15 s deadline are Worker-level but the same clause names a Tier 2 p95 < 1,200 ms target with no local test (hosted evidence). Cited: the required bounded Idempotency-Key and strong If-Match equal to expectedVersion at the contract.',
  },
  {
    criterion: 'P2-S12-AC-080',
    text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written, answers a missing or stale MFA with 401 `STEP_UP_REQUIRED` that reserves no idempotency record and changes no state, maps malformed IDs, header or body (400), a denied owner capability (403), a hidden, absent or cross-owner review (404), a non-JSON body (415), the assignment limit (429), an RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and reconciles a lost response by the same `Idempotency-Key`.',
    clauses: [
      {
        text: 'CMS-03C-08 refuses a stale review version, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit` and `review_not_open` (409) and `expiry_out_of_bounds` or a contract failure (422) with no row written',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (the 409/422 refusals with no row written, RPC/pgTAP) and clause 3 (lost-response reconciliation: the Worker re-sends byte-identical RPC input, but the stored-response replay that writes nothing is RPC/pgTAP). Cited: the 401 STEP_UP_REQUIRED mapping that reserves nothing, and the 400/403/404/415/429/deadline/500 mappings from the Worker input, admission, provider-boundary and SQL-refusal-transport suites (stubbed RPC replies).',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 6 ("verification covers create and revoke, every eligibility refusal collapsing to reviewer_not_eligible, the seven-day, reviewer-grant-end and grantor-authority bounds, assignment_exists, assignment_limit, review_not_open, owner-only authority and an unchanged review version"): the reviewer-grant-end and grantor-authority bounds are database-only, the assignment_limit copy lives in a separate rate-limit suite, and no Playwright spec drives the form. Clauses 0-5 are cited from jsdom component tests of CmsGovernedAssignmentForm and the detail island.',
  },
  {
    criterion: 'P2-S12-AC-082',
    text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`) and returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`, carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-09 registers POST /api/v1/cms/governed-reviews/{reviewId}/activation with the strict discriminated `GovernedActivationRequest` (`activate`; `schedule` with a `ScheduledInstant` `activateAt`; `retire` with an optional `reason`, each with `expectedVersion`)',
        citations: [],
      },
      {
        text: 'returns the strict `GovernedActivationResource` as 200 for `activate` and `retire` and 202 for `schedule`',
        citations: [],
      },
      {
        text: 'carrying `reviewId`, `reviewVersion`, `subjectKind`, `subjectId`, `lineageId`, `subjectVersion`, `action`, `subjectState` `active`, `scheduled` or `retired`, `activatedAt`, `scheduledForUtc` and an `eventType` that is set only on a committed immediate activation or retirement',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The discriminated activate/schedule/retire request, the 200/202 split with the strict resource members, eventType rule, supersededVersion and the generated OpenAPI and registry parity are asserted by the contract, Worker and OpenAPI tests listed; every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion. The RPC producer is pgTAP (not cited this pass).',
  },
  {
    criterion: 'P2-S12-AC-083',
    text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope and the review `version` equal to `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) for every action; `activate` and `schedule` further require an `approved` review and a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; `retire` requires only an `active` subject (else 409 `subject_not_retirable`), needs no fresh approval and no hash, policy, dependency, provider or preflight validity (DEC-190), and accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized); the strong `If-Match` equals `expectedVersion` exactly.',
    clauses: [
      {
        text: 'CMS-03C-09 requires, in order inside one transaction, the unconditional step-up proof, the review resolved and concealed per scope and the review `version` equal to `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) for every action;',
        citations: [],
      },
      {
        text: '`activate` and `schedule` further require an `approved` review and',
        citations: [],
      },
      {
        text: 'a recheck of the subject hash, the policy basis and every dependency in which a difference commits the invalidation (subject back to `draft`) and answers 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`',
        citations: [],
      },
      {
        text: ';',
        citations: [],
      },
      {
        text: '`retire` requires only an `active` subject (else 409 `subject_not_retirable`), needs no fresh approval and no hash, policy, dependency, provider or preflight validity (DEC-190), and accepts an optional reason of 1-256 code points that is already NFC (refused, never normalized);',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the in-order one-transaction checks, the approved-review requirement, the recheck and committed invalidation (subject back to draft, dependency_changed), the retire rules of DEC-190 and the NFC retire reason are RPC/pgTAP (not cited this pass); the bare ";" fragment carries no assertion of its own. Cited: the strong If-Match equal to expectedVersion for every action (contract).',
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
        ],
      },
      {
        text: "then serves only the holder of the subject kind's owner capability as for CMS-03C-06",
        citations: [],
      },
      {
        text: 'a hidden or absent review is 404',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (served only to the holder of the subject kind owner capability: the per-kind decision is database-made; the Worker applies an any-of owner gate) and clause 2 (a hidden or absent review is the concealed 404, RPC/pgTAP). Cited: the unconditional recent MFA proof before anything else (401 STEP_UP_REQUIRED before quota, reservation and RPC for every action, refreshed-session re-proof, retire still demands it) and the Worker 403 for a caller with neither owner capability.',
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
        ],
      },
      {
        text: 'runs in one transaction that takes its locks in the Slice 12 lock order',
        citations: [],
      },
      {
        text: 'holds the review row and the lineage advisory lock as an atomic CAS switch',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 20/min/user and 40/min/party, a 15,000 ms deadline, no-store and Tier 2',
        citations: [],
      },
      {
        text: 'commits the switch and the audit record atomically.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the Slice 12 lock order (source oracles; no race module for CMS-03C-09), the review row plus lineage advisory lock as an atomic CAS switch and the atomic switch-plus-audit commit are RPC/pgTAP (not cited this pass); the rate/deadline/no-store clause also names a Tier 2 p95 < 1,200 ms target with no local assertion (hosted evidence). Cited: the required Idempotency-Key and strong If-Match tied to expectedVersion for every action (contract).',
  },
  {
    criterion: 'P2-S12-AC-086',
    text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict` and `schedule_exists` (409), a time, tzdb or horizon failure, a preflight failure or `canonical_source_unavailable` with `details.domain` (422), and a missing or stale MFA (401 `STEP_UP_REQUIRED`, no state change), maps malformed IDs, header or body (400), a missing capability (403), a hidden or absent review (404), a non-JSON body (415), the activation limit (429), a preflight or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.governed-review.v1`, and commits no partial switch.',
    clauses: [
      {
        text: 'CMS-03C-09 refuses a stale review version, `subject_not_activatable`, `subject_not_retirable`, `dependency_changed`, `activation_conflict` and `schedule_exists` (409)',
        citations: [],
      },
      {
        text: 'a time, tzdb or horizon failure, a preflight failure or `canonical_source_unavailable` with `details.domain` (422)',
        citations: [],
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
        ],
      },
      {
        text: 'commits no partial switch.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (the 409 tokens, each with no state change: RPC/pgTAP), clause 1 (422 for time, tzdb and horizon failures, a preflight failure and canonical_source_unavailable with details.domain: not reached at activation in pgTAP either, and the Worker Time authority test cited elsewhere answers 503) and clause 4 (no partial switch on any refusal, RPC/pgTAP). Cited: the 401 STEP_UP_REQUIRED mapping (no proof and stale proof, before quota, reservation and RPC) and the 400/403/404/415/429/deadline/500 mappings from the Worker gate, admission, provider-boundary and SQL-refusal-transport suites.',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 7 ("verification covers all three actions, the confirmation step, the step-up round trip and the closed schedule reasons") is a meta statement whose parts are covered by jsdom component tests only; no Playwright spec drives CmsGovernedActivationForm, so real-browser focus and the step-up round trip are unproven. Clauses 0-6 are cited from the jsdom component and detail-island tests.',
  },
  {
    criterion: 'P2-S12-AC-088',
    text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId} and returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`) sorted by label then policy key, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-10 registers GET /api/v1/cms/governed-reviews/{reviewId}',
        citations: [],
      },
      {
        text: 'returns the strict `GovernedReviewDetailResource`: the review base fields, a nullable `blockRegistryDigest`, a `policyBasis` of at most 64 entries (`contentTypeLabel`, `policyKey`, `policyVersion`) sorted by label then policy key, `distinctApprovalCount` 0-8, at most 8 `decisions` (`id`, `decision`, `capability`, `decidedAt`, `mine`, `reason`), at most 32 `assignments`, a nullable `myAssignment`, `subjectState` and at most 6 `permittedNextActions`',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The GET route with strong review-version ETag and no-store, the strict GovernedReviewDetailResource (base fields, nullable digest, policy basis <= 64, decisions, assignments, next actions, subject state) and the OpenAPI/registry parity are asserted by the contract, Worker and OpenAPI tests listed; every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion. The RPC read is pgTAP (not cited this pass).',
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
        ],
      },
      {
        text: "exposes a decision's `reason` only to its decider and `assignments` only to the receipt-derived owner (every other reader receives `[]`)",
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 ("assignments only to the receipt-derived owner, every other reader receives []"): the contract shows a reason only to its decider, but the owner-only assignments filter is RPC/pgTAP (not cited this pass). Clause 3 is cited by composition: the contract refuses more than 8 decisions or 32 assignments and the ops provider boundary turns a response failing the strict schema into a local 502; no test sends an oversized array through the route itself.',
  },
  {
    criterion: 'P2-S12-AC-090',
    text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403), returns `reason` only on the caller's own decision, serializes `assignments` only to the owner and the caller's own assignment to its reviewer, and serializes no person, actor or party identifier.",
    clauses: [
      {
        text: "CMS-03C-10 serves only the submitter, a non-revoked reviewer assignee, a holder of the subject kind's owner capability in the owner party or the receipt-derived owner (a hidden, absent or cross-owner review is 404; a visible review without read scope is 403)",
        citations: [],
      },
      {
        text: "returns `reason` only on the caller's own decision",
        citations: [],
      },
      {
        text: "serializes `assignments` only to the owner and the caller's own assignment to its reviewer",
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the reader scopes (submitter, non-revoked assignee, owner-capability holder, receipt-derived owner), the 404/403 split, reason on the caller own decision only and assignments only to the owner are RPC/pgTAP (not cited this pass). Cited: the detail contract gives every assignment a server-built label and refuses any person, party or actor identifier member.',
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
        text: 'enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target',
        citations: [],
      },
      {
        text: 'writing no audit or outbox row and emitting no event.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 names a Tier 1 p95 < 750 ms target with no local assertion (hosted evidence; the 300/600 buckets and the 8,000 ms deadline are Worker tests) and clause 3 (no audit or outbox row, no event) is RPC/pgTAP. Cited: the no-store mutation-free safe read that refuses Idempotency-Key, If-Match and request media, and the strong review-version ETag.',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 3 ("answers a concealed review with the same 404"): absent, cross-owner, non-member and scope-less callers being indistinguishable is RPC/pgTAP (not cited this pass). Clauses 0-2 are cited from the Worker read-route, provider-boundary and SQL-refusal-transport suites against stubbed RPC replies.',
  },
  {
    criterion: 'P2-S12-AC-093',
    text: "CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`, which renders the subject identity and hash, the policy basis by content type label and policy key, the required, recorded and qualifying counts, the decisions as a semantic list without the decider's label, the caller's own reason, `myAssignment` and, for the owner only, assignment summaries by `reviewerLabel`, takes actions only from `permittedNextActions`, moves focus to the heading on navigation only and puts no person, actor or party identifier in text, URL or telemetry; verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and `permittedNextActions` per caller.",
    clauses: [
      {
        text: 'CMS-03C-10 is consumed by the protected `CmsGovernedReviewDetail` at `/app/cms-content-modeling/definition-reviews/:reviewId`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'CMS-03C-10 protected definition-review detail page, composed serves the evidence and the decision form to an assignee',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-governed-review/load-governed-detail-page.test.ts',
            title:
              'loadGovernedDetailPage returns the verified detail for this review with its verification time',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/[reviewId].astro response invariants is never prerendered or cached, uses the one shared shell and bundles no script of its own',
          },
          {
            tool: 'vitest',
            file: 'apps/web/src/pages/app/cms-content-modeling/definition-reviews/definition-review-routes.test.tsx',
            title:
              'definition-reviews/[reviewId].astro passes the island only the verified review, its id and the verification time',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 5 ("verification covers each reader scope, reason visibility to its decider only, owner-only assignments without an identifier, the distinct approval count and permittedNextActions per caller") is a meta statement; reason visibility to its decider is database-level and no Playwright spec drives the definition-review detail page, so real-browser focus on navigation is unproven. Clauses 0-4 are cited from jsdom component, island, loader and route tests (focus is by the shell heading-focus script).',
  },
  {
    criterion: 'P2-S12-AC-094',
    text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery` and returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`) ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
    clauses: [
      {
        text: 'CMS-03C-11 registers GET /api/v1/cms/governed-reviews with the strict `GovernedReviewQueueQuery`',
        citations: [],
      },
      {
        text: 'returns the strict `GovernedReviewQueuePage` (at most 50 `GovernedReviewQueueItem` rows of `reviewId`, `subjectKind`, `subjectKey`, `subjectVersion`, `state`, `riskClass`, `requiredDecisionCount`, `recordedDecisionCount`, `myDecision`, `assignmentEndsAt`, `submittedAt` and `updatedAt`, a `nextCursor` of at most 512 characters or null, and `pageVersion`)',
        citations: [],
      },
      {
        text: 'ordered by the signed keyset `(updatedAt DESC, reviewId DESC)`.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The GET route registration, the strict GovernedReviewQueueQuery, the identifier-free 12-member queue item, the 50-row page with an opaque cursor of at most 512 characters and the (updatedAt DESC, reviewId DESC) keyset order are asserted by the contract and OpenAPI tests listed; every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion. The RPC queue read is pgTAP (not cited this pass).',
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
        text: 'rejects every other query key, a body and any mutation header',
        citations: [],
      },
      {
        text: 'refuses an unknown scope, state or kind, a limit outside 1-50 or a structurally malformed cursor with the 400, 409 or 422 the validation matrix declares (DEC-140 cursor fault classes).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (a body and any mutation header rejected for the queue: the contract proves the query-key allowlist, but no queue case sends a body or Idempotency-Key/If-Match; the sibling detail route has such cases) and clause 2 (the 409 cursor fault class of DEC-140 for a replayed, tampered or expired cursor is RPC/pgTAP; the Worker proves the 400 and 422 classes). Cited: the closed scope/state/subjectKind filters, limit 1-50 with default 25, and the cursor bound of 512 characters at the contract and in the OpenAPI document.',
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
        citations: [],
      },
      {
        text: 'for `scope=submitted`, only reviews the caller submitted',
        citations: [],
      },
      {
        text: "for `scope=owned`, only reviews of subjects that the caller's designer or curator capability covers",
        citations: [],
      },
      {
        text: 'so a review outside those scopes is never listed.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the assigned, submitted and owned scope filters and the never-listed-outside-scope rule are RPC/pgTAP (not cited this pass). Cited: the Worker answers an anonymous caller 401 UNAUTHENTICATED before any dependency (verified human requirement at the Worker).',
  },
  {
    criterion: 'P2-S12-AC-097',
    text: 'CMS-03C-11 is a no-store, mutation-free safe read with a signed keyset cursor bound to the complete query and acting scope, default limit 25 and maximum 50, a filter allowlist of `scope`, `state` and `subjectKind`, read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
    clauses: [
      {
        text: 'CMS-03C-11 is a no-store, mutation-free safe read',
        citations: [],
      },
      {
        text: 'with a signed keyset cursor bound to the complete query and acting scope',
        citations: [],
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
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: no-store and mutation-free for the queue (the queue Worker case asserts 200, the page-version ETag and the contract defaults but not no-store), the signed keyset cursor bound to the complete query and acting scope (RPC/pgTAP), and the read buckets / 8,000 ms deadline / Tier 1 p95 < 750 ms clause (no Tier 1 test; hosted evidence). Cited: default limit 25 and maximum 50, and the filter allowlist of scope, state and subjectKind at the contract and in the OpenAPI document.',
  },
  {
    criterion: 'P2-S12-AC-098',
    text: 'CMS-03C-11 answers a structurally malformed cursor with 400 and an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page, and maps session, rate, read-dependency and internal failures to typed ApiError of catalog `cms.03c.governed-review.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-11 answers a structurally malformed cursor with 400',
        citations: [],
      },
      {
        text: 'an expired, tampered or foreign-bound cursor with 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, after which the client restarts from the first page',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (a structurally malformed cursor is 400: the Worker proves empty and over-long cursors, but not-base64, not-JSON and wrong-keys cursors are RPC/pgTAP) and clause 1 (the 409 for an expired, tampered or foreign-bound cursor is RPC/pgTAP; the web loader test only proves the restart). Cited: session 401, rate 429, read-dependency 503 and internal 500 mappings from the Worker provider boundary (the no audit/outbox effect of the reader is pgTAP).',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 6 ("verification covers each scope, the filters, signed-cursor binding, the DEC-140 fault classes and that a review outside the caller scopes is never listed") is a meta statement whose signed-cursor binding and never-listed rule are database-level, and no Playwright spec drives the queue page (real-browser behaviour unproven). Clauses 0-5 are cited from jsdom component, loader and route tests.',
  },
  {
    criterion: 'P2-S12-AC-100',
    text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null) and returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-12 registers POST /api/v1/cms/patterns/versions with the strict `PatternVersionRequest` (`patternKey`, `compatibleTypeIds`, `blockTree` of 1-32 root `PatternNode`s, an optional `blockRegistryDigest`, `expectedVersion` or null)',
        citations: [],
      },
      {
        text: 'returns the strict `PatternVersionResource` as 201 for a `draft` version (`patternId`, `patternKey`, `patternVersion`, `compatibleTypeIds`, `nodeCount` 1-512 and `blockRegistryDigest`)',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The strict PatternVersionRequest (1-32 root nodes, optional digest, expectedVersion or null), the strict 201 PatternVersionResource for a draft (nodeCount 1-512), the registry row and the generated OpenAPI are asserted by the contract, Worker and OpenAPI tests listed. The route-vs-registry half is cited with the OpenAPI registration test and the Worker mount test (no test compares the mounted Hono route table to the registry row). Every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion; the RPC producer is pgTAP (not cited this pass).',
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
        text: "1-64 unique `compatibleTypeIds` that are each the id of an active content type of the caller's owner scope",
        citations: [],
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
        ],
      },
      {
        text: '`block` nodes that use the canonical BlockKey and a registered, non-withdrawn version',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (each compatibleTypeId is the id of an active content type of the caller owner scope; the contract only proves 1-64 unique UUIDs) and clause 3 (a registered, non-withdrawn block version; the contract only proves the canonical BlockKey and a positive int32 version) are RPC/pgTAP behaviour (not cited this pass). Cited from the contract and Worker route tests: the patternKey grammar and reserved keys, the root and node key bounds, props of at most 64 keys and depth 8, and expectedVersion null or the parent version with the matching If-Match.',
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
        citations: [],
      },
      {
        text: 'a hidden owner or pattern is 404',
        citations: [],
      },
      {
        text: 'a readable pattern without the capability is 403',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (a verified human holding cms.template_designer in the caller owner scope: the Worker gates capability presence and acting party, the owner-scope decision is the RPC) and clause 2 (a hidden owner or pattern is 404: Worker maps a stubbed NOT_FOUND; the concealment is RPC/pgTAP, not cited this pass). Cited: server-derived context (named RPC with server-bound context, real resolver authority bound to the request), the Worker 403 for a caller without the designer capability, no step-up required (registry row and Worker cases with a stale MFA instant) and the closed resource without owner or authority identifiers. Withheld: 2 identified test identities occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
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
        citations: [],
      },
      {
        text: 'computes `blockRegistryDigest` on the server',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline (target < 2 s), no-store and the Tier 2 p95 < 1,200 ms target',
        citations: [],
      },
      {
        text: 'emits no event (activation is CMS-03C-09).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (per-owner unique (key, version) and CAS, RPC/pgTAP), clause 3 (blockRegistryDigest computed on the server, RPC/pgTAP; the Worker only binds a supplied digest to the response), clause 4 (30/60 buckets, the 15,000 ms deadline and no-store are Worker tests, but the clause also names the Tier 2 p95 < 1,200 ms and < 2 s targets for which no pattern-write benchmark exists: hosted evidence) and clause 5 (no event, RPC/pgTAP). Cited: the required bounded Idempotency-Key and the If-Match tied to expectedVersion (absent on a first version, strong and equal on a successor).',
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
        citations: [],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (409 for a stale parent, key or version, a cycle or an idempotency conflict: only the pattern_cycle reason projection is a Worker test; the rest is RPC/pgTAP) and clause 6 (no pattern row after a refusal, RPC/pgTAP). Every other clause is cited from the Worker admission, write, production-transport and typed-refusal suites against stubbed RPC replies. Withheld: 2 identified test identities occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
  },
  {
    criterion: 'P2-S12-AC-105',
    text: "CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`, which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors, nested pattern nodes from `CmsPatternSelector`, `compatibleTypeIds` from the context's content type selectors), edits node keys, props and children with explicit add, remove and move-up/move-down controls (no drag-only path), renders the server digest, `nodeCount` and a cycle, depth or node-count refusal inline with the node path, and sends the read version as `expectedVersion` for a successor; verification covers keyboard operation, the inline refusals, the error summary linking to the node and the focused result heading.",
    clauses: [
      {
        text: 'CMS-03C-12 is consumed by the protected `CmsPatternVersionDesigner` at `/app/cms-content-modeling/patterns/new` and `/app/cms-content-modeling/patterns/:patternKey`',
        citations: [],
      },
      {
        text: "which builds `PatternVersionRequest` over a native nested ordered list of `PatternNode`s (block nodes chosen from the context's registered block selectors, nested pattern nodes from `CmsPatternSelector`, `compatibleTypeIds` from the context's content type selectors)",
        citations: [],
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
        text: 'renders the server digest, `nodeCount` and a cycle, depth or node-count refusal inline with the node path',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 0 (route-level consumption; the page tests only read the Astro source as text), clause 1 (nested pattern nodes from CmsPatternSelector: no web CmsPatternSelector exists and CmsPatternNestedPicker is a disabled placeholder), clause 3 (server digest, nodeCount and a cycle, depth or node-count refusal inline with the node path: the server names no node for an expansion bound) and clause 5 (keyboard operation in a real browser; no Playwright spec exists for the pattern pages). Cited: the explicit add, remove and move controls and the successor expectedVersion from jsdom component and request-builder tests.',
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
        ],
      },
      {
        text: 'ordered by the signed keyset `(patternKey ASC, patternVersion DESC)`.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (ordered by the signed keyset (patternKey ASC, patternVersion DESC)): the Worker accepts a descending-version page and refuses rows out of keyset order as a local 502, but the signed keyset cursor and the ordering itself are RPC/pgTAP (not cited this pass). Cited: the strict PatternSelectorQuery, the registry row, the strict PatternSelectorPage (50 items, opaque cursor of at most 512, page version) and the six-member item.',
  },
  {
    criterion: 'P2-S12-AC-107',
    text: "CMS-03C-13 accepts only a UUID `contentTypeId` of a content type in the caller's owner scope, a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25), rejects every other query key, a body and any mutation header, and answers a hidden or absent content type with the same 404.",
    clauses: [
      {
        text: "CMS-03C-13 accepts only a UUID `contentTypeId` of a content type in the caller's owner scope, a signed `cursor` of at most 512 characters and a `limit` of 1-50 (default 25)",
        citations: [],
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
        text: 'answers a hidden or absent content type with the same 404.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (a UUID contentTypeId of a content type in the caller owner scope, and a signed cursor: the owner scope and the cursor signature are RPC/pgTAP; the Worker and contract prove only the UUID, the 512-character cursor bound and the 1-50 limit with default 25) and clause 2 (a hidden or absent content type answers the same 404: the Worker only publishes a stubbed 404). Cited: every other query key, a body and any mutation header (Idempotency-Key, If-Match, request media, declared body) refused.',
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
        ],
      },
      {
        text: 'lists only `active` pattern versions of that owner whose `compatibleTypeIds` contain the requested content type',
        citations: [],
      },
      {
        text: 'so a draft, non-compatible or other-owner version is never listed',
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
      'Unproven at the Vitest layer: "in the owner party", the active-only, compatible-only and own-owner listing rules and the never-listed draft, non-compatible or other-owner versions (clauses 1 and 2) are RPC/pgTAP (not cited this pass). Cited: the Worker admission (cms.author or cms.editor may use it, the designer or curator capability alone and no capability are 403 capability_missing with no quota and no port call, an unauthenticated session is the typed 401) and the selector item contract, which refuses any hidden or owner/authority member. Withheld: 1 identified test identity occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
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
        ],
      },
      {
        text: 'with a signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the query and acting scope',
        citations: [],
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
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (the signed keyset cursor over (patternKey ASC, patternVersion DESC) bound to the query and acting scope is RPC/pgTAP; the Worker only forwards it) and clause 4 (the 300/600 buckets and the 8,000 ms deadline are Worker tests, but the clause names a Tier 1 p95 < 750 ms target with no benchmark: hosted evidence). Clause 0 is cited as the Worker answers an accepted request cached nowhere with the strong ETag and refuses mutation headers; the no audit/outbox/idempotency write of the reader is pgTAP.',
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
        ],
      },
      {
        text: 'a client restarts from the first page after a cursor conflict.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 3 ("a client restarts from the first page after a cursor conflict") is client behaviour for a CmsPatternSelector component that does not exist in apps/web, so only the server half (the 409) is proven. Clauses 0-2 are cited from the Worker route, query-parser, admission and fault suites against stubbed ports (the no audit or outbox effect of the reader is pgTAP).',
  },
  {
    criterion: 'P2-S12-AC-111',
    text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`, which renders `PatternSelectorPage` items for the entry\'s content type (`patternKey`, `patternVersion`, `nodeCount`) as a native list or select with the result count announced politely, shows the empty state "No compatible pattern is active", and keeps the cursor in component state only; verification covers only active compatible versions, keyset order, cursor binding and the empty state.',
    clauses: [
      {
        text: 'CMS-03C-13 is consumed by the protected `CmsPatternSelector` in the instance-insert form at `/app/cms-content-modeling/entries/:entryId/composition`',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/web/src/components/cms-composition-instances/CmsCompositionPage.insert.test.tsx',
            title:
              'insert: the pattern selector loads the next page with the cursor, keeps the listed patterns and adds the new ones once',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 4 ("verification covers only active compatible versions, keyset order, cursor binding and the empty state") is a meta statement whose active-compatible, keyset-order and cursor-binding halves are server/database facts (cited elsewhere only as Worker and pgTAP evidence). Clauses 0-3 are cited from the jsdom CmsPatternSelector and composition-page insert tests; the composed route test lives under a bracketed [entryId] path that the guard cannot cite (see report request), and no Playwright spec drives the composition page.',
  },
  {
    criterion: 'P2-S12-AC-112',
    text: "CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` in the `ExpandedPatternNodePath` grammar (the row-path key grammar, 1–72 segments, at most 4680 ASCII characters, DEC-193), `base` (the pinned node value) and `theirs` (the target node value), each the node's `props`, block identity (`blockKey`, `blockVersion`) and `children`, or null for a node absent from that version (DEC-193), `yours` (the local override), a `collision` flag and a `collisionKind` (`removed_root`, `structure`, `props` or null), the instance's `slotPath`, at most 512 `newRoots` (`rootPath`, `blockKey`, `blockVersion`, the `rootPath` an `ExpandedPatternNodePath`), a `collisionCount` 0-128 and `bulkEligible`; generated OpenAPI and the discovered Hono route match the registry row.",
    clauses: [
      {
        text: 'CMS-03C-14 registers GET /api/v1/cms/compositions/instances/{instanceId}/update-diff',
        citations: [],
      },
      {
        text: "and returns the strict `CompositionUpdateDiffResource`: the `instance` (`id`, `version`, `revisionId`, `path`, `state`, `linkMode`, `pinnedPatternVersion`), the `targetPatternVersion`, at most 128 `paths` each with a `path` in the `ExpandedPatternNodePath` grammar (the row-path key grammar, 1–72 segments, at most 4680 ASCII characters, DEC-193), `base` (the pinned node value) and `theirs` (the target node value), each the node's `props`, block identity (`blockKey`, `blockVersion`) and `children`, or null for a node absent from that version (DEC-193), `yours` (the local override), a `collision` flag and a `collisionKind` (`removed_root`, `structure`, `props` or null), the instance's `slotPath`, at most 512 `newRoots` (`rootPath`, `blockKey`, `blockVersion`, the `rootPath` an `ExpandedPatternNodePath`), a `collisionCount` 0-128 and `bulkEligible`;",
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The GET route registry row, the strict CompositionUpdateDiffResource (instance summary, three-way path values, ExpandedPatternNodePath grammar of 72 segments / 4680 characters, 128 paths, 512 newRoots, collision kinds, collisionCount, bulkEligible) and the generated OpenAPI are asserted by the contract, Worker registry and OpenAPI tests listed. No test compares the mounted Hono route table to the registry row (the registry-row clause is cited with the operation-table and OpenAPI tests). Every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion; the RPC is pgTAP (not cited this pass).',
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
        ],
      },
      {
        text: ", defines the value of a node path as its `props` plus its block identity and `children` and lists each path the target changed (an added or removed node once, at its own path), defines a listed path as a collision of exactly one kind, the first that applies: `removed_root` when the target removed the instance's own block root, `structure` when the target changed the node's block identity or `children` (with or without an override) and `props` when the local override differs from the base `props` and the target also changed them (DEC-193), lists as `newRoots` the target's block roots whose key chain the pinned forest lacks,",
        citations: [],
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
        text: ', and',
        citations: [],
      },
      {
        text: 'refuses an instance with more than 128 changed paths or more than 256 KiB as 422 `COMPOSITION_VALIDATION_FAILED` `diff_too_large`.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (the definition of a node path value, the changed-path listing, the one-kind collision precedence removed_root / structure / props and newRoots derivation) and clause 4 (refusal of more than 128 paths or 256 KiB as 422 diff_too_large: the contract bounds the diff, the refusal is produced by the RPC) are pgTAP behaviour (the dec193_diff pgTAP is authored; not cited this pass); the bare ", and" tiling fragment (clause 3) carries no assertion of its own. Cited: the UUID instanceId path with an empty strict query, and the null-when-absent schema-typed base/theirs/yours values bounded to 128 paths and 256 KiB.',
  },
  {
    criterion: 'P2-S12-AC-114',
    text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable (the diff answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` when the instance has no newer `active` compatible pattern version, or when the named row carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path, such as a detached row, a detached copy, a `retired` row, an older version or a historical linked `active`/`pending_diff` row that is no longer newest, and answers `paths: []` with `bulkEligible` true when a newer version changes none of the instance's paths; a row with no pattern pin, a standalone block row, is refused and never answered with a fabricated pin, DEC-193)",
    clauses: [
      {
        text: "CMS-03C-14 serves only an assigned CMS author or editor on the instance's revision, for an instance that is readable",
        citations: [],
      },
      {
        text: "(the diff answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` when the instance has no newer `active` compatible pattern version, or when the named row carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path, such as a detached row, a detached copy, a `retired` row, an older version or a historical linked `active`/`pending_diff` row that is no longer newest, and answers `paths: []` with `bulkEligible` true when a newer version changes none of the instance's paths; a row with no pattern pin, a standalone block row, is refused and never answered with a fabricated pin, DEC-193)",
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Approved claim amended; no test is cited for this criterion yet. Native/SQL/browser acceptance remains unverified.',
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
        ],
      },
      {
        text: 'enforces read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 3 (read buckets 300/600, the 8,000 ms deadline and the Tier 1 p95 < 750 ms target: the Worker tests cover buckets and deadline but no benchmark exists for the diff read, so the target is hosted evidence) and the pgTAP side of the reader (no audit/outbox/idempotency write). Cited: the accepted request cached nowhere with the strong ETag, the refusal of Idempotency-Key and If-Match (400) and request media (415), the quoted instance-version ETag, and the 128-path / 256 KiB diff bound at the contract.',
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
        citations: [],
      },
      {
        text: 'leaves an unanswered update on its pinned version.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 ("never overwrites an instance": the read RPC preserving every store row on success and refusal) and clause 3 ("leaves an unanswered update on its pinned version") are RPC/pgTAP (the dec193_diff pgTAP is authored; not cited this pass). Clauses 0 and 1 are cited from the Worker route, admission and fault suites against stubbed ports.',
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
        text: ',',
        citations: [],
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
        text: ',',
        citations: [],
      },
      {
        text: 'never keeps a diff when degraded but requires it again',
        citations: [],
      },
      {
        text: ', and',
        citations: [],
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
        text: ';',
        citations: [],
      },
      {
        text: 'every explicit choice of one instance applies at once, so one block may resolve to a mix of taken and kept paths, keeping mine on a `structure` or `removed_root` collision materializes the resolved tree rather than an unchanged copy, and an inconsistent complete answer set is refused atomically 422 `COMPOSITION_VALIDATION_FAILED` with nothing applied and the choices kept;',
        citations: [],
      },
      {
        text: 'verification covers the collision marking and kinds, the new-root list and its placement request, the 128-path and 256 KiB bounds, `bulkEligible` and the focus on the first unanswered collision.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 6 ("never keeps a diff when degraded but requires it again": the page test shows the diff is read again on every open and is never cached, but no case degrades a held diff), clause 10 (one explicit choice per instance applies at once; keeping mine on a structure or removed_root collision materializes the resolved tree, and an inconsistent answer set is refused atomically 422: the resolution and the atomic refusal are RPC/pgTAP, the UI only keeps the choices) and clause 11 (verification meta clause: the 128-path and 256 KiB bounds, bulkEligible and the real-browser focus). The bare ",", ";" and ", and" separator fragments (clauses 3, 5, 7, 9) carry no assertion. Cited from the jsdom CmsPatternUpdateDiff component and composition-page tests; no Playwright spec.',
  },
  {
    criterion: 'P2-S12-AC-118',
    text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`) and returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items; generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-15 registers POST /api/v1/cms/compositions/pattern-updates with the strict discriminated `CompositionUpdateRequest` (`accept` with a `targetPatternVersion`, or `detach`; each with 1-32 `instances` of `instanceId`, `expectedVersion` and up to 128 `choices`, plus the entry `expectedVersion`)',
        citations: [],
      },
      {
        text: 'returns the strict `CompositionUpdateResource` as 200 with 1-32 `CompositionInstanceResource` items',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The discriminated CompositionUpdateRequest (accept with a target version, or detach, each with 1-32 instances), the 200 CompositionUpdateResource of 1-32 closed CompositionInstanceResource items with the committed entry ETag, the registry row and the generated OpenAPI are asserted by the contract, Worker and OpenAPI tests listed. No test compares the mounted Hono route table to the registry row (cited with the operation-table and OpenAPI tests). Every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion; the RPC is pgTAP (not cited this pass).',
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
        text: ',',
        citations: [],
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
        text: ',',
        citations: [],
      },
      {
        text: 'a `targetPatternVersion` that is the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`)',
        citations: [],
      },
      {
        text: ', `choices` only for a single-instance request and covering every colliding path (`props`, `structure` and `removed_root`, DEC-193) with `yours` or `theirs` (a missing choice is 422), and',
        citations: [],
      },
      {
        text: 'refuses a bulk request containing a colliding instance as 409 `diff_has_collisions`',
        citations: [],
      },
      {
        text: ';',
        citations: [],
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
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: the bare "," and ";" tiling fragments (clauses 1, 3, 7) carry no assertion of their own; clause 4 (targetPatternVersion is the latest active compatible version above the pinned one, else 422 pattern_version_not_active), clause 5 (choices covering every colliding path with yours or theirs, a missing choice 422) and clause 6 (a bulk request with a colliding instance is 409 diff_has_collisions) are RPC/pgTAP determinations that the Worker only relays (dec193 resolver pgTAP, not cited this pass). Cited: the accept/detach enum, the 1-32 unique instances with their own expectedVersion, and the strong If-Match equal to the entry expectedVersion.',
  },
  {
    criterion: 'P2-S12-AC-120',
    text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision: a hidden or absent instance is 404, a visible instance without edit is 403, an instance must be the newest version of its path and `pending_diff` or an `active` linked instance for `accept` and any linked pattern-origin row, including a `retired` one, for `detach` (any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`, DEC-193), and the entry and instance versions must be current.",
    clauses: [
      {
        text: "CMS-03C-15 serves only an assigned CMS author or editor on each listed instance's revision",
        citations: [],
      },
      {
        text: ':',
        citations: [],
      },
      {
        text: 'a hidden or absent instance is 404',
        citations: [],
      },
      {
        text: ',',
        citations: [],
      },
      {
        text: 'a visible instance without edit is 403',
        citations: [],
      },
      {
        text: ', an instance must be the newest version of its path and `pending_diff` or an `active` linked instance for `accept` and any linked pattern-origin row, including a `retired` one, for `detach` (any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId`, DEC-193), and',
        citations: [],
      },
      {
        text: 'the entry and instance versions must be current.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Approved claim amended; no test is cited for this criterion yet. Native/SQL/browser acceptance remains unverified.',
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
        citations: [],
      },
      {
        text: 'is all-or-nothing for 1-32 instances',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 60/min/user and 120/min/party, a 15,000 ms deadline, no-store and Tier 2',
        citations: [],
      },
      {
        text: 'appends a row for every adopted or detached instance.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (CAS on each instance own version), clause 2 (all-or-nothing for 1-32 instances) and clause 4 (a row appended for every adopted or detached instance) are RPC/pgTAP; clause 3 names a Tier 2 p95 target for which no benchmark exists (the 60/120 buckets, the 15,000 ms deadline and no-store are Worker tests). Cited: the required Idempotency-Key and the strong If-Match equal to the entry expectedVersion (contract and Worker input).',
  },
  {
    criterion: 'P2-S12-AC-122',
    text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions` and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`), and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure or an instance in no admitted state (422 `COMPOSITION_VALIDATION_FAILED`, DEC-193), maps malformed IDs, header or body (400), a missing session (401), a denied edit (403), a hidden or absent instance (404), a non-JSON body (415), the composition limit (429), a registry or RPC deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.composition.v1`, and overwrites nothing on any refusal.',
    clauses: [
      {
        text: 'CMS-03C-15 refuses a stale entry or instance version, `diff_has_collisions` and an idempotency conflict (409 `COMPOSITION_VERSION_CONFLICT`)',
        citations: [],
      },
      {
        text: ', and a target that is not the latest `active` compatible version (422 `pattern_version_not_active`) or a choices or targets schema failure or an instance in no admitted state (422 `COMPOSITION_VALIDATION_FAILED`, DEC-193),',
        citations: [],
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
        text: ', and',
        citations: [],
      },
      {
        text: 'overwrites nothing on any refusal.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (409 for a stale entry or instance version, diff_has_collisions and an idempotency conflict: the Worker proves the stale-version plain conflict and the diff_has_collisions reasonCode against stubbed ports; no Worker case maps an idempotency conflict, and the determinations are RPC/pgTAP), clause 1 (422 pattern_version_not_active, the choices or targets schema failure and an instance in no admitted state: the determination is RPC/pgTAP) and clause 4 (overwrites nothing on any refusal, pgTAP); the bare ", and" fragment (clause 3) carries no assertion. Clause 2 (the 400/401/403/404/415/429/502-504/500 mappings) is cited from the Worker route, admission, refusal and fault suites against stubbed ports.',
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
        text: ',',
        citations: [],
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
        text: ',',
        citations: [],
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
        text: ',',
        citations: [],
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
        text: ',',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 10 (verification meta clause: theirs-only adoption and retained overrides are RPC/pgTAP resolution semantics, bulk all-or-nothing is the RPC, and the real-browser focus); the bare "," and ", and" tiling fragments (clauses 1, 3, 5, 7) carry no assertion. Clauses 0, 2, 4, 6, 8 and 9 are cited from the jsdom list, diff and composition-page tests and the update request/command builders; no Playwright spec.',
  },
  {
    criterion: 'P2-S12-AC-124',
    text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null) and returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`); generated OpenAPI and the discovered Hono route match the registry row.',
    clauses: [
      {
        text: 'CMS-03C-16 registers POST /api/v1/cms/taxonomies/versions with the strict `TaxonomyVersionRequest` (`taxonomyKey`, `shape` `flat` or `hierarchical`, 1-64 unique `allowedTypeKeys`, 1-64 unique `allowedFieldKeys`, 0-6 unique `canonicalOverlapDomains`, `expectedVersion` or null)',
        citations: [],
      },
      {
        text: 'returns the strict `TaxonomyVersionResource` as 201 for a `draft` version (`taxonomyId`, `taxonomyKey`, `taxonomyVersion`, `shape`, both allowlists and `canonicalOverlapDomains`)',
        citations: [],
      },
      {
        text: 'generated OpenAPI and the discovered Hono route match the registry row.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'Unproven for citation purposes: none by assertion. The strict TaxonomyVersionRequest (key, shape, allowlists, up to six canonical domains, expectedVersion or null), the strict 201 draft TaxonomyVersionResource, the registry row, the generated OpenAPI, the transport table and the first-party route set are asserted by the contract, Worker, web and OpenAPI tests listed; no test compares the mounted Hono route table to the registry row. Every clause would be cited, so the whole entry is held until root regenerates receipts and decides promotion; the RPC is pgTAP (not cited this pass).',
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
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 4 (the never-reused (owner, key, version) triple) is database behaviour (pgTAP, not cited this pass). Every other clause is cited from the wire-contract tests (key grammar, shape enum, allowlist bounds, six canonical domains, expectedVersion null or a positive decimal) and the Worker write boundary (a first draft with a declared but unbuilt domain and a stale MFA is accepted).',
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
        citations: [],
      },
      {
        text: 'a hidden owner or taxonomy is 404',
        citations: [],
      },
      {
        text: 'a readable taxonomy without the capability is 403',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (a verified human holding cms.taxonomy_curator in the caller owner scope: the Worker gates curator capability and acting party, the owner-scope decision is the RPC) and clause 2 (a hidden owner or taxonomy is 404, RPC/pgTAP, not cited this pass). Cited: server-derived context (named create RPC with server context, caller authority and query keys strictly rejected), the Worker 403 for an absent curator, no step-up required (a stale MFA is accepted, the provider stale proof uses step-up NONE) and the closed draft resource without owner or authority members. Withheld: 1 identified test identity occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
  },
  {
    criterion: 'P2-S12-AC-127',
    text: "CMS-03C-16 requires an `Idempotency-Key`, takes `expectedVersion` as the parent version's `version` when editing (the strong `If-Match` equal to it) and `null` when creating a new lineage, enforces the per-owner unique (key, version) and CAS, enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2, and emits no event (activation is CMS-03C-09).",
    clauses: [
      {
        text: 'CMS-03C-16 requires an `Idempotency-Key`',
        citations: [],
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
        ],
      },
      {
        text: 'enforces the per-owner unique (key, version) and CAS',
        citations: [],
      },
      {
        text: 'enforces rate buckets of 30/min/user and 60/min/party, a 15,000 ms deadline, no-store and Tier 2',
        citations: [],
      },
      {
        text: 'emits no event (activation is CMS-03C-09).',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (no Worker or contract case for a missing or malformed Idempotency-Key was found for CMS-03C-16), clause 2 (per-owner unique (key, version) and CAS, RPC/pgTAP), clause 3 (30/60 buckets are Worker tests, but the clause also names the Tier 2 p95 target with no benchmark) and clause 4 (no event, RPC/pgTAP). Cited: expectedVersion null for a new lineage or the parent version with the strong If-Match equal to it (contract; Worker refuses weak, star, wrong and absent successor If-Match and sends a decoded RPC operand).',
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
        ],
      },
      {
        text: 'a hidden or absent taxonomy scope (404)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves hidden 404 instead of returning an empty versions page',
          },
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves exact taxonomy catalog RPC code TAXONOMY_NOT_FOUND without prose',
          },
        ],
      },
      {
        text: 'a stale parent, key or version or an idempotency conflict (409 `TAXONOMY_VERSION_CONFLICT`)',
        citations: [
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-definition-production.test.ts',
            title:
              'taxonomy fixed production RPC boundary preserves exact taxonomy catalog RPC code TAXONOMY_VERSION_CONFLICT without prose',
          },
        ],
      },
      {
        text: 'a non-JSON body (415)',
        citations: [],
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
        ],
      },
      {
        text: 'the taxonomy-write limit (429), a canonical registry or RPC deadline (502/503/504 `DEPENDENCY_UNAVAILABLE`) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1`',
        citations: [],
      },
      {
        text: 'with no vocabulary row after a refusal.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 3 (a non-JSON body is 415: no CMS-03C-16 case was found), clause 5 (the taxonomy-write limit 429, a registry or RPC deadline 502/503/504 as DEPENDENCY_UNAVAILABLE and an internal 500: the quota, scrub and 502 cases exist but no case maps 503/504 for this operation, so the clause is not cited) and clause 6 (no vocabulary row after a refusal, RPC/pgTAP). Cited: 400/401/403 TAXONOMY_FORBIDDEN, the hidden 404, the TAXONOMY_VERSION_CONFLICT 409 mapping and the TAXONOMY_VALIDATION_FAILED code mapping from the Worker write, admission and production-transport suites against stubbed RPC replies. Withheld: 1 identified test identity occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
  },
  {
    criterion: 'P2-S12-AC-129',
    text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`, which builds `TaxonomyVersionRequest` from the key, the shape, type-key and field-key allowlists as validated tag lists (grammar `^[a-z][a-z0-9_]{1,63}$`, 1-64 unique) and a checkbox group of the six canonical domains that shows which have a provider ("Checks available" or "Not available yet; this vocabulary cannot activate while declared"), summarizes the reviewer-visible declaration before submit and exposes group labels and descriptions programmatically; verification covers allowlist bounds, the domain declaration, the provider-availability text per domain and the focused result heading.',
    clauses: [
      {
        text: 'CMS-03C-16 is consumed by the protected `CmsTaxonomyVersionDesigner` at `/app/cms-content-modeling/taxonomies/new` and `/app/cms-content-modeling/taxonomies/:taxonomyId`',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 0 (route-level consumption by the designer at /app/cms-content-modeling/taxonomies/new and /:taxonomyId: the page tests read the Astro source as text) and clause 4 (verification meta clause: the focused result heading in a real browser; no Playwright spec exists for the taxonomy surfaces). Clauses 1-3 are cited from jsdom component and request-builder tests.',
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
        ],
      },
      {
        text: 'ordered by the signed keyset `(taxonomyKey ASC, termKey ASC)`.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (ordered by the signed keyset (taxonomyKey ASC, termKey ASC)): the Worker accepts a page ordered by vocabulary then term key and refuses duplicates and out-of-order pages, but the signed cursor and the ordering itself are RPC/pgTAP (not cited this pass). Cited: the strict TaxonomySelectorQuery, registry rows and the strict TaxonomySelectorPage (100 terms, opaque cursor of at most 512, page version) with the eight-member term and a nullable label.',
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
        ],
      },
      {
        text: 'returns `label` null, with no fallback to another locale, when a term has no label for the requested locale.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (a term with no label for the requested locale returns label null with no fallback to another locale) is RPC/pgTAP behaviour (not cited this pass; the contract only allows a nullable label). The "signed" property of the cursor is the RPC; the Worker and contract prove the 512-character bound. Cited: the key and locale grammar, limit 1-100 with default 50, every other query key, a body and any mutation header refused.',
  },
  {
    criterion: 'P2-S12-AC-132',
    text: 'CMS-03C-17 requires a verified human holding `cms.author` or `cms.editor` in the owner party and lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term; a hidden or absent vocabulary is 404 and no owner or authority field is serialized.',
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
        ],
      },
      {
        text: 'lists only `active` terms of the `active` vocabularies of that owner whose allowlist names the requested content type key and field key, never a `merged` or `deprecated` term',
        citations: [],
      },
      {
        text: 'a hidden or absent vocabulary is 404',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (only active terms of active vocabularies of that owner whose allowlist names the type key and field key, never a merged or deprecated term) and clause 2 (the concealed 404 for a caller outside the owner organization; an absent vocabulary yields an empty page, so the clause wording may need an owner adjustment) are RPC/pgTAP (not cited this pass). Cited: the Worker admission (cms.author or cms.editor may read, the curator capability alone is 403 capability_missing with no quota and no port) and the selector term contract, which carries no owner or authority member.',
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
        ],
      },
      {
        text: 'with a signed keyset cursor over `(taxonomyKey ASC, termKey ASC)` bound to the query and acting scope',
        citations: [],
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
        ],
      },
      {
        text: 'read buckets of 300/min/user and 600/min/party, an 8,000 ms deadline and the Tier 1 p95 < 750 ms target.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 1 (the signed keyset cursor over (taxonomyKey ASC, termKey ASC) bound to the query and acting scope) is RPC/pgTAP; clause 4 names a Tier 1 p95 < 750 ms target with no benchmark (hosted evidence; the 300/600 buckets and the 8,000 ms deadline are Worker tests). Cited: the strict page served no-store with a quoted page-version ETag (the read refuses write headers and a body, see AC-131), and the default limit 50 and maximum 100 at the contract.',
  },
  {
    criterion: 'P2-S12-AC-134',
    text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent vocabulary (404), an unsupported body if sent (415), a cursor/context mismatch (409), a query-bound failure (422), the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
    clauses: [
      {
        text: 'CMS-03C-17 maps a malformed query or cursor (400), a missing session (401), an author/editor scope failure (403), a hidden or absent vocabulary (404), an unsupported body if sent (415)',
        citations: [
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
              'CMS-03C-17 selector route refuses a foreign origin, a content-type, a write header and a body',
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
          {
            tool: 'vitest',
            file: 'apps/worker/src/cms-composition/taxonomy-selector-read.test.ts',
            title: 'CMS-03C-17 selector route relays the port refusal 404',
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
        ],
      },
      {
        text: 'the read limit (429), a read dependency or deadline (502/503/504) and an internal failure (500) to typed ApiError of catalog `cms.03c.taxonomy.v1` with no audit or outbox effect.',
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 2 (the read limit 429, a read dependency or deadline 502/503/504 and an internal failure 500 to the cms.03c.taxonomy.v1 catalog with no audit or outbox effect): the selector route has quota-bucket, deadline-during-quota and 503-relay guard cases, but no selector-specific 429 Retry-After and no 500 scrub case was found, so the clause is not cited; the no audit/outbox effect of the reader is pgTAP. Clauses 0 and 1 are cited from the Worker selector route and admission suites against stubbed ports. Withheld: 2 identified test identities occur more than once in their file (ambiguous for a receipt) and are not cited; see the evidence-cite lane report.',
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven: clause 6 ("verification covers merged and deprecated terms never being listed and the term_unavailable recovery"): the exclusion of merged and deprecated terms is proven at the database (pgTAP, not cited this pass) and no Playwright spec drives the taxonomy field. Clauses 0-5 are cited from jsdom component tests of CmsTaxonomyFieldEditor and its three hosts (entry create CMS-03B-01, entry editor CMS-03B-10, conflict resolve CMS-03B-11).',
  },
  {
    criterion: 'P2-S12-AC-136',
    text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`, taking the strict `CanonicalTaxonomyMatchRequest` (`domain` one of the six canonical domains, 1-64 `candidates` of 1-160 characters) and returning the discriminated `CanonicalTaxonomyMatchResult` (`no_match`; `match` with `domain`, `canonicalId` and `canonicalKind`; or `source_unavailable` with `domain`); it has no browser route, proxy or client type and is absent from the browser route inventory.',
    clauses: [
      {
        text: 'CMS-03C-18 is exactly one database RPC, `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)`',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (exactly one database RPC platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)) is a database fact (pgTAP, not cited this pass). Cited: the strict CanonicalTaxonomyMatchRequest (six closed domains, 1-64 candidates of 1-160 characters), the discriminated CanonicalTaxonomyMatchResult, and the registry/OpenAPI test that keeps CMS-03C-18 to -21 out of the browser inventory (no route or proxy; the contract test does not prove the absence of a client type beyond the inventory).',
  },
  {
    criterion: 'P2-S12-AC-137',
    text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality only, never fuzzy-matches, accepts one domain and at most 64 candidates per call, and returns `source_unavailable` for a domain whose provider is `unbuilt`.",
    clauses: [
      {
        text: "CMS-03C-18 compares each NFC candidate (key, label or alias) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality only",
        citations: [],
      },
      {
        text: 'never fuzzy-matches',
        citations: [],
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
        citations: [],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (NFKC, lowercase, trim and whitespace-collapse normalization with exact equality), clause 1 (never fuzzy-matches) and clause 3 (source_unavailable for an unbuilt provider) are RPC/pgTAP behaviour (not cited this pass). Cited: the one-domain, at-most-64-candidates (1-160 characters each) request bounds at the contract.',
  },
  {
    criterion: 'P2-S12-AC-138',
    text: "CMS-03C-18 is executable only by its database-internal callers, `cms_act_taxonomy_term` and the taxonomy-version activation preflight (PUBLIC, anon, authenticated and every other role have EXECUTE revoked), reads only the domain's named read-only projection and never another shard's store directly (DEC-100), and returns only a canonical id and kind, never canonical content.",
    clauses: [
      {
        text: 'CMS-03C-18 is executable only by its database-internal callers, `cms_act_taxonomy_term` and the taxonomy-version activation preflight (PUBLIC, anon, authenticated and every other role have EXECUTE revoked)',
        citations: [],
      },
      {
        text: "reads only the domain's named read-only projection and never another shard's store directly (DEC-100)",
        citations: [],
      },
      {
        text: 'returns only a canonical id and kind, never canonical content.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'CMS-03C-18 is not built (no RPC, grants or provider projection), so the EXECUTE revocation from PUBLIC, anon, authenticated and every other role, the named-projection-only read and the id-and-kind-only result are unproven.',
  },
  {
    criterion: 'P2-S12-AC-139',
    text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call, and applies the 2,000 ms provider timeout, so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
    clauses: [
      {
        text: 'CMS-03C-18 is read-only, bounded to 64 candidates and one domain per call',
        citations: [],
      },
      {
        text: 'applies the 2,000 ms provider timeout',
        citations: [],
      },
      {
        text: 'so a call performs no insert, update, delete, audit row or outbox row and a retry is harmless.',
        citations: [],
      },
    ],
    status: 'unverified',
    limitation:
      'CMS-03C-18 is not built (no RPC), so read-only behaviour (no insert, update, delete, audit or outbox row), the 64-candidate and one-domain bounds and the 2,000 ms provider timeout are unproven.',
  },
  {
    criterion: 'P2-S12-AC-140',
    text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write, returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`, and never returns a success-shaped body on a fault.',
    clauses: [
      {
        text: 'CMS-03C-18 treats a provider fault or timeout as 503 `DEPENDENCY_UNAVAILABLE` for the calling command with no editorial write',
        citations: [],
      },
      {
        text: 'returns the typed `source_unavailable` outcome (never a `no_match`) for an unbuilt domain so that the caller can refuse `canonical_source_unavailable`',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (a provider fault or timeout is 503 DEPENDENCY_UNAVAILABLE for the calling command with no editorial write) and clause 1 (the typed source_unavailable outcome, never no_match, for an unbuilt domain) are RPC/pgTAP behaviour (not cited this pass). Cited: the contract refuses a result that mixes outcomes, omits members or carries an extra one, so a fault cannot be shaped like a success.',
  },
  {
    criterion: 'P2-S12-AC-141',
    text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) and the taxonomy-version activation preflight; verification covers `match`, `no_match` and `source_unavailable` per domain, exact equality after normalization with no fuzzy match, the `role` provider reading the Shard 02 role facet assertion projection, the provider-fault 503 with no editorial write, and the absence of the RPC from browser routes and generated OpenAPI.',
    clauses: [
      {
        text: 'CMS-03C-18 is consumed only by `cms_act_taxonomy_term` (create, rename and alias) and the taxonomy-version activation preflight',
        citations: [],
      },
      {
        text: 'verification covers `match`, `no_match` and `source_unavailable` per domain',
        citations: [],
      },
      {
        text: 'exact equality after normalization with no fuzzy match',
        citations: [],
      },
      {
        text: 'the `role` provider reading the Shard 02 role facet assertion projection',
        citations: [],
      },
      {
        text: 'the provider-fault 503 with no editorial write',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 (consumed only by cms_act_taxonomy_term and the activation preflight; the ACL test is pgTAP), clauses 1-4 (match / no_match / source_unavailable per domain, exact equality after normalization, the role provider over the role facet assertion projection, provider-fault 503 with no editorial write) are RPC/pgTAP (not cited this pass). Cited: the registry/OpenAPI test that keeps the internal CMS-03C-18 to -21 operations out of the browser inventory and generated OpenAPI.',
  },
  {
    criterion: 'P2-S12-AC-142',
    text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`: `platform_private.cms_claim_due_governed_activations(batch)` taking an integer 1-100 and returning at most `batch` strict `ClaimedGovernedActivation` records (`scheduleId`, `reviewId`, `subjectKind`, `subjectId`, `scheduleVersion`, `expectedVersion`, `leaseId`, `correlationId`), and `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` returning the strict `GovernedActivationExecutionResult` (`completed`, `blocked`, `failed_retryable` or `already_completed`, with `reasonCode`, `actualUtc` and `deviationSeconds`); neither is a browser route, proxy or client type.',
    clauses: [
      {
        text: 'CMS-03C-19 is exactly two database RPCs run by the Worker `scheduled` sweep as BE00 job type `cms.governed_activation.execute`',
        citations: [],
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
        ],
      },
    ],
    status: 'partial',
    limitation:
      'Unproven at the Vitest layer: clause 0 ("exactly two database RPCs run by the Worker scheduled sweep as BE00 job type cms.governed_activation.execute") is a database fact (pgTAP, not cited this pass); the contract and Worker tests prove the job type name and that only the scheduled sweep imports the claim/execute port. Cited: the claim batch of 1-100 and strict claimed record, the claim and execute client calls, the closed execution outcome, and that neither operation is a browser route, proxy or client module.',
  },
];
