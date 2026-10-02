# Phase 2 — Claude checkpoint handoff

**Checkpoint date:** 2026-10-02 UTC.  
**Purpose:** preserve the current work in a draft PR and transfer continuation
context to Claude. This is not implementation acceptance or merge readiness.
**Base:** `f0bde9f1c38f2951805c2137eeb31c66a8c84d82` (`origin/main` at checkpoint preparation).
Use the draft PR's actual head commit as the saved checkpoint identity.

## Start here

1. Read `AGENTS.md`, the active project rules/instructions and applicable skills.
2. Read this file, then the exact [DEC-108 approval record](../../.memory/pipeline/progress/verification/2026-10-02-slice-09-activation-amendment-approval.md)
   and [approved amendment](../../.memory/pipeline/progress/verification/2026-10-01-slice-09-activation-contract-amendment-proposal.md).
   The owner explicitly approved the amendment; do not ask for that approval again.
3. Inspect the PR head, working-tree status and
   [Slice 09 tracker](../../.memory/pipeline/progress/slices/phase-02-slice-09.md).
   Treat the current numerical totals as the pre-amendment baseline, not final
   amended denominators. Preserve existing work; no reset/revert/broad deletion.
4. Finish the source/plan/contract cascade before QA-RED and implementation.
   Resume **Slice 09**, not Slice 10 or 12. Earlier downstream code is saved but
   remains unaccepted and gated.

Original local workspace used for this checkpoint:
`/home/rob/.codex/worktrees/ac265-hosted-evidence-producer/WeJammin`.
It was on `codex/s10-entry-revisions` before checkpoint branch creation.
Use the checked-out PR repository on another machine, not this absolute path.

## Current status — do not promote acceptance

| Item                | Verified baseline / disposition                                                            |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Phase 2             | 8/17 slices; overall 15/24                                                                 |
| Slice 09            | 262/279 active, 283 authored; 17 activation criteria open                                  |
| Phase 2 criteria    | 1,475/2,011 active checked, 2,015 authored                                                 |
| Slice 10 / Slice 12 | 0/75 and 0/50; implementation prerequisites not cleared                                    |
| AC250               | Independently verified local Chrome disclosure/accessibility criterion; retain regressions |
| AC209 / AC211       | Authored, unchecked post-deployment / post-launch evidence gates                           |
| AC265 / AC266       | Authored, unchecked mandatory pre-release gates; not waived                                |

The 17 open Slice 09 activation IDs are AC087, AC089–093, AC095–099,
AC101–102, AC169, AC191, AC217 and AC225 (`P2-S09-AC-*`). New amendment criteria
must be added contiguously from AC284 and remain open. **279 is not the final
denominator after adding the approved producer contracts.** Recompute the
source-derived depth floor, source coverage and all dependent totals/guards.
Older tracker entries still mention 18 reopened criteria; the current header
and the exact 17-ID list above control this checkpoint's baseline.

## Approved architecture and retained boundaries

DEC-108 approves CMS-owned private reviews, append-only decisions and bounded
assignments, not reuse of CFG settings reviews. The six new operations are:

- CMS-03A-09: successor draft from an immutable schema version.
- CMS-03A-10: actual queued dry-run attempt/report/plan/job, not caller evidence.
- CMS-03A-11: freeze passed candidate/dry-run/policy evidence and submit review.
- CMS-03A-12: append an independent assigned human's approve/reject decision.
- CMS-03A-13: protected, nonmutating review detail.
- CMS-03A-14: owner-only bounded assignment/revocation for one frozen review.

Private records: `cms_schema_reviews`, `cms_schema_review_decisions`,
`cms_schema_review_assignments`, with ENABLE/FORCE RLS and revoked direct table
access. Reviewers get only `cms.schema_review` read/decide, not admin/design/
publishing authority. The owner remains the sole admin. Assignment authority is
server-derived from the immutable owner initialization receipt plus current
effective owner authority; do not rerun or widen the four-capability bootstrap.
Assignments last no more than seven days or the grantor's authority, whichever
ends first. No pre-existing review/design/admin grant is needed for an eligible
existing human; the assignment is the review-only authority producer.

Keep actor/person/party/binding matching identifiers server-side. Browser CMS
props receive safe registry resources, a verified context label and MFA expiry,
not raw IDs or a new hashed context-correlation token. Ordinary policy needs
one independent reviewer, protected policy at least two; resolve exact count
1..8 from the code-owned policy. Recent MFA is verified when a decision commits;
activation rechecks current authority and activator MFA, not an arbitrary
ten-minute decision-age shortcut. Drift invalidates frozen review evidence.

Only minimum prerequisites move into Slice 09: already approved protected entry
create/draft read, actual source scanning and registered pure transforms,
CMS-03C-01 immutable template draft creation, and service-only nonmutating
`platform_api.cms_resolve_template_compatibility`. The resolver binds exact
`templateVersionId`, `contentTypeId`, `contentTypeVersionId`, with optional
`expectedTemplateVersionNo`; no implicit current version. Incompatible,
withdrawn or concealed targets cannot produce a successful compatibility claim.
Public template activation remains a separate Slice 12 gap, not AC169's gate.

Contract approval creates no real account, grant, assignment, deployment,
provider enrollment, paid plan or acceptance receipt. Chrome only for browser
work; no Brave, Orca or in-app-browser substitution. No paid Google Workspace.
Do not put credentials or private keys in chat, PRs, evidence or logs. The user's
latest subagent preference is Command Code DeepSeek
`commandcode/deepseek-deepseek-v4.1-flash` where available.

## Saved work and exact incomplete boundary

The checkpoint also contains earlier Slice 09 auth/private-binding transport,
AC250 Chrome and source-link tests, AC265/AC266 evidence-tooling improvements,
and earlier Slice 10 editorial / Slice 12 composition code and migrations.
DEC-106 protected entry-create/draft-read and DEC-107 private conflict-table
approvals remain valid. Their presence does not close downstream slices.

This approval turn updated IA03/deep dive, reciprocal IA05/BE05b boundaries,
BE03a/03b/03c and FE03/indexes, approval/proposal/decision records and
count-preserving progress notes. BE03a now describes fourteen CMS-03A operations
(eleven first-party mutations and three protected reads), twelve canonical
definition tables plus three private CMS review records. The 03c compatibility
resolver is a separate reciprocal dependency. The detailed spec cascade needs
a fresh ambiguity/consistency review before being treated as an audited lock.

**Contract Phase 0 is partial.** New schemas were written in:

- `packages/contracts/src/content-schema-registry/models-enums.ts`
- `packages/contracts/src/content-schema-registry/requests-human.ts`
- `packages/contracts/src/content-schema-registry/resources-workflow.ts` (new)
- `packages/contracts/src/content-schema-registry/resources.ts`
- `packages/contracts/src/content-schema-registry/resources-aggregates.ts`

Requests: `SchemaSuccessorRequestSchema`, `SchemaDryRunRequestSchema`,
`SchemaReviewSubmissionRequestSchema`, `SchemaReviewDecisionRequestSchema`,
`SchemaReviewAssignmentRequestSchema`. Resources include dry-run/review/decision/
assignment, frozen evidence and `SchemaActivationPreparationSchema`.
Unsealed dry runs carry no final result/counts/hashes; completed reports seal
actual evidence. The detail now requires `activationPreparation`, so existing
fixtures/projections may need legitimate schema-alignment work after RED tests.

**Not finished:** six-operation route-policy/type unions, capabilities and
platform registry rows; complete OpenAPI component wiring/generation; private
review/successor/dry-run/assignment RPCs/migrations; Worker handlers and real
scanner/transform integration; protected UI and review route; exact floor/new
criteria/count cascade; graph refresh; new RED→GREEN evidence. No new activation
acceptance was claimed. All agents stopped at the user's checkpoint request.

## Verification — current snapshot is not green

One fresh full `pnpm validate` ran after freezing this checkpoint using Node
22.23.1 / pnpm 11.24.0. **Exit 1 at the first gate:**

```text
pnpm contracts:check
node infra/generate-openapi.mjs --check
OpenAPI contract drift detected. Run pnpm contracts:generate.
```

Log: `/tmp/tmp.1brqKMEi8d/validate.log` on the original host. Because the chain
short-circuited, DB type drift, progress, formatting, lint, type checks, coverage,
evidence tests, Chrome, builds, bundle and performance gates **did not run**.
New contract compile validity and any later failures remain unverified.
Do not describe this as a passing run or as a proven pre-existing regression.
Finish the actual contract/registry batch before regenerating OpenAPI; do not
merely refresh output to conceal an incomplete approved surface.

Historical baseline, before the new amendment schemas: full validation exited
0 with 790 Vitest files, 6,812 passed / 1 skipped, configured coverage 100%,
105 functional Chrome checks and 18 production-built route checks. That evidence
is recorded in the earlier tracker/session; it does not validate this PR head.
Prior DB evidence was 90 files / 3,033 assertions and 13 private-binding
adversarial checks. Local evidence never substitutes for hosted/release proof.

## Concrete continuation sequence

1. Review the approved source sections and finish the exact depth-floor ledger.
   A draft BE ledger existed but grouped some field/error/role items too coarsely;
   use the authoritative `slice-depth-floor.md` formula, not a desired count.
   Add new open ACs and update plan, S09/10/12 prerequisite notes, phase/index/
   spec-pipeline counts and consistency/trace/source-link guards together.
2. Finish Phase 0 contracts, route/OpenAPI/registry metadata and named template
   compatibility schemas. Review job-state alignment and fixed read/decide
   assignment tuple. Regenerate through `pnpm contracts:generate` only after
   inputs describe the complete approved surface.
3. Author comprehensive QA-RED tests before behavior changes. Use disjoint
   subagent ownership; root owns shared contract integration. Do not relax
   genuine implementation-trace failures into passing metadata checks.
4. Implement forward-only migrations and protected handlers/UI. Replace the
   existing CFG `setting_value` review misuse, stable-context hash mismatch,
   `/v1` artifact-reference hardcode, and ten-minute decision-age check.
   Reuse actual worker dry-run/backfill/verification seams, not synthetic counts.
   Entry bootstrap's fail-closed editorial-policy evidence seam and missing
   production template-route registration also need real producers.
5. Exercise real create → dry-run → review → independent decisions → activation;
   then real source rows → compatible template → successor → nonzero scan/
   backfill/verify → independent review → second atomic switch. Never insert
   review/decision/report/approved/completed-plan rows by hand to claim this.
6. Run adversarial/anti-cheat, DB, production-built Chrome and full pinned
   validation; retain the same live run handle across waits. Update acceptance
   only from concrete evidence and refresh the spec graph with the project
   compiler after the source/plan cascade is stable.
7. Only after amended Slice 09 implementation acceptance is complete resume
   Slices 10–17 in dependency order. Keep AC209/211/265/266 on their approved
   deployment/launch/pre-release timelines; no synthesized provenance or devices.

No live validator, browser workflow, provider mutation or implementation writer
is left running by this checkpoint handoff. Claude has not been launched or
messaged automatically; this file is the explicit transfer artifact.
